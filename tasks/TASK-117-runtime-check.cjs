// Offline focused check for sandbox environments where Vitest/esbuild cannot spawn.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('../Webstie/node_modules/typescript/lib/typescript.js');
const source=fs.readFileSync(require('node:path').join(__dirname,'../Webstie/server/src/sale-ai/runtime.ts'),'utf8').replaceAll('import.meta.url',JSON.stringify('file:///offline/runtime.ts'));
function fixture(){
 const timers=[],logs=[],exports={};
 const timer=fn=>{const t={fn,cancelled:false,unref(){return this;}};timers.push(t);return t;};
 const stubs={
  './core.js':{createSaleAi:()=>{throw Error('Unexpected production initializer');}},
  './lib/kiot.js':{},'./lib/shared-catalog.js':{},'./lib/sapo.js':{},
  './lib/store-lock.js':{waitForStoreLocks:async()=>true},
  '../services/catalogStore.js':{},'node:module':{},'node:url':{},
 };
 const context={exports,require:name=>{assert.ok(Object.hasOwn(stubs,name),name);return stubs[name];},
  process:{env:{SAPO_API_SECRET:'offline-private-value'}},console:{error:text=>logs.push(text)},
  setTimeout:timer,setInterval:timer,clearTimeout:t=>{if(t)t.cancelled=true;},clearInterval:t=>{if(t)t.cancelled=true;},Date,Promise,Error};
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,context);
 return {runtime:exports,timers,logs};
}
(async()=>{
 const f=fixture();let calls=0,shutdowns=0;
 const core={keepCurrent:async()=>{},shutdown:async()=>{shutdowns++;return true;}};
 const initialize=async()=>{if(++calls===1)throw Error('Store busy: writer/maintenance lock exists');return core;};
 await Promise.all([f.runtime.startSaleAi(initialize),f.runtime.startSaleAi(initialize)]);
 assert.equal(calls,1);assert.match(f.runtime.getSaleAiUnavailableReason(),/đang bị khoá/);assert.match(f.logs[0],/Store busy/);
 f.timers[0].fn();await f.runtime.startSaleAi(initialize);
 assert.equal(calls,2);assert.equal(f.runtime.getSaleAi(),core);assert.equal(await f.runtime.stopSaleAi(),true);assert.equal(shutdowns,1);
 const g=fixture();await g.runtime.startSaleAi(async()=>{throw Error('configuration token=offline-private-value');});
 assert.ok(!g.logs.join('').includes('offline-private-value'));await g.runtime.stopSaleAi();assert.ok(g.timers.every(t=>t.cancelled));
 console.log('TASK-117 runtime: retry, coalescing, availability, shutdown cancellation and redaction passed (offline VM).');
})().catch(error=>{console.error(error);process.exitCode=1;});
