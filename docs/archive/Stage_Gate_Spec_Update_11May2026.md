# Stage Gate Spec — Update Notes (11 May 2026 afternoon)

This is an addendum to `Stage_Gate_Enforcement_Spec.md` capturing important
semantic corrections from founder discussion immediately after spec creation.

---

## Critical Semantic Correction

The original spec treated "SPA Signed" as the stage where payments are collected
AND signed. **This is wrong** per founder clarification:

### Actual UAE Broker Workflow

```
Stage (current name)    Semantic reality              What happens here
─────────────────────────────────────────────────────────────────────
Offer Accepted          Deal terms agreed             Price + terms locked
                                                       
Reserved                Buyer commits with payment    Booking + Reservation fees
                        (the unit IS reserved)        collected (5-10 day window)
                                                       
SPA Signed              "PAYMENT COLLECTION" stage    All remaining fees collected:
(misnamed in current     Working toward signature      Initial advance, SPA fee,
 codebase)               Stays here days/weeks         DLD, Oqood, other fees
                                                       
Closed Won              SIGNATURE EVENT               After ALL payments received:
                        Registration completes        Buyer signs SPA
                        Deal officially done          Registration filed
                                                       Deal is WON
```

**Key insight:** "SPA Signed" is the WORKING stage, not the signature event.
The signature happens at the Reserved → Closed Won transition.

---

## Gate Rules — Corrected

### Gate 5 (UPDATED): Reserved → "SPA Signed" stage
**Trigger:** Broker advances opp from Reserved to next stage.

**Required:**
- Booking fee row: status = Received, amount > 0
- Reservation fee row: status = Received, amount > 0

**Reasoning:** Buyer committed to the unit with these two payments.
Now the system enters the "collecting all other fees" stage.

### Gate 6 (UPDATED): "SPA Signed" → Closed Won
**Trigger:** Broker advances opp from "SPA Signed" stage to Closed Won.

**Required (ALL of):**
- ALL fee rows (7 total) status = Received or Waived (no Pending allowed)
- ALL "Received" rows have amount > 0 AND date
- SPA document uploaded (spa_document_path or spa_document_filename set)
- final_price set (already enforced)

**This is the SIGNATURE moment.** Founder words:
> *"No signature till all the money collected"*

After this transition:
- Stage = Closed Won
- Buyer has signed SPA
- Registration complete
- Deal officially WON
- Commission invoiceable

**No partial payments allowed.** All-or-nothing for closure.

---

## Stage Name Refactor — DEFERRED to Post-Demo

The current stage name "SPA Signed" is **semantically misleading** because:
- Brokers in this stage have NOT signed anything yet
- Signature only happens at transition to Closed Won
- True meaning is "Payment Collection" or "SPA In Progress"

### Rename plan (post-demo)

**Proposed new name:** "Payment Collection" or "SPA In Progress"

**Why deferred:**
- "SPA Signed" appears in 30-50+ places in codebase (estimated)
- Database has existing opps with stage='SPA Signed'
- Risk of breaking demo path 3 days before Thursday demo
- Renaming = engineering cleanup, not broker value
- Better to spend time on Stage Gate Enforcement (real product value)

**Effort estimate when undertaken:** ~1.5-2 hours (find/replace + DB migration + testing)

**Scheduled:** Post-investor-demo (after Thursday 14 May 2026)

---

## Implementation Order — Updated

When building gates tonight:

**Phase A — Foundation gates (~1 hour):**
1. Gate 1 — Unit asking_price required at Site Visit / Proposal Sent
2. Gate 2 — Proposal value > 0 required
3. Gate 5 — Reserved → SPA Signed (booking + reservation Received with amounts)
4. Gate 6 — SPA Signed → Closed Won (all fees Received/Waived + SPA doc + final_price)

**Phase B — Price logic (~1 hour):**
5. Gate 3 — Calculated agreed price at Offer Accepted (pre-fill from asking × discount)
6. Gate 4 — Price override warning modal with commission impact

**Phase C — Deduction display (~30 min):**
7. Gate 7 — Booking + Reservation credit notes + Initial advance breakdown

**Testing (~30 min):** End-to-end with test opp.

---

## Gates Use Current Stage Names

For tonight's build, gates use the CURRENT stage names:
- `if (toStage === "SPA Signed")` — refers to current "SPA Signed" stage (semantically "Payment Collection")
- `if (toStage === "Closed Won")` — refers to current "Closed Won" stage (semantically "Signature + Registration")

When the rename happens post-demo, only the string values change. Gate LOGIC stays the same because the SEMANTICS are correct, just the labels are wrong.

---

## Audit Trail Connection

When Gate 6 succeeds (Closed Won), this is the moment to:
- Log to activities: "SPA signed, registration filed, deal closed"
- Trigger commission invoice creation (already exists)
- Notify manager + commission reporting
- Update commission_outstanding dashboard

This is also the moment for AI Daily Briefing to celebrate: "Deal won! AED [final_price]. Your commission AED [calc]."

---

*Update captured 11 May 2026 afternoon by Claude during Stage Gate spec clarification session. Founder explicit confirmation on stage semantics + rename defer per "Name is something we can take a call later no issues".*
