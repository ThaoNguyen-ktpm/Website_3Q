import {useEffect,useRef,useState,type ReactNode} from 'react';
import {Close} from './ui';
// Header v2: espresso bar (56px) with the original logo centred (CSS crop of the JPEG, no raster change) and a two-level
// navigation drawer built on a native modal <dialog> (focus trap, Escape, inert page). Contract kept for tests and
// developers: .apps-trigger opens the menu, #apps-menu holds the top-level buttons, "Điều hành" goes to the overview.
const OPS:[string,string][]=[['overview','Tổng quan điều hành'],['transactions','Thu–bán'],['inventory','Hàng tồn kho'],['errors','Kiểm tra'],['costs','Chi phí']];
const NC:[string,string][]=[['reconcile','Tổng quan đối soát'],['consignment','Ký gửi'],['cash','Tiền & đối chiếu'],['close','Chốt kỳ & điều chỉnh'],['settings','Thiết lập & nguồn']];
const LOGO='/brand/baoq-logo-original.jpg';
export default function AppHeader({children,nav,overview,page}:{children:ReactNode;nav:(page:string)=>void;overview:string;page:string}){
 const dlg=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null),opener=useRef<HTMLButtonElement>(null),back=useRef<HTMLButtonElement>(null);
 const [open,setOpen]=useState(false),[level,setLevel]=useState(1),[scrolled,setScrolled]=useState(false);
 useEffect(()=>{const f=()=>setScrolled(window.scrollY>8);f();window.addEventListener('scroll',f,{passive:true});return()=>window.removeEventListener('scroll',f)},[]);
 const show=()=>{setLevel(1);dlg.current?.showModal();setOpen(true);requestAnimationFrame(()=>(dlg.current?.querySelector('#apps-menu [aria-current="page"]') as HTMLElement|null)?.focus())};
 const hide=()=>dlg.current?.close();
 const go=(target:string)=>{hide();nav(target)};
 const toLevel=(n:number)=>{setLevel(n);requestAnimationFrame(()=>(n===2?back.current:opener.current)?.focus())};
 const opsPage=[...OPS,...NC].some(([k])=>k===page);
 const item=(key:string,label:string,current:boolean,sub=false,small?:string)=><li className={`nav-item${sub?' nav-sub':''}`} key={key}><button type="button" className="nav-link" aria-current={current?'page':undefined} onClick={()=>go(key)}>{label}</button>{small&&<small>{small}</small>}</li>;
 return <><header className={`site-header on-dark${scrolled?' is-scrolled':''}`}>
  <button className="menu-btn apps-trigger" ref={trigger} type="button" aria-haspopup="dialog" aria-expanded={open} aria-controls="apps-menu-dialog" onClick={show}>
   <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M2 5h16M2 10h16M2 15h10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg><span className="menu-label">Menu</span></button>
  <button className="brand" type="button" onClick={()=>nav('portal')} aria-label="BAOQ Luxury, Trang chủ"><span className="wordmark"><img src={LOGO} alt=""/></span></button>
  <div className="header-right">{children}</div></header>
  <dialog className="nav-drawer on-dark" ref={dlg} id="apps-menu-dialog" aria-label="Menu" onClose={()=>{setOpen(false);setLevel(1)}} onClick={e=>{if(e.target===dlg.current)hide()}} onCancel={e=>{if(level===2){e.preventDefault();toLevel(1)}}}>
   <div className="drawer-top"><span style={{fontSize:14,color:'var(--on-dark-muted)'}}>Điều hướng</span><button className="icon-btn" type="button" aria-label="Đóng menu" onClick={hide}><Close/></button></div>
   <div className="levels">
    <div className="level" data-state={level===1?'current':'behind'} aria-hidden={level!==1} inert={level!==1}>
     <span className="drawer-logo"><img src={LOGO} alt="BAOQ Luxury"/></span>
     <nav id="apps-menu" aria-label="Điều hướng ứng dụng">
      <div className="nav-group"><h2>Làm việc</h2><ul>{item('portal','Trang chủ',page==='portal')}{item('tasks','Công việc',page==='tasks')}</ul></div>
      <div className="nav-group"><h2>Quản trị</h2><ul>
       <li className="nav-item"><button type="button" className="nav-link" aria-current={opsPage?'page':undefined} onClick={()=>go(overview)}>Điều hành</button>
        <button className="icon-btn" ref={opener} type="button" aria-label="Mở mục con của Điều hành" aria-expanded={level===2} onClick={()=>toLevel(2)}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M8 4l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg></button></li>
       {item('policy','Chính sách',page==='policy')}</ul></div>
      <div className="nav-group"><h2>Sắp có</h2><ul className="soon">{['Price System','Studio','Marketing'].map(n=><li key={n}><span translate="no">{n}</span><span>Chưa triển khai</span></li>)}</ul></div>
     </nav></div>
    <div className="level" data-state={level===2?'current':'ahead'} aria-hidden={level!==2} inert={level!==2}>
     <button className="back-btn" ref={back} type="button" onClick={()=>toLevel(1)}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M12 4l-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg><span>Menu chính</span></button>
     <h2 className="level-title">Điều hành</h2>
     <nav aria-label="Mục con Điều hành"><div className="nav-group"><ul>{OPS.map(([k,l])=>item(k,l,page===k,true))}</ul></div>
      <div className="nav-group"><h2>Chưa kết nối nguồn</h2><ul>{NC.map(([k,l])=>item(k,l,page===k,true,'Chưa kết nối'))}</ul></div></nav></div>
   </div>
   <p className="drawer-foot">Vai trò chỉ mô phỏng giao diện, không phải bảo mật. Dữ liệu là bản demo tổng hợp.</p>
  </dialog></>;
}
