# Architectural Insight: Initial Advance Should Be CALCULATED, Not Entered

**Captured:** 18 May 2026 (Monday morning)  
**Source:** Founder insight during SPA dialog refactor  
**Status:** P1 - Architectural improvement, not just UX fix  
**Target execution:** Soon after current SPA refactor (this week)

---

## 1. The Insight

**Founder verbatim:**

> "When you are working on this and there is an error i just want to hightlight 
> that the initial/advance payement is part of the payement plan ex.10/90, 50/50, 
> this should be a calculated and shown not entered after the final price has 
> been accpeted and locked."

---

## 2. Why This Matters

### Current behavior (problem)
- Broker manually enters `initial_advance` amount in SPA dialog
- No connection to payment plan agreed in proposal
- Error-prone: typos, miscalculation, mismatch with plan

### Real-world workflow
Payment plans in UAE real estate are **structured** as percentages:
- **10/90** = 10% upfront, 90% on handover
- **20/80** = 20% upfront, 80% over construction
- **50/50** = 50% upfront, 50% on handover
- **30/70/SPA-Linked** = 30% upfront, 70% per construction milestones

**The "first number" IS the initial advance percentage.**

### What SHOULD happen
```
Step 1: Proposal V3 sent with:
  - Final Price: AED 600,000
  - Payment Plan: 20/80

Step 2: Proposal accepted, stages advance

Step 3: At SPA dialog opens:
  - Final Price LOCKED at 600,000
  - Payment Plan locked at 20/80
  - Initial Advance = 600,000 × 20% = AED 120,000
  - DISPLAYED as calculated (not editable by default)

Step 4: Broker confirms:
  ✓ Received: AED 120,000 (matches expected)
  OR
  ⚠️ Received: AED 100,000 (deviation, requires reason)
```

---

## 3. Architectural Implications

### Data we need
- Proposal MUST have structured payment plan (not just text)
  - Initial percentage
  - Term percentage
  - Schedule type
- Already exists in code: `payment_plan_preset` field?
- Need to verify structure

### Computation needed
```javascript
const initialAdvancePercent = parsePlan(proposal.payment_plan_preset).initialPct;
const expectedInitialAdvance = finalPrice * (initialAdvancePercent / 100);
```

### UI changes
- **Initial Advance row** in SPA payments box:
  - BEFORE: Just an empty input
  - AFTER: 
    - Shows "Expected: AED 120,000 (20% of price per plan)"
    - Status: pending/received/waived (existing)
    - Amount: pre-filled with expected, editable if override
    - Deviation warning if entered != expected

### Same principle applies to other fees
- DLD Fee = Price × 4% (already calculated)
- Service Charge waiver = depends on developer agreement
- Other fees may also be percentage-based

---

## 4. Implementation Plan

### Phase 1 — Investigation (30 min)
- Check current proposal `payment_plan_preset` structure
- Verify field exists in proposals table
- Understand current parsing logic (if any)

### Phase 2 — Schema (if needed)
- May need to add columns:
  - `current_payment_plan_preset` on opportunities (mirrors current_* pattern)
  - Or use existing column if structured

### Phase 3 — Calculation logic (1 hour)
- Helper function: `getInitialAdvanceFromPlan(plan, price)`
- Use in SPA dialog pre-fill

### Phase 4 — UI updates (1-2 hours)
- Show calculated expected amount
- Highlight deviations
- Override flow with reason

### Phase 5 — Testing
- Plans: 10/90, 20/80, 50/50, custom
- Override scenarios
- Edge cases (no plan selected)

**Total estimated effort: 4-5 hours**

---

## 5. Same Insight Applied Elsewhere

If broker shouldn't enter what can be calculated, audit ALL fields:

| Field | Currently | Should Be |
|---|---|---|
| Initial Advance | Manual | CALCULATED from plan % |
| DLD Fee | Calculated (price × 4%) | ✅ Already correct |
| SPA Fee | Manual | TBD - usually flat fee |
| Oqood Fee | Manual | TBD - usually flat fee |
| Service Charge | Manual | If percentage, calculate |
| Booking Fee | Manual (from proposal) | ✅ OK - from earlier flow |
| Reservation Fee | Manual (from proposal) | ✅ OK - from earlier flow |

---

## 6. Why "Calculated, Not Entered" Is A Product Principle

This isn't just a UX nicety. It's a **design philosophy:**

1. **Eliminates errors** - typos cause real money problems
2. **Audit trail** - calculation source is documented
3. **Faster workflow** - one less thing to enter
4. **Trust** - broker sees math, not asked to verify
5. **Investor narrative** - "Smart fields, not dumb forms"

**This is what Phase B's Final-Proposal-First architecture is really about.**

---

## 7. When to Execute

### Current Sprint (this week)
- ✅ Apply current SPA refactor (DLD pre-fill + remove duplicate field)
- ⏳ THIS task — Initial Advance calculation

### Sequence
1. Ship current refactor (in progress)
2. Investigate payment plan data structure
3. Implement calculation
4. Test + commit

---

## 8. Acceptance Criteria

When this is complete:
- [ ] Open SPA dialog → Initial Advance shows expected amount
- [ ] Amount = `finalPrice × (paymentPlan.initialPct / 100)`
- [ ] If broker doesn't change, save as "matches plan"
- [ ] If broker changes, prompt for reason
- [ ] Deviation logged in audit trail
- [ ] Works for all plan presets (10/90, 20/80, 50/50, custom)

---

*Document created: 18 May 2026 (Monday morning)*  
*Captured during SPA dialog refactor session*  
*Founder's insight: "calculated not entered"*  
*Aligns with: Phase B Final-Proposal-First architecture*  
*Priority: P1 - Execute this week*
