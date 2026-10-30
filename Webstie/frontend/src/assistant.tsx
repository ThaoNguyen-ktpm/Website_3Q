import {useEffect,useRef,useState} from 'react';
// Trợ lý BaoQ and the BossTele (Telegram) button (Bảo 2026-10-27): the old admin's widget, same /api/assistant/chat, Webstie look.
type Source={kind:string;label:string};
type Product={sku:string;name:string;price:number|null;onHand:number|null;reserved?:number|null;hotTrend:boolean;image:string|null};
type Message={role:'user'|'assistant';content:string;time:string;greeting?:boolean;error?:boolean;retry?:string;sources?:Source[];products?:Product[];suggestions?:string[]};

async function askAssistant(messages:{role:string;content:string}[],signal:AbortSignal):Promise<{reply:string;sources:Source[];products?:Product[];suggestions?:string[]}>{
 const response=await fetch('/api/assistant/chat',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',cache:'no-store',body:JSON.stringify({messages:messages.slice(-10)}),signal});
 const data=await response.json().catch(()=>null);
 if(!response.ok)throw Error(data?.error?.message??'Không thể kết nối trợ lý. Vui lòng thử lại.');
 if(typeof data?.reply!=='string'||!Array.isArray(data.sources))throw Error('Phản hồi trợ lý không hợp lệ. Vui lòng thử lại.');
 return data;
}
// The reply already lists the details; show one short provenance line instead of repeating every item.
const sourceNames:Record<string,string>={price:'công thức tính giá BossTele',guide:'hướng dẫn sử dụng',staff:'danh sách nhân viên',audit:'nhật ký thao tác'};
function sourceSummary(sources:Source[]){
 const count=(kind:string)=>sources.filter(s=>s.kind===kind).length,parts:string[]=[],products=sources.filter(s=>s.kind==='product');
 if(products.length===1)parts.push(`KiotViet · ${products[0].label.split(' · ')[0]}`);else if(products.length)parts.push(`KiotViet · ${products.length} sản phẩm`);
 if(count('document'))parts.push(`${count('document')} đoạn tài liệu`);
 for(const [kind,name] of Object.entries(sourceNames))if(count(kind))parts.push(name);
 return parts.join(', ');
}
const vnd=(value:number|null)=>value==null?'Chưa có giá':`${value.toLocaleString('vi-VN')}đ`;
const timestamp=()=>new Date().toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'});
const Arrow=()=><svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M4 10h11M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const X=()=><svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>;

function ProductCard({product}:{product:Product}){
 const [broken,setBroken]=useState(false);
 // Bảo 2026-10-20: a customer's deposit (Kiot đặt hàng) holds the item.
 const stock=product.onHand==null?['Không quản lý tồn','']:product.onHand<=0?['Hết hàng','is-out']
  :(product.reserved||0)>=product.onHand?['Đang giữ cho khách','is-out']:[`Còn ${product.onHand}${product.reserved?` · giữ ${product.reserved}`:''}`,'is-in'];
 return <li className="ast-product">
  {product.image&&!broken?<img src={product.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={()=>setBroken(true)}/>:<span className="ast-thumb" aria-hidden="true"/>}
  <div><strong title={product.name}>{product.name}</strong><small>{product.sku}</small>
   <span className="ast-meta"><b>{vnd(product.price)}</b><em className={stock[1]}>{stock[0]}</em>{product.hotTrend&&<em className="is-hot">Hot</em>}</span></div>
 </li>;
}

const suggestions=['SP000094 còn hàng không?','Hàng hot trend có những món nào?','Thêm nhân viên ở đâu?'];
export default function Assistant({page,telegram}:{page:string;telegram:boolean}){
 const [open,setOpen]=useState(false),[messages,setMessages]=useState<Message[]>(()=>[{role:'assistant',greeting:true,content:'Chào bạn, mình có thể giúp gì cho bạn?',time:timestamp()}]);
 const [draft,setDraft]=useState(''),[pending,setPending]=useState(false);
 const input=useRef<HTMLTextAreaElement>(null),launcher=useRef<HTMLButtonElement>(null),transcript=useRef<HTMLDivElement>(null),request=useRef<AbortController|null>(null);
 const cancel=()=>{request.current?.abort();request.current=null;setPending(false)};
 const close=()=>{cancel();setOpen(false);launcher.current?.focus()};
 useEffect(()=>{if(open)input.current?.focus();const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'&&open){e.preventDefault();close()}};window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape)},[open]);
 useEffect(()=>{cancel();return()=>request.current?.abort()},[page]);
 useEffect(()=>{if(transcript.current)transcript.current.scrollTop=transcript.current.scrollHeight},[messages,pending,open]);
 async function send(text=draft,retry=false){
  const content=text.trim();if(!content||content.length>2000||request.current)return;
  const history=messages.filter(m=>!m.error&&!m.greeting);
  const next:Message[]=retry?history:[...history,{role:'user',content,time:timestamp()}];
  setMessages(current=>retry?current.filter(m=>!m.error):[...current.filter(m=>!m.error),next.at(-1)!]);
  setDraft('');setPending(true);const abort=new AbortController();request.current=abort;
  try{
   const result=await askAssistant(next.map(({role,content})=>({role,content:content.slice(0,2000)})),abort.signal);
   if(!abort.signal.aborted)setMessages(current=>[...current,{role:'assistant',content:result.reply,sources:result.sources,products:Array.isArray(result.products)?result.products:[],suggestions:Array.isArray(result.suggestions)?result.suggestions.filter(s=>typeof s==='string').slice(0,3):[],time:timestamp()}]);
  }catch(error){
   if(!abort.signal.aborted)setMessages(current=>[...current,{role:'assistant',content:(error as Error).message,error:true,retry:content,time:timestamp()}]);
  }finally{if(request.current===abort){request.current=null;setPending(false);input.current?.focus()}}
 }
 const last=messages.filter(m=>!m.error&&!m.greeting).at(-1);
 return <div className="ast">
  {open&&<section className="ast-panel" role="region" aria-label="Trợ lý BaoQ">
   <header className="ast-head"><h2>Trợ lý BaoQ</h2><button type="button" className="ast-icon" aria-label="Thu nhỏ trợ lý" onClick={close}><X/></button></header>
   <div className="ast-log" ref={transcript} role="log" aria-live="polite" aria-relevant="additions text">
    {messages.map((m,i)=><div key={i} className={`ast-msg ${m.role==='user'?'from-user':'from-bot'}${m.error?' is-error':''}`}>
     <div className="ast-text">{m.content.split(/\n+/).filter(line=>line.trim()).map((line,j)=><p key={j}>{line}</p>)}</div>
     {!!m.suggestions?.length&&<div className="ast-suggest">{m.suggestions.map(s=><button type="button" disabled={pending} key={s} onClick={()=>send(s)}>{s}<Arrow/></button>)}</div>}
     {!!m.products?.length&&<ul className="ast-products">{m.products.map(p=><ProductCard key={p.sku} product={p}/>)}</ul>}
     {!!m.sources?.length&&<p className="ast-sources">Nguồn: {sourceSummary(m.sources)}</p>}
     <time>{m.time}</time>
     {m.error&&<button className="ast-retry" type="button" disabled={pending} onClick={()=>send(m.retry,true)}>Thử lại</button>}
    </div>)}
    {messages.length===1&&<div className="ast-suggest">{suggestions.map(s=><button type="button" disabled={pending} key={s} onClick={()=>send(s)}>{s}<Arrow/></button>)}</div>}
    {pending&&<p className="ast-wait" role="status">Đang trả lời…</p>}
    {!pending&&last?.role==='user'&&!messages.at(-1)?.error&&<button className="ast-retry" type="button" onClick={()=>send(last.content,true)}>Tiếp tục câu hỏi</button>}
   </div>
   <form className="ast-compose" onSubmit={e=>{e.preventDefault();send()}}>
    <label className="vh" htmlFor="ast-input">Câu hỏi cho Trợ lý BaoQ</label>
    <textarea id="ast-input" ref={input} value={draft} maxLength={2000} rows={2} placeholder="Nhập câu hỏi…" onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();send()}}}/>
    <button type="submit" aria-label="Gửi câu hỏi" disabled={pending||!draft.trim()}><Arrow/></button>
   </form>
  </section>}
  {/* Bảo 2026-10-21: only Admin accounts get the way into BossTele (the bot gives full rights). */}
  {telegram&&!open&&<a className="ast-fab ast-telegram" href="https://web.telegram.org/k/#@BaoQ_bot" target="_blank" rel="noopener noreferrer" aria-label="Hỏi BossTele trên Telegram" title="Hỏi BossTele trên Telegram">
   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m21.5 3.5-19 7.3 6.6 2.4 2.5 7.3 3.6-4.6 4.8 3.6Z"/><path d="m9.1 13.2 8.4-6.2"/></svg></a>}
  <button ref={launcher} type="button" className="ast-fab" aria-label={open?'Đóng trợ lý':'Mở trợ lý'} aria-expanded={open} onClick={()=>open?close():setOpen(true)}>
   {open?<X/>:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-2 2V11.5a9.5 9.5 0 0 1 19 0Z"/><path d="M7 10h10M7 14h6"/></svg>}
  </button>
 </div>;
}
