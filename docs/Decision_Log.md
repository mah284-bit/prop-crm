# PropCRM — Decision Log
The record of KEY architectural & product decisions + their rationale. Purpose: never re-litigate a
settled question. New decisions append here. Format: DECISION · WHY · DATE.
This is governance backbone (#24 on the Document Register).

## 2026-06-24 (Horizon-2 design day + tester prep)

### Settings
- ALL settings are COMPANY-LEVEL, admin/manager-editable, group-aware. WHY: every user belongs to a
  company_id (solo broker = company-of-one); no separate per-broker settings concept needed. Default
  ADMIN-LOCKED to prevent individual drift.
- DLD = platform-fixed (UAE authority standard 4%; only absorber varies). WHY: not a company choice.
- Payment terms = editable presets + Custom is CORRECT scope, NOT a gap. WHY: broker doesn't collect;
  buyer pays developer directly; payment plan is informational, not a financial engine. (Becomes real
  scope only if PropCRM expands to developer-side/collections — future PropOS.)
- Roles = keep fixed 7 + configurable capabilities. Custom roles NOT built. WHY: the 7 cover every
  brokerage's permission SHAPE; titles are cosmetic labels; custom roles = structural cost, cosmetic
  payoff. Revisit only on real client pull.
- Stale-lead threshold = company-level, admin-controlled, no per-broker override. WHY: else each broker
  games it; company standard lost.

### Commission
- Resolution hierarchy (most-specific wins, always resolves): Unit/Deal override -> Project ->
  Master Agreement -> Developer standard -> Company fallback. WHY: covers agreement, no-agreement
  standard, and on-the-fly market incentives in one model.
- Visibility = CAPABILITY (company assigns who holds it), NOT a fixed Finance role. Broker NEVER sees
  or enters commission. WHY: capability machinery already exists; rigid "Finance dept" breaks the
  solo-broker case.
- Hiding = REMOVE at data layer (filter server/query-side), NEVER mask. WHY: masked values leak via
  DevTools/network — false security on confidential margin.
- Anti-miss = invoice draft at Won/Closed cannot finalize without explicit commission confirmation by
  capability-holder; unconfirmed surfaced on dashboard. WHY: make "forgot to set it" structurally
  impossible, not just discouraged.
- BOUNDARY (GIGO): software cannot prevent a wrong number entered by an authorized human. Our job =
  default-correct + forced-checkpoint + audit-trail. Beyond that, accuracy is human/finance
  responsibility. STOP adding controls past audit trail.

### Reset routine
- Schema + FK VERIFIED bucket spec (WIPE / PRESERVE / GLOBAL-never-touch / DROP-junk) for all 60
  tables. WHY: a reset that guesses = data loss. LANDMINES caught: pp_commissions, pp_launch_events,
  pp_agent_jobs are GLOBAL (FK-only to projects/devs) — never wipe. Pricing (unit_sale/lease_pricing)
  = tenant selling-inventory -> WIPE + re-import. LESSON: company_id absence != global; FK links
  disambiguate.

### PropPulse
- Run AI Agent + Verify Queue = PLATFORM-OPERATOR only (automated/scheduled). WHY: each run = cost;
  open access = runaway cost + data-integrity chaos; tenants consume, don't trigger. Validated by
  run-cadence data (heavy same-day runs in history would multiply across tenants).
- Import = tenant self-service (creates tenant unit_sale_pricing copies). Price VALUE always
  developer-sourced; broker can't change it.
- DEDUP is the biggest data risk (agent re-pulls near-dup names). Verification basis = confidence +
  RERA/DLD source match; tiered auto/manual/hold. Build post-tester in a dedicated session.

### Legacy data upload + Adoption
- Intake via PropCRM's EXCEL TEMPLATE ONLY. WHY: direct integration to clients' old systems = N
  bespoke projects (fork-hell); Excel collapses N into one pipeline.
- Bring their DATA in, NOT their PROCESS. WHY: workflow is the product's value; mimicking legacy =
  customization graveyard. Implementation must never exceed configuration.
- Data cleansing is NOT PropCRM's responsibility (advise on patterns, never own removing/updating).
  WHY: liability boundary — we must not CREATE garbage; we don't fix theirs.
- Our-ID stamping = integration key (optional legacy_ref for traceability). Staged 10-record vertical-
  slice test before full upload. Reversible batches.

### Process / engineering discipline
- Prefer SYSTEMIC corrections over SILO edits. WHY: caught that fixing hard-coded "stale=7" in one
  place leaves 3 others inconsistent; the right fix is one shared isStale() helper across all modules.
  Parked for Monday (post-tester) rather than a partial patch 2 days from tester.
- No risky multi-file change within 2 days of a tester handoff. WHY: "1 step forward, 2 back" risk.
- Sources tracked in git; generated artifacts (.docx/.pdf) gitignored. WHY: binaries bloat the repo;
  the .md is source of truth, regenerate outputs as needed.

## STANDING DECISIONS (carried from earlier sessions, still in force)
- Naming: lead-stage UI = "Quote", opp-stage UI = "Proposal"; table/code stay "proposals" (UI-label
  divergence). Path B (code/data alignment) = post-tester.
- 0% discount is VALID (full price) — must never blank the Net Price line.
- PropPulse tables (projects/project_units/properties/pp_developers) are GLOBAL — never tenant-filter.
- Multi-tenant identity: founder account currently doubles as platform + tenant (testing shortcut);
  split to platform-only identity is a post-demo refactor (Architecture_Multi_Tenant_Identity_Model.md).
