import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import vm from 'node:vm';

// The browser serves update-report.js from lib; resolve that route for Node's loader.
const uiSource=(await readFile(new URL('../public/live-ui.js',import.meta.url),'utf8')).replace(/from '(.+?)'/g,(_match,path)=>
  `from '${new URL(path==='./update-report.js'?'../lib/update-report.js':path,new URL('../public/live-ui.js',import.meta.url)).href}'`);
const {renderApproval}=await import('data:text/javascript;base64,'+Buffer.from(uiSource).toString('base64'));

test('website exposes approval tab and iframe app recognizes the view and title',async()=>{
  const require=createRequire(new URL('../../../../frontend/package.json',import.meta.url));
  const ts=require('typescript'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
  const source=await readFile(new URL('../../../../frontend/src/price-system.tsx',import.meta.url),'utf8');
  const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
  const context={exports:{},require:id=>id.startsWith('react')?require(id):{}};vm.runInNewContext(js,context);
  const html=renderToStaticMarkup(React.createElement(context.exports.SaleAi));
  assert.match(html,/>Duyệt<\/button>/);
  const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
  assert.match(app,/\['results','history','approval'\]\.includes/);assert.match(app,/approval:'Duyệt'/);
});

async function click({kind='approve',all=false,confirm=true,locked=false}={}){
  const row={code:'TEST-1',name:'Dữ liệu mẫu <script>',m:1,currentM:0,currentPrice:35e6,price:34.2e6,cost:34.5e6,belowCost:300000};
  const button={dataset:{approval:kind,code:row.code},hasAttribute:()=>all,disabled:false};
  const container={innerHTML:'',querySelectorAll:()=>[button]};const calls=[],messages=[];let busy=false,dialog;
  const oldDocument=globalThis.document;
  const state={dataset:'real',runId:'run',sapoWrite:false,pending:{items:[row],total:12},legacy:{items:[row],total:1}};
  const ctx={esc:value=>String(value??'').replaceAll('<','&lt;'),money:value=>String(value),query:'',canWrite:()=>!locked&&!busy,
    pagedTable:(_headers,items,render)=>items.map(render).join(''),message:t=>messages.push(t),beginOperation:()=>{busy=true;},endOperation:()=>{busy=false;},acceptUpdate:async()=>{},
    api:async(path,body)=>{calls.push({path,body});
      if(path.startsWith('/api/kiot/approval-selection'))return {runId:'run',items:Array.from({length:12},(_,i)=>({...row,code:'TEST-'+i}))};
      if(path==='/api/kiot/prepare')return {id:'proposal',items:body.codes.map(code=>({code,before:{currentPrice:35e6},row:{cost:34.5e6,price:kind==='restore'?34.5e6:34.2e6}}))};
      if(path==='/api/kiot/commit')return {items:[]};return {};
    }};
  globalThis.document={createElement:()=>{
    const yes={},no={};dialog={innerHTML:'',setAttribute:()=>{},querySelector:selector=>selector==='[data-yes]'?yes:no,
      showModal:()=>{assert.equal(calls.some(c=>c.path.endsWith('/commit')),false);queueMicrotask(()=>confirm?yes.onclick():no.onclick());},close:()=>{},remove:()=>{}};return dialog;
  },body:{append:()=>{}}};
  try{renderApproval(state,container,ctx);if(!locked)await button.onclick();}
  finally{globalThis.document=oldDocument;}
  return {calls,html:container.innerHTML,dialog:dialog?.innerHTML,busy,messages};
}
test('approval preview requires confirmation and all selects across pages',async()=>{
  const result=await click({all:true});assert.equal(result.calls[1].body.codes.length,12);
  assert.equal(result.calls[1].body.approveBelowCost,true);assert.equal(result.calls[2].path,'/api/kiot/commit');
  assert.match(result.dialog,/12 món/);assert.match(result.html,/&lt;script>/);assert.equal(result.busy,false);
});
test('cancel consumes no write; restore uses cost flag; keep sends confirmed price snapshot only',async()=>{
  const cancelled=await click({confirm:false});assert.deepEqual(cancelled.calls.map(c=>c.path),['/api/kiot/prepare','/api/kiot/cancel']);
  const restore=await click({kind:'restore'});assert.equal(restore.calls[0].body.restoreCost,true);assert.match(restore.dialog,/tổng tăng/);
  const keep=await click({kind:'keep'});assert.equal(keep.calls.length,1);assert.equal(keep.calls[0].path,'/api/kiot/keep-below-cost');
  assert.deepEqual(keep.calls[0].body.items,[{code:'TEST-1',price:35e6,cost:34.5e6}]);assert.match(keep.dialog,/giữ nguyên giá/);
});
test('busy approval view disables all write buttons',async()=>{
  const result=await click({locked:true});assert.match(result.html,/data-approval="approve"[^>]*disabled/);assert.deepEqual(result.calls,[]);
});
