# Stage 8 Spec — Document-Oriented Fee Tracking (Future Evolution)

**Status:** Spec captured 11 May 2026 afternoon. Build target: Post-MVP, after demo.
**Founder spec:** Abid Mirza, BFC

---

## The Insight

> *"If a person puts a wrong value the information on hand is wrong thats all the issue is or maybe chances are disputes in the fee payments, or even down the line we remove all this and ensure we take a copy of all the receipts provided by the buyer and make it as document oriented not fees for this for now"*

— Abid Mirza, 11 May 2026

---

## The Problem with Current Fee Tracking Model

The current Stage 5 v3 model tracks each fee as:
- Status (Pending / Received / Waived)
- Amount (broker types AED value)
- Date (broker types date)
- Notes (broker types context)

**Risks:**
1. **Data entry errors** — Broker types wrong amount, system has wrong data
2. **Dispute exposure** — "I paid 50,000" vs system shows "45,000" → buyer/broker dispute
3. **Audit weakness** — Numbers without proof = challengeable in regulator audit
4. **Compliance gap** — UAE law requires receipts for govt fees (SPA fee, DLD, Oqood) — having only typed amount = non-compliant

---

## Proposed Future Model — Document-Oriented

For fees that broker doesn't collect personally (paid directly by buyer to developer/govt):

### Replace "data entry" with "document upload"

```
Old (data entry):
  Fee row:    DLD fee (4%)
  Status:     [Pending] [Received] [Waived]
  Amount:     [_____AED_____]
  Date:       [_____]
  Notes:      [_____]

New (document oriented):
  Fee row:    DLD fee (4%)
  Status:     [Awaiting] [Recorded]
  Receipt:    [📎 Upload buyer's DLD receipt]
  
  When uploaded:
    - Filename + thumbnail shown
    - System extracts amount + date (OCR or manual confirm)
    - Status flips to "Recorded"
    - Receipt available for audit
```

---

## Fee Categorization

| Fee | Who Collects | Tracking Model |
|---|---|---|
| Booking fee | **Broker** | Data entry (current) |
| Reservation fee | **Broker** | Data entry (current) |
| Initial advance (1st installment) | **Broker** | Data entry (current) — relabel to "1st Installment per Payment Plan" |
| SPA fee | Developer (buyer pays directly) | **Document upload** |
| DLD fee (4%) | Government (buyer pays directly) | **Document upload** |
| Oqood fee | Government (buyer pays directly) | **Document upload** |
| Other developer fees | Developer | **Document upload** OR config per developer |

---

## Implementation Phases

### Phase 1 — Schema
- Add `fee_documents` JSONB to `pp_sales_closures.pre_spa_payments`
- Each fee row gets optional `receipt_document_path` + `receipt_uploaded_at`

### Phase 2 — UI
- For "buyer pays directly" fees, replace data entry with file upload component
- Show thumbnail of uploaded receipt
- Allow re-upload if wrong

### Phase 3 — OCR / Validation
- (Optional advanced) Use AI to OCR receipts
- Extract amount, date, payment method
- Compare with expected amount from payment plan
- Flag discrepancies for broker review

### Phase 4 — Audit & Compliance
- Receipts retrievable via opp detail
- Manager dashboard: % opps with complete receipt documentation
- Regulator audit endpoint: export all receipts for an opp

---

## Tie-in to Other Specs

| Spec | Connection |
|---|---|
| Stage Gate Enforcement | Gate 6 (Closed Won) currently requires all fees "Received/Waived". Future: requires "Recorded with receipt" for govt fees. |
| AI Daily Briefing | "Receipts missing for 3 opps — collect from buyers" daily alert |
| Stage 5 v4 Price Journey | Receipts validate the negotiated price actually applied |
| Compliance Reporting | "Show me all DLD receipts last quarter" = single query |

---

## Effort Estimate (Post-Demo)

| Component | Effort |
|---|---|
| Schema changes | 30 min |
| Upload UI for 4 fee rows | 1 hour |
| Storage integration (Supabase Storage bucket) | 30 min |
| OCR integration (optional) | 2-3 hours |
| Audit query endpoints | 1 hour |
| Testing | 1 hour |
| **Total** | **~5-7 hours** |

---

## Why Defer to Post-Demo

**For now, current data-entry model is fine because:**
- Broker has trust relationship with developer
- Disputes are rare in test/early phase
- Adding document upload = complexity that distracts from demo
- Investors care about pipeline + commission tracking, not receipt management

**Tracker model still works for MVP. Document model is "Series A polish" level.**

---

## Investor Pitch Connection

When investor asks: *"How do you ensure compliance with UAE real estate regulations?"*

**Today:** "We track every payment in structured data with date stamps."
**Future (Stage 8):** "We store the actual receipts as documents, OCR extracts data, AI validates against expected amounts, and our system is regulator-audit-ready."

The future answer is a moat. **Worth building eventually.**

---

*Spec captured 11 May 2026 afternoon during Stage Gate Phase A testing session. Founder explicit defer: "Rest this here for now". Build target: post-MVP iteration. Linked to AI Daily Briefing future feature.*
