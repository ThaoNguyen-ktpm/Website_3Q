import test from 'node:test';
import assert from 'node:assert/strict';
import {calculate, ageFields} from '../lib/pricing.js';
import {migrateCycles, recoverP0} from '../lib/cycle.js';
import {createTestApp} from './http-fixture.js';
const p = (extras={}) => ({id:99,code:'CYCLE',name:'Mẫu',p0:0,currentPrice:12e6,createdAt:'2027-01-20T10:19:09.8700000',active:true,stock:1,notes:'',...extras});
const memory = initial => {let value=initial;return {read:async()=>structuredClone(value),write:async s=>{value=structuredClone(s);}};};
test('valid date retains age and M despite P0 errors; invalid date does not invent age',()=>{
  const row=calculate(p(),'2027-01-20');assert.equal(row.age,0);assert.equal(row.m,0);assert.equal(row.price,null);assert.match(row.reasons.join(),/P0/);
  assert.equal(calculate(p({createdAt:null}),'2027-01-20').age,null);
  assert.equal(calculate(p({createdAt:'2027-01-21'}),'2027-01-20').age,null);
  assert.equal(ageFields(p({createdAt:'2023-01-01'}),'2027-01-20').ageDays,null);
  for(const [age,m] of [[44,0],[45,1],[60,2],[75,3],[120,6]]) {
    const day=new Date(Date.parse('2026-10-16')+age*86400000).toISOString().slice(0,10);
    assert.equal(ageFields(p({name:'Mẫu !',createdAt:'2026-10-16'}),day).m,m);
  }
});
test('migration restores historic P0, guards evidence/conflicts, journals once and preserves history',()=>{
  const a=p(),b=p({id:100,code:'OLD'}),c=p({id:101,code:'WRITTEN',notes:'<!--BAOQ-CURRENT-->'}),d=p({id:102,code:'ZERO',currentPrice:0});
  const state={products:[a,b,c,d],runs:[{rows:[{id:100,p0:35e6}]}],prepared:[{status:'prepared'}]};const runs=structuredClone(state.runs);
  assert.equal(migrateCycles(state,'2027-01-20','time'),2);assert.equal(a.p0,12e6);assert.equal(b.p0,35e6);assert.equal(c.p0Status,'review_required');assert.equal(d.p0Status,'pending_price');assert.deepEqual(state.runs,runs);assert.deepEqual(state.prepared,[]);
  assert.equal(recoverP0(state,a,'later'),false);assert.equal(state.p0Repairs.length,2);
  const conflict=p({id:200,code:'CONFLICT'});state.runs.push({rows:[{id:200,p0:1e6},{id:200,p0:2e6}]});assert.equal(recoverP0(state,conflict,'later'),false);assert.equal(conflict.p0Status,'review_required');
});
test('zero then positive price initializes once; day rollover and restart persist ages; hypothetical run is isolated',async()=>{
  let now=new Date('2027-01-20T05:00:00Z');const rows=[p({currentPrice:0})];const store=memory(null),liveStore=memory(null);
  const client={all:async()=>structuredClone(rows),price:async()=>{throw Error('NO WRITE');},note:async()=>{throw Error('NO WRITE');}};
  const app=await createTestApp({store,liveStore,client,clock:()=>now});await app.refreshTable();assert.equal(app.real.state.products.length,0);assert.equal(app.real.state.archivedProducts[0].p0Status,'pending_price');
  rows[0].currentPrice=12e6;await app.refreshTable();assert.equal(app.real.state.products[0].p0,12e6);assert.equal(app.real.state.runs[0].rows[0].m,0);
  rows[0].currentPrice=11e6;await app.refreshTable();assert.equal(app.real.state.products[0].p0,12e6);
  await app.real.run('2027-02-20');assert.equal(app.real.state.products[0].ageDays,0);
  now=new Date('2027-01-20T17:01:00Z');await app.keepCurrent();assert.equal(app.real.state.products[0].ageDays,1);assert.equal(app.real.state.products[0].ageAsOfDate,'2027-01-21');
  const restart=await createTestApp({store,liveStore,client,clock:()=>now});assert.equal(restart.real.state.products[0].p0,12e6);assert.equal(restart.real.state.products[0].ageDays,1);
});
