import {useEffect,useRef,useState} from 'react';
import {listCatalogProducts,syncCatalogProducts,type CatalogDetail,type CatalogProductsResponse,type MergedCatalogItem} from './api/catalog';
import {money} from './ui';
import Sheet from './sheet';
import BandAction from './band-action';
// Price System (Bảo 2026-10-27): the old admin's Sale AI and Tìm kiếm pages, same API and behaviour, Webstie look.

// Bảo 2026-10-19 (TASK-035): Sale AI runs inside the web server and is served at /sale-ai/
// on the same origin (login + sale.manage). Its own pages keep every step: preview, update, rollback and history.
const saleAiUrl='/sale-ai/';
export function SaleAi(){
 const [view,setView]=useState('results'),[status,setStatus]=useState('checking'),[attempt,setAttempt]=useState(0),[height,setHeight]=useState(900);
 const frame=useRef<HTMLIFrameElement>(null);
 // Sale AI reports its height and opened dialogs (only by message): grow the frame, scroll to dialogs.
 useEffect(()=>{const onMessage=(event:MessageEvent)=>{
  if(event.origin!==window.location.origin||event.source!==frame.current?.contentWindow)return;
  if(event.data?.type==='baoq-sale-ai-height'&&Number.isFinite(event.data.height))setHeight(Math.min(Math.max(Math.ceil(event.data.height),400),200000));
  if(event.data?.type==='baoq-sale-ai-dialog')frame.current?.scrollIntoView({behavior:'smooth',block:'start'});
 };window.addEventListener('message',onMessage);return()=>window.removeEventListener('message',onMessage)},[]);
 useEffect(()=>{let alive=true;setStatus('checking');
  fetch(`${saleAiUrl}api/status?dataset=real`,{credentials:'include',cache:'no-store'}).then(response=>alive&&setStatus(response.ok?'ok':'down')).catch(()=>alive&&setStatus('down'));
  return()=>{alive=false}},[attempt]);
 const embedSrc=`${saleAiUrl}?view=${view}&dataset=real&embed=1&theme=walnut`;
 return <section className="ws-stack">
  <div className="seg" role="group" aria-label="Màn hình Sale AI">{[['results','Bảng giá sale'],['history','Lịch sử']].map(([id,label])=><button key={id} type="button" aria-pressed={view===id} onClick={()=>{setView(id);setAttempt(n=>n+1)}}>{label}</button>)}</div>
  {status==='down'?<div className="ws-msg" role="alert"><p>Sale AI tạm thời không khả dụng. Vui lòng thử lại.</p><button className="btn btn-secondary" type="button" onClick={()=>setAttempt(n=>n+1)}>Thử lại</button></div>
   :status==='ok'?<iframe ref={frame} key={`${embedSrc}#${attempt}`} className="ws-frame" title="Sale AI" src={embedSrc} style={{height}}/>:<p className="ws-muted" role="status">Đang kết nối Sale AI…</p>}
 </section>;
}

const LOW_STOCK=10;
const syncedWhen=(value:string|null)=>{const date=value?new Date(value):null;return date&&!Number.isNaN(date.getTime())?`${date.toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})} ngày ${date.toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric'})}`:'—'};
const syncStale=(value:string|null)=>!value||Date.now()-new Date(value).getTime()>3600000;
const number=(value:number)=>value.toLocaleString('vi-VN');
const price=(value:number|null)=>value===null?'Chưa có giá':money(value);
export function CatalogSearch(){
 const [q,setQ]=useState(''),[query,setQuery]=useState({q:'',page:1,pageSize:20});
 const [data,setData]=useState<CatalogProductsResponse|null>(null),[busy,setBusy]=useState(false),[syncing,setSyncing]=useState(false),[error,setError]=useState(''),[pageDraft,setPageDraft]=useState('1');
 const [open,setOpen]=useState<MergedCatalogItem|null>(null);
 const syncRequest=useRef<AbortController|null>(null);
 useEffect(()=>()=>syncRequest.current?.abort(),[]);
 useEffect(()=>{
  // Results appear only after a search; an empty query shows the prompt instead of the whole catalog.
  if(!query.q){setData(null);setBusy(false);setError('');return;}
  const controller=new AbortController();setBusy(true);setError('');
  listCatalogProducts(query,controller.signal).then(result=>{if(controller.signal.aborted)return;setData(result);setPageDraft(String(result.page))})
   .catch(failure=>{if(!controller.signal.aborted)setError(failure.message||'Không tải được danh mục. Vui lòng thử lại.')})
   .finally(()=>{if(!controller.signal.aborted)setBusy(false)});
  return ()=>controller.abort();
 },[query]);
 useEffect(()=>{if(q.trim()===query.q)return;const timer=setTimeout(()=>setQuery(previous=>({...previous,q:q.trim(),page:1})),400);return ()=>clearTimeout(timer)},[q,query.q]);
 useEffect(()=>{if(!data?.syncing||busy)return;const timer=setTimeout(()=>setQuery(previous=>({...previous})),1500);return ()=>clearTimeout(timer)},[data,busy]);
 const navigate=(page:number)=>setQuery(previous=>({...previous,page}));
 const synchronize=async()=>{
  if(syncRequest.current&&!syncRequest.current.signal.aborted)return;
  const controller=new AbortController();syncRequest.current=controller;setSyncing(true);setError('');
  try{await syncCatalogProducts(controller.signal);if(!controller.signal.aborted)setQuery(previous=>({...previous}))}
  catch(failure){if(!controller.signal.aborted)setError((failure as Error).message||'Không đồng bộ được danh mục. Vui lòng thử lại.')}
  finally{if(!controller.signal.aborted){setSyncing(false);syncRequest.current=null}}
 };
 const syncingNow=syncing||data?.syncing;
 return <div className="ws-stack">
  <form className="ws-searchbar" onSubmit={event=>{event.preventDefault();setQuery(previous=>({...previous,q:q.trim(),page:1}))}}>
   <input className="ws-input" autoFocus maxLength={200} aria-label="Tên hoặc SKU sản phẩm" placeholder="Nhập tên hoặc SKU…" value={q} onChange={event=>setQ(event.target.value)}/>
   <button className="btn btn-primary" type="submit">Tìm</button>
  </form>
  <BandAction><button className="btn btn-ghost-dark" type="button" disabled={!!syncingNow} onClick={synchronize}>{syncingNow?'Đang tải lại…':'Tải lại sản phẩm API'}</button></BandAction>
  {data&&!syncingNow&&(Object.values(data.sources).some(source=>source.status==='error')||syncStale(data.syncedAt))&&<p className="ws-note" role="status">{data.syncedAt?`Sản phẩm đang hiển thị được cập nhật lúc ${syncedWhen(data.syncedAt)}. Bấm "Tải lại sản phẩm API" để lấy sản phẩm mới nhất.`:'Chưa tải được sản phẩm từ KiotViet. Bấm "Tải lại sản phẩm API" để thử lại.'}</p>}
  {data?<p className="ws-chips"><span>{number(data.catalogTotal??data.total)} sản phẩm</span><span>Cập nhật {syncedWhen(data.syncedAt)}</span></p>:!busy&&!error&&<p className="ws-muted">Nhập tên hoặc SKU để tra sản phẩm trên KiotViet và web Sapo.</p>}
  {error&&<div className="ws-msg" role="alert"><p>{error}</p><button className="btn btn-secondary" type="button" disabled={busy} onClick={()=>setQuery(previous=>({...previous}))}>Thử lại</button></div>}
  <div aria-live="polite" aria-busy={busy}>
   {busy&&!data&&<div className="ps-grid">{Array.from({length:8},(_,index)=><div key={index} className="ps-card is-skeleton"><span className="ps-img"/><span/><span/></div>)}</div>}
   {data&&!data.items.length&&<div className="ws-empty"><strong>Không tìm thấy sản phẩm</strong><p>Thử tên hoặc SKU khác, hoặc tải lại sản phẩm API.</p></div>}
   {data&&!!data.items.length&&<><div className="ps-grid">{data.items.map(item=><button className="ps-card" type="button" key={item.key} onClick={()=>setOpen(item)}>
    <CatalogImage src={item.image}/><strong>{item.name||'Chưa có tên'}</strong><small>{item.sku||'Chưa có SKU'}</small><b>{price(item.price)}</b><span className="ps-tags"><CatalogTrend name={item.name}/><CatalogStock quantity={item.onHand}/></span>
   </button>)}</div>
   <div className="ps-pager">
    <label>Hiển thị <select className="select" aria-label="Số dòng mỗi trang" value={query.pageSize} onChange={event=>setQuery(previous=>({...previous,pageSize:Number(event.target.value),page:1}))}>{[15,20,30,50,100].map(size=><option key={size} value={size}>{size} dòng</option>)}</select></label>
    <div className="ps-pages"><button type="button" aria-label="Trang đầu" disabled={busy||data.page===1} onClick={()=>navigate(1)}>«</button><button type="button" aria-label="Trang trước" disabled={busy||data.page===1} onClick={()=>navigate(data.page-1)}>‹</button>
     <form noValidate onSubmit={event=>{event.preventDefault();const page=Number(pageDraft);if(Number.isSafeInteger(page)&&page>=1)navigate(Math.min(page,data.pageCount));else setPageDraft(String(data.page))}}><input aria-label="Số trang" type="number" min="1" max={data.pageCount} value={pageDraft} onChange={event=>setPageDraft(event.target.value)}/></form>
     <button type="button" aria-label="Trang sau" disabled={busy||data.page===data.pageCount} onClick={()=>navigate(data.page+1)}>›</button><button type="button" aria-label="Trang cuối" disabled={busy||data.page===data.pageCount} onClick={()=>navigate(data.pageCount)}>»</button></div>
    <span>{number(data.total?(data.page-1)*data.pageSize+1:0)} – {number(Math.min(data.page*data.pageSize,data.total))} trong {number(data.total)} hàng hóa</span>
   </div></>}
  </div>
  {open&&<Sheet title={open.name||'Chưa có tên'} sub="Chi tiết sản phẩm · KiotViet / Sapo" onClose={()=>setOpen(null)}><CatalogDetails item={open} canViewCost={!!open.kiot?.inventories?.some(inventory=>Object.hasOwn(inventory,'cost'))}/></Sheet>}
 </div>;
}

function CatalogImage({src}:{src:string|null|undefined}){
 const [failed,setFailed]=useState<string|null>(null),[loaded,setLoaded]=useState<string|null>(null);
 let safe=false;try{safe=new URL(src||'').protocol==='https:'}catch{}
 // Eager load with a pulse until the photo arrives: lazy loading left empty boxes that looked broken while scrolling.
 return <span className={`ps-img${safe&&failed!==src&&loaded!==src?' is-loading':''}`}>{safe&&failed!==src?<img src={src!} alt="" decoding="async" referrerPolicy="no-referrer" onLoad={()=>setLoaded(src!)} onError={()=>setFailed(src!)}/>:<small>Chưa có ảnh</small>}</span>;
}
// KiotViet marks hot-trend products with "!" in the product name (Bảo 2026-10-16).
const isHotTrend=(name:string)=>typeof name==='string'&&name.includes('!');
function CatalogTrend({name}:{name:string}){return isHotTrend(name)?<span className="pill is-warm">Hot trend</span>:<span className="pill">Hàng thường</span>}
function CatalogStock({quantity}:{quantity:number|null}){
 const tone=quantity===null?'':quantity<=0?' is-danger':quantity<=LOW_STOCK?' is-caution':' is-ok';
 return <span className={`pill${tone}`}>{quantity===null?'Không quản lý tồn':quantity<=0?'Hết hàng':quantity<=LOW_STOCK?`Sắp hết · Tồn ${quantity}`:`Còn hàng · Tồn ${quantity}`}</span>;
}
// Sapo gives single-variant products a placeholder option "Title: Default Title"; it carries no information.
const noDefault=(value:unknown)=>value!=='Default Title';
const pairs=(values?:{name:string|null;value:string|null}[])=>(values||[]).filter(value=>value.name&&value.value&&noDefault(value.value)).map(value=>`${value.name}: ${value.value}`).join(' · ');
const plainDescription=(input?:string|null)=>{
 const value=(input||'').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'').replace(/<\/(p|div|li|h[1-6])\s*>|<br\s*\/?>/gi,'\n').replace(/<[^>]*>/g,'');
 return new DOMParser().parseFromString(value,'text/html').body.textContent||'';
};
function CatalogDetails({item,canViewCost}:{item:MergedCatalogItem;canViewCost:boolean}){
 const detail:CatalogDetail=item.kiot||item.sapo?{...item.sapo,...item.kiot} as CatalogDetail:{images:[]};const [selected,setSelected]=useState(0);
 const images=item.images||detail.images||[];
 let webUrl:string|null=null;try{const url=new URL(item.sapo?.webUrl||'');if(url.protocol==='https:'&&/^[a-z0-9][a-z0-9-]*\.mysapo\.net$/i.test(url.hostname)&&!url.username&&!url.password)webUrl=url.href}catch{}
 const date=(value?:string|null)=>{if(!value)return null;const parsed=new Date(value);return Number.isNaN(parsed.getTime())?null:parsed.toLocaleString('vi-VN')};
 const fields:[string,unknown][]=[['Có trên',item.sources?.map(source=>source==='kiotviet'?'KiotViet':'Sapo').join(', ')],['SKU',item.sku],['Phân loại',isHotTrend(item.name)?'Hot trend':'Hàng thường'],['Mã vạch',detail.barcode],['Danh mục / Loại',detail.categoryName||detail.productType],['Thương hiệu',detail.tradeMarkName||detail.vendor],['Đơn vị',detail.unit],['Cân nặng',detail.weight?`${detail.weight}${detail.weightUnit?` ${detail.weightUnit}`:''}`:null],['Thuộc tính',pairs(detail.attributes?.length?detail.attributes:detail.options)],['Tags',detail.tags?.join(', ')],['Biến thể',noDefault(detail.variantTitle)?detail.variantTitle:null],['Có biến thể',detail.hasVariants==null?null:detail.hasVariants?'Có':'Không'],['Sản phẩm gốc',detail.masterProductId],['Ngày tạo',date(detail.createdDate||detail.createdOn)],['Cập nhật',date(detail.modifiedDate||detail.modifiedOn)],['Ngày đăng',date(detail.publishedOn)]];
 const descriptions:[string,string|null|undefined][]=[['Mô tả',item.kiot?.description],['Mô tả web',item.sapo?.description]];
 const selling=item.kiot?(detail.isActive===false||detail.allowsSale===false?'Ngừng bán':detail.isActive===true||detail.allowsSale===true?'Đang bán':'Chưa rõ'):detail.publishedOn?'Đang bán':'Ngừng bán';
 return <div className="ps-detail">
  <div className="ps-gallery"><CatalogImage src={images[selected]}/>{images.length>1&&<div className="ps-thumbs" aria-label="Chọn ảnh sản phẩm">{images.map((src,index)=><button type="button" key={src} aria-label={`Ảnh ${index+1}`} aria-pressed={selected===index} onClick={()=>setSelected(index)}><CatalogImage src={src}/></button>)}</div>}</div>
  {detail.fullName&&detail.fullName!==item.name&&<p className="ws-muted">{detail.fullName}</p>}
  <div className="ps-numbers"><div><span>Giá bán</span><strong>{price(item.price)}</strong>{detail.compareAtPrice!=null&&<del>{money(detail.compareAtPrice)}</del>}</div><div><span>Tồn tổng</span><strong>{item.onHand??'Không quản lý tồn'}</strong></div><div><span>Trạng thái</span><strong>{selling}</strong></div></div>
  <dl className="facts">{fields.filter(([,value])=>value!==null&&value!==undefined&&value!=='').map(([label,value])=><div key={label} style={{display:'contents'}}><dt>{label}</dt><dd>{String(value)}</dd></div>)}</dl>
  {webUrl&&<p><a className="text-link" href={webUrl} target="_blank" rel="noopener noreferrer">Xem trên website Sapo</a></p>}
  {!!detail.inventories?.length&&<section><h3>Tồn theo chi nhánh</h3><div className="table-scroll" tabIndex={0} aria-label="Tồn theo chi nhánh"><table className="table"><thead><tr><th>Chi nhánh</th><th className="r">Tồn</th><th className="r">Đặt giữ</th>{canViewCost&&<th className="r">Giá vốn</th>}</tr></thead><tbody>{detail.inventories.map((inventory,index)=><tr key={inventory.branchId??index}><td>{inventory.branchName||inventory.branchId||'Chưa có tên'}</td><td className="r">{inventory.onHand??'—'}</td><td className="r">{inventory.reserved??'—'}</td>{canViewCost&&<td className="r">{inventory.cost==null?'—':money(inventory.cost)}</td>}</tr>)}</tbody></table></div></section>}
  {descriptions.map(([title,value])=>{const text=plainDescription(value).trim();return text?<section key={title}><h3>{title}</h3><p className="ps-description">{text}</p></section>:null})}
 </div>;
}
