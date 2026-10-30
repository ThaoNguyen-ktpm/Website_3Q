import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile,unlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {SplitStore} from '../lib/split-store.js';
import {Simulator} from '../lib/service.js';
import {LiveService} from '../lib/live.js';
import {normalizeProduct} from '../lib/kiot.js';
import {POLICY,calculate} from '../lib/pricing.js';
const state=()=>({version:1,cycleVersion:2,policy:POLICY,products:[{id:1,code:'A',p0:35e6,notes:'Gốc',manualPricing:{price:1,allowance:0}}],archivedProducts:[{id:2,code:'B',p0:4e6}],runs:[{id:'old',rows:[{id:1,p0:35e6,price:34e6}]}],updates:[{id:'old-write',items:[{code:'A',status:'done'}],attempts:[{status:'completed'}]}],prepared:[],settings:{enabled:false,time:'09:00'},manualEdits:[{code:'A',before:null,after:{price:1}}],p0Repairs:[{id:1,source:'history'}],customField:{retained:true}});
async function withTemp(fn){const dir=await mkdtemp(join(tmpdir(),'baoq-split-test-'));try{return await fn(dir);}finally{await rm(dir,{recursive:true,force:true});}}
test('after a restart the first live save does not re-serialize unchanged runs',()=>withTemp(async dir=>{
 const path=join(dir,'state.json');await new SplitStore(path).write(state());
 await new Simulator(new SplitStore(path),{load:async()=>[]}).initialize(); // first start normalizes and saves; the next one is the restart
 const store=new SplitStore(path),sim=new Simulator(store,{load:async()=>[]});await sim.initialize();const before=store.stats.serializedRuns;
 await sim.mutate(s=>{s.prepared=[{id:'draft'}];},{codes:[],ids:[],timings:{cloneMs:0,saveMs:0,publishMs:0,networkMs:0,authMs:0,requests:[]}});
 assert.equal(store.stats.serializedRuns,before);
}));
test('Sapo catalog reloads without simulator version/history; default state store stays strict',()=>withTemp(async dir=>{
 const path=join(dir,'sapo.json'),catalog={products:[{id:9,variants:[{id:10,sku:'SP000009'}]}],mapping:null,catalogBinding:'binding'};
 await new SplitStore(path,{kind:'sapo'}).write(catalog);
 assert.deepEqual(await new SplitStore(path,{kind:'sapo'}).read(),catalog);
 await assert.rejects(new SplitStore(path).read(),/Manifest/);
}));
test('migration round-trips every field/order, keeps legacy bytes and uses only new storage afterwards',()=>withTemp(async dir=>{
 const path=join(dir,'state.json'),s=state(),text=JSON.stringify(s,null,2);await writeFile(path,text);
 const store=new SplitStore(path);const restored=await store.read();assert.deepEqual(restored,s);assert.equal(await readFile(path,'utf8'),text);
 restored.products[0].notes='Changed';await store.write(restored);assert.equal(await readFile(path,'utf8'),text);
 assert.deepEqual(await new SplitStore(path).read(),restored);
 const before=store.stats.bytesWritten;await store.write(restored);assert.equal(store.stats.bytesWritten,before);
}));
test('failed migration has no manifest; failed publication preserves old state and drains workers',()=>withTemp(async dir=>{
 const path=join(dir,'state.json');await writeFile(path,JSON.stringify(state()));
 let fail=true;const store=new SplitStore(path,{fault:async stage=>{if(fail&&stage==='beforeManifest')throw Error('Injected');}});
 await assert.rejects(store.read(),/Injected/);await assert.rejects(readFile(store.manifestPath),e=>e.code==='ENOENT');
 fail=false;const original=await store.read();const next=structuredClone(original);next.products[0].notes='Unpublished';fail=true;
 await assert.rejects(store.write(next),/Injected/);assert.deepEqual(await new SplitStore(path).read(),original);
 fail=false;await store.write(next);assert.deepEqual(await new SplitStore(path).read(),next);
}));
test('corrupt manifests, missing records, invalid references and wrong hashes fail closed with legacy still present',()=>withTemp(async dir=>{
 const path=join(dir,'state.json');await writeFile(path,JSON.stringify(state()));const store=new SplitStore(path);await store.read();const manifest=await readFile(store.manifestPath,'utf8');const m=JSON.parse(manifest);
 await writeFile(store.manifestPath,'{invalid');await assert.rejects(new SplitStore(path).read());await writeFile(store.manifestPath,manifest);
 const indexPath=join(store.blobs,m.indexes.products+'.json'),indexText=await readFile(indexPath,'utf8');
 const productPath=join(store.blobs,JSON.parse(indexText)[0]+'.json'),productText=await readFile(productPath,'utf8');
 await unlink(productPath);await assert.rejects(new SplitStore(path).read(),e=>e.code==='ENOENT');await writeFile(productPath,productText);
 await writeFile(productPath,'{}');await assert.rejects(new SplitStore(path).read(),/Hash/);await writeFile(productPath,productText);
 m.indexes.products='../state.json';await writeFile(store.manifestPath,JSON.stringify(m));await assert.rejects(new SplitStore(path).read(),/Tham chiếu/);
 await unlink(store.manifestPath);await assert.rejects(new SplitStore(path).read(),/Thiếu manifest/);
}));
async function liveFixture(dir){
 const path=join(dir,'state.json'),store=new SplitStore(path),clock=()=>new Date('2027-01-21T04:00:00Z');
 let current=normalizeProduct({id:1,code:'ONE',name:'Mẫu',basePrice:35e6,isActive:true,createdDate:'2026-10-13T12:00:00',description:'Gốc',inventories:[{branchId:44466,onHand:1}]});
 const untouched={...current,id:2,code:'TWO',p0:35e6},product={...current,p0:35e6};const calls=[];
 const sim=new Simulator(store,{load:async()=>[]},clock);sim.state={...state(),products:[product,untouched],updates:state().updates,mapping:{verified:true},dataRevision:1};
 const client={product:async()=>{calls.push('GET');return structuredClone(current);},update:async(_,body)=>{calls.push('PUT');current={...current,currentPrice:body.basePrice,notes:body.description};}};
 const live=new LiveService(sim,client,clock);
 sim.state.runs.unshift({id:'now',at:clock().toISOString(),day:'2027-01-21',policy:POLICY,dataset:'real',dataRevision:1,rows:[live.snapshot(calculate(product,'2027-01-21'),product,sim.state)]});
 await store.write(sim.state);return {sim,live,store,calls,untouched};
}
test('one-product live draft and checkpoints keep immutable history, publish isolation and skip final duplicate bytes',()=>withTemp(async dir=>{
 const f=await liveFixture(dir),history=f.sim.state.runs,oldUpdate=f.sim.state.updates[0],oldSummary=structuredClone(oldUpdate);
 const runsBefore=f.store.stats.serializedRuns,bytesBefore=f.store.stats.bytesWritten;
 const prepared=await f.live.prepare('now',['ONE']);prepared.items[0].name='Returned mutation';assert.notEqual(f.sim.state.prepared[0].items[0].name,'Returned mutation');
 let isolated=false;const checkpoint=f.live.checkpoint.bind(f.live);
 f.live.checkpoint=async(s,u)=>{await checkpoint(s,u);if(u){const price=f.sim.state.products[0].currentPrice,prior=s.products[0].currentPrice;s.products[0].currentPrice=1;assert.equal(f.sim.state.products[0].currentPrice,price);s.products[0].currentPrice=prior;isolated=true;}};
 const result=await f.live.commit(prepared.id,true);assert.equal(result.outcome,'success');assert.equal(isolated,true);
 assert.equal(f.sim.state.runs,history);assert.equal(f.sim.state.products[1],f.untouched);assert.equal(f.sim.state.updates[1],oldUpdate);assert.deepEqual(oldUpdate,oldSummary);
 assert.equal(f.store.stats.serializedRuns,runsBefore);assert.ok(f.store.stats.bytesWritten-bytesBefore<1000000);assert.deepEqual(f.calls,['GET','GET','GET','PUT','GET','GET']);
 const bytes=f.store.stats.bytesWritten;await f.store.write(f.sim.state,{immutable:true});assert.equal(f.store.stats.bytesWritten,bytes);
 assert.deepEqual(await new SplitStore(f.store.path).read(),JSON.parse(JSON.stringify(f.sim.state)));
}));
test('journal disk failure prevents PUT and published snapshot survives restart without external writes',()=>withTemp(async dir=>{
 const f=await liveFixture(dir),p=await f.live.prepare('now',['ONE']);let failed=false;
 const write=f.store.write.bind(f.store);f.store.write=async(s,o)=>{if(!failed&&s.updates[0]?.items[0]?.status==='sending'){failed=true;throw Error('Disk failure');}return write(s,o);};
 const result=await f.live.commit(p.id,true);assert.equal(result.items[0].status,'write_failed');assert.equal(f.calls.includes('PUT'),false);
 const restarted=new Simulator(new SplitStore(f.store.path),{load:async()=>[]},f.sim.clock);await restarted.initialize();assert.equal(restarted.state.updates[0].items[0].requestSent,false);
}));
test('process-stop snapshots around checkpoints restore unknown without repeating any PUT',()=>withTemp(async dir=>{
 for(const stoppingStatus of ['journaled','ready','sending','verified','done']){
  const sub=join(dir,stoppingStatus),f=await liveFixture(sub),p=await f.live.prepare('now',['ONE']);let captured;
  const checkpoint=f.live.checkpoint.bind(f.live);
  f.live.checkpoint=async(s,u)=>{await checkpoint(s,u);if(!captured&&u?.items[0].status===stoppingStatus)captured=await readFile(f.store.manifestPath,'utf8');};
  await f.live.commit(p.id,true);assert.ok(captured);await writeFile(f.store.manifestPath,captured);
  const before=[...f.calls],restarted=new Simulator(new SplitStore(f.store.path),{load:async()=>[]},f.sim.clock);await restarted.initialize();
  assert.deepEqual(f.calls,before);assert.equal(restarted.state.updates[0].outcome,'interrupted');assert.equal(restarted.state.updates[0].items[0].status,'unknown');
 }
}));
