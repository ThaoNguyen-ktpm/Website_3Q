import {useEffect,useRef,useState} from 'react';
import {getConfig,loginWithGoogle,loginWithLink,type User} from './auth';
import {linkCode} from './login-link';
type GoogleId={initialize(o:{client_id:string;callback:(r:{credential:string})=>void}):void;renderButton(e:HTMLElement,o:Record<string,unknown>):void};
declare global{interface Window{google?:{accounts:{id:GoogleId}}}}
// Same two ways in as the old sign-in page: Google, or a one-time link (?ma=…) from Nhân viên → Link đăng nhập.
// Machines on the shop wifi open the site by IP, where Google refuses to sign in, so they only get the link hint.
export default function Login({onLogin}:{onLogin:(user:User)=>void}){
 const button=useRef<HTMLDivElement>(null);
 const [code,setCode]=useState(()=>new URLSearchParams(location.search).get('ma'));
 const [state,setState]=useState<'loading'|'ready'|'checking'>(code?'checking':'loading'),[error,setError]=useState('');
 const lan=!['localhost','127.0.0.1','[::1]'].includes(location.hostname);
 const used=useRef(false);
 // Temporary (Bảo 2026-10-27, to be removed later): paste the one-time link or its code here instead of opening it.
 const [link,setLink]=useState('');
 const submitLink=(e:React.FormEvent)=>{e.preventDefault();if(state==='checking')return;const pasted=linkCode(link);if(!pasted){setError('Link này không có mã đăng nhập. Dán nguyên link quản lý gửi.');return;}
  setState('checking');setError('');loginWithLink(pasted).then(d=>onLogin(d.user)).catch(e=>{setLink('');fail(Error((e instanceof Error?e.message:'Link không dùng được.')+' Link chỉ dùng 1 lần trong 10 phút, nhờ quản lý gửi link mới.'))})};
 const fail=(e:unknown)=>{setError(e instanceof Error?e.message:'Không đăng nhập được. Thử lại nhé.');setState('ready')};
 useEffect(()=>{if(!code||used.current)return;used.current=true;history.replaceState(null,'',location.pathname+location.hash);
  // A used or expired link falls back to the Google button.
  loginWithLink(code).then(d=>onLogin(d.user)).catch(e=>{fail(Error((e instanceof Error?e.message:'Link không dùng được.')+' Link chỉ dùng 1 lần trong 10 phút, nhờ quản lý gửi link mới.'));setState('loading');setCode(null)})},[code]);
 useEffect(()=>{if(code||lan)return;let alive=true;
  getConfig().then(({googleClientId})=>new Promise<void>((resolve,reject)=>{
   if(window.google)return resolve();const s=document.createElement('script');s.src='https://accounts.google.com/gsi/client?hl=vi';s.async=true;s.onload=()=>resolve();s.onerror=()=>reject(Error('Không tải được nút Google. Kiểm tra mạng rồi tải lại trang.'));document.head.append(s)})
   .then(()=>{if(!alive||!button.current||!window.google)return;const g=window.google.accounts.id;
    g.initialize({client_id:googleClientId,callback:({credential})=>{setState('checking');setError('');loginWithGoogle(credential).then(d=>onLogin(d.user)).catch(fail)}});
    g.renderButton(button.current,{theme:'outline',shape:'rectangular',text:'signin_with',locale:'vi',size:'large',width:Math.min(320,button.current.clientWidth)});setState(current=>current==='checking'?current:'ready')}))
   .catch(e=>{if(alive){setError(e instanceof Error?e.message:'Không tải được nút Google.');setState(current=>current==='checking'?current:'ready')}});
  return()=>{alive=false}},[code,lan]);
 return <section className="login-card" aria-labelledby="login-title">
   <div className="login-band"><img src="/brand/baoq-logo-original.jpg" alt="BAOQ Luxury · Buy · Sell · Consign" width="400" height="400"/></div>
   <div className="login-body">
    <p className="login-kicker">Khu làm việc nội bộ</p>
    <h1 id="login-title">Đăng nhập</h1>
    {lan?<p className="login-note">Máy đang dùng wifi của shop nên không đăng nhập Google được. Dán link đăng nhập quản lý gửi vào ô dưới.</p>
     :<><p className="login-lede">Dùng tài khoản Google đã được cấp quyền.</p>
      <div className="login-google" ref={button} inert={state==='checking'}/>{state==='loading'&&!code&&<p className="login-status" role="status"><span className="login-spin" aria-hidden="true"/>Đang tải nút Google…</p>}
      <div className="login-or" aria-hidden="true"><span>hoặc</span></div></>}
    <form className="login-link" onSubmit={submitLink}><label htmlFor="login-link">Đăng nhập bằng link</label>
     <div><input id="login-link" type="text" autoComplete="off" spellCheck={false} placeholder="Dán link hoặc mã đăng nhập" value={link} disabled={state==='checking'} onChange={e=>setLink(e.target.value)}/><button className="btn btn-primary" type="submit" disabled={!link.trim()||state==='checking'}>Vào</button></div>
     <small>Quản lý tạo link ở Nhân viên → Link đăng nhập. Mỗi link dùng 1 lần, trong 10 phút.</small></form>
    {state==='checking'&&<p className="login-status" role="status"><span className="login-spin" aria-hidden="true"/>Đang đăng nhập…</p>}
    {error&&<p className="login-error" role="alert">{error}</p>}
   </div>
  </section>;
}
