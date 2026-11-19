import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {Simulator} from '../lib/service.js';
import {LiveService} from '../lib/live.js';
import {normalizeProduct,KiotClient,kiotFetch} from '../lib/kiot.js';
import http from 'node:http';

const memory=()=>{let value;return {read:async()=>structuredClone(value),write:async next=>{value=structuredClone(next);}};};
// Test clients only. Advance a modeled network clock and yield once per request.
async function fixture(n){
 let now=Date.parse('2026-11-16T03:00:00Z');const clock=()=>new Date(now),delay=async ms=>{now+=ms;await new Promise(setImmediate);};
 const products=Array.from({length:n},(_,i)=>normalizeProduct({id:i+1,code:'SP'+(i+1),name:'Túi '+i,basePrice:35e6,createdDate:'2026-09-01',description:'Gốc '+i,isActive:true,inventories:[{branchId:44466,cost:1,onHand:1}]}));
 const calls={all:0,modified:0,single:0,sapo:0,lots:[]},changes=new Map();
 const edit=(id,fields)=>{Object.assign(products[id-1],fields);changes.set(id,now);};
 const client={
  all:async()=>{calls.all++;await delay(400);return structuredClone(products);},
  product:async()=>{calls.single++;throw Error('Unexpected per-product GET');},
  update:async()=>{calls.single++;throw Error('Unexpected per-product PUT');},
  listModified:async since=>{calls.modified++;await delay(400);return structuredClone(products.filter(p=>(changes.get(p.id)??-Infinity)>=Date.parse(since)));},
  updateMany:async entries=>{calls.lots.push(entries.map(e=>e.product.id));await delay(5000);for(const {product,fields} of entries){assert.deepEqual(Object.keys(fields),['basePrice']);edit(product.id,{currentPrice:fields.basePrice});}},
 };
 const store=memory(),sim=new Simulator(store,{load:async()=>[]},clock);await sim.initialize();
 const live=new LiveService(sim,client,clock);sim.live=live;live.batchWrites=true;live.sapoWrite=false;live.kiotDescription=false;live.timingSink=()=>{};
 live.sapo={client:{all:async()=>{calls.sapo++;throw Error('Unexpected Sapo LIST');}},requireVerified:()=>{calls.sapo++;throw Error('Unexpected Sapo');},read:async()=>{calls.sapo++;throw Error('Unexpected Sapo GET');}};
 await live.refresh();const run=await sim.run();
 const prepared=await live.prepare(run.id,products.map(p=>p.code),{continueOnError:true,localOnly:true});
 calls.all=0;
 return {sim,live,store,products,client,calls,edit,advance:ms=>{now+=ms;},prepared,commit:()=>live.commit(prepared.id,true)};
}

test('runtime explicitly enables Kiot bulk price writes',async()=>{
 const source=await readFile(new URL('../runtime.ts',import.meta.url),'utf8');
 assert.match(source,/createSaleAi\(\{[^}]*batchWrites\s*:\s*true/);
 assert.match(source,/sapoWrite\s*:\s*false/);assert.match(source,/kiotDescription\s*:\s*false/);
});

test('1311 price-only local products use 27 bulk PUTs, a trusted delta cursor and no Sapo',async()=>{
 const f=await fixture(1311),result=await f.commit();
 assert.equal(result.outcome,'success');assert.ok(result.items.every(i=>i.status==='done'));
 assert.deepEqual(f.calls.lots.map(l=>l.length),[...Array(26).fill(50),11]);
 assert.equal(f.calls.all,0);assert.equal(f.calls.modified,28);assert.equal(f.calls.single,0);assert.equal(f.calls.sapo,0);
 assert.ok(f.products.every((p,i)=>p.notes==='Gốc '+i));assert.deepEqual(Object.keys(result.platformSummary),['kiot']);
});

test('missing read cursor falls back to full list; modified list catches a later edit',async()=>{
 const f=await fixture(101);f.edit(1,{notes:'Sửa tay cũ'});
 f.sim.state.prepared[0].listAt=null;
 // Older than the proposal cursor: only the initial full read can catch it.
 f.client.listModified=async()=>{f.calls.modified++;return structuredClone(f.products.filter(p=>p.id!==1));};
 const send=f.client.updateMany;f.client.updateMany=async entries=>{await send(entries);if(f.calls.lots.length===1)f.edit(90,{notes:'Sửa tay giữa lượt'});};
 const result=await f.commit();
 for(const id of [1,90]){assert.equal(result.items.find(i=>i.id===id).platforms.kiot.status,'preflight_failed');assert.ok(!f.calls.lots.flat().includes(id));}
 assert.equal(result.items.filter(i=>i.status==='done').length,99);assert.equal(f.calls.all,1);
});

test('table cursor catches a hand edit older than the proposal cursor',async()=>{
 const f=await fixture(51);f.edit(1,{currentPrice:1});
 // The table read predates this edit; moving the confirmation time cannot hide it.
 f.advance(120000);
 const prepared=await f.live.prepare(f.sim.state.runs[0].id,f.products.map(p=>p.code),{continueOnError:true,localOnly:true});
 const result=await f.live.commit(prepared.id,true);
 assert.equal(f.calls.all,0);assert.equal(result.items[0].platforms.kiot.status,'preflight_failed');
 assert.ok(!f.calls.lots.flat().includes(1));assert.equal(result.items[50].status,'done');
});

test('a deleted product in the delta is blocked before PUT',async()=>{
 const f=await fixture(2),list=f.client.listModified;
 f.client.listModified=async since=>[...(await list(since)),{id:1,deleted:true}];
 const result=await f.commit();assert.equal(result.items[0].platforms.kiot.status,'preflight_failed');
 assert.deepEqual(f.calls.lots,[[2]]);assert.equal(result.items[1].status,'done');
});

for(const error of [Object.assign(Error('HTTP 503'),{httpStatus:503}),Object.assign(Error('timeout'),{uncertain:true})])test(`bulk ${error.message} is unknown without retry; next lot continues`,async()=>{
 const f=await fixture(51),send=f.client.updateMany;
 f.client.updateMany=async entries=>{if(!f.calls.lots.length){f.calls.lots.push(entries.map(e=>e.product.id));throw error;}await send(entries);};
 const result=await f.commit();assert.deepEqual(f.calls.lots.map(l=>l.length),[50,1]);
 assert.ok(result.items.slice(0,50).every(i=>i.platforms.kiot.status==='unknown'));assert.equal(result.items[50].status,'done');assert.equal(f.calls.sapo,0);
});

test('a real local socket drop marks one bulk lot unknown and the next lot continues',async t=>{
 let requests=0;const server=http.createServer((_req,res)=>{
  requests++;res.writeHead(200,{'Content-Length':100});res.write('{');setImmediate(()=>res.destroy());
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));
 const f=await fixture(51),send=f.client.updateMany;
 const wire=new KiotClient({fetcher:(_url,options)=>kiotFetch('http://127.0.0.1:'+server.address().port,options)});
 wire.token='fixture';wire.expires=Date.now()+60000;
 f.client.updateMany=async entries=>{
  if(!f.calls.lots.length){f.calls.lots.push(entries.map(e=>e.product.id));return wire.updateMany(entries);}
  return send(entries);
 };
 const result=await f.commit();assert.equal(requests,1);
 assert.ok(result.items.slice(0,50).every(i=>i.platforms.kiot.status==='unknown'));
 assert.equal(result.items[50].status,'done');assert.deepEqual(f.calls.lots.map(l=>l.length),[50,1]);
});

for(const corruption of ['price','description','missing'])test(`bulk read-back ${corruption} makes only the affected item unknown`,async()=>{
 const f=await fixture(3),send=f.client.updateMany;
 f.client.updateMany=async entries=>{await send(entries);if(corruption==='price')f.edit(2,{currentPrice:1});if(corruption==='description')f.edit(2,{notes:'Đổi mô tả'});};
 if(corruption==='missing'){const list=f.client.listModified;f.client.listModified=async since=>(await list(since)).filter(p=>p.id!==2);}
 const result=await f.commit();assert.deepEqual(result.items.map(i=>i.platforms.kiot.status),['done','unknown','done']);assert.equal(f.calls.lots.length,1);
});

test('restart distinguishes unsent ready items from potentially sent items in journal and attempt',async()=>{
 const store=memory(),initial=new Simulator(store,{load:async()=>[]});await initial.initialize();
 const statuses=[{status:'ready'},{status:'ready',requestSent:false},{status:'ready',requestSent:true},{status:'sending',requestSent:false},{status:'sending',requestSent:true},{status:'done'},{status:'preflight_failed'},{status:'not_sent'}];
 initial.state.updates=[{mode:'joint-v1',targets:['kiot'],items:statuses.map((p,i)=>({code:'SP'+i,platforms:{kiot:p}})),attempts:[{status:'running'}]}];await store.write(initial.state);
 const reopened=new Simulator(store,{load:async()=>{throw Error('No reimport');}});await reopened.initialize();const update=reopened.state.updates[0];
 const expected=['not_sent','not_sent','unknown','unknown','unknown','done','preflight_failed','not_sent'];
 assert.deepEqual(update.items.map(i=>i.platforms.kiot.status),expected);
 assert.deepEqual(update.items.slice(0,2).map(i=>i.status),['not_sent','not_sent']);
 assert.equal(update.items[0].platforms.kiot.error,'Chưa gửi — lượt bị dừng');assert.equal(update.items[1].platforms.kiot.requestSent,false);
 assert.equal(update.attempts[0].status,'interrupted');assert.deepEqual(update.attempts[0].items.map(i=>i.platforms.kiot.status),expected);
 assert.equal(update.platformSummary.kiot.succeeded,1);assert.equal(update.platformSummary.kiot.failed,7);assert.equal(update.platformSummary.sapo,undefined);
 const again=new Simulator(store,{load:async()=>[]});await again.initialize();assert.deepEqual(again.state.updates,reopened.state.updates);
});

test('existing page progress renders lot number and processed/total',async()=>{
 const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8'),box={};
 const sandbox={$:()=>box,count:n=>Number(n).toLocaleString('vi-VN')};vm.createContext(sandbox);
 vm.runInContext(source.slice(source.indexOf('function renderProgress('),source.indexOf('setInterval(async()=>',source.indexOf('function renderProgress('))),sandbox);
 sandbox.renderProgress({batch:{lot:5,lots:27,total:1311,done:230,failed:0,unknown:0}});
 assert.match(box.innerHTML,/lô 5\/27/);assert.match(box.innerHTML,/230\/1\.311/);
});
