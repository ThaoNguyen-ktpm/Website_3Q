import React,{useEffect,useRef,useState} from 'react';
import {listStaff,listRoles,createStaff,updateStaff,createLoginLink} from '../../api/staff';
import {auditActions,listAuditLogs} from '../../api/audit';
import {listCatalogProducts,syncCatalogProducts} from '../../api/catalog';
import Icon from '../components/Icon';
import '../styles.css';
import {RevenueChart,OrderRing} from '../components/Charts';
import useAdminController from '../controllers/useAdminController';
import {money,shortMoney,statusLabels,seedOrders} from '../models/storeModel';
import PatternWaves from '../../components/PatternWaves';
// Tài liệu (TASK-027) tạm tắt theo yêu cầu Bảo 2026-10-17: bỏ khỏi nav nên trang không mở được; thêm lại ['documents','bag','Tài liệu'] vào nav để bật.
import Documents from './Documents';
import AssistantWidget from '../components/AssistantWidget';

// Bảo 2026-10-20: menu chỉ còn chức năng thật. Tổng quan, Sản phẩm, Đơn hàng, Khách hàng, Cài đặt dùng dữ liệu mẫu trong trình duyệt nên tạm ẩn;
// bật lại bằng cách thêm ['overview','grid','Tổng quan'], ['products','box','Sản phẩm'], ['orders','bag','Đơn hàng'], ['customers','users','Khách hàng'], ['settings','settings','Cài đặt'] vào nav.
const nav=[['search','search','Tìm kiếm'],['sale','trend','Sale AI'],['team','team','Nhân viên'],['audit','clock','Nhật ký']];
const titles=Object.fromEntries(nav.map(([id,,title])=>[id,title]));
const dateLabel=date=>date.split('-').reverse().join('/');
const periodNames={month:'Tháng này',week:'7 ngày gần nhất',today:'Hôm nay'};
function Avatar({person}) {return <span className={`avatar ${person.color}`}>{person.initials}</span>}
function ProductImage({product,small=false}) {return <span className={`product-image ${product.color} ${small?'small':''}`}><Icon name={product.icon} size={small?22:28}/></span>}
function Badge({status}) {return <span className={`badge ${status==='ACTIVE'?'completed':status==='DISABLED'?'cancelled':status}`}><i/>{({ACTIVE:'Đang hoạt động',DISABLED:'Tạm ngưng'})[status]||statusLabels[status]}</span>}
function Empty({label='Không có kết quả phù hợp',hint='Thử từ khóa khác hoặc đặt lại bộ lọc.'}){return <div className="empty"><Icon name="search" size={30}/><strong>{label}</strong><p>{hint}</p></div>}
function PanelHeading({title,description,children}){return <div className="panel-heading"><div><h2>{title}</h2>{description&&<p>{description}</p>}</div>{children}</div>}

export default function App({user,onSignOut,signingOut,signOutError}){
 const [assistant,setAssistant]=useState(()=>({open:false,messages:[{role:'assistant',greeting:true,content:'Chào bạn, mình có thể giúp gì cho bạn?',time:new Date().toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})}]}));
 const can=key=>user.permissions.includes(key);
 const allowedNav=nav.filter(([id])=>can(({overview:'dashboard.view',search:'products.view',sale:'sale.manage',products:'products.view',orders:'orders.view',customers:'customers.view',documents:'documents.view',team:'staff.view',audit:'audit.view',settings:'settings.manage'})[id]));
 const c=useAdminController(allowedNav[0]?.[0]||'overview');c.can=can;const [helpOpen,setHelpOpen]=useState(false);
 const validPage=titles[c.page]?c.page:allowedNav[0]?.[0];
 const allowed=allowedNav.some(([id])=>id===validPage);
 return <div className="app-shell">
  <div className="admin-background" aria-hidden="true"><PatternWaves backgroundColor="#07070c" color="#8c7cf0" opacity={0.55} fade="edges" /></div>
  {c.sidebarOpen&&<button className="nav-backdrop" aria-label="Đóng menu" onClick={()=>c.setSidebarOpen(false)}/>}
  <aside className={`sidebar ${c.sidebarOpen?'open':''}`} aria-label="Menu quản trị">
   <a className="brand" href="#search" aria-label="BaoQ Luxury"><img className="brand-logo" src="/brand/baoq-logo-transparent.png" alt="BaoQ Luxury — Buy · Sell · Consign" width="816" height="600"/></a>
   
   <div className="nav-caption">KHÔNG GIAN LÀM VIỆC</div>
   <nav>{allowedNav.map(([id,icon,label])=><a key={id} href={`#${id}`} className={validPage===id?'active':''} aria-current={validPage===id?'page':undefined}><Icon name={icon} size={19}/><span>{label}</span>{id==='orders'&&<span className="nav-count">{seedOrders.filter(o=>o.status==='pending').length}</span>}</a>)}</nav>
   <div className="sidebar-bottom"><div className="support-box"><span className="support-icon"><Icon name="help" size={21}/></span><h3>Cần một chút hỗ trợ?</h3><p>Khám phá cách sử dụng<br/>bản quản trị của bạn.</p><button onClick={()=>setHelpOpen(true)}>Hướng dẫn sử dụng <Icon name="arrow" size={14}/></button></div><div className="sidebar-foot"><span className="version-dot"/> Phiên bản giao diện <span>v1.0</span></div></div>
  </aside>
  <div className="workspace">
   <header className="topbar"><div className="breadcrumbs"><button className="icon-button mobile-menu" onClick={()=>c.setSidebarOpen(true)} aria-label="Mở menu"><Icon name="menu"/></button><span>Không gian làm việc</span><Icon name="chevron" size={13}/><strong>{titles[validPage]}</strong></div><div className="topbar-actions"><div className="store-switch store-switch-top"><span className="store-square"><img className="store-logo" src="/brand/baoq-monogram.png" alt="" width="390" height="390"/></span><div><strong>{c.store.settings.name}</strong><small>Không gian quản trị</small></div></div><span className="topbar-divider"/><Account user={user} onSignOut={onSignOut} signingOut={signingOut} signOutError={signOutError}/></div></header>
   <main>
    {allowed?<><div className="page-title"><div><h1>{validPage==='overview'?'Tổng quan cửa hàng':titles[validPage]}</h1><p>{({overview:'Mọi hoạt động kinh doanh, trong một góc nhìn.',search:'Tra sản phẩm trực tiếp từ KiotViet.',sale:'Tính và cập nhật giá sale KiotViet, Sapo bằng tool Sale AI.',products:'Theo dõi hàng hóa và chăm chút từng sản phẩm.',orders:'Theo dõi và quản lý đơn hàng của cửa hàng.',customers:'Hiểu khách hàng, xây dựng kết nối dài lâu.',team:'Cùng đội ngũ vận hành cửa hàng mỗi ngày.',settings:'Thiết lập thông tin cho không gian của bạn.'})[validPage]}</p></div><div className="page-actions">{['overview','orders'].includes(validPage)?<><PeriodSelect c={c}/>{can('reports.export')&&<button className="button primary" onClick={c.exportOrders}><Icon name="download" size={16}/> Xuất báo cáo</button>}</>:validPage==='products'&&can('products.edit')?<button className="button primary" onClick={()=>c.setDrawer({type:'product',product:null})}><Icon name="plus" size={17}/> Thêm sản phẩm</button>:null}</div></div>
    {validPage==='overview'&&<Overview c={c}/>}
    {validPage==='products'&&<Products c={c}/>}
    {validPage==='search'&&<CatalogSearch c={c}/>}
    {validPage==='sale'&&<SaleAi/>}
    {validPage==='documents'&&<Documents canManage={can('documents.manage')}/>}
    {validPage==='orders'&&<Orders c={c}/>}
    {validPage==='customers'&&<Customers c={c}/>}
    {validPage==='team'&&<Team c={c} user={user}/>}
    {validPage==='audit'&&<AuditLogs/>}
    {validPage==='settings'&&<Settings c={c}/>}</>:<Empty label="Bạn không có quyền xem trang này" hint="Chọn một trang được phép trong menu."/>}
    <footer className="page-footer"></footer>
   </main>
  </div>
  {c.drawer&&<Drawer c={c}/>}
  {c.toast&&<div className="toast" role="status"><Icon name="check" size={18}/>{c.toast}<button className="icon-button" onClick={()=>c.setToast('')} aria-label="Đóng thông báo"><Icon name="close" size={16}/></button></div>}
  {helpOpen&&<Help onClose={()=>setHelpOpen(false)}/>}
  <AssistantWidget state={assistant} setState={setAssistant} page={validPage} telegram={user.role==='ADMIN'}/>
 </div>
}

function PeriodSelect({c}){return <label className="period-control"><Icon name="calendar" size={16}/><select aria-label="Khoảng thời gian" value={c.period} onChange={e=>c.setPeriod(e.target.value)}>{Object.entries(periodNames).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>}
function Search({c,placeholder}){return <label className="search"><Icon name="search" size={17}/><input aria-label={placeholder} placeholder={placeholder} value={c.search} onChange={e=>c.setSearch(e.target.value)}/>{c.search&&<button aria-label="Xóa tìm kiếm" onClick={()=>c.setSearch('')}><Icon name="close" size={14}/></button>}</label>}

function Overview({c}){
 const r=c.report;const stats=[['Doanh thu',money(r.total),'wallet',r.trend,'so với kỳ trước'],['Đơn hàng',r.orderCount,'bag','12,2%','so với kỳ trước'],['Khách hàng mới',r.customers,'users','8,5%','so với kỳ trước'],['Giá trị đơn trung bình',money(r.average),'trend','5,7%','so với kỳ trước']];
 return <>
  <section className="metrics" aria-label="Chỉ số kinh doanh mẫu">{stats.map(([label,value,icon,trend,sub],i)=><article className="metric" key={label}><div className="metric-label"><span>{label}</span><span className={`metric-icon metric-${i}`}><Icon name={icon} size={19}/></span></div><strong className="metric-value">{value}</strong><div className="metric-note"><span><Icon name="trend" size={13}/> {trend}</span><small>{sub}</small></div></article>)}</section>
  <div className="analytics-grid">
   <section className="panel revenue-panel"><PanelHeading title="Tổng quan doanh thu" description="Theo dõi nhịp tăng trưởng của cửa hàng"><span className="chart-unit">Đơn vị: triệu đồng</span></PanelHeading><div className="revenue-summary"><strong>{money(r.total)}</strong><span className="change-pill"><Icon name="arrow" size={13}/>{r.trend}</span><div className="chart-legend"><span><i/> Kỳ này</span><span><i/> Kỳ trước</span></div></div><RevenueChart report={r}/><div className="chart-foot"><Icon name="trend" size={15}/><span>Doanh thu tăng <strong>{r.trend}</strong> so với kỳ trước.</span><span className="muted">Số liệu tổng hợp mẫu</span></div></section>
   <section className="panel status-panel"><PanelHeading title="Trạng thái đơn hàng" description={`${periodNames[c.period]} · Số liệu mẫu`}/><OrderRing count={r.orderCount}/></section>
  </div>
  <div className="bottom-grid">
   <section className="panel recent-orders"><PanelHeading title="Đơn hàng gần đây" description="Cập nhật những đơn hàng mới nhất"><a className="text-link" href="#orders">Xem tất cả <Icon name="chevron" size={14}/></a></PanelHeading><OrderTable orders={c.filteredOrders.slice(0,5)} c={c} compact/><div className="panel-bottom"><span>Hiển thị {Math.min(5,c.filteredOrders.length)} trong {c.filteredOrders.length} đơn mẫu của kỳ</span><a href="#orders">Quản lý đơn hàng <Icon name="chevron" size={13}/></a></div></section>
   <section className="panel bestsellers"><PanelHeading title="Sản phẩm bán chạy" description="Được khách hàng yêu thích · Mẫu"/><div className="top-products">{[...c.store.products].sort((a,b)=>b.sold-a.sold).slice(0,4).map((p,i)=><div className="top-product" key={p.id}><span className="rank">{String(i+1).padStart(2,'0')}</span><ProductImage product={p} small/><div className="product-meta">{c.can('products.edit')?<button onClick={()=>c.setDrawer({type:'product',product:p})}>{p.name}</button>:<strong>{p.name}</strong>}<small>{p.sold} đã bán</small></div><strong>{shortMoney(p.price*p.sold)}</strong></div>)}</div><a className="product-bottom-link" href="#products">Xem tất cả sản phẩm <Icon name="chevron" size={14}/></a></section>
  </div>
 </>
}

function OrderTable({orders,c,compact=false}){return orders.length?<div className="table-scroll"><table><thead><tr><th>Mã đơn hàng</th><th>Khách hàng</th>{!compact&&<th>Ngày tạo</th>}<th className="align-right">Tổng tiền</th><th>Trạng thái</th><th><span className="sr-only">Thao tác</span></th></tr></thead><tbody>{orders.map(o=><tr key={o.id}><td><button className="order-id" onClick={()=>c.setDrawer({type:'order',order:o})}>#{o.id}</button>{compact&&<small className="cell-sub">{dateLabel(o.date)}</small>}</td><td><div className="person"><Avatar person={o.customer}/><span>{o.customer.name}</span></div></td>{!compact&&<td className="muted">{dateLabel(o.date)}</td>}<td className="amount align-right">{money(o.total)}</td><td><Badge status={o.status}/></td><td><button className="icon-button row-action" aria-label={`Xem đơn ${o.id}`} onClick={()=>c.setDrawer({type:'order',order:o})}><Icon name="chevron" size={16}/></button></td></tr>)}</tbody></table></div>:<Empty/>}
function Orders({c}){return <section className="panel data-panel"><div className="list-tabs">{[['all','Tất cả'],...Object.entries(statusLabels)].map(([id,label])=><button key={id} className={c.status===id?'selected':''} onClick={()=>c.setStatus(id)}>{label}{id==='all'&&<span>{seedOrders.length}</span>}</button>)}</div><div className="table-toolbar"><Search c={c} placeholder="Tìm mã đơn, khách hàng, kênh bán…"/><span className="muted">{c.filteredOrders.length} đơn hàng phù hợp</span></div><OrderTable orders={c.filteredOrders} c={c}/><div className="panel-bottom"><span>Đang xem dữ liệu đơn hàng mẫu · {periodNames[c.period]}</span><span>Tổng: <strong>{money(c.filteredOrders.reduce((s,o)=>s+o.total,0))}</strong></span></div></section>}
function Products({c}){return <><div className="inline-summary"><span><Icon name="box" size={18}/><strong>{c.store.products.length}</strong> sản phẩm</span><span><i className="stock-dot"/><strong>{c.store.products.filter(p=>p.stock<c.store.settings.lowStock).length}</strong> sản phẩm sắp hết hàng</span></div><section className="panel data-panel"><div className="table-toolbar"><Search c={c} placeholder="Tìm tên, mã sản phẩm…"/><select aria-label="Danh mục sản phẩm" value={c.category} onChange={e=>c.setCategory(e.target.value)}><option value="all">Tất cả danh mục</option>{[...new Set(c.store.products.map(p=>p.category))].map(x=><option key={x}>{x}</option>)}</select></div>{c.filteredProducts.length?<div className="table-scroll"><table><thead><tr><th>Sản phẩm</th><th>Mã sản phẩm</th><th>Danh mục</th><th className="align-right">Giá bán</th><th className="align-right">Tồn kho</th><th>Trạng thái</th><th><span className="sr-only">Sửa</span></th></tr></thead><tbody>{c.filteredProducts.map(p=><tr key={p.id}><td><div className="person"><ProductImage product={p} small/><strong>{p.name}</strong></div></td><td className="muted">{p.id}</td><td>{p.category}</td><td className="align-right amount">{money(p.price)}</td><td className="align-right amount">{p.stock}</td><td><span className={`badge ${p.stock<c.store.settings.lowStock?'pending':'completed'}`}><i/>{p.stock<c.store.settings.lowStock?'Sắp hết hàng':'Còn hàng'}</span></td><td>{c.can('products.edit')&&<button className="icon-button" aria-label={`Sửa ${p.name}`} onClick={()=>c.setDrawer({type:'product',product:p})}><Icon name="edit" size={17}/></button>}</td></tr>)}</tbody></table></div>:<Empty/>}<div className="panel-bottom"><span>{c.filteredProducts.length} sản phẩm · Thay đổi lưu trong trình duyệt này</span></div></section></>}
function Customers({c}){return <section className="panel data-panel"><div className="table-toolbar"><Search c={c} placeholder="Tìm khách hàng, email, mã khách…"/><span className="muted">{c.filteredCustomers.length} khách hàng mẫu</span></div>{c.filteredCustomers.length?<div className="table-scroll"><table><thead><tr><th>Khách hàng</th><th>Mã khách</th><th>Số điện thoại</th><th className="align-right">Số đơn</th><th className="align-right">Tổng chi tiêu</th><th><span className="sr-only">Chi tiết</span></th></tr></thead><tbody>{c.filteredCustomers.map(p=><tr key={p.id}><td><div className="person"><Avatar person={p}/><div><strong>{p.name}</strong><small className="cell-sub">{p.email}</small></div></div></td><td className="muted">{p.id}</td><td>{p.phone}</td><td className="align-right">{p.orders}</td><td className="align-right amount">{money(p.spent)}</td><td><button className="icon-button" aria-label={`Xem khách hàng ${p.name}`} onClick={()=>c.setDrawer({type:'customer',customer:p})}><Icon name="chevron" size={17}/></button></td></tr>)}</tbody></table></div>:<Empty/>}</section>}
function staffAvatar(staff){return {color:'lavender',initials:(words=>words.length>1?words[0][0]+words.at(-1)[0]:words[0].slice(0,2))(staff.fullName.trim().split(/\s+/)).toLocaleUpperCase('vi')}}
function Account({user,onSignOut,signingOut,signOutError}){
 const [open,setOpen]=useState(false);const ref=useRef(null);
 useEffect(()=>{if(!open)return;const close=e=>{if(e.type==='keydown'){if(e.key==='Escape'){setOpen(false);ref.current?.querySelector('button')?.focus()}}else if(!ref.current?.contains(e.target))setOpen(false)};document.addEventListener('pointerdown',close);document.addEventListener('keydown',close);return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',close)}},[open]);
 return <div className="notification-wrap account-wrap" ref={ref}><button className="account" type="button" aria-label="Hồ sơ và đăng xuất" aria-expanded={open} aria-controls="account-panel" onClick={()=>setOpen(!open)}><Avatar person={staffAvatar(user)}/><Icon name="down" size={14}/></button>{open&&<div className="notification-panel account-panel" id="account-panel"><div className="account-card"><Avatar person={staffAvatar(user)}/><div><strong>{user.fullName}</strong><small>{user.roleLabel}</small></div></div><p className="account-email">{user.email}</p><button className="button account-signout" disabled={signingOut} onClick={onSignOut}><Icon name="logout" size={16}/>{signingOut?'Đang đăng xuất…':'Đăng xuất'}</button>{signOutError&&<p role="alert">{signOutError}</p>}</div>}</div>
}
function Team({c,user}){
 const [staff,setStaff]=useState([]),[roles,setRoles]=useState([]),[catalog,setCatalog]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[reload,setReload]=useState(0);
 useEffect(()=>{const abort=new AbortController();setLoading(true);setError('');Promise.all([listStaff(abort.signal),listRoles(abort.signal)]).then(([people,options])=>{if(!abort.signal.aborted){setStaff(people.staff);setRoles(options.roles);setCatalog(options.catalog)}}).catch(error=>{if(!abort.signal.aborted)setError(error.message)}).finally(()=>{if(!abort.signal.aborted)setLoading(false)});return()=>abort.abort()},[reload]);
 // Bảo 2026-10-20: one-time sign-in link for a laptop on the shop wifi (opened by IP, where Google sign-in is refused).
 const [links,setLinks]=useState({});
 async function makeLink(p){setLinks(l=>({...l,[p.id]:{pending:true}}));try{const link=await createLoginLink(p.id);setLinks(l=>({...l,[p.id]:link}));navigator.clipboard?.writeText(link.url).then(()=>c.setToast(`Đã chép link đăng nhập cho ${p.fullName}. Dùng 1 lần, hết hạn sau 10 phút.`),()=>{})}catch(error){setLinks(l=>({...l,[p.id]:{error:error.message}}))}}
 const team=staff.filter(p=>`${p.fullName} ${p.roleLabel} ${p.email}`.toLocaleLowerCase('vi').includes(c.search.toLocaleLowerCase('vi')));
 return <><section className="panel data-panel"><PanelHeading title="Đội ngũ cửa hàng" description="Tài khoản Google và quyền truy cập của nhân viên."/><div className="table-toolbar"><Search c={c} placeholder="Tìm nhân viên, vai trò…"/>{c.can('staff.manage')&&<button className="button primary" disabled={loading||!!error} onClick={()=>c.setDrawer({type:'staff',staff:null,roles,catalog,user,onSaved:saved=>setStaff(current=>[...current,saved])})}><Icon name="plus" size={17}/> Thêm nhân viên</button>}</div>{loading?<p className="staff-message" role="status">Đang tải nhân viên…</p>:error?<div className="staff-message" role="alert"><p>{error}</p><button className="button" onClick={()=>setReload(reload+1)}>Thử lại</button></div>:team.length?<div className="table-scroll"><table><thead><tr><th>Thành viên</th><th>Vai trò</th><th>Trạng thái</th><th>Đăng nhập gần nhất</th>{c.can('staff.manage')&&<th>Thao tác</th>}</tr></thead><tbody>{team.map(p=><tr key={p.id}><td><div className="person"><Avatar person={staffAvatar(p)}/><div><strong>{p.fullName}</strong><small className="cell-sub">{p.email}</small></div></div></td><td>{p.roleLabel} {p.customPermissions&&<span className="badge">Tùy chỉnh</span>}</td><td><Badge status={p.status}/></td><td className="muted">{p.lastLoginAt?new Date(p.lastLoginAt).toLocaleString('vi-VN'):'Chưa đăng nhập'}</td>{c.can('staff.manage')&&<td>{p.status==='ACTIVE'&&(!p.isPrimaryAdmin||user.isPrimaryAdmin)&&<button className="button" disabled={links[p.id]?.pending} onClick={()=>makeLink(p)}>Link đăng nhập</button>}{links[p.id]?.url&&<input className="login-link" readOnly value={links[p.id].url} onFocus={e=>e.target.select()} aria-label={`Link đăng nhập của ${p.fullName}, dùng 1 lần, hết hạn sau 10 phút`}/>}{links[p.id]?.error&&<small className="login-link-error" role="alert">{links[p.id].error}</small>}{!p.isPrimaryAdmin&&<button className="button" aria-label={`Sửa ${p.fullName}`} onClick={()=>c.setDrawer({type:'staff',staff:p,roles,catalog,user,onSaved:saved=>setStaff(current=>current.map(person=>person.id===saved.id?saved:person))})}>Sửa</button>}</td>}</tr>)}</tbody></table></div>:<Empty label={staff.length?'Không có kết quả phù hợp':'Chưa có nhân viên'} hint={staff.length?'Thử tìm theo tên hoặc email khác.':'Thêm nhân viên để cấp quyền truy cập cửa hàng.'}/>}</section></>
}
const auditFields={email:'Email',fullName:'Họ tên',phone:'Điện thoại',role:'Vai trò',status:'Trạng thái',reason:'Lý do',method:'Cách đăng nhập',expiresAt:'Hết hạn'};
const auditValues={ADMIN:'Admin',MANAGER:'Quản lý',STAFF:'Nhân viên',ACTIVE:'Đang hoạt động',DISABLED:'Tạm ngưng',not_staff:'Email chưa được cấp quyền',invalid_link:'Link đăng nhập không hợp lệ',link:'Link đăng nhập một lần',disabled:'Tài khoản tạm ngưng',unverified_email:'Email chưa xác minh',sub_mismatch:'Tài khoản Google không khớp'};
function auditValue(value,key){return value==null?'—':key==='expiresAt'?new Date(value).toLocaleString('vi-VN'):Array.isArray(value)?value.join(', ')||'Không có':typeof value==='boolean'?(value?'Có':'Không'):auditValues[value]||String(value)}
// One readable line per change; technical fields (id, timestamps) are left out, permissions are named in Vietnamese.
function auditDetails(item,labels){
 const after=item.after||{},before=item.before||{},name=key=>labels[key]||key;
 const lines=Object.entries(after).filter(([key])=>auditFields[key]).map(([key,value])=>`${auditFields[key]}: ${Object.hasOwn(before,key)?`${auditValue(before[key],key)} → `:''}${auditValue(value,key)}`);
 if(Object.hasOwn(before,'customPermissions')&&before.customPermissions!==after.customPermissions)lines.push(after.customPermissions?'Chuyển sang quyền riêng':'Chuyển về quyền mặc định của vai trò');
 if(Array.isArray(after.permissions)){
  if(Array.isArray(before.permissions)){
   const added=after.permissions.filter(key=>!before.permissions.includes(key)),removed=before.permissions.filter(key=>!after.permissions.includes(key));
   if(added.length)lines.push(`Thêm quyền: ${added.map(name).join(', ')}`);if(removed.length)lines.push(`Bỏ quyền: ${removed.map(name).join(', ')}`);
  }else lines.push(after.customPermissions?`Quyền riêng: ${after.permissions.map(name).join(', ')}`:`Quyền: mặc định của vai trò (${after.permissions.length} quyền)`);
 }
 return lines;
}
function AuditLogs(){
 const [filters,setFilters]=useState({action:'',actorId:'',page:1}),[actorId,setActorId]=useState(''),[data,setData]=useState({items:[],total:0,page:1,pageSize:25}),[loading,setLoading]=useState(true),[error,setError]=useState(''),[reload,setReload]=useState(0);
 useEffect(()=>{const abort=new AbortController();setLoading(true);setError('');listAuditLogs(filters,abort.signal).then(result=>{if(!abort.signal.aborted)setData(result)}).catch(error=>{if(!abort.signal.aborted)setError(error.message)}).finally(()=>{if(!abort.signal.aborted)setLoading(false)});return()=>abort.abort()},[filters,reload]);
 const pages=Math.max(1,Math.ceil(data.total/data.pageSize));
 return <section className="panel data-panel audit-panel"><PanelHeading title="Nhật ký thao tác" description="Lịch sử đăng nhập và quản lý nhân viên. Nhật ký được lưu theo thời hạn cấu hình của máy chủ."/><form className="table-toolbar audit-filters" onSubmit={e=>{e.preventDefault();setFilters({...filters,actorId,page:1})}}><label>Hành động<select value={filters.action} onChange={e=>setFilters({...filters,action:e.target.value,page:1})}><option value="">Tất cả hành động</option>{Object.entries(auditActions).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><label>Người thực hiện (mã nhân viên)<input type="number" min="1" max="2147483647" step="1" value={actorId} placeholder="Tất cả nhân viên" onChange={e=>setActorId(e.target.value)}/></label><button className="button" type="submit">Áp dụng</button><button className="button" type="button" onClick={()=>{setActorId('');setFilters({action:'',actorId:'',page:1})}}>Đặt lại</button></form>
 {loading?<p className="staff-message" role="status">Đang tải nhật ký…</p>:error?<div className="staff-message" role="alert"><p>{error}</p><button className="button" onClick={()=>setReload(reload+1)}>Thử lại</button></div>:<>{data.items.length?<div className="table-scroll"><table><thead><tr><th>Thời gian</th><th>Người thực hiện</th><th>Hành động</th><th>Chi tiết</th></tr></thead><tbody>{data.items.map(item=><tr key={item.id}><td className="audit-time">{new Date(item.createdAt).toLocaleString('vi-VN')}</td><td>{item.actorEmail||'Không xác định'}{item.actorId&&<small className="cell-sub">Mã nhân viên: {item.actorId}</small>}</td><td><span className={`badge ${item.action==='auth.login_denied'?'cancelled':item.action==='auth.login'?'completed':'pending'}`}><i/>{item.actionLabel}</span></td><td className="audit-details">{(lines=>lines.length?lines.map((line,index)=><div key={index}>{line}</div>):'—')(auditDetails(item,data.permissionLabels||{}))}</td></tr>)}</tbody></table></div>:<Empty label="Chưa có nhật ký phù hợp" hint="Thử đổi hành động hoặc mã nhân viên trong bộ lọc."/>}<div className="audit-pagination"><span>{data.total} thao tác · Trang {data.page}/{pages}</span><div><button className="button" disabled={data.page<=1} onClick={()=>setFilters({...filters,page:data.page-1})}>Trang trước</button><button className="button" disabled={data.page>=pages} onClick={()=>setFilters({...filters,page:data.page+1})}>Trang sau</button></div></div></>}
 </section>
}
function StaffForm({c,d}){
 const defaults=role=>d.roles.find(item=>item.role===role)?.permissions.map(p=>p.key)||[];
 const [draft,setDraft]=useState(()=>d.staff?{...d.staff}:{fullName:'',email:'',phone:'',role:'STAFF',status:'ACTIVE',permissions:defaults('STAFF')}),[saving,setSaving]=useState(false),[error,setError]=useState('');
 const change=(key,value)=>setDraft({...draft,[key]:value,...(key==='role'?{permissions:defaults(value)}:{})});const own=d.staff?.id===d.user.id;
 const locked=own||draft.role==='ADMIN'||saving;
 const toggle=(key,checked)=>change('permissions',checked?[...draft.permissions,key]:draft.permissions.filter(p=>p!==key));
 async function save(e){e.preventDefault();if(saving)return;setSaving(true);setError('');try{const data={fullName:draft.fullName,phone:draft.phone||null,role:draft.role,status:draft.status,...(!own?{permissions:draft.permissions}:{})};const result=d.staff?await updateStaff(d.staff.id,data):await createStaff({...data,email:draft.email});d.onSaved(result.staff);c.setDrawer(null);c.setToast('Đã lưu thông tin nhân viên.')}catch(error){setError(error.message)}finally{setSaving(false)}}
 return <form className="drawer-content" onSubmit={save}><div className="form-grid"><Field label="Họ tên *" wide><input required maxLength={120} value={draft.fullName} onChange={e=>change('fullName',e.target.value)}/></Field><Field label="Email Google *" wide><input type="email" required maxLength={191} disabled={!!d.staff} value={draft.email} onChange={e=>change('email',e.target.value)}/></Field><Field label="Số điện thoại" wide><input type="tel" maxLength={20} pattern="[0-9 +]*" value={draft.phone||''} onChange={e=>change('phone',e.target.value)}/></Field><Field label="Vai trò"><select disabled={own||(d.staff?.role==='ADMIN'&&d.user.role!=='ADMIN')} value={draft.role} onChange={e=>change('role',e.target.value)}>{d.staff?.role==='ADMIN'&&d.user.role!=='ADMIN'&&<option value="ADMIN" hidden>Admin</option>}{d.roles.filter(role=>role.role!=='ADMIN'||d.user.role==='ADMIN').map(role=><option key={role.role} value={role.role}>{role.label}</option>)}</select></Field><Field label="Trạng thái"><select disabled={own} value={draft.status} onChange={e=>change('status',e.target.value)}><option value="ACTIVE">Đang hoạt động</option><option value="DISABLED">Tạm ngưng</option></select></Field></div><div className="staff-permissions"><h3>Quyền truy cập</h3><div className="staff-permission-options">{d.catalog.map(permission=><label key={permission.key}><input type="checkbox" checked={draft.role==='ADMIN'||draft.permissions.includes(permission.key)} disabled={locked||!d.user.permissions.includes(permission.key)} onChange={e=>toggle(permission.key,e.target.checked)}/><span>{permission.label}</span></label>)}</div>{draft.role==='ADMIN'&&<p className="form-help">Admin luôn có toàn quyền</p>}<button type="button" className="button" disabled={locked} onClick={()=>change('permissions',defaults(draft.role))}>Dùng quyền mặc định của vai trò</button></div>{own&&<p className="form-help">Bạn không thể đổi vai trò hoặc tạm ngưng chính mình.</p>}{error&&<p role="alert" className="staff-error">{error}</p>}<div className="drawer-actions"><button type="button" className="button" disabled={saving} onClick={()=>c.setDrawer(null)}>Hủy</button><button type="submit" className="button primary" disabled={saving}>{saving?'Đang lưu…':'Lưu nhân viên'}</button></div></form>
}

function Settings({c}){const [draft,setDraft]=useState(c.store.settings);const change=(field,value)=>setDraft({...draft,[field]:value});return <section className="panel settings-panel"><PanelHeading title="Thông tin cửa hàng" description="Thông tin mẫu được lưu riêng trên trình duyệt này."/><form onSubmit={e=>{e.preventDefault();c.saveSettings(draft)}}><div className="form-grid"><Field label="Tên cửa hàng"><input required maxLength={80} value={draft.name} onChange={e=>change('name',e.target.value)}/></Field><Field label="Email liên hệ"><input type="email" required value={draft.email} onChange={e=>change('email',e.target.value)}/></Field><Field label="Số điện thoại"><input required value={draft.phone} onChange={e=>change('phone',e.target.value)}/></Field><Field label="Cảnh báo khi tồn kho dưới"><input type="number" required min="1" step="1" value={draft.lowStock} onChange={e=>change('lowStock',Number(e.target.value))}/></Field><Field label="Địa chỉ" wide><input value={draft.address} onChange={e=>change('address',e.target.value)}/></Field></div><div className="form-actions"><span>Chỉ áp dụng cho bản mẫu.</span><button className="button primary" type="submit"><Icon name="check" size={17}/> Lưu thay đổi</button></div></form></section>}
function Field({label,wide,children}){return <label className={`field ${wide?'wide':''}`}><span>{label}</span>{children}</label>}

// Bảo 2026-10-19: say when the catalog was last updated and nudge a reload when that sync failed or is over an hour old.
const syncedWhen=value=>{const date=value?new Date(value):null;return date&&!Number.isNaN(date.getTime())?`${date.toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})} ngày ${date.toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric'})}`:'—'};
const syncStale=value=>!value||Date.now()-new Date(value).getTime()>3600000;
function CatalogSearch({c}){
 const [q,setQ]=useState(''),[query,setQuery]=useState({q:'',page:1,pageSize:20});
 const [data,setData]=useState(null),[busy,setBusy]=useState(false),[syncing,setSyncing]=useState(false),[error,setError]=useState(''),[pageDraft,setPageDraft]=useState('1');
 const grid=useRef(null),syncRequest=useRef(null);
 useEffect(()=>()=>syncRequest.current?.abort(),[]);
 useEffect(()=>{
  // Results appear only after a search; an empty query shows the prompt instead of the whole catalog.
  if(!query.q){setData(null);setBusy(false);setError('');return;}
  const controller=new AbortController();setBusy(true);setError('');
  listCatalogProducts(query,controller.signal).then(result=>{
   if(controller.signal.aborted)return;
   setData(result);setPageDraft(String(result.page));
  }).catch(failure=>{if(!controller.signal.aborted)setError(failure.message||'Không tải được danh mục. Vui lòng thử lại.')})
   .finally(()=>{if(!controller.signal.aborted)setBusy(false)});
  return ()=>controller.abort();
 },[query]);
 useEffect(()=>{
  if(q.trim()===query.q)return;
  const timer=setTimeout(()=>setQuery(previous=>({...previous,q:q.trim(),page:1})),400);
  return ()=>clearTimeout(timer);
 },[q,query.q]);
 useEffect(()=>{
  if(!data?.syncing||busy)return;
  const timer=setTimeout(()=>setQuery(previous=>({...previous})),1500);
  return ()=>clearTimeout(timer);
 },[data,busy]);
 const navigate=page=>setQuery(previous=>({...previous,page}));
 const synchronize=async()=>{
  if(syncRequest.current&&!syncRequest.current.signal.aborted)return;
  const controller=new AbortController();syncRequest.current=controller;setSyncing(true);setError('');
  try{await syncCatalogProducts(controller.signal);if(!controller.signal.aborted)setQuery(previous=>({...previous}))}
  catch(failure){if(!controller.signal.aborted)setError(failure.message||'Không đồng bộ được danh mục. Vui lòng thử lại.')}
  finally{if(!controller.signal.aborted){setSyncing(false);syncRequest.current=null}}
 };
 const number=value=>value.toLocaleString('vi-VN');
 const syncingNow=syncing||data?.syncing;
 return <div className="catalog-search">
  <section className="panel catalog-controls"><div className="panel-heading catalog-heading"><h2>Tra cứu sản phẩm</h2><span aria-hidden="true">/</span><button className="catalog-reload" aria-label="Tải lại sản phẩm API" type="button" disabled={!!syncingNow} onClick={synchronize}>{syncingNow?'Đang tải lại…':'Tải lại sản phẩm API'}</button></div>
   <form onSubmit={event=>{event.preventDefault();setQuery(previous=>({...previous,q:q.trim(),page:1}))}}>
    {data&&!syncingNow&&(Object.values(data.sources).some(source=>source.status==='error')||syncStale(data.syncedAt))&&<p className="catalog-warning" role="status">{data.syncedAt?`Sản phẩm đang hiển thị được cập nhật lúc ${syncedWhen(data.syncedAt)}. Bấm "Tải lại sản phẩm API" để lấy sản phẩm mới nhất.`:'Chưa tải được sản phẩm từ KiotViet. Bấm "Tải lại sản phẩm API" để thử lại.'}</p>}
    <div className="catalog-query"><label className="search"><input autoFocus maxLength={200} aria-label="Tên hoặc SKU sản phẩm" placeholder="Nhập tên hoặc SKU…" value={q} onChange={event=>setQ(event.target.value)}/></label><button className="button primary" type="submit">Tìm</button></div>
    <div className="catalog-sync-status"><span>{data?`${number(data.catalogTotal??data.total)} sản phẩm`:busy?'Đang tải danh mục…':''}</span></div>
   </form>
  </section>
  {error&&<div className="catalog-message" role="alert"><p>{error}</p><button className="button" disabled={busy} onClick={()=>setQuery(previous=>({...previous}))}>Thử lại</button></div>}
  <div ref={grid} aria-live="polite" aria-busy={busy}>
   {busy&&!data&&<><p role="status">Đang đồng bộ sản phẩm từ KiotViet…</p><div className="catalog-grid">{Array.from({length:10},(_,index)=><div key={index} className="catalog-skeleton"><span/><span/><span/></div>)}</div></>}
   {data&&!data.items.length&&<Empty label="Không tìm thấy sản phẩm" hint="Thử tên hoặc SKU khác, hoặc đồng bộ lại danh mục."/>}
   {data&&<><div className="catalog-grid">{data.items.map(item=><button className="catalog-card" key={item.key} onClick={()=>c.setDrawer({type:'catalog',item,canViewCost:!!item.kiot?.inventories?.some(inventory=>Object.hasOwn(inventory,'cost'))})}>
    <CatalogImage src={item.image}/><div className="catalog-card-content"><strong>{item.name||'Chưa có tên'}</strong><small>{item.sku||'Chưa có SKU'}</small><b>{item.price===null?'Chưa có giá':money(item.price)}</b><div className="catalog-tags"><CatalogTrend name={item.name}/><CatalogStock quantity={item.onHand} lowStock={Number(c.store.settings.lowStock)}/></div></div>
   </button>)}</div>
   <div className="catalog-pagination">
    <label>Hiển thị <select aria-label="Số dòng mỗi trang" value={query.pageSize} onChange={event=>{setQuery(previous=>({...previous,pageSize:Number(event.target.value),page:1}))}}>{[15,20,30,50,100].map(size=><option key={size} value={size}>{size} dòng</option>)}</select></label>
    <div className="catalog-page-buttons"><button aria-label="Trang đầu" disabled={busy||data.page===1} onClick={()=>navigate(1)}>⏮</button><button aria-label="Trang trước" disabled={busy||data.page===1} onClick={()=>navigate(data.page-1)}>◀</button><form noValidate onSubmit={event=>{event.preventDefault();const page=Number(pageDraft);if(Number.isSafeInteger(page)&&page>=1)navigate(Math.min(page,data.pageCount));else setPageDraft(String(data.page))}}><input aria-label="Số trang" type="number" min="1" max={data.pageCount} value={pageDraft} onChange={event=>setPageDraft(event.target.value)}/></form><button aria-label="Trang sau" disabled={busy||data.page===data.pageCount} onClick={()=>navigate(data.page+1)}>▶</button><button aria-label="Trang cuối" disabled={busy||data.page===data.pageCount} onClick={()=>navigate(data.pageCount)}>⏭</button></div>
    <span>{number(data.total?(data.page-1)*data.pageSize+1:0)} - {number(Math.min(data.page*data.pageSize,data.total))} trong {number(data.total)} hàng hóa</span>
   </div></>}
  </div>
 </div>;
}

// Bảo 2026-10-19 (TASK-035): the Sale AI tool (D:\BaoQ-AI) runs beside this server (npm run dev) and is served at /sale-ai/
// on this same port (login + sale.manage). Its own pages keep every step: preview, update, rollback and history.
const saleAiUrl='/sale-ai/';
function SaleAi(){
 const [view,setView]=useState('results'),[status,setStatus]=useState('checking'),[attempt,setAttempt]=useState(0),[height,setHeight]=useState(900);
 const frame=useRef(null);
 // Sale AI reports its height and opened dialogs (cross-origin, so only by message): grow the frame, scroll to dialogs.
 useEffect(()=>{const onMessage=event=>{
  if(event.origin!==window.location.origin||event.source!==frame.current?.contentWindow)return;
  if(event.data?.type==='baoq-sale-ai-height'&&Number.isFinite(event.data.height))setHeight(Math.min(Math.max(Math.ceil(event.data.height),400),200000));
  if(event.data?.type==='baoq-sale-ai-dialog')frame.current.scrollIntoView({behavior:'smooth',block:'start'});
 };window.addEventListener('message',onMessage);return()=>window.removeEventListener('message',onMessage)},[]);
 useEffect(()=>{let alive=true;setStatus('checking');
  fetch(`${saleAiUrl}api/status?dataset=real`,{credentials:'include',cache:'no-store'}).then(response=>alive&&setStatus(response.ok?'ok':'down')).catch(()=>alive&&setStatus('down'));
  return()=>{alive=false}},[attempt]);
 const src=`${saleAiUrl}?view=${view}&dataset=real`,embedSrc=`${src}&embed=1`;
 return <section className="panel sale-ai">
  <div className="sale-ai-bar">
   <div className="sale-ai-tabs" role="group" aria-label="Màn hình Sale AI">{[['results','Bảng giá sale'],['history','Lịch sử']].map(([id,label])=><button key={id} type="button" className={`button ${view===id?'primary':''}`} aria-pressed={view===id} onClick={()=>{setView(id);setAttempt(n=>n+1)}}>{id==='history'&&<Icon name="clock" size={16}/>}{label}</button>)}</div>
  </div>
  {status==='down'?<div className="catalog-message" role="alert"><p>Sale AI chưa chạy. Chạy <code>npm run dev</code> tại D:\Website_3Q (tự bật Sale AI) hoặc mở shortcut BAOQ AI, rồi bấm Thử lại.</p><button className="button" onClick={()=>setAttempt(n=>n+1)}>Thử lại</button></div>
   :status==='ok'?<iframe ref={frame} key={`${embedSrc}#${attempt}`} className="sale-ai-frame" title="Sale AI" src={embedSrc} style={{height}}/>:<p className="catalog-sync-status">Đang kết nối Sale AI…</p>}
 </section>;
}

function CatalogImage({src}){
 const [failed,setFailed]=useState(null),[loaded,setLoaded]=useState(null);
 let safe=false;try{safe=new URL(src).protocol==='https:'}catch{}
 // Eager load with a pulse until the photo arrives: lazy loading left empty boxes that looked broken while scrolling.
 return <span className={`catalog-image${safe&&failed!==src&&loaded!==src?' is-loading':''}`}>{safe&&failed!==src?<img src={src} alt="" decoding="async" referrerPolicy="no-referrer" onLoad={()=>setLoaded(src)} onError={()=>setFailed(src)}/>:<span className="catalog-image-placeholder"><Icon name="box" size={32}/><small>Chưa có ảnh</small></span>}</span>;
}
// KiotViet marks hot-trend products with "!" in the product name (Bảo 2026-10-16).
const isHotTrend=name=>typeof name==='string'&&name.includes('!');
function CatalogTrend({name}){return isHotTrend(name)?<span className="badge shipping">Hot trend</span>:<span className="badge">Hàng thường</span>}
function CatalogStock({quantity,lowStock}){
 const status=quantity===null?'processing':quantity<=0?'cancelled':quantity<=lowStock?'pending':'completed';
 return <span className={`badge ${status}`}>{quantity===null?'Không quản lý tồn':quantity<=0?'Hết hàng':quantity<=lowStock?`Sắp hết · Tồn ${quantity}`:`Còn hàng · Tồn ${quantity}`}</span>;
}
function CatalogDetails({d}){
 const item=d.item,detail=item.kiot||item.sapo?{...item.sapo,...item.kiot}:item.detail||{};const [selected,setSelected]=useState(0);
 const images=item.images||detail.images||[];
 let webUrl=null;try{const url=new URL(item.sapo?.webUrl);if(url.protocol==='https:'&&/^[a-z0-9][a-z0-9-]*\.mysapo\.net$/i.test(url.hostname)&&!url.username&&!url.password)webUrl=url.href}catch{}
 const date=value=>{if(!value)return null;const parsed=new Date(value);return Number.isNaN(parsed.getTime())?null:parsed.toLocaleString('vi-VN')};
 // Sapo gives single-variant products a placeholder option "Title: Default Title"; it carries no information.
const noDefault=value=>value!=="Default Title";
const pairs=values=>(values||[]).filter(value=>value.name&&value.value&&noDefault(value.value)).map(value=>`${value.name}: ${value.value}`).join(' · ');
 const fields=[['Có trên',item.sources?.map(source=>source==='kiotviet'?'KiotViet':'Sapo').join(', ')],['SKU',item.sku],['Phân loại',isHotTrend(item.name)?'Hot trend':'Hàng thường'],['Mã vạch',detail.barcode],['Danh mục / Loại',detail.categoryName||detail.productType],['Thương hiệu',detail.tradeMarkName||detail.vendor],['Đơn vị',detail.unit],['Cân nặng',detail.weight?`${detail.weight}${detail.weightUnit?` ${detail.weightUnit}`:''}`:null],['Thuộc tính',pairs(detail.attributes?.length?detail.attributes:detail.options)],['Tags',detail.tags?.join(', ')],['Biến thể',noDefault(detail.variantTitle)?detail.variantTitle:null],['Có biến thể',detail.hasVariants==null?null:detail.hasVariants?'Có':'Không'],['Sản phẩm gốc',detail.masterProductId],['Ngày tạo',date(detail.createdDate||detail.createdOn)],['Cập nhật',date(detail.modifiedDate||detail.modifiedOn)],['Ngày đăng',date(detail.publishedOn)]];
 const plainDescription=input=>{
  const value=(input||'').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'').replace(/<\/(p|div|li|h[1-6])\s*>|<br\s*\/?>/gi,'\n').replace(/<[^>]*>/g,'');
  return typeof DOMParser==='undefined'?value:new DOMParser().parseFromString(value,'text/html').body.textContent||'';
 };
 const descriptions=item.kiot||item.sapo?[["Mô tả",item.kiot?.description],["Mô tả web",item.sapo?.description]]:[["Mô tả",detail.description]];
 const selling=(item.kiot||item.source==='kiotviet')?(detail.isActive===false||detail.allowsSale===false?'Ngừng bán':detail.isActive===true||detail.allowsSale===true?'Đang bán':'Chưa rõ'):detail.publishedOn?'Đang bán':'Ngừng bán';
 return <div className="drawer-content catalog-details">
  <div className="catalog-gallery"><CatalogImage src={images[selected]}/>{images.length>1&&<div className="catalog-thumbnails" aria-label="Chọn ảnh sản phẩm">{images.map((src,index)=><button key={src} aria-label={`Ảnh ${index+1}`} aria-pressed={selected===index} onClick={()=>setSelected(index)}><CatalogImage src={src}/></button>)}</div>}</div>
  <div className="catalog-detail-title"><h3>{item.name}</h3>{detail.fullName&&detail.fullName!==item.name&&<p>{detail.fullName}</p>}</div>
  <div className="catalog-numbers"><div><span>Giá bán</span><strong>{item.price===null?'Chưa có giá':money(item.price)}</strong>{detail.compareAtPrice!=null&&<del>{money(detail.compareAtPrice)}</del>}</div><div><span>Tồn tổng</span><strong>{item.onHand??'Không quản lý tồn'}</strong></div><div><span>Trạng thái</span><strong>{selling}</strong></div></div>
  <dl className="detail-list">{fields.filter(([,value])=>value!==null&&value!==undefined&&value!=='').map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
  {webUrl&&<a href={webUrl} target="_blank" rel="noopener noreferrer">Xem trên website Sapo</a>}
  {!!detail.inventories?.length&&<section><h3>Tồn theo chi nhánh</h3><div className="catalog-inventory-scroll" tabIndex={0} aria-label="Tồn theo chi nhánh"><table><thead><tr><th>Chi nhánh</th><th>Tồn</th><th>Đặt giữ</th>{d.canViewCost&&<th>Giá vốn</th>}</tr></thead><tbody>{detail.inventories.map((inventory,index)=><tr key={inventory.branchId??index}><td>{inventory.branchName||inventory.branchId||'Chưa có tên'}</td><td>{inventory.onHand??'—'}</td><td>{inventory.reserved??'—'}</td>{d.canViewCost&&<td>{inventory.cost==null?'—':money(inventory.cost)}</td>}</tr>)}</tbody></table></div></section>}
  {descriptions.map(([title,value])=>{const text=plainDescription(value).trim();return text?<section key={title}><h3>{title}</h3><p className="catalog-description">{text}</p></section>:null})}
 </div>;
}

function Drawer({c}){
 const ref=useRef(null),previousFocus=useRef(document.activeElement);
 useEffect(()=>{const previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';ref.current?.focus();return()=>{document.body.style.overflow=previousOverflow;previousFocus.current?.focus()}},[]);
 const d=c.drawer;const title={catalog:'Chi tiết sản phẩm',staff:d.staff?'Sửa nhân viên':'Thêm nhân viên',order:'Chi tiết đơn hàng',product:d.product?'Chỉnh sửa sản phẩm':'Thêm sản phẩm',customer:'Thông tin khách hàng'}[d.type];
 const trap=e=>{if(e.key!=='Tab')return;const nodes=ref.current.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]');const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&(document.activeElement===first||document.activeElement===ref.current)){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}};
 return <div className="drawer-overlay" onClick={()=>c.setDrawer(null)}><section className="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title" tabIndex={-1} ref={ref} onKeyDown={trap} onClick={e=>e.stopPropagation()}><div className="drawer-heading"><div><h2 id="drawer-title">{title}</h2><p>{d.type==='catalog'?'Dữ liệu trực tiếp · KiotViet':d.type==='staff'?'Tài khoản và quyền truy cập':'Dữ liệu bản mẫu'}</p></div><button className="icon-button" aria-label="Đóng chi tiết" onClick={()=>c.setDrawer(null)}><Icon name="close"/></button></div>{d.type==='catalog'?<CatalogDetails d={d}/>:d.type==='staff'?<StaffForm c={c} d={d}/>:d.type==='product'?<ProductForm c={c} product={d.product}/>:d.type==='order'?<OrderDetails order={d.order}/>:<CustomerDetails customer={d.customer}/>}</section></div>
}
function ProductForm({c,product}){const [draft,setDraft]=useState(product||{id:`SP${String(Math.max(...c.store.products.map(p=>Number(p.id.slice(2))||0),0)+1).padStart(3,'0')}`,name:'',category:'Thời trang',price:'',stock:'',sold:0,icon:'shirt',color:'lavender'});const change=(field,value)=>setDraft({...draft,[field]:value});return <form className="drawer-content" onSubmit={e=>{e.preventDefault();if(!draft.name.trim())return;c.saveProduct({...draft,name:draft.name.trim(),price:Number(draft.price),stock:Number(draft.stock)})}}><div className="product-preview"><ProductImage product={draft}/><div><strong>{draft.name||'Sản phẩm mới'}</strong><small>{draft.id}</small></div></div><div className="form-grid"><Field label="Tên sản phẩm" wide><input autoFocus required maxLength={100} value={draft.name} onChange={e=>change('name',e.target.value)}/></Field><Field label="Danh mục" wide><select value={draft.category} onChange={e=>{const category=e.target.value;setDraft({...draft,category,icon:category==='Thời trang'?'shirt':category==='Điện tử'?'headset':'bag'})}}>{['Thời trang','Phụ kiện','Điện tử'].map(x=><option key={x}>{x}</option>)}</select></Field><Field label="Giá bán (VND)"><input type="number" required min="1000" step="1000" value={draft.price} onChange={e=>change('price',e.target.value)}/></Field><Field label="Số lượng tồn kho"><input type="number" required min="0" step="1" value={draft.stock} onChange={e=>change('stock',e.target.value)}/></Field></div><p className="form-help">Bạn đang chỉnh dữ liệu mẫu. Sản phẩm được lưu trong trình duyệt, chưa gửi đến máy chủ.</p><div className="drawer-actions"><button type="button" className="button" onClick={()=>c.setDrawer(null)}>Hủy</button><button className="button primary" type="submit">Lưu sản phẩm</button></div></form>}
function OrderDetails({order:o}){return <div className="drawer-content"><div className="detail-title"><strong>#{o.id}</strong><Badge status={o.status}/></div><dl className="detail-list"><div><dt>Ngày tạo</dt><dd>{dateLabel(o.date)}</dd></div><div><dt>Kênh bán hàng</dt><dd>{o.channel}</dd></div><div><dt>Khách hàng</dt><dd>{o.customer.name}</dd></div><div><dt>Số điện thoại mẫu</dt><dd>{o.customer.phone}</dd></div></dl><h3>Sản phẩm trong đơn</h3>{o.items.map(p=><div className="order-item" key={p.id}><ProductImage product={p} small/><div><strong>{p.name}</strong><small>{p.quantity} × {money(p.price)}</small></div><strong>{money(p.price*p.quantity)}</strong></div>)}<div className="order-total"><span>Tổng thanh toán</span><strong>{money(o.total)}</strong></div><p className="form-help">Bản này dùng để duyệt giao diện. Thay đổi trạng thái và xử lý thanh toán sẽ được nối với backend sau.</p></div>}
function CustomerDetails({customer:p}){return <div className="drawer-content"><div className="customer-profile"><Avatar person={p}/><h3>{p.name}</h3><span className="muted">{p.id}</span></div><dl className="detail-list"><div><dt>Email</dt><dd>{p.email}</dd></div><div><dt>Số điện thoại</dt><dd>{p.phone}</dd></div><div><dt>Tổng đơn hàng mẫu</dt><dd>{p.orders}</dd></div><div><dt>Tổng chi tiêu mẫu</dt><dd>{money(p.spent)}</dd></div></dl><p className="form-help">Thông tin khách hàng là dữ liệu hư cấu để duyệt giao diện.</p></div>}
function Help({onClose}){const ref=useRef(null);useEffect(()=>{const prev=document.activeElement;ref.current?.focus();return()=>prev?.focus()},[]);return <div className="drawer-overlay" onClick={onClose}><section className="help-dialog" role="dialog" aria-modal="true" aria-labelledby="help-title" ref={ref} tabIndex={-1} onKeyDown={e=>{if(e.key==='Escape')onClose();if(e.key==='Tab'){e.preventDefault();ref.current.querySelector('button')?.focus()}}} onClick={e=>e.stopPropagation()}><div className="drawer-heading"><h2 id="help-title">Khám phá bản quản trị</h2><button className="icon-button" aria-label="Đóng hướng dẫn" onClick={onClose}><Icon name="close"/></button></div><div className="help-content"><p>Chọn menu bên trái để chuyển màn hình.</p><p><strong>Tìm kiếm:</strong> tra sản phẩm KiotViet thật: giá, tồn, ảnh.</p><p><strong>Sale AI:</strong> tính giá sale và cập nhật Kiot + Sapo; Lịch sử có xem lỗi và khôi phục.</p><p><strong>Nhân viên:</strong> thêm, sửa tài khoản và quyền.</p><p><strong>Nhật ký:</strong> xem ai đã làm gì, lúc nào.</p></div></section></div>}
