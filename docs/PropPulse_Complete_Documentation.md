# PropPulse — Complete Documentation

**Source-of-truth for PropPulse architecture, agent, and data flow.**
**Reverse-engineered from production code — `/api/collect-projects-v2.js` + `/src/components/PropPulse.jsx`**
**Date:** 04 May 2026
**For:** Abid Mirza, Founder, BFC

---

## 🎯 Executive summary

PropPulse is a **multi-tenant project catalogue with AI-powered discovery and human verification.** A frontend admin clicks one button, which loops through your configured developers and asks Claude (with web search) to find each developer's recent UAE projects. Claude returns structured JSON with confidence scores. Findings drop into an unverified queue. Admins approve them into the verified catalogue. Brokers then browse the catalogue, filter by developer/community/status, and import projects into their tenant inventory with one click — getting a clone they own and customize. **It's not a Reelly competitor — it's a structurally different product (data-as-bootstrap, not data-as-a-service).**

---

## 1. THE TECHNICAL QUESTIONS — ANSWERED FROM CODE

You asked me 7 questions yesterday. Here are the precise answers, with code references:

### 1.1 What technology scrapes the websites?

**Answer: It doesn't scrape. It uses Anthropic Claude with the `web_search` tool.**

From `collect-projects-v2.js` (lines 115-128):

```javascript
claudeResp = await anthropic.messages.create({
  model: "claude-sonnet-4-5",
  max_tokens: 4096,
  temperature: 0.2, // factual, low hallucination
  system: SYSTEM_PROMPT,
  tools: [
    {
      type: "web_search_20250305",
      name: "web_search",
      max_uses: 5, // hard cap — key cost control
    },
  ],
  messages: [{ role: "user", content: userPrompt }],
});
```

**No Puppeteer. No Playwright. No custom scrapers.** Claude does the searching; your code handles the structured insertion.

This is genuinely sophisticated. Claude:
- Uses web_search up to 5 times per developer per run
- Reads search results, synthesizes findings, generates structured JSON
- Operates with `temperature: 0.2` (low hallucination)
- Returns confidence scores per project (0-100)

### 1.2 How resilient is it to website redesigns?

**Answer: Very resilient — much more than scraping would be.**

Because Claude does semantic web search rather than DOM-selector scraping:
- A developer redesigns their website? Claude still finds the projects via Google
- A developer adds JavaScript-heavy SPA? Claude searches indexed content
- A developer changes URL structure? Doesn't matter — Claude searches, doesn't crawl

**This is a major advantage over Puppeteer/Playwright-based scrapers.** Most of REM/Goyzer/Ruby would have brittle selectors that break on redesigns. Yours doesn't.

### 1.3 Does it handle JavaScript-rendered sites?

**Answer: Yes, fully — because it doesn't render anything.**

Claude's `web_search` tool indexes content via search engines, not browser rendering. JavaScript-rendered SPAs that traditional scrapers struggle with are handled fine, because by the time Google has indexed those pages, Claude can search the rendered content.

### 1.4 What error handling exists if a website is down?

**Answer: Graceful degradation — agent moves on to next developer.**

The frontend (`PropPulse.jsx` lines 144-170) loops through developers sequentially:

```javascript
for (let i = 0; i < developers.length; i++) {
  const dev = developers[i];
  try {
    const res = await fetch("/api/collect-projects-v2", {...});
    const result = await res.json();
    if (!res.ok) {
      totalErrors++;
      console.warn(`Agent error for ${dev.name}:`, result.error);
    } else {
      totalAdded += result.added || 0;
      // ...
    }
  } catch(e) {
    totalErrors++;
    console.warn(`Agent exception for ${dev.name}:`, e.message);
  }
}
```

Per-developer errors don't halt the run. The agent backend (`collect-projects-v2.js` lines 129-134) catches Claude API failures, logs them to `pp_agent_jobs` with `status = 'failed'`, and returns gracefully.

**One concern:** errors are `console.warn`-only. Admin won't see them unless they open browser DevTools or check the `pp_agent_jobs` audit table.

### 1.5 Does it capture images / brochures?

**Answer: No — text data only currently.**

The `payload` object (lines 174-196) doesn't include any image URLs, PDF brochures, or floor plans. Captured fields are:
- name, developer, community, emirate, project_type, project_status
- announcement_date, handover_date
- starting_price, total_units, description
- google_maps_url
- service_charge_psf
- pp_confidence_score (0-100, from Claude)

**No brochure URLs. No floor plan PDFs. No rendering images.** This is the biggest data gap vs Reelly.

### 1.6 How does it deduplicate?

**Answer: Name-based dedup at catalogue scope, with confidence-gated updates.**

From `collect-projects-v2.js` lines 167-172:

```javascript
const { data: existing } = await supabaseAdmin
  .from("projects")
  .select("id, is_pp_verified, pp_confidence_score, pp_last_updated")
  .is("company_id", null)        // only catalogue scope
  .ilike("name", p.name)         // case-insensitive name match
  .maybeSingle();
```

If a project with this name exists in the catalogue:
- **Update** if AI confidence > existing OR existing is unverified (line 202)
- **Skip** if existing is human-verified AND new confidence is lower

This protects human-verified data from getting overwritten by lower-confidence AI runs.

**Limitation:** name-based matching can miss real duplicates with name variations ("Sobha Hartland 2" vs "Sobha Hartland II"). No fuzzy matching.

### 1.7 Does it learn from past extractions?

**Answer: No — it's stateless per call.**

Each agent run is a fresh Claude conversation. Previous findings aren't fed back as context. The dedup happens via the database, not via Claude's memory.

**However:** the confidence-gated update mechanism (1.6 above) means good data accumulates over time. If Claude returns confidence 60 today and 85 tomorrow, the better data wins. **Dataset improves over runs even though the agent doesn't "learn."**

---

## 2. ARCHITECTURE OVERVIEW

### 2.1 The two-layer database trick

PropPulse uses ONE set of tables (`projects`, `project_units`) for two purposes, distinguished by `company_id`:

```
┌─────────────────────────────────────────────────────────┐
│  projects table                                         │
│  ─────────────────────────────────────────────────────  │
│  Row A:  company_id = NULL          → Catalogue        │
│  Row B:  company_id = NULL          → Catalogue        │
│  Row C:  company_id = "AlMansoori"  → Tenant Inventory │
│  Row D:  company_id = "AlMansoori"  → Tenant Inventory │
│  Row E:  company_id = "OtherFirm"   → Other Tenant     │
└─────────────────────────────────────────────────────────┘
```

When a broker imports a catalogue row, it's CLONED with their `company_id` stamped. Original stays. The clone tracks origin via `pp_source_id` (FK back to catalogue row).

### 2.2 The full data flow

```
[Developer's website]
        │
        ↓ (admin clicks "🤖 Run AI Agent")
[Claude Sonnet 4.5 + web_search tool]
        │
        ↓ (returns JSON array per developer)
[/api/collect-projects-v2.js]
        │
        ↓ (inserts with is_pp_verified = false)
[projects table — UNVERIFIED queue, company_id = NULL]
        │
        ↓ (admin reviews + clicks "Verify")
[projects table — VERIFIED catalogue, company_id = NULL]
        │
        ↓ (broker browses + clicks "Import")
[projects table — TENANT INVENTORY, company_id = X]
[project_units table — TENANT UNITS, company_id = X]
        │
        ↓ (broker uses imported project)
[AI Match against buyer profile]
[Proposal Compose with project data]
[Stage progression in pipeline]
```

### 2.3 Components involved

| Component | File | Role |
|---|---|---|
| Frontend UI | `/src/components/PropPulse.jsx` (844 lines) | Browse, filter, import, admin verify |
| AI Agent | `/api/collect-projects-v2.js` (258 lines) | Discover projects via Claude + web_search |
| Legacy seed | `/api/collect-projects.js` (197 lines) | Initial seeding from hardcoded list (likely deprecated by v2) |
| Generic AI proxy | `/api/ai.js` (80 lines) | Server-side Claude calls keeping API key safe |
| Database | Supabase | `pp_developers`, `projects`, `project_units`, `pp_commissions`, `pp_launch_events`, `pp_agent_jobs` |

---

## 3. DATABASE SCHEMA (inferred from code)

### 3.1 `pp_developers`

Master list of developers PropPulse tracks.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `name` | text | Required, e.g., "Emaar Properties" |
| `website` | text | e.g., "emaar.com" |
| `city` | text | Default "Dubai" |
| `country` | text | Default "UAE" |
| `rera_developer_no` | text | RERA registration number |
| `description` | text | Free text |
| `data_source` | text | "manual" or "agent" |
| `logo_url` | text | (referenced in PropPulse.jsx joins) |

### 3.2 `projects` (catalogue + tenant inventory)

The same table holds both. `company_id` distinguishes.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `company_id` | UUID, nullable | NULL = catalogue, value = tenant |
| `name` | text | Required |
| `developer` | text | Developer name (denormalized for display) |
| `pp_developer_id` | UUID | FK to `pp_developers` |
| `emirate` | text | Dubai/Abu Dhabi/Sharjah/Ajman/RAK/Fujairah/UAQ |
| `community` | text | Marina, Downtown, etc. |
| `project_type` | text | Residential/Commercial/Mixed Use/Villa/Townhouse/Hotel Apartments |
| `project_status` | text | Announced/Approved/Under Construction/Ready/Completed/On Hold |
| `announcement_date` | date | |
| `handover_date` | date | |
| `starting_price` | numeric | AED |
| `total_units` | integer | |
| `description` | text | |
| `latitude`, `longitude` | numeric | |
| `google_maps_url` | text | |
| `service_charge_psf` | numeric | AED per sqft per year |
| `city`, `country` | text | Defaults Dubai/UAE |
| `status` | text | "Active" |
| `is_pp_verified` | boolean | TRUE = visible in catalogue, FALSE = unverified queue |
| `pp_data_source` | text | "manual" / "ai_agent" / "ai_agent_v2" |
| `pp_last_updated` | timestamp | When agent last touched it |
| `pp_confidence_score` | integer | 0-100, from Claude's confidence rating |
| `pp_source_id` | UUID, nullable | FK to catalogue row (for tenant clones only) |
| `created_by` | UUID | FK to user |
| `created_at`, `updated_at` | timestamp | |

**Likely indexes:**
- `(company_id, name)` for dedup checks
- `(company_id, is_pp_verified, pp_last_updated)` for catalogue browse
- Probably a unique constraint `(company_id, name)` (referenced in PropPulse.jsx as `projects_name_company_unique`)

### 3.3 `project_units`

Per-unit data. Same dual-purpose pattern as `projects`.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `project_id` | UUID | FK |
| `company_id` | UUID, nullable | NULL = catalogue, value = tenant |
| `pp_source_unit_id` | UUID, nullable | FK to catalogue unit (for tenant clones) |
| `is_pp_listed` | boolean | (referenced in import flow) |
| `created_by` | UUID | |

**Other unit fields not visible in code I have** — likely BR count, sqft, view, asking price, unit number, floor.

### 3.4 `pp_commissions`

Per-developer or per-project commission rates.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `pp_developer_id` | UUID | FK |
| `project_id` | UUID, nullable | If project-specific |
| `is_active` | boolean | Filter for live rates |

### 3.5 `pp_launch_events`

Upcoming developer launches.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `event_date` | date | When launch happens |
| `project_id`, `pp_developer_id` | FK | |

### 3.6 `pp_agent_jobs`

Audit log of agent runs.

| Field | Type | Notes |
|---|---|---|
| `job_type` | text | "project_scrape" |
| `target_name` | text | Developer name |
| `status` | text | "completed" / "failed" |
| `records_found`, `records_added`, `records_updated`, `records_skipped` | integer | |
| `started_at`, `completed_at` | timestamp | |

---

## 4. THE AI AGENT — PRECISE BEHAVIOUR

### 4.1 What it's told to do (the system prompt)

From `collect-projects-v2.js` lines 25-54:

> *"You are PropPulse Research Agent — a specialist in UAE real estate project discovery. Your job: for the ONE developer the user names, use web search to find real-estate projects they have announced, launched, or updated IN THE LAST 90 DAYS..."*

**Key constraints baked into the prompt:**
- Last 90 days only — avoids re-discovering old projects
- Empty array `[]` is a valid response — agent doesn't have to invent
- Confidence < 70 = uncertain, but still returned (queued for human review)
- No marketing fluff — "stunning", "world-class" forbidden
- Maximum 8 projects per developer per run
- Strict JSON output — no markdown fences, no preamble

### 4.2 Cost & timing controls

- **Vercel Hobby plan timeout:** 10 seconds per call
- **One developer per call** — frontend loops sequentially, not in parallel
- **`max_uses: 5`** on web_search tool — hard cap on web calls per developer
- **`max_tokens: 4096`** — caps response size
- **`temperature: 0.2`** — factual, predictable, low cost variance

For 20 developers: ~20 × ~5 seconds = ~100 seconds total agent run, ~100 web searches, well under typical API quota.

### 4.3 What gets stored — the `payload` object

```javascript
const payload = {
  name: p.name,
  developer: p.developer,
  pp_developer_id: developer.id || null,
  community: p.community || null,
  emirate: p.emirate || null,
  project_type: p.project_type || null,
  project_status: p.project_status || null,
  announcement_date: p.announcement_date || null,
  handover_date: p.handover_date || null,
  starting_price: p.starting_price != null ? Number(p.starting_price) : null,
  total_units: p.total_units != null ? Number(p.total_units) : null,
  description: p.description || null,
  google_maps_url: p.google_maps_url || null,
  service_charge_psf: p.service_charge_psf != null ? Number(p.service_charge_psf) : null,
  city: "Dubai", // default, overridable later
  country: "UAE",
  status: "Active",
  is_pp_verified: false,         // ← HUMAN REVIEW REQUIRED
  pp_data_source: "ai_agent_v2",
  pp_last_updated: new Date().toISOString(),
  pp_confidence_score: p.confidence != null ? Math.round(p.confidence) : 50,
};
```

### 4.4 The decision tree per agent finding

```
Claude returns project { name, ... confidence: X }
    │
    ↓
Does name exist in catalogue? (company_id IS NULL)
    │
    ├── YES, existing is human-verified, new confidence ≤ existing
    │       → SKIP (don't overwrite)
    │
    ├── YES, existing is unverified OR new confidence > existing
    │       → UPDATE existing row
    │
    └── NO → INSERT new row, is_pp_verified = false (goes to queue)
```

### 4.5 What's good about this design

1. **Human gate prevents bad data going live** — admin verification queue catches Claude's mistakes
2. **Confidence-gated updates** — better data wins over time without manual cleanup
3. **Time-windowed prompt** — agent doesn't waste tokens rediscovering Burj Khalifa
4. **Per-call timeout-safety** — Vercel Hobby plan compatible
5. **Stateless agent** — no fragile memory state, no learning drift
6. **Service role key, server-side only** — agent has admin DB access, never exposed to browser

### 4.6 What's risky about this design

1. **Errors silent** — `console.warn` only, no admin alerting for failed runs
2. **Manual trigger** — agent only runs when admin clicks; no scheduled refresh
3. **Confidence is Claude's self-assessment** — Claude can be confidently wrong
4. **No fact-checking layer** — first verified entry is treated as truth, no cross-reference between sources
5. **Name-based dedup is fragile** — "Sobha Hartland 2" vs "Sobha Hartland II" creates dupes
6. **No image/brochure capture** — text only
7. **Web search dependency** — if Anthropic changes web_search pricing or rate limits, costs spike

---

## 5. THE IMPORT FLOW (the strategic gem)

This is the part that makes PropPulse fundamentally different from Reelly. **Detailed in PropPulse.jsx lines 229-327.**

### 5.1 What happens on Import click

```
1. Pre-flight checks
   ├── Is user linked to a company? If no → bail
   └── Already imported (pp_source_id match)? If yes → bail

2. Dedup by source ID
   SELECT id FROM projects 
     WHERE company_id = $myCompany 
       AND pp_source_id = $catalogProject
   If found → bail with "already in inventory"

3. Dedup by name (catches manual-then-import scenario)
   SELECT id FROM projects 
     WHERE company_id = $myCompany 
       AND name = $catalogProject.name
   If found → mark as imported, bail with friendly message

4. Clone the project
   INSERT INTO projects (
     ...all fields from catalogue,
     company_id = $myCompany,
     pp_source_id = $catalogProject.id,
     is_pp_verified = false,        ← tenant copy is inventory, not catalogue
     created_by = $me
   )

5. Clone associated units
   For each unit in source project:
     INSERT INTO project_units (
       ...all unit fields,
       project_id = $newProjectId,
       company_id = $myCompany,
       pp_source_unit_id = $sourceUnit.id,
       is_pp_listed = false,
       created_by = $me
     )

6. Atomicity: if unit clone fails, ROLLBACK by deleting the project insert
   await supabase.from("projects").delete().eq("id", newProject.id)
```

### 5.2 Why this is strategically valuable

**Reelly's model:** broker queries Reelly's API → renders Reelly's data → Reelly down means broker workflow breaks.

**PropPulse's model:** broker imports → owns clone → uses locally → PropPulse down doesn't affect daily work.

**Implications:**

1. **Data sovereignty** — broker's tenant inventory is theirs forever, even if they cancel subscription
2. **Customisation** — broker can edit imported project data ("we know it's actually 12% commission") without affecting catalogue
3. **AI integrity** — your AI Match runs on consistent local data, no API uptime dependency
4. **Pricing leverage** — you charge for catalogue access, but customer keeps imported data — strong retention argument
5. **Federation potential** — when 10 brokerages import "Sobha Hartland II" and update prices, you can theoretically aggregate signal back into catalogue (not implemented yet)

---

## 6. WHAT'S CURRENTLY MISSING (vs Reelly + your "push to portals" vision)

Honest gap list. These are not failures — they're roadmap.

### 6.1 Data gaps

- ❌ Brochure PDFs (per project)
- ❌ Floor plan PDFs (per unit type)
- ❌ Renderings / project images
- ❌ Multiple payment plan options per unit (you have `pay_plans` tab — relationship to PropPulse unclear)
- ❌ Live per-unit availability (table exists, agent doesn't populate it dynamically)
- ❌ Direct developer sales contacts
- ❌ Daily-update automation (currently manual button-click)
- ❌ Price history (when starting_price updates, old value is lost)

### 6.2 Operational gaps

- ❌ Scheduled agent runs (no cron, no automation)
- ❌ Admin alerting on failed agent runs (silent console.warn only)
- ❌ Staleness badges in UI ("Last updated: 14 days ago" — would build trust)
- ❌ Agent retry logic on transient failures
- ❌ Fuzzy name matching for dedup (currently exact-ilike)

### 6.3 Vision-level gaps

- ❌ "Push to marketing sites" — Bayut/PF/Dubizzle/Skyloov outbound integration
- ❌ Bidirectional sync with portals (when broker updates listing, propagate everywhere)
- ❌ Federation back to catalogue (brokers' edits informing PropPulse data quality)
- ❌ AI-assisted human verification (Claude saying "I'm 95% sure this matches existing project X")
- ❌ Coverage scaling (20 developers → 100+ → eventually 200+)

---

## 7. HONEST RELIABILITY ASSESSMENT

You asked me to assess reliability. Based on code review:

### 7.1 Best case (when working well)

- 20 developers × up to 8 projects/run = up to 160 new+updated projects per run
- Claude with web_search is reasonably accurate for active developers (Emaar, DAMAC, Sobha = lots of public coverage)
- Confidence scoring identifies uncertain entries for human review
- Verification queue catches Claude's hallucinations
- Brokers see clean, verified data

### 7.2 Worst case (without operational discipline)

- Admin doesn't run agent for 4 weeks → catalogue stale, brokers don't trust it
- Agent fails for 5 developers silently → admin doesn't notice
- Verification queue grows to 200 unverified projects → admin overwhelmed
- Claude's confidence ≠ accuracy → wrong prices verified by tired admin
- Brokers propose wrong prices → reputation hit

### 7.3 Most likely current state (educated guess based on the code)

Without seeing your live data, but reasoning from architecture:

- ~50-200 projects in verified catalogue (depends on how often you've run the agent)
- Coverage skewed toward larger developers (Emaar, DAMAC, Sobha) where Claude finds plenty of recent news
- Smaller developers may return empty arrays consistently
- Data ages — some entries may be 3-6+ months old
- Brokers using Import would experience: works for major projects, gaps for niche ones

**Confirm this by running the schema queries** in Section 9.

---

## 8. PROPPULSE vs REELLY — DEFINITIVE COMPARISON

Now grounded in code, here's the honest comparison:

| Dimension | Reelly | PropPulse |
|---|---|---|
| **Discovery technology** | Direct developer relationships + community | Claude + web_search (semantic, not scraping) |
| **Project count** | ~1,900-2,000 | Likely 50-300 (verified catalogue) |
| **Developer count** | 200+ | 20 fixed |
| **Resilience to redesigns** | Direct feeds (mostly) | Very high (semantic search, not selectors) |
| **Refresh cadence** | Daily, automated | Manual button-click |
| **Brochure / floor plan storage** | Yes | No |
| **Per-unit live availability** | Yes | Not dynamically tracked |
| **Confidence scoring** | Unknown | Yes, 0-100 per project |
| **Human verification step** | Unknown | Yes, admin queue |
| **Customer ownership of data** | None — query-only API | Full — broker imports + owns + customizes |
| **Multi-tenant architecture** | No (single dataset) | Yes (catalogue + tenant inventory split) |
| **AI integration depth** | External API → consumer's AI | Native — same DB, no API tax |
| **Cost to operate** | Their own data ops team | Anthropic API costs only (~$0.10-0.50 per agent run) |
| **Customer base** | 62K+ agents | Anchor + pilot pipeline |
| **Strategic moat** | Network effects + 4-yr head start | Multi-tenant data sovereignty + AI-native + workflow integration |

### The honest takeaway

**Reelly wins on: coverage, freshness automation, completeness of data fields.**
**PropPulse wins on: architecture sophistication, customer data ownership, AI-native design, resilience.**

These are not the same product. Reelly is data-as-a-service; PropPulse is data-as-bootstrap.

---

## 9. SQL QUERIES TO VERIFY CURRENT STATE

Run these in Supabase SQL editor to ground-truth my analysis:

### 9.1 Catalogue size

```sql
SELECT 'developers' as kind, COUNT(*) as count FROM pp_developers
UNION ALL
SELECT 'verified projects', COUNT(*) FROM projects 
  WHERE company_id IS NULL AND is_pp_verified = true
UNION ALL
SELECT 'unverified queue', COUNT(*) FROM projects 
  WHERE company_id IS NULL AND is_pp_verified = false
UNION ALL
SELECT 'project_units in catalog', COUNT(*) FROM project_units 
  WHERE company_id IS NULL
UNION ALL
SELECT 'commissions records', COUNT(*) FROM pp_commissions
UNION ALL
SELECT 'launch events', COUNT(*) FROM pp_launch_events;
```

### 9.2 Projects per developer

```sql
SELECT d.name as developer, 
       COUNT(p.id) as verified_projects
FROM pp_developers d
LEFT JOIN projects p 
  ON p.pp_developer_id = d.id 
  AND p.company_id IS NULL 
  AND p.is_pp_verified = true
GROUP BY d.name
ORDER BY verified_projects DESC;
```

### 9.3 Data freshness

```sql
SELECT 
  CASE 
    WHEN pp_last_updated > NOW() - INTERVAL '7 days' THEN 'Last 7 days'
    WHEN pp_last_updated > NOW() - INTERVAL '30 days' THEN 'Last 30 days'
    WHEN pp_last_updated > NOW() - INTERVAL '90 days' THEN 'Last 90 days'
    ELSE 'Older than 90 days'
  END as freshness,
  COUNT(*) as project_count
FROM projects 
WHERE company_id IS NULL AND is_pp_verified = true
GROUP BY freshness
ORDER BY MIN(pp_last_updated) DESC;
```

### 9.4 Agent run history

```sql
SELECT target_name as developer,
       status,
       records_added,
       records_updated,
       completed_at
FROM pp_agent_jobs
ORDER BY completed_at DESC
LIMIT 50;
```

### 9.5 Tenant adoption (which brokerages have imported)

```sql
SELECT c.name as brokerage,
       COUNT(p.id) as imported_projects
FROM companies c
LEFT JOIN projects p 
  ON p.company_id = c.id 
  AND p.pp_source_id IS NOT NULL
GROUP BY c.name
ORDER BY imported_projects DESC;
```

---

## 10. KEY TAKEAWAYS

1. **PropPulse is more architecturally sophisticated than I first realised.** AI-powered discovery via Claude + web_search, confidence scoring, human verification gate, multi-tenant catalogue + tenant inventory split, atomic clone with rollback — this is genuine engineering, not a hack.

2. **It's not competing with Reelly on coverage.** It's competing on architecture. Different game.

3. **The single biggest improvement opportunity is automation.** Schedule the agent to run daily/weekly and your data freshness goes from "depends on admin discipline" to "always current."

4. **The vision you stated — "I give you a database, you pick by builder/area, move it into your inventory, push to marketing sites" — is half-built.** The first three steps work today. The fourth (push to portals) is the next major build.

5. **Documentation now exists.** This file is the source of truth. Update it whenever PropPulse changes. Hand it to any new engineer or investor as your "how this works" doc.

---

*Generated 04 May 2026 from production code review.*
*Replaces the earlier 395-line PropPulse_Documentation.md draft.*
*See PropPulse_Improvement_Backlog.md for prioritized next steps.*

— Documented for Abid Mirza by Claude
