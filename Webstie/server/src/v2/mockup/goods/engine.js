/* Auto Sale simulation engine — pure functions, no DOM. Mockup only: every rule marked "GIẢ ĐỊNH MÔ PHỎNG" is an assumption, not approved policy.
   Two independent clocks (never merged):
     Tuổi tồn  = days since ready_for_sale_date, never reset.            M0=[0,30) … M6=[180,210), M6+ = 210+
     Bậc giá   = turns due since sale_cycle_start (30 days per turn).   Turn k (k=1..6) happens at cycleStart + 30·k days
   Price is always recomputed from M0 price, never from the previous run's output, so re-running with the same input and policy is stable.
   Cross-check rules (all GIẢ ĐỊNH MÔ PHỎNG, not approved policy):
     a) a turn dated BEFORE ready_for_sale_date is skipped (no discount, never made up later) even if sale_cycle_start is earlier than ready;
     b) a legacy price reset is an event stored on the item (legacy_reset_date). Policy versions cannot move it, so approving a new version never rewrites past turns;
     c) before the first version's effective date there is NO policy: such turns are skipped, a future version is never applied backwards. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.Engine=factory()})(typeof self!=='undefined'?self:this,function(){
const MS=864e5;
const dayNum=s=>{const [y,m,d]=s.split('-').map(Number);return Math.round(Date.UTC(y,m-1,d)/MS)};
const dayStr=n=>new Date(n*MS).toISOString().slice(0,10); // UTC both ways: no local-time day shift
const dayDiff=(a,b)=>dayNum(b)-dayNum(a);
const addDays=(s,n)=>dayStr(dayNum(s)+n);
const isDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s);

// Old discount table (units: triệu VND per turn). c1 = turns M1 & M2, c2 = turns M3–M6. >= 600 triệu: no rule.
const BRACKETS_V0=[[0,10,0.3,0.5],[10,20,0.5,0.7],[20,50,0.8,1],[50,100,1.5,1.5],[100,150,2.5,2.5],[150,200,3,3],[200,250,4,4],[250,300,5,5],[300,400,7,7],[400,500,8,8],[500,600,10,10]]
 .map(([min,max,c1,c2])=>({min,max,c1,c2}));
const MAX_TURNS=6,TURN_DAYS=30,RULE_CEILING_TRIEU=600;
const clone=o=>JSON.parse(JSON.stringify(o));
function defaultVersions(){return [{id:'v0',name:'Chính sách cũ (mô phỏng)',effective:'2025-01-01',brackets:clone(BRACKETS_V0),bracketMode:'fixedM0',costMode:'keepPrev',approvedAt:null,note:'Bảng giảm cũ do anh cung cấp. Mô phỏng, chưa áp dụng thực tế.'}]}
// Returns the version in force on `date`, or null when none is yet effective (never a future version).
function versionAt(versions,date){const v=versions.slice().sort((a,b)=>a.effective.localeCompare(b.effective));let cur=null;for(const x of v){if(x.effective<=date)cur=x}return cur}

// Half-open brackets [min,max): 10,000,000 belongs to 10–<20; 600,000,000 has no rule (null).
function bracketOf(priceVnd,brackets){if(!(priceVnd>=0))return null;for(const b of brackets){if(priceVnd>=b.min*1e6&&priceVnd<b.max*1e6)return b}return null}

function ageInfo(item,calc){
 if(!isDate(item.ready_for_sale_date))return {state:'missing',days:null,idx:null,label:'Thiếu ngày sẵn sàng'};
 const days=dayDiff(item.ready_for_sale_date,calc);
 if(days<0)return {state:'future',days,idx:null,label:'Chưa sẵn sàng'};
 const idx=Math.floor(days/TURN_DAYS);
 return {state:'ok',days,idx:Math.min(idx,7),label:idx>6?'M6+':'M'+idx};
}
const AGE_LABELS=['M0','M1','M2','M3','M4','M5','M6','M6+'];

const SPECIAL_TEXT={hot_trend:'Hot/trend: “đến M3 mới bắt đầu M0” chưa đủ công thức',rule_3pct:'Quy tắc 3%: chưa đủ công thức',rule_half:'Cơ chế 1/2: chưa đủ công thức',buyback:'Giá thu về: chưa đủ công thức'};
function lockOf(item){
 const ai=item._age;
 if(ai.state==='missing')return {code:'missing_ready',text:'Thiếu ngày sẵn sàng bán: không mặc định M0',group:'data'};
 if(ai.state==='future')return {code:'not_ready',text:'Chưa tới ngày sẵn sàng bán',group:'data'};
 if(item.cost==null)return {code:'missing_cost',text:'Thiếu giá vốn',group:'data'};
 if(item.m0_price==null)return {code:'missing_m0',text:'Thiếu giá M0',group:'data'};
 if(item.legacy_reset&&!isDate(item.legacy_reset_date))return {code:'missing_reset_date',text:'Hàng cũ thiếu ngày reset giá của món: không tự tính',group:'data'};
 if(item.source==='Ký gửi')return {code:'consign',text:'Ký gửi: GIẢ ĐỊNH MÔ PHỎNG khóa auto, chưa rõ chính sách',group:'rule'};
 if(item.special)return {code:'special_'+item.special,text:SPECIAL_TEXT[item.special],group:'rule'};
 if(item.m0_price>=RULE_CEILING_TRIEU*1e6)return {code:'over600',text:'Từ 600 triệu: không đủ chính sách',group:'rule'};
 if(item.m0_price<item.cost)return {code:'m0_below_cost',text:'Giá M0 thấp hơn giá vốn: khóa auto, cần xử lý tay (không tự tăng giá)',group:'data'};
 return null;
}
function cycleStart(item){
 if(item.legacy_reset)return item.legacy_reset_date||null; // GIẢ ĐỊNH MÔ PHỎNG: old manual-sale stock restarts its price cycle on ITS OWN reset date (item data, not policy)
 return item.sale_cycle_start||item.ready_for_sale_date;
}

function evaluate(item,calc,versions){
 const it=Object.assign({},item,{_age:ageInfo(item,calc)});
 const res={sku:item.sku,age:it._age,lock:lockOf(it),cycleStart:null,cycleDays:null,turns:[],turnsDue:0,skipped:0,cycleBeforeReady:false,tier:null,proposed:null,discount:0,hitCost:false,exhausted:false};
 if(res.lock)return res;
 const cs=cycleStart(item),days=dayDiff(cs,calc),ready=item.ready_for_sale_date;
 res.cycleStart=cs;res.cycleDays=days;res.cycleBeforeReady=cs<ready;
 let price=item.m0_price,stopped=false;
 for(let k=1;k<=MAX_TURNS;k++){
  const date=addDays(cs,TURN_DAYS*k),due=days>=TURN_DAYS*k;
  if(!due){res.turns.push({k,date,due:false,status:'future',amount:0,before:price,after:price});continue}
  // (a) a turn that fell before the item was ready for sale never discounts, and is not made up afterwards
  if(date<ready){res.skipped++;res.turns.push({k,date,due:true,status:'skipped_before_ready',amount:0,before:price,after:price});continue}
  if(stopped){res.turns.push({k,date,due:true,status:'stopped',amount:0,before:price,after:price,version:(versionAt(versions,date)||{}).id});continue}
  // (c) only a version already effective on the turn date may apply; none → no policy in force, turn skipped
  const v=versionAt(versions,date),before=price;
  if(!v){res.skipped++;res.turns.push({k,date,due:true,status:'no_policy',amount:0,before,after:price});continue}
  const br=bracketOf(v.bracketMode==='perTurn'?price:item.m0_price,v.brackets);
  if(!br){res.turns.push({k,date,due:true,status:'no_rule',amount:0,before,after:price,version:v.id});stopped=true;continue}
  const amt=Math.round((k<=2?br.c1:br.c2)*1e6);
  if(price-amt<item.cost){
   stopped=true;res.hitCost=true;
   if(v.costMode==='toCost'&&price>item.cost){const a=price-item.cost;price=item.cost;res.turns.push({k,date,due:true,status:'to_cost',amount:a,before,after:price,version:v.id,bracket:br})}
   else res.turns.push({k,date,due:true,status:'stopped_cost',amount:0,before,after:price,version:v.id,bracket:br});
  }else{price-=amt;res.turns.push({k,date,due:true,status:'applied',amount:amt,before,after:price,version:v.id,bracket:br})}
 }
 res.turnsDue=res.turns.filter(t=>t.due).length;
 res.tier='M'+res.turnsDue;
 res.proposed=price;res.discount=item.m0_price-price;
 const last=res.turns[MAX_TURNS-1];
 res.exhausted=days>=TURN_DAYS*(MAX_TURNS+1)&&!res.hitCost&&last.status!=='skipped_before_ready'&&last.status!=='no_policy'; // past M6 on the price clock: auto never continues
 return res;
}
function evaluateAll(items,calc,versions){return items.map(i=>evaluate(i,calc,versions))}
function hashOf(results){const s=JSON.stringify(results.map(r=>[r.sku,r.lock&&r.lock.code,r.proposed,r.tier,r.age.label,r.hitCost,r.turns.map(t=>t.status+':'+t.amount)]));let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(16).padStart(8,'0')}

// Draft validation (returns blocking errors and soft warnings)
function validateVersion(v,calc,prevEffective){
 const errors=[],warnings=[];
 if(!isDate(v.effective))errors.push('Ngày hiệu lực không hợp lệ.');
 else if(v.effective<calc)errors.push('Ngày hiệu lực không được trước ngày tính: mô phỏng không truy giảm quá khứ.');
 v.brackets.forEach((b,i)=>{
  const lab=`${b.min}–<${b.max} tr`;
  if(!(b.c1>=0)||!(b.c2>=0)||isNaN(b.c1)||isNaN(b.c2))errors.push(`Bậc ${lab}: mức giảm phải là số không âm.`);
  else if(b.c2<b.c1)warnings.push(`Bậc ${lab}: mức M3–M6 (${b.c2}) nhỏ hơn M1&M2 (${b.c1}).`);
  if(b.c1*1e6>b.min*1e6&&b.min>0)warnings.push(`Bậc ${lab}: một lượt giảm lớn hơn giá thấp nhất của bậc.`);
 });
 return {errors,warnings};
}

return {dayNum,dayStr,dayDiff,addDays,isDate,BRACKETS_V0,MAX_TURNS,TURN_DAYS,RULE_CEILING_TRIEU,AGE_LABELS,defaultVersions,versionAt,bracketOf,ageInfo,cycleStart,lockOf,evaluate,evaluateAll,hashOf,validateVersion,clone};
});
