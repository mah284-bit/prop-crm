# Pre-Demo Phase 2 Sprint — Discipline Doc

**Date captured:** 30 May 2026 (Saturday morning, Day 19)
**Demo date:** 15 June 2026 (16 days out)
**Source:** Day 19 architect-founder planning session after Day 18 audit
**Status:** Approved plan, execution begins immediately

---

## Why this doc exists

Day 18 evening, founder asked: what can we finish before demo. That question triggered the 17-item Phase 2 Strategic Roadmap audit. But the audit answered the full picture, NOT what ships pre-demo. Day 19 morning we corrected that: 2 items from the 17 ship pre-demo, in this order, with deliberate exclusions.

This doc is the discipline guardrail. When fatigue or scope-creep tempts us to expand, this doc says NO.

---

## The verdict — what ships pre-demo (and what does not)

### Ships pre-demo (in this order)

**Phase 2.0 — Real-Time State Sync** (Item 1 from Strategic Roadmap)
- Effort: 2-3 days
- Days 19-21 (May 30 to June 1)
- Doc reference: Phase_2_State_Management_RealTime_Sync.md

**Phase 2.1 — Lead Ingestion and Assignment, LAYER 1 ONLY** (Item 2, scoped)
- Effort: 3-4 days (Layer 1 only, not Layers 2 or 3)
- Days 22-25 (June 2-5)
- Doc reference: Phase_2_Strategic_Roadmap_v1.md Item 2

### Demo Hardening Sprint
- Days 26-32 (June 6-14)
- Demo rehearsals, mock investors, polish from rehearsal findings, Abdullah persona journey, final dry run

### Demo Day
- 15 June 2026

---

## Deliberately rejected — architect reasoning

**Item 9 — Proposal PDFs (Brahma Lipi Tier 1)**
Would force a 1-week PDF library setup. Risk of rabbit-holing into font/template issues that eat demo prep. Demo narrative already covers Phase 2 PDFs. SKIP.

**Items 2 Layer 2 + Layer 3**
Layer 1 round-robin IS the demo win. Layers 2 and 3 add admin complexity without demo upgrade. DEFER.

**Item 5 — Activity Logging FAB**
Low demo impact. Lead-side shipped Day 11. Universal FAB is polish. DEFER.

**Item 7 — Nav-History App-Wide**
Founder own deferral call yesterday (commit 61ec691): last step ensuring entire app back follows same track. DEFER.

**Items 3, 4, 6, 8, 10 through 17**
Each either too large for 16-day window, not demo-visible, or has higher demo-payoff alternatives. ALL deferred to post-demo Phase 2 proper.

---

## The dependency map — why sequence matters

A: Real-Time Sync
  ↓ (enables) C to work without hard-refresh
C: Lead Ingestion Layer 1
  ↓ (enables) Demo narrative: agent-side + org-side platform
Demo Hardening
  ↓
DEMO

**Why A must ship before C:**
Lead Ingestion creates new lead records when admin assigns. Agent pipeline view must update without hard-refresh — otherwise the demo moment (watch the lead appear in the agent list) fails. Real-Time Sync is the prerequisite.

**Why A is isolated, low-risk:**
Backend-only — Supabase Realtime subscriptions on tables + refresh callbacks on save handlers. No new UI surfaces, no schema changes, no migration risk.

**Why parallel work is rejected:**
C touches state-update patterns that A reshapes. Parallel = merge conflicts + rework. Serial is faster than parallel here.

---

## Time budget honesty

| Block | Days | Cumulative |
|---|---|---|
| Phase 2.0 Real-Time Sync | 2-3 | Day 21 (June 1) |
| Phase 2.1 Lead Ingestion L1 | 3-4 | Day 25 (June 5) |
| Demo Hardening | 5-7 | Day 32 (June 14) |
| Demo | 1 | Day 33 (June 15) |

Buffer: ~3-5 days available for slips.

- If A slips badly: cut C. Ship A only.
- If A clean, C slips: ship A + partial C, demo what works.
- If both clean: more buffer for hardening.

---

## The demo upgrade question

If we ship only Phase 1 as it is today (no A, no C), the demo runs as the v3.1 script describes — already strong. Adding A and C upgrades the narrative as follows:

**Phase 1 only (today reality):**
"PropPlatform is the agent operating power. Phase 2 adds real-time sync and brokerage-admin workflow."

**Phase 1 + A + C Layer 1 (post-sprint reality):**
"PropPlatform is both the agent AND the brokerage admin operating power. Real-time sync across users. Admin lead intake with round-robin distribution. Audit trail of every assignment. Phase 2 expands the org-side further."

**The difference:** investor SEES the org-side platform working in the demo, not just hears about it as roadmap. Different category of pitch.

---

## Discipline rules during the sprint

1. **Read this doc before any "small addition" temptation.** If it is not A or C-Layer-1, it does not ship pre-demo.
2. **Every build day ends with a golden-mark commit.** Revertable if next-day rehearsal exposes regression.
3. **No scope creep on C.** Layer 1 only. If pilot brokerage feedback wants Layer 2/3, that is Phase 2 post-demo.
4. **Test on the deployed Vercel preview** at end of each commit cycle. Real production environment, not just local dev.
5. **Phase 2.0 and 2.1 docs split out from Roadmap when build begins.** Each gets its own focused implementation doc separate from the Strategic Roadmap v1.
6. **Demo Hardening starts whether or not C is fully done.** Block 3 has hard date floor — June 6 demo rehearsal pace begins regardless.

---

## What success looks like at June 14 (one day before demo)

- ✅ Real-Time Sync working on production URL (no hard refresh anywhere during demo)
- ✅ Lead Ingestion Layer 1 working on production URL (admin Lead Queue + round-robin + audit log)
- ✅ Demo script v3.1 updated to include new Scene/scene-extension for Lead Ingestion
- ✅ AI Coach broad analysis verified live (Day 18 work)
- ✅ All 4 demo personas have journeys
- ✅ Demo rehearsed end-to-end at least 3 times
- ✅ Mock investor session completed
- ✅ Backup screenshots captured to phone
- ✅ Demo URL stable, monitored for 4+ days

---

## Status

- [x] Plan documented (this doc)
- [ ] Phase 2.0 Day 1 — Real-Time Sync subscriptions on Priority 1 tables
- [ ] Phase 2.0 Day 2 — Smart refresh callbacks on save operations
- [ ] Phase 2.0 Day 3 — Multi-tab + multi-user testing, deploy verify
- [ ] Phase 2.1 Day 1 — schema (agent_pools, lead_assignment_log)
- [ ] Phase 2.1 Day 2 — round-robin logic + assignment service
- [ ] Phase 2.1 Day 3 — Admin Lead Queue UI
- [ ] Phase 2.1 Day 4 — test + deploy verify
- [ ] Demo Hardening Block — rehearsals + mocks + polish
- [ ] Demo Day — 15 June

---

## Founder principles preserved (Day 19 morning)

> *"sounds good, but 16 days for just 4 points is too much... my thought is some can finish what we put the whole plan for yesterday to see what can go and what not"*

Founder rejected the overcorrected "demo polish only" pitch from architect. The audit purpose was to answer "what can ship" — not to capture and defer everything. Phase 2.0 + 2.1 Layer 1 honor that purpose.

> *"Architect call here as things are interdependent — what goes first and next you decide to ensure no look back deliberately with losing time and leave for later"*

Founder asked for an architect-locked sequence with deliberate exclusions. This doc IS that sequence. The exclusion reasoning is documented above. No look-back.

---

*Document created: 30 May 2026 (Saturday morning, Day 19)*
*Source: Day 19 founder-architect planning session, post Day 18 audit*
*Status: Approved plan. Phase 2.0 build begins next.*
*Discipline rule: read this doc whenever scope-creep tempts.*