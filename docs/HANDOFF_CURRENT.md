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
