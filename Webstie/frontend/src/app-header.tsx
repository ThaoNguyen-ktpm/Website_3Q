import {useEffect,useRef,useState,type ReactNode} from 'react';
import {Close} from './ui';
import {PRICE,MANAGE} from './apps';
// Header v2: espresso bar (56px) with the original logo centred (CSS crop of the JPEG, no raster change) and a two-level
// navigation drawer built on a native modal <dialog> (focus trap, Escape, inert page). Contract kept for tests and
// developers: .apps-trigger opens the menu, #apps-menu holds the top-level buttons, "Điều hành" goes to the overview.
const OPS:[string,string][]=[['overview','Tổng quan điều hành'],['transactions','Thu–bán'],['inventory','Hàng tồn kho'],['errors','Kiểm tra'],['costs','Chi phí']];
const NC:[string,string][]=[['reconcile','Tổng quan đối soát'],['consignment','Ký gửi'],['cash','Tiền & đối chiếu'],['close','Chốt kỳ & điều chỉnh'],['settings','Thiết lập & nguồn']];
// can: the signed-in person's permissions; Price System and Quản lý list only the pages they may open (Bảo 2026-10-27).
// reports: Admin sees the demo reports (Bảo 2026-10-27); Điều hành is listed only when one of its pages is open to this person.
export default function AppHeader({children,nav,overview,page,can,reports}:{children:ReactNode;nav:(page:string)=>void;overview:string;page:string;can:(permission:string)=>boolean;reports:boolean}){
 const dlg=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null),back=useRef<HTMLButtonElement>(null);
 const [open,setOpen]=useState(false),[level,setLevel]=useState(1),[sub,setSub]=useState<'ops'|'price'>('ops'),[scrolled,setScrolled]=useState(false);
 useEffect(()=>{const f=()=>setScrolled(window.scrollY>8);f();window.addEventListener('scroll',f,{passive:true});return()=>window.removeEventListener('scroll',f)},[]);
 const show=()=>{setLevel(1);dlg.current?.showModal();setOpen(true);requestAnimationFrame(()=>(dlg.current?.querySelector('#apps-menu [aria-current="page"]') as HTMLElement|null)?.focus())};
 const hide=()=>dlg.current?.close();
 const go=(target:string)=>{hide();nav(target)};
 const toLevel=(n:number,next=sub)=>{setSub(next);setLevel(n);requestAnimationFrame(()=>(n===2?back.current:dlg.current?.querySelector<HTMLElement>(`[data-sub="${next}"]`))?.focus())};
 const price=PRICE.filter(([,,p])=>can(p)),manage=MANAGE.filter(([,,p])=>can(p));
 const pricePage=PRICE.some(([k])=>k===page);
 const opsPage=[...OPS,...NC,...MANAGE].some(([k])=>k===page);
 const opener=(key:'ops'|'price',label:string)=><button className="icon-btn" data-sub={key} type="button" aria-label={`Mở mục con của ${label}`} aria-expanded={level===2&&sub===key} onClick={()=>toLevel(2,key)}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M8 4l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg></button>;
 const item=(key:string,label:string,current:boolean,sub=false,small?:string)=><li className={`nav-item${sub?' nav-sub':''}`} key={key}><button type="button" className="nav-link" aria-current={current?'page':undefined} onClick={()=>go(key)}>{label}</button>{small&&<small>{small}</small>}</li>;
 return <><header className={`site-header on-dark${scrolled?' is-scrolled':''}`}>
  <button className="menu-btn apps-trigger" ref={trigger} type="button" aria-haspopup="dialog" aria-expanded={open} aria-controls="apps-menu-dialog" onClick={show}>
   <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M2 5h16M2 10h16M2 15h10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg><span className="menu-label">Menu</span></button>
  <button className="brand" type="button" onClick={()=>nav('portal')} aria-label="BAOQ Luxury, Trang chủ"><img className="wordmark-img" src="/brand/baoq-wordmark.png" alt="" width="200" height="46"/></button>
  <div className="header-right">{children}</div></header>
  <dialog className="nav-drawer on-dark" ref={dlg} id="apps-menu-dialog" aria-label="Menu" onClose={()=>{setOpen(false);setLevel(1)}} onClick={e=>{if(e.target===dlg.current)hide()}} onCancel={e=>{if(level===2){e.preventDefault();toLevel(1)}}}>
   <div className="drawer-top"><span style={{fontSize:14,color:'var(--on-dark-muted)'}}>Điều hướng</span><button className="icon-btn" type="button" aria-label="Đóng menu" onClick={hide}><Close/></button></div>
   <div className="levels">
    <div className="level" data-state={level===1?'current':'behind'} aria-hidden={level!==1} inert={level!==1}>
     <nav id="apps-menu" aria-label="Điều hướng ứng dụng">
      <div className="nav-group"><h2>Làm việc</h2><ul>{item('portal','Trang chủ',page==='portal')}{item('tasks','Công việc',page==='tasks')}</ul></div>
      <div className="nav-group"><h2>Quản trị</h2><ul>
       {(reports||manage.length>0)&&<li className="nav-item"><button type="button" className="nav-link" aria-current={opsPage?'page':undefined} onClick={()=>go(overview)}>Điều hành</button>
        {opener('ops','Điều hành')}</li>}
       {/* Only one Price System page open to this person (staff: Tìm kiếm): list that page by its own name. */}
       {price.length>1&&<li className="nav-item"><button type="button" className="nav-link" aria-current={pricePage?'page':undefined} onClick={()=>go(price[0][0])}>Price System</button>{opener('price','Price System')}</li>}
       {price.length===1&&item(price[0][0],price[0][1],page===price[0][0])}
       {item('policy','Chính sách',page==='policy')}</ul></div>
      <div className="nav-group"><h2>Sắp có</h2><ul className="soon">{['Studio','Marketing'].map(n=><li key={n}><span translate="no">{n}</span><span>Chưa triển khai</span></li>)}</ul></div>
     </nav></div>
    <div className="level" data-state={level===2?'current':'ahead'} aria-hidden={level!==2} inert={level!==2}>
     <button className="back-btn" ref={back} type="button" onClick={()=>toLevel(1)}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M12 4l-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg><span>Menu chính</span></button>
     {sub==='price'?<><h2 className="level-title">Price System</h2>
     <nav aria-label="Mục con Price System"><div className="nav-group"><ul>{price.map(([k,l])=>item(k,l,page===k,true))}</ul></div></nav></>
     :<><h2 className="level-title">Điều hành</h2>
     <nav aria-label="Mục con Điều hành">{manage.length>0&&<div className="nav-group"><h2>Quản lý</h2><ul>{manage.map(([k,l])=>item(k,l,page===k,true))}</ul></div>}
      {reports&&<><div className="nav-group"><h2>Báo cáo (demo)</h2><ul>{OPS.map(([k,l])=>item(k,l,page===k,true))}</ul></div>
      <div className="nav-group"><h2>Chưa kết nối nguồn</h2><ul>{NC.map(([k,l])=>item(k,l,page===k,true,'Chưa kết nối'))}</ul></div></>}</nav></>}</div>
   </div>
   <p className="drawer-foot">Price System, Nhân viên và Nhật ký dùng dữ liệu thật. Các mục còn lại là bản demo.</p>
  </dialog></>;
}
