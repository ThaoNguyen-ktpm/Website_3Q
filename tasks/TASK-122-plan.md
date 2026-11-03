# TASK-122 plan

1. Instrument the unchanged batch engine; record isolated 1112/1311-product modeled benchmarks before optimization. Keep the latency assumptions explicit.
2. Persist the beginning of the authoritative Kiot read in table rows. Use the oldest selected row cursor for localOnly preflight, with the existing 30-second margin. Missing/invalid/future cursor uses full all().
3. Reuse post-write modified reads for the next lot. Preserve sending checkpoint before PUT, checkpoint results after each lot, remove redundant batch-final checkpoint on the Kiot-only path.
4. Test old hand edits, later-lot edits, missing cursor fallback, failed PUT continuation, and interrupted journals. Rerun the same benchmarks, report actual modeled bottlenecks if above 120 seconds.
5. Keep LOT_SIZE=50 unless the official public API explicitly supports more. Keep status polling/ETA unless measurement supports a change. Focused checks only; Claude runs full suites and E2E.
