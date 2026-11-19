import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {createSaleAi} from '../core.js';
import {normalizeProduct} from '../lib/kiot.js';
import {AUTO_UPDATE_LIMIT, AUTO_UPDATE_WINDOW_MS} from '../lib/auto-update.js';

const memory=()=>{let state;return {read:async()=>structuredClone(state),write:async next=>{state=structuredClone(next);}};};
async function request(sale,path,body){
  const req=Readable.from(body===undefined?[]:[JSON.stringify(body)]);
  Object.assign(req,{url:path,method:body===undefined?'GET':'POST',headers:{'content-type':'application/json'}});
  let status,data;await sale.handler(req,{locals:{user:{id:1,email:'fixture@example.invalid'}},writeHead:code=>{status=code;},end:raw=>{data=JSON.parse(raw);}});
  return {status,body:data};
}
async function fixture({count=2,batch=true}={}){
  let now=Date.parse('2026-11-16T03:00:30Z');
  const products=Array.from({length:count},(_,n)=>normalizeProduct({id:n+1,code:'SP'+n,name:'Túi '+n,basePrice:35e6,createdDate:'2026-09-01',isActive:true,description:'Gốc',inventories:[{branchId:44466,cost:1,onHand:1}]}));
  const puts=[],stores={store:memory(),liveStore:memory(),sapoStore:memory(),autoStore:memory()};
  const client={all:async()=>structuredClone(products),product:async id=>structuredClone(products.find(p=>p.id===id)),update:async(p,fields)=>{assert.deepEqual(Object.keys(fields),['basePrice']);puts.push(p.id);products.find(x=>x.id===p.id).currentPrice=fields.basePrice;}};
  if(batch){client.listModified=async()=>structuredClone(products);client.updateMany=async entries=>{for(const e of entries)await client.update(e.product,e.fields);};}
  const forbidden=async()=>{throw Error('Không được gọi Sapo');};
  const options={...stores,fixture:true,sapoWrite:false,kiotDescription:false,batchWrites:batch,readSapoOnStartup:false,client,sapoClient:{configured:false,all:forbidden,product:forbidden,update:forbidden},clock:()=>new Date(now)};
  const boot=async()=>{const sale=await createSaleAi(options);sale.live.timingSink=()=>{};sale.live.sleep=async ms=>{now+=ms;};return sale;};
  const sale=await boot();await sale.refreshTable();
  const settings=body=>request(sale,'/api/auto-update/settings',body);
  const tick=async(core=sale)=>{const job=await core.checkAutoUpdate();if(job?.id)await core.waitForJob(job.id);return job;};
  return {sale,products,puts,client,stores,boot,tick,settings,setTime:value=>{now=Date.parse(value);}};
}

for(const batch of [false,true])test(`schedule writes M1–M6 once, persists claim across restart (batch=${batch})`,async()=>{
  const f=await fixture({batch});await f.settings({enabled:true,time:'10:00'});
  await Promise.all([f.tick(),f.tick()]);assert.deepEqual(f.puts,[1,2]);assert.equal(f.sale.real.state.updates[0].trigger,'schedule');
  f.setTime('2026-11-16T03:00:45Z');await f.tick();
  f.setTime('2026-11-16T03:02:00Z');const restarted=await f.boot();await f.tick(restarted);
  assert.equal(f.puts.length,2);assert.equal((await request(restarted,'/api/auto-update/settings')).body.enabled,true);
});

test('Sunday, disabled and missed five-minute window never write',async()=>{
  const f=await fixture();assert.equal((await f.settings()).body.enabled,false);assert.equal((await f.settings()).body.time,'10:00');await f.tick();assert.equal(f.puts.length,0);
  await f.settings({enabled:true,time:'10:00'});
  for(const time of ['2026-11-15T03:00:00Z','2026-11-16T03:05:00Z','2026-11-16T03:30:00Z']){f.setTime(time);await f.tick();}
  assert.equal(f.puts.length,0);assert.equal(AUTO_UPDATE_WINDOW_MS,300000);
  assert.ok((await request(f.sale,'/api/view?dataset=real&view=history')).body.history.every(e=>e.update.trigger!=='schedule'));
  f.setTime('2026-11-17T03:00:00Z');await f.tick();assert.equal(f.puts.length,2);

});

test('settings accept only complete strict enabled/time values and custom Vietnam time runs once',async()=>{
  const f=await fixture();
  for(const body of [{enabled:true},{enabled:true,time:'25:00'},{enabled:true,time:'abc'},{enabled:true,time:'9:00'},{enabled:1,time:'10:00'},{enabled:true,time:'10:00',extra:1},null,[]])assert.equal((await f.settings(body)).status,400);
  assert.equal((await f.settings({enabled:false,time:'00:00'})).status,200);
  assert.equal((await f.settings({enabled:false,time:'23:59'})).status,200);
  assert.equal((await f.settings({enabled:true,time:'14:30'})).status,200);await f.tick();assert.equal(f.puts.length,0);
  f.setTime('2026-11-16T07:30:00Z');await f.tick();assert.equal(f.puts.length,2);
  await f.settings({enabled:true,time:'15:00'});f.setTime('2026-11-16T08:00:00Z');await f.tick();assert.equal(f.puts.length,2);
  const history=(await request(f.sale,'/api/view?dataset=real&view=history')).body.history;
  assert.ok(history.some(e=>e.update.mode==='auto-settings'&&e.update.message.includes('fixture@example.invalid')));
});

test('M0 excluded; manual Kiot prices are preserved, detailed, and excluded from errors/retry',async()=>{
  const f=await fixture({count:3});
  f.products[0].createdAt='2026-11-15T00:00:00+07:00';
  f.products[0].currentPrice=34e6;
  // P0 is already captured by the initial refresh.
  f.products[1].currentPrice=30e6;
  await f.settings({enabled:true,time:'10:00'});await f.tick();assert.deepEqual(f.puts,[3]);
  const update=f.sale.real.state.updates[0];
  const detail=(await request(f.sale,`/api/history/updates/${update.id}?dataset=real&filter=skipped_manual_price`)).body;
  assert.equal(detail.pagination.total,1);assert.equal(detail.update.summary.failed,0);assert.equal(detail.update.summary.manualPriceSkipped,1);
  assert.equal(detail.pagination.items[0].expectedPrice,35e6);assert.equal(detail.pagination.items[0].beforePrice,30e6);
  assert.match(detail.update.message,/1 giữ giá sửa tay/);
  const retry=await request(f.sale,'/api/kiot/retry-selection?updateId='+update.id);assert.deepEqual(retry.body.codes,[]);
  const run=f.sale.real.state.runs[0];const job=await request(f.sale,'/api/kiot/update',{runId:run.id,codes:['SP1'],confirmed:true});await f.sale.waitForJob(job.body.id);
  const manual=f.sale.real.state.updates[0];assert.equal(manual.items[0].status,'done');
  // Next milestone changes the target; yesterday's verified manual write is the expected baseline.
  f.setTime('2026-12-01T03:00:00Z');await f.tick();assert.ok(f.puts.filter(id=>id===2).length===2);
});

test('most recent verified Kiot write wins; failed, unchanged and unknown do not replace it',async()=>{
  const f=await fixture({count:2});
  await f.sale.real.mutate(s=>{s.updates=[
    {id:'unknown',at:'2026-11-15T04:00:00Z',items:[{id:1,status:'unknown',row:{price:31e6},platforms:{kiot:{status:'unknown'}}}]},
    {id:'verified',at:'2026-11-14T03:00:00Z',items:[{id:1,status:'done',row:{price:32200000},platforms:{kiot:{status:'done',requestSent:true,verifiedAt:'2026-11-14T03:00:01Z',afterProduct:{currentPrice:32200000}}}}]},
  ];});
  f.products[0].currentPrice=30e6;await f.settings({enabled:true,time:'10:00'});await f.tick();assert.deepEqual(f.puts,[2]);
  assert.equal(f.sale.real.state.updates[0].manualPriceSkips[0].expectedPrice,32200000);
});

test('busy claim is persisted immediately, skipped with history, never retried that day',async()=>{
  const f=await fixture();await f.settings({enabled:true,time:'10:00'});
  let release,entered;const gate=new Promise(r=>{release=r;}),started=new Promise(r=>{entered=r;});
  f.client.all=async()=>{entered();await gate;return structuredClone(f.products);};
  const refresh=f.sale.refreshTable();await started;
  await f.tick();assert.equal(f.puts.length,0);
  const history=(await request(f.sale,'/api/view?dataset=real&view=history')).body.history;
  assert.ok(history.some(e=>e.update.message.includes('Bỏ qua: đang có lượt khác')));
  release();await refresh;await f.tick();await f.tick(await f.boot());assert.equal(f.puts.length,0);
});

test('refresh failure and abnormal count stop before all writes and leave history',async()=>{
  const f=await fixture();await f.settings({enabled:true,time:'10:00'});f.client.all=async()=>{throw Error('fixture refresh failed');};await f.tick();
  assert.equal(f.puts.length,0);let history=(await request(f.sale,'/api/view?dataset=real&view=history')).body.history;
  assert.ok(history.some(e=>e.update.message.includes('không tải lại được từ Kiot')));
  assert.equal(AUTO_UPDATE_LIMIT,2000);
  const large=await fixture({count:2001});await large.settings({enabled:true,time:'10:00'});await large.tick();assert.equal(large.puts.length,0);
  history=(await request(large.sale,'/api/view?dataset=real&view=history')).body.history;
  assert.ok(history.some(e=>e.update.message.includes('Dừng: số món bất thường (2.001)')));
});

test('zero changes still record history; partial write errors remain retryable',async()=>{
  const empty=await fixture({count:0});await empty.settings({enabled:true,time:'10:00'});await empty.tick();assert.equal(empty.puts.length,0);
  const history=(await request(empty.sale,'/api/view?dataset=real&view=history')).body.history;
  assert.ok(history.some(e=>e.update.message.includes('0 món cần đổi giá')));
  const f=await fixture({batch:false});const apply=f.client.update;
  f.client.update=async(p,b)=>{if(p.id===1)throw Object.assign(Error('fixture rejected'),{httpStatus:400});return apply(p,b);};
  await f.settings({enabled:true,time:'10:00'});await f.tick();
  const update=f.sale.real.state.updates[0],retry=await request(f.sale,'/api/kiot/retry-selection?updateId='+update.id);
  assert.deepEqual(retry.body.codes,['SP0']);assert.equal(update.items.find(i=>i.id===2).status,'done');
});

test('an unresolved unknown write is never sent again by tomorrow’s schedule',async()=>{
  const f=await fixture({count:1});let attempts=0;
  f.client.updateMany=async()=>{attempts++;throw Object.assign(Error('fixture uncertain'),{httpStatus:503});};
  await f.settings({enabled:true,time:'10:00'});await f.tick();assert.equal(attempts,1);
  assert.equal(f.sale.real.state.updates[0].items[0].platforms.kiot.status,'unknown');
  f.setTime('2026-11-17T03:00:00Z');await f.tick();assert.equal(attempts,1);
  const history=(await request(f.sale,'/api/view?dataset=real&view=history')).body.history;
  assert.ok(history.some(e=>e.update.message.includes('chưa xác minh, không gửi lại')));
});

test('turning off skips a day; enabling again runs the next eligible day',async()=>{
  const f=await fixture();await f.settings({enabled:true,time:'10:00'});await f.settings({enabled:false,time:'10:00'});
  await f.tick();assert.equal(f.puts.length,0);
  f.setTime('2026-11-17T02:59:00Z');await f.settings({enabled:true,time:'10:00'});await f.tick();assert.equal(f.puts.length,0);
  f.setTime('2026-11-17T03:00:00Z');await f.tick();assert.equal(f.puts.length,2);
});

test('a failed durable claim prevents even the refresh GET',async()=>{
  const f=await fixture();await f.settings({enabled:true,time:'10:00'});let reads=0;
  f.client.all=async()=>{reads++;return structuredClone(f.products);};
  f.stores.autoStore.write=async()=>{throw Error('fixture disk failure');};
  await f.tick();assert.equal(reads,0);assert.equal(f.puts.length,0);
});
