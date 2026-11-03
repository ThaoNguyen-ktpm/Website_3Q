// Pages backed by the real API (Bảo 2026-10-27): [page, label, permission the server also checks].
export type AppPage=[string,string,string];
export const V2_OVERVIEW='#page=v2-dashboard';
export const V2_REPORTS:[string,string][]=[['v2-dashboard','Tổng quan'],['v2-tx','Thu–bán'],['v2-inventory','Tồn kho'],['v2-checks','Kiểm tra'],['v2-costs','Chi phí'],['v2-goods','Hàng hóa & hiệu quả vốn'],['v2-kpi','KPI Sale']];
export const V2_PENDING:[string,string][]=[['v2-reconcile','Tổng quan đối soát'],['v2-consignment','Ký gửi'],['v2-cash','Tiền & đối chiếu'],['v2-close','Chốt kỳ & điều chỉnh'],['v2-settings','Thiết lập & nguồn']];
export const v2Label=(page:string)=>[...V2_REPORTS,...V2_PENDING].find(([key])=>key===page)?.[1];
export function legacyV2Page(page:string){
 const old:Record<string,string>={overview:'dashboard',transactions:'tx',inventory:'inventory',errors:'checks',costs:'costs',reconcile:'reconcile',consignment:'consignment',cash:'cash',close:'close',settings:'settings'};
 return Object.hasOwn(old,page)?`v2-${old[page]}`:page;
}
export function v2FrameUrl(page:string,route:URLSearchParams){
 const pending=V2_PENDING.some(([key])=>key===page);
 const hash=new URLSearchParams({view:pending?'nc':page.slice(3)});
 if(pending)hash.set('page',page.slice(3));
 route.forEach((value,key)=>{if(!['page','view'].includes(key))hash.set(key,value)});
 return `/v2/mockup/baoq-mockup-v2.html?embed=1#${hash}`;
}
/** Only known V2 screens may navigate the parent; no URL from the frame is opened. */
export function v2MessageRoute(hash:unknown){
 if(typeof hash!=='string'||!hash.startsWith('#')||hash.length>8000)return null;
 const inner=new URLSearchParams(hash.slice(1)),view=inner.get('view');
 if(view==='policy'){
  const target=new URLSearchParams({page:'policy'}),group=inner.get('group');
  if(group)target.set('group',group);
  return '#'+target.toString();
 }
 if(view==='home')return '#page=portal';
 const page=`v2-${view==='nc'?inner.get('page'):view}`;
 if(!v2Label(page))return null;
 const outer=new URLSearchParams({page});
 inner.forEach((value,key)=>{if(!['view','page'].includes(key))outer.set(key,value)});
 return '#'+outer.toString();
}
export const PRICE:AppPage[]=[['sale','Sale AI','sale.manage'],['search','Tìm kiếm sản phẩm','products.view']];
export const MANAGE:AppPage[]=[['team','Nhân viên','staff.view'],['audit','Nhật ký','audit.view'],['documents','Tài liệu','documents.view']];
