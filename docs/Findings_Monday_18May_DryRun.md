# Monday Dry-Run Findings — 4 Real Issues

**Date discovered:** 18 May 2026 (Monday afternoon)  
**Source:** End-to-end smoke testing after Monday's 6 commits  
**Captured:** Founder while testing real workflow  
**Target resolution:** Tomorrow (Tuesday) or after broker discussion

---

## Summary

After shipping 6 commits Monday (SPA refactor + calculation + column improvements), 
ran end-to-end smoke test. **5 tests, 4 issues found** — real workflow gaps that 
need addressing before tester visit.

| # | Issue | Priority | Effort | Blocked By |
|---|---|---|---|---|
| 1 | Zero-value inventory in unit picker | P2 | 15 min | Nothing |
| 2 | Site Visit Move Stage UX confusing | P2 | Design call | Broker discussion |
| 3 | Negotiation approval cycle unclear | P1-P2 | Investigation | Broker discussion |
| 4 | Offer Accepted dialog lacks DLD/Plan info | P1 | 1-2 hr | Broker spec |

---

## Issue 1: Zero-Value Inventory in Unit Picker

### What happens
When broker creates a new opportunity and opens the unit picker, units with 
`asking_price = 0` or NULL are shown.

### Founder verbatim
> "It shows prices and have the issue showing zero value inventory"  
> "search units still show zero value inventory"

### Why it's a problem
- Broker might accidentally select an "unpriced" unit
- Confuses the calculation features (initial advance from price)
- Suggests bad data quality

### Fix approach
Add filter to unit picker:
```javascript
units.filter(u => {
  const sp = salePricing.find(s => s.unit_id === u.id);
  return sp?.asking_price > 0;
})
```

Affects:
- CreateOpportunityDialog unit picker
- UnitPickerRich component (used in Leads consolidation)

### Estimated effort
15-20 minutes surgical fix

### Status
P2 — quick win, can fix anytime

---

## Issue 2: Site Visit Move Stage UX Confusing

### What happens
At Site Visit stage:
- No "Advance to Proposal Sent" button (removed in ARCH-SIMPLIFY-002 yesterday)
- Hint shows: "use 📤 Send Proposal in Log Activity"
- Broker still wants to advance directly without sending proposal

### Founder verbatim
> "the advance to next stage button is hidden, next I have to manually press 
> the offer accepted accepted button"

### Sunday's earlier insight
> "It should say move to negotiations correct instead of the message"

### Analysis
This is BY DESIGN — ARCH-SIMPLIFY-002 was supposed to force the proper path 
(Send Proposal auto-advances). But broker workflow might differ from this 
assumption.

### Questions for broker
- Do brokers always send formal proposals before negotiation?
- Or is verbal negotiation common, with written proposal later?
- Should there be a "skip to Negotiation" path for verbal deals?

### Resolution options
A. Keep current design (force Send Proposal) — investor demo clean
B. Add "Advance to Negotiation (no proposal)" option — matches reality
C. Make hint optional/dismissible — broker has both paths

### Status
**P2 — Needs broker input.** Hold for Wednesday's broker discussion.

---

## Issue 3: Negotiation Approval Cycle Unclear

### What happens
When broker adds entries to Negotiation Rounds table, system highlights 
"requires approval" but no clear approval workflow exists.

### Founder verbatim
> "it highlighted requires approval, have we planned for a approval cycle here"

### Investigation needed
- Where does "requires approval" come from?
- Is there a `discounts` or `pp_negotiations` workflow that's incomplete?
- Who approves what?

### Hypothesis
There may be partial implementation from earlier sprints (discount approval 
workflow) that's incomplete. Could be:
- Discount > threshold = requires manager approval
- Override price = requires admin sign-off
- Negotiation outside proposal = requires audit

### Resolution options
A. Investigate and complete the approval workflow
B. Remove the "requires approval" indicator until workflow is built
C. Document as roadmap item, ignore for now

### Status
**P1-P2 — Needs code investigation.** Confusing for tester. May need to hide 
the indicator until proper workflow is built.

---

## Issue 4: Offer Accepted Dialog Lacks Critical Information

### What happens
At Offer Accepted stage, dialog shows:
- Unit Asking Price ✓
- Approved Discount % ✓
- Net Offer Price ✓
- Discount source (e.g., proposal_v2) ✓
- Override Price option
- Offer Valid Until date
- Notes

### What's MISSING
- DLD payer (was the proposal's 50/50 split, no field to confirm)
- Payment plan agreed (was 5% discount + new plan in latest proposal, no field)
- Comparison with proposal (does this match what was sent?)

### Founder verbatim
> "fields shown there is not enough to confirm if its right"  
> "NEW proposal sent with 5% discount it is show 0 and DLD 50/50 I am not sure 
> because there is not field to to ensure on this form"

### Why this matters
Offer Accepted is the moment broker confirms buyer's commitment. The deal terms 
should be visible to verify against proposal. Currently, broker has to trust 
"discount source: proposal_v2" without seeing what proposal_v2 actually said.

### Resolution approach
Similar to SPA dialog improvements done today:
1. Show DLD payer + split from `opp.current_dld_payer` / `current_dld_split_pct`
2. Show payment plan from `opp.current_payment_plan_preset`
3. Visual indicator "Pre-filled from Proposal V2"
4. Optional: side-by-side proposal vs offer comparison

### Estimated effort
1-2 hours (similar pattern to SPA refactor)

### Status
**P1 — Critical for offer accuracy.** Should be done before tester visit. 
Aligned with "Final-Proposal-First" architecture philosophy.

---

## Recommended Order

### Tomorrow (Tuesday) — if you have time
1. **Issue 1** (15 min) - Zero-value filter, quick win
2. **Issue 3 investigation** (30 min) - understand current state of approval
3. **Issue 4 implementation** (1-2 hr) - apply same pattern as SPA refactor

### After broker discussion (Wednesday)
4. **Issue 2 resolution** - based on broker workflow truth

### Total estimated effort
- Issue 1: 15 min
- Issue 3: 30 min - 2 hr (depends on findings)
- Issue 4: 1-2 hr
- Issue 2: 30 min (after design decision)

---

## What Today's Smoke Test Validated

### Working perfectly
✅ Test 1: Opportunities list with 8 columns (Price + Final visible)  
✅ Test 5: Reopen completed SPA dialog (UX-COMPLETED-STAGE-001)

### Working with caveats
⚠️ Test 2: New opp creation - works but shows zero-value units (Issue 1)  
⚠️ Test 3: Send proposal + auto-advance - works (modulo Issue 2 workflow)

### Surfaced gaps
❌ Test 4: Offer Accepted dialog missing DLD/Plan info (Issue 4)

---

## Why This Is Healthy

**These findings are NOT failures** — they're evidence of good testing discipline.

- Real broker workflow exposed real gaps
- Caught BEFORE tester visit
- Documented with clear resolution paths
- Each has a priority + effort estimate
- Some need broker input (right discipline)

**This is what mature product development looks like.**

---

## Next Steps

1. ✅ Document captured (this file)
2. ⏳ Continue Monday session - golden tag stable state
3. ⏳ Tuesday: tackle Issue 1 (quick win)
4. ⏳ Wednesday: broker discussion clarifies Issues 2, 3, 4 design
5. ⏳ Wed/Thu: implement Issues 3, 4 with broker input

---

*Document created: 18 May 2026 (Monday afternoon)*  
*Captured during end-of-Monday smoke test*  
*Status: 4 issues documented, prioritized, estimated*  
*Aligned with: tester visit prep + investor demo readiness*
