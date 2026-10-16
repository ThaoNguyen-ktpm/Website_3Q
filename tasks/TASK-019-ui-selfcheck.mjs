// Local component and API checks with fixtures; no browser, Google or database.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const source = readFileSync('client/src/admin/views/App.jsx','utf8').replace(/^import .*$/gm,'').replace('export default function App','function App');
const compiled = ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022}}).outputText;
let states=[], cursor=0, effects=[], requests=[], page='audit';
const useState=initial=>{const key=cursor++;if(!(key in states))states[key]=typeof initial==='function'?initial():initial;return [states[key],value=>{states[key]=typeof value==='function'?value(states[key]):value}]};
const useEffect=effect=>effects.push(effect);
const actions={'auth.login':'Đăng nhập','staff.update':'Sửa nhân viên'};
let fetchResult={items:[],total:0,page:1,pageSize:25}, fetchError;
const listAuditLogs=async(...args)=>{requests.push(args);if(fetchError)throw fetchError;return fetchResult};
const controller=()=>({page,store:{settings:{name:'Fixture'}},sidebarOpen:false,drawer:null,toast:null});
const {App,AuditLogs,auditDetails}=new Function('React','useState','useEffect','useRef','listAuditLogs','auditActions','Icon','useAdminController','seedOrders','statusLabels',`${compiled}; return {App,AuditLogs,auditDetails};`)(React,useState,useEffect,()=>({}),listAuditLogs,actions,()=>null,controller,[],{});
const walk=node=>Array.isArray(node)?node.flatMap(walk):node?.props?[node,...walk(node.props.children)]:[];
const reset=()=>{states=[];cursor=0;effects=[];requests=[];fetchError=undefined};
const render=()=>{cursor=0;effects=[];return AuditLogs()};
const markup=tree=>renderToStaticMarkup(tree);
for(const permissions of [[],['audit.view']]){
  reset();
  const tree=App({user:{fullName:'Fixture',permissions}});
  assert.equal(walk(tree).some(node=>node.type==='a'&&node.props.href==='#audit'),permissions.includes('audit.view'));
  assert.equal(walk(tree).some(node=>node.type===AuditLogs),permissions.includes('audit.view'));
}
const item={id:1,actorId:2,actorEmail:'staff@example.test',action:'staff.update',actionLabel:'Sửa nhân viên',targetType:'staff',targetId:'3',createdAt:'2026-10-16T01:00:00Z',before:{fullName:'Old',permissions:['products.view']},after:{fullName:'New',permissions:['products.view','audit.view']},ip:'127.0.0.1'};
assert.equal(auditDetails(item),'Họ tên: Old → New; Quyền: products.view → products.view, audit.view');
assert.equal(auditDetails({before:null,after:{reason:'disabled'}}),'Lý do: Tài khoản tạm ngưng');
reset();let tree=render();assert.match(markup(tree),/Đang tải nhật ký/);
fetchResult={items:[item],total:26,page:1,pageSize:25};
let cleanup=effects[0]();await new Promise(resolve=>setImmediate(resolve));
assert.deepEqual(requests[0][0],{action:'',actorId:'',page:1});
tree=render();let html=markup(tree);
for(const text of ['Thời gian','Người thực hiện','Hành động','Đối tượng','Chi tiết','IP','staff@example.test','Sửa nhân viên','Old → New','127.0.0.1','Trang 1/2'])assert.ok(html.includes(text),text);
assert.match(html,/badge pending/);
let buttons=walk(tree).filter(node=>node.type==='button');
assert.equal(buttons.find(node=>node.props.children==='Trang trước').props.disabled,true);
buttons.find(node=>node.props.children==='Trang sau').props.onClick();
assert.equal(states[0].page,2);
tree=render();walk(tree).find(node=>node.type==='select').props.onChange({target:{value:'auth.login'}});
assert.deepEqual(states[0],{action:'auth.login',actorId:'',page:1});
tree=render();walk(tree).find(node=>node.type==='input').props.onChange({target:{value:'2'}});
tree=render();walk(tree).find(node=>node.type==='form').props.onSubmit({preventDefault(){}});
assert.equal(states[0].actorId,'2');
cleanup();assert.equal(requests[0][1].aborted,true);
fetchResult={items:[],total:0,page:1,pageSize:25};
tree=render();effects[0]();await new Promise(resolve=>setImmediate(resolve));
assert.match(markup(render()),/Chưa có nhật ký phù hợp/);
fetchError=new Error('Fixture failure');effects[0]();await new Promise(resolve=>setImmediate(resolve));
tree=render();assert.match(markup(tree),/role="alert"/);assert.match(markup(tree),/Fixture failure/);
walk(tree).find(node=>node.type==='button'&&node.props.children==='Thử lại').props.onClick();
assert.equal(states[5],1);

// Verify the API module's actual query construction and safe error envelope.
const apiSource=ts.transpileModule(readFileSync('client/src/api/audit.ts','utf8').replaceAll('export ',''),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
let received;
const api=new Function('fetch',`${apiSource};return {listAuditLogs};`)(async(url,options)=>{received={url,options};return {ok:true,json:async()=>fetchResult}});
await api.listAuditLogs({action:'staff.update',actorId:'2',page:3});
assert.equal(received.url,'/api/audit-logs?page=3&action=staff.update&actorId=2');
assert.equal(received.options.credentials,'include');
const failing=new Function('fetch',`${apiSource};return {listAuditLogs};`)(async()=>({ok:false,json:async()=>({error:{message:'Không có quyền'}})}));
await assert.rejects(failing.listAuditLogs({action:'',actorId:'',page:1}),/Không có quyền/);
console.log('PASS: audit menu/route permission, loading/error/empty/table, before-after text, filters, pagination, abort and API query/error. Local mocks only.');
