import { updateReport, reportStatus, failureReason, summaryText } from './update-report.js';
import { historyEntries } from './history-model.js';
import { ageCell } from './age-cell.js';
const selected = new Set();
const excluded = new Set();
let autoEditing=false,autoSaving=false,autoSignature;
export function renderAutoUpdate(settings,container,ctx){
  if(!container||!settings)return;
  const {esc,api,message}=ctx,s=settings;
  const busy=ctx.canWrite?!ctx.canWrite():false;
  const signature=JSON.stringify([s,autoEditing,autoSaving,busy]);
  if(container.dataset.autoReady&&autoSignature===signature)return;
  autoSignature=signature;container.dataset.autoReady='true';
  const locked=s.running||autoSaving||busy;
  const next=s.nextAt?new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',minute:'2-digit',weekday:'long',day:'2-digit',month:'2-digit',hourCycle:'h23'}).format(new Date(s.nextAt)):'';
  container.innerHTML=`<div class="auto-row"><button class="auto-switch" role="switch" aria-checked="${s.enabled}" aria-label="Tự động cập nhật" aria-describedby="auto-note" ${locked?'disabled':''}></button>
    <span class="auto-dot ${s.running?'running':s.enabled?'':'off'}" aria-hidden="true"></span><b>Tự động cập nhật: ${s.running?'Đang chạy':s.enabled?'Bật':'Tắt'}</b>
    ${autoEditing?`<label>Giờ chạy <input type="time" value="${esc(s.time)}" required ${locked?'disabled':''}></label><button data-auto-save ${locked?'disabled':''}>Lưu</button><button data-auto-cancel ${autoSaving?'disabled':''}>Huỷ</button>`:`<span class="auto-tag">${esc(s.time)} · Thứ 2–Thứ 7</span><button data-auto-edit ${locked?'disabled':''}>Đổi giờ</button>`}
    <span class="muted" id="auto-note">${s.running?'Lượt tự động đang chạy':s.enabled?`Lần tới: ${esc(next)}`:'Chỉ cập nhật khi bấm tay'}</span></div><div class="auto-confirm" aria-live="polite"></div>`;
  const save=async body=>{
    if(autoSaving||(ctx.canWrite&&!ctx.canWrite()))return;autoSaving=true;ctx.beginOperation();renderAutoUpdate(s,container,ctx);
    try{Object.assign(s,await api('/api/auto-update/settings',body));autoEditing=false;message('Đã lưu lịch tự động cập nhật.');}
    catch(error){message(error.message,true);}
    finally{autoSaving=false;ctx.endOperation();autoSignature=undefined;renderAutoUpdate(s,container,ctx);await ctx.acceptUpdate();}
  };
  const ask=(text,body)=>{
    const box=container.querySelector('.auto-confirm');
    box.innerHTML=`<div class="auto-confirm-row"><span>${esc(text)}</span><button class="primary" data-auto-yes>Đồng ý</button><button data-auto-no>Huỷ</button></div>`;
    box.querySelector('[data-auto-yes]').onclick=()=>save(body);
    box.querySelector('[data-auto-no]').onclick=()=>{box.innerHTML='';container.querySelector('.auto-switch').focus();};
    box.querySelector('[data-auto-yes]').focus();
  };
  container.querySelector('.auto-switch').onclick=()=>s.enabled?save({enabled:false,time:s.time}):ask(`Từ lần tới, ${s.time} Thứ 2–Thứ 7 máy sẽ tự ghi giá Kiot cho món M1–M6 (giữ giá sửa tay). Chỉ bật trên một máy để tránh ghi Kiot hai lần. Bật?`,{enabled:true,time:s.time});
  const edit=container.querySelector('[data-auto-edit]');if(edit)edit.onclick=()=>{autoEditing=true;renderAutoUpdate(s,container,ctx);container.querySelector('input').focus();};
  const cancel=container.querySelector('[data-auto-cancel]');if(cancel)cancel.onclick=()=>{autoEditing=false;renderAutoUpdate(s,container,ctx);container.querySelector('[data-auto-edit]').focus();};
  const submit=container.querySelector('[data-auto-save]');if(submit)submit.onclick=()=>{
    const input=container.querySelector('input');if(!input.reportValidity())return;
    ask(`Đổi giờ tự động cập nhật thành ${input.value}, Thứ 2–Thứ 7?`,{enabled:s.enabled,time:input.value});
  };
}
export function clearLiveSelection() { selected.clear();excluded.clear(); }
export function renderApproval(state,container,ctx){
  const {esc,money,pagedTable,api,message}=ctx;
  const locked=!ctx.canWrite()||state.dataset!=='real';
  const buttons=(r,group)=>group==='pending'?`<button data-approval="approve" data-code="${esc(r.code)}" class="primary" ${locked?'disabled':''}>Duyệt</button>`:
    `<button data-approval="restore" data-code="${esc(r.code)}" class="primary" ${locked?'disabled':''}>Trả về giá vốn</button> <button data-approval="keep" data-code="${esc(r.code)}" ${locked?'disabled':''}>Giữ giá</button>`;
  container.innerHTML=`<div class="toolbar"><input id="approval-search" class="search" aria-label="Tìm sản phẩm cần duyệt" placeholder="Tìm mã hoặc tên…" value="${esc(ctx.query||'')}"></div>`+
    ['pending','legacy'].map(group=>{
      const data=state[group]||{items:[],total:0},pending=group==='pending';
      return `<section class="approval-group"><h2>${pending?'Chờ duyệt':'Đã lỡ giảm dưới vốn'} (${data.total})</h2><div class="selection-bar">${pending?`<button data-approval="approve" data-all class="primary" ${locked||!data.total?'disabled':''}>Duyệt tất cả (${data.total} món)</button>`:`<button data-approval="restore" data-all class="primary" ${locked||!data.total?'disabled':''}>Trả về giá vốn tất cả</button><button data-approval="keep" data-all ${locked||!data.total?'disabled':''}>Giữ giá tất cả</button>`}</div>`+
        (data.items.length?pagedTable(pending?['Sản phẩm','M hiện tại → M mới','Giá Kiot / P0','Giá sale mới','Giá vốn','Thấp hơn vốn','Duyệt']:['Sản phẩm','M','Đang bán trên Kiot','Giá vốn','Thấp hơn vốn','Quyết định'],data.items,r=>`<tr><td><b>${esc(r.code)}</b><span class="small">${esc(r.name)}</span></td><td>${pending?`M${r.currentM??'—'} → M${r.m}`:`M${r.m??'—'}`}</td><td class="money">${money(r.currentPrice)}${pending?`<span class="small">P0: ${money(r.p0)}</span>`:''}</td>${pending?`<td class="money">${money(r.price)}</td>`:''}<td class="money">${money(r.cost)}</td><td class="money approval-loss">-${money(r.belowCost)}</td><td>${buttons(r,group)}</td></tr>`,group):`<p class="empty">${pending?'Không có món nào giảm dưới giá vốn hôm nay.':'Không có món nào đang bán dưới giá vốn.'}</p>`)+`</section>`;
    }).join('');
  container.querySelectorAll('[data-approval]').forEach(button=>button.onclick=async()=>{
    if(!ctx.canWrite())return;ctx.beginOperation();container.querySelectorAll('[data-approval]').forEach(b=>b.disabled=true);
    const kind=button.dataset.approval,group=kind==='approve'?'pending':'legacy';let proposal;
    try{
      const selection=button.hasAttribute('data-all')?await api(`/api/kiot/approval-selection?group=${group}&q=${encodeURIComponent(ctx.query||'')}`):{runId:state.runId,items:state[group].items.filter(r=>r.code===button.dataset.code)};
      const codes=selection.items.map(r=>r.code);if(!codes.length)throw Error('Không còn món để duyệt; tải lại danh sách.');
      if(kind!=='keep')proposal=await api('/api/kiot/prepare',{runId:selection.runId,codes,...(kind==='approve'?{approveBelowCost:true}:{restoreCost:true})});
      const items=proposal?proposal.items.map(i=>({code:i.code,currentPrice:i.before.currentPrice,cost:i.row.cost,price:i.row.price})):selection.items.map(r=>({...r,price:r.currentPrice}));
      const total=items.reduce((sum,r)=>sum+(kind==='restore'?r.cost-r.currentPrice:r.cost-(kind==='keep'?r.currentPrice:r.price)),0);
      const text=kind==='restore'?`${items.length} món sẽ được ghi lại giá Kiot bằng giá vốn (tổng tăng ${money(total)})`:kind==='keep'?`${items.length} món giữ nguyên giá, chấp nhận thấp hơn giá vốn tổng ${money(total)}`:`Duyệt ${items.length} món thấp hơn giá vốn tổng ${money(total)}. Giá sẽ được ghi lên ${state.sapoWrite===false?'Kiot':'Kiot + Sapo'}.`;
      if(!await confirmApproval(text,items,ctx)){if(proposal)await api('/api/kiot/cancel',{id:proposal.id});return;}
      if(kind==='keep'){await api('/api/kiot/keep-below-cost',{codes,items:items.map(r=>({code:r.code,price:r.currentPrice,cost:r.cost})),confirmed:true});message(`Đã xác nhận giữ giá ${codes.length} món.`);}
      else{const update=await api('/api/kiot/commit',{id:proposal.id,confirmed:true});notifyUpdate(update,ctx);}
    }catch(error){message(error.message,true);}
    finally{ctx.endOperation();await ctx.acceptUpdate();}
  });
}
function confirmApproval(text,items,{esc,money}){
  return new Promise(resolve=>{
    const dialog=document.createElement('dialog');dialog.className='confirmation';dialog.setAttribute('aria-labelledby','approval-dialog-title');
    dialog.innerHTML=`<h2 id="approval-dialog-title">Xác nhận duyệt</h2><p>${esc(text)}</p><div class="table-wrap"><table><thead><tr><th>Sản phẩm</th><th>Giá Kiot</th><th>Giá mới</th><th>Giá vốn</th></tr></thead><tbody>${items.map(r=>`<tr><td>${esc(r.code)}</td><td class="money">${money(r.currentPrice)}</td><td class="money">${money(r.price??r.currentPrice)}</td><td class="money">${money(r.cost)}</td></tr>`).join('')}</tbody></table></div><div class="toolbar"><button data-yes class="primary">Xác nhận</button><button data-no autofocus>Huỷ</button></div>`;
    const close=value=>{dialog.close();dialog.remove();resolve(value);};
    dialog.querySelector('[data-yes]').onclick=()=>close(true);dialog.querySelector('[data-no]').onclick=()=>close(false);dialog.oncancel=e=>{e.preventDefault();close(false);};document.body.append(dialog);dialog.showModal();
  });
}
export function notifyUpdate(update,ctx) {
  const summary=updateReport(update);
  ctx.message(summaryText(summary,update)+(update.refreshError?' Tải lại dữ liệu chưa thành công: '+update.refreshError:''),summary.failed>0||!!update.skipped?.length||!!update.refreshError);
  if(summary.failed||update.skipped?.length) {
    const button=document.createElement('button');button.textContent='Xem sản phẩm lỗi';
    button.onclick=()=>ctx.openUpdateHistory(update.id);
    document.querySelector('#message').append(' ',button);
  }
}
let selectionRun;
// Target systems for writes; Sapo is shown only when the server enables Sapo writes.
let target='Kiot + Sapo';
const updateStatus = status => ({unchanged:'Bỏ qua (đã đúng giá)',skipped_sapo_zero_price:'Bỏ qua (Sapo giá 0)',done:'Đã cập nhật và kiểm chứng',conflict:'Xung đột',journaled:'Lượt cũ chưa hoàn tất',unknown:'Chưa xác minh',price_pending:'Chưa xác minh giá (lượt cũ)',note_pending:'Chưa xác minh ghi chú (lượt cũ)',preflight_failed:'Lỗi kiểm tra — chưa ghi',not_sent:'Không cập nhật — lượt đã dừng',write_failed:'Cập nhật lỗi / chưa đầy đủ',rolled_back:'Đã hoàn tác',rollback_failed:'Hoàn tác không thành công',ready:'Chưa gửi',sending:'Đang gửi',verified:'Đã xác minh — đang xử lý lượt',rolling_back:'Đang hoàn tác'})[status] || status;

export function renderLiveResults(state, run, container, ctx) {
  const {esc,money,pagedTable,api,action,message}=ctx;
  const selectionKey=JSON.stringify([state.dataset,run?.id,state.dataRevision,state.mFilter??null]);
  if(selectionRun!==selectionKey) {selected.clear();excluded.clear();selectionRun=selectionKey;}
  target=state.sapoWrite===false?'giá Kiot':'Kiot + Sapo';const needSapo=state.sapoWrite!==false;
  const alreadyCorrect=r=>state.kiotDescription===false&&r.status==='simulated'&&r.currentPrice===r.price;
  const fresh=run?.policy===state.policy&&run?.day===state.today&&!run?.customDate&&run?.dataRevision===state.dataRevision;
  const previousToolbar=container.dataset.source===state.dataset?container.querySelector('.result-actions'):null;
  container.dataset.source=state.dataset;
  const html=`<div class="toolbar result-actions">
    <input id="result-search" name="q" autocomplete="off" spellcheck="false" class="search" aria-label="Tìm sản phẩm trong kết quả" placeholder="Tìm mã hoặc tên, ví dụ SP000009…" value="${esc(ctx.query||'')}">
    <label class="m-filter" for="result-m">Theo M <select id="result-m" name="m" aria-label="Theo M"><option value="">Tất cả</option>${Array.from({length:7},(_,m)=>`<option value="${m}" ${String(m)===ctx.mFilter?'selected':''}>M${m}</option>`).join('')}</select></label></div>
    <div class="selection-bar"><button id="select-all" ${!run||!run.rows.length||!fresh||ctx.loading?'disabled':''}>Chọn tất cả (mọi trang)</button><button id="clear-selection">Bỏ chọn</button>
    <button id="prepare-update" class="primary" ${!run||(needSapo&&!state.sapo?.ready)||!fresh||ctx.loading?'disabled':''}>Cập nhật ${target} (${selected.size} món)</button></div>
    ${run&&!fresh?'<p class="wait">Kết quả cũ hoặc ngày giả định: tải/kiểm thử lại cho hôm nay trước khi cập nhật.</p>':''}
    ${needSapo&&(!state.sapo?.connected||state.sapo?.refreshError)?`<p class="wait">${esc(!state.sapo?.connected?'Sapo chưa kết nối — chưa thể cập nhật chung':state.sapo.refreshError)}</p>`:''}
    ${run?`<p class="muted result-note"><b>${run.customDate?'Kết quả lịch sử':'Kết quả'} ${esc(run.day)}</b> · chưa ghi Kiot · Chọn tất cả lấy mọi món đủ điều kiện theo bộ lọc; giá và mô tả gốc được lưu để khôi phục trong Lịch sử.</p>`:''}
    ${run&&!run.rows.length?'<p class="empty" role="status">Không có sản phẩm khớp từ khóa và bộ lọc M.</p>':''}
    ${run?pagedTable(
      ['Chọn / Sản phẩm','Tuổi / M / Ngày tạo Kiot','Giá Kiot / P0','Giá dự kiến / Quyền sale','Giá chốt thấp nhất','Kết quả / Ghi chú'],ctx.filterRows?ctx.filterRows(run.rows):run.rows,r=>`<tr>
      <td><label><input type="checkbox" data-live-code="${esc(r.code)}" aria-label="Chọn ${esc(r.code)}" ${selected.has(r.code)?'checked':''} ${r.status!=='simulated'||!fresh||(!needSapo&&alreadyCorrect(r))?'disabled':''}> <b>${esc(r.code)}</b></label><span class="small">${esc(r.name)}</span><span class="badge">${r.type==='hottrend'?'Hottrend':r.type==='normal'?'Hàng thường':'Chờ xử lý: thiếu tên'}</span></td>
      <td>${ageCell(r,esc)}</td><td class="money">${money(r.currentPrice)}<span class="small">P0: ${money(r.p0)}</span></td>
      <td class="money">${money(r.price)}<span class="small">Sale: ${money(r.allowance)}${r.pricingMode==='manual'?' · Giá tay':''}</span></td>
      <td class="money">${money(r.net)}</td>
      <td>${r.writeStatus&&r.writeStatus!=='unchanged'?`<span class="badge">${r.writeStatus==='restored'?'Kiot: đã khôi phục và kiểm chứng':'Kiot: cập nhật thành công và kiểm chứng'}</span>`:''}<span class="${r.status==='waiting'?'wait':'muted'}">${alreadyCorrect(r)?'Đã đúng giá trên Kiot':r.reasons.length?r.reasons.map(esc).join('<br>'):'Đủ điều kiện kiểm thử'}</span>
      <details><summary>Ghi chú trước / dự kiến</summary><p>Trước (nội dung API):</p><pre>${esc(r.notesBefore)}</pre><p>${state.kiotDescription===false?'Ghi chú tham khảo (không ghi lên Kiot):':'Dự kiến — chưa ghi Kiot:'}</p><pre>${esc(r.notePreview||'Chưa có đề xuất')}</pre></details></td></tr>`,'results'):'<div class="empty">Tải sản phẩm và chạy kiểm thử để có kết quả.</div>'}`;
  if(previousToolbar){
    const template=document.createElement('template');template.innerHTML=html;
    const input=previousToolbar.querySelector('#result-search');if(input.value!==(ctx.query||''))input.value=ctx.query||'';
    template.content.querySelector('.result-actions').remove();
    for(const node of [...container.childNodes])if(node!==previousToolbar)node.remove();
    container.append(template.content);
  }else container.innerHTML=html;
  const mSelect=container.querySelector('#result-m');mSelect.value=ctx.mFilter||'';mSelect.disabled=ctx.loading;
  container.querySelectorAll('[data-live-code]').forEach(input=>input.onchange=()=>{
    input.checked?selected.add(input.dataset.liveCode):selected.delete(input.dataset.liveCode);
    container.querySelector('#prepare-update').textContent=`Cập nhật ${target} (${selected.size} món)`;
  });
  const syncSelection=()=>{
    container.querySelectorAll('[data-live-code]').forEach(e=>e.checked=selected.has(e.dataset.liveCode));
    container.querySelector('#prepare-update').textContent=`Cập nhật ${target} (${selected.size} món)`;
  };
  // TASK-037 hid Thiết lập; TASK-108 now reads the Sapo index automatically in the core.
  container.querySelector('#clear-selection').onclick=()=>{if(!ctx.canWrite())return;selected.clear();excluded.clear();syncSelection();};
  container.querySelector('#select-all').onclick=async()=>{
    if(!ctx.canWrite())return;ctx.beginOperation();const button=container.querySelector('#select-all');button.disabled=true;
    try{const params=`runId=${encodeURIComponent(run.id)}&q=${encodeURIComponent(ctx.query||'')}${ctx.mFilter!==''?'&m='+encodeURIComponent(ctx.mFilter):''}`;
      const result=await api('/api/kiot/selection?'+params);
      if(result.runId!==run.id||result.dataRevision!==state.dataRevision)throw Error('Bảng thay đổi; tải lại để chọn.');
      for(const code of result.codes)selected.add(code);for(const code of result.excludedCodes||[])excluded.add(code);syncSelection();message(`Đã chọn ${result.codes.length} món đủ điều kiện qua mọi trang. Tổng đang chọn: ${selected.size}.`);
    }catch(e){message(e.message,true);}finally{ctx.endOperation();button.disabled=!fresh||ctx.loading||!run.rows.length;}
  };
  container.querySelector('#prepare-update').onclick=async()=>{
    if(!ctx.canWrite())return;
    if(!selected.size&&!excluded.size){message('Chọn sản phẩm trước khi cập nhật.',true);return;}
    ctx.beginOperation();
    const button=container.querySelector('#prepare-update');button.disabled=true;
    button.textContent=`Đang kiểm tra ${selected.size} sản phẩm…`;
    let committing=false;
    try {
      committing=true;
      const update=await api('/api/kiot/update',{runId:run.id,codes:[...selected],excludedCodes:[...excluded],confirmed:true});
      selected.clear();excluded.clear();
      syncSelection();await ctx.acceptUpdate(update);notifyUpdate(update,ctx);
    }
    catch(error) {message(error.message+(committing?' — Xem Lịch sử để kiểm tra kết quả trước khi cập nhật tiếp.':''),true);}
    finally {ctx.endOperation();button.disabled=(needSapo&&!state.sapo?.ready)||!fresh||ctx.loading;button.textContent=`Cập nhật ${target} (${selected.size} món)`;}
  };
}


// Keep the shared settings hook; automatic indexing needs no Sapo connection panel.
export function appendLiveSettings() {}

export function renderHistory(state,container,ctx,includeUpdates=true) {
  const {esc,dateTime,pagedTable}=ctx;
  const entries=(state.history||historyEntries(state,includeUpdates)).filter(e=>state.dataset!=='real'||e.kind==='update');
  container.innerHTML=entries.length?pagedTable(['Ngày xét','Thời điểm chạy','Cách chạy','Kết quả'],entries,e=>{
    // "Theo lịch" / "Tự động cập nhật": entries made before the schedule was removed (21/10/2026).
    // TASK-137 reuses the same label for the newly authorized schedule.
    if(e.kind==='simulation')return `<tr><td>${esc(e.day)}</td><td>${dateTime(e.at)}</td><td>${e.run.trigger==='schedule'?'Theo lịch':'Mô phỏng'}${e.run.customDate?' · Ngày giả định':''}</td><td><button data-run="${esc(e.id)}">Xem ${e.run.rowCount??e.run.rows.length} sản phẩm</button></td></tr>`;
    const summary=e.update.summary?.preflightFailed!==undefined?e.update.summary:updateReport(e.update);
    if(e.update.mode==='auto-settings')return `<tr><td>${esc(e.day)}</td><td>${dateTime(e.at)}</td><td>Đổi lịch tự động</td><td>${esc(e.update.message)}</td></tr>`;
    const restore=e.update.mode==='restore-joint-v1',joint=restore||e.update.mode==='joint-v1';
    const manualSapo=state.sapoWrite===false&&!!(e.update.hasSapo||e.update.platformSummary?.sapo);
    return `<tr><td>${esc(e.day)}</td><td>${dateTime(e.at)}</td><td>${e.update.trigger==='schedule'?'<span class="auto-badge">AUTO</span> ':''}${(e.update.trigger==='schedule'?'Tự động cập nhật':restore?'Khôi phục ':'Cập nhật ')+(e.update.trigger==='schedule'?'':(joint&&e.update.platformSummary?.sapo||e.update.mode==='schedule-failed')?'Kiot + Sapo':'Kiot')}<span class="small">${esc(summaryText(summary,e.update))}</span>${e.update.error?`<span class="small">Chưa hoàn tất: ${esc(e.update.error)}</span>`:''}</td><td><div class="history-actions">${summary.total?`<button data-update-details="${esc(e.id)}">Xem chi tiết (${Number(summary.total).toLocaleString('vi-VN')} món)</button>`:''}${manualSapo?'<span class="wait">Lượt cũ có Sapo — cần hoàn tác tay</span>':e.update.canRestore?`<button data-restore="${esc(e.id)}">${e.update.kiotDescription===false?'Khôi phục giá Kiot (Rollback)':'Khôi phục giá + mô tả (Rollback)'}</button>`:''}</div></td></tr>`;
  },'history'):'<div class="empty">Chưa có lịch sử.</div>';
  container.querySelectorAll('[data-update-details]').forEach(b=>b.onclick=()=>showUpdateDetails(state,b.dataset.updateDetails,ctx));
  container.querySelectorAll('[data-restore]').forEach(b=>b.onclick=async()=>{
    if(!ctx.canWrite())return;ctx.beginOperation();b.disabled=true;
    let committing=false;const label=b.textContent;b.textContent='Đang kiểm tra bản khôi phục…';
    try{
      const proposal=await ctx.api('/api/kiot/restore/prepare',{sourceId:b.dataset.restore});
      committing=true;b.textContent=`Đang khôi phục ${proposal.items.length} sản phẩm…`;
      const update=await ctx.api('/api/kiot/restore/commit',{id:proposal.id,confirmed:true});
      await ctx.acceptUpdate(update);
      notifyUpdate(update,ctx);
    }catch(e){ctx.message(e.message+(committing?' — Xem Lịch sử để kiểm tra kết quả khôi phục.':''),true);}
    finally{ctx.endOperation();b.disabled=committing;b.textContent=label;}
  });
  if(includeUpdates)container.insertAdjacentHTML('afterbegin','<p class="muted">Lịch sử lưu giá và mô tả gốc. Lượt chỉ cập nhật giá Kiot sẽ chỉ khôi phục giá Kiot, giữ nguyên mô tả.</p>');
}


export function showUpdateDetails(state,id,ctx) {
  const {esc,money,dateTime,api,message}=ctx;
  const source=state.dataset;
  const dialog=document.createElement('dialog');dialog.className='confirmation';
  dialog.setAttribute('aria-labelledby','history-dialog-title');
  let page=1,size=10,sequence=0,controller;
  const entry=state.history?.find(e=>e.id===id)?.update;
  let filter=entry?.summary?.issues!==undefined?(entry.summary.issues?'issues':'all'):null;
  // TASK-102: failed products of this update that can be updated again now (same checks as a new update).
  let retry;
  let retryData=null;
  const eligible=code=>retryData?.codes?`<span class="small">${retryData.codes.includes(code)?'Đủ điều kiện cập nhật lại':'Không đủ điều kiện'}</span>`:'';
  const retryBar=()=>!retryData?'':retryData.error?`<p class="muted">${esc(retryData.error)}</p>`:retryData.total?`<div class="retry-bar"><span>Cập nhật lại ${retryData.codes.length} / ${retryData.total} món lỗi${retryData.notEligible?` (${retryData.notEligible} món không đủ điều kiện)`:''}</span><button class="primary" data-retry ${retryData.codes.length?'':'disabled'}>Cập nhật lại các món lỗi</button></div>`:'';
  const statusLabel=p=>({skipped_manual_price:'Giữ giá sửa tay',skipped_sapo_zero_price:'Bỏ qua (Sapo giá 0)',done:'Thành công',preflight_failed:'Lỗi kiểm tra — chưa ghi',write_failed:'Lỗi khi ghi',unknown:'Chưa xác minh',not_sent:'Chưa gửi',unchanged:'Bỏ qua (đã đúng giá)'})[p.reportStatus||reportStatus(p)];
  const row=p=>`<tr><td><b>${esc(p.code)}</b><span class="small">${esc(p.name)}</span></td><td class="money">${money(p.beforePrice)} → ${money(p.price)}${p.status==='skipped_manual_price'?`<span class="small">Sale AI ghi trước: ${money(p.expectedPrice)}</span>`:''}</td><td>${esc(statusLabel(p))}${p.platforms?Object.entries(p.platforms).map(([name,result])=>`<span class="small">${name==='kiot'?'Kiot':'Sapo'}: ${esc(result.skipped?'Bỏ qua — không cần khôi phục':updateStatus(result.status))} ${esc(result.error||'')}</span>`).join(''):''}</td><td>${esc(failureReason(p))||'—'}${filter==='issues'?eligible(p.code):''}${p.stage?`<span class="small">${esc(p.failureStage||p.stage)} · ${esc(p.rollbackResult||'')}</span>`:''}</td></tr>`;
  const close=()=>{controller?.abort();dialog.close();dialog.remove();};
  const controls=p=>`<div class="pagination" tabindex="-1" aria-label="Phân trang lượt cập nhật"><label>Sản phẩm mỗi trang <select aria-label="Số sản phẩm mỗi trang">${[10,50,100].map(n=>`<option ${p.size===n?'selected':''}>${n}</option>`).join('')}</select></label><span>Hiển thị ${p.total?(p.page-1)*p.size+1:0}–${Math.min(p.page*p.size,p.total)} / ${p.total}</span><button data-prev ${p.page===1?'disabled':''}>Trước</button><span role="status" aria-live="polite">Trang ${p.page} / ${p.totalPages}</span><button data-next ${p.page===p.totalPages?'disabled':''}>Sau</button></div>`;
  const table=p=>p.items.length?`<div class="table-wrap"><table><thead><tr><th>Sản phẩm</th><th>Giá trước → dự kiến</th><th>Trạng thái</th><th>Nguyên nhân</th></tr></thead><tbody>${p.items.map(row).join('')}</tbody></table></div>`:'<p>Không có sản phẩm trong bộ lọc này.</p>';
  const path=(p,s,attempt)=>`/api/history/updates/${encodeURIComponent(id)}?page=${p}&size=${s}&filter=${attempt===undefined?filter||'all':'issues'}${attempt===undefined?'':'&attempt='+attempt}`;
  const draw=async(focusTarget)=>{
    controller?.abort();controller=new AbortController();const current=++sequence;
    dialog.querySelectorAll('button:not([data-close]),select').forEach(e=>e.disabled=true);
    try{
      const data=await api(path(page,size),undefined,{dataset:source,signal:controller.signal});
      if(current!==sequence||!dialog.isConnected)return;
      if(filter===null){filter=data.update.summary.issues?'issues':'all';if(filter==='issues')return draw();}
      if(filter==='issues'&&source==='real'){
        retry||=api('/api/kiot/retry-selection?updateId='+encodeURIComponent(id),undefined,{dataset:source}).catch(e=>({error:e.message}));
        retryData=await retry;
      }
      if(current!==sequence||!dialog.isConnected)return;
      const p=data.pagination;page=p.page;size=p.size;
      const s=data.update.summary,n=value=>Number(value||0).toLocaleString('vi-VN');
      const filters=`<div class="history-filters" role="group" aria-label="Lọc sản phẩm trong lượt">${[['all','Tất cả',s.total],['success','Thành công',s.succeeded],['issues','Lỗi + chưa gửi',s.issues],['unchanged','Đã đúng giá',s.unchanged],...(s.manualPriceSkipped?[['skipped_manual_price','Giữ giá sửa tay',s.manualPriceSkipped]]:[]),...(s.skippedSapoZeroPrice?[['skipped_sapo_zero_price','Bỏ qua (Sapo giá 0)',s.skippedSapoZeroPrice]]:[])].map(([value,label,total])=>`<button data-history-filter="${value}" aria-pressed="${filter===value}">${label} (${n(total)})</button>`).join('')}</div>`;
      dialog.innerHTML=`<h2 id="history-dialog-title">Chi tiết lượt ${data.update.mode==='restore-joint-v1'?'khôi phục':'cập nhật'}</h2><p>${dateTime(data.update.at)} · ${esc(data.update.message)}</p>${filters}${s.unnamedUnchanged&&filter==='all'?`<p class="muted">Lượt cũ có ${n(s.unnamedUnchanged)} món đã đúng giá nhưng không lưu danh sách mã.</p>`:''}${filter==='issues'?retryBar():''}${table(p)}${controls(p)}
        ${data.attempts.map(a=>`<details data-attempt="${a.index}"><summary>Lỗi lần thử ${a.index+1} · ${dateTime(a.at)}</summary><div class="attempt-content"></div></details>`).join('')}<div class="dialog-error" role="status"></div><button data-close>Đóng</button>`;
      dialog.querySelector('select').onchange=e=>{size=Number(e.target.value);page=1;draw('select');};
      dialog.querySelector('[data-prev]').onclick=()=>{page--;draw('.pagination');};dialog.querySelector('[data-next]').onclick=()=>{page++;draw('.pagination');};
      dialog.querySelector('[data-close]').onclick=close;
      dialog.querySelectorAll('[data-history-filter]').forEach(button=>button.onclick=()=>{filter=button.dataset.historyFilter;page=1;draw(`[data-history-filter="${filter}"]`);});
      const retryButton=dialog.querySelector('[data-retry]');
      if(retryButton)retryButton.onclick=async()=>{
        if(!ctx.canWrite())return;ctx.beginOperation();retryButton.disabled=true;
        const box=dialog.querySelector('.dialog-error');let committing=false;
        try{
          retryButton.textContent=`Đang kiểm tra ${retryData.codes.length} sản phẩm…`;
          committing=true;
          const update=await api('/api/kiot/update',{runId:retryData.runId,codes:retryData.codes,confirmed:true},{dataset:source});
          close();await ctx.acceptUpdate(update);notifyUpdate(update,ctx);
        }catch(e){box.textContent=e.message+(committing?' — Xem Lịch sử để kiểm tra kết quả trước khi cập nhật tiếp.':'');retryButton.textContent='Cập nhật lại các món lỗi';retryButton.disabled=committing;}
        finally{ctx.endOperation();}
      };
      dialog.querySelectorAll('[data-attempt]').forEach(details=>{
        let loaded=false,attemptPage=1,attemptSize=10,attemptSequence=0;
        const load=async(focus)=>{
          const slot=details.querySelector('.attempt-content'),request=++attemptSequence;
          try{const d=await api(path(attemptPage,attemptSize,details.dataset.attempt),undefined,{dataset:source,signal:controller.signal});
            if(!details.isConnected||request!==attemptSequence)return;const p=d.pagination;attemptPage=p.page;attemptSize=p.size;slot.innerHTML=table(p)+controls(p);
            slot.querySelector('select').onchange=e=>{attemptSize=Number(e.target.value);attemptPage=1;load('select');};
            slot.querySelector('[data-prev]').onclick=()=>{attemptPage--;load('.pagination');};slot.querySelector('[data-next]').onclick=()=>{attemptPage++;load('.pagination');};
            if(focus)slot.querySelector(focus)?.focus();loaded=true;
          }catch(e){if(e.name!=='AbortError'&&details.isConnected){slot.textContent=e.message;loaded=false;}}
        };
        details.ontoggle=()=>{if(details.open&&!loaded)load();};
      });
      if(focusTarget)dialog.querySelector(focusTarget)?.focus();
    }catch(e){if(e.name!=='AbortError'&&dialog.isConnected){const box=dialog.querySelector('.dialog-error');box.textContent=e.message;const retry=document.createElement('button');retry.textContent='Tải lại chi tiết';retry.onclick=()=>draw();box.append(retry);message(e.message,true);}}
  };
  dialog.innerHTML='<h2 id="history-dialog-title">Đang tải lượt cập nhật…</h2><div class="dialog-error" role="status"></div><button data-close>Đóng</button>';
  dialog.querySelector('[data-close]').onclick=close;dialog.oncancel=e=>{e.preventDefault();close();};document.body.append(dialog);dialog.showModal();draw();
}



