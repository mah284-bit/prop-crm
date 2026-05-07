# PropPlatform — Phase 1 Build Plan: Complete Sales Cycle

**Date:** 07 May 2026
**Purpose:** Module-by-module specification for building the complete UAE off-plan sales cycle in PropPlatform. Companion to `Sales_Cycle_Process_Flow.md`.
**Status:** Build plan derived from locked process flow
**For:** Abid Mirza + dev team

---

## ⚠️ REVISION NOTE — 07 May 2026 afternoon

After running database diagnostic queries (see `PropPulse_Diagnostic_07May2026.md`), discovered that **existing schema is richer than this plan assumed.** Specifically:

- **`pp_commissions` table already exists** with 16 columns supporting per-developer + per-project commission rates, validity periods, registered broker authority, and source URLs. **Module 1 (Developer Agreements) should EXTEND this table, not create a new `developer_agreements` table.** Saves ~1 week of build work.

- **`pp_launch_events` table already exists** with location, registration, invite-only fields. Useful for future launch tracking features.

- **`project_units` has 54 columns** including premium features (private_pool, private_garden, maid_room, etc.), pricing tiers, document URLs, and multi-tenancy flags. Genuinely thorough schema.

**Revised total effort: 7-11 weeks (was 8-12).** Module 1 details below should be read with this revision in mind. Other modules unchanged.

**Action item:** Module 1 design needs to be redone to map onto `pp_commissions` rather than creating new tables. This is a 30-60 min revision task before Phase 1 development begins.

---

## ONE-PAGE SUMMARY

To complete the sales cycle, PropPlatform needs **5 new/modified modules** built over **7-11 weeks** (revised from 8-12 after schema discovery):

| # | Module | Status | New/Modify | Effort | Notes |
|---|---|---|---|---|---|
| 1 | Developer Agreements | EXTEND | Extend `pp_commissions` | 3-5 days | Was 1.5-2 weeks before schema discovery |
| 2 | Opportunity Detail (extended) | MODIFY | Extend existing | 1 week | |
| 3 | Payment Milestones | NEW | New module + UI | 2-3 weeks | |
| 4 | SPA / Sale Deed tracking | NEW | New module | 1 week | |
| 5 | Commission Invoicing | NEW | New module | 2-3 weeks | Separate from `pp_commissions` (different purpose) |
| 6 | Discount Approvals integration | MODIFY | Wire into Stage 2 | 0.5 weeks |
| 7 | Reports & Dashboards | NEW | Outstanding/Aging | 1-1.5 weeks |

**Total: 7-11 weeks of focused dev work** (revised from 9-12 after schema reuse identified)

This plan covers Phase 1A (must-have) only. Phase 1B (accounting integration, advanced reports) and Phase 2 (DLD APIs, developer integrations) are scoped separately.

---

## 1. NEW MODULE: Developer Agreements

### Purpose
Master record of broker-developer relationship — commission terms, payment terms, agreement period. Becomes the default reference for every deal involving that developer.

### Database tables (new)

```sql
CREATE TABLE developer_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id UUID REFERENCES pp_developers(id),
  brokerage_id UUID REFERENCES companies(id),
  
  -- Agreement period
  valid_from DATE NOT NULL,
  valid_to DATE,
  status VARCHAR(20) DEFAULT 'active',  -- active, expired, terminated
  
  -- Commission structure
  default_commission_pct DECIMAL(5,2) NOT NULL,
  vat_applicable BOOLEAN DEFAULT true,
  
  -- Payment terms
  payment_trigger VARCHAR(50), -- 'spa_signed', 'buyer_payment_pct', 'fixed_days_after_spa'
  payment_trigger_value VARCHAR(50), -- e.g., '14' (days), '30' (% buyer payment)
  
  -- Discount authority
  has_discount_authority BOOLEAN DEFAULT false,
  max_discount_pct DECIMAL(5,2),
  
  -- Agreement document
  agreement_document_url TEXT,
  signed_by VARCHAR(255),
  signed_date DATE,
  
  -- Bonuses / escalations
  bonus_tiers JSONB, -- e.g., [{"min_sales": 10, "bonus_pct": 0.5}]
  
  -- Project-specific overrides
  project_overrides JSONB, -- e.g., [{"project_id": "...", "commission_pct": 6.0}]
  
  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP,
  notes TEXT
);

CREATE TABLE agreement_amendments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id UUID REFERENCES developer_agreements(id),
  amendment_date DATE NOT NULL,
  amendment_type VARCHAR(50), -- 'commission_change', 'extension', 'termination', 'project_added'
  changes JSONB, -- snapshot of what changed
  document_url TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);
```

### UI components

**List view (`/developer-agreements`):**
- Table with columns: Developer, Period, Commission %, Status, Project Overrides count, Actions
- Filters: by developer, by status, expiring soon, by commission range
- Actions: View, Edit, Add Amendment, Renew

**Detail view (`/developer-agreements/:id`):**
- Header: Developer name + agreement period + status badge
- Section 1: Commission terms (default % + project overrides table)
- Section 2: Payment terms (trigger + days)
- Section 3: Discount authority
- Section 4: Bonus tiers (if any)
- Section 5: Document downloads
- Section 6: Amendment history (timeline)
- Activity log

**Create/Edit form:**
- Multi-step form: Developer & Period → Commission → Payment Terms → Discount → Bonuses → Document Upload → Review

### Effort: 1.5-2 weeks
- Database + RLS policies: 2 days
- API/service layer: 2 days
- List view UI: 2 days
- Detail view UI: 2-3 days
- Create/Edit form UI: 3-4 days
- Testing + QA: 2 days

### Dependencies
- Existing `pp_developers` table
- Existing `companies` table (brokerage)
- File storage for agreement documents (Supabase Storage)

---

## 2. MODIFY: Opportunity Detail (extend with sales cycle stages)

### Purpose
Existing `OpportunityDetail.jsx` shows the deal — need to extend it to show the complete sales cycle stages (booking → payments → SPA → commission).

### Database modifications

```sql
ALTER TABLE opportunities ADD COLUMN developer_agreement_id UUID REFERENCES developer_agreements(id);
ALTER TABLE opportunities ADD COLUMN commission_pct_override DECIMAL(5,2); -- if differs from agreement default
ALTER TABLE opportunities ADD COLUMN final_sale_price DECIMAL(15,2);
ALTER TABLE opportunities ADD COLUMN booking_date DATE;
ALTER TABLE opportunities ADD COLUMN booking_fee_amount DECIMAL(15,2);
ALTER TABLE opportunities ADD COLUMN spa_signed_date DATE;
ALTER TABLE opportunities ADD COLUMN spa_reference_number VARCHAR(100); -- DLD/Oqood reference
ALTER TABLE opportunities ADD COLUMN sale_completed BOOLEAN DEFAULT false;
ALTER TABLE opportunities ADD COLUMN sales_cycle_stage VARCHAR(30) DEFAULT 'lead';
-- Possible values: lead, qualifying, site_visit, offer_made, booking, payments_pending, spa_signed, commission_pending, completed, lost
```

### UI extensions

**Add sales cycle progress bar at top of opportunity detail:**
```
[Lead] → [Qualifying] → [Site Visit] → [Offer] → [Booking] → [Payments] → [SPA Signed] → [Commission] → [Completed]
   ✓         ✓             ✓           ✓         ✓ (current)    -            -              -            -
```

Each stage has:
- ✓ if completed (with date)
- ⏱ if current (highlighted)
- — if not yet reached
- ❌ if skipped (e.g., lost deal)

**Add new tabs to opportunity detail:**
1. Overview (existing — buyer info, property, offer)
2. Site Visits (existing)
3. Activities (existing)
4. **Booking** (new) — Stage 2 data
5. **Payments** (new) — Stage 3 milestones (links to Payment Milestones module)
6. **SPA / Sale** (new) — Stage 4 documents
7. **Commission** (new) — Stage 5 invoice tracking
8. **Documents** (new — unified) — all uploaded files

**On project selection during opportunity creation:**
- Auto-fetch master agreement for that project's developer
- Show default commission % (editable)
- Pre-populate payment terms

### Effort: 1 week
- Database changes + migration: 0.5 days
- Stage progress bar component: 1 day
- New tabs UI scaffolding: 1.5 days
- Integration with new modules: 1 day
- Testing: 1 day

### Dependencies
- Developer Agreements module (built first)

---

## 3. NEW MODULE: Payment Milestones

### Purpose
Track buyer's payment progress to the developer. **This is the killer feature** — replaces broker logging into 5+ developer portals.

### Database tables (new)

```sql
CREATE TABLE payment_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID REFERENCES opportunities(id) ON DELETE CASCADE,
  
  -- Milestone details
  milestone_name VARCHAR(255) NOT NULL, -- e.g., "Booking Fee", "10% Down Payment", "Construction Start"
  sequence_number INTEGER NOT NULL, -- order
  due_date DATE NOT NULL,
  due_amount DECIMAL(15,2) NOT NULL,
  due_amount_pct DECIMAL(5,2), -- % of total sale price
  
  -- Payment status
  paid_amount DECIMAL(15,2) DEFAULT 0,
  paid_date DATE,
  payment_status VARCHAR(20) DEFAULT 'pending', -- pending, partial, paid, overdue, waived
  
  -- Receipt
  receipt_document_url TEXT,
  receipt_uploaded_at TIMESTAMP,
  receipt_uploaded_by UUID REFERENCES auth.users(id),
  
  -- Notes
  notes TEXT,
  
  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP
);

CREATE TABLE payment_plan_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id), -- specific to project
  developer_id UUID REFERENCES pp_developers(id), -- or generic to developer
  template_name VARCHAR(255),
  milestones JSONB NOT NULL, -- [{name, pct, days_from_booking}, ...]
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### UI components

**Within Opportunity Detail → Payments tab:**

```
┌─────────────────────────────────────────────────────────────────┐
│ Payment Schedule for [Buyer Name] — [Project] [Unit]            │
│ Total Sale Price: AED 1,750,000   Total Paid: AED 175,000 (10%) │
├─────────────────────────────────────────────────────────────────┤
│ # │ Milestone        │ Due       │ Amount    │ Status   │ Action│
├───┼──────────────────┼───────────┼───────────┼──────────┼───────┤
│ 1 │ Booking Fee      │ 5 May'26  │ 175,000   │ ✅ Paid  │ View  │
│ 2 │ 10% Payment      │ 5 Jun'26  │ 175,000   │ ⏳ Due  │ Mark  │
│ 3 │ Construction     │ 5 Sep'26  │ 350,000   │ — Future │ —     │
│ 4 │ 50% Milestone    │ 5 Mar'27  │ 525,000   │ — Future │ —     │
│ 5 │ Handover         │ 5 Sep'27  │ 525,000   │ — Future │ —     │
└─────────────────────────────────────────────────────────────────┘
```

**Mark Paid action:**
- Modal: "Mark milestone X as paid"
- Fields: Date paid, Amount paid (defaults to due), Receipt upload, Notes
- Save → status updates → buyer payment % recalculates → triggers commission eligibility check

**Auto-create payment plan on opportunity move to Booking stage:**
- When opportunity stage moves to "Booking", system shows: "Apply payment plan template?"
- Options: Use developer's standard plan / Use project-specific plan / Custom plan
- Template auto-creates milestone records

**Notifications:**
- Reminder to broker 7 days before milestone due (configurable)
- Alert when milestone goes overdue
- Optional reminder to buyer (broker-controlled)

**Dashboard widget on broker home:**
- "Upcoming Milestones (Next 30 Days)" — sorted by due date
- "Overdue Milestones" — sorted by days overdue (red)
- Click → goes to opportunity

### Effort: 2-3 weeks
- Database + templates seed: 2 days
- Payment plan auto-creation logic: 2 days
- Milestone list UI in opportunity tab: 2 days
- Mark Paid modal + receipt upload: 2 days
- Notifications + reminders: 2-3 days
- Dashboard widgets: 2 days
- Testing: 2 days

### Dependencies
- Opportunity Detail extended (built in parallel)
- Document storage (Supabase)
- Notification system (existing or new)

---

## 4. NEW MODULE: SPA / Sale Deed Tracking

### Purpose
Capture the moment the deal officially "closes" — SPA signed and registered with DLD. Triggers commission eligibility.

### Database modifications
Already covered in Opportunity table additions:
- `spa_signed_date`, `spa_reference_number`, `sale_completed` flag

Plus document storage for SPA copy.

### UI components

**Within Opportunity Detail → SPA / Sale tab:**

```
┌────────────────────────────────────────────────────────────────┐
│ Sale Confirmation                                              │
│ Status: [Pending SPA Signing] [SPA Signed] [Sale Confirmed]    │
├────────────────────────────────────────────────────────────────┤
│ ┌── Mark SPA Signed ─────────────────────────────────────┐    │
│ │ SPA Signed Date: [Date Picker]                         │    │
│ │ DLD/Oqood Reference Number: [_______________]          │    │
│ │ Final Sale Price: AED [_____________]                  │    │
│ │ Final Unit Number: [_______________]                   │    │
│ │ SPA Document: [Upload PDF]                             │    │
│ │ Notes: [_____________________________________]         │    │
│ │ [Save & Mark Sale Confirmed]                            │    │
│ └────────────────────────────────────────────────────────┘    │
│                                                                │
│ Once confirmed → triggers Commission Invoice generation        │
└────────────────────────────────────────────────────────────────┘
```

**Action: "Save & Mark Sale Confirmed"**
- Validates: SPA date filled, reference number filled, document uploaded
- Updates opportunity: `sale_completed = true`, stage = "commission_pending"
- Triggers: auto-create commission invoice draft (next module)
- Notification: broker + manager notified

### Effort: 1 week
- Database additions: 0.5 days (already in opportunity changes)
- UI for SPA tab: 2 days
- Validation + state transitions: 1 day
- Trigger commission invoice creation: 1 day
- Testing: 1 day

### Dependencies
- Opportunity Detail extended
- Commission Invoicing module (next)

---

## 5. NEW MODULE: Commission Invoicing

### Purpose
Once SPA signed → broker raises commission invoice TO developer → tracks until paid. **Closes the financial loop.**

### Database tables (new)

```sql
CREATE TABLE commission_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID REFERENCES opportunities(id) UNIQUE, -- one invoice per deal
  developer_id UUID REFERENCES pp_developers(id),
  agreement_id UUID REFERENCES developer_agreements(id),
  
  -- Invoice details
  invoice_number VARCHAR(100), -- assigned by accounting tool after sync, or manual
  invoice_date DATE,
  due_date DATE, -- calculated from payment terms
  
  -- Amounts
  base_amount DECIMAL(15,2) NOT NULL, -- typically sale price
  commission_pct DECIMAL(5,2) NOT NULL, -- effective % used
  gross_amount DECIMAL(15,2) NOT NULL, -- base × pct
  vat_amount DECIMAL(15,2) DEFAULT 0,
  net_amount DECIMAL(15,2) NOT NULL,
  
  -- Payment
  paid_date DATE,
  paid_amount DECIMAL(15,2) DEFAULT 0,
  variance DECIMAL(15,2) DEFAULT 0, -- gross - paid
  
  -- Status
  status VARCHAR(20) DEFAULT 'draft',
  -- draft, ready_to_send, issued, partial_paid, paid, disputed, written_off
  
  -- Accounting integration (for Phase 1B)
  accounting_tool_reference VARCHAR(100), -- Tally/Zoho ID after sync
  accounting_tool_synced_at TIMESTAMP,
  
  -- Documents
  invoice_document_url TEXT, -- generated PDF
  
  -- Notes & audit
  notes TEXT,
  dispute_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP
);

CREATE TABLE commission_invoice_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES commission_invoices(id) ON DELETE CASCADE,
  payment_date DATE NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  reference VARCHAR(100), -- bank ref, cheque #
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### UI components

**List view (`/commissions`):**
- Tabs: All / Draft / Issued / Pending / Paid / Disputed
- Table: Invoice #, Developer, Property, Sale Price, Commission, Status, Aging (days), Actions
- Filters: by developer, by status, by date range, by aging bucket
- Bulk action: Send invoices to accounting tool (Phase 1B)

**Detail view (`/commissions/:id`):**

```
┌──────────────────────────────────────────────────────────────────┐
│ Commission Invoice — INV-2026-001                                │
│ Status: [DRAFT]  Created: 7 May 2026                             │
├──────────────────────────────────────────────────────────────────┤
│ Developer: Emaar Properties                                      │
│ Project: Beach Vista Tower 2                                     │
│ Buyer: John Smith                                                │
│ Sale Price: AED 1,750,000                                        │
│ Commission %: 4.0% (from master agreement)                       │
│ Gross Commission: AED 70,000                                     │
│ VAT: AED 3,500                                                   │
│ Net Commission: AED 73,500                                       │
│                                                                  │
│ Payment Terms: 14 days after SPA signing                         │
│ Due Date: 21 May 2026                                            │
│                                                                  │
│ [Edit Amounts] [Generate PDF] [Mark as Issued] [Sync to Tally]  │
└──────────────────────────────────────────────────────────────────┘

Payment History:
─ No payments received yet ─
[Record Payment]
```

**Auto-generation logic:**
1. SPA signed → opportunity stage moves to "commission_pending"
2. System creates draft commission invoice with:
   - Base amount = `final_sale_price`
   - Commission % = `commission_pct_override` OR `agreement.default_commission_pct` for that project
   - VAT calculated per agreement
   - Due date = SPA date + payment_trigger_value (from agreement)
3. Notification to broker: "Commission invoice draft ready for review — INV-XXX"
4. Broker reviews → edits if needed → marks "Ready to Send"
5. (Phase 1B) syncs to accounting tool → invoice number assigned → broker sends PDF to developer
6. Phase 1A simpler version: broker generates PDF from PropPlatform, sends manually

**Edit modal:**
- Allows adjusting: commission %, base amount, VAT, due date, notes
- Reason for adjustment captured (audit trail)

**Record Payment modal:**
- Date, amount, reference, notes
- If full amount paid → status = "paid"
- If partial → status = "partial_paid", variance auto-updates
- Multiple payments supported

### PDF invoice generation
- Use template engine (e.g., react-pdf or server-side puppeteer)
- Template: brokerage logo, address, TRN (VAT number), invoice details, developer details
- Output: AED amount in words, VAT breakdown, payment terms
- Comply with UAE VAT FTA requirements (TRN, "Tax Invoice" header, all required fields)

### Effort: 2-3 weeks
- Database tables + RLS: 1 day
- Auto-generation logic on SPA signing: 1 day
- List view UI: 2 days
- Detail view UI: 2-3 days
- Edit/Record Payment modals: 2 days
- PDF generation (basic version): 2-3 days
- VAT compliance check: 1 day
- Testing: 2 days

### Dependencies
- SPA tracking (built before)
- Developer Agreements (built first)
- PDF generation library

---

## 6. MODIFY: Discount Approvals — Wire into Stage 2

### Purpose
The Discount Approvals module already exists. It needs to connect to Stage 2 (Booking with Developer) so that when a broker offers a discount, it goes through the approval workflow tied to the master agreement's discount authority.

### Modifications

**Discount Approval flow:**
1. Broker on Opportunity → enters "Booking" stage
2. UI: "Offering discount?" toggle
3. If yes:
   - Discount amount entered (% or absolute)
   - System checks master agreement's `has_discount_authority` and `max_discount_pct`
   - If within authority → auto-approved, no workflow
   - If beyond → goes to manager approval (existing Discount Approvals module)
4. Once approved → discount visible on opportunity, applied to final sale price calculation

**Database:**
- Existing `discount_approvals` table (or whatever it's called) needs link to `opportunity_id`
- Add `agreement_id` reference to track if it was within authority

**UI:**
- Discount field in Booking tab of Opportunity Detail
- Inline approval status indicator (auto-approved / pending manager / approved by [name] on [date])
- Existing Discount Approvals list view continues to work — now with deeper context

### Effort: 0.5 weeks (mostly wiring)

### Dependencies
- Existing Discount Approvals module
- Developer Agreements (for authority check)
- Opportunity Detail extended (for discount field)

---

## 7. NEW: Reports & Dashboards

### Purpose
Show the broker the financial health of their pipeline. **This is what brokers see when they log in every morning.**

### Reports to build

#### Report 1: Outstanding Commission by Developer
```
┌────────────────────────────────────────────────────────────┐
│ Outstanding Commission — As of 7 May 2026                  │
├────────────────────────────────────────────────────────────┤
│ Developer       │ Pending  │ Overdue  │ Total            │
│ Emaar           │ 215,000  │ 80,000   │ 295,000          │
│ Damac           │ 175,000  │ 0        │ 175,000          │
│ Sobha           │ 90,000   │ 45,000   │ 135,000          │
│ ────────────────┼──────────┼──────────┼──────────────────│
│ TOTAL           │ 480,000  │ 125,000  │ 605,000          │
└────────────────────────────────────────────────────────────┘
```

#### Report 2: Commission Aging
- 0-30 days, 31-60 days, 61-90 days, 90+ days
- Bar chart visualization
- Drill-down to specific invoices

#### Report 3: Payment Milestone Status (Pipeline Health)
- Shows all active deals + their current milestone status
- Highlights overdue buyer payments (broker action needed)

#### Report 4: Developer Payment Behavior (intelligence)
- Avg days to pay per developer
- Best/worst payers
- Becomes valuable data over time

### Dashboard updates

Existing Dashboard module gets new tiles:
- "Commission Outstanding" (sum)
- "Overdue Payments" (count + total)
- "Deals This Month" (closed)
- "Pending SPAs" (deals waiting for SPA)
- "Commission Earned This Month" (paid invoices)

### Effort: 1-1.5 weeks
- Reports module + queries: 3-4 days
- Dashboard widgets: 2-3 days
- Charts & visualizations: 1-2 days
- Testing: 1 day

### Dependencies
- Commission Invoicing module
- Payment Milestones module

---

## SEQUENCING & TIMELINE

### Recommended sequence (8-12 weeks total)

```
Week 1-2:    Developer Agreements module (#1)
Week 2-3:    Opportunity Detail extension (#2) [parallel with #1 last week]
Week 3-5:    Payment Milestones module (#3)
Week 5-6:    SPA Tracking (#4)
Week 6-8:    Commission Invoicing (#5)
Week 8:      Discount Approvals integration (#6)
Week 8-9:    Reports & Dashboards (#7)
Week 9-10:   Integration testing, bug fixing, polish
Week 10-12:  User acceptance testing with anchor customer + iterations
```

**Critical path:**
- Developer Agreements MUST be first (everything references it)
- Opportunity Detail extension can run parallel with later modules
- Reports build at the end (depends on data from all modules)

### What to ship in incremental releases

**Release 1 (after week 4):** Developer Agreements + Payment Milestones
- Brokers can manage developer relationships + track buyer payments
- Even without commission invoicing yet, this is useful

**Release 2 (after week 8):** Add SPA + Commission Invoicing
- Now the complete cycle works
- This is the Phase 1A complete milestone

**Release 3 (after week 10):** Reports + Polish
- Strategic reports unlock the "wow" features

---

## TESTING STRATEGY

### Unit tests
- Commission calculation logic (gross, VAT, net, with edge cases)
- Payment plan auto-generation
- Status transitions (draft → issued → paid)

### Integration tests
- SPA signing → triggers commission invoice draft
- Milestone marked paid → buyer payment % updates → commission eligibility check
- Discount approval → reflects in final commission calculation

### User acceptance testing (UAT)
- Run with anchor customer (Al Mansoori Properties)
- Real deals as test cases
- Feedback loop weekly during weeks 9-12

---

## RISKS & MITIGATIONS

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Brokers resist new workflow | Medium | High | UAT with anchor customer, iterative refinement |
| VAT compliance issues with invoices | Medium | High | Consult with UAE accountant early, FTA-compliant template |
| Payment plan templates vary too much per developer | High | Medium | Make templates flexible, allow custom plans per deal |
| Commission disputes harder than expected | Low | Medium | Robust audit trail, dispute workflow built-in |
| Performance issues with many invoices | Low | Medium | Indexes + pagination from Day 1 |

---

## WHAT THIS BUILD UNLOCKS

After Phase 1A is complete, PropPlatform will:

✅ Be a **complete UAE off-plan sales CRM** (Stages 0-5)
✅ Replace 5+ developer portals with 1 unified workspace
✅ Generate **VAT-compliant commission invoices** automatically
✅ Show brokers their **outstanding commission position** in real-time
✅ Capture **proprietary deal data** that no other product has
✅ Become the foundation for Phase 1B (accounting integration) and Phase 2 (DLD APIs, developer integrations)

This is the moment PropPlatform transforms from "data layer" to "complete CRM."

---

## NEXT STEPS

1. ✅ Save this build plan to `D:\prop-crm\docs\Phase_1_Build_Plan.md`
2. ⏳ Review with partner for resourcing decision
3. ⏳ Begin Week 1 with Developer Agreements module
4. ⏳ Update investor pitch deck (separate doc) to showcase complete sales cycle
5. ⏳ Update FOUNDER_CONTEXT.md to reflect locked decisions

---

*Build plan derived from process flow approved by Abid Mirza on 07 May 2026.*

— BFC · 07 May 2026
