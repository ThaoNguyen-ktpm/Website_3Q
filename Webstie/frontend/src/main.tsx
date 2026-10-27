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
import Tasks from './tasks';
import AppHeader from './app-header';
import HomeView from './home';
import PolicyView from './policy';
import {OpsBand,OpsSide,OpsTabs,Overview,AlertSheet,labels,DATA_PAGES,type Row,type Summary} from './dashboard';
import {LanguageToggle} from './i18n';
import {money,Toast,Close} from './ui';
import {simulatedApi} from './simulated-api';
const fields:Record<string,string>={week:'Tuần demo',id:'Mã',source:'Nguồn',original_id:'ID gốc',business_at:'Ngày nghiệp vụ',synced_at:'Ngày đồng bộ',channel:'Kênh',sale:'Sale',amount:'Số tiền',cost:'Giá vốn',sku:'SKU',kind:'Loại',name:'Tên',age_days:'Tuổi tồn (ngày)',value:'Giá trị',issue:'Nội dung',record:'Bản ghi liên quan',severity:'Mức độ',category:'Nhóm chi phí',money_impact:'Ảnh hưởng tiền',repair_steps:'Cách xử lý',completion:'Điều kiện hoàn thành'};
const HIDDEN=['business_at','synced_at','original_id','repair_steps','completion'],MONEY=['amount','cost','value','money_impact'];
const NC_TEXT:Record<string,string>={reconcile:'Tổng hợp',consignment:'Ký gửi · Hồ sơ ký gửi · Phân bổ',cash:'Ngân hàng · Khoản thu · Phân bổ',close:'Sổ chốt · Điều chỉnh',settings:'Thiết lập · Danh mục · Từ điển · Hướng dẫn'};
const api = simulatedApi;
function App(){
 const [route,setRoute]=useState(new URLSearchParams(location.hash.slice(1)));
 const [me,setMe]=useState<{role:string;grants:string[]}|null>(null),[error,setError]=useState(''),[summary,setSummary]=useState<Summary|null>(null),[rows,setRows]=useState<Row[]>([]),[detail,setDetail]=useState<Row|null>(null),[loading,setLoading]=useState(false);
 const [errors,setErrors]=useState<Row[]>([]),[inventoryCount,setInventoryCount]=useState(0);
 const dialog=useRef<HTMLDialogElement>(null);const page=route.get('page')||'portal',period=route.get('period')||'',field=route.get('field')||'',value=route.get('value')||'',record=route.get('record')||'',alert=route.get('alert')||'';
 // replace=true rewrites the current history entry (filters, closing deep-linked sheets) instead of adding one
 function go(next:Record<string,string>,replace=false){const p=new URLSearchParams(location.hash.slice(1));for(const [k,v] of Object.entries(next)){v?p.set(k,v):p.delete(k)}
  if(replace){history.replaceState(history.state,'','#'+p.toString());setRoute(p)}else location.hash=p.toString();}
 function nav(target:string,f='',v=''){go({page:target,field:f,value:v,record:'',task:'',taskView:'',taskFilter:'',alert:'',group:'',homeFilter:'',homeDept:'',homeView:''});window.scrollTo(0,0)}
 const overview=me?.grants.includes('overview')?'overview':me?.grants[0]||'overview';
 useEffect(()=>{const h=()=>setRoute(new URLSearchParams(location.hash.slice(1)));window.addEventListener('hashchange',h);api('me').then(setMe).catch(()=>{});return()=>window.removeEventListener('hashchange',h)},[]);
 useEffect(()=>{let active=true;setError('');setSummary(null);setRows([]);setDetail(null);setErrors([]);if(!me||!(page in labels))return;setLoading(true);const query=new URLSearchParams({period,field,value});
  const task=page==='overview'?api('overview?'+query).then(d=>{if(active)setSummary(d)}):DATA_PAGES.includes(page)?api('records/'+page+'?'+query).then(d=>{if(active){setRows(d.rows);if(d.summary)setSummary(d.summary)}}):Promise.resolve();
  // the overview's alert list and aging count come from the same simulated tables (roles without the grant simply get none)
  if(page==='overview'&&period){api('records/errors?period='+period).then(d=>{if(active)setErrors(d.rows)}).catch(()=>{});api('records/inventory?period='+period).then(d=>{if(active)setInventoryCount(d.rows.length)}).catch(()=>{})}
  task.catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[page,period,field,value,me]);
 useEffect(()=>{let active=true;setDetail(null);if(record&&me)api(`record/${page}/${record}`).then(d=>{if(active)setDetail(d.record)}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[record,page,me]);
 useEffect(()=>{if(detail)dialog.current?.showModal();else dialog.current?.close()},[detail]);
 async function login(role:string){try{const d=await api('demo/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({role})});setMe(d);nav('portal')}catch(e){setError(String(e))}}
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
 const header=<AppHeader nav={nav} overview={overview} page={page}><LanguageToggle/><label className="header-role"><span className="role-label">Vai trò</span><select aria-label="Vai trò demo" value={me?.role||''} onChange={e=>login(e.target.value)}><option value="" disabled>Chọn vai trò</option><option value="ceo">CEO</option><option value="cofounder">Cofounder · chưa cấp quyền</option><option value="inventory">Kho · quyền tồn kho</option><option value="sales">Sale · quyền Thu–bán</option></select></label></AppHeader>;
 let body:React.ReactNode;
 if(page==='portal')body=<HomeView route={route} go={go} overview={overview}/>;
 else if(page==='policy')body=<PolicyView group={route.get('group')||''} go={go}/>;
 else if(page==='tasks')body=<><OpsBand title="Công việc" crumbs={crumbs}/>
  <div className="ops-layout"><aside className="ops-side tasks-side" aria-label="Điều hướng Công việc"><nav aria-label="Trong Công việc"><h2>Công việc</h2><ul>
   <li><button type="button" className="side-link side-btn" aria-current={route.get('taskView')!=='notifications'?'page':undefined} onClick={()=>go({task:'',taskView:'list'})}><span>Danh sách công việc</span></button></li>
   <li><button type="button" className="side-link side-btn" aria-current={route.get('taskView')==='notifications'?'page':undefined} onClick={()=>go({task:'',taskView:'notifications'})}><span>Thông báo Telegram</span></button></li>
   <li><button type="button" className="side-link side-btn" onClick={()=>nav('portal')}><span>← Trang chủ</span></button></li></ul></nav></aside>
   <div className="ops-main legacy"><p className="notice">Sườn UI · Vai trò mô phỏng, không phải bảo mật · Chưa nhập dữ liệu thật · Snapshot demo: 19/10/2026 09:00 UTC</p><Tasks route={route} go={go}/></div></div></>;
 else body=<><OpsBand title={labels[page]||'Ứng dụng'} crumbs={crumbs} overviewTarget={page!=='overview'&&me?.grants.includes('overview')?'overview':undefined} actions={DATA_PAGES.includes(page)?periodSelect:undefined}/>
  <OpsTabs page={page} nav={nav}/>
  <div className="ops-layout"><OpsSide page={page} nav={nav} warnings={summary?.warning_count||0}/>
   <div className="ops-main"><p className="notice-line">Sườn UI · Vai trò mô phỏng, không phải bảo mật · Chưa nhập dữ liệu thật · Snapshot demo: 19/10/2026 09:00 UTC</p>
    {error&&<p className="error" role="alert">{error}</p>}{opsContent()}</div></div>
  <AlertSheet error={errors.find(e=>e.id===alert)||null} close={()=>go({alert:''})} go={go}/></>;
 return <>{header}<main id="main">{body}</main>
  <footer className="site-foot"><div className="wrap">BAOQ Internal · UI scaffold 0.2 · Dành cho review và bàn giao dev</div></footer>
  <dialog className="rec-dialog" ref={dialog} onCancel={e=>{e.preventDefault();go({record:''})}}><div className="dl-head"><h2>Chi tiết bản ghi</h2><button className="icon-btn" type="button" onClick={()=>go({record:''})} aria-label="Đóng chi tiết"><Close/></button></div><span className="chip-demo">DỮ LIỆU DEMO</span><dl>{detail&&Object.entries(detail).map(([k,v])=><React.Fragment key={k}><dt>{fields[k]||k}</dt><dd>{MONEY.includes(k)?money(Number(v)):String(v)}</dd></React.Fragment>)}</dl></dialog>
  <Toast undoLabel="Hoàn tác"/></>;
}
createRoot(document.getElementById('root')!).render(<App/>);
