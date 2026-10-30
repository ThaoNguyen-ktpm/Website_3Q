import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './joint-update.test.js';
import {updateDetail} from '../lib/view-data.js';
test('continue mode records missing SKU while writing the valid product',async()=>{
 const f=await fixture();f.sapo.state.products=f.sapo.state.products.filter(p=>p.variants[0].sku!=='SP000009');
 const p=await f.live.prepare(f.run.id,['SP000009','SP000010'],{continueOnError:true});
 const u=await f.live.commit(p.id,true);assert.equal(u.items.length,1);assert.equal(u.items[0].status,'done');assert.equal(u.skipped.length,1);
 const errors=updateDetail(f.sim.state,u.id,new URLSearchParams({errorsOnly:'true'}));assert.equal(errors.pagination.total,1);assert.equal(errors.pagination.items[0].code,'SP000009');
});
test('continue mode keeps timeout unknown and sends next product without retry',async()=>{
 const f=await fixture(),p=await f.live.prepare(f.run.id,['SP000009','SP000010'],{continueOnError:true});
 const original=f.kiot.update;let calls=0;f.kiot.update=async(...args)=>{calls++;if(calls===1)throw Object.assign(Error('timeout'),{uncertain:true});return original(...args);};
 const u=await f.live.commit(p.id,true);assert.equal(u.items[0].platforms.kiot.status,'unknown');assert.equal(u.items[1].platforms.kiot.status,'done');assert.equal(calls,2);
});
test('continue mode still stops platform on forbidden writes',async()=>{
 const f=await fixture(),p=await f.live.prepare(f.run.id,['SP000009','SP000010'],{continueOnError:true});let calls=0;
 f.kiot.update=async()=>{calls++;throw Object.assign(Error('forbidden'),{httpStatus:403});};
 const u=await f.live.commit(p.id,true);assert.equal(calls,1);assert.equal(u.items[1].platforms.kiot.status,'not_sent');
});
test('all waiting or missing products create a history issue list without writes',async()=>{
 const f=await fixture(1);f.sim.state.runs[0].rows[0].status='waiting';f.sim.state.runs[0].rows[0].reasons=['Chưa có giá duyệt riêng'];
 const p=await f.live.prepare(f.run.id,[],{continueOnError:true,excludedCodes:['SP000009']});
 const u=await f.live.commit(p.id,true);assert.equal(u.items.length,0);assert.equal(u.issueCount,1);assert.equal(f.calls.length,0);
 assert.equal(updateDetail(f.sim.state,u.id,new URLSearchParams({errorsOnly:'true'})).pagination.items[0].error,'Chưa có giá duyệt riêng');
});
test('continue mode skips a per-product preflight conflict while sending the next',async()=>{
 const f=await fixture(),p=await f.live.prepare(f.run.id,['SP000009','SP000010'],{continueOnError:true});
 f.products[0].notes+=' outside edit';const u=await f.live.commit(p.id,true);
 assert.equal(u.items[0].platforms.kiot.status,'preflight_failed');assert.equal(u.items[1].status,'done');
 assert.equal(f.calls.length,2);assert.ok(f.calls.every(c=>!c.includes('SP000009')));
});
test('continue mode closes both send gates when saving the sending journal fails',async()=>{
 const f=await fixture(),p=await f.live.prepare(f.run.id,['SP000009','SP000010'],{continueOnError:true});
 const write=f.store.write;f.store.write=async state=>{
  if(state.updates.some(u=>u.items.some(i=>Object.values(i.platforms||{}).some(p=>p.status==='sending'))))throw Error('disk failed');
  return write(state);
 };
 await assert.rejects(f.live.commit(p.id,true),/disk failed/);assert.equal(f.calls.length,0);
});
