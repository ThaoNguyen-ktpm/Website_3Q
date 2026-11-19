import {expectedKiotPrices} from './auto-update.js';
import {calculate} from './pricing.js';

/** Groups use the current price snapshot; approvals never exempt later markdowns. */
export function approvalGroups(state){
  if(!state.runs?.[0])return {pending:[],legacy:[],total:0};
  const products=new Map((state.products||[]).map(p=>[p.id,p]));
  const currentM=new Map();
  for(const update of state.updates||[])for(const item of update.items||[]){
    const result=item.platforms?.kiot||item;
    if(!currentM.has(item.id)&&result.status==='done'&&result.verifiedAt)currentM.set(item.id,item.row?.m??null);
  }
  const rows=(state.runs?.[0]?.rows||[]).map(row=>({...row,currentM:currentM.get(row.id)??(row.currentPrice===row.p0?0:null),currentPrice:products.get(row.id)?.currentPrice??row.currentPrice}));
  const pending=rows.filter(r=>r.status==='needs_approval'&&r.currentPrice!==r.price);
  const pendingIds=new Set(pending.map(r=>r.id)),expected=expectedKiotPrices(state.updates);
  const kept=new Map((state.belowCostKeeps||[]).map(k=>[k.id,k.price]));
  const byId=new Map(rows.map(r=>[r.id,r]));
  const candidates=[...products.values()].map(p=>byId.get(p.id)||{...calculate(p,state.runs[0].day),id:p.id});
  const legacy=candidates.filter(r=>!pendingIds.has(r.id)&&Number.isSafeInteger(r.cost)&&r.cost>0&&r.currentPrice<r.cost&&expected.get(r.id)===r.currentPrice&&kept.get(r.id)!==r.currentPrice)
    .map(r=>({...r,belowCost:r.cost-r.currentPrice}));
  return {pending,legacy,total:pending.length+legacy.length};
}
