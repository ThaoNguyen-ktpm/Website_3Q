import test from 'node:test';
import assert from 'node:assert/strict';
import {SapoClient,SapoService,sapoNote,validateSapoProduct} from '../lib/sapo.js';
const memory=()=>{let disk;return {read:async()=>structuredClone(disk),write:async s=>{disk=structuredClone(s);}};};
const product={id:91211362,content:'<b>Nội dung gốc</b>',variants:[{id:900,sku:'SP000009',price:'35000000'},{id:901,sku:'OTHER',price:'100'}]};
test('catalog tolerates unrelated empty descriptions, zero prices and absent SKU, selected reads remain strict',async()=>{
 const other={id:123,content:null,variants:[{id:456,sku:null,price:0},{id:457,sku:'ZERO',price:0}]};
 const s=new SapoService({all:async()=>[product,other],product:async id=>id===123?other:product},memory(),'catalog');
 await s.initialize();assert.equal((await s.refresh()).count,2);
 assert.equal((await s.prepare('SP000009',{previewOnly:true})).variantId,900);
 await assert.rejects(s.prepare('ZERO',{previewOnly:true}),/cấu trúc|phiên bản/);
 assert.throws(()=>validateSapoProduct({...product,variants:[{id:900,sku:'ZERO',price:0}]}),/phiên bản/);
});
test('Kiot code with a suffix finds the Sapo SKU before "_" when the exact SKU is absent',async()=>{
 const client={all:async()=>[structuredClone(product)],product:async()=>structuredClone(product)};
 const s=new SapoService(client,memory(),'fixture');await s.initialize();await s.refresh();
 const ref=await s.prepare('SP000009_23092026',{previewOnly:true});assert.equal(ref.variantId,900);assert.equal(ref.code,'SP000009');
 assert.equal((await s.prepare('SP000009_KG',{previewOnly:true})).variantId,900);
 await assert.rejects(s.prepare('SP000011_23092026',{previewOnly:true}),/SKU Sapo thiếu \(đã tìm cả SP000011\)/);
 const row={m:1,price:1000,allowance:100};assert.equal(sapoNote('',{...row,code:'SP000009_23092026'}),sapoNote('',{...row,code:'SP000009'}));
});
test('Sapo exact SKU index rejects missing/duplicate without requiring manual mapping',async()=>{
 const client={all:async()=>[structuredClone(product)],product:async()=>structuredClone(product)};
 const s=new SapoService(client,memory(),'fixture');await s.initialize();
 await assert.rejects(s.prepare('SP000009'),/chỉ mục/);await s.refresh();
 const check=await s.check('SP000009');await s.confirm({...check,confirmed:true});
 assert.equal((await s.prepare('SP000009')).variantId,900);
 await assert.rejects(s.prepare('sp000009'),/SKU/);
 client.all=async()=>[product,{...product,id:3}];await s.refresh();await assert.rejects(s.check('SP000009'),/trùng/);
});
test('Sapo HTML outside SKU-owned BAOQ block is retained and repeat does not duplicate',()=>{
 const row={code:'SP000009',m:3,price:32e6,allowance:1e6};
 const first=sapoNote(product.content,row);assert.ok(first.startsWith(product.content));assert.equal(sapoNote(first,row),first);
 assert.ok(sapoNote(first,{...row,code:'OTHER'}).includes(first));
});
test('full Kiot description replaces abbreviated Sapo block without losing other HTML or SKU',()=>{
 const row={code:'SP000009',m:3,price:3900000,allowance:117000},note='<!--BAOQ-CURRENT--><p>BAOQ | M3</p><!--/BAOQ-CURRENT--><p data-baoq-event="event">Lịch sử áp dụng</p>';
 const old=sapoNote('<p>Sapo riêng</p>',row),other=sapoNote(old,{...row,code:'OTHER'});
 const full=sapoNote(other,row,note);
 assert.ok(full.includes(note));assert.ok(full.startsWith('<p>Sapo riêng</p>'));
 assert.equal(sapoNote(full,row,note),full);assert.equal(full.split('data-baoq-event').length-1,1);
});
test('Sapo client paginates, validates identity, sends minimal fields and never retries PUT or leaks secrets',async()=>{
 const calls=[];const c=new SapoClient({shop:'baoqluxury.mysapo.net',key:'SECRETKEY',secret:'SECRET'},async(url,opt)=>{
 calls.push({url,opt});return {ok:true,status:200,json:async()=>url.includes('?')?{products:calls.length===1?[product]:[]}:{product}};
 });
 assert.equal((await c.all()).length,1);await c.update(91211362,900,32e6,'new');
 assert.deepEqual(JSON.parse(calls.at(-1).opt.body),{product:{id:91211362,content:'new',variants:[{id:900,price:32e6}]}});
 assert.ok(!calls[0].url.includes('SECRET'));
 c.fetcher=async()=>{throw Error('SECRETKEY SECRET');};await assert.rejects(c.update(91211362,900,1,'x'),e=>!e.message.includes('SECRET')&&e.uncertain===true);
});
test('changing credentials requires fresh complete catalog before check or confirmation',async()=>{
 const store=memory(),client={all:async()=>[product],product:async()=>product};const a=new SapoService(client,store,'shop-A');await a.initialize();await a.refresh();const check=await a.check('SP000009');await a.confirm({...check,confirmed:true});
 const b=new SapoService(client,store,'shop-B');await b.initialize();assert.equal(b.status().verified,false);await assert.rejects(b.check('SP000009'),/chỉ mục/);await assert.rejects(b.confirm({...check,confirmed:true}),/chỉ mục/);
});
test('mapping confirms long descriptions by fingerprint without echoing HTML',async()=>{
 const long={...product,content:'<p>'+('x'.repeat(20000))+'</p>'},client={all:async()=>[long],product:async()=>long},s=new SapoService(client,memory(),'long');await s.initialize();await s.refresh();const check=await s.check('SP000009');await s.confirm({code:check.code,fingerprint:check.fingerprint,price:check.price,confirmed:true});assert.equal(s.status().verified,true);
});
