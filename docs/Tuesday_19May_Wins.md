# Tuesday 19 May 2026 — Session Wins

**Latest commit:** `8f3ec77` (Hide internal approval features)  
**Safety tag:** `pre-tuesday-work-19-may-2026`  
**Continuing from:** `v2.5-monday-stable` (Monday 18 May golden tag)

---

## Today's Commits

| # | Hash | What | Why |
|---|---|---|---|
| 1 | `f030add` | Issue 1: Zero-value inventory filter | Broker prevented from selecting unpriced units |
| 2 | `5437996` | Issue 4: Offer Accepted UI (DLD + Plan + Total + Checkbox) | Critical workflow gap from Monday |
| 3 | `bce7799` | Issue 4: Validation gate (block save if unchecked) | Make checkbox functional |
| 4 | `8f3ec77` | Hide internal approval features (feature flag) | Clean broker-only app for tester |

---

## Monday Findings — Resolution Status

| # | Issue | Status | Resolution |
|---|---|---|---|
| 1 | Zero-value inventory filter | ✅ RESOLVED | `f030add` — Filter applied to inline picker |
| 2 | Site Visit Move Stage UX | ⏸️ PENDING | Awaits broker discussion |
| 3 | Negotiation approval cycle | ✅ RESOLVED | `8f3ec77` — Hidden via INTERNAL_APPROVAL_FEATURES_ENABLED flag |
| 4 | Offer Accepted lacks DLD/Plan info | ✅ RESOLVED | `5437996` + `bce7799` — Full UI + gate logic |

**3 of 4 resolved.** Issue 2 holds for broker meeting.

---

## Architectural Decisions Today

### Decision 1: Broker-only app for Phase 1
**Context:** Founder identified Negotiation approval cycle as developer-side feature.  
**Decision:** Hide all developer-facing workflows; PropCRM = pure broker/agent app.  
**Implementation:** Feature flag `INTERNAL_APPROVAL_FEATURES_ENABLED = false`  
**Re-enable when:** Developer onboarding begins (Phase 2)

### Decision 2: Simple checkbox vs. full payment tracking at Offer Accepted
**Context:** Discussed showing per-payment tracking at Offer Accepted.  
**Decision:** Single confirmation checkbox + Total Expected calculation.  
**Reasoning:** Detailed per-payment tracking lives at SPA stage. At Offer Accepted, broker needs ASSURANCE not paperwork.  
**Iterate based on:** Tester feedback.

### Decision 3: Feature flag pattern for incomplete features
**Context:** Approval workflow exists in code but not fully implemented.  
**Decision:** Hide UI, preserve code via feature flag.  
**Why preserve:** Code is complex (state, modal, save logic); one-line flip is easier than re-introducing.  
**Future:** Per-tenant configuration architecture.

---

## What's Live Now (User-Facing)

### Offer Accepted Dialog (Issue 4)
```
✅ Pre-filled from Final Proposal
DLD Fee Arrangement: 🔵 Split 50/50
Payment Plan: 📅 10/90

📊 Total Expected to be Collected (Pre-SPA)
Initial Advance (10% per plan):    AED 102,441
Buyer DLD share (50% of 4%):       AED 20,488
─────────────────────────────────
Total Expected:                    AED 122,929

Note: Developer service charges, admin fees, and registration 
collected separately by the developer

☐ All expected amounts collected — ready to advance

[Cancel]  [Confirm — disabled until checked]
```

**Gating:** Toast error if try to advance without confirmation.

### Unit Picker (Issue 1)
- Filters out units with `asking_price = 0` or NULL
- Matches UnitPickerRich's data integrity pattern
- Both pickers now consistent

### Removed UI (Issue 3 / Internal Approval)
- ❌ "💰 Request Discount" button (Financials section)
- ❌ Yellow "request discount" notice in Offer Accepted
- ❌ Discount Request modal (unreachable)

---

## Architecture State

### Stage-by-stage workflow visibility

| Stage | Pre-fill from Proposal | Confirmation Gate | Status |
|---|---|---|---|
| Negotiation | (existing rounds tracking) | - | Existing |
| **Offer Accepted** | **✅ DLD + Plan + Total** | **✅ Checkbox** | **NEW** |
| Reserved | - | - | Could apply same pattern |
| SPA Signed | ✅ DLD + Plan + Initial Advance | ✅ Pre-SPA Payments status | Monday's work |
| Closed Won | (auto-advance) | (auto) | Existing |

**Consistency:** Offer Accepted and SPA Signed now share similar "pre-filled from proposal" pattern.

### Schema State

`opportunities` table has these `current_*` columns (Math Flow Sprint + today):
- current_agreed_price
- current_discount_type
- current_discount_value
- current_discount_source
- current_dld_payer
- current_dld_split_pct
- current_dld_amount
- current_payment_plan_preset (Monday's addition)
- current_admin_fee
- current_developer_fees
- current_oqood_fee
- current_trustee_fee
- current_values_updated_at
- current_values_updated_by

**Total: 14 current_* columns.** All populated by proposal save flow.

---

## What's NOT Done Yet

### Pending broker discussion
- **Issue 2:** Site Visit Move Stage UX  
  Should there be "Move to Negotiation" button at Site Visit, OR force Send Proposal path?
- **Reservation vs Booking fees:** 1 or 2 fields?
- **Approval workflow scope:** What internal hierarchy actually exists at the company?

### Pending founder questionnaire
- `PropCRM_Strategy_Questionnaire.xlsx` (Sunday) — strategic questions for founder to answer at own pace

### Potential Phase B work
- Reservation dialog could mirror Offer Accepted pattern (consistency)
- Final-Proposal-First architecture cleanup
- Activity timeline improvements

### Code cleanup
- 8+ leftover `fix_*.py` scripts in working directory
- `test-data/` directory status unclear (intentional? gitignore?)

---

## Tester Demo Readiness

### What works end-to-end
1. ✅ Lead creation
2. ✅ Opportunity creation (with zero-value filter)
3. ✅ Stage advancement with appropriate dialogs
4. ✅ Proposal flow with payment plan + DLD
5. ✅ Offer Accepted with rich pre-fill + checkbox gate
6. ✅ SPA Signed with calculation + DLD pre-fill (Monday)
7. ✅ Completed stage reopen (Monday)
8. ✅ Commission preview at SPA
9. ✅ Opportunity list with Budget/Price/Final visible

### What needs verification before tester
- End-to-end smoke test (planned for today)
- Various edge cases (custom payment plans, NULL data)
- Multi-tenant isolation (Phase A work)

---

## Math Principle: "Calculated, Not Entered"

**Founder's Monday insight crystallized today:**

> "all amounts collected before SPA including govt. charges + developer 
> service/admin charges and registration is done by the developer. so total 
> amount SPA (MATH) we did should show here and give 1 check box all collected"

**Applied in:**
- SPA Signed: Initial advance = price × plan%
- Offer Accepted: Total Expected = Initial advance + Buyer DLD share
- All calculations from `current_*` columns

**Why this matters:**
- Eliminates broker typos
- Audit trail (proposal = source of truth)
- Faster workflow
- Investor demo benefit: "Smart fields, not dumb forms"

---

## Next Sessions Plan

### Today (continuation)
- Reservation dialog audit (apply same pattern as Offer Accepted)
- End-to-end smoke test
- Polish + golden tag

### When broker discussion happens
- Issue 2 resolution
- Booking/Reservation fees decision
- Approval workflow scope

### Future sessions
- Strategy questionnaire follow-up (when founder fills it)
- Reservation dialog (if confirms valuable)
- Phase B architectural refinements

---

*Document created: 19 May 2026 (Tuesday)*  
*Session productivity: 4 commits resolving 3 of 4 Monday issues*  
*Aligned with: Pre-tester demo readiness*  
*Status: Tuesday session in progress*
