// Only selected products and the active journal may change in a live transaction.
import {isDeepStrictEqual} from 'node:util';
export function liveDraft(state,scope={},previous) {
  const codes=new Set(scope.codes||[]);
  const ids=new Set(scope.ids||[]);
  const published=new Map((previous?.products||[]).map(p=>[p.id,p]));
  return {...state,
    products:state.products.map(p=>codes.has(p.code)||ids.has(p.id)?
      published.has(p.id)&&isDeepStrictEqual(p,published.get(p.id))?published.get(p.id):structuredClone(p):p),
    prepared:(state.prepared||[]).map(p=>structuredClone(p)),
    updates:(state.updates||[]).map(u=>u.id===scope.updateId?structuredClone(u):u)};
}
