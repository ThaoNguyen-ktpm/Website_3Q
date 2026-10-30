import React, {lazy, Suspense, useEffect, useRef, useState} from 'react';
import Tasks from './tasks';
import AppHeader from './app-header';
import HomeView from './home';
import PolicyView from './policy';
import {OpsBand,OpsSide,OpsTabs,Overview,AlertSheet,labels,DATA_PAGES,type Row,type Summary} from './dashboard';
import {money,Toast,Close} from './ui';
import {simulatedApi} from './simulated-api';
import type {User} from './auth';
import {PRICE,MANAGE,type AppPage} from './apps';
import {SaleAi,CatalogSearch} from './price-system';
import {Team,AuditLogs,initials} from './staff';
import {Icon} from './ui';
import Assistant from './assistant';
import {allowedPage as mayOpen} from './access';
import {readRecent} from './recent';
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
const fields:Record<string,string>={week:'Tuần demo',id:'Mã',source:'Nguồn',original_id:'ID gốc',business_at:'Ngày nghiệp vụ',synced_at:'Ngày đồng bộ',channel:'Kênh',sale:'Sale',amount:'Số tiền',cost:'Giá vốn',sku:'SKU',kind:'Loại',name:'Tên',age_days:'Tuổi tồn (ngày)',value:'Giá trị',issue:'Nội dung',record:'Bản ghi liên quan',severity:'Mức độ',category:'Nhóm chi phí',money_impact:'Ảnh hưởng tiền',repair_steps:'Cách xử lý',completion:'Điều kiện hoàn thành'};
const HIDDEN=['business_at','synced_at','original_id','repair_steps','completion'],MONEY=['amount','cost','value','money_impact'];
const NC_TEXT:Record<string,string>={reconcile:'Tổng hợp',consignment:'Ký gửi · Hồ sơ ký gửi · Phân bổ',cash:'Ngân hàng · Khoản thu · Phân bổ',close:'Sổ chốt · Điều chỉnh',settings:'Thiết lập · Danh mục · Từ điển · Hướng dẫn'};
const api = simulatedApi;
export default function App({user,onLogout}:{user:User;onLogout:()=>void}){
 const [route,setRoute]=useState(new URLSearchParams(location.hash.slice(1)));
 const [me,setMe]=useState<{role:string;grants:string[]}|null>(null),[error,setError]=useState(''),[summary,setSummary]=useState<Summary|null>(null),[rows,setRows]=useState<Row[]>([]),[detail,setDetail]=useState<Row|null>(null),[loading,setLoading]=useState(false);
 const [errors,setErrors]=useState<Row[]>([]),[inventoryCount,setInventoryCount]=useState(0);
 const dialog=useRef<HTMLDialogElement>(null);const page=route.get('page')||'portal',period=route.get('period')||'',field=route.get('field')||'',value=route.get('value')||'',record=route.get('record')||'',alert=route.get('alert')||'';
 // replace=true rewrites the current history entry (filters, closing deep-linked sheets) instead of adding one
 function go(next:Record<string,string>,replace=false){const p=new URLSearchParams(location.hash.slice(1));for(const [k,v] of Object.entries(next)){v?p.set(k,v):p.delete(k)}
  if(replace){history.replaceState(history.state,'','#'+p.toString());setRoute(p)}else location.hash=p.toString();}
 function nav(target:string,f='',v=''){go({page:target,field:f,value:v,record:'',task:'',taskView:'',taskFilter:'',alert:'',group:'',homeFilter:'',homeDept:'',homeView:''});window.scrollTo(0,0)}
 const can=(permission:string)=>user.permissions.includes(permission);
 const pageLabel=pageOf(page)?.[1]||(Object.hasOwn(labels,page)?labels[page]:'')||(page==='tasks'?'Công việc':page==='policy'?'Chính sách':'');
 useEffect(()=>{if(page==='portal'||!pageLabel)return;try{localStorage.setItem('baoq-recent',JSON.stringify([{page,label:pageLabel,at:new Date().toISOString()},...readRecent().filter(r=>r.page!==page)].slice(0,4)))}catch{}},[page,pageLabel]);
 // Bảo 2026-10-27 (A): only Admin opens the demo reports; Điều hành starts at the first page this person may open.
 const admin=user.role==='ADMIN';
 const allowedPage=(target:string)=>mayOpen(user,target);
 const allowed=(list:AppPage[])=>list.filter(([,,permission])=>can(permission)).map(([k,l]):[string,string]=>[k,l]);
 const real=pageOf(page);
 const realContent=page==='sale'?<SaleAi/>:page==='search'?<CatalogSearch/>:page==='team'?<Team user={user}/>:page==='audit'?<AuditLogs/>:page==='documents'?<Suspense fallback={<p role="status">Đang mở tài liệu…</p>}><Documents canManage={can('documents.manage')}/></Suspense>:null;
 const overview=admin?'overview':MANAGE.find(([,,p])=>can(p))?.[0]||'portal';
 useEffect(()=>{const h=()=>setRoute(new URLSearchParams(location.hash.slice(1)));window.addEventListener('hashchange',h);// The demo reports read sample data as the simulated CEO; only Admin opens them.
  if(admin)api('me').catch(()=>api('demo/session',{method:'POST',body:JSON.stringify({role:'ceo'})})).then(setMe).catch(()=>{});return()=>window.removeEventListener('hashchange',h)},[]);
 useEffect(()=>{let active=true;setError('');setSummary(null);setRows([]);setDetail(null);setErrors([]);if(!me||!(page in labels))return;setLoading(true);const query=new URLSearchParams({period,field,value});
  const task=page==='overview'?api('overview?'+query).then(d=>{if(active)setSummary(d)}):DATA_PAGES.includes(page)?api('records/'+page+'?'+query).then(d=>{if(active){setRows(d.rows);if(d.summary)setSummary(d.summary)}}):Promise.resolve();
  // the overview's alert list and aging count come from the same simulated tables (roles without the grant simply get none)
  if(page==='overview'&&period){api('records/errors?period='+period).then(d=>{if(active)setErrors(d.rows)}).catch(()=>{});api('records/inventory?period='+period).then(d=>{if(active)setInventoryCount(d.rows.length)}).catch(()=>{})}
  task.catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[page,period,field,value,me]);
 useEffect(()=>{let active=true;setDetail(null);if(record&&me)api(`record/${page}/${record}`).then(d=>{if(active)setDetail(d.record)}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[record,page,me]);
 useEffect(()=>{if(detail)dialog.current?.showModal();else dialog.current?.close()},[detail]);
 const periodSelect=<label className="period role-select"><span className="vh-sm">Kỳ dữ liệu</span><select aria-label="Kỳ dữ liệu" value={period} onChange={e=>go({period:e.target.value,record:''})}><option value="">Chưa chọn kỳ</option><option value="2026-10">Tháng 10 / 2026 · Demo</option></select></label>;
 const crumbs=page==='tasks'?<span aria-current="page">Công việc</span>:<><a href={`#page=${overview}`}>Điều hành</a><span aria-hidden="true">/</span><span aria-current="page">{labels[page]}</span></>;
 function opsContent(){
  if(!me)return <section className="card empty-card"><h2>Chọn vai trò demo để bắt đầu.</h2><p>Vai trò chỉ mô phỏng giao diện, không phải bảo mật.</p></section>;
  if(loading)return <p role="status">Đang tải…</p>;
  if(error)return null;
  if(!DATA_PAGES.includes(page))return <section className="card"><div className="card-head"><h2>Chưa kết nối nguồn</h2><p>{NC_TEXT[page]}</p></div><p>Chưa có kỳ và số dư thật được xác minh. Quy tắc đối soát chờ bộ fixture từ nguồn trước khi triển khai.</p></section>;
  if(!period)return <section className="card empty-card"><h2>Chưa chọn kỳ dữ liệu</h2><p>Chọn tháng demo để xem biểu đồ và số liệu tổng hợp. Không có số dư thật được nhập.</p><button className="btn btn-primary" type="button" onClick={()=>go({period:'2026-10',record:''})}>Xem biểu đồ demo · Tháng 10/2026</button></section>;
  if(page==='overview')return summary?<Overview summary={summary} nav={nav} go={go} errors={errors} inventoryCount={inventoryCount}/>:null;
  const cols=Object.keys(rows[0]||{}).filter(k=>!HIDDEN.includes(k));
  return <section className="card"><div className="card-head"><h2>{labels[page]} <span className="count-pill">{rows.length}</span></h2>{field&&<button className="chip-clear" type="button" onClick={()=>go({field:'',value:'',record:''})}>Bỏ lọc: {fields[field]} = {value} <Close/></button>}</div>
   {page==='costs'&&summary&&<p className="formula">Doanh thu {money(summary.revenue)} − Giá vốn {money(summary.cogs)} − Vận hành {money(summary.operating)} = Kết quả demo <strong>{money(summary.result)}</strong>.<br/>Tổng chi phí: {money(summary.total_cost)}. Chi phí vận hành: {money(rows.reduce((s,r)=>s+Number(r.amount),0))}. <button className="link-btn" type="button" onClick={()=>nav('transactions')}>Xem giá vốn theo giao dịch</button></p>}
   <div className="table-scroll"><table><thead><tr>{cols.map(k=><th key={k} className={MONEY.includes(k)?'r':undefined}>{fields[k]||k}</th>)}<th>Chi tiết</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}>{cols.map(k=><td key={k} className={MONEY.includes(k)?'r num':undefined}>{MONEY.includes(k)?money(Number(r[k])):String(r[k])}</td>)}<td><button className="open-btn" type="button" onClick={()=>go({record:String(r.id)})}>Mở {r.id}</button></td></tr>)}</tbody></table></div>
   {!rows.length&&<p>Không có bản ghi phù hợp.</p>}</section>;
 }
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
   ...(admin||manage.length?[{href:`#page=${overview}`,icon:'overview',title:'Điều hành',text:admin?'Nhân viên, nhật ký và báo cáo tổng quan.':manage.map(([,l])=>l).join(', ')+'.',tag:manage.length?`${manage.map(([,l])=>l).join(', ')}: dữ liệu thật`:'Báo cáo demo',real:manage.length>0}]:[]),
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
 else if(page in labels&&!admin)body=<><OpsBand title={labels[page]} crumbs={crumbs}/>
  <OpsTabs page={page} nav={nav} manage={allowed(MANAGE)} reports={false}/>
  <div className="ops-layout"><OpsSide page={page} nav={nav} warnings={0} manage={allowed(MANAGE)} reports={false}/><div className="ops-main"><NoAccess/></div></div></>;
 else body=<><OpsBand title={labels[page]||'Ứng dụng'} crumbs={crumbs} overviewTarget={page!=='overview'&&me?.grants.includes('overview')?'overview':undefined} actions={DATA_PAGES.includes(page)?periodSelect:undefined}/>
  <OpsTabs page={page} nav={nav} manage={allowed(MANAGE)}/>
  <div className="ops-layout"><OpsSide page={page} nav={nav} warnings={summary?.warning_count||0} manage={allowed(MANAGE)}/>
   <div className="ops-main">
    {error&&<p className="error" role="alert">{error}</p>}{opsContent()}</div></div>
  <AlertSheet error={errors.find(e=>e.id===alert)||null} close={()=>go({alert:''})} go={go}/></>;
 return <>{header}<main id="main">{body}</main>
  <dialog className="rec-dialog" ref={dialog} onCancel={e=>{e.preventDefault();go({record:''})}}><div className="dl-head"><h2>Chi tiết bản ghi</h2><button className="icon-btn" type="button" onClick={()=>go({record:''})} aria-label="Đóng chi tiết"><Close/></button></div><span className="chip-demo">DỮ LIỆU DEMO</span><dl>{detail&&Object.entries(detail).map(([k,v])=><React.Fragment key={k}><dt>{fields[k]||k}</dt><dd>{MONEY.includes(k)?money(Number(v)):String(v)}</dd></React.Fragment>)}</dl></dialog>
  <Assistant page={page} telegram={user.role==='ADMIN'}/>
  <Toast undoLabel="Hoàn tác"/></>;
}
