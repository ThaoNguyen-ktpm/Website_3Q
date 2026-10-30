import test from 'node:test';
import assert from 'node:assert/strict';
import {previewNote,POLICY} from '../lib/pricing.js';
import {liveNote} from '../lib/live.js';
const row={m:0,price:8e6,currentPrice:8e6,p0:8e6,allowance:800000};
const originals=['','Mô tả ngắn','<h3>Mô tả cũ</h3><p><img src="/bag.png">Đồ hiệu</p>','<pre>  giữ khoảng trắng\n</pre>\n  ','<p>'+('Mô tả dài '.repeat(500))+'</p>'];
test('preview begins with BAOQ and preserves exact old description, including whitespace',()=>{
 for(const original of originals){
  const once=previewNote(original,row,'2026-10-13');
  assert.ok(once.startsWith('[BAOQ-MO-PHONG]'));
  assert.ok(once.endsWith('[/BAOQ-MO-PHONG]'+(original?'\n\n'+original:'')));
  assert.equal(previewNote(once,row,'2026-10-13'),once);
  assert.equal((once.match(/\[BAOQ-MO-PHONG\]/g)||[]).length,1);
 }
});
test('legacy preview at bottom moves to top without duplicate or lost HTML',()=>{
 const original='<h3>Gốc</h3><p>Giữ HTML</p>';
 const block=previewNote('',row,'2026-10-13');
 const moved=previewNote(original+'\n\n'+block,row,'2026-10-13');
 assert.equal(moved,block+'\n\n'+original);
});
test('live notes put current and event before untouched original and are idempotent',()=>{
 for(const original of originals){
  const once=liveNote(original,row,'note-first-key','2026-10-13 09:00');
  assert.ok(once.startsWith('<!--BAOQ-CURRENT-->'));
  assert.ok(once.endsWith(original));
  assert.ok(once.indexOf('<!--/BAOQ-CURRENT-->')<once.indexOf('<p data-baoq-event='));
  assert.equal(liveNote(once,row,'note-first-key','2026-10-13 10:00'),once);
  assert.equal((once.match(/data-baoq-event=/g)||[]).length,1);
 }
});
test('legacy live block at bottom moves to top and keeps its event',()=>{
 const original='<h3>Gốc</h3><img src="/original.png">';
 const block=liveNote('',row,'same-event','2026-10-13 09:00');
 assert.equal(liveNote(original+block,row,'same-event','2026-10-13 10:00'),block+original);
});
test('current policy supersedes the note-first layout version',()=>{
 assert.equal(POLICY,'baoq-2026-10-30-hide-before-jul-v10');
});
