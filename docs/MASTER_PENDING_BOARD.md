> **THIS IS THE WORK LIST - what is outstanding, verified.**
> Head: `docs/PropCRM_Master_Context_and_Takeover.md` · Log: `docs/HANDOFF_CURRENT.md`
> Go-live readiness lives in `docs/Go_Live_Readiness_Register.md` - NOT duplicated here.
> Rule: nothing enters this board unverified against repo/DB. REWRITTEN, not appended.

# MASTER PENDING BOARD
Last verified against repo: 4 Aug 2026 (Day 84) - main @ 16200de. FULL AUDIT done Day 84:
every entry checked against the CODE. V1 CLOSED Day 83, so section B is now OPEN - B3 clean data,
then B2 end-to-end. That is the current front.

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
    (a) ✅ **CLOSED Day 85** - NOT NULL applied after the B3 wipe left the table empty. It was
        blocked not by Al Mansoori's backfill but by THREE null rows in another TEST tenant
        (Emirates Premium Realty) - the constraint is database-wide, so one tenant's gap blocks
        every tenant. Those were cleared; no real client data was touched.
        ORIGINAL: `leads.buyer_type` is NULLABLE in DB - "required" exists only in the form. Founder
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
C0. ⚠️ **PART BUILT Days 77-83** - the block now carries ACTIVITIES (with its own
    block_deal_id on activities, and an RLS branch so they are readable), DEVELOPER QUESTIONS,
    the full MONEY phase, CLOSURE by roll-up and a CANCEL ceremony. STILL MISSING: the journey
    and next-steps - the founder's "go there do it, come here do this, move there do this".
    ORIGINAL: **BLOCK AS A FIRST-CLASS DEAL** (`Block_As_Deal_Design.md`, Day 77) - the block carries the
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
C0b. ⚠️ **SUPERSEDED BY A FOUNDER RULING (Day 77)** - do NOT build this as written. The ruling
     was the opposite: "DO NOT merge the reservation ceremony with the ledger. The reservation is
     a CEREMONY; the ledger is an INSTRUMENT." The receipt half WAS built (Day 79,
     generateReceiptPDF.js - received / balance / expiry / branded). Kept so the reversal is
     visible rather than silently erased. ORIGINAL TEXT: **1-TO-1 FLOW SIMPLIFICATION** - merge the reservation ceremony with the ledger's birth
    (kills two dead steps), enable partial receipts with a save-progress door, and print the
    receipt: received / balance / due by. Changes the CERTIFIED money path - own cut, own test.
C1. ✅ **CLOSED Days 79-82** - see V1-1. ORIGINAL: **BLOCK LEDGER PHASE** - post-reservation block money (instalments, DLD, SPA fees across N
    children) using the 1-to-1 ledger grammar at block level. Design of record already written:
    `Block_Ledger_Phase_Design.md` (BL-1..BL-4). Founder ruling: reuse the known screen, invent
    no dialect. **This is the nearest-term design item.**
C2. DASHBOARDS + REPORTS REDESIGN: dashboards are "lists not analytics" -> charts/trends/
    actionables; reports need date-range + saved presets; no calendar view for scheduled
    activities. Input: `Dashboard_Redesign_Spec.md`.
C3. SPA v2 TWO-FACES ("horse-rider"): compact ceremony face + full ledger face. Folds in the
    Price Journey card (engine shipped Day 66, display never built), deduction-display polish,
    computable all-received amounts.
C4. ⚠️ **THREE OF FOUR CLOSED Day 82** - waived guard (an optional who-and-why prompt, not a
    ceremony: the DEVELOPER waives, the broker records) · gross-vs-net (the label said "Net
    commission" over commission PLUS VAT, which is what the developer is invoiced, not what the
    brokerage keeps) · offer_valid_until (captured for months, displayed NOWHERE - four live deals
    carried offers expired 4-12 days with nothing saying so).
    STILL OPEN: invoice-panel zero residuals.
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
     ✅ Cut 6a BOOKING CLOCK - BUILT Day 83. Note the board said "nags, never auto-cancels";
     the founder ruled otherwise and correctly: the hold RELEASES automatically, because that is
     the DEVELOPER'S rule taking effect, not the app deciding. The DEAL survives; only the
     inventory hold ends. · clearance-at-the-door · block payment
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

## ✅ CLOSED DAY 82 - BLOCK CONFIRM IDEMPOTENCY GUARD
Built Day 77, PROVEN Day 82: a second Confirm on Block Test 1 was refused and no duplicate
children were born. The guard reads the children FRESH from the database rather than trusting the
page's in-memory copy - which was the original cause. THE UI STILL LOOKS STALE after a refusal
(status and button do not refresh), which invites a third press. Boarded separately.
ORIGINAL ENTRY: **BLOCK CONFIRM HAS NO IDEMPOTENCY GUARD**
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

## ✅ CLOSED DAY 78 - FEES ARE COMPANY SETTINGS
`src/lib/feeSettings.js` resolves company setting then fallback; `companies.default_reservation_fee`
and `default_dld_pct` added; Buyer Fees section shipped in Settings. PROVEN: SPA fee set to 6,000
appeared as Expected 6,000 on a fresh deal's ledger. ⚠️ Day 83 found the setting was only HALF
honoured - ten display sites still had the numbers typed in, one showing an SPA fee of 5,250 while
the Money tab read 6,000 on the SAME DEAL. Now all read one source.
ORIGINAL: **FEES ARE HARD-CODED, SHOULD BE COMPANY SETTINGS**
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

## ✅ CLOSED DAY 79 - BLOCK VISIBILITY LADDER
`block_deals.assigned_to` added and backfilled; RLS rewritten to the full ladder (group / branch
downline / own). VERIFIED LIVE: an agent sees no blocks he does not own; his manager sees them via
downline. TRAP BANKED: an `ALL` policy alongside a restrictive SELECT DEFEATS it - Postgres RLS is
permissive, so the policies OR together. ⚠️ Day 83 found the sibling bug: block CREATION then
failed RLS because the insert never set an owner, making a new block invisible to its own creator.
ORIGINAL: **BLOCK VISIBILITY IS COMPANY-WIDE**
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

## ✅ CLOSED DAY 83 - DLD PCT HARD-CODED (and it was worse than three files)
The board said three files. It was TEN SITES across three files, plus an SPA fee of 5,250 and an
Oqood of 4,020 typed inline - and the PROPOSAL BUILDER computed its own DLD rate, so a document
sent to a buyer could state a rate the app would not then bill. All now read one resolver:
frozen policy where the deal has one, company setting otherwise, declared fallback last.
ORIGINAL: **DLD PCT HARD-CODED ACROSS 3 FILES**
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

## ═══ BOARD AUDIT — DAY 83 ═══
The founder called this: read the board and mark it, rather than keep appending to it. Every
entry checked against the CODE, not against memory.

RESULT: of the entries audited, **five described work already done** - loss reasons, the drop
ceremony, the buyer-type matrices, form enforcement, and KYC on Lead Detail. Two more had been
half-fixed and never marked. The board was carrying ghosts, which is precisely why the list FELT
like it only grew: nothing ever left it.

⚠️ AND ONE ENTRY WAS A LIVE MONEY BUG THAT HAD SAT UNREAD FOR SIX DAYS.
C16, written Day 77: two sites tested for a DLD value that does not exist in the picklist. A
proposal where the DEVELOPER absorbs the DLD silently billed the BUYER - on the document sent to
him and in the deal's ledger. On a 5.8M deal, 234,575 AED wrongly charged. Fixed and proven live
Day 83. It was found by READING the board, not by building.

**THE RULE THAT FOLLOWS: read the board BEFORE starting work, not after finishing it.**
An entry written and never read back is worse than no entry - it creates the belief that something
is being tracked while nothing is watching it.

SUGGESTED CADENCE: a full audit pass at the start of any week, and a re-read of the dated
additions before choosing what to build. Both are cheap. This one took under two hours and found
more than a day of building would have.

## ADDED DAY 84 - WHO SEES THE BROKERAGE'S COMMISSION? (company setting, not a product decision)
STATE TODAY, and it is now INCONSISTENT: the "Commission Outstanding" nav item was gated to
manager-and-above (Day 84) while the COMMISSION INVOICE PANEL on the deal page is still visible to
the owning agent. The same number is hidden in one place and shown in another.
FOUNDER: it was left visible deliberately - "we had kept it as viewable and want to keep it that
way, but it is a bit controversial, and we should think how to handle this, probably through the
company setting." That later never came. It is now.
WHY IT IS A SETTING AND NOT A RULING: this is a CULTURE decision, not a product one.
 FOR showing it: the agent closed the deal; seeing what it earned is motivating, and hiding it
 looks like the firm has something to conceal.
 AGAINST: an agent who knows the brokerage bills 64,786 on his sale may resent his split, quote it
 to a buyer, or carry it to a competitor as leverage.
Different brokerages feel genuinely differently about this and neither is wrong. So:
 SETTING: "Show brokerage commission to agents" - DEFAULT ON, because that is today's behaviour
 and flipping it silently would surprise the founder's own tenant.
 WHEN BUILT: the nav gate and the deal panel must read the SAME setting. Today they disagree.
SEPARATE AND PROBABLY YES: should an agent see HIS OWN commission - what he earns after the split?
That is a different number from the brokerage's invoice. `pp_commission_invoices` already carries
agent_commission, agent_split_mode and company_net, so the data exists.

## ADDED DAY 84 - THE REVENUE REPORT SHOWS "NOT INVOICED" ON DEALS THAT ARE INVOICED
The report was rebuilt to read pp_commission_invoices instead of computing commission at a flat 4%
(and the fabricated "Realization Rate 95%" was removed). The STRUCTURE is right - Developer column,
Invoiced / Received, blocks in their own section, Not-Invoiced count.
BUT both won deals show "not invoiced" while SQL confirms each HAS an invoice.
RULED OUT: the fetch exists in loadData's Promise.all; loadData IS called from a useEffect; RLS
should pass for a sales_manager (can_see_brokerage_commission() allows the role, and the capability
is granted to sales_manager); Arun's profile row is correct.
NOT YET CHECKED: whether the request actually fires, and what it returns. safe() swallows the error
so nothing surfaces. LESSON: the defensive `safe()` wrapper is what hid this - it turns a failure
into silence.
NEXT STEP FOR WHOEVER PICKS THIS UP: Network tab filtered to `pp_commission`, hard refresh, open
Reports. Status and body settle it in one look. Do not theorise further - four theories were wrong.

## ADDED DAY 84 - HISTORIC DEALS CARRY THE WRONG COMMISSION RATE (founder ruling needed)
Fixed forward on Day 84: all four creation doors now resolve the agreed rate. But every deal
created BEFORE that carries the company default instead - 4% where Aldar agreed 4.5% and DAMAC 5%.
Some already have invoices raised against the wrong figure.
Correcting them is a BUSINESS decision, not a code one: re-issuing an invoice to a developer at a
higher rate is a conversation with that developer, not a database update. The app should not decide
it. Two candidate positions, founder to rule: (a) correct only invoices still in DRAFT and leave
issued ones as history, or (b) leave all of it and start clean from the fix.
NOTE: this is test data today, so the immediate exposure is nil - but the same query is the
GO-LIVE CHECK for any tenant onboarded before Day 84.

## ADDED DAY 84 - THE UNIT PICKER SHOULD BE SHARED, AND IT CARRIES DOCTRINE
CreateOpportunityDialog has a RICH picker: search across ref / project / bedrooms / view, project
pills, bedroom pills, show-reserved toggle, result counts, price on every row for budget matching,
and a Property Pack button.
It also carries the CLAIM LADDER: a BOOKED-BY-BLOCK unit is HARD-REFUSED with an explanation of
when it releases; a Reserved/Sold unit warns about double-booking before it can be chosen.
Block creation and the calculator use a PLAIN DROPDOWN - unusable past ~20 units, and every
brokerage has hundreds.
⚠️ DO NOT LIFT IT WHOLESALE. The conflict rules were written for 1-TO-1 selection: "Booked by a
block" means something different when you are BUILDING that block. Extraction needs a parameter -
picking FOR A DEAL vs picking FOR A BLOCK - or the block form will refuse units for reasons that
do not apply to it. That makes this a DESIGNED cut, not a mechanical one.
A plain text filter was tried on Day 84 and REVERTED: a box labelled "Filter..." tells a broker
nothing about what it matches, and a half-good filter is worse than none.


## ADDED DAY 85 - SIX TEST TENANTS SIT IN THE PRODUCTION DATABASE
companies holds: Emirates Premium Realty, Sole Broker Test, Gulf Leasing Solutions, Default
Company, Test Brokerage Z, Test Company - 16-06-2026 - alongside Al Mansoori Properties.
None hold real client data. A production database should not carry "Test Brokerage Z", and a
super-admin company list full of test rows looks unfinished to anyone being shown the product.
GO-LIVE CLEANUP, not urgent - but check for FK children before deleting any of them.

## ADDED DAY 85 - FOUND WHILE SEEDING (B3 walkthrough)
1. ⚠️ PROMOTED QUOTE CARRIES NO TERMS. A quote pushed to an opportunity creates V1 with plan and
   DLD BLANK - the deal row reads "Plan - / DLD -". Founder had understood promotion "picks the
   standards and applies"; it does not. Same shape as the Day-81 block-confirm bug: BIRTH NOT
   CARRYING TERMS. Everything downstream then computes from nothing.
2. VIEW QUOTES has no counter. A broker cannot see how many quotes he has sent without opening
   Activity - so he sends duplicates.
3. SEND QUOTE should confirm the selected unit (ref is enough) before sending, and show the
   payment terms it will use.
4. The quote PDF says "To be discussed" for plan and DLD. If promotion applies standards, the
   quote should SHOW those standards rather than a blank.
5. LEAD CREATION could use a REFERENCE field (the firm's own number for this contact).

## ADDED DAY 85 - THE PIECES DO NOT MARRY, AND THE COACH CANNOT SEE MOST OF THEM
FOUNDER'S WORRY, and it is well-founded: "this whole thing is not marrying, it is loose - somewhere
a broker sees a deal and takes a call whether the buyer is SERIOUSLY INTERESTED OR JUST PLAYING."
That judgement lives ACROSS the pieces: three rounds of asks with no movement on price, two
developer questions unanswered, a proposal sent eleven days ago with no reply. Any one is nothing;
together they are a verdict.
TODAY the pieces are sound but SEPARATE. Negotiations record asks. Proposals record offers.
Developer questions record what was asked of the developer. Activities record calls. All hang off
opportunity_id in the database - so this is a PRESENTATION gap, not a data one. But presentation is
what gets shown to a brokerage, so the gap is real where it matters.
⚠️ AND THE COACH CANNOT HELP: buildContext(leads, units, projects, salePricing, leasePricing,
activities, currentUser) - it is given NO proposals, NO negotiation rounds, NO developer questions.
It advises without the story, which is why it reads thin. Widening buildContext is a small change;
the data is one join away.
TWO PIECES OF WORK, in this order:
 1. ASKS vs OUTCOMES - a table showing what was asked across all rounds and what was actually
    granted. Derivable today: asks from each round's ticked boxes, outcomes from comparing proposal
    versions. "DLD help asked twice, never granted" is the kind of line a broker needs before his
    next call with the developer.
 2. THE DEAL STORY - one surface assembling rounds, proposals, questions and activities in order,
    so the buyer can be READ rather than reconstructed from four tabs.
DELIBERATELY NOT DESIGNED YET: finish the six-deal walkthrough first. It will show where the seams
are worst, and the design will be better for having watched all six than one.

## ADDED DAY 85 - THE 1-TO-1 HAS NO PAYMENT ALLOCATOR (blocks do)
A broker holding a 35,500 transfer statement must work out by hand which of seven rows it covers.
The BLOCK vertical solved this on Day 80: one amount in, allocated proportionally across
particulars and units, broker never chooses. The simpler case still has none.
SHAPE: record the payment as a FACT first (amount, date, reference), then allocate - with a
proportional split SUGGESTED and overridable. Suggested, not dictated: on a block the split is
arithmetic; here the developer may say "this clears the DLD and Oqood", and the broker records
what he was told.

## ADDED DAY 85 - NOTHING FLAGS DEVELOPER SILENCE, AND THE BROKER CARRIES THE LOSS
FOUNDER: "if tomorrow the developer stops the process and does not inform the broker, the deal
slips - who is at loss?" The broker. The developer has his money either way; the broker's
commission depends on completion and he finds out last.
The app records what the broker was TOLD. It cannot see what he was not told - but it CAN see the
silence: an outstanding balance with no payment recorded for N days, on a deal that should be
moving. Same shape as the developer-questions nudge.
"Money arrived" is not a statement a broker should accept - full or partial must be established.
The app should make the unanswered question visible rather than let it sit.

## ⭐ D7 ROLES ARC - HALF BUILT, AND SMALLER THAN FEARED (sized Day 85, next major target)
FOUNDER'S TWO REQUIREMENTS, from a four-hour session that was never documented: (1) roles must be
MANAGED, not hard-coded; (2) CUSTOM roles with granted access. He remembered the requirements; the
design was lost. This entry replaces the one line D7 had carried.
✅ (1) IS DONE. `role_capabilities` holds 22 capabilities per company, and
`RoleCapabilitiesSection.jsx` is a working per-company grid - a tenant can already decide their
sales manager does not approve discounts. canDo() reads it. NOTE: `see_own_commission` exists as a
capability, which answers the Day-84 "should an agent see his own split" question - already
modelled, never surfaced.
❌ (2) IS NOT. `ROLES` is a fixed array of seven in code (RoleCapabilitiesSection.jsx line 4).
MEASURED SIZE - the database is barely hard-coded, which is the good news:
  - TWO functions name roles: can_view_master_agreements(), can_see_brokerage_commission().
    Both sit beside a has_capability() check in the policy and could simply BE that check - the
    capabilities (view_master_agreements, see_brokerage_commission) already exist and are granted.
  - THREE policies name roles: agent_pools_update, agent_pool_members_delete,
    invoices_update_same_company.
  - FRONT END is the larger half: nav items carry `roles:[...]` lists rather than capabilities,
    and the ROLES array must come from a table.
ROUGHLY A DAY. Not a rebuild.
⚠️ AND IT SOLVES THE ACCOUNTANT PROBLEM without a new role: grant a role manage_commissions +
see_brokerage_commission and nothing else. That is an accountant in everything but name.
SEQUENCE: after the walkthrough. The walk may surface capability gaps that would otherwise be
designed blind.
   D7b. RIDES THE ROLES WORK: a DRAFT commission invoice's rate cannot be corrected anywhere - not
   in CommissionOutstanding (read-only) and not on the deal. A negotiated rate missed at creation
   is discovered by the manager at the invoice and cannot be fixed. RULING: edit the PERCENTAGE,
   never a typed amount - a percentage on a known price is checkable at reconciliation, a typed
   figure is not. Draft editable with a MANDATORY REASON written to an activity (who, from, to,
   why); ISSUED frozen, corrected by credit note. THE REASON IS INTERNAL - it must never appear on
   the developer's invoice. Who may edit is `manage_commissions`, which is why this rides D7.

## ⭐ ADDED DAY 85 - SPA SIGNED HAS NO CEREMONY OF ITS OWN: IT REOPENS THE COLLECTION FORM
FOUNDER, after three days of saying it in different words: "the tab header is saying something and
doing something." Here is the root of it.
At SPA REQUIREMENTS the broker presses "Collect payments" and gets the collection form. Correct.
At SPA SIGNED he presses the stage button and gets THE SAME FORM AGAIN - the same editable money
rows, plus a document upload and a final price. So SPA Signed is collection reopened, not a
signing ceremony. CONSEQUENCES, all found on the Day-85 walkthrough:
 - To attach the signed SPA a broker must press AMEND, which unlocks the ENTIRE money record -
   on a deal whose commission invoice has already been raised on those figures.
 - The form opens in VIEW MODE and the upload area keeps its pointer cursor and its inviting
   "Click to upload" text, so it looks like the one live control on a dead form. The founder lost
   twenty minutes to it, and he built this.
 - The error "SPA document must be uploaded before closing as Won" names a requirement but not
   where to satisfy it.
WHAT SPA SIGNED SHOULD BE: signing date, SPA/Oqood reference, the signed document, final price -
and the collection shown READ-ONLY beneath as evidence, not as fields. Collection stays at SPA
Requirements, where the Save-payments button now lives.
This dissolves three findings at once. It is a real cut - splitting one form into two ceremonies -
and it should be built fresh, not at the end of a long session.

## ⭐ THE PATTERN BEHIND SIX FINDINGS: THE LABEL DOES NOT MATCH THE SURFACE
Not six bugs - one fault, six times. The words were not updated when the thing beneath them changed.
 "Money" tab -> heading reads Financials · "Record SPA Signing" -> a collection form ·
 "Save & Advance to Negotiation" -> when already AT Negotiation · "Net commission" -> gross PLUS
 VAT · "Nil check" -> on a cancelled block holding 30,000 · "SPA fee 5,250" -> total computed on
 6,000.
WHY IT MATTERS MORE THAN ANY ONE OF THEM: a broker who learns the labels lie stops reading them -
and then the warnings that DO matter get ignored too.
STANDING RULE: when a surface changes, the words above it change with it. Check the label in the
same cut, not the next one.
   AND FOLD IN THE SPA PREPARATION CHIPS. There is a real four-item checklist - docs complete,
   signature ready, buyer attends / signs remotely, SPA uploaded - rendered as a quiet dashed panel
   on the deal page, and it GATES Closed Won. The founder walked eight stages and never saw it,
   then met it as a blocker at the very end. Two faults:
    (a) WRONG PLACE. Those are preparations for the SIGNING APPOINTMENT, not conditions of closing.
        By Closed Won the SPA is signed, the money collected, the invoice raised - asking "are the
        docs complete?" is asking about an event that already happened. They belong AT SPA SIGNED,
        which is exactly the ceremony this entry says is missing.
    (b) NOTHING ASKS. A quiet panel competing with a full deal page loses. FOUNDER: "chips are
        looking good, I liked it, but it will definitely be lost in the flow of work - unless
        pushed, the broker keeps ignoring and moving. We both developed it and still ignored it."
   If an answer matters enough to gate a close, the ceremony must ASK for it.

## ADDED DAY 85 - A DRAFT BLOCK IS A TRAP: NO DELETE, NO EDIT, NO UNIT CHANGE
Found on the block walkthrough. A block in DRAFT - before confirmation, before any child is born,
before any money - cannot be deleted, its developer cannot be changed, and its unit lines cannot be
swapped or removed. The broker picks the wrong developer and is left with a permanent dead block
holding SOFT CLAIMS on those units. They accumulate, and each one blocks inventory.
⚠️ IT CONTRADICTS THE APP'S OWN LOGIC: a CONFIRMED block can be cancelled with a proper ceremony -
reason, children dropped, units freed. The DRAFT, which is the least committed state of all, has no
exit whatsoever.
FIX SHAPE: a draft block (status draft, no children born, no payments) should be DELETABLE outright
- it is not a record of anything that happened. Unit lines should be removable while draft. Whether
the developer can be changed is a smaller question: changing it invalidates every line, so the
honest answer may be "delete and start again" rather than an edit.
   AND THE HEADER'S RESERVATION FIELD IS BLANK, NOT SUGGESTED. "Reservation Amt Expected - Not set,
   click to set" asks the broker to type a number the app already knows: company standard x number
   of units (25,000 x 3 = 75,000 on the Day-85 walkthrough block). FOUNDER: "if I put it there it
   is going to be wrong - it should look around and calculate and put it."
   It should PRE-FILL and SHOW ITS WORKING ("3 units x AED 25,000 company standard"), overwritable
   when the developer demands more. On a ten-unit block, arithmetic in the broker's head against a
   half-remembered policy is where errors come from.
   AND THE DEVIATION MUST BE VISIBLE: if he overwrites it DOWNWARD, nothing says so today - the
   same gap as the reservation shortfall on a 1-to-1.
   AND THE STANDARD SHOULD BE PER DEVELOPER, NOT PER COMPANY. FOUNDER: "if he is working only with
   one developer fine - he will work with multiple. It is not good to give a memory test."
   A broker running Emaar, Aldar, DAMAC and Sobha in one week cannot hold four reservation figures
   in his head, so today he overwrites the single company default constantly and nothing knows what
   the right figure was. pp_master_agreements already holds the commission rate, discount authority
   and payment terms per developer - a reservation standard belongs beside them, resolved the same
   way as commission: agreement first, company default second.
   FOUNDER'S RULING (Day 85): ONE PLACE, COMPUTED, EDITABLE. The reservation is asked for on the
   CREATION form and again on the block HEADER - two entry points for one number, which is how they
   drift. It should be computed (units x the developer's standard), shown with its working, and
   editable in ONE place only. Remove the other.

## ADDED DAY 85 - THE CONFIRM BUTTON REMAINS ON A CONFIRMED BLOCK (stale, corrects on reload)
The header still offers "Confirm block" after confirmation until the page is reopened. The Day-77
IDEMPOTENCY GUARD does refuse a second press - it reads the children fresh - so nothing breaks, but
the control should not be there to press. Same class as the label-vs-surface pattern and the Day-82
note that the UI "looks stale after a refusal, which invites a third press".
FOUNDER: it should be greyed unless a unit is being added or removed - which is itself unbuilt for
a CONFIRMED block, and correctly so: removing a unit then means DROPPING A LIVE CHILD DEAL, which
is a ceremony, not an edit. Before confirmation the calculator already has per-line "remove".

## ⭐ ADDED DAY 85 - A BLOCK NEVER SENDS THE BUYER A PROPOSAL
FOUNDER, at the moment of confirming: "we are only running behind money here - we have not sent the
proposal to the buyer, on what basis are we asking for reservation money?"
He is right and it is a hole. On a 1-TO-1 the proposal is the spine: V1, V2, V3, change chips,
supersession, a PDF the buyer holds. On a BLOCK there is NO PROPOSAL AT ALL. The distribution is
locked, the developer approves, units are claimed, a five-day clock starts and 75,000 is demanded -
and the buyer has received NOTHING stating what he is buying, at what price, on what terms.
The block STATEMENT PDF exists but it is a statement of what is OWED, not an OFFER.
Same class as the proposal PDF omitting DLD: the buyer is bound by terms he cannot see.
⚠️ OPEN DESIGN QUESTION, founder to rule: ONE proposal covering all units - which is what the
investor actually negotiated - or ONE PER UNIT, which is what he ultimately signs? The block's own
doctrine says terms are uniform and price varies per unit, which argues for one document with a
per-unit schedule. And it should supersede like a 1-to-1 proposal does, because a block gets
renegotiated too.

## RULING (Day 85) - THE SHORTFALL TOLERANCE EXISTS FOR BANK CHARGES, AND SHOULD BE FLAT
FOUNDER, on why a small gap is not a shortfall: "whenever you get your money in corporate there are
bank charges which will be deducted - many people make noise but you have to absorb it. Accounts
have a way to adjust their books, but you cannot say received 100%."
So the tolerance is not LENIENCY, it is ACCURACY. A buyer wires 25,000, the correspondent bank
takes 75, and 24,925 lands. Nobody underpaid.
CONSEQUENCE: the tolerance should be a FLAT AED figure, not a percentage. Bank charges are roughly
fixed (50-200 AED) whether the transfer is 25,000 or 600,000 - so 1% of a 643,441 BLOCK bill waves
through 6,434, which is not a bank charge. Founder allows around 0.5% as a guide, "and even if it
is more than that, sometimes you have to find out and forgo" - which is exactly the case a HUMAN
should rule on, not a threshold.
⚠️ THIS SUPERSEDES THE DAY-80 DIVERGENCE. That ruling said a block demands approval for EVERY gap
however small while a 1-to-1 allowed 500 / 1%. Two surfaces, two rules, is a memory test for the
broker. SAME RULE BOTH SURFACES: flat AED tolerance, beyond it a manager rules with a reason.
AND THE WORDING SHOULD SAY WHAT IT MEANS: "within bank-charge tolerance", not "shortfall accepted" -
so a manager reading the record knows nothing was conceded.

## ⭐ ADDED DAY 85 - A BLOCK CHILD HAS NO CLOSURE ROW: THE TWO LEDGERS NEVER MEET
Found by walking a block child into the 1-to-1 ladder - a seam NEVER TESTED. Days 79-83 verified
every block piece in isolation (allocator to the fils, statement PDF, closure roll-up) and the
1-to-1 ladder was walked on Day 85. Nobody had walked ONE INTO THE OTHER.
ROOT CAUSE, one not two: a block child never goes through the RESERVATION CEREMONY. It is born at
Offer Accepted and roll-up moves it to Reserved when the block's reservation settles - so no
pp_sales_closures row is ever created. Consequences on AGR-08-04, live:
 - NO FROZEN FEE POLICY, so dealFees falls through to the declared constant: the deal states an SPA
   fee of 5,250 while the block's own Money tab shows 6,000 for the same unit. The panel COMPUTES
   with 5,250 too, so the bill is understated by 750.
 - NO COLLECTION LEDGER, so the bill panel sees only opp.reservation_amount. It reads "AED 25,002
   already credited" when the block has actually allocated 163,436 to this unit across four
   particulars. A broker reads: owes 203,400, paid 25,002. The truth is: owes 204,150, paid 163,436.
   BOTH WRONG, IN OPPOSITE DIRECTIONS.
⭐ ARCHITECT'S CALL: ROLL-UP SHOULD CREATE THE CLOSURE ROW, seeded from the block's terms and
frozen fees, and credited with what the block has already allocated to that child.
WHY NOT THE ALTERNATIVE - teaching every 1-to-1 money panel to also read block allocations - that
means every future money surface must handle two shapes forever, which is exactly how the DLD
vocabulary split into two dialects and stayed wrong for six days. ONE SHAPE, FED FROM TWO PATHS.
⚠️ RISK TO HANDLE: double counting. The closure row becomes the DISPLAY; block_payment_allocations
stays the AUDIT TRAIL. They must not both be summed.
   ⚠️ AND THE RULING THAT SHAPES THE FIX, founder to make: AFTER RESERVATION, DOES COLLECTION STAY
   AT BLOCK LEVEL OR MOVE PER CHILD? Both are defensible and the app currently allows both without
   either knowing about the other. On the Day-85 walk 402,415 was collected in ONE block payment
   across three children - so a child arrives at SPA Requirements already substantially paid, BY
   THE BLOCK, and has no way to know it. Whichever way this is ruled, the child must see what the
   block paid on its behalf or the broker will ask the buyer for money he has already given.
   BLOCK WALK STOPPED HERE (Day 85) - pushing a structurally incomplete child further would only
   produce symptoms of a cause already identified.

## ⭐ TWO LISTS, NOT ONE: WHAT STOPS A TESTER vs WHAT LOSES A DEMO (founder, Day 85)
"Testing is one thing - I can tell them straight, it is not there, test it as built. A DEMO I
cannot."
A TESTER can be briefed: "the unit swap is not built, ignore it." He is helping, and a known gap
costs nothing. A BROKERAGE OWNER WATCHING A DEMO asks "what if my buyer wants a different unit?"
and "not built yet" is the answer that loses the room. He is not helping - he is deciding whether
to buy.
CONSEQUENCE: the board needs TWO readings, and they overlap but are not the same.
 - WHAT STOPS A TESTER: things that block work. The block child's missing closure row. The SPA
   ceremony reopening collections. A draft block that cannot be deleted.
 - WHAT LOSES A DEMO: things a buyer will ASK ABOUT, whether or not they block anything.
   ⚠️ RESALE is the largest and it is still unanswered - "if a broker company cannot do resale, why
   should I buy your software?" (see the SCOPE QUESTION at the top of this board).
   Then: no proposal to the buyer on a block · no unit swap after confirmation · nothing is ever
   SENT from the app (proposals generate a PDF and stop; the communications table exists and
   nothing writes to it).
BEFORE ANY DEMO, read the board through the SECOND lens. The first list is what to build next; the
second is what to have an answer for.

## ADDED DAY 85 - THE SOFT-CLAIM LABEL SHOULD TELL ANOTHER BROKER WHAT HE IS WALKING INTO
A draft block holds a SOFT claim: the unit stays Available and the picker shows "(in block: X)".
FOUNDER: that names the block but does not tell the other broker what it MEANS. "Held for a block
sale" is language brokers already understand - a block takes time, the block buyer has priority,
and pushing a single deal on that unit is likely wasted effort. He would choose another unit
himself, which is the honest outcome: not refused, just informed.
⚠️ BUT IT MUST NOT OVERSTATE. "Held for a block sale" on a draft nobody has approved would freeze
inventory SOCIALLY where it cannot freeze it technically - the freeze-the-book abuse arriving by
the back door. So: "in a block being negotiated" while draft, "held for a block sale" once the
developer has approved.

## ⭐ RULING (Day 86) - MONEY ARRIVES AT BOTH LEVELS, AND THE CHILD'S LEDGER MUST SEE BOTH
The open question from Day 85 - after reservation, does collection stay at BLOCK level or move PER
CHILD - is answered: BOTH, because that is how buyers actually pay.
FOUNDER: "there are people who will say it is a limitation of the card, I will pay this, bring a
cheque or cash later - you cannot stop that. And when we are talking about a block it is a lot of
money, sometimes it comes in two instalments. That is the reason it is there."
So neither level is the "right" one. Money arrives, and it may be against the BLOCK or against ONE
UNIT. The app must record what arrived and work out what it covers.
⭐ THE FIX, SHARPENED: roll-up CREATES the child's pp_sales_closures row (seeded from the block's
terms and frozen fees, credited with what the block has already allocated). Thereafter BOTH sources
post into that one row - a block payment allocates across children and credits each child's ledger;
a child's own collection credits it directly. One ledger per child, two sources, neither blind to
the other.
⚠️ DOUBLE-COUNTING GUARD: block_payment_allocations is the AUDIT TRAIL, the closure row is the
BALANCE. Never sum both.

## ⭐ RULING (Day 86) - MONEY FLOWS FROM THE BLOCK; THE SPA IS PER CHILD; BOTH ARE ENTERED ONCE
FOUNDER: "for block payments coming in bulk, entering 1-to-1 is a pain - today we have two, really
it is fifteen. Payments have to flow through from the block."
 - MONEY: recorded at BLOCK level and allocated. Fifteen entries per payment is unusable, and the
   allocator already exists. The child's ledger (born Day 86) receives from above.
 - THE SPA: PER CHILD, and the deciding reason is not registration but the SIGNATORY. Founder's two
   cases: (1) a company buying to lease or forward-sell - one owner across every unit, SPAs
   identical in substance; (2) a father buying for his children, or a company for its employees -
   EACH SPA CARRIES A DIFFERENT OWNER. The second case makes per-child unavoidable.
   ⚠️ AND IT IS NOT MODELLED: the app assumes one buyer per deal. A block child whose OWNER differs
   from the block's buyer has nowhere to record that - the TITLE HOLDERS question (C15) arriving
   from a new direction, and now with a concrete case behind it.
 - THE CHALLENGE, and the answer: "if it is one owner, why can I not close the SPA from the block?"
   Because DLD issues ONE SPA PER UNIT - researched Day 82, each unit gets its own Oqood
   certificate and no group SPA exists as a DLD product. The app records fifteen because fifteen
   were signed. BUT THE WORK SHOULD BE DONE ONCE: a BULK SPA ENTRY that writes per-child records -
   one screen, one signing date, one reference series, fifteen rows. Same shape as the money
   allocator: enter once, distribute properly. The record stays true; the tedium goes.

## ⭐ ADDED DAY 86 - THE BUYER IS NOT ALWAYS THE OWNER (C15 arrives with a concrete case)
The app collapses two roles into one lead_id: the BUYER, who negotiates and pays, and the OWNER,
whose name goes on the SPA and the title. Usually the same person. Often not:
 - a man buys in his wife's name
 - a father buys three units for three children - THREE DIFFERENT OWNERS IN ONE BLOCK
 - a company buys for employees and deducts from salary
FOUNDER'S DESIGN, and it is better than bolting a field onto the SPA ceremony:
 1. SET THE PEOPLE UP BEFORE THE DEAL. The owner is a real person record, not a name typed at the
    SPA door.
 2. ASK AT BLOCK CREATION: "will all units be in one name?" YES - nothing changes. NO - assign an
    owner per unit line, there and then, while the arrangement is being shaped.
 3. The child deal then POINTS AT ITS OWN OWNER.
WHY CREATION AND NOT SIGNING: the broker already knows. A father buying for three children knows
their names before he confirms - not at the SPA door six weeks later. And it defuses the silent
killer: discovering at signing that unit two needs the son's name and the son has no KYC. Asked at
creation, there are WEEKS to collect documents.
⚠️ THE COST IS REAL: those names become PERSON RECORDS, because of the founder's Day-76 hard rule -
"every name on the SPA must have documents, no override, the govt line." So "assign a name" means
"create a person", not a text field. That is the honest price and it is why C15 was never small.
⚠️ NOT ALREADY BUILT: `lead_persons` exists but it is a COMMUNICATION channel - who to call - not
an ownership model. Do not mistake one for the other.
   ⭐ THE DEMO ANSWER, founder's framing and better than the architect's: "One cheque, one entry -
   we distribute it. But the SPA is per unit because DLD registers per unit, and because the OWNERS
   MAY DIFFER. The money comes from the SPONSOR; the title goes to the OWNER. Two different facts,
   both recorded." That makes it a FEATURE, not a limitation - and a challenger would have to argue
   that DLD does not register per unit, which is false (researched Day 82). SPONSOR is the right
   word: a company, a parent, a husband. Someone pays, someone owns.
   ⭐ AND WHEN SOMEONE SAYS "USE AI, AUTOMATE THE REPETITION": AI can FILL fifteen forms from one
   input - that is the bulk-entry cut. It cannot SIGN fifteen contracts, and it must not DECIDE
   whose name goes on unit three. If it guesses wrong the unit registers in the wrong name at DLD
   and unwinding that costs months.
   THE GENERAL DEFENCE: this app uses AI for SUGGESTION - proposal terms, coaching, unit matching.
   It uses DETERMINISTIC RULES for money and titles, because a wrong number or a wrong name is not
   a bad suggestion, it is a legal problem. The app is deliberately not clever where being wrong is
   expensive.

## ADDED DAY 86 - "TO COLLECT: COMPLETE" WITH THREE ITEMS PENDING
The Payment Summary nets an OVER-payment on one row against SHORTFALLS on others and declares the
collection complete. Seen live: first instalment +62,950 over, SPA fee 5,766 short, DLD 23,879
short - and the summary read "To Collect: Complete" with "Pending items: 3" directly beneath it.
Arithmetically the net is positive; practically the buyer still owes an SPA fee and a DLD share
that the developer will ask for. Another instance of the LABEL-vs-SURFACE pattern.
FIX SHAPE: "Complete" only when every row is settled or waived. Otherwise show the net AND the
count - "net +29,284 · 3 items unpaid" - so nobody reads a green word over an open obligation.

## CLARIFIED (Day 86) - SPA SIGNED IS A REAL STAGE, AND THE GATE AT CLOSED WON IS CORRECT
The architect questioned whether SPA Signed deserves its own stage. IT DOES. Founder:
 - SPA SIGNED = the BUYER has signed. That is a proof point.
 - THEN A WAIT: the countersigned document travels between the parties BY POST, not email.
 - CLOSED WON = the broker holds the EXECUTED document.
So a deal genuinely SITS at SPA Signed, for as long as the post takes. The stage exists for that
gap, and the Closed Won gate demanding the SPA document is asking the right question - "has the
executed copy arrived?" - not being over-strict as the architect suggested on Day 85.
⚠️ ONE QUESTION LEFT, and it is a money question: the COMMISSION INVOICE is created at SPA Signed,
when the buyer has signed but the document is not yet executed. IF the developer becomes liable
only on EXECUTION, the invoice is raised early and "Total Invoiced" on Commission Outstanding
overstates what is actually claimable. Founder to confirm when liability starts.

## RULING (Day 86) - A BLOCK CHILD PROCEEDS TO SPA ONLY WHEN THE WHOLE BLOCK IS COLLECTED
Not per unit. FOUNDER: "collection is one full bulk payment - how will we decipher what the payment
is for? That is the reason we have the block sales process." The allocator splits it for ACCOUNTING,
so each unit has a cost basis, but the money was never AGAINST a particular unit. "06-02 is paid" is
an artefact of the split, not a fact about what the buyer paid.
AND THE STRONGER ARGUMENT: the developer gave a bulk discount BECAUSE it is a bulk purchase. A buyer
who paid for one unit and stalled on the rest would not be entitled to the block discount at all.
The concession and the payment are the same bargain.
INTERIM POSITION for a block that goes wrong mid-way: CANCEL IT, having recorded every penny
collected, and create a new block with the money carried across - credit/debit handled in the
firm's own accounts. No new machinery until a real case demands it.
DEFERRED, and it is different machinery: a developer granting a staged concession - "I will reduce
some after a period."

## ADDED DAY 86 - THE BLOCK HEADER REPORTS ONLY THE RESERVATION
On a fully collected block the header reads "Reservation Received AED 50,000 of AED 50,000 -
Collected in full" while the block has actually collected AED 1,431,643. True but tiny: a broker
glancing at the header cannot tell the block is paid, and must open the Money tab to find out.
The "Reservation settled ✓" chip sitting beside a "Record payment" button compounds it - the chip
describes one bill, the button opens another, and nothing says the second is done.
FIX SHAPE: once the whole bill is in, the headline should be the WHOLE BILL - "Fully collected -
AED 1,431,643 of AED 1,431,643 ✓" - with the reservation as a detail rather than the headline.
While money is outstanding it should name what is outstanding, across both bills.
ALSO: the header does not refresh after a collection is recorded - close and reopen shows it. The
stale-render pattern again.
   ⭐ AND THE ROOT CAUSE, founder Day 87: "the same form moves and various actions are taken, hence
   it is carrying forward the legacy." ONE FORM SERVES FIVE GATES - Offer Accepted, Reserved, SPA
   Signed, Closed Won, Closed Lost. Every addition was made for ONE gate and inherited by the rest.
   That is not five bugs, it is one structural fact producing symptoms:
    - a COLLECTION table appearing at a SIGNING ceremony
    - QUICK-FILL DATE, built for one case, applying everywhere
    - DLD radios on a form where terms should not change
    - the heading reading "Record SPA Signing" when the button said "Collect payments"
   The form cannot be reasoned about because it serves five masters. THAT is the argument for the
   split - not tidiness.

## OPEN QUESTION (Day 87) - SHOULD COMMISSION WAIT ON A SIGNING THE BROKER DOES NOT CONTROL?
FOUNDER: "all the payments have been made and it is only the signing ceremony - should the broker
wait 15-20 days because both buyer and developer are delaying? It is not his mistake."
Same question as Day 86 from the other side: WHEN DOES THE DEVELOPER BECOME LIABLE - on the buyer's
signature or the executed SPA? The payment TRIGGER field on pp_master_agreements already exists for
exactly this (SPA Executed / First Payment Received / Full Payment Received / Custom), so the
answer may be in the firm's own agreements.
LEFT ALONE per the founder: one commission invoice PER UNIT on a block. Wait for a broker reaction.

## ⭐ DESIGN (Day 87) - THE BLOCK PROPOSAL IS RENDERED FROM THE LOCKED DISTRIBUTION
The block never sends the buyer anything (Day 85). It needs the same grammar the 1-to-1 has - V1
goes out, the investor pushes back, V2 supersedes - BUT WITH ONE SOURCE OF TRUTH.
⭐ THE DISTRIBUTION STAYS MASTER. It is already versioned (D1, D2), already carries the terms,
already births the children, and the developer approves it. So a block proposal is RENDERED FROM
D_latest, not typed independently: lock D1 -> generate V1; renegotiate -> D2 -> V2.
WHY NOT LET THE PROPOSAL LEAD: two version histories (D and V) would drift apart, which is the
exact fault behind a week of findings - two sources for one number.
FROM THE BUYER'S SIDE it behaves like a 1-to-1: he receives V1, then V2, and the deal runs on the
latest ACCEPTED version. One document, per-unit schedule.

## ⭐ DESIGN (Day 87) - THE BLOCK PROPOSAL FLOW, SETTLED
FOUNDER'S GOVERNING RULE: the block behaves like a 1-to-1 in EVERYTHING EXCEPT COLLECTION - "the
communication to the buyer in the block process remains the same, no change." One cheque,
distributed; everything else mirrors the deal.
THE PROPOSAL IS THE SHORTLIST. There is no separate document: V1 shows the units AND the price, the
buyer reacts - too expensive, wrong floor, want a bigger one - site visits happen, and V2 carries
the NEW SET at the NEW PRICE. It repeats until he accepts. After acceptance money starts and
changes should be minimal.
⭐ APPROVAL BELONGS ON THE VERSION, NOT THE BLOCK. Each version records who at the developer
approved THAT discount. Today approval is a single block-level field, so locking D2 at a higher
discount leaves the old approval standing unchallenged. FOUNDER: "the broker cannot take a decision
on behalf of the developer - if the developer refuses, the deal is dusted; he will not take the
risk." The negotiation happens AT THE DEVELOPER'S OFFICE, to put the pressure where it belongs.
⚠️ ARCHITECT PROPOSED AN "INDICATIVE, NOT YET APPROVED" ESCAPE AND WAS WRONG - a broker must not put
an unbacked number in a buyer's hands. THE RULE uses what the master agreement already holds:
DISCOUNT AUTHORITY.
⚠️ ARCHITECT'S REFINEMENT, founder-agreed: "within authority, send freely" is technically right but
commercially misleading. A broker often goes to the developer's office EVEN WITHIN his authority -
because he wants the developer INVESTED in the buyer's demand rather than deciding alone. So the
approval field is ALWAYS PRESENT and ALWAYS RECORDABLE; it is MANDATORY only above authority. One
who went is not prevented from recording it; one who did not is not blocked.
STILL TO BUILD: (1) approval fields on send, per version · (2) BUYER ACCEPTED - one button on the
latest version; nothing today records the version the buyer agreed to, so a block confirms on
nothing · (3) test whether units can change between D versions, not just discounts.
⚠️ AND THE GAME NOT YET MODELLED: the discount is a LEVER THE BROKER TRADES AGAINST HIS OWN
COMMISSION. Founder: "the developer says I will give you 10% - if you close at 5 I will give you an
extra 2%." The app tracks what discount was GIVEN, never what was AVAILABLE, so it cannot show what
a broker earned by holding back. discount_authority_pct, bonus_commission_pct and bonus_threshold
all sit on pp_master_agreements, unfilled. CHEAP FIRST STEP: show the authority beside the discount
in the calculator - "5% of 10% available". A per-deal bonus control already exists on the manager's
view; the full incentive model waits until the flow is complete.

## ADDED DAY 87 - THE OPPORTUNITY LIST NEEDS A BLOCK / 1-TO-1 FILTER
The BLOCK / 1-TO-1 chip (Day 84) tells a broker what a row IS, but he still cannot ISOLATE one kind.
On a list of 11 that is a minor annoyance; on a real book it means scanning. FOUNDER: "two more
filters here for block and 1-to-1, or one dropdown to select - easy."
Cheap: block_deal_id is already on the opportunity and already read for the chip. It sits beside the
existing stage tabs.
   ⚠️ BUILT DAY 87 AND IT DOES NOT RESPOND. The select renders (cursor changes to a hand) but
   clicking opens nothing and the count stays at 11 of 11. Code verified correct end to end: state
   at line 19, onChange at 247, filter inside the `visible` memo at 103-105, fType in the memo's
   dependency array. Console clean, Vite cache cleared, hard refreshed.
   So something is INTERCEPTING the control rather than the logic being wrong - the same shape as
   the Day-85 KYC upload that looked live and was not. NEXT STEP: try keyboard arrows on it; if the
   value changes that way the click is being overlaid.

## ⭐ DESIGN (Day 87) - BLOCK ACCEPTANCE IS A STATUS, NOT A BUTTON PER VERSION
Settled by walking the 1-to-1. The architect proposed an "Accepted" control on each proposal row;
THE FOUNDER WAS RIGHT AND THAT IS WRONG: "at V10 I move to accepted - I can send 100 proposals,
I cannot have a button on every save."
HOW THE 1-TO-1 ACTUALLY WORKS: proposals accumulate as HISTORY - V1, V2, superseded, the journey
shows "Quoted (n)" as a COUNT. Acceptance is a STAGE MOVE on the deal, one act on the parent
record, whenever the buyer says yes and whichever version it was.
⭐ SO THE BLOCK MIRRORS IT WITH A STATUS: `accepted`, sitting between `approved` and `confirmed`.
 - ONE header button, "Buyer accepted", live once at least one proposal exists.
 - It stamps the date and the version that was live at that moment - the accepted version is
   implicitly the LATEST, the same assumption the 1-to-1 makes. No selection, no per-row control.
 - CONFIRM IS GATED ON IT. Today a block claims units, starts a clock and demands a reservation on
   an offer nobody has agreed to.
ALSO NOTED while walking the 1-to-1: "Build proposal" and "send" are ONE act there too - status is
SENT on save, and the button becomes "+ Send Revised" afterwards. The block already matches.

## ADDED DAY 87 - ADMIN AND TRUSTEE FEES ARE HARD-CODED, NOT SETTINGS
Every opportunity is created with `current_admin_fee: 580` and `current_trustee_fee: 4200`, typed
into the code. Company settings hold SPA, Oqood, DLD% and the reservation - not these two. So a
tenant whose DLD trustee charges differently, or whose developer adds an admin charge, cannot say
so. Same class as the Day-83 fee sweep, and missed by it because these live on the OPPORTUNITY
insert rather than in a fee resolver.
FOUNDER: a DEVELOPER ADMIN CHARGE may also apply and is not modelled at all - "I always added this
as 0", so it has never been visible.
FIX SHAPE: both belong in Buyer Fees beside the others, resolved through feeSettings.js like the
rest. And the buyer-facing proposal should show them, because "you never told me about this" is the
argument they cause.

## IN PROGRESS DAY 88 - THE SPA CEREMONY SPLIT (mostly done, one piece left)
ROOT CAUSE FOUND AND FIXED: the gate form was named by the DESTINATION, not by where the broker is.
At SPA Requirements the button targets SPA Signed, so pressing "Collect payments" opened a form
headed "Record SPA Signing" with a final price, a signing date and a document upload - a ceremony
for a signing that had not happened. That is the root of a week of findings.
DONE: a "SPA Requirements" gate now opens for collection, the signing fields are HIDDEN there (not
greyed - greyed reads as live), and the heading says "Collect payments".
⚠️ LEFT TO DO: the FOOTER BUTTONS on the collection gate still offer "Record SPA". It should offer
Save payments only - he is not signing anything. One small cut.

## ⭐ ADDED DAY 88 - THE 1-TO-1 LEDGER HAS NO PAYMENT TRAIL, AND THAT IS THE LOOSEST PART OF THE
## MONEY PATH
FOUNDER: "if he changes 50k to 25k by mistake and saves, what happens?" It is OVERWRITTEN SILENTLY.
The save does `.update({ pre_spa_payments: prePaymentsState })` - the whole object replaced. Nothing
records that it was ever 50,000.
⚠️ THE BLOCK DOES THIS PROPERLY and the contrast is stark: every block payment is a ROW in
block_payments with amount, mode, reference, date and who recorded it; allocations hang off it;
amending is manager-gated and the original survives. The 1-to-1 has ONE JSON FIELD PER PARTICULAR,
overwritten. Three cheques against a first instalment become a single number, and a mistyped
correction erases the original with no trace.
HOW IT HAPPENED: the Day-69 honest ledger was designed for CLARITY - expected vs received, one line
each - and that was right for the DISPLAY. But the display model became the STORAGE model, and a
money record needs a trail.
⭐ THE FIX: a payments table on the 1-to-1 mirroring block_payments. Each payment is a row; the
ledger becomes the SUM, derived rather than typed. Same shape as the Day-86 ruling - the trail is
the truth, the balance is derived from it.
HONEST SIZING: a table, a recording dialog, a migration of existing figures, and every panel that
reads pre_spa_payments. Half a day at least. NEXT MAJOR CUT after the current walkthrough.
SMALLER, AND RELATED: the form saves a payment with `method: ""` - an amount and a date but no mode,
which cannot be reconciled against a bank statement. Require it when the amount is positive.
ALSO ON THE COLLECTION GATE, cosmetic: the DLD radios and "quick-fill date for all received items"
still render there and belong to neither collection nor this stage, and the Notes placeholder still
reads "conditions or notes on the SPA" on a form that is not about the SPA.

## ADDED DAY 89 - THE RECEIPT IS BRANDED "PropCRM", NOT THE COMPANY
generateReceiptPDF carries a hard-coded navy-and-gold PropCRM header, while every other document -
proposal, block statement, block proposal, payment statement - reads company.name and
company.brand_color. This is a WHITE-LABEL product and a receipt carrying the product's name to a
brokerage's client is wrong.
ALSO: printReceipt (OpportunityDetail ~1486) is DEAD - defined, never called, 40+ lines of inline
HTML with the same PropCRM branding. Remove it rather than leave a second receipt path for someone
to wire up by mistake.
AND ON THE PAYMENT STATEMENT, both small and buyer-facing:
 - An overpaid line reads "Due 98,821 · Paid 104,279 · Settled". Better: "Settled - 5,458 in
   credit", so the document answers the question it otherwise invites.
 - Rows WRAP when a reference is long; dates and descriptions run together. Widen or truncate.
   ⚠️ CORRECTION (same day): generateReceiptPDF is FINE - it reads company.name and
   company.brand_color like every other document. The PropCRM branding is only in the DEAD
   printReceipt, which nothing calls, so no buyer has ever received it. The architect read the dead
   function and assumed the live one shared its fault. The remaining action is smaller than boarded:
   DELETE printReceipt. Nothing else to fix here.
