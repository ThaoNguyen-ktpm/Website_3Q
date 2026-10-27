import {useEffect,useRef,useState} from 'react';
// Shared helpers for the v2 views. Views that render their own VI/EN text read the language set by LanguageToggle
// (document.documentElement.lang) and mark themselves data-no-translate so the glossary translator skips them.
export type Lang='vi'|'en';
export function useLang():Lang{const [l,setL]=useState<Lang>(()=>document.documentElement.lang==='en'?'en':'vi');
 useEffect(()=>{const o=new MutationObserver(()=>setL(document.documentElement.lang==='en'?'en':'vi'));o.observe(document.documentElement,{attributes:true,attributeFilter:['lang']});return()=>o.disconnect()},[]);return l}
export const money=(v:number)=>new Intl.NumberFormat('vi-VN').format(v)+' ₫';
export const pct=(v:number,lang:Lang)=>new Intl.NumberFormat(lang==='en'?'en-GB':'vi-VN',{minimumFractionDigits:2,maximumFractionDigits:2}).format(v)+'%';
export const compact=(v:number,lang:Lang)=>(v<0?'−':'')+new Intl.NumberFormat(lang==='en'?'en-GB':'vi-VN',{maximumFractionDigits:1}).format(Math.abs(v/1e6))+(lang==='en'?'M':' tr');
export const reduceMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
export const localIso=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; // not toISOString(): UTC shifts the day in UTC+7

/* Toast with optional Undo (5 s window, paused on hover/focus) */
type ToastMsg={text:string;undo?:()=>void;id:number};
let push:(m:ToastMsg|null)=>void=()=>{};
export function showToast(text:string,undo?:()=>void){push({text,undo,id:Date.now()})}
export function Toast({undoLabel}:{undoLabel:string}){
 const [m,setM]=useState<ToastMsg|null>(null);const timer=useRef<number>(0);
 useEffect(()=>{push=x=>{setM(x);clearTimeout(timer.current);timer.current=window.setTimeout(()=>setM(null),5000)};return()=>{push=()=>{}}},[]);
 const hold=()=>clearTimeout(timer.current),release=()=>{timer.current=window.setTimeout(()=>setM(null),2500)};
 return <div className={`toast${m?' is-open':''}`} role="status" aria-live="polite" onMouseEnter={hold} onFocus={hold} onMouseLeave={release}>
  <span data-no-translate>{m?.text}</span>{m?.undo&&<button type="button" id="toast-undo" onClick={()=>{m.undo!();setM(null)}}>{undoLabel}</button>}</div>}

const P:Record<string,string>={overview:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',transactions:'M4 7h16 M16 3l4 4-4 4 M20 17H4 M8 13l-4 4 4 4',inventory:'M3 7l9-4 9 4v10l-9 4-9-4z M3 7l9 4 9-4 M12 11v10',errors:'M12 3L2 21h20z M12 9v5 M12 17v1',costs:'M4 5h16v14H4z M4 9h16 M15 14h2',nc:'M5 3h10l4 4v14H5z M9 11h6 M9 15h6',policy:'M6 3h9l4 4v14H6z M9 9h6 M9 13h6 M9 17h3',home:'M3 11l9-7 9 7v9H3z M9 20v-6h6v6',result:'M4 19h16 M7 15l4-4 3 3 5-6',tasks:'M5 6h14 M5 12h14 M5 18h9'};
export const Icon=({name}:{name:string})=><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={P[name]||P.nc}/></svg>;
export const Chev=()=><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
export const Back=()=><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
export const Close=()=><svg viewBox="0 0 20 20" aria-hidden="true" width="20" height="20"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;
export const SevIcon=({sev}:{sev:string})=>sev==='Ưu tiên'?<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 1.5l4.5 8h-9z" fill="currentColor"/></svg>:sev==='aging'?<svg viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="4.75" fill="none" stroke="currentColor" strokeWidth="1.3"/><path d="M6 3.5V6l1.7 1.2" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>:<svg viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="4" fill="currentColor"/></svg>;
