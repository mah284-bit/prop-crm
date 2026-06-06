# Phase 2 — Identity, Group/Branch Hierarchy & Settings Hub (Design)

**Date captured:** 6 June 2026 (Day 29, afternoon design session)
**Status:** DESIGN LOCKED — build follows, foundation-up. No code until this is committed.
**Supersedes/extends:** `Architecture_Multi_Tenant_Identity_Model.md` (the two-tier model holds; this adds the group/branch hierarchy + Settings surface + final sequencing).
**Context:** Post-demo. Investor verbally committed (~1 July). The migration the identity doc called "post-demo" is now in scope.

---

## TL;DR — the locked model

PropCRM organises around **two orthogonal axes** plus a **two-tier identity**:

1. **WHERE you operate (scope):** Group → Branch → data. Structural.
2. **WHAT you can do (ACL/role):** the existing 7 fused roles. DONE — already works.
3. **WHO you are (identity tier):** Platform Operator vs Tenant User. The foundation.

Build foundation-up: structure now, lockdown at go-live (config flip), break-glass at first external customer.

---

## 1. Group / Branch hierarchy (LOCKED)

### The model
```
GROUP (optional umbrella — "Al Mansoori Holding")
  └─ BRANCH (a Trade License — "Al Mansoori Dubai")   ← = today's `companies` row
       └─ USER (role + branch placement)
            └─ owns LEADS / OPPS / DEALS / etc.
```

### Schema keystone decision (LOCKED — Option B)
- **`company_id` STAYS as the BRANCH** (the Trade License). Unchanged. Every existing
  query/RLS/`roles:[]` filter keeps working — zero disruption to the ~hundreds of
  `company_id` touch-points.
- **Add `groups` table + `group_id` column on `companies`** — purely additive, ABOVE.
- Single-branch brokerages: one group, one branch — hierarchy is invisible to them.
- Multi-branch groups: cross-branch visibility is an UPWARD lookup (same group_id +
  role permits), an added RLS clause — NOT a rewrite of the company_id foundation.

### Why Option B (not company_id = group)
If company_id meant the group, every existing query would scope too WIDE (all branches)
and we'd re-narrow hundreds of touch-points with branch_id. That's the comeback-prone
rework. Option B keeps the bedrock still.

### UI language
Talk in terms of **Group** (umbrella) and **Branch** (= the `companies` row). DB keeps
`company_id` as the branch key — NO rename (too risky). Vocabulary only.

### Branch visibility (one model, configurable — covers the old options 1/2/3)
A `branch_visibility` setting per group:
- `isolated` — branches never see each other
- `group_admin_only` — only group-level admin sees across; branch staff stay local
- `shared` — staff can be granted multi-branch access
A user belongs to one branch by default; can be granted additional branches
(handles real-world "people move suddenly" mobility).

---

## 2. Roles / ACL axis (LOCKED — DONE, nothing to build)

### Decision: keep FUSED roles (app baked into role)
7 roles: super_admin, admin, sales_manager, sales_agent, leasing_manager,
leasing_agent, viewer. App (sales/leasing) is fused into the role by design —
a leasing agent and sales agent are genuinely different jobs, not one role with a toggle.

### Why NOT split role × app
Splitting would force every permission check, RLS policy, and `roles:[]` TABS filter to
check two fields — hundreds of touch-points = comeback rework. The "cleanliness" is
theoretical; the cost is real. "Both" lives at the BRANCH level
(`companies.business_type = sales|leasing|both`), which is the correct home.

### The two real needs — both ALREADY MET
- **Mobility** (leasing↔sales): admin edits user's role value. Edit form works
  (UserManagement.jsx — editUser path updates role on existing user).
- **Upliftment** (agent→manager): same edit form. Works.

### Deferred (captured, NOT now)
Custom role creation + per-permission toggles. No tester has asked. Revisit only on
real demand. Building a permission engine now = speculative complexity.

### Edge case (noted, deferred)
No clean "works across both apps" person-level option. Rare. If needed later → app-access
flags at user level. Not now.

---

## 3. Two-tier identity (LOCKED model, STAGED build)

### The tiers (from Architecture_Multi_Tenant_Identity_Model.md — holds)
- **Tier 1 — Platform Operator:** runs PropCRM (founder + future PropCRM staff).
  Onboards companies, platform config, billing, PropPulse content. `company_id=NULL`.
  DEFAULT: zero tenant CRM data access.
- **Tier 2 — Tenant User:** brokerage staff. Full CRM scoped to their branch(es).

### Founder's two needs (this session)
1. **Assign Super Admin to own users for onboarding as PropCRM grows** → these are
   Tier-1 Platform Operators (future PropCRM employees). Same rules: no default tenant
   data access, break-glass when needed.
2. **The access dilemma** ("if I keep access I'm lying about data privacy; but how do
   I support?") → resolved below.

### The trust dilemma — RESOLVED (industry-standard answer)
Default NO access + audited break-glass. The customer trusts the SYSTEM, not the person:
- **Default:** Platform Operators have ZERO read access to tenant CRM data. Privacy
  promise is TRUE, not a lie.
- **Break-glass:** tenant explicitly grants time-limited (e.g. 4hr), logged, scoped
  access when they need support. Tenant sees exactly what was accessed. Auto-expires.
- **Honest pitch:** "We can't see your data. Support needs your one-tap, logged,
  expiring grant — you see everything we did. You're always in control." A SELLING POINT.

### Build sequencing (LOCKED — staged, so trust stuff becomes a later SWITCH not a now-decision)
- **NOW (this refactor):** build STRUCTURE — group/branch hierarchy + `is_platform_operator`
  flag + make company-scoping real. **Founder keeps current access during development**
  (needed to build/test). Nothing locks yet.
- **AT GO-LIVE:** flip the lockdown — Platform Operator loses default tenant-data access.
  A CONFIG FLIP, not a rebuild (structure already supports it). Thrown when first real
  external brokerage onboards.
- **AT FIRST EXTERNAL CUSTOMER:** build break-glass (~1 day, self-contained) — exactly
  when a real tenant exists to support. Not before (no external data = nothing to breach).

### Why this sequencing is correct (not over-thinking)
Pre-external-customer, the trust dilemma is real but NOT YET LIVE. Locking yourself out
now helps no one and slows your own dev. Building structure now makes lockdown +
break-glass cheap LATER additions, not rewrites. Pay the structural cost once, now.

---

## 4. Settings Hub (the SF/Dynamics-style surface — DESIGN)

### Principle
Two-tier identity ⇒ TWO Settings surfaces. The rules (identity) get a home (Settings).

### Surface A — Tenant Settings (a brokerage configures ITS OWN world)
Modelled on Salesforce/Dynamics "Setup" tree — organised sections, not scattered config.
Proposed information architecture:
- **Group & Branches** — group profile, branch list, branch_visibility setting, add/edit branch
- **Users & Roles** — user list, role assignment (existing UserManagement, re-homed here),
  branch placement, activate/deactivate
- **Agent Pools & Lead Routing** — (existing Settings module content — already built Day 21)
- **Master Agreements** — (existing module, re-homed)
- **Branding** — logo, company name, AI assistant name (existing, scattered → consolidated)
- **AI Configuration** — per-branch AI assistant name, quota view
- (later) **Billing & Plan** — tenant sees their own

### Surface B — Platform Admin (YOU run PropCRM — only Platform Operators see it)
Lighter, function over polish (just you for now):
- **Companies/Tenants** — onboard new group+branch, designate initial Tenant Super Admin
- **Platform config** — plans, AI quota ceilings, branding templates
- **PropPulse management** — the global cross-tenant intelligence layer (the ONE place
  Platform Operators legitimately manage shared data)
- **Billing overview** — all tenants
- (later) **Break-glass / support access log**

### Build note
Surface A (Tenant Settings) is mostly RE-HOMING existing scattered screens
(UserManagement, Agent Pools, Master Agreements, Branding) into one organised hub +
adding Group/Branches. Surface B is mostly NEW but light.

---

## 5. STAGED BUILD PLAN (foundation-up, each step a revertable checkpoint)

### Stage 0 — Design doc committed (THIS doc)
No code. Lock the model in git first.

### Stage 1 — Schema foundation (additive, safe)
- `groups` table (id, name, created_at, branch_visibility default 'isolated')
- `companies.group_id` column (nullable, FK to groups)
- `profiles.is_platform_operator` boolean default false
- Backfill: create one group for Al Mansoori, link it; founder stays as-is (dev access)
- IF NOT EXISTS + safety tag before running
- NO behaviour change yet — pure schema

### Stage 2 — Group/Branch in Settings (Tenant Surface A, first slice)
- New Settings section: Group & Branches (view group, list branches, branch_visibility)
- Re-home existing Settings (Agent Pools, Lead Routing) under the hub structure
- Read-only/additive — doesn't touch existing scoping yet

### Stage 3 — Make company-scoping real + switcher
- Audit the super-admin company switcher (currently partly cosmetic per backlog)
- Ensure queries honor active branch context
- Within-group cross-branch visibility (the branch_visibility setting) via RLS clause

### Stage 4 — Re-home remaining Settings screens (Surface A complete)
- Users & Roles, Master Agreements, Branding, AI config → into the hub
- Consolidation, not rebuild — existing screens, new home

### Stage 5 — Platform Admin surface (Surface B, light)
- is_platform_operator-gated area: tenant onboarding, platform config, PropPulse mgmt

### DEFERRED (not in this refactor)
- Lockdown flip → AT GO-LIVE (config, when first external brokerage onboards)
- Break-glass support access → AT FIRST EXTERNAL CUSTOMER (~1 day, self-contained)
- Custom roles / permission toggles → on real demand only
- Billing/plans → future

---

## 6. Founder principles applied
- "No half-hearted work / avoid comebacks" → Option B keeps company_id still; fused roles
  avoid hundreds of touch-points; structure-now makes lockdown a later config flip.
- "Architect controls my excitement" → custom roles, break-glass, platform polish all
  GATED to when there's a real need, not built speculatively.
- Trust dilemma → resolved by system+audit (industry standard), not personal promise.

---

*Design session: 6 June 2026 (Day 29 afternoon). Model locked across 6 questions:
branch relationships, schema keystone, role scope, role configurability, identity tier,
break-glass timing. Build is foundation-up, each stage a revertable checkpoint.*

---

## STAGE 1 — COMPLETE (6 June 2026, Day 29 afternoon)
Schema foundation landed on live DB (additive, idempotent, zero behaviour change):
- `groups` table created (id, name, branch_visibility ['isolated'|'group_admin_only'|'shared'], created_at)
- `companies.group_id` column added (nullable FK → groups)
- `profiles.is_platform_operator` boolean added (default false)
- Backfill: all 5 companies linked 1:1 to their own group, all branch_visibility='isolated':
  - Al Mansoori Properties → Al Mansoori Properties Group (a7328950...)
  - Default Company, Emirates Premium Realty, Gulf Leasing Solutions, Test Brokerage Z → each own group
Safety tag before migration: pre-stage1-identity-schema
Founder access UNCHANGED (dev continues). Nothing reads group_id yet — pure structure.
NEXT: Stage 2 — Group & Branches section in Settings (read-only view first).
