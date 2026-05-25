# Phase 2 Backlog — Master Document

**Date captured:** 21 May 2026 (Thursday, Day 9) — initial
**Last updated:** 23 May 2026 (Saturday, Day 11) — added 5 strategic captures from today's work
**Purpose:** Single source of truth for all Phase 2 backlog items + Phase 1 hidden features
**Audience:** Founder reference + investor Q&A backing + team onboarding
**Status:** Live document — updated as new items emerge

---

## TL;DR — Phase 1 vs Phase 2

### Phase 1 LIVE (June 5 demo)
**Workflow:**
- Dashboard, Leads, Opportunities with stage gates
- **Lead Detail activity logging (RESTORED 23 May)** ⭐ NEW
- Opp Detail full activity logging with scheduling
- Proposals V1→V2→V3 with audit + pre-fill
- Negotiations (V_latest pre-fill from rounds only)
- 7-tab opp dashboard, SPA Signed workflow
- Master Agreements

**Intelligence:**
- PropPulse with AI Agent (Claude Sonnet 4.5 + web search)
- 38 verified projects + 20 developers + 119 units

**Financial:**
- Commission Outstanding (manual refresh button — Phase 2.0 fixes)
- Buyer outflow vs Broker revenue separation (architectural)

**Infrastructure:**
- Multi-tenant + per-company config + AI Coach per deal

### Phase 1 HIDDEN (built, behind menu)
- Discounts approval (developer persona) | Activity Log (replaced by role-aware Dashboard)
- Permissions x2 | Group View | Cover Message Preview | OpportunityDetail orphan

---

## SECTION 1 — Hidden Features

| Feature | Commit | Why Hidden | Phase 2 |
|---|---|---|---|
| Discounts | `588c7df` | Developer persona | Q3 2026 |
| Activity Log | `0b84c73` | Replaced by role-aware Dashboard | July 2026 |
| Permissions #1 (RBAC) | `2135186` | Admin config, not broker workflow | July 2026 |
| Permissions #2 (empty) | `2135186` | Looks broken | Consolidate or remove |
| Group View | `2135186` | Placeholder | Q4 2026 |

---

## SECTION 2 — Architectural Roadmap

### 2.0 ⭐ NEW: State Management & Real-Time Sync (PRIORITY 0)
**Date captured:** 23 May 2026  
**Founder quote:** *"I cant tell the customers to keep refreshing always... shows a flaw in the system"*  
**Severity:** 🔴 Production blocker for client deployment (demo OK with workaround)

**Problem:** React SPA caches state in browser memory. Changes don't auto-propagate.

**Solution:**
- Supabase Realtime subscriptions for Priority 1 tables
- Smart refresh callbacks on all save operations
- Cross-tab + multi-user sync

**Effort:** 2-3 days  
**Timing:** PRIORITY 0 — before any other Phase 2 features  
**Document:** `Phase_2_State_Management_RealTime_Sync.md`  
**Client deployment blocker:** Yes — no client onboards until this ships


---

**✅ DAY 13 RESOLUTION (25 May 2026):**

**Root cause:** Not stale state needing Realtime — the `OpportunityDetail` component was being reused across navigation without remounting, so `useEffect([opp.id])` never re-fired. Saturday's symptom (Mayya's proposals missing) was a missing React `key` prop on the render sites, not a database sync issue.

**Fix shipped:** Single 2-line change — `key={selOpp.id}` added at both render sites (Opportunities page line 10880, Leads page line 12000). React now treats every navigation as a fresh mount; all 5 fetches re-execute reliably.

**Commits:**
- `e60e8ab` — `useRealtimeSubscription` hook preserved for future multi-user cross-tab sync
- `bfb1050` — `key={selOpp.id}` fix (production blocker resolved)
- `9da9994` — Repo cleanup (removed 50 obsolete fix scripts)

**Status:**
- ✅ Saturday's Mayya bug — RESOLVED
- ✅ Demo blocker — REMOVED (no hard refresh needed)
- ✅ Client deployment blocker — REMOVED for single-user single-tab scenarios
- 📋 Multi-user/multi-tab Realtime sync — DEFERRED until pilot client runs 2+ devices simultaneously

**Lesson:** Day 12 Realtime INSERT approach hit StrictMode duplicate-key race. Founder rightly questioned "does Realtime even solve Saturday's symptom?" — it didn't. The actual symptom was simpler than the architecture we were building.
### 2.1 PropOS Vision
**Founder vision:** Property Operating System for all real estate personas (broker → developer → construction → facilities)

| Persona | Phase | Timing |
|---|---|---|
| Broker / Agency | 1 | NOW |
| Sales Manager (team view) | 2 | July 2026 |
| Developer Operations | 2 | Q3 2026 |
| Construction Manager | 3 | Q4 2026 |
| Facilities Manager | 4 | 2027 |

### 2.2 Two-Tier Proposal Model (Brahma Lipi)
**Document:** `Phase_2_Proposal_Communication_Model.md`  
**Effort:** 14-18 hours | **Timing:** July 2026

### 2.3 Configurable Roles per Company
**Current:** Hard-coded 7 roles  
**Vision:** Brokerage defines own hierarchy  
**Effort:** 3-5 days | **Timing:** Q3 2026

### 2.4 Unified Settings Module
**Current:** Settings scattered across Companies/Users/Permissions  
**Vision:** One Settings page with sections  
**Effort:** 1 week | **Timing:** July-Aug 2026

### 2.5 ⭐ NEW: Negotiation Round First-Time Pre-Fill from V_latest
**Date captured:** 23 May 2026  
**Founder discovery:** Mayya's nego form blank when no prior rounds

**Current:**
- Prior round exists → Phase A pre-fills ✅
- No prior round → Form blank ❌

**Target:**
- No prior round → pre-fill from V_latest proposal terms
- Broker enters NEW asks on top
- Reference line: "Counter-offer to V4 latest terms"

**Effort:** 30-45 min  
**Timing:** Phase 2 OR pre-demo Sunday  
**Demo workaround:** Use Shrikant's deal (has existing rounds)

### 2.6 Multi-tenant Verification (RLS audit)
**Effort:** 1 day | **Timing:** Before scaling beyond pilot

### 2.7 PDF Generation Capability
**Required for:** Broker proposals, invoices, reports, closure summaries  
**Effort:** 4-6 hours | **Timing:** July 2026

### 2.8 Paid Data Source Integrations
**Founder quote:** *"if we connect to the paid services also it will be a Miracle"*  
**Targets:** RERA Dubai, DLD registry, Bayut/PropertyFinder  
**Effort:** 2-3 weeks per source | **Timing:** Q3 2026

### 2.9 Customer-Facing Context Bundle (CRITICAL)
**Founder priority:** Asked by 2nd-demo investor previously  
**Vision:** Multi-entry-point send (Inventory/Lead/Opp/Proposal)  
**Required:** Brochure upload UI + PDF bundling + Send (WhatsApp/Email/Download)

**⭐ Day 11 enhancement:** Site Visit Invite must include unit location pin (data exists in inventory, just plumb to invite). Pick-and-drop coordination is NEW addition.

**Effort:** 5-7 days | **Timing:** Q3 2026

### 2.10 AI Bubble Clickable Results
**Vision:** Text → clickable cards (units, proposals, actions)  
**Effort:** 2-3 hrs (α) or 1-2 days (β with tool use)  
**Timing:** Q3 2026

### 2.11 Portfolio-Level AI Coach
**Founder ask:** *"is it possible to put for all his pending deals and give a fair report"*  
**Connection:** Lives inside Manager view (Role-Based Dashboard)  
**Effort:** 6-8 hrs backend + 1 day UI | **Timing:** Q3 2026

### 2.12 Opp State Refresh on Proposal Save
**Status:** Resolved by Phase 2.0 (State Management & Real-Time Sync)

### 2.13 ⭐ NEW: Activity Logging Everywhere (FAB)
**Date captured:** 22 May 2026  
**Founder direction:** *"calling logging is a floating button we may have to think logically and fit wherever necessary"*
**Stage 1 SHIPPED Day 11:** Lead Detail logging restored (commit `91f46c2`)


**✅ Stage 2 SHIPPED Day 14 (25 May 2026):** FAB on detail screens (Option X scope)
- `3bed195` — FAB on Opportunity Detail (stacked above AI Coach button at `bottom:96`)
- `a7395e7` — FAB on Lead Detail (`bottom:24`, wires into richer 23 May logging modal with next-step reminders)
- Reuses existing modals — no duplication. Material Design FAB convention.

**📋 Stage 3 DEFERRED (Option Y):** Dashboard / Leads list / Opps list FAB — needs lead picker (4-6 hrs UX work). Revisit post-demo if broker workflow demands it. Detail-screen FAB ships the 80% value.
**Effort:** 1-2 days for FAB | **Timing:** Q3 2026  
**Document:** `Phase_2_Activity_Logging_Everywhere.md`

### 2.14 ⭐ NEW: Lead Lifecycle & Buyer Segmentation
**Date captured:** 23 May 2026  
**Founder vision:** Investor vs Owner-Occupier segmentation + auto-conversion lead→customer

**Lifecycle:** Raw → Qualified → Active Prospect → Customer → Portfolio Customer  
**Buyer Intent:** Investor / Owner-Occupier / Hybrid / Corporate / Reseller  
**Marketing automation:** Targeted campaigns by segment

**Effort:** 2-3 days | **Timing:** Q3 2026  
**Document:** `Phase_2_Lead_Lifecycle_Segmentation.md`

### 2.15 ⭐ NEW: Communications & Output Overhaul
**Date captured:** 23 May 2026  
**Founder quote:** *"all the docs, reports and mails... at the moment very minimal below the basic level"*

**Scope:** Customer-facing attachments + Documents/Reports overhaul + Email/WhatsApp templates + Bulk send/tracking

**Effort:** 4 weeks (Phase 2A/B/C/D) | **Timing:** Q3 2026  
**Document:** `Phase_2_Communications_Overhaul.md`

### 2.16 ⭐ NEW: Dev2 Refactor — Activity Logging Duplication
**Date captured:** 23 May 2026  
**Founder concern:** *"duplicated code in App.jsx... not doing a normalised development"*

**Solution:** Single `<LogActivityDialog>` component used everywhere  
**Effort:** 1 day in dev2 | **Document:** `Dev2_Refactor_Activity_Logging.md`

---

## SECTION 3 — Pre-Demo Improvements

| Item | Status | Effort | Schedule |
|---|---|---|---|
| Dashboard CSS bug | ✅ FIXED (`8e83584`) | — | — |
| Projects row clickable | PENDING | 30 min | Days 4-7 (or skip) |
| Unlinked deals link | ✅ FIXED today | — | — |
| Sample brochure PDFs | PENDING | 45 min | Days 4-7 |
| Sample floor plan | PENDING | 30 min | Days 4-7 |
| RAK Properties fix | ✅ DONE (`79ed411`) | — | — |
| Queue verification | ✅ DONE (12 verified) | — | — |
| "abc" test project | PENDING | 15 min | Anytime |
| SettingsTab crash | ✅ FIXED (`6d9617e`) | — | — |

---

## SECTION 4 — Phase 2 Build Schedule

```
PHASE 2.0 ✅ DONE Day 13: State Management (key={selOpp.id} fix, bfb1050)
PHASE 2.1 ✅ DONE Day 14: FAB on detail screens (3bed195 + a7395e7) — Stage 3 lists deferred
PHASE 2.2 (Week 3-4): Lead Lifecycle & Buyer Segmentation
PHASE 2.3 (Weeks 5-8): Communications Overhaul
  - 2.3A PDF foundation
  - 2.3B Site Visit + Bundle system
  - 2.3C Email/WhatsApp templates
  - 2.3D Reports overhaul
PHASE 2.4 (Weeks 9-10): Role-Based Dashboard + Portfolio AI Coach
PHASE 2.5 (Weeks 11-12): Configurable RBAC + Unified Settings

Q4 2026: Developer persona launch + RERA/DLD paid integrations
2027+: Construction + Facilities personas
```

---

## SECTION 5 — Founder Quotes (Strategic Wisdom)

### PropOS vision
> "final aim is to have the Property Operating System 1stop shop for everything, I still have it in mind"

### PropPulse intelligence
> "It is not Gold it is more than that, only on the public domain we are getting this, if we connect to the paid services also it will be a Miracle"

### Role-based design
> "Role based Dashboard is a fantastic decision"

### Scattered settings
> "there are settings everywhere we have to actually design a better module"

### Hard-coded roles
> "Roles mentioned there are hard coded... we have to see how to define roles based on the company requirements"

### Brahma Lipi (proposal communication)
> "all the proposals should go with all the details of the property... the final proposal the buyer will accept and sign is from the developer this is only for the communication for the broker"

### Multi-tenant maturity
> "Yes it is designed, thats why everywhere company id filtering is added"

### ⭐ Day 11: Lead Lifecycle
> "if you look at our design it the new buyers we create as lead, and remain as lead contacts"

> "The minute we attach an opportunity/sale is confirmed we should convert them to as customers"

> "this will help us segregate and we should also look at putting things as investors or simple buyers"

### ⭐ Day 11: Communications gap
> "all the docs, reports and mails needs to be relooked at the end which are at the moment very minimal below the basic level"

### ⭐ Day 11: Lead Activity logging vindication
> "100% gut feeling of having this feature, just that the heading i have forgotten"

(Past chats confirmed feature existed in design + user guide. Restored 23 May commit `91f46c2`.)

### ⭐ Day 11: State Management gap
> "I cant tell the customers to keep refreshing always, which shows a flaw in the system correct"

> "I need solution, you can decide... I can always refresh and show them and make my excuse with investor but not with the client"

### ⭐ Day 11: Architectural debt awareness
> "we have duplicated code in App.jsx. which we need to manage, and we are not doing a normalised development at the moment"

---

## SECTION 6 — Investor Q&A Backing

### Q: "What's NOT built yet?"
A: Be specific:
- "Discount approval workflow is built but hidden — developer persona ready when we add developer-side users"
- "Role-aware Manager Dashboard is Phase 2 (July)"
- "PDF proposal generation is Phase 2 (July) — text-based proposals sufficient for broker-buyer communication today"
- "Real-time sync is Phase 2.0 PRIORITY 0 — foundation before client deployment"

### Q: "How do you scale to 100 brokerages?"
A: "Multi-tenant from day one — `company_id` filtering on every query. Per-company branding + AI naming + plan tiers. Permissions framework supports custom roles per brokerage in Phase 2."

### Q: "What about state sync / real-time updates?"
A: "PropCRM is real-time-capable. Phase 2.0 adds Supabase Realtime subscriptions for full instant sync across users and tabs. Data integrity is rock-solid; sync layer is the polish we add for production. Demo runs with occasional manual refresh; client deployment ships with full real-time."

### Q: "How do you segment customers for marketing?"
A: "Phase 2 (Q3 2026) adds lifecycle management — leads automatically convert to customers when SPA signed — plus buyer intent: Investor / Owner-Occupier / Hybrid / Corporate / Reseller. Unlocks targeted campaigns."

### Q: "What about emails, reports, documents?"
A: "Phase 1 today is workflow-focused. Phase 2 Communications Overhaul (4 weeks Q3 2026) brings all output to executive standard — branded PDFs, professional emails, WhatsApp Business API, automated reports."

### Q: "Where's your roadmap?"
A: Show Section 4. "We've planned through Q4 2026 with specific deliverables, not just slides."

---

## SECTION 7 — Document Cross-Reference

| Document | Subject |
|---|---|
| `Phase_2_Proposal_Communication_Model.md` | PDF + Developer upload (Brahma Lipi) |
| `Phase_2_Role_Based_Dashboard_Vision.md` | Manager view |
| `Phase_2_Activity_Logging_Everywhere.md` | FAB universal logging |
| `Phase_2_Lead_Lifecycle_Segmentation.md` | Buyer journey + marketing |
| `Phase_2_Communications_Overhaul.md` | Comprehensive output overhaul |
| `Phase_2_State_Management_RealTime_Sync.md` | PRIORITY 0 foundation |
| `Dev2_Refactor_Activity_Logging.md` | Architectural debt cleanup |
| `Day9_App_Audit_Strategic_Plan.md` | Day 9 audit findings |
| `Investor_Demo_Script_v3_1_21May2026.md` | Demo script (references this) |

---

## SECTION 8 — Day 11 Saturday Summary

**Commits today:**
1. `91f46c2` — Lead Detail activity logging RESTORED (~183 lines)
2. `1fb1a77` — Phase 2 docs: Dev2 refactor + Lead Lifecycle
3. `f3571e1` — Phase 2 docs: Communications + State Management

**Key learnings:**
- **Trust founder pattern recognition.** Past chats + user guide confirmed restored feature existed.
- **React SPA state management** is a real production issue (Phase 2.0 PRIORITY 0)
- **Lead lifecycle + buyer segmentation** = strategic moat
- **Communications domain** is the weakest area = comprehensive Phase 2 overhaul needed
- **Architectural debt acknowledged** + scheduled for dev2

**Run-through #1 completed:**
- All 8 sections validated end-to-end (Opening + 7 Scenes + Closing)
- Architectural separation works
- AI Coach validated as ⭐⭐⭐⭐⭐
- Demo flow demo-ready

**Pending (Day 12+):**
- Sample brochures upload
- "abc" test project cleanup
- SPA discussion (after booking/payment clarity)
- Dev2 strategy decision (founder said tomorrow evening)
- Run-through #2 (with refinements)
- Mock investor sessions

---


## SECTION 8.5 — Day 12-14 Summary (Phase 2.0 + 2.1 SHIPPED)

**Day 12 (24 May 2026, Sunday):**
- Built `useRealtimeSubscription` hook (`e60e8ab`) — DRY pattern for Supabase Realtime subscriptions
- Wired Realtime INSERT subscription to proposals table
- Hit StrictMode duplicate-key issue — Realtime fired twice in dev, caused React warnings
- Founder questioned whether Realtime even solved Saturday's symptom (Mayya proposals missing)
- Decision: abandon Realtime INSERT approach, keep hook for future multi-user use, find simpler fix

**Day 13 (25 May 2026 morning):**
- Root-caused Saturday's bug — not stale state, but `OpportunityDetail` component instance being reused across navigation without remount, so `useEffect([opp.id])` never re-fired
- Fixed with 2-line `key={selOpp.id}` change at both render sites (`bfb1050`)
- Audited all other detail components — Lead detail uses parent state (immune), all dialogs unmount cleanly (immune). No other instances of the bug.
- Cleanup: deleted 50 obsolete fix scripts, gitignored `test-data/` (`9da9994`)

**Day 14 (25 May 2026 afternoon):**
- Built FAB on Opportunity Detail (`3bed195`) — stacks above AI Coach at `bottom:96`, reuses `LogActivityModal`
- Built FAB on Lead Detail (`a7395e7`) — `bottom:24`, reuses richer 23 May `showLeadLog` modal with next-step reminders
- Caught one bad `sed` insertion (FAB outside root `<div>`), reverted with `git checkout`, redid at correct line — zero damage
- Material Design FAB convention: primary action highest in thumb zone

**Key learnings (Days 12-14):**
- **Match solution to actual symptom.** Day 12 reached for Realtime architecture when the actual bug was a missing `key` prop. Trust founder's pattern-recognition pushback.
- **Smaller fix = lower risk.** Day 13's 2-line change beat Day 12's 100+ line hook wiring for the same problem.
- **Reuse existing modals, don't duplicate.** Lead Detail FAB reuses the 23 May logging system rather than introducing `LogActivityModal` — preserves richer feature set, avoids regression.
- **Revertable checkpoints work.** Bad sed → `git checkout src/App.jsx` → clean re-do. One commit per logical change makes recovery trivial.

**Commits (Days 12-14):**
1. `e60e8ab` — Realtime hook (Day 12, preserved for future)
2. `bfb1050` — Mayya bug fixed (Day 13)
3. `9da9994` — Cleanup (Day 13)
4. `3bed195` — FAB on Opp Detail (Day 14)
5. `a7395e7` — FAB on Lead Detail (Day 14)

**Status:**
- ✅ Phase 2.0 (State Management) — Saturday's symptom resolved
- ✅ Phase 2.1 Stage 2 (FAB on detail screens) — Option X scope shipped
- 📋 Phase 2.1 Stage 3 (FAB on Dashboard/lists) — deferred to Option Y if needed post-demo
- ⏭️ Next: Phase 2.2 — Lead Lifecycle & Buyer Segmentation

## SECTION 9 — Update Discipline

**This document gets updated when:**
- New Phase 2 item identified
- Phase 1 feature hidden for demo
- Phase 2 item completes and graduates to Phase 1
- Investor Q&A reveals question not yet addressed
- New strategic vision from founder

**Don't fragment Phase 2 into tiny docs.** Add sections HERE.  
Exception: Big design specs get own doc, but referenced here.

---

*Document created: 21 May 2026 (Thursday afternoon, Day 9)*
*Last major update: 23 May 2026 (Saturday afternoon, Day 11)*
*Status: Live document, will update through Phase 1 + Phase 2 build*
