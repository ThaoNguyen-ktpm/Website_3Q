import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {Simulator} from '../lib/service.js';
import {LiveService} from '../lib/live.js';
import {normalizeProduct} from '../lib/kiot.js';

const memory=()=>{let value;return {read:async()=>structuredClone(value),write:async next=>{value=structuredClone(next);}};};
// Test clients only. Advance a modeled network clock and yield once per request.
async function fixture(n){
 let now=Date.parse('2026-11-16T03:00:00Z');const clock=()=>new Date(now),delay=async ms=>{now+=ms;await new Promise(setImmediate);};
 const products=Array.from({length:n},(_,i)=>normalizeProduct({id:i+1,code:'SP'+(i+1),name:'Túi '+i,basePrice:35e6,createdDate:'2026-09-01',description:'Gốc '+i,isActive:true,inventories:[{branchId:44466,onHand:1}]}));
 const calls={all:0,modified:0,single:0,sapo:0,lots:[]},changes=new Map();
 const edit=(id,fields)=>{Object.assign(products[id-1],fields);changes.set(id,now);};
 const client={
  all:async()=>{calls.all++;await delay(31200);return structuredClone(products);},
  product:async()=>{calls.single++;throw Error('Unexpected per-product GET');},
  update:async()=>{calls.single++;throw Error('Unexpected per-product PUT');},
  listModified:async since=>{calls.modified++;const list=products.filter(p=>(changes.get(p.id)??-Infinity)>=Date.parse(since));client.lastPages=Math.max(1,Math.ceil(list.length/100));await delay(400*client.lastPages);return structuredClone(list);},
  updateMany:async entries=>{calls.lots.push(entries.map(e=>e.product.id));await delay(5000);for(const {product,fields} of entries){assert.deepEqual(Object.keys(fields),['basePrice']);edit(product.id,{currentPrice:fields.basePrice});}},
 };
 const store=memory(),sim=new Simulator(store,{load:async()=>[]},clock);await sim.initialize();
 const live=new LiveService(sim,client,clock);sim.live=live;live.batchWrites=true;live.sapoWrite=false;live.kiotDescription=false;live.timingSink=()=>{};
 live.sapo={client:{all:async()=>{calls.sapo++;throw Error('Unexpected Sapo LIST');}},requireVerified:()=>{calls.sapo++;throw Error('Unexpected Sapo');},read:async()=>{calls.sapo++;throw Error('Unexpected Sapo GET');}};
 await live.refresh();const run=await sim.run();
 const prepared=await live.prepare(run.id,products.map(p=>p.code),{continueOnError:true,localOnly:true});
 calls.all=0;
 return {elapsed:()=>now,sim,live,store,products,client,calls,edit,prepared,commit:()=>live.commit(prepared.id,true)};
}


for(const n of [1112,1311])test(`modeled batch benchmark ${n}`,async()=>{
 const f=await fixture(n),start=f.elapsed();let saves=0;const write=f.store.write;
 f.store.write=async(...args)=>{saves++;return write(...args);};
 const result=await f.commit();
 assert.equal(result.outcome,'success');assert.equal(f.calls.single,0);assert.equal(f.calls.sapo,0);
 assert.equal(f.calls.all,0);assert.equal(f.calls.lots.length,n===1112?23:27);
 assert.equal(saves,n===1112?25:29);
 assert.equal(f.elapsed()-start,n===1112?141400:166200);
 const t=result.timings.batch;
 console.log('TASK-122 benchmark',JSON.stringify({n,elapsedMs:f.elapsed()-start,all:f.calls.all,modifiedCalls:f.calls.modified,lots:f.calls.lots.length,saves,initialReadMs:t.initialReadMs,putMs:t.lots.reduce((sum,l)=>sum+l.putMs,0),listModifiedMs:t.lots.reduce((sum,l)=>sum+l.listModifiedMs,0),reads:t.reads,writes:t.writes,journalWallMs:result.timings.saveMs}));
});
