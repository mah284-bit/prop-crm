# Stage 1 Build Spec — Master Developer Agreement Module

**Version:** 1.0
**Date:** 09 May 2026
**Owner:** Abid Mirza (Founder, BFC) + Claude (technical decisions)
**Status:** APPROVED FOR BUILD — locked design
**Target ship date:** 18 May 2026 (Day 10 of 14-day investor window)
**Buffer:** Days 11-12 for Stage 2 spec, Days 13-14 for demo orchestration

---

## 1. WHAT WE'RE BUILDING

A **Master Developer Agreement** module — the foundation layer of PropPlatform's broker sales workflow. Captures the commercial relationship between a broker firm and a property developer (Emaar, DAMAC, Sobha, Aldar, etc.) at the firm level — independent of any specific deal.

**Core concept:**
> When a broker firm signs an agreement with Emaar saying "we get 4% commission on all sales, paid 14 days post-SPA, with bonus 0.5% over 10 sales/quarter," that agreement becomes the **default reference** for every Emaar deal that broker handles. Specific projects can override this default (e.g., "Creek Beach has a special 6% rate for first 50 sales") but the master defines the baseline.

---

## 2. WHY IT MATTERS (FOR INVESTORS)

This is **Stage 1** of the locked 6-stage broker sales lifecycle. Every subsequent stage references the master agreement:

- **Stage 2 (Lead → Opportunity)** — pulls default commission % to populate new deals
- **Stage 3 (Booking)** — references payment terms for milestone schedule
- **Stage 4 (Payment Tracking)** — uses payment terms to alert when commission becomes claimable
- **Stage 5 (SPA)** — checks discount authority limits set in master
- **Stage 6 (Commission Invoice)** — uses agreement document as audit reference for invoice

**No master agreement = no foundation for the rest.** That's why investors specifically asked for Stage 1 first.

---

## 3. DATABASE DESIGN

### 3.1 New table — `pp_master_agreements`

```sql
CREATE TABLE IF NOT EXISTS pp_master_agreements (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Multi-tenant scope
  company_id            UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- The relationship
  developer_id          UUID NOT NULL REFERENCES pp_developers(id) ON DELETE RESTRICT,
  developer_name        TEXT NOT NULL,  -- denormalized for display performance

  -- Agreement identity
  agreement_title       TEXT NOT NULL,           -- e.g. "Emaar 2026 Annual Agreement"
  agreement_reference   TEXT,                    -- broker's internal ref number (optional)

  -- Commercial terms (defaults — projects can override via pp_commissions)
  default_commission_pct NUMERIC(5,2) NOT NULL,  -- e.g. 4.00 for 4%
  bonus_commission_pct   NUMERIC(5,2),           -- volume bonus, optional
  bonus_threshold        TEXT,                   -- e.g. "10+ sales/quarter"

  -- Payment terms
  payment_terms          TEXT,                   -- e.g. "14 days post-SPA"
  payment_trigger        TEXT,                   -- 'spa_executed' | 'first_payment' | 'full_payment'
  payment_days           INTEGER,                -- # days from trigger

  -- Discount authority
  discount_authority_pct NUMERIC(5,2),           -- max discount this broker can offer without dev approval
  discount_requires_approval_above NUMERIC(5,2), -- threshold above which dev approval needed

  -- Document trail
  agreement_document_url TEXT,                   -- Supabase Storage path to PDF
  agreement_document_filename TEXT,              -- original filename for display

  -- Validity period
  valid_from             DATE,
  valid_until            DATE,

  -- Audit trail
  signed_by              TEXT,                   -- name of signatory
  signed_date            DATE,
  signed_on_behalf_of    TEXT,                   -- which BFC entity if multiple

  -- Lifecycle
  status                 TEXT NOT NULL DEFAULT 'active', -- 'draft' | 'active' | 'expired' | 'terminated'
  notes                  TEXT,

  -- Timestamps
  created_at             TIMESTAMPTZ DEFAULT now(),
  created_by             UUID REFERENCES profiles(id),
  updated_at             TIMESTAMPTZ DEFAULT now(),
  updated_by             UUID REFERENCES profiles(id),

  -- Constraints
  CONSTRAINT chk_agreement_dates CHECK (valid_until IS NULL OR valid_until >= valid_from),
  CONSTRAINT chk_default_pct_range CHECK (default_commission_pct >= 0 AND default_commission_pct <= 100)
);

-- Indexes
CREATE INDEX idx_master_agreements_company ON pp_master_agreements(company_id);
CREATE INDEX idx_master_agreements_developer ON pp_master_agreements(developer_id);
CREATE INDEX idx_master_agreements_active ON pp_master_agreements(company_id, status) WHERE status = 'active';

-- RLS
ALTER TABLE pp_master_agreements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants see own agreements"
  ON pp_master_agreements
  FOR SELECT
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Tenants edit own agreements"
  ON pp_master_agreements
  FOR ALL
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
```

### 3.2 Modification to `pp_commissions` (existing table)

Add foreign key to link project-level overrides to the master agreement:

```sql
ALTER TABLE pp_commissions
ADD COLUMN IF NOT EXISTS master_agreement_id UUID REFERENCES pp_master_agreements(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_commissions_master_agreement ON pp_commissions(master_agreement_id);
```

**Migration plan:** Since `pp_commissions` is currently empty (0 rows), no data migration needed. Future inserts can populate `master_agreement_id`.

### 3.3 Supabase Storage bucket for agreement documents

```sql
-- Create bucket via Supabase dashboard (manual step):
-- Bucket name: master-agreements
-- Public: false (signed URLs only)
-- File size limit: 10 MB
-- Allowed MIME types: application/pdf
```

**Storage RLS policies:** Only allow access to files matching `{company_id}/...` path pattern.

---

## 4. UI / UX DESIGN

### 4.1 Where it lives in the app

**New top-level menu item under Sales:** "Master Agreements" (admin-only access).

```
Sales
├── Dashboard
├── Leads
├── Opportunities
├── Inventory
├── PropPulse
├── Reports
├── Permissions
└── Master Agreements   ← NEW
```

**Permission gate:** Only `admin` and `super_admin` roles see this menu item. Regular brokers don't need to manage agreements.

### 4.2 Three views

#### View 1: List view (default)

**Layout:**
- Top bar: "Master Developer Agreements" + button "+ New Agreement"
- Filter row: Developer dropdown, Status (Active/Expired/Draft), Search box
- Table columns:
  - Developer (with logo if available)
  - Agreement Title
  - Default Commission %
  - Validity period
  - Status badge (Active/Expired/Draft)
  - Last updated
  - Actions (View / Edit / Archive)

**Empty state:** "No master agreements yet. Add one to start tracking your developer relationships."

#### View 2: New / Edit form

**Sections (collapsible accordion or tabbed):**

**Section 1: The Relationship**
- Developer (dropdown — pulls from `pp_developers`)
- Agreement title (free text — e.g. "Emaar 2026 Annual")
- Agreement reference (optional — broker's internal ref)

**Section 2: Commercial Terms**
- Default commission % (numeric input, 0-100, decimal allowed)
- Bonus commission % (optional numeric input)
- Bonus threshold (free text — e.g. "10+ sales per quarter")

**Section 3: Payment Terms**
- Payment trigger (dropdown: SPA executed / First payment received / Full payment received / Custom)
- Payment days (numeric — e.g. 14)
- Auto-generated: "Commission paid {days} days after {trigger}"

**Section 4: Discount Authority**
- Discount authority % (max we can offer without approval)
- Threshold for developer approval (% above which dev sign-off needed)

**Section 5: Document & Audit**
- Upload signed agreement PDF (drag-drop or browse)
- Signed by (name)
- Signed date (date picker)
- Validity from / Validity until (date pickers)

**Section 6: Notes**
- Free-text textarea

**Save button:** Validates required fields (developer, default %, agreement title), saves, returns to list.

#### View 3: Detail / Read-only view

When clicking a row in list view:
- All fields shown as labeled values (read-only)
- "Edit" button at top
- "View Document" button (opens PDF in new tab via signed URL)
- Bottom section: "Used in" — shows count of projects with `master_agreement_id` linked, with quick-link to those projects (preparation for Stage 2 integration)

### 4.3 Validation rules

- Developer: required
- Agreement title: required, max 100 chars
- Default commission %: required, 0-100, max 2 decimals
- Validity from/until: if both provided, until >= from
- PDF upload: optional in v1 (can save without doc, can be added later)
- Bonus %: optional, but if provided must be 0-100

---

## 5. INTEGRATION WITH OTHER STAGES

### 5.1 Stage 2 (Lead → Opportunity) integration

**On creating a new Opportunity:**
- User selects a Project
- Project has a `pp_developer_id`
- System looks up active master agreement: `WHERE company_id = X AND developer_id = Y AND status = 'active'`
- Auto-fills opportunity's commission_pct field with master's `default_commission_pct`
- Shows visual cue: "Commission populated from master agreement [link]"
- User can override the default if needed (per-deal override)

**Implementation:** Modify the Opportunity creation form's `useEffect` on project change to query the master agreement.

### 5.2 Stage 3-6 integrations

These are SCOPED but NOT BUILT in Stage 1:
- Stage 3 (Booking): will reference `payment_terms` for milestone schedule
- Stage 4 (Payment Tracking): will use `payment_trigger` + `payment_days` for alerting
- Stage 5 (SPA): will validate discount against `discount_authority_pct`
- Stage 6 (Commission Invoice): will reference `agreement_document_url` for audit

**Stage 1 must EXPOSE the data structures these need.** Schema design above accommodates all.

---

## 6. IMPLEMENTATION PLAN — DAY BY DAY

### Day 2 (today, ~3 hours): Database + skeleton component
- Create migration SQL file in `supabase/migrations/` folder
- Run migration in Supabase dashboard
- Verify table created via SQL
- Create new component file `src/components/MasterAgreements.jsx`
- Add menu item in App.jsx (admin-only)
- Wire up routing — empty page renders for now

### Day 3 (~4 hours): List view
- Build the list view UI (table with developer, title, %, dates, status)
- Add filter and search
- Connect to Supabase query
- Empty state design
- Test with manually-inserted test row

### Day 4 (~4 hours): Create / Edit form
- Build form sections 1-4 (relationship, commercial, payment, discount)
- Validation logic
- Save → insert/update logic
- Error handling and toast notifications

### Day 5 (~4 hours): Document upload
- Set up Supabase Storage bucket `master-agreements`
- Storage RLS policies
- Upload component (drag-drop)
- Save uploaded path to record
- Display existing document with view/replace buttons in edit mode

### Day 6 (~3 hours): Detail view + audit
- Read-only detail view
- Signed by / date / validity display
- Document view button
- "Used in [N] projects" placeholder (we'll wire actual count when Stage 2 integration ships)

### Day 7 (~4 hours): Stage 2 integration
- Modify Opportunity form to detect project's developer
- Query active master agreement
- Auto-populate commission %
- Add override capability
- Visual indicator showing source

### Day 8 (~3 hours): Polish + edge cases
- Multiple agreements with same developer (different periods, branches)
- Expired agreement handling (show as inactive, prevent new opps from using)
- Bulk import option (CSV of agreements? — defer if time tight)
- UI polish — loading states, animations, copy review

### Day 9 (~3 hours): Testing
- Create master agreement → end to end
- Edit existing agreement
- Upload PDF, verify retrievable
- Create opportunity → verify auto-population
- Test multi-tenant isolation (Al Mansoori sees own only)
- Test permission gates (regular broker doesn't see menu)

### Day 10 (~3 hours): Production deploy + Al Mansoori test
- Final code review
- Push to main → Vercel deploys
- Test on production URL
- Walk through with Al Mansoori for real validation
- Document any issues for Day 11+ buffer

---

## 7. WHAT'S DELIBERATELY NOT IN STAGE 1

These are **deferred to later stages** to keep Stage 1 shippable in 10 days:

- ❌ Bulk CSV import of agreements (manual entry only in v1)
- ❌ Agreement amendment versioning (just edit-in-place — version 2 of agreement = new record)
- ❌ Email notifications when agreement nearing expiry (defer to v1.x)
- ❌ Multi-currency support (AED only)
- ❌ Agreement templates / clone-from-existing
- ❌ Approval workflow (admin creates, no review needed)
- ❌ E-signature integration (manual PDF upload only)

These are NOT scope creep — they're explicitly tagged for v1.x or v2.

---

## 8. ACCEPTANCE CRITERIA — WHAT "DONE" LOOKS LIKE

Stage 1 ships when ALL of these are true:

1. ✅ Admin user can navigate to Master Agreements menu
2. ✅ Admin can create a new agreement with all fields
3. ✅ Admin can upload a signed PDF and retrieve it later
4. ✅ Admin can edit an existing agreement
5. ✅ List view shows all agreements with filters working
6. ✅ Detail view shows all data + linked document
7. ✅ Multi-tenant isolation verified (Al Mansoori sees only Al Mansoori's)
8. ✅ Regular broker user cannot access menu (permission gate)
9. ✅ Creating an Opportunity for a project auto-populates commission % from master
10. ✅ Tested end-to-end on production URL with Al Mansoori validation

---

## 9. INVESTOR DEMO SCRIPT (PRE-WRITTEN)

When the investor meets, here's the 5-minute demo flow:

**Minute 1: The big picture**
- Show Process Flows deck slide 2 (the 6-stage flow)
- "Six stages from agreement to commission. Stage 1 ships today."

**Minute 2: Stage 1 walkthrough**
- Open Master Agreements menu in PropPlatform
- "This is where every broker firm captures their commercial relationship with developers."
- Click into existing Emaar agreement
- Show all data: rates, payment terms, signed document

**Minute 3: The integration moment**
- Open a new Opportunity
- Select a project under Emaar
- Watch commission % auto-populate from master agreement
- "This single integration is what makes the platform a system, not a CRM."

**Minute 4: The pipeline**
- Show Process Flows deck slide 4 (Stages 2-6)
- "Stage 1 done as tagged for Stage 2. No architectural rework. Each stage independently shippable."

**Minute 5: Where we're going**
- Show Process Flows deck slide 5 (Today vs 14 days)
- Recap: 50 projects in catalogue, AI agent operational, anchor customer signed, foundation stage shipped
- Ask: "What questions can I answer?"

---

## 10. RISKS & MITIGATIONS

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Supabase Storage RLS misconfigured = data leak | LOW | HIGH | Test with 2 test companies before going live; review policies before any real data |
| PDF upload fails on large files | MEDIUM | MEDIUM | 10MB limit set; client-side validation before upload |
| Multi-tenant query returns wrong rows | LOW | HIGH | Test from Al Mansoori login + Default Company login; verify RLS policies fire |
| Stage 2 integration breaks existing Opportunity flow | MEDIUM | HIGH | Code change only adds optional auto-fill; existing flow still works if no master agreement found |
| App.jsx 14,000+ lines makes adding menu hard | HIGH | MEDIUM | Pattern from existing menus (Permissions, Reports); copy-paste with minimal modification |
| 10-day estimate slips | MEDIUM | LOW | Buffer days 11-12 absorb overruns. Stage 2 spec doc can be drafted in parallel. |

---

## 11. DEPENDENCIES

Before Day 2 work starts:
- ✅ Process Flows deck shipped (Day 1 — DONE)
- ✅ This spec doc reviewed and approved by Abid
- ⚠️ Supabase Storage bucket created (manual setup before Day 5)
- ⚠️ Test data: at least 2 developers in `pp_developers` table to test multi-tenant (we have 20 — fine)

---

## 12. POST-STAGE 1 — IMMEDIATE NEXT STEPS

**Day 11-12: Stage 2 spec document**
- Write `Stage_2_Lead_Opportunity_Build_Spec.md` (similar structure to this doc)
- Show "Stage 1 tagged for Stage 2" investor narrative is real

**Day 13: Investor demo prep**
- Practice run on production
- Document common questions investor might ask
- Prepare 1-page leave-behind

**Day 14: Schedule the meeting**
- Reach out to investors
- Confirm Stage 1 is shipped + working + tested with anchor customer

---

## SIGN-OFF

**Approved by:** Abid Mirza, Founder, BFC
**Date:** 09 May 2026
**Build start:** Day 2 of 14-day window

This document is the source of truth for Stage 1 build. Any deviation requires updating this doc first.
