# Workflow Clarity — Final
**Broker vs Developer Responsibilities (Confirmed by Founder)**

**Created:** 16 May 2026 (Saturday morning)
**Status:** ✅ CONFIRMED by founder
**Purpose:** Strategic clarity to guide SPA dialog refactor + Phase B architecture
**Launch target:** July 1, 2026

---

## 1. The Killer Insight

**PropCRM exists BECAUSE:**

> *"broker's CRM just keeps the info to ensure things or not pending and he has to follow up not based on logging to Developers systems developer's system, he has to refer 2 systems and some developers don't give the all the agents access as the cost for them is very high"*

### Translation
- Brokers work with MULTIPLE developers
- Most developers don't give brokers access to their systems (cost-prohibitive)
- Brokers need a UNIFIED tracker across all deals, all developers, all pipelines
- **PropCRM is broker's "source of action"** — where they take action
- **Developer system is "source of truth"** — where official records live
- Broker REFERENCES developer system, ACTS in PropCRM

### Investor narrative
> "Brokers work with 5-15 developers. Each developer's CRM access costs $X/month
> per agent. PropCRM is brokers' unified deal-management layer — one view across
> all developers, all pipelines. They look up facts in developer systems. They
> take action in PropCRM. It's the meta-system every broker needs but couldn't
> afford to build alone."

**This positioning is investor-pitch gold.**

---

## 2. Founder-Confirmed Workflow Truths

### Q1: Does broker enter SPA terms or does developer?
**Answer:** Developer (usually)

**Implication:** SPA dialog is a CONFIRMATION FORM. Broker reads from developer source, types into PropCRM for own records.

### Q2: Who decides DLD split — developer or broker negotiation?
**Answer:** Developer

**Implication:** DLD payer comes from developer's authorized terms (captured in proposal). Broker doesn't negotiate DLD — broker captures what developer authorized.

### Q3: Are pre-SPA payments tracked by broker (commission protection) or developer (cash flow)?
**Answer:** Developer collects, but broker does ALL follow-ups and ensures payments made

**Implication:** Pre-SPA payment fields in PropCRM are broker's **FOLLOW-UP TRACKER**, not the official record. The Pending/Received/Waived statuses are broker's view of "did developer collect this yet?"

### Q4: What's the source of truth for SPA?
**Answer:** Developer's system. Broker's CRM just keeps the info to ensure things not pending. Broker refers to BOTH systems.

**Implication:** PropCRM doesn't replace developer system. It SUPPLEMENTS it. Broker uses both.

---

## 3. SPA Dialog Specific Issues (Founder Confirmed)

### Issue 1: Down Payment vs Initial Payment are the same
**Founder verbatim:**
> "Down Payment & Initial Payment are same as far as I understand business"

**Action for Tuesday's refactor:**
- Merge into ONE field
- Suggested label: "Down Payment / Initial Advance"
- Remove redundancy

### Issue 2: Reservation Fees / Booking Fees — confirm with broker
**Founder verbatim:**
> "is what I said I will confirm after having a word with the broker whether 
> then need 2 fields or 1 here"

**Action:** Don't change yet. Mark as P2 pending broker verification.

**Test plan:** When tester visits, ask: "Are reservation and booking fees ever DIFFERENT amounts? Or do they collapse?"

### Issue 3: Missing pre-fills (CRITICAL)
**Founder verbatim:**
> "All the fields we have in the Negotiations and Final Accepted proposal. 
> reservations/fees/booking fees if collected and the final proposal conditions 
> accepted Final proposal Accepted, should be part of pre filled"

**Action for Tuesday's refactor — Major work:**

When SPA dialog opens:
1. Read latest accepted proposal (V_latest where status = 'accepted')
2. Pre-fill from proposal:
   - Final agreed price ← `proposal.discounted_price`
   - DLD payer ← derived from `proposal.dld_handling`
   - DLD split percentage ← from proposal
   - Payment plan structure ← from `proposal.payment_plan_preset`
   - Service charge waiver ← from proposal
   - Validity terms ← from proposal
3. Also pre-fill from earlier captures:
   - Reservation fee amount ← `opp.reservation_amount`
   - Reservation fee date ← `opp.reservation_date`
   - Booking fee amount ← `opp.booking_amount`
   - Booking fee date ← `opp.booking_date`

**This is the Final-Proposal-First pattern applied to SPA stage.** ✓

### Issue 4: DLD section should show agreed conditions
**Founder verbatim:**
> "there are 2 sections pre SPA Payment Status should clearly show all the 
> agreed conditions from the Final Proposal and should match in the detail 
> math below"

**Action:**
- DLD section should display what was AGREED in Final Proposal
- Math below SPA must MATCH the proposal's agreed terms
- Currently shows generic 4% — should show 50/50 split if that's what was agreed
- Visual indicator: "From Proposal V3: 50/50 split between buyer and developer"

### Issue 5: Final Agreed Price readonly
**Founder verbatim:**
> "the readonly state issue (we fixed)"

**Status:** ✅ FIXED in Day 3 of Math Flow Sprint. Confirmed working.

### Issue 6: Visual/UX
**Founder verbatim:**
> "For me it looks enough and we close"

**Action:** No visual redesign. Focus on data flow, not aesthetics.

---

## 4. Three Categories of Data (Refined)

### Category A: BROKER-OWNED (PropCRM is source of truth)
- Sales notes
- Buyer relationship details
- Activity log
- Follow-up reminders
- **Commission tracking** (PROBABLY the most valuable broker-owned data)

### Category B: DEVELOPER-OWNED (PropCRM stores broker's COPY)
- Final agreed price
- SPA Reference Number
- DLD policy (payer, amount, split)
- Payment plan structure
- Pre-SPA payment receipts
- Service charge waiver decisions

**UX implication:** These fields should be PRE-FILLED from proposal (developer-issued terms), with broker just CONFIRMING they match what they received from developer.

### Category C: BUYER ACTIONS (PropCRM observes)
- Acceptance of terms (broker captures)
- Signing of documents (broker uploads copy)
- Payment timestamps (broker tracks for follow-up)

---

## 5. Strategic Direction

### Tuesday's SPA Refactor — Crystal Clear Spec
1. **Pre-fill ALL fields** from latest accepted proposal + earlier captures
2. **Combine Down Payment + Initial Advance** into one field
3. **DLD section** displays what was agreed in proposal (with source reference)
4. **Math below** uses proposal's terms (not generic 4%)
5. **NO visual redesign** — keep current layout
6. **Reservation/Booking fees** — leave alone, confirm with broker post-tester

### Phase B Architecture — Now Crystal Clear
**Final-Proposal-First is the ANSWER.**

```
opp.final_proposal_id → proposals.id (the canonical version)
                       ↓
                  Every stage reads from this ONE source
                       ↓
                  SPA = "Confirm developer's authorized terms"
```

**This eliminates:**
- Sync bugs between current_* and proposal data
- "Why is DLD showing 4% when proposal said 50/50?"
- Re-entry of known information
- Broker confusion about "which is the latest?"

### July 1, 2026 Launch Target
- Today (May 16) → July 1 = **~6 weeks**
- Math Flow Sprint: ✅ Complete (3 days)
- Roadmap week (19-25 May): Polish + Tester prep
- Tester visit: Mon-Tue 19-20 May (now postponed to following week)
- Investor demo: ~22-27 May
- Phase B (Final-Proposal-First): June 2026 (~4 weeks)
- Polish + launch prep: Late June

**Timeline is TIGHT but achievable** with disciplined execution.

---

## 6. Decisions Locked

| Decision | Status |
|---|---|
| SPA is confirmation form, not creation form | ✅ Locked |
| Pre-fill from latest accepted proposal | ✅ Locked |
| Combine Down Payment + Initial Advance | ✅ Locked |
| Don't redesign visuals | ✅ Locked |
| Final-Proposal-First is the architecture | ✅ Locked |
| Two-system reality is the value proposition | ✅ Locked |
| Reservation vs Booking — confirm post-tester | ⏳ Pending |
| Override price behavior | ⏳ TBD |
| Multi-developer customization | ⏳ Phase B |

---

## 7. Action Plan

### Today (Saturday afternoon, if energy permits)
- This document committed to docs/
- Optional: small quick wins from backlog
- Real rest in evening

### Sunday
- Genuine rest
- Maybe light reading/thinking

### Monday 19 May
- ARCH-SIMPLIFY-002 (Remove Advance to Proposal Sent button) — 1.5 hr
- BUG-ACTIVITY-DUPLICATE (Failed save creates phantom activity) — 30 min

### Tuesday 20 May
- **SPA refactor** — pre-fill from proposal + combine fields (HALF DAY)
- This is now well-scoped thanks to today's clarity

### Wednesday 21 May
- UX-PROPOSAL-HISTORY-001 (show proposal history on opp screen)
- Builds on today's principle (single source of truth via proposal)

### Thursday 22 May
- UX-COMPLETED-STAGE-001 (clicking completed stage shows readonly)
- Buffer for issues found in earlier work

### Friday 23 May
- Tester visit smoke test
- Final polish
- Golden tag: `v2.5-tester-ready`

### Following week (26 May onwards)
- Tester visit
- Tester feedback applied
- Investor demo preparation

### June 2026 (Phase B)
- Final-Proposal-First architecture implementation
- PDF generation for proposals
- pp_negotiations subsystem refinement

### Late June
- Polish + launch prep
- Documentation
- Onboarding flow

### July 1, 2026
- 🚀 LAUNCH

---

## 8. Investor Pitch Components (Built Today)

### The Problem
> "Brokers work with multiple developers but can't afford access to each
> developer's CRM. They lose deals because they can't track follow-ups across
> systems. Commission disputes happen because there's no unified audit trail."

### The Insight
> "Brokers don't need a better developer CRM. They need a META-CRM. One layer
> above all developer systems. Where they take action. Where they track. Where
> they get paid."

### The Architecture (Final-Proposal-First)
> "Every deal references one canonical proposal version. That proposal contains
> the developer's authorized terms. PropCRM eliminates entire categories of
> sync bugs by making the proposal the single source of truth. Brokers see
> the latest agreed terms. Math always matches. Audit trail is complete."

### The Math Flow (Proven 15 May 2026)
> "Asking price 623,694. Proposal V3 sent with 3% discount → 604,983 final price.
> 50/50 DLD split → broker pays 12,099.66. Commission base = 604,983 × 4% = 24,199.32.
> VAT 5% = 1,209.97. Net broker take = 25,409.29. Every number traces to its source.
> Every stage shows the same math. Every change is auditable."

### The Methodology
> "We built this through methodical dry-run integration testing. Not unit tests.
> Real broker workflows tested end-to-end. Bugs found before customers hit them.
> Architecture documented while building. This is what disciplined startup
> engineering looks like."

---

## 9. Risks to July 1 Launch

### Risk 1: Tester feedback is heavy
**Mitigation:** Postpone testers to Mon 26 May to give buffer week.

### Risk 2: Investor demo doesn't close
**Mitigation:** Have working product, math flowing. That alone is impressive.

### Risk 3: Phase B Final-Proposal-First refactor breaks things
**Mitigation:** Build in backwards compatibility. Don't remove current_* until June end.

### Risk 4: Solo founder burns out
**Mitigation:** Weekly weekend rest (this Saturday strategy pause = good model).

### Risk 5: Multi-developer support not ready
**Mitigation:** Launch with single-developer support, add multi-dev post-launch.

---

## 10. What Made This Saturday Special

**Most founders skip this kind of strategic pause.** They keep coding until they burn out, then refactor everything in v2.

**You did the opposite:**
- Recognized confusion before fixing UI
- Articulated WHY PropCRM exists (the killer insight)
- Confirmed responsibility boundaries
- Made decisions for Tuesday's refactor
- Documented for future you

**Tomorrow's you will thank today's you.**

---

*Document created: 16 May 2026 (Saturday morning)*  
*Purpose: Strategic clarity locked in*  
*Status: APPROVED by founder*  
*Next: Tuesday SPA refactor with clear specs*  
*Launch target: July 1, 2026*
