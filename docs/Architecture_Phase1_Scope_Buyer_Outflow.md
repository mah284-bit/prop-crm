# Architectural Law — Phase 1 Scope: Buyer Outflow vs Broker Revenue

**Captured:** 19 May 2026 (Tuesday evening, Day 7)  
**Decision authority:** Abid Mirza (founder)  
**Status:** ARCHITECTURAL LAW — applies to all PropCRM development

---

## The Core Architectural Boundary

PropCRM Phase 1 tracks **TWO distinct financial flows** that must NEVER be mixed in the same total or summary:

### Flow 1 — Buyer → Developer (the property deal)
**This is what PropCRM Phase 1 manages end-to-end.**

What buyer pays to developer + government:

### One-time payments (at SPA / handover)
- Net property price (after discount)
- Booking Fee (10% of price, typical)
- DLD Fee (4% of price, paid to Dubai Land Department)
- Oqood Fee (off-plan registration fee, AED 4,020 standard)
- Initial Advance (per payment plan, e.g. 20% for 20/80)
- Admin / handover fees (at SPA stage, developer-specific)

### Recurring payments (annual, post-handover)
- **Annual Maintenance / Service Charge** — AED X per sqft per year, paid to developer or Owners Association
- Varies by building, project, and amenities (typical UAE range: AED 12-30/sqft/year)
- Data field: `units.service_charge_per_sqft` (already exists in PropCRM schema)
- For unit AGR-09-05 at 1800 sqft × AED 15/sqft = AED 27,000/year (example calculation)

**Goes into:** SPA contract, payment schedule, ongoing cost-of-ownership tracking.

**Important distinction:** Maintenance FEE (buyer → developer) is Phase 1.
Maintenance COORDINATION services (broker helps buyer manage their property) is Phase 2.
These are different things — same word "maintenance" but different flows.

### Flow 2 — Developer → Broker (the commission)
**This is broker revenue — tracked separately for commission payouts.**

What broker earns from facilitating the deal:
- Commission percentage of property value
- Stored in `opp.commission_pct`
- Paid from developer to brokerage (not from buyer)
- Tracked for broker payouts, not buyer outflows

**Goes into:** Commission tracking, broker payout reports.

---

## What is NOT in PropCRM Phase 1

The following are **deliberately OUT OF SCOPE for Phase 1**:

### Buyer → Broking Company services (Phase 2)
These represent a SEPARATE agreement between buyer and brokerage:
- Agency liaison fees (2% buyer pays brokerage for help, optional)
- Property management retainer (broker manages buyer's property)
- Tenant-finding services (broker finds tenants for buyer's rental)
- **Maintenance coordination services** (broker arranges repairs/upkeep — NOT the maintenance fee itself, which is Phase 1)
- Resale brokerage services
- Periodic consultation fees

**Clear separation:**
- Annual maintenance FEE paid to developer = Phase 1 (mandatory cost of ownership)
- Broker SERVICE to manage maintenance on buyer's behalf = Phase 2 (optional add-on)

**Why deferred to Phase 2:**
1. Phase 1 must validate core deal pipeline first
2. Demo feedback will reveal which services brokers actually want tracked
3. Adds different VAT/tax treatment that needs careful design
4. Different invoicing system needed
5. Modular addition won't disrupt Phase 1 if isolated cleanly

---

## The Connection Pattern (Phase 1 → Phase 2)

When Phase 2 is built later, it will connect to Phase 1 via:
- Same buyer record (`lead.id`)
- Same property reference (`opportunity.unit_id` if relevant)
- Different workflow with own state machine
- Separate invoicing/payment tracking
- Distinct UI section (e.g., "Property Services" module)

**The dots get connected — but in Phase 2, not now.**

---

## Implementation Rules (binding)

### Rule 1 — Buyer outflow displays
Anywhere PropCRM shows "what buyer pays":
- One-time: Price + Booking + DLD + Oqood + Admin + Initial Advance
- Recurring: **Annual maintenance/service charge (AED × sqft)**
- NEVER mix in: commission, agency fees, broker service retainers
- Label clearly: "Buyer outflow to developer + government"
- Distinguish: one-time vs recurring (recurring shown as "AED X/year")

### Rule 2 — Broker commission displays
Anywhere PropCRM shows broker earnings:
- Show separately as "Broker commission" or "Your commission"
- Use a different visual style (different card, different total)
- NEVER include in same total as buyer outflow

### Rule 3 — Existing UI cleanup needed
**Currently incorrect:** "Client Upfront Costs" card (line ~6838 in App.jsx) includes "Agency Fee 2%"
- This mixes commission into buyer outflow
- Fix planned: Wednesday with fresh brain
- Removal pattern: hide line, keep data in DB, re-introduce in Phase 2 as separate workflow

### Rule 4 — Phase 2b dashboard (current work)
The new Proposals tab cost summary MUST:
- One-time outflow: Net Price + Booking + DLD + Oqood + Initial Advance
- Recurring outflow: Annual maintenance (AED × sqft)
- Show separately: Broker commission as separate line (developer pays this)
- Educational text: "Buyer agency services tracked separately (future module)"
- Pull annual maintenance from: `units.service_charge_per_sqft × units.size_sqft`

---

## Future Phase 2 Module — Property Services

**Trigger for Phase 2 build:** Real broker tester feedback in demos requesting these features.

**Likely features (TBD based on demos):**
- Buyer-brokerage service contract creation
- Tenant management for buyer's rental properties
- Maintenance request tracking
- Resale workflow (selling buyer's existing property)
- Periodic service charges to buyer
- Recurring invoice generation

**Scope NOT defined yet** — will be designed after Phase 1 launches and brokers tell us what they need.

---

## Founder's Strategic Rationale

> "Broker app only to ensure buyers payout to developer is taken care here, if the 
> buyer gets in to an agreement with the broking company then from there we can 
> draw and connect the dots is what my plan is correct me if my thought process 
> is in the right direction."
> 
> "Will bring all this as an addition small spin off module. I dont want to touch 
> that topic at the moment purely upon demo will pick and understand the process"

This reflects:
1. **Scope discipline** — prevent feature creep killing the launch
2. **Modular architecture** — Phase 2 plugs in without disrupting Phase 1
3. **Demo-driven development** — let real users guide feature priorities
4. **Clean accounting** — buyer's contract = one thing, broker's services = another
5. **Investor clarity** — "We start with core, expand modularly" is a strong pitch

---

## Validation Against Industry Practice

Most UAE real-estate CRMs **conflate these two flows**, creating:
- Confused accounting reports
- VAT treatment errors (deal vs services have different rules)
- Broker frustration ("Why is my commission in the buyer total?")
- Investor red flags ("Can't tell where revenue comes from")

PropCRM's clean separation = **competitive advantage** and **architectural integrity**.

---

## Quick Reference Card

When designing ANY new UI element involving money, ask:

| Question | If YES | If NO |
|----------|--------|-------|
| Is this money flowing buyer → developer/government? | Phase 1: include in buyer outflow | Skip |
| Is this money flowing developer → broker? | Phase 1: show as commission (separate) | Skip |
| Is this money flowing buyer → broking company for services? | Phase 2: DEFER | Skip |
| Mixing 2+ of the above into one total? | STOP — wrong | OK |

---

*This document represents an architectural decision binding on all current and future PropCRM development. Any deviation requires founder approval.*

*Captured: Tuesday 19 May 2026, evening session*  
*Context: Discovered during dashboard refactor when designing buyer-outflow summary*  
*Founder caught the conflation in early design before code shipped*

**Correction (20 May 2026, Wednesday morning):**
Original draft incorrectly assigned annual maintenance fee to Phase 2.
Founder corrected: maintenance is paid to developer (Phase 1, recurring annual cost).
Property management SERVICES (broker helping buyer coordinate maintenance) is the
Phase 2 item — different concept, same word.

Data already exists in schema: `units.service_charge_per_sqft` column.
Just needs UI surfacing in buyer outflow displays (planned for Phase 2b).
