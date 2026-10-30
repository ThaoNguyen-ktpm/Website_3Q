import {useEffect,useRef,type ReactNode} from 'react';
import {Close} from './ui';
// Right-hand panel for details and forms: a native modal dialog (focus trap, Escape), opened on mount.
export default function Sheet({title,sub,onClose,children}:{title:string;sub?:string;onClose:()=>void;children:ReactNode}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{ref.current?.showModal()},[]);
 return <dialog className="side-sheet" ref={ref} aria-label={title} onCancel={e=>{e.preventDefault();onClose()}} onClick={e=>{if(e.target===ref.current)onClose()}}>
  <div className="sheet-head"><p>{sub}</p><button className="icon-btn" type="button" aria-label="Đóng" onClick={onClose}><Close/></button></div>
  <div className="sheet-body"><h2>{title}</h2>{children}</div>
 </dialog>;
}
