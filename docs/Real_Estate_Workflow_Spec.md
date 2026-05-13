# Real Estate Workflow Specification
**Capturing the Real UAE Real Estate Sales Workflow**

**Captured:** 13 May 2026 (Wednesday afternoon)
**Source:** Founder articulation during Wednesday dry-run session
**Purpose:** Document the real UAE off-plan and ready property sales
workflow as understood by founder (broker industry expert), so PropCRM
can evolve to match it. Today's PropCRM is a simplified MVP; real
workflow has more nuance and intermediate states.

---

## 1. Why This Document Exists

During Wednesday 13 May 2026 dry-run, founder articulated the complete
UAE real estate sales workflow from offer to closure. This includes
several intermediate states currently not modeled in PropCRM. Capturing
now while fresh in memory so:

- Phase B/C development can target real workflow
- Tester conversations have shared reference
- Broker industry partnerships have structured discussion basis
- Investor pitch can claim *"PropCRM models the real workflow, not a
  generic CRM"*

**Critical founder quote (13 May 2026):**

> *"once all the money is collected presuming all the required documents
> collected which is our final update before meeting, when the cheques
> and other details are taken. They will take the buyers appointment and
> in the background they will fix all the required meetings with
> authorities and prepare the sale deeds and all the documents required.
> Final step is the buyer will come sign the papers and take them along
> or documents sent if outside the country sale to sign the documents and
> collected once every penny is collected everything is signed the final
> click is won and close. For now this is my brain which can be captured
> for development"*

---

## 2. Current PropCRM Workflow (MVP — 8 Stages)

PropCRM today models a simplified 8-stage flow:

| # | Stage | What Happens | PropCRM State |
|---|---|---|---|
| 1 | New | Lead just entered, not contacted | `stage = "New"` |
| 2 | Contacted | First contact made (call/email) | `stage = "Contacted"` |
| 3 | Site Visit | Buyer visited the unit | `stage = "Site Visit"` |
| 4 | Proposal Sent | Formal proposal/quote sent | `stage = "Proposal Sent"` |
| 5 | Negotiation | Back-and-forth on price/terms | `stage = "Negotiation"` |
| 6 | Offer Accepted | Buyer agreed to terms | `stage = "Offer Accepted"`, `offer_price` set |
| 7 | Reserved | Reservation fee paid (typically 5 working days) | `stage = "Reserved"`, `reservation_amount` set, timer running |
| 8 | SPA Signed | Sale & Purchase Agreement signed | `stage = "SPA Signed"`, `final_price` set, SPA doc uploaded |
| 9 | Closed Won | Deal complete | `stage = "Closed Won"` |

**Current SPA Signed → Closed Won transition is a single button click.**
**Real-world: this is 5+ distinct sub-stages with 1-3 weeks elapsed time.**

---

## 3. Real UAE Workflow (As Articulated by Founder)

The real workflow has significant nuance between "Offer Accepted" and
"Closed Won" that PropCRM currently collapses into 2-3 stages.

### Real Flow

```
1. Offer Accepted     (price + terms agreed verbally/in proposal)
   ↓
2. Booking Amount     (small fee to demonstrate buyer seriousness)
                      — Sometimes collected BEFORE offer accepted
   ↓
3. Reservation        (formal reservation, typically 5% of price)
                      — 5 working day window
   ↓
4. Negotiation Output (DLD payer agreed: buyer/developer/split,
                       discount %, concessions like waived maintenance,
                       free parking, free DLD, etc.)
   ↓
5. Money Collection   (full down payment, scheduled cheques, advances)
                      — Multiple payment milestones
                      — All payment methods tracked
   ↓
6. Document Collection (KYC, NOC, passport, residency, employment
                        proof, source of funds, etc.)
                      — Different for resident vs non-resident
                      — Different for individual vs company buyer
   ↓
7. Background Operations (broker working with developer/authorities)
                        — DLD pre-registration
                        — Oqood registration
                        — NOC clearance
                        — Sale deed preparation
                        — Title deed preparation
                        — Mortgage finalization (if applicable)
   ↓
8. SPA Signing Meeting (formal meeting where buyer signs documents)
                       — In-person at developer office, OR
                       — Remote (POA, courier, video conference)
                       — Witness/notarization
   ↓
9. Final Payment + Documents (last payment, all docs signed and
                              exchanged)
   ↓
10. Closed Won           (deal complete, broker earned commission,
                          property transferred)
```

**Key insight from founder:**
> *"The final click is won and close"* — Closed Won is the LAST step,
> not the first time SPA is mentioned.

### Time elapsed

- Steps 1-2: same day to few days
- Steps 3-4: 5-15 days (within reservation window + negotiation)
- Steps 5-7: 2-8 weeks (depends on financing, documentation, authority delays)
- Steps 8-10: 1-3 days

**Total deal cycle: 4-12 weeks typical, 6+ months for complex deals.**

---

## 4. Gap Analysis (Current PropCRM vs Real World)

### 4.1 Missing intermediate stages

| Real Workflow Stage | PropCRM Equivalent | Gap |
|---|---|---|
| Booking Amount | (none) | Not captured. Sometimes collected before Offer Accepted. |
| Negotiation Output (DLD split, etc.) | Partial — captured at SPA Signed | Should be captured at Negotiation stage end |
| Money Collection (multiple milestones) | `pp_payments` table (basic) | Need richer milestone tracking |
| Document Collection | (none) | Need document checklist + status |
| Background Operations | (none) | Need workflow board for broker tasks |
| SPA Signing Meeting | Conflated with SPA Signed stage | Should be distinct sub-state |
| Final Payment | Conflated with Closed Won | Should be distinct sub-state |

### 4.2 Missing data points

- **Payment milestones structure:** booking fee → reservation → down payment → installments → final
- **Document checklist:** customizable per buyer type (resident/non-resident, individual/company)
- **Authority interactions log:** DLD visits, NOC requests, etc.
- **Approval workflow:** discount approval, commission split approval
- **Broker activity backlog:** "things to do before SPA signing"

### 4.3 Missing workflow UX

- **Stage gate dialogs treat already-completed stages as "new"** (you reported 13 May 2026):
  - Clicking "Reservation" on already-reserved opp opens blank form
  - Should detect existing state → show readonly view with edit option
- **No "buyer seriousness" indicators** (booking amount paid, KYC complete, etc.)
- **No background task tracking** (broker preparing documents, meeting authorities)

---

## 5. UX Patterns Needed

### 5.1 "Already in this stage" detection

When user clicks a stage gate button for a stage the opp is already in:

**Current behavior:** Opens blank form
**Desired behavior:** 
- Detect opp.stage matches the gate clicked
- Show **readonly view** of stored data
- Provide **"Edit"** button if user wants to modify
- Provide **"Re-record"** button if user wants to fully redo
- Block "Advance" until next-stage criteria met

### 5.2 Stage progression breadcrumb

Show clearly where each opp is in the real workflow:
- ✅ Offer Accepted (12 May)
- ✅ Reservation paid (13 May, expires 18 May)
- ✅ Negotiation outputs recorded (14 May)
- ⏳ Money collection in progress (3/5 milestones)
- ⏳ Documents (4/7 collected)
- ⏰ Background operations (DLD pending)
- ⏰ SPA Signing meeting scheduled (22 May)
- ⏰ Final payment + closure

### 5.3 Status badges per sub-state

Each sub-state has its own visual indicator:
- 💰 Money: 3/5 milestones collected
- 📄 Docs: 4/7 collected
- 🏛️ DLD: pre-registration done
- 🖊️ SPA: meeting scheduled
- ✅ Won: closed

---

## 6. Phase B / C Implementation Plan

### Phase B (post-demo, week of 19 May 2026)

**Day 1-2:** UX fixes that DON'T require schema changes
- ✅ Fix "already in stage" dialogs (show readonly + edit option)
- ✅ Carry forward negotiation outputs to SPA dialog
- ✅ Auto-fill prices from previous stages

**Day 3:** Light schema additions
- Add `pp_sales_closures` fields for sub-stages
- Add `pp_payment_milestones` (extend existing)
- Document checklist table

**Day 4-5:** Workflow board
- "Things to do" per opp in pre-SPA phase
- Stage transition prevention until criteria met

### Phase C (post-funding)

**Major refactor:** Replace 9-stage flat model with hierarchical model:
- Top level: New → Contacted → Engaged → Reserved → Pre-Closure → Closed Won
- Sub-stages within each, customizable per company
- Configurable workflow per developer (different processes)

**Engineer requirement:** Hire someone with UAE real estate domain
knowledge.

### Phase D (scale)

- Multi-tenant workflow customization
- Developer-specific workflows (Emaar process vs Sobha process)
- Buyer-type workflows (resident vs non-resident vs company)
- Mortgage flow vs cash flow

---

## 7. Questions for Broker Conversation (Tomorrow)

When founder meets with brokers/testers tomorrow, validate these
specific questions:

### About booking amount
1. Is booking amount always collected? At what stage?
2. Is it the same as reservation amount or separate?
3. Receipt format expected?
4. Can buyer refuse to pay booking and still proceed?

### About negotiation outputs
5. When are concessions formally agreed (verbal vs written)?
6. Do brokers track concessions per opp or per deal?
7. Discount approval flow — who approves what amounts?

### About money collection
8. How many payment milestones typically?
9. Cheque vs bank transfer vs cash — what's typical for off-plan?
10. PDC (Post-Dated Cheques) tracking — how is it handled?
11. Mortgage cases — who tracks bank approval timeline?

### About documents
12. Standard document checklist for resident UAE buyer?
13. Different for non-resident?
14. Who keeps custody during processing?

### About background operations
15. Typical broker tasks between SPA "agreed" and "signed"?
16. How is timeline managed (broker reminders)?
17. What goes wrong most often that delays closure?

### About SPA signing
18. In-person vs remote — what's the split?
19. Power of attorney flow when buyer is overseas?
20. Document witnessing requirements?

### About Closed Won
21. Is "Closed Won" when SPA signed or when full payment received?
22. Commission timing — at SPA or at full payment?
23. Refund risk window — can deals reverse after Closed Won?

---

## 8. Founder's Words to Preserve

**On real workflow complexity:**
> *"in the background they will fix all the required meetings with
> authorities and prepare the sale deeds and all the documents required"*

**On final closure:**
> *"Final step is the buyer will come sign the papers and take them
> along or documents sent if outside the country sale to sign the
> documents and collected once every penny is collected everything is
> signed the final click is won and close"*

**On UX gap:**
> *"click Reservation it opens the screen again, when it is already
> reserved it should not bring the new form blank... should bring up
> the data and say already reserved or should mask the Reservation
> button"*

**On product evolution philosophy:**
> *"For now this is my brain which can be captured for development"*

This last quote captures the meta-principle: **the founder's domain
knowledge is the product. Capturing it is product development.**

---

## 9. Status Summary

| Area | Today (13 May 2026) | Phase B Target | Phase C Target |
|---|---|---|---|
| Stage model | 9 flat stages | Same + UX fixes | Hierarchical with sub-stages |
| Booking amount | Not tracked | Capture at appropriate stage | Configurable per developer |
| Negotiation outputs | Captured at SPA Signed | Captured at Negotiation end | Required field |
| Money milestones | Basic pp_payments | Richer milestone tracking | Full milestone configurability |
| Documents | Not tracked | Basic checklist | Configurable per buyer type |
| Background ops | Not tracked | Tasks board | Workflow board |
| "Already done" UX | Opens blank form | Readonly + edit | Smart context-aware UI |

**Demo (Thursday 14 May 2026):** 9-stage flat model is acceptable.
Investor pitch: *"Phase 2 builds the rich workflow with broker partner input."*

---

*Last updated: 13 May 2026 (Wednesday afternoon, after dry-run reveals)*
*Founder energy: still sharp after customer call, articulating product*
*vision with clarity. Excellent product-knowledge capture session.*
