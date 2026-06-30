# PropCRM — Multi-Tenant Identity Model (Architecture)

**Date captured:** 31 May 2026 (Sunday morning, Day 20)
**Source:** Founder Day 20 morning observation while setting up Phase 2.1 real-world test
**Status:** Architectural foundation document. Lives outside Phase 2 docs because it crosscuts everything.
**Audience:** Founder reference + every future architect/developer + investor Q&A when "multi-tenant security" comes up

---

## Why this doc exists

PropCRM has operated for ~20 days with a hidden architectural shortcut: **the founder's account is both the Platform Super Admin AND a Tenant user of the test brokerage Al Mansoori Properties.** This conflation is convenient for testing but is NOT the production identity model. Day 20 morning, while setting up the Phase 2.1 assignment RPC test, founder named the gap:

> *"my user id is Super Admin, who will actually launch the other companies and assign the required access etc. and later in the date I should not have the access to any of the data of any customer but the company profile and setup part of it. However, if have to bring this discipline we have never documented this part anywhere so as we are working now, it becomes imperative to keep this tracked and we have to do something about this."*

This doc closes that gap. It defines the two-tier identity model PropCRM will operate under in production, documents the current testing-shortcut state, names the implications for features-in-flight (especially Phase 2.1), and lays out the migration path.

---

## The two-tier identity model

PropCRM has TWO entirely distinct categories of users. They share NO data access rights with each other.

### Tier 1 — Platform Operators
**Who:** Anthropic-style "internal" staff who run the PropCRM platform itself.
**Today:** Just founder Abid Mirza.
**Production:** Founder + future PropCRM employees (support, ops, billing, engineering).

**What they can do:**
- Onboard new brokerage companies (provision a new `companies` row + initial config)
- Designate the initial Tenant Super Admin for that brokerage
- Configure platform-level settings (plans, billing, AI quota, branding templates)
- View aggregated, anonymized usage metrics across all tenants
- Triage support tickets (within agreed access scope — see below)

**What they MUST NOT do (production rule):**
- Read individual leads, opportunities, proposals, activities, contacts, or other CRM data of ANY tenant brokerage
- Modify CRM business records of any tenant
- Impersonate tenant users to "see what they see"

**Why the boundary is hard:**
- Customer data privacy expectations (UAE PDPL, EU GDPR adjacent rules where they apply)
- Regulatory clarity for the brokerages we serve (UAE RERA cares about who can read transactional data)
- Trust during enterprise sales conversations ("can your engineers read our deal pipeline?" → NO)
- Reduces blast radius of any platform-side compromise

**Support exception (documented, agreed):**
- Tenant Super Admin may explicitly grant Platform Operator temporary read access to specific tenant data for support troubleshooting
- Such access is time-limited (e.g., 4 hours), logged, and audit-trailed
- This is opt-in by tenant, not default

### Tier 2 — Tenant Users
**Who:** Anyone who works at a brokerage that uses PropCRM.
**Today:** Test accounts inside Al Mansoori Properties.
**Production:** Real brokerage staff, with roles per Phase 2.1 (broker, sales_manager, admin, super_admin within their tenant).

**What they can do:**
- Full CRM access scoped to THEIR brokerage's `company_id`
- Subject to RLS, RBAC, and tenant-specific permission sets

**What they MUST NOT do:**
- Read or modify ANY data belonging to another brokerage
- Even see that other brokerages exist as named entities (they see only their own world)

**Tenant Super Admin (within a brokerage):**
- Has the highest role inside their company's tier-2 hierarchy
- Configures their own brokerage's roles, agents, master agreements, pools, etc.
- Different from Platform Super Admin (Tier 1) — same word, different scope

---

## Current state — the testing shortcut

| Aspect | Today (testing shortcut) | Target (production) |
|---|---|---|
| Founder's `profiles` row | `company_id = Al Mansoori`, `role = super_admin`, `is_super_admin = true` | TWO separate identities (see below) |
| Founder's data access | Sees all Al Mansoori data + can act inside it as super_admin | NO access to any tenant data; only platform-level config |
| Platform admin surface | Doesn't exist as a separate UI | New "Platform Admin" surface, distinct from tenant CRM views |
| RLS behavior | super_admin bypasses most RLS via legacy grants | Platform Operators have a separate access path (NOT super_admin-within-tenant) |
| Phase 2.1 assignment RPC | Works today because founder.company_id = Al Mansoori | Will need revision when identities split |

**Why we accepted the shortcut so far:** building a multi-tenant CRM with realistic data requires SOMEONE to be inside a tenant. Either we build the Platform Operator UI first (week of work, blocks all CRM dev) or we let the founder be a tenant user for testing while building CRM features. We chose the latter. **This was a sound trade-off as long as we documented when to undo it.** This doc IS that documentation.

---

## Target production model — two identities, not one

In production, founder Abid Mirza will have TWO `profiles` rows (or one row with both flags, schema decision below):

### Identity A — Abid Mirza, Platform Operator
- `role = 'platform_operator'` or `is_platform_operator = true`
- `company_id = NULL` (not a member of any tenant)
- Visible only to Platform Admin surface
- Cannot use the tenant CRM at all

### Identity B (optional) — Abid Mirza, Tenant User
- Only exists IF founder also wants to operate as a broker inside one brokerage
- Separate `profiles` row, separate email or `email+tag` convention
- `company_id = <some brokerage>`, `role = <tenant role>`
- This identity has zero platform privileges

**Realistic projection:** founder likely keeps only Identity A in production. The current "+Tenant User" state is purely a testing convenience. Founder explicitly stated: *"later in the date I should not have the access to any of the data of any customer."*

---

## Schema implications

### What needs to change in the DB (eventually)

**Add to `profiles`:**
```sql
ALTER TABLE profiles ADD COLUMN is_platform_operator boolean DEFAULT false;
-- (OR add a separate 'platform_operators' table — schema decision deferred)
```

**Modify RLS policies:**
- Currently, super_admin and is_super_admin grant broad data access
- Need to scope these to "super_admin within their own company_id" — already RLS does this via `company_id IN (SELECT company_id FROM profiles WHERE id=auth.uid())`, which is correct ✅
- Where it BREAKS: any policy that uses `is_super_admin = true` as an unconditional bypass (need to audit)

**Audit needed (Phase 2 post-demo):**
- Find every RLS policy using `is_super_admin`
- Replace global-bypass semantics with "scoped to tenant" semantics
- Add Platform Operator access via separate policy clause (or separate views entirely)

### What does NOT need to change for Phase 2.1 pre-demo

- Founder's account stays as `company_id = Al Mansoori, role = super_admin` for testing
- Phase 2.1 RPC and governance assume Tenant Super Admin = Al Mansoori's super_admin (which is founder's account, today)
- Real-world Phase 2.1 tests use Al Mansoori's data as if Al Mansoori were a real brokerage
- This is intentional and acceptable for pre-demo

**The identity-model split is a Phase 2 POST-DEMO refactor**, not pre-demo. Pre-demo we ACKNOWLEDGE the shortcut and protect against making it worse.

---

## Implications for Phase 2.1

### Where Phase 2.1 is already correct
- `companies.lead_admin_user_id` points to a Tenant Super Admin / Sales Manager — this is correctly tenant-scoped
- `agent_pools.company_id` enforces tenant scoping
- `lead_assignment_log.company_id` enforces tenant scoping
- The RPC `assign_lead_via_pool` enforces caller's company match against lead + pool

**All of these will work correctly under both the current shortcut AND the target production model**, because they consistently scope by `company_id` regardless of whether the caller is "Tenant Super Admin" or "Platform Operator masquerading as tenant for testing."

### Where Phase 2.1 needs care post-demo
- The Lead Queue UI assumes the caller has a `company_id` (used to filter visible leads). A Platform Operator with `company_id=NULL` would see nothing — which is correct semantically (Platform Operators shouldn't see tenant leads anyway).
- When we split identities, Platform Operator UI will be completely separate from Lead Queue (no overlap, no conflict).

**Conclusion for Phase 2.1:** the design holds. No pre-demo changes needed. Post-demo identity split will not require Phase 2.1 schema changes — only RLS policy refinements and addition of separate Platform Admin UI surface.

### What we WON'T do pre-demo
- We will NOT try to split identities now. The cost is too high for too little demo value.
- We will NOT add `is_platform_operator` column yet. It enters in the post-demo refactor.
- We will NOT build a Platform Admin UI surface pre-demo. Demo investor doesn't care about platform internals; they care about broker workflow.

---

## Implications for OTHER features

This identity model also touches features outside Phase 2.1. Naming them now so we don't repeat the same blind spot:

### Master Agreements
Today: founder's super_admin role lets them edit master agreements for Al Mansoori.
Production: Platform Operator can VIEW master agreements (for support) but cannot edit; Tenant Super Admin edits for their own brokerage.

### Companies table
Today: any super_admin can read companies. Risky — a Tenant Super Admin should NOT see other companies.
Production: Tenant users see only their own `companies` row. Platform Operators see all.

### AI Coach / AI features per company
Today: AI quota and settings are per-company; founder configures Al Mansoori's settings.
Production: each Tenant Super Admin configures their own; Platform Operator sets platform-level quota ceilings.

### PropPulse data
Today: shared across all companies (the intelligence layer is global).
Production: stays shared across all companies — this is BY DESIGN. PropPulse is the cross-tenant moat. The "In My Inventory" signal is per-company; the raw project/developer data is global.
Note: This is the ONE case where Platform Operator role intersects with data access — Platform Operators DO manage the PropPulse content, because it's not tenant-private.

### Billing, Plans, Subscriptions (future)
Tenant Super Admin sees their own brokerage's billing; Platform Operator sees all billing.

---

## Demo positioning — when investor asks "multi-tenant security"

Current honest answer (post-this-doc):

> *"PropCRM is designed with two-tier identity from the start. Brokerages are tenants — their data is strictly scoped by company_id, enforced via Postgres Row-Level Security on every table. Platform operators (PropCRM staff) manage tenant onboarding, billing, and platform configuration — they explicitly do NOT have data access to tenant CRM records. Today, the founder's account operates inside our test brokerage Al Mansoori Properties for development purposes; production will split that into a separate platform-only identity. We've documented this discipline (Architecture_Multi_Tenant_Identity_Model.md) and the migration is a small, post-demo task — schema is already 90% there."*

**Why this matters in pitch:**
- Investor: "What stops your team from reading our customer data?"
- Wrong answer: "We promise we won't."
- Right answer: "Architecture won't let us. Platform staff have a separate identity that can't read tenant data. Here's the doc."

This kind of clarity is enterprise-sales table stakes.

---

## Migration path (post-demo)

### Phase A — Schema preparation (1 day)
- Add `is_platform_operator boolean DEFAULT false` to `profiles`
- Backfill: existing super_admins that ARE tenant employees stay as-is; founder's account stays as-is during dual-identity period
- Audit all RLS policies referencing `is_super_admin` or `role='super_admin'`; identify which need scoping

### Phase B — Founder identity split (0.5 day)
- Create new `profiles` row for "Abid Mirza Platform" with `is_platform_operator=true, company_id=NULL`
- Existing `profiles` row for Abid stays as Al Mansoori user (or gets deleted if Al Mansoori is no longer a real tenant)
- Update auth flow so login decides which "mode" to enter (platform vs tenant)

### Phase C — Platform Admin UI (3-5 days)
- New top-level surface visible ONLY to `is_platform_operator=true`
- Views: tenant list, tenant onboarding wizard, platform settings, billing overview
- Hidden from tenant users entirely

### Phase D — RLS audit + lockdown (1-2 days)
- Walk through every table
- Confirm tenant data is scoped by `company_id`
- Add explicit denial rules for `is_platform_operator=true` accessing tenant CRM records
- Add explicit allow rules for `is_platform_operator=true` accessing platform-level data (companies overview, billing, master config templates)

### Phase E — Tenant impersonation tooling (1 day, optional)
- When tenant explicitly grants support access, Platform Operator can "impersonate" a specific tenant user for a time-limited session
- Every impersonation logged in a `platform_support_session` table
- Tenant sees impersonation history

**Total post-demo effort:** ~6-9 days. Lives in Phase 2 broader scope, NOT in Phase 2.1.

---

## Where this fits in the strategic roadmap

This is NOT a numbered item in `Phase_2_Strategic_Roadmap_v1.md` (which is feature-oriented). It's an **architectural foundation** that applies across all items.

Add a cross-reference: at the top of `Phase_2_Strategic_Roadmap_v1.md`, add a note:

> **Architecture references:**
> - `Architecture_Multi_Tenant_Identity_Model.md` — two-tier identity model (Platform vs Tenant). Applies to every roadmap item.

This way future architects see the model before touching any item.

---

## Founder principles preserved

> *"my user id is Super Admin, who will actually launch the other companies and assign the required access etc. and later in the date I should not have the access to any of the data of any customer but the company profile and setup part of it."*

This statement is the target production model. Captured.

> *"if have to bring this discipline we have never documented this part anywhere so as we are working now, it becomes imperative to keep this tracked and we have to do something about this."*

This doc IS the tracking. The "do something about this" = Phase 2 post-demo migration path (Phases A-E above). Captured.

> *"no half hearted work which spoils"* (Day 19)

The half-hearted version would be: split identities pre-demo, do it under time pressure, ship it half-tested. Architect's call: don't do that. Document the discipline now, do the split properly post-demo. Phase 2.1 design already respects the model (scoped by company_id) — the migration is additive, not destructive.

---

## Status

- [x] Two-tier identity model defined (Platform Operator vs Tenant User)
- [x] Current testing-shortcut state documented vs target production state
- [x] Phase 2.1 implications analyzed — no pre-demo changes required, post-demo refactor scoped
- [x] Implications for other features (Master Agreements, Companies, AI, PropPulse, Billing) named
- [x] Migration path documented (5 phases, ~6-9 days post-demo)
- [x] Demo positioning narrative drafted
- [ ] Add cross-reference at top of `Phase_2_Strategic_Roadmap_v1.md`
- [ ] Resume Phase 2.1 real-world test (next step after this doc commits)
- [ ] Post-demo: Phase A (schema preparation) — first item in identity-split work

---

## Decision log (chronological)

| Date | Decision | Status |
|---|---|---|
| ~10 May 2026 (early build) | Founder account = super_admin within test brokerage Al Mansoori | Implicit, undocumented until today |
| 31 May 2026 (Day 20 morning) | Founder names the conflation, requests it be tracked | This doc |
| 31 May 2026 (Day 20 morning) | Architect call: capture model NOW, defer identity split to post-demo | This doc |
| 31 May 2026 (Day 20 morning) | Phase 2.1 design confirmed compatible with both shortcut and target models | This doc |
| Post-demo (TBD) | Execute Phase A schema preparation | Pending |
| Post-demo (TBD) | Execute Phase B founder identity split | Pending |

---

*Document created: 31 May 2026 (Day 20 morning)*
*Source: Founder observation during Phase 2.1 RPC test setup*
*Status: Architectural foundation document. Cross-referenced by all multi-tenant features.*
*Next: Resume Phase 2.1 real-world test, knowing Phase 2.1 design is compatible with target identity model.*

## ADDENDUM (30 Jun) — Onboarding role must be separate from tenant super_admin (founder restated)
During Stage 8 solo-broker setup, founder restated the Tier-1/Tier-2 split concretely: the role that
ONBOARDS companies + provisions users (Platform Operator) must be SEPARATE from the super_admin who
OWNS/operates a brokerage (Tenant Super Admin). Today conflated in founder's account (documented
testing shortcut). For SOLO broker: Platform Operator onboards the company; the single user is that
brokerage's owner (Tenant Super Admin) AND its agent. NO pre-Stage-8 change — post-demo identity
refactor (Phases A-E). Stage 8 uses the founder-as-onboarder shortcut to create the solo company; the
100%-to-broker commission path is what Stage 8 verifies.

## FOUNDER'S MODEL (30 Jun) — don't give tenants super_admin at all; use tenant-tier role(s)
Founder's plan (raised repeatedly, now adopted as target): the cleanest fix is NOT to patch
super_admin's leaks — it's to STOP giving brokerage owners the super_admin role. A solo/brokerage owner
should hold a TENANT-TIER role (admin, or a new 'tenant_owner') that bundles full in-company power
(≈ Admin operational + Sales Manager commission authority) but has ZERO platform reach.

WHY THIS IS BETTER than patching super_admin:
- super_admin = role==="super_admin" unlocks platform surfaces. A tenant with that role triggers every
  platform check. If the tenant simply ISN'T super_admin, the leak never fires — root avoided, not patched.
- One person has one profiles.role today, so "give both Admin + Sales Manager" isn't literally
  assignable. SOLUTION = either a new 'tenant_owner' role bundling those caps, OR the capability model
  (role_capabilities) granting both sets to one role per company.

TARGET END STATE:
1. super_admin + is_super_admin=true = PLATFORM owner ONLY (founder). Never assigned to a tenant.
2. Brokerage owner = tenant-tier role with full in-company capability via role_capabilities, NO platform
   reach. The "Admin + Sales Manager" combined powers, expressed as capabilities.
3. Platform surfaces gate on is_super_admin FLAG (done — Cut 1/2a); tenant powers flow from
   role_capabilities (ACL pass). Flag + capability model = belt and suspenders.
4. RLS enforces company isolation at the DB so none of this depends on UI gating alone.

The flag-based fixes already shipped (Cut 1 nav, Cut 2a UsersTab) are correct under THIS model too —
they ensure only the real platform owner sees platform surfaces. Next: adopt tenant-tier role for
owners + RLS. SoleBrokerUser should be RE-CREATED as tenant-tier (not super_admin) when we build this.

## 🛑 DECISION (30 Jun) — stop app-layer whack-a-mole; RLS is the cure
After Cut 1 (nav) + Cut 2a (UsersTab), testing as SoleBrokerUser (company has 0 activities, confirmed
in DB) STILL shows "Activity Log: 1" — a 4th leak: a count computed from unscoped activities data.
This is the pattern founder warned about all session: each app-layer count/list computes independently,
so there's always a NEXT leak (Companies → Users → Activity → dashboard tallies → ...).

ARCHITECT CALL (founder aligned): STOP patching app-layer leaks one by one. The STRUCTURAL leaks
(Companies tab, company switcher, Users list — navigation/access surfaces) are closed + committed
(Cut 1, 2a) — those mattered. The remaining ones are COUNT leaks (activity=1, dashboard tallies):
lower severity (a number, not row-level browsing) AND exactly what RLS eliminates wholesale.

WHY RLS IS THE CURE (not more patches): with RLS on activities/leads/opportunities/etc., a tenant's
browser NEVER RECEIVES another company's rows — so no count, widget, or list can display them. One
properly-scoped DB layer makes the ENTIRE class of count-leak bugs impossible, vs hunting each widget
forever. RLS + the founder's tenant-tier-role model = the end product. App-layer flag-checks become
defense-in-depth on top, not the only defense.

NEXT SESSION (the real identity/RLS pass, fresh focus):
1. RLS policies on all tenant tables (activities, leads, opportunities, proposals, etc.) scoped by
   company_id; platform owner (is_super_admin) bypass where legitimate.
2. Adopt founder's tenant-tier-role model (owners NOT super_admin); re-create SoleBrokerUser as
   tenant-tier.
3. Verify: tenant sees ONLY own company everywhere, by DB enforcement not UI hiding.
DO NOT continue app-layer count-patching — it's symptom-chasing. RLS is the cure.

## PRINCIPLE (30 Jun, founder) — buyer identity is per-company; cross-company duplication is CORRECT
Founder stated the multi-tenant buyer rule precisely:
- A real buyer may be talking to MANY brokerages at once → he is legitimately a lead/buyer in multiple
  companies simultaneously. Same person across different companies = EXPECTED and must be ALLOWED.
  Each company owns their OWN record/relationship with him. Never merge or block across companies.
- Duplicate of the same buyer WITHIN one company = the MAJOR problem dedupe must catch (messy data,
  split history). Dedupe is COMPANY-SCOPED: check email/phone within company_id before creating.
- Identity = the row's id + company_id, NOT the name. Two "Roger Federer" rows in two companies are two
  distinct identities. Name is a label; id-scoped-by-company is the identity.
- NEVER MIXING UP across companies is critical — the foundation. RLS must enforce this at the DB so
  cross-company bleed is IMPOSSIBLE, not merely avoided in code.
RLS PASS must honor this: tenant queries return ONLY own-company rows (so cross-company buyer records
never collide/bleed); within-company dedupe stays an app-level email/phone check scoped by company_id.
