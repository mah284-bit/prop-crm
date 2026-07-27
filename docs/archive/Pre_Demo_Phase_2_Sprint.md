# Pre-Demo Phase 2 Sprint — Discipline Doc

**Date originally written:** 30 May 2026 (Saturday morning, Day 19)
**Last rewritten:** 30 May 2026 (Saturday evening, Day 19) — clean rewrite after Phase 2.0 shipped and Phase 2.1 scope expanded
**Demo date:** 15 June 2026 (16 days out)
**Status:** Living doc — updated as builds ship and scope crystallizes

---

## Why this doc exists

Day 18 evening, founder asked: what can we finish before demo. That question triggered the 17-item Phase 2 Strategic Roadmap audit. The audit answered the full Phase 2 picture, NOT what ships pre-demo. Day 19 morning we picked 2 items from the 17 to ship pre-demo, in deliberate sequence, with deliberate exclusions.

This doc is the discipline guardrail. When fatigue or scope-creep tempts us to expand, this doc says NO.

Earlier versions of this doc are preserved in git history (commits before Day 19 evening).

---

## The verdict — what ships pre-demo (and what does not)

### Ships pre-demo (in this order)

**Phase 2.0 — Real-Time State Sync** ✅ COMPLETE
- Shipped Day 19 afternoon (was estimated 2-3 days)
- Proven on production prop-crm-two.vercel.app: cross-tab realtime sync working
- Founder live test: V6 saved in Tab A appeared in Tab B within 2 sec, no refresh
- Pattern locked: dedupe by id on every INSERT handler against optimistic update races
- Doc reference: Phase_2_State_Management_RealTime_Sync.md
- Strategic Roadmap reference: Item 1

**Phase 2.1 — Lead Ingestion, Assignment & Governance** 🟡 IN PROGRESS
- Day 19 PM: schema deployed (3 tables + 8 columns + RLS + realtime publication)
- Estimated remaining: 4-6 days (originally 3-4 days for Layer 1 only; expanded to include governance per founder principle of avoiding come-backs)
- Doc reference: Phase_2_1_Lead_Ingestion_Design.md
- Strategic Roadmap reference: Item 2 (extended scope, see below)

### Demo Hardening Sprint
- Begins Day 26 (6 June) regardless of Phase 2.1 completion status
- Demo rehearsals, mock investors, polish from rehearsal findings, Abdullah persona journey, final dry run

### Demo Day
- 15 June 2026

---

## What changed between morning and evening of Day 19

Three substantive shifts:

### Shift 1: Phase 2.0 finished same-day
Estimate was 2-3 days. Reality: ~3 hours. Why faster: the Day 12 work (`useRealtimeSubscription.js` hook + Supabase Realtime publication enabled) had already done ~80% of the foundation. Day 19 work was: upgrade activities to full INSERT/UPDATE/DELETE, add per-opp proposals subscription, two dedupe hotfixes for the optimistic-update race condition, two merges to main, verify on production.

### Shift 2: Phase 2.1 scope expanded — governance included, not deferred
Original plan: Layer 1 round-robin only (3-4 days), defer governance (release/transfer/stale-detection) to Phase 2.1 Extended post-demo.

Founder pushed back on the split: *"if we do split we have to come back I leave this call to you avoiding come backs completely is my thought which is going on from past 2 days."*

Architect accepted. Splitting now creates ~2 days of re-warm-up cost when we return (same schema, same UI files, same mental model). Full Phase 2.1 = 5-7 days, includes:
- Round-robin assignment service + audit log (original Layer 1)
- Broker formal release workflow (release-to-queue OR transfer-to-specific-broker, both require reason)
- Stale-detection (client-side check pre-demo, surfacing visibility to Lead Admin)
- Admin force-reassign with audit
- Lead Queue UI with 3 tabs (Unassigned / Stale Flagged / History)
- Settings → Agent Pools + Settings → Lead Routing Rules

### Shift 3: Two-layer assignment model locked
Founder raised: *"Many times the brokers of same org talk to the same single lead but different opps, due to sectors or maybe the buyer wants to work with them on different projects."*

Inspection of existing schema confirmed PropCRM already has `leads.assigned_to` AND `opportunities.assigned_to` as independent columns. Phase 2.1 governs lead-level assignment ONLY. Opportunity-level assignment stays untouched — a lead with multiple opps may legitimately have different brokers per opp.

Stale-detection considers activity across the lead AND all its opps (so an active opp keeps a lead non-stale even if lead-level owner hasn't touched the lead record itself).

---

## Deliberately rejected — architect reasoning (unchanged from morning)

**Item 9 — Proposal PDFs (Brahma Lipi Tier 1)**
Would force a week of PDF library setup. Risk of rabbit-holing into font/template issues that eat demo prep. Demo narrative already covers Phase 2 PDFs. SKIP.

**Items 2 Layer 2 + Layer 3** (source-based routing, territory/language matching)
Layer 1 round-robin + governance IS the demo win. Layers 2 and 3 add admin complexity without demo upgrade. DEFER to post-demo Phase 2 proper.

**Item 5 — Activity Logging FAB**
Low demo impact. Lead-side shipped Day 11. Universal FAB is polish. DEFER.

**Item 7 — Nav-History App-Wide**
Founder's own deferral call yesterday (commit 61ec691). DEFER.

**Items 3, 4, 6, 8, 10 through 17**
Each either too large for the window, not demo-visible, or has higher demo-payoff alternatives. ALL deferred to post-demo Phase 2 proper.

---

## The dependency map — why sequence matters

```
Phase 2.0: Real-Time Sync
  ↓ (enables) Phase 2.1 UI to update without hard-refresh
Phase 2.1: Lead Ingestion + Governance
  ↓ (enables) Demo narrative: agent-side + org-side platform
Demo Hardening
  ↓
DEMO
```

**Why Phase 2.0 had to ship first:** when Phase 2.1 Lead Queue auto-assigns a lead via round-robin, the assigned agent's pipeline view must update without hard-refresh — otherwise the demo moment (watch the lead appear in the agent's list) fails. Realtime sync is the prerequisite. **This is now proven working** — the lead realtime subscription is live in the main branch.

**Why parallel work was rejected:** Phase 2.1 touches state-update patterns that Phase 2.0 reshapes. Parallel work = merge conflicts + rework. Serial was faster than parallel — confirmed by Phase 2.0 shipping in 1 day instead of 3.

---

## Time budget — current reality

| Block | Original estimate | Actual | Status |
|---|---|---|---|
| Phase 2.0 Real-Time Sync | 2-3 days (Days 19-21) | 1 day (Day 19) | ✅ DONE |
| Phase 2.1 Lead Ingestion + Governance | 3-4 days (originally) | 5-7 days (scope expanded) | 🟡 Schema done Day 19 PM, remaining 4-6 days |
| Demo Hardening | 5-7 days (Days 26-32) | 5-7 days | Starts Day 26 (6 June) regardless |
| Demo | 1 day (Day 33) | 1 day | 15 June |

**Buffer status:**
- Started with 16 days
- Phase 2.0 used 1 day (saved 1-2 vs estimate)
- Phase 2.1 will use 5-7 days (Days 19 PM through Day 25 max)
- Demo Hardening floor: Day 26 (6 June) — 7+ days of hardening available before demo
- Floor of hardening time is non-negotiable

**Slip protection:**
- If Phase 2.1 slips into Days 26-27: cut the stale-detection client check (defer to post-demo), ship the rest
- If Phase 2.1 slips further: cut the broker-transfer mode, keep release-to-queue only
- If catastrophic slip: ship Phase 2.0 only + cover Phase 2.1 in demo narrative as "shipping Q3" (still strong because Phase 2.0 is the bigger investor moment)

---

## The demo upgrade question

**Phase 1 only (April demo reality):** "PropPlatform is the agent operating power."

**Phase 1 + Phase 2.0 (after today):** "PropPlatform is the agent operating power, real-time across users and tabs."

**Phase 1 + Phase 2.0 + Phase 2.1 (target):** "PropPlatform is both the agent AND the brokerage admin operating power. Real-time sync across users. Pool-sourced leads route through admin queue with round-robin distribution. Broker-created leads stay with the broker who captured them. Formal release/transfer workflow prevents lead-rot. Stale-detection surfaces dormant deals. Every assignment auditable. Phase 2 expands the org-side further (Layers 2 and 3, post-demo)."

**The pitch difference:** Investor sees the brokerage operating system working in the demo, not just hears about it as roadmap. **This is a different category of pitch.**

---

## Discipline rules during the sprint

1. **Read this doc before any "small addition" temptation.** If it is not in scope of Phase 2.0 (done) or Phase 2.1 as designed, it does not ship pre-demo.
2. **Every build day ends with a golden-mark commit.** Revertable if next-day rehearsal exposes regression.
3. **No Layer 2 or Layer 3 routing.** Pre-demo Phase 2.1 includes Layer 1 round-robin + governance. Source-based routing and territory/language matching are post-demo.
4. **Test on the deployed Vercel preview** at end of each commit cycle. Real production environment, not just local dev.
5. **Schema changes always preceded by golden-tag** (precedent set by `pre-phase-2.1-schema` tag at 6381fe2). Supabase backup window confirmed before deploying.
6. **Demo Hardening starts Day 26 regardless.** Hard date floor.

---

## What success looks like at June 14 (one day before demo)

- ✅ Real-Time Sync working on production URL (confirmed Day 19)
- ⬜ Lead Ingestion + Governance working on production URL (Lead Queue + round-robin + release/transfer + stale-detection + audit log)
- ⬜ Demo script v3.1 updated to include new scene for Lead Ingestion + Two-Layer model narrative
- ✅ AI Coach broad analysis verified live (Day 18 work)
- ⬜ All 4 demo personas have journeys (Abdullah Al-Ghamdi 4th persona pending)
- ⬜ Demo rehearsed end-to-end at least 3 times
- ⬜ Mock investor session completed
- ⬜ Backup screenshots captured to phone
- ⬜ Demo URL stable, monitored for 4+ days

---

## Status checklist — current

### Phase 2.0 Real-Time Sync — ALL COMPLETE ✅
- [x] Activities subscription upgraded to full INSERT/UPDATE/DELETE (commit 776c0d6)
- [x] Per-opp proposals subscription added (commit 3fbe96b)
- [x] Dedupe hotfix on all realtime INSERT handlers (commit 98775f6)
- [x] Dedupe hotfix on local save handler vs realtime race (commit 05fbb51)
- [x] Merged to main, deployed to production
- [x] Live verified cross-tab on prop-crm-two.vercel.app

### Phase 2.1 Lead Ingestion + Governance — IN PROGRESS 🟡
- [x] Design doc (Phase_2_1_Lead_Ingestion_Design.md, 374 lines, commit 6381fe2)
- [x] Four open design questions resolved (Q1=A, Q2=B, Q3=B, Q4=A)
- [x] Two-layer assignment model locked
- [x] Schema migration deployed (commit e3857ae) — agent_pools, agent_pool_members, lead_assignment_log + 4 cols on leads + 4 cols on companies + RLS + realtime
- [x] All 6 verification queries green
- [x] 18 existing leads backfilled clean (broker_created / assigned)
- [ ] Day 20: Assignment service RPC functions (round-robin algorithm)
- [ ] Day 20: Lead creation flow updated (writes broker_created log entry)
- [ ] Day 21 AM: Settings → Agent Pools UI
- [ ] Day 21 PM: Settings → Lead Routing Rules UI
- [ ] Day 22 AM: Lead Queue page (3 tabs)
- [ ] Day 22 PM: Lead Detail Assignment section + Release dialog
- [ ] Day 23: Stale-detection client check
- [ ] Day 24: Test + deploy verify on production

### Demo Hardening Block — UPCOMING ⬜
- [ ] Demo Hardening starts Day 26 (6 June)
- [ ] Demo script v3.1 update (Phase 2.0 + 2.1 narrative)
- [ ] Abdullah Al-Ghamdi 4th persona journey
- [ ] 3+ end-to-end rehearsals
- [ ] Mock investor session
- [ ] Phone backup screenshots
- [ ] 4+ days stability monitoring

### Demo Day — 15 June 2026 ⬜
- [ ] Final morning dry-run
- [ ] Demo delivered

---

## Safety nets in place

- **Git tag `pre-phase-2.1-schema`** at commit 6381fe2 — revert path: `git reset --hard pre-phase-2.1-schema`
- **Supabase daily backups** — most recent 30 May 2026 02:34:29 UTC — 1-click Restore in dashboard
- **Migration file in repo** (commit e3857ae) — schema recreatable in any environment
- **Phase 2.1 migration is idempotent** — IF NOT EXISTS on every CREATE, safe to re-run
- **Phase 2.0 dedupe pattern documented** — `setX(x => x.some(r => r.id === p.new.id) ? x : [p.new, ...x])` — reapply anywhere new optimistic + realtime mix exists

---

## Founder principles preserved

> *"sounds good, but 16 days for just 4 points is too much... my thought is some can finish what we put the whole plan for yesterday to see what can go and what not"*

Founder rejected the overcorrected "demo polish only" pitch from architect (Day 19 morning). The audit purpose was to answer "what can ship" — not to capture and defer everything. Phase 2.0 + 2.1 honor that purpose.

> *"Architect call here as things are interdependent — what goes first and next you decide to ensure no look back deliberately with losing time and leave for later"*

Architect-locked sequence with deliberate exclusions. This doc IS that sequence. No look-back.

> *"if we do split we have to come back I leave this call to you avoiding come backs completely is my thought which is going on from past 2 days."*

Phase 2.1 ships as ONE coherent unit including governance, not split into Layer 1 + Extended. Decided Day 19 PM. Architect accepted founder's call.

> *"no half hearted work which spoils"*

Phase 2.1 scope is what we'll fully complete, not "Layer 1 plus pretty-good intentions for governance." If schedule pressure forces partial delivery, the deliberate cuts are documented above (stale-detection first, transfer-mode second), not silently dropped.

> *"Many times the brokers of same org talk to the same single lead but different opps... please check this before starting anything, actually this becomes an issue later is i understand."*

Two-layer assignment model honored: `leads.assigned_to` = lead-level; `opportunities.assigned_to` = per-deal level. Confirmed Day 19 PM before schema written.

---

*Document originally created: 30 May 2026 (Day 19 morning)*
*Rewritten clean: 30 May 2026 (Day 19 evening) — Phase 2.0 shipped, Phase 2.1 schema deployed, scope expanded*
*Discipline rule: read this doc whenever scope-creep tempts.*
