# Day 27 — Session Capture & Open Items (4 Jun 2026)

Consolidates everything from the Day 27 working session so nothing is lost.
Resume point for the evening session.

---

## ✅ DONE & TESTED this session

### 1. User-creation onboarding — FIXED
4-bug chain cracked (see `docs/Day_27...` commits + migration
`migrations/2026-06-04_fix_handle_new_user_trigger.sql`):
AI-field white-on-white → trigger missing email → invalid 'agent' role default
→ THE killer: trigger used bare `profiles` not `public.profiles` + no pinned
search_path. Add User now works on prod. Self-signup role also fixed ('agent'→'sales_agent').

### 2. Tenant isolation RLS sweep — DONE
Dropped leaky permissive `*_all` policies on project_units, projects,
unit_sale_pricing, unit_lease_pricing. opps/leads/pp_commission_invoices already
scoped. pp_* = shared PropPulse catalog (correct). Junk tables pb_projects(2 rows)
+ properties(0 rows) flagged for cleanup. See `docs/Day_27_RLS_Isolation_Sweep_Note.md`.
Real tenant users now company-isolated.

### 3. Property Pack (Phase 2.2) — VERIFIED WORKING (code complete)
Viewer opens, pulls correct unit data, Share button correctly deferred "Q3 2026".
Remaining work = CONTENT SEEDING (photos/brochures per project) — a content task,
not code. See `Phase_2_2_Content_Seeding_Guide.md`.

### 4. Lead Lifecycle auto-conversion (Phase 2.5) — BUILT & TESTED
Migration `migrations/2026-06-04_lead_lifecycle_autoconvert.sql`.
- Lead → customer at FIRST money: first time an opp hits Reserved / Closed Won /
  SPA Signed (founder principle "money changes hands = customer"; matches UAE
  CRM standard where Reservation is the pivotal first-commitment stage).
- portfolio_size / total_purchases_aed RECOMPUTED from source (count/sum of the
  lead's conversion-stage opps) — idempotent, immune to double-fire.
  (An earlier increment-based version double-counted; caught in testing, fixed.)
- became_customer_at stamped once. 2+ deals → portfolio_customer.
- Tested working via safe BEGIN/ROLLBACK: 1 opp→Reserved gave customer,
  portfolio_size 1, correct total.
- Added columns: portfolio_size, total_purchases_aed, marketing_opt_in,
  last_marketing_contact.

**Lead Lifecycle REMAINING (future slices, not done):**
- Buyer-intent dropdown on lead creation form (required field)
- Customers screen (new menu item, lifecycle_stage in customer/portfolio)
- Bulk actions / per-segment email-WhatsApp (depends on Comms 2.3)
- Manager dashboard per-segment metrics
(Badges + segment filter already exist in App.jsx ~11503-12462.)

---

## 🆕 NEW Phase 2 item — Multi-Language / i18n

**Founder context:** targeting Middle East first, then UK, maybe Malaysia.
Asked (exploratory, for customer conversations) whether multi-language is doable.

**Answer:** Yes — it's a PRESENTATION layer (UI string translation), does NOT change
logic, data, or workflows. Architecturally clean.
- **First language (Arabic) = foundational effort:** build i18n infra (react-i18next),
  extract all hardcoded strings into translation files, AND **RTL layout support**
  (mirror UI right-to-left) — the bigger lift.
- **Subsequent languages = incremental:** infra exists; mostly translation work.
  Latin-script (UK English, Malay) need no RTL → faster.
- **Estimate:** founder's ~2-4 weeks/language is reasonable; first one costs more
  (infra + RTL), later ones cheaper.
- **Sequencing insight:** doing Arabic/RTL FIRST (ME focus) builds RTL-capable infra
  from the start, making UK/Malaysia straightforward after.
- Customer line: "Multi-language is roadmapped; it's a presentation layer so core
  logic is untouched. Arabic-first (with RTL) is foundational; more languages are
  incremental."

---

## ⏳ DEFERRED — the Identity / Segregation cluster (design TOGETHER, not piecemeal)

**Founder decision:** Super-Admin data lockdown is the LAST step (else founder can't
test/operate during build). These items are ONE coherent family — "who is a tenant,
what are the boundaries, who sees what" — and must be DESIGNED TOGETHER as a single
identity/structure refactor, not patched individually. This is Phase 2.13 expanded.

**The cluster:**

1. **Super-Admin company SWITCHER (currently cosmetic).**
   Selecting a company changes the header label but data still shows the viewing
   account's own company (queries use currentUser.company_id and/or super_admin
   bypasses RLS). Founder confirmed this SHOULD work (pick company X → see only X's
   data app-wide). Plumbing exists (activeCompanyId state, localStorage, dropdown
   ~App.jsx 16750/16989) but queries/RLS don't honor it. Fixing it properly = same
   work as the identity refactor → belongs in this cluster, NOT a standalone patch.

2. **Super-Admin total lockdown.** Platform operator (Abid) should have ZERO standing
   access to tenant CRM data — onboarding + platform config ONLY. Currently every
   policy has `is_super_admin() OR ...` bypass (the temporary shortcut).

3. **Support access model (open design problem).** If operator has no data access,
   how is tenant support handled? Direction = BREAK-GLASS: tenant admin grants a
   time-boxed, fully-audited, tenant-visible support session on demand. Default = zero.
   Needs real design.

4. **Branch / Group hierarchy (NEW — founder raised).** A brokerage umbrella (e.g. Al
   Mansoori Group) may have multiple BRANCHES on separate Trade Licenses (Dubai, Abu
   Dhabi, ...), each with own managers/brokers/agents who see ONLY their branch's data,
   all under one umbrella. DATA-MODEL FORK to decide: company = branch + group_id link,
   OR company = umbrella + branch_id sub-level. Founder leans = branches feel like
   separate-companies-sharing-an-owner (his domain call, to confirm at design time).
   The switcher fix (item 1) is FORWARD-COMPATIBLE with this (same scoping mechanism).

5. **Layer-2 within-org ownership isolation.** Within ONE company/branch, a broker
   should see only deals they created/are assigned to; managers/admins see all.
   Currently UI-enforced only (`can(role,"see_all") ? all : filter(assigned_to===me)`).
   Move into DB (RLS) for real enforcement.

**Why together:** all five touch the same question. Designing piecemeal = the "1 step
forward 2 back" rework the founder explicitly wants to avoid. One coherent identity +
org-structure design, executed as the FINAL hardening before real multi-company
production.

---

## Cleanup backlog (low priority)
- Drop junk tables: pb_projects (2 test rows), properties (0 rows).
- Delete throwaway test data: company "Test Brokerage Z" + user "Hussain Test"
  (currently kept as isolation-test fixtures; delete when no longer needed).
- App.jsx normalisation (duplicate forms) — see `docs/App_Normalisation_Priority.md`.

---

*Captured Day 27, 4 Jun 2026. Session pausing; resume in evening.*
*Branches: main == dev2 (keep synced). All fixes live on prod.*
