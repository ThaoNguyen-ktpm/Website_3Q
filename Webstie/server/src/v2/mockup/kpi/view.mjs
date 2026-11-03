import {tiers} from './model.mjs?v=beb9a611';

export const esc=x=>String(x??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const money=x=>Number(x).toLocaleString('vi-VN')+' ₫';
export const short=x=>x>=1e9?(x/1e9).toLocaleString('vi-VN',{maximumFractionDigits:2})+' tỷ':x>=1e6?(x/1e6).toLocaleString('vi-VN',{maximumFractionDigits:2})+' tr':money(x);
export const day=iso=>iso?iso.slice(8,10)+'/'+iso.slice(5,7):'—';
export const dmy=iso=>iso?iso.slice(8,10)+'/'+iso.slice(5,7)+'/'+iso.slice(0,4):'—';
export const pct=(a,b)=>b?Math.round(a/b*1000)/10:0;
export const pctText=n=>n.toLocaleString('vi-VN',{maximumFractionDigits:1})+'%';
export const stampText=iso=>{const m=/^(\d{4})-(\d\d)-(\d\d)T(\d\d:\d\d).*?([+-]\d\d):?(\d\d)?$/.exec(iso||'');return m?`${m[3]}/${m[2]}/${m[1]} ${m[4]} (UTC${m[5].replace(/^\+0?/,'+').replace(/^-0?/,'−')})`:esc(iso)};

/* Status words use the V2 .sev chips. Provisional is not "final": it is a simulation on a partial sample. */
const DOT='<svg viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="3" fill="currentColor"/></svg>';
export const STATE={provisional:{label:'Tạm tính',cls:'ok'},pending:{label:'Chờ xác minh',cls:'check'},excluded:{label:'Loại trừ',cls:'info'}};
export const badge=s=>`<span class="sev ${STATE[s]?.cls||'info'}">${DOT}${STATE[s]?.label||esc(s)}</span>`;
export const CSTAT={provisional:{label:'Tạm tính',cls:'ok'},insufficient:{label:'Chưa đủ dữ liệu',cls:'check'},notmet:{label:'Chưa đạt',cls:'info'},pending:{label:'Chờ xác minh',cls:'check'},none:{label:'Không có',cls:'info'},unseen:{label:'Chưa thấy trong mẫu',cls:'info'},unconfigured:{label:'Chưa cấu hình',cls:'draft'}};
export const cbadge=s=>`<span class="sev ${CSTAT[s].cls}">${DOT}${CSTAT[s].label}</span>`;
export const KIND={selling:'Bán · Sapo',acquisition:'Thu mua · Kiot',return:'Hoàn · Sapo'};

export const REASONS=[
 {key:'detail',test:/Mới đọc danh sách/,title:'Mới đọc danh sách đơn, chưa đọc chi tiết',missing:'Tiền thực thu, sale hưởng KPI, nguồn cá nhân hay shop.',next:'Mở từng đơn trong Sapo, đọc chi tiết rồi chốt sale và nguồn. Lượt chụp snapshot sau sẽ đọc lại.'},
 {key:'pay',test:/Chưa đủ cả tiền/,title:'Chưa đủ tiền hoặc trạng thái thanh toán',missing:'Tiền đã thu bằng giá trị đơn và trạng thái “Đã thanh toán” cùng lúc.',next:'Kiểm tra khoản thu của đơn; chỉ tính khi cả hai điều kiện đủ.'},
 {key:'sale',test:/Chưa chốt sale/,title:'Chưa chốt sale hưởng KPI',missing:'Một người phụ trách duy nhất cho đơn.',next:'Chốt sale trong Sapo theo quy tắc phụ trách; đơn nhiều người chờ chủ duyệt.'},
 {key:'src',test:/Nguồn cá nhân/,title:'Nguồn cá nhân hay shop chưa xác nhận',missing:'Phân loại nguồn cá nhân / shop.',next:'Ghi nguồn tại Sapo; Facebook/Zalo shop không phải nguồn cá nhân.'},
 {key:'fee',test:/phí quay đầu/,title:'Phí quay đầu hoặc xử lý khác kỳ chưa chắc',missing:'Tỷ lệ phí có chứng cứ, ngày ghi nhận.',next:'Bổ sung căn cứ phí tại chứng từ gốc rồi chụp lại.'},
 {key:'acq',test:/Chờ nguồn sale cố định/,title:'Thu mua chờ nguồn sale và khoản chi đối soát',missing:'Sale cố định trên phiếu; khoản chi đã đối soát và phân bổ không trùng.',next:'Ghi nguồn sale trên phiếu Kiot và đối soát từng khoản chi. Chưa đủ thì chưa cộng 1,5%.'},
 {key:'ret',test:/Hoàn trong kỳ/,title:'Hoàn trong kỳ, đơn gốc ngoài kỳ',missing:'Căn cứ phí quay đầu và cách ghi nhận khác kỳ.',next:'Chủ chốt cách xử lý khác kỳ; chưa có thì không giữ và không trừ KPI.'},
 {key:'excl',test:/Livestream|Hủy không phí|dưới 10%/,title:'Loại khỏi KPI sale',missing:'Không thiếu gì; đơn nằm ngoài phạm vi KPI sale.',next:'Không cần xử lý. Livestream, ký gửi đối tác / B2B, hủy không phí hoặc phí dưới 10% không tính.'}
];
export const reasonOf=r=>REASONS.find(x=>x.test.test(r.reason||''))||{key:'other',title:r.reason||'Khác',missing:'Chưa xác định.',next:'Kiểm tra tại chứng từ gốc.'};

export const chev='<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
export const backIcon='<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICONS={sales:'M4 19h16 M7 15l4-4 3 3 5-6',wait:'M12 7v5l3 2 M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',skip:'M6 6l12 12 M18 6L6 18',people:'M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M5 20c0-3 3-5 7-5s7 2 7 5',cash:'M4 7h16v10H4z M12 10v4'};
export const icon=k=>`<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="${ICONS[k]||ICONS.sales}"/></svg>`;

export const emptyState=(title,body,action='')=>`<div class="k-empty" role="status"><h2>${esc(title)}</h2><p>${esc(body)}</p>${action}</div>`;
export const note=(text,tone='caution')=>`<p class="k-note ${tone}">${text}</p>`;

/* Progress toward a monthly threshold. On a partial sample it is context, not a verdict: the caption says so. */
export function meter({label,value,target,fmt=short,met,hint,drill}){
 const p=Math.min(100,pct(value,target)),left=Math.max(0,target-value);
 const inner=`<div class="m-top"><span class="m-label">${label}</span><span class="m-val num"><b>${fmt(value)}</b> / ${fmt(target)}</span></div>
 <div class="m-track" role="progressbar" aria-label="${esc(label)}" aria-valuemin="0" aria-valuemax="${target}" aria-valuenow="${Math.min(value,target)}" aria-valuetext="${fmt(value)} trên ${fmt(target)}"><span class="m-fill${met?' is-met':''}" style="width:${p}%"></span></div>
 <div class="m-bottom"><span class="m-state ${met?'ok':'gap'}">${met?'<span aria-hidden="true">✓</span> Đạt trên mẫu':'Còn thiếu <b class="num">'+fmt(left)+'</b> trên mẫu'}</span>${hint?`<span class="m-hint">${hint}</span>`:''}</div>`;
 return drill?`<a class="meter is-link" href="${drill}">${inner}</a>`:`<div class="meter">${inner}</div>`;
}

export function stackBar(parts,total,label){
 const segs=parts.filter(p=>p.n>0).map(p=>`<a class="seg-b s-${p.key}" style="flex:${p.n} 1 0" href="${p.href}" title="${esc(p.label)}: ${p.n} (${pctText(pct(p.n,total))})" aria-label="${esc(p.label)}: ${p.n} trên ${total} chứng từ"><span>${p.n>=total*.06?p.n:''}</span></a>`).join('');
 const legend=parts.map(p=>`<a class="lg" href="${p.href}"><i class="s-${p.key}" aria-hidden="true"></i><span>${esc(p.label)}</span><b class="num">${p.n}</b><span class="lg-p num">${pctText(pct(p.n,total))}</span></a>`).join('');
 return `<div class="stack" role="group" aria-label="${esc(label)}">${segs}</div><div class="legend2">${legend}</div>`;
}

export function tierTable(breakdown,eligible){
 const labels=tiers.map((_,i)=>i===tiers.length-1?`Trên ${i} tỷ`:`${i} – ${i+1} tỷ`);
 const rows=breakdown.map((b,i)=>`<tr class="${b.base?'':'is-zero'}"><td>Bậc ${b.tier}</td><td>${labels[i]}</td><td class="r num">${b.base?short(b.base):'—'}</td><td class="r num">${(b.rate*100).toLocaleString('vi-VN')}%</td><td class="r num">${b.base?money(b.commission):'—'}</td></tr>`).join('');
 return `<div class="table-scroll"><table class="table"><caption class="vh">Bậc hoa hồng bán lũy tiến</caption><thead><tr><th>Bậc</th><th>Khoảng doanh số</th><th class="r">Phần của sale</th><th class="r">Tỷ lệ</th><th class="r">Hoa hồng bậc, trước điều kiện</th></tr></thead><tbody>${rows}</tbody></table></div><p class="k-muted">${eligible?'Đã đủ hai điều kiện trên mẫu: tổng các bậc là hoa hồng bán.':'Bảng chỉ cho thấy cách chia bậc lũy tiến trên doanh số đã xác minh trong mẫu. Chưa kết luận hoa hồng bán của tháng.'}</p>`;
}

export function recordsTable(rows){
 if(!rows.length)return '';
 const body=rows.map(r=>`<tr class="click" data-code="${esc(r.code)}">
  <td data-label="Chứng từ"><span class="cell"><button type="button" class="sens" data-open="${esc(r.code)}">${esc(r.code)}</button><span class="kind">${KIND[r.kind]}</span></span></td>
  <td data-label="Ngày" class="num"><span class="cell">${day(r.date)}</span></td>
  <td data-label="Sale · nguồn"><span class="cell">${esc(r.sale||'Chưa gán sale')}<span class="sub sens">${esc(r.source||'Chưa đọc nguồn')}</span></span></td>
  <td data-label="Giá trị chứng từ" class="r num"><span class="cell sens">${money(r.amount)}</span></td>
  <td data-label="Tính vào KPI" class="r num">${r.ctr?`<span class="cell"><b class="sens">${money(r.ctr)}</b></span>`:'<span class="cell k-muted">Chưa tính</span>'}</td>
  <td data-label="Trạng thái"><span class="cell">${badge(r.state)}</span></td>
  <td data-label="Lý do" class="why">${esc(r.reason)}</td></tr>`).join('');
 return `<div class="table-scroll k-scroll" tabindex="0" role="region" aria-label="Danh sách chứng từ, cuộn trong khung"><table class="table k-table"><thead><tr><th>Chứng từ</th><th>Ngày</th><th>Sale · nguồn</th><th class="r">Giá trị chứng từ</th><th class="r">Tính vào KPI</th><th>Trạng thái</th><th>Lý do</th></tr></thead><tbody>${body}</tbody></table></div>`;
}

export function checks(r){
 const list=[];
 if(r.kind==='selling'){const nd=!r.detail;
  list.push(['Không thuộc livestream / ký gửi đối tác / B2B',!/live|KG chị Tuyền/i.test(r.source||'')&&r.state!=='excluded']);
  list.push(['Đủ tiền và trạng thái “Đã thanh toán”',nd?null:(r.status==='Đã thanh toán'&&Number.isFinite(r.paid)&&r.paid>=r.amount)]);
  list.push(['Sale hưởng KPI đã chốt',nd?null:!!r.sale&&!r.ambiguous]);
  list.push(['Nguồn cá nhân hay shop đã xác nhận',nd?null:typeof r.personal==='boolean']);
 }else if(r.kind==='acquisition'){list.push(['Có sale cố định trên phiếu',!!r.sale]);list.push(['Khoản chi đã đối soát và phân bổ',!!r.paymentVerified])}
 else list.push(['Phí quay đầu có chứng cứ',!!r.feeConfirmed]);
 return `<ul class="checks">${list.map(([t,v])=>`<li class="${v===true?'yes':v===false?'no':'unk'}"><span class="ck" aria-hidden="true">${v===true?'✓':v===false?'✕':'?'}</span><span>${t}<small>${v===true?'Đủ':v===false?'Chưa đủ':'Chưa kiểm tra: mới đọc danh sách'}</small></span></li>`).join('')}</ul>`;
}
