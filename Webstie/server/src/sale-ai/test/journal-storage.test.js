import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {Readable} from 'node:stream';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {SplitStore} from '../lib/split-store.js';
import {Simulator} from '../lib/service.js';
import {LiveService,fingerprint} from '../lib/live.js';
import {normalizeProduct} from '../lib/kiot.js';
import {updateDetail,viewData} from '../lib/view-data.js';
import {audit} from '../lib/store-cleanup.js';
import {createSaleAi} from '../core.js';
import {liveDraft} from '../lib/live-draft.js';

async function retrySelection(f,state,id){
 const memory=()=>({read:async()=>null,write:async()=>{}}),blocked=async()=>{throw Error('Sapo forbidden');};
 const sale=await createSaleAi({fixture:true,store:memory(),liveStore:memory(),sapoStore:memory(),client:f.client,sapoClient:{all:blocked,product:blocked,update:blocked},sapoWrite:false,kiotDescription:false,clock:f.clock});
 sale.real.state=state;
 const req=Readable.from([]);req.url='/api/kiot/retry-selection?updateId='+id;req.method='GET';req.headers={};
 let status,body;await sale.handler(req,{writeHead:code=>{status=code;},end:raw=>{body=JSON.parse(raw);}});
 assert.equal(status,200);return body;
}

async function fixture(n=2){
 const dir=await mkdtemp(join(tmpdir(),'task126-test-')),path=join(dir,'kiot-state.json');
 const store=new SplitStore(path),clock=()=>new Date('2026-11-16T03:00:00Z');
 const products=Array.from({length:n},(_,i)=>normalizeProduct({id:i+1,code:'SP'+(i+1),name:'Túi '+i,basePrice:35e6,createdDate:'2026-09-01',description:'Gốc '+i,isActive:true,inventories:[{branchId:44466,cost:1,onHand:1}]}));
 const calls={all:0,put:0,modified:[]},stages=[];
 const client={all:async()=>{calls.all++;return structuredClone(products);},listModified:async since=>{calls.modified.push(since);return structuredClone(products);},product:async id=>structuredClone(products.find(p=>p.id===id)),
 updateMany:async entries=>{calls.put++;for(const e of entries)products.find(p=>p.id===e.product.id).currentPrice=e.fields.basePrice;},
 update:async(p,fields)=>{assert.deepEqual(Object.keys(fields),['basePrice']);products.find(x=>x.id===p.id).currentPrice=fields.basePrice;}};
 const sim=new Simulator(store,{load:async()=>[]},clock);await sim.initialize();
 const live=new LiveService(sim,client,clock);sim.live=live;live.batchWrites=true;live.sapoWrite=false;live.kiotDescription=false;live.timingSink=()=>{};
 const stage=live.stage.bind(live);live.stage=(text,...args)=>{stages.push(text);stage(text,...args);};
 await live.refresh();await sim.run();calls.all=0;
 return {dir,path,store,clock,sim,live,products,client,calls,stages};
}
const prepare=f=>f.live.prepare(f.sim.state.runs[0].id,f.products.map(p=>p.code),{localOnly:true,continueOnError:true});

test('unchanged automatic refresh upgrades a legacy table cursor without changing its historical snapshot',async()=>{
 const f=await fixture();delete f.sim.state.kiotReadAt;const old=f.sim.state.runs[0];old.rows.forEach(r=>delete r.liveReadAt);
 const original=structuredClone(old);await f.live.refresh({onlyWhenChanged:true});
 assert.deepEqual(old,original);assert.ok(f.sim.state.runs[0].rows.every(r=>r.liveReadAt));
 const p=await prepare(f);await f.live.commit(p.id,true);assert.equal(f.calls.all,1);assert.equal(f.calls.put,1);
});
test('legacy table falls back with the required message; reload provides a safe cursor',async()=>{
 const f=await fixture();delete f.sim.state.kiotReadAt;f.sim.state.runs[0].rows.forEach(r=>delete r.liveReadAt);
 const p=await prepare(f);await f.live.commit(p.id,true);
 assert.equal(f.calls.all,1);assert.ok(f.stages.includes('Đang đọc toàn bộ Kiot (~30 giây) vì bảng chưa có mốc; bấm Tải lại từ Kiot để lần sau nhanh hơn'));
 await f.live.refresh();await f.sim.run();assert.ok(f.sim.state.runs[0].rows.every(r=>r.liveReadAt));
});
test('trusted cursor uses margin and blocks manual edits before sending',async()=>{
 const f=await fixture(),p=await prepare(f);f.products[0].notes='Sửa tay';
 const result=await f.live.commit(p.id,true);assert.equal(f.calls.all,0);
 assert.ok(Date.parse(f.calls.modified[0])<Date.parse(p.listAt));
 assert.equal(result.items[0].platforms.kiot.status,'preflight_failed');assert.equal(result.items[0].platforms.kiot.requestSent,false);
 assert.equal(result.items[1].status,'done');
});
test('compact chunked journal reopens for history, TASK-125 snapshot checks and price-only restore',async()=>{
 const f=await fixture(51),p=await prepare(f),u=await f.live.commit(p.id,true);
 const disk=await new SplitStore(f.path).read(),saved=disk.updates[0];
 assert.equal(saved.items.length,51);assert.equal(saved.items[0].before.rawSource,undefined);assert.equal(saved.items[0].before.rawFields,undefined);
 assert.equal(saved.items[0].row.notesBefore,undefined);assert.equal(saved.items[0].platforms.kiot.afterFingerprint,fingerprint(f.products[0]));
 assert.equal(updateDetail(disk,u.id,new URLSearchParams()).pagination.total,51);
 assert.equal(viewData(disk,new URLSearchParams({view:'history'}),{revision:1,dataset:'real'}).history[0].update.canRestore,true);
 assert.deepEqual((await retrySelection(f,disk,u.id)).codes,[]);
 // The full old before-image is intentionally stale: only the verified journal can authorize this no-op.
 const old=f.sim.state.runs.at(-1).rows[0];f.live.checkKiotSnapshot(disk,{id:1,row:old,before:{...f.products[0],currentPrice:1,notes:'stale'}},f.products[0]);
 f.sim.state=disk;const restore=await f.live.prepareRestore(u.id);const result=await f.live.commitRestore(restore.id,true);
 assert.equal(result.outcome,'success');assert.ok(f.products.every(p=>p.currentPrice===35e6));
 const manifest=JSON.parse(await readFile(f.store.manifestPath,'utf8'));
 const updates=JSON.parse(await readFile(join(f.store.blobs,manifest.indexes.updates+'.json'),'utf8'));
 const descriptor=JSON.parse(await readFile(join(f.store.blobs,updates[1]+'.json'),'utf8'));
 assert.equal(descriptor.storage,'baoq-update-chunks-v1');assert.equal(descriptor.itemChunks.length,2);
});
test('old unchunked journal still displays history, selects failed codes and restores',async()=>{
 const f=await fixture(),send=f.client.updateMany;
 f.client.updateMany=entries=>send(entries.filter(e=>e.product.id!==2));
 const p=await prepare(f),u=await f.live.commit(p.id,true);
 // Persist the old JSON layout verbatim through the normal blob primitive.
 const manifest=JSON.parse(await readFile(f.store.manifestPath,'utf8'));
 const old=structuredClone(u);delete old.journalVersion;old.items[1].status='write_failed';old.items[1].platforms.kiot.status='write_failed';
 manifest.indexes.updates=await f.store.put([await f.store.put(old)]);
 await writeFile(f.store.manifestPath,JSON.stringify(manifest));
 const disk=await new SplitStore(f.path).read();assert.deepEqual(disk.updates[0],JSON.parse(JSON.stringify(old)));
 assert.deepEqual(updateDetail(disk,u.id,new URLSearchParams({filter:'issues'})).pagination.items.map(p=>p.code),['SP2']);
 const retry=await retrySelection(f,disk,u.id);assert.deepEqual(retry.codes,['SP2']);
 f.sim.state=disk;f.client.updateMany=send;
 const retryPrepared=await f.live.prepare(retry.runId,retry.codes,{localOnly:true,continueOnError:true});
 assert.equal((await f.live.commit(retryPrepared.id,true)).outcome,'success');
 assert.equal(f.products[1].currentPrice,u.items[1].row.price);
 const restore=await f.live.prepareRestore(u.id);await f.live.commitRestore(restore.id,true);assert.equal(f.products[0].currentPrice,35e6);
});
test('checkpoint reuses unchanged published products but isolates the changed lot',()=>{
 const previous={products:[{id:1,code:'SP1',currentPrice:1},{id:2,code:'SP2',currentPrice:2}],updates:[],prepared:[]};
 const scope={ids:[1,2]},draft=liveDraft(previous,scope);draft.products[1].currentPrice=3;
 const published=liveDraft(draft,scope,previous);
 assert.equal(published.products[0],previous.products[0]);assert.notEqual(published.products[1],draft.products[1]);
 draft.products[1].currentPrice=4;assert.equal(published.products[1].currentPrice,3);assert.equal(previous.products[1].currentPrice,2);
});
test('large tables compress losslessly, old plain tables still read, product blobs remain plain JSON',async()=>{
 const f=await fixture();const old=structuredClone(f.sim.state.runs[0]);
 const large={...old,id:'large',rows:old.rows.map(row=>({...row,notesBefore:'Mô tả dài '.repeat(10000)}))};
 f.sim.state.runs.unshift(large);await f.store.write(f.sim.state);
 const manifest=JSON.parse(await readFile(f.store.manifestPath,'utf8'));
 const runs=JSON.parse(await readFile(join(f.store.blobs,manifest.indexes.runs+'.json'),'utf8'));
 const packed=JSON.parse(await readFile(join(f.store.blobs,runs[0]+'.json'),'utf8'));
 assert.equal(packed.format,'baoq-gzip-run-v1');assert.ok(JSON.stringify(packed).length<JSON.stringify(large).length/4);
 const reopened=await new SplitStore(f.path).read();assert.deepEqual(reopened.runs,JSON.parse(JSON.stringify(f.sim.state.runs)));
 const products=JSON.parse(await readFile(join(f.store.blobs,manifest.indexes.products+'.json'),'utf8'));
 assert.equal(JSON.parse(await readFile(join(f.store.blobs,products[0]+'.json'),'utf8')).code,'SP1');
});
test('chunk or manifest save failure closes the PUT gate',async()=>{
 for(const faultStage of ['beforeBlob','beforeManifest']){
  const f=await fixture(),p=await prepare(f);f.store.fault=async stage=>{if(stage===faultStage)throw Error('Disk failure');};
  await assert.rejects(f.live.commit(p.id,true),/Disk failure/);assert.equal(f.calls.put,0);
 }
});
test('completed journal cleans superseded chunks, keeps seven tables, and corrupt child fails closed',async()=>{
 const f=await fixture(51);for(let n=1;n<=8;n++)await f.sim.run(`2026-10-${String(n).padStart(2,'0')}`);
 await f.sim.run();const p=await prepare(f);await f.live.commit(p.id,true);
 assert.equal(f.sim.state.runs.length,7);assert.equal((await audit(f.dir)).stores[0].candidates.length,0);
 const manifest=JSON.parse(await readFile(f.store.manifestPath,'utf8'));
 const refs=JSON.parse(await readFile(join(f.store.blobs,manifest.indexes.updates+'.json'),'utf8'));
 const record=JSON.parse(await readFile(join(f.store.blobs,refs[0]+'.json'),'utf8'));
 const child=join(f.store.blobs,record.itemChunks[0]+'.json');await writeFile(child,'[]');
 await assert.rejects(new SplitStore(f.path).read(),/Hash/);await assert.rejects(audit(f.dir),/hash/i);
});
