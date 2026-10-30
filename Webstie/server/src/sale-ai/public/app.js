import { renderLiveResults, renderHistory, showUpdateDetails, clearLiveSelection } from './live-ui.js';
import { ageCell } from './age-cell.js';

// Website_3Q frames this page with ?embed=1 (Bảo 2026-10-19, TASK-035): dark purple theme without the own menu, and the page
// reports its height and opened dialogs so the website grows the frame instead of scrolling inside it. Standalone use is unchanged.
const embedded = new URL(location.href).searchParams.get('embed') === '1' && window.parent !== window;
if (embedded) {
  document.documentElement.classList.add('embedded');
  // The Webstie page (localhost:8787, Bảo 2026-10-27) asks for its light walnut palette; the old admin keeps dark purple.
  if (new URL(location.href).searchParams.get('theme') === 'walnut') document.documentElement.classList.add('walnut');
  const post = message => { window.parent.postMessage(message, location.origin); };
  new ResizeObserver(() => post({ type: 'baoq-sale-ai-height', height: document.body.scrollHeight })).observe(document.body);
  new MutationObserver(records => { if (records.some(record => record.target.tagName === 'DIALOG' && record.target.open)) post({ type: 'baoq-sale-ai-dialog' }); })
    .observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open'] });
}
const $ = s => document.querySelector(s);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const moneyFormatter=new Intl.NumberFormat('vi-VN',{maximumFractionDigits:2});
const dateFormatter=new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',dateStyle:'short',timeStyle:'short'});
const money = n => n == null ? '—' : moneyFormatter.format(n)+'đ';
const dateTime = d => dateFormatter.format(new Date(d));
const scenarioStatus = status => ({price_failed:'Chưa ghi được giá',note_pending:'Chờ bổ sung ghi chú',simulated:'Mô phỏng thành công'})[status] || status;
const typeLabel = type => type === 'hottrend' ? 'Hottrend' : type === 'normal' ? 'Hàng thường' : 'Chờ xử lý: thiếu tên';
let state, view = 'results', selectedRun, query = '', mFilter = '', pending = false;
let dataset='real';
const context=()=>{
  const source=state.dataset;
  return {esc,money,dateTime,pagedTable,api:(path,body,options={})=>api(path,body,{dataset:source,...options}),action,message,query,mFilter,loading:loadedKey!==requestKey(),canWrite:()=>!pending&&loadedKey===requestKey()&&dataset===source,beginOperation:()=>{pending=true;},endOperation:()=>{pending=false;},acceptUpdate:async()=>{if(dataset===source)await loadView();},openUpdateHistory:id=>{showUpdateDetails({dataset:source},id,context());}};
};
const pages = Object.fromEntries(['results','history','edits'].map(key=>[key,{page:1,size:10}]));
let resultsRunId;
let controller,requestSequence=0,loadedKey='',searchTimer;
function requestKey(){return JSON.stringify([dataset,view,selectedRun,query,mFilter,pages]);}
function lockOldView(){
  $('#content').setAttribute('aria-busy','true');
  $('#content').querySelectorAll('button,input[type="checkbox"],select,input[type="time"]').forEach(e=>e.disabled=true);
}
async function loadView(focusTarget){
  clearTimeout(searchTimer);controller?.abort();controller=new AbortController();
  const sequence=++requestSequence,key=requestKey(),source=dataset;
  lockOldView();
  const pager=pages[view==='history'?'history':'results'];
  const params=new URLSearchParams({view,page:pager.page,size:pager.size,q:query,edits_page:pages.edits.page,edits_size:pages.edits.size});
  if(source==='real'&&view==='results'&&mFilter!=='')params.set('m',mFilter);
  if(selectedRun)params.set('run',selectedRun);
  try{
    const data=await api('/api/view?'+params,undefined,{signal:controller.signal,dataset:source});
    if(sequence!==requestSequence||key!==requestKey())return false;
    state=data;
    if(data.pagination)Object.assign(pager,{page:data.pagination.page,size:data.pagination.size});
    if(data.editsPagination)Object.assign(pages.edits,{page:data.editsPagination.page,size:data.editsPagination.size});
    loadedKey=requestKey();render();syncUrl();$('#content').setAttribute('aria-busy','false');
    if(focusTarget)$('#content').querySelector(focusTarget)?.focus();
    return true;
  }catch(error){if(error.name!=='AbortError'&&sequence===requestSequence){message(error.message+' · Chưa tải được màn hình mới; dữ liệu đang hiển thị là bản cũ.',true);const retry=document.createElement('button');retry.textContent='Tải lại màn hình';retry.onclick=()=>loadView(focusTarget);$('#message').append(retry);$('#content').setAttribute('aria-busy','false');}return false;}
}
async function ensureView(){
  const source=dataset,sequence=requestSequence;
  try{const result=await api('/api/table/ensure',{}, {dataset:source});if(source===dataset&&sequence===requestSequence&&result.revision!==state?.revision)await loadView();}
  catch(error){if(source===dataset)message(error.message,true);}
}
function readUrl() {
  const params = new URL(location.href).searchParams;
  view = ['results','history'].includes(params.get('view')) ? params.get('view') : 'results';
  dataset = params.get('dataset') === 'sample' ? 'sample' : 'real';
  query = params.get('q') || ''; selectedRun = params.get('run') || null;
  const nextM=dataset==='real'?(params.get('m')??''):'';
  if(nextM!==mFilter)clearLiveSelection();
  mFilter=nextM;
  for (const [key, pager] of Object.entries(pages)) {
    const page = Number(params.get(key+'_page'));
    pager.page = Number.isSafeInteger(page) && page > 0 ? page : 1;
    const size = Number(params.get(key+'_size'));
    pager.size = [10,50,100].includes(size) ? size : 10;
  }
}
function viewUrl(nextView = view) {
  const url = new URL(location.href);url.search = '';
  if(embedded)url.searchParams.set('embed','1');
  if(embedded&&document.documentElement.classList.contains('walnut'))url.searchParams.set('theme','walnut');
  url.searchParams.set('view', nextView);url.searchParams.set('dataset', dataset);
  if(query)url.searchParams.set('q',query);
  if(dataset==='real'&&mFilter!=='')url.searchParams.set('m',mFilter);
  if(selectedRun)url.searchParams.set('run',selectedRun);
  for(const [key,pager] of Object.entries(pages)) {
    if(pager.page>1)url.searchParams.set(key+'_page',pager.page);
    if(pager.size!==10)url.searchParams.set(key+'_size',pager.size);
  }
  return url;
}
function syncUrl(push = false) {
  const url=viewUrl();if(url.href!==location.href)history[push?'pushState':'replaceState'](null,'',url);
  document.querySelectorAll('[data-view]').forEach(link=>{link.href=viewUrl(link.dataset.view);});
}
function navigate(nextView) {view=nextView;syncUrl(true);loadView().then(ok=>{if(ok)$('#title').focus();});}
function announcePage(key) {$('#page-status').textContent=`${key==='history'?'Lịch sử':'Kết quả'} · Trang ${pages[key].page}.`;}
readUrl();
function pagedTable(headers, items, row, key) {
  const pager = pages[key] ||= {page:1,size:10};
  const remote=key==='edits'?state.editsPagination:state.pagination;
  const total=remote?.total??items.length;
  const totalPages = remote?.totalPages??Math.max(1,Math.ceil(items.length/pager.size));
  pager.page = Math.min(Math.max(1,pager.page),totalPages);
  const start = (pager.page-1)*pager.size;
  const name = {results:'kết quả kiểm thử',history:'lịch sử lượt chạy',edits:'lịch sử giá tay'}[key] || 'sản phẩm cập nhật Kiot';
  const hidden=key==='results'?(state.runs.find(r=>r.id===selectedRun)||state.runs[0])?.hiddenBeforeNoMarkdownCount:0;
  const controls = `<div class="pagination" data-pagination="${key}" tabindex="-1" aria-label="Phân trang ${name}">
    <label>${key==='results'?'Sản phẩm mỗi trang':'Dòng mỗi trang'} <select data-page-size="${key}" aria-label="Số dòng mỗi trang — ${name}">${[10,50,100].map(size=>`<option value="${size}" ${size===pager.size?'selected':''}>${size}</option>`).join('')}</select></label>
    <span class="muted">Hiển thị ${total?start+1:0}–${Math.min(start+pager.size,total)} / ${total}${hidden?` · Đã ẩn ${count(hidden)} món tạo trước 01/07/2026 (không giảm)`:''}</span>
    <div class="page-buttons"><button data-page-key="${key}" data-page="1" ${pager.page===1?'disabled':''}>Đầu</button><button data-page-key="${key}" data-page="${pager.page-1}" ${pager.page===1?'disabled':''}>Trước</button>
    <span>Trang ${pager.page} / ${totalPages}</span><button data-page-key="${key}" data-page="${pager.page+1}" ${pager.page===totalPages?'disabled':''}>Sau</button><button data-page-key="${key}" data-page="${totalPages}" ${pager.page===totalPages?'disabled':''}>Cuối</button></div></div>`;
  return table(headers,(remote?items:items.slice(start,start+pager.size)).map(row)) + controls;
}
function bindPagination(container) {
  container.querySelectorAll('[data-page-size]').forEach(select=>select.onchange=()=>{
    const key=select.dataset.pageSize;
    pages[key].size=Number(select.value);pages[key].page=1;
    syncUrl(true);loadView(`[data-page-size="${key}"]`).then(ok=>{if(ok)announcePage(key);});
  });
  container.querySelectorAll('[data-page-key]').forEach(button=>button.onclick=()=>{
    const key=button.dataset.pageKey;pages[key].page=Number(button.dataset.page);
    syncUrl(true);loadView(`[data-pagination="${key}"]`).then(ok=>{if(ok)announcePage(key);});
  });
}
async function api(path, body, options={}) {
  const source=options.dataset||dataset;
  const querySuffix=path.includes('?')?'&':'?';
  // Relative to the page: /api/… standalone, /sale-ai/api/… inside Website_3Q (TASK-035).
  const response = await fetch(path.replace(/^\//,'')+querySuffix+'dataset='+source, {...(body === undefined ? {} : {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,dataset:source})}),signal:options.signal});
  const data = await response.json(); if(!response.ok) throw new Error(data.error); return data;
}
let messageTimer;
function message(text,error=false){
  const box=$('#message');
  clearTimeout(messageTimer);
  box.replaceChildren();
  box.hidden=!text;
  box.className=`message-notice${error?' error':''}`;
  if(!text)return;
  const icon=document.createElement('span');
  icon.className='message-icon';icon.textContent=error?'!':'✓';icon.setAttribute('aria-hidden','true');
  const content=document.createElement('span');content.className='message-text';content.textContent=text;
  const close=document.createElement('button');close.className='message-close';close.type='button';close.textContent='×';close.setAttribute('aria-label','Đóng thông báo');
  const dismiss=()=>{clearTimeout(messageTimer);box.hidden=true;box.replaceChildren();};
  close.onclick=dismiss;
  box.append(icon,content,close);
  messageTimer=setTimeout(dismiss,10000);
}
async function action(fn){if(pending||loadedKey!==requestKey())return;pending=true;try{await fn();await loadView();}catch(e){message(e.message,true);}finally{pending=false;}}
// Khung HTML dùng chung cho các bảng. Nội dung từng dòng do màn hình cung cấp.
const table = (headers, rows) => `
  <div class="table-wrap">
    <table>
      <thead>
        <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
      </thead>
      <tbody>
        ${rows.join('\n')}
      </tbody>
    </table>
  </div>
`;
const count=value=>Number(value||0).toLocaleString('vi-VN');
function metrics(){const m=state.metrics;return `<div class="metrics"><div><b>${count(m.products)}</b><span>${dataset==='real'?'Sản phẩm Kiot':'Sản phẩm mẫu'}</span></div><div><b>${count(m.inStock)}</b><span>Còn tồn</span></div><div><b>${count(m.hottrend)}</b><span>Hot trend</span></div><div><b>${count(m.waiting)}</b><span>Chờ xử lý</span></div></div>`;}
// Bảo 2026-10-21: the data line turns yellow and says so when the Kiot data is over 12 hours old.
function syncLine(){const old=!!state?.loadedAt&&Date.now()-Date.parse(state.loadedAt)>12*3600e3;$('#data-bar').classList.toggle('stale',old);return state?.loadedAt?'Dữ liệu Kiot tải lúc '+dateTime(state.loadedAt)+' · Chi nhánh trung tâm'+(old?' · đã cũ, nên tải lại trước khi cập nhật':''):'Chưa tải sản phẩm thật. Bấm Tải lại từ Kiot.';}
function render(){
  $('#dataset').value=dataset;
  $('#refresh').hidden=dataset!=='real';
  $('#sync-status').textContent=dataset==='real'?syncLine():'Bộ dữ liệu mẫu được giữ riêng.';
  document.querySelectorAll('[data-view]').forEach(b=>{
    b.classList.toggle('active',b.dataset.view===view);
    if(b.dataset.view===view)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
    b.href=viewUrl(b.dataset.view);
  });
  $('#title').textContent={results:'Bảng giá sale',history:'Lịch sử'}[view];
  // Bảo 2026-10-21: the Kiot data line and its reload button only belong to Kết quả, not Lịch sử.
  $('#data-bar').hidden=view==='history';
  $('#header-metrics').hidden=view!=='results';
  $('#header-metrics').innerHTML=view==='results'?metrics():'';
  if(view==='results'){
    const run=state.runs.find(r=>r.id===selectedRun)||state.runs[0];
    if(run?.id!==resultsRunId){resultsRunId=run?.id;}
    if(dataset==='real') {
      if(!$('#results-area'))$('#content').innerHTML='<div id="results-area"></div>';
      const draw=()=>{
        renderLiveResults(state,run,$('#results-area'),context());
        const search=$('#result-search');
        const searchChanged=()=>{query=search.value;pages.results.page=1;syncUrl();lockOldView();clearTimeout(searchTimer);if(!search.composing)searchTimer=setTimeout(()=>loadView(),150);};
        search.oninput=searchChanged;
        const filter=$('#result-m');
        filter.onchange=()=>{
          if(pending||state.busy){filter.value=mFilter;return;}
          mFilter=filter.value;clearLiveSelection();pages.results.page=1;
          syncUrl(true);loadView('#result-m');
        };
        if(!search.compositionBound){
          search.compositionBound=true;
          search.addEventListener('compositionstart',()=>{search.composing=true;clearTimeout(searchTimer);controller?.abort();requestSequence++;});
          search.addEventListener('compositionend',()=>{search.composing=false;search.oninput();});
        }
        bindPagination($('#results-area'));
      };
      draw();
    }
    else {
    $('#content').innerHTML=`<p class="muted result-caption">Kết quả ${run?.customDate?'lịch sử':'hiện hành'} · Chỉ mô phỏng</p>`+(run?`<p class="muted">${esc(run.day)} · ${dateTime(run.at)} · ${run.trigger==='schedule'?'Theo lịch':'Bấm chạy'} · Đã mô phỏng</p>`+pagedTable(['Sản phẩm','Tuổi / M / Ngày tạo Kiot','P0 / Giá mẫu','Giá dự kiến','Quyền sale','Kết quả / Ghi chú dự kiến'],run.rows,r=>`<tr><td><b>${esc(r.code)}</b><span class="small">${esc(r.name)}</span><span class="badge">${r.type == null ? 'Chưa xác định trong lượt này' : typeLabel(r.type)}</span></td><td>${ageCell(r,esc)}</td><td class="money">${money(r.p0)}<span class="small">Giá mẫu: ${money(r.currentPrice)}</span></td><td class="money">${money(r.price)}${r.pricingMode==='manual'?'<span class="small">Giá tay duyệt riêng</span>':''}</td><td class="money">${money(r.allowance)}</td><td><span class="${r.status==='waiting'?'wait':'muted'}">${r.reasons.length?r.reasons.map(esc).join('<br>'):'Đã mô phỏng'}</span>${r.notePreview?`<details><summary>Xem ghi chú</summary><pre>${esc(r.notePreview)}</pre></details>`:''}</td></tr>`, 'results'):`<div class="empty">Bảng sẽ tự chuẩn bị kết quả khi mở trang.</div>`);
    }
  }
  if(view==='history')renderHistory(state,$('#content'),context(),dataset==='real');
  document.querySelectorAll('[data-run]').forEach(b=>b.onclick=()=>{selectedRun=b.dataset.run;navigate('results');});
  if(view==='history' && state.manualEdits?.length) $('#content').insertAdjacentHTML('beforeend', '<h2 class="manual-history-title">Lịch sử nhập giá tay — chỉ mô phỏng</h2>'+pagedTable(['Sản phẩm / Thời điểm','Giá bán trước → sau','Quyền sale trước → sau'],state.manualEdits,e=>`<tr><td>${esc(e.code)} · ${esc(e.name)}<span class="small">${dateTime(e.at)}</span></td><td>${money(e.before?.price)} → ${money(e.after.price)}</td><td>${money(e.before?.allowance)} → ${money(e.after.allowance)}</td></tr>`, 'edits'));
  bindPagination($('#content'));
}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=e=>{if(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;e.preventDefault();navigate(b.dataset.view);});
$('#dataset').onchange=e=>{if(pending||document.querySelector('dialog[open]')){e.target.value=dataset;return;}dataset=e.target.value;query='';mFilter='';clearLiveSelection();selectedRun=null;for(const page of Object.values(pages))page.page=1;syncUrl(true);loadView().then(ok=>{if(ok&&!state.busy)ensureView();});};
window.addEventListener('popstate',()=>{
  if(pending){syncUrl();return;}
  const previousDataset=dataset,before=requestKey();readUrl();
  if(before===requestKey())return;
  loadView().then(ok=>{if(ok){$('#title').focus();if(previousDataset!==dataset&&!state.busy)ensureView();}});
});
$('#refresh').onclick=()=>action(async()=>{await api('/api/kiot/refresh',{});selectedRun=null;message('Đã tải dữ liệu và cập nhật bảng.');});
if(await loadView()){if(!state.busy)await ensureView();}
// TASK-102: progress of a page update written in lots, from /api/status every 3 s.
function renderProgress(op){
  const box=$('#update-progress');if(!box)return;
  if(!op){box.hidden=true;box.innerHTML='';return;}
  const b=op.batch,finished=Math.min(b.total,b.done+b.failed+b.unknown),percent=b.total?Math.floor(finished*100/b.total):0;
  const time=(t,seconds)=>new Date(t).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit',...(seconds?{second:'2-digit'}:{})});
  const eta=b.etaSeconds==null?'Đang ước tính thời gian…':`Còn khoảng ${Math.max(1,Math.ceil(b.etaSeconds/60))} phút · dự kiến xong lúc ${time(Date.now()+b.etaSeconds*1000)}`;
  const bar=(label,p)=>p?`<div class="progress-row"><span>${label}</span><progress max="${p.total||1}" value="${p.processed}"></progress><span>${p.processed}/${p.total}</span></div>`:'';
  box.hidden=false;
  box.innerHTML=`<div class="progress-head"><b>Đang cập nhật ${b.total} sản phẩm · ${percent}%</b><span>${eta}</span></div>
    <progress class="progress-main" max="100" value="${percent}"></progress>
    <ol class="progress-steps"><li class="done">Đọc danh sách Kiot + Sapo</li><li class="current">Ghi và xác minh lô ${b.lot}/${b.lots}</li><li>Lưu lịch sử</li></ol>
    ${b.pause?`<p class="progress-pause">${b.pause.side==='kiot'?'Kiot':'Sapo'} báo quá giới hạn — tạm nghỉ đến ${time(b.pause.until,true)} rồi tự chạy tiếp.</p>`:''}
    ${bar('Kiot',op.platforms?.kiot)}${bar('Sapo',op.platforms?.sapo)}
    <div class="progress-counts"><span>Thành công <b>${b.done}</b></span><span>Lỗi <b>${b.failed}</b></span><span>Chưa xác định <b>${b.unknown}</b></span>${b.unchanged?`<span>Bỏ qua (đã đúng giá) <b>${b.unchanged}</b></span>`:''}</div>
    <p class="muted">Có thể đóng trang, Sale AI vẫn chạy. Không tắt máy và cửa sổ npm run dev.</p>`;
}
setInterval(async()=>{
  try {
    const status=await api('/api/status');
    renderProgress(dataset==='real'&&status.operation?.running&&status.operation.source===dataset&&status.operation.batch?status.operation:null);
    if(dataset==='real') {
      if(status.operation?.running&&status.operation.source===dataset){
        const text=status.operation.platforms?Object.entries(status.operation.platforms).map(([name,p])=>(name==='kiot'?'Kiot':'Sapo')+': '+p.stage+' · '+p.processed+'/'+p.total+' sản phẩm').join(' | '):status.operation.stage+' · '+status.operation.processed+'/'+status.operation.total+' sản phẩm';
        $('#sync-status').textContent=text;
        const box=document.querySelector('dialog .dialog-error');if(box)box.textContent=text;
      }
      else if(status.progress?.running) $('#sync-status').textContent='Đang kiểm tra Kiot: '+status.progress.loaded+'/'+(status.progress.total||'…')+' sản phẩm…';
      else if(status.progress?.error) $('#sync-status').textContent='Chưa đọc được dữ liệu mới: '+status.progress.error+' · Đang giữ dữ liệu lần tải thành công.';
      else $('#sync-status').textContent=syncLine();
    }
    if(pending||status.busy||document.querySelector('dialog[open]')||$('#result-search')?.composing)return;
    if(loadedKey!==requestKey())return;
    if(status.revision===state?.revision)return;
    if(await loadView())message('Bảng đã cập nhật dữ liệu mới.');
  } catch{}
},3000);
