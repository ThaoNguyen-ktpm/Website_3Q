# Current verification — UI-only scaffold

The user replaced scope with design review and developer handoff. Final runtime is a static Python file server, React and synthetic JSON. FastAPI is stopped and not used. Role states are simulated in the browser; no security or authentication is claimed.

| Check | Result |
|---|---|
| TypeScript tsc --noEmit | PASS |
| Vite static build | PASS |
| Playwright, static UI only | PASS: 3 scenarios |
| Desktop visual review | PASS: local screenshot inspected |
| Mobile 390px | PASS: no document horizontal overflow |
| Backend/database/authentication | HALTED after scope change; preserved code is unused |
| Real integrations / production | NOT IMPLEMENTED / NOT RUN |
| Separate frontend ESLint | NOT CONFIGURED; TypeScript build checked |

UI flows checked: initial blank period; channel and sale drilldowns; URL-filter persistence on refresh; repeated open/close (3 times); browser Back; Escape; clear filter; issue detail/completion criteria; simulated Cofounder and Kho states; inventory 90+ filter; cost/result calculation; transaction drilldown. Passing simulated role tests does NOT establish security.

Synthetic totals reconcile: revenue 190,000,000 VND; COGS 130,500,000; operating 32,000,000; total costs 162,500,000; result 27,500,000; inventory 111,000,000; 90+ inventory 42,000,000 across 2 SKUs. No real balances.

Earlier backend/API/schema checks are retained in historical-application-verification.md for transparency only. They do not describe the final scaffold runtime. No ongoing approval denial or uncertain external action. No deployment, upload, source write or existing-project edit.

Latest UI iteration: TypeScript/build PASS; Playwright 5 scenarios PASS. Added shared-shell geometry/same-origin/single-tab/history checks and empty-state-to-donuts/weekly-bar drilldown checks. Actual user Chrome tab 466553915 was inspected, set to CEO / October demo and returned to overview; visible donut charts and weekly bar heading were verified by screenshot. No new tab was created during this iteration. Existing preview remained running.

Home-only tiles revision: TypeScript/build PASS; 5 Playwright scenarios PASS, including no sidebar/breadcrumb on home, exactly five tiles, shared header, module→home→browser Back and charts/drilldowns. Verified home visually in the user's existing Chrome preview tab and left it open. No backend changes.

Branding revision: original Library JPEG materialized with identity metadata and visually inspected. Build/typecheck PASS; all 6 Playwright scenarios PASS. Home/dashboard/mobile screenshots reviewed. No backend or real-source changes. Claude CLI not found in PATH or conventional user/Homebrew/npm-global locations; no installation or authentication attempted.

## shadcn/ui dashboard-01 iteration

- TypeScript `tsc --noEmit` and Vite build: passed.
- Existing six Chromium UI scenarios: passed (4.4s), including repeated detail open/close, Back/Escape, reload/filter persistence, costs/sale/aging drilldowns, blank-period action, five-tile HOME and simulated role behavior.
- Additional centered-logo/no-overlap/no-horizontal-overflow check: passed at 1440, 1024, 768 and 390px (0.9s).
- Visual review: desktop full dashboard and mobile viewport screenshots inspected; logo and numerical text readable, no clipped viewport. Live Chrome portal refreshed at localhost; selected Sale role preserved.
- Screenshot: docs/brand-dashboard-qa.png. Library identity libfile_43f6b500511081919372c68b2588b93f, file_00000000950481f69dfda96ff1254d7e, version 0. Also local docs/brand-home-qa.png and docs/brand-mobile-qa.png.
- ESLint: not configured/not run. Backend/API authorization and real accounting integration: not run, outside current frontend-only scope. No dependencies installed, no public deployment, no GitHub push, no live-source write.

## Luxury Workspace iteration (2026-10-20)

Commands (run from `frontend/`, static server `../scripts/run-local.sh` on 127.0.0.1:8787; browsers verified in `frontend/.browsers/chromium-1248`, matching playwright-core 1.64.1):

```sh
PATH="$PWD/../.node/bin:$PATH" ../.node/bin/npm run build
PATH="$PWD/../.node/bin:$PATH" PLAYWRIGHT_BROWSERS_PATH="$PWD/.browsers" ../.node/bin/npx playwright test
PATH="$PWD/../.node/bin:$PATH" PLAYWRIGHT_BROWSERS_PATH="$PWD/.browsers" BAOQ_SHOTS=luxury-after ../.node/bin/npx playwright test -c playwright.capture.config.ts
```

| Check | Baseline (before edits) | After |
|---|---|---|
| `tsc --noEmit` + Vite build | PASS | PASS |
| Existing 8 Playwright scenarios (unchanged) | PASS 8/8 | PASS 8/8 |
| New scenarios: launcher/keyboard/VI-EN, logo click/Enter/Space + menu ×3, touch 390px, motion budget + reduced motion, flat amounts/no count-up, Back/Forward filter + dialog, WCAG AA text contrast | not applicable | PASS 7/7 |
| AA text-contrast audit (home, overview, filtered table, tasks, home EN) | 5 colour groups below 4.5:1 (lowest 2.83:1) | 0 failures |
| Screenshot set (17 images) | `docs/qa/luxury-baseline/` | `docs/qa/luxury-after/` |

Notes: existing tests still write `docs/dashboard-local-qa.png`, `docs/home-board-*-qa.png`, `docs/tasks-*.png` on each run (overwritten as before). Contrast check excludes disabled controls (WCAG inactive-component exemption) and approximates gradient backgrounds by their nearest solid ancestor colour. Safari/Firefox and real touch devices: NOT RUN (Chromium emulation only). ESLint: not configured.

### Follow-up after approval of home-vi-1440/390 and dashboard-overview-1440/390 (2026-10-21)

- Approved images were captured after the last source change, so no redesign was done.
- Defect found and fixed: the HOME app-row scroll container clipped the keyboard focus ring of the first/last card (measured ring 4px outside the row on the left, 2px on top). Fix in `src/luxury.css`: vertical padding with matching negative margin, card focus ring offset `-2px`, `scroll-padding`. New Playwright check "launcher focus ring is not clipped" (failed on the previous build, passes now).
- typecheck PASS, build PASS, Playwright 16/16 PASS. Re-capture: 16 of 17 `docs/qa/luxury-after` images byte-identical, including the four approved ones; `dashboard-overview-en-1440` differs only by gradient raster noise (max channel delta 18/255, one pixel above 16, no launcher on that page). The approved `luxury-after` files were not overwritten.

## App v2 (21/10/2026) — mockup v2 ported into the main app

- Ported from `docs/design-proposals/plan-mockup-v1/v2/`: HOME v2 (`home.tsx`), Điều hành v2 (`dashboard.tsx`), Chính sách frame (`policy.tsx`), espresso header + two-level drawer (`app-header.tsx`), styles `app-v2-base.css` + `app-v2.css`. Old `style.css` / `luxury.css` removed.
- Unchanged: simulated API, demo data, roles (UI simulation only), formulas, task store. Policy drafts stay in `localStorage` (`baoq-policy-draft-v2`), nothing pre-filled, nothing applied.
- `qa.spec.ts`: 20/20 pass. Business tests kept; assertions tied to the removed launcher/logo panel/donuts rewritten for v2; new tests for HOME filters, alert sheet, policy validation, not-connected pages, drawer focus ring; contrast check now also covers errors table and policy.
- Phone (<700px): the logo sits after Menu instead of centred, because the language toggle + role select leave no room; ≥768px it is centred.
- Screenshots: `docs/qa/v2-app/`.
