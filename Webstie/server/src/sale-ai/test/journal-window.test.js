import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './joint-update.test.js';
import {Simulator} from '../lib/service.js';
import {summaryText} from '../lib/update-report.js';
import {JOURNAL_WINDOW} from '../lib/joint-update.js';

test('journal is saved per window, and every product is saved as sending before its request (TASK-037)',async()=>{
 const f=await fixture(2);
 let writes=0;const write=f.store.write;f.store.write=async s=>{writes++;return write(s);};
 const checked=[];const update=f.kiot.update;
 f.kiot.update=async(p,b)=>{const saved=await f.store.read();const item=saved.updates[0].items.find(i=>i.code===p.code);checked.push([p.code,item.platforms.kiot.status,item.platforms.kiot.requestSent]);return update(p,b);};
 const p=await f.prepare();writes=0;
 const u=await f.live.commit(p.id,true);
 assert.equal(u.outcome,'success');
 assert.deepEqual(checked,[['SP000009','sending',true],['SP000010','sending',true]]);
 // Constant: start, checks, one window per platform, outcome, finish (before: ~4 per product per platform).
 assert.ok(writes<=8,`writes ${writes}`);
 assert.equal(JOURNAL_WINDOW,100);
});

test('a crash in the middle of a window never reports a sent product as not sent',async()=>{
 const f=await fixture(2);
 const p=await f.prepare();let snapshot;
 const update=f.kiot.update;f.kiot.update=async(prod,b)=>{const r=await update(prod,b);if(prod.code==='SP000009')snapshot=await f.store.read();return r;};
 await f.live.commit(p.id,true);
 // Restart from the journal as it was right after the first Kiot write (results not saved yet).
 const store={read:async()=>structuredClone(snapshot),write:async()=>{}};
 const restarted=new Simulator(store,{load:async()=>[]},()=>new Date('2027-01-22T03:00:00Z'));await restarted.initialize();
 const kiot=restarted.state.updates[0].items.map(i=>i.platforms.kiot.status);
 assert.ok(!kiot.includes('not_sent'),kiot.join(','));
 assert.deepEqual(kiot,['unknown','unknown']);
});

test('errors are recorded in history while the other products continue; summary only counts successes',async()=>{
 // The page always prepares with continueOnError:true.
 const f=await fixture(2);const p=await f.live.prepare(f.run.id,['SP000009','SP000010'],{continueOnError:true});
 const update=f.kiot.update;f.kiot.update=async(prod,b)=>{if(prod.code==='SP000009')throw Object.assign(Error('Kiot trả HTTP 429'),{httpStatus:429,uncertain:false});return update(prod,b);};
 const u=await f.live.commit(p.id,true);
 const saved=(await f.store.read()).updates[0].items.find(i=>i.code==='SP000009').platforms.kiot;
 assert.deepEqual([saved.status,saved.error,saved.requestSent],['write_failed','Kiot trả HTTP 429',true]);
 assert.equal(summaryText(u.summary,u),'Đã cập nhật thành công 1/2 sản phẩm. Lỗi 1 sản phẩm.');
 const ok=await fixture(2),q=await ok.prepare(),v=await ok.live.commit(q.id,true);
 assert.equal(summaryText(v.summary,v),'Đã cập nhật thành công 2/2 sản phẩm.');
});
