# MASTER PENDING BOARD
Built Day 75 (26 Jul 2026), first hour. Swept: HANDOFF (54 markers) + GF capture + older strata
(Deferred_Day39, Price_Columns, App_Normalisation, CLEANUP, Decision_Log, CURRENT_STATUS) +
Phase 2 register. Rule: verify, don't collect. Items move to CLOSED with evidence, never deleted.

## A - BLOCK VERTICAL: FINISH + MERGE (branch feature/block-cut7)
A1. Payment-form vocabulary CONVERGENCE with 1-to-1 (founder directive: read Record-Reservation
    ceremony + payForm + honest ledger FIRST; block form = block face of same machinery).
A2. Payments-tab shows "manager only" for SUPER_ADMIN; Accept button gates correctly. Same
    canDo, different result - suspect stale currentUser in tab-row closure. VERIFIED OPEN.
A3. AMEND path never tested live. Fixture: Khalid block (2 payments).
A4. Strip [BPD] debug probe from BlockPaymentDialog BEFORE merge. VERIFIED PRESENT.
A5. Text: "Reservation Received X of Y" / "held until collected fully".
A6. Approval capture: separate REFERENCE from NOTE (prose floods header, proven twice).
A7. Adopt-panel overflow (title fallback + nowrap). VERIFIED OPEN via screenshot.
A8. Cut 7-5: block unit picker -> reuse rich unit finder, multi-select.
A9. Calculator totals-on-top + Workspace net-price dash between D-lock and confirm.
A10. Cut 6a BOOKING CLOCK - nags not auto-cancel; now has real outstanding to chase.
A11. Clearance-at-the-door (deferred build, interim approval-gate shipped).
A12. MERGE to main when A1-A5 done.

## B - PRE-PROD HARDENING (the ratified plan's next phase)
B1. DATA FRESHNESS (pinned #1): stale-render class - screens show prior-fetch snapshots until
    hard refresh (blank-Dashboard specimen Day 74). Fix: refetch-on-mount + on-window-focus.
    Audit all surfaces. Bites hardest in tester week.
B2. END-TO-END TESTING ROUND (~1-2 days): fresh clean deals through the FULL ladder
    (lead->opp->proposal->nego->reserve->SPA->won->customer->commission), checking data at
    each step + report accuracy + every gate. Everything so far tested in silos.
B3. CLEAN-DATA ROUND: wipe test mess, seed fresh demo data. Reset-routine buckets in
    Decision_Log (landmines: pp_commissions, pp_launch_events, pp_agent_jobs are GLOBAL -
    never wipe). Resolves chip over-counting + owner-mismatch archaeology.
B4. NEGATIVE-TESTING workstream (banked Day 66) - app-wide round.
B5. KYC v2 minimum for prod: PRIVATE bucket + signed URLs (bucket is PUBLIC today - real
    exposure). Full KYC v2 (doc matrices, AI extraction, hard gate) lives in D.
B6. Report count-accuracy (Tasks shows 0 despite data) - verify during B2.
B7. Fieldset/lock sweep rides B2 (view-mode locks + terminal states on fresh deals).

## C - DESIGN SESSIONS OWED (design-first, then build)
C1. DASHBOARDS + REPORTS REDESIGN (dedicated session promised Day 65/67): GF-15 dashboards
    "lists not analytics" -> charts/trends/actionables; GF-16 reports need date-range,
    saved-report presets; GF-20 no calendar view (meetings/site visits/reminders).
    Dashboard_Redesign_Spec.md exists as input.
C2. SPA v2 TWO-FACES ("horse-rider", Day 70): compact tabular ceremony face + full ledger
    face; folds in Stage-5-v4 Price Journey card (asking->offer->negotiated->final trail -
    engine DELIVERED Day 66 via V_latest prefill, the display card never built) + deduction
    display polish + GF-11 all-received computable amounts.
C3. MONEY SMALLS (one cut): waived-with-date guard, gross-vs-net commission display check,
    offer_valid_until surfacing + nag, GF-13 residuals (stray 0 / invoice panel zeros).
C4. SETTINGS CONSOLIDATION + App.jsx shadow sweep items 3-6 (auth screens, UserManagement
    wrapper, ChangePassword, SettingsTab migration) + the 9 shadow-component collisions
    (Day-61 sweep, documented untouched) + two OpportunityDetail render sites check.
C5. OPERATOR/SUPERADMIN DASHBOARD (Day 52 promise): users search/filter/pagination at scale,
    company filter, operator console surface.
C6. INTELLIGENCE LAYER design session (Day 52): Customer-360 AI + Employee-360 AI (dossier,
    strengths/weaknesses, coach vs manager-eye views) + org-chart person-click -> Employee-360.
C7. LEAD->ACCOUNT MODEL + CANONICAL IDENTITY (Day 48 stickies): Salesforce-pattern
    lead-to-account conversion; govt-ID as canonical person key; AI dup-leads report + merge
    tool; per-company email uniqueness. Pairs with C8.
C8. PROPPULSE DEDUP dedicated session (Decision_Log: "biggest data risk").
C9. QUOTE/PROPOSAL PATH B naming alignment (code says quote, data says proposal).
C10. LEGACY EXCEL INTAKE pipeline (designed Day 48, never built) - broker onboarding needs it.
C11. SYSTEMIC isStale() HELPER (Decision_Log "Monday post-tester") - may merge into B1
     freshness work; decide during B1 design.
C12. OPP LIST PRICE COLUMNS (Backlog doc): Budget + Current Price + Final side-by-side on the
     opp list. Small; partially overlapped by Day-65 total-value pill. VERIFIED OPEN.

## D - POST-TESTER / PHASE 2
D1. DEVELOPER PERSONA module (founder signal, loud): developer-as-user, approval flows in-app.
    Stage-3 discount-authority wiring (discount_authority_pct from MA checked at discount time)
    WAITS FOR THIS - founder ruling Day 75, not pending elsewhere.
D2. Identity-model split (Architecture_Multi_Tenant_Identity_Model.md) - operator vs tenant.
D3. Communications overhaul (Phase_2_Communications_Overhaul.md) - email/WhatsApp/sequences.
D4. State management + realtime sync (Phase_2 doc) - supersedes/absorbs B1 pattern long-term.
D5. Manager dashboard v2 + team views; commission PAYABLES/earnings views (own + team).
D6. Leasing vertical resume (parked module) + leasing queue.
D7. PM/maintenance module arc.
D8. Roles arc: configurable roles UI (permission_sets machinery live), viewer role,
    Executive/BI + group rollups (multi-company consolidation).
D9. Full KYC v2: doc matrices per party type, AI extraction, hard gate at govt line,
    expiry tracking.
D10. Stage 7 Doomed-Opp detection + Stage 8 Document Fees (specs captured 11 May).
D11. Rename decision (PropCRM name) + branding pass.
D12. Handover-change audit trail; Upfront-merge decision; chips deep-link wiring (lead-KYC);
     PDF hero-image CORS proxy; forgot-password own-domain sender; shortlist-engagement
     tracking (architect homework Day 65).
D13. AI Coach phase 2 (voice, deeper analytics) + AI-Extract v2 (learn from corrections).

## CLOSED THIS SWEEP (evidence attached, ghosts buried)
X1. CLEANUP_CRITICAL_MUST_DO - doc says CLOSED Day 72, orphans deleted, tree verified.
X2. Deferred_Day39 Pack button - superseded: live "Share Pack" via propertyPackBus in
    OpportunityDetail L1362. Verified by grep Day 75.
X3. CURRENT_STATUS.md - RETIRED Day 75 (dated 12 May, pre-refactor, cites dead line numbers).
    Stage-rename item superseded by Day-68 stage split. Save-Draft likely superseded by
    honest-ledger rebuild (cheap verify during B2).
X4. Stage-5-v4 core pain (SPA re-entry) - KILLED Day 66 (V_latest prefill verified live).
    Display card folded into C2.
X5. GF items resolved through Day 67 per capture doc; GF-01b/02-verify/10/11 residuals live
    inside B2/C2/C3.

## ADDED DAY 75 (A1 convergence read, founder-ratified)
A13. BLOCK PAYMENT LIFECYCLE (banked, look at END): block payments are recorded as FACTS
     (money arrived, split it) which matches practice - accounts dept clears funds BEFORE the
     broker records. But 1-to-1 sales_payments carry a LIFECYCLE (status Pending/Received/
     Bounced/Replaced, due date) and a block cheque recorded pre-clearance has no way to
     bounce today. Founder: "generally after accounts have given, they move on - but good
     point, mark it." Not a merge blocker.
