/** UI-only fixture router. NOT authentication, authorization, a source adapter or a real API. */
import demo from './demo-data.json';
type Row = Record<string,string|number>;
const grants:Record<string,string[]>={ceo:['overview','transactions','inventory','errors','costs'],cofounder:[],inventory:['inventory'],sales:['transactions']};
const collections:Record<string,Row[]>={transactions:demo.transactions,inventory:demo.inventory,errors:demo.errors,costs:demo.costs};
const emptySummary={revenue:0,cogs:0,operating:0,total_cost:0,result:0,inventory_value:0,warning_count:0,aging_count:0,aging_value:0,groups:{channel:[],sale:[]},categories:[]};
export async function simulatedApi(path:string,options?:RequestInit): Promise<any>{
 const [pathname,query='']=path.split('?');
 const params=new URLSearchParams(query);
 if(pathname==='demo/session'){
  const role=JSON.parse(String(options?.body||'{}')).role as string;
  if(!grants[role])throw Error('Vai trò mô phỏng không hợp lệ.');
  sessionStorage.setItem('baoq-ui-persona',role);
  return {role,grants:grants[role]};
 }
 const role=sessionStorage.getItem('baoq-ui-persona')||'';
 if(!grants[role])throw Error('Chọn vai trò mô phỏng để bắt đầu.');
 if(pathname==='me')return {role,grants:grants[role],synthetic:true};
 const [kind,section,id]=pathname.split('/');
 const scope=kind==='overview'?'overview':section;
 if(!grants[role].includes(scope))throw Error('Mô phỏng: bạn chưa được cấp quyền cho phân hệ này. Đây không phải kiểm soát bảo mật.');
 if(kind==='overview')return params.get('period')?demo.summary:emptySummary;
 if(kind==='record'){
  const record=collections[section]?.find(r=>r.id===id);
  if(!record)throw Error('Không có bản ghi demo.');
  return {record,synthetic:true};
 }
 let rows=params.get('period')?[...(collections[section]||[])]:[];
 const field=params.get('field'),value=params.get('value');
 if(field)rows=rows.filter(r=>field==='week'?String(Math.ceil(Number(String(r.business_at).slice(8,10))/7))===value:field==='age_days'?Number(r[field])>=Number(value):String(r[field])===value);
 return {rows,synthetic:true,summary:section==='costs'?demo.summary:null};
}

export const demoTrend = ['01–07/10','08–14/10','15–19/10'].map((label,index)=>{
 const week=String(index+1);
 const inWeek=(date:string)=>String(Math.ceil(Number(date.slice(8,10))/7))===week;
 const sales=demo.transactions.filter(r=>inWeek(r.business_at));
 const revenue=sales.reduce((n,r)=>n+r.amount,0);
 const costs=demo.costs.filter(r=>inWeek(r.business_at)).reduce((n,r)=>n+r.amount,0);
 return {week,label,revenue,result:revenue-sales.reduce((n,r)=>n+r.cost,0)-costs};
});
