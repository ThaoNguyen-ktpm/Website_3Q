import test from 'node:test';
import assert from 'node:assert/strict';
import {calculate,ageFields,POLICY} from '../lib/pricing.js';
import {viewData} from '../lib/view-data.js';
import {Simulator} from '../lib/service.js';
const item=(extra={})=>({code:'OLD',name:'Túi',createdAt:'2026-09-30',p0:35e6,currentPrice:35e6,active:true,stock:1,notes:'<p>Mô tả gốc</p>',...extra});
const day=age=>new Date(Date.parse('2026-11-01')+age*86400000).toISOString().slice(0,10);
// Products created after the epoch count age from their own creation day.
const from=(start,age)=>new Date(Date.parse(start)+age*86400000).toISOString().slice(0,10);
test('July-October batch starts M1 on November 1 for both types',()=>{
 assert.equal(POLICY,'baoq-2026-10-30-hide-before-jul-v10');
 for(const name of ['Túi','Túi !']) for(const [age,m] of [[0,1],[14,1],[15,2],[29,2],[30,3],[75,6],[150,6]]) {
  const r=calculate(item({name}),day(age));assert.equal(r.age,age);assert.equal(r.m,m);assert.equal(r.saleStartDate,'2026-11-01');
 }
});
test('October 16 creation cutoff and newer hottrend uses its 45-day M0',()=>{
 for(const createdAt of ['2026-10-16','2026-10-17']) for(const name of ['Túi','Túi !']) {
  assert.equal(calculate(item({createdAt,name}),from(createdAt,0)).m,0);
  assert.equal(calculate(item({createdAt,name}),from(createdAt,15)).m,name.includes('!')?0:1);
  assert.equal(calculate(item({createdAt,name}),from(createdAt,45)).m,name.includes('!')?1:3);
 }
 const later=calculate(item({createdAt:'2026-10-20'}),'2026-10-21');assert.equal(later.age,1);assert.equal(later.m,0);
});
test('cutoff uses Vietnam date, including timestamps across midnight',()=>{
 const old=calculate(item({createdAt:'2026-10-15T16:59:59Z'}),day(0));assert.equal(old.createdDateVN,'2026-10-15');assert.equal(old.m,1);
 const newer=calculate(item({createdAt:'2026-10-15T17:00:00Z'}),day(0));assert.equal(newer.createdDateVN,'2026-10-16');assert.equal(newer.m,1);
});
test('invalid dates and days before the epoch wait without fabricated M',()=>{
 for(const createdAt of [null,'bad','2026-02-30','2026-11-02']) {
  const r=calculate(item({createdAt}),day(0));assert.equal(r.status,'waiting');assert.equal(r.m,null);
 }
 const before=calculate(item(),'2026-09-30');assert.equal(before.age,null);assert.equal(before.m,null);assert.equal(before.status,'waiting');
});
test('M1 markdown starts from P0 once and sale rights follow actual M',()=>{
 const r=calculate(item(),day(0));assert.equal(r.price,34.2e6);assert.equal(r.allowance,1710000);
 assert.equal(calculate(item({currentPrice:r.price}),day(0)).price,r.price);
 const m3=calculate(item(),day(30));assert.equal(m3.price,32.4e6);assert.equal(m3.allowance,972000);
 assert.equal(calculate(item(),day(45)).allowance,0);
 const manual=calculate(item({p0:700e6,manualPricing:{price:665e6,allowance:19950000}}),day(75));assert.equal(manual.m,6);assert.equal(manual.price,665e6);
});
test('paged results expose the normalized Kiot date without exposing raw fields',()=>{
 const row=calculate(item(),day(0));
 const state={products:[],runs:[{id:'r',day:day(0),rows:[{...row,rawSource:{secret:'no'}}]}],policy:POLICY};
 const v=viewData(state,new URLSearchParams(),{revision:'1',today:day(0),dataset:'real',busy:false});
 assert.equal(v.runs[0].rows[0].createdDateVN,'2026-09-30');assert.equal(v.runs[0].rows[0].rawSource,undefined);
});
test('both tables share the age/M/Kiot-date cell including missing date',async()=>{
 const ui=await import('../public/age-cell.js');
 const esc=s=>String(s).replaceAll('<','&lt;');
 assert.equal(ui.ageCell({age:0,m:1,createdDateVN:'2026-09-25'},esc),'0 ngày<br>M1<span class="small">Tạo: 25/09/2026</span>');
 assert.match(ui.ageCell({age:null,m:null,createdDateVN:null},esc),/Chưa xác định/);
 assert.match(ui.ageCell({age:0,m:0,createdDateVN:'<script>'},esc),/Chưa xác định/);
});
test('policy upgrade clears preparations, recalculates locally and preserves history and rollback snapshots',async()=>{
 const history={id:'historic',day:'2026-10-13',policy:'baoq-2026-10-13-note-first-v5',rows:[{code:'OLD',p0:35e6,m:0,price:35e6}]};
 const update={id:'write',items:[{code:'OLD',before:{price:35e6,notes:'<p>Mô tả trước ghi</p>'},after:{price:34.2e6}}]};
 let saved={version:1,cycleVersion:2,policy:history.policy,products:[item()],runs:[history],prepared:[{id:'old',policy:history.policy}],updates:[update],settings:{enabled:false}};
 const originalHistory=structuredClone(saved.runs),originalUpdates=structuredClone(saved.updates);
 const store={read:async()=>structuredClone(saved),write:async value=>{saved=structuredClone(value);}};
 const service=new Simulator(store,{load:async()=>{throw Error('No external reads allowed');}},()=>new Date('2026-10-13T03:00:00Z'));
 await service.initialize();assert.equal(service.state.policy,POLICY);assert.deepEqual(service.state.prepared,[]);
 assert.deepEqual(service.state.runs,originalHistory);assert.deepEqual(service.state.updates,originalUpdates);
 await service.run(undefined,'data_change');assert.equal(service.state.runs[0].rows[0].m,0);assert.equal(service.state.runs[0].rows[0].createdDateVN,'2026-09-30');
 assert.deepEqual(service.state.runs.find(r=>r.id==='historic'),history);assert.deepEqual(service.state.updates,originalUpdates);
});
