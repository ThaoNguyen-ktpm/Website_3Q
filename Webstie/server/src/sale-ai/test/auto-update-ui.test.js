import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=(await readFile(new URL('../public/live-ui.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'').replaceAll('export function ','function ');
function fixture(settings,{reload}={}){
  const sandbox=vm.createContext({});vm.runInContext(source,sandbox);
  // The renderer's DOM boundary, same pattern as other Sale AI node UI tests.
  const nodes=new Map();
  const node=key=>{if(!nodes.has(key))nodes.set(key,{innerHTML:'',focus(){},reportValidity:()=>true,value:'14:30'});return nodes.get(key);};
  const container={dataset:{},innerHTML:'',querySelector:selector=>{
    if(selector==='[data-auto-edit]'&&container.innerHTML.includes('data-auto-save'))return null;
    if(['[data-auto-save]','[data-auto-cancel]'].includes(selector)&&!container.innerHTML.includes('data-auto-save'))return null;
    const element=node(selector);if(selector==='.auto-confirm')element.querySelector=node;return element;
  }};
  const calls=[],messages=[];
  const ctx={esc:String,beginOperation(){},endOperation(){},message:text=>messages.push(text),api:async(path,body)=>{calls.push({path,body:structuredClone(body)});return {...settings,...body,nextAt:'2026-11-05T03:00:00Z'};},acceptUpdate:reload||(async()=>sandbox.renderAutoUpdate(settings,container,ctx))};
  sandbox.renderAutoUpdate(settings,container,ctx);return {sandbox,container,node,calls,messages};
}
test('switch requires inline approval before persisting; cancelling never writes',async()=>{
  const f=fixture({enabled:false,time:'10:00'});
  f.node('.auto-switch').onclick();assert.equal(f.calls.length,0);
  assert.match(f.node('.auto-confirm').innerHTML,/M1–M6/);
  assert.match(f.node('.auto-confirm').innerHTML,/Chỉ bật trên một máy để tránh ghi Kiot hai lần\./);
  f.node('[data-auto-no]').onclick();assert.equal(f.calls.length,0);
  f.node('.auto-switch').onclick();await f.node('[data-auto-yes]').onclick();
  assert.equal(f.calls.length,1);assert.equal(f.calls[0].body.enabled,true);assert.equal(f.calls[0].body.time,'10:00');
  assert.match(f.container.innerHTML,/Tự động cập nhật: Bật/);
});
test('POST response updates the schedule immediately while the table reload is pending',async()=>{
  let release;const reloading=new Promise(resolve=>{release=resolve;});
  const settings={enabled:false,time:'10:00'};
  const f=fixture(settings,{reload:()=>reloading});
  f.node('.auto-switch').onclick();const saving=f.node('[data-auto-yes]').onclick();
  try{
    await new Promise(setImmediate);
    assert.match(f.container.innerHTML,/Tự động cập nhật: Bật/);
    assert.match(f.container.innerHTML,/Lần tới:/);
    assert.equal(settings.enabled,true);
    assert.equal(settings.nextAt,'2026-11-05T03:00:00Z');
  }finally{release();await saving;}
});
test('time editor saves only after inline confirmation and cancel keeps the old schedule',async()=>{
  const f=fixture({enabled:true,time:'10:00'});
  f.node('[data-auto-edit]').onclick();assert.match(f.container.innerHTML,/type="time"/);
  f.node('[data-auto-cancel]').onclick();assert.equal(f.calls.length,0);
  f.node('[data-auto-edit]').onclick();f.node('input').value='14:30';f.node('[data-auto-save]').onclick();assert.equal(f.calls.length,0);
  assert.match(f.node('.auto-confirm').innerHTML,/14:30/);await f.node('[data-auto-yes]').onclick();
  assert.equal(f.calls[0].body.time,'14:30');assert.equal(f.calls[0].body.enabled,true);
  assert.match(f.container.innerHTML,/14:30 · Thứ 2–Thứ 7/);
});
test('schedule controls are available without a machine permission field',()=>{
  const f=fixture({enabled:false,time:'10:00'});
  assert.doesNotMatch(f.container.innerHTML,/disabled|chỉ Laptop|Máy: Laptop/);
  assert.match(f.container.innerHTML,/Tự động cập nhật: Tắt/);
  f.node('[data-auto-edit]').onclick();assert.match(f.container.innerHTML,/type="time"/);
  assert.equal(f.calls.length,0);
});
test('active auto job exposes locked controls',()=>{
  const f=fixture({enabled:true,time:'10:00',running:true});
  assert.match(f.container.innerHTML,/aria-describedby="auto-note" disabled/);
  assert.match(f.container.innerHTML,/data-auto-edit disabled/);
  assert.match(f.container.innerHTML,/Đang chạy/);
  assert.equal(f.calls.length,0);
});
