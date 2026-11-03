import React, {lazy, Suspense, useEffect, useRef, useState} from 'react';
import Tasks from './tasks';
import AppHeader from './app-header';
import HomeView from './home';
import PolicyView from './policy';
import {OpsBand,OpsSide,OpsTabs} from './dashboard';
import {Toast} from './ui';
import type {User} from './auth';
import {PRICE,MANAGE,V2_OVERVIEW,v2Label,legacyV2Page,type AppPage} from './apps';
import {SaleAi,CatalogSearch} from './price-system';
import {Team,AuditLogs,initials} from './staff';
import {Icon} from './ui';
import Assistant from './assistant';
import {allowedPage as mayOpen} from './access';
import {readRecent} from './recent';
import {V2Frame} from './v2-frame';
// Loaded only after sign-in (see main.tsx).
const Documents=lazy(()=>import('./documents'));
const pageOf=(page:string)=>[...PRICE,...MANAGE].find(([k])=>k===page);
// Price System has no Điều hành sidebar of its own: same aside + mobile tabs, its own pages only.
function AppSide({title,items,page}:{title:string;items:AppPage[];page:string}){
 return <aside className="ops-side" aria-label={`Điều hướng ${title}`}><nav aria-label={`Trong ${title}`}><h2>{title}</h2><ul>{items.map(([k,l])=><li key={k}><a className="side-link" href={`#page=${k}`} aria-current={page===k?'page':undefined}><Icon name={k}/><span>{l}</span><span className="live">THẬT</span></a></li>)}
  <li><a className="side-link" href="#page=portal"><Icon name="home"/><span>← Trang chủ</span></a></li></ul></nav></aside>;
}
function AppTabs({title,items,page}:{title:string;items:AppPage[];page:string}){
 return <nav className="ops-tabs" aria-label={`Tab ${title}`}><div className="tabs-row"><ul>{items.map(([k,l])=><li key={k}><a href={`#page=${k}`} aria-current={page===k?'page':undefined}>{l}</a></li>)}</ul></div></nav>;
}
// Name + Đăng xuất folded into one account button (design v3).
function Account({user,onLogout}:{user:User;onLogout:()=>void}){
 const ref=useRef<HTMLDetailsElement>(null);
 useEffect(()=>{const close=(e:MouseEvent)=>{if(ref.current?.open&&!ref.current.contains(e.target as Node))ref.current.open=false};document.addEventListener('click',close);return()=>document.removeEventListener('click',close)},[]);
 return <details className="acct" ref={ref}><summary aria-label={`Tài khoản ${user.fullName}`}><span className="acct-av" aria-hidden="true">{initials(user.fullName)}</span><span className="acct-name">{user.fullName}</span><svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg></summary>
  <div className="acct-menu"><strong>{user.fullName}</strong><small>{user.email}</small><small>{user.roleLabel}</small><button type="button" className="btn btn-secondary btn-sm" onClick={onLogout}>Đăng xuất</button></div></details>;
}
// "Mở gần đây" on the home page: the last pages opened in this browser (labels only, no data).
const NoAccess=()=><section className="card empty-card"><h2>Bạn chưa có quyền xem mục này</h2><p>Nhờ quản lý cấp quyền trong Điều hành → Nhân viên.</p></section>;
export default function App({user,onLogout}:{user:User;onLogout:()=>void}){
 const [route,setRoute]=useState(new URLSearchParams(location.hash.slice(1)));
 const page=legacyV2Page(route.get('page')||'portal');
 // replace=true rewrites the current history entry (filters, closing deep-linked sheets) instead of adding one
 function go(next:Record<string,string>,replace=false){const p=new URLSearchParams(location.hash.slice(1));for(const [k,v] of Object.entries(next)){v?p.set(k,v):p.delete(k)}
  if(replace){history.replaceState(history.state,'','#'+p.toString());setRoute(p)}else location.hash=p.toString();}
 function nav(target:string){const next=new URLSearchParams({page:legacyV2Page(target)});location.hash=next.toString();window.scrollTo(0,0)}
 const can=(permission:string)=>user.permissions.includes(permission);
 const pageLabel=pageOf(page)?.[1]||v2Label(page)||(page==='tasks'?'Công việc':page==='policy'?'Chính sách':'');
 useEffect(()=>{if(page==='portal'||!pageLabel)return;try{localStorage.setItem('baoq-recent',JSON.stringify([{page,label:pageLabel,at:new Date().toISOString()},...readRecent().filter(r=>r.page!==page)].slice(0,4)))}catch{}},[page,pageLabel]);
 // Bảo 2026-10-27 (A): only Admin opens the demo reports; Điều hành starts at the first page this person may open.
 const admin=user.role==='ADMIN';
 const allowedPage=(target:string)=>mayOpen(user,target);
 const allowed=(list:AppPage[])=>list.filter(([,,permission])=>can(permission)).map(([k,l]):[string,string]=>[k,l]);
 const real=pageOf(page);
 const realContent=page==='sale'?<SaleAi/>:page==='search'?<CatalogSearch/>:page==='team'?<Team user={user}/>:page==='audit'?<AuditLogs/>:page==='documents'?<Suspense fallback={<p role="status">Đang mở tài liệu…</p>}><Documents canManage={can('documents.manage')}/></Suspense>:null;
 const overview=admin?'v2-dashboard':MANAGE.find(([,,p])=>can(p))?.[0]||'portal';
 useEffect(()=>{const h=()=>setRoute(new URLSearchParams(location.hash.slice(1)));window.addEventListener('hashchange',h);return()=>window.removeEventListener('hashchange',h)},[]);
 useEffect(()=>{const old=route.get('page');if(old&&legacyV2Page(old)!==old)go({page:legacyV2Page(old)},true)},[route]);
 const crumbs=page==='tasks'?<span aria-current="page">Công việc</span>:<><a href={`#page=${overview}`}>Điều hành</a><span aria-hidden="true">/</span><span aria-current="page">{pageLabel}</span></>;
 const header=<AppHeader nav={nav} overview={overview} page={page} can={can} reports={admin}><Account user={user} onLogout={onLogout}/></AppHeader>;
 let body:React.ReactNode;
 if(!allowedPage(page))body=<NoAccess/>;
 else if(real&&PRICE.includes(real)){
  // "Price System" only for people with more than one of its pages; staff with Tìm kiếm alone just see Tìm kiếm.
  const mine=PRICE.filter(([,,p])=>can(p)),group=mine.length>1?'Price System':real[1];
  body=<><OpsBand title={real[1]} crumbs={mine.length>1?<><a href={`#page=${mine[0][0]}`}>Price System</a><span aria-hidden="true">/</span><span aria-current="page">{real[1]}</span></>:<span aria-current="page">{real[1]}</span>}/>
  <AppTabs title={group} items={mine} page={page}/>
  <div className="ops-layout"><AppSide title={group} items={mine} page={page}/><div className="ops-main">{can(real[2])?realContent:<NoAccess/>}</div></div></>;
 }
 else if(real)body=<><OpsBand title={real[1]} crumbs={<><a href={`#page=${overview}`}>Điều hành</a><span aria-hidden="true">/</span><span aria-current="page">{real[1]}</span></>}/>
  <OpsTabs page={page} nav={nav} manage={allowed(MANAGE)} reports={admin}/>
  <div className="ops-layout"><OpsSide page={page} nav={nav} warnings={0} manage={allowed(MANAGE)} reports={admin}/><div className="ops-main">{can(real[2])?realContent:<NoAccess/>}</div></div></>;
 else if(page==='portal'){
  const price=PRICE.filter(([,,p])=>can(p)),manage=MANAGE.filter(([,,p])=>can(p));
  const tiles:{href?:string;icon:string;title:string;text:string;tag:string;real?:boolean}[]=[
   ...(price.length>1?[{href:`#page=${price[0][0]}`,icon:'sale',title:'Price System',text:'Sale AI và tra cứu sản phẩm Kiot + Sapo.',tag:'Dữ liệu thật',real:true}]
    :price.length===1?[{href:`#page=${price[0][0]}`,icon:price[0][0],title:price[0][1],text:price[0][0]==='search'?'Tra cứu sản phẩm Kiot + Sapo.':'Tính và cập nhật giá sale Kiot + Sapo.',tag:'Dữ liệu thật',real:true}]:[]),
   ...(admin||manage.length?[{href:admin?V2_OVERVIEW:`#page=${overview}`,icon:'overview',title:'Điều hành',text:admin?'Tổng quan V2, KPI Sale và Hàng hóa/Kho.':manage.map(([,l])=>l).join(', ')+'.',tag:admin?'KPI: dữ liệu thật · Tổng quan/Kho: demo':`${manage.map(([,l])=>l).join(', ')}: dữ liệu thật`,real:admin||manage.length>0}]:[]),
   {href:'#page=tasks&taskView=list',icon:'tasks',title:'Công việc',text:'Giao việc, checklist và hạn hoàn thành.',tag:'Mở danh sách'},
   {icon:'nc',title:'Studio · Marketing',text:'Ảnh, nội dung và kênh bán.',tag:'Sắp có'}];
  const recent=readRecent().filter(r=>allowedPage(r.page)).slice(0,3),when=(at:string)=>{const d=new Date(at);return `${d.toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})} · ${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`};
  const hello=<><section className="band on-dark hello"><div className="wrap"><p className="hello-date">{new Date().toLocaleDateString('vi-VN',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'})}</p><h1 className="display" tabIndex={-1}>Chào {user.fullName.trim().split(/\s+/).at(-1)}, hôm nay mở gì?</h1></div></section>
   <div className="wrap app-tiles">{tiles.map(tile=>{const inner=<><span className="tile-ico"><Icon name={tile.icon}/></span><strong>{tile.title}</strong><span className="tile-text">{tile.text}</span><span className={`tile-tag${tile.real?' is-real':''}`}>{tile.tag}</span></>;
    return tile.href?<a key={tile.title} className="app-tile" href={tile.href}>{inner}</a>:<div key={tile.title} className="app-tile is-soon" aria-disabled="true">{inner}</div>})}</div></>;
  const aside=<aside className="side" aria-labelledby="recent-h"><h2 id="recent-h">Mở gần đây</h2>{recent.length?<ul>{recent.map(r=><li key={r.page}><a href={`#page=${r.page}`}><strong>{r.label}</strong><span>{when(r.at)}</span></a></li>)}</ul>:<p className="ws-muted">Chưa mở trang nào.</p>}</aside>;
  body=<HomeView route={route} go={go} overview={overview} hello={hello} aside={aside}/>;
 }
 else if(page==='policy')body=<PolicyView group={route.get('group')||''} go={go}/>;
 else if(page==='tasks')body=<><OpsBand title="Công việc" crumbs={crumbs}/>
  <div className="ops-layout"><aside className="ops-side tasks-side" aria-label="Điều hướng Công việc"><nav aria-label="Trong Công việc"><h2>Công việc</h2><ul>
   <li><button type="button" className="side-link side-btn" aria-current={route.get('taskView')!=='notifications'?'page':undefined} onClick={()=>go({task:'',taskView:'list'})}><span>Danh sách công việc</span></button></li>
   <li><button type="button" className="side-link side-btn" aria-current={route.get('taskView')==='notifications'?'page':undefined} onClick={()=>go({task:'',taskView:'notifications'})}><span>Thông báo Telegram</span></button></li>
   <li><button type="button" className="side-link side-btn" onClick={()=>nav('portal')}><span>← Trang chủ</span></button></li></ul></nav></aside>
   <div className="ops-main legacy"><Tasks route={route} go={go}/></div></div></>;
 else if(v2Label(page))body=<><OpsBand title={pageLabel} crumbs={crumbs}/>
  <OpsTabs page={page} nav={nav} manage={allowed(MANAGE)} reports={admin}/>
  <div className="ops-layout"><OpsSide page={page} nav={nav} warnings={0} manage={allowed(MANAGE)} reports={admin}/>
   <div className="ops-main"><V2Frame page={page} route={route} onRoute={hash=>{location.hash=hash}}/></div></div></>;
 else body=<NoAccess/>;
 return <>{header}<main id="main">{body}</main>
  <Assistant page={page} telegram={user.role==='ADMIN'}/>
  <Toast undoLabel="Hoàn tác"/></>;
}
