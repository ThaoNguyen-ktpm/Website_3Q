import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {createSaleAi} from '../core.js';
import {normalizeProduct} from '../lib/kiot.js';

const memory=()=>{let value;return {read:async()=>structuredClone(value),write:async next=>{value=structuredClone(next);}};};
async function request(sale,path,body){
 const req=Readable.from(body===undefined?[]:[JSON.stringify(body)]);req.url=path;req.method=body===undefined?'GET':'POST';req.headers={'content-type':'application/json'};
 let status,data;await sale.handler(req,{writeHead:code=>{status=code;},end:raw=>{data=JSON.parse(raw);}});return {status,body:data};
}
async function finish(sale,id){
 for(let n=0;n<20000;n++){const r=await request(sale,'/api/jobs/'+id);if(r.body.status!=='running')return r.body;await new Promise(setImmediate);}
 throw Error('Background job did not finish');
}
async function fixture(count=1,{batch=false}={}){
 let now=Date.parse('2026-11-16T03:00:00Z'),release;const gate=new Promise(r=>{release=r;});let hold=true;
 const products=Array.from({length:count},(_,n)=>normalizeProduct({id:n+1,code:'SP'+n,name:'Túi '+n,basePrice:35e6,createdDate:'2026-09-01',isActive:true,description:'Gốc',inventories:[{branchId:44466,onHand:1}]}));
 const sapos=products.map(p=>({id:p.id+5000,content:'Gốc Sapo',variants:[{id:p.id+9000,sku:p.code,price:35e6}]}));
 const reads={kiot:new Map(),sapo:new Map()},writes={kiot:new Set(),sapo:new Set()};
 const delayed=async()=>{if(hold)await gate;now+=500;await new Promise(setImmediate);};
 const read=async(name,id,rows)=>{await delayed();if(!writes[name].has(id))reads[name].set(id,(reads[name].get(id)||0)+1);return structuredClone(rows.find(p=>p.id===id));};
 const client={all:async()=>structuredClone(products),product:id=>read('kiot',id,products),update:async(p,b)=>{writes.kiot.add(p.id);Object.assign(products.find(x=>x.id===p.id),{currentPrice:b.basePrice,notes:b.description});}};
 if(batch){client.listModified=async()=>structuredClone(products);client.updateMany=async entries=>{for(const e of entries)await client.update(e.product,e.fields);};}
 const sapoClient={all:async()=>structuredClone(sapos),product:id=>read('sapo',id,sapos),update:async(id,vid,price)=>{writes.sapo.add(id);sapos.find(p=>p.id===id).variants.find(v=>v.id===vid).price=price;},restore:async(id,variants,content)=>{const p=sapos.find(p=>p.id===id);for(const v of variants)p.variants.find(x=>x.id===v.id).price=v.price;p.content=content;}};
 const sale=await createSaleAi({fixture:true,batchWrites:batch,store:memory(),liveStore:memory(),sapoStore:memory(),source:{load:async()=>[]},client,sapoClient,clock:()=>new Date(now),readSapoOnStartup:false});
 sale.live.timingSink=()=>{};await sale.live.refresh();await sale.sapo.refresh();const run=await sale.real.run();
 sale.live.sleep=async ms=>{now+=ms;};
 return {sale,run,products,sapos,reads,writes,tick:ms=>{now+=ms;},release:()=>{hold=false;release();}};
}

test('fatal interruption recovers persisted sending/ready journals and fences a late response',async()=>{
 const f=await fixture(51,{batch:true});f.release();
 let release,entered;const gate=new Promise(r=>{release=r;}),sending=new Promise(r=>{entered=r;});
 let writes=0;f.sale.live.client.updateMany=async()=>{writes++;entered();await gate;};
 const job=await request(f.sale,'/api/kiot/update',{runId:f.run.id,codes:f.products.map(p=>p.code),confirmed:true});
 await sending;await f.sale.interrupt();
 const update=f.sale.real.state.updates[0];
 assert.equal(update.outcome,'interrupted');assert.equal(update.attempts[0].status,'interrupted');
 assert.ok(update.items.slice(0,50).every(i=>i.platforms.kiot.status==='unknown'));
 assert.equal(update.items[50].platforms.kiot.status,'not_sent');
 assert.equal((await request(f.sale,'/api/jobs/'+job.body.id)).body.status,'failed');
 release();await f.sale.waitForJob(job.body.id);
 assert.equal(writes,1);assert.equal(f.sale.real.state.updates[0].outcome,'interrupted');
 assert.equal((await request(f.sale,'/api/kiot/update',{confirmed:true})).status,503);
});

for(const batch of [false,true])test(`TASK-118 background zero Sapo skips both and retry (batch=${batch})`,async()=>{
 const f=await fixture(1,{batch});f.sapos[0].variants[0].price=0;f.release();
 const accepted=await request(f.sale,'/api/kiot/update',{runId:f.run.id,codes:['SP0'],confirmed:true});
 const job=await finish(f.sale,accepted.body.id);assert.equal(job.status,'completed');
 assert.equal(job.result.items[0].status,'skipped_sapo_zero_price');
 assert.equal(f.writes.kiot.size,0);assert.equal(f.writes.sapo.size,0);
 const retry=await request(f.sale,'/api/kiot/retry-selection?updateId='+job.result.id);assert.deepEqual(retry.body.codes,[]);
 const detail=await request(f.sale,'/api/history/updates/'+job.result.id+'?dataset=real&filter=skipped_sapo_zero_price');
 assert.equal(detail.body.update.summary.failed,0);assert.equal(detail.body.update.summary.skippedSapoZeroPrice,1);assert.equal(detail.body.pagination.total,1);
});
test('TASK-117 shutdown drains accepted work and refuses new jobs',async()=>{
 const f=await fixture();
 const accepted=await request(f.sale,'/api/kiot/update',{runId:f.run.id,codes:['SP0'],confirmed:true});
 assert.equal(await f.sale.shutdown({timeoutMs:1}),false);
 assert.equal((await request(f.sale,'/api/kiot/update',{runId:f.run.id,codes:['SP0'],confirmed:true})).status,503);
 f.release();await f.sale.waitForJob(accepted.body.id);
 assert.equal((await request(f.sale,'/api/jobs/'+accepted.body.id)).body.status,'completed');
 assert.equal(await f.sale.shutdown({timeoutMs:100}),true);
});
test('1500 products: immediate acceptance, lock, reconnect, one pre-write GET, history',async()=>{
 const f=await fixture(1500);f.sale.real.state.prepared=[{id:'old-1311',items:[],status:'prepared'}];
 const started=performance.now();const accepted=await request(f.sale,'/api/kiot/update',{runId:f.run.id,codes:f.products.map(p=>p.code),confirmed:true});
 assert.equal(accepted.status,202);assert.ok(performance.now()-started<1000);
 assert.equal(f.reads.kiot.size,0);assert.equal(f.reads.sapo.size,0);
 try{
  const view=await request(f.sale,'/api/view?dataset=real');assert.equal(view.body.busy,true);assert.equal(view.body.operation.running,true);
  assert.equal((await request(f.sale,'/api/kiot/update',{runId:f.run.id,codes:['SP0'],confirmed:true})).status,409);
  assert.equal((await request(f.sale,'/api/jobs/'+accepted.body.id)).body.status,'running');
 }finally{f.release();}
 const job=await finish(f.sale,accepted.body.id);assert.equal(job.status,'completed');assert.equal(job.result.outcome,'success');
 assert.equal(job.result.items.length,1500);assert.equal(f.sale.real.state.updates[0].id,job.result.id);
 assert.equal(f.writes.kiot.size,1500);assert.equal(f.writes.sapo.size,1500);
 for(const name of ['kiot','sapo']){assert.equal(f.reads[name].size,1500);assert.ok([...f.reads[name].values()].every(n=>n===1),name+' read twice before writing');}
 assert.equal((await request(f.sale,'/api/view?dataset=real')).body.busy,false);
});
test('background retry selection and fingerprint conflicts keep the original safety checks',async()=>{
 const f=await fixture();
 assert.equal((await request(f.sale,'/api/kiot/update',{runId:f.run.id,codes:['SP0']})).status,400);
 f.products[0].currentPrice++;
 const first=await request(f.sale,'/api/kiot/update',{runId:f.run.id,codes:['SP0'],confirmed:true});f.release();
 const failed=await finish(f.sale,first.body.id);assert.equal(failed.status,'completed');assert.equal(f.writes.kiot.size,0);assert.equal(f.writes.sapo.size,0);assert.equal(failed.result.items[0].platforms.kiot.status,'preflight_failed');
 const retry=await request(f.sale,'/api/kiot/retry-selection?updateId='+failed.result.id);assert.deepEqual(retry.body.codes,['SP0']);
 f.products[0].currentPrice--;const accepted=await request(f.sale,'/api/kiot/update',{...retry.body,confirmed:true});
 assert.equal(accepted.status,202);assert.equal((await finish(f.sale,accepted.body.id)).result.outcome,'success');
});
test('background failure is observable and releases lock',async()=>{
 const f=await fixture();f.release();
 const accepted=await request(f.sale,'/api/kiot/update',{runId:'stale',codes:['SP0'],confirmed:true});assert.equal(accepted.status,202);
 const job=await finish(f.sale,accepted.body.id);assert.equal(job.status,'failed');assert.match(job.error,/mới nhất/);
 assert.equal((await request(f.sale,'/api/status')).body.busy,false);
});
test('background batch catches Kiot edits older than the modified-since window',async()=>{
 const f=await fixture(2,{batch:true});f.products[0].currentPrice++;f.tick(120000);
 // Legacy tables have no trustworthy read cursor: keep the full-list safety gate.
 for(const row of f.sale.real.state.runs[0].rows)delete row.liveReadAt;
 f.sale.live.client.listModified=async()=>[];f.release();
 const accepted=await request(f.sale,'/api/kiot/update',{runId:f.run.id,codes:['SP0'],confirmed:true});
 const job=await finish(f.sale,accepted.body.id);assert.equal(job.status,'completed');
 assert.equal(f.writes.kiot.size,0);assert.equal(f.writes.sapo.size,0);assert.equal(job.result.items[0].platforms.kiot.status,'preflight_failed');
});
test('background workers release barriers after an authorization stop',async()=>{
 const f=await fixture(4);f.sale.sapo.client.update=async()=>{throw Object.assign(Error('fixture denied'),{httpStatus:403});};f.release();
 const accepted=await request(f.sale,'/api/kiot/update',{runId:f.run.id,codes:f.products.map(p=>p.code),confirmed:true});
 const job=await finish(f.sale,accepted.body.id);assert.equal(job.status,'completed');assert.equal(f.writes.kiot.size,4);assert.equal(f.reads.sapo.size,1);
 assert.equal(job.result.items[3].platforms.sapo.status,'not_sent');
});
test('background partial update can restore verified products with missing snapshots on unsent products',async()=>{
 const f=await fixture(2),read=f.sale.sapo.client.product;
 f.sale.sapo.client.product=id=>id===5001?Promise.reject(Error('fixture missing')):read(id);f.release();
 const accepted=await request(f.sale,'/api/kiot/update',{runId:f.run.id,codes:['SP0','SP1'],confirmed:true});
 const job=await finish(f.sale,accepted.body.id);assert.equal(job.status,'completed');assert.equal(f.writes.kiot.size,1);assert.equal(f.writes.sapo.size,1);
 const restore=await f.sale.live.prepareRestore(job.result.id);const result=await f.sale.live.commitRestore(restore.id,true);
 assert.equal(result.outcome,'success');assert.equal(f.products[0].currentPrice,35e6);assert.equal(f.sapos[0].variants[0].price,35e6);
});
