# PropPlatform — Off-Plan Sales Cycle Process Flow

**Date:** 07 May 2026
**Purpose:** Locked process flow for UAE off-plan property sale — broker workflow from agreement to commission. Foundation for module build plan.
**Status:** APPROVED by Abid Mirza — design decisions locked
**For:** Internal product team + investor pitch + onboarding new customers

---

## 1. THE BIG PICTURE

UAE off-plan brokerage works on a **commission model paid by the developer to the broker** after a sale completes. The broker never holds buyer money. This makes the broker's CRM fundamentally different from a typical sales CRM:

- Broker doesn't invoice the buyer
- Broker invoices the **developer** for commission
- Money flows: Buyer → Developer → Broker (commission)
- Broker's job: facilitate the sale, monitor buyer's payment compliance, claim commission once contract executes

**PropPlatform must support this end-to-end so brokers don't switch to developer portals mid-deal.**

---

## 2. THE 6-STAGE LIFECYCLE

```
Stage 0          Stage 1         Stage 2         Stage 3         Stage 4         Stage 5
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│ Master   │→ │ Lead to  │→ │ Booking  │→ │ Buyer    │→ │ SPA /    │→ │ Commission│
│Agreement │  │Opportunity│  │with      │  │Payment   │  │Sale Deed │  │Invoicing  │
│with Dev. │  │(Sale Cycle│  │Developer │  │Tracking  │  │Executed  │  │& Receiving│
│          │  │Today)     │  │(Discount │  │(Manual + │  │(Document │  │           │
│          │  │           │  │may apply)│  │Documents)│  │upload)   │  │           │
└──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘
   ONE-TIME      EXISTING       PARTIAL       NEW BUILD      NEW BUILD     NEW BUILD
                 IN APP         IN APP
```

Each stage has: actors, inputs, outputs, edge cases, and CRM data captured.

---

## 3. STAGE-BY-STAGE DETAIL

### STAGE 0 — Master Broker-Developer Agreement
**One-time setup per developer relationship (e.g., Emaar, Damac, Sobha, Aldar, Nakheel)**

**Actors:** Brokerage management + Developer's broker relations team
**Frequency:** Renewed annually or per project
**Lives in:** Developer Agreements module (new)

**Captured data:**
- Developer name + relationship contact
- Agreement period (start, end, renewal date)
- Default commission percentage (e.g., 4%, 5%)
- Project-specific commission overrides (e.g., 6% on specific high-priority projects)
- Discount authority (does this broker have pre-approved discount tier?)
- Payment terms (commission paid 14 days after SPA, or after 30% buyer payment, etc.)
- Any escalation tiers (e.g., +0.5% bonus after 10 sales/quarter)
- Agreement document (PDF upload)
- Signed by + signed date

**Why it matters:** This becomes the **default values reference** for every deal with that developer. Saves brokers from re-entering commission terms per deal.

**Edge cases:**
- Multiple agreements with same developer (different brokerage entities, multiple branches) → support multiple
- Agreement amendments mid-period → version tracking
- Pre-launch incentives (special commission + cashback for first 50 sales) → captured per project, not master

---

### STAGE 1 — Lead → Opportunity (CURRENT WORKFLOW IN PROPPLATFORM)
**Status: ✅ Already exists in app**

**Actors:** Broker + Buyer
**Lives in:** Leads module → Opportunity module

**Captured data:**
- Buyer profile (name, contact, nationality, budget, preferences)
- Source (Bayut/PF/Facebook/referral/walk-in/etc.)
- Property interest (project, unit type, size)
- Budget range
- Site visit scheduled, completed, feedback
- Offer made, offer amount, offer status
- Probability stage (qualifying → site visit → offer → negotiation)

**This stage works today. No major changes needed.**

**Minor improvements to consider:**
- Show **default commission %** from Stage 0 agreement when project is selected (auto-populate)
- Better source attribution (link to Pillar 3 leads inbox once built)
- Activity timeline showing all touchpoints with buyer

---

### STAGE 2 — Booking with Developer (Discount Application)
**Status: ⚠️ Partially exists (Discount Approvals module exists, needs wiring into sales cycle)**

**Actors:** Broker + Buyer + Developer (sales person at developer's office)
**Lives in:** Opportunity → "Booked" status, Discount Approvals module

**What happens:**
1. Buyer offer accepted → broker takes buyer to developer
2. Developer presents official price + their discount (if any)
3. Broker may offer additional discount **only if pre-approved by developer in master agreement** (Stage 0)
4. Buyer pays booking fee directly to developer (typically 5-10% of property value)
5. Booking form filled at developer's office
6. Unit is now reserved/booked

**Captured data in PropPlatform:**
- Booking date
- Booking fee amount paid (broker confirms with buyer)
- Discount applied (developer's discount + broker discount, both shown)
- Booking form / receipt uploaded as PDF
- Status: "Booking Confirmed"

**Connection to Discount Approvals:**
Discount Approvals module today probably exists for internal approval workflow — broker requests discount approval from manager before offering to buyer. This needs to wire into Stage 2:
- If broker has master agreement authority → discount auto-approved
- If broker exceeds authority → goes to brokerage manager for approval
- Once approved → discount visible in opportunity

**Edge cases:**
- Buyer changes unit mid-booking → preserve original booking ref + new booking
- Buyer cancels booking → preserve record, mark cancelled, adjust pipeline
- Developer changes discount terms after booking (rare but happens) → audit trail

---

### STAGE 3 — Buyer Payment Tracking (NEW — THIS IS THE BIG MISSING PIECE)
**Status: ❌ Not built. THIS IS THE CORE GAP TODAY.**

**The problem you described:**
> *"They monitor on the developers access they get when they become agents/brokers"*

Brokers today log into **5+ different developer portals** (Emaar Connect, Damac Broker, Sobha Partner, etc.) just to check if buyer paid the next milestone. **This is the workflow you want to bring INTO PropPlatform.**

**Actors:** Broker (monitor) + Buyer (payer) + Developer (receiver) + System (tracker)

**Captured data:**
- Payment milestone schedule per project (e.g., 10% on booking, 10% in 30 days, 10% on construction start, etc.)
- Each milestone:
  - Amount due
  - Due date
  - Status: pending / paid / overdue
  - Receipt uploaded by broker (manually after checking developer portal OR uploaded by buyer)
  - Notes (any issues, delays, partial payments)
- Total paid to date / total committed
- Payment compliance score (how on-time is buyer paying?)
- Reminders / follow-ups logged

**How broker uses it (your design decision: Mix of manual + document):**
1. **Manual entry path:** Broker logs into Emaar's portal, sees buyer paid 10% → goes into PropPlatform → marks milestone "Paid" + uploads receipt
2. **Document upload path:** Buyer or broker forwards receipt to PropPlatform → broker tags it to the milestone
3. **Future API path:** If a developer (Emaar, Damac, etc.) provides an API for broker partners, PropPlatform integrates and auto-syncs status. **This is upsell territory — make it possible but don't depend on it.**

**Why this is killer-feature territory:**
Today brokers spend 20-40% of their daily time logging into developer portals to check payment status. **Move this into PropPlatform with notifications + reminders, you save them hours daily.**

**Edge cases:**
- Buyer pays late → automated reminder to broker to follow up
- Buyer defaults / cancels → handover to recovery process, deal goes to "lost"
- Buyer pays in lump sum (not milestone) → support both schedules
- Developer changes payment plan mid-deal → version tracking
- Buyer transfers ownership before completion → support unit assignment changes

---

### STAGE 4 — SPA / Sale Deed Execution (NEW)
**Status: ❌ Not built**

**Actors:** Buyer + Developer (notary or DLD office) + Broker (witness/facilitator)

**What happens:**
1. After certain payment threshold (typically 20-30%) the SPA (Sale & Purchase Agreement) is signed
2. SPA registered with DLD via Oqood (off-plan registration system)
3. Buyer and broker receive copies
4. Final unit allocation confirmed

**Captured data in PropPlatform:**
- SPA signing date
- SPA registration number (DLD/Oqood reference)
- Final unit number/floor/specifications confirmed
- SPA document uploaded
- Property officially "Sold" status in PropPlatform
- Triggers Stage 5 (commission invoice generation eligible)

**This is the milestone that triggers the commission claim.**

**Future opportunity:** if PropPlatform has DLD API access (Pillar 1 deepen, from Day 2 strategic doc), this stage could **auto-update** by querying Oqood for the SPA registration. Until then, manual upload + entry.

---

### STAGE 5 — Commission Invoicing & Receiving (NEW)
**Status: ❌ Not built. Critical for closing the loop.**

**Actors:** Broker + Developer's accounts payable team

**What happens:**
1. SPA signed → broker is now eligible to claim commission
2. Broker raises commission invoice TO the developer (not buyer)
3. Developer pays commission per master agreement payment terms (e.g., 14 days after SPA, or after buyer reaches X% payment)
4. Broker receives commission, marks invoice as paid

**Your design decision (option 4): Mixed approach**
- PropPlatform **generates the invoice DATA** (auto-calculated commission, developer details, deal reference, applicable terms from master agreement)
- Broker can **edit** if any adjustments needed (e.g., partial commission, withholding, etc.)
- Integrates with broker's **existing accounting tool** (Tally / Zoho Books / QuickBooks / Xero)
- Broker sends actual invoice via their accounting tool (which has VAT compliance, official numbering, audit trail)

**Why this is right:**
- UAE has VAT compliance requirements — a CRM-generated invoice won't satisfy FTA without proper accounting integration
- Brokers' accountants already use Tally/Zoho — don't disrupt their accounting workflow
- PropPlatform's role: **track the receivable, generate the data, push to accounting tool, monitor payment status**

**Captured data:**
- Commission % (from master agreement, editable)
- Commission base amount (typically property sale price)
- Commission gross amount (% × base)
- VAT applicable (yes/no per agreement)
- Commission net amount
- Invoice number (assigned by accounting tool after sync)
- Invoice issue date
- Payment due date (per master agreement terms)
- Payment received date (manual mark or webhook from accounting)
- Payment received amount
- Variance (gross vs received)
- Status: Draft / Issued / Pending / Paid / Disputed / Written-off

**This unlocks killer reports:**
- "Outstanding commission by developer" — how much each developer owes the broker
- "Commission aging" — which receivables are 30/60/90 days overdue
- "Commission realization rate" — what % of invoiced commission gets paid
- "Developer payment behavior" — average days to pay per developer (this becomes scoring data)

**Edge cases:**
- Developer disputes commission → raise dispute, partial payment workflow
- Developer goes bankrupt / project cancelled → commission write-off
- Buyer defaults after SPA signed → check master agreement for clawback clauses
- Multiple brokers split commission (rare, but happens with referral partnerships) → split allocation

---

## 4. EDGE CASES SPANNING MULTIPLE STAGES

### What if buyer cancels mid-deal?
- Stage 1-2 (before SPA): Update opportunity status to "Lost — Cancelled", optional reason capture
- Stage 3-4 (after SPA): Trigger refund workflow per developer policy, broker may have clawback obligation
- **CRM behavior:** preserve all history, mark deal as cancelled, exclude from active pipeline

### What if buyer changes unit?
- Common scenario in off-plan
- Original booking → new booking with same buyer
- **CRM behavior:** sub-deal under same opportunity, preserve original record, surface new

### What if commission % is renegotiated mid-deal?
- Variant of master agreement amendment
- **CRM behavior:** opportunity overrides master commission with note, audit trail

### What if multiple brokers worked the deal?
- Splits common in referral business
- **CRM behavior:** support % split per broker on deal, separate commission claims per broker

### What if developer is late paying commission?
- **CRM behavior:** automated reminders to broker (and optionally CC'd to developer), aging report, escalation workflow

---

## 5. DATA MODEL IMPLICATIONS

New tables/modules needed:

### `developer_agreements` (master)
- id, developer_id, brokerage_id
- valid_from, valid_to, renewal_status
- default_commission_pct
- payment_terms (json — flexible terms structure)
- discount_authority_pct
- agreement_document_url
- signed_by, signed_date
- amendments (versioned)

### `payment_milestones` (per opportunity)
- id, opportunity_id
- milestone_name, due_date, due_amount
- paid_amount, paid_date, payment_status
- receipt_document_url
- notes, late_indicator

### `commission_invoices`
- id, opportunity_id, developer_id
- invoice_number (synced from accounting tool)
- gross_amount, vat_amount, net_amount
- invoice_date, due_date, paid_date, paid_amount
- status (draft/issued/pending/paid/disputed/written_off)
- accounting_tool_reference

### Modifications to existing tables
- `opportunities`: add `developer_agreement_id`, `commission_pct_override`, `final_sale_price`, `spa_signed_date`, `spa_reference_number`
- `discount_approvals`: link to opportunity stage (Stage 2)
- Add `documents` table (or polymorphic doc storage) for receipts, SPAs, agreements, booking forms

---

## 6. INTEGRATION POINTS (FUTURE-PROOFING)

### Today (Day 1)
- Manual entry + document upload
- No external integrations required

### Phase A (months 2-3)
- Integration with broker's accounting tool (Tally / Zoho Books / QuickBooks)
- One-way: PropPlatform generates invoice data → pushes to accounting tool

### Phase B (months 4-6, after DLD APIs go live)
- Stage 4 SPA auto-update via Oqood API (DLD)
- Stage 5 commission tracking with bank statement reconciliation

### Phase C (months 6-12, if developers cooperate)
- Per-developer API integrations (Emaar, Damac, Sobha) for Stage 3 auto-sync
- This is upsell territory — premium tier feature

---

## 7. IMMEDIATE BUILD PRIORITIES

### Must build now (Phase 1A — 4-6 weeks):
1. **Developer Agreements module** (Stage 0)
2. **Payment Milestone tracking** (Stage 3) — manual + document upload
3. **SPA execution stage** (Stage 4)
4. **Commission Invoice tracking** (Stage 5) — receivable management, no accounting integration yet
5. **Wire Discount Approvals** into Stage 2 (already exists, needs connection)

### Build next (Phase 1B — 2-4 weeks):
6. Accounting tool integration (Tally first, then Zoho Books)
7. Outstanding Commission report
8. Commission aging dashboard
9. Developer payment behavior scoring

### Build later (Phase 2+):
10. Per-developer API integrations
11. DLD/Oqood auto-update
12. Buyer self-service portal (upload their own receipts)

---

## 8. WHY THIS MATTERS

### For brokers (the value)
- One place for entire deal lifecycle
- Stop logging into 5+ developer portals
- Automated reminders for payment milestones
- Real visibility into outstanding commission
- Clean audit trail for tax/compliance
- Better cash flow forecasting (knowing what commission is coming when)

### For PropPlatform (the moat)
- This data **doesn't exist anywhere else.** Reelly has projects but not deals. Bayut has listings but not transactions. Only PropPlatform owns the **complete deal lifecycle**.
- Aggregated across customers, this becomes **market intelligence**: which developers pay fastest? which projects close fastest? which units have highest commission realization rate?
- Eventually becomes the basis for new revenue streams (broker financing, developer scorecards, market reports)

### For investors (the pitch)
- "PropPlatform owns the deal data nobody else has"
- "Every commission invoice flows through us → predictable revenue per deal"
- "We replace 5 developer portals with 1 broker workspace"
- "End-to-end workflow + AI project intelligence + listing syndication + lead capture = complete UAE broker OS"

---

## 9. WHAT THIS DOES NOT INCLUDE (deliberately)

To keep the build focused, NOT included in Phase 1:

- ❌ Buyer-facing portal (buyer doesn't log in to PropPlatform)
- ❌ Developer-facing module (developers don't log in either)
- ❌ Mortgage/financing tracking (separate module, later)
- ❌ Conveyancing / legal coordination (later)
- ❌ Property handover tracking (post-completion, later)
- ❌ Service charge / community tracking (FM territory, much later)

These can be added in future phases. **Don't dilute Phase 1 scope.**

---

## 10. LOCKED DESIGN DECISIONS (from Abid, 07 May 2026)

1. **Stage 0:** Master Developer Agreements module — defaults editable per deal ✅
2. **Stage 3:** Manual entry + document upload (with API as future possibility) ✅
3. **Stage 5:** Generate invoice data + integrate with accounting tool, with edit option ✅

These are LOCKED and form the basis of the build plan.

---

## NEXT STEPS

1. ✅ This document → save to `D:\prop-crm\docs\Sales_Cycle_Process_Flow.md`
2. ⏳ Build plan document — module-by-module, what's new, what's modified (separate doc)
3. ⏳ Investor pitch deck update — slide showing complete sales cycle as differentiator
4. ⏳ FOUNDER_CONTEXT.md update — lock these decisions for future Claude sessions

---

*Process flow articulated by Abid Mirza based on 15+ years of UAE off-plan real estate experience.*
*Cleaned up + edge cases surfaced + data model implications by Claude.*
*Foundation document for PropPlatform Phase 1 build.*

— BFC · 07 May 2026
