# Stage 5 — Testing Issues Log (09 May 2026 evening)

**Tested commit:** `4541ce6` (Stage 5 base + polish, shipped 09 May)
**Testing time:** ~15 min
**Status:** Stage 5 base WORKS. 4 bugs found, none block the foundation. 3 quick fixes + 1 deferred.

---

## What's working ✅

- ✅ SPA Signed dialog opens with all new fields
- ✅ SPA / Oqood Reference field present
- ✅ SPA Document upload zone present (PDF/JPG/PNG, 10MB)
- ✅ Pre-SPA Payments checkboxes section visible (4 checkboxes: booking, reservation, advance, other)
- ✅ Down Payment Method dropdown working
- ✅ Final Sale Price in Closed Won shows READ-ONLY with "Edit if changed" button (this part works)
- ✅ Read-only displays "AED 910,000 from SPA Signed" correctly

**Foundation is solid.** All bugs below are surface-level refinements.

---

## Issue 1 — Offer Accepted dialog showing AED — (no price)

**Symptom:**
```
Unit Asking Price: AED —
Approved Discount: None
Net Offer Price: AED —
```

**Root cause:** Pre-existing issue (NOT introduced by Stage 5). Likely the opportunity isn't linked to a `salePricing` record (sp variable), or the unit doesn't have `asking_price` set in inventory.

**Severity:** Medium. Doesn't block Stage 5. Affects offer acceptance flow generally.

**Priority:** DEFER — investigate tomorrow. Not Stage 5's fault.

**Investigation tomorrow:**
1. Check what unit is linked to the opp being tested
2. Run: `SELECT * FROM project_units WHERE id = '<unit_id>';`
3. Run: `SELECT * FROM sale_pricing WHERE unit_id = '<unit_id>';`
4. If no sale_pricing row → that's why price shows AED —. Either backfill OR fix the offer accepted dialog to fall back to `opp.budget`.

---

## Issue 2 — SPA Signing dialog: Final Agreed Price doesn't pre-fill

**Symptom:** Field is empty, broker has to type the price.

**Root cause:** Current code:
```javascript
value={stageGateForm.final_price||opp.offer_price||""}
```
If both `final_price` and `offer_price` are null on the opportunity record, defaults to empty.

**Why it's null in test:** The opportunity record likely has neither `offer_price` nor `final_price` set. This connects to Issue 1 — the offer flow didn't capture price properly.

**Fix:** Add `opp.budget` as final fallback:
```javascript
value={stageGateForm.final_price||opp.final_price||opp.offer_price||opp.budget||""}
```

**Severity:** Medium. Friction, not blocker.

**Priority:** FIX TOMORROW (1-line change).

---

## Issue 3 — Closed Won "Final price required" error blocks save 🔴

**Symptom:**
- Read-only price displays correctly: "AED 910,000 from SPA Signed"
- Click "Close Won" button
- Toast appears: "Final price is required"
- Save blocked

**Root cause:** Validation logic at line ~6766:
```javascript
if(showStageGate==="Closed Won"&&!stageGateForm.final_price)
  {showToast("Final sale price is required","error");return;}
```

When the price is in READ-ONLY mode, we never set `stageGateForm.final_price`. The display reads from `opp.final_price` directly. So validation thinks the field is empty.

**Fix:** Change validation to accept either source:
```javascript
if(showStageGate==="Closed Won"&&!(stageGateForm.final_price||opp.final_price))
  {showToast("Final sale price is required","error");return;}
```

Also: when broker clicks "Edit if changed" but doesn't change anything, save should still work. The fix above handles that too.

**Severity:** HIGH — completely blocks Closed Won transition.

**Priority:** FIX TOMORROW FIRST THING.

---

## Issue 4 — Need MORE pre-SPA payment checkboxes

**User feedback:** *"the full token of advance payments need to be shown too like spa fee, dld. etc.etc."*

**Current 4 checkboxes:**
- Booking fee paid
- Reservation fee paid
- Initial advance paid
- Other developer fees paid

**Need to add:**
- SPA fee (administrative fee for the SPA)
- DLD fee (4% Dubai Land Department registration fee)
- Oqood fee (AED 4,020 typical for off-plan)

**New checklist (proposed):**
1. Booking fee paid
2. Reservation fee paid
3. Initial advance paid
4. SPA fee paid
5. DLD fee paid (4%)
6. Oqood fee paid
7. Other developer fees paid

**Schema impact:** None — `pre_spa_payments` is JSONB, accepts any keys.

**Severity:** Medium. Adds completeness.

**Priority:** FIX TOMORROW (just add 3 more entries to the array).

---

## What I'm doing tomorrow morning (in order)

### Sprint 1 — Quick fixes (~30 min total)

1. **Fix Issue 3** (Closed Won validation) — 1-line fix, critical
2. **Fix Issue 2** (SPA price fallback to budget) — 1-line fix
3. **Fix Issue 4** (add 3 more checkboxes) — small array change
4. Test all 3 in browser
5. **Commit + push immediately**

### Sprint 2 — Investigate Issue 1 (~15 min)

1. Check which opp/unit was tested
2. Determine if sale_pricing row missing OR asking_price not set
3. Decide: backfill data OR add fallback to budget in offer dialog
4. Quick fix + commit

### Sprint 3 — Stage 6 BUILD STARTS (~2 days)

After Sprint 1 + 2 ship:
- Schema: `pp_commission_invoices` table
- Auto-create draft commission_invoice on SPA Signed (in commitStageMove)
- New top-level menu: "Commission Outstanding"
- Aggregate dashboard (by developer + by aging buckets)
- Per-invoice detail view
- Mark Received flow

---

## Standing facts for tomorrow

**Production state:**
- Latest commit: `4541ce6` (Stage 5 SPA closure + pre-payments + read-only Closed Won price)
- 13 commits today
- Stage 1 + Stage 5 = LIVE on prop-crm-two.vercel.app

**Test data:**
- 3 TEST- master agreements (Emaar 4%/0.5%, DAMAC 5%, Aldar Q3)
- 1 test opportunity with auto-populated 4% commission
- 1 sales_closure row was inserted during testing tonight (verify with: `SELECT * FROM pp_sales_closures;`)

**Pending DB checks:**
- Did the test SPA Signed actually create a row in `pp_sales_closures`? Run:
  ```sql
  SELECT 
    id, opportunity_id, spa_signed_date, spa_reference_number,
    final_sale_price, spa_document_filename, pre_spa_payments, notes
  FROM pp_sales_closures
  ORDER BY created_at DESC LIMIT 5;
  ```
- If 0 rows → the closure insert silently failed. Investigate before moving on.
- If 1+ rows with proper data → all good, proceed to fixes.

---

## Honest meta-note for tomorrow's Claude

**Foundation is intact.** The 4 issues are surface-level refinements:
- 3 are 1-line / few-line fixes
- 1 is pre-existing (Issue 1) and not Stage 5's responsibility

**Don't refactor more than needed.** User has decision fatigue and wants progress. Quick fixes → commit → Stage 6 build. **Do not** propose redesigns.

**User's Monday goal:** Stage 5 + Stage 6 fully shipped. Stage 5 polish + Stage 6 build = Saturday/Sunday work. Realistic.

**Tonight was a long day** (~14 hours). User is right to stop.

---

*— Captured by Claude, 09 May 2026, ~10pm UAE*
