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
