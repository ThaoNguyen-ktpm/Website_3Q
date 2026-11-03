/* Mockup v2 UI. Pure front-end simulation: no network, no real policy applied. Logic lives in engine.js; data in data.js. */
(function(){
const E=Engine,D=Data;
/* ---------- format helpers ---------- */
const nf=new Intl.NumberFormat('vi-VN'),nf1=new Intl.NumberFormat('vi-VN',{maximumFractionDigits:1}),pf1=new Intl.NumberFormat('vi-VN',{minimumFractionDigits:1,maximumFractionDigits:1});
const NB=' ';
const money=v=>nf.format(Math.round(v))+NB+'₫';
const tr=v=>v==null?'—':(v<0?'−':'')+nf1.format(Math.abs(v)/1e6)+NB+'tr';
const trN=v=>nf1.format(v);                     // already in triệu
const pc=v=>isFinite(v)?pf1.format(v)+'%':'—';
const dmy=s=>s?s.split('-').reverse().join('/'):'—';
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const sum=(a,f)=>a.reduce((s,x)=>s+f(x),0);
/* The module renders inside a host element (the dashboard shell, or the standalone test page). Selectors are scoped to it. */
let host=document,view=null,sheet=null,ac=null,NS='',BASE='',STANDALONE=false,ONLY='';
const $=(s,r=host)=>r.querySelector(s),$$=(s,r=host)=>[...r.querySelectorAll(s)];
const A='<span class="assume">Giả định mô phỏng</span>';
const CH_COLOR={'Cửa hàng':'var(--ch-store)','Online':'var(--ch-online)','Đối tác':'var(--ch-partner)'};
const COLORS=['var(--c1)','var(--c2)','var(--c3)','var(--c4)','var(--c5)','var(--c6)'];

/* ---------- state (URL hash) ---------- */
const DEF={tab:'hang',scope:'ban',cat:'',brand:'',src:'',ch:'',all:true,pmin:0,pmax:1000,basis:'list',dd:'brand',bm:'qty',calc:D.CALC_DEFAULT};
const st=Object.assign({},DEF);
const TABS=['hang','tuoi','chinhsach','sale'];
function readHash(){
 const raw=new URLSearchParams(location.hash.slice(1)),p={get:k=>raw.get(NS+k)},g=(k,d)=>p.get(k)==null?d:p.get(k),n=(k,d)=>isFinite(parseFloat(p.get(k)))?parseFloat(p.get(k)):d;
 st.tab=ONLY||(TABS.includes(g('tab','hang'))&&(STANDALONE||g('tab','hang')!=='sale')?g('tab','hang'):'hang');st.scope=g('scope','ban')==='ton'?'ton':'ban';
 st.cat=g('cat','');st.brand=g('brand','');st.src=g('src','');st.ch=g('ch','');
 st.all=p.get('all')!=='0';st.pmin=Math.max(0,n('pmin',0));st.pmax=Math.max(0,n('pmax',1000));
 st.basis=g('basis','list')==='cost'?'cost':'list';st.dd=['brand','cat','src'].includes(g('dd','brand'))?g('dd','brand'):'brand';st.bm=g('bm','qty');
 st.calc=E.isDate(g('calc',D.CALC_DEFAULT))?g('calc',D.CALC_DEFAULT):D.CALC_DEFAULT;
}
function writeHash(){
 const p=new URLSearchParams();
 for(const k of ['tab','scope','cat','brand','src','ch','basis','dd','bm','calc'])if(st[k]!==DEF[k])p.set(NS+k,st[k]);
 if(!st.all){p.set(NS+'all','0');p.set(NS+'pmin',st.pmin);p.set(NS+'pmax',st.pmax)}
 const q=p.toString();history.replaceState(null,'','#'+(BASE?BASE+(q?'&':''):'')+q);
}
/* ---------- policy store (localStorage; every access guarded) ---------- */
const PKEY='baoq-autosale-policy-v2.1'; // bumped: v2 stored versions with a legacyResetDate and an effective date that no longer matches the engine
const policy={versions:E.defaultVersions(),draft:null,preview:null,sig:null,run:0};
function loadPolicy(){try{const j=JSON.parse(localStorage.getItem(PKEY));if(j&&Array.isArray(j.versions)&&j.versions.length&&j.versions.every(v=>v.id&&v.effective&&Array.isArray(v.brackets))){policy.versions=j.versions;if(j.draft&&Array.isArray(j.draft.brackets))policy.draft=j.draft}}catch{}}
function savePolicy(){try{localStorage.setItem(PKEY,JSON.stringify({versions:policy.versions,draft:policy.draft}))}catch{}}
function latest(){return policy.versions.slice().sort((a,b)=>a.effective.localeCompare(b.effective))[policy.versions.length-1]}
function freshDraft(){const base=E.clone(latest());return Object.assign(base,{id:'nháp',name:'Bản nháp',effective:st.calc,approvedAt:null})}
const draftSig=()=>JSON.stringify(policy.draft);

/* ---------- data views ---------- */
let _res=null,_resKey='';
function results(){const k=st.calc+'|'+JSON.stringify(policy.versions);if(k!==_resKey){_res=E.evaluateAll(D.STOCK,st.calc,policy.versions);_resKey=k}return _res}
const resOf=()=>{const m={};for(const r of results())m[r.sku]=r;return m};
const BRANDS=[...new Set(D.LINES.map(l=>l.brand).concat(D.STOCK.map(s=>s.brand)))].sort((a,b)=>a===D.BRAND_NONE?1:b===D.BRAND_NONE?-1:a.localeCompare(b));
const inRange=v=>st.all||(v!=null&&v>=st.pmin*1e6&&v<=st.pmax*1e6);
const nonPrice=x=>(!st.cat||x.category===st.cat)&&(!st.brand||x.brand===st.brand)&&(!st.src||x.source===st.src);
const soldLines=()=>D.LINES.filter(l=>nonPrice(l)&&(!st.ch||l.channel===st.ch)&&inRange(l.price_actual));
const stockKey=()=>st.basis==='cost'?'cost':'list_price';
const stockItems=()=>D.STOCK.filter(s=>nonPrice(s)&&inRange(s[stockKey()]));
function aggLines(ls){
 const orders=new Set(ls.map(l=>l.order)),wc=ls.filter(l=>l.cost!=null),rev=sum(ls,l=>l.price_actual),revWc=sum(wc,l=>l.price_actual),cost=sum(wc,l=>l.cost),gp=revWc-cost;
 const own=wc.filter(l=>l.source==='Mua đứt'),ownCost=sum(own,l=>l.cost),ownGp=sum(own,l=>l.price_actual-l.cost);
 const dl=ls.filter(l=>l.ready_for_sale_date).map(l=>E.dayDiff(l.ready_for_sale_date,l.created_on));
 return {orders:orders.size,items:ls.length,rev,cost,gp,margin:revWc?gp/revWc*100:NaN,aov:orders.size?rev/orders.size:0,missCost:ls.length-wc.length,ownCost,roc:ownCost?ownGp/ownCost*100:NaN,days:dl.length?sum(dl,x=>x)/dl.length:NaN,daysN:dl.length};
}
const groupBy=(arr,f)=>{const m=new Map();for(const x of arr){const k=f(x);if(!m.has(k))m.set(k,[]);m.get(k).push(x)}return m};

/* ---------- UI plumbing ---------- */
let H=[];const h=fn=>{H.push(fn);return H.length-1};
let opener=null;
function openSheet(kicker,title,summaryHtml,bodyHtml,count){
 opener=document.activeElement;$('#sheet-kicker').textContent=kicker;$('#sheet-title').textContent=title;
 $('#sheet-content').innerHTML=`<div class="sheet-sum" id="sheet-count" data-n="${count.n}" data-orders="${count.orders==null?'':count.orders}">${summaryHtml}</div><div class="table-scroll">${bodyHtml}</div>`;
 sheet.showModal();document.body.classList.add('is-locked');requestAnimationFrame(()=>$('#sheet-title').focus());
}
function closeSheet(){if(!sheet||!sheet.open)return;if(matchMedia('(prefers-reduced-motion: reduce)').matches){sheet.close();return}sheet.classList.add('is-closing');setTimeout(()=>{sheet.classList.remove('is-closing');if(sheet.open)sheet.close()},180)}
function toast(t){const el=$('#toast');el.textContent=t;el.classList.add('on');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('on'),3500)}
const sumBox=(l,v)=>`<div><p>${l}</p><strong>${v}</strong></div>`;

function linesSheet(title,ls,kicker='Dòng hàng đã bán'){
 const a=aggLines(ls);
 const body=`<table class="an"><thead><tr><th>Mã đơn</th><th>Ngày</th><th>SKU</th><th>Sản phẩm</th><th>Brand</th><th>Kênh</th><th>Sale</th><th class="r">Giá thực tế</th><th class="r">Lãi gộp</th></tr></thead><tbody>${ls.slice().sort((x,y)=>y.price_actual-x.price_actual).map(l=>`<tr><td translate="no">${l.order}</td><td>${dmy(l.created_on).slice(0,5)}</td><td translate="no">${l.sku}</td><td>${esc(l.name)}</td><td>${esc(l.brand)}</td><td>${l.channel}</td><td>${l.assignee}</td><td class="r">${tr(l.price_actual)}</td><td class="r ${l.cost!=null&&l.price_actual<l.cost?'neg':''}">${l.cost==null?'<span class="tag warn">thiếu giá vốn</span>':tr(l.price_actual-l.cost)}</td></tr>`).join('')||'<tr><td colspan="9">Không có dòng hàng.</td></tr>'}</tbody></table>
 <p class="note">Giá thực tế = giá niêm yết − giảm giá của dòng. Đây là danh sách <b>đơn đã bán</b>, không phải hàng tồn.</p>`;
 openSheet(kicker,title,sumBox('Dòng hàng',a.items)+sumBox('Đơn (không trùng)',a.orders)+sumBox('Doanh thu',tr(a.rev))+sumBox('Lãi gộp',tr(a.gp)),body,{n:a.items,orders:a.orders});
}
function stockSheet(title,items,kicker='Hàng tồn hiện tại'){
 const R=resOf(),own=items.filter(s=>s.source==='Mua đứt'&&s.cost!=null);
 const body=`<table class="an"><thead><tr><th>SKU</th><th>Sản phẩm</th><th>Brand</th><th>Nhóm</th><th>Nguồn</th><th>Tuổi tồn</th><th>Bậc giá</th><th class="r">Niêm yết</th><th class="r">Giá vốn</th><th class="r">Giá đề xuất</th><th>Trạng thái</th><th></th></tr></thead><tbody>${items.map(s=>{const r=R[s.sku];
  const stt=r.lock?`<span class="tag ${r.lock.group==='data'?'warn':'bad'}">${esc(r.lock.text)}</span>`:`<span class="tag ok">Auto${r.hitCost?' · chạm vốn':''}${r.exhausted?' · hết lượt M6':''}${r.skipped?` · bỏ qua ${r.skipped} lượt`:''}</span>`;
  return `<tr><td translate="no">${s.sku}</td><td>${esc(s.name)}</td><td>${esc(s.brand)}</td><td>${s.category}</td><td>${s.source}</td><td>${r.age.label}${r.age.days!=null&&r.age.state==='ok'?` <small class="note">(${r.age.days} ngày)</small>`:''}</td><td>${r.tier||'—'}</td><td class="r">${tr(s.list_price)}</td><td class="r">${tr(s.cost)}</td><td class="r">${r.proposed==null?'—':tr(r.proposed)}</td><td class="wrap">${stt}</td><td><button class="link" type="button" data-load="${s.sku}">Nạp vào máy tính</button></td></tr>`}).join('')||'<tr><td colspan="12">Không có món.</td></tr>'}</tbody></table>
 <p class="note">Danh sách <b>hàng còn tồn</b> (không có mã đơn bán). “Tuổi tồn” tính từ ngày sẵn sàng bán; “Bậc giá” tính từ đầu chu kỳ giá. Hai đồng hồ độc lập.</p>`;
 openSheet(kicker,title,sumBox('Số món tồn',items.length)+sumBox('Vốn (mua đứt, có giá vốn)',tr(sum(own,s=>s.cost)))+sumBox('Giá niêm yết',tr(sum(items,s=>s.list_price))),body,{n:items.length});
}

/* ---------- tabs ---------- */
function setTab(t){st.tab=t;writeHash();render()}
function render(){
 if(!ONLY)$$('#tabs [role=tab]').forEach(b=>{const on=b.dataset.tab===st.tab;b.setAttribute('aria-selected',on);b.tabIndex=on?0:-1;b.setAttribute('aria-controls','view')});
 const chip=$('#period-chip');if(chip)chip.textContent=st.tab==='hang'&&st.scope==='ton'?`Tồn tại ngày tính ${dmy(st.calc)}`:st.tab==='hang'||st.tab==='sale'?D.PERIOD.label:`Ngày tính ${dmy(st.calc)}`;
 H=[];({hang:renderHang,tuoi:renderTuoi,chinhsach:renderPolicy,sale:renderSale})[st.tab]();
}

/* ============================================================
   TAB 1 — Hàng hóa & hiệu quả vốn
   ============================================================ */
const KNOTS=[[0,0],[50,40],[100,70],[200,110],[500,160],[1000,200]],POS_MAX=200;
function valToPos(v){v=Math.min(Math.max(v,0),1000);for(let i=0;i<KNOTS.length-1;i++){const [v0,p0]=KNOTS[i],[v1,p1]=KNOTS[i+1];if(v<=v1)return p0+(v-v0)/(v1-v0)*(p1-p0)}return POS_MAX}
function posToVal(p){p=Math.min(Math.max(p,0),POS_MAX);for(let i=0;i<KNOTS.length-1;i++){const [v0,p0]=KNOTS[i],[v1,p1]=KNOTS[i+1];if(p<=p1){const v=v0+(p-p0)/(p1-p0)*(v1-v0);return v<100?Math.round(v):v<500?Math.round(v/5)*5:Math.round(v/10)*10}}return 1000}
const PRESETS=[['0-100','0–100 tr'],['0-200','0–200 tr'],['200-1000','200 tr – 1 tỷ'],['all','Tất cả']];

function filtersCard(){
 const opt=(arr,cur,all)=>`<option value="">${all}</option>`+arr.map(x=>`<option value="${esc(x)}"${x===cur?' selected':''}>${esc(x)}</option>`).join('');
 return `<section class="card" aria-label="Bộ lọc">
 <div class="scope-row"><div class="seg" role="group" aria-label="Phạm vi xem"><button type="button" id="scope-ban" data-scope="ban" aria-pressed="${st.scope==='ban'}">Bán trong kỳ</button><button type="button" id="scope-ton" data-scope="ton" aria-pressed="${st.scope==='ton'}">Tồn hiện tại</button></div>
  <p class="note" style="margin:0" id="scope-note"></p></div>
 <div class="fbar" style="margin-top:var(--s4)">
  <label>Nhóm hàng<select id="f-cat">${opt(D.CATS,st.cat,'Tất cả nhóm')}</select></label>
  <label>Brand<select id="f-brand">${opt(BRANDS,st.brand,'Tất cả brand')}</select></label>
  <label>Nguồn hàng<select id="f-src">${opt(['Mua đứt','Ký gửi'],st.src,'Mua đứt + Ký gửi')}</select></label>
  <label>Kênh bán<select id="f-ch" ${st.scope==='ton'?'disabled aria-describedby="ch-why"':''}>${st.scope==='ton'?'<option value="">Không áp dụng cho Tồn</option>':opt(D.CHANNELS,st.ch,'Tất cả kênh')}</select></label>
  <label id="basis-wrap" ${st.scope==='ban'?'hidden':''}>Lọc giá tồn theo<select id="f-basis"><option value="list"${st.basis==='list'?' selected':''}>Giá niêm yết hiện tại</option><option value="cost"${st.basis==='cost'?' selected':''}>Giá vốn</option></select></label>
 </div>
 <p class="note" id="ch-why" ${st.scope==='ban'?'hidden':''}>Hàng tồn chưa gắn kênh bán nên bộ lọc kênh bị khóa. Biểu đồ và bảng tồn không chịu bộ lọc kênh.</p>
 <div class="pf" id="pf"><div class="pf-head"><strong>Lọc theo giá <span id="pf-basis-note" class="note" style="font-weight:400"></span></strong><span class="note" style="margin:0">Lọc để xem, <b>không đổi</b> khung giá Auto Sale.</span></div>
  <div class="pf-inputs"><label>Từ<span class="u"><input id="pmin" type="number" inputmode="decimal" min="0" step="1" aria-describedby="pf-err"><span>tr</span></span></label><label>Đến<span class="u"><input id="pmax" type="number" inputmode="decimal" min="0" step="1" aria-describedby="pf-err"><span>tr</span></span></label></div>
  <div class="rs" id="rs"><div class="rs-track"><i class="rs-fill" id="rs-fill"></i></div><input type="range" id="r-min" min="0" max="${POS_MAX}" step="1" aria-label="Giá thấp nhất, triệu đồng"><input type="range" id="r-max" min="0" max="${POS_MAX}" step="1" aria-label="Giá cao nhất, triệu đồng"></div>
  <div class="rs-ticks" aria-hidden="true">${[0,50,100,200,500,1000].map(v=>`<span style="left:${valToPos(v)/POS_MAX*100}%">${v===1000?'1 tỷ':v+' tr'}</span>`).join('')}</div>
  <p class="err-line" id="pf-err" role="alert"></p>
  <div class="presets" role="group" aria-label="Chọn nhanh khoảng giá">${PRESETS.map(([k,l])=>`<button class="chip" type="button" data-preset="${k}">${l}</button>`).join('')}</div>
  <p class="note" id="pf-status"></p></div></section>`;
}
function renderHang(){
 view.innerHTML=filtersCard()+'<div id="results" style="display:grid;grid-template-columns:minmax(0,1fr);gap:var(--s5)"></div>';
 const set=(id,key,after)=>$(id).addEventListener('change',e=>{st[key]=e.target.value;writeHash();after&&after();renderResults();syncPrice()});
 set('#f-cat','cat');set('#f-brand','brand');set('#f-src','src');set('#f-ch','ch');set('#f-basis','basis');
 $$('[data-scope]').forEach(b=>b.onclick=()=>{st.scope=b.dataset.scope;writeHash();render()});
 $$('[data-preset]').forEach(b=>b.onclick=()=>{const k=b.dataset.preset;if(k==='all'){st.all=true}else{const [a,c]=k.split('-').map(Number);st.all=false;st.pmin=a;st.pmax=c}applyPrice()});
 const rMin=$('#r-min'),rMax=$('#r-max'),nMin=$('#pmin'),nMax=$('#pmax'),err=$('#pf-err');
 rMin.addEventListener('input',()=>{let v=posToVal(+rMin.value);if(v>st.pmax)v=st.pmax;st.all=false;st.pmin=v;applyPrice()});
 rMax.addEventListener('input',()=>{let v=posToVal(+rMax.value);if(v<st.pmin)v=st.pmin;st.all=false;st.pmax=v;applyPrice()});
 const numIn=(el,which)=>el.addEventListener('input',()=>{
  const raw=el.value.trim(),v=parseFloat(raw);
  if(raw===''||!isFinite(v)||v<0){err.textContent='Nhập số từ 0 trở lên (đơn vị triệu đồng).';el.setAttribute('aria-invalid','true');return}
  const lo=which==='min'?v:st.pmin,hi=which==='max'?v:st.pmax;
  if(lo>hi){err.textContent='Giá thấp nhất không được lớn hơn giá cao nhất. Đang giữ khoảng hợp lệ gần nhất.';el.setAttribute('aria-invalid','true');return}
  err.textContent='';nMin.removeAttribute('aria-invalid');nMax.removeAttribute('aria-invalid');
  st.all=false;st[which==='min'?'pmin':'pmax']=v;applyPrice(el);
 });
 numIn(nMin,'min');numIn(nMax,'max');
 [nMin,nMax].forEach(el=>el.addEventListener('blur',()=>{err.textContent='';el.removeAttribute('aria-invalid');syncPrice()}));
 syncPrice();renderResults();
}
function applyPrice(skip){writeHash();syncPrice(skip);renderResults()}
function syncPrice(skip){
 const rMin=$('#r-min'),rMax=$('#r-max');if(!rMin)return;
 const lo=st.all?0:st.pmin,hi=st.all?1000:st.pmax,pl=valToPos(lo),ph=valToPos(hi);
 rMin.value=pl;rMax.value=ph;rMin.style.zIndex=pl>POS_MAX/2?3:2;rMax.style.zIndex=pl>POS_MAX/2?2:3;
 $('#rs').classList.toggle('dim',st.all);
 const f=$('#rs-fill');f.style.left=(pl/POS_MAX*100)+'%';f.style.right=(100-ph/POS_MAX*100)+'%';
 const nMin=$('#pmin'),nMax=$('#pmax');
 if(skip!==nMin){nMin.value=st.all?'':st.pmin;nMin.placeholder=st.all?'Tất cả':'0'}
 if(skip!==nMax){nMax.value=st.all?'':st.pmax;nMax.placeholder=st.all?'Tất cả':'1000'}
 rMin.setAttribute('aria-valuetext',st.all?'Không lọc':trN(st.pmin)+' triệu');rMax.setAttribute('aria-valuetext',st.all?'Không lọc':trN(st.pmax)+' triệu');
 $$('[data-preset]').forEach(b=>{const k=b.dataset.preset;b.setAttribute('aria-pressed',String(k==='all'?st.all:!st.all&&k===st.pmin+'-'+st.pmax))});
 const basisTxt=st.scope==='ban'?'giá bán thực tế của từng dòng hàng (sau giảm giá)':st.basis==='list'?'giá niêm yết hiện tại':'giá vốn';
 $('#pf-basis-note').textContent='· '+basisTxt;
 const aboveCap=st.scope==='ban'?D.LINES.filter(l=>nonPrice(l)&&(!st.ch||l.channel===st.ch)&&l.price_actual>1e9).length:D.STOCK.filter(s=>nonPrice(s)&&s[stockKey()]!=null&&s[stockKey()]>1e9).length;
 let s=st.all?'Không lọc giá (“Tất cả”): gồm cả món trên 1 tỷ.':`Đang lọc ${trN(st.pmin)}–${trN(st.pmax)} tr`+(st.pmax>1000?' (nhập tay, vượt thang trượt 1 tỷ)':'')+'.';
 if(!st.all&&st.pmax<=1000&&aboveCap)s+=` Có ${aboveCap} ${st.scope==='ban'?'dòng hàng':'món'} trên 1 tỷ bị loại khỏi khoảng này.`;
 if(!st.all&&st.scope==='ton'&&st.basis==='cost'){const miss=D.STOCK.filter(x=>nonPrice(x)&&x.cost==null).length;if(miss)s+=` ${miss} món thiếu giá vốn không vào được bộ lọc giá.`}
 $('#pf-status').textContent=s;
 $('#scope-note').textContent=st.scope==='ban'?`Kỳ ${D.PERIOD.label}. Dùng giá bán thực tế.`:`Tồn tại ngày tính ${dmy(st.calc)}. Dùng giá niêm yết / giá vốn, không phải giá bán.`;
}

function groupsFor(items,dim,valueOf){
 const keyOf=dim==='brand'?x=>x.brand:dim==='cat'?x=>x.category:x=>x.source;
 let g=[...groupBy(items,keyOf)].map(([k,arr])=>({key:k,label:k,items:arr,value:sum(arr,valueOf),n:arr.length}));
 g.sort((a,b)=>b.value-a.value);
 if(g.length>6){const top=g.slice(0,5),rest=g.slice(5);g=top.concat([{key:'__other',label:'Khác',items:rest.flatMap(x=>x.items),value:sum(rest,x=>x.value),n:sum(rest,x=>x.n),other:rest.map(x=>x.label)}])}
 return g;
}
function donutHtml(groups,total,aria){
 const C=2*Math.PI*44;let off=0;const many=groups.length>1;
 const segs=groups.map((g,i)=>{const f=total?g.value/total:0,d=Math.max(0,f*C-(many?1.4:0)),o=off;off+=f*C;return `<circle cx="60" cy="60" r="44" fill="none" stroke="${COLORS[i]}" stroke-width="16" stroke-dasharray="${d} ${C}" stroke-dashoffset="${-o}" transform="rotate(-90 60 60)"/>`}).join('');
 return `<svg viewBox="0 0 120 120" role="img" aria-label="${esc(aria)}"><circle cx="60" cy="60" r="44" fill="none" stroke="#efeae3" stroke-width="16"/>${segs}<text x="60" y="58" text-anchor="middle" font-size="14" font-weight="700">${nf.format(Math.round(total/1e6))} tr</text><text x="60" y="73" text-anchor="middle" font-size="11.5" fill="#5f5850" style="fill:#5f5850">= 100%</text></svg>`;
}
const DIM_LABEL={brand:'Brand',cat:'Nhóm hàng',src:'Nguồn hàng'};

function renderResults(){
 H=[];const box=$('#results');if(!box)return;
 box.innerHTML=st.scope==='ban'?resultsBan():resultsTon();
 $$('#results [data-dd]').forEach(el=>el.addEventListener('change',e=>{st[e.target.dataset.dd==='dd'?'dd':'bm']=e.target.value;writeHash();renderResults()}));
}
function emptyCard(){return `<section class="card empty" id="empty"><h2 style="font-family:var(--serif);font-weight:400;margin:0 0 var(--s2)">Không có dữ liệu phù hợp bộ lọc</h2><p>Thử nới khoảng giá hoặc bỏ bớt bộ lọc.</p><button class="btn-solid" type="button" data-h="${h(()=>{Object.assign(st,{cat:'',brand:'',src:'',ch:'',all:true});writeHash();render()})}">Xóa bộ lọc</button></section>`}

function barMeasureOptions(scope){return scope==='ban'?[['qty','Số món'],['rev','Doanh thu'],['gp','Lãi gộp']]:[['qty','Số món'],['val','Giá trị']]}
function barBlock(items,scope){
 const donutMeasure=scope==='ban'?'rev':'val';
 const opts=barMeasureOptions(scope);let bm=opts.some(o=>o[0]===st.bm)?st.bm:'qty';
 const clash=st.dd==='cat';                       // same dimension → a bar on the donut's own measure would just repeat it
 if(clash&&bm===donutMeasure)bm='qty';
 const val=scope==='ban'?{qty:a=>a.length,rev:a=>sum(a,l=>l.price_actual),gp:a=>sum(a.filter(l=>l.cost!=null),l=>l.price_actual-l.cost)}:{qty:a=>a.length,val:a=>sum(a,s=>s[stockKey()]||0)};
 const rows=D.CATS.map(c=>{const arr=items.filter(x=>x.category===c);return {c,arr,v:val[bm](arr)}}).filter(r=>r.arr.length).sort((a,b)=>b.v-a.v);
 const mx=Math.max(1,...rows.map(r=>Math.abs(r.v)));const fmt=bm==='qty'?v=>v+' món':tr;
 const label={qty:'Số món',rev:'Doanh thu',gp:'Lãi gộp',val:st.basis==='cost'?'Giá trị vốn':'Giá trị niêm yết'}[bm];
 return `<section class="card" id="bar-card"><div class="card-head"><h2>So sánh nhóm hàng</h2><div class="card-tools"><label class="vh" for="bm-sel">Thước đo</label><select id="bm-sel" data-dd="bm" aria-label="Thước đo so sánh">${opts.map(([k,l])=>`<option value="${k}"${k===bm?' selected':''}${clash&&k===donutMeasure?' disabled':''}>${l}${clash&&k===donutMeasure?' (đã có ở biểu đồ tròn)':''}</option>`).join('')}</select></div>
  <p>Cột ngang: ${label} theo nhóm hàng. ${clash?'Biểu đồ tròn đang chia theo nhóm hàng nên thước đo trùng được khóa để khỏi lặp.':'Bấm một cột để xem chi tiết.'}</p></div>
  <div class="hbars" id="bars">${rows.map(r=>`<button type="button" class="hb${r.v<0?' cost':''}" data-h="${h(()=>scope==='ban'?linesSheet(r.c,r.arr):stockSheet(r.c,r.arr))}" aria-label="${esc(r.c)}: ${label} ${fmt(r.v)}, ${r.arr.length} ${scope==='ban'?'dòng hàng':'món'}. Xem chi tiết"><span class="lab">${esc(r.c)}<small>${r.arr.length} ${scope==='ban'?'dòng':'món'}</small></span><span class="track"><i style="width:${Math.max(0,r.v)/mx*100}%"></i></span><span class="val ${r.v<0?'neg':''}">${fmt(r.v)}</span></button>`).join('')}</div></section>`;
}
function donutBlock(items,scope,total,denomText){
 const vf=scope==='ban'?l=>l.price_actual:s=>s[stockKey()]||0;
 const g=groupsFor(items,st.dd,vf);
 const aria=`Cơ cấu theo ${DIM_LABEL[st.dd]}. ${denomText}. `+g.map(x=>`${x.label} ${pc(total?x.value/total*100:0)}`).join(', ');
 const open=x=>scope==='ban'?linesSheet(`${DIM_LABEL[st.dd]}: ${x.label}${x.other?' ('+x.other.join(', ')+')':''}`,x.items):stockSheet(`${DIM_LABEL[st.dd]}: ${x.label}${x.other?' ('+x.other.join(', ')+')':''}`,x.items);
 return `<section class="card" id="donut-card"><div class="card-head"><h2>Cơ cấu theo ${DIM_LABEL[st.dd].toLowerCase()}</h2><div class="card-tools"><label class="vh" for="dd-sel">Chiều xem</label><select id="dd-sel" data-dd="dd" aria-label="Chiều xem cơ cấu">${Object.entries(DIM_LABEL).map(([k,l])=>`<option value="${k}"${k===st.dd?' selected':''}>${l}</option>`).join('')}</select></div></div>
  <div class="donut-wrap"><div id="donut" data-total="${Math.round(total)}">${donutHtml(g,total,aria)}</div>
  <div class="lg-list">${g.map((x,i)=>`<button type="button" class="lg" data-h="${h(()=>open(x))}" aria-label="${esc(x.label)}: ${tr(x.value)}, ${pc(total?x.value/total*100:0)}, ${x.n} ${scope==='ban'?'dòng hàng':'món'}. Xem chi tiết"><i style="background:${COLORS[i]}"></i><span class="n">${esc(x.label)}<small>${x.n} ${scope==='ban'?'dòng hàng':'món'}</small></span><span class="v">${pc(total?x.value/total*100:0)}<small>${tr(x.value)}</small></span></button>`).join('')}</div></div>
  <p class="denom" id="denom"><b>Mẫu số:</b> ${denomText}</p></section>`;
}

function resultsBan(){
 const ls=soldLines(),a=aggLines(ls);if(!ls.length)return emptyCard();
 const tile=(l,v,c,hero)=>`<div class="tile${hero?' hero':''}"><p class="l">${l}</p><p class="v">${v}</p>${c?`<p class="c">${c}</p>`:''}</div>`;
 const denom=`100% = ${tr(a.rev)} doanh thu giá bán thực tế · ${a.orders} đơn · ${a.items} dòng hàng (sau bộ lọc)`;
 const cats=D.CATS.map(c=>{const arr=ls.filter(l=>l.category===c);return {c,arr,...aggLines(arr)}}).filter(r=>r.arr.length);
 const sumCatOrders=sum(cats,r=>r.orders);
 return `<div class="kpis" id="kpis">${tile('Doanh thu',tr(a.rev),'Giá bán thực tế, sau giảm giá')}${tile('Số đơn',String(a.orders),`${a.items} dòng hàng · đếm đơn không trùng`)}${tile('Lãi gộp',tr(a.gp),`${pc(a.margin)} lãi gộp${a.missCost?` · ${a.missCost} dòng thiếu giá vốn bị loại`:''}`,true)}${tile('Giá trị đơn TB',tr(a.aov),'Doanh thu ÷ số đơn')}${tile('Lãi gộp ÷ vốn',pc(a.roc),'Chỉ hàng mua đứt, có giá vốn')}${tile('Ngày bán TB',isFinite(a.days)?nf1.format(a.days)+' ngày':'—',`Từ ngày sẵn sàng bán đến ngày bán${a.daysN<a.items?` · ${a.items-a.daysN} dòng thiếu ngày`:''}`)}</div>
 <div class="grid-2">${donutBlock(ls,'ban',a.rev,denom)}${barBlock(ls,'ban')}</div>
 <section class="card"><div class="card-head"><h2>Theo nhóm hàng · bán trong kỳ</h2><p>Lãi gộp = giá bán thực tế − giá vốn, chưa trừ vận hành, hoa hồng, chia ký gửi.</p></div>
  <div class="table-scroll"><table class="an" id="grp-table"><thead><tr><th>Nhóm hàng</th><th class="r">Đơn có chứa nhóm *</th><th class="r">Số món</th><th class="r">Doanh thu</th><th class="r">Giá vốn</th><th class="r">Lãi gộp</th><th class="r">% lãi gộp</th></tr></thead><tbody>${cats.map(r=>`<tr data-h="${h(()=>linesSheet(r.c,r.arr))}"><td><button class="link" type="button" data-h="${h(()=>linesSheet(r.c,r.arr))}">${esc(r.c)}</button></td><td class="r">${r.orders}</td><td class="r">${r.items}</td><td class="r">${tr(r.rev)}</td><td class="r">${tr(r.cost)}</td><td class="r ${r.gp<0?'neg':''}">${tr(r.gp)}</td><td class="r">${pc(r.margin)}</td></tr>`).join('')}</tbody>
  <tfoot><tr><td>Tổng</td><td class="r" id="tot-orders">${a.orders}</td><td class="r">${a.items}</td><td class="r">${tr(a.rev)}</td><td class="r">${tr(a.cost)}</td><td class="r">${tr(a.gp)}</td><td class="r">${pc(a.margin)}</td></tr></tfoot></table></div>
  <p class="note">* Một đơn có nhiều nhóm được đếm ở mỗi nhóm, nên cột này cộng lại (${sumCatOrders}) ${sumCatOrders>a.orders?'lớn hơn':'bằng'} tổng đơn thật (${a.orders}). Số món là số dòng hàng; số đơn đếm theo mã đơn không trùng.</p></section>`;
}
function stockAgg(items){const R=resOf(),own=items.filter(s=>s.source==='Mua đứt'&&s.cost!=null),ownCost=sum(own,s=>s.cost),m6=sum(own.filter(s=>R[s.sku].age.label==='M6+'),s=>s.cost);return {R,own,ownCost,m6,consign:items.filter(s=>s.source==='Ký gửi')}}
function resultsTon(){
 const items=stockItems();if(!items.length)return emptyCard();
 const {R,own,ownCost,m6,consign}=stockAgg(items);
 const bad=items.filter(s=>R[s.sku].lock&&R[s.sku].lock.group==='data');
 const total=sum(items,s=>s[stockKey()]||0),baseTxt=st.basis==='cost'?'giá vốn':'giá niêm yết hiện tại';
 const noPrice=items.filter(s=>s[stockKey()]==null).length;
 const denom=`100% = ${tr(total)} ${baseTxt} · ${items.length} món tồn (sau bộ lọc)${noPrice?` · ${noPrice} món thiếu ${baseTxt} không có trong biểu đồ`:''}`;
 const tile=(l,v,c,hero,h2)=>`<div class="tile${hero?' hero':''}"><p class="l">${l}</p><p class="v">${v}</p>${c?`<p class="c">${c}</p>`:''}</div>`;
 const cats=D.CATS.map(c=>({c,arr:items.filter(s=>s.category===c)})).filter(r=>r.arr.length);
 const row=(arr)=>{const o=arr.filter(s=>s.source==='Mua đứt'&&s.cost!=null),oc=sum(o,s=>s.cost),m=sum(o.filter(s=>R[s.sku].age.label==='M6+'),s=>s.cost);return {n:arr.length,oc,list:sum(arr,s=>s.list_price),m6p:oc?m/oc*100:NaN,miss:arr.filter(s=>R[s.sku].lock&&R[s.sku].lock.group==='data').length}};
 return `<div class="kpis" id="kpis">${tile('Số món tồn',String(items.length),`${consign.length} ký gửi · ${items.length-consign.length} mua đứt`)}${tile('Vốn nằm trong tồn',tr(ownCost),`Hàng mua đứt, theo giá vốn (${own.length} món)`,true)}${tile('Giá niêm yết tồn',tr(sum(items,s=>s.list_price)),'Giá hiện tại, không phải giá bán')}${tile('% vốn ở tuổi M6+',pc(ownCost?m6/ownCost*100:NaN),'Tuổi từ ngày sẵn sàng bán ≥ 210 ngày')}${tile('Ký gửi',String(consign.length),'Không tính vào vốn của BAOQ')}${tile('Thiếu dữ liệu',String(bad.length),'Thiếu ngày sẵn sàng, giá vốn, giá M0…')}</div>
 <div class="grid-2">${donutBlock(items,'ton',total,denom)}${barBlock(items,'ton')}</div>
 <section class="card"><div class="card-head"><h2>Theo nhóm hàng · tồn hiện tại</h2><p>Vốn chỉ tính hàng mua đứt có giá vốn. Bấm dòng để xem danh sách món tồn (không có đơn bán).</p></div>
  <div class="table-scroll"><table class="an" id="grp-table"><thead><tr><th>Nhóm hàng</th><th class="r">Số món</th><th class="r">Vốn (mua đứt)</th><th class="r">Giá niêm yết</th><th class="r">% vốn ở M6+</th><th class="r">Thiếu dữ liệu</th></tr></thead><tbody>${cats.map(r=>{const x=row(r.arr);return `<tr data-h="${h(()=>stockSheet(r.c,r.arr))}"><td><button class="link" type="button" data-h="${h(()=>stockSheet(r.c,r.arr))}">${esc(r.c)}</button></td><td class="r">${x.n}</td><td class="r">${tr(x.oc)}</td><td class="r">${tr(x.list)}</td><td class="r">${pc(x.m6p)}</td><td class="r">${x.miss}</td></tr>`}).join('')}</tbody>
  <tfoot>${(()=>{const x=row(items);return `<tr><td>Tổng</td><td class="r">${x.n}</td><td class="r">${tr(x.oc)}</td><td class="r">${tr(x.list)}</td><td class="r">${pc(x.m6p)}</td><td class="r">${x.miss}</td></tr>`})()}</tfoot></table></div></section>`;
}

/* ============================================================
   TAB 2 — Tuổi tồn & Auto Sale
   ============================================================ */
const LOCK_LABEL={missing_ready:'Thiếu ngày sẵn sàng',not_ready:'Chưa tới ngày sẵn sàng',missing_cost:'Thiếu giá vốn',missing_m0:'Thiếu giá M0',consign:'Ký gửi (khóa, giả định)',special_hot_trend:'Hot/trend: thiếu công thức',special_rule_3pct:'Quy tắc 3%: thiếu công thức',special_rule_half:'Cơ chế 1/2: thiếu công thức',special_buyback:'Giá thu về: thiếu công thức',over600:'Từ 600 triệu: không đủ chính sách',m0_below_cost:'Giá M0 < giá vốn: xử lý tay',missing_reset_date:'Hàng cũ thiếu ngày reset'};
function renderTuoi(){
 const R=results(),map=resOf(),ver=E.versionAt(policy.versions,st.calc),auto=R.filter(r=>!r.lock);const verTxt=ver?`<b>${esc(ver.id)}</b> (hiệu lực ${dmy(ver.effective)})`:'<b>chưa có phiên bản nào hiệu lực</b> (không áp dụng chính sách tương lai)';
 const byLock=groupBy(R.filter(r=>r.lock),r=>r.lock.code);
 const skuItems=rs=>rs.map(r=>D.STOCK.find(s=>s.sku===r.sku));
 const ages=[...E.AGE_LABELS.map(l=>({key:l,label:l,rs:R.filter(r=>r.age.state==='ok'&&r.age.label===l)})),{key:'pending',label:'Chưa sẵn sàng / thiếu ngày',rs:R.filter(r=>r.age.state!=='ok'),locked:true}];
 const mxA=Math.max(1,...ages.map(a=>a.rs.length));
 const tiers=['M0','M1','M2','M3','M4','M5','M6'].map(t=>({t,rs:auto.filter(r=>r.tier===t)}));
 const dis=sum(auto,r=>r.discount),listA=sum(auto,r=>D.STOCK.find(s=>s.sku===r.sku).list_price),propA=sum(auto,r=>r.proposed);
 const tile=(l,v,c,hero)=>`<div class="tile${hero?' hero':''}"><p class="l">${l}</p><p class="v">${v}</p>${c?`<p class="c">${c}</p>`:''}</div>`;
 const hash=E.hashOf(R);
 const brandNone=D.STOCK.filter(s=>s.brand===D.BRAND_NONE);
 view.innerHTML=`<div class="banner"><strong>Chưa áp dụng thực tế.</strong> Giá đề xuất chỉ để xem mô phỏng, không đổi giá Kiot/Sapo. “Tuổi M#” (từ ngày sẵn sàng bán, không bao giờ reset) và “Bậc giá M#” (từ đầu chu kỳ giá, mỗi 30 ngày một lượt) là hai đồng hồ khác nhau, luôn ghi rõ từng cái.</div>
 <section class="card"><div class="calc-bar"><label>Ngày tính (giả lập)<input type="date" id="calc-date" value="${st.calc}"></label><button class="btn-solid" type="button" id="recalc">Tính lại (giả lập)</button>
  <p class="note" style="margin:0;flex:1 1 260px" id="calc-meta">Phiên bản chính sách tại ngày tính: ${verTxt} · lần tính #<span id="run-n">${policy.run}</span> · mã kiểm kết quả <b id="run-hash" data-hash="${hash}">${hash}</b> <span class="note">(cùng đầu vào + cùng chính sách → cùng mã)</span></p></div></section>
 <div class="kpis" id="kpis">${tile('Auto tính được',String(auto.length),`${R.length-auto.length} món bị khóa`)}${tile('Giảm dự kiến',tr(dis),'Tổng các lượt đã tới hạn',true)}${tile('Giá đề xuất (tổng)',tr(propA),'So với niêm yết '+tr(listA)+' · chỉ món Auto')}${tile('Chạm giá vốn',String(auto.filter(r=>r.hitCost).length),'Dừng, không xuống dưới vốn')}${tile('Hết lượt M6',String(auto.filter(r=>r.exhausted).length),'Không auto vượt M6, cần xử lý tay')}${tile('Bị khóa',String(R.length-auto.length),'Chi tiết ở dải bên dưới')}</div>
 <div class="grid-2">
  <section class="card"><div class="card-head"><h2>Tuổi tồn (từ ngày sẵn sàng bán)</h2><p>M0 = 0–29 ngày … M6 = 180–209, M6+ = từ 210 ngày. Bấm một bậc để xem đúng hàng tồn của bậc đó.</p></div>
   <div class="hbars" id="age-bars">${ages.map(a=>`<button type="button" class="hb${a.locked?' locked':''}" data-bucket="${a.key}" data-n="${a.rs.length}" data-h="${h(()=>stockSheet(a.locked?'Chưa sẵn sàng / thiếu ngày sẵn sàng':'Tuổi tồn '+a.label,skuItems(a.rs),'Hàng tồn'))}" aria-label="${a.label}: ${a.rs.length} món tồn. Xem danh sách"><span class="lab">${a.label}<small>${a.locked?'không mặc định M0':'tuổi'}</small></span><span class="track"><i style="width:${a.rs.length/mxA*100}%"></i></span><span class="val">${a.rs.length} món</span></button>`).join('')}</div>
   <p class="note">Tổng ${R.length} món tồn = ${ages.map(a=>a.rs.length).join(' + ')}.</p></section>
  <section class="card"><div class="card-head"><h2>Bậc giá Auto Sale (từ đầu chu kỳ)</h2><p>Chỉ món Auto tính được. Bậc giá khác Tuổi tồn với hàng cũ đã reset.</p></div>
   <div class="table-scroll"><table class="an" id="tier-table"><thead><tr><th>Bậc giá</th><th class="r">Món</th><th class="r">Giảm dự kiến</th><th></th></tr></thead><tbody>${tiers.map(x=>`<tr data-h="${h(()=>stockSheet('Bậc giá '+x.t+' (Auto)',skuItems(x.rs),'Hàng tồn'))}"><td><button class="link" type="button" data-h="${h(()=>stockSheet('Bậc giá '+x.t+' (Auto)',skuItems(x.rs),'Hàng tồn'))}">${x.t}</button></td><td class="r">${x.rs.length}</td><td class="r">${tr(sum(x.rs,r=>r.discount))}</td><td class="wrap">${x.t==='M3'?'<span class="hint-m3">Gợi ý demo M3: content / topic sale / TikTok / ads · đánh dấu Kiot. Chỉ hiển thị, không gửi hay tạo gì.</span>':''}</td></tr>`).join('')}</tbody></table></div></section>
 </div>
 <section class="card"><div class="card-head"><h2>Hàng chưa tự tính được</h2><p>Mỗi món thuộc một nhóm duy nhất. Bấm để xem đúng danh sách. Các nhóm “thiếu công thức” khóa tự động, không có con số nào được suy ra.</p></div>
  <div class="qchips" id="qchips">${[...byLock].sort((a,b)=>b[1].length-a[1].length).map(([code,rs])=>`<button type="button" class="qchip ${rs[0].lock.group}" data-lock="${code}" data-n="${rs.length}" data-h="${h(()=>stockSheet(LOCK_LABEL[code]||code,skuItems(rs)))}">${esc(LOCK_LABEL[code]||code)} <b>${rs.length}</b></button>`).join('')}<button type="button" class="qchip info" data-lock="no_brand" data-n="${brandNone.length}" data-h="${h(()=>stockSheet('Thiếu brand (không khóa)',brandNone))}">Thiếu brand, không khóa <b>${brandNone.length}</b></button></div></section>
 <section class="card" id="calc-card"><div class="card-head"><h2>Thử tính 1 món</h2><p>Nhập số liệu để xem timeline từng lượt. Dùng để kiểm tra các mốc 29/30/60/180 ngày. Dùng phiên bản chính sách đang hiệu lực.</p></div>
  <div class="calc-grid"><label>Giá M0 (triệu)<input id="c-m0" type="number" min="0" step="0.1"></label><label>Giá vốn (triệu)<input id="c-cost" type="number" min="0" step="0.1"></label><label>Ngày sẵn sàng bán<input id="c-ready" type="date"></label><label>Đầu chu kỳ giá<input id="c-cycle" type="date"></label>
   <label>Ngày tính<input id="c-calc" type="date"></label><label>Nguồn hàng<select id="c-src"><option>Mua đứt</option><option>Ký gửi</option></select></label><label>Trường hợp đặc biệt<select id="c-special"><option value="">Không</option><option value="hot_trend">Hot/trend</option><option value="rule_3pct">Quy tắc 3%</option><option value="rule_half">Cơ chế 1/2</option><option value="buyback">Giá thu về</option></select></label><label>Ngày reset giá của món (hàng cũ)<input id="c-reset" type="date"></label><label class="chk"><input id="c-legacy" type="checkbox"> Hàng cũ đã reset giá (chu kỳ giá bắt đầu từ ngày reset của món)</label></div>
  <div class="presets" role="group" aria-label="Mốc ngày nhanh">${[29,30,59,60,89,90,100,179,180,209,210].map(d=>`<button class="chip" type="button" data-days="${d}">${d} ngày</button>`).join('')}</div>
  <div id="calc-out" aria-live="polite"></div></section>`;
 $('#calc-date').addEventListener('change',e=>{if(E.isDate(e.target.value)){st.calc=e.target.value;policy.draft=null;writeHash();render()}});
 $('#recalc').onclick=()=>{policy.run++;_resKey='';render();$('#recalc').focus()};
 initCalc();
}
let calcInit=null;
function initCalc(){
 const ids=['m0','cost','ready','cycle','calc','src','special','legacy','reset'].reduce((o,k)=>(o[k]=$('#c-'+k),o),{});
 const set=(it,calc)=>{ids.m0.value=it.m0_price==null?'':it.m0_price/1e6;ids.cost.value=it.cost==null?'':it.cost/1e6;ids.ready.value=it.ready_for_sale_date||'';ids.cycle.value=it.sale_cycle_start||'';ids.calc.value=calc;ids.src.value=it.source;ids.special.value=it.special||'';ids.legacy.checked=!!it.legacy_reset;ids.reset.value=it.legacy_reset_date||'2026-07-01'};
 calcInit=set;
 set(calcSeed||{m0_price:100e6,cost:60e6,ready_for_sale_date:E.addDays(st.calc,-60),sale_cycle_start:E.addDays(st.calc,-60),source:'Mua đứt'},st.calc);
 const run=()=>{
  const num=el=>el.value===''?null:Math.round(parseFloat(el.value)*1e6);
  const it={sku:'THỬ',m0_price:num(ids.m0),cost:num(ids.cost),ready_for_sale_date:ids.ready.value||null,sale_cycle_start:ids.cycle.value||null,source:ids.src.value,special:ids.special.value||null,legacy_reset:ids.legacy.checked,legacy_reset_date:ids.reset.value||null};
  const calc=E.isDate(ids.calc.value)?ids.calc.value:st.calc,r=E.evaluate(it,calc,policy.versions),ver=E.versionAt(policy.versions,calc)||{bracketMode:'fixedM0',costMode:'keepPrev',none:true};
  const T={future:'Chưa tới',applied:'Áp dụng',stopped_cost:'Dừng: lượt này sẽ thấp hơn giá vốn, giữ giá trước lượt',to_cost:'Hạ đúng bằng giá vốn rồi dừng',stopped:'Đã dừng',no_rule:'Không có quy định cho bậc giá này',skipped_before_ready:'Bỏ qua: lượt này rơi trước ngày sẵn sàng bán (không giảm, không bù sau)',no_policy:'Bỏ qua: chưa có phiên bản chính sách hiệu lực vào ngày này (không dùng chính sách tương lai)'};
  let html;
  if(r.lock)html=`<div class="banner err" role="status"><strong>Không tự tính:</strong> ${esc(r.lock.text)}. ${r.age.state==='ok'?`Tuổi tồn vẫn là ${r.age.label} (${r.age.days} ngày).`:''}</div>`;
  else html=`<p class="calc-sum" id="calc-sum">Tuổi tồn <b>${r.age.label}</b> (${r.age.days} ngày từ ngày sẵn sàng) · Bậc giá <b>${r.tier}</b> (${r.cycleDays} ngày từ đầu chu kỳ ${dmy(r.cycleStart)}) · Giá đề xuất <b id="calc-price">${tr(r.proposed)}</b> (giảm ${tr(r.discount)} so với M0 ${tr(it.m0_price)})${r.hitCost?' · <span class="tag warn">đã chạm giá vốn</span>':''}${r.exhausted?' · <span class="tag bad">quá M6: hết lượt auto, xử lý tay</span>':''}${r.skipped?` · <span class="tag warn">bỏ qua ${r.skipped} lượt${r.cycleBeforeReady?' (chu kỳ giá bắt đầu trước ngày sẵn sàng)':''}</span>`:''}</p>
   <div class="table-scroll"><table class="an timeline" id="timeline"><thead><tr><th>Lượt</th><th>Ngày</th><th>Bậc giá M0/giá</th><th class="r">Mức giảm</th><th class="r">Giá trước</th><th class="r">Giá sau</th><th>Trạng thái</th></tr></thead><tbody>${r.turns.map(t=>`<tr class="t-${t.status}" data-k="${t.k}" data-status="${t.status}"><td>M${t.k}</td><td>${dmy(t.date)}</td><td>${t.bracket?`${t.bracket.min}–<${t.bracket.max} tr`:'—'}</td><td class="r">${t.status==='future'?'—':tr(t.amount)}</td><td class="r">${tr(t.before)}</td><td class="r">${tr(t.after)}</td><td class="wrap">${T[t.status]}${t.k===3?'<span class="hint-m3">Gợi ý demo M3: content / topic sale / TikTok / ads · đánh dấu Kiot (chỉ hiển thị).</span>':''}</td></tr>`).join('')}</tbody></table></div>
   <p class="note">Phiên bản chính sách theo từng lượt: ${[...new Set(r.turns.filter(t=>t.due&&t.version).map(t=>t.version))].join(', ')||'chưa có lượt áp dụng'} · ${ver.none?'chưa có phiên bản hiệu lực':`cách xếp bậc: ${ver.bracketMode==='fixedM0'?'cố định theo M0':'theo giá trước mỗi lượt'} · khi chạm vốn: ${ver.costMode==='keepPrev'?'giữ giá trước lượt':'hạ bằng giá vốn'}`} ${A}</p>`;
  $('#calc-out').innerHTML=html;
 };
 $$('#calc-card input,#calc-card select').forEach(el=>el.addEventListener('input',run));
 $$('[data-days]',$('#calc-card')).forEach(b=>b.onclick=()=>{const d=+b.dataset.days,calc=ids.calc.value||st.calc;ids.ready.value=E.addDays(calc,-d);ids.cycle.value=E.addDays(calc,-d);ids.legacy.checked=false;run()});
 run();
}
let calcSeed=null;
function loadCalc(s){calcSeed=s;if(st.tab!=='tuoi'){st.tab='tuoi';writeHash();render()}else{calcInit(s,st.calc);$('#c-m0').dispatchEvent(new Event('input'))}
 setTimeout(()=>{calcSeed=null;const c=$('#calc-card');c&&c.scrollIntoView({block:'start',behavior:'auto'})},0)}

/* ============================================================
   TAB 3 — Chính sách Auto Sale (cũ, mô phỏng)
   ============================================================ */
const BMODE={fixedM0:'Cố định theo bậc giá M0',perTurn:'Theo bậc giá của giá trước mỗi lượt'},CMODE={keepPrev:'Giữ giá trước lượt rồi dừng',toCost:'Hạ đúng bằng giá vốn rồi dừng'};
const QUESTIONS=['Mức giảm xếp theo bậc giá M0 cố định, hay theo giá trước mỗi lượt?','Khi một lượt làm giá thấp hơn giá vốn: giữ giá trước lượt hay hạ bằng vốn? Sau đó có dừng hẳn không?','Hàng ký gửi có được giảm giá tự động không? “Vốn” của ký gửi là gì?','Thế nào là một lượt hợp lệ (ví dụ đang giữ/đặt cọc)? Lượt bị lỡ thì bỏ hay bù?','Ngày reset giá niêm yết cho hàng cũ đến 6/2026 là ngày nào? Hàng đó có được tính lượt tiếp theo từ ngày reset không?','Hot/trend (“đến M3 mới bắt đầu M0”), quy tắc 3%, cơ chế 1/2, giá thu về: công thức cụ thể là gì?','Hàng từ 600 triệu trở lên áp dụng quy định nào?','Khóa ghép Sapo, Kiot, Price System là SKU hay mã dòng sản phẩm? Nguồn chính thức của giá vốn, giá niêm yết, ngày sẵn sàng bán?'];
function previewFor(draft){
 const v=E.clone(draft);v.id='nháp';const after=policy.versions.concat([v]),out=[];
 for(const date of [st.calc,E.addDays(st.calc,60)]){
  const b=E.evaluateAll(D.STOCK,date,policy.versions),a=E.evaluateAll(D.STOCK,date,after),bm={};b.forEach(r=>bm[r.sku]=r);
  const ch=a.filter(r=>!r.lock&&(bm[r.sku].proposed!==r.proposed||bm[r.sku].tier!==r.tier));
  const sd=rs=>sum(rs.filter(r=>!r.lock),r=>r.discount);
  out.push({date,changed:ch.length,discB:sd(b),discA:sd(a),hitB:b.filter(r=>r.hitCost).length,hitA:a.filter(r=>r.hitCost).length,lockB:b.filter(r=>r.lock).length,lockA:a.filter(r=>r.lock).length,
   top:ch.map(r=>({r,b:bm[r.sku],delta:r.proposed-bm[r.sku].proposed})).sort((x,y)=>Math.abs(y.delta)-Math.abs(x.delta)).slice(0,10)});
 }
 return out;
}
function renderPolicy(){
 if(!policy.draft)policy.draft=freshDraft();
 const d=policy.draft,vs=policy.versions.slice().sort((a,b)=>a.effective.localeCompare(b.effective)||a.id.localeCompare(b.id));
 view.innerHTML=`<div class="banner"><strong>Chưa áp dụng thực tế.</strong> Không đổi giá Kiot/Sapo. Đây là chính sách cũ do anh cung cấp, dùng để mô phỏng. Luồng: chỉnh nháp → xem trước tác động → hủy hoặc duyệt <b>GIẢ LẬP</b> → tab “Tuổi tồn & Auto Sale” tính lại.</div>
 <section class="card"><div class="card-head"><h2>Phiên bản chính sách</h2><p>Mỗi lượt giảm dùng phiên bản đang hiệu lực vào ngày của lượt đó; lượt đã qua không bị tính lại ${A}</p></div>
  <div class="table-scroll"><table class="an" id="ver-table"><thead><tr><th>Phiên bản</th><th>Hiệu lực từ</th><th>Cách xếp bậc</th><th>Khi chạm vốn</th><th>Trạng thái</th></tr></thead><tbody>${vs.map(v=>`<tr data-id="${esc(v.id)}"><td><b>${esc(v.id)}</b> <small class="note">${esc(v.name)}</small></td><td>${dmy(v.effective)}</td><td>${BMODE[v.bracketMode]}</td><td>${CMODE[v.costMode]}</td><td>${v.approvedAt?'<span class="tag ok">Duyệt giả lập</span>':'<span class="tag">Chính sách cũ (mô phỏng)</span>'}${v.effective>st.calc?' <span class="tag warn">chưa hiệu lực</span>':''}</td></tr>`).join('')}</tbody></table></div>
  <div class="pol-actions"><button class="btn-ghost" type="button" id="p-reset">Xóa mọi phiên bản demo (về v0)</button></div></section>
 <section class="card"><div class="card-head"><h2>Nháp chính sách</h2><p>Mức giảm mỗi lượt, đơn vị <b>triệu VND</b>. Cột 1 áp dụng cho lượt M1 và M2, cột 2 cho M3–M6. Ranh giới bậc giá chỉ đọc. Từ 600 triệu: chưa có quy định.</p></div>
  <div class="pol-grid"><label>Ngày hiệu lực (demo)<input type="date" id="d-eff" min="${st.calc}" value="${esc(d.effective)}"></label><p class="note" style="align-self:end" id="reset-note">Ngày reset giá của hàng cũ là <b>dữ liệu của từng món</b> ${A} nên chính sách mới không dời được chu kỳ đã chạy và không viết lại lượt quá khứ.</p><span></span>
   <label><span>Cách xếp bậc giảm ${A}</span><select id="d-bmode">${Object.entries(BMODE).map(([k,l])=>`<option value="${k}"${d.bracketMode===k?' selected':''}>${l} (ví dụ, chưa được duyệt)</option>`).join('')}</select></label>
   <label><span>Khi giảm làm giá thấp hơn vốn ${A}</span><select id="d-cmode">${Object.entries(CMODE).map(([k,l])=>`<option value="${k}"${d.costMode===k?' selected':''}>${l} (ví dụ, chưa được duyệt)</option>`).join('')}</select></label></div>
  <div class="table-scroll"><table class="an pol-table" id="pol-table"><thead><tr><th>Bậc giá M0 (triệu)</th><th class="r">M1 & M2</th><th class="r">M3–M6</th></tr></thead><tbody>${d.brackets.map((b,i)=>`<tr><td class="ro">${b.min} – dưới ${b.max}</td><td class="r"><label class="vh" for="d-c1-${i}">M1 và M2, bậc ${b.min} đến ${b.max}</label><input id="d-c1-${i}" data-i="${i}" data-f="c1" type="number" min="0" step="0.1" value="${b.c1}"></td><td class="r"><label class="vh" for="d-c2-${i}">M3 đến M6, bậc ${b.min} đến ${b.max}</label><input id="d-c2-${i}" data-i="${i}" data-f="c2" type="number" min="0" step="0.1" value="${b.c2}"></td></tr>`).join('')}<tr><td class="ro">600 trở lên</td><td class="r ro" colspan="2">Chưa có quy định: không đủ chính sách, không tự tính</td></tr></tbody></table></div>
  <div id="pol-msgs"></div>
  <div class="pol-actions"><button class="btn-solid" type="button" id="p-preview">Xem trước tác động</button><button class="btn-ghost" type="button" id="p-cancel">Hủy nháp</button><button class="btn-solid" type="button" id="p-approve" disabled>Duyệt GIẢ LẬP</button><span class="note" id="p-state" style="margin:0"></span></div></section>
 <div id="pol-preview"></div>
 <section class="card"><div class="card-head"><h2>Chưa chốt, ghi để hỏi lại</h2><p>Các mục sau khóa tính tự động hoặc chỉ là ví dụ ${A}</p></div><ol class="q-list">${QUESTIONS.map(q=>`<li>${esc(q)}</li>`).join('')}</ol>
  <p class="note">Quy tắc đang áp dụng trong mô phỏng: ký gửi khóa auto; Hot/trend, 3%, 1/2, giá thu về khóa vì thiếu công thức; từ 600 triệu không đủ chính sách; giá M0 thấp hơn vốn thì khóa và báo xử lý tay (không tự tăng giá); không auto vượt M6.</p></section>`;
 const q=(id)=>$(id);
 function sync(){
  const v=E.validateVersion(policy.draft,st.calc);if(policy.preview&&policy.sig!==draftSig())policy.preview=null;
  if(!policy.preview)$('#pol-preview').innerHTML='';
  $('#pol-msgs').innerHTML=(v.errors.length?`<ul class="msg-list e" role="alert">${v.errors.map(m=>`<li>${esc(m)}</li>`).join('')}</ul>`:'')+(v.warnings.length?`<ul class="msg-list w">${v.warnings.map(m=>`<li>${esc(m)}</li>`).join('')}</ul>`:'');
  $('#p-preview').disabled=v.errors.length>0;
  $('#p-approve').disabled=!(policy.preview&&policy.sig===draftSig()&&!v.errors.length);
  $('#p-state').textContent=v.errors.length?'Sửa lỗi trước khi xem trước.':policy.preview?'Đã xem trước. Có thể duyệt giả lập hoặc hủy nháp.':'Nháp đã đổi: cần “Xem trước tác động” trước khi duyệt giả lập.';
  $$('#pol-table input').forEach(i=>i.setAttribute('aria-invalid',String(!(parseFloat(i.value)>=0))));
 }
 const touch=()=>{policy.preview=null;savePolicy();sync()};
 $('#d-eff').addEventListener('input',e=>{policy.draft.effective=e.target.value;touch()});
 $('#d-bmode').addEventListener('change',e=>{policy.draft.bracketMode=e.target.value;touch()});
 $('#d-cmode').addEventListener('change',e=>{policy.draft.costMode=e.target.value;touch()});
 $$('#pol-table input').forEach(i=>i.addEventListener('input',()=>{const v=parseFloat(i.value);policy.draft.brackets[+i.dataset.i][i.dataset.f]=isNaN(v)?NaN:v;touch()}));
 $('#p-preview').onclick=()=>{
  const pv=previewFor(policy.draft);policy.preview=pv;policy.sig=draftSig();
  const col=(p)=>`<div class="tile"><p class="l">Ngày ${dmy(p.date)}</p><p class="v">${p.changed} món đổi</p><p class="c">Giảm dự kiến ${tr(p.discB)} → ${tr(p.discA)} (${p.discA-p.discB>=0?'+':'−'}${tr(Math.abs(p.discA-p.discB)).replace('−','')}) · chạm vốn ${p.hitB} → ${p.hitA} · bị khóa ${p.lockB} → ${p.lockA}</p></div>`;
  $('#pol-preview').innerHTML=`<section class="card" id="pv-card"><div class="card-head"><h2>Xem trước tác động</h2><p>So sánh với các phiên bản đã duyệt. Nháp hiệu lực từ ${dmy(policy.draft.effective)}: lượt trước ngày đó giữ theo phiên bản cũ nên thường chưa đổi tại ngày tính; cột “sau 60 ngày” cho thấy tác động khi các lượt tiếp theo tới hạn. Không đổi giá thật.</p></div>
   <div class="kpis" style="grid-template-columns:repeat(2,minmax(0,1fr))" id="pv-tiles">${pv.map(col).join('')}</div>
   ${pv.map(p=>`<h3 class="sub" style="margin-top:var(--s4)">10 món đổi nhiều nhất · ngày ${dmy(p.date)}</h3><div class="table-scroll"><table class="an pv-top"><thead><tr><th>SKU</th><th>Sản phẩm</th><th class="r">Giá đề xuất hiện tại</th><th class="r">Giá đề xuất theo nháp</th><th class="r">Chênh</th></tr></thead><tbody>${p.top.map(x=>{const s=D.STOCK.find(z=>z.sku===x.r.sku);return `<tr><td translate="no">${s.sku}</td><td>${esc(s.name)}</td><td class="r">${tr(x.b.proposed)}</td><td class="r">${tr(x.r.proposed)}</td><td class="r ${x.delta<0?'neg':''}">${tr(x.delta)}</td></tr>`}).join('')||'<tr><td colspan="5">Không có món nào đổi.</td></tr>'}</tbody></table></div>`).join('')}</section>`;
  sync();$('#pv-card').scrollIntoView({block:'nearest'});
 };
 $('#p-cancel').onclick=()=>{policy.draft=freshDraft();policy.preview=null;savePolicy();toast('Đã hủy nháp. Mọi thứ về như phiên bản đang hiệu lực.');renderPolicy()};
 $('#p-approve').onclick=()=>{
  const v=E.clone(policy.draft),n=Math.max(0,...policy.versions.map(x=>parseInt(String(x.id).replace(/\D/g,''))||0))+1;
  v.id='v'+n;v.name='Duyệt giả lập, chưa áp dụng thực tế';v.approvedAt=new Date().toISOString();
  policy.versions.push(v);policy.draft=freshDraft();policy.preview=null;_resKey='';savePolicy();
  toast(`Đã duyệt GIẢ LẬP ${v.id} (hiệu lực ${dmy(v.effective)}). Tab “Tuổi tồn & Auto Sale” đã tính lại.`);renderPolicy();
  $('#view').insertAdjacentHTML('afterbegin',`<div class="banner ok" id="approved-banner" role="status"><strong>Đã duyệt GIẢ LẬP ${esc(v.id)}.</strong> Hiệu lực từ ${dmy(v.effective)}, chưa áp dụng thực tế. Ảnh hưởng hiện ra khi ngày tính ≥ ngày hiệu lực. <button class="link" type="button" id="goto-tuoi" style="color:var(--walnut);font-weight:600;text-decoration:underline">Xem tab Tuổi tồn & Auto Sale</button></div>`);
  $('#goto-tuoi').onclick=()=>setTab('tuoi');
 };
 $('#p-reset').onclick=()=>{policy.versions=E.defaultVersions();policy.draft=null;policy.preview=null;_resKey='';savePolicy();toast('Đã xóa các phiên bản demo, về v0.');renderPolicy()};
 sync();
}

/* ============================================================
   TAB 4 — Sale & kênh (kept small; distinct orders vs line items)
   ============================================================ */
function renderSale(){
 const ls=D.LINES,a=aggLines(ls);
 const per=D.CHANNELS.map(c=>({c,...aggLines(ls.filter(l=>l.channel===c))}));
 const stackRow=(label,key,tot)=>`<div class="stack-row"><span class="lab">${label}</span><div class="stack" role="img" aria-label="${label}: ${per.map(p=>`${p.c} ${pc(p[key]/tot*100)}`).join(', ')}">${per.map(p=>{const v=p[key]/tot*100;return v>0?`<span class="${p.c==='Cửa hàng'?'lt':''}" style="width:${v}%;background:${CH_COLOR[p.c]}">${v>=9?pc(v):''}</span>`:''}).join('')}</div></div>`;
 const rows=D.SALES.map(s=>{const arr=ls.filter(l=>l.assignee===s);return {s,arr,...aggLines(arr)}}).sort((x,y)=>y.rev-x.rev);
 view.innerHTML=`<div class="banner">Tab này luôn tính <b>mọi kênh</b> trong kỳ ${D.PERIOD.label}; không chịu bộ lọc kênh/giá của tab Hàng hóa.</div>
 <div class="kpis" id="kpis">${[['Số đơn',a.orders,`${a.items} dòng hàng · đếm đơn không trùng`],['Doanh thu',tr(a.rev),'Giá bán thực tế'],['Giá trị đơn TB',tr(a.aov),'Doanh thu ÷ số đơn'],['Lãi gộp',tr(a.gp),pc(a.margin)+' lãi gộp'],['Số món',a.items,'Số dòng hàng'],['Đơn nhiều dòng',[...groupBy(ls,l=>l.order)].filter(([,x])=>x.length>1).length,'Đơn có từ 2 dòng hàng']].map(([l,v,c],i)=>`<div class="tile${i===2?' hero':''}"><p class="l">${l}</p><p class="v">${v}</p><p class="c">${c}</p></div>`).join('')}</div>
 <section class="card"><div class="card-head"><h2>Tỷ trọng kênh bán</h2><p>Mẫu số: toàn bộ ${a.orders} đơn / ${tr(a.rev)} doanh thu / ${tr(a.gp)} lãi gộp trong kỳ.</p></div><div class="legend">${per.map(p=>`<span><i style="background:${CH_COLOR[p.c]}"></i>${p.c}</span>`).join('')}</div>${stackRow('Doanh thu','rev',a.rev)}${stackRow('Số đơn','orders',a.orders)}${stackRow('Lãi gộp','gp',a.gp)}</section>
 <section class="card"><div class="card-head"><h2>Hiệu quả từng sale</h2><p>Số đơn đếm theo mã đơn không trùng; số món là số dòng hàng.</p></div><div class="table-scroll"><table class="an" id="sale-table"><thead><tr><th>Sale</th><th class="r">Số đơn</th><th class="r">Số món</th><th class="r">Doanh thu</th><th class="r">Giá trị đơn TB</th><th class="r">Lãi gộp</th><th>Kênh bán</th></tr></thead><tbody>${rows.map(r=>{const t=r.rev;const mix=D.CHANNELS.map(c=>sum(r.arr.filter(l=>l.channel===c),l=>l.price_actual));return `<tr data-h="${h(()=>linesSheet('Đơn của '+r.s,r.arr,'Sale'))}"><td><button class="link" type="button" data-h="${h(()=>linesSheet('Đơn của '+r.s,r.arr,'Sale'))}">${r.s}</button></td><td class="r">${r.orders}</td><td class="r">${r.items}</td><td class="r">${tr(r.rev)}</td><td class="r">${tr(r.aov)}</td><td class="r">${tr(r.gp)}</td><td><span class="mini" role="img" aria-label="${D.CHANNELS.map((c,i)=>`${c} ${pc(t?mix[i]/t*100:0)}`).join(', ')}">${D.CHANNELS.map((c,i)=>mix[i]?`<span style="width:${mix[i]/t*100}%;background:${CH_COLOR[c]}"></span>`:'').join('')}</span></td></tr>`}).join('')}</tbody><tfoot><tr><td>Tổng</td><td class="r">${a.orders}</td><td class="r">${a.items}</td><td class="r">${tr(a.rev)}</td><td class="r">${tr(a.aov)}</td><td class="r">${tr(a.gp)}</td><td></td></tr></tfoot></table></div>
 <p class="note">Mỗi đơn chỉ có một sale phụ trách nên số đơn của các sale cộng lại bằng tổng.</p></section>`;
}

/* ---------- mount ---------- */
const TEMPLATE=`<div class="an-tabs"><div class="row"><div class="seg" role="tablist" aria-label="Phân tích" id="tabs">
  <button type="button" role="tab" id="tab-hang" data-tab="hang">Hàng hóa</button>
  <button type="button" role="tab" id="tab-tuoi" data-tab="tuoi">Tuổi tồn & Auto Sale</button>
  <button type="button" role="tab" id="tab-chinhsach" data-tab="chinhsach">Chính sách Auto Sale (cũ)</button>
  <button type="button" role="tab" id="tab-sale" data-tab="sale">Sale & kênh</button></div><span class="chip-status" id="period-chip"></span></div></div>
 <p class="mock-note"><strong>Mockup mô phỏng để duyệt, không phải hệ thống thật.</strong> Dữ liệu tổng hợp, đặt theo trường Sapo / Kiot / Price System. Không gọi API, không đổi giá Kiot hay Sapo, không gửi tin, không tạo việc. Mọi mục ghi <em>GIẢ ĐỊNH MÔ PHỎNG</em> là giả định, chưa phải quy tắc được duyệt.</p>
 <div class="an-wrap" id="view" role="tabpanel" tabindex="-1"></div>
 <dialog class="side-sheet" id="sheet" aria-labelledby="sheet-title">
  <div class="sheet-head"><p id="sheet-kicker">Chi tiết</p><button class="icon-btn" type="button" aria-label="Đóng" id="sheet-close"><svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button></div>
  <div class="sheet-body"><h2 id="sheet-title" tabindex="-1"></h2><div id="sheet-content"></div></div>
 </dialog>
 <div class="toast" id="toast" role="status" aria-live="polite"></div>`;
function wire(signal){
 sheet.addEventListener('cancel',e=>{e.preventDefault();closeSheet()});
 sheet.addEventListener('close',()=>{document.body.classList.remove('is-locked');if(opener&&opener.focus&&document.contains(opener))opener.focus()});
 sheet.addEventListener('click',e=>{if(e.target===sheet)closeSheet()});
 $('#sheet-close').onclick=closeSheet;
 document.addEventListener('click',e=>{
  if(!host.contains(e.target))return;
  const L=e.target.closest('[data-load]');if(L){loadCalc(D.STOCK.find(s=>s.sku===L.dataset.load));closeSheet();return}
  const x=e.target.closest('[data-h]');if(x&&H[+x.dataset.h])H[+x.dataset.h]();
 },{signal});
 if(!ONLY){const T=()=>TABS.filter(x=>$('#tab-'+x));$('#tabs').addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(b)setTab(b.dataset.tab)});
 $('#tabs').addEventListener('keydown',e=>{if(e.key!=='ArrowRight'&&e.key!=='ArrowLeft')return;const tt=T(),i=tt.indexOf(st.tab),n=tt[(i+(e.key==='ArrowRight'?1:tt.length-1))%tt.length];setTab(n);$('#tab-'+n).focus()})}
 if(STANDALONE)window.addEventListener('hashchange',()=>{readHash();render()},{signal}); // inside the dashboard the shell calls onHash() instead
}
/* opts: ns = hash key prefix ('' standalone, 'g_' inside the dashboard), base = fixed hash part ('view=goods'), standalone = own hashchange listener */
function mount(h,opts={}){
 if(ac)ac.abort();
 NS=opts.ns||'';BASE=opts.base||'';STANDALONE=!!opts.standalone;ONLY=opts.only==='sale'?'sale':'';host=h;host.classList.add('mod-goods');host.innerHTML=TEMPLATE;
 /* Sale & kênh now lives in KPI Sale (Tổng quan sale): the Goods tab strip shows it only in the standalone test host; ONLY='sale' embeds just that view */
 if(ONLY){$('.an-tabs').remove();$('.mock-note').remove()}else if(!STANDALONE)$('#tab-sale').remove();
 view=$('#view');sheet=$('#sheet');ac=new AbortController();wire(ac.signal);
 loadPolicy();readHash();render();
 return {onHash(){try{if(sheet&&sheet.open){sheet.classList.remove('is-closing');sheet.close()}}catch(_){}readHash();render()},destroy(){document.body.classList.remove('is-locked');if(ac){ac.abort();ac=null}try{if(sheet&&sheet.open)sheet.close()}catch(_){}host.classList.remove('mod-goods');host.innerHTML=''}};
}
/* Read-only numbers for the dashboard blocks, built with the same aggLines/stockAgg as the tabs: all channels, no filters, default calc date.
   st.calc is swapped only for the call and always restored, so nothing leaks into the Goods tabs. */
function summary(){const keep=st.calc;loadPolicy();st.calc=D.CALC_DEFAULT;try{
 const a=aggLines(D.LINES),per=D.CHANNELS.map(c=>({c,...aggLines(D.LINES.filter(l=>l.channel===c))}));
 const k=stockAgg(D.STOCK);
 return {period:D.PERIOD,calc:D.CALC_DEFAULT,sold:a,channels:per,stock:{items:D.STOCK.length,consign:k.consign.length,own:k.own.length,ownCost:k.ownCost,m6:k.m6,m6pct:k.ownCost?k.m6/k.ownCost*100:NaN}}}finally{st.calc=keep}}
window.BAOQGoods={mount,summary};
window.__mock={st,policy,results,E,D};
})();
