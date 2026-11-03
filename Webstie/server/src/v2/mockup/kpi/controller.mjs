import {summarize} from './model.mjs?v=beb9a611';
import {analyze,THRESH} from './income.mjs?v=c2a46b0d';
import {esc,money,short,day,dmy,pct,pctText,stampText,badge,cbadge,STATE,KIND,REASONS,reasonOf,emptyState,note,meter,stackBar,tierTable,recordsTable,checks,chev,backIcon,icon} from './view.mjs?v=638bb864';

/* KPI Sale, mounted inside the dashboard's "Điều hành" shell (same band, sidebar, fonts, cards, buttons, motion).
   State lives in the URL hash under a key prefix (k_) so deep links, reload and Back/Forward work next to the shell's own `view=kpi`. */
const SRC_OK=/^https:\/\/baoqluxury\.(mysapo\.net|kiotviet\.vn)\//;
const VIEWS=[['channels','Tổng quan sale'],['income','Thu nhập sale'],['todo','Cần xử lý'],['list','Chứng từ'],['rules','Cách tính']];
const SNAP=new URL('./snapshot.json',import.meta.url);
let host=null,EXT={},sub=null,subTok=0,NS='k_',BASE='view=kpi',ac=null,data=null,AN=null,S=null,lastKey='',opener=null,tok=0;
const $=s=>host.querySelector(s);
const reduce=()=>matchMedia('(prefers-reduced-motion:reduce)').matches;

/* ---------- URL state ---------- */
const g=(p,k,d='')=>p.get(k)??d;
const innerParams=()=>{const o=new URLSearchParams(),r=new URLSearchParams(location.hash.slice(1));for(const [k,v] of r)if(k.startsWith(NS))o.set(k.slice(NS.length),v);return o};
function parse(){const p=innerParams(),v=g(p,'view','income');
 return {view:['channels','income','sale','todo','list','rules'].includes(v)?v:'income',period:['sample','nov','oct'].includes(g(p,'period'))?g(p,'period'):'sample',sale:g(p,'sale','all'),kind:g(p,'kind','all'),state:g(p,'state','all'),rs:g(p,'rs'),pers:['1','0'].includes(g(p,'pers'))?g(p,'pers'):'',q:g(p,'q'),back:g(p,'back')}}
const enc=o=>{const p=new URLSearchParams();for(const [k,v] of Object.entries(o)){if(v===undefined||v===null||v===''||v===false||v==='all'||(k==='period'&&v==='sample')||(k==='view'&&v==='income'))continue;p.set(k,String(v))}return p.toString()};
const pref=qs=>{const o=new URLSearchParams();for(const [k,v] of new URLSearchParams(qs))o.set(NS+k,v);return o.toString()};
const cur=()=>innerParams().toString();
const depth=h=>{const b=new URLSearchParams(h).get('back');return b?1+depth(b):0};
const capBack=h=>{if(depth(h)<2)return h;const p=new URLSearchParams(h);p.delete('back');return p.toString()};
const H=o=>{const q=pref(enc({period:S.period,...o}));return '#'+BASE+(q?'&'+q:'')};
const L=o=>H({...o,back:capBack(cur()||'view=income')});
const M=o=>H({...S,...o});
const viewName=v=>VIEWS.find(x=>x[0]===v)?.[1]||'Thu nhập sale';
const backLabel=h=>{const p=new URLSearchParams(h),v=g(p,'view','income');if(v==='sale'&&g(p,'sale','all')!=='all')return 'Hồ sơ '+(g(p,'sale')==='unknown'?'chưa gán sale':g(p,'sale'));return viewName(v==='sale'?'income':v)};
const backBtn=()=>S.back?`<a class="ghost-btn k-back" href="#${BASE}&${pref(S.back)}" data-fid="k-back">${backIcon}Quay lại ${esc(backLabel(S.back))}</a>`:'';

/* ---------- data ---------- */
const bySale=(rows,s)=>rows.filter(r=>s==='all'||(s==='unknown'?!r.sale:r.sale===s));
const count=(rows,st)=>rows.filter(r=>r.state===st).length;
const sumBy=(rows,f)=>rows.reduce((a,r)=>a+(f(r)||0),0);
const saleName=s=>s==='unknown'?'Chưa gán sale':s;
function filtered(opt={}){const s={...S,...opt},q=s.q.trim().toLowerCase();
 return bySale(AN.records,s.sale).filter(r=>(s.kind==='all'||r.kind===s.kind)&&(s.state==='all'||r.state===s.state)&&(!s.pers||(r.kind==='selling'&&r.state==='provisional'&&(s.pers==='1'?r.personal===true:r.personal===false)))&&(!s.rs||reasonOf(r).key===s.rs)&&(!q||[r.code,r.source,r.sale,r.sku?.join(' ')].join(' ').toLowerCase().includes(q)))}
const saleOptions=(sel,all='Toàn team')=>`<option value="all"${sel==='all'?' selected':''}>${all}</option>`+AN.team.map(t=>`<option value="${esc(t.name)}"${sel===t.name?' selected':''}>${esc(t.name)}</option>`).join('')+`<option value="unknown"${sel==='unknown'?' selected':''}>Chưa gán sale</option>`;
const amt=c=>c.status==='provisional'?money(c.amount):c.status==='notmet'?'0 ₫':'';
const drillOf=(sale,c)=>c.drill?L({view:'list',...c.drill}):'';

/* ---------- context: period, as-of, coverage ---------- */
function ctxCard(){const p=data.period,cv=AN.coverage;
 return `<section class="card k-ctx" aria-label="Kỳ, thời điểm và độ bao phủ">
  <div class="k-strip"><span class="sev check">Mẫu một phần</span><span class="sev draft">Không phải thu nhập thực</span><span class="k-sf num">Kỳ ${day(p[0])}–${day(p[1])} · ${cv.days} ngày</span><span class="k-sf num">As-of ${stampText(data.capturedAt)}</span><span class="k-sf k-sf-cov num">${cv.ordersRead}/${cv.ordersTotal} đơn đọc chi tiết · ${cv.receiptsWithSale}/${cv.receiptsTotal} phiếu có sale</span><span class="sev info k-sf-pol">Mô phỏng chính sách 11/2026</span></div>
  <details class="k-more"><summary>Chi tiết kỳ, độ bao phủ và cách đọc</summary>
   <dl class="k-facts"><div><dt>Chính sách</dt><dd>Mô phỏng chính sách 11/2026</dd></div><div><dt>Mẫu dữ liệu</dt><dd class="num">${dmy(p[0])} – ${dmy(p[1])} · ${cv.days} ngày</dd></div><div><dt>Tại thời điểm</dt><dd class="num">${stampText(data.capturedAt)}</dd></div><div><dt>Cập nhật</dt><dd>Ảnh chụp, không realtime</dd></div><div><dt>Đơn bán đã đọc chi tiết</dt><dd class="num">${cv.ordersRead} / ${cv.ordersTotal}</dd></div><div><dt>Phiếu thu mua có sale</dt><dd class="num">${cv.receiptsWithSale} / ${cv.receiptsTotal}</dd></div></dl>
   <p class="k-muted">“Chưa đủ dữ liệu” nghĩa là mẫu chưa chứng minh được, nên không hiển thị 0. Số trong mẫu dùng để thử chính sách tháng 11. Không nhân lên cả tháng và không coi là thu nhập thực. Hoa hồng / thưởng <b>không phải toàn bộ thu nhập</b>: lương cơ bản chưa cấu hình. Đơn tạo trước kỳ nhưng thu trong kỳ, hoàn / hủy và nguồn chưa đọc có thể làm kết quả thay đổi.</p></details></section>`}

/* ---------- Thu nhập sale (income-first) ---------- */
function compSub(c){const b=c.basis;
 if(c.key==='selling')return `Mẫu <b class="num">${short(b.total)}</b> / 500 tr tổng · <b class="num">${short(b.personal)}</b> / 100 tr cá nhân`;
 if(c.key==='personal')return `Mẫu cá nhân <b class="num">${short(b.personal)}</b> / 100 tr`;
 if(c.key==='cross')return `Mẫu <b class="num">${b.extra}</b> / 10 món thêm · đơn lớn nhất <b class="num">${short(b.maxOrder)}</b> / 300 tr`;
 if(c.key==='acq')return c.status==='unseen'?'Chưa thấy phiếu gắn sale này trong mẫu':`${b.receipts} phiếu · ${b.verified} đã đối soát`;
 if(c.key==='adjust')return c.status==='unseen'?'Chưa thấy trong mẫu, chưa xác định cả tháng':`${b.count} sự kiện chờ căn cứ`;
 return 'Riêng, không nằm trong tổng hoa hồng / thưởng'}
function compRow(sale,c){
 const val=amt(c)||c.status,inner=`<span class="c-l">${esc(c.label)}</span><span class="c-v c-${c.status}">${c.status==='provisional'?`<b class="num">${amt(c)}</b>`:esc(({insufficient:'Chưa đủ dữ liệu',pending:'Chờ xác minh',none:'Không có',unseen:'Chưa thấy trong mẫu',unconfigured:'Chưa cấu hình',notmet:'Chưa đạt · 0 ₫'})[c.status])}</span><span class="c-s">${compSub(c)}</span>`;
 const href=drillOf(sale,c);
 return href?`<li><a class="comp" href="${href}" data-fid="comp-${esc(sale)}-${c.key}">${inner}<span class="c-go" aria-hidden="true">${chev}</span></a></li>`:`<li><div class="comp is-static">${inner}</div></li>`}
function totalLine(s,detail=false){const t=s.total;
 return t.known?`<p class="kvalue num">${money(t.amount)}</p><p class="kctx">${t.openCount?`Chưa gồm ${t.openCount} khoản chờ / thiếu dữ liệu. `:''}Chưa phải toàn bộ thu nhập.</p>`
  :`<p class="kvalue is-text">Chưa đủ dữ liệu</p>${detail?'<p class="kctx">Mẫu chưa đủ để kết luận nên không hiển thị 0. Chưa phải toàn bộ thu nhập.</p>':''}`}
function saleCard(s){
 return `<article class="kcard k-sale" aria-labelledby="sc-${esc(s.name)}"><div class="ktop"><h3 class="k-name" id="sc-${esc(s.name)}">${esc(s.name)}</h3>${s.total.known?'<span class="sev ok">Có khoản tạm tính</span>':'<span class="sev check">Chưa đủ dữ liệu</span>'}</div>
  <p class="kctx">${s.counts.provisional} đơn tạm tính · ${s.counts.pending} chờ xác minh</p>
  <div class="k-total"><span class="klabel">Hoa hồng / thưởng đã xác minh</span>${totalLine(s)}</div>
  <ul class="comp-list">${s.components.map(c=>compRow(s.name,c)).join('')}</ul>
  <a class="klink link-btn" href="${L({view:'sale',sale:s.name})}">Xem hồ sơ thu nhập ${chev}</a></article>`}
function incomeView(){
 const c=AN.counts,t=AN.totals,O=AN.records.filter(r=>r.kind==='selling'),P=AN.records.filter(r=>r.kind==='acquisition'),R=AN.records.filter(r=>r.kind==='return');
 const kc=(cls,label,ic,value,ctx,href,isText)=>`<article class="kcard ${cls}"><div class="ktop"><span class="klabel">${label}</span><span class="kicon">${icon(ic)}</span></div><p class="kvalue num${isText?' is-text':''}">${value}</p><p class="kctx">${ctx}</p>${href?`<a class="klink link-btn" href="${href}">Xem chi tiết ${chev}</a>`:`<button class="klink link-btn" type="button" data-scrollto="k-sales-h">Xem từng sale ${chev}</button>`}</article>`;
 const strip=`<div class="kpi-grid k-kpis">`+
  kc('hero','Hoa hồng / thưởng đã xác minh','cash',t.known?money(t.amount):'Chưa đủ dữ liệu',t.known?`${t.salesWithKnown} sale có khoản tạm tính. Chưa phải toàn bộ thu nhập`:'Chưa sale nào đủ dữ liệu',null,!t.known)+
  kc('','Doanh số bán tạm tính','sales',short(t.verifiedSales),`${count(O,'provisional')} đơn đủ bằng chứng trong mẫu · cá nhân ${short(t.personalSales)}`,L({view:'list',kind:'selling',state:'provisional'}))+
  kc('','Chờ xác minh','wait',c.pending,`${count(O,'pending')} đơn · ${P.length} phiếu thu mua · ${R.length} hoàn`,L({view:'todo'}))+
  kc('','Loại trừ','skip',c.excluded,'Livestream, ký gửi đối tác / B2B. Không cần xử lý',L({view:'list',state:'excluded'}))+`</div>`;
 const parts=[{key:'provisional',label:'Tạm tính',n:c.provisional,href:L({view:'list',state:'provisional'})},{key:'pending',label:'Chờ xác minh',n:c.pending,href:L({view:'list',state:'pending'})},{key:'excluded',label:'Loại trừ',n:c.excluded,href:L({view:'list',state:'excluded'})}];
 const un=AN.unassigned,unTotal=un.pending+un.excluded+un.provisional;
 const groups=groupsOf(AN.records.filter(r=>r.state==='pending')).slice(0,3);
 return `${ctxCard()}
 <section class="k-sec k-sales" id="sales" aria-labelledby="k-sales-h"><div class="k-sh"><h2 id="k-sales-h" data-heading tabindex="-1">Thu nhập từng sale</h2><p>Bấm một khoản để xem đơn hoặc chứng từ cấu thành. Số mẫu không phải thu nhập tháng.</p></div>
  <div class="k-sale-grid">${AN.sales.map(saleCard).join('')||emptyState('Chưa có sale nào đủ bằng chứng','Khi đơn có sale được chốt, thu nhập từng sale sẽ hiện ở đây.')}</div>
  ${unTotal?`<a class="k-unassigned" href="${L({view:'sale',sale:'unknown'})}"><b class="num">${unTotal}</b> chứng từ chưa gán sale: chưa tính cho ai, không xếp hạng <span class="go">Xem ${chev}</span></a>`:''}</section>
 ${strip}
 <section class="card k-sec" aria-labelledby="k-evid-h"><div class="card-head"><h2 id="k-evid-h">Bằng chứng trong mẫu</h2><p>Tỷ lệ trên <b class="num">${c.all}</b> chứng từ: ${O.length} đơn Sapo, ${P.length} phiếu thu mua Kiot, ${R.length} sự kiện hoàn.</p></div>${stackBar(parts,c.all,'Cơ cấu bằng chứng trên '+c.all+' chứng từ')}</section>
 <section class="card k-sec" aria-labelledby="k-todo-h"><div class="card-head"><h2 id="k-todo-h">Cần xử lý trước</h2><a class="link-btn" href="${L({view:'todo'})}">Xem tất cả ${chev}</a></div>
  <ol class="mini-todo">${groups.map(x=>`<li><a href="${L({view:'list',state:'pending',rs:x.def.key})}"><b class="num">${x.rows.length}</b><span>${esc(x.def.title)}</span>${chev}</a></li>`).join('')}</ol></section>`;
}
function groupsOf(rows){const m=new Map();for(const r of rows){const d=reasonOf(r);if(!m.has(d.key))m.set(d.key,{def:d,rows:[]});m.get(d.key).rows.push(r)}return [...m.values()].sort((a,b)=>b.rows.length-a.rows.length)}

/* ---------- Hồ sơ thu nhập một sale ---------- */
function salePicker(){return `<label class="k-field"><span>Sale</span><select class="select" data-param="sale" data-fid="sale-pick" aria-label="Chọn sale">${saleOptions(S.sale,'Chọn sale…')}</select></label>`}
function compCard(s,c,body=''){
 const head=`<div class="card-head k-chead"><h3>${esc(c.label)}</h3>${cbadge(c.status)}<p>${esc(c.rule)}</p></div>`;
 const val=amt(c)?`<p class="kvalue num">${amt(c)}</p>`:`<p class="kvalue is-text">${({insufficient:'Chưa đủ dữ liệu',pending:'Chờ xác minh',none:'Không có',unseen:'Chưa thấy trong mẫu',unconfigured:'Chưa cấu hình'})[c.status]}</p>`;
 const href=drillOf(s.name,c);
 return `<section class="card k-comp" aria-label="${esc(c.label)}">${head}${val}${body}${href?`<a class="link-btn" href="${href}">Xem đơn / chứng từ cấu thành ${chev}</a>`:''}</section>`}
function saleView(){
 const un=S.sale==='unknown',s=AN.sales.find(x=>x.name===S.sale);
 if(S.sale==='all')return `<div class="card-head"><h2 data-heading tabindex="-1">Chọn sale để mở hồ sơ thu nhập</h2><p>Hồ sơ gồm các khoản hoa hồng, thưởng và điều chỉnh, mỗi khoản tính riêng.</p></div><div class="k-pick">${AN.sales.map(x=>`<a class="k-pickc" href="${L({view:'sale',sale:x.name})}"><b>${esc(x.name)}</b><span>${x.total.known?'Có khoản tạm tính':'Chưa đủ dữ liệu'}</span></a>`).join('')}</div>`;
 if(un){const rows=bySale(AN.records,'unknown');return `${backBtn()}<div class="k-phead"><div><p class="k-kicker">Hồ sơ</p><h2 class="k-h2" data-heading tabindex="-1">Chưa gán sale</h2></div>${salePicker()}</div>${note('Các chứng từ này chưa có sale hưởng KPI nên <b>không tính thu nhập cho ai</b>. Chốt sale tại hệ thống gốc rồi chụp lại snapshot.')}<div class="k-trio">${['provisional','pending','excluded'].map(st=>`<a class="k-stat" href="${L({view:'list',state:st,sale:'unknown'})}"><b class="num">${count(rows,st)}</b><span>${STATE[st].label}</span></a>`).join('')}</div>`}
 if(!s)return emptyState('Không có hồ sơ cho sale này','Tên sale trong đường dẫn không có trong snapshot.',`<a class="btn btn-secondary" href="${H({view:'sale'})}">Chọn lại sale</a>`);
 const t=AN.team.find(x=>x.name===s.name),mine=bySale(AN.records,s.name),[sel,per,crs,acq,adj,sal]=s.components;
 const attested=AN.coverage.mechanisms.selling==='attested';
 const cap=attested?'':'<p class="k-muted">Thanh là tiến độ của mẫu so với ngưỡng cả tháng. Chưa phải kết luận, và thiếu chưa có nghĩa là không đạt.</p>';
 const andBlock=`<div class="and-block"><div class="and-head"><span class="rule-chip">Cần đạt cả hai</span><span class="and-result ${sel.status==='provisional'?'ok':'gap'}">${sel.status==='provisional'?'Đủ điều kiện trên mẫu':'Chưa kết luận'}</span></div><div class="and-grid">${meter({label:'Tổng bán trong mẫu',value:t.total,target:THRESH.total,met:t.total>=THRESH.total,hint:'cá nhân + shop, không cộng trùng',drill:L({view:'list',kind:'selling',state:'provisional',sale:s.name})})}<span class="and-pill" aria-hidden="true">VÀ</span>${meter({label:'Trong đó bán cá nhân',value:t.personal,target:THRESH.personal,met:t.personal>=THRESH.personal,hint:'nguồn cá nhân đã xác minh',drill:L({view:'list',kind:'selling',state:'provisional',pers:1,sale:s.name})})}</div></div>${cap}
  <div class="k-split"><a class="k-stat" href="${L({view:'list',kind:'selling',state:'provisional',pers:1,sale:s.name})}"><span>Bán cá nhân</span><b class="num">${short(t.personal)}</b></a><a class="k-stat" href="${L({view:'list',kind:'selling',state:'provisional',pers:0,sale:s.name})}"><span>Bán shop</span><b class="num">${short(t.total-t.personal)}</b></a></div>
  <h4 class="k-h4">Cách chia bậc lũy tiến</h4>${tierTable(t.breakdown,t.eligible)}`;
 const persBody=meter({label:'Doanh số cá nhân trong mẫu',value:t.personal,target:THRESH.personal,met:t.personal>=THRESH.personal,drill:L({view:'list',kind:'selling',state:'provisional',pers:1,sale:s.name})});
 const crossBody=`<div class="and-grid or">${meter({label:'Nhánh A: số món thêm',value:t.extra,target:THRESH.items,fmt:n=>n+' món',met:t.extra>=THRESH.items,hint:'mỗi đơn cộng max(số món − 1, 0)',drill:L({view:'list',kind:'selling',state:'provisional',sale:s.name})})}<span class="and-pill or" aria-hidden="true">HOẶC</span>${meter({label:'Nhánh B: một đơn lớn',value:crs.basis.maxOrder,target:THRESH.order,met:crs.basis.maxOrder>=THRESH.order,hint:'đơn bán lớn nhất đủ bằng chứng',drill:L({view:'list',kind:'selling',state:'provisional',sale:s.name})})}</div><p class="k-muted">Đạt cả hai nhánh vẫn chỉ 1 triệu, một lần. Nhánh B chỉ xét đơn bán, không xét phiếu thu mua.</p>`;
 const rec=mine.filter(r=>r.kind==='acquisition');
 const acqBody=rec.length?recordsTable(rec):`<p class="k-muted">Chưa thấy phiếu thu mua gắn với sale này trong mẫu. Điều này <b>chưa chứng minh</b> là không có cả tháng.</p>`;
 const adjRows=mine.filter(r=>r.kind==='return'||/hoàn|hủy/i.test(r.status||''));
 const adjBody=adjRows.length?recordsTable(adjRows):`<p class="k-muted">Chưa thấy hoàn / hủy / quay đầu gắn với sale này trong mẫu, chưa xác định cả tháng. Sự kiện chưa gán sale nằm ở <a href="${L({view:'list',kind:'return'})}">Chứng từ hoàn</a>.</p>`;
 const total=`<section class="card k-comp k-grand" aria-label="Tổng đã xác minh"><div class="card-head k-chead"><h3>Hoa hồng / thưởng đã xác minh</h3>${s.total.known?'<span class="sev ok"><svg viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="3" fill="currentColor"/></svg>Có khoản tạm tính</span>':'<span class="sev check"><svg viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="3" fill="currentColor"/></svg>Chưa đủ dữ liệu</span>'}</div>${totalLine(s,true)}</section>`;
 return `${backBtn()}<div class="k-phead"><div><p class="k-kicker">Hồ sơ thu nhập</p><h2 class="k-h2" data-heading tabindex="-1">${esc(s.name)}</h2><p class="k-muted">${s.counts.provisional} đơn tạm tính · ${s.counts.pending} chờ xác minh · ${s.counts.excluded} loại trừ</p></div>${salePicker()}</div>
 ${total}${compCard(s,sel,andBlock)}${compCard(s,per,persBody)}${compCard(s,crs,crossBody)}${compCard(s,acq,acqBody)}${compCard(s,adj,adjBody)}
 <section class="card k-comp" aria-label="Lương cơ bản"><div class="card-head k-chead"><h3>${esc(sal.label)}</h3>${cbadge(sal.status)}<p>Cấu hình riêng, không nằm trong tổng hoa hồng / thưởng</p></div><p class="kvalue is-text">Chưa cấu hình</p><p class="k-muted">Không tính là 0 ₫ và không cộng vào bất kỳ tổng nào ở trên.</p></section>`;
}

/* ---------- Cần xử lý ---------- */
function todoView(){
 const rows=bySale(AN.records,S.sale),pend=rows.filter(r=>r.state==='pending'),exc=rows.filter(r=>r.state==='excluded');
 const gs=groupsOf(pend),ex=groupsOf(exc);
 const cards=gs.map(x=>{const id='claim-'+x.def.key;return `<article class="card k-todo"><div class="k-todo-main"><div class="k-todo-top"><h3>${esc(x.def.title)}</h3><span class="k-count num">${x.rows.length}</span></div>
  <p class="k-muted">Giá trị mặt chứng từ ${short(sumBy(x.rows,r=>r.amount))} (chưa phải KPI) · ${x.rows.length} chứng từ</p>
  <dl class="k-two"><dt>Còn thiếu</dt><dd>${esc(x.def.missing)}</dd><dt>Bước tiếp theo</dt><dd>${esc(x.def.next)}</dd></dl></div>
  <div class="k-todo-act"><a class="btn btn-primary" href="${L({view:'list',state:'pending',rs:x.def.key,sale:S.sale})}">Xem ${x.rows.length} chứng từ</a><button class="btn btn-secondary" type="button" disabled aria-describedby="${id}">Nhận việc</button><p class="k-muted" id="${id}">Chưa có hệ thống giao việc. Mockup không ghi nhận, không đánh dấu đã xử lý.</p></div></article>`}).join('');
 return `<div class="k-row"><div class="card-head"><h2 data-heading tabindex="-1">Cần xử lý</h2><p>${pend.length} chứng từ chờ xác minh, nhóm theo lý do. Sửa tại Sapo / Kiot; snapshot không tự cập nhật.</p></div><label class="k-field"><span>Sale</span><select class="select" data-param="sale" data-fid="todo-sale">${saleOptions(S.sale)}</select></label></div>
 ${cards||emptyState('Không có chứng từ chờ xác minh','Với bộ lọc này, mọi chứng từ đã có kết luận (tạm tính hoặc loại trừ).')}
 ${exc.length?`<details class="k-excl"><summary>Đã loại khỏi KPI, không cần xử lý (${exc.length})</summary><ul>${ex.map(x=>`<li><a href="${L({view:'list',state:'excluded',sale:S.sale})}"><b class="num">${x.rows.length}</b> ${esc(x.def.title)}</a></li>`).join('')}</ul></details>`:''}`;
}

/* ---------- Chứng từ ---------- */
function listChips(){
 const base=filtered({state:'all'});
 const chip=(k,l,n)=>`<a href="${M({state:k})}" data-fid="st-${k}" ${S.state===k?'aria-pressed="true"':'aria-pressed="false"'}>${l} <span class="count num">${n}</span></a>`;
 const act=[];
 if(S.pers)act.push([S.pers==='1'?'Chỉ nguồn cá nhân':'Chỉ nguồn shop',M({pers:''})]);
 if(S.rs)act.push([REASONS.find(x=>x.key===S.rs)?.title||S.rs,M({rs:''})]);
 return `<div class="seg k-seg2" role="group" aria-label="Lọc theo trạng thái">${chip('all','Tất cả',base.length)}${['provisional','pending','excluded'].map(s=>chip(s,STATE[s].label,count(base,s))).join('')}</div>${act.length?`<div class="k-active">${act.map(([l,h])=>`<a class="k-tag" href="${h}" aria-label="Bỏ lọc: ${esc(l)}">${esc(l)} <span aria-hidden="true">✕</span></a>`).join('')}</div>`:''}`;
}
function resultsHtml(){
 const rows=filtered(),sel=rows.filter(r=>r.kind==='selling'),acq=rows.filter(r=>r.kind==='acquisition');
 const parts=[sel.length?`Bán: doanh số tính vào KPI <b class="num">${money(sumBy(sel,r=>r.ctr))}</b>`:'',acq.length?`Thu mua: tiền đã đối soát làm nền 1,5% <b class="num">${money(sumBy(acq,r=>r.ctr))}</b>`:''].filter(Boolean);
 const head=`<p class="k-muted" id="result-count">${rows.length} chứng từ${parts.length?' · '+parts.join(' · ')+(parts.length>1?' · hai cơ chế tính riêng, không cộng chung':''):''}</p>`;
 return head+(rows.length?recordsTable(rows):emptyState('Không có chứng từ khớp bộ lọc','Thử bỏ bớt bộ lọc hoặc đổi từ khóa. Không có bản ghi khác với chưa có dữ liệu.',`<a class="btn btn-secondary" href="${H({view:'list',back:S.back})}">Xóa bộ lọc</a>`));
}
function listView(){
 const title=[S.kind==='all'?'Chứng từ':KIND[S.kind],S.state!=='all'?STATE[S.state].label.toLowerCase():'',S.pers==='1'?'nguồn cá nhân':S.pers==='0'?'nguồn shop':'',S.sale!=='all'?saleName(S.sale):''].filter(Boolean).join(' · ');
 return `${backBtn()}<div class="card-head"><h2 data-heading tabindex="-1">${esc(title)}</h2><p>Bấm mã để xem căn cứ và mở chứng từ gốc. Sửa tại hệ thống gốc, mockup không ghi dữ liệu.</p></div>
 <div class="k-filters"><div id="kchips">${listChips()}</div><div class="k-frow"><label class="k-field"><span>Loại chứng từ</span><select class="select" data-param="kind" data-fid="f-kind">${[['all','Tất cả'],['selling','Bán · Sapo'],['acquisition','Thu mua · Kiot'],['return','Hoàn · Sapo']].map(([v,l])=>`<option value="${v}"${S.kind===v?' selected':''}>${l}</option>`).join('')}</select></label><label class="k-field"><span>Sale</span><select class="select" data-param="sale" data-fid="f-sale">${saleOptions(S.sale,'Tất cả')}</select></label><label class="k-field grow"><span>Tìm mã, nguồn, sale</span><input class="k-input" id="kq" type="search" data-fid="q" value="${esc(S.q)}" placeholder="Ví dụ: Zalo, Linh" autocomplete="off"></label></div></div>
 <div id="kresults">${resultsHtml()}</div>`;
}

/* ---------- Cách tính & phạm vi dữ liệu ---------- */
function rulesView(){
 const rules=[['Doanh số bán','Cá nhân + shop, không cộng trùng. Chỉ tính đơn đủ tiền và trạng thái “Đã thanh toán”. Không có điều kiện đã giao hàng. Facebook / Zalo shop không phải nguồn cá nhân. Livestream và ký gửi đối tác / B2B loại trừ.'],
  ['Hoa hồng bán','Mỗi sale phải đạt đồng thời tổng ≥ 500 tr VÀ cá nhân ≥ 100 tr. Lũy tiến theo từng phần: 0–1 tỷ × 0,5%; 1–2 tỷ × 0,75%; 2–3 tỷ × 1%; 3–4 tỷ × 1,25%; 4–5 tỷ × 1,35%; trên 5 tỷ × 1,5%.'],
  ['Thưởng cá nhân','Đạt 100 tr bán cá nhân thì thưởng 1% toàn bộ doanh số cá nhân. Tính riêng với hoa hồng bán.'],
  ['Thu mua','1,5% tiền shop thực trả, theo khoản chi đã đối soát và phân bổ. Không cộng vào doanh số bán. Gán sale theo nguồn thu mua cố định của phiếu, không theo người tạo.'],
  ['Cross-sale','Mỗi đơn cộng max(số món − 1, 0). Đạt 10 món thêm HOẶC một đơn ≥ 300 tr thì 1 tr / sale / tháng, chỉ một lần.'],
  ['Quay đầu','Phí ≥ 10% giữ KPI trên toàn bộ giá bán ban đầu. Phí dưới 10% hoặc hủy không phí thì không tính. Chưa rõ căn cứ phí hoặc khác kỳ thì chờ xác minh.']];
 const c=data.coverage;
 return `<div class="card-head"><h2 data-heading tabindex="-1">Cách tính</h2><p>Công thức cố định, mô phỏng chính sách 11/2026. Không dùng AI suy đoán dữ liệu, không tự duyệt chi.</p></div>
 <ol class="k-rules">${rules.map(([t,d],i)=>`<li class="card"><span class="k-n num">${i+1}</span><div><h3>${t}</h3><p>${d}</p></div></li>`).join('')}</ol>
 <section class="card k-sec"><div class="card-head"><h2>Cách hiển thị khi thiếu dữ liệu</h2></div><ul class="k-bullets"><li><b>Chưa đủ dữ liệu:</b> khoản có ngưỡng tháng mà mẫu chưa chứng minh được đủ nguồn. Không ghi 0, không ghi “chưa đạt”.</li><li><b>Chưa thấy trong mẫu:</b> không có phiếu hay sự kiện gắn sale trong mẫu. Chưa chứng minh là không có cả tháng.</li><li><b>Chờ xác minh:</b> có bản ghi nhưng thiếu căn cứ.</li><li><b>Chưa cấu hình:</b> lương cơ bản, tách riêng, không cộng vào tổng hoa hồng / thưởng.</li><li><b>Chưa đạt / Không có:</b> chỉ hiện khi dữ liệu có bằng chứng đầy đủ rõ ràng và không còn bản ghi chờ. Snapshot hiện tại chưa có bằng chứng này.</li></ul></section>
 <section class="card k-sec"><div class="card-head"><h2>Phạm vi dữ liệu</h2><p>Ảnh chụp lấy qua giao diện tài khoản, chưa phải API. Số trong mẫu không phải thành tích tháng.</p></div>
 <dl class="k-two wide"><dt>Sapo</dt><dd>${esc(c.sapo)}</dd><dt>Kiot</dt><dd>${esc(c.kiot)}</dd><dt>Chi tiết</dt><dd>${esc(c.detail)}</dd><dt>Chưa xác minh</dt><dd>Toàn bộ hủy / hoàn, đổi nhóm nhà cung cấp theo lịch sử, một nhà cung cấp nhiều sale, phân bổ chi cho nhiều phiếu, thanh toán trong kỳ của đơn tạo trước kỳ, quyền API.</dd><dt>Để vận hành</dt><dd>Lưu sale ID và nguồn tại thời điểm chứng từ; nối theo order / receipt ID, SKU và payment ID; đồng bộ hủy, hoàn và ngày ghi nhận đã chốt. Cần đối chiếu API thực tế trước khi bật realtime.</dd></dl></section>`;
}

/* ---------- shell inside the module ---------- */
const TEMPLATE=`<div class="k-bar"><div class="seg k-tabs" id="ktabs" role="group" aria-label="KPI Sale"></div><label class="k-period"><span class="vh">Kỳ xem</span><select class="select" id="kperiod" aria-label="Kỳ xem"><option value="sample">Mẫu 26–30/10/2026 · có dữ liệu</option><option value="nov">Tháng 11/2026 · chưa có snapshot</option><option value="oct">Tháng 10/2026 · chính sách cũ, không tính lại</option></select></label></div>
<div id="kview" tabindex="-1" aria-busy="true"><p class="mod-loading" role="status">Đang tải snapshot…</p></div>
<dialog class="rec-dialog" id="kdetail" aria-labelledby="kd-title"><div class="dl-head"><p class="k-kicker" id="kd-kicker"></p><button class="close-btn" type="button" id="kclose">Đóng <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button></div><div id="kd-body"></div></dialog>
<div class="vh" id="klive" role="status" aria-live="polite"></div>`;
function renderTabs(){$('#ktabs').innerHTML=VIEWS.map(([k,l])=>`<a href="${H({view:k})}" data-fid="tab-${k}" aria-pressed="${(S.view===k||(k==='income'&&S.view==='sale'))?'true':'false'}">${l}</a>`).join('')}
function periodEmpty(){const o=S.period==='nov'?['Chưa có snapshot cho tháng 11/2026','Chính sách 11/2026 đang mô phỏng. Kỳ này chưa có dữ liệu nên không hiện số: một con số 0 sẽ bị hiểu nhầm là kết quả.']:['Tháng 10/2026 không tính lại','Tháng 10 áp dụng chính sách cũ nên nằm ngoài mockup này. Mẫu 26–30/10 chỉ dùng để thử chính sách tháng 11.'];return emptyState(o[0],o[1],`<a class="btn btn-primary" href="${H({period:'sample'})}">Về mẫu 26–30/10/2026</a>`)}
function dropSub(){subTok++;if(sub){try{sub.destroy&&sub.destroy()}catch(_){}sub=null}}
/* Tổng quan sale: the former Hàng hóa "Sale & kênh" view, embedded unchanged (all channels in the demo period; it ignores the Goods channel/price filters). Its period is NOT the KPI snapshot period. */
function channelsView(){
 return `<section class="card k-ctx" aria-label="Kỳ và nguồn của Tổng quan sale"><div class="k-strip"><span class="sev draft">Dữ liệu demo</span><span class="k-sf num" id="kchan-per">Kỳ demo</span><span class="k-sf">Nguồn: mô phỏng Sale &amp; kênh (Hàng hóa)</span><span class="sev info">Không cùng kỳ với snapshot KPI</span></div>
  <details class="k-more"><summary>Khác gì với Thu nhập sale</summary><p class="k-muted">Số trong trang này là dữ liệu demo của kỳ ghi ở thanh phía trên (đến 21/10, không phải cả tháng) và tính mọi kênh. Thu nhập sale dùng snapshot 26–30/10/2026 với chính sách 11 mô phỏng. Hai kỳ và hai nguồn không được cộng chung, và doanh thu ở đây không phải thu nhập thực của sale.</p><a class="link-btn" href="${H({view:'income'})}">Xem Thu nhập sale ${chev}</a></details></section>
  <div id="kchan" class="k-chan" aria-busy="true"><p class="mod-loading" role="status">Đang tải Sale &amp; kênh…</p></div>`}
async function mountChannels(){const my=++subTok,el=host&&host.querySelector('#kchan');if(!el||!EXT.goodsSale)return;
 try{const api=await EXT.goodsSale(el);if(my!==subTok||!host){api&&api.destroy&&api.destroy();return}sub=api;el.setAttribute('aria-busy','false');
  const per=window.BAOQGoods&&window.BAOQGoods.summary&&window.BAOQGoods.summary().period;const c=host.querySelector('#kchan-per');if(c&&per)c.textContent='Kỳ demo '+per.label}
 catch(_){if(my!==subTok||!el)return;el.setAttribute('aria-busy','false');el.innerHTML=emptyState('Không tải được Sale & kênh','Dữ liệu demo của Hàng hóa chưa đọc được trên máy này.',`<button class="btn btn-primary" type="button" id="kchan-retry">Thử lại</button>`);host.querySelector('#kchan-retry').addEventListener('click',()=>{el.innerHTML='';mountChannels()})}}
function render(){
 if(!host||!data)return;
 S=parse();const view=$('#kview');
 dropSub();$('#kperiod').value=S.period;$('#kperiod').closest('label').hidden=S.view==='channels';renderTabs();
 const key=[S.view,S.period,S.view==='sale'?S.sale:''].join('|'),prev=lastKey,changed=key!==prev;lastKey=key;
 const fid=!changed&&document.activeElement?.dataset?.fid;
 view.setAttribute('aria-busy','false');
 view.innerHTML=S.view==='channels'?channelsView():S.period!=='sample'&&S.view!=='rules'?periodEmpty():({income:incomeView,sale:saleView,todo:todoView,list:listView,rules:rulesView}[S.view])();
 if(S.view==='channels')mountChannels();
 if(fid){const el=host.querySelector(`[data-fid="${fid}"]`);if(el)el.focus({preventScroll:true})}
 else if(changed&&prev!==''){window.scrollTo({top:0});view.querySelector('[data-heading]')?.focus({preventScroll:true});$('#klive').textContent='Đang xem: '+viewName(S.view==='sale'?'income':S.view);if(!reduce())view.animate([{opacity:.35,transform:'translateY(4px)'},{opacity:1,transform:'none'}],{duration:180,easing:'cubic-bezier(.22,.8,.24,1)'})}
}

/* ---------- record detail: V2 record dialog (centre 560px; bottom sheet on phones) ---------- */
function detail(r){
 const sys=r.kind==='acquisition'?'Kiot':'Sapo',ok=SRC_OK.test(r.url||'');
 const paid=r.kind==='return'?`${money(r.refund)} hoàn`:r.paid===null||r.paid===undefined?'Chưa đọc':money(r.paid);
 const formula=r.kind==='acquisition'?'1,5% × khoản chi đã đối soát và phân bổ. Chưa có khoản đối soát nên chưa cộng hoa hồng thu mua.':r.kind==='return'?`Giá gốc ${money(r.amount)}; hoàn ${money(r.refund)}; giữ lại ${money(r.retained)} ≈ ${pctText(pct(r.retained,r.amount))} theo số học. Đây chưa phải phí đã chốt, nên chờ xử lý khác kỳ, không tự giữ hay trừ.`:r.state==='provisional'?`Đủ điều kiện nên cộng ${money(r.base)} vào doanh số của sale. Hoa hồng xét theo tổng doanh số của sale, không theo từng đơn.`:'Chưa cộng doanh số: chưa đủ các điều kiện ở trên.';
 const next=r.state==='provisional'?'Không cần thêm. Số tạm tính chờ chủ chốt tháng.':reasonOf(r).next;
 $('#kd-kicker').textContent=KIND[r.kind];
 $('#kd-body').innerHTML=`<h2 id="kd-title" tabindex="-1" class="sens">${esc(r.code)}</h2>${badge(r.state)}<p class="k-muted why-line">${esc(r.reason)}</p>
 <dl class="k-dl"><dt>Ngày chứng từ</dt><dd class="num">${dmy(r.date)}</dd><dt>Giá trị chứng từ</dt><dd class="num sens">${money(r.amount)}</dd><dt>Tính vào KPI</dt><dd class="num sens">${r.ctr?money(r.ctr):'Chưa tính'}</dd><dt>${r.kind==='acquisition'?'Đã trả (thấy trên UI)':'Đã thu (thấy trên UI)'}</dt><dd class="num sens">${paid}</dd><dt>Sale</dt><dd>${esc(r.sale||'Chưa gán sale')}</dd><dt>Nguồn</dt><dd class="sens">${esc(r.source||'Chưa đọc')}</dd><dt>Số món</dt><dd class="num">${esc(r.items??'—')}</dd><dt>SKU</dt><dd class="sens">${esc(r.sku?.join(', '))}</dd></dl>
 <h3 class="k-h4">Điều kiện</h3>${checks(r)}
 <p>${formula}</p><p class="k-next"><b>Bước tiếp theo:</b> ${esc(next)}</p>
 ${r.evidence?`<details class="k-ev"><summary>Bằng chứng đã đọc</summary><p class="k-muted sens">${esc(r.evidence)}</p></details>`:''}
 <div class="k-actions">${ok?`<a class="btn btn-primary" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">Mở trong ${sys} ${chev}</a>`:`<button class="btn btn-secondary" type="button" disabled aria-describedby="nolink">Mở trong ${sys}</button><p class="k-muted" id="nolink">Snapshot chưa có đường dẫn hợp lệ cho chứng từ này, nên nút bị khóa. Không đoán link.</p>`}</div>
 <p class="k-muted">Sửa tại ${sys}; mockup này không ghi dữ liệu nghiệp vụ và không tự cập nhật.</p>`;
 const dlg=$('#kdetail');opener=document.activeElement;dlg.showModal();document.body.classList.add('is-locked');$('#kd-title').focus({preventScroll:true});
}
function closeNow(){const d=host&&host.querySelector('#kdetail');if(d&&d.open){d.classList.remove('is-closing');d.close()}}
function closeDetail(){const dlg=$('#kdetail');if(!dlg||!dlg.open)return;if(reduce()){dlg.close();return}dlg.classList.add('is-closing');setTimeout(()=>{dlg.classList.remove('is-closing');if(dlg.open)dlg.close()},180)}

function wire(signal){
 const dlg=$('#kdetail');
 dlg.addEventListener('cancel',e=>{e.preventDefault();closeDetail()});
 dlg.addEventListener('close',()=>{document.body.classList.remove('is-locked');const o=opener;opener=null;if(o&&document.contains(o))o.focus({preventScroll:true})});
 dlg.addEventListener('click',e=>{if(e.target===dlg)closeDetail()});
 $('#kclose').addEventListener('click',closeDetail);
 host.addEventListener('click',e=>{const sc=e.target.closest('[data-scrollto]');if(sc){const t=$('#'+sc.dataset.scrollto);if(t){t.scrollIntoView({behavior:reduce()?'auto':'smooth',block:'start'});t.focus({preventScroll:true})}return}
  const o=e.target.closest('[data-open]')||(e.target.closest('tr[data-code]')&&!e.target.closest('a,button,select,input')?e.target.closest('tr[data-code]'):null);
  if(o){const r=AN.records.find(x=>x.code===(o.dataset.open||o.dataset.code));if(r)detail(r)}},{signal});
 host.addEventListener('change',e=>{
  if(e.target.id==='kperiod'){location.hash=H({view:S.view,period:e.target.value,sale:S.view==='sale'?S.sale:undefined});return}
  const p=e.target.dataset?.param;if(!p)return;
  if(p==='sale'&&S.view==='sale'){location.hash=H({view:'sale',sale:e.target.value==='all'?undefined:e.target.value,back:S.back});return}
  history.replaceState(null,'',M({[p]:e.target.value}));render();
 },{signal});
 host.addEventListener('input',e=>{if(e.target.id!=='kq')return;history.replaceState(null,'',M({q:e.target.value}));S=parse();const rs=$('#kresults');rs.innerHTML=resultsHtml();$('#kchips').innerHTML=listChips();if(!reduce())rs.animate([{opacity:.35,transform:'translateY(4px)'},{opacity:1,transform:'none'}],{duration:180,easing:'cubic-bezier(.22,.8,.24,1)'})},{signal});
}

/* ---------- read-only summary for dashboard blocks: same analyze() as the views, nothing is stored or mutated ---------- */
export async function summary(){const r=await fetch(SNAP,{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);const d=await r.json(),A=analyze(d);
 return {period:d.period,capturedAt:d.capturedAt,coverage:A.coverage,counts:A.counts,totals:A.totals,sales:A.sales.map(x=>({name:x.name,total:x.total,counts:x.counts}))}}

/* ---------- mount / unmount ---------- */
export function mount(h,opts={}){
 if(ac)ac.abort();
 EXT=opts.ext||{};NS=opts.ns||'k_';BASE=opts.base||'view=kpi';host=h;host.classList.add('mod-kpi');host.innerHTML=TEMPLATE;data=null;AN=null;lastKey='';
 ac=new AbortController();const my=++tok;S=parse();renderTabs();wire(ac.signal);
 fetch(SNAP,{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()}).then(j=>{if(my!==tok)return;data=j;AN=analyze(data);render()}).catch(()=>{if(my!==tok||!host)return;const v=$('#kview');v.setAttribute('aria-busy','false');
  v.innerHTML=emptyState('Không tải được snapshot','Tệp snapshot.json không đọc được trên máy này. Dữ liệu không đổi, chỉ chưa hiển thị được. Kiểm tra server cục bộ rồi thử lại.',`<button class="btn btn-primary" type="button" id="kretry">Thử lại</button>`);
  $('#kretry').addEventListener('click',()=>mount(host,opts))});
 return {onHash(){closeNow();render()},destroy(){tok++;dropSub();document.body.classList.remove('is-locked');if(ac){ac.abort();ac=null}try{const d=host&&host.querySelector('#kdetail');if(d&&d.open)d.close()}catch(_){}if(host){host.classList.remove('mod-kpi');host.innerHTML=''}host=null;data=null;AN=null}};
}
