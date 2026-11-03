import {test,expect} from '@playwright/test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import AppHeader from './src/app-header';
import {OpsSide,OpsTabs} from './src/dashboard';
import {V2_OVERVIEW,legacyV2Page,v2FrameUrl,v2MessageRoute} from './src/apps';
import {allowedPage} from './src/access';
import {V2Frame} from './src/v2-frame';

const noop=()=>{};
test('Admin navigation shares all reports, real management and folded unconnected pages',()=>{
 for(const html of [
  renderToStaticMarkup(createElement(AppHeader,{nav:noop,overview:'v2-dashboard',page:'v2-tx',can:()=>true,reports:true,children:null})),
  renderToStaticMarkup(createElement(OpsSide,{page:'v2-tx',nav:noop,warnings:0,manage:[['team','Nhân viên'],['audit','Nhật ký'],['documents','Tài liệu']]})),
  renderToStaticMarkup(createElement(OpsTabs,{page:'v2-tx',nav:noop,manage:[['team','Nhân viên']]})),
 ]){
  for(const label of ['Báo cáo','Quản lý','Chưa kết nối','Hàng hóa &amp; hiệu quả vốn','KPI Sale','Nhân viên','THẬT'])expect(html).toContain(label);
  expect(html).toContain('aria-current="page"');
  expect(html).not.toContain('Tổng quan cũ');
 }
 expect(V2_OVERVIEW).toBe('#page=v2-dashboard');
});
test('Manager and STAFF never gain V2 pages or report navigation',()=>{
 for(const role of ['MANAGER','STAFF']){
  const actor={role,permissions:['staff.view']};
  expect(allowedPage(actor,'v2-dashboard')).toBe(false);
  expect(allowedPage(actor,'v2-kpi')).toBe(false);
  expect(allowedPage(actor,'team')).toBe(true);
  for(const html of [
   renderToStaticMarkup(createElement(AppHeader,{nav:noop,overview:'team',page:'team',can:p=>actor.permissions.includes(p),reports:false,children:null})),
   renderToStaticMarkup(createElement(OpsSide,{page:'team',nav:noop,warnings:0,manage:[['team','Nhân viên']],reports:false})),
   renderToStaticMarkup(createElement(OpsTabs,{page:'team',nav:noop,manage:[['team','Nhân viên']],reports:false})),
  ]){expect(html).not.toContain('#page=v2-');expect(html).not.toContain('Báo cáo');expect(html).toContain('Nhân viên')}
 }
});
test('legacy links map to V2 and embedded links retain record and module state',()=>{
 for(const [old,next] of [['overview','v2-dashboard'],['transactions','v2-tx'],['inventory','v2-inventory'],['errors','v2-checks'],['costs','v2-costs'],['cash','v2-cash']])expect(legacyV2Page(old)).toBe(next);
 expect(v2FrameUrl('v2-tx',new URLSearchParams('page=v2-tx&record=DEMO-S1'))).toBe('/v2/mockup/baoq-mockup-v2.html?embed=1#view=tx&record=DEMO-S1');
 expect(v2FrameUrl('v2-cash',new URLSearchParams())).toBe('/v2/mockup/baoq-mockup-v2.html?embed=1#view=nc&page=cash');
 expect(v2MessageRoute('#view=kpi&k_view=sale&k_sale=Lan')).toBe('#page=v2-kpi&k_view=sale&k_sale=Lan');
 expect(v2MessageRoute('#view=nc&page=cash')).toBe('#page=v2-cash');
 expect(v2MessageRoute('#view=policy&group=commission')).toBe('#page=policy&group=commission');
 for(const hash of ['#view=bogus','#view=nc&page=bogus','https://evil.test/'])expect(v2MessageRoute(hash)).toBeNull();
 const html=renderToStaticMarkup(createElement(V2Frame,{page:'v2-inventory',route:new URLSearchParams(),onRoute:noop}));
 expect(html).toContain('src="/v2/mockup/baoq-mockup-v2.html?embed=1#view=inventory"');
 expect(html).toContain('title="Điều hành V2"');
});
