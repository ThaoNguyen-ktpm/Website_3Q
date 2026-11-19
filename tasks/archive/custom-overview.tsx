import {useEffect,useRef,useState,type ReactNode} from 'react';
import {money,compact,Icon,Chev} from './ui';
import {summaries,type GoodsSummary,type KpiSummary} from './v2-modules';
// Tổng quan tùy chỉnh (V2 handoff 2026-11-01, dashView/DB in baoq-mockup-v2.src.html): an ordered list of block ids,
// edited as a draft (add / remove / up / down / reset) and saved in this browser only (same key and shape as V2).
// Blocks keep their own source and period: Điều hành demo, Hàng hóa demo, KPI snapshot; never added together.
const DKEY='baoq-dash-layout-v1';
const GROUPS:[string,string][]=[['ops','Điều hành (demo)'],['kpi','KPI Sale'],['gd','Hàng hóa'],['inventory','Hiệu quả vốn']];
export const DASH_DEFAULT=['ops.revenue','ops.cost','ops.result','ops.inventory','ops.weekly','ops.alerts','ops.channel','ops.sale','ops.bridge','ops.costmix','ops.note'];
type Size='tile'|'card'|'wide';
type Block={g:string;z:Size;ti:string;d:string;need?:'goods'|'kpi';html?:(x:never)=>ReactNode};
const pc1=(v:number)=>isFinite(v)?new Intl.NumberFormat('vi-VN',{minimumFractionDigits:1,maximumFractionDigits:1}).format(v)+'%':'—';
const dd=(s:string)=>{const a=String(s).split('-');return a[2]+'/'+a[1]};
const asOf=(c:string)=>{const m=/^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)/.exec(c||'');return m?`${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}`:''};
const gTag=(g:GoodsSummary)=>`Demo ${dd(g.period.from)}–${dd(g.period.to)}/${g.period.to.slice(0,4)}`;
const kTag=(k:KpiSummary)=>`Snapshot ${dd(k.period[0])}–${dd(k.period[1])}/${k.period[0].slice(0,4)} · as-of ${asOf(k.capturedAt)} · chính sách 11 mô phỏng`;
const calc=(g:GoodsSummary)=>g.calc.split('-').reverse().join('/');
const cmp=(v:number)=>compact(v,'vi');
const tile=(label:string,icon:string,value:string,ctx:string,href:string,text=false)=><article className="kcard"><div className="ktop"><span className="klabel">{label}</span><span className="kicon"><Icon name={icon}/></span></div>
 <p className={`kvalue${text?' is-text':''}`}>{value}</p><p className="kctx">{ctx}</p><a className="link-btn klink" href={href} aria-label={`Xem chi tiết: ${label}`}>Xem chi tiết<Chev/></a></article>;
const DB:Record<string,Block>={
 'ops.revenue':{g:'ops',z:'tile',ti:'Doanh thu thuần',d:'Doanh thu của dữ liệu demo điều hành.'},
 'ops.cost':{g:'ops',z:'tile',ti:'Tổng chi phí',d:'Tổng chi phí demo và tỷ lệ trên doanh thu.'},
 'ops.result':{g:'ops',z:'tile',ti:'Kết quả demo',d:'Kết quả demo sau chi phí.'},
 'ops.inventory':{g:'ops',z:'tile',ti:'Giá trị tồn demo',d:'Giá trị tồn kho trong dữ liệu demo.'},
 'ops.weekly':{g:'ops',z:'wide',ti:'Doanh thu & kết quả theo tuần',d:'Doanh thu và kết quả theo tuần.'},
 'ops.alerts':{g:'ops',z:'card',ti:'Cần xử lý',d:'Cảnh báo cần xử lý trước.'},
 'ops.channel':{g:'ops',z:'card',ti:'Đóng góp theo kênh',d:'Tỷ trọng doanh thu theo kênh (demo điều hành).'},
 'ops.sale':{g:'ops',z:'card',ti:'Đóng góp theo sale',d:'Tỷ trọng doanh thu theo sale (demo điều hành).'},
 'ops.bridge':{g:'ops',z:'card',ti:'Từ doanh thu đến kết quả',d:'Cầu nối từ doanh thu tới kết quả.'},
 'ops.costmix':{g:'ops',z:'card',ti:'Cơ cấu chi phí',d:'Cơ cấu chi phí.'},
 'ops.note':{g:'ops',z:'card',ti:'Ghi chú hoa hồng',d:'Ghi chú về cách tính hoa hồng.'},
 'kpi.income':{g:'kpi',z:'tile',need:'kpi',ti:'Hoa hồng / thưởng đã xác minh',d:'Tổng khoản đã đủ bằng chứng trong snapshot, không phải thu nhập cả tháng.',
  html:(k:KpiSummary)=>tile('Hoa hồng / thưởng đã xác minh','sale',k.totals.known?money(k.totals.amount):'Chưa đủ dữ liệu',`${kTag(k)}. Mẫu một phần, chưa phải toàn bộ thu nhập; lương cơ bản chưa cấu hình.`,'#page=kpi',!k.totals.known)},
 'kpi.sales':{g:'kpi',z:'tile',need:'kpi',ti:'Doanh số bán tạm tính',d:'Doanh số các đơn đủ bằng chứng trong snapshot.',
  html:(k:KpiSummary)=>tile('Doanh số bán tạm tính','sale',cmp(k.totals.verifiedSales),`${kTag(k)} · ${k.coverage.ordersRead}/${k.coverage.ordersTotal} đơn đọc chi tiết`,'#page=kpi&k_view=list&k_kind=selling&k_state=provisional')},
 'kpi.pending':{g:'kpi',z:'tile',need:'kpi',ti:'Chờ xác minh',d:'Số chứng từ chưa đủ căn cứ để tính.',
  html:(k:KpiSummary)=>tile('Chờ xác minh','sale',String(k.counts.pending),`${kTag(k)} · chưa tính vào thu nhập`,'#page=kpi&k_view=todo')},
 'kpi.team':{g:'kpi',z:'card',need:'kpi',ti:'Thu nhập từng sale',d:'Từng sale: khoản đã xác minh hoặc "Chưa đủ dữ liệu". Không xếp hạng, không cộng chung.',
  html:(k:KpiSummary)=><section className="card" aria-label="Thu nhập từng sale"><div className="card-head"><h3>Thu nhập từng sale</h3><a className="link-btn" href="#page=kpi">Xem chi tiết<Chev/></a><p>{kTag(k)}. Mẫu một phần; lương cơ bản chưa cấu hình.</p></div>
   <ul className="dash-list">{k.sales.map(x=><li key={x.name}><a href={`#page=kpi&k_view=sale&k_sale=${encodeURIComponent(x.name)}`}><span className="who">{x.name}</span><span className={`val ${x.total.known?'num':'is-miss'}`}>{x.total.known?money(x.total.amount):'Chưa đủ dữ liệu'}</span></a></li>)}</ul></section>},
 'gd.revenue':{g:'gd',z:'tile',need:'goods',ti:'Doanh thu bán (demo)',d:'Doanh thu giá bán thực tế, mọi kênh trong kỳ demo.',
  html:(g:GoodsSummary)=>tile('Doanh thu bán (demo)','inventory',cmp(g.sold.rev),`${gTag(g)} · mọi kênh`,'#page=kpi&k_view=channels')},
 'gd.orders':{g:'gd',z:'tile',need:'goods',ti:'Số đơn bán (demo)',d:'Số đơn không trùng, mọi kênh trong kỳ demo.',
  html:(g:GoodsSummary)=>tile('Số đơn bán (demo)','inventory',String(g.sold.orders),`${gTag(g)} · ${g.sold.items} dòng hàng`,'#page=kpi&k_view=channels')},
 'gd.channels':{g:'gd',z:'card',need:'goods',ti:'Tỷ trọng kênh bán',d:'Doanh thu theo kênh, mọi kênh, không chịu bộ lọc của Hàng hóa.',
  html:(g:GoodsSummary)=>{const top=Math.max(...g.channels.map(c=>c.rev));return <section className="card" aria-label="Tỷ trọng kênh bán"><div className="card-head"><h3>Tỷ trọng kênh bán</h3><a className="link-btn" href="#page=kpi&k_view=channels">Xem chi tiết<Chev/></a><p>{gTag(g)} · 100% = {cmp(g.sold.rev)} doanh thu mọi kênh.</p></div>
   <ul className="hbars">{g.channels.map(c=><li key={c.c}><a href="#page=kpi&k_view=channels" aria-label={`${c.c} ${cmp(c.rev)}`}><span className="who">{c.c}</span><span className="track"><span className="fill rev" style={{width:`${(c.rev/top*100).toFixed(2)}%`}}/></span><span className="val num">{cmp(c.rev)}<small>{pc1(c.rev/g.sold.rev*100)}</small></span></a></li>)}</ul></section>}},
 'gd.stock':{g:'gd',z:'tile',need:'goods',ti:'Số món tồn',d:'Số món tồn hiện tại trong dữ liệu demo.',
  html:(g:GoodsSummary)=>tile('Số món tồn','inventory',String(g.stock.items),`Demo · tồn tính tại ${calc(g)}, không phải kỳ bán · ${g.stock.consign} ký gửi, ${g.stock.items-g.stock.consign} mua đứt`,'#page=goods&g_scope=ton')},
 'cap.capital':{g:'inventory',z:'tile',need:'goods',ti:'Vốn nằm trong tồn',d:'Vốn của hàng mua đứt có giá vốn.',
  html:(g:GoodsSummary)=>tile('Vốn nằm trong tồn','inventory',cmp(g.stock.ownCost),`Demo · tồn tính tại ${calc(g)}, không phải kỳ bán · hàng mua đứt, ${g.stock.own} món theo giá vốn`,'#page=goods&g_scope=ton')},
 'cap.m6':{g:'inventory',z:'tile',need:'goods',ti:'% vốn ở tuổi M6+',d:'Phần vốn tồn từ 210 ngày trở lên.',
  html:(g:GoodsSummary)=>tile('% vốn ở tuổi M6+','inventory',pc1(g.stock.m6pct),`Demo · tồn tính tại ${calc(g)}, không phải kỳ bán · tuổi từ ngày sẵn sàng bán ≥ 210 ngày`,'#page=goods&g_scope=ton')},
 'cap.roc':{g:'inventory',z:'tile',need:'goods',ti:'Lãi gộp ÷ vốn',d:'Hiệu quả vốn của hàng mua đứt đã bán.',
  html:(g:GoodsSummary)=>tile('Lãi gộp ÷ vốn','inventory',pc1(g.sold.roc),`${gTag(g)} · chỉ hàng mua đứt, có giá vốn`,'#page=goods')},
 'cap.days':{g:'inventory',z:'tile',need:'goods',ti:'Ngày bán TB',d:'Số ngày trung bình từ sẵn sàng bán tới bán.',
  html:(g:GoodsSummary)=>tile('Ngày bán TB','inventory',isFinite(g.sold.days)?new Intl.NumberFormat('vi-VN',{maximumFractionDigits:1}).format(g.sold.days)+' ngày':'—',`${gTag(g)} · ${g.sold.daysN} dòng có ngày sẵn sàng`,'#page=goods')},
};
const sanitize=(ids:unknown)=>{const seen=new Set<string>(),out:string[]=[];if(Array.isArray(ids))for(const id of ids)if(typeof id==='string'&&DB[id]&&!seen.has(id)){seen.add(id);out.push(id)}return out};
function loadSaved(){try{const j=JSON.parse(localStorage.getItem(DKEY)||'null');if(j&&j.v===1&&Array.isArray(j.ids))return sanitize(j.ids)}catch{}return [...DASH_DEFAULT]}
function persist(ids:string[]){try{localStorage.setItem(DKEY,JSON.stringify({v:1,ids}));return true}catch{return false}}
type Src<D>={st:'idle'|'loading'|'ready'|'error';data?:D};

/** ops: the existing Điều hành overview pieces keyed by block id (rendered by Overview with its own data and charts). */
export function CustomOverview({ops}:{ops:Record<string,ReactNode>}){
 const [saved,setSaved]=useState(loadSaved),[draft,setDraft]=useState<string[]|null>(null),[cat,setCat]=useState(false),[persisted,setPersisted]=useState(true),[msg,setMsg]=useState('');
 const [src,setSrc]=useState<{goods:Src<GoodsSummary>;kpi:Src<KpiSummary>}>({goods:{st:'idle'},kpi:{st:'idle'}});
 const editHead=useRef<HTMLHeadingElement>(null),editBtn=useRef<HTMLButtonElement>(null);
 const ids=draft||saved,edit=!!draft;
 const ensure=(kind:'goods'|'kpi')=>{setSrc(s=>s[kind].st==='idle'?{...s,[kind]:{st:'loading'}}:s)};
 useEffect(()=>{new Set(ids.map(i=>DB[i].need).filter(Boolean) as ('goods'|'kpi')[]).forEach(ensure)},[ids]);
 useEffect(()=>{(['goods','kpi'] as const).forEach(kind=>{if(src[kind].st!=='loading')return;
  (summaries[kind] as ()=>Promise<GoodsSummary|KpiSummary>)().then(data=>setSrc(s=>({...s,[kind]:{st:'ready',data}}))).catch(()=>setSrc(s=>({...s,[kind]:{st:'error'}})))})},[src.goods.st,src.kpi.st]);
 useEffect(()=>{if(edit)editHead.current?.focus()},[edit]);
 const block=(id:string):ReactNode=>{const b=DB[id];if(!b.need)return ops[id];const s=src[b.need];
  if(s.st==='ready')return (b.html as (x:unknown)=>ReactNode)(s.data);
  if(s.st==='error')return <section className="card"><h3>{b.ti}</h3><p className="dash-miss">Không tải được nguồn {b.need==='kpi'?'KPI Sale':'Hàng hóa'}. Dữ liệu không đổi, chỉ chưa hiển thị được.</p><button className="btn btn-secondary" type="button" onClick={()=>setSrc(x=>({...x,[b.need!]:{st:'loading'}}))}>Thử lại</button></section>;
  return <section className="card dash-skel" aria-busy="true"><h3>{b.ti}</h3><p className="mod-loading" role="status">Đang tải…</p></section>};
 const move=(id:string,dir:-1|1)=>{if(!draft)return;const i=draft.indexOf(id),j=i+dir;if(i<0||j<0||j>=draft.length)return;const n=[...draft];[n[i],n[j]]=[n[j],n[i]];setDraft(n);setMsg(`${DB[id].ti}: vị trí ${j+1} trên ${n.length}.`)};
 const save=()=>{if(!draft)return;const ok=persist(draft);setPersisted(ok);setSaved(draft);setDraft(null);setCat(false);setMsg(ok?'Đã lưu bố cục trong trình duyệt này.':'Không lưu được vào trình duyệt này; bố cục chỉ giữ trong phiên.');requestAnimationFrame(()=>editBtn.current?.focus())};
 const cancel=()=>{setDraft(null);setCat(false);setMsg('Đã hủy, giữ bố cục đã lưu.');requestAnimationFrame(()=>editBtn.current?.focus())};
 return <div onKeyDown={e=>{if(e.key==='Escape'&&cat){setCat(false);e.preventDefault()}}}>
  {!edit&&<div className="dash-top"><button ref={editBtn} className="btn btn-secondary" type="button" aria-expanded={false} onClick={()=>{setDraft([...saved]);setCat(false)}}>Tùy chỉnh tổng quan</button></div>}
  {edit&&<section className="card dash-bar" aria-labelledby="dash-bar-h"><div className="card-head"><h2 id="dash-bar-h" ref={editHead} tabIndex={-1}>Tùy chỉnh tổng quan</h2><p>Thêm, bớt và sắp xếp các khối nhỏ. Bố cục lưu trong trình duyệt này, chưa đồng bộ theo tài khoản.</p></div>
   <div className="dash-actions"><button className="btn btn-primary" type="button" onClick={save}>Lưu bố cục</button><button className="btn btn-secondary" type="button" onClick={cancel}>Hủy</button>
    <button className="btn btn-secondary" type="button" aria-expanded={cat} aria-controls="dash-cat" onClick={()=>setCat(!cat)}>Thêm khối</button>
    <button className="ghost-btn" type="button" onClick={()=>{setDraft([...DASH_DEFAULT]);setMsg('Đã đặt lại bản nháp về mặc định. Bấm Lưu bố cục để áp dụng, hoặc Hủy để giữ bố cục cũ.')}}>Khôi phục mặc định</button></div>
   {cat&&<div className="dash-cat" id="dash-cat"><h3 className="vh">Danh mục khối</h3>{GROUPS.map(([g,label])=><section key={g} aria-labelledby={`dcg-${g}`}><h4 id={`dcg-${g}`}>{label}</h4><ul>{Object.keys(DB).filter(k=>DB[k].g===g).map(k=>{const has=ids.includes(k);
    return <li key={k}><div><b>{DB[k].ti}</b><span>{DB[k].d}</span></div><button className="btn btn-secondary" type="button" disabled={has} aria-label={`${has?'Đã có':'Thêm'} khối ${DB[k].ti}`} onClick={()=>{setDraft([...ids,k]);setMsg(`Đã thêm ${DB[k].ti} vào cuối tổng quan.`)}}>{has?'Đã có':'Thêm'}</button></li>})}</ul></section>)}</div>}</section>}
  {!ids.length&&<section className="card empty" aria-live="polite"><h2>Tổng quan đang trống</h2><p>Chưa có khối nào. Thêm khối từ danh mục hoặc dùng bố cục mặc định.</p>
   <div className="dash-actions">{edit?<><button className="btn btn-primary" type="button" onClick={()=>setCat(true)}>Thêm khối</button><button className="btn btn-secondary" type="button" onClick={()=>setDraft([...DASH_DEFAULT])}>Dùng bố cục mặc định</button></>
    :<><button className="btn btn-primary" type="button" onClick={()=>setDraft([...saved])}>Tùy chỉnh tổng quan</button><button className="btn btn-secondary" type="button" onClick={()=>{try{localStorage.removeItem(DKEY)}catch{}setSaved([...DASH_DEFAULT])}}>Dùng bố cục mặc định</button></>}</div></section>}
  {ids.length>0&&<><h2 className="vh">Các khối tổng quan</h2><div className="dash-grid">{ids.map((id,i)=>{const b=DB[id];
   return <div key={id} className={`dash-item dash-${b.z}${edit?' is-edit':''}`} data-bid={id}><div className="dash-blk">{block(id)}</div>
    {edit&&<div className="dash-ctl" role="group" aria-label={`Sắp xếp: ${b.ti}`}><button className="btn btn-secondary" type="button" disabled={i===0} aria-label={`Chuyển ${b.ti} lên trước`} onClick={()=>move(id,-1)}>↑ Lên</button>
     <button className="btn btn-secondary" type="button" disabled={i===ids.length-1} aria-label={`Chuyển ${b.ti} xuống sau`} onClick={()=>move(id,1)}>↓ Xuống</button>
     <button className="btn btn-secondary" type="button" aria-label={`Gỡ ${b.ti} khỏi tổng quan`} onClick={()=>{setDraft(ids.filter(x=>x!==id));setMsg(`Đã gỡ ${b.ti}.`)}}>Gỡ</button></div>}</div>})}</div></>}
  <p className="dash-note">Các khối có kỳ và nguồn riêng: demo điều hành, demo Hàng hóa 01–21/10/2026 và snapshot KPI Sale 26–30/10/2026 (chính sách 11 mô phỏng). Không cộng chung và không phải số thật. {persisted?'Bố cục lưu trong trình duyệt này, chưa đồng bộ theo tài khoản.':<b>Không lưu được vào trình duyệt này (lưu trữ bị chặn): bố cục chỉ giữ trong phiên.</b>}</p>
  <p className="vh" role="status" aria-live="polite">{msg}</p></div>;
}
