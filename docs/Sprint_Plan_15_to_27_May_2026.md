# Sprint Plan: 15 May → 27 May 2026
**PropPlatform Math Flow + AI Integration Sprint**

**Created:** 13 May 2026 (Wednesday afternoon)
**Status:** APPROVED for execution
**Duration:** ~2 weeks (calendar time including weekends)
**Outcome:** Investor-ready demo with math integrity + AI dominance + broker UX excellence

---

## 0. Context & Decision Trigger

**13 May 2026, Wednesday:** End-to-end acid test by founder revealed math flow
issues across stages. Discounts entered at Proposal don't carry to Acceptance.
SPA price picks from buyer's budget instead of negotiated final price. DLD
fees mentioned but not enforced. Multiple "already done" stages re-open as
blank forms.

**Combined with:** Investor has previously told founder *"fix the basics
first, no broker will buy this until then."* Founder has shown rich features
3 times. Math basics not yet solid.

**Universe gift:** Investor delayed (stuck in UK for 2 weeks). Founder
postpones tester visit to Mon-Tue 19-20 May, investor demo to ~22-27 May
range when investor returns.

**Result:** 2 weeks of focused work to ship something founder is proud of
rather than apologetic for.

---

## 1. Founder Principles (Direction-Setting)

These principles govern every decision in this sprint:

### Principle 1: Logic and Math Married
> *"ensure the logic and math are married together"* — Founder, 13 May 2026

**Translation:** Every calculation flows from ONE source of truth. No
duplicated price fields. No "list price here, budget there, offer price
somewhere else." Each stage READS the carried-forward values, MODIFIES with
its own contribution, WRITES updated state, then carries forward to next
stage.

**Anti-pattern (current state):**
- `opp.budget` (buyer budget)
- `opp.offer_price` (set at Offer Accepted)
- `opp.final_price` (set at SPA Signed)
- `pp_sales_closures.final_sale_price` (yet another)
- Discount % captured at various stages independently
- DLD/admin/trustee fees mentioned but not enforced

**Target pattern (sprint outcome):**
```
opp.current_agreed_price   ← single source of truth
opp.current_discount       ← % OR amount, not both
opp.current_fee_breakdown  ← DLD, admin, trustee, etc.
opp.current_commission     ← derived from agreed_price + commission_pct
```

Each stage gate reads these, modifies, writes back, carries forward.

### Principle 2: AI Dominant Everywhere
> *"AI being more dominant, push as much and whereever you can heron to all
> the new flows and the only support system to brokers"* — Founder, 13 May 2026

**Translation:** AI is not a feature bolted onto a CRM. AI is the **operating
system** of PropCRM. Every flow, every form, every decision point asks
*"where does AI reduce broker cognitive load?"*

**AI roles in every flow:**

| Role | Examples |
|---|---|
| **Pre-fill** | Form fields auto-populated from prior stages |
| **Validate** | "This discount is 8% — your developer threshold is 5%. Approve override?" |
| **Suggest** | "Based on this client's profile, suggest 2BR or 3BR" |
| **Flag** | "This offer price is 15% below comparable units" |
| **Guide** | "Next action: confirm reservation amount with buyer" |
| **Calculate** | "Final price after 3% discount = AED 7,547,635" |
| **Compose** | "Draft proposal email — review and send" |
| **Explain** | "Why this rejected: master agreement requires escrow setup first" |

### Principle 3: Protect Broker Eyes
> *"the only support system to brokers which should not take their eyes out"*
> — Founder, 13 May 2026

**Translation:** Brokers don't read complex forms. They don't memorize
workflows. They don't calculate. They **answer prompts**, **confirm AI
suggestions**, and **act on guidance**.

**Anti-patterns to eliminate:**
- Long forms with 15 fields
- Manual price calculations
- Re-entering data already known
- Free-text fields where structured data exists
- "Did I miss anything?" anxiety

**Target patterns:**
- AI fills, broker confirms
- AI asks one question at a time when needed
- AI shows summary before action
- AI flags anything unusual proactively
- Confirmation > entry

### Principle 4: Solid + Enhanceable
> *"some things can always be left for enhancements"* — Founder, 13 May 2026

**Translation:** Not everything ships in 2 weeks. What ships must be **rock
solid**. What's missing should be **clearly noted** as enhancements without
holding up demo readiness.

**Decision rule:** If a feature is *"nice to have"* and not directly demoed,
defer it. If a feature is *"core math/flow"* and demoed, build it solid.

---

## 2. Math Flow Architecture (Single Source of Truth)

### 2.1 Schema additions (minimal)

Add to `opportunities` table:
```sql
-- Current agreed values (updated by each stage)
current_agreed_price       NUMERIC      -- the "live" price
current_discount_type      TEXT         -- 'percent' or 'amount' or null
current_discount_value     NUMERIC      -- the % or the AED amount
current_discount_source    TEXT         -- 'proposal', 'negotiation', 'override'

-- Fee structure (snapshot at each stage)
current_dld_payer          TEXT         -- 'buyer', 'developer', 'split', 'negotiated'
current_dld_split_pct      NUMERIC      -- if split, broker's portion (0-100)
current_admin_fee          NUMERIC      -- AED admin charges (varies by developer)
current_trustee_fee        NUMERIC      -- AED trustee fees
current_oqood_fee          NUMERIC      -- AED Oqood registration

-- Computed snapshots (for history)
final_net_price            NUMERIC      -- after all discounts
final_commission           NUMERIC      -- broker's earning
```

### 2.2 Stage data flow

**Proposal stage:**
- READS: `salePricing.asking_price`, developer payment plan
- COMPUTES: `current_agreed_price` = asking_price - discount
- WRITES: `current_discount_type`, `current_discount_value`, `current_agreed_price`
- CARRIES: All proposal terms to Negotiation

**Negotiation stage:**
- READS: All from Proposal
- MODIFIES: Possibly new discount, DLD split, payment plan adjustments
- WRITES: Updates `current_*` fields with negotiated values
- DOCUMENTS: Each round of negotiation logged as activity
- CARRIES: Final negotiated values to Acceptance

**Offer Accepted stage:**
- READS: All from Negotiation (FINAL agreed values)
- DISPLAYS: As confirmation, NOT as new entry
- WRITES: `opp.offer_price` = `current_agreed_price` (snapshot)
- LOCKS: `stage_lock_offer_accepted = true` (cannot change without override)

**Reserved stage:**
- READS: `current_agreed_price` (display only)
- ASKS: Reservation amount (10% typical, configurable per developer)
- WRITES: `opp.reservation_amount`, `opp.reservation_date`
- TRIGGERS: 5-working-day timer

**SPA Signed stage:**
- READS: `current_agreed_price` (the FINAL number from Acceptance)
- DISPLAYS: Pre-filled, editable only with override warning
- ASKS: SPA date, reference, down payment method, fee breakdown
- WRITES: `opp.final_price` = `current_agreed_price` (snapshot)
- VALIDATES: All payments + documents present (warning if missing)

**Closed Won stage:**
- READS: Everything (final state)
- VERIFIES: SPA signed, final payment received
- WRITES: `opp.stage = "Closed Won"`, `final_net_price`, `final_commission`
- TRIGGERS: Commission outstanding entry

### 2.3 Discount handling (% OR amount, never both)

**UX:**
```
Discount: [● Percent] [○ Amount]

If Percent selected:
  Enter %: [___]
  Calculated amount: AED [auto] (read-only)
  Final price: AED [auto] (read-only)

If Amount selected:
  Enter AED amount: [___]
  Calculated %: [auto]% (read-only)
  Final price: AED [auto] (read-only)
```

**Storage:**
- `current_discount_type` = 'percent' OR 'amount'
- `current_discount_value` = the value entered
- Computed final price = ALWAYS derived, never stored separately
- ONE source of truth, no conflict

### 2.4 Fee enforcement

When unit is selected at Proposal stage, AI auto-loads:
- DLD 4% (UAE standard)
- AED 580 admin (UAE standard)
- AED 4,200 trustee (off-plan only, AI detects from unit.type)
- Developer-specific fees (from `pp_developers` table if configured)

These appear in proposal as:
- ✅ "DLD 4%: AED 311,572 — buyer pays" (editable in negotiation)
- ✅ "Admin: AED 580 — buyer pays"
- ✅ "Trustee: AED 4,200 — buyer pays"

NOT optional to skip. Mandatory in calculation.

---

## 3. AI Integration Points (Detailed)

### 3.1 Lead Entry → AI Match
**Current:** Broker enters lead, AI Match runs.
**Sprint adds:** AI auto-suggests budget tier based on phone/email patterns + early interactions. Broker can override.

### 3.2 Proposal Stage → AI Compose + Validate
**Current:** Broker manually fills proposal.
**Sprint adds:**
- AI pre-fills based on unit + AI Match insights
- AI suggests discount tier based on inventory health (slow movers get more)
- AI validates against developer rules (e.g., "Aldar max 5% without approval")
- AI composes proposal PDF (not email — proper document)

### 3.3 Negotiation Stage → AI Flag + Suggest
**Current:** Broker enters new discount/terms.
**Sprint adds:**
- AI carries forward proposal values
- AI flags if new discount exceeds threshold ("Discount > 5%, requires approval")
- AI suggests counter-offers ("Buyer asking 8%, developer typically accepts 4-6%")
- AI auto-updates payment plan based on developer rules

### 3.4 Acceptance Stage → AI Verify + Confirm
**Current:** Broker enters agreed price (often wrong number).
**Sprint adds:**
- AI displays final negotiated values (read-only)
- AI asks one question: "Confirm buyer has accepted these terms?"
- AI auto-locks values upon confirmation
- AI prompts: "Send signed proposal to developer?"

### 3.5 Reservation Stage → AI Configure + Track
**Current:** Broker enters reservation amount, timer starts.
**Sprint adds:**
- AI suggests amount based on developer's standard (typically 5-10%)
- AI tracks timer with reminders ("3 working days left")
- AI prompts: "Buyer paid by cheque #__? Upload receipt?"

### 3.6 SPA Stage → AI Pre-fill + Validate
**Current:** Broker re-enters all numbers (currently wrong sources).
**Sprint adds:**
- AI pre-fills EVERYTHING from carried values
- AI validates all required documents present
- AI flags missing items ("KYC not uploaded — collect before SPA?")
- AI suggests SPA date based on developer's calendar

### 3.7 Closed Won Stage → AI Verify + Celebrate
**Current:** Broker clicks confirm.
**Sprint adds:**
- AI runs final checklist (payments received, docs signed, fees recorded)
- AI generates commission entry automatically
- AI creates handover checklist (keys, utilities, snagging)

### 3.8 PropPulse (background) → AI Living Engine
**Current:** Static dashboard.
**Sprint adds (within scope):**
- Refresh when prices change
- Personal pulse: "Your client Mohammed Ali matches new unit X"
- Company pulse: "Inventory health 89% priced"

**Defer to Phase C:**
- Market pulse (cross-company)
- Advanced AI Match re-scoring

---

## 4. Day-by-Day Sprint Plan

### Day 1: Wednesday 13 May (today, late afternoon)
**Status:** Planning complete (this doc)
**Deliverable:** Sprint plan approved by founder
**Code work:** None today (decisions only)

### Day 2: Thursday 14 May
**Focus:** Schema + math flow foundation
**Tasks:**
- Add `current_*` columns to opportunities (Supabase migration)
- Audit all existing opps for data backfill (set current_agreed_price = best available)
- Refactor Proposal stage to write `current_*` fields
- Test: create new opp, verify Proposal writes correctly

**Deliverable:** Math foundation tested. Existing opps migrated.

### Day 3: Friday 15 May
**Focus:** Negotiation → Acceptance flow
**Tasks:**
- Negotiation stage reads/writes current_* fields
- Discount handling (% OR amount toggle)
- Acceptance stage displays final values as confirmation
- "Already accepted" detection → readonly view

**Deliverable:** Math flow from Proposal → Negotiation → Acceptance ties together. Discount is single source of truth.

### Day 4: Saturday 16 May (weekend, lighter day)
**Focus:** SPA Signed math fix + DLD/fee enforcement
**Tasks:**
- SPA dialog uses `current_agreed_price` (not budget!)
- DLD/admin/trustee fees enforced in proposal stage
- AI pre-fills SPA from carried values
- Test: 7.6M opp flows correctly through all stages

**Deliverable:** End-to-end math tested with founder's acid test scenario.

### Day 5: Sunday 17 May (rest day, optional polish)
**Focus:** Optional — "Already in stage" UX fix
**Tasks:**
- Detect opp.stage matches showStageGate
- Show readonly view of stored data
- Provide Edit/Re-record buttons
- Apply to all 5 gates

**Deliverable:** No more blank forms on already-completed stages.

### Day 6: Monday 18 May
**Focus:** AI integration round 1 (high-value points)
**Tasks:**
- Proposal AI compose (PDF generation, not email)
- Negotiation AI flag (discount thresholds)
- Acceptance AI confirmation flow
- Test all AI integrations

**Deliverable:** AI visible at every stage gate.

### Day 7-8: Tuesday-Wednesday 19-20 May — TESTER VISIT
**Focus:** Validate with brokers, capture feedback
**Tester agenda:**
- Day 1: Walk through full flow with tester acting as broker
  - Capture every "this should..." moment
  - Use Section 7 of Real_Estate_Workflow_Spec.md (23 questions)
- Day 2: Show fixes from Day 1 feedback, capture any remaining gaps

**Deliverable:** Tester-validated workflow. Founder's understanding confirmed or refined.

### Day 9: Thursday 21 May
**Focus:** Apply tester feedback
**Tasks:**
- Triage tester findings (P1/P2/P3)
- Fix all P1 issues
- Document P2/P3 for Phase B
- Re-test affected flows

**Deliverable:** Tester P1 issues resolved.

### Day 10: Friday 22 May
**Focus:** Final polish + dry-run
**Tasks:**
- Final clean dry-run by founder
- Catch any remaining issues
- Deploy to production
- Verify production URL works

**Deliverable:** Production-ready. Demo URL tested.

### Day 11-13: Weekend (rest if possible)
**Focus:** Buffer + practice demo script
**Tasks:**
- Practice 25-min demo walkthrough
- Time each section
- Refine narrative
- Rest

**Deliverable:** Confident demo delivery.

### Day 14: Investor demo day (whenever investor returns, ~22-27 May)
**Focus:** Show what you're proud of
**Outcome:** Math ties. AI visible. Brokers will trust this.

---

## 5. Out of Scope (Deferred to Phase B/C)

These are GOOD enhancements but won't block demo:

### Phase B (later sprint, June 2026)
- "Already in stage" readonly UX (if not Day 5)
- Document checklist tracking
- Payment plan as derived from developer (not free text)
- Browser back/forward navigation (React Router)
- Service charges field
- Booking amount distinct from reservation
- Master agreement enforcement gates

### Phase C (post-funding)
- Hierarchical sub-stages between SPA Signed → Closed Won
- Background ops workflow (authorities, sale deed prep)
- Buyer signing flow (in-person vs remote)
- Real workflow modeling (10+ sub-states)
- Multi-tenant customization per developer
- Buyer-type-specific flows
- PropPulse Market Pulse layer

---

## 6. Success Criteria for Investor Demo

The demo is "ready" when ALL of these are TRUE:

### Math Integrity
- ✅ End-to-end test: 7.6M opportunity flows correctly
- ✅ Discount entered at Proposal appears at Acceptance unchanged
- ✅ DLD/admin/trustee fees calculated and enforced
- ✅ SPA price = negotiated final price (NOT buyer budget)
- ✅ Commission calculated from final price + commission_pct
- ✅ No discrepancies between stages

### AI Visibility
- ✅ AI visible at Proposal (compose, validate)
- ✅ AI visible at Negotiation (flag, suggest)
- ✅ AI visible at Acceptance (confirm)
- ✅ AI visible at SPA (pre-fill all fields)
- ✅ AI visible at Closed Won (verify checklist)
- ✅ PropPulse shows intelligence (not static dashboard)

### Broker UX
- ✅ Stage transitions guided, not free-form
- ✅ Forms minimize typing (AI fills, broker confirms)
- ✅ Already-completed stages show readonly view (no blank forms)
- ✅ AI prompts brokers on next action

### Architecture
- ✅ Single source of truth for prices
- ✅ Stage cascade verified working
- ✅ Code committed and pushed
- ✅ Tester validation completed

### Story
- ✅ 25-min walkthrough practiced
- ✅ "PropCRM is AI-native, not CRM + AI" narrative ready
- ✅ Phase B/C roadmap documented for "what's next" question

---

## 7. Communication Plan

### To investor (postponement message — to send today/tomorrow)
```
Hi [Investor],

Quick honest update on this week's planned demo:

I did end-to-end testing today and found math flow gaps — exactly the 
"fix the basics first" point you raised last time. I'm not going to 
waste your time with another demo that has the same issue.

Good news on timing: I understand you're stuck in UK for a couple of 
weeks anyway. By the time you're back in Dubai, I'll have:
- Math flowing correctly end-to-end across all stages
- Broker tester validation completed
- AI integration deeper in every stage

Apologies for needing the delay. I'd rather show you something I'm 
proud of than rush this week.

Best,
Abid
```

### To testers (reschedule message — to send today/tomorrow)
```
Hi [Tester],

I'm pushing our Thursday session to Monday 19 May (and adding 
Tuesday 20 May). 

I found some math flow issues in my pre-walk-through testing that I 
want to fix before showing you. Better to validate working software 
than test broken math.

The longer session lets us go deep — I have 23 specific questions 
about real broker workflow I want your input on. Your time will be 
better spent on a corrected product.

Looking forward to it.

Best,
Abid
```

---

## 8. Risk Management

### What can go wrong
1. **Math fixes break existing flows** → Mitigation: Tag before each change, atomic edits, instant revert
2. **Schema changes lose data** → Mitigation: Backfill script, test on copy first
3. **Founder fatigue mid-sprint** → Mitigation: Day 5 (Sunday) is rest day, build buffer
4. **Tester finds bigger issue** → Mitigation: 1 day buffer between testers and demo
5. **Investor returns sooner** → Mitigation: Demo can be ready by Day 10 if needed

### Safety nets
- ✅ Daily commits with descriptive messages
- ✅ Daily tags before risky changes
- ✅ Golden tag preserved (v1.5-stage-gates-complete-pre-demo)
- ✅ Feature_Backlog.md captures deferred items so they're not lost
- ✅ This document is the source of truth for sprint scope

---

## 9. Definition of "Done" (per task)

A task is DONE when:
- ✅ Code committed to main with descriptive message
- ✅ Pushed to GitHub
- ✅ Tested in browser (specific scenario verified)
- ✅ Console clear of errors
- ✅ Founder approved the visible change

A stage is DONE when:
- ✅ All tasks for that stage DONE
- ✅ End-to-end test from previous stage works
- ✅ Carries forward correctly to next stage

The sprint is DONE when:
- ✅ All 6 Success Criteria sections (Section 6) marked complete
- ✅ Production deployed and verified
- ✅ Founder has practiced demo 3+ times

---

## 10. Founder Notes Section

(Reserved for founder annotations as sprint progresses)

### Day-by-day diary

**Day 1 — 13 May 2026 (today):**
- ✅ Acid test revealed math gaps
- ✅ Investor postponement decided
- ✅ Sprint plan approved
- 🎯 Tomorrow: start Day 2 work

**Day 2 — [to fill]**
- 

**Day 3 — [to fill]**
- 

---

*Document started: 13 May 2026, Wednesday afternoon*
*Author: Claude (in collaboration with founder Abid Mirza)*
*Document status: APPROVED for execution upon founder review*
