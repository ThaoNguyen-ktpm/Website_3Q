import test from 'node:test';
import assert from 'node:assert/strict';
import {calculate,POLICY} from '../lib/pricing.js';
const p=extra=>({code:'15D',name:'Túi',createdAt:'2026-10-16',p0:35e6,currentPrice:35e6,active:true,stock:1,...extra});
const at=age=>new Date(Date.parse('2026-10-16')+age*86400000).toISOString().slice(0,10);
test('new ordinary products step every 15 days from M0 and cap at M6',()=>{
 assert.equal(POLICY,'baoq-2026-10-30-hide-before-jul-v10');
 for(const [age,m] of [[0,0],[14,0],[15,1],[29,1],[30,2],[44,2],[45,3],[59,3],[60,4],[74,4],[75,5],[89,5],[90,6],[240,6]])assert.equal(calculate(p(),at(age)).m,m);
});
test('new hottrend has exactly 45 days in M0 then 15-day steps',()=>{
 for(const [age,m] of [[0,0],[14,0],[15,0],[30,0],[44,0],[45,1],[59,1],[60,2],[74,2],[75,3],[89,3],[90,4],[104,4],[105,5],[119,5],[120,6],[240,6]])assert.equal(calculate(p({name:'Túi !'}),at(age)).m,m);
});
test('July-October batch starts M1 on November 1 for both types',()=>{
 for(const name of ['Túi','Túi !'])for(const [age,m] of [[0,1],[14,1],[15,2],[29,2],[30,3],[44,3],[45,4],[59,4],[60,5],[74,5],[75,6],[150,6]]){
  const r=calculate(p({name,createdAt:'2026-09-30'}),new Date(Date.parse('2026-11-01')+age*86400000).toISOString().slice(0,10));assert.equal(r.age,age);assert.equal(r.m,m);assert.equal(r.saleStartDate,'2026-11-01');
 }
});
test('15-day policy preserves price bands and P0 idempotency, M3/M4 sale rules',()=>{
 const first=calculate(p(),at(15));assert.equal(first.price,34200000);assert.equal(first.allowance,1710000);
 assert.equal(calculate(p({currentPrice:first.price}),at(15)).price,first.price);
 const third=calculate(p(),at(45));assert.equal(third.price,32400000);assert.equal(third.allowance,972000);
 assert.equal(calculate(p(),at(60)).allowance,0);
 const hot=calculate(p({name:'Túi !'}),at(75));assert.equal(hot.price,third.price);assert.equal(hot.allowance,third.allowance);
 const old=calculate(p({createdAt:'2026-09-30'}),'2026-12-01');assert.equal(old.price,third.price);
});
