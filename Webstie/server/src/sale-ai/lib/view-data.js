import { updateSummary, reportItems, summaryText, failureReason } from './update-report.js';

const pick = (value, keys) => Object.fromEntries(keys.filter(key => value?.[key] !== undefined).map(key => [key,value[key]]));
const rowFields = ['id','code','name','type','age','m','createdDateVN','p0','currentPrice','price','allowance','net','status','reasons','notesBefore','notePreview','pricingMode','writeStatus'];
const runFields = ['id','at','day','customDate','trigger','policy','dataRevision','dataset','hiddenBeforeNoMarkdownCount'];
const productFields = ['id','code','name','currentPrice','createdAt','active','stock'];
const caches = new WeakMap();
const dayFormat = new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Ho_Chi_Minh'});
export function readMFilter(params) {
  const value=params.get('m');
  if(value===null)return null;
  if(!/^[0-6]$/.test(value))throw Object.assign(new Error('Bộ lọc M phải từ M0 đến M6'),{status:400});
  return Number(value);
}
export function filterResultRows(rows,params) {
  const m=readMFilter(params),q=(params.get('q')||'').toLowerCase();
  return rows.filter(r=>(m===null||r.m===m)&&(`${r.code} ${r.name}`).toLowerCase().includes(q));
}
export function paginate(items, params) {
  const requested = Number(params.get('page')), n = Number(params.get('size'));
  const size = [10,50,100].includes(n) ? n : 10;
  const total = items.length, totalPages = Math.max(1,Math.ceil(total/size));
  const page = Math.min(Number.isSafeInteger(requested)&&requested>0?requested:1,totalPages);
  return {items:items.slice((page-1)*size,page*size),total,totalPages,page,size};
}
function cached(state, revision) {
  let data = caches.get(state);
  if(data?.revision===revision)return data;
  const runs=state.runs||[], products=state.products||[];
  data={revision,metrics:{products:products.length,inStock:products.filter(p=>p.active&&p.stock>0).length,hottrend:products.filter(p=>p.type==='hottrend').length,waiting:(runs[0]?.rows||[]).filter(r=>r.status==='waiting').length},
    history:[...runs.map(run=>({kind:'simulation',id:run.id,at:run.at,day:run.day,run:{...pick(run,runFields),rowCount:run.rows.length}})),
      ...(state.updates||[]).map(update=>({kind:'update',id:update.id,at:update.at,day:dayFormat.format(new Date(update.at)),update:{...pick(update,['id','at','mode','outcome','platformSummary','issueCount','trigger','error']),canRestore:update.restoreVersion===1&&update.items.some(i=>Object.values(i.platforms||{}).some(p=>p.status==='done'))&&!update.items.some(i=>Object.values(i.platforms||{}).some(p=>['unknown','sending'].includes(p.status)))&&!(state.updates||[]).some(u=>u.mode==='restore-joint-v1'&&u.sourceId===update.id&&u.items.some(i=>Object.values(i.platforms||{}).some(p=>p.requestSent))),summary:updateSummary(update.items)}}))].sort((a,b)=>Date.parse(b.at)-Date.parse(a.at))};
  caches.set(state,data);return data;
}
export function viewData(state,params,{revision,today,dataset,busy,progress}) {
  const mFilter=readMFilter(params);
  const view=['results','history'].includes(params.get('view'))?params.get('view'):'results';
  const cache=cached(state,revision);
  const out={view,dataset,revision,today,busy,progress,policy:state.policy,dataRevision:state.dataRevision,loadedAt:state.loadedAt,mapping:pick(state.mapping,['verified','code']),metrics:cache.metrics};
  if(view==='results') {
    const id=params.get('run');const run=id?state.runs.find(r=>r.id===id):state.runs[0];
    if(id&&!run)throw Object.assign(new Error('Không tìm thấy lượt mô phỏng'),{status:404});
    const rows=filterResultRows(run?.rows||[],params);
    out.mFilter=mFilter;
    out.pagination=paginate(rows,params);out.pagination.items=out.pagination.items.map(r=>pick(r,rowFields));
    out.runs=run?[{...pick(run,runFields),rows:out.pagination.items}]:[];delete out.pagination.items;
  } else if(view==='history') {
    out.pagination=paginate(cache.history.filter(e=>dataset==='real'?e.kind==='update':e.kind==='simulation'),params);
    out.history=out.pagination.items;delete out.pagination.items;
    const editParams=new URLSearchParams({page:params.get('edits_page')||'1',size:params.get('edits_size')||'10'});
    out.editsPagination=paginate(state.manualEdits||[],editParams);
    out.manualEdits=out.editsPagination.items.map(e=>({...pick(e,['id','code','name','at']),before:pick(e.before,['price','allowance']),after:pick(e.after,['price','allowance'])}));
    delete out.editsPagination.items;
  } else {
    const p=state.products.find(p=>p.code===state.mapping?.code)||state.products.find(p=>p.active&&p.stock>0)||state.products[0];
    out.products=p?[pick(p,productFields)]:[];
  }
  return out;
}
export function updateDetail(state,id,params) {
  const update=(state.updates||[]).find(u=>u.id===id);
  if(!update)throw Object.assign(new Error('Không tìm thấy lượt cập nhật'),{status:404});
  const attempt=params.get('attempt');let items=update.items||[];
  if(attempt!==null){const index=Number(attempt);if(!Number.isSafeInteger(index)||index<0||!update.attempts?.[index])throw Object.assign(new Error('Không tìm thấy lần thử'),{status:404});items=update.attempts[index].items||[];}
  if(params.get('errorsOnly')==='true')items=[...items.filter(p=>p.status!=='done'),...(attempt===null?update.skipped||[]:[])].filter((p,i,all)=>all.findIndex(x=>x.code===p.code)===i);
  const pagination=paginate(items,params);
  pagination.items=pagination.items.map(p=>pick(p.row||p.before?reportItems([p])[0]:({...p,error:failureReason(p)}),['id','code','name','beforePrice','price','status','error','stage','failureStage','rollbackResult','platforms']));
  return {update:{...pick(update,['id','at','mode','outcome']),summary:updateSummary(update.items),message:summaryText(updateSummary(update.items),update)},pagination,
    attempts:(update.attempts||[]).map((a,index)=>({index,at:a.at,failed:(a.items||[]).filter(p=>p.status!=='done').length})).filter(a=>a.failed)};
}


