# BAOQ Internal — developer handoff for review

## Purpose and current state

Clickable synthetic UI scaffold only. Bảo wants to approve and adjust the structure, then describe it to their developer. The current frontend does not call an application API. A static localhost server serves a React build. Role selection is UI simulation, all data is public within the bundle, and there is no real authentication.

## Review sequence

1. Portal: verify five top-level applications. Only Điều hành opens; the others remain explicitly unavailable.
2. Select CEO UI persona → Điều hành → initial blank period → choose October demo.
3. Click revenue KPI/channel/sale legend → transaction table with URL filter → record → close/Escape/Back.
4. Click cost/result KPI → breakdown formula → transaction costs.
5. Click aged inventory and warning count → SKU/errors table → issue detail including impact, source, repair and completion criteria.
6. Switch Cofounder/Kho/Sale UI persona to discuss desired access states. This does not provide security.
7. Review accounting module labels and decide which screens to add/remove next.

## Visual direction

Neutral light backgrounds, graphite typography, restrained bronze accents; no slogans. Main shell uses 230px sidebar, 24–36px content gutters, 16–22px card gaps, 7–9px corners, compact tables and explicit empty/unavailable states. Desktop has 4 KPI columns, paired chart cards; narrow widths collapse grids, tables scroll inside containers.

## Future behavior for dev — specification, not delivered features

- Overall Điều hành view CEO-only. Other roles require explicit backend section grants; Cofounder never implicitly receives CEO financial access.
- Backend independently enforces list/detail/aggregate permissions; menu hiding alone is insufficient.
- Connect sources separately from UI. Sapo sales/refunds, Kiot purchases, OneDrive accounting authority, Price System authoritative pricing/age outputs.
- Retain source IDs, timestamps, provenance, freshness, snapshots, idempotency and approved corrections. No duplicate accounting implementation without source fixtures.
- Closed history changes block close and require approved current-period correction; preserve originals.
- No current commission/score computation until approved policy supplied.

## Latest Price System clarification — supersedes earlier notes

- Margin is profit divided by selling price; cost base only item purchase price. Other fees are separate.
- Sale-ready clock starts at the **earliest website OR social publication timestamp after photography**. Reuse existing SKU and publication/ready status data.
- Do NOT require both channels. Do NOT use stock receipt date as auto-sale start.
- Inventory financial age is separate from auto-sale age.
- Historical M0 baseline remains unresolved. Pricing bands, effective policy/version and concrete API contracts need confirmation.
- Existing auto-sale price approval stays in Price System; this scaffold does not rebuild or overwrite it.

## Suggested review decisions

Confirm portal labels, dashboard KPI choices, required table columns, whether financial inventory age is useful, issue grouping, and which accounting module to design next. Actual access grants, API contracts and source fixtures are implementation handoff items, not implied by this mockup.

## Preserved earlier work

`backend/`, `tests/`, SQL schema and Python environment were created before scope replacement. They are halted and unused. The run script starts only a static file server. No live integration or DB configuration was completed. Dev may independently inspect or disregard preserved code.

## UI iteration: unified shell and visible charts

Persistent BAOQ Internal header and global sidebar now exist on both Trang chủ and Điều hành. Module pages use the same content alignment and breadcrumb hierarchy. Internal actions update the same hash route; no window.open/target=_blank is used. The UI test verifies one tab, same origin and unchanged main-content x-position across home/module/detail/back.

Observed missing-chart state in the user's Chrome tab was `#page=overview` with no selected period. Added an explicit “Xem biểu đồ demo” action to that empty state; selected demo period remains in routes during internal navigation. CEO overview includes channel/sale donuts, cost breakdown, and weekly revenue/result horizontal bars. Weekly result derives from the synthetic transaction costs and operating cost dates, including a negative week; the total remains 27.5m VND. Bar clicks filter transactions by the fixture week. UI persona remains simulation only.

## Superseding home navigation revision

Home now contains only five central application tiles under the shared top header. The duplicate left module list and redundant breadcrumb navigation are removed from HOME entirely. Inside Điều hành, a contextual sidebar lists only Điều hành screens and a clear “← Trang chủ” button. Same-tab hash navigation, role simulation, charts and browser history are retained. This supersedes earlier notes requiring a global sidebar on Home. A1Radar reference was viewed read-only for visual context; no login, changes or tooling installation performed.

## Approved BAOQ branding

Original supplied JPEG preserved at frontend/public/brand/baoq-logo-original.jpg (Library libfile_0b473fc98b0c8191815c0807812465e1; actual bytes 2048×2048). It is displayed using CSS framing only; no redrawing or raster modification. Shared header uses deep walnut, white surfaces and black/walnut text, with chart accents #68452d / #211d19 / #ba9b7d. Headings use Georgia with serif fallback supporting Vietnamese on the reviewed Mac; this is a compatible visual choice, not identification of the logo's original font. Body and financial values retain readable system sans.

Home remains five tiles without sidebar. Context menu appears only in Điều hành. Six browser scenarios passed, including original logo intrinsic dimensions, mobile overflow, navigation and charts. Local visual evidence: brand-home-qa.png, brand-dashboard-qa.png, brand-mobile-qa.png.

## Current visual reference — shadcn/ui dashboard-01

Latest user selection supersedes the intermediate Shadcn Admin reference. Primary reference inspected in browser: https://ui.shadcn.com/view/new-york-v4/dashboard-01 (official repository https://github.com/shadcn-ui/ui). Applied its inset main surface, compact icon navigation, rounded KPI cards with supporting context, primary chart placement and restrained table borders. Existing React implementation adapted; no third-party source copied and no packages installed in this iteration.

The original BAOQ JPEG stays unchanged, centered in the shared header independently of right-hand role controls. At mobile sizes controls occupy a separate row. Walnut/white/black palette and serif title hierarchy remain. HOME has five tiles, no sidebar or breadcrumb; contextual navigation appears only inside Điều hành. All existing synthetic data and drilldowns remain unchanged. User's Sale selection in the live preview was preserved.

Current scope remains frontend UI scaffold only. Role checks are simulated in the browser; backend security, live source adapters and real balances are not delivered by this iteration.

## Luxury Workspace layer (2026-10-20) — supersedes the "five tiles" HOME notes above

Actual HOME in code: compact 56px header, BAOQ logo panel revealed on demand, then the department task board. The earlier "HOME = five tiles" descriptions are historical.

- **Header kept at 56px.** The logo panel still opens on mouse hover and keyboard focus; it now also toggles by click, tap, Enter and Space (`aria-expanded`, `aria-controls="brand-panel"`). The first activation after a hover/focus opens keeps it open. Escape and outside pointer still close it.
- **HOME app row** (`AppLauncher` in `src/app-header.tsx`): one compact row above the task board, same items/order and same-tab hash targets as the "Ứng dụng" menu (shared `appItems`). Unbuilt modules are disabled and labelled "Chưa triển khai". On mobile the row scrolls horizontally inside itself; the task board stays on the first screen.
- **Styles** live in `src/luxury.css`, loaded after `style.css`: tokens `--lx-*` (walnut `#68452d`, walnut-deep `#211604`, charcoal `#211d19`, white, muted `#73685d`), new classes `.lx-*`. Overrides of existing classes are limited to: secondary text colour for WCAG AA, focus outline colour, flat hover feedback (colour/border/shadow) and short entry animations for logo panel, app menu and record dialog.
- **Motion:** 140–280 ms, transform/opacity/colour only, no `pointer-events:none`, navigation never waits on animation. Light 3D (perspective tilt) only on the logo image and enabled app-row cards, and only for `(hover:hover) and (pointer:fine)`; touch gets a press scale. `prefers-reduced-motion: reduce` removes transforms, transitions and animations.
- **Flat data:** KPI values, tables, bars and donuts have no transforms or count-up; amounts render at their final value with tabular digits.
- **Unchanged:** content, synthetic figures, formulas, simulated roles, routes/filters/drilldowns, VI/EN glossary approach (two strings added: "ỨNG DỤNG", "Lối vào ứng dụng"), backend, data files.
- Screenshots: `docs/qa/luxury-baseline/` (before) and `docs/qa/luxury-after/` (after), produced by `frontend/visual-capture.spec.ts` with `frontend/playwright.capture.config.ts`.
