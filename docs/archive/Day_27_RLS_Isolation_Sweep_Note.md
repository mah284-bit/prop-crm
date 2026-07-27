# Day 27 — Tenant Isolation (RLS) Sweep + Deferred Super-Admin Lockdown

**Date:** 4 June 2026 (Day 27)
**Trigger:** Onboarding dry-run + multi-tenant isolation test (Test Brokerage Z / Hussain Test)

---

## What was found

The isolation test surfaced that some tenant-private tables had a leftover
**permissive RLS policy** (`auth.role() = 'authenticated'` or `qual = true`)
sitting ALONGSIDE a correct company-scoped policy. Because Postgres OR's
policies together, the permissive one won → any logged-in user could read
those rows across tenants.

Root pattern: early-development `*_all` policies never removed after
multi-tenancy (company_id scoping) was introduced.

## What was FIXED tonight (live on prod DB)

Dropped the leaky permissive policy on each (correct company-scoped policy
remained and now governs):

- `project_units`  — dropped `project_units_all`
- `projects`       — dropped `projects_all`
- `unit_sale_pricing`  — dropped `unit_sale_pricing_all`
- `unit_lease_pricing` — dropped `unit_lease_pricing_all`

## Confirmed ALREADY correct (no action needed)

- `opportunities` — scoped: `is_super_admin() OR company_id = my_company_id()`
- `leads` — scoped
- `pp_commission_invoices` — scoped strictly `company_id = my_company` (the
  AED 1.74M seen under "Test Brokerage Z" was Al Mansoori's data shown because
  the viewing account's profile.company_id = Al Mansoori — i.e. the cosmetic
  switcher, NOT an RLS hole)

## Shared-by-design (correctly open to all tenants — PropPulse layer)

- `pp_commissions` (commission RATE catalog — NOT receivables), `pp_developers`,
  `pp_facilities`, `pp_launch_events`, `pp_payment_plans`, `reference_*`

## Junk / legacy (no data risk — flag for cleanup, NOT fixed)

- `pb_projects` — 2 rows of obvious test garbage ("asdf"), no company_id. Drop table later.
- `properties` — 0 rows, legacy (superseded by project_units). Drop table later.

---

## KEY DECISION — Super-Admin data lockdown = LAST step (deferred)

**Founder decision (Day 27):** Do NOT remove the `is_super_admin()` data
bypass now. Today Abid's account = super_admin = Al Mansoori tenant. Removing
the bypass now would lock the founder out of the data needed to build and
test. Therefore:

- The `is_super_admin() OR ...` bypass STAYS as the working shortcut during build.
- The lockdown is the **final hardening step** before real multi-company production.

This is **Phase 2.13 (Multi-Tenant Identity Model refactor)** — already documented.
Tonight's findings sharpen what 2.13 must deliver:

1. **Remove super_admin data bypass** — platform operator gets ZERO standing
   access to tenant CRM data (leads/opps/proposals/invoices/etc.).
2. **Operator = onboarding + platform config ONLY.**
3. **Support access (THE open design problem):** operator must be able to help
   tenants without standing data access. Resolution direction = **break-glass**:
   tenant admin grants a *time-boxed, fully-audited, tenant-visible* support
   session on demand. Default = zero access. Needs real design in 2.13.

## Two related NEW Phase 2 items (add to backlog)

- **Super-Admin company switcher** — currently COSMETIC: selecting a company
  changes the header label but data queries still return the viewing account's
  own company data (because most fetches use `currentUser.company_id` and/or
  super_admin bypasses RLS). Either make it a true scoped view or remove it
  (likely subsumed by 2.13 identity work).
- **Layer-2 ownership isolation in DB** — within ONE company, a broker should
  see only deals they created/are assigned to (colleagues' deals hidden);
  managers/admins see all. Currently enforced UI-side only
  (`can(role,"see_all") ? all : filter(assigned_to===me)`). Move into RLS.

---

*Captured Day 27, 4 Jun 2026. Security lockdown deferred to final step per founder.*
*RLS leaks on the 4 tables above ARE fixed now (real tenant users isolated).*
