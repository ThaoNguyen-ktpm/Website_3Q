/* Income-first presentation layer. Pure: reads the model's results, never changes a formula, rate, threshold or snapshot value.
   It only decides HOW a result is shown. A monthly threshold that cannot be judged is "insufficient" (amount null), never 0.
   Coverage is NEVER inferred from row counts, a number of days or "detail = true". Each mechanism is 'unknown' unless the data carries an
   explicit proof (data.proof.mechanisms[key] === true, written by whoever verified the whole policy period at source). Even then a pending
   record anywhere in that mechanism keeps the answer "insufficient". Missing money stays missing; there is no invented total income. */
import {summarize,team,acquisition} from './model.mjs?v=beb9a611';

export const STATUS={provisional:'Tạm tính',insufficient:'Chưa đủ dữ liệu',notmet:'Chưa đạt',pending:'Chờ xác minh',none:'Không có',unseen:'Chưa thấy trong mẫu',unconfigured:'Chưa cấu hình'};
export const THRESH={total:5e8,personal:1e8,items:10,order:3e8};

const dayMs=864e5,isoMs=s=>Date.parse(s+'T00:00:00Z');
/* Coverage. days / ordersRead / receiptsWithSale are DESCRIPTIVE ONLY (shown to the reader); they never decide anything.
   A mechanism is 'attested' only by explicit proof in the data; the real snapshot has none, so every mechanism is 'unknown'. */
export const MECH=['selling','personal','cross','acq','adjust'];
export function coverageOf(data){
 const days=Math.round((isoMs(data.period[1])-isoMs(data.period[0]))/dayMs)+1;
 const proof=(data.proof&&data.proof.mechanisms)||{};
 const mechanisms={};for(const k of MECH)mechanisms[k]=proof[k]===true?'attested':'unknown';
 return {days,ordersRead:data.orders.filter(o=>o.detail).length,ordersTotal:data.orders.length,
  receiptsWithSale:data.receipts.filter(r=>r.sale).length,receiptsTotal:data.receipts.length,
  mechanisms,complete:MECH.every(k=>mechanisms[k]==='attested')};
}

/* Records: one row per document, tagged by mechanism. ctr = amount that counts toward that mechanism (never summed across mechanisms). */
export function buildRecords(data){
 const rows=summarize(data.orders).rows;
 return [...rows.map(o=>({...o,kind:'selling',ctr:o.state==='provisional'?o.base:0})),
  ...data.receipts.map(o=>{const a=acquisition(o);return {...o,...a,kind:'acquisition',ctr:a.state==='provisional'?a.base:0}}),
  ...data.events.map(o=>({...o,kind:'return',state:'pending',reason:'Hoàn trong kỳ, đơn gốc ngoài kỳ; căn cứ phí và khác kỳ chưa chốt',ctr:0}))];
}

const comp=(key,label,status,amount,extra={})=>({key,label,status,amount:status==='provisional'||status==='notmet'?amount:null,...extra});

export function incomeFor(name,A,T,cov,config={}){
 const t=T.find(x=>x.name===name);
 if(!t)return null;
 const mine=A.filter(r=>r.sale===name);
 const prov=mine.filter(r=>r.kind==='selling'&&r.state==='provisional');
 const maxOrder=Math.max(0,...prov.map(r=>r.base));
 /* open evidence: any pending record in the mechanism (assigned to this sale or not) can still change the answer */
 const openSel=A.some(r=>r.kind==='selling'&&r.state==='pending'),openAcq=A.some(r=>r.kind==='acquisition'&&r.state==='pending'),
  openAdj=A.some(r=>(r.kind==='return'||/hoàn|hủy/i.test(r.status||''))&&r.state==='pending');
 const can=(k,open)=>cov.mechanisms[k]==='attested'&&!open;
 const missOf=k=>can(k,openSel)?'notmet':'insufficient';
 const c=[];
 c.push(comp('selling','Hoa hồng bán lũy tiến',t.selling>0||t.eligible?'provisional':missOf('selling'),t.selling,
  {rule:'Tổng ≥ 500 tr VÀ cá nhân ≥ 100 tr, tính lũy tiến',basis:{total:t.total,personal:t.personal,needTotal:THRESH.total,needPersonal:THRESH.personal},drill:{kind:'selling',state:'provisional',sale:name}}));
 c.push(comp('personal','Thưởng cá nhân 1%',t.personalBonus>0?'provisional':missOf('personal'),t.personalBonus,
  {rule:'1% toàn bộ doanh số cá nhân khi đạt 100 tr',basis:{personal:t.personal,need:THRESH.personal},drill:{kind:'selling',state:'provisional',pers:'1',sale:name}}));
 c.push(comp('cross','Cross-sale',t.cross>0?'provisional':missOf('cross'),t.cross,
  {rule:'10 món thêm HOẶC một đơn ≥ 300 tr: 1 tr, một lần',basis:{extra:t.extra,needItems:THRESH.items,maxOrder,needOrder:THRESH.order},drill:{kind:'selling',state:'provisional',sale:name}}));
 const rec=mine.filter(r=>r.kind==='acquisition'),ok=rec.filter(r=>r.state==='provisional');
 c.push(comp('acq','Thu mua 1,5%',ok.length?'provisional':rec.length?'pending':can('acq',openAcq)?'none':'unseen',ok.reduce((s,r)=>s+r.commission,0),
  {rule:'1,5% tiền shop thực trả đã đối soát và phân bổ',basis:{receipts:rec.length,verified:ok.length,base:ok.reduce((s,r)=>s+r.base,0)},drill:{kind:'acquisition',sale:name}}));
 const adj=mine.filter(r=>r.kind==='return'||/hoàn|hủy/i.test(r.status||''));
 c.push(comp('adjust','Điều chỉnh (hoàn / hủy / quay đầu)',adj.length?'pending':can('adjust',openAdj)?'none':'unseen',0,
  {rule:'Chỉ tính khi có căn cứ phí và kỳ ghi nhận',basis:{count:adj.length},drill:adj.length?{kind:'return',sale:name}:null}));
 const sal=config.baseSalary&&Number.isFinite(config.baseSalary[name])?config.baseSalary[name]:null;
 c.push(comp('salary','Lương cơ bản',sal==null?'unconfigured':'provisional',sal,{rule:'Cấu hình riêng, không nằm trong tổng hoa hồng / thưởng',separate:true,drill:null}));
 const counted=c.filter(x=>!x.separate&&x.status==='provisional');
 /* a total of 0 is honest only when every money mechanism is settled by proof (not met / none), never from missing data */
 const settled=['selling','personal','cross','acq'].every(k=>{const x=c.find(y=>y.key===k);return x.status==='notmet'||x.status==='none'||x.status==='provisional'});
 const open=c.filter(x=>!x.separate&&(x.status==='insufficient'||x.status==='pending'));
 return {name,components:c,
  total:{known:counted.length>0||settled,amount:counted.length?counted.reduce((s,x)=>s+x.amount,0):(settled?0:null),openCount:open.length,partial:open.length>0||!cov.complete},
  counts:{provisional:mine.filter(r=>r.state==='provisional').length,pending:mine.filter(r=>r.state==='pending').length,excluded:mine.filter(r=>r.state==='excluded').length}};
}

export function analyze(data,config={}){
 const A=buildRecords(data),T=team(data.orders),cov=coverageOf(data),S=summarize(data.orders);
 const sales=[...T].sort((a,b)=>b.total-a.total).map(t=>incomeFor(t.name,A,T,cov,config));
 const un=A.filter(r=>!r.sale);
 const known=sales.filter(s=>s.total.known);
 return {records:A,team:T,coverage:cov,sales,
  unassigned:{provisional:un.filter(r=>r.state==='provisional').length,pending:un.filter(r=>r.state==='pending').length,excluded:un.filter(r=>r.state==='excluded').length},
  totals:{verifiedSales:S.total,personalSales:S.personal,known:known.length>0,amount:known.length?known.reduce((s,x)=>s+x.total.amount,0):null,salesWithKnown:known.length},
  counts:{provisional:A.filter(r=>r.state==='provisional').length,pending:A.filter(r=>r.state==='pending').length,excluded:A.filter(r=>r.state==='excluded').length,all:A.length}};
}
