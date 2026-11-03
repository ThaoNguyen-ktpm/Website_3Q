// Isolated bridge checks with DOM fixtures; no browser, API, login or real data access.
const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const html=readFileSync('Webstie/server/src/v2/mockup/baoq-mockup-v2.html','utf8');
const bridge=html.slice(html.indexOf('// The parent owns navigation only'),html.lastIndexOf('</script>'));
function fixture(search='?embed=1'){
 const events={},docEvents={},sent=[],renders=[],vars={},classes=new Set(),queue=[];
 const main={getBoundingClientRect:()=>({height:1234.2})};
 const location={search,hash:'#view=tx',origin:'http://fixture.local'};
 const parent={postMessage:data=>sent.push(data)};
 const context={URLSearchParams,location,parent,NAV_ORDER:['dashboard','tx','checks','inventory','kpi','goods'],overlay:null,
  reportOverlay:()=>parent.postMessage({type:'baoq-v2-overlay',open:false}),
  document:{body:{},getElementById:()=>main,documentElement:{style:{setProperty:(key,value)=>vars[key]=value},classList:{add:key=>classes.add(key),remove:key=>classes.delete(key)}},addEventListener:(name,fn)=>(docEvents[name]??=[]).push(fn)},
  history:{replaceState:(_s,_title,hash)=>location.hash=hash},render:value=>renders.push(value),
  requestAnimationFrame:fn=>{queue.push(fn);return queue.length},cancelAnimationFrame:()=>{},queueMicrotask:fn=>queue.push(fn),
  ResizeObserver:class{observe(){}},MutationObserver:class{observe(){}},
  addEventListener:(name,fn)=>(events[name]??=[]).push(fn)};
 context.window=context;
 vm.runInNewContext(bridge,context);
 return {events,docEvents,sent,renders,vars,classes,context,flush(){while(queue.length)queue.shift()()}};
}
const f=fixture();f.flush();
assert.equal(f.sent.some(m=>m.type==='baoq-v2-view'),false,'boot must not push an iframe route to the parent');
assert.equal(f.sent.find(m=>m.type==='baoq-v2-height').height,1235);
f.sent.length=0;f.events.hashchange[0]();
assert.deepEqual(f.sent.map(m=>m.type),['baoq-v2-ready'],'restored child entry requests the authoritative parent route');
const receive=f.events.message[0],valid={origin:f.context.location.origin,source:f.context.parent};
for(const invalid of [{...valid,origin:'http://wrong.test'},{...valid,source:{}}]){
 receive({...invalid,data:{type:'baoq-v2-route',hash:'#view=checks'}});
}
assert.equal(f.context.location.hash,'#view=tx');
receive({...valid,data:{type:'baoq-v2-route',hash:'#view=dashboard'}});
assert.equal(f.context.location.hash,'#view=dashboard');assert.deepEqual(f.renders,[true]);
assert.equal(f.sent.some(m=>m.type==='baoq-v2-view'),false,'parent route cannot echo into a new history entry');
receive({...valid,data:{type:'baoq-v2-overlay-layout',rect:{top:-300,left:400,width:900}}});
assert.equal(f.vars['--embed-top'],'-300px');assert.equal(f.vars['--embed-width'],'900px');
receive({...valid,data:{type:'baoq-v2-overlay-layout',rect:{top:0,left:0,width:NaN}}});
assert.equal(f.vars['--embed-width'],'900px');
f.sent.length=0;
f.context.location.hash='#view=kpi&k_view=sale';f.docEvents.change[0]({target:{closest:()=>true}});f.flush();
assert.equal(f.sent.find(m=>m.type==='baoq-v2-view').hash,'#view=kpi&k_view=sale');
const direct=fixture('');assert.equal(Object.keys(direct.events).length,0);
console.log('PASS: bridge boot/history, route origin/source, height, overlay coordinates, module controls, direct mode (DOM fixtures only).');

// Execute the actual React receiver with hook/DOM fixtures, without rendering a browser.
const ts=require('../Webstie/frontend/node_modules/typescript');
const code=ts.transpileModule(readFileSync('Webstie/frontend/src/v2-frame.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const hooks=[],refs=[],updates=[],messages=[],routes=[],listeners={};let stateIndex=0;
class Element{
 constructor(){this.children=[];this.inert=false;this.style={};this.attrs={}}
 getAttribute(key){return this.attrs[key]??null}
 setAttribute(key,value){this.attrs[key]=value}
 removeAttribute(key){delete this.attrs[key];if(key==='style')this.style={}}
 append(child){this.children.push(child);child.parentElement=this;return child}
}
const body=new Element(),root=new Element(),app=body.append(new Element()),header=app.append(new Element()),slot=app.append(new Element()),iframe=slot.append(new Element());
iframe.contentWindow={postMessage:data=>messages.push(data)};iframe.getBoundingClientRect=()=>({top:-200,left:400,width:900});
const exportsObject={},outer={origin:'http://fixture.local',hash:'#page=v2-dashboard'};
const sandbox={exports:exportsObject,HTMLElement:Element,URL,URLSearchParams,location:outer,document:{body,documentElement:Object.assign(root,{clientWidth:1420})},
 scrollX:0,scrollY:500,innerWidth:1440,getComputedStyle:()=>({paddingRight:'0'}),
 require:name=>name==='react'?{useRef:value=>{const ref={current:value};refs.push(ref);return ref},useState:value=>{const index=stateIndex++;return [value,next=>updates.push([index,next])]},useEffect:fn=>hooks.push(fn)}:
  name==='react-dom'?{createPortal:()=>null}:name==='react/jsx-runtime'?{jsx:()=>null,jsxs:()=>null}:name==='./apps'?{
   v2FrameUrl:(page)=>'/v2/mockup/baoq-mockup-v2.html?embed=1#view='+page.slice(3),
   v2MessageRoute:hash=>hash==='#view=tx'?'#page=v2-tx':null}:assert.fail('Unexpected require '+name),
 addEventListener:(name,fn)=>listeners[name]=fn,removeEventListener:name=>delete listeners[name],scrollTo:opts=>messages.push({scroll:opts})};
sandbox.window=sandbox;vm.runInNewContext(code,sandbox);
exportsObject.V2Frame({page:'v2-dashboard',route:new URLSearchParams(),onRoute:hash=>routes.push(hash)});
refs[0].current=iframe;hooks[0]();const cleanup=hooks[1]();
const send=(data,origin=outer.origin,source=iframe.contentWindow)=>listeners.message({data,origin,source});
send({type:'baoq-v2-height',height:1234.2});assert.deepEqual(updates.pop(),[0,1235]);
for(const height of [399,200001,NaN,Infinity,'900'])send({type:'baoq-v2-height',height});
send({type:'baoq-v2-overlay',open:true},'http://wrong.test');send({type:'baoq-v2-overlay',open:true},outer.origin,{});
assert.equal(updates.length,0);assert.equal(header.inert,false);
send({type:'baoq-v2-overlay',open:true});assert.equal(header.inert,true);assert.equal(iframe.inert,false);
assert.equal(body.style.top,'-500px');assert.equal(root.style.overflow,'hidden');assert.equal(body.style.paddingRight,'20px');
assert.deepEqual(updates.pop(),[1,true]);
send({type:'baoq-v2-overlay',open:false});assert.equal(header.inert,false);assert.equal(body.style.position,undefined);
assert.equal(messages.at(-1).scroll.top,500);assert.deepEqual(updates.pop(),[1,false]);
send({type:'baoq-v2-ready'});assert.equal(messages.at(-1).hash,'#view=dashboard');
send({type:'baoq-v2-view',hash:'#view=tx'});assert.deepEqual(routes,['#page=v2-tx']);
send({type:'baoq-v2-overlay',open:true});cleanup();assert.equal(header.inert,false);assert.equal(listeners.message,undefined);
console.log('PASS: actual receiver height bounds, origin/source, overlay lock/inert/scroll restoration and unmount cleanup (hook/DOM fixtures only).');
