# Phase B Architecture Vision: Final-Proposal-First
**Single Source of Truth via Direct Proposal Reference**

**Captured:** 15 May 2026 (Friday, Day 3 of Math Flow Sprint)
**Status:** APPROVED for Phase B implementation (post-investor demo)
**Origin:** Founder insight during dry-run when testing Offer Accepted stage

---

## 1. The Insight That Led Here

During Day 3 dry-run testing the Offer Accepted dialog, founder noticed
"Discount source: proposal_v1" displayed even though proposal V3 had been
sent. This bug (stale source field) led to a deeper architectural question.

**Founder verbatim:**
> "we need to bring in a concept of Final proposal and pick everything from
> their what do you think about this, the whole circus of searching things
> unecssary will stop just think and how to put it also"

**Translation:** Why have two sources of truth (proposals table + 
opportunities.current_*) when one would do? Just reference the "final"
proposal and read from it.

---

## 2. Current Architecture (Two-Layer)

### What we have now

```
LAYER 1: opportunities.current_*    ← live snapshot
  - current_agreed_price
  - current_discount_type/value
  - current_dld_payer/split_pct/amount
  - current_admin_fee
  - current_trustee_fee
  - current_discount_source (e.g. "proposal_v3")
  - current_values_updated_at/_by

LAYER 2: proposals table             ← versioned history
  - V1, V2, V3, ... with full data
  - status: sent/superseded/accepted/rejected
  - structured_data JSONB (dld_handling, payment_plan_preset, etc.)
```

### How sync works (currently)

When proposal saved:
```javascript
INSERT into proposals (V_next)  ← versioned
UPDATE opportunities             ← live snapshot
  SET current_agreed_price = proposal.final_price,
      current_discount_* = ...,
      current_dld_* = ...,
      current_discount_source = "proposal_v_next"
```

### Why this works
- Stage gates read fast (single column access)
- Audit trail preserved in proposals
- Two-layer pattern matches bank/git/email systems

### Why this is fragile
- **Two sources of truth = sync bugs possible**
- Today's bug: `current_discount_source` stuck at "proposal_v1" instead of v3
- Every new touch point = code to wire up current_* sync
- "Did I forget to update current_* somewhere?" anxiety

---

## 3. Proposed Architecture (Final-Proposal-First)

### What we'd have

```
opportunities.final_proposal_id UUID FK → proposals.id
                ↓
        proposals table is the ONLY math source
        - V1, V2, V3, ... versioned
        - opp.final_proposal_id points to the "current" version
        - All stages read DIRECTLY through this reference
```

### How math flows

```javascript
// Single read function for the whole app
function getCurrentMath(opp, proposalsCache) {
  if (opp.final_proposal_id) {
    const fp = proposalsCache.find(p => p.id === opp.final_proposal_id);
    return {
      agreed_price: fp.structured_data.discounted_price || fp.asking_price,
      discount_type: fp.discount_pct > 0 ? 'percent' : null,
      discount_value: fp.discount_pct,
      dld_payer: dldHandlingToPayer(fp.structured_data.dld_handling),
      dld_amount: computeDldAmount(fp),
      admin_fee: 580,
      trustee_fee: opp.property_category === 'Off-Plan' ? 4200 : null,
      source: `proposal_v${fp.version}`,
      asOfProposal: fp,
    };
  }
  // No proposal yet (just-created opp): use unit defaults
  return {
    agreed_price: getUnitListPrice(opp, salePricing),
    ...
  };
}
```

### Every stage uses this function
```javascript
// SPA Signed dialog
const math = getCurrentMath(opp, proposalsCache);
finalPriceField = math.agreed_price;

// Offer Accepted dialog  
const math = getCurrentMath(opp, proposalsCache);
displayDiscount = math.discount_value;
displayPrice = math.agreed_price;

// Reserved stage
const math = getCurrentMath(opp, proposalsCache);
reservationAmount = math.agreed_price * 0.10;

// Closed Won
const math = getCurrentMath(opp, proposalsCache);
commission = math.agreed_price * (opp.commission_pct / 100);
```

**One function. Eight callers. Single source of truth.**

---

## 4. Why This Is Better

### Architectural advantages

| Aspect | Current (Two-Layer) | Proposed (Final-Proposal-First) |
|---|---|---|
| Sources of truth | 2 (opp.current_*, proposals) | 1 (proposals only) |
| Sync bugs possible | YES (today's "proposal_v1" bug) | NO (impossible by design) |
| Code touch points to update math | 7+ (each stage writes current_*) | 1 (the read function) |
| New stages added | Must wire current_* sync | Just call getCurrentMath() |
| Audit trail completeness | Good (proposals table) | EXCELLENT (everything traceable to proposal version) |
| Reverting to old proposal | Complex (data migration) | Trivial (change FK) |
| Performance | Faster reads (single column) | Slightly slower (FK lookup) |

### Business advantages

**For brokers:**
- "Where did this price come from?" → Click → See proposal V3 with full breakdown
- "I want to revert to V2 terms" → System changes FK, all math reverts instantly
- "How many negotiation rounds?" → Count proposals where status != superseded

**For investors:**
- "Math is traceable to the exact document" — perfect audit story
- "No sync issues because there's nothing to sync"
- "Phase B simplification = engineering maturity"

**For analytics:**
- Easy: "what proposals had 5%+ discount?"
- Easy: "average rounds before acceptance?"
- Hard with current: query both opp.current_* AND proposals.*

---

## 5. Migration Strategy

### Phase B Implementation (3-5 days)

**Day 1 — Schema additions**
```sql
ALTER TABLE opportunities
  ADD COLUMN final_proposal_id UUID REFERENCES proposals(id);

-- Set final_proposal_id from existing data
UPDATE opportunities o
SET final_proposal_id = (
  SELECT id FROM proposals
  WHERE opportunity_id = o.id
  AND status = 'sent'
  ORDER BY version DESC
  LIMIT 1
);
```

**Day 2 — Helper function**
- Write `getCurrentMath(opp, proposalsCache)` utility
- Test against all sample opps in DB
- Verify outputs match current `current_*` values

**Day 3 — Wire to stages**
- Replace `opp.current_*` reads with `getCurrentMath()`
- One stage at a time
- Each stage: change reads, verify in browser
- Stage gates affected: Acceptance, Reserved, SPA, Closed Won, plus displays everywhere

**Day 4 — Wire to writes**
- When proposal accepted: `opp.final_proposal_id = accepted.id`
- When SPA signed: `opp.final_proposal_id` becomes immutable
- Override flows: create "override proposal" version

**Day 5 — Polish**
- Remove `current_*` columns (or keep as DB-only backup)
- Update all queries
- Performance test
- Document the pattern

### Backwards compatibility

**During transition:**
- Keep `current_*` columns
- New code reads via `getCurrentMath()` (which reads proposals)
- Old code reads `current_*` (still synced)
- Both paths work

**Post-transition:**
- All code reads via `getCurrentMath()`
- `current_*` columns can be removed or kept as audit-only

---

## 6. Edge Cases (handled)

### Case: New opp, no proposal yet
```javascript
opp.final_proposal_id = NULL
→ getCurrentMath returns unit defaults
→ current_agreed_price = salePricing.asking_price
→ No discount, default fees
```

### Case: Override price (not in any proposal)
**Two approaches:**

**Approach A — Override creates "override" proposal type:**
```javascript
// Broker overrides price in Offer Accepted dialog
INSERT proposals (
  version: N+1, status: 'override',
  asking_price: original,
  discount_amount: override - original,
  structured_data: { override: true, reason: 'special_arrangement' }
)
opp.final_proposal_id = override_proposal.id
```

**Approach B — Override flag on opp:**
```javascript
opp.override_price = 595000
opp.override_reason = 'cash deal'
// getCurrentMath checks override first, then proposal
```

**Recommendation:** Approach A — keeps proposals as single source.

### Case: Reverting to old proposal
```javascript
// Buyer accepts V2 terms after V3 rejected
opp.final_proposal_id = V2.id
// All stages immediately use V2's math
// No data migration needed
// Audit trail shows: V3 superseded V2, but reverted
```

### Case: Closed Won (price locked)
```javascript
// At Closed Won, freeze the proposal that was accepted
opp.final_proposal_id = accepted_proposal.id (immutable)
// Subsequent edits to proposals don't affect this opp
// Acts like a snapshot
```

---

## 7. Why NOT Doing This in Phase A

### Reasons to defer

1. **Sprint has 2 weeks runway, demo Mon-Tue testers + investor week 2** — refactor mid-sprint = risk
2. **Math foundation works currently** — current_* approach is functional
3. **Touch points 1, 2, 4 done** — sunk cost in working code
4. **Refactor needs 3-5 dedicated days** — not interleavable
5. **Better to ship current architecture, refactor with experience**

### When to do this

**Phase B start: June 1, 2026** (after investor secured)
- Team might be growing
- Fresh eyes for refactor
- Confidence from demo success
- Time for careful migration

---

## 8. Phase B Sprint Plan (Final-Proposal-First Refactor)

### Scope
**5 day sprint:** Schema + helper + migration + testing + documentation

### Day 1 — Schema + Backfill
- Add `final_proposal_id` column
- Backfill from existing data
- Verify integrity

### Day 2 — Helper function
- Write `getCurrentMath()` utility
- Test on all existing opps
- Compare vs current_* (should match)

### Day 3-4 — Refactor stages
- Replace reads in: Acceptance, Reserved, SPA, Closed Won, Display
- One stage per session
- Test after each

### Day 5 — Polish + Cleanup
- Performance verify
- Documentation update
- Optional: remove current_* columns

---

## 9. Investor Narrative

**For pitch:**
> "PropCRM uses a 'Final Proposal' architecture pattern. Every deal's
> current state is defined by reference to a single proposal version. This 
> eliminates entire categories of bugs that plague traditional CRMs where
> data is duplicated across tables. We discovered this pattern through 
> stress testing during Phase A. Phase B implements it. Result: cleaner
> code, perfect auditability, brokers can revert to any past proposal
> with one click."

**Bonus narrative:**
> "We initially built a 'live snapshot + history' approach (like banking
> systems). Through testing, we realized for our use case, a 'reference 
> + versioned source' approach is cleaner. This is the kind of evolution
> that happens when you build software with users, not for them."

---

## 10. Status

| Aspect | Status |
|---|---|
| Architectural vision | ✅ APPROVED |
| Sprint impact | Continues current approach |
| Implementation date | Phase B (June 2026) |
| Backwards compatibility | Maintained during transition |
| Effort estimate | 5 days |
| Risk | LOW (additive migration) |

---

## 11. Founder Realization (Verbatim)

The thinking that led to this clarity:

> "we need to bring in a concept of Final proposal and pick everything 
> from their what do you think about this, the whole circus of searching 
> things unecssary will stop just think and how to put it also"

**The principle:**
- One reference, one truth
- No sync needed if there's no copy
- Audit trail comes free
- Code simplifies dramatically

---

*Document created: 15 May 2026 (Friday, Day 3 of Math Flow Sprint)*  
*Captured during dry-run of Offer Accepted stage*  
*To be implemented in Phase B (post-investor demo)*  
*Pattern: Final-Proposal-First (Reference Architecture)*
