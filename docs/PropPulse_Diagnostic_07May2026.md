# PropPulse Database Diagnostic — 07 May 2026

**Purpose:** Capture all findings from running 5 SQL queries against production Supabase. Honest read of current state, surface issues, identify implications.
**For:** Abid Mirza, Founder, BFC + planning sessions
**Status:** Diagnostic complete. Action items identified.

---

## TL;DR

Five SQL queries run against production database. Three significant findings:

1. **AI Agent is largely broken in production.** 90% of recent runs failed. Only Nakheel and Object 1 successfully scrape. 17 of 20 configured developers have never been successfully processed.

2. **Anchor customer reality is honest.** 1 real customer (Al Mansoori) with 9 projects, 1 imported from catalogue, 8 created directly. Three other companies in DB are test data uploaded earlier.

3. **Existing schema is richer than expected.** `project_units` has 54 columns, `pp_commissions` already supports master agreements, `pp_launch_events` exists. **Phase 1 build plan needs revision to extend existing tables, not create new ones.**

These findings are corrective, not catastrophic. They reshape the strategic narrative honestly.

---

## QUERY 1: PropPulse catalogue size

**Result:**
- Catalogue projects: 16
- Tenant imported projects: 37
- Total rows: 53

**Reading:** 16 projects in shared catalogue, 37 in tenant inventories. Total 53 across all tenants.

**Implication:** Catalogue is small (16 projects across 20 developers = <1 project per developer average).

---

## QUERY 2: Tenant breakdown

**Result:**

| Company | Total | Imported | Created Directly | Real Customer? |
|---|---|---|---|---|
| Default Company | 22 | 0 | 22 | NO — test data |
| PROPPULSE_CATALOGUE | 16 | — | — | Shared catalogue |
| Al Mansoori Properties | 9 | 1 | 8 | YES — anchor customer |
| Emirates Premium Realty | 3 | 0 | 3 | NO — test data |
| Gulf Leasing Solutions | 3 | 0 | 3 | NO — test data |

**Reading (corrected after user clarification):**
- 1 real customer in production: Al Mansoori Properties
- 9 projects total for that customer
- 1 imported from catalogue (likely a manual test by Abid)
- 8 created directly without using PropPulse Import feature
- 3 test companies pollute analysis but don't affect production functionality

**Implication:**
- Sample size of 1 customer × 9 projects is too small to draw adoption conclusions
- "PropPulse Import adoption" can only be measured properly after Phase 1 + Dubai Pulse scaling delivers a meaningful catalogue (5,000+ projects)
- Test data should be cleaned before next investor demo or external review

---

## QUERY 3: Configured developers

**Result:** 20 developers configured, all manually entered on 2026-04-21, no updates since.

**Geographic breakdown:**
- Dubai: 14 (70%)
- Abu Dhabi: 3 (Aldar, Eagle Hills, Reportage)
- RAK: 1 (RAK Properties)
- **Sharjah: 0 (gap)**
- Ajman/UAQ/Fujairah: 0 (acceptable for now)

**Tier coverage:**
- Top 10 UAE developers: All present (Emaar, DAMAC, Sobha, Aldar, Nakheel, Meraas, Dubai Properties, Majid Al Futtaim, Azizi, Ellington)
- Mid-tier: Well covered (Binghatti, Deyaar, Eagle Hills, Nshama, Omniyat, Select Group, Reportage, RAK Properties)
- Smaller/newer: Object 1, Tiger Properties (both unverified)

**Verdict on selection:** Solid top-20 list. Don't add more right now — make these 20 work better first.

**Issues found:**

| Issue | Severity | Implication |
|---|---|---|
| All `total_projects = 0` | LOW | Field is dead/unused. Either remove from schema or wire up for agent to populate. |
| All `rera_developer_no = NULL` | LOW | Easy fix — RERA numbers are public. Useful for "Verified by RERA" badges. |
| All added 2026-04-21, no updates since | MEDIUM | Configuration is static, no automation maintains it. Won't scale to 100+ without process. |
| All `data_source = 'manual'` | LOW | Confirms 20 number is intentional, not algorithmic. |

**Notable gaps for future expansion:**
- Imtiaz Developments
- Danube Properties
- Bloom Holding (Abu Dhabi)
- Modon Properties (Abu Dhabi)
- Imkan Properties (Abu Dhabi)
- Arada (Sharjah — important: NO Sharjah developers configured)
- Saraya (Sharjah)
- Tilal Properties (Sharjah)

---

## QUERY 4: Agent run history (CRITICAL FINDING)

**Result:** 30 most recent runs. Pattern of failures:

| Stat | Value |
|---|---|
| Total runs visible | 30 |
| Successful runs | 3 (Nakheel × 2, Object 1 × 1) |
| Failed runs | 27 |
| Failure rate | 90% |
| Most recent run | 02 May 2026 (5 days ago) |
| Runs in last 24 hours | 0 |
| `error_log` populated? | NO — all NULL |
| `duration_seconds` populated? | NO — all 0 |

**Pattern:** All runs happened in 2 batches on 02 May 2026:
- Batch 1: ~09:00 (20 developers)
- Batch 2: ~14:21-14:45 (20 developers, retry)

**Successful developers:**
- **Nakheel:** 2 successful runs, found 3 and 4 projects
- **Object 1:** 1 successful run, found 1 project

**Failed developers:** Aldar, Azizi, Binghatti, DAMAC, Deyaar, Dubai Properties, Eagle Hills, Ellington, Emaar, Majid Al Futtaim, Meraas, Nshama, Omniyat, RAK Properties, Reportage, Select Group, Sobha, Tiger.

**Reading:**
- Agent CAN work (Nakheel and Object 1 are proof)
- Agent IS broken for 17 of 20 developers (most including the major ones — Emaar, DAMAC, Sobha)
- We don't know WHY because `error_log` is NULL across all failures
- Hypothesis: Either Vercel function timeout, or major developer sites blocking scraping, or JSON parsing errors not logged

**Implications:**
- "PropPulse runs daily and grows the catalogue" claim is currently FALSE
- The 16 projects in catalogue likely from Nakheel + Object 1 successful runs accumulated
- Investor narrative needs adjustment: "AI agent scrapes 20 developer websites" is honest; "AI agent runs daily and consistently produces project data" is not currently honest

---

## QUERY 5: Schema discovery for sales cycle modules

**MAJOR FINDING:** Schema is richer than I assumed when writing Phase 1 build plan. Existing tables substantially match what I proposed building.

### `project_units` (54 columns — extensive)

**Categories of columns:**
- Identification: id, project_id, unit_ref, unit_type, sub_type, purpose
- Physical: floor_number, block_or_tower, view, facing, size_sqft, built_up_sqft, plot_sqft, balcony_sqft, terrace_sqft
- Bedroom/bath: bedrooms, bathrooms, en_suite, parking_spaces
- Premium features: maid_room, maid_bathroom, driver_room, store_room, laundry_room, study_room, garage, private_pool, private_garden, private_beach, roof_terrace, guest_bathroom, powder_room
- Furnishing: furnishing, condition, fit_out, kitchen_type, furnished
- Pricing: original_price, current_price, price_per_sqft, eoi_amount, booking_amount, service_charge_yr
- Documents: floor_plan_url, brochure_url, render_url, unit_3d_url
- Lifecycle: handover_date, status, is_featured
- Multi-tenancy: company_id, is_pp_listed, pp_last_updated, pp_source_unit_id
- Audit: created_by, created_at, updated_at, notes

**Verdict:** Genuinely thorough schema. Designed by someone who knows UAE off-plan deeply.

### `pp_commissions` (16 columns)

**Columns:** id, developer_id, project_id, commission_type, rate_pct, bonus_pct, conditions, valid_from, valid_until, is_active, registered_broker_only, notes, source_url, is_verified, created_at, updated_at

**Verdict:** This table substantially does what Phase 1 plan proposed for "Master Developer Agreements module":
- Per-developer (`developer_id`) + per-project overrides (`project_id`)
- Rate + bonus structure
- Validity period (valid_from, valid_until)
- Registered broker authority flag
- Source URL for verification

**REVISED Phase 1 plan implication:** Don't create `developer_agreements` table — extend `pp_commissions` instead.

### `pp_launch_events` (18 columns)

**Columns:** id, project_id, developer_id, event_type, title, event_date, event_time, venue_name, venue_address, city, latitude, longitude, google_maps_url, registration_url, is_invite_only, description, status, created_at, updated_at

**Verdict:** Already supports launch event tracking with location, registration, invite-only flag. Covers PropPulse improvement backlog Tier 2 item directly.

---

## REVISED PHASE 1 BUILD PLAN — IMPLICATIONS

The current `Phase_1_Build_Plan.md` proposes 7 modules over 8-12 weeks. With existing schema known, here's what changes:

### Module 1: Developer Agreements
- **Original plan:** Create `developer_agreements` table (1.5-2 weeks)
- **Revised plan:** Extend existing `pp_commissions` table to capture agreement metadata (~3-5 days work)
- **Saved:** ~1 week

### Module 3: Payment Milestones
- **Original plan:** Create `payment_milestones` table + UI
- **Revised plan:** Same — no existing table
- **No change**

### Module 4: SPA / Sale Deed Tracking
- **Original plan:** Add columns to `opportunities` table
- **Revised plan:** Same — no existing dedicated table
- **No change**

### Module 5: Commission Invoicing
- **Original plan:** Create `commission_invoices` table
- **Revised plan:** Same — `pp_commissions` is for AGREEMENTS, this is for INVOICES (different purpose)
- **No change but clarify naming:** keep `pp_commissions` for agreement-level data, create new `commission_invoices` for invoice-level data

### Module 7: Reports & Dashboards
- **Original plan:** Build reporting on commission/payment data
- **Revised plan:** Same
- **No change**

### Net effort revision

- **Original estimate:** 8-12 weeks
- **Revised estimate:** 7-11 weeks (saved 1-2 weeks by reusing existing tables)

---

## ACTION ITEMS

Ranked by urgency and dependency:

### 🔴 BEFORE Phase 1 build starts

1. **Fix AI agent error_log populating** — make agent code always write to error_log when status='failed'. Currently flying blind. ~2-3 hours of code work.

2. **Run agent test on Emaar with verbose logging** — once error_log works, manually trigger one developer to see the actual error. ~30 minutes.

3. **Diagnose root cause of 90% failure rate** — based on error message, fix accordingly:
   - If timeout → upgrade Vercel plan or chunk requests
   - If anti-bot → use scraper service or Apify
   - If JSON parsing → improve prompt + parsing
   - ~Variable, but probably 1-2 days

### 🟡 Strategic narrative adjustments

4. **Update investor pitch deck** — soften "AI agent runs daily" claim. Reframe as "PropPulse architecture supports AI-driven catalogue growth (currently in optimization phase)". ~30 min update.

5. **Update FOUNDER_CONTEXT.md** — capture today's findings under "open threads from last working session." ~10 min.

6. **Revise Phase_1_Build_Plan.md** — reflect schema reuse for `pp_commissions`. ~30 min.

### 🟢 Cleanup tasks (low priority, do when convenient)

7. **Clean test data** — delete Default Company, Emirates Premium Realty, Gulf Leasing Solutions. Use safe transaction-wrapped script. ~15 min.

8. **Populate `rera_developer_no` for the 20 developers** — manual research. ~1 hour.

9. **Add Sharjah developers** — Arada, Saraya, Tilal Properties. Configure via existing flow. ~30 min.

### 🔵 After agent is fixed

10. **Schedule via Vercel cron** — once >50% success rate, schedule daily runs. ~1-2 hours.

11. **Begin Dubai Pulse open data integration** — separate workstream, supplements the AI agent. ~1-2 weeks.

---

## STRATEGIC IMPLICATIONS

### What's STILL TRUE despite findings

- ✅ **PropPulse architecture is sound** — multi-tenant catalogue with provenance is genuinely innovative
- ✅ **Schema design is excellent** — `project_units` and supporting tables are thorough
- ✅ **The vision is right** — broker-owned data with growing catalogue
- ✅ **One real customer is real progress** — Al Mansoori works, used the product, came back
- ✅ **Phase 1 build plan is mostly sound** — just needs minor schema reuse adjustments

### What needs HONEST adjustment

- ⚠️ **AI agent reliability** — needs fixes before scaling
- ⚠️ **Catalogue size narrative** — 16 projects is small; Dubai Pulse fixes this fast
- ⚠️ **"Brokers import" claim** — too small a sample to defend, defer until catalogue grows
- ⚠️ **Investor narrative** — still strong, but agent claims need softening

### What this DOESN'T change

- ❌ **No need to abandon PropPulse** — fix the agent, scale via Dubai Pulse, narrative recovers
- ❌ **No need to delay broker meetings** — what works (manual entry, opportunity flow, discount approvals) IS working
- ❌ **No need to refactor architecture** — design is sound

---

## HONEST META-REFLECTION

This diagnostic was uncomfortable but valuable. **Three things I learned about my own analysis:**

1. **I wrote the Phase 1 build plan without looking at the existing schema.** Real planning mistake. I proposed tables that already exist.

2. **I was too quick to interpret data initially.** Treated test data as real adoption signal. Required correction.

3. **I made strategic claims about agent reliability without verifying.** Yesterday's investor narrative implied a working daily agent. Today's data says 90% failure rate.

**These corrections are why running these queries was the right move.** Better to know the truth in a private session than to discover it during an investor pitch.

**Net assessment:** Today's findings strengthen the work going forward, even though they require some narrative adjustment. **Honest data is more valuable than positive assumptions.**

---

## NEXT STEPS BY DAY

### Today (remaining time)
- ✅ Push docs to GitHub (DONE)
- ✅ Run 5 SQL queries (DONE)
- ✅ Document findings (THIS DOC)
- ⏳ Save this doc to `D:\prop-crm\docs\PropPulse_Diagnostic_07May2026.md`
- ⏳ Push the diagnostic to GitHub

### Tomorrow / Next session
- Fix `error_log` capture in agent code (start of agent debugging)
- Run one developer manually with verbose logging
- Update FOUNDER_CONTEXT, README, and investor pitch slide based on findings
- Revise Phase_1_Build_Plan.md for schema reuse

### This week
- Diagnose root cause of agent failures
- Implement fix for highest-priority developer (Emaar — flagship developer, must work)
- Decide on Dubai Pulse integration timing

### This month
- Get agent to >70% success rate
- Schedule via Vercel cron
- Update strategic decks with truthful state

---

*Diagnostic compiled from 5 SQL queries run against production Supabase on 07 May 2026.*
*Honest findings. Corrective implications. Action items prioritized.*

— BFC · 07 May 2026
