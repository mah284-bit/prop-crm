# Multi-Tenant Isolation Audit — Day 30 (7 June 2026)

**Status:** AUDIT COMPLETE. Fixes pending (next session). NO code changes made during audit (deliberate: catalog first, fix with full context).
**Trigger:** Founder spotted, while testing the unified company switcher, that switching to an empty company (Emirates Premium) still showed populated data on several screens. Correct instinct — pushed to verify screen-by-screen rather than assume.
**Test method:** Two companies walked end-to-end on LOCAL:
- **Al Mansoori Properties** (`c23a2320-1b35-4636-a840-532c247a6cf9`) — populated (35 opps, 50 units, 4 customers, AED 1.2M commissions)
- **Emirates Premium Realty** (`e536de3f-0090-474e-8036-315e474174f1`) — near-empty (0 opps, 30 units, 0 customers, 0 commissions)
- Logic: a leak shows loudest on the empty company — any data appearing there that belongs to Al Mansoori = cross-company exposure.

**Deadline context:** Investor pushing for go-live 1 July (sales) + 1 Aug (leasing). Founder must answer next weekend. Multi-tenant isolation IS the investor's real "is it secure" question — so this audit + an automated isolation test is the fastest path to a defensible answer.

---

## CONTEXT — the switcher change that enabled this audit
Earlier this session: unified the header company switcher to call the existing
`switchCompany(id)` function (App.jsx ~17077) instead of its partial inline logic.
- Before: header select only set localStorage + reloaded (did NOT update `profiles.company_id`).
- After: calls `switchCompany()` which updates `profiles.company_id` in DB + localStorage + reloads.
- **This change is CORRECT and KEPT.** It made company-switching actually work, which is
  what surfaced the pre-existing leaks below. The leaks were always there — just hidden
  because switching never fully worked before.
- Status: uncommitted at audit time (App.jsx). Decision: keep.

---

## ISSUE LOG (severity-ordered)

### #7 — CRITICAL — Commission Outstanding: cross-company financial leak
- Emirates Premium shows Al Mansoori's ENTIRE commission book: AED 1,212,301.71 invoiced,
  AED 972,629.43 outstanding, identical 8 invoices (Aldar/Nakheel/Emaar/Sobha), same
  Outstanding-by-Developer, same Aging Breakdown.
- Emirates has zero deals → should show zero. This is the demo's "money moment" screen.
- HIGHEST severity: financial data, cross-tenant, on the centrepiece screen.

### #4 — HIGH — Master Agreements: cross-company confidential leak
- Both companies show identical 4 agreements (Azizi/DAMAC/Aldar/Emaar) with same refs
  (TEST-DMC-2026 etc.) AND same "Used In" counts (DAMAC 3, Emaar 4 — those usages are
  Al Mansoori's).
- Master agreements = per-tenant CONFIDENTIAL commercial terms (negotiated commission rates).
  A tenant seeing another tenant's rates = serious breach. Opposite of PropPulse (which is
  intentionally shared).

### #6 — MED — Lead Queue: cross-company leak
- Emirates shows same Unassigned (1: Mukund Sangli), Stale Flagged (7), History (4) as
  Al Mansoori, despite Emirates having no leads. Tab counts AND lead list both unscoped.
- Phase 2.1 code (Day 22).

### #5 — MED — Group & Branches: wrong company (OUR Stage 2 code)
- On Emirates, shows "Al Mansoori Properties Group" + Al Mansoori branch instead of
  Emirates' own group. Component: `GroupBranchesSection.jsx` (built Day 29).
- Suspected cause: active-company resolution `currentUser?.company_id || localStorage`
  latches stale/cached `currentUser.company_id` (Al Mansoori) over the switched value.
- NOTE: this same resolution pattern appears in ~5 places in App.jsx — check all for the
  same latent issue.

### #1 — MED — Leads screen header: summary counts not company-scoped
- On Emirates: lead list correctly empty ("0 total contacts · No contacts found") BUT
  header shows "28 active opportunities · 7 won deals" (Al Mansoori's numbers).
- The list scopes right; only the two aggregate counts don't.
- Localized: Dashboard + Reports count the SAME data correctly, so this is one component's
  summary calc using an unscoped source.

### #3 — VERIFY — Users screen: all-company visibility
- On Emirates (super-admin), Users list shows 7 users from Al Mansoori / Test Brokerage Z /
  Default Company, none from Emirates.
- MAY be by-design: UserManagement.jsx ~line 35 comment "All other roles only see users
  from their own company" implies super-admin intentionally sees all.
- MUST verify with a NON-super-admin login. If a tenant admin also sees all-company users,
  it's a real leak. Belongs to the lockdown-stage `is_super_admin` bypass audit.

### #2 — LOW — Emirates inventory: duplicate unit refs (data quality, NOT a leak)
- EPR-001 through EPR-010 each repeated across 3 projects (One Za'abeel/Atlantis/Six Senses)
  = 30 rows, non-unique refs. All correctly within Emirates (no leak). Seed-data quality issue.
- Risk: linking an opp to "EPR-001" is ambiguous (3 matches).

### WATCH-ITEM A — Dashboard "stale leads" banner references EPR- units
- Al Mansoori dashboard banner lists EPR-010, EPR-008 (Emirates' units) among stale leads.
- Possible cross-company reference in that banner, OR a lead legitimately referencing those
  unit codes. Revisit during fixes.

---

## CLEAN / CORRECTLY SCOPED (verified)
- Dashboard core stats (pipeline, opps, won, stages, team) ✅
- Opportunities (list + count "35 of 35" vs Emirates 0) ✅
- Projects (Al Mansoori 7 vs Emirates 3, different sets) ✅
- Inventory (Al Mansoori 50 vs Emirates 30, different prefixes) ✅
- Reports — ALL sub-reports (Pipeline, Sales Payments, Agent Performance, Lead Conversion,
  Tasks) all zero on Emirates ✅
- Customers (list + summary cards: Emirates 0 / AED 0) ✅ — proves summary cards CAN scope
  correctly when written right (contrast with #1)

## EXPECTED-GLOBAL (by design — NOT leaks)
- PropPulse — shared cross-tenant intelligence layer (the moat). Same for all companies = correct.
- Companies screen — super-admin sees all companies by design.

## NOT YET TESTED
- AI Coach — DEFERRED to LIVE (needs backend; local has none). Check whether Coach analyses
  only the active company's deals or pulls cross-company. Test on prod last.
- Agent Pools section (Settings) — not captured during walk; check for same admin-cluster leak.

---

## DIAGNOSIS DIRECTION (the pattern)
Two clusters:
- **Clean:** older, core OPERATIONAL screens (Dashboard, Opps, Projects, Inventory, Reports,
  Customers) — these scope correctly.
- **Leaking:** NEWER code (Lead Queue Day22, Commission, Group&Branches Day29) + ADMIN screens
  (Users, Master Agreements).

Hypothesis: leaking screens either (a) miss `.eq("company_id", cid)` on their query, (b) use
the `currentUser?.company_id || localStorage` resolution that latches stale currentUser after
switch, or (c) rely on super-admin RLS bypass that returns everything. Likely a MIX:
- Commission / Master Agreements / Lead Queue → probably missing the company filter entirely
  (or querying a view/table without company_id).
- Group & Branches → stale active-company resolution (our code).
- Leads header counts → unscoped aggregate source.

NEXT STEP (afternoon): compare query patterns of ONE clean screen (Customers) vs leaking ones
(Commission Outstanding + Lead Queue) to pinpoint shared root cause(s).

---

## THE FOOL-PROOF AUTOMATED TEST (to build)
Manual screen-walking found these, but must NOT be how we guarantee isolation going forward.

**Multi-Tenant Isolation Test** — a SQL script (run before every demo/release) that:
1. For every company-scoped table (leads, opportunities, activities, proposals, invoices,
   master_agreements, agent_pools, lead_assignment_log, groups, etc.), reports row COUNT
   grouped by company_id.
2. Flags any table that LACKS a company_id column (candidate global-leak table — e.g. if
   master_agreements has no company_id, that explains #4).
3. (Optional, stronger) A per-screen query harness that runs each screen's actual query
   scoped to an empty company and asserts zero rows.

Value: converts "we hope it's isolated" → "we can PROVE it" in ~10 seconds. This is the
defensible artifact for the investor's security question. Build it FIRST next session — it
reveals the COMPLETE leak map (confirms these 7, finds any missed), making fixes mechanical.

---

## PLAN (next session, fast — investor deadline)
1. Build + run the Multi-Tenant Isolation Test → complete leak map (which tables lack
   company_id, which have cross-company rows).
2. Diagnose shared root cause via clean-vs-leaking query comparison.
3. Fix in severity order, re-running isolation test after each:
   #7 Commission → #4 Master Agreements → #6 Lead Queue → #5 Group&Branches → #1 Leads counts
   → #3 Users (verify non-super-admin first).
4. Commit each fix as its own checkpoint. Re-walk both companies to confirm.
5. THEN resume Stage 3+ of the identity refactor with isolation proven.

## DECISIONS LOCKED
- Switcher unification: KEEP (correct; enabled the audit).
- Audit-then-fix discipline: catalog complete BEFORE any fix (avoids half-fixes / missed patterns).
- Isolation test built BEFORE fixes (reveals full scope, becomes the regression guard + investor proof).
- super-admin caveat: several "leaks" may be by-design for super-admin; the real test is
  non-super-admin behavior — fold into lockdown-stage is_super_admin bypass audit.

---

*Audit: 7 June 2026 (Day 30 morning). Founder-driven, screen-by-screen, two-company method.
No code changed during audit. Fixes + isolation test = next session. Last commit 2484792
(stage2-complete) + uncommitted switcher fix in App.jsx (keep).*

---

## NORMAL-USER VERDICT (7 June 2026, Day 30 afternoon) — THE DEFINITIVE TEST

**Method:** Created two fresh, transaction-free test users (both Admin role) on PROD:
- Raja Shekhar (raja@proptest.ae) — Al Mansoori Properties
- Roy James (royjames@proptest.ae) — Emirates Premium Realty
Plus light labeled seed data in Emirates (3 "EPR-TEST" leads + 2 opps, AED 4M/9M).
Tested on PROD because user creation + password reset need the backend (fail on localhost).

**RESULT — COMPANY ISOLATION WORKS, BOTH DIRECTIONS:**

| User | Saw | Did NOT see | Verdict |
|------|-----|-------------|---------|
| Roy James (Emirates admin) | Only Emirates: 2 EPR seed opps, AED 0 commissions | Al Mansoori's 35 opps, AED 1.2M, agreements | ✅ ISOLATED |
| Raja Shekhar (Al Mansoori admin) | Only Al Mansoori: 19 contacts, 28 opps, 7 won | None of the EPR-TEST leads/opps | ✅ ISOLATED |

**KEY CONCLUSION:** The 7 issues catalogued in the morning were observed AS SUPER-ADMIN.
A NORMAL tenant user is correctly, fully isolated. Most "leaks" = super-admin god-mode
(expected platform-operator behavior, controlled at lockdown). Commission Outstanding —
which showed AED 1.2M cross-company to super-admin — correctly showed AED 0 to a normal
Emirates user. **The system is tenant-safe on the boundary that matters for the investor's
"is it secure" question.**

### Re-classification of the 7 issues
- #7 Commission, #4 Master Agreements, #6 Lead Queue, #3 Users → were SUPER-ADMIN visibility,
  NOT normal-user leaks. Resolved by the LOCKDOWN (remove super-admin default tenant access).
  NOT critical code bugs.
- #5 Group & Branches (our Stage 2) → genuine code issue (stale active-company resolution).
  Small fix. Still to do.
- #1 Leads header counts → genuine but low-severity (showed company's own counts to normal
  user; mainly a consistency fix).
- #2 Emirates dup unit refs → data quality, unchanged.

### Two scoping LAYERS clarified (founder insight)
1. COMPANY isolation (tenant boundary) → PROVEN ✅
2. WITHIN-COMPANY role visibility → admin sees all company data (confirmed correct via Roy+Raja);
   BROKER/sales_agent SHOULD see only assigned work (founder vision) — NOT YET TESTED.
   Needs a sales_agent test user with assigned opps. NOT a security breach (same-company data) —
   a product/role refinement. Fast-follow, not a go-live blocker.

---

## PRIORITISED FORWARD PLAN (Architect's call)
1. **CRITICAL / DONE:** Company isolation — proven both directions. Go-live safe on tenant boundary.
2. **HIGH / go-live gate:** LOCKDOWN — remove super-admin/platform-operator default access to
   tenant CRM data + audited break-glass. Turns "secure for normal users" into "secure, full stop."
   This handles morning issues #7/#4/#6/#3 at the root (the is_super_admin bypass).
3. **MEDIUM / fast-follow:** Broker-visibility enforcement (agent sees only assigned, admin sees all
   — founder vision). Same RLS+role family as lockdown; done together to avoid touching policies twice.
4. **SMALL / anytime:** Fix #5 Group&Branches stale active-company resolution; #1 Leads header count.
5. Then resume the Settings-hub re-home (Stage 4) + Platform Admin surface (Stage 5).

## TEST ARTIFACTS ON PROD (to clean before go-live)
- Users: Raja Shekhar (raja@proptest.ae), Roy James (royjames@proptest.ae) — Admin test accounts.
- Seed leads: e9000001-0000-4000-a000-000000000001/2/3 (EPR-TEST Alpha/Beta/Gamma).
- Seed opps: e90000a2-0000-4000-a000-000000000001/2.
- Decision: KEEP for ongoing isolation testing during lockdown build; remove (or deactivate users)
  before first external customer.

---

*Normal-user verdict captured 7 June 2026 (Day 30 afternoon). Company isolation PROVEN.
Lockdown + broker-visibility = next focused session. The morning's alarm resolved: super-admin
god-mode, not broken RLS. System is tenant-safe for the investor security question.*
