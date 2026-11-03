import test from 'node:test';
import assert from 'node:assert/strict';
import {SapoClient} from '../lib/sapo.js';
import {createSaleAi} from '../core.js';
import {normalizeProduct} from '../lib/kiot.js';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const memory=()=>{let state=null;return {read:async()=>structuredClone(state),write:async value=>{state=structuredClone(value);}};};
const config={shop:'fixture.mysapo.net',key:'fixture',secret:'fixture'};
const reply=(status,body={},headers={})=>({ok:status===200,status,headers:new Headers(headers),json:async()=>structuredClone(body)});

test('GET retries three times with exponential backoff; PUT is never retried',async()=>{
 let now=0,calls=0;const times=[];
 const client=new SapoClient(config,async()=>{times.push(now);return reply(++calls<4?429:200);},{now:()=>now,sleep:async ms=>{now+=ms;}});
 await client.request('/test');assert.equal(calls,4);assert.deepEqual(times,[0,2000,6000,14000]);
 client.fetcher=async()=>{calls++;return reply(429,{}, {'Retry-After':'3'});};
 await assert.rejects(client.request('/test','PUT',{}),e=>e.httpStatus===429&&e.retryAfter===3&&/Sapo quá giới hạn — chưa ghi/.test(e.message)&&!e.uncertain);
 assert.equal(calls,5);
});

async function fixture(count=2,{batch=false}={}){
 let now=Date.parse('2026-11-16T03:00:00Z'),used=0,last=now,rejections=0;const calls=[],faults=new Map();
 const products=Array.from({length:count},(_,n)=>normalizeProduct({id:n+1,code:'SP'+String(n+1).padStart(6,'0'),name:'Túi '+n,basePrice:35e6,createdDate:'2026-09-01',isActive:true,description:'Kiot gốc',inventories:[{branchId:44466,onHand:1}]}));
 const sapos=products.map(p=>({id:p.id,content:'HTML gốc',variants:[{id:p.id,sku:p.code,price:35e6}]}));
 const adapter=new SapoClient(config,async(url,options)=>{
  const path=new URL(url).pathname,id=Number(path.match(/products\/(\d+)/)?.[1]),key=options.method+':'+id;
  used=Math.max(0,used-(now-last)/500);last=now;calls.push({method:options.method,id,at:now});
  if(used>=40){rejections++;return reply(429,{}, {'Retry-After':'2'});}used++;
  const remaining=faults.get(key)||0;if(remaining){faults.set(key,remaining-1);return reply(429,{}, {'Retry-After':'2'});}
  if(!id)return reply(200,{products:new URL(url).searchParams.get('page')==='1'?sapos:[]},{'X-Sapo-Api-Call-Limit':`${Math.ceil(used)}/40`});
  const product=sapos.find(p=>p.id===id);
  if(options.method==='PUT'){const body=JSON.parse(options.body).product;product.variants[0].price=body.variants[0].price;if(body.content!==undefined)product.content=body.content;}
  return reply(200,{product},{'X-Sapo-Api-Call-Limit':`${Math.ceil(used)}/40`});
 },{now:()=>now,sleep:async ms=>{now+=ms;}});
 // Real HTTP adapter behind a fixture-only facade: no network, env or live stores.
 const sapoClient=Object.fromEntries(['all','product','update','restore'].map(name=>[name,adapter[name].bind(adapter)]));
 // The disabled batch engine uses full-list fixtures; production catalog indexing keeps identities only.
 if(batch)sapoClient.all=async()=>structuredClone(sapos);
 Object.defineProperty(sapoClient,'rateLimitWait',{get:()=>adapter.rateLimitWait});
 const client={all:async()=>structuredClone(products),product:async id=>structuredClone(products.find(p=>p.id===id)),update:async(p,b)=>Object.assign(products.find(x=>x.id===p.id),{currentPrice:b.basePrice,notes:b.description})};
 if(batch)Object.assign(client,{listModified:async()=>structuredClone(products),updateMany:async entries=>{for(const {product,fields} of entries)await client.update(product,fields);}});
 const sale=await createSaleAi({fixture:true,batchWrites:batch,readSapoOnStartup:false,store:memory(),liveStore:memory(),sapoStore:memory(),client,sapoClient,clock:()=>new Date(now)});
 sale.live.timingSink=()=>{};sale.live.sleep=async ms=>{now+=ms;};
 await sale.live.refresh();await sale.sapo.refresh();const run=await sale.real.run();
 const prepared=await sale.live.prepare(run.id,products.map(p=>p.code),{continueOnError:true});
 return {sale,calls,faults,prepared,adapter,now:()=>now,rejections:()=>rejections};
}

test('real core updates 300 products through a 40/2 leaky bucket without 429',async()=>{
 const f=await fixture(300),start=f.now(),from=f.calls.length;
 const update=await f.sale.live.commit(f.prepared.id,true);
 assert.equal(update.outcome,'success');assert.equal(update.platformSummary.sapo.succeeded,300);
 const calls=f.calls.slice(from);assert.equal(calls.filter(c=>c.method==='PUT').length,300);
 assert.equal(f.rejections(),0);
 for(let n=1;n<calls.length;n++)assert.ok(calls[n].at-calls[n-1].at>=500);
 assert.ok(f.now()-start>=(calls.length-1)*500);
});

test('GET 429 recovers; exhausted GET fails only that product and labels Sapo separately',async()=>{
 const f=await fixture(3);f.faults.set('GET:1',2);f.faults.set('GET:2',4);
 const update=await f.sale.live.commit(f.prepared.id,true);
 assert.equal(update.items[0].status,'done');assert.equal(update.items[2].status,'done');
 const failed=update.items[1];assert.equal(failed.platforms.sapo.status,'preflight_failed');
 assert.equal(failed.platforms.kiot.status,'not_sent');assert.doesNotMatch(failed.platforms.kiot.error,/HTTP 429|Sapo GET/);
 assert.equal(f.calls.filter(c=>c.id===2&&c.method==='GET').length,5); // prepare + 4 attempts
 assert.equal(f.calls.filter(c=>c.id===2&&c.method==='PUT').length,0);
});

test('PUT 429 is definitive, never resent, waits and continues with the next product',async()=>{
 const f=await fixture();f.faults.set('PUT:1',1);
 const update=await f.sale.live.commit(f.prepared.id,true);
 assert.equal(update.items[0].platforms.sapo.status,'write_failed');assert.match(update.items[0].platforms.sapo.error,/chưa ghi/);
 assert.equal(update.items[1].status,'done');assert.equal(f.calls.filter(c=>c.id===1&&c.method==='PUT').length,1);
 const index=f.calls.findIndex(c=>c.id===1&&c.method==='PUT');assert.ok(f.calls[index+1].at-f.calls[index].at>=2000);
});

test('batch lanes also pause after Sapo PUT 429 without retrying or stopping Kiot',async()=>{
 const f=await fixture(4,{batch:true});f.faults.set('PUT:1',1);
 const update=await f.sale.live.commit(f.prepared.id,true);assert.equal(update.batch,true);
 assert.equal(update.platformSummary.kiot.succeeded,4,JSON.stringify(update.items.map(i=>i.platforms.kiot)));assert.equal(update.platformSummary.sapo.succeeded,3);
 assert.equal(update.items[0].platforms.sapo.status,'write_failed');assert.match(update.items[0].platforms.sapo.error,/chưa ghi/);
 assert.equal(f.calls.filter(c=>c.method==='PUT'&&c.id===1).length,1);
 const index=f.calls.findIndex(c=>c.method==='PUT'&&c.id===1);assert.ok(f.calls[index+1].at-f.calls[index].at>=2000);
});

test('all default clients share a queue; catalog, product, update and restore honor its spacing',async()=>{
 const a=new SapoClient(config,async()=>reply(200)),b=new SapoClient(config,async()=>reply(200));
 assert.equal(a.limiter,b.limiter);
 let now=0;const starts=[];const raw={id:1,content:'original',variants:[{id:1,sku:'SP000001',price:100}]};
 const first=new SapoClient(config,async url=>{starts.push(now);return reply(200,url.includes('?')?{products:[]}:{product:raw});},{now:()=>now,sleep:async ms=>{now+=ms;}});
 const second=new SapoClient(config,first.fetcher);second.limiter=first.limiter;
 await Promise.all([first.all(),second.product(1),first.update(1,1,200,null),second.restore(1,[{id:1,price:100}],'original')]);
 assert.deepEqual(starts,[0,500,1000,1500]);
});

test('exhausted verification GET 429 after a successful PUT is unknown, never labelled unwritten',async()=>{
 for(const batch of [false,true]){
  const f=await fixture(2,{batch}),fetcher=f.adapter.fetcher;
  f.adapter.fetcher=async(url,options)=>{const response=await fetcher(url,options);if(options.method==='PUT'&&url.endsWith('/1.json'))f.faults.set('GET:1',4);return response;};
  const update=await f.sale.live.commit(f.prepared.id,true),p=update.items[0].platforms.sapo;
  assert.equal(p.status,'unknown');assert.match(p.error,/HTTP 429/);assert.doesNotMatch(p.error,/chưa ghi/);
  assert.equal(f.calls.filter(c=>c.method==='PUT'&&c.id===1).length,1);assert.equal(update.items[1].status,'done');
 }
});

test('bucket headers slow the next request; Retry-After accepts HTTP dates and malformed values back off',async()=>{
 for(const header of ['X-Sapo-Api-Call-Limit','X-Sapo-Shop-Api-Call-Limit']){
  let now=0,calls=0;const starts=[];
  const client=new SapoClient(config,async()=>{starts.push(now);return reply(200,{},++calls===1?{[header]:'39/40'}:{});},{now:()=>now,sleep:async ms=>{now+=ms;}});
  await client.request('/a');assert.ok(client.rateLimitWait);await client.request('/b');
  assert.deepEqual(starts,[0,5500]);assert.equal(client.rateLimitWait,null);
 }
 for(const [value,expected] of [['Thu, 01 Jan 1970 00:00:04 GMT',4000],['invalid',2000],['-1',2000]]){
  let now=0,calls=0;const client=new SapoClient(config,async()=>reply(++calls===1?429:200,{}, {'Retry-After':value}),{now:()=>now,sleep:async ms=>{now+=ms;}});
  await client.request('/a');assert.equal(calls,2);assert.equal(now,expected);
 }
});

test('core status stays readable while the Sapo queue sleeps and UI polling shows the wait',async()=>{
 const f=await fixture(1);let release,entered;const sleeping=new Promise(r=>entered=r);
 f.adapter.limiter.sleep=async ms=>{entered();await new Promise(r=>release=r);f.adapter.limiter.now=()=>Date.parse('2026-11-17T03:00:00Z');};
 f.adapter.limiter.pause(2000);const pending=f.adapter.request('/admin/products/1.json');await sleeping;
 let status;await f.sale.handler({method:'GET',url:'/api/status?dataset=real'}, {writeHead:()=>{},end:body=>{status=JSON.parse(body);}});
 assert.ok(status.sapoWait);release();await pending;
 let poll;const nodes={'#sync-status':{},'#update-progress':{}};
 const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
 const context=vm.createContext({polling:false,observedJob:undefined,finishedJob:undefined,setInterval:fn=>poll=fn,api:async()=>({...status,busy:true,operation:{running:true,source:'real',platforms:{sapo:{stage:'Đang gửi',processed:3,total:10}}}}),dataset:'real',renderProgress:()=>{},$:s=>nodes[s],document:{querySelector:()=>null},pending:true});
 vm.runInContext(source.slice(source.lastIndexOf('setInterval(async()=>{')),context);await poll();
 assert.match(nodes['#sync-status'].textContent,/Đang chờ giới hạn Sapo… · 3\/10/);
});
