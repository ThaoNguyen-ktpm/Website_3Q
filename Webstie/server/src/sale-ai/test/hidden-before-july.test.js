import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createSaleAi} from '../core.js';
import {calculate, POLICY} from '../lib/pricing.js';

const memory=(initial=null)=>{let value=initial;return {read:async()=>structuredClone(value),write:async next=>{value=structuredClone(next);}};};
const item=(code,createdAt,extra={})=>({id:code,code,name:'Túi '+code,createdAt,p0:35e6,currentPrice:35e6,active:true,stock:1,notes:'Ghi chú '+code,...extra});
const products=()=>[item('MARCH','2026-03-15'),item('JUNE','2026-06-30'),item('JULY','2026-07-01'),item('OCT','2026-10-20')];
async function request(sale,url,method='GET',body={}) {
  const req=Readable.from(method==='POST'?[JSON.stringify(body)]:[]);
  Object.assign(req,{url,method,headers:{'content-type':'application/json'}});
  let status,data;await sale.handler(req,{writeHead(code){status=code;},end(bytes){data=JSON.parse(bytes);}});
  return {status,data};
}
async function fixture(list=products(),runs=[]) {
  const calls=[];
  const forbidden=async()=>{calls.push('external');throw Error('External calls forbidden');};
  const liveStore=memory({version:1,cycleVersion:2,pricedOnly:true,policy:POLICY,dataRevision:1,products:list,runs});
  const options={fixture:true,store:memory(),liveStore,sapoStore:memory(),sapoWrite:false,
    clock:()=>new Date('2026-10-30T03:00:00Z'),client:{all:forbidden,product:forbidden,update:forbidden},
    sapoClient:{configured:false,all:forbidden,update:forbidden,restore:forbidden}};
  const sale=await createSaleAi(options);sale.live.timingSink=()=>{};
  return {sale,calls,liveStore,options};
}
const run=async sale=>{const result=await request(sale,'/api/run','POST',{dataset:'real'});assert.equal(result.status,200);return result.data;};

test('core omits only pre-July exclusions, persists count and retains products/P0 and old runs',async()=>{
  const old={id:'old',day:'2026-10-29',policy:POLICY,rows:[calculate(products()[0],'2026-10-29')]};
  const {sale,calls,liveStore,options}=await fixture(products(),[old]);
  const result=await run(sale);
  assert.deepEqual(result.rows.map(r=>r.code),['JULY','OCT']);
  assert.equal(result.hiddenBeforeNoMarkdownCount,2);
  for(const row of result.rows){assert.equal(row.id,row.code);assert.equal(row.notesBefore,'Ghi chú '+row.code);}
  assert.equal(sale.real.state.products.length,4);
  assert.ok(sale.real.state.products.every(p=>p.p0===35e6));
  assert.deepEqual(sale.real.state.runs.find(r=>r.id==='old'),old);
  const saved=await liveStore.read();assert.equal(saved.runs[0].rows.length,2);assert.equal(saved.runs[0].hiddenBeforeNoMarkdownCount,2);
  const restarted=await createSaleAi(options);
  const view=(await request(restarted,'/api/view?dataset=real')).data;
  assert.equal(view.pagination.total,2);assert.equal(view.runs[0].hiddenBeforeNoMarkdownCount,2);
  assert.deepEqual(calls,[]);
});

test('core retains other exclusions and date boundaries use Vietnam calendar',async()=>{
  const {sale}=await fixture([...products(),item('EMPTY','2026-07-02',{stock:0}),item('INACTIVE','2026-07-03',{active:false}),
    item('UTC-OLD','2026-06-30T16:59:59Z'),item('UTC-JULY','2026-06-30T17:00:00Z')]);
  const result=await run(sale);assert.equal(result.hiddenBeforeNoMarkdownCount,3);assert.equal(result.rows.length,5);
  for(const code of ['EMPTY','INACTIVE'])assert.match(result.rows.find(r=>r.code===code).reasons.join(),/hết tồn hoặc ngừng kinh doanh/);
  assert.ok(result.rows.some(r=>r.code==='UTC-JULY'));
  assert.equal(calculate(products()[0],'2026-10-30').excludedReason,'before_no_markdown');
});

test('core select-all, query, M and pagination contain only remaining rows; hidden prepare is rejected locally',async()=>{
  const {sale,calls}=await fixture();const result=await run(sale);
  const select=async query=>(await request(sale,`/api/kiot/selection?runId=${result.id}${query}`)).data;
  const selection=await select('');assert.deepEqual(selection.codes,['JULY','OCT']);assert.deepEqual(selection.excludedCodes,[]);
  assert.deepEqual((await select('&q=JUNE')).codes,[]);
  const view=(await request(sale,'/api/view?dataset=real&m=0&page=9&size=10')).data;
  assert.equal(view.pagination.total,2);assert.equal(view.pagination.totalPages,1);assert.equal(view.pagination.page,1);
  assert.deepEqual((await select('&m=0')).codes,selection.codes);
  assert.deepEqual((await select('&m=1')).codes,[]);
  const search=(await request(sale,'/api/view?dataset=real&q=JUNE')).data;
  assert.equal(search.pagination.total,0);assert.equal(search.runs[0].hiddenBeforeNoMarkdownCount,2);
  const prepare=await request(sale,'/api/kiot/prepare','POST',{runId:result.id,codes:['JUNE']});
  assert.equal(prepare.status,400);assert.match(prepare.data.error,/chưa đủ điều kiện/);
  assert.deepEqual(sale.real.state.prepared||[],[]);assert.deepEqual(calls,[]);
});

test('all hidden and no hidden tables have exact counts',async()=>{
  for(const [list,hidden,remaining] of [[products().slice(0,2),2,0],[products().slice(2),0,2]]) {
    const {sale}=await fixture(list);const result=await run(sale);
    assert.equal(result.rows.length,remaining);assert.equal(result.hiddenBeforeNoMarkdownCount,hidden);
  }
});

test('select-all spans pages without returning hidden codes',async()=>{
  const visible=Array.from({length:13},(_,i)=>item('VISIBLE-'+i,'2026-07-01'));
  const {sale,calls}=await fixture([...products().slice(0,2),...visible]);const result=await run(sale);
  const first=(await request(sale,'/api/view?dataset=real&size=10')).data;
  const second=(await request(sale,'/api/view?dataset=real&size=10&page=2')).data;
  assert.equal(first.pagination.total,13);assert.equal(first.pagination.totalPages,2);
  assert.equal(first.runs[0].rows.length,10);assert.equal(second.runs[0].rows.length,3);
  const selection=(await request(sale,`/api/kiot/selection?runId=${result.id}`)).data;
  assert.deepEqual(selection.codes,visible.map(p=>p.code));assert.deepEqual(selection.excludedCodes,[]);assert.deepEqual(calls,[]);
});

test('shared results pagination renders hidden summary next to count; old runs remain compatible',async()=>{
  const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
  const fn=source.slice(source.indexOf('function pagedTable('),source.indexOf('function bindPagination('));
  const state={pagination:{total:2,totalPages:1,page:1,size:10},runs:[{id:'new',hiddenBeforeNoMarkdownCount:2886}]};
  const context=vm.createContext({state,selectedRun:null,pages:{results:{page:1,size:10}},count:n=>Number(n||0).toLocaleString('vi-VN'),table:()=>'<table></table>'});
  vm.runInContext(fn,context);
  const render=()=>vm.runInContext("pagedTable([],[],()=>'', 'results')",context);
  assert.match(render(),/Đã ẩn 2\.886 món tạo trước 01\/07\/2026 \(không giảm\)/);
  state.runs=[{id:'old'}];assert.doesNotMatch(render(),/Đã ẩn/);
});
