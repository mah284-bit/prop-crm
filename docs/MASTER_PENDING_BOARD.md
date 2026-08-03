> **THIS IS THE WORK LIST - what is outstanding, verified.**
> Head: `docs/PropCRM_Master_Context_and_Takeover.md` · Log: `docs/HANDOFF_CURRENT.md`
> Go-live readiness lives in `docs/Go_Live_Readiness_Register.md` - NOT duplicated here.
> Rule: nothing enters this board unverified against repo/DB. REWRITTEN, not appended.

# MASTER PENDING BOARD
Last verified against repo: 30 Jul 2026 (Day 79) - branch feature/block-ledger

## A - BLOCK VERTICAL — ✅ CLOSED (merged Day 75, tag golden-block-vertical-complete)
A1 convergence ✓ (Particulars/Bill-Collected-ToCollect/Notes) · A2 ✓ NOT A BUG (gate correct;
"manager only" was an agent session) · A3 amend — DEFERRED BY DESIGN (settled cycles are
read-only per founder ruling; amend lives in the ledger phase) · A4 ✓ probe gone with the form
rebuild · A5 ✓ text · A12 ✓ merged + tagged · A14 ✓ calculator locked after settlement.
**Still open, moved into the sections below:** A6 approval ref-vs-note · A7 adopt-panel
overflow · A8 rich unit picker · A9 calculator totals-on-top · A10 Cut 6a booking clock ·
A11 clearance-at-the-door · A13 block payment lifecycle.

## SCOPE QUESTION - RESALE (Day 79, founder to decide) - READ BEFORE PLANNING GO-TO-MARKET
The app models NEW OFF-PLAN RESIDENTIAL ONLY. Resale is a SECOND TRANSACTION TYPE: there is a
SELLER the app does not model, no Oqood, no developer payment plan (often a mortgage instead),
a different fee set (NOC, trustee, agency both sides), and a different VAT rule.
FOUNDER: "if a broker company cannot do resale, why should I buy your software? HEAVY PUSHBACK."
Most UAE brokerages transact both. Either resale ships before wide sale, or the pitch is
deliberately positioned as a primary/off-plan specialist. NOT an engineering question alone.
Doc: `Resale_Secondary_Market_Question.md` (also holds the open VAT items for the accountant).

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
B5. ✅ **CLOSED Day 82** - KYC now writes to the PRIVATE `documents` bucket and is signed on
    demand (3600s), matching Master Agreements and SPA documents. Storage keeps the PATH, not a
    URL - a signed URL expires and a stored one would rot. An upload that fails to record now
    REMOVES the file rather than leaving an orphan. Residue: 13 test files remain under
    propcrm-files/kyc/, referenced by nothing, cleared by B3. Full KYC v2 still in D.
B8. **BUYER_TYPE GAP** (founder catch Day 76): every lead has buyer_type NULL because all were
    seeded from the backend (via_app=0) - the form's required-field validation was never
    invoked. NOT a form bug; untested rather than broken.
    (a) `leads.buyer_type` is NULLABLE in DB - "required" exists only in the form. Founder
        ruling: DOUBLE PROTECTION (form validates + DB constrains). Add NOT NULL after backfill
        during B3.
    (b) ✅ **VERIFIED Day 82** - the form renders the field blank and refuses to pass until it
        is selected. Enforcement works; it had simply never been exercised.
    (c) ✅ **CORRECTED Day 82** - the matrices are NOT unpopulated. `reference_buyer_type_rules`
        holds 48 rows and the form computes required documents live from the buyer type. The
        board was wrong. What remains is EXERCISING them through a real deal - rides B2.
    (d) ✅ **FIXED Day 82** - the duplicate declaration is gone. The later one won, so the form
        had always started EMPTY while the earlier line claimed "Investor". Empty is the better
        default: it makes the broker choose.
    LESSON: backend seeding bypasses every app-level guard.
B9. DOC VERIFY (from the Day-76 index): `Architecture_TwoLayer_LiveStateAndHistory.md` and
    `Architecture_FinalProposalFirst_PhaseB.md` may be superseded by the honest ledger and the
    V_latest cascade. Read and either re-date or archive.

## ⭐ V1 SCOPE - **COMPLETE, Day 83** (list drawn Day 76)
"NO MORE DEVELOPMENT" needs a definition or it never arrives. THESE FIVE, then development
STOPS and section B opens:
  V1-1  C1  Block ledger phase - post-reservation block money (design already written)
  V1-2  C13 Block polish + Cut 6a BOOKING CLOCK (the last unbuilt block seam)
  V1-3  C4  Money smalls, one cut (waived guard, gross-vs-net, valid_until, invoice zeros)
  V1-4  B5  KYC bucket PRIVATE + signed URLs (security, not polish - real exposure today)
  V1-5  B8  buyer_type guard: form enforcement proven + DB constraint (double protection)
EVERYTHING ELSE IN C AND D IS POST-TESTER. Not worse, not forgotten - just not what stands
between here and a finished v1. Improvement is infinite; completion is a decision.

### ✅ CLOSED DAY 83 - ALL FIVE
V1-1 Block ledger .......... Days 79-82. Two-stage proportional allocator, collection dialog,
                             Money tab, statement PDF, closure roll-up, cancel ceremony. Verified
                             to the fils across three payments.
V1-2 Polish + clock ........ Day 83. The booking clock: stamped at confirm, weekend-aware, lands
                             end-of-day Dubai, four display states, swept when the list loads.
V1-3 Money smalls .......... Day 82. Offer expiry surfaced (captured for months, shown nowhere -
                             four live deals had lapsed offers and nothing said so), waive note,
                             final-price divergence notice, commission label corrected.
                             OPEN: invoice-panel zero residuals only.
V1-4 KYC private bucket .... Day 82. See B5.
V1-5 buyer_type guard ...... Day 82. See B8. Only (a), the NOT NULL constraint, remains - blocked
                             on the B3 backfill, not on building.
WHAT NOW STANDS BEFORE TESTERS is not feature work: the pre-tester list, B3 clean data, the two
walkthroughs, and the founder's open claim/confirm ruling.

## C - DESIGN SESSIONS OWED (v1 items marked above; rest is post-tester)
C0. **BLOCK AS A FIRST-CLASS DEAL** (`Block_As_Deal_Design.md`, Day 77) - the block carries the
    journey, activities, communications, next steps and money; the child opp becomes an execution
    record (unit, price, SPA, DLD, commission) worked FROM the block. Today a 700K 1-to-1 has a
    full deal life and a 5M block has status words - backwards. Includes: the three tiers of
    post-reservation change with the FORFEIT as the line, money recorded never computed, and
    developer-ready event shapes. **This supersedes C1 as the block's real scope.**
C0c. **BLOCK OWNERSHIP GOVERNANCE** (`Block_Ownership_Governance_Question.md`, Day 79) - the
    visibility ladder and owner display are SHIPPED; the reassign control is deliberately NOT
    built. Needs: COVER (temporary access, commission stays) vs REASSIGN (permanent, children
    follow, mandatory reason, outgoing owner notified), and the unresolved core - WHOSE COMMISSION
    when a block moves mid-deal. Do not build a reassign control before that rule is ruled.
C0b. **1-TO-1 FLOW SIMPLIFICATION** - merge the reservation ceremony with the ledger's birth
    (kills two dead steps), enable partial receipts with a save-progress door, and print the
    receipt: received / balance / due by. Changes the CERTIFIED money path - own cut, own test.
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
C16. ⚠️ DLD VOCABULARY SPLIT (found Day 77 during BL-2). TWO dialects: proposal side uses
     DLD_OPTIONS (buyer_pays / split_5050 / developer_pays / specific_amount); SPA-ledger side
     uses dldPayer (buyer / developer / split / negotiated). THREE partial translations exist
     (OpportunityDetail L4075 proposal->opp, L2590 opp->proposal, L1934/2591 share math) and
     ONE IS BROKEN: L4075 tests for "developer_absorbs" which is NOT a real value - the constant
     says "developer_pays" - so a developer-absorbs proposal silently maps to BUYER. Live bug in
     the money path. Also: specific_amount is unhandled in the reverse map.
     FIX: one canonical vocabulary + one mapping helper in lib. Own cut, own straight-test.
     BLOCK DECISION (Day 77): the block stores the SPA-side values - what dealBill() consumes
     and what the child opp columns hold. No third dialect.
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

## ADDED DAY 77 - BLOCK CONFIRM HAS NO IDEMPOTENCY GUARD (verified defect)
EVIDENCE: Khalid's block carries SIX children on three units - one set born 14:45 (Offer
Accepted, orphaned) and one 14:48 (Reserved, the live set linked from block_deal_units).
Confirm ran twice, three minutes apart, and nothing stopped the second birth. Founder confirms
no 1-to-1 work has happened since block development began, so the duplicates are the block
engine's own doing.
IMPACT: a double-click or a slow response duplicates the entire child set. Phantom Active opps
on already-Reserved units distort saturation counts, dashboards, and per-unit conflict checks.
FIX (V1 candidate - the vertical is otherwise shipped): Confirm must refuse when the block
already has children (or when block.status is already confirmed). Guard + a clear message.
CLEANUP: soft-close the three phantom Offer-Accepted opps on EBT-08-04/09-05/10-06 created
2026-07-25 14:45 - do it with the clean-data round, not piecemeal.
ALSO SEEN: Chen Wei New Block 2 has collection_status=open and "Reservation Amt Expected: not
set", yet all three children are already Reserved - a state the Day-76 gate now forbids. Legacy
of pre-gate data; confirm no path can still produce it.

## ADDED DAY 77 - ADOPT PANEL (partly fixed, one cosmetic mystery left)
FIXED: (1) the filter offered deals it must refuse - SPA-Signed and Closed-Lost deals appeared
as adoptable. Rule now: Active + not already in a block + stage NOT in Reserved/SPA Requirements/
SPA Signed/Closed Won/Closed Lost. (2) unit ref came from a lookup in `units`, which only holds
AVAILABLE units - so a claimed unit could never resolve and fell back to the long opp title,
which with whiteSpace:nowrap pushed the row past the dialog edge. Now joined directly:
opportunities.select(...project_units(unit_ref)). (3) row rebuilt as plain two-line block.
STILL OPEN (cosmetic, C13-a): the checkbox renders detached from its row - floating centre-right
on its own line - despite being an inline <input> immediately before the ref inside one block
div. Survived five cuts (flex fixes, label->div, plain block rebuild). NOT in this file: suspect
a GLOBAL input style or an ancestor rule. NEXT SESSION: inspect the input in DevTools Elements,
read its computed styles, find the rule. Ten minutes with the right evidence; an hour without.

## ADDED DAY 77 - FEES ARE HARD-CODED, SHOULD BE COMPANY SETTINGS (v1 candidate)
FOUNDER: "broker to broker they charge according to the govt fees they pay AND have a company
admin cost - some increase the value of the govt fees as part of their admin charges. Giving
them the freedom to set their policies" - this was designed and agreed; the constants are a
regression from that intent.
EVIDENCE: SPA fee 5250 and Oqood 4020 are HARD-CODED at OpportunityDetail L908/909 (and 4020
again at L1935). DLD 4% is hard-coded in several places. The settings columns DO exist
(companies.default_spa_fee / default_oqood_fee, pp_developers same) but:
  (a) NOTHING WRITES THEM - there is no settings UI; they can only be set by SQL.
  (b) THE READ CHAIN IS BROKEN - OpportunityDetail L737 overrides from pp_developers using
      opp.developer_id, a column that DOES NOT EXIST on opportunities. So the developer tier
      never fires and resolution silently stops at the company default (usually null) -> the
      fallback constants are what brokers actually see.
FIX: (1) settings UI for SPA fee, Oqood, DLD pct and any admin uplift, at COMPANY level;
(2) fix the developer-override chain (find the real developer link); (3) ONE resolver in lib
used by dealBill(), the 1-to-1 ledger and the block preview; (4) retire the hard-codes.
V1 CANDIDATE: a brokerage that cannot set its own fees cannot use the app honestly.

## ADDED DAY 77 - BLOCK VISIBILITY IS COMPANY-WIDE (founder observation, ruling needed)
Verified: all five block tables have RLS ON and scope correctly to the caller's company - NO
cross-tenant leak. But unlike leads/opps/activities (which also scope by see_own_data /
downline), the block policies are company-wide ONLY. So ANY agent sees EVERY block in the
company, with buyer names and money.
FOUNDER RULING (Day 77): BLOCKS FOLLOW THE SAME VISIBILITY LADDER AS 1-TO-1 DEALS.
  Agent -> own blocks only · Sales Manager -> his team · Group Sales Manager -> his territories
  (Sharjah, Dubai...) · Viewer (GM/executive) -> everything read-only · Admin/super_admin -> all.
  Maps to the existing capability tiers: see_own_data -> see_branch_data (downline) ->
  see_group_data. The Group-Sales-Manager tier needs the territory/branch structure that is
  still unbuilt (parked Day 49).
BLOCKER FOUND: block_deals HAS NO OWNER COLUMN. Only created_by - and authorship is not
ownership (an admin creating a block for an agent would make it invisible to that agent, the
same distinction opportunities solve with assigned_to vs created_by).
FIX ORDER: (1) add block_deals.assigned_to (uuid -> profiles), backfill from created_by;
(2) rewrite the five block RLS policies to mirror the opportunities policy - company scope PLUS
the capability tiers; (3) surface owner in the Workspace header and allow reassignment.
NOTE: super_admin stays wide open by design during build; stripped at pre-go-live hardening.

## ADDED DAY 78 - DLD PCT HARD-CODED ACROSS 3 FILES (systemic, own cut)
FIXED TODAY: SPA fee and Oqood now read the company policy (Settings > Buyer Fees -> feeSettings
resolver -> ledger). PROVEN LIVE: SPA 6000 set in Settings appears as Expected 6,000.
STILL HARD-CODED: DLD at 4%. Setting it to 5 in Settings changes nothing - the ledger still shows
4% (234,574.96 on a 5,864,374 deal). Sites found: OpportunityDetail L925 (the ledger), L2348
(Financials card), L3723 (property pack), L4420, L4654 (split calc), plus a hard-coded "(4%)"
LABEL at L4738 and in the DLD button header. ALSO in ProposalBuilderDialog and ReportsModule.
WHY NOT FIXED TODAY: patching one site makes surfaces DISAGREE (ledger 5%, Financials card 4%,
side by side) - worse than consistent-but-wrong. Needs one systemic cut with companyFees plumbed
into all three files, and its own straight-test across every surface.
RISK TODAY IS LOW: DLD is a UAE GOVERNMENT rate - 4% for everyone. No brokerage varies it. This
is correctness debt, not a live wound. (SPA fee was different: brokerages genuinely vary it,
which is why that one was fixed today.)
NOTE: same pattern elsewhere - property pack line 3723 does `sp.agency_fee_pct || 2` for agency
fee: setting exists, constant used as fallback, label hard-coded "(2%)".

## CLOSED DAYS 78-79 (evidence attached)
X9. **COMPANY FEE POLICY** (Day 78) - Settings > Buyer Fees writes reservation / SPA / Oqood /
    DLD-pct per company; lib/feeSettings.js resolves company setting -> fallback. SPA and Oqood
    hard-codes retired. PROVEN LIVE: SPA set to 6000 in Settings appeared as Expected 6,000 on a
    fresh deal's ledger. (DLD pct still hard-coded across 3 files - separate board item.)
X10. **BLOCK VISIBILITY LADDER** (Day 79) - block_deals.assigned_to added and backfilled; RLS
    rewritten to mirror the opportunities ladder (own / downline / group / super_admin). Four
    policies, no ALL. VERIFIED LIVE: an agent who does not own the blocks sees none; his manager
    sees them via downline. Closes the Day-77 leak. Owner shown in the Workspace header.
X11. **C0b THE COLLECTION LEDGER** (Day 79) - the ledger is BORN AT RESERVATION with the company
    fee policy FROZEN into the row; it FOLLOWS THE PROPOSAL (price-derived rows recompute, frozen
    fees and the reservation hold) from every entry point via lib/createProposal.js;
    Bill / Collected / To collect shown on the deal itself; branded RECEIPT PDF with the itemised
    balance to proceed; the deal action reads "Collect payments" while money is outstanding.
    VERIFIED LIVE end to end on a fresh specimen (Boris / DAM-14-10) including a renegotiation
    from 10-90 at 6,753,047 to 50-50 at 6,550,456.
    STILL OPEN FROM IT: the ledger stores TOTALS not payment EVENTS, so only the reservation can
    produce a receipt - see the design doc.

## KNOWN BAD SPECIMEN (Day 81) - "Fatima is buying 3 unit"
Deliberately NOT cleaned. It is the only block showing what happens when money arrives against an
UNDEFINED bill: 99,500 collected across two units, reservation_expected NEVER SET, one unit
dropped (AGR-14-10 Closed Lost) so the block reads 3 lines but 2 live, and no payment plan.
The Money tab reports this honestly - Reservation Bill AED 0 against Collected 99,500 - which is
ugly and correct. Useful as a test of whether surfaces hide a mess or show it.
TO VERIFY BEFORE GO-LIVE: no path can still produce this. The Day-74 gate should prevent a block
reaching confirmed with children Reserved and no reservation expected. This is pre-gate data, but
CONFIRM the gate holds.
WILL BE WIPED by the B3 clean-data round.

## ADDED DAY 81 - THE APP DOES NOT HANDLE "THIS RECORD NO LONGER EXISTS"
After the block wipe, an OPEN Block Workspace kept rendering a deleted block from component state -
header, tabs, money strip, and a "Reservation settled" chip on a block with AED 0 collected and no
database row at all. useFreshData refetches on focus, but a component holding a record that has
been deleted has nothing to refetch TO, so it shows the last good copy indefinitely.
RARE in normal single-user work; a TESTER with two tabs, or two users where one deletes, will hit
it. FIX SHAPE: when a refetch returns no row for the open record, close the surface and say so -
"this block no longer exists" - rather than continuing to render a ghost.
Applies to any detail surface, not just blocks.

## ADDED DAY 81 - REACT WARNING: setState DURING RENDER (BlockDealsPage -> App)
Console: "Cannot update a component (App) while rendering a different component (BlockDealsPage)."
Something calls a parent setState during BlockDealsPage's RENDER rather than in an effect or a
handler. Nothing visibly broken today, but this class of fault drops updates and produces stale
screens - the symptom we have chased repeatedly on block surfaces.
NOT chased when found (mid-test on a clean block). Locate via the React stack trace when picked up.

## MUST-SHIP CANDIDATE (Day 81 close) - THE BLOCK STOPS AT RESERVED
Everything proven on Day 80-81 ends at the RESERVATION. What comes after has never been walked for
a block: the remaining collections through to SPA, and the CLOSURE of the block - won, or dead.
FOUNDER: "we tested the Reservation only - we have to move the block to closure of the deal, or
cancel, to close the sales cycle completely."
UNANSWERED:
- Does a block HAVE a closure, or is it finished when its last child resolves? Children each walk
  their own ladder, so a block can hold one unit at SPA Signed and another dropped.
- Can a block be CANCELLED wholesale, and what happens to children already at SPA?
- Day-77 ruling "nothing auto-cancels, humans decide" applies - but there is no SURFACE for the
  human to decide on.
WHY MUST-SHIP: a broker who cannot close or cancel a block is STUCK. That is precisely the
week-one test. Unlike most of today's captures, this one blocks work rather than annoying it.
ORDER AGREED WITH FOUNDER: the remaining payments and the closure FIRST, then the board split -
the sales cycle should be complete before deciding what ships.

## CORRECTED DAY 82 - LOSS REASONS DO EXIST (the entry below was WRONG)
The architect boarded this without checking the app. The Close-as-Lost form ALREADY captures a
mandatory Lost Reason from a picklist - Price too high / Bought elsewhere / No longer interested /
Budget constraints / Project not suitable / No response / Other - plus free notes.
WHAT MAY STILL BE MISSING, to judge during testing rather than assert now: the founder's own list
included LEGAL, FAILED NEGOTIATIONS and PAYMENT ISSUES, which the picklist does not cover and
which are not the same as "price too high" or "no response".
LESSON: check the app before boarding a gap. The original (wrong) entry is kept below so the
correction is visible rather than silently erased.

## SUPERSEDED - ORIGINAL ENTRY (WRONG)
"Closed Lost" records THAT a deal died, never WHY. Founder: "it is important to know the actual
action - buyer stopped communicating / informed as not interested / legal / failed negotiations /
payment issues / clean close." Those are five or six DIFFERENT management responses and the
reports cannot tell them apart; a manager sees a lost deal and cannot tell whether his broker was
outbid, ghosted, or blocked by a bank.
Applies to 1-to-1 deals AND to block children. Also feeds the block's derived status - a block
where every unit was lost currently derives to "cancelled", which is the ARCHITECT'S derivation,
not a founder ruling. With loss reasons captured, the block could say something truer.
FOUNDER: "will see that at the end while doing the testing." Not scheduled.

## ADDED DAY 82 - A CANCELLED BLOCK HOLDING MONEY SHOWS GREEN
Proven live on Block Test 3: both units lost, block derived to cancelled, units correctly freed.
But the Money tab reads "Total AED 0 - Collected AED 30,000 - Nil (tick)" IN GREEN, because with
no units left the bill is zero and the arithmetic says nothing is owed. Meanwhile 30,000 of the
buyer's money sits unreconciled.
WHAT IT SHOULD SAY: cancelled, AED X received and unreconciled - refund, forfeit or transfer still
to be recorded.
THE RULING NOT YET TAKEN (this is the "developer forfeits" case from the Day-77 three tiers):
when a block dies with money collected, what does the broker RECORD - refund to buyer, forfeit to
developer, transfer to another deal? The app must not decide; the developer decides and the broker
records. But the screen must stop showing green over an open obligation.
Founder deferred the ruling on Day 82: "I am not raising any point here, for now proceed."

## ADDED DAY 82 - DROP CLEARS block_deal_id, SO THE ROLL-UP NEVER SEES THE CHILD
The calculator's DROP sets the child to Closed Lost AND clears its block_deal_id, so the child
leaves the block entirely. rollUpBlockStatus reads children BY block_deal_id - so after dropping
every unit a block has zero children, the roll-up returns early, and the status never derives to
cancelled. The block sits "confirmed" forever with nothing in it.
(This is why the Day-82 roll-up test only worked when children were closed from Opportunities,
where block_deal_id stayed intact.)
TWO WAYS TO SETTLE IT, not yet ruled:
 (a) DROP keeps block_deal_id and relies on stage = Closed Lost - the block remembers what it
     lost, which is better for history and lets the roll-up work.
 (b) DROP keeps clearing it, and the block's status is settled explicitly by whatever performs
     the drop.
LEANING (a): a block that forgets a unit it once held cannot tell the story of what happened.
DETACH is different and correctly clears it - the deal genuinely leaves to stand alone.

## RULING (Day 82) - MONEY ON A CANCELLED BLOCK IS RECORDED, NEVER COMPUTED
Founder: "money depends on so many factors - at what level, and what the law says and they have to
follow. It is not as easy as we cancelled it in the app. If only the reservation is collected it
will be the developer's policy that matters."
So the app must NOT decide refund vs forfeit vs transfer. It varies by law, by developer policy,
and by how far the deal had gone. THE FIX IS THEREFORE SMALL: the screen must stop showing "Nil"
in green over money that is still unreconciled, and must offer a place to RECORD what was decided
- refunded / forfeited / transferred - with a reason and a date. Three words and a note. No logic,
no calculation, no rules engine.

## ADDED DAY 82 - KYC STATUS IS INDEPENDENT OF KYC EVIDENCE
The dialog lets a broker set "Docs Collected" or "Verified" with ZERO documents uploaded - status
and evidence are separate fields with nothing tying them together. If the SPA gate checks
kyc_status rather than the documents themselves, the gate is checking a CLAIM, not evidence.
ALSO: on Lead Detail, KYC renders as a status LABEL among other chips ("KYC: Not started") with a
small pencil. Nothing invites the broker to act on it - and the developer asks for KYC AT
RESERVATION, not at SPA, so a broker who meets it first as a gate weeks later is being told late.
Founder: "before the 360 view it looks like a button would be more prominent."
BOTH ARE TESTER QUESTIONS, not blockers. Let them come back with it.

## V1 STATUS — VERIFIED AGAINST THE CODE, DAY 82
V1-1 Block ledger phase ....... DONE (Days 79-82: allocator, collection dialog, Money tab,
                                statement PDF, closure roll-up, cancel ceremony)
V1-2 Block polish + clock ..... PART. Polish done. The Cut-6a BOOKING CLOCK is NOT built.
V1-3 Money smalls ............. NOT DONE (waived guard, gross-vs-net, valid_until, invoice zeros)
V1-4 KYC private bucket ....... DONE Day 82 (documents bucket + signed URLs + orphan prevention)
V1-5 buyer_type guard ......... DONE except (a). (b) form enforcement VERIFIED live - the form
                                renders blank and refuses to pass until selected. (c) matrices are
                                POPULATED - reference_buyer_type_rules holds 48 rows, not empty as
                                the board claimed. (d) duplicate buyer_intent declaration removed.
                                (a) NOT NULL constraint is BLOCKED until B3 backfills 12 NULL rows.
REMAINING TO v1: the booking clock, and the money smalls. One and a half items.
⚠️ LESSON: FOUR board entries today described code that had since changed - loss reasons, the drop
ceremony, buyer-type matrices, form enforcement. The board grows stale faster than it grows long.
Verify against the code before treating an entry as work.

## ADDED DAY 82 - MANDATORY REASONS ARE BEING SATISFIED WITH NOISE
One deal (Sara / SHI-14-10) carries THREE "KYC gate OVERRIDE at SPA Requirements - reason: ok"
entries inside twenty minutes. Another carried six, with reasons "asdf", "as", "ok". The gate asks
for a reason, accepts anything, and lets the deal through.
A required field that accepts any characters is not a gate; it is a speed bump with an audit trail
of nonsense. The same shape applies to the shortfall accept and the block cancel.
DO NOT TIGHTEN YET - this is a TESTER question. Whether brokers do this because the gate is wrong
(asking at the wrong moment, for something they cannot supply yet) or because they are rushing
tells you which fix is right. Tightening first would hide the signal.

## NOTED DAY 82 (not scoped, not scheduled) - INVENTORY OWNERSHIP
`project_units` is GLOBAL PropPulse data today - shared, tenant-unowned, a catalogue a broker READS.
A developer module would make some of it AUTHORITATIVE and OWNED: which units may be sold, by whom,
at what price, held how long, released to which broker. Those two models must be reconciled before
either is extended. Recorded because it is a fact about TODAY'S architecture, not a future design.
Founder's wider developer-side thinking (real approval workflows, document signing, handover as a
ceremony with defects and corrections) was expressed in conversation and deliberately NOT written up
- leasing and release come first.

## ADDED DAY 83 - THE CLOCK MAY BE AN OUTSTANDING-BALANCE FEATURE, NOT A RESERVATION ONE
The booking clock as built covers the RESERVATION: the units are held N days and released if it is
not collected. Founder's observation: "the rest of the cash also has to have this - cannot wait
forever, same rule applies." Money outstanding after the reservation - first instalment, fees -
cannot sit indefinitely either, and while a balance stands it should keep flashing.
IF THAT IS RIGHT, the clock is really an OUTSTANDING-BALANCE feature and the reservation is simply
its first instance: "units held until X" while the reservation is open, then "AED Y outstanding
since Z" once it is not.
DELIBERATELY NOT DESIGNED YET - founder: "let the SPA tests happen, then we come back to this."
The answer should come from walking a deal, not from a whiteboard.
ALSO NOTED: the unit picker on block creation is a plain dropdown with no search. Fine at 8 units,
unusable at 200.

## OPEN RULING (Day 83) - WHEN IS A UNIT ACTUALLY CLAIMED, AND WHEN MAY A BLOCK CONFIRM?
FOUNDER'S CATCH: units are only set to Booked at CONFIRM. Between creation and confirm - the
calculator, developer approval, negotiation, which can take days - the units are NOT claimed. The
Day-74 design calls them "soft claims" and warns on collision, but warn-only means the loss still
happens: another broker takes one, and this block's owner finds out at confirm.
TWO CANDIDATE FIXES, both with costs:
 (a) BOOK AT CREATION. Closes the window. But a broker could then hold ten units by STARTING a
     block and never confirming - the freeze-the-book abuse, moved earlier. If taken, THE CLOCK
     MUST START AT CREATION TOO: an unconfirmed block does not make the hold free.
 (b) DO NOT CONFIRM UNTIL THE RESERVATION IS PAID. Founder: "the rule of law in the app will be do
     not confirm till the buyer comes and pays money to reserve during confirm." This is the
     STRONGER rule - it makes the clock almost unnecessary, because nothing is held on a promise.
     Cost: the app currently births children AT confirm, so nothing exists to collect against until
     after it. The sequence would have to change.
FOUNDER'S CONTEXT: "there is nothing permanent, it is sharp and keeps moving. If the buyer requests
more time - because it is a block, stakes are high and it might need time." So whatever is chosen
must accommodate a legitimate extension, not just punish delay.
FOUNDER DEFERRED: "let me think through clearly and come back on it." NOT BUILT EITHER WAY.

## ADDED DAY 83 - THE REVENUE REPORT COMPUTES COMMISSION AT A FLAT 4%
`ReportsModule.jsx:373` - `const comm = o.final_price * 0.04` - for EVERY won deal, regardless of
what was actually agreed with that developer.
The app already models the truth: `pp_commissions` is a RATE CARD (developer, project, rate_pct,
bonus_pct, valid_from/until, registered_broker_only). Emaar may pay 3% on one project and 5% on
another; the report says 4% for all of them. That is not a display inconsistency - it is REVENUE
reported on a number nobody agreed to.
WHY IT IS NOT A ONE-LINE FIX: there is no table of commission EARNED per deal. The report
recomputes because there is nothing to sum. The proper fix joins each won deal to its project's
rate card - and that raises questions only the founder can answer:
 - What is shown when a project has NO rate card? Zero, blank, or a flagged estimate?
 - What when the card EXPIRED before the deal closed - the card at closing date, or the latest?
 - `registered_broker_only` - does it change the rate, or the eligibility?
 - Does BONUS_PCT belong in the headline figure or beside it?
NEEDS ITS OWN CUT. Do not fold into a fee-consistency pass.

## ⭐ THE PRE-TESTER LINE (drawn Day 83, founder-agreed)
FOUNDER: "testers is when I call them - let us complete it so we do not have to call them twice
for the same, just the delta." Correct: testers are limited goodwill, not a limitless resource.
BUT "complete" needed a definition or it moves again. TWO READINGS:
 (a) Clear the whole board including sections B and C - that is weeks, and section D was always
     post-tester by design.
 (b) Clear what a TESTER WOULD ENCOUNTER. Taken.
SOME BOARD ITEMS EXIST TO BE ANSWERED **BY** TESTING and must NOT be pre-built: whether the
mandatory-reason gates are being satisfied with noise because they ask at the wrong moment, whether
KYC belongs earlier in the journey, whether the booking clock should cover post-reservation money.
Building an answer before the evidence arrives is guessing.

### PRE-TESTER LIST (finite, in order)
1. Invoice-panel zero residuals (last C4 item)
2. The flat-4% revenue report - it should read the invoice's own commission_net
3. `commission_net` holds GROSS + VAT - board the naming, correct the DISPLAYS
4. Show the master agreement on the invoice document (the lookup now works; nothing renders it)
5. Cancelled block holding money reads "Nil" in green over unreconciled money
6. Stale-record ghost - a deleted record keeps rendering from component state
7. Unit picker needs search (unusable past ~20 units)
8. Nudge for open developer questions - nothing tells the broker one is due
9. Adopt panel checkbox alignment (cosmetic, has resisted five attempts)
THEN: the founder's claim/confirm ruling · B3 clean data (unblocks buyer_type NOT NULL) · the two
walkthroughs · THEN call the testers.

## ADDED DAY 83 - THE OPPORTUNITY LIST DOES NOT SHOW WHICH DEALS ARE BLOCK CHILDREN
A block child and a standalone deal look identical in the list, yet they behave differently: the
child's terms are locked at the block, its what's-next line is suppressed, and its money flows
through the block ledger. A broker opening one and expecting normal controls will be confused -
the founder confused himself while picking a deal to test on.
Cheap: a chip on the row. block_deal_id is already on the opportunity.
PRE-TESTER LIST - this is the kind of thing a tester hits in the first hour.

## ADDED DAY 83 - THE PROPOSAL PDF DOES NOT STATE THE DLD ARRANGEMENT
The generated proposal shows asking price, discount, final price and payment plan - and NOT who
pays the DLD fee. On a 611,220 deal that is 24,449 the buyer is bound by and cannot see on the
document he is sent. The builder captures it; the PDF prints nothing.
FOUNDER NOTE: the proposal PDF was built fast during the hero-docs push and "deviated - lost about
it, moved away, not documented." Worth reading generateProposalPDF.js against what the builder
captures - DLD may not be the only term collected and never printed.
ALSO: the DLD arrangement is not on the opportunity HEADER either, only in the Money panel, so a
broker on the phone cannot see a money term he is being asked about.

## ADDED DAY 83 - SENDING A PROPOSAL TAKES 15-20 SECONDS
Long enough that a broker clicks again thinking it failed. Likely PDF generation plus storage
upload happening inline before the dialog closes. Check whether the upload can follow the DB write
rather than block it, and whether a double-submit guard exists - without one, an impatient second
click may create two versions.

## CLOSED DAY 83 - C16 DLD VOCABULARY: THE LIVE MONEY BUG IS FIXED
Two sites tested for 'developer_absorbs', which is NOT a value in DLD_OPTIONS - the constant is
'developer_pays', labelled "Developer absorbs full DLD". The test never matched, so a proposal
where the DEVELOPER absorbs the DLD fell through and billed the BUYER, both on the document sent
to him and in the deal's ledger. On a 5.8M deal that is 234,575 wrongly charged.
PROVEN LIVE after the fix: proposal 'developer_pays' now sets the deal to 'developer'. Before, it
set 'buyer'.
⚠️ THE ENTRY THAT FOUND THIS WAS WRITTEN ON DAY 77 AND SAT UNREAD FOR SIX DAYS. The board was
being appended to and never read back. That is the argument for the audit, not for more building.
