import { updateSummary, reportItems, failureReason, summaryText } from './update-report.js';
import { historyEntries, failedItems } from './history-model.js';
import { ageCell } from './age-cell.js';
const selected = new Set();
const excluded = new Set();
export function clearLiveSelection() { selected.clear();excluded.clear(); }
function notifyUpdate(update,ctx) {
  const summary=update.summary||updateSummary(update.items);
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
const updateStatus = status => ({done:'Đã cập nhật và kiểm chứng',conflict:'Xung đột',journaled:'Lượt cũ chưa hoàn tất',unknown:'Chưa xác minh',price_pending:'Chưa xác minh giá (lượt cũ)',note_pending:'Chưa xác minh ghi chú (lượt cũ)',preflight_failed:'Lỗi kiểm tra — chưa ghi',not_sent:'Không cập nhật — lượt đã dừng',write_failed:'Cập nhật lỗi / chưa đầy đủ',rolled_back:'Đã hoàn tác',rollback_failed:'Hoàn tác không thành công',ready:'Chưa gửi',sending:'Đang gửi',verified:'Đã xác minh — đang xử lý lượt',rolling_back:'Đang hoàn tác'})[status] || status;

export function renderLiveResults(state, run, container, ctx) {
  const {esc,money,pagedTable,api,action,message}=ctx;
  const selectionKey=JSON.stringify([state.dataset,run?.id,state.dataRevision,state.mFilter??null]);
  if(selectionRun!==selectionKey) {selected.clear();excluded.clear();selectionRun=selectionKey;}
  target=state.sapoWrite===false?'Kiot':'Kiot + Sapo';const needSapo=state.sapoWrite!==false;
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
      <td><label><input type="checkbox" data-live-code="${esc(r.code)}" aria-label="Chọn ${esc(r.code)}" ${selected.has(r.code)?'checked':''} ${r.status!=='simulated'||!fresh?'disabled':''}> <b>${esc(r.code)}</b></label><span class="small">${esc(r.name)}</span><span class="badge">${r.type==='hottrend'?'Hottrend':r.type==='normal'?'Hàng thường':'Chờ xử lý: thiếu tên'}</span></td>
      <td>${ageCell(r,esc)}</td><td class="money">${money(r.currentPrice)}<span class="small">P0: ${money(r.p0)}</span></td>
      <td class="money">${money(r.price)}<span class="small">Sale: ${money(r.allowance)}${r.pricingMode==='manual'?' · Giá tay':''}</span></td>
      <td class="money">${money(r.net)}</td>
      <td>${r.writeStatus?`<span class="badge">${r.writeStatus==='restored'?'Kiot: đã khôi phục và kiểm chứng':'Kiot: cập nhật thành công và kiểm chứng'}</span>`:''}<span class="${r.status==='waiting'?'wait':'muted'}">${r.reasons.length?r.reasons.map(esc).join('<br>'):'Đủ điều kiện kiểm thử'}</span>
      <details><summary>Ghi chú trước / dự kiến</summary><p>Trước (nội dung API):</p><pre>${esc(r.notesBefore)}</pre><p>Dự kiến — chưa ghi Kiot:</p><pre>${esc(r.notePreview||'Chưa có đề xuất')}</pre></details></td></tr>`,'results'):'<div class="empty">Tải sản phẩm và chạy kiểm thử để có kết quả.</div>'}`;
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
    try{const params=new URLSearchParams({runId:run.id,q:ctx.query||''});if(ctx.mFilter!=='')params.set('m',ctx.mFilter);
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
      const proposal=await api('/api/kiot/prepare',{runId:run.id,codes:[...selected],excludedCodes:[...excluded],continueOnError:true});
      button.textContent=`Đang cập nhật ${proposal.items.length} sản phẩm…`;
      committing=true;
      const update=await api('/api/kiot/commit',{id:proposal.id,confirmed:true});
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
    if(e.kind==='simulation')return `<tr><td>${esc(e.day)}</td><td>${dateTime(e.at)}</td><td>${e.run.trigger==='schedule'?'Theo lịch':'Mô phỏng'}${e.run.customDate?' · Ngày giả định':''}</td><td><button data-run="${esc(e.id)}">Xem ${e.run.rowCount??e.run.rows.length} sản phẩm</button></td></tr>`;
    const summary=e.update.summary||updateSummary(e.update.items);
    const restore=e.update.mode==='restore-joint-v1',joint=restore||e.update.mode==='joint-v1';const counts=joint?Object.entries(e.update.platformSummary||{}).map(([name,s])=>`${name==='kiot'?'Kiot':'Sapo'}: ${s.succeeded} thành công · ${s.failed} lỗi/chưa hoàn tất`).join('<br>'):`${summary.succeeded} thành công · ${summary.failed} lỗi/chưa hoàn tất`;
    return `<tr><td>${esc(e.day)}</td><td>${dateTime(e.at)}</td><td>${(e.update.trigger==='schedule'?'Tự động cập nhật ':restore?'Khôi phục ':'Cập nhật ')+((joint&&e.update.platformSummary?.sapo||e.update.mode==='schedule-failed')?'Kiot + Sapo':'Kiot')}<span class="small">${e.update.error?'Chưa hoàn tất: '+esc(e.update.error):counts}</span></td><td><div class="history-actions"><button data-update-products="${esc(e.id)}">Xem ${summary.total} sản phẩm</button><button data-update-errors="${esc(e.id)}">Xem danh sách lỗi (${e.update.issueCount??summary.failed})</button>${e.update.canRestore?`<button data-restore="${esc(e.id)}">Khôi phục giá + mô tả (Rollback)</button>`:''}</div></td></tr>`;
  },'history'):'<div class="empty">Chưa có lịch sử.</div>';
  container.querySelectorAll('[data-update-errors]').forEach(b=>b.onclick=()=>showUpdateDetails(state,b.dataset.updateErrors,ctx));
  container.querySelectorAll('[data-update-products]').forEach(b=>b.onclick=()=>showUpdateDetails(state,b.dataset.updateProducts,ctx,false));
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
  if(includeUpdates)container.insertAdjacentHTML('afterbegin','<p class="muted">Các lượt cập nhật mới tự lưu giá và mô tả gốc. Bấm Khôi phục giá + mô tả (Rollback) để trả lại ngay trên từng bên đã cập nhật.</p>');
}


export function showUpdateDetails(state,id,ctx,errorsOnly=true) {
  const {esc,money,dateTime,api,message}=ctx;
  const source=state.dataset;
  const dialog=document.createElement('dialog');dialog.className='confirmation';
  dialog.setAttribute('aria-labelledby','history-dialog-title');
  let page=1,size=10,sequence=0,controller;
  // TASK-102: failed products of this update that can be updated again now (same checks as a new update).
  const retry=errorsOnly&&source==='real'?api('/api/kiot/retry-selection?updateId='+encodeURIComponent(id),undefined,{dataset:source}).catch(e=>({error:e.message})):null;
  let retryData=null;
  const eligible=code=>retryData?.codes?`<span class="small">${retryData.codes.includes(code)?'Đủ điều kiện cập nhật lại':'Không đủ điều kiện'}</span>`:'';
  const retryBar=()=>!retryData?'':retryData.error?`<p class="muted">${esc(retryData.error)}</p>`:retryData.total?`<div class="retry-bar"><span>Cập nhật lại ${retryData.codes.length} / ${retryData.total} món lỗi${retryData.notEligible?` (${retryData.notEligible} món không đủ điều kiện)`:''}</span><button class="primary" data-retry ${retryData.codes.length?'':'disabled'}>Cập nhật lại các món lỗi</button></div>`:'';
  const row=p=>errorsOnly?`<tr><td><b>${esc(p.code)}</b></td><td>${esc(p.name)}</td><td>${esc(failureReason(p))}${eligible(p.code)}</td></tr>`:`<tr><td><b>${esc(p.code)}</b><span class="small">${esc(p.name)}</span></td><td class="money">${money(p.beforePrice)} → ${money(p.price)}</td><td>${esc(updateStatus(p.status))}${p.platforms?Object.entries(p.platforms).map(([name,result])=>`<span class="small">${name==='kiot'?'Kiot':'Sapo'}: ${esc(result.skipped?'Bỏ qua — không cần khôi phục':updateStatus(result.status))} ${esc(result.error||'')}</span>`).join(''):''}</td><td>${esc(failureReason(p))||'Đã kiểm chứng'}${p.stage?`<span class="small">${esc(p.failureStage||p.stage)} · ${esc(p.rollbackResult||'')}</span>`:''}</td></tr>`;
  const close=()=>{controller?.abort();dialog.close();dialog.remove();};
  const controls=p=>`<div class="pagination" tabindex="-1" aria-label="Phân trang lượt cập nhật"><label>Sản phẩm mỗi trang <select aria-label="Số sản phẩm mỗi trang">${[10,50,100].map(n=>`<option ${p.size===n?'selected':''}>${n}</option>`).join('')}</select></label><span>Hiển thị ${p.total?(p.page-1)*p.size+1:0}–${Math.min(p.page*p.size,p.total)} / ${p.total}</span><button data-prev ${p.page===1?'disabled':''}>Trước</button><span role="status" aria-live="polite">Trang ${p.page} / ${p.totalPages}</span><button data-next ${p.page===p.totalPages?'disabled':''}>Sau</button></div>`;
  const table=p=>p.items.length?`<div class="table-wrap"><table><thead><tr>${errorsOnly?'<th>Mã sản phẩm</th><th>Tên sản phẩm</th><th>Lý do</th>':'<th>Sản phẩm</th><th>Giá trước → dự kiến</th><th>Trạng thái</th><th>Nguyên nhân</th>'}</tr></thead><tbody>${p.items.map(row).join('')}</tbody></table></div>`:'<p>Không có sản phẩm trong bộ lọc này.</p>';
  const path=(p,s,attempt)=>`/api/history/updates/${encodeURIComponent(id)}?page=${p}&size=${s}&errorsOnly=${attempt===undefined?errorsOnly:true}${attempt===undefined?'':'&attempt='+attempt}`;
  const draw=async(focusTarget)=>{
    controller?.abort();controller=new AbortController();const current=++sequence;
    dialog.querySelectorAll('button:not([data-close]),select').forEach(e=>e.disabled=true);
    try{
      const data=await api(path(page,size),undefined,{dataset:source,signal:controller.signal});
      if(retry)retryData=await retry;
      if(current!==sequence||!dialog.isConnected)return;
      const p=data.pagination;page=p.page;size=p.size;
      dialog.innerHTML=`<h2 id="history-dialog-title">${errorsOnly?'Sản phẩm cập nhật lỗi':'Sản phẩm trong lượt cập nhật'}</h2><p>${dateTime(data.update.at)} · ${esc(data.update.message)}</p>${retryBar()}${table(p)}${controls(p)}
        ${data.attempts.map(a=>`<details data-attempt="${a.index}"><summary>Lỗi lần thử ${a.index+1} · ${dateTime(a.at)}</summary><div class="attempt-content"></div></details>`).join('')}<div class="dialog-error" role="status"></div><button data-close>Đóng</button>`;
      dialog.querySelector('select').onchange=e=>{size=Number(e.target.value);page=1;draw('select');};
      dialog.querySelector('[data-prev]').onclick=()=>{page--;draw('.pagination');};dialog.querySelector('[data-next]').onclick=()=>{page++;draw('.pagination');};
      dialog.querySelector('[data-close]').onclick=close;
      const retryButton=dialog.querySelector('[data-retry]');
      if(retryButton)retryButton.onclick=async()=>{
        if(!ctx.canWrite())return;ctx.beginOperation();retryButton.disabled=true;
        const box=dialog.querySelector('.dialog-error');let committing=false;
        try{
          retryButton.textContent=`Đang kiểm tra ${retryData.codes.length} sản phẩm…`;
          const proposal=await api('/api/kiot/prepare',{runId:retryData.runId,codes:retryData.codes,continueOnError:true},{dataset:source});
          committing=true;retryButton.textContent=`Đang cập nhật ${proposal.items.length} sản phẩm…`;
          const update=await api('/api/kiot/commit',{id:proposal.id,confirmed:true},{dataset:source});
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



