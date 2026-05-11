# Stage 5 v4 Spec — Price Journey

**Status:** Spec captured 11 May 2026. Build target: post-investor-demo.
**Founder spec:** Abid Mirza, BFC

---

## The Problem

At SPA Signed stage, broker has to **manually re-enter** the Final Agreed Price even though the system already knows the full price journey from earlier stages.

**Founder's words (11 May 2026):**

> *"Why I had to enter 2M agreed price, as we have discussed the price coming from inventory, plus special offers in between, negotiated value etc.. from the process it should bring the value from there correct, and then show value if negotiated, along with the original price just for the peace of eyes."*

---

## Real Broker Workflow (Current State)

```
Stage           Where Price Lives                Broker Action
─────────────────────────────────────────────────────────────
Inventory       project_units.original_price     None (already there)
Proposal        proposals.asking_price           Enters manually or pre-fills from unit
                proposals.discount_pct           Enters offer percentage
                proposals.final_price            Calculated: asking × (1 - discount)
Negotiation     opportunities.offer_price         Stored when offer accepted
                opportunities.final_price         Set at Offer Accepted or Reserved
SPA Signed      stageGateForm.final_price        ⚠️ BROKER RE-ENTERS HERE
```

**Gap:** Final price exists in 3+ places by the time SPA is signed. Broker shouldn't type it again.

---

## Proposed UX — Price Journey Card

At SPA Signed dialog, replace the lone "Final Agreed Price" input with:

```
┌─────────────────────────────────────────────────────────┐
│ 💰 Price Journey                                         │
│                                                          │
│  Asking price (inventory):     AED 2,552,304             │
│  After offer (-10% Q2):        AED 2,297,074  ↓ 10%      │
│  Negotiated (Offer Accepted):  AED 2,000,000  ↓ 12.9%    │
│  ─────────────────────────────────────────────────────  │
│  Total discount:               AED 552,304 (21.6%)       │
│                                                          │
│  Final Agreed Price *                                    │
│  [AED 2,000,000           ]  [✏️ Override if different]  │
└─────────────────────────────────────────────────────────┘
```

**Behavior:**
- Final Agreed Price PRE-FILLS with negotiated value (no re-entry)
- "Override if different" button reveals editable input + reason field
- Override requires reason: "Last-minute discount", "Buyer added extras", "Other"
- Override gets logged to activities for audit trail

---

## Schema Changes Needed

### Existing columns (already there, just need to use)
- `project_units.original_price` ✅
- `proposals.asking_price`, `proposals.discount_pct`, `proposals.final_price` ✅
- `opportunities.offer_price`, `opportunities.final_price` ✅

### New columns (probably needed)
- `opportunities.negotiated_price` NUMERIC — explicit captured at Negotiation stage
- `pp_sales_closures.price_override_reason` TEXT — if broker overrode

---

## Implementation Steps

### Step 1 — Capture negotiated_price (Phase A)
When opp advances from Negotiation → Offer Accepted:
- If stageGateForm has a price entered, save to `opp.negotiated_price`
- This is the FINAL negotiated value before SPA

### Step 2 — Price Journey card render (Phase B)
At SPA Signed dialog open:
- Query proposals table for accepted proposal (most recent)
- Build journey from: unit.original_price → proposal.final_price → opp.negotiated_price
- Render the journey card above the final_price input
- Pre-fill final_price input with opp.negotiated_price (or fallback)

### Step 3 — Override flow (Phase C)
- Default: final_price input is read-only showing negotiated value
- "Override" button reveals editable input + reason dropdown
- On save: log to activities with reason

---

## Effort Estimate

| Phase | Component | Effort |
|---|---|---|
| A | Capture negotiated_price at Negotiation stage | 30 min |
| B | Price Journey card UI + data plumbing | 60 min |
| C | Override flow with reason capture | 30 min |
| - | Testing all 4 scenarios (no negotiated, with negotiated, override, with extras) | 30 min |
| **Total** | | **~2.5 hours focused work** |

---

## Edge Cases to Handle

1. **No proposal exists** — opp closed without ever generating proposal (rare but possible)
   - Skip proposal step in journey, show: Asking → Final
2. **Multiple proposals** — broker generated 2-3, only one accepted
   - Use most recent accepted (status='accepted' or similar)
3. **Override exceeds negotiated** — broker enters HIGHER price than negotiated
   - Warn: "Price higher than negotiated value. Reason required."
4. **Currency rounding** — discount percentages should reconcile to AED
5. **Special offer expired** — proposal's offer was valid only X days
   - Show in journey but flag "Offer expired" if past expiry_date

---

## Tie-in to Existing Features

### Phase 3c (Running Totals)
Once Price Journey shows the negotiated price, the running totals/commission preview
naturally calculate from THAT value. No conflict.

### Audit Trail
Activities log entries:
- "Final price overridden from AED 2M to AED 1.95M — Reason: Last-minute discount"
- These feed the AI Daily Briefing for manager visibility

### Manager Dashboard (future)
- "5 deals had price overrides this month" 
- "Avg discount this quarter: 21.6%"
- Patterns reveal sales practices

---

## Why This Matters for Demo

**Investor question that WILL get asked:**
> *"How does your CRM handle the negotiation journey? Most brokers haggle for weeks."*

**Without Price Journey:** "Uh, broker enters final price at SPA stage."
**With Price Journey:** "We capture the full journey - asking → offer → negotiated → final - automatically. Brokers don't re-enter data, managers see the discount trail, AI can flag unusual patterns."

The second answer wins.

---

## Build Order (post-demo)

1. Schema: add negotiated_price + price_override_reason
2. Capture: extend Negotiation stage gate to save negotiated_price
3. Display: Price Journey card render logic + data query
4. Override: button + reason capture + activity log
5. Testing: 4 scenarios
6. Polish: animations, color coding for discount %

---

## Linked Issues

- **Phase 3c (current sprint)** — Running totals + commission preview
- **Stage 7 (Doomed Opp Workflow)** — Already captured
- **AI Daily Briefing** — Will consume override logs for manager insights
- **Discount Approvals** (existing Stage 3 work) — Override flow could integrate with approval rules

---

*— Spec captured 11 May 2026 by Claude during Stage 5 v3 Phase 3b Split implementation. Build target: post-investor-demo (after Thursday 14 May 2026). Founder explicit defer: "as long as documented and will be completed at the end".*
