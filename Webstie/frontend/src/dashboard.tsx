import {type ReactNode} from 'react';
import {Icon,Back} from './ui';
import {V2_REPORTS,V2_PENDING} from './apps';
// Điều hành v2. Shell parts (band, sidebar, tabs) render Vietnamese and are translated by the existing glossary.
export function OpsBand({title,crumbs,actions,overviewTarget}:{title:string;crumbs:ReactNode;actions?:ReactNode;overviewTarget?:string}){
 return <section className="band slim on-dark"><div className="wrap-wide"><div className="slim-top"><nav className="crumbs" aria-label="Đường dẫn"><a href="#page=portal">Trang chủ</a><span aria-hidden="true">/</span>{crumbs}</nav></div>
  <div className="slim-main"><h1 className="display slim-title" tabIndex={-1}>{title}</h1><div className="slim-actions" id="band-actions">{overviewTarget&&<a className="ghost-btn" href={`#page=${overviewTarget}`}><Back/>Quay lại tổng quan</a>}{actions}</div></div></div></section>}
// manage: the real Nhân viên / Nhật ký pages this person may open (Bảo 2026-10-27).
// reports=false (not Admin): the demo reports and the unconnected pages are not listed (Bảo 2026-10-27).
export function OpsSide({page,nav,manage=[],reports=true}:{page:string;nav:(p:string)=>void;warnings:number;manage?:[string,string][];reports?:boolean}){
 const item=(k:string,label:ReactNode,live=false)=><li key={k}><a className="side-link" href={`#page=${k}`} aria-current={page===k?'page':undefined} onClick={e=>{e.preventDefault();nav(k)}}><Icon name={live?k:'overview'}/><span>{label}</span>{live&&<span className="live">THẬT</span>}</a></li>;
 return <aside className="ops-side" aria-label="Điều hướng Điều hành"><nav aria-label="Trong Điều hành">
  {reports&&<><h2>Báo cáo</h2><ul>{V2_REPORTS.map(([k,l])=>item(k,l))}</ul></>}
  {manage.length>0&&<><h2>Quản lý</h2><ul>{manage.map(([k,l])=>item(k,l,true))}</ul></>}
  {reports&&<details className="side-fold" open={V2_PENDING.some(([k])=>k===page)}><summary>Chưa kết nối nguồn ({V2_PENDING.length})</summary><ul>{V2_PENDING.map(([k,l])=>item(k,l))}</ul></details>}
  <h2>Khác</h2><ul>{item('policy','Chính sách')}{item('portal','← Trang chủ')}</ul></nav></aside>;
}
export function OpsTabs({page,nav,manage=[],reports=true}:{page:string;nav:(p:string)=>void;manage?:[string,string][];reports?:boolean}){
 const item=(k:string,l:string,live=false)=><li key={k}><a href={`#page=${k}`} onClick={e=>{e.preventDefault();nav(k)}} aria-current={page===k?'page':undefined}>{l}{live&&<small>THẬT</small>}</a></li>;
 return <nav className="ops-tabs ops-v2-tabs" aria-label="Tab Điều hành"><div className="tabs-row">
  {reports&&<div><span className="ops-tabs-group">Báo cáo</span><ul>{V2_REPORTS.map(([k,l])=>item(k,l))}</ul></div>}
  {manage.length>0&&<div><span className="ops-tabs-group">Quản lý</span><ul>{manage.map(([k,l])=>item(k,l,true))}</ul></div>}
  {reports&&<details open={V2_PENDING.some(([k])=>k===page)}><summary>Chưa kết nối nguồn ({V2_PENDING.length})</summary><ul>{V2_PENDING.map(([k,l])=>item(k,l))}</ul></details>}
  <details><summary>Khác</summary><ul>{item('policy','Chính sách')}{item('portal','← Trang chủ')}</ul></details>
 </div></nav>;
}
