import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {setTimeout as delay} from 'node:timers/promises';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createSaleAi} from '../core.js';
import {normalizeProduct} from '../lib/kiot.js';

const memory=(initial=null)=>{let value=initial;return {read:async()=>structuredClone(value),write:async next=>{value=structuredClone(next);}};};
const products=[{id:10,variants:[{id:20,sku:'SP000009'}]}];
const until=async predicate=>{for(let i=0;i<100;i++){if(predicate())return;await delay(10);}assert.fail('Background read did not finish');};
async function request(sale,path,method='GET',body={}) {
 const req=Readable.from(method==='POST'?[JSON.stringify(body)]:[]);
 Object.assign(req,{url:path,method,headers:{'content-type':'application/json'}});
 let status,data;await sale.handler(req,{writeHead(code){status=code;},end(bytes){data=JSON.parse(bytes);}});
 return {status,data};
}
async function fixture({catalog={products,catalogBinding:'fixture'},configured=true,all}={}) {
 const calls=[];
 const kiotProduct=normalizeProduct({id:1,code:'SP000009',name:'Túi',basePrice:35e6,createdDate:'2026-12-03',isActive:true,inventories:[{branchId:44466,onHand:1}]});
 const forbidden=async()=>{calls.push('PUT');throw Error('Unexpected write');};
 const sc={configured,all:async()=>{calls.push('GET Sapo');return all?all():structuredClone(products);},update:forbidden,restore:forbidden};
 const sale=await createSaleAi({fixture:true,store:memory(),liveStore:memory(),sapoStore:memory(catalog),clock:()=>new Date('2027-01-22T03:00:00Z'),client:{all:async()=>{calls.push('GET Kiot');return [kiotProduct];},update:forbidden},sapoClient:sc});
 return {sale,calls,sc};
}
test('Kiot reload reads Sapo each time, clears prepared even for unchanged catalogs, and sends no PUT',async()=>{
 const {sale,calls}=await fixture({catalog:null});
 const result=await request(sale,'/api/kiot/refresh','POST');assert.equal(result.status,200);
 assert.equal(sale.sapo.status().ready,true);assert.deepEqual(sale.sapo.state.products,products);
 await sale.real.mutate(s=>{s.prepared=[{id:'pending'}];});
 assert.equal((await request(sale,'/api/kiot/refresh','POST')).status,200);
 assert.deepEqual(sale.real.state.prepared,[]);
 assert.deepEqual(calls,['GET Kiot','GET Sapo','GET Kiot','GET Sapo']);
});
test('Sapo failure preserves successful Kiot reload, exposes safe error, and retries next reload',async()=>{
 let fail=true;const {sale,calls}=await fixture({all:async()=>{if(fail)throw Error('private upstream detail');return products;}});
 assert.equal((await request(sale,'/api/kiot/refresh','POST')).status,200);
 assert.equal(sale.real.state.products.length,1);assert.equal(sale.real.state.runs[0].rows.length,1);
 const status=(await request(sale,'/api/sapo/status')).data;
 assert.ok(status.refreshError);assert.doesNotMatch(JSON.stringify(status),/private upstream detail/);
 const view=(await request(sale,'/api/view?dataset=real')).data;assert.ok(view.sapo.refreshError);
 fail=false;assert.equal((await request(sale,'/api/kiot/refresh','POST')).status,200);
 assert.equal(sale.sapo.status().refreshError,null);assert.equal(calls.includes('PUT'),false);
});
test('Kiot refresh holds the shared lock through the Sapo read, including direct refreshTable callers',async()=>{
 let release;const gate=new Promise(r=>release=r);
 const {sale,calls}=await fixture({all:async()=>{await gate;return products;}});
 const reload=sale.refreshTable();await until(()=>calls.includes('GET Sapo'));
 assert.equal(sale.real.state.products.length,1);
 assert.equal((await request(sale,'/api/run','POST')).status,409);
 await assert.rejects(sale.refreshTable(),e=>e.status===409);
 release();await reload;assert.equal((await request(sale,'/api/status')).data.busy,false);
 assert.deepEqual(calls,['GET Kiot','GET Sapo']);
});
test('failed Kiot reload never starts a Sapo read',async()=>{
 const {sale,calls}=await fixture();sale.live.client.all=async()=>{throw Error('Kiot fixture failed');};
 assert.equal((await request(sale,'/api/kiot/refresh','POST')).status,400);assert.deepEqual(calls,[]);
});
test('empty configured Sapo starts one background read without delaying core readiness or allowing concurrent mutations',async()=>{
 let release;const gate=new Promise(r=>release=r);
 const {sale,calls}=await fixture({catalog:null,all:async()=>{await gate;return products;}});
 assert.equal(sale.sapo.status().ready,false);
 await until(()=>calls.length===1);
 assert.equal((await request(sale,'/api/run','POST')).status,409);
 assert.equal((await request(sale,'/api/status')).data.busy,true);
 release();await until(()=>sale.sapo.status().ready);
 await until(()=>!sale.real.busy);await delay(30);
 assert.deepEqual(calls,['GET Sapo']);
});
test('background startup waits for an active mutation, then reads only once',async()=>{
 const {sale,calls}=await fixture({catalog:null});
 let release;const gate=new Promise(r=>release=r);
 const mutation=sale.real.mutate(async s=>{await gate;s.prepared=[{id:'pending'}];});
 await delay(40);assert.deepEqual(calls,[]);
 release();await mutation;await until(()=>sale.sapo.status().ready);
 await until(()=>!sale.real.busy);assert.deepEqual(sale.real.state.prepared,[]);assert.deepEqual(calls,['GET Sapo']);
});
test('startup preserves prepared when catalog contents are unchanged, clears it when contents change',async()=>{
 for(const changed of [false,true]) {
  const catalog={products:changed?[]:products,catalogBinding:'old'};
  const {sale,calls}=await fixture({catalog});
  await sale.real.mutate(s=>{s.prepared=[{id:'pending'}];});
  await until(()=>sale.sapo.status().ready);await until(()=>!sale.real.busy);
  assert.deepEqual(sale.real.state.prepared,changed?[]:[{id:'pending'}]);assert.deepEqual(calls,['GET Sapo']);
 }
});
test('startup keeps prepared when only product and variant ordering changes',async()=>{
 const old=[{id:11,variants:[]},{id:10,variants:[{id:21,sku:'OTHER'},{id:20,sku:'SP000009'}]}];
 const fresh=[{id:10,variants:[{id:20,sku:'SP000009'},{id:21,sku:'OTHER'}]},{id:11,variants:[]}];
 const {sale,calls}=await fixture({catalog:{products:old,catalogBinding:'old'},all:async()=>fresh});
 await sale.real.mutate(s=>{s.prepared=[{id:'pending'}];});
 await until(()=>sale.sapo.status().ready);await until(()=>!sale.real.busy);
 assert.deepEqual(sale.real.state.prepared,[{id:'pending'}]);assert.deepEqual(calls,['GET Sapo']);
});
test('startup failure logs no upstream details, does not retry until Kiot reload',async t=>{
 const logs=[];t.mock.method(console,'error',(...args)=>logs.push(args.join(' ')));
 let fail=true;const {sale,calls}=await fixture({catalog:null,all:async()=>{if(fail)throw Error('private upstream detail');return products;}});
 await until(()=>logs.length>0);await delay(40);
 assert.equal(sale.sapo.status().ready,false);assert.ok(sale.sapo.status().refreshError);
 assert.doesNotMatch(logs.join(' '),/private upstream detail/);assert.deepEqual(calls,['GET Sapo']);
 fail=false;assert.equal((await request(sale,'/api/kiot/refresh','POST')).status,200);
 assert.equal(sale.sapo.status().ready,true);assert.equal(calls.includes('PUT'),false);
});
test('polling revision changes on background success or failure without clearing unchanged prepared',async t=>{
 t.mock.method(console,'error',()=>{});
 for(const fail of [false,true]) {
  let release;const gate=new Promise(r=>release=r);
  const {sale}=await fixture({catalog:{products,catalogBinding:'old'},all:async()=>{await gate;if(fail)throw Error('fixture failure');return products;}});
  await sale.real.mutate(s=>{s.prepared=[{id:'pending'}];});
  const before=(await request(sale,'/api/view?dataset=real')).data;
  release();await until(()=>fail?sale.sapo.status().refreshError:sale.sapo.status().ready);
  const status=(await request(sale,'/api/status?dataset=real')).data;
  assert.notEqual(status.revision,before.revision);
  const view=(await request(sale,'/api/view?dataset=real')).data;
  assert.equal(view.revision,status.revision);assert.deepEqual(sale.real.state.prepared,[{id:'pending'}]);
 }
});
test('configured ready or unconfigured Sapo never auto reads on startup',async()=>{
 for(const configured of [true,false]) {
  const {sale,calls}=await fixture({configured});await delay(30);assert.deepEqual(calls,[]);
  if(!configured){assert.equal((await request(sale,'/api/kiot/refresh','POST')).status,200);assert.deepEqual(calls,['GET Kiot']);assert.match(sale.sapo.status().message,/Sapo chưa kết nối/);}
 }
});
test('manual Sapo refresh remains available and clears prepared',async()=>{
 const {sale,calls}=await fixture();await sale.real.mutate(s=>{s.prepared=[{id:'pending'}];});
 assert.equal((await request(sale,'/api/sapo/refresh','POST')).status,200);assert.deepEqual(sale.real.state.prepared,[]);assert.deepEqual(calls,['GET Sapo']);
});
test('rendered results and settings remove manual Sapo controls and show only relevant status',async()=>{
 // Evaluate the real renderer; imports are unused for this empty-results case.
 const source=(await readFile(new URL('../public/live-ui.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'');
 const ui=vm.createContext({});vm.runInContext(source,ui);
 for(const sapo of [{connected:true,ready:false},{connected:true,ready:true,refreshError:'Chưa đọc được Sapo, sẽ thử lại khi Tải lại từ Kiot'},{connected:false,ready:false}]) {
  const container={dataset:{},innerHTML:'',querySelector:()=>({}),querySelectorAll:()=>[],insertAdjacentHTML(_position,html){this.innerHTML+=html;}};
  ui.renderLiveResults({dataset:'real',sapo},null,container,{esc:String,mFilter:'',canWrite:()=>true});
  ui.appendLiveSettings({sapo},container,{esc:String});
  assert.doesNotMatch(container.innerHTML,/sapo-index|sapo-refresh|Kết nối Sapo|Cần đọc chỉ mục/);
  if(sapo.refreshError)assert.match(container.innerHTML,/Chưa đọc được Sapo, sẽ thử lại khi Tải lại từ Kiot/);
  if(!sapo.connected)assert.match(container.innerHTML,/Sapo chưa kết nối — chưa thể cập nhật chung/);
 }
});
