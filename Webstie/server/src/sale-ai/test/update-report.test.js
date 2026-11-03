import test from 'node:test';
import assert from 'node:assert/strict';
import * as report from '../lib/update-report.js';
import {updateDetail,viewData} from '../lib/view-data.js';

const item=(code,status,extra={})=>({code,name:code,status,...extra});
const state=update=>({products:[],runs:[],updates:[{id:'u',at:'2026-11-02T03:00:00Z',...update}]});
test('64 preflight failures plus 1250 unsent products report the entire selected run',()=>{
 const update={items:Array.from({length:64},(_,i)=>item('I'+i,'write_failed',{platforms:{kiot:{status:'preflight_failed'},sapo:{status:'not_sent'}}})),skipped:Array.from({length:1250},(_,i)=>item('S'+i,'skipped',{error:'Không có SKU'}))};
 assert.equal(report.summaryText(report.updateSummary(update.items),update),'0/1.314 thành công · 64 lỗi kiểm tra · 1.250 chưa gửi');
 const r=report.updateReport(update);assert.deepEqual([r.total,r.succeeded,r.failed,r.preflightFailed,r.writeFailed,r.unverified,r.notSent,r.unchanged],[1314,0,64,64,0,0,1250,0]);
 const data=updateDetail(state(update),'u',new URLSearchParams({size:'100'}));assert.equal(data.pagination.total,1314);
 assert.equal(data.update.summary.total,1314);assert.equal(data.update.message,'0/1.314 thành công · 64 lỗi kiểm tra · 1.250 chưa gửi');
});
test('mixed legacy states count each code once, classify platform errors and retain exact reasons',()=>{
 const update={summary:{total:99},items:[item('OK','done'),item('CHECK','write_failed',{platforms:{kiot:{status:'preflight_failed',error:'Đã sửa ngoài'},sapo:{status:'not_sent'}}}),item('WRITE','write_failed',{platforms:{kiot:{status:'done'},sapo:{status:'write_failed',error:'429'}}}),item('UNKNOWN','unknown'),item('STOP','not_sent')],skipped:[item('SKIP','skipped',{error:'Thiếu mã'}),item('CHECK','skipped')],unchanged:['RIGHT','RIGHT','OK']};
 const original=structuredClone(update),r=report.updateReport(update);
 assert.deepEqual([r.total,r.succeeded,r.failed,r.preflightFailed,r.writeFailed,r.unverified,r.notSent,r.unchanged,r.issues],[7,1,3,1,1,1,2,1,5]);
 const s=state(update),read=filter=>updateDetail(s,'u',new URLSearchParams({filter}));
 assert.equal(read('all').pagination.total,7);assert.deepEqual(read('success').pagination.items.map(p=>p.code),['OK']);
 assert.equal(read('issues').pagination.total,5);assert.equal(updateDetail(s,'u',new URLSearchParams({errorsOnly:'true'})).pagination.total,5);
 assert.equal(read('all').pagination.items.find(p=>p.code==='CHECK').reportStatus,'preflight_failed');
 assert.equal(read('all').pagination.items.find(p=>p.code==='RIGHT').reportStatus,'unchanged');
 assert.match(report.failureReason(update.items[1]),/Đã sửa ngoài/);
 const view=viewData(s,new URLSearchParams({view:'history'}),{revision:'r',dataset:'real'});assert.equal(view.history[0].update.summary.total,7);
 assert.deepEqual(update,original);
});
test('legacy numeric unchanged count is reported without inventing product identities; new codes are pageable',()=>{
 const legacy={items:[item('OK','done')],unchanged:3};
 assert.equal(report.updateReport(legacy).total,4);assert.equal(report.updateReport(legacy).unchanged,3);
 const d=updateDetail(state(legacy),'u',new URLSearchParams());assert.equal(d.pagination.total,1);assert.equal(d.update.summary.total,4);
 const current={...legacy,unchangedCodes:['A','B','C']};assert.equal(updateDetail(state(current),'u',new URLSearchParams()).pagination.total,4);
});
test('restore summaries use the same denominator and attempts stay isolated from skipped',()=>{
 const u={mode:'restore-joint-v1',items:[item('OK','done'),item('BAD','unknown')],skipped:[item('SKIP','skipped')],attempts:[{at:'2026-11-02',items:[item('BAD','unknown')]}]};
 assert.equal(report.summaryText(null,u),'Khôi phục — 1/3 thành công · 1 chưa xác minh · 1 chưa gửi');
 const a=updateDetail(state(u),'u',new URLSearchParams({attempt:'0',filter:'issues'}));assert.equal(a.pagination.total,1);
});
test('restore journals marking both skipped sides done are unsent, never a false success',()=>{
 const u={mode:'restore-joint-v1',items:[item('RESTORED','done',{platforms:{kiot:{status:'done'},sapo:{status:'skipped',skipped:true}}}),item('EDITED','done',{platforms:{kiot:{status:'skipped',skipped:true},sapo:{status:'skipped',skipped:true}}})],skipped:[item('EDITED','skipped',{error:'Đã thay đổi sau cập nhật'})]};
 assert.equal(report.summaryText(null,u),'Khôi phục — 1/2 thành công · 1 chưa gửi');
 const d=updateDetail(state(u),'u',new URLSearchParams({filter:'issues'}));assert.equal(d.pagination.total,1);assert.equal(d.pagination.items[0].error,'Đã thay đổi sau cập nhật');
});
test('aggregate write_failed with only not_sent platforms remains unsent',()=>{
 const u={items:[item('STOP','write_failed',{platforms:{kiot:{status:'not_sent'},sapo:{status:'not_sent'}}})]};
 assert.deepEqual([report.updateReport(u).notSent,report.updateReport(u).writeFailed],[1,0]);
});
