import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulator} from '../lib/service.js';
import {LiveService} from '../lib/live.js';
import {viewData} from '../lib/view-data.js';
import {autoSelection,expectedKiotPrices} from '../lib/auto-update.js';
import {summaryText} from '../lib/update-report.js';

async function fixture({cost=34.5e6,currentPrice=35e6,p0=35e6,batch=false,joint=false,stop=false}={}){
  let saved,now=Date.parse('2026-11-10T03:00:00Z');
  const products=[{id:1,code:'TEST-1',name:'Dữ liệu mẫu',cost,currentPrice,createdAt:'2026-08-01',stock:1,active:true,notes:''}];
  const puts=[],client={all:async()=>structuredClone(products),product:async()=>structuredClone(products[0]),update:async(p,fields)=>{puts.push(fields);Object.assign(products[0],{currentPrice:fields.basePrice,...(fields.description!==undefined?{notes:fields.description}:{})});}};
  if(batch){client.listModified=async()=>structuredClone(products);client.updateMany=async entries=>{for(const e of entries)await client.update(e.product,e.fields);};}
  const sim=new Simulator({read:async()=>saved,write:async s=>{saved=structuredClone(s);}},{load:async()=>[]},()=>new Date(now));await sim.initialize();
  const live=new LiveService(sim,client,sim.clock);sim.live=live;live.sapoWrite=stop?undefined:false;live.kiotDescription=false;live.batchWrites=batch;live.timingSink=()=>{};live.sleep=async ms=>{now+=ms;};
  await live.refresh();sim.state.products[0].p0=p0;await sim.run();
  if(joint){live.sapoWrite=true;const sp={id:20,content:'',variants:[{id:21,sku:'TEST-1',price:35e6}]};
    const {SapoService}=await import('../lib/sapo.js');
    live.sapo=new SapoService({configured:true,all:async()=>[structuredClone(sp)],product:async()=>structuredClone(sp),update:async(_id,_vid,price)=>{sp.variants[0].price=price;}},{read:async()=>null,write:async()=>{}},'fixture');
    await live.sapo.initialize();await live.sapo.refresh();const check=await live.sapo.check('TEST-1');await live.sapo.confirm({...check,confirmed:true});live.sapoDescription=false;
  }
  const view=(name)=>viewData(sim.state,new URLSearchParams({view:name}),{revision:Math.random(),today:'2026-11-10',dataset:'real'});
  const history=()=>{sim.state.updates=[{id:'old',at:'2026-11-02T00:00:00Z',items:[{id:1,code:'TEST-1',row:{price:currentPrice},status:'done',verifiedAt:'2026-11-02T00:00:00Z',requestSent:true,afterProduct:{currentPrice}}]}];};
  return {sim,live,products,puts,view,history,run:()=>sim.state.runs[0]};
}
test('normal prepare refuses approval; approval refuses simulated; results omit pending',async()=>{
  const f=await fixture();await assert.rejects(f.live.prepare(f.run().id,['TEST-1']),/đủ điều kiện/);
  assert.equal(f.view('results').pagination.total,0);assert.equal(f.view('approval').pending.total,1);
  const safe=await fixture({cost:1});await assert.rejects(safe.live.prepare(safe.run().id,['TEST-1'],{approveBelowCost:true}),/đủ điều kiện/);
});
for(const batch of [false,true])test(`approved fake write leaves pending and records label (batch=${batch})`,async()=>{
  const f=await fixture({batch});const proposal=await f.live.prepare(f.run().id,['TEST-1'],{approveBelowCost:true,continueOnError:batch,batch});
  assert.equal(proposal.approval.kind,'below_cost');const update=await f.live.commit(proposal.id,true);
  assert.equal(f.puts.length,1);assert.equal(f.products[0].currentPrice,34.2e6);assert.equal(f.view('approval').pending.total,0);
  assert.match(summaryText(null,update),/Duyệt dưới giá vốn/);assert.equal(update.approval.by,null);
});
for(const batch of [false,true])test(`cost changing without fingerprint change prevents all writes (batch=${batch})`,async()=>{
  const f=await fixture({batch});const proposal=await f.live.prepare(f.run().id,['TEST-1'],{approveBelowCost:true,continueOnError:batch,batch});
  f.products[0].cost+=1;const update=await f.live.commit(proposal.id,true);assert.equal(f.puts.length,0);
  assert.match(JSON.stringify(update),/Giá vốn trên Kiot đã thay đổi/);
});
test('legacy requires verified own write, keep persists price only and never writes Kiot',async()=>{
  const f=await fixture({p0:35e6,cost:35e6,currentPrice:34.2e6});assert.equal(f.view('approval').legacy.total,0);f.history();
  assert.equal(f.view('approval').legacy.total,1);await f.live.keepBelowCost(['TEST-1'],true,null,[{code:'TEST-1',price:34.2e6,cost:35e6}]);
  assert.equal(f.view('approval').legacy.total,0);assert.equal(f.puts.length,0);
  f.sim.state.products[0].currentPrice=34e6;f.sim.state.updates[0].items[0].afterProduct.currentPrice=34e6;
  assert.equal(f.view('approval').legacy.total,1);
});
test('restore cost preserves P0/M and becomes expected price for next auto run',async()=>{
  const f=await fixture({p0:36e6,cost:35e6,currentPrice:34.2e6});f.history();
  const proposal=await f.live.prepare(f.run().id,['TEST-1'],{restoreCost:true});const update=await f.live.commit(proposal.id,true);
  assert.equal(f.products[0].currentPrice,35e6);assert.equal(f.sim.state.products[0].p0,36e6);assert.equal(f.run().rows[0].m,1);
  assert.equal(f.view('approval').legacy.total,0);assert.equal(expectedKiotPrices(f.sim.state.updates).get(1),35e6);
  assert.match(summaryText(null,update),/Trả về giá vốn/);assert.equal(autoSelection(f.sim.state).manualPriceSkips.length,0);
  assert.deepEqual(autoSelection(f.sim.state).codes,['TEST-1']);
});
for(const options of [{stop:true},{joint:true},{joint:true,batch:true}]){
  test(`approval uses existing engine and rejects changed cost ${JSON.stringify(options)}`,async()=>{
    for(const changed of [false,true]){
      const f=await fixture(options);const p=await f.live.prepare(f.run().id,['TEST-1'],{approveBelowCost:true,batch:options.batch});
      if(changed)f.products[0].cost++;
      const u=await f.live.commit(p.id,true);assert.equal(f.puts.length,changed?0:1);
      if(changed)assert.match(JSON.stringify(u),/Giá vốn trên Kiot đã thay đổi/);
      else assert.equal(u.outcome,'success');
    }
  });
}
test('next markdown needs a new approval and kept price cannot approve a pending item',async()=>{
  const f=await fixture();const p=await f.live.prepare(f.run().id,['TEST-1'],{approveBelowCost:true});await f.live.commit(p.id,true);
  await assert.rejects(f.live.prepare(f.run().id,['TEST-1'],{approveBelowCost:true}),/đủ điều kiện/);
  f.sim.clock=f.live.clock=()=>new Date('2026-11-16T03:00:00Z');await f.sim.run();
  assert.equal(f.view('approval').pending.total,1);assert.equal(f.view('approval').legacy.total,0);
  await assert.rejects(f.live.keepBelowCost(['TEST-1'],true,null,[{code:'TEST-1',price:34.2e6,cost:34.5e6}]),/đã thay đổi/);
});
test('keep confirmation is bound to the price and cost the user saw',async()=>{
  const f=await fixture({cost:35e6,currentPrice:34.2e6});f.history();
  const expected=[{code:'TEST-1',price:34.2e6,cost:35e6}];
  f.products[0].currentPrice=f.sim.state.products[0].currentPrice=34e6;
  f.sim.state.updates[0].items[0].afterProduct.currentPrice=34e6;
  await assert.rejects(f.live.keepBelowCost(['TEST-1'],true,null,expected),/đã thay đổi/);
  assert.equal(f.puts.length,0);assert.equal(f.sim.state.belowCostKeeps,undefined);
});
test('legacy group includes own below-cost products hidden from the ordinary sale table',async()=>{
  const f=await fixture({p0:650e6,cost:600e6,currentPrice:550e6});f.history();
  assert.equal(f.run().rows.length,0);assert.equal(f.view('approval').legacy.total,1);
  const p=await f.live.prepare(f.run().id,['TEST-1'],{restoreCost:true});await f.live.commit(p.id,true);
  assert.equal(f.products[0].currentPrice,600e6);
});
test('keep price also supports hidden legacy products without a simulation snapshot',async()=>{
  const f=await fixture({p0:650e6,cost:600e6,currentPrice:550e6});f.history();
  await f.live.keepBelowCost(['TEST-1'],true,null,[{code:'TEST-1',price:550e6,cost:600e6}]);
  assert.equal(f.view('approval').legacy.total,0);assert.equal(f.puts.length,0);
});
