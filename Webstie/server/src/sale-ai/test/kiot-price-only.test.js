import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {createSaleAi} from '../core.js';
import {normalizeProduct,KiotClient} from '../lib/kiot.js';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as report from '../lib/update-report.js';
import {ageCell} from '../public/age-cell.js';
const uiSource=(await readFile(new URL('../public/live-ui.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'').replaceAll('export function ','function ');
const ui=vm.createContext({...report,ageCell});vm.runInContext(uiSource,ui);
const {renderLiveResults,renderHistory}=ui;

const memory=()=>{let value;return {read:async()=>structuredClone(value),write:async next=>{value=structuredClone(next);}};};
async function backgroundUpdate(sale,codes){
 const response=await request(sale,'/api/kiot/update',{runId:sale.real.state.runs[0].id,codes,confirmed:true});
 assert.equal(response.status,202);await sale.waitForJob(response.body.id);
 const job=(await request(sale,'/api/jobs/'+response.body.id)).body;
 assert.equal(job.status,'completed');return job.result;
}
async function request(sale,path,body){
 const req=Readable.from(body===undefined?[]:[JSON.stringify(body)]);req.url=path;req.method=body===undefined?'GET':'POST';req.headers={'content-type':'application/json'};
 let status,data;await sale.handler(req,{writeHead:code=>{status=code;},end:raw=>{data=JSON.parse(raw);}});return {status,body:data};
}
async function fixture({batch=false,corrupt=false}={}){
 const products=[1,2].map(id=>normalizeProduct({id,code:'SP'+id,name:'Túi '+id,basePrice:35e6,createdDate:'2026-09-01',isActive:true,description:'<b>Gốc '+id+'</b>',inventories:[{branchId:44466,onHand:1}]}));
 const calls=[],sapoCalls=[];
 const apply=(p,fields)=>{calls.push(structuredClone(fields));assert.deepEqual(Object.keys(fields),['basePrice']);const actual=products.find(x=>x.id===p.id);actual.currentPrice=fields.basePrice;if(corrupt)actual.notes='mô tả bị đổi';};
 const client={all:async()=>structuredClone(products),product:async id=>structuredClone(products.find(p=>p.id===id)),update:async(p,fields)=>apply(p,fields),
  updateMany:async entries=>{for(const e of entries)apply(e.product,e.fields);},listModified:async()=>structuredClone(products)};
 // SP1 has Sapo price zero; SP2 is missing. Neither should ever be read.
 const sapoClient={all:async()=>{sapoCalls.push('LIST');return [{id:51,content:'Sapo',variants:[{id:91,sku:'SP1',price:0}]}];},product:async()=>{sapoCalls.push('GET');throw Error('Sapo disabled');},update:async()=>{sapoCalls.push('PUT');throw Error('Sapo disabled');}};
 const sale=await createSaleAi({fixture:true,sapoWrite:false,kiotDescription:false,batchWrites:batch,store:memory(),liveStore:memory(),sapoStore:memory(),client,sapoClient,clock:()=>new Date('2026-11-16T03:00:00Z')});
 sale.live.timingSink=()=>{};
 await new Promise(setImmediate);await sale.refreshTable();await sale.real.run();
 return {sale,products,calls,sapoCalls};
}
for(const batch of [false,true])for(const background of [false,true])test(`price-only update and restore preserve descriptions without Sapo (batch=${batch}, background=${background})`,async()=>{
 const f=await fixture({batch}),run=f.sale.real.state.runs[0];let update;
 if(background){const accepted=await request(f.sale,'/api/kiot/update',{runId:run.id,codes:['SP1','SP2'],confirmed:true});assert.equal(accepted.status,202);await f.sale.waitForJob(accepted.body.id);const job=(await request(f.sale,'/api/jobs/'+accepted.body.id)).body;assert.equal(job.status,'completed');update=job.result;}
 else{const prepared=await f.sale.live.prepare(run.id,['SP1','SP2'],{continueOnError:true});assert.match(prepared.items[0].notePreview,/BAOQ/);update=await f.sale.live.commit(prepared.id,true);}
 assert.equal(update.outcome,'success');assert.equal(update.kiotDescription,false);assert.deepEqual(Object.keys(update.platformSummary),['kiot']);
 const updatedRows=f.sale.real.state.runs[0].rows;
 assert.ok(updatedRows.every(r=>r.currentPrice===r.price&&r.liveReadAt));
 assert.deepEqual(updatedRows.map(r=>r.notesBefore),['<b>Gốc 1</b>','<b>Gốc 2</b>']);
 assert.deepEqual(f.products.map(p=>p.notes),['<b>Gốc 1</b>','<b>Gốc 2</b>']);assert.equal(f.calls.length,2);assert.deepEqual(f.sapoCalls,[]);
 // Restore semantics belong to the journal, even if the current flag changes.
 f.sale.live.kiotDescription=true;
 const proposal=await f.sale.live.prepareRestore(update.id),restored=await f.sale.live.commitRestore(proposal.id,true);
 assert.equal(restored.outcome,'success');assert.equal(f.calls.length,4);assert.ok(f.products.every(p=>p.currentPrice===35e6));assert.deepEqual(f.sapoCalls,[]);
 const history=(await request(f.sale,'/api/view?dataset=real&view=history')).body;
 assert.equal(history.history.find(e=>e.id===update.id).update.kiotDescription,false);
});
for(const batch of [false,true])test(`description corruption is never verified (batch=${batch})`,async()=>{
 const f=await fixture({batch,corrupt:true}),p=await f.sale.live.prepare(f.sale.real.state.runs[0].id,['SP1'],{continueOnError:true});
 const result=await f.sale.live.commit(p.id,true);assert.equal(result.outcome,'partial_failure');assert.equal(result.items[0].platforms.kiot.status,'unknown');assert.deepEqual(f.sapoCalls,[]);
});
test('old Sapo restore and stale joint confirmations are blocked before any network',async()=>{
 const f=await fixture();f.sale.real.state.updates=[{id:'old',mode:'joint-v1',restoreVersion:1,items:[{code:'SP1',platforms:{kiot:{status:'done'},sapo:{status:'done'}}}]}];
 await assert.rejects(f.sale.live.prepareRestore('old'),/Lượt cũ có Sapo — cần hoàn tác tay/);
 const p=await f.sale.live.prepare(f.sale.real.state.runs[0].id,['SP1']);f.sale.real.state.prepared[0].joint=true;
 await assert.rejects(f.sale.live.commit(p.id,true),/Sapo/);assert.deepEqual(f.sapoCalls,[]);assert.deepEqual(f.calls,[]);
 f.sale.real.state.prepared[0].joint=false;delete f.sale.real.state.prepared[0].kiotDescription;
 await assert.rejects(f.sale.live.commit(p.id,true),/tắt ghi mô tả/);assert.deepEqual(f.calls,[]);
});
for(const corrupt of [false,true])test(`legacy stop engine also supports price-only verification (corrupt=${corrupt})`,async()=>{
 const f=await fixture({corrupt});f.sale.live.sapo=null;f.sale.live.sapoWrite=undefined;
 const p=await f.sale.live.prepare(f.sale.real.state.runs[0].id,['SP1']);
 const result=await f.sale.live.commit(p.id,true);assert.equal(result.mode,'stop-v1');
 assert.equal(result.outcome,corrupt?'partial_failure':'success');assert.equal(f.calls.length,1);assert.deepEqual(f.sapoCalls,[]);
 if(!corrupt){const row=f.sale.real.state.runs[0].rows.find(r=>r.code==='SP1');assert.equal(row.currentPrice,row.price);assert.ok(row.liveReadAt);}
});
test('Kiot wire bodies omit description for single and bulk price writes; rawFields do not contain it',async()=>{
 const bodies=[],client=new KiotClient({fetcher:async(_url,options)=>{bodies.push(JSON.parse(options.body));return {ok:true,json:async()=>({})};}});client.token='fixture';client.expires=Date.now()+60000;
 const product=normalizeProduct({id:1,code:'SP1',name:'Túi',categoryId:2,description:'Gốc'});assert.equal(Object.hasOwn(product.rawFields,'description'),false);
 await client.update(product,{basePrice:10});await client.updateMany([{product,fields:{basePrice:20}}]);
 assert.deepEqual(bodies,[{name:'Túi',code:'SP1',categoryId:2,basePrice:10},{listProducts:[{name:'Túi',code:'SP1',categoryId:2,id:1,basePrice:20}]}]);
});
test('price-only page keeps reference notes and marks old Sapo history for manual restore',()=>{
 const nodes=new Map(),container={dataset:{},querySelector:selector=>{if(selector==='.result-actions')return null;if(!nodes.has(selector))nodes.set(selector,{});return nodes.get(selector);},querySelectorAll:()=>[],insertAdjacentHTML(_where,html){this.innerHTML+=html;}};
 const ctx={esc:String,money:String,dateTime:String,mFilter:'',pagedTable:(_headers,items,row)=>items.map(row).join('')};
 renderLiveResults({dataset:'real',sapoWrite:false,kiotDescription:false,policy:'p',today:'2026-11-16',dataRevision:1},{id:'r',policy:'p',day:'2026-11-16',dataRevision:1,rows:[{code:'SP1',reasons:[],notesBefore:'Mô tả gốc',notePreview:'BAOQ tham khảo'}]},container,ctx);
 assert.match(container.innerHTML,/Cập nhật giá Kiot \(0 món\)/);assert.match(container.innerHTML,/Ghi chú tham khảo \(không ghi lên Kiot\):/);assert.match(container.innerHTML,/Mô tả gốc/);assert.match(container.innerHTML,/BAOQ tham khảo/);
 renderHistory({dataset:'real',sapoWrite:false,history:[{kind:'update',id:'old',update:{mode:'joint-v1',canRestore:true,platformSummary:{sapo:{}},summary:{preflightFailed:0,total:1}}}]},container,ctx);
 assert.match(container.innerHTML,/Lượt cũ có Sapo — cần hoàn tác tay/);assert.doesNotMatch(container.innerHTML,/data-restore=/);
});

for(const batch of [false,true])test(`verified price updates refresh table snapshots and reselecting skips without PUT (batch=${batch})`,async()=>{
 const f=await fixture({batch}),old=structuredClone(f.sale.real.state.runs[0]);
 const first=await backgroundUpdate(f.sale,['SP1']);assert.equal(first.outcome,'success');
 const current=f.sale.real.state.runs[0],row=current.rows.find(r=>r.code==='SP1');
 assert.equal(row.currentPrice,row.price);assert.ok(row.liveReadAt);assert.equal(row.notesBefore,'<b>Gốc 1</b>');
 assert.notEqual(row.liveBase,old.rows.find(r=>r.code==='SP1').liveBase);
 const selection=await request(f.sale,'/api/kiot/selection?runId='+current.id);
 assert.deepEqual(selection.body.codes,['SP2']);assert.deepEqual(selection.body.excludedCodes,[]);
 const second=await backgroundUpdate(f.sale,['SP1']);assert.equal(second.outcome,'success');
 assert.equal(report.updateReport(second).unchanged,1);assert.equal(report.updateReport(second).issues,0);
 assert.equal(second.items[0].status,'unchanged');assert.equal(second.items[0].platforms.kiot.requestSent,false);
 assert.equal(second.summary.failed,0);assert.equal(second.issueCount,0);assert.equal(f.calls.length,1);
 const retry=await request(f.sale,'/api/kiot/retry-selection?updateId='+second.id);assert.deepEqual(retry.body.codes,[]);assert.equal(retry.body.total,0);
 assert.deepEqual(f.sapoCalls,[]);
});

for(const batch of [false,true])test(`legacy stale table accepts only the verified after-image (batch=${batch})`,async()=>{
 const f=await fixture({batch}),oldRun=structuredClone(f.sale.real.state.runs[0]),oldProducts=structuredClone(f.sale.real.state.products);
 await backgroundUpdate(f.sale,['SP1']);
 // Model an older Sale AI journal whose table/local product was never refreshed.
 f.products[0].modifiedDate='2026-11-16T03:00:00Z';
 f.products[0].notes='BAOQ của lượt ghi cũ đã xác minh';
 f.sale.real.state.updates[0].items[0].platforms.kiot.afterProduct=structuredClone(f.products[0]);
 f.sale.real.state.products=oldProducts;f.sale.real.state.dataRevision=oldRun.dataRevision;f.sale.real.state.runs=[oldRun];
 const second=await backgroundUpdate(f.sale,['SP1']);
 assert.equal(second.outcome,'success');assert.equal(report.updateReport(second).unchanged,1);assert.equal(f.calls.length,1);
 assert.equal(f.sale.real.state.runs[0].rows[0].currentPrice,f.products[0].currentPrice);
 assert.ok(f.sale.real.state.runs[0].rows[0].liveReadAt);assert.deepEqual(f.sapoCalls,[]);
});

for(const batch of [false,true])test(`already correct prices mixed with pending prices are not sent (batch=${batch})`,async()=>{
 const f=await fixture({batch});await backgroundUpdate(f.sale,['SP1']);
 const result=await backgroundUpdate(f.sale,['SP1','SP2']);
 assert.equal(result.outcome,'success');assert.equal(f.calls.length,2);
 assert.equal(report.updateReport(result).unchanged,1);assert.equal(report.updateReport(result).succeeded,1);assert.equal(result.issueCount,0);
 if(batch)assert.equal(f.sale.live.operation.batch.unchanged,1);
 const restore=await f.sale.live.prepareRestore(result.id);assert.deepEqual(restore.tasks.map(t=>t.codes),[['SP2']]);
});

for(const batch of [false,true])for(const field of ['currentPrice','notes','stock','rawFields'])test(`hand edited ${field} remains blocked even after a previous write (batch=${batch})`,async()=>{
 const f=await fixture({batch});await backgroundUpdate(f.sale,['SP1']);
 const p=f.products[0];if(field==='currentPrice')p.currentPrice++;else if(field==='notes')p.notes+=' khác';else if(field==='stock')p.stock++;else p.rawFields.categoryId=99;
 const result=await backgroundUpdate(f.sale,['SP1']);
 assert.equal(result.items[0].platforms.kiot.status,'preflight_failed');assert.equal(f.calls.length,1);
 assert.equal(report.updateReport(result).unchanged,0);assert.equal(report.updateReport(result).preflightFailed,1);assert.deepEqual(f.sapoCalls,[]);
});

test('price-only page labels already correct prices and select-all count excludes them',async()=>{
 const nodes=new Map(),container={dataset:{},querySelector:selector=>{if(selector==='.result-actions')return null;if(!nodes.has(selector))nodes.set(selector,{});return nodes.get(selector);},querySelectorAll:()=>[]};
 const ctx={esc:String,money:String,mFilter:'',pagedTable:(_h,items,row)=>items.map(row).join(''),canWrite:()=>true,beginOperation:()=>{},endOperation:()=>{},message:()=>{},api:async()=>({runId:'correct',dataRevision:1,codes:['SP2'],excludedCodes:[]})};
 renderLiveResults({dataset:'real',sapoWrite:false,kiotDescription:false,policy:'p',today:'2026-11-16',dataRevision:1},{id:'correct',policy:'p',day:'2026-11-16',dataRevision:1,rows:[{code:'SP1',status:'simulated',currentPrice:32400000,price:32400000,reasons:[],notesBefore:'Gốc'},{code:'SP2',status:'simulated',currentPrice:35000000,price:32400000,reasons:[],notesBefore:'Gốc'}]},container,ctx);
 assert.match(container.innerHTML,/Đã đúng giá trên Kiot/);
 assert.match(container.innerHTML,/data-live-code="SP1"[^>]*disabled/);
 await nodes.get('#select-all').onclick();assert.equal(nodes.get('#prepare-update').textContent,'Cập nhật giá Kiot (1 món)');
});
