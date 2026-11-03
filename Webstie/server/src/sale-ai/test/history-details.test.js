import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import * as report from '../lib/update-report.js';
import {historyEntries,failedItems} from '../public/history-model.js';
import {updateDetail,viewData} from '../lib/view-data.js';

const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
// Minimal DOM boundary: execute the shipped UI functions and their event handlers.
class Element {
 constructor(){this.nodes=new Map();this.html='';this.dataset={};this.isConnected=true;}
 set innerHTML(value){this.html=value;this.nodes.clear();}
 get innerHTML(){return this.html;}
 querySelector(selector){if(!this.nodes.has(selector))this.nodes.set(selector,new Element());return this.nodes.get(selector);}
 querySelectorAll(selector){
  if(selector==='[data-history-filter]')return [...this.html.matchAll(/data-history-filter="([^"]+)"/g)].map(([,filter])=>{const el=this.querySelector(`[data-history-filter="${filter}"]`);el.dataset.historyFilter=filter;return el;});
  if(selector==='[data-update-details]')return [...this.html.matchAll(/data-update-details="([^"]+)"/g)].map(([,id])=>{const el=this.querySelector(`[data-update-details="${id}"]`);el.dataset.updateDetails=id;return el;});
  return [];
 }
 insertAdjacentHTML(_,html){this.html=html+this.html;}
 setAttribute(){} showModal(){} close(){} focus(){} remove(){this.isConnected=false;}
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
async function fixture(items,skipped=[],unchangedCodes=[]){
 const update={id:'u',at:'2026-11-02T03:00:00Z',mode:'joint-v1',items,skipped,unchangedCodes};
 const raw={products:[],runs:[],updates:[update]};
 const state={...viewData(raw,new URLSearchParams({view:'history'}),{revision:'1',dataset:'real'}),dataset:'real'};
 let dialog;const urls=[];
 const document={createElement:()=>dialog=new Element(),body:{append(){}},querySelector:()=>new Element()};
 const source=(await readFile(new URL('../public/live-ui.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'').replaceAll('export function ','function ');
 const sandbox=vm.createContext({...report,historyEntries,failedItems,document,AbortController,URLSearchParams,encodeURIComponent});
 vm.runInContext(source,sandbox);
 const ctx={esc,money:n=>n??'—',dateTime:s=>s,message:()=>{},canWrite:()=>true,
  pagedTable:(_headers,entries,row)=>entries.map(row).join(''),
  api:async path=>{urls.push(path);if(path.startsWith('/api/kiot/retry-selection'))return {total:2,codes:['BAD'],notEligible:1};const url=new URL(path,'http://fixture');return updateDetail(raw,'u',url.searchParams);}};
 return {state,ctx,sandbox,urls,get dialog(){return dialog;}};
}
test('history has one detail button; dialog defaults to issues and tabs show matching counts and retry',async()=>{
 const f=await fixture([{code:'OK',status:'done'},{code:'BAD',name:'<unsafe>',status:'preflight_failed',error:'<failed>'}],[{code:'SKIP',status:'skipped',error:'Không có mã'}],['RIGHT']);
 const container=new Element();f.sandbox.renderHistory(f.state,container,f.ctx);
 assert.equal((container.innerHTML.match(/Xem chi tiết \(4 món\)/g)||[]).length,1);
 assert.doesNotMatch(container.innerHTML,/Xem danh sách lỗi|data-update-products|data-update-errors/);
 container.querySelector('[data-update-details="u"]').onclick();await flush();
 assert.match(f.dialog.innerHTML,/data-history-filter="issues"[^>]*aria-pressed="true"/);
 assert.match(f.dialog.innerHTML,/Tất cả \(4\)/);assert.match(f.dialog.innerHTML,/Thành công \(1\)/);assert.match(f.dialog.innerHTML,/Lỗi \+ chưa gửi \(2\)/);
 assert.match(f.dialog.innerHTML,/retry-bar/);assert.match(f.dialog.innerHTML,/Lỗi kiểm tra — chưa ghi/);assert.match(f.dialog.innerHTML,/Chưa gửi/);assert.match(f.dialog.innerHTML,/&lt;failed>/);assert.doesNotMatch(f.dialog.innerHTML,/<unsafe>/);
 f.dialog.querySelector('[data-history-filter="all"]').onclick();await flush();assert.doesNotMatch(f.dialog.innerHTML,/class="retry-bar"/);assert.match(f.dialog.innerHTML,/Đã đúng giá/);
 f.dialog.querySelector('[data-history-filter="success"]').onclick();await flush();assert.doesNotMatch(f.dialog.innerHTML,/&lt;failed>|Không có mã/);assert.match(f.dialog.innerHTML,/Thành công/);
 assert.ok(f.urls.at(-1).includes('filter=success'));assert.ok(f.urls.at(-1).includes('page=1'));
});
test('no issues defaults to all and closing the dialog aborts further display',async()=>{
 const f=await fixture([{code:'OK',status:'done'}]);f.sandbox.showUpdateDetails(f.state,'u',f.ctx);await flush();
 assert.match(f.dialog.innerHTML,/data-history-filter="all"[^>]*aria-pressed="true"/);
 f.dialog.querySelector('[data-close]').onclick();assert.equal(f.dialog.isConnected,false);
});
