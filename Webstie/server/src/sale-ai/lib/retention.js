// Keep the newest tables plus any table still needed by a confirmation or running update.
export function retainRuns(state, maxRuns = 7) {
  if (!Number.isSafeInteger(maxRuns) || maxRuns < 1) throw Error('SALE_AI_MAX_RUNS phải là số nguyên dương');
  const protectedIds = new Set((state.prepared || []).map(item => item.runId));
  for (const update of state.updates || []) {
    if (update.attempts?.some(attempt => attempt.status === 'running')) protectedIds.add(update.runId);
  }
  const kept = state.runs.filter((run, index) => index < maxRuns || protectedIds.has(run.id));
  // Keep immutable run identity when nothing was cut (live drafts cache these large snapshots).
  if (kept.length !== state.runs.length) state.runs = kept;
}
