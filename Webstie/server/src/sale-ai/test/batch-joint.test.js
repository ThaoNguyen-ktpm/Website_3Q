import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulator} from '../lib/service.js';
import {LiveService} from '../lib/live.js';
import {normalizeProduct} from '../lib/kiot.js';
import {SapoService} from '../lib/sapo.js';
import {prepareRestore} from '../lib/restore.js';
import {summaryText} from '../lib/update-report.js';
import {LOT_SIZE} from '../lib/batch-joint.js';

// TASK-102: page updates check from list reads and write Kiot 50 per bulk PUT. Fakes only — no shop API is called.
// Modeled latency (log 19/10, bulk PUT time is an assumption until checked on the shop machine):
// Kiot list page 0.4 s; bulk PUT 5 s, or the Sapo lane time of the lot when longer (Sapo runs alongside, 3 lanes × 0.7 s/product).
const memory=()=>{let disk=null;return {read:async()=>structuredClone(disk),write:async s=>{disk=structuredClone(s);}};};
const PAGE_MS=400,LOT_PUT_MS=5000,SAPO_ITEM_MS=700;
async function fixture(n,{shared=false}={}){
 let now=Date.parse('2027-01-22T03:00:00Z');const clock=()=>new Date(now);
 const products=Array.from({length:n},(_,i)=>normalizeProduct({id:i+1,code:'SP'+String(i+9).padStart(6,'0'),name:'Túi '+i,basePrice:35e6,createdDate:'2026-12-03',isActive:true,description:'Kiot gốc',inventories:[{branchId:44466,onHand:1}]}));
 const byId=new Map(products.map(p=>[p.id,p])),modified=new Map(),counts={gets:0,listPages:0,lots:[],puts:0,sapoGets:0,sapoPuts:0};
 const edit=(p,fields)=>{Object.assign(p,fields);modified.set(p.id,now);};
 const kiot={
  all:async()=>{const pages=Math.ceil(n/100);counts.listPages+=pages;now+=pages*PAGE_MS;return structuredClone(products);},
  product:async id=>{counts.gets++;now+=PAGE_MS;return structuredClone(byId.get(id));},
  update:async(p,b)=>{counts.puts++;edit(byId.get(p.id),{currentPrice:b.basePrice,notes:b.description});},
  listModified:async since=>{const from=Date.parse(since),list=products.filter(p=>modified.get(p.id)>=from),pages=Math.max(1,Math.ceil(list.length/100));
   kiot.lastPages=pages;counts.gets+=pages;now+=pages*PAGE_MS;return structuredClone(list);},
  updateMany:async entries=>{counts.lots.push(entries.length);now+=Math.max(LOT_PUT_MS,Math.ceil(entries.length/3)*SAPO_ITEM_MS);
   for(const {product,fields} of entries)edit(byId.get(product.id),{currentPrice:fields.basePrice,notes:fields.description});},
 };
 // shared: SP000009 and SP000010 are two variants of one Sapo product.
 const sapos=products.map((p,i)=>({id:5000000+i,content:'<b>HTML gốc</b>',variants:[{id:900000+i,sku:p.code,price:35e6}]}));
 if(shared){sapos[0].variants.push(sapos[1].variants[0]);sapos.splice(1,1);}
 const sapoById=new Map(sapos.map(s=>[s.id,s]));
 const sc={all:async()=>structuredClone(sapos),product:async id=>{counts.sapoGets++;return structuredClone(sapoById.get(id));},
  update:async(id,vid,price,content)=>{counts.sapoPuts++;const p=sapoById.get(id);p.variants.find(v=>v.id===vid).price=price;if(content!==null)p.content=content;}};
 const sapo=new SapoService(sc,memory(),'fake');await sapo.initialize();await sapo.refresh();const check=await sapo.check(products[0].code);await sapo.confirm({...check,confirmed:true});
 const store=memory(),sim=new Simulator(store,{load:async()=>[]},clock);await sim.initialize();
 const live=new LiveService(sim,kiot,clock);sim.live=live;live.sapo=sapo;live.requireJoint=true;live.timingSink=()=>{};live.batchWrites=true;
 const sleeps=[];live.sleep=async ms=>{sleeps.push(ms);now+=ms;};
 await live.refresh();sim.state.mapping={verified:true};
 const f={sim,live,sapo,kiot,sc,products,sapos,byId,sapoById,store,counts,sleeps,edit,clock,advance:ms=>{now+=ms;},
  run:()=>sim.run(),
  prepare:async(codes=products.map(p=>p.code),options={})=>live.prepare((await sim.run()).id,codes,{continueOnError:true,...options}),
  update:async(codes,options)=>{const p=await f.prepare(codes,options);return live.commit(p.id,true);}};
 return f;
}
const kiotStatus=(u,code)=>u.items.find(i=>i.code===code).platforms.kiot;

test('page update writes Kiot in lots of 50 without a GET per product; both sides verified and restorable',async()=>{
 const f=await fixture(120),p=await f.prepare();
 assert.equal(p.batch,true);assert.equal(f.counts.gets,0);
 const u=await f.live.commit(p.id,true);
 assert.equal(u.outcome,'success');assert.equal(u.batch,true);
 assert.deepEqual(f.counts.lots,[50,50,20]);assert.equal(f.counts.puts,0);
 assert.ok(f.products.every(x=>x.currentPrice===u.items[0].row.price&&x.notes.includes('data-baoq-event')));
 assert.ok(f.sapos.every(s=>s.variants[0].price===u.items[0].row.price&&s.content.startsWith('<b>HTML gốc</b>')));
 assert.ok(u.items.every(i=>i.platforms.kiot.afterProduct&&i.platforms.sapo.afterProduct));
 assert.equal(summaryText(u.summary,u),'Đã cập nhật thành công 120/120 sản phẩm.');
 assert.equal(f.live.operation?.batch?.done??120,120);
 assert.equal((await prepareRestore(f.live,u.id)).tasks.length,240);
});

test('products right on both sides are not sent; a product right on Kiot only sends Sapo only, and restore skips Kiot',async()=>{
 const f=await fixture(3);await f.update();
 f.sapoById.get(5000001).variants[0].price=35e6;
 f.counts.lots=[];f.counts.sapoPuts=0;
 const p=await f.prepare();
 assert.deepEqual(p.items.map(i=>[i.code,i.alreadyOk]),[['SP000010',['kiot']]]);assert.equal(p.unchanged,2);
 const u=await f.live.commit(p.id,true);
 assert.equal(u.outcome,'success');assert.deepEqual(f.counts.lots,[]);assert.equal(f.counts.sapoPuts,1);
 assert.deepEqual(kiotStatus(u,'SP000010'),{status:'done',skipped:true,alreadyOk:true});
 assert.equal(summaryText(u.summary,u),'Đã cập nhật thành công 1/1 sản phẩm. Bỏ qua 2 sản phẩm đã đúng giá.');
 const r=await prepareRestore(f.live,u.id);assert.deepEqual(r.tasks.map(t=>t.name),['sapo']);
 const again=await f.prepare();assert.equal(again.items.length,0);assert.equal(again.unchanged,3);
 const none=await f.live.commit(again.id,true);assert.equal(summaryText(none.summary,none),'Tất cả 3 sản phẩm đã đúng giá, không cần cập nhật.');
});

test('a Kiot edit after the check is never overwritten: before the first lot and before a later lot',async()=>{
 const f=await fixture(120),p=await f.prepare();
 f.edit(f.byId.get(1),{notes:'Sửa tay trước khi ghi'});
 const updateMany=f.kiot.updateMany;let first=true;
 f.kiot.updateMany=async entries=>{if(first){first=false;f.edit(f.byId.get(110),{notes:'Sửa tay giữa lượt'});}return updateMany(entries);};
 const u=await f.live.commit(p.id,true);
 for(const [code,id] of [['SP000009',1],['SP000118',110]]){
  const item=u.items.find(i=>i.code===code);
  assert.deepEqual(Object.values(item.platforms).map(x=>[x.status,x.error]),[['preflight_failed','Kiot thay đổi sau xác nhận'],['preflight_failed','Kiot thay đổi sau xác nhận']]);
  assert.match(f.byId.get(id).notes,/Sửa tay/);assert.equal(f.sapoById.get(5000000+id-1).variants[0].price,35e6);
 }
 assert.deepEqual(f.counts.lots,[49,50,19]);assert.equal(u.outcome,'partial_failure');
 assert.equal(summaryText(u.summary,u),'Đã cập nhật thành công 118/120 sản phẩm. Lỗi 2 sản phẩm.');
});

test('bulk timeout marks the whole lot unknown, sends nothing again, and the other lots continue',async()=>{
 const f=await fixture(120),p=await f.prepare();
 const updateMany=f.kiot.updateMany;let lot=0;
 f.kiot.updateMany=async entries=>{if(++lot===2){f.counts.lots.push(entries.length);throw Object.assign(Error('hết thời gian chờ'),{uncertain:true});}return updateMany(entries);};
 const u=await f.live.commit(p.id,true);
 const lot2=u.items.slice(50,100).map(i=>i.platforms.kiot.status);
 assert.deepEqual([...new Set(lot2)],['unknown']);assert.deepEqual(f.counts.lots,[50,50,20]);
 assert.ok(u.items.slice(50,100).every(i=>i.platforms.sapo.status==='done'));
 assert.ok([...u.items.slice(0,50),...u.items.slice(100)].every(i=>i.status==='done'));
});

test('bulk 429 fails only that lot, pauses Kiot for Retry-After, then continues',async()=>{
 const f=await fixture(120),p=await f.prepare();
 const updateMany=f.kiot.updateMany;let lot=0;
 f.kiot.updateMany=async entries=>{if(++lot===1)throw Object.assign(Error('Kiot trả HTTP 429'),{httpStatus:429,uncertain:false,retryAfter:60});return updateMany(entries);};
 const u=await f.live.commit(p.id,true);
 assert.ok(u.items.slice(0,50).every(i=>i.platforms.kiot.status==='write_failed'&&i.platforms.kiot.error==='Kiot trả HTTP 429'));
 assert.ok(u.items.slice(50).every(i=>i.status==='done'));
 assert.ok(f.sleeps.some(ms=>ms>55000&&ms<=60000),String(f.sleeps));
});

test('a product missing or different in the read-back is unknown, not resent',async()=>{
 const f=await fixture(3),p=await f.prepare();
 let sent;const updateMany=f.kiot.updateMany;f.kiot.updateMany=async entries=>{sent=entries.length;return updateMany(entries.filter(e=>e.product.id!==2));};
 const u=await f.live.commit(p.id,true);
 assert.deepEqual([kiotStatus(u,'SP000010').status,kiotStatus(u,'SP000010').error],['unknown','Không xác minh được sau khi gửi']);
 assert.equal(sent,3);assert.equal(f.counts.lots.length,1);assert.equal(kiotStatus(u,'SP000009').status,'done');
});

test('401 stops Kiot; Sapo still finishes every product',async()=>{
 const f=await fixture(120),p=await f.prepare();
 let calls=0;f.kiot.updateMany=async()=>{calls++;throw Object.assign(Error('Kiot trả HTTP 401'),{httpStatus:401});};
 const u=await f.live.commit(p.id,true);
 assert.equal(calls,1);
 assert.ok(u.items.slice(0,50).every(i=>i.platforms.kiot.status==='write_failed'));
 assert.ok(u.items.slice(50).every(i=>i.platforms.kiot.status==='not_sent'));
 assert.ok(u.items.every(i=>i.platforms.sapo.status==='done'));
});

test('two variants of one Sapo product both keep their price and the HTML',async()=>{
 const f=await fixture(4,{shared:true});const u=await f.update();
 assert.equal(u.outcome,'success');
 const shared=f.sapoById.get(5000000);
 assert.deepEqual(shared.variants.map(v=>v.price),[u.items[0].row.price,u.items[1].row.price]);
 assert.ok(shared.content.startsWith('<b>HTML gốc</b>'));
});

test('the journal saves the whole lot as sending before the bulk PUT',async()=>{
 const f=await fixture(60),p=await f.prepare();
 const seen=[];const updateMany=f.kiot.updateMany;
 f.kiot.updateMany=async entries=>{const saved=(await f.store.read()).updates[0];
  seen.push(entries.map(e=>saved.items.find(i=>i.id===e.product.id).platforms.kiot).every(x=>x.status==='sending'&&x.requestSent===true));return updateMany(entries);};
 await f.live.commit(p.id,true);assert.deepEqual(seen,[true,true]);
});

test('confirmations without continueOnError keep the per-product engine',async()=>{
 const f=await fixture(2);
 const p=await f.prepare(undefined,{continueOnError:false});assert.equal(p.batch,undefined);
 const u=await f.live.commit(p.id,true);assert.equal(u.batch,undefined);assert.deepEqual(f.counts.lots,[]);assert.equal(f.counts.puts,2);
 const h=await fixture(2);delete h.live.batchWrites;assert.equal((await h.prepare()).batch,undefined); // off unless SALE_AI_BATCH=1
});

test('5.000 products: modeled ≤ 30 minutes and ≤ 300 Kiot GET',async()=>{
 const f=await fixture(5000);f.counts.listPages=0;const start=f.clock().getTime(),started=Date.now();
 const u=await f.update();
 const modeled=(f.clock().getTime()-start)/1000,internal=(Date.now()-started)/1000,kiotGets=f.counts.listPages+f.counts.gets;
 console.log(`5000 món: mô phỏng ${Math.round(modeled)} s mạng + ${Math.round(internal)} s xử lý thật; GET Kiot ${kiotGets} (${f.counts.listPages} trang danh sách); ${f.counts.lots.length} lô`);
 assert.equal(u.outcome,'success');assert.equal(f.counts.lots.length,5000/LOT_SIZE);
 assert.ok(modeled+internal<=1800,`${modeled}+${internal}s`);assert.ok(kiotGets<=300,`${kiotGets} GET`);
});
