# PropPlatform — Sales Cycle Stages 4-6 (REVISED)

**Date:** 09 May 2026
**Source:** Broker MOM (Abid Mirza, this morning) + 5-point clarification (this afternoon)
**Replaces:** `Sales_Cycle_Process_Flow.md` Stages 4-6 (which were over-designed)
**Status:** Awaiting Abid approval before code

---

## What changed from the original spec

The original spec assumed the broker tracks every payment milestone (booking 10% / construction 20% / 20% / 20% / handover 20%) with full receipt management. **Wrong.**

The MOM clarifies:
- **Brokers don't collect money from buyers** — buyer pays developer directly
- **Brokers don't track installments in detail** — that's developer's responsibility
- **Brokers monitor only the gates** that move the deal forward (booking paid → advance paid → SPA signed)
- **Once SPA is signed, the deal is CLOSED from the broker's perspective**
- **The broker's real concern is COMMISSION COLLECTION from the developer** post-SPA

This changes Stage 4-6 fundamentally. **Simpler than the old design. Better aligned with broker reality.**

---

## REVISED 6-Stage Lifecycle

```
Stage 1          Stage 2         Stage 3         Stage 4         Stage 5         Stage 6
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│ Master   │→ │ Lead to  │→ │ Booking  │→ │ Pre-SPA  │→ │ SPA      │→ │ Commission│
│Agreement │  │Opportunity│  │with      │  │Gates     │  │Signed =  │  │Receivable │
│with Dev. │  │+Site Visit│  │Developer │  │Confirmed │  │Sale Closed│ │+ Outstanding│
│          │  │+Offer     │  │+Discount │  │(checklist│  │(SPA doc  │  │Dashboard  │
│          │  │           │  │          │  │only)     │  │uploaded) │  │           │
└──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘
   ✅ DONE       ✅ DONE       ⚠️ PARTIAL     ❌ TO BUILD   ❌ TO BUILD    ❌ TO BUILD
```

---

## Stage-by-stage — what's actually needed

### Stage 1 — Master Agreement
✅ **DONE.** Already shipped.

### Stage 2 — Lead → Opportunity → Site Visit → Offer
✅ **DONE.** Already exists in app + commission auto-populates from Stage 1.

### Stage 3 — Booking with Developer (broker introduces buyer)
**What broker does:** Takes buyer to developer. Developer presents official price. Broker may offer additional discount IF pre-approved in master agreement.

**What CRM needs to capture:**
- Booking date (when buyer agrees + signs booking form at developer's office)
- Discount offered: from developer + from broker (if any)
- Booking fee amount (broker confirms with buyer it's been paid)

**Status: ⚠️ PARTIAL** — discount approvals module exists. Just needs wiring into opportunity stage flow. Small piece.

**Effort: 1 day.**

### Stage 4 — Pre-SPA Payment Gates (REDESIGNED)
**What broker does:** Confirms (with buyer or via developer portal) that the buyer has paid the gates required to proceed to SPA. **Not detailed installment tracking — just confirmation of milestones reached.**

**What CRM needs to capture (a SIMPLE checklist):**
- ☐ Booking fee paid to developer (confirmed by broker)
- ☐ Reservation/advance paid to developer (confirmed by broker)  
- ☐ Any other developer-required pre-SPA payments (configurable per developer)

For each gate:
- Confirmed (yes/no)
- Date confirmed
- Confirmed by (broker user)
- Optional: notes from buyer ("paid 5 May, transfer ref XYZ")

**No amount tracking. No receipts uploaded by broker. No reminders for installments.** Broker only flips toggles.

**When ALL gates checked → "Push to SPA" button enabled.** Otherwise opportunity can't advance to Stage 5.

**Effort: 1 day.**

### Stage 5 — SPA Signed = Sale Closed (NEW)
**What broker does:** Buyer signs SPA at developer's office (or DLD). Broker uploads SPA copy. **Deal is now CLOSED WON from broker perspective.**

**What CRM needs to capture:**
- SPA signing date
- SPA reference number (DLD/Oqood ref, optional but recommended)
- SPA document uploaded (PDF, private bucket, signed URL like Stage 1)
- Final sale price (may differ from offer if discount applied)
- Opportunity status auto-flips to "Closed Won"

**Triggers:**
- Commission record auto-created in Stage 6 (commission_pct × final_price)
- Opportunity locked from edits (becomes historical record)

**Effort: 1 day.**

### Stage 6 — Commission Receivable + Outstanding Dashboard (NEW)
**What broker does:** Once deal is closed (Stage 5), broker raises invoice **to developer** (NOT buyer). Tracks payment from each developer over 30/60/90 days.

**What CRM needs to capture (commission record):**
- Linked to opportunity (which closed)
- Linked to developer (from master agreement)
- Commission gross amount (auto-calculated from sale price × commission %)
- VAT (5% UAE standard, optional toggle)
- Net amount owed
- Invoice number (broker's accounting tool ref, manual entry)
- Invoice date
- Payment status: outstanding / partially paid / paid / disputed
- Payment received date(s) — supports partial payments
- Days outstanding (auto-calculated)

**The killer dashboard:**
```
COMMISSION OUTSTANDING

By Developer:
  Emaar:    3 deals · AED 240,000 · oldest 45 days  [View Details]
  DAMAC:    1 deal  · AED 100,000 · 12 days         [View Details]
  Aldar:    2 deals · AED 180,000 · 30 days         [View Details]
  ─────────────────────────────────────
  TOTAL:    6 deals · AED 520,000 outstanding

By Aging:
  Current (0-30 days):  AED 280,000
  Overdue (31-60):      AED 150,000
  Critical (60+):       AED 90,000

Realized this month:   AED 180,000
Realization rate:      78% (paid / invoiced last 90 days)
```

**Why this matters:**
- This is the broker's REAL pain point — knowing what each developer owes them
- Replaces 5 developer portal logins with one PropPlatform dashboard
- Enables real cash-flow forecasting
- Aging report = fuel for follow-up calls
- Realization rate per developer = data nobody else has (future market intelligence product)

**Effort: 2 days.**

---

## TOTAL EFFORT ESTIMATE (revised)

| Stage | Effort |
|---|---|
| Stage 3 (wire discount approvals) | 1 day |
| Stage 4 (Pre-SPA gates checklist) | 1 day |
| Stage 5 (SPA signed = closed) | 1 day |
| Stage 6 (Commission + dashboard) | 2 days |
| **Total** | **5 days** |

**Plus testing/polish: 1 day. Total: 6 days.**

This is **dramatically simpler** than the original 15-18 day estimate. **Because we're building what brokers actually need, not what we initially thought they might want.**

---

## Suggested build order

**Sequence: Stage 5 → Stage 6 → Stage 4 → Stage 3**

Why this order:
1. **Stage 5 first** — defines "closed won" trigger that Stage 6 needs
2. **Stage 6 second** — the killer feature (outstanding dashboard) — biggest investor wow
3. **Stage 4 third** — adds gates to flow (small, polish)
4. **Stage 3 last** — wire existing discount module (easiest)

Optional alternate: Stage 6 first if it's the priority feature for investor demo.

---

## Database schema (revised)

### Drop the wrong table
```sql
DROP TABLE IF EXISTS pp_payment_milestones;
```

### New tables needed

#### `pp_pre_spa_gates` (Stage 4)
Simple checklist gates per opportunity. **Not a transaction log.**
```
id (uuid)
opportunity_id (uuid FK)
gate_type (text: 'booking_paid' | 'advance_paid' | 'other')
gate_label (text — display name)
confirmed (boolean default false)
confirmed_at (timestamptz)
confirmed_by (uuid FK profiles)
notes (text optional)
company_id (uuid FK + RLS)
created_at, updated_at
```

#### `pp_sales_closures` (Stage 5)
The SPA-signed record. One per closed opportunity.
```
id (uuid)
opportunity_id (uuid FK)
spa_signed_date (date)
spa_reference_number (text)
spa_document_path (text)  -- private bucket
spa_document_filename (text)
final_sale_price (numeric)
notes (text)
company_id, created_by, created_at, updated_at
```

#### `pp_commission_invoices` (Stage 6)
Commission receivable per closed deal.
```
id (uuid)
opportunity_id (uuid FK)
sales_closure_id (uuid FK pp_sales_closures)
developer_id (uuid FK pp_developers)
master_agreement_id (uuid FK pp_master_agreements)

-- Amount calculation
sale_price (numeric)
commission_pct (numeric)
commission_gross (numeric — auto)
vat_pct (numeric default 5.00)
vat_amount (numeric — auto)
commission_net (numeric — auto)

-- Invoice tracking
invoice_number (text — broker's manual ref)
invoice_date (date)
invoice_status (text: 'draft' | 'issued' | 'partially_paid' | 'paid' | 'disputed' | 'written_off')
amount_received (numeric default 0)
last_payment_date (date)
disputed_reason (text optional)

company_id, created_by, created_at, updated_at
```

---

## What gets DROPPED from the original spec

- ❌ Detailed payment milestone tracking (10% / 60% / 20% etc.)
- ❌ Per-installment receipt uploads by broker
- ❌ Buyer payment compliance scoring
- ❌ Reminders to broker per installment
- ❌ Auto-generated 6-milestone schedules

These are all things the **developer** does in their portal. **Not the broker's job.**

---

## Investor pitch (now simpler and stronger)

**Old story:** "We track every payment milestone for every deal."
- Hard to explain
- Brokers say "but I don't do that"

**New story:** "We replace the broker's daily ritual — logging into 5+ developer portals to check 'has my deal closed yet, and have I been paid yet'. With PropPlatform, both questions are one dashboard."
- Easy to explain
- Brokers immediately get it
- Real pain solved

---

## Open questions (all minor — can be decided during build)

1. **Multi-installment commission:** Some master agreements pay commission in tranches (e.g., 50% on SPA, 50% after first buyer payment). Should `pp_commission_invoices` support multiple receivables per closure? **Recommendation: yes, allow multiple commission_invoices per closure.**

2. **Currency:** AED only or multi-currency support? **Recommendation: AED only for Phase 1.**

3. **VAT default:** 5% standard. Should it be editable per invoice? **Recommendation: yes, editable; default to 5.**

4. **Aging buckets:** What's "current" vs "overdue" — depends on master agreement payment_days. **Recommendation: use `master_agreement.payment_days` from Stage 1; if null, default 14 days.**

---

## Approval checklist

Before we code anything, confirm:

☐ Stage 4 = simple checklist (booking paid / advance paid), not detailed tracking
☐ Stage 5 = SPA signing = deal closed (single record, not per-stage-detail)
☐ Stage 6 = commission outstanding from developer (the broker's real concern)
☐ Drop `pp_payment_milestones` table — it's wrong direction
☐ Build order: Stage 5 → 6 → 4 → 3 (or 6 first if investor priority)
☐ Total effort ~6 days (vs original 15-18 days)
☐ DROP from scope: per-installment tracking, buyer payment compliance, auto schedules

If all six checked → we proceed.

---

— Revised by Claude based on Abid's broker MOM and 5-point clarification
— Date: 09 May 2026 (this afternoon)
