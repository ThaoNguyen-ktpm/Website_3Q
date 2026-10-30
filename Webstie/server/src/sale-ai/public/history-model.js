export function historyEntries(state, includeUpdates=true) {
  return [...state.runs.map(run=>({kind:'simulation',id:run.id,at:run.at,day:run.day,run})),
    ...(includeUpdates?(state.updates||[]).map(update=>({kind:'update',id:update.id,at:update.at,day:new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Ho_Chi_Minh'}).format(new Date(update.at)),update})):[])]
    .sort((a,b)=>Date.parse(b.at)-Date.parse(a.at));
}
export const failedItems = items => items.filter(item=>item.status!=='done');
