import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {createSaleAi} from '../core.js';

const memory=()=>{let value;return {read:async()=>structuredClone(value),write:async next=>{value=structuredClone(next);}};};
async function request(sale,path,body){
  const req=Readable.from(body===undefined?[]:[JSON.stringify(body)]);
  Object.assign(req,{url:path,method:body===undefined?'GET':'POST',headers:{'content-type':'application/json'}});
  let status,data;await sale.handler(req,{locals:{user:{id:7}},writeHead:s=>{status=s;},end:text=>{data=JSON.parse(text);}});return {status,body:data};
}
async function fixture(){
  const products=Array.from({length:13},(_,i)=>({id:i+1,code:'TEST-'+i,name:'Dữ liệu mẫu '+i,currentPrice:35e6,cost:i===12?1:34.5e6,createdAt:'2026-08-01',stock:1,active:true,notes:''}));
  const writes=[],forbidden=async()=>assert.fail('No Sapo requests');
  const sale=await createSaleAi({fixture:true,store:memory(),liveStore:memory(),sapoStore:memory(),autoStore:memory(),sapoWrite:false,kiotDescription:false,readSapoOnStartup:false,
    clock:()=>new Date('2026-11-10T03:00:00Z'),client:{all:async()=>structuredClone(products),product:async id=>structuredClone(products.find(p=>p.id===id)),update:async(p,b)=>{writes.push(p.id);products.find(x=>x.id===p.id).currentPrice=b.basePrice;}},
    sapoClient:{configured:false,all:forbidden,product:forbidden,update:forbidden}});
  sale.live.timingSink=()=>{};await sale.refreshTable();
  const post=async(path,body)=>{const response=await request(sale,path,{dataset:'real',...body});if(response.status!==202)return response;
    await sale.waitForJob(response.body.id);return request(sale,'/api/jobs/'+response.body.id);};
  return {sale,products,writes,post,run:()=>sale.real.state.runs[0]};
}
test('approval API paginates/searches groups and normal select-all omits every pending code',async()=>{
  const f=await fixture(),run=f.run();
  assert.equal((await request(f.sale,'/api/status')).body.approvalCount,12);
  const view=(await request(f.sale,'/api/view?dataset=real&view=approval&pending_page=2')).body;
  assert.equal(view.pending.total,12);assert.equal(view.pending.items.length,2);assert.equal(view.legacy.total,0);
  const selection=(await request(f.sale,`/api/kiot/selection?runId=${run.id}`)).body;
  assert.deepEqual(selection.codes,['TEST-12']);assert.deepEqual(selection.excludedCodes,[]);
  assert.equal((await request(f.sale,'/api/kiot/approval-selection?group=pending')).body.items.length,12);
  assert.equal((await request(f.sale,'/api/view?dataset=real&view=approval&q=TEST-11')).body.pending.total,1);
});
test('preview/prepare approval flags are server validated and actor is taken from runtime',async()=>{
  const f=await fixture(),body={runId:f.run().id,codes:['TEST-0']};
  const ordinary=await f.post('/api/kiot/prepare',body);assert.equal(ordinary.body.status,'failed');
  const wrong=await f.post('/api/kiot/prepare',{...body,codes:['TEST-12'],approveBelowCost:true});assert.equal(wrong.body.status,'failed');
  const invalid=await f.post('/api/kiot/prepare',{...body,approveBelowCost:'true'});assert.equal(invalid.body.status,'failed');
  const preview=await f.post('/api/kiot/preview',{...body,approveBelowCost:true});assert.equal(preview.body.result.previewOnly,true);assert.equal(f.writes.length,0);
  const prepared=await f.post('/api/kiot/prepare',{...body,approveBelowCost:true,by:999});assert.equal(prepared.body.result.approval.by,7);
  const commit=await f.post('/api/kiot/commit',{id:prepared.body.result.id,confirmed:true});assert.equal(commit.body.result.approval.kind,'below_cost');assert.deepEqual(f.writes,[1]);
  const history=(await request(f.sale,'/api/view?dataset=real&view=history')).body.history;
  assert.match(history[0].update.message,/Duyệt dưới giá vốn/);assert.equal(history[0].update.approval.by,7);
});
test('legacy keep endpoint requires confirmation and never sends a price update',async()=>{
  const f=await fixture();f.products[0].cost=35e6;f.products[0].currentPrice=34.2e6;
  await f.sale.refreshTable();
  f.sale.real.state.updates=[{id:'legacy',at:'2026-11-02T00:00:00Z',items:[{id:1,code:'TEST-0',status:'done',verifiedAt:'2026-11-02T00:00:00Z',requestSent:true,afterProduct:{currentPrice:34.2e6}}]}];
  assert.equal((await request(f.sale,'/api/view?dataset=real&view=approval')).body.legacy.total,1);
  assert.equal((await f.post('/api/kiot/keep-below-cost',{codes:['TEST-0']})).body.status,'failed');
  assert.equal((await f.post('/api/kiot/keep-below-cost',{codes:['TEST-0'],items:[{code:'TEST-0',price:34.2e6,cost:35e6}],confirmed:true,by:999})).body.status,'completed');
  assert.equal(f.sale.real.state.belowCostKeeps[0].by,7);assert.deepEqual(f.writes,[]);
  assert.equal((await request(f.sale,'/api/view?dataset=real&view=approval')).body.legacy.total,0);
});
