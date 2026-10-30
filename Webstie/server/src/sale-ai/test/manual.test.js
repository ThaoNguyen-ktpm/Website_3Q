import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { percentageSuggestion, validateManual } from '../lib/manual-pricing.js';
import { calculate } from '../lib/pricing.js';
import { Simulator } from '../lib/service.js';
import { Store } from '../lib/store.js';
import { createTestApp } from './http-fixture.js';
const item = overrides => ({code:'MANUAL',name:'Mẫu duyệt riêng',currentPrice:700e6,p0:700e6,
  createdAt:'2026-10-13',active:true,stock:1,floor:0,source:'Giả định kiểm thử',notes:'Ghi chú và lịch sử gốc',...overrides});
const source = {load:async()=>[item()]};
const manual = {price:665e6,allowance:19.95e6,updatedAt:'2027-01-20T03:00:00Z'};

test('independent percent suggestions are exact, blank is not zero, fractions are never rounded', () => {
  assert.equal(percentageSuggestion(700e6,'5',true),665e6);
  assert.equal(percentageSuggestion(665e6,'3'),19.95e6);
  assert.equal(percentageSuggestion(665e6,'0'),0);
  assert.equal(percentageSuggestion(665e6,''),null);
  assert.equal(percentageSuggestion(10000,'0.29'),29);
  assert.throws(()=>percentageSuggestion(700000001,'5',true),/phần lẻ/);
  for(const percent of ['-1','101','abc','Infinity']) assert.throws(()=>percentageSuggestion(700e6,percent));
});

test('manual amounts validated and retained through M0-M6 without floor checks', () => {
  validateManual(665e6,0);
  for (const [price,allowance] of [[0,0],[-1,0],[1,1],[3,-1],[3,3.1],[null,0],[3,null],[3,'0'],[NaN,0],[Number.MAX_SAFE_INTEGER+1,0]]) assert.throws(()=>validateManual(price,allowance));
  assert.match(calculate(item(),'2027-01-20').reasons.join(),/Chờ nhập giá duyệt riêng/);
  assert.match(calculate(item({manualPricing:{price:665e6}}),'2027-01-20').reasons.join(),/Chờ nhập giá duyệt riêng/);
  for (const [day,m] of [['2026-10-13',0],['2026-11-01',1],['2026-11-16',2],['2026-12-01',3],['2026-12-16',4],['2026-12-31',5],['2027-01-15',6]]) {
    const row=calculate(item({manualPricing:manual}),day);
    assert.equal(row.m,m);assert.equal(row.price,665e6);assert.equal(row.allowance,19.95e6);assert.equal(row.net,645.05e6);
    assert.equal(row.status,'simulated');assert.equal(row.markdown,undefined);assert.deepEqual(row.manualPricing,manual);
    assert.match(row.notePreview,/Dùng giá tay/);assert.doesNotMatch(row.notePreview,/Áp dụng M1/);
    assert.ok(row.notePreview.startsWith('[BAOQ-MO-PHONG]'));assert.ok(row.notePreview.endsWith('Ghi chú và lịch sử gốc'));
  }
  const waiting=calculate(item({manualPricing:manual,floor:null}),'2027-02-10');
  assert.equal(waiting.price,665e6);assert.equal(waiting.status,'simulated');
  assert.equal(calculate(item({manualPricing:manual,floor:650e6}),'2027-02-10').status,'simulated');
  assert.equal(calculate(item({manualPricing:{price:665e6,allowance:0}}),'2027-02-10').net,665e6);
  assert.equal(calculate(item({manualPricing:manual,stock:0}),'2027-02-10').status,'excluded');
  assert.equal(calculate(item({manualPricing:manual,active:false}),'2027-02-10').status,'excluded');
  const ordinary=calculate(item({p0:35e6,manualPricing:manual}),'2027-02-10');assert.equal(ordinary.m,6);assert.equal(ordinary.price,29.4e6);assert.equal(ordinary.allowance,0);
});

test('save manual prices persists, keeps source values and immutable snapshots, records edits', async () => {
  const dir=await mkdtemp(join(tmpdir(),'baoq-manual-'));
  try {
    const store=new Store(join(dir,'state.json'));
    const simulator=new Simulator(store,source,()=>new Date(manual.updatedAt));await simulator.initialize();
    const first=structuredClone(await simulator.run('2027-01-20'));
    const original=structuredClone(simulator.state.products[0]);
    await simulator.saveManual('MANUAL',manual.price,manual.allowance);
    const next=await simulator.run('2027-02-10');const repeat=await simulator.run('2027-02-10');assert.deepEqual(next.rows,repeat.rows);
    await simulator.saveManual('MANUAL',650e6,0);const last=await simulator.run('2027-04-11');
    assert.equal(last.rows[0].price,650e6);assert.equal(last.rows[0].allowance,0);
    assert.deepEqual(simulator.state.runs.find(r=>r.id===first.id),first);
    assert.equal(next.rows[0].price,665e6);assert.equal(next.rows[0].allowance,19.95e6);
    for (const key of ['p0','currentPrice','notes']) assert.equal(simulator.state.products[0][key],original[key]);
    assert.equal(simulator.state.manualEdits.length,2);assert.equal(simulator.state.manualEdits[0].before.price,665e6);
    const restarted=new Simulator(store,source);await restarted.initialize();
    assert.equal(restarted.state.products[0].manualPricing.price,650e6);assert.deepEqual(restarted.state.runs,simulator.state.runs);
    assert.deepEqual(restarted.state.manualEdits,simulator.state.manualEdits);
  } finally {await rm(dir,{recursive:true,force:true});}
});

test('manual save rejects excluded and ordinary items and rolls back on disk errors', async () => {
  const store={read:async()=>null,write:async()=>{}};
  const simulator=new Simulator(store,{load:async()=>[item(),item({code:'ZERO',stock:0}),item({code:'STOP',active:false}),item({code:'LOW',currentPrice:599e6})]});
  await simulator.initialize();await simulator.mutate(state=>{state.products[0].floor=null;});
  await simulator.saveManual('MANUAL',665e6,0);assert.equal(simulator.state.products[0].manualPricing.price,665e6);
  for(const code of ['ZERO','STOP','LOW','MISSING']) await assert.rejects(simulator.saveManual(code,600e6,0));
  const snapshot=structuredClone(simulator.state);store.write=async()=>{throw new Error('disk failure');};
  await assert.rejects(simulator.saveManual('MANUAL',650e6,0),/disk failure/);assert.deepEqual(simulator.state,snapshot);assert.equal(simulator.busy,false);
});

test('removed manual HTTP endpoint returns 410 and preserves stored prices', async () => {
  const dir=await mkdtemp(join(tmpdir(),'baoq-manual-http-'));
  const {server}=await createTestApp({store:new Store(join(dir,'state.json')),source});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
  const post=(body,origin=base)=>fetch(base+'/api/manual-price',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
  try {
    // Foreign-origin rejection is tested through the website middleware in saleAiProxy.test.ts.
    const before=await (await fetch(base+'/api/state')).json();
    assert.equal((await post({code:'MANUAL',price:665e6,allowance:19.95e6})).status,410);
    const state=await (await fetch(base+'/api/state')).json();assert.deepEqual(state.products,before.products);assert.deepEqual(state.manualEdits,before.manualEdits);
  } finally {await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true});}
});
