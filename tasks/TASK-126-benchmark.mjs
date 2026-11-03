// Offline only: no credentials, HTTP, real store, or application runtime.
import {mkdtemp,readdir,stat,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Simulator} from '../Webstie/server/src/sale-ai/lib/service.js';
import {LiveService} from '../Webstie/server/src/sale-ai/lib/live.js';
import {SplitStore} from '../Webstie/server/src/sale-ai/lib/split-store.js';
import {normalizeProduct} from '../Webstie/server/src/sale-ai/lib/kiot.js';
const label=process.argv[2]||'before',trusted=process.argv.includes('--trusted');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const clock=()=>new Date(Date.parse('2026-11-16T03:00:00Z')+performance.now());
const products=Array.from({length:4800},(_,i)=>normalizeProduct({id:i+1,code:'SP'+(i+1),name:'Túi kiểm đo '+i,basePrice:35e6,createdDate:'2026-09-01',description:'Mô tả kiểm đo offline. '.repeat(60),isActive:true,inventories:[{branchId:44466,onHand:1}],attributes:[{value:'Chi tiết kiểm đo. '.repeat(60)}]}));
const dir=await mkdtemp(join(tmpdir(),'task126-'+label+'-')),store=new SplitStore(join(dir,'kiot-state.json'));
const calls={all:0,modified:0,put:0},changes=new Map();
const client={all:async()=>{calls.all++;for(let p=0;p<59;p++)await delay(600);client.lastPages=59;return structuredClone(products);},
 listModified:async since=>{calls.modified++;const result=products.filter(p=>(changes.get(p.id)||0)>=Date.parse(since));await delay(400);client.lastPages=1;return structuredClone(result);},
 updateMany:async entries=>{calls.put++;await delay(700);for(const {product,fields} of entries){if(Object.keys(fields).join()!=='basePrice')throw Error('Price only');const actual=products[product.id-1];actual.currentPrice=fields.basePrice;actual.modifiedDate=clock().toISOString();changes.set(actual.id,clock().getTime());}},
 product:async()=>{throw Error('Unexpected single read');},update:async()=>{throw Error('Unexpected single write');}};
const sim=new Simulator(store,{load:async()=>[]},clock);await sim.initialize();
const live=new LiveService(sim,client,clock);sim.live=live;live.batchWrites=true;live.sapoWrite=false;live.kiotDescription=false;live.timingSink=()=>{};
// Seed the same normalized local catalog without spending 35 s on an out-of-scope reload.
sim.state.products=products.map(p=>({...structuredClone(p),p0:p.currentPrice,type:'normal'}));
sim.state.dataset='real';sim.state.dataRevision=1;
if(trusted)sim.state.kiotReadAt=clock().toISOString();
await store.write(sim.state);await sim.run();
const bytes=async()=>{let n=0;for(const f of await readdir(store.blobs))n+=(await stat(join(store.blobs,f))).size;return n;};
const reachableBytes=async()=>{
 const manifest=JSON.parse(await readFile(store.manifestPath,'utf8')),refs=new Set(Object.values(manifest.indexes));
 for(const indexes of [manifest.indexes,...(manifest.recoveryIndexes||[])])for(const [key,index] of Object.entries(indexes)){
  refs.add(index);for(const ref of JSON.parse(await readFile(join(store.blobs,index+'.json'),'utf8'))){
  refs.add(ref);
  if(key==='updates'){const record=JSON.parse(await readFile(join(store.blobs,ref+'.json'),'utf8'));for(const child of [...(record.itemChunks||[]),...(record.attempts||[]).flatMap(a=>a.itemChunks||[])])refs.add(child);}
  }
 }
 let n=0;for(const ref of refs)n+=(await stat(join(store.blobs,ref+'.json'))).size;return n;
};
const beforeBytes=await bytes(),beforeWritten=store.stats.bytesWritten;
const beforeReachable=await reachableBytes(),beforeCleanup=store.stats.cleanupMs||0,saves=[];
const write=store.write.bind(store);store.write=async(state,options)=>{const t=performance.now();try{return await write(state,options);}finally{saves.push({ms:performance.now()-t,cleanup:!!options?.cleanup});}};
const start=performance.now();
const prepared=await live.prepare(sim.state.runs[0].id,products.slice(0,1311).map(p=>p.code),{continueOnError:true,localOnly:true});
const prepareMs=performance.now()-start;
const update=await live.commit(prepared.id,true);
const totalMs=performance.now()-start;
const manifest=JSON.parse(await readFile(store.manifestPath,'utf8'));
const refs=JSON.parse(await readFile(join(store.blobs,manifest.indexes.updates+'.json'),'utf8'));
const journal=JSON.parse(await readFile(join(store.blobs,refs[0]+'.json'),'utf8'));
const journalRefs=new Set([refs[0],...(journal.itemChunks||[]),...(journal.attempts||[]).flatMap(a=>a.itemChunks||[])]);
let journalBytes=0;for(const ref of journalRefs)journalBytes+=(await stat(join(store.blobs,ref+'.json'))).size;
const result={label,trusted,products:4800,items:1311,pages:59,delayMs:{page:600,put:700,listModified:400},outcome:update.outcome,calls,prepareMs,totalMs,initialReadMs:live.lastTimings.batch.initialReadMs,saveMs:live.lastTimings.saveMs,cleanupMs:(store.stats.cleanupMs||0)-beforeCleanup,saves,journalBytes,storeGrowthBytes:await bytes()-beforeBytes,reachableGrowthBytes:await reachableBytes()-beforeReachable,bytesWritten:store.stats.bytesWritten-beforeWritten,tempDir:dir};
console.log(JSON.stringify(result,null,2));
await writeFile(new URL('./TASK-126-benchmark-'+label+'.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
