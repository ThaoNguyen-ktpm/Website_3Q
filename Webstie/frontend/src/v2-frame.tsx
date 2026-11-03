import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {v2FrameUrl,v2MessageRoute} from './apps';

export function V2Frame({page,route,onRoute}:{page:string;route:URLSearchParams;onRoute:(hash:string)=>void}){
 const frame=useRef<HTMLIFrameElement>(null);
 const [height,setHeight]=useState(900),[overlay,setOverlay]=useState(false);
 const routeCallback=useRef(onRoute);routeCallback.current=onRoute;
 const src=v2FrameUrl(page,route),initialSrc=useRef(src);
 const syncRoute=()=>frame.current?.contentWindow?.postMessage({type:'baoq-v2-route',hash:new URL(src,location.origin).hash},location.origin);
 // Hash changes inside the frame use replaceState; the web owns the browser history.
 useEffect(syncRoute,[src]);
 useEffect(()=>{
  let restore:(()=>void)|undefined;
  const toggleOverlay=(open:boolean)=>{
   const el=frame.current;if(!el)return;
   if(open){
    if(restore)return;
    const rect=el.getBoundingClientRect(),x=scrollX,y=scrollY;
    const bodyStyle=document.body.getAttribute('style'),rootStyle=document.documentElement.getAttribute('style');
    const changed:HTMLElement[]=[];
    // Inert only siblings along the iframe's ancestry, never its containing branch.
    for(let node:HTMLElement=el;node.parentElement;node=node.parentElement){
     for(const sibling of Array.from(node.parentElement.children)){
      if(sibling!==node&&sibling instanceof HTMLElement&&!sibling.inert){sibling.inert=true;changed.push(sibling)}
     }
     if(node.parentElement===document.body)break;
    }
    const gap=innerWidth-document.documentElement.clientWidth;
    const padding=parseFloat(getComputedStyle(document.body).paddingRight);
    Object.assign(document.body.style,{position:'fixed',top:`${-y}px`,left:`${-x}px`,right:'0',paddingRight:`${padding+gap}px`});
    document.documentElement.style.overflow='hidden';
    setOverlay(true);
    el.contentWindow?.postMessage({type:'baoq-v2-overlay-layout',rect:{top:rect.top,left:rect.left,width:rect.width}},location.origin);
    restore=()=>{
     changed.forEach(node=>node.inert=false);
     if(bodyStyle===null)document.body.removeAttribute('style');else document.body.setAttribute('style',bodyStyle);
     if(rootStyle===null)document.documentElement.removeAttribute('style');else document.documentElement.setAttribute('style',rootStyle);
     window.scrollTo({left:x,top:y,behavior:'instant'});
    };
   }else if(restore){restore();restore=undefined;setOverlay(false)}
  };
  const receive=(event:MessageEvent)=>{
   if(event.origin!==location.origin||event.source!==frame.current?.contentWindow)return;
   const data=event.data;
   if(data?.type==='baoq-v2-height'&&typeof data.height==='number'&&Number.isFinite(data.height)&&data.height>=400&&data.height<=200000){
    setHeight(Math.ceil(data.height));
   }else if(data?.type==='baoq-v2-overlay'&&typeof data.open==='boolean'){
    toggleOverlay(data.open);
   }else if(data?.type==='baoq-v2-ready'){
    // A restored child history entry must never navigate the authoritative parent.
    elSync();
   }else if(data?.type==='baoq-v2-view'){
    const next=v2MessageRoute(data.hash);
    if(next&&next!==location.hash)routeCallback.current(next);
   }
  };
  const elSync=()=>{
   const route=new URLSearchParams(location.hash.slice(1));
   const url=v2FrameUrl(route.get('page')||'v2-dashboard',route);
   frame.current?.contentWindow?.postMessage({type:'baoq-v2-route',hash:new URL(url,location.origin).hash},location.origin);
  };
  window.addEventListener('message',receive);
  return()=>{window.removeEventListener('message',receive);restore?.()};
 },[]);
 return <div className="ws-v2-slot" style={{height}}>
  {overlay&&createPortal(<div className="ws-v2-backdrop" aria-hidden="true"/>,document.body)}
  <iframe ref={frame} className={`ws-frame ws-v2-frame${overlay?' is-overlay':''}`} style={overlay?undefined:{height}} title="Điều hành V2" src={initialSrc.current} onLoad={syncRoute}/>
 </div>;
}
