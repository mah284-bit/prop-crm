# PropPulse Improvement Backlog

**Prioritized roadmap for evolving PropPulse from current state to vision-complete.**
**Companion to PropPulse_Complete_Documentation.md**
**Date:** 04 May 2026
**For:** Abid Mirza, Founder, BFC

---

## How to use this doc

- Items grouped into 4 tiers by **impact-vs-effort**
- Each item has: effort estimate, dependencies, acceptance criteria, rationale
- Tiers respect your "no big bang" discipline — start with Tier 1, finish each tier before next
- This is **post-configurable-workflow priority** — Phase 1 of Broker Edition v1 (configurable workflows, ~7 hours) ships first, then this backlog

---

## TIER 1 — High Impact, Low Effort
*Ship in days. Foundational improvements, low risk.*

### T1.1 — Schedule the AI agent automatically ⭐ TOP PRIORITY

**What:** Replace manual button-click trigger with scheduled execution.

**Why this is #1:**
Currently, data freshness depends entirely on admin discipline. If you forget to click the button for 2 weeks, your catalogue ages 2 weeks. Brokers can't trust data they can't see being refreshed. This single change transforms PropPulse from "a database the admin maintains" to "a self-updating service."

**How:** Vercel Cron Jobs (free tier).

```javascript
// vercel.json
{
  "crons": [
    {
      "path": "/api/scheduled-collect-projects",
      "schedule": "0 2 * * *"  // Daily at 2 AM UAE time
    }
  ]
}

// /api/scheduled-collect-projects.js
// Loops through pp_developers, calls collect-projects-v2 internally for each
// Logs aggregate run results to pp_agent_jobs
// Can be triggered manually too (admin button still works)
```

**Effort:** 1-2 hours
**Dependencies:** None
**Acceptance:**
- Agent runs at 2 AM UAE time every day
- `pp_agent_jobs` shows daily entries
- Admin button still works for ad-hoc runs
- Errors emailed/logged for admin attention

**Strategic value:** ★★★★★ (data freshness is THE trust signal for brokers)

---

### T1.2 — Surface "last updated" badges in PropPulse UI

**What:** Show "Updated 2 days ago" / "Updated 14 days ago" on each project card and detail view.

**Why:** Brokers learn to trust fresh data and question stale data. Builds confidence in the catalogue. Prevents bad surprises ("oh, that price is from 6 months ago").

**How:**
```javascript
// In PropPulse.jsx project card render:
const daysSince = Math.floor(
  (Date.now() - new Date(p.pp_last_updated)) / (1000 * 60 * 60 * 24)
);
const freshnessColor = daysSince <= 7 ? "#1A7F5A" 
                     : daysSince <= 30 ? "#A06810" 
                     : "#B83232";
const freshnessLabel = daysSince === 0 ? "Today" 
                     : daysSince === 1 ? "Yesterday"
                     : daysSince <= 7 ? `${daysSince} days ago`
                     : daysSince <= 30 ? `${daysSince} days ago`
                     : `${Math.floor(daysSince/30)} mo ago`;
// Render with color coding
```

**Effort:** 30-60 minutes
**Dependencies:** None (data already exists in `pp_last_updated`)
**Acceptance:**
- Every project card shows freshness badge
- Color-coded: green (<7d), amber (7-30d), red (>30d)
- Detail view shows full timestamp on hover

**Strategic value:** ★★★★ (trust signal, low effort)

---

### T1.3 — Add filter dimensions brokers actually need

**What:** Extend filtering UI beyond current emirate/status/type/developer.

**Add filters for:**
- **Handover date range** (e.g., "Ready 2026-2027")
- **Price range** (e.g., "1M-3M AED")
- **Bedroom count** (when joined with project_units)
- **Service charge range** (cost-conscious investors care)

**Why:** Brokers immediately feel the catalogue is "complete" when they can find what they need. Currently search is fragile — broker has to think "where would this be?" rather than "what fits my buyer?"

**How:**
- Add controlled inputs above current filter row
- Extend `filteredProjects` filter logic
- Save filter preferences to localStorage per user

**Effort:** 2-4 hours
**Dependencies:** None
**Acceptance:**
- All 4 new filters work
- Combinable with existing filters
- Reset button clears all
- Selected filters reflect in URL (so brokers can bookmark "2BR Marina under 2M")

**Strategic value:** ★★★★ (broker daily-use feature)

---

### T1.4 — Admin alerting on agent failures

**What:** When agent run fails for a developer, surface it in admin UI (not just `console.warn`).

**Why:** Today, if Claude API has an outage or a developer's name was misspelled, the admin won't know. Silent failures decay catalogue completeness.

**How:**
- Add a notification badge to PropPulse admin tab when failed jobs exist in last 7 days
- Click → see list of failed agent runs from `pp_agent_jobs`
- Optionally: email/slack webhook on agent run completion summary

**Effort:** 2-3 hours
**Dependencies:** None
**Acceptance:**
- Failed agent runs visible to admin without opening DevTools
- Quick "retry" button per failed developer
- Optional notification webhook for slack/email

**Strategic value:** ★★★ (operational reliability)

---

## TIER 2 — High Impact, Medium Effort
*Ship in weeks. Real product improvements that close meaningful gaps.*

### T2.1 — Brochure + floor plan storage

**What:** Capture and store PDF brochures and floor plan PDFs per project.

**Why:** This is the #1 visible gap vs Reelly. Brokers SHOW brochures to clients during proposal conversations. Without them, they have to download from developer sites separately, breaking flow.

**How:**

Step A: Database
```sql
ALTER TABLE projects ADD COLUMN brochure_url text;
ALTER TABLE projects ADD COLUMN floor_plan_urls text[]; -- array of URLs
ALTER TABLE projects ADD COLUMN rendering_urls text[];
```

Step B: Storage
- Use Supabase Storage (already in your stack)
- Bucket structure: `proppulse-assets/<developer_id>/<project_id>/brochure.pdf`
- RLS: catalogue assets readable by all authenticated users

Step C: Agent enhancement
- Update `SYSTEM_PROMPT` in `collect-projects-v2.js` to ask Claude for brochure URLs when found
- Add field to JSON output schema
- After insert, fetch the PDF, upload to Storage, store Storage URL in DB

Step D: Manual upload UI
- Admin can upload brochures/floor plans for projects where agent didn't find them
- Drag-drop UI in project detail view

Step E: Display
- Project card → brochure thumbnail + "Download Brochure" button
- Floor plans → gallery view

**Effort:** 1-2 days
**Dependencies:** Supabase Storage configured (likely already done)
**Acceptance:**
- Agent attempts brochure URL discovery
- Admin can upload brochures manually
- Brokers can download brochures from project view
- Floor plans display as gallery

**Strategic value:** ★★★★★ (closes the biggest visible gap vs Reelly)

---

### T2.2 — Price history tracking

**What:** Track every change to `starting_price` over time.

**Why:** Two reasons:
1. **AI value:** Price history is gold for AI predictions ("Sobha typically raises prices 8% per quarter as construction progresses")
2. **Broker value:** Brokers can show "price was 1.2M in Jan, now 1.4M — strong appreciation, time to invest"

**How:**

```sql
CREATE TABLE pp_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  starting_price numeric,
  recorded_at timestamp DEFAULT now(),
  source text  -- 'ai_agent_v2', 'manual', etc.
);

-- Trigger: when projects.starting_price changes, insert history row
CREATE TRIGGER price_history_trigger 
AFTER UPDATE ON projects
FOR EACH ROW
WHEN (OLD.starting_price IS DISTINCT FROM NEW.starting_price)
EXECUTE FUNCTION insert_price_history();
```

UI: project detail → price history graph (Recharts already in your stack)

**Effort:** 4-6 hours
**Dependencies:** None
**Acceptance:**
- Every starting_price change creates audit row
- Project detail shows price-over-time graph
- AI Match factors price velocity into recommendations (future enhancement)

**Strategic value:** ★★★★ (unique differentiator, AI moat)

---

### T2.3 — Per-unit live availability tracking

**What:** Currently `project_units` table exists but per-unit availability isn't dynamically tracked. Make it live.

**Why:** Brokers MUST not propose already-sold units. Today, units in your catalogue are static. A unit sold 2 months ago still appears available.

**How (phased):**

Phase A: Add availability fields to `project_units`
```sql
ALTER TABLE project_units ADD COLUMN availability_status text DEFAULT 'unknown';
-- 'available' | 'reserved' | 'sold' | 'unknown'
ALTER TABLE project_units ADD COLUMN last_verified_at timestamp;
```

Phase B: Agent enhancement (asks Claude to find unit-level availability)

Phase C: Cron (more frequent than project-level — daily at minimum for "Under Construction" projects)

Phase D (advanced): Direct developer portal integrations
- Each major developer (Emaar, DAMAC, Sobha) has a broker portal with unit-level data
- Negotiate API access or scraping consent
- Sync daily

**Effort:** 1 week for Phase A-C, ongoing operational work for Phase D
**Dependencies:** None for A-C, business agreements for D
**Acceptance:**
- Units show clear "Available / Reserved / Sold" status
- Agent updates status during runs
- Brokers can't import/propose 'sold' units (UI prevents)

**Strategic value:** ★★★★★ (critical for not embarrassing brokers in front of clients)

---

### T2.4 — Bidirectional sync (catalogue ↔ tenant inventory updates)

**What:** When PropPulse catalogue updates a project, brokers who imported it can pull updates.

**Why:** Today, if a broker imports a project in March, and you update the catalogue in May (price change, status change), the broker's tenant copy stays at March data. They miss updates.

**How:**

UI flag in tenant inventory:
- "PropPulse has updates for this project — review changes?"
- Show diff between current tenant copy and catalogue
- Broker chooses: apply all / apply selected / ignore

This preserves customer data sovereignty (broker decides) while keeping data fresh.

**Effort:** 1-2 days
**Dependencies:** T1.1 (scheduled agent populating fresh catalogue data)
**Acceptance:**
- Broker sees "updates available" indicator in inventory
- Can review and apply selectively
- Imported projects don't go stale silently

**Strategic value:** ★★★★ (closes the data-staleness loop)

---

### T2.5 — Fuzzy name matching for dedup

**What:** Replace exact `ilike` name matching with fuzzy matching.

**Why:** "Sobha Hartland 2", "Sobha Hartland II", "Sobha Hartland Phase 2" all become separate catalogue entries today. Should be one.

**How:**
- Use `pg_trgm` extension (Postgres trigram similarity)
- Match if `similarity(name, target) > 0.7` AND same `pp_developer_id`
- For ambiguous matches (3 candidates above 0.7), surface to admin for resolution

**Effort:** 4-6 hours
**Dependencies:** Enable `pg_trgm` in Supabase
**Acceptance:**
- New agent runs don't create duplicate entries with name variations
- Admin tool to merge existing duplicates

**Strategic value:** ★★★ (data quality)

---

## TIER 3 — Vision-Level
*Ship in months. The "platform that grows with brokers" plays.*

### T3.1 — "Push to marketing sites" — Bayut/PF/Dubizzle/Skyloov outbound integration ⭐ THE VISION

**What:** From PropPlatform, broker creates a unit listing → one click publishes to all major UAE portals.

**Why:** This is the feature you described as your end-state vision. It's also the feature REM/Goyzer/Ruby use as their lock-in. Brokers list daily on portals; manual cross-posting is 2-3 hours/day. Solving this saves brokers 10-15 hours/week.

**How (per portal):**

**Step A: Business agreements**
Each portal requires:
- Broker partnership account
- API credentials issued to BFC
- Listing format compliance (each has different schema)
- Compliance review (Bayut TruCheck, PF SuperAgent verification, etc.)

Realistic timeline:
- Bayut: 2-4 months partnership setup
- Property Finder: 2-4 months
- Dubizzle: 2-3 months  
- Skyloov: 1-2 months (smaller, easier)

**Step B: Technical integration (per portal)**
- API client wrappers
- Listing format mapping (your data model → portal's schema)
- Lifecycle: publish → update → expire → republish
- Image hosting (each portal has rules)
- Lead inbound webhooks (when buyer contacts via Bayut, lead flows back into PropPlatform)

**Step C: UI**
- "Publish to Portals" button on listing detail
- Multi-select which portals
- Per-portal preview before submit
- Status tracking: "Live on Bayut, Pending PF review, Failed Dubizzle"
- Centralized lead inbox showing source portal

**Effort:**
- Bayut alone: 3-4 weeks engineering after business agreement
- Full 4-portal coverage: 4-6 months including agreements
- Plus ongoing: ~AED 5-10K/month for portal partnership fees and maintenance

**Dependencies:**
- Business agreements (the long pole)
- Likely funding for partnership negotiation + 1 dedicated engineer

**Acceptance:**
- Broker creates listing in PropPlatform
- Selects portals to publish to
- Listing appears on portal within minutes
- Leads from portal flow back into PropPlatform leads
- Single dashboard shows all listing performance across portals

**Strategic value:** ★★★★★ (this is THE feature that closes feature gap with REM and makes PropPlatform indispensable)

---

### T3.2 — Expand developer count (20 → 100+)

**What:** Scale from 20 fixed developers to 100+ over 12-18 months.

**Why:** 20 developers ≈ 10% of UAE active market. Brokers will ask for niche developers (Imtiaz, Select, Beverly Hills, smaller players). 100+ would cover ~80% of UAE off-plan.

**How:**

Phase A: Easy wins (existing agent works, just add to `pp_developers`)
- Add 30 more well-known developers
- Run agent, see what Claude finds
- Verify, iterate

Phase B: Direct relationships (operational work)
- Hire 1 data ops person dedicated to developer relationships
- Sign data partnership agreements with top 50 developers
- Get direct feeds where possible (replaces agent for those developers)
- Year 1 goal: 80 developers covered

Phase C: Long tail
- Open marketplace where smaller developers can self-register their projects
- Verification step before live in catalogue

**Effort:**
- Phase A: 1-2 weeks
- Phase B: ongoing, ~AED 25K/month for ops person
- Phase C: 1-2 months engineering, ongoing curation

**Dependencies:**
- Phase B requires funding for data ops hire

**Acceptance:**
- Phase A: 50 developers in `pp_developers`, agent producing some data for each
- Phase B: 80+ developers, top 30 with direct feeds
- Phase C: Self-service developer portal launched

**Strategic value:** ★★★★★ (closes the coverage gap that's the main reason brokers pick Reelly today)

---

### T3.3 — Federated data quality from tenant edits

**What:** When 10 brokers all import "Sobha Hartland II" and 5 of them update its commission rate to 12%, you can theoretically improve the catalogue with that signal.

**Why:** Right now, tenant edits stay in tenant inventory. But they're often more accurate than catalogue (brokers know their developer relationships). Aggregating these as "community signals" could make catalogue better than any single data source.

**How:**

```sql
-- Periodically aggregate tenant edits
SELECT pp_source_id, 
       AVG(commission_rate) as avg_tenant_commission,
       COUNT(DISTINCT company_id) as broker_count,
       MODE() WITHIN GROUP (ORDER BY starting_price) as mode_price
FROM projects
WHERE company_id IS NOT NULL  -- tenant inventory only
  AND pp_source_id IS NOT NULL  -- imported from PropPulse
GROUP BY pp_source_id
HAVING COUNT(DISTINCT company_id) >= 3;  -- need consensus

-- Surface to admin: "5 brokers say commission is 12%, catalogue says 10%"
-- Admin reviews and updates catalogue
```

**Effort:** 1 week for v1
**Dependencies:** Need at least 10+ paying brokerages using PropPulse for signal density
**Acceptance:**
- Admin sees "tenant consensus differs from catalogue" alerts
- Can apply community signal as catalogue update
- Catalogue accuracy improves over time

**Strategic value:** ★★★ (long-term moat, requires customer base)

---

### T3.4 — AI-assisted human verification

**What:** Claude helps the admin verify projects faster by suggesting matches, conflicts, and confidence reasons.

**Why:** As verification queue grows (100+ projects), admin time becomes bottleneck. AI can pre-screen.

**How:**
- Each unverified project gets a Claude analysis: "I'm 95% confident this matches existing project X based on developer + community + name similarity. Here's why: [reasons]"
- Admin sees: "Auto-approve" / "Manual review" / "Reject" recommendations
- Admin still has final say but moves through queue 5-10x faster

**Effort:** 4-6 hours
**Dependencies:** None
**Acceptance:**
- Verification queue shows AI recommendations per project
- Admin approves/rejects 50+ projects in same time as 10 today

**Strategic value:** ★★★ (operational scalability)

---

## TIER 4 — Architectural Cleanup
*Ship anytime. Quality wins, maintainability, prevents future pain.*

### T4.1 — `lib/supabase.js` refactor ⭐ DO THIS FIRST

**What:** Centralize the Supabase client into one file, import everywhere.

**Why:** Six components currently each create their own Supabase client (PropPulse, InventoryModule, LeasingLeads, LeasingModule, LeaseOpportunityDetail, ReportsModule). They fight over auth-token storage, causing the "Multiple GoTrueClient" warnings AND occasional auth-lock errors that hung your demo.

**How:**

```javascript
// /src/lib/supabase.js (new file)
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://ysceukgpimzfqixtnbnp.supabase.co";
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || "<fallback>";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);
```

Then in each of the 6 components, replace:
```javascript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const SUPABASE_URL = "...";
const SUPABASE_ANON = "...";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);
```

with:
```javascript
import { supabase } from "../lib/supabase";
```

**Effort:** 30-45 minutes (mechanical)
**Dependencies:** None
**Acceptance:**
- Console clean of "Multiple GoTrueClient" warnings
- No more "lock not released within 5000ms" errors
- All 6 components still work identically
- Single source of truth for Supabase client config

**Strategic value:** ★★★★★ (kills demo-breaking issue, professional console, easy fix)

---

### T4.2 — Schema documentation file

**What:** Write down your schema formally — what tables exist, what columns, what relationships, what RLS policies.

**Why:** Today, schema lives in Supabase + your head. Onboarding any new engineer costs hours of "what's this table for?" Critical IP undocumented.

**How:**
- Run `pg_dump --schema-only` against your Supabase
- Annotate with prose explanations
- Commit to `/docs/schema.md`

**Effort:** 2-3 hours
**Dependencies:** None
**Acceptance:**
- `/docs/schema.md` exists
- Covers all PropPulse tables + CRM tables + auth tables
- Includes RLS policies
- Includes ER diagram (mermaid syntax works)

**Strategic value:** ★★★★ (knowledge preservation, onboarding velocity)

---

### T4.3 — Agent error retry logic

**What:** When agent fails for a developer (transient Claude API error, network blip), automatically retry once after 30 seconds.

**Why:** Reduces silent partial-data scenarios. Most failures are transient.

**How:** Wrap the Claude call in retry-with-backoff utility.

**Effort:** 2 hours
**Dependencies:** None
**Acceptance:**
- Transient failures auto-recover
- Permanent failures (developer not found, API key invalid) fail fast as before

**Strategic value:** ★★ (operational reliability)

---

### T4.4 — Webhook system for catalogue changes

**What:** When PropPulse catalogue updates a project (price change, status change, new launch), fire an event.

**Why:** Other parts of system (AI Briefing, broker notifications) can react. "Sobha Hartland II just moved to Ready — your buyer Rajesh is interested."

**How:**
- Postgres LISTEN/NOTIFY on `projects` updates
- Edge function consumes events, dispatches to subscribers
- AI Briefing subscribes, surfaces in daily briefing

**Effort:** 1-2 days
**Dependencies:** None
**Acceptance:**
- AI Briefing surfaces project changes
- Brokers get notification when imported project changes status

**Strategic value:** ★★★ (compounds AI moat)

---

## SUGGESTED EXECUTION ORDER

If I were sequencing the next 6-12 months of work:

### Sprint 0 (this week, after broker meeting)
- **T4.1** lib/supabase.js refactor (30-45 min — kills demo issue)

### Sprint 1 (Week 1-2 after configurable workflows)
- **T1.1** Schedule the agent (1-2 hours)
- **T1.2** Last-updated badges (30-60 min)
- **T1.3** New filter dimensions (2-4 hours)

### Sprint 2 (Week 3-4)
- **T1.4** Admin agent failure alerting (2-3 hours)
- **T2.1** Brochure + floor plan storage (1-2 days)

### Sprint 3 (Week 5-6)
- **T2.2** Price history tracking (4-6 hours)
- **T2.5** Fuzzy name matching (4-6 hours)
- **T4.2** Schema documentation (2-3 hours)

### Month 2-3
- **T2.3** Per-unit availability (1 week + ongoing)
- **T2.4** Catalogue-tenant sync (1-2 days)
- **T3.4** AI-assisted verification (4-6 hours)

### Month 4-6 (with funding)
- **T3.1** Bayut integration (first portal)
- **T3.2** Phase A: 50 developers in catalogue

### Month 6-12 (with funding)
- **T3.1** Property Finder + Dubizzle integrations
- **T3.2** Phase B: 80 developers with direct relationships
- **T3.3** Federated data quality

---

## FINAL NOTES

**This backlog respects your discipline:**
- Each item independently shippable
- Each item builds on previous
- No big bang
- Compounds your AI + multi-tenant moat
- Customer value at every step

**Priorities reflect your stated vision:**
> *"I am giving you database, you pick by builder/area, move into your inventory, push to marketing sites."*

The first three steps work today. The fourth (push to portals) is the major Tier 3 build that closes the gap with REM and unlocks broker daily-use lock-in.

**Things explicitly NOT in this backlog (yet):**
- Mobile native apps — that's a Broker Edition v2 story, not PropPulse-specific
- WhatsApp integration — same, Broker Edition workstream
- AI improvements (deeper Briefing, Coach features) — separate AI roadmap

These are real, but they're cross-cutting concerns rather than PropPulse-specific.

---

*Generated 04 May 2026 alongside PropPulse_Complete_Documentation.md*

— Documented for Abid Mirza by Claude
