import {useEffect,useState,type FormEvent} from 'react';
import {listStaff,listRoles,createStaff,updateStaff,createLoginLink,type Staff,type StaffRole} from './api/staff';
import {auditActions,listAuditLogs,type AuditItem} from './api/audit';
import {showToast} from './ui';
import Sheet from './sheet';
import BandAction from './band-action';
import type {User} from './auth';
// Điều hành → Nhân viên, Nhật ký (Bảo 2026-10-27): the old admin's pages, same API and rules, Webstie look.
type Permission={key:string;label:string};
type Editing={staff:Staff|null}|null;
export const initials=(name:string)=>(words=>words.length>1?words[0][0]+words.at(-1)![0]:words[0].slice(0,2))(name.trim().split(/\s+/)).toUpperCase();

export function Team({user}:{user:User}){
 const [staff,setStaff]=useState<Staff[]>([]),[roles,setRoles]=useState<StaffRole[]>([]),[catalog,setCatalog]=useState<Permission[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[reload,setReload]=useState(0);
 const [search,setSearch]=useState(''),[editing,setEditing]=useState<Editing>(null);
 const manage=user.permissions.includes('staff.manage');
 useEffect(()=>{const abort=new AbortController();setLoading(true);setError('');Promise.all([listStaff(abort.signal),listRoles(abort.signal)]).then(([people,options])=>{if(!abort.signal.aborted){setStaff(people.staff);setRoles(options.roles);setCatalog(options.catalog)}}).catch(failure=>{if(!abort.signal.aborted)setError(failure.message)}).finally(()=>{if(!abort.signal.aborted)setLoading(false)});return()=>abort.abort()},[reload]);
 // Bảo 2026-10-20: one-time sign-in link for a laptop on the shop wifi (opened by IP, where Google sign-in is refused).
 const [links,setLinks]=useState<Record<number,{pending?:boolean;url?:string;error?:string}>>({});
 async function makeLink(p:Staff){setLinks(l=>({...l,[p.id]:{pending:true}}));try{const link=await createLoginLink(p.id);setLinks(l=>({...l,[p.id]:link}));navigator.clipboard?.writeText(link.url).then(()=>showToast(`Đã chép link đăng nhập cho ${p.fullName}. Dùng 1 lần, hết hạn sau 10 phút.`),()=>{})}catch(failure){setLinks(l=>({...l,[p.id]:{error:(failure as Error).message}}))}}
 const team=staff.filter(p=>`${p.fullName} ${p.roleLabel} ${p.email}`.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi')));
 return <section className="ws-stack">
  <div className="ws-searchbar"><input className="ws-input" aria-label="Tìm nhân viên, vai trò" placeholder="Tìm nhân viên, vai trò…" value={search} onChange={e=>setSearch(e.target.value)}/>
</div>
  {manage&&<BandAction><button className="btn btn-primary-dark" type="button" disabled={loading||!!error} onClick={()=>setEditing({staff:null})}>Thêm nhân viên</button></BandAction>}
  {loading?<p className="ws-muted" role="status">Đang tải nhân viên…</p>:error?<div className="ws-msg" role="alert"><p>{error}</p><button className="btn btn-secondary" type="button" onClick={()=>setReload(reload+1)}>Thử lại</button></div>
  :team.length?<div className="card ws-table"><div className="table-scroll"><table className="table"><thead><tr><th>Thành viên</th><th>Vai trò</th><th>Trạng thái</th><th>Đăng nhập gần nhất</th>{manage&&<th>Thao tác</th>}</tr></thead><tbody>{team.map(p=><tr key={p.id}>
   <td><span className="ws-person"><span className="ws-avatar" aria-hidden="true">{initials(p.fullName)}</span><span><strong>{p.fullName}</strong><small>{p.email}</small></span></span></td>
   <td>{p.roleLabel} {p.customPermissions&&<span className="pill">Tùy chỉnh</span>}</td>
   <td><span className={`pill ${p.status==='ACTIVE'?'is-ok':'is-danger'}`}>{p.status==='ACTIVE'?'Đang hoạt động':'Tạm ngưng'}</span></td>
   <td className="ws-muted">{p.lastLoginAt?new Date(p.lastLoginAt).toLocaleString('vi-VN'):'Chưa đăng nhập'}</td>
   {manage&&<td><span className="ws-actions">{p.status==='ACTIVE'&&(!p.isPrimaryAdmin||user.isPrimaryAdmin)&&<button className="btn btn-secondary btn-sm" type="button" disabled={links[p.id]?.pending} onClick={()=>makeLink(p)}>Link đăng nhập</button>}
    {!p.isPrimaryAdmin&&<button className="btn btn-secondary btn-sm" type="button" aria-label={`Sửa ${p.fullName}`} onClick={()=>setEditing({staff:p})}>Sửa</button>}</span>
    {links[p.id]?.url&&<input className="ws-input ws-link" readOnly value={links[p.id].url} onFocus={e=>e.target.select()} aria-label={`Link đăng nhập của ${p.fullName}, dùng 1 lần, hết hạn sau 10 phút`}/>}
    {links[p.id]?.error&&<small className="ws-error" role="alert">{links[p.id].error}</small>}</td>}
  </tr>)}</tbody></table></div></div>
  :<div className="ws-empty"><strong>{staff.length?'Không có kết quả phù hợp':'Chưa có nhân viên'}</strong><p>{staff.length?'Thử tìm theo tên hoặc email khác.':'Thêm nhân viên để cấp quyền truy cập cửa hàng.'}</p></div>}
  {editing&&<Sheet title={editing.staff?'Sửa nhân viên':'Thêm nhân viên'} sub="Tài khoản Google và quyền truy cập" onClose={()=>setEditing(null)}>
   <StaffForm staff={editing.staff} roles={roles} catalog={catalog} user={user} onClose={()=>setEditing(null)} onSaved={saved=>setStaff(current=>editing.staff?current.map(person=>person.id===saved.id?saved:person):[...current,saved])}/></Sheet>}
 </section>;
}

function StaffForm({staff,roles,catalog,user,onClose,onSaved}:{staff:Staff|null;roles:StaffRole[];catalog:Permission[];user:User;onClose:()=>void;onSaved:(saved:Staff)=>void}){
 const defaults=(role:string)=>roles.find(item=>item.role===role)?.permissions.map(p=>p.key)||[];
 const [draft,setDraft]=useState(()=>staff?{...staff}:{fullName:'',email:'',phone:'' as string|null,role:'STAFF',status:'ACTIVE' as Staff['status'],permissions:defaults('STAFF')}),[saving,setSaving]=useState(false),[error,setError]=useState('');
 const change=(key:string,value:unknown)=>setDraft({...draft,[key]:value,...(key==='role'?{permissions:defaults(value as string)}:{})});const own=staff?.id===user.id;
 const locked=own||draft.role==='ADMIN'||saving;
 const toggle=(key:string,checked:boolean)=>change('permissions',checked?[...draft.permissions,key]:draft.permissions.filter(p=>p!==key));
 async function save(e:FormEvent){e.preventDefault();if(saving)return;setSaving(true);setError('');try{const data={fullName:draft.fullName,phone:draft.phone||null,role:draft.role,status:draft.status,...(!own?{permissions:draft.permissions}:{})};const result=staff?await updateStaff(staff.id,data):await createStaff({...data,email:draft.email});onSaved(result.staff);onClose();showToast('Đã lưu thông tin nhân viên.')}catch(failure){setError((failure as Error).message)}finally{setSaving(false)}}
 const adminLocked=staff?.role==='ADMIN'&&user.role!=='ADMIN';
 return <form className="ws-form" onSubmit={save}>
  <div className="field"><label htmlFor="sf-name">Họ tên *</label><input id="sf-name" required maxLength={120} value={draft.fullName} onChange={e=>change('fullName',e.target.value)}/></div>
  <div className="field"><label htmlFor="sf-email">Email Google *</label><input id="sf-email" type="email" required maxLength={191} disabled={!!staff} value={draft.email} onChange={e=>change('email',e.target.value)}/></div>
  <div className="field"><label htmlFor="sf-phone">Số điện thoại</label><input id="sf-phone" type="tel" maxLength={20} pattern="[0-9 +]*" value={draft.phone||''} onChange={e=>change('phone',e.target.value)}/></div>
  <div className="fields">
   <div className="field"><label htmlFor="sf-role">Vai trò</label><select id="sf-role" disabled={own||adminLocked} value={draft.role} onChange={e=>change('role',e.target.value)}>{adminLocked&&<option value="ADMIN" hidden>Admin</option>}{roles.filter(role=>role.role!=='ADMIN'||user.role==='ADMIN').map(role=><option key={role.role} value={role.role}>{role.label}</option>)}</select></div>
   <div className="field"><label htmlFor="sf-status">Trạng thái</label><select id="sf-status" disabled={own} value={draft.status} onChange={e=>change('status',e.target.value)}><option value="ACTIVE">Đang hoạt động</option><option value="DISABLED">Tạm ngưng</option></select></div>
  </div>
  <fieldset className="ws-perms"><legend>Quyền truy cập</legend>{catalog.map(permission=><label key={permission.key} className="check"><input type="checkbox" checked={draft.role==='ADMIN'||draft.permissions.includes(permission.key)} disabled={locked||!user.permissions.includes(permission.key)} onChange={e=>toggle(permission.key,e.target.checked)}/><span>{permission.label}</span></label>)}
   {draft.role==='ADMIN'&&<p className="ws-muted">Admin luôn có toàn quyền.</p>}
   <button type="button" className="btn btn-secondary btn-sm" disabled={locked} onClick={()=>change('permissions',defaults(draft.role))}>Dùng quyền mặc định của vai trò</button></fieldset>
  {own&&<p className="ws-muted">Bạn không thể đổi vai trò hoặc tạm ngưng chính mình.</p>}
  {error&&<p className="ws-error" role="alert">{error}</p>}
  <div className="ws-form-actions"><button type="button" className="btn btn-secondary" disabled={saving} onClick={onClose}>Hủy</button><button type="submit" className="btn btn-primary" disabled={saving}>{saving?'Đang lưu…':'Lưu nhân viên'}</button></div>
 </form>;
}

const auditFields:Record<string,string>={email:'Email',fullName:'Họ tên',phone:'Điện thoại',role:'Vai trò',status:'Trạng thái',reason:'Lý do',method:'Cách đăng nhập',expiresAt:'Hết hạn'};
const auditValues:Record<string,string>={ADMIN:'Admin',MANAGER:'Quản lý',STAFF:'Nhân viên',ACTIVE:'Đang hoạt động',DISABLED:'Tạm ngưng',not_staff:'Email chưa được cấp quyền',invalid_link:'Link đăng nhập không hợp lệ',link:'Link đăng nhập một lần',disabled:'Tài khoản tạm ngưng',unverified_email:'Email chưa xác minh',sub_mismatch:'Tài khoản Google không khớp'};
function auditValue(value:unknown,key:string){return value==null?'—':key==='expiresAt'?new Date(value as string).toLocaleString('vi-VN'):Array.isArray(value)?value.join(', ')||'Không có':typeof value==='boolean'?(value?'Có':'Không'):auditValues[value as string]||String(value)}
// One readable line per change; technical fields (id, timestamps) are left out, permissions are named in Vietnamese.
function auditDetails(item:AuditItem,labels:Record<string,string>){
 const after=item.after||{},before=item.before||{},name=(key:string)=>labels[key]||key;
 const lines=Object.entries(after).filter(([key])=>auditFields[key]).map(([key,value])=>`${auditFields[key]}: ${Object.hasOwn(before,key)?`${auditValue(before[key],key)} → `:''}${auditValue(value,key)}`);
 if(Object.hasOwn(before,'customPermissions')&&before.customPermissions!==after.customPermissions)lines.push(after.customPermissions?'Chuyển sang quyền riêng':'Chuyển về quyền mặc định của vai trò');
 if(Array.isArray(after.permissions)){
  const now=after.permissions as string[];
  if(Array.isArray(before.permissions)){
   const was=before.permissions as string[];
   const added=now.filter(key=>!was.includes(key)),removed=was.filter(key=>!now.includes(key));
   if(added.length)lines.push(`Thêm quyền: ${added.map(name).join(', ')}`);if(removed.length)lines.push(`Bỏ quyền: ${removed.map(name).join(', ')}`);
  }else lines.push(after.customPermissions?`Quyền riêng: ${now.map(name).join(', ')}`:`Quyền: mặc định của vai trò (${now.length} quyền)`);
 }
 return lines;
}
export function AuditLogs(){
 const [filters,setFilters]=useState({action:'',actorId:'',page:1}),[actorId,setActorId]=useState(''),[data,setData]=useState<{items:AuditItem[];total:number;page:number;pageSize:number;permissionLabels?:Record<string,string>}>({items:[],total:0,page:1,pageSize:25}),[loading,setLoading]=useState(true),[error,setError]=useState(''),[reload,setReload]=useState(0);
 useEffect(()=>{const abort=new AbortController();setLoading(true);setError('');listAuditLogs(filters,abort.signal).then(result=>{if(!abort.signal.aborted)setData(result)}).catch(failure=>{if(!abort.signal.aborted)setError(failure.message)}).finally(()=>{if(!abort.signal.aborted)setLoading(false)});return()=>abort.abort()},[filters,reload]);
 const pages=Math.max(1,Math.ceil(data.total/data.pageSize));
 return <section className="ws-stack">
  <form className="ws-searchbar" onSubmit={e=>{e.preventDefault();setFilters({...filters,actorId,page:1})}}>
   <select className="select" aria-label="Hành động" value={filters.action} onChange={e=>setFilters({...filters,action:e.target.value,page:1})}><option value="">Tất cả hành động</option>{Object.entries(auditActions).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select>
   <input className="ws-input ws-narrow" type="number" min="1" max="2147483647" step="1" aria-label="Người thực hiện (mã nhân viên)" value={actorId} placeholder="Mã nhân viên" onChange={e=>setActorId(e.target.value)}/>
   <button className="btn btn-primary" type="submit">Áp dụng</button><button className="btn btn-secondary" type="button" onClick={()=>{setActorId('');setFilters({action:'',actorId:'',page:1})}}>Đặt lại</button>
  </form>
  <p className="ws-muted">Lịch sử đăng nhập và quản lý nhân viên. Nhật ký được lưu theo thời hạn cấu hình của máy chủ.</p>
  {loading?<p className="ws-muted" role="status">Đang tải nhật ký…</p>:error?<div className="ws-msg" role="alert"><p>{error}</p><button className="btn btn-secondary" type="button" onClick={()=>setReload(reload+1)}>Thử lại</button></div>:<>
   {data.items.length?<div className="card ws-table"><div className="table-scroll"><table className="table"><thead><tr><th>Thời gian</th><th>Người thực hiện</th><th>Hành động</th><th>Chi tiết</th></tr></thead><tbody>{data.items.map(item=><tr key={item.id}>
    <td className="ws-nowrap">{new Date(item.createdAt).toLocaleString('vi-VN')}</td>
    <td>{item.actorEmail||'Không xác định'}{item.actorId&&<small className="ws-sub">Mã nhân viên: {item.actorId}</small>}</td>
    <td><span className={`pill ${item.action==='auth.login_denied'?'is-danger':item.action==='auth.login'?'is-ok':'is-caution'}`}>{item.actionLabel}</span></td>
    <td className="ws-details">{(lines=>lines.length?lines.map((line,index)=><div key={index}>{line}</div>):'—')(auditDetails(item,data.permissionLabels||{}))}</td></tr>)}</tbody></table></div></div>
   :<div className="ws-empty"><strong>Chưa có nhật ký phù hợp</strong><p>Thử đổi hành động hoặc mã nhân viên trong bộ lọc.</p></div>}
   <div className="ps-pager"><span>{data.total} thao tác · Trang {data.page}/{pages}</span><span className="ws-actions"><button className="btn btn-secondary btn-sm" type="button" disabled={data.page<=1} onClick={()=>setFilters({...filters,page:data.page-1})}>Trang trước</button><button className="btn btn-secondary btn-sm" type="button" disabled={data.page>=pages} onClick={()=>setFilters({...filters,page:data.page+1})}>Trang sau</button></span></div>
  </>}
 </section>;
}
