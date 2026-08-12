> **THIS IS THE SESSION LOG - HISTORY, NOT STATE.**
> Read `docs/PropCRM_Master_Context_and_Takeover.md` FIRST - that is the head.
> Outstanding work lives in `docs/MASTER_PENDING_BOARD.md`.
> This file is APPENDED at session close. Never treat an old entry as current truth.
> Governed by docs/DOCUMENTATION_PRINCIPLES.md.

# ============================================================
# TOP DOCTRINE - DATA FRESHNESS (never bury this)
# TRUST THE DB, NEVER PRIOR STATE. Components refetch on open/focus.
# Stale-render = showing a prior-fetch snapshot until hard refresh.
# This is the #1 pre-prod hardening item. Echoes Day-22 realtime +
# localStorage cache-pollution lesson (validate/overwrite from auth
# record). Audit: Workspace, calculator, opp lists, inventory, dashboards.
# Fix pattern: refetch-on-mount + on-window-focus (or realtime subs).
# Bites hardest in the tester week if unaddressed.
# ============================================================

# PropCRM - Current Handoff (resume point)
_Last updated: 2 Jul 2026 (Day 45) — Path B COMPLETE_

## WHERE WE ARE: App is 100% capability-driven. ACL build + Path B de-hardcoding DONE.

### DONE + committed + pushed
- ACCESS-CONTROL BUILD B-G COMPLETE (tag acl-build-complete-day45): harness, 18-cap model, crown-jewel
  double-lock, two-tier identity (super_admin=platform via is_super_admin flag + DB CHECK), capability-driven
  broker-visibility RLS, Settings config UI. Full role x table sign-off green.
- GOVERNANCE BIBLE (docs/Access_Control_Configurable_Roles_Design.md): PropCRM=enabler, complete first-cut
  setup, customer owns config post-handover via 1 trained role under change-approval; PropCRM retains
  leak-prevention + monitoring + structural/PropPulse/schema.
- PATH B COMPLETE (tag path-b-dehardcoding-complete-day45): ALL hard-coded role arrays retired from the app.
  canDo(user,action) in lib/permissions.js reads role_capabilities. hasCapability de-hardcoded (is_super_admin
  flag only). 13 screens + App.jsx (Pipeline, inline DiscountApprovals, nav gates) migrated. permissions.js =
  only canDo + ACTION_TO_CAPABILITY. 19 caps seeded + all visible/toggleable in Settings > Role Capabilities
  (Operations group added). Two-tier discount approval preserved (approve_discounts / approve_discounts_admin).
- BUGS FIXED en route: 4 latent missing-can-import ReferenceErrors (leasing trio + inline DiscountApprovals),
  1 ReservationsWidget crash (LeasingDashboard). HEAD = 76f9245. Tree clean.

## NEXT (before tester handoff)
1. VERIFICATION WALKTHROUGH (the safety net — not yet done): as super_admin, click every migrated screen
   end-to-end (Inventory, PropertyMaster, ActivityLog, Leasing x3, Dashboard, DiscountApprovals,
   Opportunities, OpportunityDetail, LeadDetail, Pipeline, nav gates) — confirm buttons/data render per
   capability. No tenant users exist yet to test non-super profiles.
2. Confirm Settings > Role Capabilities shows the Operations group (7 new toggles) — trivial, verify on next open.

## PHASE 2 CAPTURES
- ReservationsWidget: lost in refactor, removed dangling ref; rebuild (leasing dashboard reservations panel).
- src/components/DiscountApprovals.jsx: DEAD CODE (App.jsx uses inline copy at ~1488); delete in cleanup.
- LeasingDashboard.jsx: DEAD CODE (App.jsx inline is live); delete in cleanup.
- group-GM cross-branch (forward-ready, no test surface). manage_settings edit-control (bible TBD).
- Monitoring routine (extend harness into scheduled leak-check).

## VERIFICATION WALKTHROUGH (2 Jul, Day 45) — PASSED (super_admin)
As super_admin (mah284): all top tabs open fast, Opportunities + OpportunityDetail + finance render clean,
menus quick, no white screens / console errors. Migrated screens stable end-to-end. App is tester-handoff-ready.
CAVEAT: agent/manager/viewer capability-gating verified via RLS harness (DB) + build (code), NOT live tenant
logins — no tenant users exist yet. When real tenant users created, do a quick per-role click-through to
confirm buttons/data gate correctly (agent loses manage_inventory buttons, etc.).

## 🛑 HANDOFF BLOCKER FOUND (Day 45 end) — USER CREATION BROKEN by profiles RLS
Symptom: creating a user via Users tab → "User created but profile update failed: new row violates RLS
policy for profiles". Auth user IS created, but profile lands with company_id=null (unusable).
ROOT CAUSE: UsersTab.jsx:54 uses client-side supabase.auth.signUp() which SWITCHES the session to the
new (powerless) user; the follow-up profiles upsert (line 59) then runs AS the new agent, not as
super_admin → RLS UPDATE policy denies it. Stage C enabled profiles RLS (was OFF before, so this silently
"worked"). The code comment (line 51) says "Secure user creation via serverless API route" — but it does
client signUp instead (shortcut never replaced).
PROPER FIX (fresh session — touches auth/secrets, do carefully NOT tired):
  Build a serverless API route (e.g. api/create-user) using Supabase SERVICE-ROLE key to create the auth
  user + insert the full profile row (id,email,full_name,role,company_id,is_active) atomically, server-side,
  bypassing RLS correctly and avoiding the session switch. Matches the code's own stated intent.
CLEANUP: orphaned auth users exist for testagent@testmans1.ae / testagent2@testmans1.ae / testagent3
  (auth.users rows without valid profiles). Clear via Supabase dashboard Auth panel before retesting.
IMPACT: testers cannot be given accounts until fixed. TOP priority for next session.
Tag before fix. Existing capability model + canDo is unaffected (this is purely the create-user flow).

## ✅ BLOCKER RESOLVED (2 Jul, Day 45) — USER CREATION FIXED
Fix (commit e097ecd): UsersTab signUp now passes full_name/role/company_id in options.data; the
on_auth_user_created trigger sets the profile server-side (bypasses RLS, no session-switch). Removed the
failing client upsert. VERIFIED: created testagent4@testmans1.ae (sales_agent, Al Mansoori) — no error,
profile + company_id set correctly.
CLEANUP (minor, next session): orphaned auth.users from failed attempts (testagent@ / testagent2@ /
testagent3@testmans1.ae) — delete via Supabase dashboard Auth panel. Harmless (no valid profiles).
NEXT: with user creation working, create sales_manager + viewer test users, then do the per-role live
verification walkthrough (agent loses manage_inventory buttons, etc.) — the check pending since no tenant
users existed.

## ✅ PER-ROLE LIVE VERIFICATION PASSED (2 Jul, Day 45)
Logged in as testagent4 (sales_agent, Al Mansoori) in incognito: login works; Inventory Add/Edit/Excel
buttons correctly HIDDEN (manage_inventory=false). The capability model (canDo reading role_capabilities)
works end-to-end LIVE — de-hardcoding fully verified in the flesh, not just via harness/build. Path B
DONE + PROVEN. App is tester-handoff-ready.
PRE-EXISTING items (NOT de-hardcoding related, to address separately): Dashboard + Inventory listing
"sticky note" display issue — flagged by founder for review.

## PHASE 2 / POLISH CAPTURE — dashboard Available/Reserved buttons don't pre-filter inventory
Founder flagged (Day 45): Sales dashboard "Available Units" / "Reserved Units" buttons both open the FULL
inventory instead of pre-filtering to their status — making them meaningless. Machinery already exists:
InventoryModule accepts initialFilter (line 39) + applies it (line 55, fStatus). Fix = the dashboard button
onNavigate calls (e.g. App.jsx:2171 area, the l_inventory/inventory row buttons) must pass
{type:"status",value:"Available"|"Reserved"} like the leasing one already does (line 2025). ~2-min fix.
Principle (founder): "every button has meaning, or it's demeaning." More such button-meaning issues to be
collected during the full end-to-end walkthrough.

## FOUNDER TASK — SEED-DEFAULTS REVIEW (the "complete first-cut" config pass)
Walkthrough surfaced that seeded role_capabilities defaults don't fully match Abid's real broker org intent
(NOT bugs — the capability model works live; these are config decisions). Examples found Day 45:
  - sales_manager see_branch_data = TRUE, but Abid thinks branch/all-visibility should be Group Manager only.
  - manage_inventory = TRUE for admin ONLY (group_gm + all managers = false). Confirm intent (should group_gm
    manage inventory?).
DO THIS AS ONE DELIBERATE PASS (per governance bible: PropCRM does the complete first-cut per customer
requirements): Abid defines the intended role x capability matrix for the real broker org; align the seed in
a single clean migration; re-verify per-role live. Not piecemeal mid-walkthrough.
Current roles: super_admin(platform), admin, group_gm, sales_manager, sales_agent, leasing_manager,
leasing_agent, viewer. 19 caps across Data Visibility / Commission / Master Agreements / Administrative /
Operations groups (all toggleable in Settings > Role Capabilities).

## STRATEGIC GROUPING — "ROLES CONFIGURABILITY" ARC = ONE PHASE 2 EFFORT (Day 45)
Founder scope-check surfaced that three items are the SAME family (roles-as-data) and should be done
TOGETHER as one deliberate arc, NOT piecemeal:
  1. NAV de-hardcode (TABS visibility by capability not hard-coded roles:[...])
  2. CUSTOMER-DEFINABLE ROLES (add "Regional Head"/"Director" — roles from data + Create-Role form)
  3. SEED-DEFAULTS as a proper first-cut template the customer tunes
These are DIFFERENT layers from the small remaining plate (per-role VERIFICATION = testing; SEED intent =
founder product decision) — the arc does NOT subsume them. Decision: defer the Roles Configurability arc to
a dedicated multi-session Phase 2 effort (it's schema+UI, not a finish-today job). NON-BLOCKING now: RLS
enforces real access; in-screen actions already capability-gated (proven live). Return to the small plate
(finish verification, seed review) for clean closure. Tag pre-nav-dehardcode-day45 marks the pause (no code).

## PER-ROLE VERIFICATION COMPLETE (Day 45) — all tiers gate correctly, live-proven
- sales_agent (testagent4): Inventory manage buttons HIDDEN (manage_inventory=false) ✅
- sales_manager (testmgr): per config — see_branch_data=true, manage_inventory=false (no inventory manage) ✅
- viewer (testviewer): sees ONLY Dashboard tab ✅ — but NOTE: this is the current HARD-CODED nav limiting
  viewer (only dashboard/l_dashboard list "viewer" in roles:[]). Makes viewer near-useless (can't reach
  leads/opps/inventory even read-only). To make viewer a useful READ-ONLY role (sees data, can't edit),
  the nav must be capability-driven — exactly the PAUSED Phase 2 "Roles Configurability" arc. Not a bug;
  a known consequence of hard-coded nav. Capability model itself works correctly across all 3 tiers.
CONCLUSION: capability model proven live end-to-end. App tester-ready for the built roles; viewer usefulness
+ full role/nav configurability = Phase 2 arc.

## DEFERRED DISCUSSION — MULTI-BRANCH ASSIGNMENT (revisit at LEASING phase)
Founder decision (Day 45): the multi-branch case (e.g. one manager covers Sharjah AND Ajman, not all
branches) is real and structurally sound to add later — the capability+RLS foundation extends to it cleanly
via a future branch-assignment layer. NOT needed for first testers. Build flexibility WHEN the market needs
it, deliberately — not speculatively now. REVISIT TRIGGER: after current work is finished and we move to the
LEASING phase, re-open this discussion then. (Two-account workaround rejected — it's debt; wait and build
branch-assignment properly.) Architecture confirmed extensible; timing is ours to control.

## SEED REVIEW COMPLETE (Day 45) — group_gm set to OVERSIGHT
Founder approved "see broadly, act narrowly, approve at height." group_gm (Al Mansoori) adjusted
(tag pre-seed-groupgm-oversight-day45, revertable):
  OFF: edit_records, delete_records, delete_leads, reserve_units, manage_commissions, manage_master_agreements
  ON:  see_group_data, see_branch_data, view_master_agreements, see_brokerage_commission, approve_discounts,
       approve_discounts_admin, assign_leads, request_discounts (visibility + approval + light oversight)
Customer can toggle operational caps ON later if their GM is hands-on (enabler model).
Sales/Leasing Manager: see_branch_data stays TRUE (= own branch, correct). Multi-branch = deferred to Leasing.
Seed is now a sensible first-cut TEMPLATE the customer tunes. Seed review plate item CLOSED.

## CORRECTION (Day 45 eve) — DiscountApprovals + LeasingDashboard are LIVE, not dead
Earlier HANDOFF notes said src/components/DiscountApprovals.jsx and LeasingDashboard.jsx were dead code
(App.jsx inline duplicates). VERIFIED FALSE via grep: App.jsx RENDERS both as imported components —
DiscountApprovals at lines 2764 (discounts) + 2794 (l_discounts); LeasingDashboard at line 2788 (l_dashboard).
DO NOT DELETE these files. The "dead inline duplicate" assumption is retracted. (App.jsx is ~2,866 lines now,
post-refactor — older 17k-line notes are stale too.) Any future cleanup must re-verify with grep first.

## BUTTON-FILTER FIX — NEEDS SCREEN CONFIRMATION (Day 45 eve, not fixed)
Founder reported Dashboard "Available Units"/"Reserved Units" buttons open FULL inventory instead of
pre-filtering. Investigated: only TWO Available/Reserved navigate points in App.jsx, BOTH leasing:
  - line 2025: leasing SC card -> onNavigate("builder",{type:"status",value:"Available"}) — ALREADY correct
  - line 2171: leasing array link ["Available Units",...,"l_inventory"] — no filter passed
  - NO "Reserved Units" navigate found anywhere; NO sales-dashboard Available/Reserved nav button found.
So the exact button(s) founder saw are unconfirmed (sales vs leasing? which widget?). NEXT SESSION: founder
shows the exact screen + button (screenshot or "Leasing Dashboard, Available card"), then it's a ~2-min fix
(InventoryModule already accepts initialFilter line 39 / applies line 55; button just needs to pass
{type:"status",value:"Available"|"Reserved"}). Do NOT fix blind — locate first.

## CLEANUP DONE (Day 46 AM) — orphaned auth user removed
Deleted testagent@testmans1.ae (company_id=null, role=null, unusable orphan from user-creation debugging)
via Supabase Dashboard > Authentication. NOTE: HANDOFF earlier over-counted — testagent2@/testagent3@ did
NOT exist (never created or already gone). Good test accounts REMAIN: testmgr@ (sales_manager), testviewer@
(viewer), both Al Mansoori. testagent4@ (sales_agent) not seen in auth list — reverify it exists next time needed.

## BUTTON-FILTER FIX — DONE + VERIFIED (Day 46 AM)
Root cause found: Dashboard.jsx buttons (lines 106/107) ALREADY passed {type:"status",value:"Available"|
"Reserved"} correctly; the break was App.jsx line 2763 (sales builder tab) NOT passing initialFilter=
{navFilter} to InventoryModule (every other tab did). Fix: added initialFilter={navFilter} to the builder
tab render. Verified live — Sales Dashboard Available/Reserved buttons now pre-filter inventory by status.
Tag pre-inventory-filter-fix-day46. (Leasing l_inventory line 2792 also missing it — deferred to Leasing phase.)

## 🛑 CRITICAL PHASE 2 — LEAD/CUSTOMER DUPLICATE PREVENTION (founder-flagged, Day 46)
Founder emphasis: this is CRITICAL, not minor — must not surface as poor design at handoff. Currently NO
duplicate check exists on lead creation (verified via grep — nothing on phone/email match). REAL AIM: prevent
two accounts/contacts with the same person's details entering the system at the root — a data-integrity
problem, not just a UX popup.
MINIMUM (v1): on lead save, exact-match check on phone + email; if match found, warn "A lead with this
phone/email already exists: [name]" -> user chooses Continue anyway / Cancel. Non-blocking, informative.
Serves both control-freak brokerages (see dup, route it — pairs with create_leads capability restricting
lead entry to a sales admin who dedup-checks) AND fast brokerages (proceed).
DEEPER DESIGN QUESTION (needs proper thought, not a quick popup): is warn-continue enough, or do we need
enforced uniqueness / a merge flow / a canonical-contact model? Founder wants a BETTER approach considered.
ENHANCEMENT (later): AI/fuzzy matching (Mohd vs Mohammed, typo'd numbers) — v1 = exact match only (reliable,
no false positives); AI-fuzzy = separate follow-on.
Do this properly during end-of-project ironing. Tied to create_leads capability (lead-entry control) work.

## ⏳ IN-PROGRESS (Day 46) — AGENT "+ Add Lead" BUTTON NOT SHOWING (unresolved, WIP stashed)
GOAL: sales_agent should see "+ Add Lead" on Leads screen. It's hidden because canDo(user,"create_lead")
returns false — the agent's currentUser.capabilities is EMPTY at runtime.
DONE + COMMITTED (safe on main): create_leads capability seeded (agents/mgrs/admin/gm=true, viewer=false,
verified in DB); permissions.js map has create_lead->create_leads; LeadDetail Add Lead gated by
canDo(create_lead); Settings matrix shows Create leads (commit ced619a). Nav de-hardcode DONE (0661558).
Button-filter fix DONE (bff838e). Orphan cleanup DONE.
STASHED (git stash: "day46 create_leads debug..."): App.jsx WIP containing TWO REAL FIXES worth keeping +
debug logs to strip:
  1. setFollowups([]) removed from SIGNED_OUT handler (~line 2434) — was a real ReferenceError crashing logout.
  2. restore path (~line 2426) now calls loadUserCapabilities(ru) — session-restore was SKIPPING cap load.
  Plus temp debug logs: [LOGIN PATH], [LOADCAPS ENTRY], [LOADCAPS BAILED], [CAPS DEBUG], company_id log.
THE UNSOLVED MYSTERY: handleLogin (line 2543) fires and logs "[LOGIN PATH] handleLogin -> role=sales_agent
company_id=c23a2320..." (valid company_id!). Next line 2546 calls loadUserCapabilities(user). BUT the FIRST
line inside that function "[LOADCAPS ENTRY]" NEVER prints — in dev (5173) AND in a fresh production build
(4173) that PROVABLY contains the log (grep -c on dist = 1). No red console error. So loadUserCapabilities
is called but its body never runs, with no thrown error. Defies normal JS. NEXT SESSION leads to chase:
  (a) Is loadUserCapabilities somehow shadowed/redefined? grep -n "loadUserCapabilities" src/App.jsx (was 3 hits).
  (b) const defined at 2600 but called at 2546 — TDZ? (but no error seen... verify in prod build w/ breakpoint).
  (c) Put a debugger; breakpoint at line 2546 and step IN.
  (d) SEPARATE the data (COUNTRY_CODES export line 911) OUT of App.jsx — it breaks React Fast Refresh
      ("COUNTRY_CODES export incompatible" HMR error). Move consts to src/lib/ so App.jsx exports ONLY the
      component. This likely fixes dev-HMR staleness AND is good hygiene.
TO RESUME: git stash pop  (brings back the WIP). Then chase (a)-(d).

## ✅ RESOLVED (Day 47) — AGENT "+ Add Lead" — SOLVED + VERIFIED END-TO-END
ROOT CAUSE: TDZ ReferenceError — `const loadUserCapabilities` (arrow fn, not hoisted) was DEFINED at ~line
2547 but USED earlier by the restore useEffect (~2374) and handleLogin (~2494). On session-restore it threw
"Cannot access 'loadUserCapabilities' before initialization" (swallowed by try/catch) -> capabilities NEVER
loaded -> agent currentUser.capabilities empty -> canDo(create_lead) false -> Add Lead hidden. super_admin
bypasses canDo via is_super_admin flag, so it worked for them -> looked role-specific (it wasn't).
FIX: moved loadUserCapabilities definition ABOVE the restore useEffect (commit 7af6352). Debug artifacts
stripped (4be63eb). VERIFIED: testagent4 (sales_agent) sees + Add Lead AND successfully created a lead
("test new lead from agent") — frontend + backend + RLS all confirmed working, online + local.
REAL BUGS FIXED THIS ARC (all committed): setFollowups([]) crash in SIGNED_OUT handler; restore path now
calls loadUserCapabilities; 4 data constants (COUNTRY_CODES, NATIONALITIES, MAX_RESERVATION_FEE, RES_COLORS)
moved App.jsx -> src/lib/refData.js (App.jsx now component-only -> React Fast Refresh works); undefined
`app` -> `activeApp` in handleLogin; ActivityLog.jsx missing `Empty` import; create_leads capability
(agents/mgrs/admin/gm=true, viewer=false) gating Add Lead. Nav de-hardcode (0661558).
BIG LESSON: local Vite dev served STALE bundles for hours (broken Fast Refresh from non-component exports),
making every local test lie. TRUTH = Vercel (committed code) OR aggressive Ctrl+Shift+R x8-10 on localhost.
When local behaves impossibly, commit + test online.

## 🔭 VISION / NORTH STAR (Day 47 — NOT near-term; capital-dependent, captured for direction only)
Founder note: this needs funding PropCRM does not have yet. It is a compass, NOT a build plan. Do broker
depth first; everything below waits for $$$ and traction.
PROPOS = property-lifecycle OPERATING SYSTEM (not a CRM). One shared data spine + multi-tenant identity +
capability engine; persona-apps layered on top as feature packs (modules/<persona>/), NOT forked codebases.
  Lifecycle: Broker/Agency (LIVE) -> Developer -> CAFM/Facilities -> Construction/Contracting -> more
  (leasing, valuation, property mgmt, owner portal). Building flows through ONE data spine: financed -> sold
  -> built -> operated -> resold; nobody re-enters data. That continuity = the moat + the "minimal-entry,
  click-and-go, AI-heavy" thesis EARNED (PropPulse already owns the data; entry is a consequence of owning it,
  not an AI wrapper). Stay ruthlessly VERTICAL (real estate) — going generic = dilution/death.
  Suggested sequence (data-adjacency first): Broker -> Developer -> CAFM -> Construction. Developer + CAFM
  reuse existing spine most; Construction is the bigger domain leap.
MULTI-GEOGRAPHY: universal engine + per-market DELTA packs in markets/<country>/ — slice ONLY the
principle-level differences (compliance, reference data, capability defaults, stage defs) into region folders;
NEVER fork the core. lead->won workflow is universal; specifics (UAE DLD/Oqood/RERA vs UK conveyancing/chains/
EPC/seller-side commission) are swappable config. The refactor + de-hardcoding done to date is the ENABLER.
  Near-term geo interest: MENA (GCC, esp. Saudi — structurally similar, config not fork). UK feeler exists
  (friend's family) — treat as VALIDATION conversation, not a build commitment; UK is a bigger pivot
  (resale/chain model, seller-side commission, no off-plan-dominant) = a UK config pack on the engine, later.
WHY IT MATTERS: "PropOS — operating system for the property lifecycle" is a far bigger fundraise story than
"UAE broker CRM." Art = pitch the BIG vision, execute NARROW (broker first). Foundation being hardened now
(multi-tenant, capability-driven, de-hardcoded, refactored) IS the OS spine — build it right, add personas later.

## 🛑 PHASE 2 STICKY — CANONICAL IDENTITY (govt ID) — deferred, founder insight Day 48
Email/phone are weak identity (shared, changed, faked). The FOOL-PROOF unique key = government ID:
Emirates ID number (784-YYYY-NNNNNNN-C — immutable across card renewals) for locals/residents; passport
for international (NOTE: passport number CHANGES on renewal — needs care + document copy upload). Design must
branch by buyer type: EID routine vs international routine, each requiring an uploaded ID copy. KEY NUANCE:
this only matters once a lead becomes an ACTUAL BUYER with a transaction — a habitual searcher/caller with no
deals doesn't need govt-ID identity. So the ID-as-canonical-key belongs at the KYC/buyer-conversion stage,
NOT at early lead entry (early leads won't have EID yet). Ties into KYC fields already on the form
(pep_flag, source_of_funds, nationality). This UPGRADES the vague "canonical-contact model" to a concrete
answer: identity = govt ID, captured at buyer stage.

## 🛑 PHASE 2 STICKY — LEAD -> ACCOUNT MODEL (Salesforce pattern) — "rethink completely" Day 48
SF does it cleanly: (1) Lead + Lead Details + all communications live in the LEAD space. (2) When an
Opportunity is created, SF promotes the lead to a proper ACCOUNT record, and ALL transactions flow forward
from the Account (not the lead). Cleaner separation of "prospect" vs "customer with deals". PropCRM currently
keeps everything on the lead. Founder flags this as a possible COMPLETE rethink of the data model later —
pairs with canonical-identity (Account = the person keyed by govt ID). Big design; revisit post-handoff.
Architect TODO before revisit: research how SF/HubSpot/Zoho structure Lead vs Account vs Contact, and whether
PropCRM should adopt Lead->Account promotion on opp-creation.

## DUPLICATE-PREVENTION — v1 SCOPE (Day 48): keep SIMPLE = email + phone exact-match only.
DB guarantee scope decided: EMAIL strict-unique per company (reliable). PHONE = UI-warn only (shared phones
are legitimate — family/reps; test data already shows 2 different people sharing +9715012341234). Govt-ID
canonical identity + Lead->Account model = the deeper stickies above, revisit later.

## ✅ RESOLVED (Day 48) — DUPLICATE-PREVENTION v1 — DONE + VERIFIED
On + Add Lead, exact phone/email match (company-scoped, via src/lib/checkDuplicateLead.js — two clean
.eq/.ilike queries, no fragile .or()) shows a BLOCK message: "🛑 This contact already exists: [name] ·
[phone] · [email]. Please contact your administrator to be assigned this lead." Close-only (no Add anyway).
Banner renders just above the footer Save button (was off-screen at form top in the scrollable panel — fixed).
DB backstop: existing global UNIQUE INDEX leads_email_unique on (email) prevents dup email at DB level (kept).
Verified on prod: duplicate email/phone -> block message, no 409 surfaced, no dup created; fresh lead saves clean.
DEFERRED STICKIES (Day 48, founder calls): (1) leads_email_unique is GLOBAL not per-company -> multi-tenancy
hardening = make it (company_id, lower(email)). (2) Canonical identity via govt ID (EID/passport) at buyer/KYC
stage. (3) Lead->Account model (SF pattern). (4) AI duplicate-leads report (who/when created) + merge tool.
All deferred to the proper account/opp design phase near go-live.

## 🛑 KNOWN ISSUE / STICKY (Day 48) — PDF hero image CORS-blocked (non-blocking)
Proposal PDF generation tries to fetch the project hero image directly from the developer's site (e.g.
aldar.com/.../grove-residences-hero.jpg). Those sites block cross-origin requests (CORS: "No
Access-Control-Allow-Origin header"), so the hero image does NOT embed in the PDF. NON-BLOCKING: the PDF
still generates + uploads successfully; only the hero image is missing. Console shows a CORS error + ERR_FAILED
for the image — cosmetic, safe to ignore for testers. PROPER FIX (deferred): proxy external images through our
own backend (Vercel function / Supabase) so they're served same-origin, OR download+re-host hero images in
Supabase storage at PropPulse-import time. Phase 2 polish, not handoff-blocking.

## ✅ RESOLVED (Day 48) — Issue 1: agent proposal visibility — CORRECT BY DESIGN (no fix)
Agent testagent4 opened a lead and saw 0 proposals under "view proposals sent", but super_admin saw
proposals on the SAME lead (super_admin had created them). QUESTION for founder: should a sales agent see
(A) ALL proposals on a lead ASSIGNED to them (even manager/admin-created) -> then it's a BUG, widen the
proposal query scoping; or (B) ONLY proposals they personally created -> then current behavior is CORRECT
(no fix). Architect lean = (A): the lead is in the agent's pipeline, they need full proposal history to
follow up / avoid duplicates. Resume: get A/B from founder, then fix-or-confirm.

RESOLUTION: verified T1 - Lead Test is assigned to super_admin (mah284), NOT the agent. activities RLS (activities_select_policy) scopes see_own_data users to proposals on leads/opps ASSIGNED to them. Agent correctly saw 0 -> RLS working as designed. Founder decision (agents see own work by default) is ALREADY enforced by RLS; the configurable widen-setting ALREADY exists = toggle see_branch_data / see_group_data per role. No code change needed.

RESOLUTION: verified T1 - Lead Test is assigned to super_admin (mah284), NOT the agent. activities RLS (activities_select_policy) scopes see_own_data users to proposals on leads/opps ASSIGNED to them. Agent correctly saw 0 -> RLS working as designed. Founder decision (agents see own work by default) is ALREADY enforced by RLS; the configurable widen-setting ALREADY exists = toggle see_branch_data / see_group_data per role. No code change needed.
✅ DONE Day 48: dup-prevention v1 (block + contact-admin), commission gate (see_brokerage_commission,
configurable). Tags: dup-prevention-v1-day48, commission-gate-day48. HEAD 27692a5.

## 🛑 PHASE 2 STICKY (Day 48) — Dashboard redesign: analytics, not repetitive listings
Founder insight: the current dashboard is "full of listings" — nearly every tile just deep-links to a
filtered list (opps/inventory), which is repetitive and under-uses the space. REAL DIRECTION: redesign the
dashboard so tiles/sections surface genuine ANALYTICAL reports per persona (trends, breakdowns, conversion,
aging, pipeline velocity, month-over-month) rather than N doors to the same list view. Also add report
filters (date from/to, monthly, stage, owner). This is a deliberate design project — NOT to be rushed before
the weekend tester handoff (redesign risk > handoff value). Do properly post-handoff. Today we fix only the
one visible glitch (Won Value tile mismatch) so testers aren't confused.

## RESOLVED (Day 48) Won Value tile mismatch DONE+VERIFIED
Tile showed 0 but click landed on unfiltered opp list showing a New opp as won. FIX: (1) Won Value tile passes {type:stage,value:Closed Won} to onNavigate; (2) Opportunities consumes initialFilter.type==stage -> setFStage; (3) total-value pill (16px bold) sums filtered rows, shows <stage>: AED <total> when a stage filter active, updates by stage. Verified prod. Tag wonvalue-fix-day48. Dashboard analytics redesign = separate Phase 2 sticky.

## PHASE 2 STICKY (Day 48) — Calendar of events on dashboard
Founder idea: surface all scheduled activities (follow-up calls, meetings, site visits — the "Next: Meeting on 6 Jul" type entries logged against leads/opps) in a CALENDAR view on the dashboard. High value for agents/managers to see whats coming. Part of the broader dashboard-analytics-redesign sticky (dashboard = analytics not repetitive listings). Do properly post-handoff.

## RESOLVED (Day 48) Activity append-only notes DONE+VERIFIED
New src/components/opportunities/AppendNote.jsx: "+ Add note" on COMPLETED activity cards (canEdit-gated) appends a timestamped, attributed line to the activity note field WITHOUT editing the original (audit-safe). Original preserved above; addendum shows as "u21B3 [date time . user] text". Saves via supabase update, refreshes via setActivities re-fetch. currentUser threaded into ActivitiesList across all 3 render paths (OpportunityDetail, LeadDetail, LeaseOpportunityDetail) so attribution shows real name not "User". Verified prod. Tag activity-append-notes-day48. Decided: append-only (not edit) preserves audit trail; solves "add forgotten point e.g. buyer hard-stop on price". Calendar-on-dashboard = separate Phase 2 sticky.

## RESOLVED (Day 48) Activity append-only notes DONE+VERIFIED
New src/components/opportunities/AppendNote.jsx: "+ Add note" on COMPLETED activity cards (canEdit-gated) appends a timestamped, attributed line to the activity note field WITHOUT editing the original (audit-safe). Original preserved above; addendum shows as "u21B3 [date time . user] text". Saves via supabase update, refreshes via setActivities re-fetch. currentUser threaded into ActivitiesList across all 3 render paths (OpportunityDetail, LeadDetail, LeaseOpportunityDetail) so attribution shows real name not "User". Verified prod. Tag activity-append-notes-day48. Decided: append-only (not edit) preserves audit trail; solves "add forgotten point e.g. buyer hard-stop on price". Calendar-on-dashboard = separate Phase 2 sticky.

## RESOLVED (Day 48) Lead Queue -> Lead Assignment rename + audit by-X
Renamed 7 user-facing "Lead Queue" labels to "Lead Assignment" (Queue implied waiting; module actually assigns/transfers leads). Internal id lead_queue, folder leadqueue/, capabilities UNCHANGED. History tab now shows "by [triggered_by name]" so audit records WHO performed each transfer (data was already in lead_assignment_log.triggered_by, now displayed). VERIFIED broker transfer/release already captures mandatory reason + triggered_by (ReleaseDialog.jsx) and it shows in History = full audit, no memory dependency. Commit ef8b32e, tag lead-assignment-rename-day48. Also DONE Day 48: activity append-only notes (tag activity-append-notes-day48).

## RESOLVED Day48 Log Activity 2-mode DONE+VERIFIED. LogActivityModal (shared): Completed=history (date max=now, next-step shown); Scheduled=future (date min=now, next-step hidden+reset). FIX: next-step now INSERTS real upcoming activity (activity_subtype=next_step, status=upcoming) - shows in Upcoming Tasks; was note-text-only before. Verified in data. Commit 421310d tag activity-form-2mode-day48.

## PHASE 2 STICKY (Day 48) — Log Activity form: visual history/future separation
Form works perfectly (logic locked) but founder notes a UI clarity gap: you cannot tell at a glance whether you are logging HISTORY (completed) or scheduling FUTURE (next step) without scrolling down to the "Schedule a next step" section. Idea: visually separate the two zones — e.g. two labeled frames/bands "What happened" (history) vs "What is next" (future), or a mode banner driven by the status toggle. Constraint: modal is ~500px wide so a 2-column split risks cramping + mobile; labeled stacked bands likely cleaner. Cosmetic polish, not functional — deferred to post-handoff. Founder flagged, architect to design properly later.

## RESOLVED Day48 Reports data-leak FIXED+VERIFIED. ReportsModule had ZERO access control - sales_agent could open Agent Performance and see ALL agents (names/roles/deals/pipeline/won). FIX: imported canDo, gated agent_performance + lead_conversion behind see_all (see_branch_data) at tab list line 336, guarded activeReport default. Agents now see only Pipeline/Sales Payments/Tasks (self-scoped); admin/manager/super_admin see all 5. Verified both logins. Commit 30c8b34 tag reports-leak-gate-day48. DEFERRED: report count-accuracy (Tasks shows 0 despite existing) = part of dashboard/reports listings+duplicates cleanup, handle at end.

## Day49 AI Coach agent smoke-test PASSED. testagent4 sees only own book (1 deal AED 0.50M) - correctly scoped, no cross-agent leak (unlike Reports). Scope selector role-aware. Analysis engine proven prior sessions. AGENT SMOKE-TEST COMPLETE: Leads/Opportunities/Lead Assignment/Reports/Customers/AI Coach all swept + scoping correct. Handoff-readiness milestone.

## Day49 SEED tweak — managers view-only on master agreements (DONE+VERIFIED). sales_manager + leasing_manager manage_master_agreements default flipped TRUE->FALSE across all 7 companies (view_master_agreements stays true; admin keeps manage=true). Crown-jewel commission contracts default to owner/admin only; org can toggle managers back ON per role in Settings > Role Capabilities (enabler model). Tag pre-seed-mgr-masteragreements-day49 (revertable). DB seed change, no code. Rest of seed matrix reviewed = sound (agent reserve_units/edit_records left as-is; viewer near-useless by hard-coded nav = Phase 2 Roles Configurability arc).

## PHASE 2 STICKY (Day49) — Users screen: add search + filters. Founder note: Users list (20 users) needs a find/search box + filters (by company, role, status) so when working across group/branches an admin can clearly see + confirm what they are viewing/adding. Company column already shows; missing = search + filter controls. Also seed verified LIVE: sales_manager (Arun Kumar) correctly has NO Master Agreements tab (manage_master_agreements=false hides it; org can toggle ON in Settings). Non-blocking polish, post-handoff.

## Day49 FINDING — branch-manager concept UNBUILT (defer to Phase 2). profiles has NO branch_id column; companies has group_id but branch layer not wired. sales_manager see_branch_data=true has NO structure to resolve against -> manager (Arun Kumar) sees no branch leads/opps (and has no own assigned data either). NOT a bug = the group/branch hierarchy is the documented Phase 2 arc (Phase_2_Identity_And_Settings_Design.md Stage 2). Branch-manager testing deferred until group/branch structure is built. Founder decision: cover other manager issues now, revisit branch when built.

## Day49 Manager Reports gating VERIFIED (was stale session, NOT a bug). sales_manager (Arun Kumar, see_branch_data=true) initially showed only 3 reports; after fresh deploy+login he correctly sees ALL 5 (Pipeline/Sales Payments/Agent Performance/Lead Conversion/Tasks). Reports gate confirmed working ALL tiers: agent=3 (mgmt hidden), manager=5, super_admin=5. The 0-data in Lead Conversion + Tasks for Arun = EXPECTED (he has 0 assigned leads/opps + branch layer unbuilt so see_branch_data has nothing to widen to) - NOT a bug. Temp debug log added+stripped. Tag pre-mgr-reports-debug-day49. LESSON: capability changes need fresh login (caps load at login) - stale sessions mislead.

## PHASE 2 STICKY (Day49) — Commission EARNINGS views (own + team) missing. Commission Outstanding page = RECEIVABLES only (developer->brokerage incoming). Founder notes it does NOT show: (1) a manager/agents OWN commission entitlement (what they personally earn across their deals), (2) a managers TEAM commission (what his agents earn). FOUND: config EXISTS (settings/AgentBracketsSection + CommissionSettingsSection define earning rules/brackets; OpportunityDetail shows per-deal commission) but NO dedicated EARNINGS VIEW (personal or team). Team-earnings view also needs the unbuilt branch/team structure. = internal commission-distribution views, distinct from receivables tracker. Phase 2. Ties to see_own_commission cap + branch layer.

## Day49 refinement — commission model = RECEIVABLES (developer->brokerage, incoming, BUILT = Commission Outstanding) vs PAYABLES (brokerage->team/agents, outgoing, PHASE 2 = the earnings views above). Founder framing: separate these two cleanly. Payables view waits for Phase 2.

## Day49 CLARIFICATION (founder) — super_admin OPEN BY DESIGN during testing/build. Abid/super_admin deliberately attached to Al Mansoori company + kept wide-open (sees ALL screens/data/companies) for end-to-end testing. When group layer comes, super_admin (PropCRM platform) STAYS open to see all. AT GO-LIVE: strip super_admin to ONLY onboarding + settings (the Multi-Tenant Identity split, Architecture_Multi_Tenant_Identity_Model.md). So super_admin seeing everything now = intended, not a leak. Corollary: if super_admin CANT see a screen (e.g. Commission Outstanding), that IS a bug to check.
## Day49 PHASE 2 ARC — Executive/BI & Consolidation layer = ONE effort: viewer role (top-mgmt read-only) + dashboard-analytics-redesign (analytics not listings) + group/branch consolidation roll-ups + slice/dice/graphs/drilldowns. Founder: top-down approach, do AFTER Phase 2 core (branch/identity) built. Do NOT design piecemeal now.

## ── DAY 49 SESSION CLOSE (clean checkpoint HEAD aeb0f29, tag day49-manager-seed-verified) ──
DONE Day 49: (1) Agent smoke-test COMPLETE (all 6 surfaces). (2) Seed-defaults review DONE — sales_manager+leasing_manager manage_master_agreements flipped to FALSE (view-only default, org-toggles in Settings); rest of matrix sound. (3) Manager tier SWEPT + verified live (Arun Kumar): Master Agreements tab correctly hidden; Reports gating works ALL tiers (agent=3/manager=5/super_admin=5) — earlier "missing" was STALE SESSION not a bug; Commission Outstanding access OK. (4) Branch-manager = UNBUILT (no branch_id col) — deferred Phase 2. (5) Clarified: super_admin OPEN BY DESIGN during testing, lockdown at go-live. 
PHASE 2 STICKIES captured Day 49: Users search+filter; commission PAYABLES/earnings views (own+team, vs receivables which is built); Executive/BI & Consolidation layer = ONE arc (viewer + dashboard-analytics + group/branch rollups) — deferred until AFTER Phase 2 core (branch/identity).
NEXT SESSION: role-tier walkthrough essentially complete. Options: quick-verify super_admin sees Commission Outstanding (minor flag); sweep un-walked screens (Projects/PropPulse/Inventory detail); or begin Phase 2 planning. Tree clean, all pushed.

## Day49 FIX — RLS has_capability() now honors super_admin (root fix, DB). BUG: super_admin saw BLANK Commission Outstanding while sales_manager saw full data (AED 1.4M) on same company. ROOT CAUSE: RLS SELECT policy on pp_commission_invoices requires has_capability(see_brokerage_commission); the DB function has_capability() looked up role_capabilities table where super_admin has ZERO rows (super_admin bypasses via is_super_admin FLAG in app code, but DB function did not know) -> returned false -> RLS blocked super_admin on EVERY has_capability-gated table. FIX: added super_admin short-circuit to has_capability() function: returns true if is_super_admin=true, else the normal role_capabilities lookup (other users UNCHANGED). Verified live: super_admin now sees Commission Outstanding data. REVERT: original function body was just the COALESCE(role_capabilities lookup) without the EXISTS super_admin check. Fixes super_admin visibility app-wide (Commission was the symptom caught).

## Day49 has_capability() blast-radius VERIFIED clean. Surveyed all RLS policies using has_capability(): activities/leads/opportunities/pp_commission_invoices SELECT (super_admin sees all = intended), pp_master_agreements INSERT+UPDATE + profiles UPDATE (super_admin manages = intended). All 7 = intended super_admin behavior, no surprise write/delete exposure. Root fix confirmed correct both-ways.

## Day49 PHASE 2 START-POINT — Group View (Consolidated) shell BUILT, branch/group structure NOT. Group View renders: Group Pipeline AED 56.83M, 1 branch, 12 agents, Branch Comparison table = WORKING UI SCAFFOLD for the Executive/BI & Consolidation arc. BUT underlying structure missing: profiles has no branch_id, companies.group_id exists but not wired -> Group View currently treats the COMPANY as a single implicit branch (shows 1 branch = Al Mansoori itself). PHASE 2 STAGE 2 = wire the STRUCTURE beneath this existing shell: add branch_id to profiles, branch entities, assign agents to branches, wire companies.group_id into a real group-of-branches. The destination UI (Group View) already exists; the data model is the build. Clean start point for Stage 2.

## Day50 CLEANUP DONE — orphaned test auth.users purged. Deleted 8 orphaned auth.users (no valid profile: finalagent2026@abcdef.ae, finaltest@proptest.ae, finaltestagent2026@test.ae, newagent@proptest.ae, test2026v3@test.ae, testagent123@proptest.ae, testinsert@proptest.ae, testuser123@abcdefg.ae) + their auth.identities/auth.sessions, in FK-safe order (dependents first, then users), scoped strictly to profile-less rows. Verified remaining_orphans=0. Tester auth env clean.

## Day50 VAT check — commission VAT IS handled (not a gap). pp_commission_invoices has vat_pct/vat_amount/commission_net; CommissionOutstanding.jsx displays "VAT @ X%" (line 586) + CSV exports VAT column (line 303/315). Founder flagged possible VAT-missing concern -> verified PRESENT in receivables flow. TESTING CHECKLIST: during walkthrough, confirm VAT shows correctly on (a) commission invoices, (b) any proposal/quote client-facing commission display, then CLOSE. Not a build item.

## PHASE 2 DESIGN (Day50) — Flexible ORG HIERARCHY + Legal Entities (founder input). Do NOT force rigid branch-vs-company (A/B). UAE reality = ALL combos: many companies under one group; one company with emirate branches (DXB/SHJ/AJMAN/ABUDHABI); acquired companies slotted under groups; hybrids. ARCHITECT DIRECTION: model as a self-referencing entity tree — org_units/legal_entities table with parent_id + type (group/company/branch), handles any depth/combo. Capture per legal entity: legal_name, trade_registration_no, vat_registration_no. This replaces the current flat companies model + gives Group View real multi-branch structure + lets see_branch_data resolve. VAT already handled in commission calcs (confirmed Day50); entity vat_registration_no feeds invoice/tax correctness. = the Stage 2 structural build beneath the existing Group View shell. Design-first; build deliberately when Stage 2 starts.

## Phase2 Stage2 SCHEMA DONE (Day50). companies extended: parent_id(uuid FK self), unit_type(text default company), legal_name, vat_registration_no — all nullable, zero break. profiles.branch_id added (uuid FK companies, nullable). Created 2 test branches under Al Mansoori: Dubai (5f4bd32e), Abu Dhabi (19496e2f) — unit_type=branch, parent=c23a2320. Assigned to Dubai branch: Arun Kumar(mgr)+Test Agent4+Rajesh Haridas+abc; 3 others unassigned (test scoping). All DB-only + additive so far — app code untouched, still works. Tag phase2-stage2-schema-done, golden-pre-phase2-stage2. NEXT: Step 5 wire see_branch_data to resolve via branch_id (first app-code change = real risk begins).

## Day50 PHASE 2 STAGE 2 — SCHEMA FOUNDATION DONE (DB only, app untouched, tag phase2-stage2-schema-done). Extended companies: parent_id (self-ref FK), unit_type (group/company/branch, default company), legal_name, vat_registration_no — all nullable/additive/zero-break. Added profiles.branch_id (nullable FK to companies.id). Created 2 test branches under Al Mansoori: "Al Mansoori — Dubai" 5f4bd32e-77bb-45db-adb0-112cd7ff3ab1 + "Al Mansoori — Abu Dhabi" 19496e2f-b4a8-4f77-854e-44db0fdad593 (unit_type=branch, parent_id=Al Mansoori c23a2320, same group_id). Assigned to Dubai branch: Arun Kumar(mgr)+Test Agent4+Rajesh Haridas+abc; left null: New Test user 14, Test Admin User, Test Manager (for scoping test). Self-ref tree PROVEN. NEXT (Step 5, first APP-CODE change=real risk): wire see_branch_data to resolve against profiles.branch_id so manager sees his branch agents data. NOTE: branches now appear as rows in companies -> will show in super_admin company selector (expected, refine display later).

## Day50 DATA-HYGIENE STICKY — test data owner-mismatch (NOT a code bug). Branch-scoping (leads/opps/activities) VERIFIED WORKING: Arun (Dubai mgr) correctly sees Rajesh Haridas Dubai-branch won opps (EBT-07-03, DAM-07-03). BUT Customers shows 0 because the underlying customer-LEADS are owned by Abid/super_admin (branch_id=null) while their OPPS were reassigned to Rajesh via BACKEND SQL - owner-mismatch from manual backend transfers (opp-owner changed, lead-owner not). = dirty test data, not a scoping bug. Founder agrees: needs a deliberate TEST-DATA RESET pass (align lead/opp/customer owners to consistent state) rather than per-screen debugging - else same discussion recurs. NOTE valid case: a real lead/opp transfer where receiver closes it legitimately belongs to receiver; only the backend-injected inconsistent transfers are the mess. Do the reset as a deliberate activity before tester handoff.

## Day50 PHASE 2 STAGE 2 — ORG-CHART SCREEN (founder-requested, build AFTER data layer). A professional visual reporting-structure screen: cards per person with profile pics, showing the manager_id chain (agent->branch mgr->group mgr->GM->owner, any depth), able to add/reassign reports + upload pics. Build on top of the completed manager_id reporting engine (data first, UI second). Uses profiles.manager_id + branch_id + org tree. Design: clean card-based hierarchy view, drag/reassign or dropdown-reassign, pic upload to Supabase storage.

## Day50 MILESTONE — Phase 2 Stage 2 REPORTING LAYER DONE + VERIFIED (tag phase2-stage2-reporting-layer-done). Added profiles.manager_id (self-ref FK, nullable, re-assignable = reports-to spine, any depth). Seeded test chain: Test Agent4+Rajesh+abc -> manager_id=Arun(78284963); Arun -> manager_id=Raja Shekhar(333616cc, owner/admin); Raja -> null(top). Created recursive helper my_downline() [security definer stable, recursive CTE from auth.uid() down manager_id chain, returns all downline incl self]. Swapped RLS SELECT on leads + opportunities + activities: see_branch_data now resolves via assigned_to IN (my_downline()) OR own (activities via parent opp/lead assigned to downline). super_admin short-circuit + see_own_data + see_group_data UNCHANGED. VERIFIED LIVE: Arun (sales_manager) sees ONLY his team (Test Agent4 + Rajesh) leads/opps, not company-wide; super_admin sees all. MODEL: manager_id chain = who-reports-to-whom (agent->branch mgr->group mgr->GM->owner, any depth, insert tiers by re-pointing); org tree (companies parent_id) = where-they-sit. REVERT: original policies used branch_id grouping (assigned_to IN profiles WHERE branch_id=my_branch_id()); before that company-wide see_branch_data. NEXT: org-chart SCREEN (cards+pics+reassign, captured 737025d) on this engine. NOTE: my_branch_id() helper + branch_id still exist (superseded by downline for scoping but kept for org-unit placement).

## ── Day50 RESET TO GOLDEN (DB reverted; today Stage2 attempt undone) ──
WHY: discovered a PRE-EXISTING Day-29 company/branch model already LIVE + wired (groups table + branch_visibility isolated/group_admin_only/shared + getVisibleCompanyIds.js scope primitive + GroupBranchesSection + getGroupConsolidatedData). Todays Stage-2 attempt (companies.parent_id tree + profiles.branch_id + my_branch_id() branch-scoped RLS) DUPLICATED/competed with it. Founder + architect call: reset, keep Day-29, re-found the NEW idea on it.
DB FULLY REVERTED to golden-pre-phase2-stage2: (1) leads/opps/activities SELECT policies restored to original (company+capability, no branch/downline); (2) dropped functions my_downline() + my_branch_id(); (3) deleted 2 test branches (Al Mansoori Dubai/Abu Dhabi); (4) dropped columns profiles.branch_id, profiles.manager_id, companies.parent_id/unit_type/legal_name/vat_registration_no. Verified: 0 branch rows, 0 leftover columns. Code never materially changed (Stage2 was ~90% DB; only doc appends). HEAD 74fc24c = clean golden-equivalent.
ARCHITECT VERDICT (kept for next session): (A) COMPANY/BRANCH visibility = KEEP DAY-29 (groups+branch_visibility+getVisibleCompanyIds — same principle as todays, more complete, already live/wired). (B) PERSON/REPORTING (manager_id chain + downline) = GOOD NEW IDEA, never in Day-29, freshly formulated Day50 — RE-FOUND it ON TOP of Day-29 (not a parallel tree). (C) DROP the duplicate parent_id/my_branch_id approach (done).
NEXT SESSION START: FIRST fully study the Day-29 model (read getVisibleCompanyIds.js, getGroupConsolidatedData.js, GroupBranchesSection.jsx, groups table, branch_visibility) BEFORE any build. THEN design the reporting-chain (manager_id) addition to FIT Day-29. Do NOT re-add parent_id. LESSON: read for pre-existing feature machinery (grep components + tables) before building new Stage work — the Day-29 GroupBranches work was not surfaced in HANDOFF and caused a duplicate build.

## Day50 DAY-29 MODEL STUDIED — reconciliation design LOCKED. Day-29 = coherent COMPANY/BRANCH model, 3 files one pattern (company->group_id->group+sibling branches sharing group_id): getVisibleCompanyIds.js (scope primitive: which COMPANIES via branch_visibility+see_all), getGroupConsolidatedData.js (Group View rollup: aggregates opps/agents per branch by company_id), GroupBranchesSection.jsx (Settings display). Branches = companies sharing group_id. Capability-driven, fail-safe [own]. COMPLETE for company/branch level. GAP: no person-to-person reporting (branch lumps all agents; no Mgr-A-team vs Mgr-B-team WITHIN a branch). RE-FOUND PLAN (clean, additive to Day-29, NO duplicate): keep Day-29 100% untouched; add ONLY profiles.manager_id (reporting line); person-level team scoping refines WHO within your visible companies you see (works within a branch, does not replace branch visibility). NO parent_id, NO my_branch_id, NO duplicate tree (that was the Day50 mistake, reverted). manager_id is purely additive. Data verified clean post-reset: 0 records orphaned to deleted branch ids. NEXT BUILD: profiles.manager_id + team scoping layered on Day-29 + org-chart screen reading manager_id.

## Day50 ARCHITECTURE + MIGRATION notes (founder Qs, FUTURE not now). PORTABILITY: app fully OS-portable (React+Vite static, Node cross-platform, MINGW64/CRLF=local-dev-only not runtime). LOCK-IN = Supabase (DB+Auth+RLS), the migration-heavy one; Vercel/Anthropic/npm are easy/portable. RLS does NOT port to Oracle (=VPD rewrite + auth.uid() replacement). VERDICT: DB-hardening was the RIGHT tradeoff (secure+fast multi-tenancy now) NOT a mistake — standard startup choice; coupling is accepted+known, not a trap. FUTURE Oracle migration: Claude can accelerate ~70-80% (read/inventory all policies+functions, translate DDL, RLS->VPD, plpgsql->PL/SQL, design auth rewire); human+ops needed for security-testing each VPD policy, data transfer (ora2pg), auth swap = weeks-project not one-click. CHEAP PREP HABITS (adopt now, dont build migration): document every RLS policy/function in HANDOFF (=migration map), prefer app-layer helpers for NEW logic where reasonable (e.g. getMyTeamIds.js ports trivially), keep a DB-logic registry. Decision: stay Supabase now, adopt prep habits, dont deepen lock-in unnecessarily, dont rip out working RLS.

## Day50 MILESTONE — Phase 2 Stage 2 REPORTING LAYER done+verified, CLEAN rebuild (tag phase2-stage2-reporting-clean-done). After the earlier reset (dropped the duplicate parent_id tree), rebuilt person-level reporting cleanly ON TOP of Day-29: profiles.manager_id (self-ref, re-assignable, any depth) + recursive my_downline() helper (walks manager_id down, multi-level, role-agnostic, no hardcode) + getMyTeamIds.js app-layer helper (commit 10a3151, portable). RLS SELECT on leads+opps+activities: see_branch_data resolves via assigned_to IN (my_downline()); super_admin + see_own_data + see_group_data UNCHANGED; Day-29 company/branch model (groups+branch_visibility+getVisibleCompanyIds) UNTOUCHED. NO parent_id tree, NO my_branch_id (the earlier duplicate, stays dropped). VERIFIED LIVE: Arun (sales_manager) sees his team (Test Agent4+Rajesh+abc) leads+opps, multi-level; super_admin sees all. Arun Customers=0 = EXPECTED (customer-leads owned by Abid not his team = known dirty-data item, needs test-data reset pass). MODEL: manager_id chain=who-reports-to-whom any depth (agent->branch mgr->group mgr->GM->owner via role assignments, no hardcode); Day-29=which companies. NEXT: org-chart SCREEN (cards+manager_id hierarchy+reassign, pic-upload slot) reading manager_id.

## Day50 STICKY — VIEWER-as-GM + ROLE/ASSIGNMENT model (Phase 2 for the dashboard part). Founder model: viewer=a ROLE (read-only) ASSIGNED to a GM/Owner who wants FULL-VIEW across the whole app + a better exec dashboard, no editing (oversight seat). Admins=SUPPORT (back-office), sit OUTSIDE the sales chain, NOT above sales managers (founder: "if anyone sees this hierarchy they will kill me"). Sales chain=Agent->Sales Manager->GM(viewer)->Owner. THREE CLEAN SURFACES (no mid-flow mixing): (1) Users screen=assign a user ROLE (built, UsersTab.jsx); (2) Org Chart=assign a user MANAGER/manager_id (built this session, pencil edit); (3) Settings>Role Capabilities=tune what each role CAN DO (built, RoleCapabilitiesSection). DEFER to Phase 2: (a) grant viewer role broad READ (see_all) when it is the GM seat; (b) the better GM/executive oversight DASHBOARD (Executive/BI arc); (c) CUSTOM role-NAME creation form (Configurable Roles per Company - already in backlog; not needed for handoff, 8 roles+tunable caps suffice now). No new form needed now.

## Day50 MILESTONE - Org Chart DONE (tag phase2-stage2-orgchart-done, HEAD 4badca3). Compact flowchart, collapsible teams, Unassigned bucket, pencil-reassign. Verified Vercel: Test Viewer(GM)->Arun->3 agents; admins=support in Unassigned. Hierarchy org-correct (admins NOT above sales). manager_id: Test Viewer=null apex, Arun->1e07bc74, agents->78284963. Look is clean-but-plain: WOW-polish deferred to later pass. NEXT: wow polish + test-data reset.

## Day51 STICKY — END-TO-END TESTING ROUND (post-Stage-2, pre-go-live, founder-defined ~1-2 days). AFTER Stage 2 completes: take a couple of deals and walk them BACK-TO-BACK through the FULL workflow (lead->opp->proposal->negotiation->close->customer->commission), checking DATA at each step + REPORTS accuracy + every stage GATE + business LOGIC + workflow smoothness. Everything so far built in SILOS (unit-tested piecemeal); this is the integrated end-to-end validation that proves the whole journey holds together. A deliberate planned phase, NOT a quick task. Precedes go-live planning. SEPARATE from the Day50/51 test-data mess (that is just an unblock-dev nuisance handled by creating fresh consistent records now). This end-to-end round = a real pre-go-live milestone.

## Day51 ORG CHART — DONE + POLISHED (tag orgchart-wow-done, HEAD 59bf0e9). Horizontal space-filling tree: GM(apex star) top-center, managers side-by-side, teams beneath, compact horizontal cards (avatar left, ~50% shorter), thick dark connector lines + thick dark unassigned separator, uniform card size, role colors+legend, search, pencil-reassign. Founder: "looking amazing". TERMINOLOGY FIX: GM = GROUP MANAGER (mid-tier, manages branch managers), NOT General Manager/Owner. Full chain = Agent -> Branch Manager -> Group Manager(GM) -> General Manager/Owner(apex). manager_id chain handles all tiers same way (any depth, no hardcode) - naming only, no structural change. DEFERRED (revisit when real tiers built): (1) COLLAPSE/EXPAND toggles per manager (dropped in horizontal-layout switch; add when real multi-tier depth exists to test against - dont over-build vs thin test data); (2) add real Group Manager tier + more managers/agents then see+adjust. Founder call: stop polishing now, build real structure later then refine. Org chart functionally complete for handoff.

## Day51 DECISION LOCKED — ACCESS CONTROL = ROLES ONLY (no per-user overrides). Model: create user + attach a role (Users screen); roles carry capabilities (8 standard cover most); if brokerage needs different, CREATE A CUSTOM ROLE (clone standard, adjust capabilities, name it) + attach to users. NO per-user toggles (rejected: un-auditable, endless "where did access slip" debugging). Industry standard (Salesforce/HubSpot), clean+auditable+scalable. PHASE 2 (custom-role creation form = "Configurable Roles per Company" backlog); for handoff the 8 roles + Settings>Role Capabilities suffice. Locked now for unambiguous later build. ALSO: group rollup (many companies -> 1 group) ALREADY DONE via Day-29 (structure supports multi-branch, no dent tomorrow, populate when real, subtle future sticky). 1-sheet pictorial of companies+org flow = later nice-to-have.

## Day52 STICKY — SUPERADMIN / PropCRM-OPERATOR DASHBOARD (founder wants Claude 100% help on design; dedicated session). A DIFFERENT dashboard from the business/brokerage dashboard — this is the SERVICE-PROVIDER view for PropCRM consultants/admins monitoring ALL tenant brokerages. Founder has no tech reference for "what a SaaS provider should monitor" - Claude to bring the full design. CANDIDATE METRICS (Claude draft, refine in session): per-COMPANY health+activity (companywise listing = founder priority: users, active users, leads/opps/deals volume, last-activity/login), adoption+usage (logins, feature usage, DAU/MAU per tenant, dormant accounts), data health (records created, stale data, incomplete deals), commercial (per-tenant seat count, plan, billing signals), system (errors, failed logins, API/AI usage per tenant), onboarding funnel (new tenants, setup completion). Separate from PropPulse (which has its own solid doc - this is the APP-operations side). Gated to super_admin only. Phase 2 design+build, dedicated session. Founder: "watch company-by-company" is the core lens.

## Day52 DONE — Users search+filters COMPLETE + one-row (HEAD 61c3b24). UsersTab.jsx (rendered via UserManagement inline wrapper in App.jsx line 2153 -> subTab "users" -> UsersTab; "settings" subTab -> SettingsTab). Added: search name/email + role + status + company(super_admin) filters, filtered count. LAYOUT SAGA: controls kept stacking vertically; not cache/wrong-file — fixed by forcing container flexWrap:nowrap + explicit widths (search 220, selects 140) + flexShrink:0 = one compact row. LESSON: when inline flex still wraps, force nowrap+fixed-widths+flexShrink:0 decisively rather than long CSS hunts. OPEN STICKIES: (1) Users-screen "⚙ Settings" sub-tab (SettingsTab: CRM Mode/Company Name/Currency) — founder questioned why it exists, possibly legacy/duplicate of main Settings nav; investigate keep/remove/merge (deferred, separate). (2) UserManagement still INLINE in App.jsx line 2153 (small sub-tab wrapper) — un-refactored, low priority. (3) data-hygiene: some users show Company "—" (null company_id): testagent@testmans3.ae, testagent@testmans2.ae, freshtest2026@test.ae = orphaned test accounts, eventual cleanup.

## Day52 SETTINGS-TAB (Users>Settings subtab) FULLY MAPPED — evidence-based, do NOT blind-remove. SettingsTab.jsx = legacy app-config form (own comment: "FUTURE: fold into new settings/SettingsPage pre-go-live"). 4 fields, wiring VERIFIED by grep: (1) CRM Mode cfg.mode = LIVE/LOAD-BEARING — App.jsx L2554 MODE_TABS[cfg.mode] controls which tabs show (Sales/Leasing/Both); NOTE L2553 top app-toggle overrides cfg.mode when app explicitly selected. (2) Company Name cfg.company = NOT WIRED — nothing reads it to rename app (grep hits are unrelated CSS .company / currentUser.company); renaming PropCRM->X does nothing today. (3) Currency cfg.currency = NOT WIRED — ZERO reads outside SettingsTab; AED is hard-coded everywhere; changing it does nothing today. (4) Country cfg.country = set in state, no input shown, unused. VERDICT: it is a half-wired WHITE-LABEL/multi-stream STUB (founder vision: rename app, set currency, add streams like contracting/FMS) — intent present, only CRM Mode actually plumbed. Removing = breaks CRM Mode switcher. SAFE PATH (Phase 2 pre-go-live settings-consolidation): migrate CRM Mode into main-nav Settings hub; then either WIRE company/currency to real displays (deliver the white-label feature) OR retire them. Deliberate migration, NOT a blind delete. Founder instinct correctly flagged this as load-bearing.

## Day52 SLIM-LEAD REDESIGN — Step 1 DONE, rest = clean rebuild next session. VISION (founder): LeadDetail is cramped + has BROKEN nested-scroll (opps "shows N but no render", sticks at heading). FIX = slim lead: every section a COLLAPSIBLE TILE (click header expand/collapse). Sections: Identity/Notes, People (who-is-who comms map: decision-maker + office/coordinator/payment contacts for foreign investors), Communications&Activities, Opportunities, Proposals. SEPARATE Phase-2 piece: Client-360 = its OWN new page/tab (glance summary: active opps/closed won/total business value AED/last activity + full history) — NOT crammed in lead. DONE: Step 1 Activities section collapsible (commit ed99cb2, actExpanded useState, wraps ActivitiesList, collapsed default) — LIVE + verified beautiful. BLOCKED: Step 2 Opportunities collapsible FAILED TWICE via in-place anchor-wrap (JSX Expected , or ) errors) — the opps block (line ~689) is too tangled (empty-state + LogActivityModal + table nested) to wrap safely; reverted clean both times (no broken commit). ARCHITECT DECISION: do NOT keep patching tangled JSX; NEXT SESSION rewrite the whole LeadDetail detail-view (view==="lead" return, ~line 408-900) as clean collapsible tiles from scratch, fully tested, delivered as clean block — not anchored patches. metrics for 360 use EXISTING calcs: leadOpps.filter(status Active/Won), reduce budget for value, leadActivities for last-activity. Safety tag pre-lead360-redesign at caba93a. LESSON: ActivitiesList wrap worked (single clean child); opps block wrap failed (tangle) - rewrite tangled sections wholesale, dont anchor-wrap.

## Day52 SLIM-LEAD — STOP piecemeal patching, do CLEAN REBUILD (founder call). Committed wins kept: Activities collapsible (ed99cb2), Opps render-bug FIXED (eea7e59, removed broken flex:1 overflowY trap), People collapsible (7600e7f). People tile has a DISPLAY quirk in the OLD tangled layout (button hard to see/locate despite grey bg + correct code) — NOT worth more piecemeal fixing since the WHOLE LeadDetail detail-view (view==="lead" return ~line 408-900) is getting rebuilt into clean collapsible tiles anyway. DECISION: leave People as-is (logically correct in code), fix all display polish in the CLEAN REBUILD where each tile is built right from scratch (no white-on-white, no jamming, consistent grey-bg tiles). Lesson: piecemeal wrapping of the tangled old detail-view fights us (6 exchanges on 1 People tile); the clean full-rebuild is the correct path. NEXT: rewrite LeadDetail detail-view as clean tile stack (Identity/Notes, People, Comms/Activities, Opportunities, Proposals) + separate Client-360 page. Safety tag pre-lead360-redesign at caba93a.

## Day52 LEAD 2-COLUMN LAYOUT — DONE + LIVE (tag lead-2col-done, merged ca17223). Fixed founder day-1 UI/UX complaint: lead detail-view was a single vertical column (flexDirection column, L410) = spread out, blank right side, more blank than data. FIX: wrapped the section-stack in a 2-column CSS grid (gridTemplateColumns minmax(0,1fr) minmax(0,1.1fr)) — LEFT col = Identity/Notes + People + Activities, RIGHT col (wider) = Opportunities. Header stays full-width on top. Fills screen, dense, professional. Built on safe branch lead-2col-redesign, functionally verified (opp opens, activities expand, people visible) BEFORE merge to main. Founder: "AMAZING looking great". Also earlier this session on the lead view: Activities collapsible (ed99cb2), Opps render-bug fixed (eea7e59), People reverted to plain-visible (6baabcf). LESSON: for bigger/riskier layout changes on the tangled LeadDetail file, work on a BRANCH (build+test freely, merge if good, abandon if not) — protected main throughout. Atomic abort-safe Python (all anchors verified before write) prevented half-broken states.

## Day52 CLIENT-360 — Stage 1+2 DONE + LIVE (tag client-360-stage2-done, merged 252451c). NEW client-at-a-glance page, built clean on branch client-360 (greenfield, no tangled-file fighting). Reached via "📊 360 View" button on lead header (gold, near Edit). Opens view==="client360" render: (Stage 1) glance strip = 4 cards Active Opportunities / Closed Won / Total Business AED / Last Activity, reusing RLS-scoped calcs (opps.filter lead_id + status Active/Won, budget-sum of Won, activities last-date); (Stage 2) Deals list below = each opp a clickable row (stage badge/title/unit/value/status) navigating to opp via onNavigateToOpp. Back-to-Lead button. Verified live on branch (Shrikant: 3 active opps, deals list shows 3, click opens opp). Founder: "perfectly shows". RLS CONFIRMED SOUND this session: leads/opps/activities SELECT policies correct (super_admin OR company + see_group_data OR see_branch_data via assigned_to IN my_downline() OR see_own_data); sales_manager role has see_branch_data=true → managers DO see team data; the "Customers=0 / 0 values" seen = KNOWN test-data mess (owner-mismatch), NOT an RLS bug — clean data will display correct. DEFERRED: Client-360 Stage 3 (activity timeline below deals) if wanted; manager-scope live test blocked by messy test-data (do after test-data reset). Branch workflow (build+test+merge) used again successfully. NEXT: possible Stage 3 timeline, or tester-readiness, or test-data reset for clean end-to-end.

## Day52 MANAGER-SCOPE + CLIENT-360 VERIFIED LIVE + test-data verdict. PROVED end-to-end from Arun (sales_manager) login: reassigned 6 test leads to Arun downline (Test Agent4/abc/Rajesh) — Arun then correctly SEES 7 team leads + 9 team opps, correctly scoped (owner col shows his agents), CANNOT see outside-team data. RLS manager-scope (see_branch_data via assigned_to IN my_downline()) = SOUND, verified with real data. Client-360 works. The "— (no lead)" on some of Arun opps = RLS working CORRECTLY: opp owned by Rajesh (his downline, visible) but that opp lead owned by Abid (outside downline, correctly HIDDEN) → shows dash. NOT a bug = test-data inconsistency (opps assigned to Rajesh but their leads left on Abid; leads+opps transferred independently over 50 days). ARCHITECT DECISION: do NOT surgically clean the messy test-data (whack-a-mole, risky, not a system bug). System is PROVEN sound. Defer to the END-TO-END TESTING ROUND (documented pre-go-live milestone): create a FEW FRESH consistent deals (lead+opp+activities all one owner) walked through full workflow = clean testing, not patched messy data. Per handoff principle: fresh consistent records NOT surgical realignment, dont wipe 50-day corpus. Reassignment done today (6 leads to Arun team) is reversible (set back to fa0aae73) but fine to keep — it made manager-scope testable.

## Day52 PHASE-2 THREAD — INTELLIGENCE LAYER (analysis-not-listing) — founder vision + architect patterns, DEDICATED design session later
CORE PRINCIPLE (founder, locked): NO repetitive listings across screens — if a list already exists elsewhere, don't repeat it; show ANALYSIS/INSIGHT instead. Client-360 activity-listing was built then REJECTED for exactly this (broker already saw activities on prior screen). Best analytics DESCRIBE + PRESCRIBE + BENCHMARK, not just list.

TWO-HEADED AI INTELLIGENCE:

(1) CUSTOMER-360 AI (client-facing, lives on the 360 page): understand the BUYER from lead+opp+customer+payment history.
- Founder points: buying behavior, payment behavior, appetite, buying-journey patterns, when-started/when-closed span.
- Architect adds: engagement temperature (heating/cooling via activity-freq trend), responsiveness score (their reply speed vs our chase), decision-style (deliberator vs impulsive by touches-per-stage), price-elasticity read (from negotiation push history), best-time-to-contact (day/hour response patterns), risk flags ("quiet 14d after proposal = slipping"), next-best-action (Coach focused on ONE client).

(2) EMPLOYEE-360 AI (via ORG-CHART person-click, manager clicks an agent): understand the BROKER.
- Founder points: how effectively he uses the app, how good a broker he is, total comparative business broken down by YEAR + MONTH, peak-month analysis, systematic-vs-adhoc/does-he-plan behavior, how he engages customers (task/engagement analysis not listing).
- Architect adds: effort-vs-outcome (activity volume vs deals closed), follow-up discipline (% deals with scheduled next-step vs left hanging), pipeline hygiene (stale deals on his watch), velocity (avg days/stage vs team avg), consistency (steady vs feast-famine + the INSIGHT not just the chart), coaching flags ("logs calls but never books site visits = skill gap").

DRILL-DOWN: details only on demand (dropdowns/expand) — Phase-2 "think about it", not default.
FOUNDATION: reuses existing AI plumbing (Coach, proposal extraction) = extension of proven capability, becomes a real MOAT. NOT new infra.
STATUS: rich strategic feature = its own DEDICATED design session (founder wants Claude to bring cross-industry patterns; founder brings UAE domain). NOT a rushed build. Captured so nothing lost. Client-360 currently = glance strip + deals list (live, bc1d7fd); insights layer replaces/augments later.

## ── DAY 60 (12 Jul) — CLEANUP R1 + FORM CONVERGENCE MERGED (main 0db60a9, tag cleanup-and-form-convergence-done) ──
DONE+VERIFIED PROD: (1) 30 orphans deleted (~2,384 lines; DiscountApprovals among them - founder: fine,
rebuild at developer persona). Build gate passed: 335 modules, 0 unresolved imports. Recover any file:
git checkout before-orphaned-cleanup -- path. (2) Saturation BOTH doors: async analyzeUnitSaturation
wired into CreateOpportunityDialog (was amputated-not-transplanted). (3) ONE FORM ONE TRUTH: LeadDetail
+New Opportunity (L546) -> setShowCanonicalOppDialog; all 4 entry paths on canonical dialog. Thin
OpportunityForm/Adapter now UNREACHABLE. (4) Gate removals merged (leadOpps>0 + SendQuote blocks gone).
NEXT: (a) Cleanup R2 by 25 Jul (docs/CLEANUP_CRITICAL_MUST_DO.md) - iterative dev-server method, fresh
branch+tag; include RETIRING OpportunityForm.jsx + OpportunityFormAdapter.jsx + showAddOpp modal in
LeadDetail (L40/294/1054-1080). (b) Settings consolidation remainder. (c) End-to-end testing round
with fresh clean deals. LESSON: heredocs >30 lines split on paste in MINGW64 - keep short or use Python.

## ── DAY 60 PM — CLEANUP ROUND 2 COMPLETE (main 9f20cb2, tag cleanup-round-2-done) ──
17 more files / 1,266 lines deleted, each verified by grep + build gate (333 modules, 0 unresolved):
thin form retired (OpportunityForm+Adapter+showAddOpp modal; ALL opp creation via canonical dialog,
AI promote-to-opp verified pre-filling it with saturation live); widget twins (DiscBadge/Empty/Spinner/
Toast - real ones in modules/shared); PwInput twin (live one = modules/auth, used by PwRecoveryForm);
UnitPickerRich; exportProposalPDF dup (LIVE PDF = src/lib/generateProposalPDF.js); comms stubs
(TemplateEngine/composeBundle/emailTemplates - rebuild properly in Phase 2.3); metadata/validation/
proposalSuccessHandler. KEPT BY DESIGN: leasing quartet, getMyTeamIds, getVisibleCompanyIds. Codebase
now fully accounted for. 25-Jul cleanup deadline CLOSED 13 days early.
NEW STICKY (founder, Day 60): FORGOT-PASSWORD missing on login screen - locked-out user has no path
(admin reset exposes password to 2nd person). Self-CHANGE exists (top-bar key modal, PwRecoveryForm).
BUILD: login link -> supabase resetPasswordForEmail -> existing recovery path (~1 hr). Also verify key
icon visible to agent role. Tester-blocker class - do before weekend handoff.

## ── DAY 60 CLOSE — MODULARITY AUDIT (founder Q: are we 100% modular? Honest answer: ~85%) ──
SOLID: file-level dedup COMPLETE (every src/ file imported or kept-by-design); single source of truth
PROVEN for opp creation (4 paths, 1 canonical dialog), lead creation, activity logging, canDo perms.
REMAINING for 100% (all in App.jsx ~2,866 lines) = DAY 61 PLAN, one auth-zone visit:
1. forgot-password build FIRST (tester-blocker; login link -> resetPasswordForEmail -> existing recovery)
2. inline PwInput (L336) duplicate of modules/auth/PwInput.jsx -> converge on module
3. inline auth screens (~L600-640) -> extract, use module PwInput + StrengthBar
4. UserManagement inline wrapper (~L2153) -> extract (known since Day 52)
5. inline Change-Password modal (~L2540) -> extract
6. legacy SettingsTab migration: CRM Mode is LOAD-BEARING (MODE_TABS reads cfg.mode) -> migrate to
   Settings hub, then wire-or-retire company/currency stubs (= Settings-consolidation remainder)
7. sweep App.jsx for further inline consts/components shadowing module versions (PwInput pattern)
END STATE: App.jsx = routing + composition only. Then modularity claim = 100%, not 85%.

## DAY 61 ITEM-1 CLOSED - FORGOT-PASSWORD VERIFIED E2E + SMTP HARDENED
Root cause of "no reset emails": Supabase BUILT-IN mailer (rate-limited, Hotmail-dropped) + Gmail-merge
inbox quirk hiding earlier mails. Code was ALWAYS complete (L620 link -> L607 send -> L2308 listener ->
L2441 PwRecoveryForm). FIX: custom SMTP via Resend (free 100/day). Account: mabid284@hotmail.com.
Config: sender onboarding@resend.dev / name PropCrm / host smtp.resend.com / port 465 / username resend /
password = Resend API key (propcrm-supabase). VERIFIED LIVE on production: send -> receive -> reset -> login.
GOTCHAS: username must be literal "resend"; sender email MUST be onboarding@resend.dev until own domain
verified (own-domain sender = Phase 2 polish); UI error box shows "{}" on auth 500s - display bug, real
error in Network response (polish sticky). ALL auth emails (invites, signups, resets) now via Resend.

## DAY 61 ITEM-7 SHADOW SWEEP DONE - 9 collisions found, DOCUMENTED NOT TOUCHED (pre-handoff risk call)
Inline components in App.jsx that also exist as files: Btn, Empty, FR, G3, LeasingDashboard, Modal,
RoleBadge, Spinner, Toast. Likely PwInput-pattern shadows (inline + modules/shared twin): Btn, Empty, FR,
Spinner, Toast, RoleBadge. Needs individual verdicts: G3, Modal. LeasingDashboard = leasing parked, do not
touch. Harmless at rest (each screen consistently uses its own resolution). Convergence = post-handoff
Items 3-6 arc (auth screens, UserManagement wrapper, ChangePassword modal, SettingsTab migration, these 9).
ITEMS 2+7 CLOSED today; 3-6 PARKED post-handoff by architect call: tester clock outranks hygiene.
PIVOT: tester-readiness - verify test accounts, then E2E round with fresh clean deals.

## DAY 61 CRITICAL FINDING - COLD-LOGIN EMPTY DATA (diagnosed, fix NEXT SESSION first task)
SYMPTOM: fresh login as scoped role (Arun/sales_manager) -> Leads shows 0/0 "No contacts found",
dashboard scoped tiles 0, while Recent Activity/units partially populate. Ctrl+Shift+R always cures.
Intermittent (timing-dependent). super_admin rarely affected. Tester-blocker class.
EVIDENCE CHAIN (all verified clean): lead assigned_to=testagent4 OK; manager chain testagent4->Arun
(78284963) OK; role_capabilities see_branch_data=true OK; leads_select_policy text OK; my_downline()
body OK (CTE replicated, returns team); has_capability() body OK (company+role scoped, fail-safe).
Manager visibility PROVEN working after refresh (Arun sees 8 leads incl fresh Julythe13th).
ROOT CAUSE (App.jsx master loader, effect at ~L2324, deps [currentUser, activeCompanyId]):
currentUser changes TWICE at login (restore ~L2291 sets profile; capabilities-attach L2277 sets NEW
object). Effect fires twice -> two overlapping 15-table Promise.all loads, NO cancellation between
runs. If run-1 (auth-not-fully-settled -> RLS returns empty) resolves AFTER run-2 (correct data),
stale empty arrays CLOBBER good data. Explains: intermittency, partial population (per-table race),
refresh-cures (single clean run), super_admin near-immunity (fast short-circuit).
FIX SHAPE (~10 lines, surgical): cancellation guard in the L2324 effect - let live=true, discard
results if !live on every setX, return ()=>{live=false}. Same pattern as saturation useEffect.
OPTIONAL hardening: skip run when currentUser exists but capabilities not yet attached (single
clean run instead of two).
VERIFICATION PLAN: repeated fresh incognito logins as Arun + testagent4 + super_admin (5x each,
timing-sensitive), leads/opps populated WITHOUT refresh; then normal regression (both opp doors).
DO FRESH: this effect is the app's data heart (15 tables + realtime channel) - no tired surgery.

## DAY 62 - COLD-LOGIN BUG KILLED + VERIFIED PROD (commit 6e5b3aa)
TWO-LAYER ROOT CAUSE, both fixed:
(1) Master loader (L2324 effect) double-fired on login (currentUser changes at restore AND caps-attach),
no cancellation -> stale run-1 clobbered run-2. FIX: live-flag cancellation guard, 4 checkpoints.
(2) THE REAL KILLER (probes proved it): loadUserCapabilities was scope-trapped INSIDE the auth useEffect.
restore() (same scope) worked -> refresh always cured. handleLogin (L2417, outside) hit ReferenceError,
silently swallowed -> caps NEVER loaded on login path -> canDo(see_all) false -> LeadDetail L235 filter
(see_all ? all : own-only) showed 0 for managers. Day-47 TDZ ghost, third + final appearance.
FIX: loadCapsRef (useRef) assigned inside effect, handleLogin calls loadCapsRef.current?.(user).
VERIFIED PROD 5-login gauntlet: testagent4=4 own / arun.k=8 team incl fresh lead / mah284=36 all -
instant, no refresh, correct scoping per role. RACE-PROBE debug lines stripped.
LESSON (3rd occurrence - now standing rule): functions called from handleLogin/outside MUST live at
component scope; anchored edits near the auth effect must re-verify scoping. Probe-first debugging
(2 console.logs) beat theory - instrumentation showed caps=false + 8-fetched-but-0-shown in one run.
NEXT: E2E Deal #1 continues as testagent4 (proposal -> promote to opp -> activities -> stages),
then Arun manager-view check on the deal.

## DAY 62 EVENING - GHOST-IDENTIFIER CLASS KILLED (2b896c9), AGENT DEAL-SPINE RUN New->Reserved
GHOST CLASS (bare identifiers used without import - invisible to build gate): 6 found via E2E clicks +
targeted sweep, ALL FIXED: OpenItemsGuard (was App.jsx-inline, crashed opp screen; extracted to
opportunities/, true boundary L645-820 - first cut over-grabbed to L842 incl mid-file refData import,
reverted clean, recut with eyes-on boundary); VisitOutcomeDialog/ProposalViewerDialog/
HandoverMeetingDialog/OutcomeModal (deleted in Cleanup R1, restored via git checkout
before-orphaned-cleanup, imports wired in OpportunityDetail+ActivitiesList); buildIcsEvent +
ASKS_GRID_OPTIONS (extraction-era missing imports in StageCaptureDialog/NegotiationRoundDialog).
LESSON: build gate misses bare-identifier usage; grep USAGE of deleted exports, not imports.
TOMORROW FIRST: generalized identifier sweep (components + CAPS constants + called functions) to
certify the class extinct before testers.
DEAL SPINE VERIFIED AS AGENT (deepest E2E ever): Julythe13th AGR-06-02 New->Contacted->Site Visit
(outcome captured via restored dialog)->Quoted(3 versions, V3 self-narrating DLD 50/50 change)->
Negotiation (round created)->Offer Accepted->RESERVED (AED 25,000 collected). Guard chain worked:
open-items dialog blocked proposal until visit outcome captured.
REMAINING SPINE: SPA Signed -> Closed Won -> customer conversion -> commission. Then Arun manager-view.
NEW CAPTURES: next-step ribbon lacks time+place for Meeting/SiteVisit (broker compensates via note);
service_charge_per_sqft missing on AGR units (maintenance calc warning); duplicate-key React warning
from the 3 dup opps (dup-gate evidence); FOUNDER FLAG: full Opps-journey UX review = dedicated future
design session (commercial flow must be smooth - proposals workspace, buyer outflow, tabs).

## DAY 62 NIGHT - CLOSE-WON GATE HIT (working as built, workflow redesign flagged)
Spine advanced Reserved -> SPA Signed OK. Close-Won dialog correct: final price LOCKED from SPA stage,
handover date, notes. BLOCKED by design: 'SPA document (signed) must be uploaded before closing as Won'
- the doc-discipline gate works. TOMORROW: upload a dummy signed SPA -> Close Won -> verify customer
conversion + commission record + dashboard tiles + 360.
FOUNDER WORKFLOW CAPTURE (for the dedicated Opps-journey design session, NOT a patch): stage ordering
wrong for UAE practice - SPA cannot be signed until ALL payment collected; payment-verification gate
must move BEFORE SPA Signed. Full Opp workflow (stages, gates, payment sequencing, proposals workspace
UX) = its own planned session with founder domain input.

## DAY 63 - SATURATION RPC + DUP GATE SHIPPED (cf6d391, tag saturation-rpc-dup-gate-done)
FEATURE COMPLETE: (1) get_unit_saturation(p_unit_id) - security definer SQL fn, counts-only
{total, mine}, hard-scoped to caller's company, grant to authenticated. Analyzer swapped .select
for .rpc - agents FINALLY see competitor pressure past RLS (verified: '3 active opps, 1 yours 2
others' as testagent4 on AGR-05-01). 3-day RLS-visibility saga closed with zero deal-detail leak.
(2) DUP GATE: amber warn (not block) when selectedLead already has Active opp on picked unit;
extra scoped query in same effect, deps [unit_id, selectedLead?.id]. Gotcha fixed: first cut used
nonexistent 'lead' var (silent no-op) - dialog's real state = selectedLead. NOTE: L266/275 in
CreateOpportunityDialog also reference bare 'lead' in other paths - audit those next session.
ALSO TODAY: nav tab overflow fixed (thin 4px scrollbar, was hidden - managers couldn't reach Org
Chart); 2 sweep ghosts wired (ProposalViewerDialog constants, PropertyMaster 8 imports - Inventory
master was a click-crash); AGR-06-02 confirmed Sold post-Close-Won = correctly absent from picker.
CAPTURES: org-chart edit controls unbuilt (manager can edit whole org incl super_admin - gate to
admin+); reports data quality = clean-data round; AI narration of saturation counts = Coach arc.
NEXT SESSION: audit bare-'lead' refs in dialog L266/275; SPA upload gate UI re-verify; Arun-view
checks done; then tester-package freshness + accounts doc = HANDOFF-READY for weekend.

## DAY 63 CLOSE - HANDOFF-READY MILESTONE REACHED
Prod smoke: saturation + dup-gate banners verified live as agent (incl negative gate on fresh unit).
Bare-'lead' audit: FALSE ALARM - loadConflictContext(lead) function parameter, healthy (grep blind
spot: params, like props). Tester package refreshed + 05_Tester_OnePager created (golden flow routes
testers through SPA-upload UI at step 6 = closes that sticky by test). Admin reset-password works on
prod (api/reset-password.js exists; localhost 404 = no api layer, known). ALL THREE ROLES LOG IN:
testagent4 / arun.k / viewer (password reset + verified).
REMAINING HUMAN STEPS (off-repo): share passwords + report channel; founder 30-min dry-run of the
golden flow before Saturday. Everything else on the lists = post-handoff by design.
STATUS: READY FOR WEEKEND TESTERS.

## DAY 63 BONUS BLOCK - polish + data hygiene (post HANDOFF-READY)
DATA: AGR-06-02 dup opp closed (status must be 'Lost' not 'Closed Lost' - CHECK constraint: status in
Active/Won/Lost/On Hold; stage carries 'Closed Lost'). Aldar Grove service charges: 15/sqft on projects
+ project_units + service_charge_yr computed - proposal maintenance warning should be gone (verify in
founder dry-run). Active-count landscape healthy: 4 units at 3 actives = saturation demos for testers.
CODE: ErrBox hardened (string/message/error_description/stringify guard, hides empty - no more {}).
Lifecycle Stage field moved adjacent to Buyer Intent in LeadCreationFormV2 + DEBUG console.log stripped.
bare-'lead' L266/275 = loadConflictContext param, healthy (audit closed).
PENDING (founder, pre-Saturday): 30-min golden-flow dry-run (incl SPA-upload UI at step 6 + service-
charge warning check); share passwords + report channel with testers.
SUPABASE EDITOR QUIRK noted by founder: hover on Run can eat composed SQL - workaround: compose in
Notepad, run with Ctrl+Enter.

## DAY 64 - AGENT MOTIVATION DISPLAY SHIPPED (230f8cd, tag agent-motivation-display-done)
AUDIT FIRST: Day-31 layer-2 mostly BUILT already - companies.default_agent_split_mode/value ('percentage'/40
set), Close-Won auto-computes agent_commission (17,690.64 = 44,226.60 x 40% verified) + company_net.
Missing was only per-user override (captured, later) and THE DISPLAY. Old May invoices: agent-less nulls
(pre-engine) - clean-data round, no backfill; tile sums handle nulls naturally.
BUILT: (A) opp-create banner 'Your estimated earning: AED X' - agents only, price x commission_pct x
company split, brokerage % never rendered (verified AED 39,958 = 2.497M x 4% x 40%; absent for super).
(B) Dashboard 'My Earnings' tile - agents only, exact AED, paid/pending sub (verified prod: AED 17,691).
RLS: invoices SELECT policy + arm (agent_id = auth.uid()) = Day-31 see_own_commission intent; DDL lesson:
verify policy list after DROP+CREATE pairs. NOTE: row exposes commission_gross to the agent (derivable
anyway - founder-accepted); column-hiding via view = Phase 2 if ever needed.
NEXT COMMISSION ITEM (founder spec, from tile feedback): tile onClick -> My Earnings detail view (agent's
own commission list: deal/unit/cut/status). Build after ranked Tue-Fri items.
QUEUE: founder dry-run (priority) -> next-step time+place -> TAB_CAPABILITY review -> org-chart gating.

## DAY 64 CLOSE - AUTO-ADVANCE V1 + LIFECYCLE SHIPPED (f4c876f, tag auto-advance-v1-done)
BUILT (Design Capture items 2+3, v1 slice): lib/autoAdvance.js - completed activity on New-stage opp
auto-advances to Contacted (stage update + journey auto-note activity_subtype auto_stage_advance +
toast); first completed activity flips lead raw->qualified. Wired BOTH save paths: opp FAB
(OpportunityDetail L5108 onSaved) + lead-side (LeadDetail L795 onSaved, w/ local-state flip so chip
moves without refresh). 5-state lifecycle chip in lead header (extended existing L379 badge map:
raw grey/qualified blue/active_prospect indigo/customer green/portfolio purple - founder chose single
auto-moving chip over journey bar).
BUG FIXED EN ROUTE: lifecycle casing chaos - LeadCreationFormV2 default was "Raw" (capital) vs
lowercase dropdown values; 5 capital rows in DB normalized via SQL lower(); form default fixed;
helper compares case-insensitively. LESSON: enum-ish text fields need canonical casing at every door.
VERIFIED: Shabbir raw->qualified LIVE on save (lead-side); New->Contacted cascade on opp FAB call.
DESIGN NOTES: auto-advance deliberately does NOT call moveStage (unit-conflict guard + capture
dialogs live there - blind calls would pop dialogs mid-save); direct stage update is correct for
the New->Contacted case where the activity IS the capture. Negotiation/SiteVisit auto-advance =
redesign session (capture-dialog interplay). Proposal-send already advances via builder.
CAPTURED FOLLOW-UP: lifecycle->active_prospect trigger lives ONLY in LeadDetail's create door -
must move into canonical CreateOpportunityDialog onCreated (all doors). Next block item.
PENDING: prod smoke of this merge; golden-flow dry-run STILL owed (the walk became the design
session - the click-through itself remains).

## DAY 64 LATE - LIFECYCLE DOOR-UNIFICATION (9ef29fb)
active_prospect trigger moved into canonical CreateOpportunityDialog post-create (all 4 doors fire it,
case-proof, setLeads local flip); LeadDetail door-specific copy removed. VERIFIED: Shabbir
qualified -> active_prospect via Opportunities-tab door. Full chain now live end-to-end:
raw -> (call) -> qualified -> (opp) -> active_prospect -> (won) -> customer, with deals
auto-advancing New -> Contacted on logged calls. The Day-64 design captures #2+#3 fully shipped.
PENDING NEXT: prod smoke of the evening merges (auto-advance + door-unification); ranked leftovers
(next-step time+place, TAB_CAPABILITY review, org-chart gating, My Earnings detail); golden-flow
click-through still owed.

## DAY 64 NIGHT - TIME+PLACE SHIPPED, SECURITY SESSION, PROD CERTIFIED
SHIPPED: next-step ns_time+ns_place (Location for Meeting/Visit only; scheduled_at real time not 9am;
narration 'at HH:MM / pin'; activities.location column added) + founder polish: ribbon hidden in
Scheduled mode (a schedule IS the step). Merged 6f4ffc3.
SECURITY: TAB_CAPABILITY + lead_queue/org_chart (assign_leads) + proppulse (use_proppulse - NEW
capability, seeded SQL all companies, admin+ default, Permissions-screen flippable per founder).
ROOT CAUSE CLASS: canDo requires the action in permissions.js ACTION map - unmapped = false for
non-admins (managers silently lose legit tabs; Commission Outstanding rendering was the tell that
caps loaded fine). LESSON: new capability = 3 steps: seed SQL + map entry + gate. Org Chart edit
controls gated manage_users (admin+); managers view whole org read-only (founder: no subtree split).
PROD CERTIFIED: auto-advance + lifecycle chain live (Shabbir active_prospect, both opps Contacted
with auto-notes visible). Time+place NOT yet re-smoked on prod post-merge (was mid-deploy at check).
NEXT SESSION PRIORITY: golden-flow click-through (the walk became the design session - the actual
tester-path run remains). Then: KYC v1 half-day, My Earnings detail, remaining list.

## DAY 65 CLOSE (15 Jul, ~7pm) - GOLDEN-FLOW WALK + FIX AFTERNOON
MORNING: full golden-flow click-through as agent on prod - spine passed 2nd complete run (GoldenFlow
Test1, AGR-13-09, 2.448M: lead -> quote -> promote -> auto-advance -> visit -> proposal -> nego ->
Offer -> Reserved -> SPA ledger + UI upload VERIFIED WORKING -> Won -> customer -> invoice).
Findings GF-01..22 in docs/Opps_Journey_Redesign_Capture.md + design amendments (booking/reservation
two-products, SPA-dialog job split, 5b charges ledger, one-unit-one-opp promote ruling, PM module
planned, north-star quote).
AFTERNOON FIXES SHIPPED (all on main, pushed):
- MONEY ARC 8e71325: GF-21 dedupe guard (one invoice/opp), GF-14 pct fallback at invoice time,
  falsy-0 fix; SQL heal (dup deleted, invoice recomputed 97,932/39,172.80/58,759.20). VERIFIED:
  My Earnings 56,863, full 3-layer commission panel, manager ledger consistent (drafts 6).
- GF-12 0225f77: manager_weekly + investor_quarterly gated behind see_all (agent verdict rides
  next agent login - not explicitly re-checked).
- GF-01 69713c5: quote PDF loops ALL units (verified 4-unit); GF-01b queued (per-unit project lookup
  - multi-project quotes show first unit's project on every card).
- GF-06+22 5eabb15: dead Log Activity tab button WIRED (showLog had NO render consumer - FAB modal
  cloned incl auto-advance); Sent Proposals dialog widened 760/560.
- GF-04b 864979c RESOLVED-BY-DESIGN: promote = one unit one opp (quotes are menus); v1 build queued:
  prefill unit[0] from STORED record, no AI on own PDFs; shortlist-tracking = architect homework.
- GF-07 (this commit): Location on main activity form, Meeting/Site Visit, any status.
REMAINING QUEUE: GF-02 promote-banner (mitigated by engine fallback - polish), GF-03 Unknown author,
GF-04 lead-side single-opp advance rule (build), GF-09/10 reservation display + ledger flow (money-tail
bricks), GF-15..18 dashboard/report sums + cosmetics (dashboards session), GF-19 developer_id (cured
at source when opps carry MA - promote polish), GF-20 viewer redesign (parked), KYC v1 (headliner),
My Earnings detail view. TOMORROW: KYC v1 + promote-v1 (stored-record prefill) my picks.
Screenshot budget exhausted mid-day - text-paste reporting worked well.

## DAY 65 EVENING SPRINT (post-break) - PROMOTE FAST-PATH SHIPPED (6acfcb3)
GF-04b v1 LIVE: Promote-to-Opp reads units_quoted[0] from the proposal ACTIVITY's structured_data
(id-first, unit_ref fallback; price from record with salePricing fallback) - instant prefill, NO AI
call for our own quotes; extraction demoted to fallback for external/legacy docs. Verified end-to-end
on localhost (old path 404'd there = proof of bypass) + DB row confirmed (DAM-09-05, 2,506,034, unit
linked). NOTE: dialog source = activities table type='proposal_sent' (NOT proposals table); the
units_quoted shape is {id, price, bedrooms, unit_ref}.
SIDE EFFECTS EXPECTED CURED WITH THIS PATH: GF-02 (banner should fire now - unit_id set pre-dialog,
MA effect runs; VERIFY next session), GF-19 (opps get MA when effect runs -> invoices link developer).
STILL QUEUED: GF-03 Unknown author (15min), GF-04 lead-side single-opp advance (20min), KYC v1
(tomorrow's headliner), My Earnings detail, GF-09/10 money-tail bricks, dashboards session.
DAY 66 PLAN: KYC v1 morning -> GF-03/04 -> prod smoke of fast-path + GF-02 banner verify.

## DAY 65 FINAL (evening extension) - GF-03 + GF-04 SHIPPED (512a446)
GF-03: proposal_sent author 'Unknown' = currentUser.name (undefined) - fixed to full_name. One token.
GF-04: lead-side auto-advance live - completed activity + exactly ONE active opp at New -> advance
with toast + local flip; 2+ opps or non-New -> untouched (founder rule). Verified both directions.
LESSON RE-BANKED: dev server restart needed after lib/flow merges - stale bundle caused a false
fast-path failure (slow + silent); restart cured instantly. Env-confusion (local vs prod) recurred -
tester one-pager should state env explicitly per step.
DAY 65 FULL TALLY: golden-flow walk (GF-01..22 + 6 design amendments) / money arc (13,14,21 killed,
data healed, engine hardened) / GF-12 report gating / GF-01 PDF loop / GF-06 dead button wired /
GF-22 dialog widened / GF-07 main-form location / GF-04b promote fast-path / GF-03 author / GF-04
lead-side advance. NINE findings killed same day they were found + one flow rebuilt.
DAY 66: KYC v1 headliner -> prod smoke (fast-path + GF-02 banner verify + GF-12 agent half) ->
My Earnings detail if runway. Saturday: testers.

## DAY 66 MORNING - KYC v1 + v1.1 SHIPPED (tags kyc-v1-done, kyc-v1-1-expiry-done)
V1: KYCDialog (4 states, in_progress='Docs Collected'); per-doc UPLOAD propcrm-files/kyc (real files
per founder); Verified needs passport+EID; auto-bump on first upload; clickable lead badge; SOFT GATES
Reserved(>=docs)/SPA(verified) w/ logged override (kyc_override); chip on Deal Journey (Reserved/SPA).
V1.1: per-doc EXPIRY (red border+banner); Verified blocked on expired identity docs; state
self-computes (expired identity->expired, any doc->in_progress); gates check expiry. Round-trip
verified incl recovery. STORAGE: INSERT+SELECT policies added, upsert:false; bucket PUBLIC - private
+ signed URLs post-testers. LESSONS: dev restart after every cut (3x); JSX escapes need JS-string
form; prompt wording matters. V2: hard no-override gate before govt proceedings (money-tail/Close-Won),
AI doc extraction, buyer-type matrices, SPA-party packs, auto-deselect-Verified UX.
QUEUE: My Earnings detail, GF-09 reservation surface, GF-02 prod verify, remaining GF list.

## DAY 66 CLOSE (16 Jul, afternoon) - THE PRE-TESTER DAY
SHIPPED TODAY (all on main + prod): KYC v1 (dialog, uploads, gates, chip - tags kyc-v1-done) +
v1.1 expiry (kyc-v1-1-expiry-done) | My Earnings detail modal | GF-09 Reservation card |
GF-19 developer fallback PROVEN via fresh walk (Sobha invoice 92,991.96 via unit->project; backfill
healed all 12 historical) | V_LATEST FLOW FIX (headline: onSaved carries cascade fields + setter-guard
stale-closure fix - SPA dialog now pre-fills negotiated price 5,571,155, DLD terms, reservation 25k,
AND resurrected the dormant plan-derived initial advance 557,116) | pencil escape fix | tester
package refreshed (env clarity, MA-optional, negative-testing invite).
WALK SIBLINGS BANKED (Opps_Journey_Redesign_Capture.md): evidence gates (money-without-proposal hole,
PRODUCTION-CRITICAL), lock-at-true-SPA-Signed ruling (proposals stay open through payment collection),
SPA Requirements->SPA Signed stage split, ask-then-credit layout, SPA fee from settings, door
consistency (opps-form skips budget), Quoted pill semantics, negative-testing workstream.
SATURDAY: testers on prod. Founder can push back if needed but app is in best-ever shape.
NEXT SESSION: fresh chat, read this HANDOFF; remaining queue: GF-17/18 cosmetics, GF-15/16 dashboards
session, evidence-gates design, money-tail redesign, clean-data round before/after testers.

## DAY 66 EVENING BLOCK - EVIDENCE GATE + COSMETICS
EVIDENCE GATE v1 SHIPPED (86de45c): Reserve/SPA with zero sent proposals prompts w/ logged override
(evidence_override). Verified firing. DESIGN RULINGS: soft-not-hard CORRECT (Path B reserve-first
broker games real; hard stop drives deals out of CRM); override makes wilderness VISIBLE + queryable.
GF-17 + GF-18 killed: duplicate active-opp chip removed; AED-AED doubling (fmtM embeds AED, L157
double-prefixed) dead.
ARCHITECT HOMEWORK COMMISSIONED (founder): survey the wilderness - Path B games, post-reservation
renegotiation w/ smart controls, unit-switch fund transfer, Launch Mode kiosk, block sales, developer
repricing, intent-vs-consequence override logging - return ONE coherent design: controlled, traceable,
flexible, easy. Deal-spine doctrine banked: proposal=record-made-visible, negotiation=convergence,
Reserve=confirmation-by-money; post-Reserve changes = controlled exceptions w/ ceremony.
DATA-SEMANTICS notes for clean-data round: Portfolio/Customer chips over-counting from test deals.
SATURDAY-READY: app + tester package + gates all live on prod.

## STOCK-TAKE (Day 66 close) - EVERYTHING PENDING, PRIORITIZED
### FRIDAY (deep work):
1. WILDERNESS DESIGN SESSION (architect homework due): Path B reserve-first, post-reservation
   renegotiation controls, unit-switch fund transfer, Launch Mode kiosk, block sales, developer
   repricing, override logging (intent vs consequence), evidence-gate v2 (unit-link hard),
   reserved-without-terms 'terms pending' state. ONE coherent design.
2. DASHBOARDS/REPORTS SESSION (GF-15/16 parked): value sums by stage wrong on dashboard + reports
   (Contacted/Site Visit showing 0.00M), dashboard vs report consistency, viewer/executive dashboard
   redesign (GF-20: viewer sees Add New Lead it can't use).
3. Money-tail redesign items if session runs long: SPA Requirements/SPA Signed stage split,
   ask-then-credit layout, SPA fee from settings, booking-fee product (5k immediate non-refundable).
### SATURDAY MORNING (landing strip):
4. CLEAN-DATA ROUND: wipe 66 days of test mess, seed fresh demo data (leads, 2-3 marched deals,
   MAs incl Sobha, clean invoices). Chip over-counting (Portfolio/Customer) resolves with it.
5. Prod smoke: full pass as agent + manager + viewer.
6. Tester credentials + package final check.
### QUEUED (post-testers):
- GF-01b per-unit project in multi-project PDFs | GF-10 full verify | Sent Proposals v-numbering
- Shortlist-engagement tracking design | map-pin location | KYC v2 (private bucket + signed URLs,
  buyer-type doc matrices, SPA-party packs, AI date extraction, hard gate at govt proceedings)
- Negative-testing workstream | rename decision (PropCRM collision) | Property Management module
- Comms overhaul | Manager dashboard | Leasing lead queue | identity-model split

## DAY 67 MIDDAY
SEED ALIVE: wiped (backups _bk_*_20260717), 9 leads/3 agents, Priya WON (invoice 58,384.88, V_latest
pre-fill VIRGIN-verified 1,459,622), James SPA Signed (25,100.48). Sobha re-proof rides testers.
BRICKS: Terms Pending chip + hint (Part 2 done). DOCTRINE: SPA form = record not police (broker
testimony); validator fixed - waived satisfies, 5000-workaround dead. BANKED: settings-feed audit,
First-instalment label, schedule-on-Financials, post-SPA lock cut open, deduction-display polish.

## DAY 67 LATE-MORNING - QUICK-SPA SHIPPED
QUICK-SPA TOGGLE live (28ccb7d): Record-SPA dialog = two faces. Quick: Price+Date+Ref+Upload+Confirm
(revenue-only broker's four fields, founder trust-moment design from internal broker arguments -
'my job ends when they paid the developer'). Detailed: full form (default). Company default:
companies.spa_mode ('detailed'|'quick', SQL-flippable, NO settings UI yet - flip on first tester
complaint or demo moment). Same engine, invoice fires either way.
BUILD SAGA (lessons re-struck): JSX wrap failed twice (conditional-boundary imbalance) -> take-three
= chunk-wise div wraps + container gating, ALL verified by python repr line-looks first; toggle
insert landed inside a JS string (comedy of errors: setSpa'quick'ode) -> collision-proof
placeholders (@@/##) + orphan sweep. Heredoc split on long lines AGAIN - keep scripts small.
ALSO THIS MORNING: closed-deal read-only guard (bb40250) - Won/Lost refuse all stage dialogs (pills
included; the live Record-SPA reopening on Won deals was one click from closure mutation).
STATE: main = seed alive + 4 wilderness bricks + quick-spa + all guards. Testers tonight (US late
night UAE). REMAINING: prod smoke, optional settings-feed audit, tester creds check.

## DAY 67 PRE-BREAK SEAL (~11am)
14 SHIPPED since 6:50am (chips/guards/Quick-SPA/fees/sums/marches/validator - see commits 9abe627
through 2327c96). ESSENTIALS ALL CLOSED: prod live+smoked, creds trio verified, package refreshed,
seed alive. Testers midnight - ZERO blockers.
RETURN BOARD (optional, post-break ~1pm, kickoff 2-3pm): A small-fry (GF-01b PDF projects,
v-numbering) | C ceremony Tier-2 brick | or rest. Parked-by-design backlog rides stage-split
foundation post-testers (come-back principle - no double-builds).

## DAY 67 ADDENDUM: #15 = By-Broker accordion in Pipeline Report (f0502aa, manager grouping umbrella first delivery). Kickoff 2-3pm; testers midnight; board clear.

## DAY 67 CLOSE (~1pm): 15 shipped, all merged, 3 gates ride tomorrow (By-Broker eyeball, hints polish, prod fees glance). Founder: team discussion tonight + testers midnight -> verdicts shape Saturday AM session. Next chat: read HANDOFF first.

## DAY 68 (18 Jul, Sat) - TESTER DEMO VERDICT + NEW OPERATING PLAN
3-HR DEMO NIGHT: testers THRILLED - SPA dual-face, MOAT APIs, AI-across-app all landed. They cannot test this weekend (engagements); will return with thoughts.
RATIFIED PLAN: founder COMPLETES the app -> production cut -> 1wk pre-prod -> 1wk findings/setup -> 2-day tester review -> close.
CONSEQUENCE: designed backlog = THE build list now (stage split first per wilderness build-order); no more ship-by-midnight constraints; proper foundation-first sequencing unlocked.

## DAY 68 MORNING - FOUR BRICKS: stage split (TAGGED stage-split-done, DB constraint extended), lock completed (SPA Signed = executed), Ceremony Tier-2 (reason+markers+badges, verified pr=true), Buyers bill tile on Financials. Terminology unification (Initial Payment/Advance family) banked for v2 layout. Build-order marching: next = unit switch brick or bill-first dialog rebuild.

## DAY 68 MIDDAY PARK (guest arrived): unit-switch brick MOSTLY VERIFIED on straight test (prompt+re-point+terms-clear all work; pr-badge crash FIXED mid-test - straight-test protocol RATIFIED after fogged regression debugging). OUTSTANDING on feature/unit-switch branch: chip switch-aware fix (written, run pending), builder-unit question (Edit V1 shows SHI or EBT?), timeline-note + EBT-Available verdicts, open-items guard found site-visit with stale unit ref (banked). Title still says AGR (banked). Saturation analyzer rpc broken (banked). Resume: run chip fix -> capture site visit outcome -> Edit V1 unit check -> verdicts -> commit+merge.

## DAY 68 CLOSE - FIVE BRICKS (record day): stage split (tagged) + lock + Tier-2 ceremony + Buyers bill + UNIT SWITCH (full ceremony: clash guard, clear guard, claim+release, terms reset, audit). Straight-test protocol RATIFIED (found 3 real bugs). Residual: EBT inventory heal SQL, saturation-analyzer rpc fix, Reserved hint text, title-embed question, aged-deal cleanup. NEXT: Launch Mode or dashboards redesign or negative-testing sweep - foundation is LAID.

## DAY 68 FINAL - SIX BRICKS: + LAUNCH MODE Phase 1 merged (schema w/ RLS, LaunchMode component in feature folder, rapid capture verified live, chunk-append method ratified for new files after heredoc failures). Phase 2 NEXT SESSION: Morning-After reconciliation queue + Convert-to-deal (opp born at Reserved w/ launch_record as E2 evidence, lands Terms Pending). Rocket icon lesson: python \U escapes do not survive into JS strings - write real chars via chr().

## DAY 68 GRAND CLOSE - SEVEN BRICKS: + Launch Phase 2 (convert-to-deal: lead match/create, opp born Reserved, inventory match attempt, audit note, record badge). Wilderness Parts 1-5 ALL SHIPPED. Remaining from wilderness doc: Block Sales (own design session). Khalid chip+timeline glance pending (protocol debt). NEXT SESSION OPTIONS: block sales design, dashboards redesign, bill-first SPA dialog v2, negative-testing sweep.

## DAY 68 NIGHT CAP - EIGHTH BRICK: bill-first SPA dialog v2 shipped (expected amounts pre-fill INTO fields on open, Received-tick stamps today+amount, Offer checkbox retired w/ info line). Founder ruling ratified live: field pre-fill editable, developer owns adjustments. OUTSTANDING SMALL: Gate-2 Offer info-line peek unverified, booking-row silent-resolve glance, commission price-source stale on switched deals (waterfall precedence), Reserve-button-at-Reserved sticky (read-only view or hide), DLD auto-received softening, L2233/2247 possible bill-tile twin. NEXT BIG: block sales design, dashboards redesign, negative sweep.

## DAY 68 TRUE CLOSE (founder ruling: end on wins, not midnight cuts): TOMORROW FIRST BRICK = SPA form ledger headline (Bill: X / Collected: Y / To Collect: Z computed from rows - the collection accounting explicit). Then: Gate-2 Offer peek, booking glance, Reserve-button hide.

## DAY 69 MID-MORNING PARK (founder in huddle): ledger headline SHIPPED (07ea350), smalls swept (b5b7ccf: Reserve-hide + Offer info-line verified). UMBRELLA IN PROGRESS uncommitted: viewMode state + pill-sets-view + advance-forces-edit + footer Amend-swap all coded+green BUT unverified - AND deeper truth found: Offer capture has NO persistence (only offer_valid_until field, no offer_accepted_at, no hydration) so reopen = genuinely blank. RESUME: (1) SHI-deal Reserved-pill probe (does footer say Amend?), (2) build Offer persistence + hydration, (3) then umbrella whole. Ledger numbers review still parked for day-end.

## DAY 69 GRAND CLOSE: ledger headline + smalls sweep + UMBRELLA WHOLE (view-mode/hydration/persistence/freshness/stage-race) + evening trio + WATERFALL at all three SPA engine sites + Khalid invoice healed + FULL LEDGER AUDIT PASSED. RATIFIED: founder tabular-ledger form = SPA v2 spec of record (Particulars/Expected/Received/Mode/Date/Accept-diff rows); Requirements = the processing period (NO new stage); invoice stays at Signed (domain); the RAZOR: engine/schema always, form-cosmetics defer to redesign; trust founder STOP as much as GO. Lessons: prompt-traps poison tabs, silent-skip guards drink waterfalls. PENDING: waived date-guard, Requirements-pill->Financials, gross-vs-net policy, valid_until persistence, scar-deal cleanup. NEXT BIGS: SPA v2 tabular build, block sales design, dashboards.

## DAY 69 POST-SEAL ADDENDUM (founder hint at close): SPA v2 = TWO FACES by broker archetype: (1) HORSE-RIDER face - final price + his commission, minimal (the closer mid-gallop); (2) DETAILS face - the full tabular ledger spec. The Day-67 Quick/Detailed toggle was v1 of this instinct; v2 designs each face FOR its broker. Both faces to be looked into at the v2 build.

## DAY 70 MORNING CLOSE - HONEST LEDGER COMPLETE (a7bca0c): founder tabular form BUILT + verified Path-A AND Path-B walks, all fabricators dead, frames unified, every number exact. GOLDEN TAG: honest-ledger-done. NEXT (same subject): variance-gate on Confirm, cold-look law, Diff->Variance + .00 micro-pass. PENDING: SPA-prep dialogue states, Offer arm, activities dedupe, end-state UX, service_charge gaps, scar cleanup.

## DAY 70 AFTERNOON PARK: umbrella RETIRED (8f5df54, all three dialogs honest records). Mid-hunt: activities double-render - realtime guard EXISTS (L446), suspect = L4005 onSaved optimistic append without some-guard (sed 4005-4015 next, fix = mirror the guard). Then: end-state UX naming, founder negative round, bigs.

## DAY 71 MIDDAY PARK (mid-graduation-walk): SHIPPED uncommitted: SPA-prep checklist card (spa_prep jsonb) + prep soft-gate + close-gate v2 (hard pending w/ see-the-bill Financials-open + materiality prompt w/ company tolerance settings close_variance_tolerance_aed/pct). RATIFIED: rebalance doctrine - primary gates move to Requirements->Signed transition, close keeps safety net (founder 100pct sync). Walk state: Khalid rung 1 fired (blocked on oqood, new words). RESUME: rung 2 (Amend->waive oqood->re-record) -> rung 3 (materiality ~4705>500) -> rung 4 (prep prompt -> WON) -> omnibus commit -> then the rebalance cut.

## DAY 71 CLOSE: close-discipline WHOLE both doors (ba61ff9) - dedupe, naming, prep checklist+gate, close v2 (hard+see-bill+materiality+company tolerance), lifecycle .catch kill, REBALANCE (primary at Reqs->Signed, net at close, fired live 351k vs 3.7k). NEW SLATED SUBJECT: UI/UX FLOW PASS (buttons/tabs/movement - founder-named imbalance, design-session-first per razor). NEXT: founder negative round OR UI/UX walk (fresh eyes), scar-deal cleanup round, smalls (at-close wording, waived date-guard, Offer glance).

## UI/UX FLOW PASS - MARKED & COMMITTED (Day 71 close): Next session opens with the architect-prepared WALK-MAP (every button, tab, transition catalogued w/ proposed names + flow fixes) -> founder reacts -> ratify -> cut. Founder: 100pct architect help required. Fresh eyes mandatory.

## DAY 71 GRAND CLOSE (the fullest day): activities dedupe + end-state naming + SPA-prep checklist+gate + close-gate v2 (hard/see-bill/materiality/company-tolerance) + lifecycle .catch kill + Khalid GRADUATED full ladder (Won/Sold/customer) + REBALANCE (primary at Reqs->Signed, fired 351k vs 3.7k) + UI/UX FLOW PASS all 3 passes RETIRED (tabs story-order+Money+Activity, three-verb grammar Record/Advance/Close-as/Amend, Deal actions zone, smalls). Founder-marched throughout - poetry in motion verdict. Recovery drill: surrogate-escape truncation -> git checkout (raw-emoji file-scripts law). DEFERRED: chips wiring (lead-KYC deep-link design), Upfront-merge decision, prompt->modal polish, scar-deal cleanup, founder negative round, two-faces horse-rider build, block sales design.

## SCAR-DEAL CLEANUP COMPLETE (Day 71 night): 12 runaways soft-closed (Closed Lost - reversible, history intact), pipeline now 4 Active (Sara@Offer DAM-08-04 fresh specimen, James+SaraNewOpp+KhalidQbr @Signed) + 2 Won (Khalid graduate, Priya historic) + 13 Lost. Census-verified exact. Tripwire protocol used (deliberate bad-id caught by PG before bulk op - eye-verification enforced).

## DAY 71 NIGHT CLOSE: negative round certified + four locks shipped (view-mode ledger dead, terminal View-only). DEFERRED: fieldset whole-dialog lock (3-way foot anchor), variance-note retry-multiplication design question, chips wiring, Upfront merge. Pipeline clean 4A/2W/13L. The longest fullest day ends.

## DAY 72 (23 Jul): CLEANUP DEADLINE CLOSED 2 days early (52-orphan list audited - stale, all alive except EyeIcon dup; census protocol saved live code from deletion). FIELDSET LOCK shipped (positional anchor). WON DOOR v3: won_at banner + labeled close-date + handover-live editable block (doctrine: future-facts stay editable on closed deals) + close_notes/expected_handover_date columns + hydration. Lesson: nested fieldset cannot re-enable under disabled ancestor. Sweep verdict: offer/reservation blanks were honest nulls. DEFERRED: handover-change audit trail (how many times it moved), chips wiring, Upfront merge, two-faces, block sales design, dashboards.

## DAY 72 BLOCK SALES CUT 1: schema live (block_deals + block_deal_units event-lines + block_distributions versioned + opportunities.block_deal_id nullable, all RLS company-scoped, idempotent DDL). Design of record: docs/Block_Sales_Design.md (FULL AND FINAL). Tag: pre-block-sales-schema. Next: CUT 2 creation UI.

## DAY 72 BLOCK SALES CUT 2 SHIPPED: creation UI live + certified (1 block, 2 proposed lines, asking_price join works). Founder rulings: discount belongs to calculator (create = buyer+units only), single-developer blocks (Cut 2b: picker filters by selected developer). LAW PAID: python -c banned (bash ate a guard line), file-scripts only. NEXT: Cut 3 bidirectional distribution calculator (the big one). Board: Cut 2b dev-filter, chips wiring, Upfront merge, two-faces, dashboards.

## DAY 72 BLOCK SALES CUT 3 SHIPPED: bidirectional calculator certified (5 versions, 2 specimens: mixed-mode frozen at 2nd-block D2, uniform at 1st-block D2). Founder found cross-block unit clash -> re-point heal, spec for Cut 2d guard (cross-block+active-opp+non-Available). NEXT: Cut 2d guard, then CUT 4 confirm->birth child opps (+4b adopt-into-block). Specimens ready for conversion test.

## DAY 73: CUT 2d tiered guard (hard=committed, soft=negotiating flagged, same-buyer blocked) + CUT 4 birth engine CERTIFIED (4 children born at exact D prices, both specimens confirmed, units claimed, all-or-nothing guard). Block vertical touches spine end-to-end. NEXT: Cut 5 roll-up view + Cut 4b adopt-into-block; then chips wiring / two-faces / dashboards. Children ready for full-ladder walk (Reserved->Won as ordinary opps).

## DAY 73 CLEAN RUN CERTIFIED: old specimens soft-retired (scar pattern: children Closed Lost, lines dropped, blocks cancelled, units freed). Block-1 walked uninterrupted: create (2 EBT units) -> calculator 5pct pro-rata -> Lock D1 -> Confirm -> 2 children born Reserved at exact nets (580199.20/922064.30), units claimed. Full cycle proven with zero anomalies - this walk = the tester demo script. Banked: negative days-ago display quirk on opp list.

## DAY 73 CONTROL WALK CERTIFIED: virgin 1-to-1 (Chen Wei / SHI-07-03) walked New->Reserved cleanly; V1 proposal, Record Offer, fee ceremony all healthy (regression pass on the week). Mainstream flip PROVEN: unit Available->Reserved at fee. Two-tier symmetric with block ruling (Offer Accepted holds nothing). 5b scope LOCKED: (1) teach reservation flip Booked->Reserved for block children, (2) conflict-flash learns Booked, (3) Booked block-context in inventory, (4) Money caption for proposal-less children. Census findings banked: Meraas/Omniyat GL units unpriced, EPR refs duplicated across 4 developers (seed artifact), Sobha service_charge unset. Specimens: SHI-07-03 control Reserved, SHI-05-01 spare at New, EBT pair Booked awaiting 5b.

## DAY 73 GRAND CLOSE: BLOCK CHILD EARNED RESERVED (fee ceremony -> stage Reserved, unit Booked->Reserved flipped by unconditional line-1247 write - zero teach needed). Birth-truth doctrine PROVEN live end-to-end: born OfferAccepted/Booked -> pay -> Reserved/Reserved. Both specimens healthy: control (Chen Wei/SHI-07-03) + block child (Khalid/EBT-06-02) both Reserved via the same honest ceremony. REMAINING BOARD: 5b polish trio (conflict-flash Booked, inventory block-context, Money caption), Cut 5 Block Workspace, Cut 6+6a (drop-outs + Booking Clock), Cut 7 Block Money Allocation, Cut 4b adopt-into-block. The vertical stands on the honest ladder.

## DAY 73 FINAL: evidence gate teach sealed (50d9c06). Founder close ruling: block children from Reserved onward = mainstream machinery (certified across many 1-to-1 walks incl. Khalid graduation + Chen Wei control) - no re-testing shared rungs; only block-specific seams needed proof and ALL FOUR sealed today (birth stage, Booked hold, fee flip, evidence gate). Vertical rides the paid-for spine. Next session board: 5b polish trio, Cut 5 Block Workspace, Cut 6+6a, Cut 7 money allocation, Cut 4b adopt.

## DAY 73 5b-1 PARK (2hr founder break): flash cut in + green, verify mid-flight. RESUME: (1) create EBT-05-01 collision opp past same-buyer yellow, open -> expect amber Block-1 banner at Booked-by-block, (2) soft-close throwaway, (3) 5b-2 inventory block-context, (4) 5b-3 Money caption + chips. Gap noted: mainstream picker offers Booked units (flash is the net; picker teach = later polish).

## FOUNDER SIGNAL (24 Jul): developer-persona itch is LOUD - founder sees SF-based developer projects suffering; validates PropOS Layer-2 thesis. Sequence holds (broker completion -> production -> testers -> THEN developer persona) but signal recorded: prioritize dev-persona planning immediately post-tester-review. Discounts workflow (built, hidden) is the seed.

## DAY 73 AFTERNOON GRAND CLOSE: 5b FAMILY RETIRED WHOLE (flash certified different-buyer, create door 3-layer defense w/ Booked vocabulary adoption, inventory Booked-Block-1 context live, captions+chips block-fluent - all eyes-verified). Founder findings drove every item. Board next: whats-next hint polish (1 line), Cut 5 Block Workspace, Cut 6+6a drop-outs+Booking Clock, Cut 7 money allocation, Cut 4b adopt, dev-persona signal recorded. Vertical: create->calculate->confirm->honest ladder->guarded everywhere.

## DAY 73 EVENING: CUT 4b SHIPPED+CERTIFIED (organic blocks live - chen block adopted from 2 existing Chen Wei deals, negotiating, awaiting calculator terms). Adopt panel formatted v3. FOUNDER VALIDATION: block card blind/strict -> Cut 5 BLOCK WORKSPACE is the confirmed next big (children view, D-history, edit paths, activity). Also owed: 4b-2 lockDistribution re-prices existing children on Dn+1 (adopted blocks need it for terms to flow down). Day 73 total: 2d, 4+fix, clean run, birth truth, control walk, evidence gate, 5b family whole, hint, 4b. The fullest block day.

## DAY 73 NIGHT: 4b-2 CERTIFIED - developer-authority doctrine live (approval capture -> gated repricing of existing children, pre-SPA only, contract-locked deals skipped by name). Chen Wei organic block repriced live at 4pct. Bug paid: lock downgraded approved blocks (keepStatus). BOARD: Cut 5 Block Workspace (blind card - founder-validated marquee), clearance-at-the-door (deferred build post-vertical), Cut 6+6a drop-outs+Booking Clock, Cut 7 money allocation.

## DAY 74: CUT 5 BLOCK WORKSPACE COMPLETE (5-1 shell+header, 5-2 children table w/ deal stages+prices, 5-3 Terms history + Activity tabs, 5-4 status-routed header actions). Blind card -> full control room. Operations layer done. RESTRAINT LIFTED: block operations now visible+testable. BOARD: top-down box init-blank polish (minor), add/remove units = Cut 6 drop-outs (detach vs drop doctrine pending founder ruling), Cut 6a Booking Clock, Cut 7 Block Money Allocation, clearance-at-door (post-vertical). Vertical near-complete.

## PRE-PROD HARDENING (founder catch, 25 Jul) - STALE-RENDER / DATA FRESHNESS
NOT browser cache - components render prior-fetch snapshots until hard refresh (seen:
Workspace showed old child rows after edits elsewhere). App-wide risk on live process.
FIX DISCIPLINE: views refetch on open/focus, not trust cached state; consider realtime
subscriptions or refetch-on-mount + on-window-focus. Audit Workspace, calculator, opp
lists, inventory. Pre-prod task (bites in tester week). Not block-specific.

## DAY 74: CUT 6 COMPLETE (drop-outs) - remove(detach/drop fork)+add+reprice-prompt all in the calculator cockpit (founder: composition+money one screen), certified on Fatima born children. Calculator opens on confirmed blocks now. Top-down nudge shipped. Bugs paid: const-before-init crash, calculator-hidden-on-confirmed. BOARD: 6a Booking Clock, 7 Block Money Allocation, clearance-at-door, top-down box init cosmetic, DATA-FRESHNESS (pinned #1 pre-prod). Block vertical: create/adopt->calculate->approve->confirm->born->drop/add/reprice->honest ladder. Near feature-complete.

## DAY 74 CUT 7 DESIGN PASS (block money allocation) - RULINGS RATIFIED
Sequencing call: Cut 7 BEFORE 6a (block payments are frequent+real; 7 builds the ledger
machinery 6a booking-clock depends on; completes the money story of the vertical).
Scenario: buyer wires one lump covering several children; today broker must mentally split
it into N child ledgers - error-prone, matches no bank line.
Shape: block payment event -> allocation ceremony (suggested split, editable per child)
-> remainder-to-zero -> lock -> each child ledger receives its own honest row.
FOUR RULINGS (founder-ratified):
1. ONE PARTICULAR per payment event (not restricted to reservation/booking fees). Mixed
   lump = two events. No artificial fee-type ceiling.
2. Suggestion basis = OUTSTANDING BILL per child, not net price. Fully-paid child shows
   zero WITH REASON (greyed), never a silent 0.
3. NO developer-approval gate. Day-73 developer-authority covers TERMS changes; money-in
   is not a terms change. Record obligations stand (ref, mode, date, audit line) -
   testimony, not permission.
4. Allocations are AMENDABLE with reason (three-verb grammar), not frozen at lock.
NEXT: docs/Block_Sales_Cut7_Design.md then build.
LESSON BANKED: this design pass lived only in chat and did NOT reach HANDOFF before session
end -> next session resumed from a stale board (proposed freshness work instead of Cut 7).
Append design rulings AT RULING TIME, not at session close.

## DAY 74 CUT 7 - BLOCK MONEY ALLOCATION (branch feature/block-cut7, NOT merged)
CERTIFIED LIVE: 7-1 schema (block_payments + block_payment_allocations, RLS company-scoped,
tags pre-block-cut7-schema/design; golden-block-vertical-cut6-complete marks pre-Cut-7 state).
7-2 ceremony screen + 7-3 lock engine PROVEN END-TO-END on Fatima block
(06c67a5b): AED 50,000 Reservation -> 2 children served 25,000 each -> both Offer Accepted
-> RESERVED, both units Booked -> Reserved, 1 payment row + 2 allocation rows written.
One wire, N members, from the block screen. Dropped child correctly untouched.
DESIGN CORRECTION MID-BUILD (founder caught it, important): first cut distributed the
EXPECTED amount and absorbed bank-charge variance at block level. FOUNDER OVERRULED with the
10,000 case - if a buyer sends 10k against a 50k expectation, crediting members 25k each is
the app FABRICATING money. LAW: the app records ACTUALS; variance is SURFACED for a human to
approve, never absorbed silently. Rebuilt: allocations reconcile against LANDED, remainder
measures actual money, reason MANDATORY whenever variance != 0. Mirrors the mainstream
close-gate materiality grammar.
7-4 AMEND (Payments tab + hydrate + amend-in-place) BUILT, NOT VERIFIED. amendBlockPayment()
in lib/lockBlockPayment.js: corrects the record in place, no second row, adjusts member
reservation by DELTA, logs audit activity per affected deal. Doctrine ruled: a downward amend
does NOT pull a stage back (money paid is money paid, Part 4); genuine withdrawal = cancellation
path, not amend.
## OPEN AT PARK (resume here)
1. UNVERIFIED: does the Payments tab actually RENDER in BlockWorkspace? Probe shows
   payment prop = null on every open, which is CORRECT for the header 'Record payment'
   button (new payment). Never confirmed whether founder was clicking the tab's Open button
   or the header button. FIRST CHECK: is there a 'Payments (N)' tab beside Deals/Terms
   history/Activity? No tab = the a2.py insert did not reach the render path. Tab present =
   nothing broken, click Open on the payment row to test hydration.
2. DEBUG PROBE LEFT IN: console.log('[BPD] payment prop:'...) at BlockPaymentDialog line 7.
   STRIP before merge.
3. BUG (cosmetic): bank-line labels REFERENCE / RECEIVED ON overlap after the two variance
   fields were added - row exceeds width. Needs widths rebalanced.
4. GAP (real, founder-flagged): 'Expected' has NO source. 1-to-1 gets reservation amount from
   company/developer setup; block ceremony falls back to broker-typed. Nothing in the app
   stores a per-developer reservation fee (money-tail sec 5 specifies it, never built; only
   MAX_RESERVATION_FEE=5000 in lib/refData.js, which is a guard not a default). FIND where
   1-to-1 sources it and wire the ceremony to the same place.
5. Mode/Reference persistence to block_payments never confirmed with a deliberate non-default
   entry (every successful lock ran with Wire + blank ref).
DATA STATE: Fatima block healthy - 2 children Reserved at 25,000 each, 1 payment row, 2
allocation rows, third unit correctly dropped/Closed Lost. Good fixture for testing amend.
Do NOT delete it.

## STANDING LAW (Day 74) - COLD-LOOK, ARCHITECT SIDE
The architect must read every screen cut as a first-time broker holding a real cheque:
what does this TELL me, what am I left GUESSING? Judge the screen BEFORE proving the engine
- a working engine behind an unreadable screen is the wrong order, and the broker never
sees the engine.
Day-74 evidence: founder caught FOUR cold-look failures the architect shipped without
noticing - (1) green 'AED 0' reading as satisfied when the truth was unknown, (2) Suggest
split silently doing nothing when all members were satisfied, (3) REFERENCE/RECEIVED ON
labels overlapping after a field was added, (4) the payment dialog giving a broker no way
to tell a NEW payment from an AMEND, and no source for 'already received'.
The founder's earlier principle generalizes: 'every button has meaning, or it is demeaning'
-> every FIELD and every NUMBER must say what it is and where it came from.

## DAY 74 CLOSE - CUT 7 STATE (branch feature/block-cut7, NOT merged)
PROVEN ON CLEAN DATA (Nshama walk, Chen Wei New Block 2, NTS-07-03/08-04/09-05):
create -> calculator D1 (5pct, 274,099 off) -> developer approval -> confirm (3 children born
Offer Accepted, units Booked) -> RECORD PAYMENT 75,000 -> equal split 25,000 x 3 -> all three
children Reserved, all three units Reserved, Cheque + reference 789754 persisted on the bank
line AND on every child. One payment row. The distribution engine is certified.
FORM REBUILT MID-SESSION per founder's flow: money in -> SPLIT EQUALLY across live members
(not by expectation, not by outstanding). Partial payments are normal tranches. Columns are
Unit / Deal stage / Received before / This payment / Total after. 'Split differently' exists
behind a mandatory reason (Tier-2 grammar) - the broker has no silent lever to favour one unit.
FOUNDER RULINGS BANKED THIS SESSION:
- The app records ACTUALS. Variance is surfaced for a human to approve, never absorbed. (The
  10,000 case: crediting members their full agreed share when less money arrived = the app
  fabricating money.)
- Nothing auto-cancels. The clock NAGS - broker reminders escalating to sales manager; a human
  decides cancellation + damages claim. Correct the Cut 6a note accordingly.
- Recording a payment = broker, no gate. AMENDING a recorded payment = manager (rewriting
  history is where error and manipulation live). Capability amend_payments SEEDED across all 7
  companies (admin/group_gm/sales_manager/leasing_manager true; agents/viewer false), mapped in
  permissions.js as amend_payment, Amend button gated - agents see 'manager only'.
COST OF THE REBUILD (deliberate, acknowledged): the Expected / Actually-landed pair was removed,
so the variance path went with it. There is currently NO way to record 'due 75,000, landed
74,500, reason'. This is NOT to be fixed by restoring those fields - see Cut 7-6.
## CUT 7-6 (next, the real fix) - THE SCREEN MUST STATE WHAT IS DUE
Founder cold-look: a broker opens the payment screen holding a cheque and the form asks him for
a number he has to already know. The system knows the units, the deal values and the developer -
it should SAY 'Reservation due: AED 25,000 x 3 = AED 75,000. Received so far: X.' Broker then
enters ONLY what actually arrived; shortfall and variance compute themselves; approval rides the
difference. No typing of totals, no ambiguity.
ARCHITECT RULING on the source (founder deferred it - fresh eyes may overrule):
FIXED PER DEVELOPER, with an override at block creation. Basis: money-tail sec 5 already
specifies developer/MA level, 'pickable at reserve-time, broker may adjust'; matches UAE
practice; and the number is then known before any block exists.
Build shape: default_reservation_fee on pp_master_agreements -> block creation reads and allows
adjust -> payment screen states due vs received -> variance falls out of the difference.
ALSO: the particular should be STAGE-DRIVEN, not a broker dropdown. At this rung the only thing
being collected is the reservation fee. Retitle 'Record reservation fees'. Later money stages
get their own screens when those stages exist.
## STILL UNVERIFIED AT CLOSE
- AMEND path never tested live (Payments tab -> Amend -> correct with reason -> one row badged
  AMENDED, children adjusted by delta, stages NOT pulled back). Engine + gate are built.
- Partial-payment tranche stacking never tested (would have shown 'Received before 25,000').
- DEBUG PROBE still in BlockPaymentDialog: console.log('[BPD] payment prop:'...). STRIP BEFORE MERGE.

## CUT 7-6 - FOUNDER'S OWN WORDS (the shape, Day 74 close)
'We know we have to collect 75K - keep showing. Receiving can be 1 plus, which is what we
record, and ensure all collected and move on.'
= A RUNNING BALANCE, not a variance calculation. The DUE figure is stated and stays visible;
tranches accumulate against it (1 or many); the block stays open until collected in full, then
moves on. The clock chases whatever remains outstanding. Simpler than the expected/landed pair
that was removed - and it makes partial payments first-class rather than an exception.

## BUG (Day 74 eve) - ADOPT-FROM-EXISTING-DEALS PANEL IS UNUSABLE (create block door)
Founder screenshot: the yellow 'Adopt from existing deals' panel on the New Block Deal form
offers checkboxes for the buyer's active deals but shows NOTHING identifying them - just a
checkbox and a truncated opp title ('Inquir...') running off the right edge of the panel.
TWO FAULTS:
1. CONTENT: rows render the opportunity TITLE only. Must show UNIT REF + STAGE + VALUE - the
   three things that identify a deal. A broker cannot decide what to adopt from a title.
2. LAYOUT: the row overflows horizontally past the panel edge (something in the row has no
   width constraint / no truncation). Same class as the Day-52 Users-screen wrap saga - force
   explicit widths + flexShrink:0 rather than hunting CSS.
IMPACT: Cut 4b (adopt-into-block) is effectively inoperable through this door. Founder hit it
live - Khalid had 2 existing 1-to-1 opps that were legitimate grouping candidates and he could
not tell what they were, so he ignored them and picked fresh units.
Not polish - the panel cannot be operated as it stands. Fix after the current walk.
RELATED (already banked): Cut 7-5 - the unit picker on this same form is a bare dropdown; app
has a rich unit finder with filters that should be reused here with multi-select.

## HEADER LINE - FINAL SHAPE (founder, Day 74 eve)
Every number must carry its own LABEL, not just the arithmetic:
  List AED 5,160,029 . Discount AED 258,001 (5%) . Deal value AED 4,902,028 . D1
Founder: 'tag it with a proper heading - what is the number, else ambiguous.' Same labelled
shape on the calculator summary bar so both surfaces read identically and the broker learns
the vocabulary once. 'Deal value' is the agreed term for list-minus-discount.

## DAY 74 GRAND CLOSE - CUT 7-6 COLLECTION STATE CERTIFIED END-TO-END (branch feature/block-cut7)
Khalid EBT walk, full arc live-proven: Expected 75,000 set (editable on Workspace header) ->
tranche 60,000 (Cheque EBT-100) HELD at Offer Accepted -> tranche 14,850 (wire) HELD ->
150 shortfall -> Accept shortfall & close (manager-gated, reason mandatory) -> all 3 deals
Reserved, all 3 units Reserved, 24,950 each (ACTUALS - shortfall never recorded as money),
block collection_status=accepted_short w/ reason+who+when. Payments (2), both persisted w/
mode+ref. Header rebuilt: List/Discount(%)/Deal value/D1 all LABELLED + collection line
'Reservation X of Y' + pulsing outstanding chip. RULES PROVEN: reservation = the test of the
buyer; Reserved EARNED at full collection (the payment that closes the balance earns it);
tranches first-class; actuals only; humans decide differences.
SHIPPED TODAY (7-6a/b/c): reservation_expected + collection_status/note/closed_by/at on
block_deals; Expected field on create form + editable on Workspace; due/received/outstanding
strip on payment dialog; part-payment vs completes-reservation messaging; stage gate in
lockBlockPayment (completesReservation); acceptShortCollection engine + dialog.
OPEN AT CLOSE: (1) Payments-tab shows 'manager only' for SUPER_ADMIN while the Accept button
gates correctly - same canDo, different result; suspect currentUser prop vs closure in the tab
row render. (2) Amend path STILL never tested live. (3) Debug probe still in BlockPaymentDialog
- STRIP BEFORE MERGE. (4) Text tweak owed: 'Reservation Received X of Y' + 'held until
collected fully'. (5) Approval ref-vs-note split, adopt-panel overflow, rich unit picker
(7-5), totals-on-top calculator - all banked earlier. Branch NOT merged to main.

## NEXT SESSION FIRST TASK (founder directive, Day 74 close) - THE MASTER PENDING BOARD
Before ANY build: consolidate ALL pending work into ONE master board. Sources to sweep, in order:
1. This HANDOFF end-to-end (54 pending markers: STICKY/DEFERRED/PHASE 2/QUEUE/banked/parked)
2. docs/Opps_Journey_Redesign_Capture.md - GF items not marked resolved (GF-01b, 02-verify, 10,
   11, 13 residuals, shortlist-engagement homework)
3. docs/Deferred_Items_Day39.md, Backlog_Opp_List_Price_Columns.md, App_Normalisation_Priority.md,
   Dashboard_Redesign_Spec.md, CLEANUP docs, Decision_Log.md - the OLDER strata the Day-74 sweep missed
4. Phase_2_Backlog_Master_Doc.md (project files) - the original Phase 2 register
Output: ONE doc (docs/MASTER_PENDING_BOARD.md) grouped A) Block finish+merge B) Pre-prod
hardening C) Design sessions owed D) Post-tester/Phase 2 - each item with source reference.
Founder reviews, ranks, THEN build resumes. Draft skeleton from Day-74 close exists in chat
history; known-missing from founder memory check: Lead->Account model, govt-ID identity,
Customer/Employee-360 AI, commission payables views, operator dashboard, Executive/BI arc,
shortlist tracking, dup-leads AI report, CORS hero proxy, Upfront merge, chips wiring.

## BOARD RULE (founder, final word Day 74): VERIFY, DON'T JUST COLLECT
Many banked items may ALREADY BE CLOSED (fixed en route, superseded by redesigns, or dead with
deleted code). First hour of next session = check each candidate against the REPO and DB (grep
the code, query the data) before it earns a place on the board. Census protocol applies - the
Day-72 cleanup audit proved stale lists nearly deleted live code; the same staleness cuts the
other way here. Only VERIFIED-open items go on MASTER_PENDING_BOARD.md, each with evidence.

## ── DAY 76 (27 Jul) — B1 MERGED + THE DOCUMENTATION RESET ──
BUILD: B1a master-load split shipped (data load via useFreshData w/ silentReload; realtime
subscription its own effect). Verified live: silent refresh (screen still, network moving),
cross-tab realtime alive, clean console across 15+ screens, lead edit round-tripped intact.
Merged to main, tag golden-data-freshness. B1 CLOSED - the pinned #1 pre-prod item.
FOUNDER FINDINGS: (1) Edit-lead form showed sparse data -> NOT a bug, Khalid's row genuinely
had nulls; (2) every lead has buyer_type NULL because all were seeded from the backend, so the
form's required guard was never invoked - board item B8, double-protection ruling.
THE RESET (the day's real work): founder named the continuity failure - "documents are updated
superficially; only my memory is tested." Proven live: the architect began writing a go-live
section while docs/Go_Live_Readiness_Register.md already held 286 verified lines on it, because
the HANDOFF carried no pointer. WHAT WE DID: ratified six documentation principles
(DOCUMENTATION_PRINCIPLES.md) · archived 93 historical docs (137 -> 44 living) · rebuilt
PropCRM_Master_Context_and_Takeover.md as THE HEAD with product frame + state measured from the
repo + the DOCUMENT INDEX that Register item #23 asked for on 24 Jun · wired handoff and board
to the head so no document is an orphan · wrote FOUNDER_SESSION_PROCEDURE.md · rewrote the board
whole. TWO COMPETING HEADS COLLAPSED INTO ONE.
DOCTRINE RE-ESTABLISHED: founder corrected the architect's plan to run E2E next - NO E2E until
development STOPS (three rounds: dev-close, testers, pre-go-live). Board sequencing fixed.
V1 SCOPE DEFINED (five items): C1 block ledger phase · C13 block polish + booking clock ·
C4 money smalls · B5 KYC bucket private · B8 buyer_type guard. Then development stops.
NEXT SESSION: read the head, then the board. V1-1 is the block ledger phase.

## ── DAY 76 (27 Jul) — B1 MERGED + THE DOCUMENTATION RESET ──
BUILD: B1a master-load split shipped and merged (tag golden-data-freshness). Verified live:
silent refresh, cross-tab realtime alive, clean console, edit round-trip intact. B1 CLOSED.
THE RESET: founder named the continuity failure - documents updated superficially, only his
memory tested. Proven live when the architect began writing a go-live section that already
existed in Go_Live_Readiness_Register.md. DONE: six documentation principles ratified · 93 docs
archived (137 -> 44 living) · Master_Context rebuilt as THE HEAD with product frame + state
measured from repo + the DOCUMENT INDEX (Register item #23, asked 24 Jun) · handoff and board
wired to the head · FOUNDER_SESSION_PROCEDURE.md written · board rewritten whole.
DOCTRINE: founder corrected the plan to run E2E next - NO E2E until development STOPS (three
rounds: dev-close, testers, pre-go-live). Board sequencing fixed.
V1 SCOPE DEFINED: C1 block ledger · C13 block polish + booking clock · C4 money smalls ·
B5 KYC bucket private · B8 buyer_type guard. Then development stops.
FOUND: buyer_type form guard WORKS (tested live). Doc-matrix seed has errors (local_national
requires both emirates_id and national_id - same doc; corporate requires NO documents and asks
a company for nationality + Arabic name). NEW C15 TITLE HOLDERS: the app cannot record a joint
purchase - "in whose name?" is never asked. Holders belong to the OPPORTUNITY. Founder hard
rule: every name on the SPA has documents, no override. OPEN: is C15 in v1?
NEXT SESSION: read the head, then the board. V1-1 is the block ledger phase.

## ── DAY 77 (29 Jul) — THE DAY THE BLOCK BECAME A DEAL ──
BUILT: dealBill.js (pure per-particular bill derivation, one truth for both ledgers) · BLOCK
TERMS on the distribution calculator (payment plan + DLD, uniform per founder ruling, versioned
with D_n, hydrates on reopen) · adopt-panel filter fixed (was offering SPA-Signed and Closed-Lost
deals) · adopt unit-ref now joined properly (was falling back to long titles and breaking layout)
· confirm idempotency guard (root cause: the page's in-memory copy, not a fresh DB read - the
Khalid six-children-on-three-units bug). Branch feature/block-ledger, NOT merged.
FOUNDER RULINGS: block terms are UNIFORM - "if it is different, then the block concept does not
have meaning" · blocks follow the SAME visibility ladder as 1-to-1 (agent/manager/group manager/
viewer) · partial receipts ALLOWED so the broker carries follow-up responsibility · post-
reservation change has THREE TIERS with THE FORFEIT as the line (developer forfeits -> cancel;
otherwise ceremony) · money is RECORDED, never computed - the developer decides, the broker
records · this is a BROKER PORTAL, developer portal to follow - shape money events with an author.
THE BIG ONE: after an uninterrupted 1-to-1 walk, founder ruled the BLOCK IS A FIRST-CLASS DEAL.
It carries the journey, activities, communications, next steps and money; the child opp becomes
an execution record (unit, price, SPA, DLD, commission) worked FROM the block. A 700K 1-to-1 has
a full deal life; a 5M block had status words. Backwards. Design of record:
docs/Block_As_Deal_Design.md.
ALSO RULED: merge the reservation ceremony with the LEDGER'S BIRTH - kills two dead steps
("Advance to SPA Requirements" only recoloured buttons; the collection ledger lived inside a
dialog named "Record SPA Signing"). Commercial reason: a printable RECEIPT at the reservation
moment - received / balance / due by - in the buyer's hand while he is still in the room.
METHOD FINDING: silo tests prove correctness; only an UNINTERRUPTED end-to-end walk exposes FEEL.
Every earlier walk was broken by discussion, so the friction never accumulated. Expect more
findings of this kind, the same way.
FOUND + BOARDED, NOT FIXED: fees are HARD-CODED (5250/4020/4%) though designed as company
settings - and the developer-override chain is broken (reads opp.developer_id, which does not
exist) · DLD vocabulary split across two dialects with one broken mapping · money inputs have no
thousands separators · block has no owner column · the pre-SPA ledger is a jsonb blob shaped by
the form, not the data (reporting + audit consequence) · adopt-panel checkbox renders detached
(C13-a, five cuts failed - inspect computed styles next).
V1 GREW from five items to ten. Founder: testers are his to manage - build it RIGHT, in
dependency order, not to a date.
NEXT (architect order, founder deferred): (1) company fee settings + one resolver - unblocks both
ledgers · (2) block owner column + visibility ladder · (3) C0b 1-to-1 flow simplification ·
(4) C1 block ledger · (5) C0 block deal life.

## ── DAY 79 (30 Jul) — THE COLLECTION LEDGER + THREE SCOPE FINDS ──
SHIPPED (branch feature/block-ledger, not merged):
- BLOCK VISIBILITY LADDER: block_deals.assigned_to + RLS mirroring opportunities. VERIFIED LIVE -
  an agent sees only his own blocks, his manager sees them via downline. Closes the Day-77 leak.
  Owner shown in the Workspace header. TRAP CAUGHT: an ALL policy alongside a restrictive SELECT
  policy DEFEATS it (Postgres RLS is permissive) - narrowed to INSERT/UPDATE/DELETE.
- RESERVATION SUGGESTION: block creation suggests company reservation fee x units, with "use this".
- C0b THE COLLECTION LEDGER: born AT RESERVATION with the fee policy FROZEN into the row; FOLLOWS
  THE PROPOSAL from every entry point (lives in lib/createProposal.js) so price-derived rows
  recompute while frozen fees and the reservation hold; Bill/Collected/To-collect strip on the deal;
  branded RECEIPT PDF with the itemised balance to proceed; deal action renamed "Collect payments"
  while money is outstanding. Verified end to end on a fresh specimen through a renegotiation.
- C1 FIRST CUT: block bill engine (dealBill per child, summed) + Money tab showing the block bill
  and the PER-UNIT cost basis.
RULINGS: no ceremony/ledger merge - "the reservation is a CEREMONY, the ledger is an INSTRUMENT" ·
fees FREEZE at reservation, price-derived amounts FOLLOW the price · the ledger follows the
PROPOSAL, never the negotiation (rounds are internal) · one bill at BLOCK level, the split visible
per unit - "record from one source and distribute" · the per-unit split is the buyer's ASSET
REGISTER (he sells, rents or gifts units one at a time) and must print the RECORDED allocation,
never a tidier pro-rata.
THREE SCOPE FINDS, all captured, none built:
1. RESALE - the app is OFF-PLAN ONLY. Resale is a second transaction type (a seller the app does
   not model, no Oqood, mortgages, a different fee set). Founder: "if a broker cannot do resale,
   why buy your software - HEAVY PUSHBACK." A positioning question, not a backlog item.
2. VAT - commission is handled (5%, computed). Open for the accountant: are brokerage fees
   VAT-rated? must the receipt be a valid TAX INVOICE (TRN, sequential number)? any commercial
   units in scope?
3. INVENTORY COMPLETENESS - PropPulse imports are inherently incomplete; an unpriced imported unit
   would produce a silent zero bill. VERIFIED no live exposure (30 unpriced units are global
   catalogue, never imported). Also recovered: two ORPHANED payment-plan-template tables, built
   for developer custom plans and lost when no master doc kept them alive.
ALSO BOARDED: the ledger stores TOTALS not payment EVENTS, so only the reservation can produce a
receipt - blocks per-payment receipts in the collection phase.
NEXT: BL-2 block ledger screen (record once, allocate across children). Prerequisite - existing
blocks carry no payment plan, so a TERMS EDITOR is needed (option b: terms-only, price stays
locked) or the Money tab shows zero instalments forever.

## ── DAY 80 (31 Jul) — BL-2: THE BLOCK COLLECTION PHASE ──
SHIPPED (branch feature/block-ledger, not merged):
- BLOCK TERMS EDITOR: terms are editable after confirmation - the calculator lock protects PRICE
  (money paid against it), terms are a separate concern. Writes a new distribution version,
  cascades plan + DLD to PRE-SPA children only, audited. Gate started manager-only and was
  LOOSENED to OWNER-OR-MANAGER: founder's reasoning is that block terms come FROM THE DEVELOPER -
  the broker is RECORDING what was offered, not granting a concession, so an approval gate would
  be theatre and would put the person WITHOUT the knowledge doing the entry.
- AUDIT: every terms change writes an activity naming who set what and which version, deduped on
  the block view (one act writes one row per child - each deal keeps its own history for detach).
  Verified the OWNING AGENT sees his manager's change.
- ACCEPT-SHORTFALL BUTTON now hides once the decision is made; the settled chip names WHO accepted
  and WHEN. Founder ruling held: EVERY shortfall needs manager approval, however small - a
  tolerance was built mid-cut and STRIPPED on that ruling.
- BL-2 THE COLLECTION PHASE (the day's main work). Rebuilt after the founder rejected the first
  model: the broker was being made to choose a PARTICULAR and read a per-unit split at the moment
  he just wants to record money. New model - "a chunk arrives for the block; what it COVERS is
  allocation, not data entry":
    lib/allocateBlockPayment.js - two-stage PROPORTIONAL split, across particulars by outstanding,
    then within each across units by outstanding. Equal-split would over-credit small units.
    lib/recordBlockCollection.js - one bank line, one allocation row per (particular, unit).
    BlockCollectionDialog - ONE amount, no particular chosen, allocation shown before recording,
    "nothing to record" once fully collected.
    Money tab - bill / collected / outstanding per particular, and each unit's PAID.
    generateBlockStatement.js - the buyer's document: THE BLOCK, then PER UNIT (his asset register
    for selling, renting or transferring one unit at a time).
  VERIFIED TO THE FILS: three payments (500k, 400k, 379,950) on Chen Wei allocated across four
  particulars and three units, ending exactly on the bill - per-unit paid 413,067 / 368,590 /
  573,293 summing to 1,354,950. Second and third payments correctly worked off the REDUCED
  outstanding, proving paidByParticular / paidByUnit.
SCHEMA: block_payment_allocations.particular added (a single payment now spans several, so the
parent's milestone can no longer describe it - post-reservation lines are milestone "Collection").
METHOD NOTE: five surfaces (strip, two banners, table, sub-line) each assumed "reservation" and
were patched one at a time as the founder caught them - the arithmetic branched on particular but
the COPY did not. The rebuild removed the branch entirely.
STILL OPEN: no REJECT path on the shortfall gate (accept or silence) · no materiality gate at the
END of the collection phase - an outstanding 200 simply sits · shortfall rules still DIVERGE
between block (every gap approved) and 1-to-1 (500 AED / 1% tolerance).
NEXT: the reject path, or merge the branch to main.

## ── DAY 81 (1 Aug) — CLEAN SLATE, AND SIX REAL BUGS ──
THE WIPE: block test data had become unusable - a 25,000 discrepancy traced to a child carrying a
reservation from BEFORE it joined its block. Founder: "we should never do things on runaway data."
All 8 blocks removed, 15 units freed, TWO ADOPTED 1-to-1 deals preserved by detaching first.
Method and lesson in Go_Live_Readiness_Register.md - a DRY-RUN COUNT caught a delete that would
have destroyed two real deals.
SIX BUGS FOUND AND FIXED, all on the money path:
1. Money tab read the reservation BILL from what children had PAID, so Bill always equalled
   Collected and Outstanding always read Nil - contradicting the header.
2. Creating a block failed RLS: the Day-79 ladder needs assigned_to = auth.uid() to SELECT and the
   insert never set an owner, so the .select() after it failed. A latent bug the rewrite exposed.
3. Block activities were INVISIBLE: activities RLS scoped only through opportunity_id / lead_id,
   so a block event (neither) failed every branch. The audit wrote and nobody could read it.
4. ACCEPT left no trace while DECLINE did - the feed showed refusals and not approvals.
5. LOCK allowed a distribution with NO PAYMENT PLAN - children then computed a ZERO instalment.
   On one specimen that hid 300,453 of a 380,584 bill and nothing said so. Now gated.
6. CONFIRM BIRTHED CHILDREN WITHOUT TERMS - price copied from D_latest, plan and DLD not. Every
   block confirmed before today was born term-less, understating its bill by ~76%. It only looked
   right because "Set terms" cascades; birth never did.
BUILT: the DECLINE path - a manager can now refuse a shortfall with a reason, recorded and visible
to the owning agent. Before, silence was indistinguishable from refusal.
BUILT: TERMS AT CREATION. Founder: "the purpose of the block is to treat, propose, collect as ONE
line, and the benefit to the buyer is better discounts AND better payment plans" - so the plan is
part of what is PROPOSED, not set later. Flows creation -> D1 -> children.
PROVEN ON A CLEAN WALK (Block Test 3, as the AGENT): terms at creation carried all the way down
with no manual step; reprice to 5.5% re-priced children and recomputed every derived figure;
partial reservation 30,000 of 50,000; manager accepted the shortfall with a reason - audit written,
collection closed, both units released to Reserved.
STANDING THEME: the DATA was right and the SCREEN was behind, repeatedly - a deleted block still
rendering, confirm not refreshing status, the settled chip not appearing after acceptance. All
boarded. The setState-during-render warning (BlockDealsPage -> App) is the likely common cause and
is the best next thing to chase.
ALSO SEEN, NOT CHASED: Record payment opened the COLLECTION dialog on a block with 0 of 50,000
collected (should have been the reservation ceremony) - stale childRows at that moment.
KEPT AS A SPECIMEN: none - the wipe was total. Blocks now on the system are Block Test 1/2/3, all
created today on clean data.

## ── DAY 81 EVENING — THE DEVELOPER SIDE, AND THREE DESIGNS ──
BUILT AND PROVEN: DEVELOPER QUESTIONS. A buyer asks something the broker cannot answer; he logs it
against the deal or block with WHO he will ask and WHEN he needs it. It stands open. The developer
replies and he records the answer with the channel. The deal then carries "buyer asked X,
developer said Y on the 3rd" - what he needs when the buyer rings back a week later.
New table developer_questions (RLS ladder: visible to whoever can see the subject; NO delete
policy - an asked question is not erasable). New folder src/components/developer/.
Mounted on the block Activity tab. PROVEN LIVE end to end on Block Test 3.
FOUNDER'S GAP, felt for months and never raised: "interaction with the developer is missing for
the deal - I thought the buyer side was more important." The app recorded OUTCOMES and never the
WORK. A block IS a negotiation with a developer and none of it was anywhere.
CONSTRAINT HELD: "not too many things like you have to run a CRM." No developer login, no approval
chain, no status machine. One entity: an open question with an answer.
STILL OPEN ON THIS FEATURE: blocks only (the component already takes oppId - 1-to-1 needs it too);
the NUDGE is not built (an overdue question does not reach his reminders); managers cannot see
open questions across the team.
THREE DESIGNS CAPTURED, NOTHING BUILT:
- `Developer_Interaction_Design.md` - the shape above, plus what the MANAGER gets: today the
  broker's developer-side chasing is INVISIBLE, so "he is only talking to the buyer" is the
  impression. Open questions with dates make the effort visible.
- `AI_Briefing_Design.md` - the morning briefing. SQL computes the signals; AI reads ~15 lines of
  structured facts and judges which three matter today. About $4-5/month for a 20-broker
  brokerage. Founder's boundary, ratified: "NEVER on the money arithmetic - just the Midas touch,
  it READS IN and tells the broker hey, you have something waiting." From his ERP years: "I cannot
  fit a boxing glove inside the app which will punch you when you are doing wrong data entry."
- `Context_Help_Design_Question.md` + `Documentation_Deliverables_Pending.md` - mechanism decided
  early, content written last; developer/architect guides captured as headings only.
- `Block_As_Deal_Design.md` gained THREE THREADS: the sales flow up to reservation (C0, buildable),
  buyer<->developer interactions (now partly built), and what happens after the deal concludes
  (post-leasing, property management).
THE FOUNDER'S STANDING WORRY, recorded because it is legitimate: the list only grows. v1 was five
items on Day 76 and is now roughly twelve. AGREED DISCIPLINE, not yet executed: split the board
into MUST-SHIP and CAN-WAIT against one question - what would a tester hit in week one. Almost
nothing captured today is on that list. RESALE is the only item that is a genuine demo-stopper.
NEXT SESSION: that board split, before any more building.

## ── DAY 82 (2 Aug) — THE BLOCK'S END, AND V1 MEASURED HONESTLY ──
BLOCK CLOSURE ARC, now complete. RULING: closure is a ceremony but a PER-CHILD one - market check
confirmed off-plan SPAs register per unit through DLD's Oqood portal, each unit getting its own
certificate, so there is no group SPA. The block therefore has NO close button: it REFLECTS where
its children stand. The one block-level ceremony is CANCELLATION.
BUILT: rollUpBlockStatus - a resolved child settles its LINE, frees its UNIT, and the block derives
completed / partially_dropped / cancelled. Found by testing: a cancelled block's units stayed
BOOKED, holding inventory forever with nothing saying why.
FIXED: DROP was clearing block_deal_id, so the block forgot units it once held and the roll-up
could never see them. A block that forgets what it lost cannot tell the story.
BUILT: CANCEL BLOCK - manager ceremony, live children closed, units freed, audited. Proven live.
V1-4 DONE - KYC documents were uploading to propcrm-files, a PUBLIC bucket shared with brochures,
served by getPublicUrl. Passports and Emirates IDs were readable by anyone with the link. Moved to
the private `documents` bucket with signed URLs, matching the pattern Master Agreements and SPA
documents already used. Also: an upload that fails to record now REMOVES the file rather than
leaving an orphan nobody can reach.
V1-5 DONE except the NOT NULL constraint (blocked on the B3 backfill of 12 NULLs). Form
enforcement VERIFIED live; buyer-type matrices found POPULATED (48 rows), not empty as boarded;
the duplicate buyer_intent declaration removed.

## ── DAY 84 (4 Aug) — THE BOARD AUDIT, AND THE COMMISSION RATE ──
THE AUDIT the founder called for: read the board and MARK it, rather than keep appending. Every
entry checked against the CODE. Five described work already done; two more were half-fixed and
never marked. That is why the list FELT like it only grew - nothing ever left it.
⚠️ AND ONE ENTRY WAS A LIVE MONEY BUG THAT HAD SAT UNREAD FOR SIX DAYS. C16, written Day 77: two
sites tested for 'developer_absorbs', a value not in DLD_OPTIONS - the constant is 'developer_pays'
labelled "Developer absorbs full DLD". The test never matched, so a proposal where the DEVELOPER
absorbs the DLD silently billed the BUYER, on the document sent to him and in the deal's ledger.
On a 5.8M deal, 234,575 wrongly charged. Fixed and proven live.
THE RULE: read the board BEFORE starting work, not after finishing it.

FIXED TODAY, all on the money path:
- PROPOSAL PDF omitted the DLD arrangement AND the service-charge waiver - terms the buyer is bound
  by and could not see, while the app's own viewer showed them. Now printed, every option stating
  what HE pays. Layout derived from the box count so the next term will not break it.
- REPORTS MODULE HAD NEVER LOADED ITS OWN DATA. safe() assumed a Supabase builder was a promise
  (it has no .catch() until awaited), so Promise.all rejected on every mount. Behind that:
  an undeclared `cheques` variable and a missing Spinner import, both unreachable until now.
  It looked fine only because most reports read a prop rather than fetched data.
- The investor report computed commission at a FLAT 4% and carried a hard-coded "Realization Rate
  95%" neither founder nor architect could define. Both gone; it reads the real invoices now.

⭐ THE DAY'S LARGEST FIND — THE COMMISSION RATE WAS NEVER READ FOR AGENT-CREATED DEALS.
An AGENT creates the deal and sends the proposal; a manager approves. But RLS on
pp_master_agreements deliberately excludes agents - that table holds discount authority, payment
triggers and signed contracts a broker should not see. So the lookup silently returned nothing and
the rate fell to the COMPANY DEFAULT: 4% where Aldar agreed 4.5% and DAMAC 5%. About 7,300
understated on a 1.46M Aldar deal, on the brokerage's OWN revenue.
NEITHER LAYER WAS WRONG. The permission is right; the lookup was right; they could not both be
true as built. FIX: get_commission_rate(project, company) - SECURITY DEFINER, returns ONLY the
number. Contract stays private, arithmetic becomes correct.
Wired into ALL FOUR creation doors: CreateOpportunityDialog, block confirm (a five-unit block
birthed five rate-less deals at once), LeadDetail, and LaunchMode (which creates at RESERVED).
Also removed a competing company-default fallback that OVERWROTE the resolved rate - two writers
on one field. Proven live: same buyer, same developer, old deal 4.00, new deal 4.50.
BOARDED NOT DECIDED: historic deals carry the wrong rate and some invoices are already raised.
Re-issuing to a developer at a higher rate is a conversation, not a database update.

⚠️ STANDING LESSON - THREE SILENT CATCHES COST HOURS TODAY. The KYC upload swallowed its error;
ReportsModule's catch showed a toast and never logged; safe() turned a failure into an empty array.
Each turned a five-second diagnosis into an hour. A catch that hides the error is not defensive.
ALSO: an hour went into a chip that was correct all along - clipped by a cell's overflow:hidden.
When the code is right and the data is right, look at what is DRAWING it.
NEXT: the pre-tester list, B3 clean data, the two walkthroughs.

## ── DAY 84 EVENING — CANCELLED RECORDS, AND THE SHARED UNIT PICKER ──
A CANCELLED BLOCK holding money no longer reads "Nil" in green: it says what was received and that
it is unreconciled. The app still does NOT decide refund vs forfeit - that is law and developer
policy - it simply stops showing green over an open obligation.
A CANCELLED DEAL IS VIEW-ONLY EVERYWHERE. Founder: "wherever you navigate you only get to see, not
do any action." A proposal is a PROMISE OF GOODS AT A PRICE and must not issue from a dead record;
the same holds for recording money against it or waiving a fee on it. Closed WON is deliberately
left open - commission collection and handover run for months after closing.
Cancelled records stay READABLE because a buyer with a history of cancellations is leverage in the
next negotiation.
DEVELOPER-QUESTION NUDGE: an open question now shows in the deal's warning band, red once past its
needed-by date, and stays quiet on terminal stages.

⭐ THE SHARED UNIT PICKER. Block creation and the calculator used a plain <select> - unusable past
about twenty units, and every brokerage has hundreds. The architect proposed boarding it as too
risky to extract; THE FOUNDER PUSHED, and was right: reading the code showed the picker CARRIES
DOCTRINE - the Day-74 claim ladder lives in it (booked-by-block hard-refused with an explanation of
when it releases, reserved warns about double-booking). That made sharing it MORE important, not
less: doctrine in two places drifts, as DLD and the fee constants both proved this same day.
FOUNDER'S DESIGN, and it was better than the architect's: the CALLER pre-filters. The picker does
not need to understand blocks or developers - it receives the units it may show. So block creation
passes units already narrowed to the selected developer, and the project pills then show only that
developer's projects. ONE DEVELOPER, ANY NUMBER OF PROJECTS - which is how an investor actually
buys: two from one tower, four from another.
Extracted to src/components/shared/UnitPicker.jsx, wired to the CERTIFIED deal path first to prove
no regression, then to block creation and the calculator. 196 lines left CreateOpportunityDialog.

## ── DAY 85 — B3 CLEAN DATA, AND THE FIRST FULL LADDER WALKED ──
B3 DONE. All transactional data wiped for Al Mansoori; structure, inventory and master agreements
preserved; 80 units freed. TWO LESSONS: several block child tables carry NO company_id, so the
register's spec - which scopes everything by company - fails on them; delete through the PARENT.
And batched deletes ROLL BACK as a unit, so one FK error silently undoes the statements before it.
One statement at a time.
B8(a) CLOSED: buyer_type NOT NULL applied. Blocked not by Al Mansoori but by three null rows in
another TEST tenant - the constraint is database-wide, so one tenant's gap blocks every tenant.
DEAL 1 WALKED END TO END on clean data: lead - quick quote - promoted to opp - site visit - two
negotiation rounds - revised proposal - offer accepted - reserved - collection - SPA signed -
closed won - commission invoice. Unit went to Sold.
⭐ THE COMMISSION CHAIN IS PROVEN: 4.50% resolved at creation via the Day-84 RPC, carried through
six stages, invoiced at 28,238.04. Before that fix this deal would have billed 4% - 3,138 short.
FIXED ON THE WALK, all first-encounter defects that survived because nobody had walked this far:
 - The NEGOTIATIONS TAB CRASHED the whole deal page - a `p` where the map variable was `r`,
   unreachable until a negotiation round existed.
 - A SECOND NEGOTIATION ROUND WAS REFUSED AND LOST. A 16-May double-submit guard could not tell a
   second click from a second round, and returned BEFORE writing.
 - RESERVATION BORE A LEDGER WITH NO FIRST INSTALMENT. The component's in-memory `opp` was behind
   the database, so the bill was short by 62,751 and the strip told the broker to chase 22,570
   instead of 85,321. Now reads the deal FRESH before computing.
 - THE KYC VERIFY GUARD read .url after Day 82 moved storage to .path, so it refused to verify a
   lead whose documents were all present. Fourth site of that change; three were updated.
 - The buyer's-bill DESCRIPTION still stated the old hard-coded fees while the total used the
   settings - they disagreed by 750.
 - SAVE PAYMENTS added: a part payment is NOT a variance, and recording one should not require
   signing an SPA.
⭐ TWO STRUCTURAL FINDINGS, both on the board in full:
 1. SPA SIGNED HAS NO CEREMONY OF ITS OWN - it reopens the COLLECTION form. So attaching the signed
    SPA means pressing Amend, which unlocks the entire money record on a deal whose commission
    invoice is already raised. And the four-item SPA-preparation checklist (docs, signature, buyer
    attends or signs remotely, upload) sits in a quiet dashed panel, gates Closed Won, and was
    never noticed across eight stages - then met as a blocker at the end.
 2. THE LABEL DOES NOT MATCH THE SURFACE - one fault, six times. "Money" tab reading Financials,
    "Record SPA Signing" being a collection form, "Save & Advance to Negotiation" when already at
    Negotiation, "Net commission" meaning gross plus VAT, "Nil" over 30,000 unreconciled, "SPA fee
    5,250" beside a total computed on 6,000. FOUNDER, who had been saying this for three days
    before it was heard: "the tab header is saying something and doing something."
    STANDING RULE: when a surface changes, the words above it change in the same cut.
ALSO SIZED: D7 roles arc is HALF BUILT - capabilities are already per-company data with a settings
grid; only custom roles are missing, and the database names roles in just two functions and three
policies. Roughly a day, not a rebuild. Next major target after the walkthrough.
NEXT: the block walkthrough. The 1-to-1 path is proven; blocks carry the harder money mechanics.

## ── DAY 85 EVENING — THE BLOCK WALK ──
Block created, distributed at 5% pro-rata, developer-approved, confirmed. THREE FIXES FROM DAYS 81,
83 AND 84 PROVEN AT ONCE: children born carrying plan and DLD; each carrying 4.50% from the
commission RPC, its first real exercise; the booking clock stamped 12 Aug at 23:59:59 Dubai, five
working days out with the weekend skipped.
THE ALLOCATOR IS EXACT. The reservation split EQUALLY - each unit owes a flat 25,000. The 402,415
instalment payment split PROPORTIONALLY on DLD and instalment but EQUALLY on SPA and Oqood: twelve
allocation rows summing to within one fils. Nobody told it to distinguish; it follows from what
each unit owes.
FIXED: block reservation allocations never carried their `particular` - null on every row ever
written, because the reservation path did not set it while the post-reservation collector did.
Create AND amend paths both fixed, existing rows backfilled. The display read through it, so this
was untidy rather than broken.
BUILT: a block can now be DELETED before confirmation, guarded on the LINES not on status - if any
child was ever born it refuses and must be cancelled instead.
⭐ THE FINDING THAT STOPPED THE WALK: A BLOCK CHILD HAS NO CLOSURE ROW. It never goes through the
reservation ceremony - it is born at Offer Accepted and roll-up moves it to Reserved - so no
pp_sales_closures row exists. Consequences seen live: no frozen fee policy, so the deal states an
SPA fee of 5,250 while the block shows 6,000 for the same unit; and no ledger, so the bill panel
reads "25,002 already credited" when the block has allocated 163,436 to that unit. Both wrong, in
opposite directions. ARCHITECT'S CALL: roll-up should CREATE the closure row. One shape fed from
two paths, rather than teaching every money panel to handle two shapes forever.
⚠️ AND A RULING IS NEEDED FIRST: after reservation, does collection stay at BLOCK level or move
PER CHILD? The app allows both and neither knows about the other.
ALSO CAPTURED: a block never sends the buyer a PROPOSAL at all - units are claimed and 75,000
demanded against nothing on paper. And TWO LISTS, NOT ONE: what stops a tester (briefable) versus
what loses a DEMO (not briefable) - resale being the largest of the second kind.

## ── DAY 86 — THE BLOCK MONEY PATH CLOSED END TO END ──
RULING FIRST: money arrives at BOTH levels because that is how buyers pay - "it is a limitation of
the card, I will pay this, bring a cheque later", and on a block it may come in tranches. ONE
LEDGER PER CHILD, TWO SOURCES. Block allocations are the AUDIT TRAIL; the closure row is the
BALANCE, derived from it, never summed beside it.
BUILT: `birthChildClosure` - a block child now gets its pp_sales_closures row when the reservation
completes, seeded from the block's terms with the fee policy frozen and the block's allocations
credited. `postAllocationsToChild` - later block payments post into that same row, cumulative and
idempotent, carrying the date the money was RECEIVED rather than posted.
PROVEN LIVE on a fresh block: 50,000 reservation then 1,381,643 collected, both children's ledgers
filled to the dirham - 232,588.50 and 739,984.93 instalment, 93,035.40 and 295,993.97 DLD.
ENFORCED, per the founder's sealed ruling "payments block, SPA line-wise": on a BLOCK CHILD the
money table, the waive buttons, Save payments, the DLD radios and the FINAL PRICE are all locked -
the price comes from the block's locked distribution. And no child may record an SPA until the
WHOLE BLOCK is collected, computed by summing the children's ledgers rather than reading
collection_status, which tracks only the reservation.
FIXED ALSO: the "Reservation settled" chip had REPLACED the Record payment button, so once the
reservation closed there was no door to the post-reservation collection phase at all - the Day-80
instalments, SPA fees, DLD and Oqood were reachable only by collecting them BEFORE settlement.
And the DLD radio on the SPA gate wrote `dld_payer` while every money computation reads
`current_dld_payer`: the button turned green and the bill did not move.
The block calculator's discount now caps at 100% - 50,000 typed into a percentage field produced a
net price of MINUS 1.8 billion and the app computed it without complaint.
⭐ AND THE FIND THAT WAS ON NOBODY'S LIST: src/lib/supabase.js loaded the client from
https://esm.sh AT RUNTIME while @supabase/supabase-js sat installed in package.json and unused. So
every tenant's app depended on a third-party CDN staying up - and mid-session esm.sh returned 404
for a sub-dependency and the WHOLE APP STOPPED LOADING. Nothing in the codebase was wrong; someone
else's server was. Now bundled. It was invisible until the CDN happened to fail while we were
working; it could as easily have failed during a demo.
RULINGS SETTLED TODAY: money at the block, SPA per child - and the reason is the SIGNATORY, not
registration: a father buying for three children means three different owners in one block. THE
SPONSOR PAYS, THE OWNER HOLDS TITLE, and the app records both (C15 now has a concrete case and a
design). A block child proceeds only when the WHOLE block is collected - the allocator splits for
accounting, but the money was never against one unit, and the bulk discount was granted for the
bulk purchase.
NEXT: the Day-86 findings still open - the Payment Summary contradicting the table above it, the
block header reporting only the reservation on a fully collected block, currency formatting on
numeric fields, whether amending a payment leaves a trail. Then the 1-to-1 SPA ceremony and a block
child walked through to Won.

## ── DAY 87 — THE BLOCK PROPOSAL, AND THE FLOW SIMPLIFIED BY THE FOUNDER ──
THE GAP CLOSED: a block used to reach Closed Won with NOTHING the buyer had agreed to in writing.
It now has the same grammar as a 1-to-1 - versioned offers, supersession, acceptance - with one
source of truth: THE DISTRIBUTION STAYS MASTER and each offer is rendered from it.
⭐ AND THE DESIGN WAS THE FOUNDER'S, THREE TIMES OVER. The architect built a two-button flow (lock,
then send), approval recorded per version, and an authority gate. Each was questioned, each was
wrong:
 - TWO BUTTONS became ONE. "When I click the button it saves the record and sends the proposal at
   the same time - why set first and then send?" There was no reason: the lock existed first and
   the send was bolted beside it. History, not design.
 - APPROVAL PER VERSION became ONE APPROVAL. "The negotiation happens at the developer's office -
   they play within it." Recording it on every version was bureaucracy.
 - ACCEPTANCE PER ROW became ONE ACT. "At V10 I move to accepted - I can send 100 proposals, I
   cannot have a button on every save." Settled by WALKING THE 1-TO-1, which shows proposals as a
   COUNT and acceptance as a stage move.
THE CALCULATOR NOW HAS THREE STATES, and this too was the founder's: "everything is frozen after
the first proposal is sent - a button to edit the offer, or move to accepted." It is not a scratch
pad once an offer exists; what it shows IS the live offer.
  no offer sent -> editable, one Send button
  offer sent    -> FROZEN. Edit the offer / Offer accepted
  accepted      -> FROZEN. Reopen negotiation, MANAGER ONLY, with a reason
  money in      -> the existing settlement lock holds
AN IDENTICAL REPEAT IS REFUSED - nothing saved, nothing sent. Any real change (price, plan, DLD,
units) sends. The first offer always sends. Resending an unchanged offer is the PDF's job, not a
new version's.
FIXED ON THE WALK:
 - REMOVING A LINE COMMITTED IMMEDIATELY. A broker who pressed remove to look at something and then
   pressed Cancel had already lost the line WITH ITS DISCOUNT, and no way back. Every other edit
   lived in form state; only remove wrote straight through. It now joins them, with a confirmation
   first - founder: "it is a warning for making a mistake; even after that you proceed, so the app
   does not take responsibility." A line WITH a child keeps the drop ceremony: dropping a live deal
   is not a form edit.
 - A UNIT JOINING A BLOCK ARRIVED AT 0%, so adding one to a 5.5% block silently dropped the block
   total to 2.04%. It now inherits the block rate.
 - THE BLOCK RATE RESET TO 0 on every open, which is WHY the inheritance had nothing to read. The
   founder's fix, and better than the architect's line-scanning: THE BLOCK RECORDS ITS CURRENT
   OFFER - current_proposal_id and current_discount_pct, written by the send. One field, one
   writer, one moment. It also removes an inference: "the latest proposal" was derived from
   status != superseded, so a half-failed send would leave two live offers or none.
 - The tab's send button referenced `lines` and `units`, which exist only in the calculator - two
   doors to one act, and the second one crashed. The send lives in the calculator; the tab is
   history.
STILL OPEN: no PDF for a block proposal - "sent" is notional until there is a document. The header
is crowded with six buttons. The wording still leaks D and V at the broker. The type filter on the
opportunity list renders but does not respond.
⭐ AND THE PDF, so "sent" stops being notional. A block proposal now produces a document: branded
banner, buyer and developer, plan and DLD, list -> block discount -> total payable, a PER-UNIT
SCHEDULE and the reservation figure. Rendered from the SENT VERSION's structured_data, never the
live calculator, so reprinting an old offer shows what was actually offered.
WHAT THE BUYER SEES AND DOES NOT: per-unit NET prices, one block discount figure - not the split
between units, which invites an argument about which unit got what when the concession was for the
block as a whole. No commission, no approval reference, nothing internal.
AND "WHAT YOU PAY BEFORE THE SPA" - instalment, DLD share, SPA fee, Oqood, total. FOUNDER: "if you
do not put it in the proposal there will be arguments - you never told me about all this." Computed
at TODAY's rates with a disclaimer rather than frozen: government fees are the government's, and
claiming to fix them would be a certainty the broker does not have.
FOUND WHILE BUILDING IT: unit descriptions came out BLANK, because the caller passes availUnits
which EXCLUDES units already in the block - so a buyer received "EBT-07-03 - AED 1,414,581" with no
idea whether it was a studio or a four-bedroom. Now fetched rather than depended upon.

## ── DAY 88 — THE ROOT CAUSE BEHIND A WEEK OF FINDINGS ──
⭐ THE GATE FORM WAS NAMED BY THE DESTINATION, NOT BY WHERE THE BROKER IS. At SPA Requirements the
advance button targets SPA Signed, and the dialog is titled by the TARGET - so pressing "Collect
payments" opened a form headed "Record SPA Signing", carrying a final price, a signing date, an SPA
reference and a document upload. A ceremony for a signing that had not happened.
That single line explains most of the week: the collection table appearing at a signing, the
heading naming the wrong act, quick-fill date applying everywhere, and the document upload that
could only be reached by pressing Amend - which unlocked the whole money record on a deal whose
commission invoice was already raised.
FIXED: a "SPA Requirements" gate now opens when he is AT SPA Requirements with money outstanding.
The signing fields are HIDDEN there - hidden rather than greyed, because greyed fields read as live
and cost the founder twenty minutes twice in one week. The heading says "Collect payments", the
footer says "Save payments", and saving RECORDS THE MONEY WITHOUT MOVING THE STAGE. Advancing to
SPA Signed stays a separate, deliberate act for the day the buyer actually signs.
⚠️ THE SIGNING SIDE IS PROVEN - a block child was taken through SPA Signed with its document
uploaded. THE COLLECTION GATE HAS NEVER BEEN OPENED. It is coded and committed but untested, and
that is the FIRST THING TO DO on the next session: a 1-to-1 at SPA Requirements with money
outstanding should give a form headed "Collect payments" with no signing fields, and saving should
leave the stage where it is.
LESSON FROM THE CUT ITSELF: four anchor attempts failed on this file before one landed. A 5,000-
line JSX tree cannot be edited by pattern-matching on indentation - the successful method was to
READ the region first, then search for the open and close BY CONTENT with a verified bracket, and
abort rather than guess. Every failed attempt aborted safely; nothing was corrupted. Also caught by
a grep rather than the build: setCollectionTick did not exist, and Vite does not fail on an
undefined identifier - it would have thrown the moment Save was pressed.
STILL OPEN: the type filter on the opportunity list renders but does not respond · the block header
carries six buttons · the wording still leaks D and V at the broker · admin (580) and trustee
(4,200) fees are hard-coded, and a developer admin charge is not modelled at all · the block header
reports only the reservation on a fully collected block.

## ── DAY 89 — THE 1-TO-1 GETS A PAYMENT TRAIL ──
THE HOLE, found at the end of Day 88. FOUNDER: "if he changes 50k to 25k by mistake and saves, what
happens?" It was overwritten silently. The deal's money lived in ONE JSON FIELD PER PARTICULAR on
pp_sales_closures and every save replaced the whole object - so three cheques against a first
instalment became one number, and a mistyped correction erased the original with no trace. The
BLOCK had always done this properly: a row per payment with amount, mode, reference and date.
⭐ BUILT: `pp_payments`, mirroring block_payments. THE ROWS ARE THE TRUTH, THE LEDGER IS THE SUM -
pre_spa_payments is no longer typed into, it is DERIVED after every write, so the two cannot
disagree. Nothing else changed: every panel that read the ledger keeps reading it and now finds a
figure that is always the sum of real payments.
MIGRATED: 28 existing figures became rows, verified count-for-count before anything read from them.
Without that first, the first sync would have zeroed every ledger in the database.
THE LEDGER CELLS ARE NOW READ-ONLY. A "+" on each row opens a dialog for ONE payment against THAT
particular - the particular is passed in, never chosen, so money cannot be filed against the wrong
line the way a dropdown would allow. Amount, mode, reference, date: everything the broker was TOLD
by the developer or the bank, nothing computed or defaulted except today's date.
⭐ TWO KINDS OF MONEY, TWO RULES ON OVERPAYMENT, and the founder settled it:
 - FLAT FEES (reservation, booking) - once settled the "+" DISAPPEARS. "We only come here BECAUSE
   the reservation is fully paid; any amount collected here is other than reservation." An excess
   there is a misclick, and a confirmation just lets it through when he taps OK out of habit.
 - COMPUTED FEES (instalment, DLD, SPA, Oqood) - percentages, so small differences are normal:
   bank charges, rounding on a 4% DLD. Warn only beyond 500 AED. Never refuse: the app records what
   arrived.
ALSO: every payment writes an ACTIVITY, so the deal's timeline now carries the money trail. A
PAYMENT HISTORY sits under the ledger, collapsed, with a manager-gated VOID - voiding, not deleting,
because a payment recorded in error is a fact about the record. The row stays with a reason and the
ledger re-derives without it. PROVEN LIVE: deleting a row re-derived the reservation from Mixed back
to Credit Card and 25,025 back to 25,000.
NEXT, and the founder's own words: "a report which can be sent if the buyer asks" - a buyer-facing
payment statement PDF, reading these same rows.
LATER ON DAY 89 - THE STATEMENT, AND THE HEADER THAT WENT QUIET.
⭐ A BUYER-FACING PAYMENT STATEMENT, reading the payment rows built this morning: every payment in
date order with how it was paid and its reference, so the buyer can match each line against his own
bank record, then "Where it stands" - due, paid, outstanding per particular. Voided payments are
excluded; a buyer's statement shows what he PAID, not what was recorded in error. It stops at the
pre-SPA bill: what remains on the price afterwards is the developer's payment plan.
⭐ THE BLOCK HEADER NOW READS ITS WHOLE STATE. "Collected in full" used to describe the RESERVATION -
50,000 on a block that had taken 1,431,643 - and once it settled nothing said what happened next.
FOUNDER: "if the money is the end of the block, give an appropriate message to say now the SPA is
unit-wise." It now says: money outstanding -> "AED X still to collect across the block"; fully
collected -> "each unit's SPA is recorded on its own deal (n of m sold)"; all children won ->
"Block complete". PROVEN LIVE on Vinayak Block 1: "Reservation settled - AED 191,026 still to
collect across the block."
THREE ANCHOR MISSES ON blockBill's SHAPE before that worked: it returns { per, tot, grand }, not
{ total: { bill, collected } }, and paidByParticular EXCLUDES the reservation. Reading a key that
does not exist would have shown "collected in full" on a block still owing - a false all-clear on
the money path, caught by checking the shape rather than trusting a clean build.
REMOVED: printReceipt, dead and carrying hard-coded "PropCRM" branding a buyer should never see.
The LIVE receipt was fine all along - the architect read the dead one and assumed the live one
shared its fault. Correction boarded the same day.
FOUND AND BOARDED: "Buyers bill to SPA" counts only the reservation on BOTH verticals - 25,000
credited where the strip above says 360,643 collected, so a broker would chase money already paid ·
brokerage commission is visible to a sales agent in THREE places with no capability check · five
block children predate the closure-row fix and have no ledger, which is a real upgrade case even
though this database gets wiped.
