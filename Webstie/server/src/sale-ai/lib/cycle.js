import { ageFields, POLICY } from './pricing.js';
export const validP0 = value => Number.isSafeInteger(value) && value > 0;
function hasWriteEvidence(state, p) {
  return !!p.manualPricing || /data-baoq-event|BAOQ-CURRENT|Đã áp dụng/.test(p.notes || '') ||
    (state.updates || []).some(u => u.items?.some(i => i.id === p.id || i.code === p.code || i.row?.code === p.code));
}
export function recoverP0(state, p, at) {
  if (validP0(p.p0)) { p.p0Status = 'initialized'; return false; }
  const historic = new Set((state.runs || []).flatMap(r => r.rows || [])
    .filter(row => (p.id != null ? row.id === p.id || (row.id == null && row.code === p.code) : row.code === p.code) && validP0(row.p0)).map(row => row.p0));
  let value, source;
  if (historic.size === 1) { value = [...historic][0]; source = 'history'; }
  else if (historic.size > 1 || hasWriteEvidence(state, p)) { p.p0Status = 'review_required'; return false; }
  else if (validP0(p.currentPrice)) { value = p.currentPrice; source = 'first_valid_kiot_price'; }
  else { p.p0Status = 'pending_price'; return false; }
  state.p0Repairs ||= [];
  state.p0Repairs.push({ id:p.id, code:p.code, at, before:p.p0 ?? null, after:value, source });
  p.p0 = value; p.p0Status = 'initialized'; p.p0InitializedAt = at;
  return true;
}
export function migrateCycles(state, day, at) {
  let repaired = 0;
  for (const p of [...state.products, ...(state.archivedProducts || [])]) {
    if (recoverP0(state, p, at)) repaired++;
    Object.assign(p, ageFields(p, day));
  }
  state.prepared = [];
  state.cycleVersion = 2;
  state.policy = POLICY;
  state.dataRevision = (state.dataRevision || 0) + 1;
  return repaired;
}
