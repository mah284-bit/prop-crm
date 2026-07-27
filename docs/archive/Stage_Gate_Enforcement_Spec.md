# Stage Gate Enforcement & Calculated Price — Comprehensive Spec

**Status:** Spec captured 11 May 2026 (Monday afternoon). Build target: tonight after 2-hour break.
**Founder spec:** Abid Mirza, BFC

---

## The Vision

Every stage transition in the opportunity workflow should ENFORCE business rules that match real UAE broker practice. **No silent data corruption. No fake progress. No bad commission calculations.**

This is the SAFETY NET that separates "professional broker software" from "fake-it CRM."

---

## The Five Stage Gates

### Gate 1: Site Visit / Proposal Sent — Unit must have asking_price

**Founder's words:**
> *"Sending before even going to offer accepted, the unit selected and there is no price for some reason should not even move forward."*

**Rule:** Cannot advance opportunity to Site Visit or Proposal Sent stage if linked unit has no `asking_price` (or `original_price` or any price field).

**Why:** Broker pitching a unit with no price = pitching fiction.

**Implementation:**
- In `commitStageMove`, when toStage is "Site Visit" or "Proposal Sent":
  - If `opp.unit_id` exists, query `project_units.original_price` (and price_per_sqft)
  - If null/zero → block with toast: "Unit has no asking price. Contact your manager to set unit pricing before proceeding."
- Apply same check in `moveStage` (both paths)

**Effort:** ~15 min

---

### Gate 2: Proposal Sent — Proposal value must be > 0

**Founder's words:**
> *"Then a proposal is sent even there the proposal of 0 value not be sent"*

**Rule:** Cannot send a proposal with `asking_price` of 0 or null. Even more strict: proposal `final_price` must be > 0.

**Why:** A 0-value proposal is meaningless. Will look unprofessional to buyer + confuse commission calc.

**Implementation:**
- In the proposal save handler (already exists at line 3689):
  - Before insert, validate `asking_price > 0`
  - If discount is applied, validate `final_price > 0`
  - If failed → toast: "Cannot send proposal at AED 0. Enter asking price first."

**Effort:** ~10 min

---

### Gate 3: Negotiation / Offer Accepted — Agreed price should be CALCULATED, not free-entry

**Founder's words:**
> *"The agreed price what we are forced to enter, should be a calculated field from the base value and discount %age and final discussion if they want to change the price"*

**Rule:** When transitioning to Negotiation or Offer Accepted, the "agreed price" should be PRE-FILLED from:
- `asking_price - (asking_price × discount_pct / 100)`
- This is what a buyer accepted in the proposal

**Free entry is allowed BUT triggers a WARNING.**

**Why:** Brokers shouldn't type random numbers. The proposal flow already calculated the offer price. Manual entry = sign of a manual override that needs justification.

**Implementation:**
- In the Offer Accepted / Negotiation stage gate dialog:
  - Pre-fill `offer_price` field with calculated value (asking × (1 - discount/100))
  - Show a small label: "Calculated from proposal — broker can override"
- If broker changes the value:
  - Detect the change (initial value vs current)
  - Show inline warning (see Gate 4)

**Effort:** ~25 min

---

### Gate 4: Price Override Warning — Affects commission disclosure

**Founder's words:**
> *"As a broker I should be allowed to enter the final value as a broker in our system, give them warning while change ensure you are changing match with developer offer and proceed as this will effect your commission and you should be aware. Then goes forward."*

**Rule:** When broker manually overrides any price field (offer_price, final_price, agreed_price), show prominent warning:

```
⚠️ Price Override Warning
You're changing the price from AED X to AED Y.

This change will affect:
  • Your commission calculation (current: AED Z @ 4%)
  • New commission: AED Y × 4% = AED W
  • Difference: AED [Z-W]

Confirm this matches the developer's authorization.
Your broker license depends on accurate price tracking.

[Cancel]  [Confirm Override]
```

**Why:** Broker commission depends on price. Wrong price = wrong commission. Wrong commission = compliance issue. Wrong compliance = lost license.

**Implementation:**
- On any price field blur/change, compare new vs original
- If different → modal popup with warning + commission impact preview
- Two buttons: Cancel (revert) or Confirm Override
- If Confirm: log to activities as "Price override: [old] → [new] by [broker]"
- Audit trail visible to manager

**Effort:** ~30 min

---

### Gate 5: Reserved → SPA Signed — Booking + Reservation required

(Already established from earlier discussion.)

**Rule:** Cannot advance Reserved → SPA Signed unless BOTH:
- Booking fee row: status = Received, amount > 0
- Reservation fee row: status = Received, amount > 0

**Founder's clarification:** These two are mandatory commitment payments. 5-10 day window. One or both may credit forward toward initial advance.

**Implementation:**
- In Confirm SPA Signed button validation block:
  - Read prePaymentsState
  - Verify booking_fee.status === "received" AND booking_fee.amount > 0
  - Verify reservation_fee.status === "received" AND reservation_fee.amount > 0
  - If either failed → toast: "Booking and Reservation fees both required (with amounts) to advance to SPA Signed. These are mandatory commitment payments."

**Effort:** ~15 min

---

### Gate 6: SPA Signed → Closed Won — Full payment + signed SPA

**Founder's clarification:**
> *"All the amount is paid in full or (partial in some cases) will not start the registration, once the registration and Signing is done, it completes the process and SPA Signed and won"*

**Rule:** Cannot advance SPA Signed → Closed Won unless:
- All 7 fee rows: status = Received or Waived (no Pending allowed)
- All "Received" rows have amount + date
- SPA document uploaded (PDF / image of signed SPA)

**Why:** Closed Won = deal complete = commission claimable. Need full evidence trail.

**Implementation:**
- In Confirm Closed Won button validation:
  - Verify all rows in prePaymentsState have status !== "pending"
  - Verify all "received" rows have amount + date
  - Verify spa_document_path or spa_document_filename is set
  - If failed → toast naming specific missing items

**Effort:** ~20 min

---

### Gate 7: Booking + Reservation Deduction Display

(Already discussed.)

**Founder's clarification:**
> *"Advance/reservation fee maybe adjusted in the initial payment, meaning if I have to 100 as initial payment, 10 adv + 10 reservation will be deducted from 100 and taken only 80"*

**Rule:** Booking and Reservation amounts CREDIT toward future Initial Advance payment.

**Implementation:**
- Display note on Booking + Reservation rows: "Credits toward initial advance"
- Initial advance row should show:
  - "Expected: AED [from payment plan]"
  - "Less booking/reservation credits: AED [sum]"
  - "Actual due from buyer: AED [Expected - credits]"
- Payment Summary card adds: "Net cash collected" (excluding credits) — optional

**Note:** This is DISPLAY ONLY. Does NOT affect the running totals math we already built (which correctly tracks actual cash received).

**Effort:** ~30 min

---

## Total Effort Estimate

| Gate | Effort |
|---|---|
| 1: Unit asking_price gate | 15 min |
| 2: Proposal value gate | 10 min |
| 3: Calculated agreed price | 25 min |
| 4: Override warning modal | 30 min |
| 5: Reserved → SPA Signed gate | 15 min |
| 6: SPA Signed → Closed Won gate | 20 min |
| 7: Deduction display | 30 min |
| Testing all 7 gates | 45 min |
| **Total** | **~3 hours 10 min focused** |

---

## Build Order (recommended)

**Phase A — Foundation gates (~1 hour):**
1. Gate 1 (Unit asking_price)
2. Gate 2 (Proposal value)
3. Gate 5 (Reserved → SPA Signed)
4. Gate 6 (SPA Signed → Closed Won)

These are validation-only, no UI changes. Lowest risk.

**Phase B — Price logic (~1 hour):**
5. Gate 3 (Calculated agreed price)
6. Gate 4 (Override warning modal)

These add UI components and modal flows.

**Phase C — Deduction display (~30 min):**
7. Gate 7 (Credit notes + Initial advance breakdown)

Pure UI enhancement.

**Testing (~30 min):**
Walk through all stages with a test opp end-to-end.

---

## Schema Requirements

### Existing (no changes needed):
- `opportunities.offer_price` ✅
- `opportunities.final_price` ✅
- `opportunities.budget` ✅
- `opportunities.discount_pct` ✅
- `opportunities.commission_pct` ✅
- `project_units.original_price` ✅
- `pp_sales_closures.pre_spa_payments` JSONB ✅

### New (recommended for full audit trail):
- `opportunities.price_override_history` JSONB — array of {timestamp, old_value, new_value, reason, by_user_id}
- Or just use existing `activities` table for override logs (simpler)

---

## Tie-in to Existing Specs

| Existing spec | Relationship |
|---|---|
| Stage 7 Doomed Opp Workflow | Independent — fires when unit becomes unavailable |
| Stage 5 v4 Price Journey | RELATED — Gate 3 (calculated agreed price) is the foundation. Stage 5 v4 just adds the visual "journey" card showing the calculation breakdown |

**Stage 5 v4 spec can be UPDATED to reference Gate 3 as its dependency.**

---

## Demo Significance

**Investor demo question that WILL be asked:**
> *"How do you prevent brokers from gaming the system or making data entry errors?"*

**Without Stage Gates:**
"We trust our brokers to enter accurate data."

**With Stage Gates:**
"We enforce business rules at every stage transition. Unit must have price before quoting. Proposal can't be sent at zero value. Agreed price is calculated, not free-entered. Price overrides trigger commission impact warnings. Reservations require committed payments. Closed Won requires signed SPA + full payment trail. This is what UAE compliance requires, and PropPlatform makes it impossible to violate."

**That's the difference between toy CRM and broker compliance software.**

---

## Audit Trail Side Effects

Each gate violation attempt is itself useful data:
- Manager dashboard: "5 brokers tried to advance past Offer Accepted without offer_price this month" → training opportunity
- AI Daily Briefing input: "John tried to advance EBT-09-05 without booking — needs follow-up"
- Compliance reporting: System enforces > log violations > prove compliance

---

## What This Replaces

The current behavior at each stage:
- **No validation** at Site Visit / Proposal advance
- **No validation** of proposal price
- **Free-entry** offer_price at Offer Accepted (line 7548: "Offer Accepted - no required fields")
- **Manual entry** of agreed price (broker types whatever)
- **No commission impact warning** when prices change
- **Soft validation** at SPA Signed (date only, not amounts in some paths)
- **No validation** at Closed Won besides final_price

---

*Spec captured 11 May 2026 by Claude during Monday post-lunch session. Founder explicit instructions: "I dont want to stop the momentum it is really on the peek of exploding the app". Build starts after 2-hour break, same day. All 7 gates to be built in 3 phases tonight.*
