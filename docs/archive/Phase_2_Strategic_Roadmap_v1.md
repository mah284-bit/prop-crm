# Phase 2 Strategic Roadmap v1
## The Complete Brokerage Operating System

**Date captured:** 29 May 2026 (Thursday evening, Day 18)
**Source:** Founder-architect comprehensive Phase 2 audit session
**Trigger:** Founder principle: *"1 step forward 2 steps back is bothering me"* — leading to full Phase 2 re-scoping before pre-demo polish
**Status:** Strategic plan, NOT yet built. Demo positioning material.
**Audience:** Founder reference + investor Q&A backing + Phase 2 build team onboarding

---

## TL;DR

After today's audit, **Phase 2 has 17 items, not 7.** The original 7 were agent-workflow focused. The 10 added today reflect the *org-side* and *enterprise-readiness* gaps that emerge once you think past a single-broker prototype.

**Restructured into 4 themes, 4 priority tiers, sequenced into a 10-week post-demo plan.**

| Theme | Items | Priority |
|---|---|---|
| **Foundation** | 4 items | Tier 0 — Must ship first |
| **Workflow** | 5 items | Tier 1 — Built atop foundation |
| **Org Operations** | 6 items | Tier 2 — The biggest tier, enables real brokerage onboarding |
| **Compliance & Polish** | 2 items | Tier 3 — Enterprise-grade finishing |

**Total estimated effort:** 10-12 focused weeks with a team of 1-2 engineers.

**For the June 15 investor demo:** Phase 1 ships as-is. Phase 2 is positioned as the funded post-demo roadmap. This document IS the roadmap.

---

## Why this audit happened today

Day 18 evening, after shipping the AI Coach and Activity Logging consolidation, founder voiced two concerns:

> *"1 step forward and 2 steps back is what bothering me... we may have to look at what is in stage 2 decisions and take a call what we can finish."*

> *"There was one more major which i was looking for... Leads Management, when the leads come from various sources the admin will have a job of assigning them or round robin assignment, before that verifying the leads itself."*

The first concern surfaced *thrash*. The second surfaced *scope gaps*. Architect's response: stop polishing piecemeal, audit Phase 2 in full, decide the real shape.

This document is the result.

**Outcome of the audit:** No Phase 2 work starts before the June 15 demo. Phase 2 is funded post-demo work. But the full scope is now documented so the demo narrative is credible ("here's the 10-week plan") and so post-demo execution is immediate, not re-discovery.

---

## The 17 items at a glance

### Tier 0 — Foundation (must ship first, ~2-3 weeks)
1. **Real-Time State Sync** — Supabase Realtime subscriptions, no more hard-refresh
2. **Lead Ingestion & Assignment** — Admin queue, verification, configurable auto-distribution
3. **Master Data / Reference Configuration** — Per-org customizable stages, sources, roles, currencies
4. **Audit Trail / Compliance Log** — System-event logging for DLD compliance

### Tier 1 — Workflow (built on foundation, ~2-3 weeks)
5. **Activity Logging FAB** — Universal floating-button across all screens (remainder of Day 11 work)
6. **Lead Lifecycle remainder** — Marketing automation hooks atop existing buyer-intent + lifecycle stages
7. **Nav-History App-Wide** — Single navigation stack, all back buttons + browser back synced
8. **Communications Overhaul** — PDFs, branded emails, WhatsApp Business API, automated reports
9. **Proposal PDFs (Brahma Lipi)** — Two-tier model: broker PDFs + developer uploads

### Tier 2 — Org Operations (the largest tier, ~3-4 weeks)
10. **Settings Module** — One unified org/brokerage/agent self-service page
11. **User & Team Management UX** — Hierarchy creation, reassignment, permissions per module
12. **Role-Based Dashboard** — Manager team view + drill-down + portfolio AI Coach
13. **Notifications & Reminders** — Email + WhatsApp pushes, daily digest, stale-lead alerts
14. **Dashboard Customization** — User-defined reports, graphs, BI-lite layer
15. **Document Collection** — Buyer KYC docs + Property visual assets (floor plans, photos, videos)
16. **Legacy Data Import** — Excel/CSV onboarding for leads, contacts, units, deals, commission history

### Tier 3 — Compliance & Polish (~1-2 weeks)
17. **Data Export / Backup / Right-to-Delete** — Enterprise-grade data portability

---

## How to read this document

For each item below: **Problem → Scope → Effort → Dependencies → Demo positioning.**

Items already captured in their own Phase 2 docs are referenced (not re-written here). New items get full inline detail.

---

# THEME 1: FOUNDATION (Tier 0)

These four items are foundational because everything else depends on them. Ship in 2-3 focused weeks.

---

## Item 1 — Real-Time State Sync ✅ COMPLETE (Day 19)

**Status:** SHIPPED to production 30 May 2026 (Day 19 afternoon)
**Original estimate:** 2-3 days
**Actual:** ~3 hours (Day 12 work had already built the foundation)
**Priority:** Tier 0 — Foundational
**Doc reference:** `Phase_2_State_Management_RealTime_Sync.md`

### Problem (recap)
PropCRM caches state in browser memory. Changes don't always propagate. Hard refresh required between major actions. Acceptable for demo, blocker for client deployment.

### Scope (delivered)
- ✅ Supabase Realtime subscriptions on Priority 1 tables (proposals, activities, opportunities, leads)
- ✅ Per-opportunity proposals subscription scoped by `opportunity_id`
- ✅ Full INSERT / UPDATE / DELETE handling on activities, opportunities, leads
- ✅ Dedupe pattern locked on all INSERT handlers (handles optimistic-update race against realtime)
- ✅ Local save handler dedupe (`setProposals` race against realtime arrival)
- ✅ Cross-tab sync proven on production prop-crm-two.vercel.app

### How it shipped
Day 12 work (24 May 2026) had built `useRealtimeSubscription.js` hook + enabled Supabase Realtime publication on Priority 1 tables. Day 19 work was:
1. Upgrade activities subscription from INSERT-only to full I/U/D (commit 776c0d6)
2. Add per-opp proposals subscription in OpportunityDetail (commit 3fbe96b)
3. Hotfix: dedupe all realtime INSERTs against optimistic state (commit 98775f6)
4. Hotfix: dedupe local save handler against realtime race (commit 05fbb51)
5. Two merges to main, deployed live

### The pattern (reusable)
```javascript
// On every INSERT handler that may race with an optimistic update:
setX(prev => prev.some(r => r.id === p.new.id) ? prev : [p.new, ...prev])
// On local save handler that may race with realtime:
setX(prev => prev.some(r => r.id === newRow.id) 
  ? prev.map(r => r.id === newRow.id ? newRow : r)
  : [newRow, ...prev])
```

### Live verification (Day 19 evening)
Founder opened two tabs of prop-crm-two.vercel.app. Saved a proposal in Tab A. Tab B updated within ~2 seconds, no refresh. No duplicates in either tab. Phase 2.0 acid test passed.

### Demo positioning (now true, not roadmap)
*"PropCRM is built for real-time collaboration. Save a proposal in one tab, watch it appear in another tab in seconds, no refresh. Built on Supabase Realtime. Working today."*

### Cross-reference
- Implementation log: `Phase_2_State_Management_RealTime_Sync.md`
- Discipline doc: `Pre_Demo_Phase_2_Sprint.md` (status checklist Phase 2.0 all ✅)

---

## Item 2 — Lead Ingestion, Assignment & Governance 🟡 IN PROGRESS (Day 19)

**Status:** Schema deployed Day 19 PM. Remaining build Day 20-24.
**Original estimate:** 5-7 days (Layer 1 + Layer 2 + Layer 3, plus admin UI)
**Revised estimate (Day 19 PM):** 5-7 days for Layer 1 + GOVERNANCE only; Layers 2 and 3 deferred to post-demo
**Priority:** Tier 0 — Foundational (alongside Real-Time Sync)
**Doc reference:** `Phase_2_1_Lead_Ingestion_Design.md` (374 lines, full design + open questions resolved + day-by-day plan)

### Problem
PropCRM today assumes leads arrive pre-assigned. In any brokerage with hierarchy, this fiction breaks immediately. Leads from multiple sources (website forms, Bayut/PropertyFinder, WhatsApp campaigns, walk-ins, referrals) flood in unassigned. Admins need to verify which leads are real before burning agent time. Distribution must be fair (round-robin) AND auditable (no "manager favorites" complaint). And there has to be a way to take leads back from brokers who aren't working them — without political infighting.

Without this, PropCRM is a single-broker tool dressed up as multi-tenant.

### Pre-demo scope (revised Day 19 PM after founder no-come-backs principle)

**The two-origin model**

Every lead has one of two origins. The model handles them differently:

1. **broker_created** — Broker meets walk-in, gets referral, captures WhatsApp inquiry. Lead is owned by that broker from creation. NO pool routing. Stays with broker until formally released or transferred. (How ~all existing PropCRM leads were created.)

2. **pool_sourced** — Lead arrives from a configured pool source (website form, paid portal, marketing campaign). Lands in the Lead Queue without an assigned broker. Lead Admin assigns via round-robin within a pool (or manually overrides).

The trigger between modes is `lead.source` matching `companies.pool_sources` array. Sources configured as pool-sourced go to the queue. All others (including manually-created walk-in/referral leads) follow the broker-created path.

**Round-robin assignment service**
- Per-company `agent_pools` (groupings of agents who share lead distribution)
- Agents can be in multiple pools (e.g., one for Downtown apartments, one for Off-Plan villas)
- Round-robin orders by `last_assigned_at` ASC (NULLs first → new agents get their first lead quickly)
- Atomic transaction: update `leads.assigned_to` + update `agent_pool_members.last_assigned_at` + insert audit log row
- Idempotency: if lead already `assignment_status='assigned'`, fail clearly (use Force Reassign for legitimate reassigns)

**Governance — release, transfer, stale-detection**

This is the part that expanded Phase 2.1 beyond pure round-robin:

- **Broker formal release:** broker who wants to drop a lead must choose: release-to-queue (back to Lead Admin) OR transfer-to-specific-broker. Both require a free-text reason. No silent abandonment.
- **Admin force-reassign:** Lead Admin can reassign ANY lead at any time with a reason. Logged.
- **Stale-detection:** lead with no broker activity for `companies.stale_lead_threshold_days` (default 7) flags. Org chooses behavior: `'flag_for_admin'` (visibility only) or `'auto_return_to_queue'` (auto-unassign). Pre-demo: client-side check when Lead Admin opens Queue. Post-demo: server cron if any pilot enables auto-return.
- **Audit log:** every assignment, release, transfer, force-reassign, stale-flag writes a row to `lead_assignment_log`. Append-only. Lead Detail shows the timeline.

### Two-layer assignment model (founder insight, Day 19 PM)

Founder noted: brokers in the same org may legitimately work different opps for the same lead — sectors, developer relationships, language. PropCRM already supports this via TWO independent `assigned_to` columns:

- `leads.assigned_to` — **lead-level owner.** Phase 2.1 governs this. This is what the Lead Queue assigns, what release/transfer operates on, what stale-detection watches.
- `opportunities.assigned_to` — **per-deal owner.** Untouched by Phase 2.1. A lead with multiple opps may have different brokers per opp.

Example flow: Broker A is the lead-level owner. Broker B works an Aldar villa deal for that same lead. Both are legitimate. If A releases the lead, A's lead-level ownership returns to queue. B's opp stays with B (`opportunities.assigned_to=B` unchanged).

Stale-detection considers activity across the lead AND all its opps. An active opp keeps the lead from being flagged stale.

### Schema (deployed Day 19 PM, commit e3857ae)

**New tables:**
- `agent_pools` (id, company_id, name, description, is_active, created_at, created_by)
- `agent_pool_members` (pool_id, user_id, last_assigned_at, added_at) — PK on (pool_id, user_id)
- `lead_assignment_log` (id, lead_id, company_id, action enum, from_user_id, to_user_id, pool_id, method, reason, triggered_by, created_at)

**New columns on `leads`:**
- `origin` enum (broker_created / pool_sourced)
- `assignment_status` enum (unassigned / assigned / released / stale_flagged)
- `last_assigned_at`
- `last_broker_activity_at`

**New columns on `companies`:**
- `lead_admin_user_id` — per-company designated Lead Admin (Q1 resolution: reuse sales_manager role, designate WHO)
- `pool_sources` text[] — which `lead.source` values route through queue
- `stale_lead_threshold_days` int (default 7)
- `stale_action` enum (flag_for_admin / auto_return_to_queue)

**Operational details:**
- RLS enabled on all 3 new tables (multi-tenant safety)
- All 3 new tables added to Supabase Realtime publication (cross-tab sync inherited from Phase 2.0)
- 18 existing leads backfilled to `(origin='broker_created', assignment_status='assigned')`
- Migration is idempotent (IF NOT EXISTS everywhere, safe to re-run)
- Rollback SQL at bottom of migration file, commented out, ready if needed

### UI surfaces (Day 20-24)

1. **Settings → Agent Pools** — admin creates pools, adds/removes agents
2. **Settings → Lead Routing Rules** — designate Lead Admin, configure `pool_sources`, set stale threshold + action
3. **Lead Queue** (new top-level nav) — 3 tabs: Unassigned (incl. released back) / Stale Flagged / History
4. **Lead Detail — Assignment section** — current assignee, "Release Lead" button (current assignee only), mini-timeline of last 5 log entries, expand to full history

### Pre-demo deliberate exclusions

The original Strategic Roadmap framing had Layers 1/2/3. The new framing keeps Layer 1 + governance, defers Layers 2 and 3:

- **Source-based smart routing (was Layer 2)** — auto-assign vs admin-queue per source, anomaly detection (duplicate phone, fake names). **DEFERRED post-demo.** The `pool_sources` foundation column lands now, but smart per-source rules are post-demo.
- **Match-based assignment (was Layer 3)** — territory tags, language tags, segment tags driving pool selection. **DEFERRED post-demo.** Schema design supports adding this later without re-migration.
- **Performance-weighted assignment** — top-performer-gets-more. **EXPLICITLY REJECTED.** Politically toxic. Brokerages lose agents over this. Don't ship even with opt-in.
- **Intake API endpoint** — `/api/leads/intake` for website form/portal webhook POSTs. **DEFERRED post-demo (Q3 resolution).** Admin manually enters pool-sourced leads via "Add to Queue" pre-demo. Demo investor doesn't care how the lead arrived.

### Open design questions (all resolved Day 19 PM)

- **Q1 Lead Admin role:** A — reuse `sales_manager` role + per-company `lead_admin_user_id`. No new role needed.
- **Q2 Stale-detection:** B — client-side check when Lead Admin opens Queue page. Defer pg_cron until any pilot enables auto-return-to-queue.
- **Q3 Intake API:** B — skip pre-demo. Admin manual entry only.
- **Q4 Broker-to-broker transfer consent:** A — no recipient consent. Reason + audit log + Lead Admin oversight are enough governance.

### Demo positioning (target Day 14 June)

*"PropCRM Phase 1 is the agent's operating power. Phase 2 begins with the brokerage's operating power. Pool-sourced leads route through admin queue with round-robin distribution within configurable agent pools. Broker-created leads stay with the broker who captured them. Formal release/transfer workflow with mandatory reason — no silent abandonment. Stale-detection surfaces dormant deals to admin. Every assignment auditable. Source-based smart routing and territory matching come post-pilot when brokerages signal demand."*

### Risks

- **Schema is wider than the demo path.** Some columns and the audit log enum support post-demo features. **Mitigation:** acceptable — better to land the data model right ONCE than re-migrate later. No premature optimization, but no premature simplification either.
- **Governance UI complexity.** Release dialog + Transfer dialog + Force-reassign + Stale visibility = 4 admin surfaces. **Mitigation:** they share one dialog component pattern. Architect commits to consolidated dialog before building.
- **Multi-tab race in Lead Queue.** Two admins viewing queue, both click "Assign" on same lead. **Mitigation:** idempotency check (`if assignment_status != 'unassigned' THEN fail`). Realtime updates the second admin's view immediately so the second click doesn't even fire.

### Cross-references
- Implementation doc: `Phase_2_1_Lead_Ingestion_Design.md` (full design)
- Schema migration: `migrations/2026-05-30_phase_2_1_lead_ingestion.sql` (deployed, committed)
- Discipline doc: `Pre_Demo_Phase_2_Sprint.md` (Phase 2.1 status checklist)
- Safety: git tag `pre-phase-2.1-schema` at commit 6381fe2

---

## Item 3 — Master Data / Reference Configuration

**Status:** Captured here (this doc) as new strategic item
**Effort:** 3-5 days
**Priority:** Tier 0 — Foundational
**Source:** Founder's prior comment: *"there are settings everywhere we have to actually design a better module"*

### Problem
Today, many lists are hardcoded:
- Opportunity stages (7 fixed)
- Lead sources (fixed list)
- Lead lifecycle stages (6 fixed)
- Buyer intent values (5 fixed)
- User roles (7 hardcoded)
- Currencies (AED only)
- Activity types (Call, WhatsApp, Note, Visit, etc.)
- Project types, unit types, payment plan types

Each brokerage will want different values. Changing any of these today requires a developer + redeploy. Not viable for SaaS.

### Scope
- Move all reference lists into `reference_data` tables, per company_id
- Seeded defaults for new brokerages (current hardcoded values become the seed)
- Admin UI in Settings to add/edit/reorder/disable values
- Validation: prevent deletion of values in use (offer "deactivate" instead)
- Migration path: existing hardcoded values stay as defaults; per-org overrides layer on top

### Why Tier 0
Many later features (Lead Ingestion routing rules, Settings module, Audit Trail labels, Dashboard Customization filters) depend on knowing what valid values ARE. Build the reference layer once, everything reads from it.

### Demo positioning
*"Phase 2 makes every brokerage's setup their own — their stage names, their lead sources, their commission tiers. The system becomes their system, not ours."*

---

## Item 4 — Audit Trail / Compliance Log

**Status:** Captured here (this doc) as new strategic item
**Effort:** 3-4 days
**Priority:** Tier 0 — Foundational (for compliance-grade deployments)
**Source:** Architect addition based on UAE DLD regulatory requirements.

### Problem
PropCRM today logs broker-initiated *activities* (calls, notes, visits). It does NOT log *system events*:
- Who edited a proposal and when
- Who changed a deal's price field
- Who reassigned a lead to another agent
- Who marked a deal as Closed Won
- Who deleted a customer record
- Who exported data
- Who changed a Master Agreement commission %

DLD-regulated brokerages get audited. In a dispute (broker A vs broker B over a lead, or DLD over commission accuracy), there must be a tamper-proof log of every material change. Today, we have nothing.

### Scope
- New `system_audit_log` table — append-only
- Capture on every UPDATE/DELETE to sensitive tables (opportunities, proposals, leads, master_agreements, commissions, users)
- Fields: actor_user_id, action_type, entity_type, entity_id, before_value, after_value, reason (optional), ip_address, timestamp
- Implemented as Postgres triggers (DB-side, can't be bypassed from app)
- Admin UI: searchable timeline view by entity / by user / by date range
- Export to CSV for compliance submissions

### Why Tier 0
Once the brokerage has months of data, retrofitting audit log is impossible (you'd be missing the history). **It must be built before any real client onboards.**

### Demo positioning
*"Phase 2 is compliance-grade. Every material change captured in a tamper-proof audit log. DLD-ready from day one."*

### Risks
- Storage growth: archive logs older than 2 years to cheaper storage; never delete.
- Performance: keep trigger logic minimal, write to log async-friendly format.

---

# THEME 2: WORKFLOW (Tier 1)

Five items that build on Foundation. These complete the agent + customer workflow story.

---

## Item 5 — Activity Logging FAB (universal floating button)

**Status:** Lead-side already shipped Day 11 (commit `91f46c2`). Captured in `Phase_2_Activity_Logging_Everywhere.md`.
**Remainder effort:** 1-2 days
**Priority:** Tier 1

### Problem
The canonical activity-logging modal (consolidated Day 18) exists, but is only invoked from Opp Detail and Lead Detail. Broker working in Inventory, Dashboard, Projects, or anywhere else can't quick-log an activity without navigating to the lead/opp first.

### Scope
- Universal floating action button (FAB) anchored bottom-right on every authenticated screen
- Click → modal opens with "Pick a lead or opp" search + the canonical activity form
- Mobile-friendly position
- Hidden on settings/admin screens

### Demo positioning
*"Phase 2 unlocks quick-logging from anywhere — broker on the move can capture a call or visit in seconds without navigating."*

### Cross-reference
See `Phase_2_Activity_Logging_Everywhere.md` for full design.

---

## Item 6 — Lead Lifecycle remainder (marketing automation hooks)

**Status:** Core lifecycle + buyer_intent shipped Day 15-16. Captured in `Phase_2_Lead_Lifecycle_Segmentation.md`.
**Remainder effort:** 2-3 days
**Priority:** Tier 1

### Problem
The lifecycle stages (Raw → Qualified → Active Prospect → Customer → Portfolio Customer) exist and auto-conversion on SPA-signed works. What's missing: the *marketing automation* hooks on top — triggered emails/messages when a lead moves through stages, segment-based campaigns by buyer_intent.

### Scope
- Per-lifecycle-stage automation rules (e.g., "When lead enters Qualified, send Welcome email after 1 day")
- Per-buyer-intent campaigns (Investor → quarterly market intel; Owner-Occupier → lifestyle content)
- Campaign builder UI for admins
- Send-via integration with Comms Overhaul (Item 8)

### Dependencies
- Item 8 (Communications Overhaul) — provides the actual delivery mechanism
- Item 3 (Master Data) — provides the configurable lifecycle stages

### Demo positioning
*"Phase 2 turns the lifecycle into marketing automation. Lead becomes customer → triggers onboarding sequence. Investor segment → quarterly intel. Owner-occupier → lifestyle content. The broker doesn't push send; the system nurtures."*

### Cross-reference
See `Phase_2_Lead_Lifecycle_Segmentation.md` for full design.

---

## Item 7 — Nav-History App-Wide

**Status:** Captured today (commit `61ec691`) in `Phase_2_Backlog_Master_Doc.md`
**Effort:** 1-2 days
**Priority:** Tier 1

### Problem
"Back" buttons across the app reset to module defaults rather than returning to where the user came from. Most visible today: AI Coach → click deal card → Opp Detail → "← Back" goes to Opps list, not back to Coach.

### Scope
- ONE app-wide navigation history stack (context + hook, e.g., `useNavStack`)
- Push on every drill-in, pop on every back
- All existing "Back" buttons rewired to use it (single rewire, not per-surface)
- Browser back/forward integrated via `history.pushState` + `popstate` listener
- Optional: breadcrumb display

### Why Tier 1 (not Tier 0)
It's UX polish, not infrastructure. Demo runs without it.

### Demo positioning
*"Phase 2 syncs every back navigation — app back, browser back, breadcrumbs — all on a single stack. The user never loses their place."*

### Architect's call
Do NOT patch per-surface. That would duplicate the same fix in N places — the very duplication disease the Day 18 consolidation refactor cured.

---

## Item 8 — Communications Overhaul (PDFs, emails, WhatsApp, reports)

**Status:** Captured in `Phase_2_Communications_Overhaul.md`
**Effort:** 4 weeks (the single largest item in Phase 2)
**Priority:** Tier 1

### Problem
Every customer-facing output today is BELOW PROFESSIONAL STANDARD. Proposals are text-based, emails are minimal, reports are barebones, site visit invitations lack location pins, brochures aren't attached anywhere, no PDF generation exists.

### Scope (4 sub-phases)
- **2A Foundation (1 week):** PDF generation library, branded template system, core PDFs (proposal, invoice, closure summary)
- **2B Site Visit + Bundle (1 week):** Brochure upload UI, bundle composition, multi-entry-point send, visit invite (email + WhatsApp + .ics), pick-and-drop coordination
- **2C Email & WhatsApp Templates (1 week):** Template engine, WhatsApp Business API integration, bulk send + scheduling + tracking
- **2D Reports (1 week):** Pipeline executive PDF, manager weekly auto-report, investor quarterly review, AI narrative generation

### Why Tier 1
Without this, PropCRM looks unprofessional next to any competitor's polished output. **Single biggest gap in product perception.**

### Dependencies
- Item 1 (Real-Time Sync) — delivery status tracking needs realtime
- Item 3 (Master Data) — template variables read from configurable references
- Item 6 (Lead Lifecycle) — automation triggers feed into template selection

### Demo positioning
*"Phase 2 Communications Overhaul — 4-week sprint — brings all output to executive standard. Branded PDFs, professional emails, WhatsApp Business API, automated reports. The foundation is solid; Phase 2 just builds the rendering layer on top."*

### Cross-reference
See `Phase_2_Communications_Overhaul.md` for full design.

---

## Item 9 — Proposal PDFs (Brahma Lipi two-tier model)

**Status:** Captured in `Phase_2_Proposal_Communication_Model.md`
**Effort:** 14-18 hours (fits inside Item 8's 2A sub-phase)
**Priority:** Tier 1

### Problem
Today proposals are text-based for speed. For real broker-to-buyer communication, a branded PDF is expected. The strategic insight: PropCRM's proposal lifecycle has TWO distinct actors — broker (communication-grade) and developer (legal-grade).

### Scope (Tier 1 — Broker proposal PDF)
- Branded 2-3 page PDF on every proposal save
- Page 1: broker brand header + buyer info + property snapshot
- Page 2: pricing + payment plan + discounts + DLD treatment
- Page 3: terms + signatures + broker contact
- Optional bundle: brochures, floor plans appended
- Generated on demand, audit trail logged

### Scope (Tier 2 — Developer proposal upload)
- Broker can upload the developer's final proposal PDF (Tier 2 document)
- Tier 2 supersedes Tier 1 in the buyer's record but Tier 1 history preserved
- Audit trail: who uploaded when, from whom

### Demo positioning
*"Today text-based for speed. Phase 2 Q3 adds the polished PDF layer — branded, with attachments, downloadable. The data model is ready; we add the rendering."*

### Cross-reference
See `Phase_2_Proposal_Communication_Model.md` for full design.

---

# THEME 3: ORG OPERATIONS (Tier 2)

The largest tier — six items that turn PropCRM from "agent tool" into "brokerage operating system." This is where the org-side workflow lives.

---

## Item 10 — Settings Module ⭐ NEW (Day 18)

**Status:** Captured here as new strategic item
**Effort:** 1 week
**Priority:** Tier 2 (depends on Item 3 Master Data)
**Founder quote:** *"there are settings everywhere we have to actually design a better module"*
**Founder observation Day 18:** *"we may have to look at that also and have clear thought which goes their and what not why"*

### Problem
Settings are scattered across Companies, Users, Permissions, Master Agreements, hardcoded enums, etc. A new brokerage admin has no single place to configure their org. We previously discussed a unified Settings page; it's not visible in the app today (or never built).

### Scope — what goes in Settings (clear thought)

**Section 1 — Company / Organization**
- Company profile (name, logo, brand colors, address, RERA/DLD license)
- Email signature template
- Default timezone, currency, date format
- Office locations / branches

**Section 2 — Users & Teams** (Item 11 lives here)
- User list, invite, deactivate
- Team/pool structure
- Role assignments

**Section 3 — Reference Data** (Item 3 lives here)
- Lead sources (add/edit/disable)
- Opportunity stages (rename, reorder, recolor)
- Lifecycle stages (custom labels)
- Buyer intent values
- Activity types
- Project types, unit types
- Payment plan templates

**Section 4 — Lead Routing** (Item 2 config lives here)
- Agent pools (create, manage membership)
- Source-routing rules (which source auto-assigns vs goes to queue)
- Verification rules (anomaly thresholds)

**Section 5 — Master Agreements**
- Developer contracts (existing module, surfaced here)
- Commission tiers

**Section 6 — Communications**
- Email templates (per Item 8)
- WhatsApp Business API config
- Default sender identity
- Notification preferences (per user)

**Section 7 — Compliance**
- Audit log access (Item 4)
- Data export (Item 17)
- Privacy policy + ToS links

**Section 8 — Integrations** (post-pilot)
- PropPulse data sources
- RERA/DLD paid feeds
- Email/SMS providers

### What does NOT go in Settings
- Personal workflow preferences (those belong in the user profile dropdown)
- Quick filters (those belong in each list view)
- Daily operations (Lead Queue, Commission Outstanding) — those are work surfaces, not settings

### Why this is one item, not many
A unified Settings module is the "front door" for org admins. Each section is small; the value is in the COMPOSITION — one consistent place. Building section-by-section across the app would scatter UX again.

### Demo positioning
*"Phase 2 brings every org-level configuration into one Settings module. Brokerage admin onboards once, configures their org once, the system adapts to them. No developer touch needed for stage renames, source additions, or routing changes."*

### Risks
- Scope creep — "let's add THIS to settings too." **Mitigation:** the 8 sections above are the canonical list; new requests get evaluated against "does this belong in Settings or in a work surface?"

---

## Item 11 — User & Team Management UX

**Status:** Captured here as new strategic item (Day 18 architect addition)
**Effort:** 3-5 days
**Priority:** Tier 2

### Problem
PropCRM has a Users tab, but the org-management UX is barely surfaced:
- Creating a structured org (managers → team leads → agents) is not guided
- Reassigning leads when an agent leaves the brokerage requires manual SQL or admin gymnastics
- Setting permissions per module per user is hardcoded
- No bulk operations (invite 10 agents at once, set their pool memberships, etc.)

### Scope
- Org tree view (drag-and-drop hierarchy)
- Agent off-boarding workflow: pick replacement → bulk reassign all open leads/opps → deactivate user → preserve historical data
- Per-user permissions matrix (CRUD per module)
- Bulk invite (paste emails, set role + pool, send invites)
- Activity log view per user (Item 4 surfaced here)

### Dependencies
- Item 4 (Audit Trail) — for showing user activity history
- Item 10 (Settings Module) — lives inside Settings

### Demo positioning
*"Brokerage hierarchy in PropCRM Phase 2 — drag-and-drop org tree, structured onboarding, clean offboarding. When an agent leaves, the system handles reassignment without losing a single lead."*

---

## Item 12 — Role-Based Dashboard (Manager view)

**Status:** Captured in `Phase_2_Role_Based_Dashboard_Vision.md`
**Effort:** 1-2 weeks
**Priority:** Tier 2

### Problem
Today PropCRM has a single Dashboard for everyone. Managers need different views than agents:
- Team performance overview
- Drill into individual agents
- Activity heatmaps (who's busy, who's idle)
- Stage-conversion funnel by team
- Portfolio-level AI Coach (the "all my agents' deals" Coach view)

### Scope
- Role-aware Dashboard component
- Manager-only widgets: team funnel, agent activity heatmap, portfolio Coach summary
- Drill from team view → individual agent → individual deal
- Existing Activity Log component preserved but folded into Dashboard

### Dependencies
- Item 10 (Settings) — role definitions live there
- Item 11 (User Management) — hierarchy data feeds the dashboard

### Demo positioning
*"Phase 2 turns the Dashboard from generic to role-aware. Manager opens to team view; agent opens to personal pipeline. Same data, different lens."*

### Cross-reference
See `Phase_2_Role_Based_Dashboard_Vision.md` for full design.

---

## Item 13 — Notifications & Reminders ⭐ NEW (Day 18)

**Status:** Captured here as new strategic item (Day 18 architect addition)
**Effort:** 1 week
**Priority:** Tier 2

### Problem
PropCRM has in-app reminders. It has NO push mechanism:
- No email notifications when a lead is assigned
- No WhatsApp pings for stale opportunities
- No daily digest email summarizing pending work
- No "you have 5 stale leads" alerts
- The system relies on the broker LOGGING IN to discover work

In any real workflow, the system must PUSH attention, not wait.

### Scope
- Notification channels: in-app (existing), email (new), WhatsApp (new — via Item 8's WhatsApp Business API)
- Per-user notification preferences (Settings → Section 6)
- Triggered events:
  - Lead assigned to me
  - Reminder due (call, visit, follow-up)
  - Proposal sent / replied
  - Opportunity stage moved
  - Stale lead alert (no activity 7+ days)
  - Daily digest (7am summary email)
- Quiet hours / Do Not Disturb config
- Delivery audit log (which notification, when, delivered Y/N)

### Dependencies
- Item 8 (Communications Overhaul) — provides the email + WhatsApp delivery infrastructure
- Item 10 (Settings) — user preferences live there

### Demo positioning
*"Phase 2 wakes the broker up — proactive email + WhatsApp pings, daily digest, stale-lead alerts. The system pushes attention to where it matters."*

---

## Item 14 — Dashboard Customization ⭐ NEW (Day 18)

**Status:** Captured here as new strategic item
**Effort:** 1-2 weeks
**Priority:** Tier 2
**Founder quote Day 18:** *"on the Dashboard capabilities of creating your own reports, graphs, is another point"*

### Problem
Today's Dashboard has fixed widgets. Brokerage A wants to see "commission realization by developer" prominently; Brokerage B wants "lead source effectiveness" front-and-center. No customization possible — broker stares at someone else's mental model.

### Scope — BI-lite layer

**MVP**
- Widget library (chart types: bar, line, pie, KPI card, table, funnel)
- Drag-and-drop dashboard editor
- Per-user dashboard layouts (saved per company_id + user_id)
- Data source: any PropCRM table the user has access to (RLS-respected)
- Filter builder: date range, agent, source, stage, etc.
- Save / clone / share dashboards

**Polish**
- Public dashboards (sharable URL with read-only access)
- Scheduled email exports (e.g., "send this dashboard PDF every Monday")
- Aggregation functions (sum, avg, count, distinct, percentile)

### Why Tier 2 (not Tier 1)
It's a power-user feature. Default Dashboard suffices for MVP. Customization is the upgrade.

### Dependencies
- Item 4 (Audit Trail) — for tracking dashboard-export events
- Item 1 (Real-Time Sync) — widgets should live-update

### Demo positioning
*"Phase 2 lets every brokerage build their own dashboard. Drag-and-drop widgets, custom reports, scheduled exports. The COO sees their KPIs; the sales manager sees theirs. Same data, infinite lenses."*

### Risks
- Going full BI (Tableau-clone) is a trap — performance, complexity, support cost all explode. **Mitigation:** scope to "BI-lite" with a fixed widget vocabulary; resist custom SQL.

---

## Item 15 — Document Collection ⭐ NEW (Day 18) — BIG ITEM

**Status:** Captured here as new strategic item
**Effort:** 1-2 weeks
**Priority:** Tier 2
**Founder quote Day 18:** *"the documents collection like identification documents Passport/IDs or any such details with valid copies attached to the buyers and related buyers for SPA, and the property details, like floor plan, building plan, community plan, directions, pictures, or videos if available"*

### Problem
PropCRM today has NO document storage. Yet two enormous use cases exist:
1. **Buyer KYC** — Every SPA closure requires verified passport/Emirates ID/proof of residency/source-of-funds proof, often for multiple related buyers (joint owners, corporate signatories). Today these live in WhatsApp / email / shared drives — fragmented, lost, non-compliant.
2. **Property visual assets** — Floor plans, building plans, community plans, directions, photos, videos — broker needs these at fingertips for buyer conversations, but they live in developer emails or random folders.

### Scope (two halves)

**Half A — Buyer KYC Documents**
- Per-lead-person (or per-customer) document upload
- Document types (configurable via Item 3): Passport, Emirates ID, Visa, Proof of Address, Source of Funds, Power of Attorney, Trade License (for corporates)
- Expiry tracking + alerts (passport expires in 30 days → alert)
- Verification workflow: uploaded → admin reviews → marked verified
- Related-buyers linkage (joint buyers, corporate signatories all linked to one deal)
- SPA closure checklist: "before marking Closed Won, verify all required KYC docs present"
- Compliance: encryption at rest, access audit log (Item 4)

**Half B — Property Visual Assets**
- Per-project + per-unit upload
- Asset types: Master plan, Building plan, Floor plan (per unit), Community amenities map, Location/directions, Photo gallery, Video walkthrough, 360° tour
- Bulk upload (drag-and-drop multiple files)
- Cropping/captioning per asset
- Available in: Inventory detail, Opp detail, Proposal attachments, Site Visit invites
- Brochure assembly: select assets → compose PDF bundle (feeds Item 8 Comms Overhaul)

### Schema (sketch)
- documents (id, company_id, owner_type, owner_id, doc_type, file_url, file_size, mime_type, uploaded_by, uploaded_at, verified_by, verified_at, expires_at)
- document_access_log (id, document_id, accessed_by, action, timestamp) — feeds Item 4 audit

### Storage choice
Supabase Storage (built-in). Bucket per company_id. RLS enforces access. Tracked in `documents` table.

### Dependencies
- Item 3 (Master Data) — document types are configurable per company
- Item 4 (Audit Trail) — every doc access logged
- Item 8 (Communications Overhaul) — property assets feed into bundle generation

### Demo positioning
*"Phase 2 gives PropCRM its document memory. Every buyer's KYC chain — passport to source of funds — captured per customer, expiry-tracked, compliance-ready. Every property's visual story — floor plans to video walkthroughs — at the broker's fingertips. SPA closure becomes a checklist, not a scavenger hunt."*

### Risks
- Storage cost — videos can balloon. **Mitigation:** per-company storage quotas, tiered pricing.
- KYC compliance varies by jurisdiction. **Mitigation:** start with UAE DLD requirements; configurable doc-type lists allow expansion.

---

## Item 16 — Legacy Data Import ⭐ NEW (Day 18)

**Status:** Captured here as new strategic item
**Effort:** 1 week
**Priority:** Tier 2
**Founder quote Day 18:** *"all the major initial data upload facilities from the legacy system/excel"*

### Problem
A new brokerage onboarding to PropCRM brings YEARS of existing data:
- Hundreds or thousands of leads in Excel/CSV
- Historical opportunities with stage history
- Past commission invoices
- Customer master records
- Project inventory

Today: zero import tooling. Every new brokerage faces a manual data-entry wall — which is a deal-killer for SaaS sales.

### Scope
- Import wizard, one entity type at a time
- Supported formats: Excel (.xlsx), CSV
- Per-entity templates (downloadable .xlsx with required + optional columns)
- Step-by-step wizard:
  1. Pick entity (Leads / Opportunities / Units / Customers / Past Invoices)
  2. Upload file
  3. Map columns (auto-suggest based on header names)
  4. Validation preview (errors shown row-by-row with fix-and-retry)
  5. Dry-run import (preview without committing)
  6. Commit + summary report
- Idempotency: re-running same file detects duplicates (by external_id or fingerprint)
- Rollback: every import gets an import_batch_id; admin can rollback an entire batch within 24 hrs

### Entities to support (priority order)
1. Leads (with persons)
2. Customers
3. Units (atop existing inventory)
4. Past opportunities (with stage history)
5. Commission invoices (closed history for revenue recognition)
6. Projects + developers (if PropPulse insufficient)

### Schema additions
- import_batches (id, company_id, entity_type, file_name, uploaded_by, uploaded_at, row_count, error_count, status, rollback_until)
- Each imported row gets an `import_batch_id` foreign key for traceability

### Dependencies
- Item 3 (Master Data) — column-mapping uses configured reference values
- Item 4 (Audit Trail) — every import logged as a system event

### Demo positioning
*"Phase 2 gets new brokerages live on PropCRM in days, not months. Bulk Excel import for leads, customers, units, deal history. The brokerage's existing data flows in; no manual re-entry."*

### Risks
- Bad data in real-world Excel files is the norm, not exception. **Mitigation:** strong validation + clear error messages + dry-run preview.

---

# THEME 4: COMPLIANCE & POLISH (Tier 3)

The enterprise-grade finishing layer. Sequenced last because the other tiers create the data + workflows these protect.

---

## Item 17 — Data Export / Backup / Right-to-Delete ⭐ NEW (Day 18)

**Status:** Captured here as new strategic item (Day 18 architect addition)
**Effort:** 1-2 weeks
**Priority:** Tier 3

### Problem
A real brokerage onboarding will ask:
- "Can I export my entire data?"
- "Can I delete a customer's record on request?" (GDPR-style requirement)
- "What's your backup story if something goes wrong?"
- "Can I move to a different CRM later?" (portability is a trust signal, not a threat)

Today: no export, no formal backup story beyond Supabase's defaults, no right-to-delete workflow.

### Scope

**Half A — Export**
- Per-company full export: all data, structured (one CSV/JSON per table) + assets (documents from Item 15)
- Filtered export: by date range, by entity type, by user
- Scheduled exports: weekly/monthly backup to admin email or external storage (S3 bucket they own)
- Format options: CSV (for spreadsheets), JSON (for migration), PDF (for compliance archive)

**Half B — Right-to-Delete (GDPR-style)**
- Per-customer deletion workflow
- Admin initiates → confirmation + reason logged → cascade plan shown ("this will affect X opps, Y activities, Z documents")
- Soft-delete first (90-day window), then hard-delete with audit trail entry
- Audit log preserved even after hard-delete (action log retained, PII stripped)

**Half C — Backup & Disaster Recovery**
- Documented backup schedule (Supabase point-in-time recovery)
- Restore drills documented (quarterly test on staging)
- Customer-facing "your data is safe" page in Settings showing backup status

### Dependencies
- Item 4 (Audit Trail) — deletion events must be logged forever
- Item 15 (Document Collection) — exports include document assets

### Demo positioning
*"Phase 2 closes the enterprise loop — full data export, GDPR-style right-to-delete, documented backup + restore. The brokerage owns their data, can leave anytime, trusts the system to protect it."*

### Risks
- Right-to-delete in a multi-tenant audit-logged system has subtle cascade implications. **Mitigation:** soft-delete with 90-day window + extensive cascade preview before commit.

---

# THE 10-WEEK SEQUENCED PLAN

This is the actual build order, post-demo, assuming 1-2 engineers focused.

## Weeks 1-3 — Tier 0 Foundation

**Week 1:**
- Day 1-3: Item 1 (Real-Time State Sync)
- Day 4-5: Begin Item 3 (Master Data) — schema + seed migration

**Week 2:**
- Day 1-3: Complete Item 3 (Master Data — admin UI + migration of hardcoded values)
- Day 4-5: Begin Item 4 (Audit Trail) — triggers + table

**Week 3:**
- Day 1-2: Complete Item 4 (Audit Trail — admin UI + export)
- Day 3-5: Item 2 (Lead Ingestion & Assignment) — Layer 1 + Layer 2

*(End of Week 3: Foundation complete. Item 2 Layer 3 deferred to post-pilot demand.)*

## Weeks 4-6 — Tier 1 Workflow

**Week 4:**
- Day 1-2: Item 5 (Activity Logging FAB)
- Day 3-5: Item 7 (Nav-History App-Wide)

**Weeks 5-6:** Item 8 (Communications Overhaul) — the big one
- Week 5: Sub-phases 2A (PDFs) + 2B (Site visit + bundle) — includes Item 9 (Proposal PDFs as part of 2A)
- Week 6: Sub-phases 2C (Email/WhatsApp templates) + 2D (Reports)

*(End of Week 6: Workflow complete except Item 6 lifecycle remainder.)*

## Weeks 7-10 — Tier 2 Org Operations

**Week 7:** Item 10 (Settings Module) — the structural shell that surfaces Items 3, 4, 11
- Day 1-3: Settings framework + sections 1, 5, 7
- Day 4-5: Section 3 (Reference Data UI), Section 4 (Lead Routing UI)

**Week 8:** Items 11 + 13 (User Management + Notifications)
- Day 1-3: Item 11 (User & Team Management UX)
- Day 4-5: Item 13 (Notifications & Reminders)

**Week 9:** Item 15 (Document Collection)
- Day 1-3: Half A (Buyer KYC documents)
- Day 4-5: Half B (Property visual assets)

**Week 10:** Items 16 + 6 + 14 (Import + Lifecycle remainder + Dashboard Customization start)
- Day 1-3: Item 16 (Legacy Data Import)
- Day 4: Item 6 (Lead Lifecycle remainder — marketing automation hooks)
- Day 5: Begin Item 14 (Dashboard Customization MVP)

*(End of Week 10: Org Operations 90% complete. Items 12 + 14 + 17 extend into Weeks 11-12.)*

## Weeks 11-12 — Finish Tier 2 + Tier 3

**Week 11:**
- Item 12 (Role-Based Dashboard) — full week
- Day 5: Continue Item 14 (Dashboard Customization)

**Week 12:**
- Day 1-3: Item 14 (Dashboard Customization — finish MVP)
- Day 4-5: Item 17 (Data Export / Right-to-Delete / Backup docs)

*(End of Week 12: All 17 items shipped at MVP-grade. Polish + scale work begins.)*

---

# THE INVESTOR DEMO POSITIONING

Use this in the demo Q&A whenever Phase 2 comes up.

## The 30-second pitch

> "Phase 1 is the agent's operating power — Intelligence, Compliance, Workflow, all converging at Commission Outstanding. Phase 2 is the brokerage's operating power. We've scoped it into 17 items across 4 tiers — Foundation, Workflow, Org Operations, Compliance. Ten focused weeks post-funding. The roadmap is concrete, sequenced, and dependencies-mapped. We've documented every item with problem, scope, effort, and demo positioning. This isn't 'we'll figure it out' — it's 'here's the operating system roadmap.'"

## Common investor questions + answers

**Q: "What's NOT built yet?"**
A: Be specific. Cite this doc. "Foundation tier — real-time sync (2-3 days), lead ingestion + assignment (5-7 days), master data configuration (3-5 days), audit trail (3-4 days). That's our Tier 0, 2-3 weeks post-funding. Then four more weeks for workflow, three for org operations, two for compliance polish. Twelve-week complete build to enterprise-grade."

**Q: "How will you scale to 100 brokerages?"**
A: "Tier 0 enables it: Master Data makes the system per-brokerage configurable; Lead Ingestion enables multi-agent orgs; Audit Trail handles compliance at scale; Real-Time Sync handles concurrent users. Without Tier 0, we're a single-broker prototype. With it, we onboard the first 10 brokerages in Q3, the next 40 in Q4."

**Q: "Why those priorities?"**
A: "Tier 0 must ship first because everything else depends on it — you can't audit trail what doesn't exist, can't assign leads with no pool model, can't customize what's hardcoded. Tier 1 is agent-facing polish that makes the demo professional. Tier 2 is org-facing — the layer that turns this from 'broker tool' into 'brokerage platform.' Tier 3 is the enterprise finishing — data portability, GDPR, backup story."

**Q: "What's the biggest single item?"**
A: "Communications Overhaul — 4 weeks. PDFs, branded emails, WhatsApp Business API, automated reports. It's the largest because every customer-facing output today is below professional standard. One coordinated sprint upgrades them all together."

**Q: "What did the founder add today that the engineer missed?"**
A: "Lead Ingestion & Assignment. The architect was thinking agent-side. The founder caught that without admin lead intake + verification + configurable distribution, PropCRM is a single-broker tool dressed up as multi-tenant. It's now Tier 0, Foundation. That's why I trust this founder."

---

# FOUNDER PRINCIPLES PRESERVED (Day 18 audit session)

The audit that produced this document distilled several founder principles worth preserving for future planning sessions.

## On structural debt
> *"4-6 hours now is better than breaking our head later when we come back to correct"*

Drove the Day 18 modal consolidation. Drove the "ONE Settings module, not scattered" call. Drove the "ONE nav history stack, not per-surface" call. Architect's gloss: when founder pushes on structural debt, listen.

## On thrash
> *"1 step forward 2 steps back is bothering me"*

Surfaced the need for this audit. The cure for thrash isn't more polish — it's *clarity of scope*. This document IS that clarity.

## On configurability
> *"Configurable I believe is the best but my architect to advise the market trend and ease of use"*

Drove the Lead Ingestion 3-layer design (Round-Robin / Source-Based / Match-Based — all configurable but pre-shaped). Drove the Master Data approach (configurable values, fixed schema). Founder trusts architect on shape; architect serves founder's configurability instinct.

## On org vs agent
> *"Leads Management, when the leads come from various sources the admin will have a job of assigning them..."*

Surfaced the missing org-side layer that 7 of the 10 new items address. Architect's blind spot was thinking agent-first; founder's instinct was always org-first.

---

# DOCUMENT MAINTENANCE

## When to update this doc
- New Phase 2 item identified → add as Item 18+, place in correct tier
- Phase 2 item completes → mark as ✅ shipped, retain spec for posterity
- Investor Q&A reveals a question not addressed → add to "Common investor questions"
- Strategic re-prioritization → renumber tiers, document why

## Related documents (live)
- `Phase_2_Backlog_Master_Doc.md` — live tracker, references this doc
- `Phase_2_State_Management_RealTime_Sync.md` — full Item 1 design
- `Phase_2_Activity_Logging_Everywhere.md` — full Item 5 design
- `Phase_2_Lead_Lifecycle_Segmentation.md` — full Item 6 design
- `Phase_2_Communications_Overhaul.md` — full Item 8 design
- `Phase_2_Proposal_Communication_Model.md` — full Item 9 design (Brahma Lipi)
- `Phase_2_Role_Based_Dashboard_Vision.md` — full Item 12 design

Items 2, 3, 4, 10, 11, 13, 14, 15, 16, 17 are captured ONLY in this strategic roadmap doc (no separate per-item docs yet — they get split out when build begins).

---

*Document created: 29 May 2026 (Thursday evening, Day 18)*
*Source: Comprehensive founder-architect Phase 2 audit*
*Status: Strategic plan, ready for investor demo positioning. Post-demo execution roadmap.*
*Next revision trigger: post-demo retrospective, OR when build of any Tier 0 item begins.*
