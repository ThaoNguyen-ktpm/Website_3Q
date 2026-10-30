import test from 'node:test';
import assert from 'node:assert/strict';
import {START,ageFields,calculate} from '../lib/pricing.js';
const product=(extras={})=>({name:'Túi',code:'START',createdAt:'2026-10-16',p0:35e6,currentPrice:35e6,active:true,stock:1,...extras});
test('global epoch stays 1 October; pre-July excluded and batch starts M0',()=>{
 assert.equal(START,'2026-10-01');
 assert.equal(ageFields(product({createdAt:'2026-07-01'}),'2026-10-01').ageDays,0);
 assert.equal(calculate(product({createdAt:'2026-06-01'}),'2026-10-01').status,'excluded');
 assert.equal(calculate(product({createdAt:'2026-07-01'}),'2026-10-01').m,0);
 assert.equal(calculate(product(),'2026-10-17').age,1);
});
test('before new epoch waits; later creation keeps its own start date',()=>{
 const before=calculate(product({createdAt:'2026-06-01'}),'2026-09-30');assert.equal(before.status,'waiting');assert.equal(before.m,null);assert.match(before.reasons.join(),/01\/10\/2026/);
 const later=calculate(product({createdAt:'2026-10-20T08:00'}),'2026-10-21');assert.equal(later.saleStartDate,'2026-10-20');assert.equal(later.age,1);
});
test('new epoch retains ordinary/hottrend boundaries and post-markdown rights',()=>{
 for(const [age,ordinary,hot] of [[14,0,0],[15,1,0],[44,2,0],[45,3,1],[60,4,2],[75,5,3],[120,6,6]]){
  const day=new Date(Date.parse('2026-10-16')+age*86400000).toISOString().slice(0,10);
  assert.equal(calculate(product(),day).m,ordinary);assert.equal(calculate(product({name:'Túi !'}),day).m,hot);
 }
 const day=new Date(Date.parse('2026-10-16')+15*86400000).toISOString().slice(0,10);
 assert.equal(calculate(product(),day).allowance,1710000);
});
