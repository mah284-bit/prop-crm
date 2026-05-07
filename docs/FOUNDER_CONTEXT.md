# Founder Context — PropPlatform

**Purpose of this document:** Paste this at the start of any new Claude (or other AI) chat to bootstrap context fast. Saves 30+ minutes of re-explaining who I am, what I'm building, and how I work.

**Last updated:** 07 May 2026 — late evening (AGENT FIXED — 85% success rate, catalogue growing autonomously)
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

## Environment & infrastructure (honest state)

**Important:** This section captures what's KNOWN and FLAGS uncertainties. Don't make assumptions beyond what's documented here. Verify with Abid before acting on environment details.

### What's confirmed

- **Codebase:** Local at `D:\prop-crm` on Abid's laptop
- **Repo:** `github.com/mah284-bit/prop-crm` (single repo, `main` branch is the live source)
- **Stack:** Vite + React 19 + Supabase + Vercel serverless functions
- **Local dev:** `npm run dev` → `http://localhost:5173`
- **Vercel auto-deploy:** Pushes to `main` deploy automatically
- **Supabase project:** ONE database for the CRM, named `propcrm-dev` (project ID `ysceukgpimzfqixtnbnp`, AWS ap-south-1, micro tier)
- **Supabase URL hardcoded in code:** `https://ysceukgpimzfqixtnbnp.supabase.co`
- **Other Supabase projects in dashboard (NOT for PropCRM):** BuildCore, edustack — leave alone

### Important context about "production"

Abid is at UAT/MVP/testing phase, not formally launched. Earlier the Supabase project was named "prod" but was renamed to `propcrm-dev` to reflect reality — there is **no separate production environment** at present. **Whatever Vercel deploys from `main`** is what Al Mansoori (anchor customer) and demo brokers see.

This means:
- ⚠️ **Any push to `main` immediately affects the live demo.** Be careful.
- ⚠️ **No separate staging environment** to test changes safely outside localhost.
- 🟡 **Future state:** When 5+ paying customers exist, real prod/staging separation will be needed. Not urgent today.

### Known uncertainties

- ❓ Exact Vercel URL where `main` deploys — assumed `prop-crm-two.vercel.app` based on past references but not formally verified
- ❓ Whether brokers/Al Mansoori actively use the deployed version or only see localhost demos when Abid is present
- ❓ Whether `src/AppOld.jsx` (visible in git status) is still relevant or just legacy file to delete

### Safety practices used today (07 May 2026 refactor)

- Created a feature branch (`refactor/supabase-client`) before edits
- Backed up every modified file as `.backup` before editing
- Verified with `head -3` after each edit
- Tested locally before merging to `main`
- Rolled back files when an unexpected error appeared (App.jsx `q.catch` issue)
- Only merged + pushed once Sales side was confirmed working

These practices are good defaults — re-use them for any future code changes.

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

3. **lib/supabase.js refactor — RESOLVED 07 May 2026.** Centralized Supabase client into `src/lib/supabase.js`. 6 component files refactored. Shipped to production at commit `7c8b2c3`. PropPulse loads noticeably faster.

4. **App.jsx refactor — RESOLVED 07 May 2026.** Fixed q.catch bug (commit `aef8b3f`) by changing pattern to `q.then(r=>r).catch(...)` matching the working `qsafe` helper at line 11843. Then completed App.jsx Supabase refactor (commit `0546c85`). All 7 files now use shared `src/lib/supabase.js` client.

5. **AI agent debugging — RESOLVED 07 May 2026.** Five-phase debugging journey (~3 hours):
   - Phase 1: Added error_log capture (commit `80a7886`) — revealed parse errors
   - Phase 2: Smarter parser + stronger prompt (commit `8cd4b04`) — partial improvement
   - Phase 3: Prefill attempt (commit `27ca52a`) — BROKE agent with 500 errors (prefill incompatible with web_search)
   - Phase 4: Rollback (commit `aab917e`) — 500 errors persisted, mystery
   - Phase 5: Found root cause (commit `4a439bc`) — backticks in template literal had been silently breaking JavaScript syntax since Phase 2. Single-character fix.
   - **Result: 85% success rate (17/20 developers). 37 new projects added to catalogue tonight.**
   - **Lesson: never use backticks inside JS template literals. Use `node -c filename.js` to syntax-check.**
   - **Lesson: prefill (`role: "assistant"`) is INCOMPATIBLE with web_search tool.**

6. **W7 reservation work** paused. Will rebuild as part of Builder Edition Year 2.

7. **golden tag updated to `golden-2026-05-07`** at commit `4a439bc` — known-good state with working agent. Use `git checkout golden-2026-05-07` to return here if needed.

8. **Test data cleanup** — 3 test companies in production DB. Explicitly deferred until product near-complete. Low priority.

9. **Pre-existing bugs remaining (not from today's refactor):**
   - `can()` not defined in `LeasingModule.jsx` and `LeasingLeads.jsx` — leasing modules crash when clicked. Hidden because sales-only focus. Fix when reactivating Leasing in Year 2 H2.

10. **Cost discipline tactics for future agent debugging:**
   - Test with ONE developer at a time (not full 20-developer sweep) — cuts cost from $1-3 per test to ~$0.10
   - Lower `max_uses: 5` web search cap to 2 during debugging — reduces per-call cost ~50%
   - Anthropic auto-reload is enabled at $10 → $20 threshold (consider tightening or capping at API console level)

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
- **Diagnostic + doc updates pushed to GitHub** at commit `d664adc`.

### Evening
- **Supabase client refactor SHIPPED to production** at commit `7c8b2c3`. 6 component files now share one client (`src/lib/supabase.js`). Net 16 lines removed from codebase. PropPulse loads noticeably faster (Abid confirmed).
- **App.jsx Supabase refactor SHIPPED** at commit `0546c85` after q.catch bug fixed. App.jsx now also uses shared client. ALL 7 files consolidated.
- **App.jsx q.catch bug fixed** at commit `aef8b3f` — Permissions module no longer crashes. 5-day-pending bug fixed in 5 minutes once we found the working pattern at line 11843.
- **Environment setup documented** in this file (FOUNDER_CONTEXT) for the first time. Important: no separate prod/staging — `main` deploys directly to Vercel's live URL where Al Mansoori sees changes immediately.
- **PropPlatform_Data_Roadmap.pptx created** — 3-slide deck documenting Phase 1 (free) and Phase 2 (regulated) data sources. Shipped at `docs/PropPlatform_Data_Roadmap.pptx`.

### Late evening — agent debugging saga (RESOLVED)

The day's most complex sequence. Started at ~10:30 PM with goal of fixing the AI agent.

**Phase 1 — Diagnostic infrastructure (commit `80a7886`):**
Modified `api/collect-projects-v2.js` `logJob()` to write `error_log` column from `results.errors[]`. Errors were already being collected, just not persisted. **First test revealed all 20 developers failing with "Parse error: Unexpected token 'B'/'I'"** — Claude was returning prose narration ("Based on my research...", "I found...") instead of JSON arrays.

**Phase 2 — Smarter parser (commit `8cd4b04`):**
Two changes: (1) strengthened system prompt with stronger instructions, (2) added regex-based JSON extraction from prose responses. **Test showed same parse errors** — the new error format suffix `| Response start: ...` was missing, suggesting the fix didn't fully take effect.

**Phase 3 — Prefill attempt (commit `27ca52a`) — BROKE THE AGENT:**
Added prefill (`{ role: "assistant", content: "[" }`) + concrete example output. **Result: every developer returned 500 Internal Server Error.** Console showed `Unexpected token 'A', "A server e"...` — Vercel's HTML error page being parsed as JSON.

**Phase 4 — Rollback (commit `aab917e`):**
Reverted the prefill changes. **Surprise: 500 errors persisted.** The rollback file looked correct on disk, all greps confirmed prefill was gone, but production still 500-erroring.

**Phase 5 — ROOT CAUSE found (commit `4a439bc`):**
Investigated more carefully. Discovered that the "stronger prompt" added back in Phase 2 (commit `8cd4b04`) used **backtick characters around `[` and `]`** for emphasis. The system prompt itself is a JavaScript template literal wrapped in backticks. **Inner backticks prematurely terminated the template string, causing the entire file to fail JavaScript parsing at module load time.** Vercel returned HTML error pages because the function couldn't even load.

Fix: replaced ` `[` ` and ` `]` ` with `'['` and `']'` (single quotes). Verified with `node -c`. Single-character bug, hours of debugging.

**RESULT — AGENT WORKS:**
```
status      count    total_records_found    total_records_added
completed   17       50                     37
failed      3        0                      0
```

**85% success rate.** From 90% failure to 85% success in one evening. **37 new projects discovered and added** to PropPulse catalogue including Emaar, DAMAC, Aldar, Nakheel, Sobha, Meraas, Tiger Properties.

The 3 failures (Eagle Hills, Ellington, RAK) returned empty responses — Claude found nothing worth reporting. Acceptable failure mode, diagnosable for future tuning.

**Lessons documented for future:**
1. Never use backticks inside JavaScript template literals without escaping
2. Anthropic's prefill (`role: "assistant"`) is INCOMPATIBLE with `web_search` tool
3. Local dev (Vite) doesn't run Vercel serverless functions — must test on production URL
4. `node -c filename.js` is a quick syntax-check that would have caught the backtick bug instantly
5. Vercel "A server error has occurred" = function failed to load (different from runtime errors)

**Total cost of evening's diagnostic work:** ~$15 in Anthropic API credits. **Worth every penny** — agent now operational, infrastructure proven, narrative validated.

### What's working at end of 07 May 2026
- ✅ Supabase client centralized (single shared instance)
- ✅ PropPulse loads fast (auth-lock contention eliminated)
- ✅ Permissions module functional
- ✅ AI agent operational at 85% success rate
- ✅ 50 projects in PropPulse catalogue (vs 27 at start of day)
- ✅ Verification queue populated with newly discovered projects
- ✅ Error logging captures all failure modes for future diagnosis
- ✅ All work committed to GitHub on `main` branch
- ✅ Production deployed and verified working

### Still pending end of 07 May (now smaller list)
- ⚠️ Investor pitch slide could mention agent operational status (low priority — Data Roadmap deck handles this)
- ⚠️ Test data cleanup (low priority — explicitly deferred until product near-complete)
- ⚠️ Vercel cron schedule for automatic agent runs (recommendation: fortnightly, not nightly — saves $150-650/year vs nightly schedule)
- ⚠️ Naming decision still pending (Squadhelp/lawyer/defer)
- ⚠️ App.jsx 14,000+ line splitting (real tech debt, dedicated future session)
- ⚠️ 2 pre-existing bugs documented (can() undefined in 2 leasing files — fix when reactivating Leasing in Year 2 H2)
- ⚠️ The 3 agent failures (Eagle Hills, Ellington, RAK) returning empty responses — investigate next session if needed

### Golden tag
**`golden-2026-05-07`** at commit `4a439bc` — known-good state with working agent. Use `git checkout golden-2026-05-07` to return here if anything breaks.

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
