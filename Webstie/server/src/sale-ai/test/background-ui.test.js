import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const apiSource=source.slice(source.indexOf('async function api('),source.indexOf('let messageTimer;'));

for(const failure of ['fetch','json'])test(`page API explains ${failure} connection loss without resending`,async()=>{
 let calls=0;const sandbox={dataset:'real',fetch:async()=>{calls++;if(failure==='fetch')throw new TypeError('Failed to fetch');return {ok:true,json:async()=>{throw new SyntaxError('Unexpected end of JSON input');}};}};
 vm.createContext(sandbox);vm.runInContext(apiSource,sandbox);
 await assert.rejects(sandbox.api('/api/kiot/update',{confirmed:true}),/Mất kết nối máy chủ Sale AI.*Lịch sử/);assert.equal(calls,1);
});

test('page API preserves cancellation and business errors',async()=>{
 const abort=Object.assign(Error('cancelled'),{name:'AbortError'});
 const sandbox={dataset:'real',fetch:async()=>{throw abort;}};vm.createContext(sandbox);vm.runInContext(apiSource,sandbox);
 await assert.rejects(sandbox.api('/api/view'),e=>e===abort);
 sandbox.fetch=async()=>({ok:false,status:403,json:async()=>({error:'Không có quyền'})});
 await assert.rejects(sandbox.api('/api/view'),/Không có quyền/);
});

test('status polling replaces stale progress with a connection message once per outage',async()=>{
 let tick;const box={},messages=[];
 const sandbox={polling:false,statusOffline:false,api:async()=>{throw Error('Mất kết nối máy chủ Sale AI — xem Lịch sử');},setInterval:fn=>{tick=fn;},$:()=>box,message:text=>messages.push(text)};
 vm.createContext(sandbox);vm.runInContext(source.slice(source.indexOf('setInterval(async()=>',source.indexOf('function renderProgress('))),sandbox);
 await tick();await tick();assert.equal(messages.length,1);assert.match(box.textContent,/Mất kết nối.*Lịch sử/);assert.equal(box.hidden,false);assert.equal(sandbox.polling,false);
});
test('status polling with no job and no observed job keeps the table without an error',async()=>{
 let tick;const calls=[],messages=[];
 const table='<table><tbody><tr><td>SP0</td></tr></tbody></table>';
 const elements={'#content':{hidden:false,innerHTML:table},'#update-progress':{hidden:true,innerHTML:''},'#sync-status':{textContent:''},'#message':{hidden:true,textContent:''}};
 const sandbox={dataset:'real',polling:false,statusOffline:false,pending:false,observedJob:undefined,finishedJob:undefined,
  state:{revision:'rev-1',busy:false},loadedKey:'results',requestKey:()=>'results',syncLine:()=>'Bảng giá hiện hành',
  fetch:async path=>{calls.push(path);return {ok:true,status:200,json:async()=>({job:null,busy:false,revision:'rev-1'})};},
  setInterval:fn=>{tick=fn;},$:selector=>elements[selector],document:{querySelector:selector=>elements[selector]||null},
  message:(text,error)=>{messages.push({text,error});elements['#message'].hidden=!text;elements['#message'].textContent=text;},
  loadView:async()=>{assert.fail('An unchanged status must keep the current table');}};
 vm.createContext(sandbox);vm.runInContext(apiSource,sandbox);
 vm.runInContext(source.slice(source.indexOf('function renderProgress(')),sandbox);
 await tick();await tick();
 assert.deepEqual(messages,[]);assert.equal(elements['#message'].hidden,true);assert.equal(elements['#update-progress'].hidden,true);
 assert.equal(elements['#content'].hidden,false);assert.equal(elements['#content'].innerHTML,table);
 assert.equal(elements['#sync-status'].textContent,'Bảng giá hiện hành');assert.equal(sandbox.statusOffline,false);assert.equal(sandbox.polling,false);
 assert.deepEqual(calls,['api/status?dataset=real','api/status?dataset=real']);
});
test('page API follows 202 using short GETs, sends confirmation once, and returns final update',async()=>{
 const calls=[],responses=[{status:202,id:'job-1'},{status:'running'},{status:'completed',id:'job-1',kind:'update',result:{id:'update-1',outcome:'success'}}];
 const sandbox={dataset:'real',setTimeout:fn=>fn(),finishedJob:undefined,fetch:async(path,options)=>{
  calls.push({path,options});const data=responses.shift();return {status:data.status===202?202:200,ok:true,json:async()=>data};
 }};
 vm.createContext(sandbox);vm.runInContext(apiSource,sandbox);
 const update=await sandbox.api('/api/kiot/update',{runId:'run-1',codes:['SP0'],confirmed:true});
 assert.equal(update.id,'update-1');assert.equal(sandbox.finishedJob,'job-1');assert.equal(calls.length,3);
 assert.equal(calls[0].options.method,'POST');assert.equal(JSON.parse(calls[0].options.body).confirmed,true);
 assert.ok(calls.slice(1).every(c=>c.path==='api/jobs/job-1?dataset=real'&&c.options.method===undefined));
});
test('page API surfaces background failure without resending the update',async()=>{
 let calls=0;
 const sandbox={dataset:'real',setTimeout:fn=>fn(),fetch:async()=>{
  const first=++calls===1;return {status:first?202:200,ok:true,json:async()=>first?{id:'failed'}:{status:'failed',error:'fixture failure'}};
 }};
 vm.createContext(sandbox);vm.runInContext(apiSource,sandbox);
 await assert.rejects(sandbox.api('/api/kiot/update',{confirmed:true}),/fixture failure.*Lịch sử/);assert.equal(calls,2);
});
