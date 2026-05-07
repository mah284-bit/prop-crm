# PropPlatform Documentation

This folder contains strategic, product, and technical documentation for PropPlatform (working name; renaming TBD — see `Naming_Brief_v3_Final.md`).

**Last updated:** 07 May 2026 — afternoon (production database diagnostic; AI agent issue identified; docs pushed to GitHub)
**Maintainer:** Abid Mirza, Founder, BFC
**Total documents:** 25

---

## How to use this folder

1. **New to the project?** Read `FOUNDER_CONTEXT.md` first (10 min). Everything else makes sense after that.
2. **Coming back after a break?** Read this README + the section headers below to find what you need.
3. **Updating a doc?** Edit the existing one, stamp the date at the top, and update this index if anything significant changed.
4. **Don't create v2 / v3 / new files** for the same purpose unless deliberately preserving an audit trail (like the naming briefs).

---

## 🎯 Start here — the essentials

If you only read 4 documents, read these:

| # | Document | Why it matters |
|---|---|---|
| 1 | `FOUNDER_CONTEXT.md` | The bootstrap doc. Operating principles, locked decisions, open threads. |
| 2 | `PropPlatform_Design_v2.md` | The full product design. Vision, segments, configurable workflows, phasing. |
| 3 | `PropPlatform_3_Pillars_Strategic_Doc.md` | The current strategic direction — 3 pillars (Inbound Data + Sales Cycle + Listings/Leads). |
| 4 | `Sales_Cycle_Process_Flow.md` | Locked 6-stage UAE off-plan workflow. Foundation for Phase 1 build. |

---

## 📊 Strategy & Product Design (5 docs)

| Document | Purpose | When to use |
|---|---|---|
| `PropPlatform_Design_v2.md` | Full product design — vision, 5 segments, configurable workflows, Phase 1 plan | Re-read before major scope/build decisions |
| `PropCRM_Workflow_Config_Design.md` | Earlier configurable workflow design notes | Reference for v2 design lineage |
| `PropPlatform_3_Pillars_Strategic_Doc.md` ⭐ | The 3-pillar strategy — complete UAE broker CRM (Inbound Data → Sales Cycle → Listings/Leads). Locked 06 May 2026. | Strategic direction discussion. Investor narrative. |
| `Sales_Cycle_Process_Flow.md` ⭐ | 6-stage UAE off-plan workflow locked 07 May 2026. Foundation document. | Onboarding new devs. Customer training. Investor explanation. |
| `Phase_1_Build_Plan.md` ⭐ | Module-by-module build spec for sales cycle (8-12 weeks). 7 modules, sequencing, effort estimates. | Active development reference. |

---

## 💼 Naming & Branding (1 doc)

| Document | Purpose | Status |
|---|---|---|
| `Naming_Brief_v3_Final.md` | Final naming conclusion. 80+ candidates evaluated. 3 survivors: **Mediant, Vouchdesk, Movewell**. | DECISION PENDING. Three paths: Squadhelp ($1-3K), lawyer-verify ($500-2K), or defer to Series A on PropPlatform. |

---

## 💰 Data Sources & Investment (2 docs)

| Document | Purpose | When to use |
|---|---|---|
| `Free_Data_Sources_Roadmap.md` ⭐ | 5 zero-investment data sources catalogued (Dubai Pulse, AI agent scaling, Bayut/PF public, RERA Sharjah, RSS). 6-9 weeks dev, AED 0 in licensing. | Phase 1 data layer planning. |
| `PropPlatform_Data_Sources_Investment.xlsx` ⭐ | Investment sheet for partner discussion. 5 paths compared. TO VERIFY column for team to confirm with PRO/DLD/vendors. | Partner discussion. License amendment decision. |

---

## 🎯 Pitch Decks (6 docs)

| Document | Audience | When to use |
|---|---|---|
| `PropPlatform_Investor_Pitch.pptx` (9 slides) | VCs, angels | Fundraising. Slide 5 is "PropPulse moat" data-as-bootstrap story. |
| `PropPlatform_Broker_Pitch.pptx` (8 slides) | Brokers | Live broker meetings. PropPulse on slide 3 + slide 5 leads "Where We Win". |
| `PropPlatform_Internal_Roadmap.pptx` | Internal team / advisors | Team alignment. PropPulse architecture + improvement roadmap. |
| `PropPlatform_Executive_Summary.docx` | Senior stakeholders | Pre-read before meetings. Includes "Structural moat" PropPulse section. |
| `PropPlatform_Sales_Cycle_Showcase.pptx` ⭐ (4 slides) | Investors, brokers | Showcases complete 6-stage sales cycle as differentiator. **Insertable into investor deck.** |
| `PropPlatform_Broker_Leavebehind.docx` | Brokers (after meeting) | Single-page printable. Print 2 copies. Fill in your email + phone in footer first. |

---

## 🥊 Competitive (1 doc)

| Document | Purpose | When to use |
|---|---|---|
| `PropPlatform_vs_REM.docx` | Honest competitive comparison vs Real Estate Matchmaker — leads with PropPulse | Send to brokers asking "how are you different from REM?" |

---

## ⚡ PropPulse — Technical Reference (4 docs)

| Document | Purpose |
|---|---|
| `PropPulse_Complete_Documentation.md` | **Source of truth.** Architecture, AI agent (Claude + web_search), database schema, data flow, reliability assessment, SQL queries. **663 lines.** |
| `PropPulse_Improvement_Backlog.md` | **Prioritized 6-12 month roadmap.** 4 tiers (high impact/low effort → vision-level). Each item has effort estimate, dependencies, acceptance criteria. **639 lines.** |
| `PropPulse_Demo_Script.md` | Demo walkthrough for broker presentations. |
| `PropPulse_Diagnostic_07May2026.md` ⭐ | **Production database state diagnostic.** 5 SQL queries, real data findings. **CRITICAL: AI agent has 90% failure rate. Action items prioritized.** Read before any agent work. |

---

## 🏗️ Codebase — Technical Reference (2 docs)

| Document | Purpose |
|---|---|
| `Component_Inventory.md` | Map of 16 component files in `/src/components` — what each does, line counts, tech debt items (e.g., `lib/supabase.js` refactor opportunity). |
| `Refactor_Supabase_Client.md` | **Copy-paste-ready 7-step refactor guide.** Centralises Supabase client. Eliminates "Multiple GoTrueClient" warnings + auth-lock errors. **~30 min mechanical work. Pending execution.** |

---

## 📋 Execution Playbooks (3 docs)

| Document | Purpose |
|---|---|
| `FOUNDER_CONTEXT.md` ⭐ | **Chat-bootstrap document.** Paste into fresh Claude conversation for instant context. Operating principles + locked decisions + open threads. |
| `Afternoon_Work_Playbook.md` | 4 sequenced tasks for a focused work session: save+commit, SQL queries, lib/supabase.js refactor, Vercel cron. Rollback plans included. |
| `SEM_Meeting_Intel_Template.md` | 12-section structured capture template for competitor product demos. Fill in DURING/immediately after meeting while fresh. |

---

## 🚦 Pending Work (as of 07 May 2026 afternoon)

### 🔴 Critical — surfaced by 07 May diagnostic

1. **Fix AI agent error_log capture** (~2-3 hours) — agent code marks jobs failed without logging WHY. Must fix before any debugging. See `PropPulse_Diagnostic_07May2026.md` for full picture.
2. **Diagnose root cause of 90% agent failure rate** (~1-2 days) — once logging works, run Emaar manually to see actual error. Likely timeout, anti-bot, or parsing.
3. **Update investor pitch deck** (~30 min) — soften "AI agent runs daily" claim until agent is fixed. Architecture is real; daily operation is currently broken.

### 🟡 Technical execution (when ready)

4. **`lib/supabase.js` refactor** (~30-45 min) — fixes demo loading hiccup observed in 06 May broker meeting. See `Refactor_Supabase_Client.md`.
5. **Revise Phase_1_Build_Plan.md** (~30 min) — reuse existing `pp_commissions` table for Master Agreements module instead of creating new `developer_agreements` table. Saves ~1 week of build work.
6. **Vercel cron for AI agent** (~1-2 hours) — but only AFTER agent achieves >50% success rate. Don't schedule a broken agent.

### 🟢 Cleanup & enhancement (low priority)

7. **Clean test data** (~15 min) — Default Company, Emirates Premium Realty, Gulf Leasing Solutions in production DB. Don't affect functionality.
8. **Populate `rera_developer_no`** (~1 hour) — manual research, useful for "Verified by RERA" badges.
9. **Add Sharjah developers** (~30 min) — Arada, Saraya, Tilal Properties. Currently 0 Sharjah coverage.

### Strategic decisions pending

1. **Partner discussion** — 3-pillar strategy validation + data sources investment + GTM/pricing
2. **Naming decision** — Squadhelp ($1-3K) OR lawyer-verify 3 survivors ($500-2K) OR defer to Series A
3. **Trade license amendment** — apply via PRO if proceeding with DLD APIs (14-day clock)

### Phase 1 development (when committed)

1. Developer Agreements module (~3-5 days, EXTEND `pp_commissions`) — was 1.5-2 weeks, revised after schema discovery
2. Opportunity Detail extension (1 week) — parallel
3. Payment Milestones module (2-3 weeks) — the killer feature
4. SPA Tracking (1 week)
5. Commission Invoicing (2-3 weeks)
6. Discount Approvals integration (0.5 weeks)
7. Reports & Dashboards (1-1.5 weeks)

**Total Phase 1: 7-11 weeks of focused dev work** (revised down from 8-12 after schema reuse identified). See `Phase_1_Build_Plan.md`.

---

## 🔑 Strategic Decisions LOCKED (don't relitigate)

These were debated and decided. Don't recommend reversing without significant new information.

### Locked early May 2026
- **Sales-only focus.** Leasing remains in code, no new investment.
- **Configurable workflow architecture.** Each company configures its own stages.
- **Broker-first.** Broker → Builder → Contractor → Planning → FM over 2-3 years.
- **No big bang.** One segment at a time. Validate before expanding.
- **PropPulse is the moat.** Multi-tenant catalogue. NOT a Reelly competitor — different category.
- **Anchor customer first.** Al Mansoori Properties.

### Locked 06-07 May 2026 (post broker meeting)
- **3-pillar strategy.** Complete UAE broker CRM, not specialized data layer. Sequential phasing.
- **Sales cycle 6-stage workflow.** Master Agreement → Lead → Booking → Payments → SPA → Commission Invoice.
- **Stage 3 design:** Manual entry + document upload (with future API path for cooperating developers).
- **Stage 5 design:** Generate invoice data + integrate with broker's accounting tool (Tally/Zoho), with edit option.
- **Free data sources first.** Don't pay for what's available free. Dubai Pulse is highest priority.
- **Lead generation is NOT a SaaS feature.** PropPlatform = lead capture + unification. Brokers buy leads from existing services; those flow into PropPlatform's inbox. **Be the destination, not the source.**

---

## 🗂️ Folder structure conventions

- **Filenames:** `PascalCase_With_Underscores.md` for technical docs; descriptive titles for decks.
- **Date stamps:** Each doc starts with "Last updated: [date]".
- **Update don't duplicate.** Edit existing docs. Don't create v2/v3 unless preserving a deliberate audit trail (like naming).
- **Add to this index.** When you create a new doc, add a row to the right section above.
- **GitHub backup.** Push this entire folder regularly. Single source of truth.

---

## 📞 When starting a fresh chat with Claude (or any AI)

Paste the first 4 sections of `FOUNDER_CONTEXT.md` (above the "Current state of documentation" line) + state what you want to work on. That's enough for a fresh assistant to engage at the right level.

For deep technical work on PropPulse: also attach `PropPulse_Complete_Documentation.md`.
For competitive positioning: also attach `PropPlatform_vs_REM.docx`.
For codebase questions: also attach `Component_Inventory.md` + the relevant component file.
For sales cycle / Phase 1: attach `Sales_Cycle_Process_Flow.md` + `Phase_1_Build_Plan.md`.

---

*This index is the front door to PropPlatform documentation. Keep it current. When in doubt, update it.*

— Abid Mirza · BFC · 07 May 2026
