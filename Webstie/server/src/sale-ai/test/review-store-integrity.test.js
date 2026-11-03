import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {SplitStore} from '../lib/split-store.js';
import {audit,applyPlan} from '../lib/store-cleanup.js';
import {POLICY} from '../lib/pricing.js';
import {createSaleAi} from '../core.js';
import {normalizeProduct} from '../lib/kiot.js';
import {Readable} from 'node:stream';
import {updateDetail} from '../lib/view-data.js';

async function temporary(fn){
 const dir=await mkdtemp(join(tmpdir(),'saleai-review-'));
 try{await fn(dir);}finally{await rm(dir,{recursive:true,force:true});}
}
const state=()=>({version:1,cycleVersion:2,policy:POLICY,products:[{id:1,code:'SP1',name:'Túi',currentPrice:35e6}],runs:[],updates:[],prepared:[]});

test('mixed old/new journals and compressed runs have deterministic audits and apply safely',()=>temporary(async dir=>{
 const store=new SplitStore(join(dir,'kiot-state.json')),s=state();
 s.runs=Array.from({length:7},(_,id)=>({id,rows:[{notesBefore:'Gốc '.repeat(id?20000:1)}]}));
 const old={id:'old',mode:'joint-v1',items:[{id:1,code:'SP1',before:{notes:'Gốc'}}]};
 s.updates=[old,...Array.from({length:3},(_,id)=>({id,journalVersion:2,mode:'joint-v1',kiotDescription:false,items:Array.from({length:101},(_,i)=>({id:i,code:'SP'+i,before:{currentPrice:35e6,notes:'Gốc'},row:{price:34e6},platforms:{kiot:{status:'done'}}})),attempts:[]}))];
 await store.write(s);const orphan=await store.put({unreferenced:true});
 const plan=await audit(dir);
 for(let i=0;i<4;i++)assert.deepEqual(await audit(dir),plan);
 const paths=new Set();const manifest=JSON.parse(await readFile(store.manifestPath,'utf8'));
 for(const [collection,digest] of Object.entries(manifest.indexes)){
  paths.add(digest);for(const ref of JSON.parse(await readFile(join(store.blobs,digest+'.json'),'utf8'))){
   paths.add(ref);if(collection==='updates'){
    const record=JSON.parse(await readFile(join(store.blobs,ref+'.json'),'utf8'));
    for(const child of record.itemChunks||[])paths.add(child);
   }
  }
 }
 let bytes=0;for(const digest of paths)bytes+=(await stat(join(store.blobs,digest+'.json'))).size;
 assert.equal(plan.stores[0].keptBytes,bytes);
 assert.deepEqual(plan.stores[0].candidates.map(c=>c.name),[orphan+'.json']);
 assert.equal((await applyPlan(dir,plan)).deletedFiles,1);
 const restored=await new SplitStore(store.path).read();assert.deepEqual(restored.runs,s.runs);assert.deepEqual(restored.updates[0],old);
 assert.equal(restored.updates[1].items.length,101);
}));

test('disk-backed background update returns complete refreshed API rows and skips repeat selection',()=>temporary(async dir=>{
 const products=[1,2].map(id=>normalizeProduct({id,code:'SP'+id,name:'Túi '+id,basePrice:35e6,createdDate:'2026-09-01',description:'Kiot gốc',isActive:true,inventories:[{branchId:44466,onHand:1}]}));
 const writes=[];let modified=[];
 const client={all:async()=>structuredClone(products),listModified:async()=>structuredClone(modified),
  updateMany:async entries=>{modified=[];for(const {product,fields} of entries){const actual=products.find(p=>p.id===product.id);actual.currentPrice=fields.basePrice;modified.push(actual);writes.push(actual.code);}}};
 const blocked=()=>{throw Error('Network disabled');};
 const sale=await createSaleAi({fixture:true,store:new SplitStore(join(dir,'state.json')),liveStore:new SplitStore(join(dir,'kiot-state.json')),sapoStore:new SplitStore(join(dir,'sapo-state.json'),{kind:'sapo'}),
  client,sapoClient:{all:blocked,product:blocked,update:blocked},sapoWrite:false,kiotDescription:false,batchWrites:true,readSapoOnStartup:false,clock:()=>new Date('2026-11-16T03:00:00Z')});
 sale.live.timingSink=()=>{};
 const request=async(path,body)=>{
  const req=Readable.from(body===undefined?[]:[JSON.stringify(body)]);req.url=path+(path.includes('?')?'&':'?')+'dataset=real';req.method=body===undefined?'GET':'POST';req.headers={'content-type':'application/json'};
  let code,result;await sale.handler(req,{writeHead:s=>{code=s;},end:raw=>{result=JSON.parse(raw);}});assert.ok(code<400,JSON.stringify(result));return result;
 };
 await sale.refreshTable();
 const first=await request('/api/kiot/update',{runId:sale.real.state.runs[0].id,codes:['SP1'],confirmed:true});await sale.waitForJob(first.id);
 assert.equal((await request('/api/jobs/'+first.id)).status,'completed');
 const run=(await request('/api/view?view=results')).runs[0],row=run.rows.find(r=>r.code==='SP1');
 assert.equal(row.currentPrice,row.price);assert.equal(row.notesBefore,'Kiot gốc');assert.ok(row.liveReadAt);
 assert.deepEqual((await request('/api/kiot/selection?runId='+run.id)).codes,['SP2']);
 const again=await request('/api/kiot/update',{runId:run.id,codes:['SP1'],confirmed:true});await sale.waitForJob(again.id);
 const update=(await request('/api/jobs/'+again.id)).result;assert.equal(update.items[0].status,'unchanged');assert.equal(update.issueCount,0);assert.deepEqual(writes,['SP1']);
 const detail=updateDetail(sale.real.state,update.id,new URLSearchParams({filter:'unchanged'}));assert.equal(detail.pagination.total,1);assert.equal(detail.pagination.items[0].code,'SP1');
 await sale.shutdown();
}));

test('cleanup retains every published compact checkpoint, including after cache reuse and restart',()=>temporary(async dir=>{
 const store=new SplitStore(join(dir,'kiot-state.json')),s=state();await store.write(s);
 const snapshots=[];
 for(const status of ['journaled','ready','sending','done']){
  s.updates=[{id:'u',journalVersion:2,mode:'joint-v1',kiotDescription:false,items:[{id:1,code:'SP1',before:{notes:'Gốc',currentPrice:35e6},row:{price:34e6},platforms:{kiot:{status}}}]}];
  await store.write(s,{stableRuns:true,cleanup:true});snapshots.push(await readFile(store.manifestPath,'utf8'));
 }
 const final=snapshots.at(-1);assert.equal((await audit(dir)).stores[0].candidates.length,0);
 for(const text of snapshots){
  await writeFile(store.manifestPath,text);
  const restored=await new SplitStore(store.path).read();assert.equal(restored.updates[0].items.length,1);
 }
 await writeFile(store.manifestPath,final);
 const damaged=JSON.parse(final);damaged.recoveryIndexes[0].products='bad';await writeFile(store.manifestPath,JSON.stringify(damaged));
 await assert.rejects(audit(dir),/Invalid blob reference/);await writeFile(store.manifestPath,final);
 // A quiescent save retires recovery roots atomically; GC can then remove superseded data.
 await store.write(s,{cleanup:true});assert.equal((await audit(dir)).stores[0].candidates.length,0);
 assert.equal(JSON.parse(await readFile(store.manifestPath,'utf8')).recoveryIndexes,undefined);
}));

test('identical concurrent blobs share one durable write',()=>temporary(async dir=>{
 let writes=0;const store=new SplitStore(join(dir,'kiot-state.json'),{fault:async stage=>{if(stage==='beforeBlob')writes++;}});
 await store.write(state());writes=0;
 const refs=await Promise.all(Array.from({length:16},()=>store.put({same:'blob'})));
 assert.equal(new Set(refs).size,1);assert.equal(writes,1);assert.deepEqual(await store.get(refs[0]),{same:'blob'});
}));
