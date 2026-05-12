# PropPlatform — Access Control & Multi-Tenant Security Spec

**Date captured:** 12 May 2026 (Tuesday afternoon, post Issue 1 resolution)
**Status:** Spec captured. Build deferred to post-demo (post-Thursday 14 May 2026).
**Founder spec:** Abid Mirza, BFC
**Estimated build effort when undertaken:** 1-2 weeks

This spec captures the founder's full vision for access control, multi-tenant data isolation, role-based permissions, and support mode for PropPlatform. Building any part without the rest creates technical debt; this document is the blueprint for a coordinated build post-demo.

---

## The Founder's Vision (preserved verbatim from spec session)

> *"For now this is what i feel is ok is as follows.*
>
> *1. There is only 1 Super admin which is only me at the moment, who has access to all the data for testing purposes.*
> *2. This super admin user can do the furnishing and adding brokers, creating, roles and assigning access, you can call it as a configuring ACL etc. which has to be thought well before making this.*
> *3. We can have couple of them or able to add by 1 person more Super admin user, as we go forward if the number of customers increase and to maintain and furnishing bottle necks.*
> *4. We also have to work on the real roles, for Customers/brokers, which are only 3 at the moment, Sales Manager, Admin, broker/agent*
> *5. There is a lot of items we have kept it as the setup items which actually fill the forms available, Permissions(2 forms no idea at the moment, cant remember), at the moment I don't remember what is there and what more should come will do it when we are ready to take it live*
>
> *1. Once decided to go live Super admins will not have access to all the data and support has to be taken care going forward should have in idea how to handle this also*
> *2. I need a complete and proper help in all the above as we cannot have each brokers data being seen by other data security is the key"*

— Abid Mirza, 12 May 2026

---

## Section 1 — Today's State (Pre-Demo, Tuesday 12 May)

### What exists today

| Component | State |
|---|---|
| Super Admin role | ✅ Single user (Abid Mirza, BFC) has full data access |
| Broker companies (multi-tenant) | ✅ 4 broker companies in `companies` table |
| `profiles.company_id` for tenant linking | ✅ Schema exists |
| `profiles.is_super_admin` boolean | ✅ Schema exists |
| `profiles.permission_set_id` | ✅ Column exists, may not be wired |
| RLS policies on data tables | ⏳ Partial — needs full audit |
| Per-broker users (sales agents, managers) | ❌ Not yet seeded |
| Role configuration UI | ❌ Not built |
| Support mode toggle | ❌ Not built |
| Audit trail for SA access | ❌ Not built |

### Why we're NOT building this pre-demo
- Demo Thursday (14 May 2026) — investors see SA mode, that's sufficient
- Building wrong now = throwaway code
- Building right needs 1-2 weeks focused
- This system underpins customer data security — must be done correctly

---

## Section 2 — Going-Live Architecture (Target State)

### Role Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│                       SUPER ADMIN (BFC)                          │
│                                                                  │
│  Today (dev mode): Full data access to all customers             │
│  Going-live: SUPPORT MODE ONLY                                   │
│                                                                  │
│  Responsibilities:                                               │
│  - Create/configure new broker company accounts                  │
│  - Initial setup: invite broker admin                            │
│  - System administration (master agreements, developers, etc.)   │
│  - Customer support (with explicit, audited, time-limited access)│
│                                                                  │
│  Constraint going-live: SA CANNOT see customer transaction data  │
│  unless explicitly granted by the customer + audit logged        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Creates broker companies
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  BROKER COMPANY (Customer Tenant)                │
│                                                                  │
│  Example: "Liwa Real Estate"                                     │
│  Strict tenant isolation: their data is NOT visible to:          │
│    - Other broker companies                                      │
│    - Super Admin (except in support mode with consent)           │
│                                                                  │
│  Three internal roles:                                           │
│                                                                  │
│  ┌──────────────────────────────────────────────┐               │
│  │ Admin (Broker Company Admin)                  │               │
│  │ - Manages users within this broker            │               │
│  │ - Configures permissions for their team       │               │
│  │ - Has full data access within this tenant     │               │
│  │ - Receives invite from Super Admin            │               │
│  └──────────────────────────────────────────────┘               │
│                                                                  │
│  ┌──────────────────────────────────────────────┐               │
│  │ Sales Manager                                 │               │
│  │ - Manages a team of sales agents              │               │
│  │ - Sees own + team data                        │               │
│  │ - Can approve discounts, etc.                 │               │
│  └──────────────────────────────────────────────┘               │
│                                                                  │
│  ┌──────────────────────────────────────────────┐               │
│  │ Sales Agent / Broker                          │               │
│  │ - Sees own data only                          │               │
│  │ - Does the deals                              │               │
│  │ - Cannot bypass approval workflows            │               │
│  └──────────────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────────────┘
```

### Critical Security Principle

> *"We cannot have each brokers data being seen by other data security is the key"*

This is **non-negotiable.** Every table, every query, every API call must enforce tenant isolation.

---

## Section 3 — Detailed Components to Build

### 3A — RLS Audit (CRITICAL FOUNDATION)

Before any UI work, audit every table for proper Row Level Security.

**Tables that MUST enforce company_id isolation:**
- `companies`
- `profiles`
- `leads`
- `opportunities`
- `proposals`
- `activities`
- `pp_sales_closures`
- `pp_commission_invoices`
- `pp_master_agreements`
- `pp_pre_spa_gates`
- `documents` / `storage buckets`
- Any other table with customer data

**Tables that are SHARED (no company_id):**
- `pp_developers` (catalog data, read-only for all)
- `pp_developer_projects` (catalog)
- `pp_developer_units` (catalog)
- System tables (auth, system config)

**Effort:** 2-3 days to audit + tighten policies + write test cases.

### 3B — Role-Based Access Control (RBAC) Layer

#### Permission Set Schema (already partially exists via `profiles.permission_set_id`)

```sql
CREATE TABLE permission_sets (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES companies(id),  -- per-broker custom sets
  name TEXT NOT NULL,                         -- "Sales Manager Default", "Senior Agent", etc.
  description TEXT,
  permissions JSONB NOT NULL,                 -- the rules
  created_at, updated_at, created_by
);

-- permissions JSONB structure:
{
  "leads": {
    "view": "own" | "team" | "all",
    "create": true | false,
    "edit": "own" | "team" | "all",
    "delete": false  // typically restricted
  },
  "opportunities": {
    "view": "own" | "team" | "all",
    "create": true | false,
    "edit": "own" | "team" | "all",
    "advance_stage": true | false,
    "approve_discount_up_to_pct": 5.0,  // numeric authority limits
    "close_won": true | false
  },
  "master_agreements": {
    "view": "all" | "none",
    "create": false,  // typically only Admin
    "edit": false
  },
  "commission_invoices": {
    "view": "own" | "team" | "all",
    "edit": "own" | "team" | "all",
    "mark_paid": true | false
  },
  "reports": {
    "view": "own" | "team" | "all"
  }
}
```

#### Built-in default permission sets per company

When a new broker company is created, system seeds 3 default permission sets:
- **Admin** (full access within tenant)
- **Sales Manager** (team-level access, can approve discounts)
- **Sales Agent** (own-data access only)

Broker admin can customize these or create new ones.

**Effort:** 3-4 days for schema + UI + policy enforcement.

### 3C — Super Admin Support Mode

#### The model
- Default state: SA sees ONLY system administration data (companies list, master agreements, developers)
- SA does NOT see customer transaction data (leads, opps, payments) by default
- When customer requests support, SA can enter "Support Mode"
- Support mode requires:
  - Customer admin's consent (toggle in their settings OR explicit support ticket)
  - Time-limited access (default 4 hours, max 24 hours)
  - Full audit trail of every screen viewed, every action taken
  - "VIEW ONLY" enforced — SA cannot edit customer data in support mode
  - Visual banner: "🔍 SUPPORT MODE: Viewing [Company Name] · Expires 14:30 UAE time"

#### Audit schema

```sql
CREATE TABLE pp_support_sessions (
  id UUID PRIMARY KEY,
  super_admin_id UUID REFERENCES profiles(id),
  target_company_id UUID REFERENCES companies(id),
  granted_by UUID REFERENCES profiles(id),  -- the broker admin who consented
  reason TEXT NOT NULL,
  started_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  ended_at TIMESTAMP,
  status TEXT  -- 'active' | 'expired' | 'revoked' | 'completed'
);

CREATE TABLE pp_support_actions (
  id UUID PRIMARY KEY,
  session_id UUID REFERENCES pp_support_sessions(id),
  action TEXT,            -- 'viewed_screen' | 'queried_data' | 'edited' (rare)
  target_table TEXT,
  target_id UUID,
  details JSONB,
  occurred_at TIMESTAMP DEFAULT NOW()
);
```

**Effort:** 4-5 days for full support mode workflow.

### 3D — Setup Workflows (Broker Onboarding)

#### Today's process (manual, dev-mode)
1. SA opens Companies page
2. Manually inserts broker company
3. Manually creates admin user
4. Hands credentials over somehow

#### Going-live workflow
1. SA opens "New Customer" wizard
2. Enters: broker company name, business type, contact admin email
3. System creates:
   - Company record
   - Default 3 permission sets (Admin/Sales Manager/Sales Agent)
   - Sends invite email to admin (verified link, 7-day expiry)
4. Admin clicks invite link → sets password → logged in
5. Admin's first screen: "Welcome - here's how to add your team"
6. Admin invites their own sales agents
7. Each agent gets role + permission set assigned

**Effort:** 5-7 days for full onboarding wizard + email + invite flows.

### 3E — Tenant Self-Configuration

Each broker admin should be able to:
- Add/remove users within their company
- Assign role + permission set per user
- Customize permission sets for their org
- Configure master agreements with developers
- Set up team structure (sales managers + their agents)

**Effort:** 5-7 days for full self-service UI.

---

## Section 4 — Build Priority Order

If we did this post-demo, here's the order:

### Phase 1 — Foundation (~1 week)
1. **RLS audit** (3 days) — every table checked, tightened, tested
2. **Permission set schema + seeding** (2 days) — schema, default sets, link to profiles

### Phase 2 — RBAC enforcement (~1 week)
3. **Code audit** (3 days) — every Supabase query checked against permission sets
4. **UI: broker admin user management** (2 days) — add users, assign roles
5. **UI: permission editor** (2 days) — broker admin can customize their sets

### Phase 3 — Support Mode + Onboarding (~1 week)
6. **Support mode schema + workflow** (3 days) — sessions, audit, banners
7. **New customer wizard** (2 days) — full onboarding for SA
8. **Invite + email flows** (2 days) — secure invite tokens

### Phase 4 — Hardening (~3-4 days)
9. **Penetration test scenarios** (2 days) — try to break tenant isolation
10. **Documentation + training** (2 days) — admin docs, support runbook

**Total: ~4 weeks for proper, security-grade RBAC + support mode.**

---

## Section 5 — Going-Live Migration

When PropPlatform is ready to go live with paying customers:

### Step 1 — Snapshot current state
- All data backed up
- DB schema documented
- Test cases pass

### Step 2 — Migrate SA permissions
- SA goes from "see all data" to "system data only"
- Support mode workflow becomes available
- Audit logging enabled

### Step 3 — Test isolation
- Create 2-3 test broker accounts
- Verify each sees only own data
- Verify SA in support mode sees what's permitted, audit logged

### Step 4 — Go live
- First real broker onboarded
- Monitor for any data leak indicators
- Iterate based on real usage

---

## Section 6 — Investor Demo Implications (Thursday 14 May 2026)

### For the Thursday demo

**Story to tell:**
> "PropPlatform is built for multi-tenant from day one. Each broker company's data is completely isolated from others. The system has role-based access control with three default roles (Admin, Sales Manager, Sales Agent) plus customizable permission sets. As BFC, our Super Admin currently has full visibility for development and testing. When we go live, we'll switch to a support-mode model where we cannot access customer data without explicit consent and full audit trail. Data security is non-negotiable."

**What to show on screen:**
- Super Admin can see all 4 broker companies
- Master Agreements page (system-level data)
- Developer catalog (shared data)
- One broker's full deal lifecycle (Lead → Opp → SPA Signed → Closed Won)
- Commission Outstanding dashboard

**What NOT to demo Thursday:**
- Logging in as 4 different brokers (we haven't built the proper RBAC yet)
- Support mode (doesn't exist yet)
- Per-tenant permission customization

**Investor questions to prepare for:**

Q: *"How is data isolated between brokers?"*
A: *"Multi-tenant architecture with company_id on every relevant table, enforced by row-level security policies. We're building a comprehensive RBAC layer with customizable permission sets per broker, plus a support-mode model for our team to assist customers without seeing their data by default."*

Q: *"How do you handle customer support without seeing customer data?"*
A: *"Support mode requires explicit customer consent, is time-limited, and every action is audited. The customer admin grants access, our Super Admin enters support mode with a visual banner showing they're viewing [Customer Name]. All activity is logged. Access expires automatically."*

Q: *"Can a broker administer their own users?"*
A: *"Yes - each broker company's Admin role can add/remove users, assign roles, and customize permission sets. We provide three default roles (Admin, Sales Manager, Sales Agent) plus the flexibility for brokers to create custom permission sets if they need finer-grained control."*

---

## Section 7 — Connection to Other Specs

| Spec | Connection |
|---|---|
| Stage_Gate_Enforcement_Spec | Permission sets determine WHO can advance stages, who can override prices |
| Stage_8_Document_Oriented_Fees | Document upload privileges per role |
| AI Daily Briefing (future) | Audit logs feed into "Suspicious activity" alerts |
| Commission Outstanding (live) | Already enforces tenant isolation via company_id |

---

## Section 8 — Open Questions for Founder

Before starting the build (post-demo), need decisions on:

1. **Email provider for invites?** SendGrid, Resend, AWS SES?
2. **Default support session duration?** 4 hours? 24 hours?
3. **Can customers opt-out of support mode entirely?** Or is it required for SLA?
4. **What's the broker admin's password reset workflow?** Self-serve? SA-assisted?
5. **Audit log retention?** 90 days? 1 year? Forever?
6. **Multi-language?** UAE has English + Arabic — do roles/permissions need translations?
7. **Mobile access?** Same RBAC applies to future mobile apps?
8. **Customer data export?** Can brokers export their own data? Right to be forgotten?

---

## Section 9 — Risk Notes

### Risks if we skip this and ship to first paying customer
- **Data leak between brokers** = lawsuits, churn, reputation damage
- **Compliance failure** = UAE data protection laws, GDPR-like requirements
- **No customer self-service** = BFC team becomes bottleneck

### Risks if we BUILD this wrong
- **Over-engineering** = months of work, no customer revenue
- **Under-tested RLS** = false sense of security
- **Permission set sprawl** = brokers create thousands of custom sets, can't maintain

**Mitigation:** Build incrementally, test heavily, start with default sets only.

---

*Spec captured 12 May 2026 by Claude during Tuesday pre-demo session. Founder explicit deferral: "Yes - capture this as 'Access Control & Support Mode Spec', defer build to post-demo". Demo Thursday will run in Super Admin mode showing full system. Build target: 4 weeks focused post-funding work, OR 1 week stripped-down version if customer rollout demands it sooner.*
