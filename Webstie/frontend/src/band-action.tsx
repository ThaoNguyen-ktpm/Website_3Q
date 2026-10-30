import {useEffect,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
// Renders a page's main button into OpsBand's #band-actions slot (design v3, Bảo 2026-10-27).
export default function BandAction({children}:{children:ReactNode}){
 const [slot,setSlot]=useState<HTMLElement|null>(null);
 useEffect(()=>setSlot(document.getElementById('band-actions')),[]);
 return slot?createPortal(children,slot):null;
}
