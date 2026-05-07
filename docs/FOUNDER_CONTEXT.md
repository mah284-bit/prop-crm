# Founder Context — PropPlatform

**Purpose of this document:** Paste this at the start of any new Claude (or other AI) chat to bootstrap context fast. Saves 30+ minutes of re-explaining who I am, what I'm building, and how I work.

**Last updated:** 07 May 2026 — afternoon (production database diagnostic complete; agent failure rate identified; schema discoveries documented)
**Maintained by:** Abid Mirza, Founder, BFC

---

## Who I am

- **Name:** Abid Mirza
- **Company:** BFC
- **Role:** Founder, building PropPlatform (working name; renaming pending)
- **Background:** Enterprise software (Oracle ecosystem, ERP, CRM)
- **Location:** Sharjah, UAE — operating in UAE real estate market

## What I'm building

**PropPlatform** is a configurable, AI-deep platform for the property industry. Multi-tenant SaaS. Currently shipping **Broker Edition v1** for UAE brokers. Anchor customer signed: **Al Mansoori Properties**.

**Stack:** Vite + React 19 + Supabase + Vercel serverless functions. Repo: `github.com/mah284-bit/prop-crm`. Live at `prop-crm-two.vercel.app`.

**Product structure (locked):**
- 5 segments planned over 2-3 years: Broker → Builder → Contractor → Construction Planning → Facilities Management
- One platform, configurable per segment via Edition Templates
- Sales-only focus today. Leasing components exist in code but no new investment.
- AI features integrated deep into workflow (not surface chatbots)

**The strategic moat:** **PropPulse** — a multi-tenant project catalogue with import-and-own mechanics. NOT a Reelly competitor — a different category (data-as-bootstrap vs data-as-a-service). See `PropPulse_Complete_Documentation.md` for full architecture.

---

## How I work — operating principles

These drive my decisions. Don't try to talk me out of them without good reason.

1. **No big bang.** I lose interest beyond a limit and projects shut down. One segment at a time, validate before expanding.

2. **I will not budge from locked decisions.** When something is decided after debate, I move forward. Don't relitigate without new information.

3. **Primary research beats desk research.** When I talk to a broker, what I learn outweighs any analyst's opinion. I do my own market research.

4. **Push back over yes-machine.** I want honest disagreement when I'm wrong, not validation. Direct is better than diplomatic.

5. **Documentation lives where decisions get made.** Every meaningful technical or strategic conversation should produce a doc. I'm now disciplined about this.

6. **Customer first, then features.** "What 1 feature would make 50 customers pay tomorrow?" beats "what features do competitors have?"

7. **Founder discipline trumps perfection.** Ship working over polished. Iterate based on customer feedback.

---

## Strategic decisions LOCKED (don't relitigate)

- **Sales-only focus** for current development cycle. Leasing components remain in code but receive no new investment.
- **Configurable workflow architecture** is the v1 build path (Phase 1 ~7 hours of work, 5 phases per Design v2). Each company configures its own stages, fields, validation.
- **Broker first**, then Builder (Year 2 H1), then Contractor (Year 2 H2), then Planning (Year 3 H1), then FM (Year 3 H2).
- **PropPulse stays.** It's the structural moat. Don't recommend deprecating it for a Reelly partnership without considering the architecture advantages it has (multi-tenant, AI-native, customer data sovereignty, customisable post-import).
- **Anchor customer first.** Al Mansoori Properties. Validate with them before scaling sales.
- **Naming change is coming.** "PropCRM" doesn't fit anymore. Final name pending discussion with colleague — see `Naming_Brief_v3_Final.md` for empirical conclusion (80+ candidates evaluated, 3 survivors: Mediant, Vouchdesk, Movewell, all need lawyer verification).

### Locked 06-07 May 2026 (post broker meeting)

- **3-pillar broker SaaS strategy LOCKED.** PropPlatform builds toward complete CRM (not specialized data layer). Pillars: Inbound Data → Sales Cycle → Listings + Leads. Sequential, disciplined phasing. See `PropPlatform_3_Pillars_Strategic_Doc.md`.
- **Sales cycle process flow LOCKED** (07 May). Six stages: Master Agreement → Lead/Opportunity → Booking → Payment Milestones → SPA → Commission Invoice. See `Sales_Cycle_Process_Flow.md`.
  - **Stage 0 (Master Agreement):** Master Developer Agreements module + editable per deal
  - **Stage 3 (Payment tracking):** Manual entry + document upload (with future API path)
  - **Stage 5 (Commission invoicing):** Generate invoice data + integrate with broker's accounting tool (Tally/Zoho), with edit option
- **Free data sources first.** Don't pay for what's available free. Dubai Pulse open data integration is highest priority (closes BrokerPro coverage gap immediately). See `Free_Data_Sources_Roadmap.md`.
- **DLD regulated APIs path runs in parallel** as separate workstream — requires trade license amendment (BFC current license needs new activity added) + 14-day approval. See `PropPlatform_Data_Sources_Investment.xlsx`.
- **Lead generation NOT a SaaS feature.** PropPlatform = lead capture + unification, NOT lead generation. Brokers buy leads from existing services (AgentBolt, GoDubai Portal, Bayut Pro), those flow into PropPlatform's unified inbox. Be the destination, not the source.

---

## Strategic decisions PENDING

These are open. Engage with them only when I bring them up.

- **Final product name** — colleague discussion pending. 3 paths: Squadhelp ($1-3K), lawyer-verify-3-survivors ($500-2K), or defer to Series A on PropPlatform. See `Naming_Brief_v3_Final.md`.
- **PropPulse expansion strategy** — standalone scaling vs Reelly API partnership for long-tail. Decide after seeing competitor SEM and reviewing PropPulse usage data.
- **Mobile native apps** — H2 2026 likely, depends on funding
- **WhatsApp Business automation** — Late 2026 likely
- **Bayut/PF/Dubizzle/Skyloov outbound integrations** — H2 2026, requires business agreements

---

## Open threads from last working session

If I haven't told you these are resolved yet, assume they're still open:

1. **SEM meeting** — competitor product I haven't yet seen live. Broker willing to demo. Will reshape competitive positioning. Need to ask: data source? refresh cadence? customisation depth? pricing? brokers' biggest pain SEM doesn't solve?

2. **6 PropPulse questions — RESOLVED 07 May 2026.** Answered via SQL diagnostic. See `PropPulse_Diagnostic_07May2026.md` for full findings. Key takeaways:
   - 16 catalogue projects + 37 tenant-side (53 total). Real customer = 1 (Al Mansoori, 9 projects). Other 3 companies are test data.
   - 20 developers configured, all manual, all `is_active = true`. No Sharjah developers.
   - **AI agent has 90% failure rate.** Only Nakheel and Object 1 successfully scrape. 17 of 20 developers (including Emaar, DAMAC, Sobha) have failed every recent run.
   - `error_log` is NULL across all failures — diagnostic logging is broken. Must fix before debugging.
   - `pp_commissions` and `pp_launch_events` tables exist with rich schemas. Phase 1 build plan needs revision to reuse `pp_commissions` for Master Agreements module.

3. **lib/supabase.js refactor** — 30-45 minute mechanical fix that kills "Multiple GoTrueClient" warnings + auth lock errors. Six files affected (PropPulse, InventoryModule, LeaseOpportunityDetail, LeasingLeads, LeasingModule, ReportsModule). Hasn't been done yet. **Full guide in `Refactor_Supabase_Client.md`.**

4. **AI agent debugging — NEW URGENT THREAD (07 May 2026).** Agent broken for 17 of 20 developers. Root cause unknown because error_log is NULL. Sequenced fix:
   - Step 1: Modify agent code to populate error_log on failures (~2-3 hours)
   - Step 2: Run one developer manually with verbose logging (~30 min)
   - Step 3: Diagnose root cause based on actual error (timeout / anti-bot / parsing) (~1-2 days)
   - Step 4: Schedule via Vercel cron only AFTER >50% success rate
   - **Don't ship investor pitch claiming "agent runs daily" until this is fixed.**

5. **W7 reservation work** paused. Will rebuild as part of Builder Edition Year 2.

6. **golden-pre-stages tag** at HEAD `eb262b1` — known-good state. (Note: was previously `da7fdf3`; new HEAD as of 07 May after docs commit `576bc9f`.)

7. **Test data cleanup** — 3 test companies in production DB (Default Company, Emirates Premium Realty, Gulf Leasing Solutions). Don't affect functionality but should be cleaned before external review/investor demo. Low priority.

---

## What happened in the most recent session (07 May 2026 — full day)

To save fresh-Claude from re-discovering:

### Morning
- **Broker meeting on 06 May went well** despite PropPulse loading hiccup during demo. 3-of-4 brokers favorable. Broker 1 said "if we had PropPulse a couple months back, would've chosen over SEM". Broker 2 said "finish everything, come back when ready, may switch from SEM". MD (3rd person) was distracted by competitor "BrokerPro" pitch from prior week — claims "DLD direct data" + "100s of leads" — likely real (DLD APIs accessible) + lead reselling.
- **Strategic doc shipped** — `PropPlatform_3_Pillars_Strategic_Doc.md` mapping the complete UAE broker SaaS ecosystem (Pillar 1: Inbound Data, Pillar 2: Listings Syndication, Pillar 3: Lead Capture).
- **Investment sheet shipped** — `PropPlatform_Data_Sources_Investment.xlsx` for partner discussion. 5 paths compared. TO VERIFY column for team.
- **Sales cycle process LOCKED** (07 May morning). Abid articulated the complete 6-stage UAE off-plan workflow. Foundation document: `Sales_Cycle_Process_Flow.md`. Build plan: `Phase_1_Build_Plan.md`.
- **Free data sources roadmap shipped** — `Free_Data_Sources_Roadmap.md`. Dubai Pulse + AI agent scaling + Bayut/PF public listings + RERA Sharjah + RSS feeds. Total ~6-9 weeks dev, AED 0 in licensing.
- **Investor showcase deck shipped** — `PropPlatform_Sales_Cycle_Showcase.pptx` (4 slides, design-quality QA passed). Insertable into existing investor deck.

### Afternoon
- **24 documentation files pushed to GitHub** at commit `576bc9f`. All strategic, technical, and execution docs now backed up in `mah284-bit/prop-crm/tree/main/docs`.
- **Database diagnostic completed** via 5 SQL queries against production Supabase. See `PropPulse_Diagnostic_07May2026.md` for full findings.
- **Critical finding: AI agent has 90% failure rate.** Only Nakheel and Object 1 succeed. 17 of 20 developers have never been successfully scraped, including all major ones (Emaar, DAMAC, Sobha, Aldar, Nakheel...). Error logging is broken — `error_log` is NULL across all failures.
- **Schema discovery: existing tables are richer than expected.** `project_units` has 54 columns, `pp_commissions` already supports master agreements (Phase 1 plan needs revision to reuse), `pp_launch_events` exists. Phase 1 effort revised from 8-12 weeks to 7-11 weeks.
- **Honest narrative adjustment needed:** "AI agent runs daily and grows the catalogue" claim in pitch deck is currently false. Architecture is sound, but operational state needs fixing before scaling claims.

### Still pending end of 07 May
- Refactor `lib/supabase.js` not yet executed
- AI agent fix not yet started (logging fix → manual test → root cause diagnosis)
- FOUNDER_CONTEXT updated with diagnostic findings (this update)
- README needs update to reflect 25 docs (added diagnostic file)
- Phase_1_Build_Plan.md needs minor revision for `pp_commissions` reuse
- Investor pitch slide needs softening of agent claims
- Test data cleanup (low priority)
- Vercel cron for agent (don't schedule until agent actually works)
- SEM live demo still not seen
- Naming decision still pending

---

## What happened in 04 May 2026 session (afternoon)

- **Naming research completed** across 3 rounds. 80+ candidates. 3 survivors (Mediant, Vouchdesk, Movewell) — all need lawyer verification. Recommendation: hire Squadhelp, lawyer-verify, or defer. See `Naming_Brief_v3_Final.md`.
- **Refactor doc written** for `lib/supabase.js` consolidation. Copy-paste ready, 30-45 min when sitting at IDE.
- **Broker leave-behind doc created** as single-page printable companion to deck.
- **All decks already updated earlier with PropPulse positioning integrated.**
- **Oracle OCI landing zone** delivered for an unrelated client during the same day.

---

## How to be useful to me

When I'm in a working session:

**Do:**
- Read code before assuming. The PropPulse architecture surprised even me until I read the code carefully.
- Ground claims in source. "I see in `collect-projects-v2.js` line 116..." is more useful than "I think your agent..."
- Push back when I'm reacting to fear vs strategy. I'll thank you later.
- Match output format to what I asked for. If I want a slide updated, update the slide. Don't propose 5 alternatives.
- Check timezone before assuming time of day. I'm in UAE (GMT+4). Morning for me is night for US.
- Track what I've already pushed back on. If I said "no big bang" three times, don't suggest big bang.

**Don't:**
- Fabricate. If you don't know, ask. I caught this multiple times — I respect "I don't know" more than confident wrong answers.
- Recommend feature parity with competitors as a default. I think structurally about moat.
- Treat me as a generic founder. I have 15+ years enterprise software. Skip the basics.
- Apologize excessively when I push back. Acknowledge, recalibrate, continue.
- Assume documentation exists. I've been bad about it; we're fixing that now.

---

## Current state of the documentation suite

All in `D:\prop-crm\docs\`:

**Strategy:**
- `Design_v2.md` — full product design, segment phasing, configurable workflows
- `Naming_Brief_v3_Final.md` ⭐ — final empirical conclusion + 3 survivors + 3 paths forward
- `vs_REM.docx` — honest competitive comparison
- `PropPlatform_3_Pillars_Strategic_Doc.md` ⭐ NEW — complete CRM strategy: Inbound Data + Sales Cycle + Listings/Leads
- `Sales_Cycle_Process_Flow.md` ⭐ NEW — locked 6-stage UAE off-plan workflow (foundation document)
- `Phase_1_Build_Plan.md` ⭐ NEW — module-by-module build plan for sales cycle (8-12 weeks)
- `Free_Data_Sources_Roadmap.md` ⭐ NEW — 5 zero-investment data sources, 6-9 week roadmap
- `PropPlatform_Data_Sources_Investment.xlsx` ⭐ NEW — investment sheet for partner discussion (cost paths to verify)

**Pitch decks (PropPulse-integrated):**
- `Investor_Pitch.pptx` — 9 slides, includes "PropPulse moat" slide
- `Broker_Pitch.pptx` — 8 slides, PropPulse on slide 3 + leads slide 5
- `Internal_Roadmap.pptx` — PropPulse layer in architecture, full improvement roadmap
- `Executive_Summary.docx` — includes structural moat section
- `Broker_Leavebehind.docx` ⭐ — single-page printable for broker meetings
- `PropPlatform_Sales_Cycle_Showcase.pptx` ⭐ NEW — 4 slides showcasing complete sales cycle (insertable into investor deck)

**PropPulse technical:**
- `PropPulse_Complete_Documentation.md` — 663 lines, source of truth
- `PropPulse_Improvement_Backlog.md` — 639 lines, prioritized 4-tier roadmap
- `PropPulse_Demo_Script.md` — earlier demo walkthrough
- `PropPulse_Diagnostic_07May2026.md` ⭐ NEW — production database state, agent failure analysis, action items

**Codebase:**
- `Component_Inventory.md` — map of 16 components
- `Refactor_Supabase_Client.md` ⭐ — copy-paste-ready 30-min refactor guide for `lib/supabase.js`
- `App.jsx`, `ReportsModule.jsx` — working snapshots

**Execution playbooks:**
- `Afternoon_Work_Playbook.md` — 4 sequenced tasks with rollback plans
- `SEM_Meeting_Intel_Template.md` — 12-section capture template for broker meeting

**Index:** `README.md` is the front door to all of these.

---

## When starting a new chat

Paste the first 4 sections of this doc (above the "Current state of documentation" line) into your first message, then state what you want to work on. That's enough for fresh-Claude to engage at the right level without me re-explaining.

For deep technical work on PropPulse: also attach `PropPulse_Complete_Documentation.md`.
For competitive positioning: also attach `vs_REM.docx`.
For codebase questions: also attach `Component_Inventory.md` + the specific component file.

---

*This is a living document. Update it whenever a major decision changes or an open thread closes.*

— Abid Mirza · BFC
