# Verification — 19 October 2026

| Check | Result |
|---|---|
| Python pytest | PASS: 7 tests |
| Python Ruff | PASS |
| Python mypy | PASS: 5 source files |
| TypeScript tsc --noEmit | PASS |
| Vite build | PASS: 6.4.3 |
| Playwright Chromium | PASS: 3 scenarios |
| Desktop visual inspection | PASS: 1440px rendered screenshot inspected; neutral graphite/bronze, amounts/labels fit |
| Mobile | PASS: 390px layout has no document horizontal overflow |
| npm install audit | 0 vulnerabilities reported after patched Vite/Playwright update |
| PostgreSQL migration / server integration | NOT RUN: PostgreSQL/Docker absent from PATH; no database credentials created |
| Real Sapo/Kiot/OneDrive/Price integration | NOT RUN: deliberately unconnected, source fixtures/API contracts pending |
| Separate frontend ESLint | NOT CONFIGURED; TypeScript build checked |

API coverage: anonymous and forged-role denial, CEO access, Cofounder denial, explicit Kho/Sale grants, record-detail permission enforcement, blank/invalid periods, dimension-filter reconciliation, aging sums, local-host/origin guard, idempotent source import, closed-history conflict block, PostgreSQL INSERT ON CONFLICT DO NOTHING compilation.

Browser scenarios: blank initial period; channel and sale contribution drilldowns; reload preserves filters; three repeated open/close cycles; browser Back closes dialog; Escape closes; clear filter restores 7 rows; issue list and completion details; Cofounder denied; Kho access; mobile overflow; age filter returns 2 SKUs; total-cost card shows result calculation and link back to cost-of-goods transactions.

Synthetic reference totals: revenue 190,000,000 VND; COGS 130,500,000; operating costs 32,000,000; total costs 162,500,000; result 27,500,000; inventory 111,000,000; 90+ day inventory 42,000,000 across 2 SKUs. These are NOT real balances.

Initial sandbox DNS and loopback bind restrictions were resolved by approved scoped executions. Chromium headless-shell encountered ICU/GPU runtime failure; full Chromium channel succeeded. No auto-review rejection remains outstanding in this task. Earlier prototype restrictions were not retried or circumvented; tests/screenshots are of this newly authorized local app only. No uploads.
