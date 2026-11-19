import test from 'node:test';
import assert from 'node:assert/strict';
import {calculate} from '../lib/pricing.js';
import {normalizeProduct} from '../lib/kiot.js';
import {autoSelection} from '../lib/auto-update.js';

const product={id:1,code:'TEST-COST',name:'Dữ liệu mẫu',p0:35e6,currentPrice:35e6,cost:34.5e6,createdAt:'2026-08-01',stock:1,active:true};
test('cost is the highest positive branch cost, absent cost stays null',()=>{
  assert.equal(normalizeProduct({inventories:[{cost:0},{cost:12},{cost:15},{cost:-1}]}).cost,15);
  assert.equal(normalizeProduct({inventories:[]}).cost,null);
});
test('cost policy excludes missing/invalid cost and P0 at or below cost',()=>{
  for(const cost of [undefined,null,0,-1,1.5,'12'])assert.equal(calculate({...product,cost},'2026-11-10').excludedReason,'missing_cost');
  for(const cost of [35e6,36e6])assert.equal(calculate({...product,cost},'2026-11-10').excludedReason,'p0_not_above_cost');
});
test('sale price below cost needs approval; equality and M0 stay simulated',()=>{
  const row=calculate(product,'2026-11-10');
  assert.equal(row.status,'needs_approval');assert.equal(row.belowCost,300000);assert.equal(row.cost,product.cost);
  assert.equal(calculate({...product,cost:34.2e6},'2026-11-10').status,'simulated');
  assert.equal(calculate(product,'2026-10-25').status,'simulated');
});
test('automatic selection never writes excluded or approval rows',()=>{
  const rows=['needs_approval','excluded','simulated'].map((status,i)=>({...product,id:i,code:String(i),status,m:1,price:34e6}));
  assert.deepEqual(autoSelection({products:rows,runs:[{rows}],updates:[]}).codes,['2']);
});
test('below-cost approval never bypasses an existing invalid allowance guard',()=>{
  const row=calculate({...product,p0:35000001,cost:34999999},'2026-11-10');
  assert.equal(row.status,'waiting');assert.match(row.reasons.join(),/phần lẻ/);
});
