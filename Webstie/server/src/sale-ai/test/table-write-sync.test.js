import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './joint-update.test.js';
import {viewData} from '../lib/view-data.js';

const table=f=>viewData(f.sim.state,new URLSearchParams({view:'results'}),{revision:'test',today:'2027-01-22',dataset:'real'}).runs[0];

test('verified update publishes new price and success in table without changing old snapshot',async()=>{
 const f=await fixture(1),old=structuredClone(f.run),p=await f.prepare();
 await f.live.commit(p.id,true);
 const run=table(f);assert.equal(run.rows[0].currentPrice,32400000);assert.equal(run.rows[0].p0,35000000);
 assert.equal(run.rows[0].writeStatus,'updated');assert.deepEqual(f.sim.state.runs.find(r=>r.id===old.id),old);
 assert.equal((await f.store.read()).runs[0].rows[0].currentPrice,32400000);
});

test('rollback updates table and permits another update despite changed Kiot modifiedDate',async()=>{
 const f=await fixture(1),write=f.kiot.update;let version=0;
 f.kiot.update=async(...args)=>{await write(...args);f.products[0].modifiedDate='version-'+(++version);};
 const p=await f.prepare(),u=await f.live.commit(p.id,true),r=await f.live.prepareRestore(u.id);
 const previous=structuredClone(f.sim.state.runs),revision=f.sim.state.dataRevision;
 await f.live.commitRestore(r.id,true);
 assert.deepEqual(f.sim.state.runs.slice(1),previous);assert.equal(f.sim.state.dataRevision,revision+1);
 assert.equal(f.products[0].currentPrice,35000000);assert.equal(f.products[0].notes,'Kiot gốc');
 assert.equal(f.sapos[0].variants[0].price,35000000);assert.equal(f.sapos[0].content,'<b>HTML gốc</b>');
 const run=table(f);assert.equal(run.rows[0].currentPrice,35000000);assert.equal(run.rows[0].p0,35000000);assert.equal(run.rows[0].writeStatus,'restored');
 const again=await f.live.prepare(run.id,['SP000009']);assert.equal((await f.live.commit(again.id,true)).outcome,'success');
 f.products[0].notes+=' outside edit';await assert.rejects(f.live.prepare(table(f).id,['SP000009']),/thay đổi/);
});

test('Sapo failure still publishes verified Kiot price while unknown Kiot stays untouched',async()=>{
 const f=await fixture(1),p=await f.prepare();f.sc.update=async()=>{throw Object.assign(Error('rejected'),{httpStatus:422});};
 await f.live.commit(p.id,true);assert.equal(table(f).rows[0].currentPrice,32400000);
 const g=await fixture(1),q=await g.prepare();g.kiot.update=async()=>{throw Object.assign(Error('timeout'),{uncertain:true});};
 await g.live.commit(q.id,true);assert.equal(table(g).rows[0].currentPrice,35000000);assert.equal(table(g).rows[0].writeStatus,undefined);
});

test('unknown Kiot rollback keeps the last verified table price and does not mark restored',async()=>{
 const f=await fixture(1),p=await f.prepare(),u=await f.live.commit(p.id,true),r=await f.live.prepareRestore(u.id);
 const before=structuredClone(f.sim.state.runs);
 f.kiot.update=async()=>{throw Object.assign(Error('timeout'),{uncertain:true});};
 const restored=await f.live.commitRestore(r.id,true);assert.equal(restored.items[0].platforms.kiot.status,'unknown');
 assert.deepEqual(f.sim.state.runs,before);assert.equal(table(f).rows[0].currentPrice,32400000);
 assert.equal(table(f).rows[0].writeStatus,'updated');
});

test('verified Kiot rollback refreshes its table even when Sapo rollback fails',async()=>{
 const f=await fixture(1),p=await f.prepare(),u=await f.live.commit(p.id,true),r=await f.live.prepareRestore(u.id);
 f.sc.restore=async()=>{throw Object.assign(Error('rejected'),{httpStatus:422});};
 const restored=await f.live.commitRestore(r.id,true);assert.equal(restored.outcome,'partial_failure');
 assert.equal(restored.items[0].platforms.kiot.status,'done');assert.equal(restored.items[0].platforms.sapo.status,'write_failed');
 assert.equal(table(f).rows[0].currentPrice,35000000);assert.equal(table(f).rows[0].writeStatus,'restored');
});
