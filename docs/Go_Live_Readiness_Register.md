# PropCRM — Go-Live Readiness Register
Created 23 June 2026. CAPTURE doc — holds every go-live thread so nothing is lost.
NOT a build list yet. Items get a method + dry-run status as we work them down post-tester.

## HORIZON 1 — Weekend Tester Handoff (NOW)
- [ ] Minimal test-data cleanup: remove this session's test opps/proposals/activities
      (Ramu Kaka, Test Lead Phase 2.5, AGR-07-03, AGR-11-07) + their orphaned PDFs in the
      property-pack storage bucket (DB rows were deleted earlier but PDF files were NOT).
      METHOD: read-only audit query FIRST (see what would go), then dependency-ordered deletes
      + matching storage-file removal. Deferred to tonight (23 Jun PM) per founder.

## HORIZON 2 — Go-Live Readiness (post-tester; list -> method -> rehearse 2x before final)
- [ ] CLEAN-SLATE RESET routine: parameterised by company_id, removes ALL tenant transactional
      data (leads, opps, proposals, activities, reminders + storage PDFs) while PRESERVING
      structure (companies, users, master agreements, PropPulse global data). Must be idempotent,
      dependency-ordered, DRY-RUN tested on test tenant before ever trusted on a real one.
- [ ] SETTINGS / CUSTOMER-CHOICE PARAMETERS (never discussed yet): decide which config is
      per-company customer choice — branding, roles/hierarchy, commission defaults, plan tier,
      stale-lead thresholds, AI quotas, DLD/payment presets, etc. Needs its own design session.
- [ ] PROPPULSE DATA DOC: PropPulse = pure data aggregation from public sources (NO AI in it).
      Document current data baseline, how a source refresh adds net-new projects + updates
      existing ones, before/after diff. Needs LIVE observation (run a refresh, record counts).
- [ ] INTERNAL INTERACTIVE AI (app-only, NOT PropPulse): parked idea — interactive AI inside the
      CRM workflow (Coach/assistant enhancements, clickable results). Discuss + scope later.
- [ ] MULTI-TENANT IDENTITY SPLIT: Platform Operator vs Tenant User (see
      Architecture_Multi_Tenant_Identity_Model.md). Post-demo refactor, ~6-9 days.
- [ ] RLS AUDIT: confirm every table scoped by company_id; lock down is_super_admin bypasses.
- [ ] BACKUP / RESTORE + MONITORING: define before any paying client.

## HORIZON 3 — Investor / Scale (only credible AFTER Horizon 2 rehearsed)
- [ ] Costing model (per-agent SaaS pricing, infra cost per tenant)
- [ ] Server sizing + production architecture (Supabase tier, realtime connection limits, CDN)
- [ ] SLAs, support model, incident response
- [ ] Investor readiness pack (architecture proven, reset rehearsed, costs modelled)

## PRINCIPLE
Do NOT open a later horizon while an earlier one is unfinished. Capture freely; build in order.
Rehearse go-live steps 2+ times on the test tenant before the real cutover. No improvised cutover.

## NOTE (24 Jun) — orphaned PDF cleanup is SCRIPTED, not manual
Storage bucket property-pack/private/proposals/<company_id>/ holds ~36 PDFs named by timestamp only
(e.g. 1781716747109_quick-pro...). Filenames carry NO lead/opp name, so manual "delete the test ones"
is unsafe guesswork. CORRECT METHOD (folds into Horizon-2 clean-slate reset): list all storage PDFs,
cross-reference against pdf_url still referenced by surviving proposals rows, delete only UNREFERENCED
files. Orphaned PDFs are invisible to testers (not linked from any opp), so SAFE TO DEFER for weekend.
Weekend DB cleanup (4 test opps + proposals removed) was the tester-facing part — done 24 Jun.

## DECISION (24 Jun) — Payment Terms: editable presets + Custom is CORRECT scope (not a gap)
Resolved after discussion. DLD = authority-fixed (4%, only absorber varies — handled). Payment plan
(20/80, 10/90, etc.) is editable BY DESIGN and that is the RIGHT call, because: the broker is NOT
responsible for collections or managing payments — the buyer pays the DEVELOPER directly. The
developer owns payment logic. In PropCRM the payment plan is INFORMATIONAL/communicative, not a
financial engine to enforce or compute. Therefore presets + Custom free-text is sufficient and
correct for a broker tool — NOT a limitation, NOT a Phase-2 rebuild. Expectation captured so the
reasoning is never re-litigated: if PropCRM ever expands to developer-side / collections (PropOS
vision), THEN payment-plan modeling becomes real scope. Until then, current design is intentional.

## CAPABILITY (logged 24 Jun, revisit POST-WEEKEND) — Lead Intelligence & Stale-Lead handling
FOUNDER FRAMING: not a settings number — a lead-lifecycle intelligence problem. Leads arrive from
many channels (events, webinars, social, print, portals); the company must triage + assign, brokers
must work them, and AI should HELP brokers act on the right lead at the right time. There is NO single
method to solve stale leads — intent/channel/behaviour all vary. Architecture posture: SUPPORT, not
SOLVE. Surface + nudge + ease assignment; the human broker still decides. Do not over-engineer a
false silver bullet.
FOUNDATIONS ALREADY BUILT (enrich, don't rebuild): Lead Queue, Agent Pools, round-robin assignment,
stale detection, AI Coach.
SCOPE TO DESIGN POST-WEEKEND:
  - Lead SOURCE/channel field + intake tagging
  - Company-level triage + assignment rules (beyond round-robin)
  - "Leads needing attention" intelligence view
  - AI broker nudges (gone cold / high-intent / matches inventory / best next action)
ROUGH ESTIMATE (planning, not promise): mechanical layer ~3-5 days; AI-intelligence layer ~2-4 days;
~1-2 weeks total as one push. Handleable — not rocket science.
KNOWN SMALL BUG (fix in build phase, NOT now): Settings exposes a configurable stale threshold, but
App.jsx (~2551) + Dashboard.jsx (~38/86) HARD-CODE >=7 days and ignore the configured value. UI says
configurable, code ignores it. Concrete correctness gap to fix when this capability is built.

## DECISION + PRINCIPLE (24 Jun) — Settings governance: company-level, admin-locked
SPECIFIC DECISION — Stale-lead threshold:
  Set at COMPANY/ORG level by admin ONLY. Every broker operates under the company rule. NO per-broker
  override (else each broker games it to personal convenience and the company standard is lost).
  Field already exists: companies.stale_lead_threshold_days. Build-phase work: (a) make code honor it
  (App.jsx/Dashboard.jsx currently hard-code >=7), (b) gate editing to admin only.
  Per-channel/per-source thresholds = NOT here; belongs in the Lead Intelligence capability.

GOVERNANCE PRINCIPLE (applies to MANY settings, capture once):
  Settings split into two classes —
    (1) ADMIN-LOCKED / company-wide: stale threshold, commission defaults, routing rules, branding,
        roles/capabilities, plan presets. Set by admin; brokers cannot self-adjust. Protects the
        company standard from individual drift.
    (2) Personal/broker-level (small, cosmetic): only things that don't affect company governance.
  RULE: default a setting to ADMIN-LOCKED unless there's a clear reason it should be personal. An
  individual broker is still part of a company and must operate under company rules, not personal
  convenience. ("Company type" handling for solo brokers vs multi-agent orgs = open question, note
  for Settings design.)

## DECISION FINAL (24 Jun) — ALL settings are COMPANY-LEVEL. Full stop.
Resolved (supersedes prior over-analysis of broker types). Every PropCRM user belongs to a company_id
— a solo broker is simply a company-of-one (own one-person tenant; "no company" onboards as their own
company record). So there is NO separate individual-broker settings concept. ALL settings live at the
COMPANY level, editable by ADMIN or MANAGER. GROUP-LEVEL must be respected where a brokerage has
branches (multi-branch group sees/sets per group rules — see getVisibleCompanyIds + group model).
No special-casing broker types. The multi-tenant model already absorbs the complexity. Keep it simple.

## DECISION (24 Jun) — Commission model + anti-miss gate (locked design, build-phase)
RESOLUTION HIERARCHY (most-specific wins, always resolves to a value — never blank):
  Unit/Deal override (on-the-fly market incentive) → Project → Master Agreement → Developer standard
  → Company fallback.
VISIBILITY = CAPABILITY (not a fixed "Finance" role): company assigns who holds commission visibility
  (extends existing see_brokerage_commission). Broker NEVER sees or enters commission. Remove
  commission_pct from broker-facing CreateOpportunityDialog; gate all commission display by capability.
ON-THE-FLY COMMISSION: handled as the top (most-specific) tier = unit/deal override. Broker may FLAG a
  developer's higher offer informally but cannot SET it; capability-holder sets/confirms.
ANTI-MISS MECHANISM (the key gate): invoice draft at Won/Closed CANNOT finalize without explicit
  commission confirmation by a capability-holder. No silent pass-through. Adhoc adjustment allowed AT
  the gate. Unconfirmed-commission invoices surfaced loudly (Commission Outstanding + dashboard count).
AUDIT: every set/confirm/change logged (who, what, when, why) — mandatory-reason pattern as used in
  lead assignment governance.
BOUNDARY OF RESPONSIBILITY (founder insight — GIGO): software CANNOT prevent a capability-holder
  entering a wrong number. Our job is NOT to prevent GIGO — impossible. It is: (1) default to correct
  (auto-resolve), (2) force a conscious checkpoint (invoice gate), (3) leave an audit trail (traceable,
  accountable). Beyond that, accuracy is a HUMAN/finance-process responsibility, not a software one.
  STOP adding controls past the audit trail — diminishing returns + friction. This is the right ceiling.

## CLARIFICATION (24 Jun) — Commission hiding = REMOVE, never mask
Considered masking commission with ***** (cheaper UI change). REJECTED: a visual mask only hides the
rendered value — the real number still arrives in React state, the API/network response, and props,
fully visible via browser DevTools/Network tab. For confidential margin data that is FALSE security.
CORRECT METHOD (build-phase): filter commission server/query-side by capability so a broker's session
NEVER RECEIVES the value. Nothing sent = nothing to leak. Do NOT mask. Remove at the data layer.

## RESET ROUTINE — schema-verified bucket spec (designed 24 Jun; BUILD/REHEARSE post-tester)
Reset a tenant to clean slate: wipe their transactional + imported-inventory data, preserve structure,
never touch PropPulse global source. Schema-verified against live table list (60 tables, 24 Jun).

🗑️ WIPE (tenant data — scoped by company_id; dependency order: children before parents):
  Leads cluster: lead_phones, lead_person_contacts, lead_persons, lead_units, leads, lead_assignment_log
  Deal cluster:  proposals, activities, reminders, followups, communications, discount_requests,
                 stage_history, reservations, opportunities
  Assignment:    agent_pool_members, agent_pools
  Sales:         sales_payments, sales_contracts
  Lease:         lease_cheques, lease_payments, rent_payments, maintenance, renewal_config,
                 lease_contracts, leases, lease_opportunities, tenants
  Commission:    pp_commission_invoices, pp_commissions, pp_sales_closures
  PP-tenant:     pp_watchlist, pp_agent_jobs, pp_documents, pp_launch_events
  INVENTORY (tenant's imported "selling inventory" — has company_id, re-imported from PropPulse):
                 unit_sale_pricing, unit_lease_pricing
                 (NOTE: price VALUE is developer-sourced; ROW is tenant copy → wipe is safe, source
                  stays in PropPulse; fresh tenant re-imports.)

🔒 PRESERVE (structure/config — survives reset):
  companies, profiles, groups, role_capabilities, permission_sets, payment_plan_templates,
  pp_master_agreements, reference_buyer_type_rules, reference_countries

🌍 GLOBAL — NEVER TOUCH (PropPulse cross-tenant source of truth):
  projects, project_units, properties, pp_developers, pp_facilities, pp_payment_plans, pb_projects

🧹 DROP ENTIRELY (leftover manual backup/junk tables, NOT app data — clean these up separately):
  _backup_alkhaleej_dup_activities_20260606, _backup_alkhaleej_dup_proposals_20260606,
  _backup_dup_invoices_20260605, _backup_pb_projects_junk_20260605,
  _backup_shrikant_dup_reminders_20260606, _backup_sobha_dup_20260605,
  _deleted_projects_backup, _opp_assignee_backup

⚠️ OPEN ITEMS before build:
  - STORAGE: also delete tenant PDFs in property-pack/private/proposals/<company_id>/ (cross-ref
    surviving pdf_url; the orphaned-PDF method already logged).
  - VERIFY each WIPE table actually has company_id (some pp_* may be global — check before wiping).
  - FK dependency order must be exact (children first) — same lesson as the manual cleanup.
  - Must be parameterised by company_id, idempotent, DRY-RUN tested on test tenant FIRST.
  - Confirm pp_commissions / pp_sales_closures / pp_documents / pp_launch_events are tenant-scoped
    (have company_id) before including — DO NOT assume.

## RESET SPEC — FK verification (24 Jun) — corrections + landmines caught
Verified company_id presence + FK links for all uncertain tables. Two GLOBAL tables were wrongly
near the WIPE bucket — caught before any build:

WIPE directly (confirmed company_id): discount_requests, lead_assignment_log, maintenance,
  pp_commission_invoices, pp_sales_closures, pp_watchlist, reservations, stage_history, tenants
  (+ the earlier company_id-scoped leads/opps/proposals/etc.)

WIPE via PARENT JOIN (tenant data, NO company_id — delete via parent, not blanket):
  - communications  -> FK lead_id -> leads      (delete where lead_id in tenant's leads)
  - followups       -> FK lead_id -> leads      (same)
  - pp_documents    -> MIXED FKs (lead_id, opportunity_id = tenant; unit_id, project_id = global)
    *** SURGICAL: delete ONLY rows where lead_id/opportunity_id belongs to tenant. NEVER delete
    project/unit-attached rows (those are global PropPulse docs). ***

🛑 NEVER WIPE — GLOBAL (FK links ONLY to projects/developers/agreements — caught as landmines):
  - pp_commissions   -> projects + pp_developers + pp_master_agreements ONLY = GLOBAL reference data
  - pp_launch_events -> projects + pp_developers ONLY = GLOBAL PropPulse launch data
  - pp_agent_jobs    -> (PropPulse job log, no company_id) = GLOBAL
  These were tentatively near WIPE; FK check proves global. Wiping them = destroying shared data.

⚠️ VERIFY AT BUILD: renewal_config (no FK surfaced; leasing config — read before classifying).

LESSON REINFORCED: company_id absence does NOT mean "global" — could be parent-scoped (tenant) OR
truly global. ONLY the FK links disambiguate. Never classify a reset table by name or assumption.

## DECISION (24 Jun) — Roles: keep fixed 7 + configurable capabilities (NOT custom roles)
Resolved. The 7 roles (super_admin/admin/sales_manager/sales_agent/leasing_manager/leasing_agent/
viewer) cover the permission SHAPE of every brokerage: owner/admin, team manager, sellers/leasers,
viewer. Fancy titles ("Senior Consultant", "Team Lead") are LABELS, not different permission
structures — cosmetic, not structural. Capabilities per role are ALREADY company-configurable
(role_capabilities table), which is the flexibility that actually matters.
CUSTOM ROLES = deliberately NOT built. It is a structural change (threads through RLS, capability
gates, assignment, group visibility, reporting) — high cost, mostly cosmetic payoff. No real demand:
founder (who knows UAE brokerages) confirms 7 fit "for now". TRIGGER TO REVISIT: only when a real
client says the 7 roles genuinely don't fit them. Wait for the pull (same discipline as multi-unit
promote). CHEAP MIDDLE-GROUND if ever needed: per-company role DISPLAY LABEL (cosmetic rename, hours
of work, no structural change) — but only if a client asks.

## METHOD (24 Jun) — RLS Audit (Horizon-2, before any real client)
SCOPE: confirm every tenant table enforces company_id isolation server-side, not just app-layer.
STEPS: (1) list all tables with company_id (from reset spec — the WIPE/PRESERVE company_id set);
(2) for each, verify an RLS policy exists that scopes rows to the caller's company_id; (3) find every
policy using is_super_admin or role='super_admin' as an UNCONDITIONAL bypass and scope it to
"super_admin WITHIN own company" (per Multi-Tenant Identity doc); (4) verify PropPulse globals
(projects, project_units, properties, pp_developers, pp_facilities, pp_payment_plans, pp_commissions,
pp_launch_events) are intentionally readable cross-tenant BY DESIGN; (5) penetration test with 2 test
tenants — confirm tenant A cannot read tenant B via API. App-layer .eq("company_id") filters exist
today but are NOT a substitute for DB-level RLS. Effort ~1 day. Document results.

## METHOD (24 Jun) — Backup / Restore + Monitoring (Horizon-2, before any real client)
BACKUP: Supabase Pro provides automated daily backups + PITR (verify tier + retention). Confirm it's
ON and the retention window is acceptable. RESTORE: rehearse a restore to a scratch project at least
ONCE before go-live — an untested backup is not a backup. MONITORING: define what we watch — DB
connection count vs tier limit, realtime connection count (200 free / 500 pro), API error rate,
storage usage, AI/Anthropic API spend. Set alert thresholds. No paying client onboards until backup
is confirmed + a restore has been rehearsed once. Effort ~1 day.

## POINTER (24 Jun) — Multi-Tenant Identity Split (Horizon-2, post-tester)
FULL DESIGN already exists: docs/Architecture_Multi_Tenant_Identity_Model.md (Platform Operator vs
Tenant User — two-tier identity; platform staff have NO data access to tenant CRM records).
CURRENT SHORTCUT: founder Abid's account is BOTH Platform Super Admin AND a tenant user of Al Mansoori
(testing convenience). TARGET: split into a platform-only identity (company_id=NULL, is_platform_
operator=true) that cannot read any tenant CRM data. MIGRATION: 5 phases (A schema prep, B founder
identity split, C Platform Admin UI, D RLS lockdown, E impersonation tooling) ~6-9 days. Phase 2.1
work already compatible (everything scoped by company_id). GO-LIVE RELEVANCE: the RLS Audit (above)
and this split are linked — do RLS audit WITH the identity split, since both touch is_super_admin
bypass semantics. NOT pre-tester. Investor "can your staff read our data?" answer lives here.
