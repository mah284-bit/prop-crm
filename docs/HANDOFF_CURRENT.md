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
