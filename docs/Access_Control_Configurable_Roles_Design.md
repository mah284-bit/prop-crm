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
