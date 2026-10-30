export type Recent={page:string;label:string;at:string};
/** Browser storage may be old or edited; discard invalid entries before rendering. */
export function readRecent():Recent[]{
 try{
  const list:unknown=JSON.parse(localStorage.getItem('baoq-recent')||'[]');
  return Array.isArray(list)?list.filter((item):item is Recent=>item!==null&&typeof item==='object'
   &&typeof item.page==='string'&&typeof item.label==='string'&&typeof item.at==='string'
   &&Number.isFinite(Date.parse(item.at))):[];
 }catch{return []}
}
