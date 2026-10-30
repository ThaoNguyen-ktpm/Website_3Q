import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import '@fontsource/playfair-display/400.css';
import '@fontsource/playfair-display/600.css';
import '@fontsource/be-vietnam-pro/400.css';
import '@fontsource/be-vietnam-pro/500.css';
import '@fontsource/be-vietnam-pro/600.css';
import '@fontsource/be-vietnam-pro/700.css';
import './app-v2-base.css';
import './app-v2.css';
import {lazy, Suspense} from 'react';
import {Toast,Close} from './ui';
import Login from './login';
import {getMe,logout,type User} from './auth';
// Bảo 2026-10-27: signed out, only the home page is open and only its code is sent; the workspace (menu, other pages,
// demo data) is a separate chunk loaded after sign-in. Another page or a task asks to sign in first; role rights come later.
const Workspace=lazy(()=>import('./workspace'));
// Published shop details (same as the shop site's footer and contact page).
const MAP='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent('92 Nguyễn Hữu Cảnh, Bình Thạnh, Hồ Chí Minh');
const SOCIAL:[string,string][]=[['Facebook','https://www.facebook.com/baoqluxurybranding/'],['Instagram','https://www.instagram.com/baoq.luxury/'],['TikTok','https://www.tiktok.com/@quocbaong']];
function PublicHome({onLogin}:{onLogin?:()=>void}){
 const [scrolled,setScrolled]=useState(false);
 useEffect(()=>{const f=()=>setScrolled(window.scrollY>8);f();window.addEventListener('scroll',f,{passive:true});return()=>window.removeEventListener('scroll',f)},[]);
 // Bảo 2026-10-27: signed out, the page shows the shop, never internal work; staff sign in from the band or the icon.
 const today=new Date().toLocaleDateString('vi-VN',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'});
 const hello=<section className="band on-dark public-hello"><div className="wrap">
  <p className="public-kicker">Buy · Sell · Consign · <span>{today}</span></p>
  <h1 className="display" tabIndex={-1}>Chào mừng đến BAOQ Luxury</h1>
  {onLogin&&<div className="cta-row"><button className="btn btn-primary-dark" type="button" onClick={onLogin}>Đăng nhập</button></div>}
 </div></section>;
 return <><header className={`site-header on-dark${scrolled?' is-scrolled':''}`}><span/>
  <button className="brand" type="button" onClick={()=>{location.hash='page=portal'}} aria-label="BAOQ Luxury, Trang chủ"><img className="wordmark-img" src="/brand/baoq-wordmark.png" alt="" width="200" height="46"/></button>
  <div className="header-right">{onLogin&&<button className="icon-btn header-login" type="button" aria-label="Đăng nhập" title="Đăng nhập" onClick={onLogin}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" strokeWidth="1.5"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg></button>}</div></header>
  <main id="main">{hello}
   <section className="wrap shop-info" aria-labelledby="shop-h"><h2 id="shop-h" className="vh">Thông tin cửa hàng</h2><div className="shop-grid">
    <div className="shop-card"><span className="shop-label">Showroom</span><p>92 Nguyễn Hữu Cảnh, P. Thạnh Mỹ Tây, Q. Bình Thạnh, HCM</p><small>Shophouse 02, Chung cư Saigon Pearl, Tháp Opal</small><a className="text-link" href={MAP} target="_blank" rel="noopener noreferrer">Xem bản đồ</a></div>
    <div className="shop-card"><span className="shop-label">Hotline</span><p><a href="tel:0928139139">0928 139 139</a></p><small>Zalo: <a href="https://zalo.me/0766428855" target="_blank" rel="noopener noreferrer">0766 428 855</a></small></div>
    <div className="shop-card"><span className="shop-label">Giờ làm việc</span><p>Thứ Hai – Thứ Bảy</p><small>08:00 – 17:30</small></div>
    <div className="shop-card"><span className="shop-label">Website</span><p><a href="https://baoqluxury.com" target="_blank" rel="noopener noreferrer">baoqluxury.com</a></p><small>Email: <a href="mailto:baoqluxury@gmail.com">baoqluxury@gmail.com</a></small>
     <span className="shop-social">{SOCIAL.map(([name,url])=><a key={name} href={url} target="_blank" rel="noopener noreferrer">{name}</a>)}</span></div>
   </div></section></main>
  <Toast undoLabel="Hoàn tác"/></>;
}
function Root(){
 // undefined while checking; a one-time link (?ma=…) opens the popup straight away.
 const [user,setUser]=useState<User|null|undefined>(undefined),[open,setOpen]=useState(()=>new URLSearchParams(location.search).has('ma'));
 const [route,setRoute]=useState(()=>new URLSearchParams(location.hash.slice(1)));
 const dlg=useRef<HTMLDialogElement>(null);
 const sessionCheck=useRef(true);
 const blocked=!user&&((route.get('page')||'portal')!=='portal'||!!route.get('task'));
 useEffect(()=>{let active=true;const h=()=>setRoute(new URLSearchParams(location.hash.slice(1)));window.addEventListener('hashchange',h);getMe().then(d=>{if(active&&sessionCheck.current)setUser(d.user)}).catch(()=>{if(active&&sessionCheck.current)setUser(null)});return()=>{active=false;window.removeEventListener('hashchange',h)}},[]);
 useEffect(()=>{if(blocked&&user===null)setOpen(true)},[blocked,user]);
 useEffect(()=>{if(open)dlg.current?.showModal();else dlg.current?.close()},[open]);
 return <>{user?<Suspense fallback={<p className="login-status" role="status">Đang mở…</p>}><Workspace user={user} onLogout={()=>logout().finally(()=>{sessionStorage.removeItem('baoq-ui-persona');setUser(null)})}/></Suspense>
  :<PublicHome onLogin={user===null?()=>setOpen(true):undefined}/>}
  <dialog className="login-dialog" ref={dlg} aria-label="Đăng nhập" onClose={()=>{setOpen(false);if(!user&&location.hash!=='#page=portal'){history.replaceState(history.state,'','#page=portal');setRoute(new URLSearchParams('page=portal'))}}} onClick={e=>{if(e.target===dlg.current)setOpen(false)}}>
   <button className="icon-btn login-close" type="button" aria-label="Đóng" onClick={()=>setOpen(false)}><Close/></button>
   {open&&<Login onLogin={u=>{sessionCheck.current=false;setUser(u);setOpen(false)}}/>}
  </dialog></>;
}
createRoot(document.getElementById('root')!).render(<Root/>);
