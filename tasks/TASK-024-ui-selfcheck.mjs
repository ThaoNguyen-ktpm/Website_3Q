// Local component events and API fixtures only; no browser, Google login or database.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const source = readFileSync('client/src/admin/views/App.jsx', 'utf8');
const teamSource = source.slice(source.indexOf('function Team('), source.indexOf('const auditFields='));
const formSource = source.slice(source.indexOf('function StaffForm('), source.indexOf('function Settings('));
const compile = code => ts.transpileModule(code, { compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 } }).outputText;
let states = [], cursor = 0, effects = [];
const useState = initial => {
  const key = cursor++;
  if (!(key in states)) states[key] = typeof initial === 'function' ? initial() : initial;
  return [states[key], value => { states[key] = typeof value === 'function' ? value(states[key]) : value; }];
};
const reset = () => { states = []; cursor = 0; effects = []; };
const render = (Component, props) => { cursor = 0; effects = []; return Component(props); };
const walk = node => Array.isArray(node) ? node.flatMap(walk) : node?.props ? [node, ...walk(node.props.children)] : [];
const stub = () => null;
const primary = { id: 1, fullName: 'Primary fixture', email: 'primary@example.test', role: 'ADMIN', roleLabel: 'Admin', status: 'ACTIVE', permissions: [], isPrimaryAdmin: true };
const member = { ...primary, id: 2, fullName: 'Member fixture', email: 'member@example.test', isPrimaryAdmin: false };
const Team = new Function('React', 'useState', 'useEffect', 'listStaff', 'listRoles', 'PanelHeading', 'Search', 'Icon', 'Avatar', 'staffAvatar', 'Badge', 'Empty',
  `${compile(teamSource)}; return Team;`)(React, useState, effect => effects.push(effect), async () => ({ staff: [primary, member] }), async () => ({ roles: [], catalog: [] }), stub, stub, stub, stub, stub, stub, stub);
let drawer;
const c = { search: '', can: () => true, setDrawer: value => { drawer = value; } };
for (const isPrimaryAdmin of [false, true]) {
  reset();
  const props = { c, user: { id: 1, isPrimaryAdmin } };
  render(Team, props);
  const cleanup = effects[0]();
  await new Promise(resolve => setImmediate(resolve));
  let tree = render(Team, props);
  assert.match(renderToStaticMarkup(tree), /Admin chính/);
  let buttons = walk(tree).filter(node => node.type === 'button');
  assert.equal(buttons.some(node => node.props['aria-label'] === `Sửa ${primary.fullName}`), isPrimaryAdmin);
  assert.ok(buttons.some(node => node.props['aria-label'] === `Sửa ${member.fullName}`));
  if (isPrimaryAdmin) {
    buttons.find(node => node.props['aria-label'] === `Sửa ${primary.fullName}`).props.onClick();
    drawer.onSaved({ ...primary, fullName: 'Updated fixture' });
    tree = render(Team, props);
    assert.match(renderToStaticMarkup(tree), /Admin chính/);
    assert.ok(walk(tree).some(node => node.props['aria-label'] === 'Sửa Updated fixture'));
  }
  cleanup();
}

const Field = ({ children }) => React.createElement('label', null, children);
const message = 'Không thể thay đổi tài khoản Admin chính.';
const apiSource = readFileSync('client/src/api/staff.ts', 'utf8').replaceAll('export ', '');
const api = new Function('fetch', `${compile(apiSource)}; return {updateStaff};`)(async () => ({ ok: false, status: 403, json: async () => ({ error: { code: 'FORBIDDEN', message } }) }));
const StaffForm = new Function('React', 'useState', 'Field', 'createStaff', 'updateStaff', `${compile(formSource)}; return StaffForm;`)(React, useState, Field, stub, api.updateStaff);
reset();
let closed = false;
const props = { c: { setDrawer: () => { closed = true; }, setToast: stub }, d: { staff: primary, roles: [], catalog: [], user: { id: 2, role: 'ADMIN', permissions: [] }, onSaved: () => assert.fail('403 must not save') } };
await render(StaffForm, props).props.onSubmit({ preventDefault() {} });
const tree = render(StaffForm, props);
assert.ok(walk(tree).some(node => node.props.role === 'alert' && node.props.children === message));
assert.equal(closed, false);
assert.equal(walk(tree).find(node => node.props.type === 'submit').props.disabled, false);
console.log('PASS: primary badge, edit visibility for both actors, badge after saving, API 403 message retained in open drawer. Local fixtures only.');
