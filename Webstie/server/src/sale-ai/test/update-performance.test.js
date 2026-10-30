import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../lib/store.js';
import {readPool} from '../lib/read-pool.js';
import {LiveService} from '../lib/live.js';

test('selected-product reads overlap with a maximum of two and preserve selection order',async()=>{
  let active=0,max=0;const releases=[];
  const pending=readPool([1,2,3],async id=>{active++;max=Math.max(max,active);await new Promise(r=>releases.push(r));active--;return id;});
  assert.equal(active,2);releases.shift()();await new Promise(r=>setImmediate(r));assert.equal(active,2);
  while(releases.length)releases.shift()();assert.deepEqual(await pending,[1,2,3]);assert.equal(max,2);
});
test('read pool settles in-flight requests before failure and starts no further reads',async()=>{
  let release,finished=false;const ids=[];
  const pending=readPool([1,2,3],async id=>{ids.push(id);if(id===1)throw Error('read failed');await new Promise(r=>release=r);finished=true;});
  await new Promise(r=>setImmediate(r));release();await assert.rejects(pending,/read failed/);assert.equal(finished,true);assert.deepEqual(ids,[1,2]);
});
test('cached checkpoint serialization preserves all history; ordinary writes invalidate cache',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'baoq-perf-'));
  try {
    const store=new Store(join(dir,'state.json'));
    const state={version:1,products:[{id:1,p0:35000000}],runs:[{id:'OLD',rows:[{price:1}]}],updates:[]};
    await store.write(state,{stableRuns:true});state.updates.push({id:'NEW',status:'sending'});await store.write(state,{stableRuns:true});
    assert.deepEqual(await store.read(),state);
    state.runs[0].rows[0].price=2;await store.write(state);await store.write(state,{stableRuns:true});assert.deepEqual(await store.read(),state);
    const draft=structuredClone(state);draft.runs.push({id:'SECOND',rows:[]});await store.write(draft,{stableRuns:true});assert.deepEqual(await store.read(),draft);
    assert.ok(!(await readFile(store.path,'utf8')).includes('\n'));
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('checkpoint publishes isolated mutable state and preserves immutable historical rows',async()=>{
  let disk;const sim={store:{write:async s=>{disk=structuredClone(s);}}};const live=new LiveService(sim,{});
  const state={products:[{id:1,currentPrice:10}],runs:[{id:'HISTORY',rows:[{p0:20}]}],archivedProducts:[{id:2,p0:20}],prepared:[],updates:[]};
  await live.checkpoint(state);state.products[0].currentPrice=99;state.updates.push({id:'later',items:[]});
  assert.equal(sim.state.products[0].currentPrice,10);assert.equal(disk.products[0].currentPrice,10);assert.equal(sim.state.updates.length,0);
  assert.deepEqual(sim.state.runs,[{id:'HISTORY',rows:[{p0:20}]}]);assert.equal(sim.state.runs,state.runs);
});
