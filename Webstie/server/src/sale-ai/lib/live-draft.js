// Only selected products and the active journal may change in a live transaction.
export function liveDraft(state,scope={}) {
  const codes=new Set(scope.codes||[]);
  const ids=new Set(scope.ids||[]);
  return {...state,
    products:state.products.map(p=>codes.has(p.code)||ids.has(p.id)?structuredClone(p):p),
    prepared:(state.prepared||[]).map(p=>structuredClone(p)),
    updates:(state.updates||[]).map(u=>u.id===scope.updateId?structuredClone(u):u)};
}
