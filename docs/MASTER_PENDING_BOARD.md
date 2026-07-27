> **THIS IS THE WORK LIST - what is outstanding, verified.**
> Head: `docs/PropCRM_Master_Context_and_Takeover.md` · Log: `docs/HANDOFF_CURRENT.md`
> Go-live readiness lives in `docs/Go_Live_Readiness_Register.md` - NOT duplicated here.
> Rule: nothing enters this board unverified against repo/DB. REWRITTEN, not appended.

# MASTER PENDING BOARD
Last verified against repo: 27 Jul 2026 (Day 76) - HEAD d1fb26c

## A - BLOCK VERTICAL — ✅ CLOSED (merged Day 75, tag golden-block-vertical-complete)
A1 convergence ✓ (Particulars/Bill-Collected-ToCollect/Notes) · A2 ✓ NOT A BUG (gate correct;
"manager only" was an agent session) · A3 amend — DEFERRED BY DESIGN (settled cycles are
read-only per founder ruling; amend lives in the ledger phase) · A4 ✓ probe gone with the form
rebuild · A5 ✓ text · A12 ✓ merged + tagged · A14 ✓ calculator locked after settlement.
**Still open, moved into the sections below:** A6 approval ref-vs-note · A7 adopt-panel
overflow · A8 rich unit picker · A9 calculator totals-on-top · A10 Cut 6a booking clock ·
A11 clearance-at-the-door · A13 block payment lifecycle.

## TESTING DOCTRINE (founder ruling - governs the whole board)
Unit-test every cut as it ships. **NO end-to-end round until development STOPS.** Running E2E
on a moving app = walking the same ladder repeatedly, hitting issues caused by half-built
features, re-testing what is about to change - the "1 step forward, 2 back" pattern the founder
built this discipline to prevent.
THREE E2E ROUNDS, in order: (1) when development closes · (2) with testers · (3) at pre-go-live.
CONSEQUENCE: section B below is NOT the current front. It is the gate that opens when the build
list (section C, v1 scope) is finished.

## B - PRE-PROD HARDENING (NOT NOW - opens when development stops)
B1. ✅ **CLOSED Day 76** - data freshness. `useFreshData` hook (focus/visibility refetch, 10s
    throttle, hold-during-dialog, silent variant) + master load SPLIT from realtime
    subscription. Adopted on BlockWorkspace, BlockDealsPage, Dashboard, and 4 App.jsx loads.
    Verified: no loading flash, cross-tab realtime alive, clean console. Tag
    golden-data-freshness. LESSON BANKED: never convert an effect read only at its top and
    bottom - the crash lived in the middle.
B2. **END-TO-END TESTING ROUND** (~1-2 days) - fresh clean deals through the FULL ladder
    (lead->opp->proposal->nego->reserve->SPA->won->customer->commission), checking data at
    each step + report accuracy + every gate. Everything so far tested in silos.
    RIDES B2: B6 report count-accuracy (Tasks shows 0) · B7 fieldset/lock sweep · Save-Draft
    supersession check · buyer_type form-enforcement check (see B8b).
B3. **CLEAN-DATA ROUND** - wipe test mess, seed fresh demo data. Method + FK-verified bucket
    spec already exist in `Go_Live_Readiness_Register.md` (landmines: pp_commissions,
    pp_launch_events, pp_agent_jobs are GLOBAL - never wipe). Resolves chip over-counting and
    owner-mismatch archaeology.
    ⚠️ SEEDS MUST GO THROUGH THE APP'S OWN VALIDATION, not raw SQL - see B8.
B4. NEGATIVE-TESTING workstream - app-wide round.
B5. KYC minimum for prod: PRIVATE bucket + signed URLs (bucket is PUBLIC today - real
    exposure). Full KYC v2 lives in D.
B8. **BUYER_TYPE GAP** (founder catch Day 76): every lead has buyer_type NULL because all were
    seeded from the backend (via_app=0) - the form's required-field validation was never
    invoked. NOT a form bug; untested rather than broken.
    (a) `leads.buyer_type` is NULLABLE in DB - "required" exists only in the form. Founder
        ruling: DOUBLE PROTECTION (form validates + DB constrains). Add NOT NULL after backfill
        during B3.
    (b) VERIFY the form enforces it: + Add Lead with name only must REFUSE to save.
    (c) CONSEQUENCE: buyer-type-driven KYC document matrices have never been exercised -
        plumbing exists (`reference_buyer_type_rules`), matrices unpopulated. Rides B2 + D9.
    (d) LATENT: LeadCreationFormV2 declares `buyer_intent` TWICE in state init (L215, L223) -
        last wins. One-line fix.
    LESSON: backend seeding bypasses every app-level guard.
B9. DOC VERIFY (from the Day-76 index): `Architecture_TwoLayer_LiveStateAndHistory.md` and
    `Architecture_FinalProposalFirst_PhaseB.md` may be superseded by the honest ledger and the
    V_latest cascade. Read and either re-date or archive.

## ⭐ V1 SCOPE - THE BUILD LIST (architect call Day 76, founder to ratify)
"NO MORE DEVELOPMENT" needs a definition or it never arrives. THESE FIVE, then development
STOPS and section B opens:
  V1-1  C1  Block ledger phase - post-reservation block money (design already written)
  V1-2  C13 Block polish + Cut 6a BOOKING CLOCK (the last unbuilt block seam)
  V1-3  C4  Money smalls, one cut (waived guard, gross-vs-net, valid_until, invoice zeros)
  V1-4  B5  KYC bucket PRIVATE + signed URLs (security, not polish - real exposure today)
  V1-5  B8  buyer_type guard: form enforcement proven + DB constraint (double protection)
EVERYTHING ELSE IN C AND D IS POST-TESTER. Not worse, not forgotten - just not what stands
between here and a finished v1. Improvement is infinite; completion is a decision.

## C - DESIGN SESSIONS OWED (v1 items marked above; rest is post-tester)
C1. **BLOCK LEDGER PHASE** - post-reservation block money (instalments, DLD, SPA fees across N
    children) using the 1-to-1 ledger grammar at block level. Design of record already written:
    `Block_Ledger_Phase_Design.md` (BL-1..BL-4). Founder ruling: reuse the known screen, invent
    no dialect. **This is the nearest-term design item.**
C2. DASHBOARDS + REPORTS REDESIGN: dashboards are "lists not analytics" -> charts/trends/
    actionables; reports need date-range + saved presets; no calendar view for scheduled
    activities. Input: `Dashboard_Redesign_Spec.md`.
C3. SPA v2 TWO-FACES ("horse-rider"): compact ceremony face + full ledger face. Folds in the
    Price Journey card (engine shipped Day 66, display never built), deduction-display polish,
    computable all-received amounts.
C4. MONEY SMALLS (one cut): waived-with-date guard, gross-vs-net commission display check,
    offer_valid_until surfacing + nag, invoice-panel zero residuals.
C5. SETTINGS CONSOLIDATION + App.jsx shadow sweep (auth screens, UserManagement wrapper,
    ChangePassword, SettingsTab migration, the 9 shadow-component collisions, two
    OpportunityDetail render sites). Also: `CountryPicker.jsx` + `LeadPersonEditModal.jsx`
    remain from the Day-40 orphan-suspect list - confirm dead or in use.
C6. OPERATOR/SUPERADMIN DASHBOARD: users search/filter/pagination at scale, company filter,
    operator console surface.
C7. INTELLIGENCE LAYER: Customer-360 AI + Employee-360 AI (dossiers, coach vs manager-eye
    views) + org-chart person-click -> Employee-360.
C8. LEAD->ACCOUNT MODEL + CANONICAL IDENTITY: Salesforce-pattern promotion; govt-ID as
    canonical person key; AI dup-leads report + merge tool; per-company email uniqueness.
C9. PROPPULSE DEDUP ("biggest data risk" - Decision_Log).
C10. QUOTE/PROPOSAL naming alignment (UI says Quote at lead stage, data says proposals).
C11. LEGACY EXCEL INTAKE pipeline - doctrine written (`Implementation_Doctrine.md`), pipeline
     never built. Broker onboarding needs it.
C12. SYSTEMIC isStale() HELPER - stale computed 4 places, 2 different ways; 3 hard-code >=7 and
     ignore the configured threshold. One shared helper.
C13. BLOCK POLISH (from A): approval REFERENCE vs NOTE split · adopt-panel overflow · rich unit
     picker with multi-select · calculator totals-on-top + workspace net-price dash ·
     Cut 6a BOOKING CLOCK (nags, never auto-cancels) · clearance-at-the-door · block payment
     LIFECYCLE (bounce/replace - today block money is recorded as fact, post-accounts).
C14. OPP LIST PRICE COLUMNS: Budget + Price + Final side-by-side.
C15. TITLE HOLDERS - "in whose name?" (`Title_Holders_Design_Capture.md`, Day 76). The app
     cannot record a JOINT purchase - one lead = one buyer is assumed everywhere. Holders belong
     to the OPPORTUNITY (same buyer holds different deals in different names). Founder HARD RULE:
     every name on the SPA must have documents, no override - the govt line. Pairs with C8.
     ⚠️ CANDIDATE FOR V1 - a broker cannot record a real joint purchase today.

## D - POST-TESTER / PHASE 2
D1. DEVELOPER PERSONA module (founder signal loud): developer-as-user, approval flows in-app.
    Stage-3 discount-authority wiring WAITS FOR THIS - founder ruling Day 75.
D2. Identity-model split - operator vs tenant (`Architecture_Multi_Tenant_Identity_Model.md`).
D3. Communications overhaul - email/WhatsApp/sequences.
D4. Manager dashboard v2 + commission PAYABLES/earnings views (own + team).
D5. Leasing vertical resume + leasing queue.
D6. PM/maintenance module arc.
D7. Roles arc: configurable-roles UI, useful viewer role, Executive/BI + group rollups.
D8. Full KYC v2: doc matrices per buyer type, AI extraction, hard gate at the govt line.
D9. Stage 7 Doomed-Opp + Stage 8 Document Fees (specs in archive).
D10. Rename decision + branding pass.
D11. Smalls: handover-change audit trail · Upfront-merge decision · chips deep-link wiring ·
     PDF hero-image CORS proxy · own-domain email sender · shortlist-engagement tracking.
D12. AI Coach phase 2 + AI-Extract v2.

## CLOSED (evidence attached - never deleted)
X1. CLEANUP_CRITICAL_MUST_DO - closed Day 72, orphans deleted, census-verified.
X2. Day-39 Pack button - superseded by live "Share Pack" via propertyPackBus (OpportunityDetail
    L1362). Verified by grep Day 75.
X3. CURRENT_STATUS.md - RETIRED Day 75 (dated 12 May, cites dead line numbers). Archived Day 76.
X4. Stage-5-v4 core pain (SPA price re-entry) - KILLED Day 66 by V_latest prefill, verified live.
X5. GF items resolved through Day 67; residuals live inside B2/C3/C4.
X6. **SECTION A - BLOCK VERTICAL** - merged Day 75, tag golden-block-vertical-complete.
X7. **B1 DATA FRESHNESS** - merged Day 76, tag golden-data-freshness.
X8. **DOCUMENTATION RESTRUCTURE** - Day 76: 137 docs -> 44 living + 93 archived; principles
    ratified; document index built (Register item #23); two competing heads collapsed into one.
