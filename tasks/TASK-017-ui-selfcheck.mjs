// Node 24, installed dependencies only. Component events with mocked hooks/API; no browser/session/DB.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const source = readFileSync('client/src/admin/views/App.jsx', 'utf8');
const formSource = source.slice(source.indexOf('function StaffForm('), source.indexOf('function Settings('));
const compiled = ts.transpileModule(formSource, { compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 } }).outputText;
const catalog = ['products.view', 'staff.view', 'staff.manage'].map(key => ({ key, label: key }));
const roles = [
 { role: 'ADMIN', permissions: catalog },
 { role: 'MANAGER', permissions: catalog.slice(0, 2) },
 { role: 'STAFF', permissions: catalog.slice(0, 1) },
];
let state, cursor, sent;
const useState = initial => {
 const index = cursor++;
 if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial;
 return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
};
const Field = ({children}) => React.createElement('label', null, children);
const save = async (...args) => { sent = args; return {staff:{id:2}}; };
const StaffForm = new Function('React','useState','Field','createStaff','updateStaff', `${compiled}; return StaffForm;`)(React,useState,Field,save,save);
const c = {setDrawer(){},setToast(){}};
const admin = {id:1,role:'ADMIN',permissions:catalog.map(p=>p.key)};
const member = {id:2,role:'STAFF',permissions:['staff.view'],fullName:'Fixture',email:'fixture@example.test',status:'ACTIVE'};
const walk = node => Array.isArray(node) ? node.flatMap(walk) : node && typeof node==='object' && node.props ? [node,...walk(node.props.children)] : [];
const render = d => { cursor=0; return StaffForm({c,d}); };
const boxes = tree => walk(tree).filter(n=>n.type==='input' && n.props.type==='checkbox');
const d = {roles,catalog,user:admin,staff:member,onSaved(){}};
state=[];
let tree=render(d);
assert.deepEqual(boxes(tree).map(n=>n.props.checked),[false,true,false]);
boxes(tree)[0].props.onChange({target:{checked:true}});
tree=render(d);
await tree.props.onSubmit({preventDefault(){}});
assert.deepEqual(sent[1].permissions,['staff.view','products.view']);
state=[];tree=render({...d,staff:null});
assert.deepEqual(boxes(tree).map(n=>n.props.checked),[true,false,false]);
walk(tree).find(n=>n.type==='select').props.onChange({target:{value:'MANAGER'}});
tree=render({...d,staff:null});assert.deepEqual(boxes(tree).map(n=>n.props.checked),[true,true,false]);
boxes(tree)[0].props.onChange({target:{checked:false}});
tree=render({...d,staff:null});
walk(tree).find(n=>n.type==='button' && n.props.children==='Dùng quyền mặc định của vai trò').props.onClick();
tree=render({...d,staff:null});assert.deepEqual(boxes(tree).map(n=>n.props.checked),[true,true,false]);
state=[];tree=render({...d,staff:{...member,role:'ADMIN'}});
assert(boxes(tree).every(n=>n.props.checked && n.props.disabled));
assert(renderToStaticMarkup(tree).includes('Admin luôn có toàn quyền'));
state=[];tree=render({...d,user:{...admin,id:2}});
assert(boxes(tree).every(n=>n.props.disabled));
await tree.props.onSubmit({preventDefault(){}});assert(!('permissions' in sent[1]));
state=[];tree=render({...d,user:{id:3,role:'MANAGER',permissions:['staff.manage']}});
assert.deepEqual(boxes(tree).map(n=>!!n.props.disabled),[true,true,false]);
assert(source.includes('Tùy chỉnh'));
assert(!source.includes('RolePermissions') && !source.includes('Phân quyền theo vai trò'));
console.log('TASK-017 UI selfcheck PASS: effective/default checkboxes, toggle/save, role reset, default button, Admin/self/actor locks, own profile payload, labels and panel removal.');
