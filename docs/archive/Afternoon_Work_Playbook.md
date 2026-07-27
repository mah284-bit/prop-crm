# Afternoon Work Playbook — PropPlatform

**Purpose:** Four high-value tasks in execution order. Each task is independent — if you finish one and stop, the others don't break. Concrete steps, expected outputs, rollback plans.

**Created:** 04 May 2026
**Estimated total time:** 30 minutes (Task 1+2) to 4 hours (all four)
**Recommended order:** As listed below — earlier tasks unblock later ones.

---

## TASK 1 — Save & commit all documentation
**Time:** 10 minutes  
**Difficulty:** Trivial  
**Why first:** Insurance. Lock today's work into the repo before anything else.

### Steps

1. **Open File Explorer →** navigate to `D:\prop-crm\docs\`

2. **Download these 11 files from this chat into that folder:**
   - `README.md`
   - `FOUNDER_CONTEXT.md`
   - `PropPulse_Complete_Documentation.md`
   - `PropPulse_Improvement_Backlog.md`
   - `Component_Inventory.md`
   - `PropPlatform_Investor_Pitch.pptx`
   - `PropPlatform_Broker_Pitch.pptx`
   - `PropPlatform_Internal_Roadmap.pptx`
   - `PropPlatform_Executive_Summary.docx`
   - `PropPlatform_vs_REM.docx`
   - (Existing) `PropPulse_Demo_Script.md` should already be there

3. **Open terminal/PowerShell:**
   ```bash
   cd D:\prop-crm
   git status
   ```
   You should see all the new files in `docs/` listed as untracked.

4. **Stage, commit, push:**
   ```bash
   git add docs/
   git commit -m "Add complete documentation suite — strategy, decks, PropPulse technical"
   git push
   ```

5. **Verify on GitHub** — visit `github.com/mah284-bit/prop-crm/tree/main/docs` and confirm all files are visible.

### Expected outcome
- `docs/` folder on GitHub contains 11+ files
- README.md renders nicely as the folder index
- You can never lose today's work again

### Rollback if something goes wrong
Nothing to rollback. Adding files to `/docs` doesn't affect any code. If you accidentally commit something wrong, just `git revert HEAD && git push`.

---

## TASK 2 — Run the 5 PropPulse SQL queries in Supabase
**Time:** 15-30 minutes  
**Difficulty:** Easy  
**Why second:** Ground-truth what's actually in PropPulse today. Answers 6 open questions. Every future PropPulse decision becomes more grounded.

### Steps

1. **Open Supabase dashboard:**
   - Go to `app.supabase.com`
   - Select your `prop-crm` / `ysceukgpimzfqixtnbnp` project
   - Left sidebar → **SQL Editor** → "New query"

2. **Run Query 1 — Catalogue size:**
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
   **Save the output as a screenshot or CSV.** Numbers tell you actual coverage.

3. **Run Query 2 — Schema info (confirms field types):**
   ```sql
   SELECT 
     table_name, 
     column_name, 
     data_type, 
     is_nullable,
     column_default
   FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name IN ('pp_developers','projects','project_units','pp_commissions','pp_launch_events')
   ORDER BY table_name, ordinal_position;
   ```
   This is the schema dump for documentation. **Save as CSV** — paste into a new file `docs/Schema_Reference.md` later.

4. **Run Query 3 — Projects per developer:**
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
   **Tells you which developers are well-covered, which are empty.** Empty ones = either agent never run for them, or agent runs return nothing.

5. **Run Query 4 — Data freshness:**
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
   **Tells you how stale your catalogue is.** If most projects are >30 days old, scheduling the agent (Task 4) becomes urgent.

6. **Run Query 5 — Agent run history:**
   ```sql
   SELECT 
     target_name as developer,
     status,
     records_added,
     records_updated,
     completed_at
   FROM pp_agent_jobs
   ORDER BY completed_at DESC
   LIMIT 50;
   ```
   **Tells you when agent last ran, what it found, what failed.** Reveals if agent has ever broken silently.

7. **Bonus Query 6 — Tenant adoption:**
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
   **Tells you whether brokers are actually using PropPulse Import.** If Al Mansoori has 0 imported, the feature is dormant.

8. **Document the answers** in a new file `docs/PropPulse_Current_State.md`:
   ```markdown
   # PropPulse Current State — [DATE]
   
   ## Catalogue size
   - Developers configured: __
   - Verified projects: __
   - Unverified queue: __
   - Project units in catalog: __
   - Commission records: __
   - Launch events: __
   
   ## Coverage by developer
   [Paste Query 3 results]
   
   ## Data freshness
   [Paste Query 4 results]
   
   ## Agent reliability
   - Most recent successful run: __
   - Total runs to date: __
   - Failures in last 30 days: __
   
   ## Tenant adoption
   - Brokerages who have imported: __
   - Most active broker: __
   ```

### Expected outcome
- 6 open questions about PropPulse answered with real numbers
- New `Schema_Reference.md` doc captures the actual database schema
- New `PropPulse_Current_State.md` captures today's reality
- Both committed to `/docs`

### Rollback if something goes wrong
- Queries are read-only `SELECT` statements. Cannot break anything.
- If a query fails, the table likely doesn't exist or has a different name. Check Supabase Table Editor → Tables to verify table names match.

---

## TASK 3 — lib/supabase.js refactor
**Time:** 30-45 minutes  
**Difficulty:** Mechanical (no logic changes)  
**Why third:** Kills the "Multiple GoTrueClient" warnings + auth-lock errors that hung your demo. Clean console for tomorrow's broker meeting.

### Background
Six components currently each create their own Supabase client at module-load time. They fight over the same auth-token storage key. Centralising into one file fixes this permanently.

### Pre-flight check

1. **Verify you're at the right starting point:**
   ```bash
   cd D:\prop-crm
   git status
   ```
   Should be clean (everything from Task 1 already committed).

2. **Create a new branch** so you can review before merging:
   ```bash
   git checkout -b refactor/centralize-supabase-client
   ```

### Steps

1. **Create the new file** `D:\prop-crm\src\lib\supabase.js`:

   ```javascript
   // src/lib/supabase.js
   // Single Supabase client shared across all components.
   // Eliminates "Multiple GoTrueClient instances" warnings and
   // auth-token contention errors.
   
   import { createClient } from "@supabase/supabase-js";
   
   const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://ysceukgpimzfqixtnbnp.supabase.co";
   const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
   
   if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
     console.error("Supabase env vars missing — check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY");
   }
   
   export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
   ```

2. **Find all files that currently create their own Supabase client.** From terminal:
   ```bash
   cd D:\prop-crm
   grep -rn "createClient" src/components/ --include="*.jsx"
   ```
   You should see 6 files (or so):
   - `PropPulse.jsx`
   - `InventoryModule.jsx`
   - `LeasingLeads.jsx`
   - `LeasingModule.jsx`
   - `LeaseOpportunityDetail.jsx`
   - `ReportsModule.jsx`

3. **Refactor each file the same way.** For each component:

   **REMOVE these lines (typically near top of file):**
   ```javascript
   import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
   // OR
   import { createClient } from "@supabase/supabase-js";
   
   const SUPABASE_URL = "https://ysceukgpimzfqixtnbnp.supabase.co";
   const SUPABASE_ANON_KEY = "<long-key-here>";
   const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
   ```

   **REPLACE with this single line:**
   ```javascript
   import { supabase } from "../lib/supabase";
   ```

4. **Test locally before committing:**
   ```bash
   npm run dev
   ```
   Open browser → DevTools → Console.
   - **Before refactor:** "Multiple GoTrueClient instances detected" warnings
   - **After refactor:** Clean console, no warnings
   - **Functionality:** Click around the app — login, inventory, PropPulse, leasing — everything should work identically

5. **If anything breaks:**
   - Most likely cause: typo in the import path. `../lib/supabase` should resolve to `src/lib/supabase.js` from any `src/components/*.jsx` file. If your component is nested deeper (e.g., `src/components/leasing/Foo.jsx`), use `../../lib/supabase`.
   - Second-most likely: a component uses `supabase` for something the new file doesn't expose. Check that the import paths match.

6. **Commit and merge:**
   ```bash
   git add src/lib/supabase.js src/components/
   git commit -m "Centralize Supabase client into src/lib/supabase.js — fixes Multiple GoTrueClient warnings"
   git checkout main
   git merge refactor/centralize-supabase-client
   git push
   ```

7. **Verify on Vercel deploy:**
   - Vercel should auto-deploy the push
   - Open the live site → DevTools → Console
   - Confirm no "Multiple GoTrueClient" warnings
   - Test login, PropPulse browse, inventory — everything should work

### Expected outcome
- New `src/lib/supabase.js` exists, single source of truth
- 6 component files import from it instead of creating their own client
- Console clean of GoTrueClient warnings
- No auth-lock errors during demos

### Rollback if something goes wrong
You're on a branch, so:
```bash
git checkout main
git branch -D refactor/centralize-supabase-client
```
Nothing on `main` was touched.

If you've already merged and discover a bug:
```bash
git revert HEAD
git push
```
Or restore the golden tag:
```bash
git checkout golden-pre-stages -- src/components/
git commit -m "Revert: restore pre-refactor component files"
git push
```

---

## TASK 4 — Schedule the AI agent (Vercel Cron)
**Time:** 1-2 hours  
**Difficulty:** Medium  
**Why fourth:** Transforms PropPulse from "manual database admin maintains" to "self-updating service." Highest leverage operational improvement.

### Background
Today, the AI agent only runs when admin clicks the "🤖 Run AI Agent" button in PropPulse UI. With Vercel Cron (free tier), it can run automatically on schedule.

### Architecture decision (do once before building)

The current `/api/collect-projects-v2` accepts ONE developer per call (Vercel Hobby 10s timeout safety). Your frontend loops through 20 developers sequentially.

For cron, you have two options:

**Option A — One cron job that loops developers internally**
- Pros: simpler architecture, single cron entry
- Cons: must complete all 20 developers in 10s — too risky on Hobby plan

**Option B — One cron job per developer**
- Pros: respects 10s timeout, isolates failures
- Cons: 20 cron entries (Vercel Hobby allows only 2 cron jobs!)

**Option C — One scheduler cron + queue pattern**
- Pros: works on Hobby plan, scalable
- Cons: more code

**Option D — Upgrade to Vercel Pro** (if you can afford ~$20/month)
- Pros: 60s timeout, unlimited cron jobs, simplest path
- Cons: cost

### Recommended: Option C (queue pattern)

Implementation below assumes Hobby plan. If you upgrade to Pro, switch to Option A (much simpler).

### Steps

1. **Create the scheduler endpoint** `D:\prop-crm\api\scheduled-collect.js`:

   ```javascript
   // api/scheduled-collect.js
   // Triggered by Vercel Cron daily at 02:00 UAE.
   // Picks the developer least-recently-scraped and triggers v2 collection.
   // Designed to run within the 10s Hobby plan timeout.
   
   import { createClient } from "@supabase/supabase-js";
   
   const supabaseAdmin = createClient(
     process.env.VITE_SUPABASE_URL,
     process.env.SUPABASE_SERVICE_ROLE_KEY
   );
   
   export default async function handler(req, res) {
     // Vercel Cron sends GET with a special header. Verify it's a cron request.
     const authHeader = req.headers.authorization;
     if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
       return res.status(401).json({ error: "Unauthorized" });
     }
     
     // Find developer with oldest pp_last_updated (or never updated)
     const { data: dev, error } = await supabaseAdmin
       .from("pp_developers")
       .select("id, name")
       .order("pp_last_collected_at", { ascending: true, nullsFirst: true })
       .limit(1)
       .single();
     
     if (error || !dev) {
       console.error("No developer found:", error);
       return res.status(500).json({ error: "No developer to scrape" });
     }
     
     // Call collect-projects-v2 internally
     const baseUrl = process.env.VERCEL_URL 
       ? `https://${process.env.VERCEL_URL}` 
       : "http://localhost:3000";
     
     const collectRes = await fetch(`${baseUrl}/api/collect-projects-v2`, {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify({ developer_id: dev.id }),
     });
     
     const result = await collectRes.json();
     
     // Update last-collected timestamp
     await supabaseAdmin
       .from("pp_developers")
       .update({ pp_last_collected_at: new Date().toISOString() })
       .eq("id", dev.id);
     
     return res.status(200).json({
       developer: dev.name,
       result,
       cron_run_at: new Date().toISOString(),
     });
   }
   ```

2. **Add `pp_last_collected_at` column to `pp_developers`** (run in Supabase SQL editor):
   ```sql
   ALTER TABLE pp_developers 
     ADD COLUMN IF NOT EXISTS pp_last_collected_at timestamp;
   ```

3. **Set up CRON_SECRET environment variable in Vercel:**
   - Generate a random secret: `openssl rand -hex 32` or any random 64-char string
   - Vercel dashboard → Project → Settings → Environment Variables
   - Name: `CRON_SECRET`, Value: (your generated secret), Environments: Production + Preview + Development
   - Save

4. **Create or update `vercel.json` in repo root:**
   ```json
   {
     "crons": [
       {
         "path": "/api/scheduled-collect",
         "schedule": "0 22 * * *"
       }
     ]
   }
   ```
   `0 22 * * *` = daily at 22:00 UTC = 02:00 UAE time.
   
   With 20 developers and 1 run per day, each developer gets refreshed every 20 days. If you want faster, run hourly (`0 * * * *`) — that gives each developer ~28 refreshes per month. **Watch your Anthropic API costs.**

5. **Deploy:**
   ```bash
   git add api/scheduled-collect.js vercel.json
   git commit -m "Add scheduled collection cron — daily PropPulse agent runs"
   git push
   ```
   Vercel auto-deploys.

6. **Verify the cron is registered:**
   - Vercel dashboard → Project → Settings → Cron Jobs
   - Should see `/api/scheduled-collect` listed with the schedule
   - First execution will be at the next 22:00 UTC

7. **Test it manually before waiting for cron:**
   ```bash
   curl -X GET "https://prop-crm-two.vercel.app/api/scheduled-collect" \
     -H "Authorization: Bearer YOUR_CRON_SECRET_HERE"
   ```
   Should return JSON with the developer that got scraped + agent results.

8. **Monitor the next 24 hours:**
   - Check `pp_agent_jobs` table for new daily entries
   - Check `pp_developers.pp_last_collected_at` is updating
   - Check Anthropic API usage to confirm costs are sensible

### Expected outcome
- Cron runs daily at 02:00 UAE time
- One developer per night gets refreshed
- Catalogue gradually self-updates over a 20-day cycle
- `pp_last_updated` on projects stays fresh
- No more manual button-click required

### Rollback if something goes wrong
1. **Disable the cron** by removing the entry from `vercel.json`:
   ```json
   { "crons": [] }
   ```
   Commit + push. Cron stops within minutes.

2. **Delete the endpoint** if needed:
   ```bash
   rm api/scheduled-collect.js
   git add -A
   git commit -m "Revert: remove scheduled collection"
   git push
   ```

3. **Manual button still works** the entire time — nothing about cron breaks the existing flow.

---

## EXECUTION ORDER & DECISIONS

### Recommended sequencing

| Order | Task | Time | When to do |
|---|---|---|---|
| 1 | Save & commit docs | 10 min | Right now — protects today's work |
| 2 | Run SQL queries | 15-30 min | Right after — quick wins, answers open questions |
| 3 | lib/supabase.js refactor | 30-45 min | Before SEM meeting — clean console matters |
| 4 | Schedule the agent | 1-2 hours | After SEM meeting — bigger commitment |

### Stopping points

- **After Task 1:** Documentation is permanent and recoverable. You can stop here with no regret.
- **After Task 2:** You know the actual state of PropPulse. Useful for tomorrow's broker conversation.
- **After Task 3:** Code quality improvement, demo-ready. Great stopping point before SEM.
- **After Task 4:** PropPulse is now a self-updating service. Major operational milestone.

### Total time estimate

- **Minimum (Tasks 1+2):** 30 minutes — locks in today's work + grounds future decisions
- **Recommended (Tasks 1+2+3):** ~90 minutes — adds clean codebase
- **Maximum (all four):** ~3-4 hours — full afternoon, you ship a major feature

---

## QUICK REFERENCE — common commands

```bash
# Check what's changed
git status

# See branches
git branch

# Switch to main
git checkout main

# Pull latest
git pull

# Run dev server
npm run dev

# Build production
npm run build

# Restore a file from golden tag
git checkout golden-pre-stages -- path/to/file
```

---

## WHEN YOU GET STUCK

Each task has a specific failure mode. Quick troubleshooting:

**Task 1 — Git push fails:**
- "Permission denied" → `git remote -v` to check remote URL is correct
- "Updates were rejected" → `git pull --rebase` first, then push

**Task 2 — SQL query fails:**
- "relation does not exist" → table name wrong; check Supabase Table Editor for actual names
- Empty results → table exists but no rows; that's a finding, not an error

**Task 3 — Refactor breaks something:**
- App won't load → typo in import path; check `../lib/supabase` resolves correctly
- Auth doesn't work → env vars missing; check `.env` has `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- Specific feature breaks → that component used Supabase differently; revert that one file, debug

**Task 4 — Cron doesn't run:**
- Cron not visible in Vercel → `vercel.json` not in repo root, or syntax error
- 401 unauthorized → `CRON_SECRET` env var mismatch
- Agent fails → check `pp_agent_jobs` table for error message

---

*Each task is independent. Skip any. Stop at any point. Today's work is already saved.*

— Playbook for Abid Mirza · BFC · 04 May 2026
