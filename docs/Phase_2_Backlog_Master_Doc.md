# Phase 2 Backlog — Master Document

**Date captured:** 21 May 2026 (Day 9) — initial
**Last major update:** 1 June 2026 (Day 23, Mon) — Phase 2.2 Property Pack display (PropPulse half) shipped on dev2
**Purpose:** Single source of truth for all Phase 2 backlog + Phase 1 status
**Audience:** Founder reference + investor Q&A backing + new-chat read-on-start
**Status:** Live document — Phase 2.0 + 2.1 complete on production

---

## TL;DR — Where we are right now (31 May 2026)

```
✅ Phase 1 LIVE on prop-crm-two.vercel.app
✅ Phase 2.0 Realtime Sync — SHIPPED (Day 19)
✅ Phase 2.1 Lead Ingestion + Governance — SHIPPED (Day 19-22)
🟡 Phase 2.2 Property Pack — PropPulse display SHIPPED on dev2 (Day 23); content seeding (Day 24) + Inventory display wiring remaining
📋 Phase 2.3+ Comms / Lifecycle / FAB / Manager Dashboard — Q3 2026
```

**Production URL:** prop-crm-two.vercel.app
**Latest main commit:** 0bb5ad2 (Phase 2.1 Day 22 merge — Day 23 work NOT yet merged)
**Latest dev2 commit:** e3bbdec (Phase 2.2 PropPulse Property Pack + cleanup)
**Golden tag:** phase-2.1-complete  ·  **Sprint safety tag:** pre-phase-2.2-schema

**Demo:** 15 June 2026 (14 days out)
**Buffer:** ~3 days ahead of Pre-Demo Sprint plan

---

## SECTION 1 — Phase 1 Features (LIVE on production)

### Workflow
- Dashboard, Leads, Opportunities with stage gates
- Lead Detail activity logging (restored Day 11, commit 91f46c2)
- Opp Detail full activity logging with scheduling
- Proposals V1→V2→V3 with audit + pre-fill
- Negotiations (V_latest pre-fill from rounds only)
- 7-tab opp dashboard, SPA Signed workflow
- Master Agreements

### Intelligence
- PropPulse with AI Agent (Claude Sonnet 4.5 + web search)
- 38 verified projects + 20 developers + 119 units

### Financial
- Commission Outstanding
- Buyer outflow vs Broker revenue separation (architectural)

### Infrastructure
- Multi-tenant + per-company config + AI Coach per deal

### Hidden Features (built, behind menu)
| Feature | Commit | Why Hidden | Phase |
|---|---|---|---|
| Discounts | 588c7df | Developer persona | Q3 2026 |
| Activity Log | 0b84c73 | Replaced by role-aware Dashboard | July 2026 |
| Permissions #1 (RBAC) | 2135186 | Admin config | July 2026 |
| Group View | 2135186 | Placeholder | Q4 2026 |

---

## SECTION 2 — Phase 2 Roadmap (Items)

### 2.0 ✅ State Management & Real-Time Sync — SHIPPED Day 19
**Founder quote:** *"I cant tell the customers to keep refreshing always, which shows a flaw in the system correct"*

**What shipped:**
- Supabase Realtime subscriptions on proposals, activities, opportunities, leads
- Per-opp proposals subscription (OpportunityDetail line 5123)
- Dedupe hotfixes (optimistic update + realtime INSERT race)
- Cross-tab + multi-user sync verified on production

**Commits:** 776c0d6, 3fbe96b, 98775f6, 05fbb51 (4 commits)

---

### 2.1 ✅ Lead Ingestion + Governance — SHIPPED Day 19-22

**Founder principle:** *"No half hearted work which spoils"* — drove full governance scope (no Layer 1 only).

**What shipped:**

**Schema (Day 19 PM):**
- 3 new tables: agent_pools, agent_pool_members, lead_assignment_log
- 4 new columns on leads: origin, assignment_status, last_assigned_at, last_broker_activity_at
- 4 new columns on companies: lead_admin_user_id, pool_sources, stale_lead_threshold_days, stale_action
- RLS + Realtime publication enabled
- 18 existing leads backfilled to (broker_created, assigned)

**RPC v1 (Day 20):**
- assign_lead_via_pool function
- Round-robin: oldest last_assigned_at NULLS FIRST
- Multi-tenant company guard
- Atomic transaction: lead update + member rotation + audit log

**RPC v2 (Day 22 PM):**
- Added p_force boolean + p_reason text arguments
- When p_force=true: skips already-assigned guard, requires reason, writes action='manual_override'
- Backward compatible with v1 callers

**Lead creation audit logging (Day 20):**
- Helper writeBrokerCreatedLog at App.jsx module scope
- Wired into 5 lead creation paths (Path 1 primary, Path 1b retry, Path 2 V2 form, Path 3 V2 duplicate, Path 4 AI Import)

**Settings module (Day 21 — first feature-folder in PropCRM):**
- src/components/settings/SettingsPage.jsx
- src/components/settings/AgentPoolsSection.jsx (create/edit/deactivate pools)
- src/components/settings/PoolEditModal.jsx (member picker with search + chips)
- src/components/settings/LeadRoutingRulesSection.jsx (Lead Admin + pool sources + stale config)
- New top-level nav item between Master Agreements and Commission Outstanding

**Lead Queue + Assignment workflows (Day 22):**
- src/components/leadqueue/LeadQueuePage.jsx — 3 tabs (Unassigned / Stale Flagged / History)
- Client-side stale detection per design Q2 (reads companies.stale_lead_threshold_days)
- Two-layer assignment model honored (active opp activity prevents stale flag)
- src/components/leadqueue/AssignPoolDropdown.jsx — initial assignment via RPC
- src/components/leadqueue/ReleaseDialog.jsx — broker formal release with mandatory reason
- src/components/leadqueue/ReassignDialog.jsx — admin force-reassign with mandatory reason
- Lead Detail Assignment section (slim strip + Release Lead button for owner)
- History tab shows color-coded actions with italicized reasons

**Governance guarantee:** No assignment, reassignment, or release can happen without an audit trail. Reason mandatory for force-reassign and release.

**Commits:** 6381fe2, e3857ae, 72315a5, 805d6a1, cb50d29, 9deada2, cb3f598, f91107c (merge), 9747a18, 0bb5ad2 (merge) — 8 dev2 commits + 2 main merges

**Safety tags created:**
- pre-phase-2.1-schema (Day 19)
- pre-phase-2.1-rpc (Day 20)
- pre-phase-2.1-rpc-v2 (Day 22 PM)
- phase-2.1-complete (Day 22 — golden checkpoint)

---

### 2.2 🟡 Property Detail Pack — PropPulse display SHIPPED (Day 23, dev2)
**Date captured:** 30 May 2026 (Day 19 evening)
**Founder pain:** *"There is no place on the app from where i can show it to the client or even attach to the proposal."*
**Design doc:** `docs/Phase_2_2_Property_Detail_Pack_Design.md` (388 lines)

**Shipped Day 23 (dev2, verified locally, NOT yet merged to main):**
- Schema: 4 columns, idempotent migration, verified 4 rows
  - `projects.hero_image_url`, `projects.photo_gallery_urls[]`, `projects.amenities[]`, `project_units.photo_urls[]`
- 5 reusable inline-style components in `src/components/property/`:
  MediaGallery, AmenityGrid, PdfPreview, VideoEmbed, FullImage
- Wired into the EXISTING PropPulse project detail panel (enhanced, not replaced)
  via `patch_proppulse.cjs`; every media section self-hides when its data is empty
- Greyed "Share Pack — coming Q3 2026" placeholder (Phase 2 Comms trajectory)
- Verified live: Creek Harbour test seed renders hero + gallery + master plan + amenities; emoji map 8/8 correct

**Key discovery:** Design doc assumed no display surface existed — inaccurate.
PropPulse already had a working detail panel, so we ENHANCED it (zero App.jsx
changes, no risk to the Import flow). Retired the early Tailwind
ProjectDetailPanel draft (no dead code).

**Import already carries the media (verified):** `importProject` uses
`...cloneable` spread (PropPulse.jsx ~line 276) → all new media columns copy
into the tenant inventory copy automatically; units copy via `...rest`.
**Data flows to Inventory on import; only the Inventory DISPLAY is unbuilt (2.2b).**

**Commits (dev2):** de17743 (leaf cut, superseded) · 3544b51 (pack + wiring) · e3bbdec (cleanup)

**Remaining for full Phase 2.2:** Day 24 content seeding (3-4 hero projects);
2.2b Inventory display wiring; merge dev2 → main when content is demo-ready.

### 2.2b 📋 Inventory Property Pack display (PARKED — in-scope, after current job)
**Captured Day 23.** Wire the same 5 `property/` components into
`src/components/InventoryModule.jsx` (full unit detail modal; uses `selUnit`;
rendered from App.jsx 17060/17088). Components built + reusable → WIRING, not
new build. Same safe patch rhythm. **This is what makes the pack render the
same in Inventory once imported.** Effort ~0.5 day. Do NOT start without founder go.

### 2.2c 📋 Dark-blue restyle (PARKED — investor feedback)
**Captured Day 23.** Investor not happy with dark blue. Source is EXISTING
PropPulse code: navy table header (`#0F2540`, ~line 460) + modal backdrop
(`rgba(11,31,58,.6)`). Separate, deliberate styling task — not mid-build. New
Property Pack sections are already light-theme and unaffected.

### 2.3 Communications & Output Overhaul (Q3 2026)
**Founder quote:** *"all the docs, reports and mails... at the moment very minimal below the basic level"*
**Design doc:** `docs/Phase_2_Communications_Overhaul.md`
**Effort:** 4 weeks (Phase 2.3A/B/C/D)

Parts:
- 2.3A — PDF foundation (proposals, invoices, closures)
- 2.3B — Site Visit + Bundle system (brochure/floor plan attach)
- 2.3C — Email/WhatsApp templates (transactional + marketing)
- 2.3D — Reports overhaul (executive, manager weekly, investor quarterly)

---

### 2.4 Activity Logging Everywhere / FAB (Q3 2026)
**Founder direction:** *"calling logging is a floating button we may have to think logically and fit wherever necessary"*
**Stage 1 SHIPPED Day 11:** Lead Detail logging restored (commit 91f46c2)
**Stage 2:** Universal floating action button across all screens
**Document:** `docs/Phase_2_Activity_Logging_Everywhere.md`
**Effort:** 1-2 days

---

### 2.5 Lead Lifecycle & Buyer Segmentation (Q3 2026)
**Founder vision:** Investor vs Owner-Occupier + auto-conversion lead→customer
**Lifecycle:** Raw → Qualified → Active Prospect → Customer → Portfolio Customer
**Buyer Intent:** Investor / Owner-Occupier / Hybrid / Corporate / Reseller
**Document:** `docs/Phase_2_Lead_Lifecycle_Segmentation.md`
**Effort:** 2-3 days

**Note:** lifecycle_stage + buyer_intent columns already in schema; UI partial (badges visible on Lead Detail). Full marketing automation depends on Phase 2.3.

---

### 2.6 Role-Based Dashboard / Manager View (July 2026)
**Founder quote:** *"Role based Dashboard is a fantastic decision"*
**Document:** `docs/Phase_2_Role_Based_Dashboard_Vision.md`
**Effort:** 2-3 days

---

### 2.7 Two-Tier Proposal Model (Brahma Lipi) (July 2026)
**Document:** `docs/Phase_2_Proposal_Communication_Model.md`
**Effort:** 14-18 hours

---

### 2.8 Configurable Roles per Company (Q3 2026)
**Current:** Hard-coded 7 roles
**Vision:** Brokerage defines own hierarchy
**Effort:** 3-5 days

---

### 2.9 Unified Settings Module (July-Aug 2026)
**Foundation laid Day 21:** Settings as top-level nav now exists. Currently hosts Agent Pools + Lead Routing Rules only.
**Phase 2.9 work:** Migrate Users, Companies, Master Agreements, AI Quotas, Branding INTO Settings. Top nav becomes leaner.
**Why deferred:** Pre-demo each migration is ~half-day of careful work; investor doesn't care about settings sprawl; consolidation is post-demo concern.
**Effort:** ~4-6 days

---

### 2.10 Customer-Facing Context Bundle (Q3 2026)
**Founder priority:** Asked by 2nd-demo investor previously
**Status:** Design done. Part of Phase 2.3 Communications Overhaul Part B.
**Effort:** Bundled into 2.3 timeline

---

### 2.11 AI Bubble Clickable Results (Q3 2026)
**Vision:** AI Coach text → clickable cards (units, proposals, actions)
**Effort:** 2-3 hrs alpha, 1-2 days beta with tool use

---

### 2.12 Portfolio-Level AI Coach (Q3 2026)
**Founder ask:** *"is it possible to put for all his pending deals and give a fair report"*
**Connection:** Lives inside Manager view (Phase 2.6 Role-Based Dashboard)
**Effort:** 6-8 hrs backend + 1 day UI

---

### 2.13 Multi-tenant Identity Model Refactor (Post-demo)
**Document:** `docs/Architecture_Multi_Tenant_Identity_Model.md` (Day 20)
**Current state:** Founder Abid is BOTH Platform Super Admin AND tenant user of Al Mansoori (testing shortcut).
**Target state:** Two-tier identity. Platform Operators have NO data access to tenant CRM records.
**Phase 2.1 design compatibility:** Compatible with BOTH current AND target states. No pre-demo changes needed.
**Effort:** 6-9 days (5 phases A-E)
**Timing:** Post-demo

---

### 2.14 Paid Data Source Integrations (Q3 2026)
**Founder quote:** *"if we connect to the paid services also it will be a Miracle"*
**Targets:** RERA Dubai, DLD registry, Bayut/PropertyFinder
**Effort:** 2-3 weeks per source

---

### 2.15 Leasing Module Lead Queue (Post-demo)
**Captured Day 22:** Sales got Lead Queue first (Phase 2.1). Schema supports both apps but UI plumbing only wired into Sales mode.
**Effort:** Mirror Sales work into Leasing nav. ~1 day.
**Founder observation:** *"since it is both sales and leasing i think this logic was written though it is stalled to complete the sales and picture copy for leasing with leasing workflow"* — correct.

---

## SECTION 3 — Build Schedule (Forward)

```
DAY 23 (1 Jun): ✅ Property Detail Pack — PropPulse display SHIPPED (dev2)
DAY 24 (2 Jun): Demo content seeding (3-4 hero projects with photos/brochures)
DAY 25 (3 Jun): Buffer / Phase 2.1 polish if needed
DAY 26-32 (4-10 Jun): Demo Hardening Block
  - Run-through #2 with refinements
  - Mock investor sessions
  - 4th persona journey (Abdullah Al-Ghamdi)
  - Demo script v3.1 update for Phase 2.0+2.1+2.2 narrative
  - Screenshots backup
DAY 33 (11 Jun): Final dry run
DAY 37 (15 Jun): DEMO

POST-DEMO Q3 2026:
- Phase 2.2 Share/Send Bundle (Comms Part B)
- Phase 2.3 Communications Overhaul (4 weeks)
- Phase 2.4 FAB (1-2 days)
- Phase 2.5 Lead Lifecycle + Marketing (2-3 days)
- Phase 2.6 Manager Dashboard (2-3 days)
- Phase 2.9 Unified Settings consolidation (4-6 days)
- Phase 2.13 Multi-tenant identity refactor (6-9 days)
- Phase 2.15 Leasing Lead Queue (1 day)
```

---

## SECTION 4 — Founder Principles (Locked through Phase 2.1)

These principles guided architectural decisions and should govern future calls:

- **"1 step forward and 2 steps back is bothering me"** → drove Phase 2 audit Day 18
- **"If we do split we have to come back I leave this call to you avoiding come backs completely"** → drove Phase 2.1 scope expansion (full governance, not Layer 1 only)
- **"No half hearted work which spoils"** → governance included from start, not deferred
- **"Many times brokers of same org talk to same single lead but different opps"** → two-layer assignment model captured Day 19
- **"Architect call — you decide"** → trust progressively increased through Phase 2.1
- **"I should not have access to any of the data of any customer"** → drove Multi-Tenant Identity Model doc Day 20
- **"We are relying more on document now than before"** → documentation discipline locked
- **File delivery pattern locked Day 19:** Claude creates .md/.sql/.jsx as downloadable files via `/mnt/user-data/outputs/`. Heredocs fail on long content.
- **Trust founder pattern recognition.** Repeatedly proven across Days 11-22.

---

## SECTION 5 — Investor Q&A Backing

### Q: "What's NOT built yet?"
A: Be specific:
- "Property Detail Pack display layer ships Day 23 — design is locked, schema mostly exists, ~1 day build"
- "Share/Send Bundle is Phase 2.3 (Q3 2026) — design captured, depends on PDF generation"
- "Manager Dashboard is Phase 2.6 (July) — Role-aware view per founder vision"
- "Real-time sync is LIVE on production — verified cross-tab and multi-user"

### Q: "How do you handle Lead Queue and assignments?"
A: "Live on production. Lead Queue has 3 tabs (Unassigned, Stale Flagged, History). Round-robin via Agent Pools with explicit Lead Admin designation. Force-reassign requires written reason — audit log is permanent. Stale detection runs against configurable threshold per brokerage."

### Q: "What about state sync / real-time updates?"
A: "PropCRM uses Supabase Realtime subscriptions for instant cross-tab and multi-user sync. Lives in production today. Verified working with proposal saves, activity logs, and lead reassignments."

### Q: "How do you scale to 100 brokerages?"
A: "Multi-tenant from day one — company_id filtering on every query. Phase 2.13 (post-demo) splits Platform Operator identity from Tenant User identity for stricter access controls. Phase 2.1 design already compatible with that split."

### Q: "Where's your roadmap?"
A: Show Section 3. "Planned through Q4 2026 with specific deliverables, not just slides."

---

## SECTION 6 — Critical Operational Notes

### Repo
- Local: /d/prop-crm on Windows MINGW64
- Branches: dev2 (working), main (production deploys to prop-crm-two.vercel.app)
- App.jsx: ~17,200 lines monolithic — feature-folder pattern mandatory for new modules

### Folder convention (LEARNED THE HARD WAY Day 21)
- ALL lowercase: `src/components/settings/`, `src/components/leadqueue/`
- Vercel deploys on Linux (case-SENSITIVE)
- Windows resolves Settings/ same as settings/ but Linux does NOT
- Always use `mkdir -p src/components/<lowercase>/` for new folders

### Migrations discipline
- Always use IF NOT EXISTS in DDL
- Always tag a safety revert point BEFORE running new migrations
- Never share illustrative SQL without idempotency guards (Day 22 lesson: founder accidentally ran schema SQL from design doc; no damage because file had IF NOT EXISTS)

### File delivery to founder
- Claude writes long content (markdown, SQL, JSX) as downloadable .md/.sql/.jsx files via create_file tool to /mnt/user-data/outputs/
- Founder downloads, cp's into repo, runs build verify
- Heredocs fail on long content with embedded backticks/quotes — DO NOT use for >50 lines
- This pattern locked Day 19 and used cleanly through Day 22

### Vite HMR + nav changes
- Top-level nav additions (MODE_TABS, TABS array) need full dev server restart, not just HMR
- Always: Ctrl+C, npm run dev, hard refresh

### App.jsx integration pattern for new top-level nav (Settings, Lead Queue templates)
4 edits required:
1. Import component at top of App.jsx
2. Add entry to TABS array (with id, label, icon, app, roles)
3. Add id to MODE_TABS.sales AND MODE_TABS.both arrays (the hidden filter at line ~147)
4. Add tab render handler in the main return

---

## SECTION 7 — Document Cross-Reference

| Document | Subject | Status |
|---|---|---|
| `Phase_2_Backlog_Master_Doc.md` (THIS) | Master tracker | LIVE — 31 May 2026 |
| `Phase_2_1_Lead_Ingestion_Design.md` | Phase 2.1 design | LOCKED — 30 May |
| `Phase_2_2_Property_Detail_Pack_Design.md` | Phase 2.2 design | LOCKED — 31 May |
| `Architecture_Multi_Tenant_Identity_Model.md` | Identity foundation | LOCKED — 31 May |
| `Phase_2_Communications_Overhaul.md` | Phase 2.3 design | DRAFT — Day 11 |
| `Phase_2_Lead_Lifecycle_Segmentation.md` | Phase 2.5 design | DRAFT — Day 11 |
| `Phase_2_Activity_Logging_Everywhere.md` | Phase 2.4 (FAB) | DRAFT — Day 11 |
| `Phase_2_Role_Based_Dashboard_Vision.md` | Phase 2.6 design | DRAFT — Day 11 |
| `Phase_2_Proposal_Communication_Model.md` | Phase 2.7 (Brahma Lipi) | DRAFT — Day 11 |
| `Day_22_End_Of_Session_Handoff.md` | Session handoff | LIVE — 31 May |
| `Pre_Demo_Phase_2_Sprint.md` | Pre-demo discipline | UPDATED Day 19 |
| `Phase_2_Strategic_Roadmap_v1.md` | Strategic roadmap | UPDATED Day 19 |
| `Investor_Demo_Script_v3_1_21May2026.md` | Demo script v3 | Needs v3.1 update for Phase 2.0+2.1+2.2 |

---

## SECTION 8 — Recent Commit Chain (Days 19-22)

```
Day 22 (31 May, Sun PM):
  0bb5ad2 Merge dev2 → main: Phase 2.1 Day 22 (Lead Queue + Assignment)
  9747a18 Phase 2.1 Day 22: Lead Queue + Assignment workflows COMPLETE
  TAG: phase-2.1-complete

Day 22 (31 May, Sun):
  cb3f598 Phase 2.1 Day 21 PM: Lead Routing Rules UI complete

Day 21 (31 May, Sun AM):
  9deada2 Phase 2.1 Day 21 AM: Settings module + Agent Pools UI (3 components, 884 lines)
  6f9265f Phase 2.1 Day 21 AM (initial — fixed by 9deada2 via folder casing rename)
  f91107c Merge dev2 → main (first Day 19-21 merge)

Day 20 (31 May, Sun morning):
  805d6a1 Phase 2.1 Day 20: lead creation flow writes broker_created audit log
  cb50d29 Architecture doc: multi-tenant identity model
  72315a5 Phase 2.1 Day 20: assign_lead_via_pool RPC function
  TAG: pre-phase-2.1-rpc

Day 19 (30 May, Sat):
  e3857ae Phase 2.1 Day 19 PM: schema migration deployed
  6381fe2 Phase 2.1 design doc
  TAG: pre-phase-2.1-schema
  f727aa2 Pre-Demo Sprint doc: Day 19 evening rewrite
  8b28891 Strategic Roadmap: Item 1 + Item 2 expanded scope
  05fbb51 Phase 2.0 hotfix #2: dedupe save handler
  98775f6 Phase 2.0 Day 1 hotfix: dedupe realtime INSERTs
  3fbe96b Phase 2.0 Day 1 subtask 2: per-opp proposals
  776c0d6 Phase 2.0 Day 1 subtask 1: activities full I/U/D
  765d4f4 Day 19: Pre-Demo Phase 2 Sprint discipline doc

Day 22 PM additional safety:
  TAG: pre-phase-2.1-rpc-v2
```

---

## SECTION 9 — Update Discipline

This document gets updated when:
- New Phase 2 item identified
- Phase 1 feature hidden for demo
- Phase 2 item completes and graduates
- Investor Q&A reveals question not yet addressed
- New strategic vision from founder
- New session ends with material progress (Day 22 = today's update)

**Don't fragment Phase 2 into tiny docs.** Add sections HERE.
Exception: Big design specs get own doc, but referenced here.

---

*Document last updated: 1 June 2026 (Mon, Day 23)*
*Status: Live document — Phase 2.0 + 2.1 on production; Phase 2.2 PropPulse display on dev2*
*Next major update: After Day 24 content seeding + dev2→main merge*
