# Access Control & Configurable Roles — Pre-Go-Live Security Scope (Decision + Design)

**Date:** 7 June 2026 (Day 30 evening)
**Status:** DIRECTION LOCKED. Build right, flex the date. Supersedes the earlier
"fixed roles for go-live, configurable later" lean.
**Builds on:** docs/Multi_Tenant_Isolation_Audit_Day30.md (company isolation PROVEN),
docs/Phase_2_Identity_And_Settings_Design.md, docs/Architecture_Multi_Tenant_Identity_Model.md.

---

## THE DECISION (founder standpoint — locked)

**Build access control RIGHT before go-live. Do NOT ship fixed/fragile roles to hit
1 July. The go-live date flexes to fit the security work.**

### Why (founder's reasoning, recorded verbatim in spirit)
The investor granting "go live 1 July" is PERMISSION, not WISDOM. If we ship a
fragile access model and 2 customers hit the same role/visibility problems we
uncovered in the Day 30 audit, the investor will not remember pushing the date —
they will ask "why did you agree if you couldn't complete it?" That is a far worse
position than asking now, from strength, for a couple more weeks citing security.

> "We should not be in an uncomfortable situation with a shippable solution."

A solution that is shippable-but-fragile on access control is not shippable — it is a
liability with a launch date. Asking for time over security is respected; shipping a
leak is fatal. Founder will officially push the dates with the investor (groundwork
already laid: "trying, no guarantees").

### Why this is ALSO the cleaner engineering path
Building fixed roles now + configurable later = the forward/backward rework trap the
founder explicitly wants to avoid. The remaining findings are all ONE system:
- Configurable role→permission model (customer defines who sees what)
- Lockdown (super-admin/platform-operator walled off from tenant data)
- Group/General Manager role (sees whole GROUP across branches)
- Broker-visibility (agent sees only assigned) — becomes a CONFIGURABLE option, not a hard-code
Doing them together as one coherent access-control layer is more robust than bolting
on fixed roles and rebuilding. Configurable is the correct platform end-state anyway
(Salesforce/Dynamics model).

---

## THE UNIFIED ACCESS-CONTROL MODEL (to build)

### Three axes (recap, now made enforceable + configurable)
1. WHERE (scope): Group -> Branch -> data. (group_id above company_id — built, Stage 1.)
2. WHAT (role/ACL): the role a user holds.
3. WHO (identity tier): Platform Operator vs Tenant User.

### Roles (the set — fused app, per locked design)
- **Agent** (sales_agent / leasing_agent) — operational, own assigned work.
- **Manager** (sales_manager / leasing_manager) — commercial oversight of their app
  (sales OR leasing) within their branch: sees ALL branch deals/pipeline/commission.
- **Admin** — administrative/operational control: Settings, user add/remove, inventory
  management, bulk lead assignment, all administrative works. (Commercial-data breadth
  = a CONFIGURABLE choice per the model below — founder's intent leans admin = ops, not
  necessarily full commercial overseer; configurable resolves this cleanly.)
- **Group/General Manager** (NEW) — sees the ENTIRE GROUP's data across all branches.
  Sits above branch managers. Uses the group_id hierarchy.
- **Super Admin (tenant)** — top of a tenant's own hierarchy.
- **Platform Operator** (Tier 1) — runs PropCRM; NO default tenant data access (lockdown).
- **Viewer** — read-only.

### The configurable layer (founder's core ask)
Instead of US hard-coding "Admin sees X, Manager sees Y" and tweaking per-customer
forever, the role->permission mapping becomes a SETTING the customer (tenant super
admin) controls. We ship the FRAMEWORK + sensible DEFAULTS; the customer configures
the POLICY to fit their structure, resources, budget. This removes us as the
forward/backward bottleneck and matches how mature platforms work.

Default policy (shipped, customer can adjust):
| Capability | Agent | Manager | Group GM | Admin | Default note |
|---|---|---|---|---|---|
| Own assigned leads/opps | yes | yes | yes | yes | |
| All BRANCH deals/pipeline/commission | no | yes | yes | configurable | manager = commercial oversight |
| All GROUP data (cross-branch) | no | no | yes | no | group GM only |
| Settings / config | no | no | no | yes | admin = ops |
| User management (add/remove/roles) | no | no | no | yes | admin |
| Inventory management | no | partial | partial | yes | admin |
| Bulk lead assignment | no | yes | yes | yes | |

(The "configurable" cells are exactly what the customer setting controls; defaults are
our opinionated starting point.)

---

## SCOPE OF THE BUILD (honest sizing)
This is a SIGNIFICANT build — weeks, not days — and it is WHY the date flexes:
1. **Permissions schema** — represent role->capability policy per tenant (and group-GM
   cross-branch grant).
2. **Enforcement in RLS** — policies that read the tenant's configured policy + the
   user's role + scope (branch/group) and enforce dynamically. Replaces the current
   is_super_admin global bypass (the lockdown).
3. **Config UI** — tenant super admin defines their role policy (in the Settings hub).
4. **Lockdown** — Platform Operator default tenant-data access removed + audited
   break-glass.
5. **Group-GM hierarchy enforcement** — cross-branch visibility via group_id.
6. **Broker-visibility** — agent-sees-only-assigned as a configurable default.
7. **Multi-combination SECURITY TESTING** — every role x scope x policy combination,
   using the isolation-test harness. A misconfigured permission rule = a leak, so this
   testing is non-negotiable (it is the whole point of doing it right).

---

## SEQUENCING (proposed - refine next session)
Stage A - Design the permission model in full detail (schema + policy representation).
Stage B - Build the isolation/permission TEST HARNESS first (so every step is verified).
Stage C - Implement enforcement (RLS) with hard-coded sensible defaults FIRST (provably
          correct), behind the scenes.
Stage D - Lockdown (super-admin/platform-operator) using the same enforcement layer.
Stage E - Group-GM + broker-visibility as policy options.
Stage F - Config UI (let tenant adjust the policy) - the customer-facing piece.
Stage G - Full multi-combination security test pass -> sign-off -> go-live.

Build-right ordering: enforcement + defaults + testing BEFORE the config UI. The UI
that lets customers change policy is useless (and dangerous) until the enforcement
underneath is proven. Defaults must be safe even if a customer never touches config.

---

## INVESTOR MESSAGE (founder handles; for reference)
"We stress-tested multi-tenant isolation. Core tenant separation is proven. To support
real customers with different access structures safely, we are building a proper,
configurable access-control layer with platform-operator lockdown - and testing every
permission combination. This needs a couple more weeks beyond 1 July. Shipping access
control we have not fully hardened would risk customer data and our credibility; we would
rather launch slightly later on a foundation that holds. Sales first, leasing follows."

Founder note: groundwork already laid with investor ("trying, no guarantees"); will
officially push dates after this decision. No discomfort - launching from strength.

---

## WHAT WE ARE NOT DOING (gates held)
- NOT shipping fixed/fragile roles just to hit a date.
- NOT building the config UI before enforcement + defaults are proven.
- NOT removing the isolation test discipline - every stage verified.

---

*Decision + design captured 7 June 2026 (Day 30 evening). Direction: build access
control right (configurable role-permissions + lockdown + group-GM + broker-visibility
as one layer), flex go-live to fit. Founder owns the investor conversation. Company
isolation already PROVEN (Day 30 audit); this hardens the full access model on top.*

---

## STAGE A - PERMISSION MODEL DESIGN (8 June 2026, Day 31 morning)

### A1. Representation decision: CAPABILITY FLAGS (not fine-grained per-object)
A role is granted a set of named capability flags. ~12-15 capabilities cover the app.
- Why: roles are clear archetypes (agent/manager/admin/group-GM) = bundles of powers, not
  per-field rules. Testable (small matrix = exhaustively security-testable before go-live).
  Fine-grained per-object permissions have too many combinations to prove safe (untested combo
  = leak). No brokerage has asked for finer control. Upgradeable later (capabilities can be
  subdivided; starting coarse and refining is safe, starting fine and simplifying is rework).

### A2. The capability set (refined with founder's brokerage-reality input)
Data visibility (WHAT can I see):
- see_own_data        - own assigned leads/opps (everyone)
- see_branch_data     - all deals/pipeline in my branch (manager+)
- see_group_data      - all data across all branches in my group (group GM)

Commission visibility (SPLIT - critical brokerage reality):
- see_brokerage_commission - what the COMPANY earns from developer (the 4%). ADMIN/MANAGER ONLY.
                             Company-confidential margin. Agents must NOT see this.
- see_own_commission       - the agent's OWN cut only (his split). Agent sees only his own.
- (the gap between the two = brokerage retained margin = NEVER shown to agent)

Administrative (WHAT can I manage):
- manage_users            - add/remove/edit users + roles (admin)
- manage_settings         - Settings hub / config (admin)
- manage_inventory        - projects/units (admin; manager partial)
- assign_leads            - bulk lead assignment (admin/manager)
- see_master_agreements   - developer agreements. ADMIN/MANAGER ONLY (hard rule, not configurable).
- manage_master_agreements- create/edit agreements (admin/manager)
- manage_commissions      - issue/mark brokerage invoices (admin/manager)

Platform tier (lockdown axis, separate):
- is_platform_operator    - platform-level; NO tenant data by default.

### A3. Commission model - THREE layers with strict visibility (founder's key insight)
1. Developer -> Brokerage (from master agreement): the brokerage commission (e.g. 4%).
   Visible to ADMIN/MANAGER only.
2. Brokerage -> Agent (from COMPANY/USER setup): the agent's split. Agent sees HIS OWN only.
3. The gap (brokerage retained margin): NEVER shown to the agent.

Agent commission rate placement (architect's call, founder-aligned):
- COMPANY level: default agent commission rate/split set in company setup (the brokerage standard).
- PER-USER override (optional): individual agent can have a different rate on their user record.
- PER-DEAL: agent commission is COMPUTED (brokerage commission x agent split / agent rate),
  derived not hand-entered - consistent + auditable.
- Mirrors the existing master-agreement pattern (developer rate flows agreement -> deal); this is
  one level down (agent split flows company/user setup -> deal). Architecturally consistent.

### A4. COMPANY TYPE drives default capability profiles (founder insight)
Capability DEFAULTS depend on how the brokerage is structured:
- SOLO / "broker is everything": one person sees all data + all commission. No separation.
  (The broker IS the brokerage - brokerage & own commission collapse into one.)
- MULTI-AGENT BROKERAGE: strict separation - agents see own + own commission only; brokerage
  commission + master agreements are admin/manager only.
This is WHY the Settings form must be carefully designed: defaults flex by company type/structure.
Company type is therefore an input to the default permission profile at tenant onboarding.

### A5. Hard rules (NOT configurable - safety floor)
- Master agreements: admin/manager only, always. Agents never.
- Brokerage commission margin: never visible to agents.
- Platform operator: no tenant data by default (lockdown).
These are the non-negotiable floor; the configurable layer can grant MORE within safe bounds but
cannot breach these.

### A6. Open design questions (next: A-continued)
- Exact schema: where capabilities live (a role_capabilities table? a JSON policy per tenant?
  per-role defaults + per-tenant overrides?).
- How company-type maps to a starting capability profile (a template set applied at onboarding).
- Where agent commission rate columns live (companies.default_agent_commission_* +
  profiles.agent_commission_* override?). To be designed with the commission-visibility build.
- These resolve in the schema-detail step before any code.

### A7. Schema architecture (LOCKED) - per-tenant capability table + defense-in-depth floor
Decision criteria (founder, paraphrased): must not get stuck now or future; simple/manageable;
security is paramount; founder is new to the dev environment so architect makes the call.

**Capabilities live in a per-tenant role->capability TABLE (Option 2):**
```
role_capabilities (
  company_id   uuid,      -- which tenant (branch)
  role         text,      -- sales_agent, sales_manager, admin, group_gm, ...
  capability   text,      -- see_branch_data, see_brokerage_commission, ...
  enabled      boolean,
  primary key (company_id, role, capability)
)
```
Why (vs the alternatives):
- Fixed-role-in-code (Option 1): rejected - gets stuck the moment a customer wants different
  access = rebuild. Fails "don't get stuck in future."
- JSON policy blob (Option 3): rejected - puts JSON parsing INSIDE RLS (the security layer);
  messier, harder to audit/verify. Security layer must be clean. Fails "security is key."
- Per-tenant table (Option 2): CHOSEN - configurable (extend = add rows), human-readable +
  auditable (SELECT reads like a spreadsheet), and RLS does a CLEAN relational lookup
  (provable, exhaustively testable). Satisfies all three criteria simultaneously.
- Ships with DEFAULT rows per company-type at onboarding; config UI later toggles `enabled`.

**Defense-in-depth for the crown jewels (the hard-rule floor):**
Principle: the more catastrophic a leak would be, the DEEPER in the stack we enforce against it.
- Ordinary visibility (which leads/opps) -> the config table is sufficient.
- CROWN JEWELS (brokerage commission margin; master agreements) -> enforced in BOTH:
  (a) config layer never offers/grants them to agents, AND
  (b) RLS itself structurally refuses them to agents - so even a malformed table row, a config-UI
      bug, a future developer mistake, or a direct DB edit CANNOT leak them.
- Two independent locks for the most sensitive data. Vault analogy: front desk never hands the
  key (config) AND the vault door is welded shut for agents (RLS). For data that "cannot be
  wrong," two locks is correct.

This keeps the system flexible where it's safe (config table) and immovable where it must be
(RLS floor on crown jewels).

### A8. END-STATE DELIVERABLE (founder-owned, at project maturity)
A comprehensive architecture document + ARCHITECTURE DIAGRAM as the mandatory onboarding gate
for any new developer: they must understand the architecture (two-tier identity, group/branch
hierarchy, capability model, defense-in-depth security floor, RLS enforcement) BEFORE touching
code. Founder verifies understanding before hands-on. The design docs being written now are the
source material for that synthesis. Produced when the access-control layer is built and proven -
not now (don't document a moving target).

## CONNECTION (30 Jun) — today's identity work is the FIRST PIECE of this design
Today (Day 44) we hit the super_admin leak (tenant super_admin saw all companies) and fixed the ROOT:
is_super_admin() RLS function now checks the is_super_admin FLAG not role='super_admin' string —
closing cross-tenant leak across all ~50 tables. THAT IS the WHO axis / Platform-Operator lockdown
from this doc's Three-Axis model — we built the first piece without realizing the full design already
existed here.

REALIZATION: the New User form bug (shows company UUID; offers super_admin to tenants; no branch
concept) is NOT a patch job — it is DOWNSTREAM of this access-control model. A correct "create user"
form requires: (1) role list constrained to creator's tier (tenant can't mint Platform Operator/above),
(2) Company→Branch→Group assignment per the WHERE axis, (3) capabilities from the configurable model.
The form can't be right until the model it assigns into is built.

DECISION: build the UNIFIED ACCESS-CONTROL LAYER per THIS doc as one coherent pass (not piecemeal —
the doc itself warns of the forward/backward rework trap). Sequence:
- WHO axis (Platform Operator vs Tenant) — RLS root-fix DONE today; tenant-tier role for owners next.
- WHAT axis — configurable role→capability (role_capabilities table exists; code must trust it).
- WHERE axis — Group→Branch→company scoping (group_id built Stage 1; wire visibility + branch assignment).
- THEN: New User form, Settings UI for capability config, visibility everywhere — all fall out correctly.
Today's piecemeal fixes (Cut 1 nav, Cut 2a UsersTab, RLS function) are correct pieces; remaining work
is to build the rest IN ORDER per this spec, not patch leak-by-leak.

## ARCHITECT SEQUENCE — LOCKED (1 Jul, Day 45)
Architect owns the order (founder's explicit instruction: "the Technical Architect decides the
sequence... I will not decide this"). Execution order, each step a prerequisite for the next:

STAGE B (START — today) — Permission/Isolation TEST HARNESS. Repeatable script asserting, per
  role × scope, EXACTLY which rows are visible. Every later stage verified by it. Built FIRST because
  a wrong policy = silent leak (proven un-eyeball-able Day 44). No enforcement work before this exists.
STAGE C — RLS enforcement, capability-driven, SAFE HARD-CODED DEFAULTS first. Replaces remaining
  hard-coded role checks. Each change instantly verified by Stage B harness.
STAGE D — Platform-Operator lockdown + tenant-tier role for owners. Completes the WHO axis
  (is_super_admin() root-fix Day 44 was piece one). The New User form is fixed HERE (assigns into a
  real tenant-tier model) — NOT before; it is downstream.
STAGE E — Group-GM + broker-visibility (WHERE axis: group/branch scoping) as policy options on the
  proven base.
STAGE F — Config UI in Settings (tenant adjusts policy). NOT before enforcement is proven (doc rule:
  policy UI is dangerous until the layer underneath holds).
STAGE G — Full role×scope×policy security test pass → sign-off → go-live.

Slot-ins: New User form → Stage D/E. Solo-vs-brokerage worlds → company-type default profiles (C/D).
Stage 7 commission visibility (already built) → folded into capability model (C).
NO deviation from this order without an architect decision recorded here.

## STAGE B FINDINGS (1 Jul, Day 45 AM) — harness surfaced two real DB-level leaks
Harness engine PROVEN: impersonate via `begin; select set_config('request.jwt.claims','{"sub":"<uuid>","role":"authenticated"}',true); set local role authenticated; <queries>; rollback;`
This drops the SQL-editor superuser bypass and enforces RLS as the target user. Verified working.

LEAK 1 — profiles RLS was DISABLED (FIXED + migrated e65ca6a):
  profiles was the ONE table with relrowsecurity=false; correct policy existed but dormant → every
  user saw all 15 profiles cross-company. Enabled RLS (helpers are SECURITY DEFINER, safe). Harness
  verified: SoleBrokerUser 15→1, platform owner still 15, login intact. All other ~55 tables already
  had RLS on.

LEAK 2 — master agreements crown-jewel leak (DIAGNOSED, fix is next Stage-C task, NOT yet done):
  A5 hard rule = master agreements admin/manager ONLY, agents NEVER. Currently BROKEN at 3 levels:
  (a) CONFIG: role_capabilities has view_master_agreements=true for sales_agent, leasing_agent, viewer
      — for BOTH tenants (Al Mansoori c23a2320, EPR e536de3f). Agents are granted the capability.
  (b) LOOSE POLICY: pp_master_agreements has TWO select policies OR'd — "Tenants see own agreements"
      (company-match only, NO capability gate) bypasses the correct capability-gated one
      "pp_master_agreements_select" (is_super_admin() OR (company + has_capability('view_master_agreements'))).
  (c) NO STRUCTURAL FLOOR: nothing structurally refuses agents regardless of config (A7 lock b missing).
  Harness proof: Rajesh (sales_agent) sees all 4 master agreements. Should see 0.
  Note: capability string is 'view_master_agreements' in table+policy (doc A2 says 'see_master_agreements'
  — doc wording only; live system consistent on 'view_master_agreements').

FIX PLAN (next session, Stage C, done properly with safety tag + migration + harness verify):
  1. Structural RLS floor (A7 lock b): master-agreement SELECT structurally excludes agents (role-based,
     not just config capability).
  2. Drop the loose "Tenants see own agreements" policy (the bypass).
  3. Config lock (A7 lock a): set view_master_agreements=false for sales_agent/leasing_agent/viewer (both tenants).
  4. Harness verify: agent→0, sales_manager→4, admin→4, cross-tenant→0.
  NOT started pre-meeting — crown-jewel policy surgery must not be rushed before a hard stop.

## STAGE B/C SWEEP (1 Jul, Day 45 late AM) — second crown jewel verified + latent findings
COMMISSION INVOICES (pp_commission_invoices) — VERIFIED SAFE (no fix needed):
  Single capability-gated SELECT policy (company + has_capability('see_brokerage_commission')),
  NO loose duplicate. Harness: Rajesh (agent) 0, Arun (manager) 10. Built right originally.

LATENT FINDINGS (not leaks — noted for Stage C/D, not fixed now):
1. is_admin_of() PHANTOM-ROLE BUG: checks role IN ('admin','manager') but there is NO 'manager'
   role (it's sales_manager/leasing_manager). Same hard-coded-role disease. Used in profiles
   UPDATE policy → managers likely CANNOT update company profiles they should. Fix in Stage C/D
   (replace with correct role strings or a tier helper like can_view_master_agreements).
2. leasing_manager GAP on see_brokerage_commission: no role_capabilities row → COALESCE false →
   leasing_manager denied brokerage-commission visibility they arguably should have (A5 admin/mgr
   tier). Over-restriction, not a leak. Review when building company-type default profiles.
3. STRUCTURAL-FLOOR ASYMMETRY: master agreements now has a structural floor
   (can_view_master_agreements, defense-in-depth lock b); commission invoices relies on config-only
   (has_capability). Per A7 both crown jewels should have structural floors. Add a
   can_see_brokerage_commission() structural floor for pp_commission_invoices in Stage C proper.

HARNESS STATUS: proven, reused across profiles + both crown jewels. Ready to formalize into a saved
repeatable script (all test users × all sensitive tables) — the real Stage B deliverable, next.

## STAGE C PLANNING FINDING (1 Jul, Day 45) — capability table is SEEDED PIECEMEAL, drifted from A2
Investigating the is_admin_of bug, found role_capabilities is incomplete + inconsistent with the A2 spec.
ACTUALLY SEEDED (8): view_master_agreements(12 rows), manage_master_agreements(2), see_brokerage_commission(6),
  see_agent_commission_split(6), see_branch_data(6), see_all_opportunities(2), see_own_opportunities_only(2),
  see_team_opportunities(2).
PROBLEMS:
  1. NAMING DRIFT vs doc A2: 'view_master_agreements' (doc: see_master_agreements); 'see_agent_commission_split'
     (doc: see_own_commission); ad-hoc caps not in the model (see_all_opportunities, see_team_opportunities,
     see_own_opportunities_only). Design vocabulary and implementation vocabulary diverged.
  2. UNEVEN ROW COUNTS (2 vs 6 vs 12) → capabilities seeded for inconsistent role/company sets, not systematically.
  3. MISSING ENTIRELY (doc A2 specifies): see_own_data, see_group_data, see_own_commission, manage_users,
     manage_settings, manage_inventory, assign_leads, manage_commissions, is_platform_operator.
  → Nothing can gate on manage_users yet (profiles UPDATE fix must wait or use interim role-strings).

ROOT: table was populated feature-by-feature over time, not seeded from the A2 model. This is precisely the
kind of drift that causes leaks (inconsistent/incomplete/misnamed).

STAGE C FIRST TASK (revised) — NOT is_admin_of patch. It is: SEED THE CANONICAL CAPABILITY MODEL from A2:
  (a) reconcile canonical names (pick one vocabulary; migrate existing rows/policies to it),
  (b) define every capability × every role × every company with SAFE defaults (doc's "hard-coded defaults first"),
  (c) THEN migrate policies (incl. profiles UPDATE → manage_users) onto the clean model, harness-verified.
This is a full-session foundational task, NOT a tail-end patch. Deferred is_admin_of fix rides on top of it.

INTERIM STATE (safe): is_admin_of phantom-'manager' bug means managers can't UPDATE company profiles (admins can;
everyone can update own row). NOT a leak — a missing capability. Acceptable until the seed task.

## STAGE C CANONICAL CAPABILITY MODEL — LOCKED (1 Jul, Day 45, architect's call)
Current table = two half-built visibility systems (ad-hoc opportunity flags + partial scope model)
layered together. Reconciled to ONE canonical vocabulary (doc A2 scope-axis wins; ad-hoc opp flags retired).

CANONICAL SET (12):
  Data scope:   see_own_data, see_branch_data, see_group_data
  Commission:   see_own_commission, see_brokerage_commission
  Master agmts: view_master_agreements, manage_master_agreements
  Admin:        manage_users, manage_settings, manage_inventory, assign_leads, manage_commissions

MIGRATION MAP (existing -> canonical):
  see_own_opportunities_only  -> see_own_data
  see_team_opportunities      -> see_branch_data (fold in)
  see_all_opportunities       -> RETIRE (redundant; = branch/group scope)
  see_agent_commission_split  -> see_own_commission
  see_branch_data             -> keep
  see_brokerage_commission    -> keep (crown jewel)
  view_master_agreements      -> KEEP AS-IS (canonical). Doc A2 said 'see_master_agreements' but the
    LIVE policy + 12 rows + our verified crown-jewel fix use 'view_master_agreements'. Consistency of
    the live system beats matching a doc word — doc wording updated to view_master_agreements, not the DB.
  manage_master_agreements    -> keep
MISSING / TO SEED: see_group_data, see_own_commission (rename), manage_users, manage_settings,
  manage_inventory, assign_leads, manage_commissions.
NOTE: is_platform_operator is a profiles FLAG, not a role_capability row (handled in Stage D lockdown).

DEFAULT MATRIX (to seed next session, per A4 company-type):
  MULTI-AGENT (strict): agent = see_own_data + see_own_commission only. manager = +see_branch_data
    +see_brokerage_commission +view_master_agreements +assign_leads +see agent splits. admin = admin caps
    (manage_users/settings/inventory) + commercial per config. group_gm = +see_group_data. viewer = read-only.
  SOLO: the single broker/owner gets ALL (collapse — broker IS the brokerage, per A4/Stage 8).
  Crown-jewel floor (A5) still structurally enforced regardless of config (master agmts done; commission
    invoices structural floor still TODO per earlier finding).

NEXT SESSION EXECUTION (clean, now unblocked):
  1. Seed all 12 canonical caps x every role x every company with the default matrix above.
  2. Migrate the 4 retired-name rows into canonical (data migration).
  3. Update policies referencing old names (if any) to canonical.
  4. Migrate profiles UPDATE policy off is_admin_of -> (company + manage_users). Fixes the phantom-manager bug.
  5. Harness-verify every role x table after.

## STAGE D DESIGN — LOCKED (1 Jul, Day 45, architect's call)
INVARIANT: super_admin role = PLATFORM tier ONLY, and MUST have is_super_admin=true.
  super_admin  <=>  platform operator  <=>  is_super_admin=true.
Tenants get 'admin' and below — NEVER super_admin. 'admin' IS the tenant-top role: full in-company
power (manage_users/settings/inventory + commercial via Stage C seed), zero platform reach (RLS-scoped).

WHY NOT a new tenant_owner role: 'admin' already exists (5 users), already functions as tenant-top,
already has correct capabilities seeded, already RLS-scoped with no platform reach. A new role = seed
rows + role-list churn + migration for no functional gain. Doc intent ("tenant-top, full in-company,
zero platform") already satisfied by admin.

CURRENT STATE (clean): 15 users. super_admin/true = 1 (mah284, platform owner). super_admin/false = 1
(SoleBrokerUser, solo tenant — the lone anomaly). All others admin/agent/manager (false). The
is_super_admin() flag fix already neutralized the danger (tenant super_admins RLS-scoped); this is
model-cleanup, not an active-leak fix.

STAGE D TASKS:
  1. Reclassify SoleBrokerUser super_admin/false -> admin (last tenant-holding-super_admin anomaly).
     Solo company (1 user); admin = full company visibility = everything a solo needs. Reversible.
  2. (Optional hardening) DB CHECK/trigger or app guard: role='super_admin' REQUIRES is_super_admin=true
     — enforce the invariant structurally so no tenant can ever be minted super_admin.
  3. NEW USER FORM FIX (the original thread): role dropdown filters by creator tier — a tenant (admin)
     may assign admin and below, NEVER super_admin; only platform operator mints super_admin. Company
     field shows the tenant's own company by NAME (not UUID), locked. This is now unblocked.
  4. Harness-verify: reclassified user still sees own company fully, zero cross-tenant.

## END-OF-DAY VERIFIED BASELINE (1 Jul, Day 45) — Stages B+C+D all green
Full harness sweep after Stages B+C+D. ALL PASS:
  mah284 (platform): companies 7, profiles 15 (full reach).
  SoleBroker (reclassified to admin, solo): companies 1, leads 1 (isolated).
  Rajesh (sales_agent): master_agreements 0, commission_invoices 0 (crown jewels refused).
  Arun (sales_manager): master_agreements 4, commission_invoices 10 (full access).
  EPR agent (cross-tenant): companies 1, master_agreements 0, commission_invoices 0 (isolated + refused).
State: Stage B (harness) + C (canonical capabilities, both crown jewels doubly locked) + D (two-tier
identity enforced at RLS + DB CHECK + UI; New User form fixed) COMPLETE and harness-green.
Remaining: Stage E (group-GM + broker-visibility at RLS layer), F (config UI), G (final sign-off).

## STAGE E — BROKER-VISIBILITY COMPLETE (1 Jul, Day 45); group-GM cross-branch FORWARD-READY
WHERE axis now enforced capability-driven on all 3 core tables (was flat company_id = agent-sees-all leak):
  opportunities: agent 8 (own assigned) / manager 38 (branch) / cross-tenant 0. (migration 0668a47)
  leads: agent 6 (leads behind own opps — decoupled lead/opp model) / manager 25 (branch). (fa4d268)
  activities: agent 40 (via parent opp/lead; no assigned_to col) / manager 189 (branch). (18bc214)
Policy pattern (no hard-coded roles): company_id floor AND (see_branch_data OR see_group_data OR
  (see_own_data AND <ownership>)). Broker-visibility is thus CONFIGURABLE (grant see_branch_data to widen).
Config confirmed: see_branch_data enabled for admin/sales_manager/leasing_manager/group_gm across all 7
  companies; false for agent/viewer. No role accidentally over-restricted.

DEFERRED (forward-ready, NOT built — no test surface): group-GM TRUE cross-branch. The see_group_data
  clause EXISTS in all 3 policies but does not yet expand past company_id (tenant floor still wraps). True
  cross-branch needs group->companies resolution AND real multi-branch groups AND group_gm users (NONE
  exist today). Build when a multi-branch group exists to test against — untestable speculation avoided per
  harness-first discipline.

REMAINING IN ACL BUILD: Stage F (config UI in Settings), Stage G (full role×scope×policy sign-off).
Activities lead-level-behind-opp edge (activity on a lead behind my opp, lead not mine) intentionally NOT
covered — starting tighter is safe, widening is additive (doc principle). Note if it surfaces in use.

## STAGE G — SECURITY SIGN-OFF (1 Jul, Day 45) — ACL BUILD B–F COMPLETE & VERIFIED
Comprehensive role × table sign-off sweep. ALL GREEN:
  AGENT (sales_agent): opps 8 / leads 6 / activities 40 (own-scoped) ; master_agmts 0 / invoices 0 (crown
    jewels refused) ; profiles 9 (own company — colleagues visible by design, cross-company blocked) ; companies 1.
  MANAGER (sales_manager): opps 38 / leads 25 / activities 189 (branch) ; master_agmts 4 / invoices 10 (crown ok).
  CROSS-TENANT (EPR agent): opps 0 / leads 0 / master_agmts 0 / invoices 0 ; companies 1 (EPR only) — isolated.
  PLATFORM (mah284): companies 7 / profiles 15 / opps 41 (all tenants) — full reach.

VERIFIED PROPERTIES:
  - Broker-visibility (WHERE axis): agent own / manager branch — RLS-enforced, capability-driven, no role strings.
  - Crown jewels (A5): master agreements + brokerage commission doubly locked (config + structural RLS floor);
    agents refused even if config wrong.
  - Two-tier identity (WHO): super_admin=platform-only (DB CHECK constraint, unbypassable); tenant=admin+below.
  - Cross-tenant isolation: complete (is_super_admin() flag-based; profiles RLS enabled).
  - Configurable (WHAT): tenant admin toggles role_capabilities via Settings UI; crown-jewel cells locked (honest).

BUILD STATUS: Stages B (harness) + C (capabilities) + D (identity) + E (broker-visibility) + F (config UI)
COMPLETE, harness-verified, migrated, tagged. DEFERRED (forward-ready, no test surface): group-GM true
cross-branch (needs multi-branch groups + group_gm users). ACL layer is GO for the intended scope.

## PATH B DECISION — APP-LAYER DE-HARDCODING (1 Jul, Day 45, founder ruling)
GOAL (non-negotiable): no hard-coded roles at the TENANT tier. Configurable. Certification-clean,
Reelly-ready, customer can shape roles to their world ("free birds, not caged").

FOUNDER RULING on the auto-pass:
  - super_admin (PropCRM PLATFORM owner, is_super_admin=true): hard-coded auto-pass is OK. It is the
    platform key — structural, DB-CHECK-enforced, only ever PropCRM. Not a customer role. Auditors expect
    platform-owner full access.
  - admin (CUSTOMER tenant admin) + ALL tenant roles: MUST be configurable. Read powers from
    role_capabilities, NOT hard-coded. A customer may want a different 'admin'; hard-coding a customer role
    fails certification/partner review.

hasCapability change (App.jsx ~2633):
  FROM: if (["admin","super_admin"].includes(role)) return true;   // hard-codes admin too — WRONG
  TO:   if (currentUser?.is_super_admin === true) return true;      // platform owner only (the flag)
        return userCapabilities[capability] === true;               // admin + all tenant roles read config
  (Uses is_super_admin FLAG, matching the DB invariant — consistent top to bottom.)

TWO-TIER SETUP MODEL (founder):
  - PropCRM does FIRST-CUT setup per customer at onboarding (gather requirements → seed capability config).
  - Customer Admin self-serves only a PERMITTED SUBSET of capabilities; the rest are PropCRM-only.
  - NEW DIMENSION required: each capability tagged "who can edit it" — CUSTOMER-EDITABLE vs PROPCRM-ONLY.
    This governs which cells the Customer Admin sees as toggleable in Settings vs locked.

## BIBLE CORRECTION (1 Jul, Day 45) — "minimal" applies to PropCRM's RETAINED plate, NOT the setup
CORRECTION to point 1: the first-cut setup is FULL AND COMPLETE, not minimal. The customer must leave
onboarding with a full-blown working environment — all business requirements met, all workflows + controls
functioning — able to run INDEPENDENTLY once PropCRM steps away. A minimal setup would leave them dependent
(wrong). "Minimal" refers to what stays on PROPCRM'S plate after handover: a thin retained layer.

### PropCRM's MINIMAL RETAINED CONTROL (everything else → customer, complete, from day one)
Retain only what is STRUCTURAL, PLATFORM-GLOBAL, SCHEMA-LEVEL, or the SAFETY WELD:
1. Group/branch hierarchy changes — add/remove a branch, restructure group→branch (architectural; affects
   see_group_data + company scoping). Customer comes back to us.
2. Tenant lifecycle — onboard/offboard a whole company (platform super_admin job by definition).
3. PropPulse global layer — projects/developers intelligence (ours by design).
4. Crown-jewel structural RLS floors — the welded protection (commission margin / master agreements can
   never leak to agents regardless of config). We hold the weld; customer toggles config above it.
5. Capability SCHEMA — WHAT capabilities exist (defining a new capability type = code/platform change).
   Customer TOGGLES capabilities; only PropCRM DEFINES new ones.
6. (Candidate — resolves the manage_settings TBD) Designating WHO at the customer holds the config keys
   (anointing the trained IT-savvy champion). If PropCRM retains this, manage_settings = PropCRM-set at
   onboarding, and the champion manages all else. Founder to confirm.

Everything OPERATIONAL / BUSINESS-WORKFLOW → customer-owned, fully, from handover (per the Bible above).

## PATH B — RESUME POINT (next session)
DONE: Step 1 — 6 business capabilities seeded (18-cap model complete), permissions.js is canonical can(),
utils.js re-exports it. Governance Bible written. Decision locked: super_admin(platform) auto-pass OK,
admin+tenant configurable.
NEXT (the delicate cut — fresh session): rewrite can() to READ capabilities not the hard-coded array —
  action→capability map (write→edit_records, delete→delete_records, see_all→see_branch_data,
  reserve_unit→reserve_units, request_discount→request_discounts, approve_manager/all→approve_discounts,
  manage_users→manage_users). can() needs the user's loaded capabilities (userCapabilities, App.jsx:2348) —
  decide wiring (pass in vs shared ref). Change hasCapability (App.jsx:2633): admin auto-pass REMOVED, use
  is_super_admin flag only. Add 6 business caps to Settings matrix. Retire hard-coded arrays. Verify screen
  by screen (buttons appear/hide correctly per role). This is the cut that kills app-layer hard-coding.
