# Math Flow Schema Design
**Single Source of Truth + Proposal Versioning Architecture**

**Created:** 13 May 2026 (Wednesday evening)
**Status:** APPROVED for execution in 2 phases
**Phase 1 (Day 2):** `current_*` columns on opportunities (math flow foundation)
**Phase 2 (Day 5+):** `pp_proposal_versions` table (audit trail + versioning)

---

## 1. Design Context

### Founder principles applied (from Sprint Plan)
- **Logic and math married:** Single source of truth for all prices
- **AI dominant:** AI populates, broker confirms (not types)
- **Protect broker eyes:** Carry-forward, no re-entry
- **Solid + enhanceable:** Phase 1 ships math flow, Phase 2 adds versioning

### Founder decisions (13 May evening Q&A)

| Question | Founder Answer | Implication |
|---|---|---|
| Q1: Price source | `salePricing.asking_price` + PropPulse for changes | salePricing is master; PropPulse is update channel |
| Q2: Discount format | % OR AED amount, broker chooses | Brokers think in AED mid-negotiation |
| Q3: DLD storage | Actual AED cost agreed + split type | Real money tracked, not derived |
| Q4: Proposal updates | **Every send = new version, latest = current** | Audit trail; this is BIG |
| Q5: Existing opps | Start with list price, broker reconciles at SPA | No false accuracy on old data |

---

## 2. Phase 1: Single Source of Truth Schema (DAY 2 - TOMORROW)

### Schema additions to `opportunities` table

```sql
-- Migration: add_current_columns_to_opportunities.sql
-- Date: 14 May 2026 (Day 2 of sprint)

BEGIN;

-- ========================================================================
-- Single source of truth: current agreed values
-- These are READ by every stage gate and WRITTEN at stage transitions
-- ========================================================================

ALTER TABLE opportunities
  -- Price (the live "current" agreed price)
  ADD COLUMN IF NOT EXISTS current_agreed_price NUMERIC(15,2),
  
  -- Discount (% OR amount, never both)
  ADD COLUMN IF NOT EXISTS current_discount_type TEXT 
    CHECK (current_discount_type IN ('percent', 'amount') OR current_discount_type IS NULL),
  ADD COLUMN IF NOT EXISTS current_discount_value NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS current_discount_source TEXT,
    -- 'proposal', 'negotiation', 'override', 'developer_offer'
  
  -- DLD fees (actual AED amounts, not just %)
  ADD COLUMN IF NOT EXISTS current_dld_payer TEXT
    CHECK (current_dld_payer IN ('buyer', 'developer', 'split', 'negotiated') OR current_dld_payer IS NULL),
  ADD COLUMN IF NOT EXISTS current_dld_split_pct NUMERIC(5,2),  -- buyer's % if split
  ADD COLUMN IF NOT EXISTS current_dld_amount NUMERIC(15,2),    -- AED actual
  
  -- Other fees (UAE standard + developer-specific)
  ADD COLUMN IF NOT EXISTS current_admin_fee NUMERIC(15,2),     -- AED 580 standard
  ADD COLUMN IF NOT EXISTS current_trustee_fee NUMERIC(15,2),   -- AED 4,200 off-plan
  ADD COLUMN IF NOT EXISTS current_oqood_fee NUMERIC(15,2),     -- AED Oqood registration
  ADD COLUMN IF NOT EXISTS current_developer_fees NUMERIC(15,2), -- catch-all dev fees
  
  -- Metadata
  ADD COLUMN IF NOT EXISTS current_values_updated_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS current_values_updated_by UUID REFERENCES profiles(id);

-- Index for performance (stage gates query opp + current_* frequently)
CREATE INDEX IF NOT EXISTS idx_opportunities_current_updated 
  ON opportunities(current_values_updated_at);

COMMIT;
```

### Why these specific columns

**`current_agreed_price`** — The cascading truth
- Initial value: `salePricing.asking_price` of the unit (at opp creation)
- Updated by: Proposal discount, Negotiation outcome, SPA override
- READ by: Acceptance, Reserved, SPA, Closed Won

**`current_discount_type` + `current_discount_value`**
- Type = 'percent' → value is 0-100 (e.g., 3.5)
- Type = 'amount' → value is AED (e.g., 50000)
- Type = null → no discount
- App computes the OTHER side automatically for display

**`current_dld_*`** trio
- `current_dld_payer` = who pays (buyer/developer/split/negotiated)
- `current_dld_split_pct` = if split, buyer's portion (e.g., 50 = 50/50)
- `current_dld_amount` = actual AED buyer pays
- This is the **only place** DLD logic lives

**`current_admin_fee`, `current_trustee_fee`, `current_oqood_fee`**
- UAE standards with developer-specific overrides
- Default at opp creation from unit/developer config
- Editable in negotiation if developer absorbs

**`current_values_updated_at` / `updated_by`**
- Audit trail (who changed what when)
- Useful even before full versioning

### Backfill strategy

For existing opps (50+ in production):

```sql
-- BACKFILL EXISTING OPPORTUNITIES
-- Logic: Use cascade fallback, mark backfilled in source

UPDATE opportunities o
SET 
  current_agreed_price = COALESCE(
    o.final_price,        -- Closed Won opps
    o.offer_price,        -- Offer Accepted opps
    (SELECT asking_price FROM unit_sale_pricing WHERE unit_id = o.unit_id LIMIT 1),
    o.budget              -- Last resort
  ),
  current_discount_type = CASE 
    WHEN o.discount_pct IS NOT NULL AND o.discount_pct > 0 THEN 'percent'
    ELSE NULL
  END,
  current_discount_value = CASE 
    WHEN o.discount_pct IS NOT NULL AND o.discount_pct > 0 THEN o.discount_pct
    ELSE NULL
  END,
  current_discount_source = 'backfill_13_may_2026',
  current_dld_payer = o.dld_payer,
  current_dld_split_pct = o.dld_split_pct,
  current_values_updated_at = NOW(),
  current_values_updated_by = NULL  -- system backfill
WHERE current_agreed_price IS NULL;  -- only update unset opps

-- Verify backfill
SELECT 
  COUNT(*) AS total_opps,
  COUNT(current_agreed_price) AS with_current_price,
  COUNT(*) - COUNT(current_agreed_price) AS still_null
FROM opportunities;
-- Expected: still_null = 0
```

### Rollback (safety net)

```sql
-- ROLLBACK script (keep ready, only if migration fails)
BEGIN;

ALTER TABLE opportunities
  DROP COLUMN IF EXISTS current_agreed_price,
  DROP COLUMN IF EXISTS current_discount_type,
  DROP COLUMN IF EXISTS current_discount_value,
  DROP COLUMN IF EXISTS current_discount_source,
  DROP COLUMN IF EXISTS current_dld_payer,
  DROP COLUMN IF EXISTS current_dld_split_pct,
  DROP COLUMN IF EXISTS current_dld_amount,
  DROP COLUMN IF EXISTS current_admin_fee,
  DROP COLUMN IF EXISTS current_trustee_fee,
  DROP COLUMN IF EXISTS current_oqood_fee,
  DROP COLUMN IF EXISTS current_developer_fees,
  DROP COLUMN IF EXISTS current_values_updated_at,
  DROP COLUMN IF EXISTS current_values_updated_by;

DROP INDEX IF EXISTS idx_opportunities_current_updated;

COMMIT;
```

### Verification queries

```sql
-- 1. Confirm columns exist
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'opportunities' AND column_name LIKE 'current_%'
ORDER BY ordinal_position;
-- Expected: 13 rows

-- 2. Confirm constraints
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'opportunities'::regclass
  AND conname LIKE '%current_%';
-- Expected: 2 check constraints (discount_type, dld_payer)

-- 3. Confirm index
SELECT indexname FROM pg_indexes
WHERE tablename = 'opportunities' AND indexname LIKE '%current%';
-- Expected: idx_opportunities_current_updated

-- 4. Sample data check
SELECT id, stage, current_agreed_price, current_discount_type, current_discount_value
FROM opportunities
LIMIT 10;
-- Expected: All non-null, varied values
```

---

## 3. Phase 2: Proposal Versioning Schema (DAY 5+)

This is DESIGNED tonight but EXECUTED in Phase 2 (Day 5 or later).

### Why versioning matters

Founder's principle (Q4):
> *"every time we send as version and take the latest version as final and take it forward"*

Real broker workflow:
1. Broker sends proposal v1 (discount 2%)
2. Buyer counter-offers (wants 5%)
3. Broker discusses with developer
4. Broker sends proposal v2 (discount 4%, free DLD)
5. Buyer accepts v2

System must:
- Preserve v1 (audit trail)
- Mark v1 'superseded'
- v2 'sent', then 'accepted'
- "Current" = v2

### Schema for `pp_proposal_versions`

```sql
-- Migration: add_proposal_versioning.sql
-- Date: TBD (Day 5+ of sprint)

CREATE TABLE pp_proposal_versions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id        UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  version_number        INT NOT NULL,  -- 1, 2, 3, ...
  
  -- Status (lifecycle)
  status                TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'superseded', 'expired')),
  
  -- Audit
  created_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by            UUID REFERENCES profiles(id),
  sent_at               TIMESTAMP WITH TIME ZONE,
  responded_at          TIMESTAMP WITH TIME ZONE,
  expires_at            TIMESTAMP WITH TIME ZONE,
  
  -- Snapshot of all financial values at this version
  agreed_price          NUMERIC(15,2) NOT NULL,
  discount_type         TEXT,
  discount_value        NUMERIC(15,2),
  
  dld_payer             TEXT,
  dld_split_pct         NUMERIC(5,2),
  dld_amount            NUMERIC(15,2),
  
  admin_fee             NUMERIC(15,2),
  trustee_fee           NUMERIC(15,2),
  oqood_fee             NUMERIC(15,2),
  developer_fees        NUMERIC(15,2),
  
  -- Payment plan (structured)
  payment_plan          JSONB,  -- {milestones: [{percent, label, due_at}]}
  
  -- Terms
  proposal_terms        TEXT,        -- broker's notes
  buyer_response        TEXT,        -- buyer's response when received
  
  -- Generated artifacts
  pdf_url               TEXT,        -- generated proposal PDF storage URL
  
  -- Constraints
  UNIQUE(opportunity_id, version_number)
);

-- Index for performance
CREATE INDEX idx_proposal_versions_opp ON pp_proposal_versions(opportunity_id, version_number DESC);
CREATE INDEX idx_proposal_versions_status ON pp_proposal_versions(status);

-- Trigger: when new version created, mark previous as 'superseded'
CREATE OR REPLACE FUNCTION mark_previous_proposal_superseded()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'sent' THEN
    UPDATE pp_proposal_versions
    SET status = 'superseded'
    WHERE opportunity_id = NEW.opportunity_id
      AND version_number < NEW.version_number
      AND status IN ('sent', 'draft');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_mark_previous_proposal_superseded
  AFTER INSERT OR UPDATE OF status ON pp_proposal_versions
  FOR EACH ROW
  WHEN (NEW.status = 'sent')
  EXECUTE FUNCTION mark_previous_proposal_superseded();
```

### Relationship to `opportunities.current_*`

When a proposal version is **accepted**:
1. App reads accepted version's snapshot
2. App updates `opportunities.current_*` columns
3. App updates `opportunities.current_proposal_version` (link to accepted version)

```sql
-- Add link column to opportunities (in Phase 2 migration)
ALTER TABLE opportunities
  ADD COLUMN current_proposal_version_id UUID REFERENCES pp_proposal_versions(id),
  ADD COLUMN current_proposal_version_number INT;
```

### App flow with versioning

**Send proposal:**
```
1. App computes agreed_price, discount, fees from form
2. Inserts new row in pp_proposal_versions (version_number = max+1, status='draft')
3. Generates PDF, uploads, stores URL
4. App marks status='sent'
5. Trigger marks previous versions 'superseded'
6. App updates opportunities.current_* with this version's snapshot
```

**Negotiate (creates new version):**
```
1. Broker opens "Negotiate" - sees latest version's values as starting point
2. Makes changes (new discount, terms)
3. "Send updated proposal" creates version N+1
4. Same flow as above (snapshot, PDF, current_* update)
```

**Accept:**
```
1. App marks current sent version as 'accepted'
2. Updates opportunities.current_* (already done at send, just confirms)
3. Locks opp.stage to 'Offer Accepted'
```

---

## 4. App Code Changes Required

### Phase 1 (Day 2-4 - Math flow with current_*)

**File:** `src/App.jsx`

**Changes needed:**

1. **Opp creation** (line ~9847 + ~8127)
   - When unit selected, set `current_agreed_price` = `salePricing.asking_price`
   - Set initial fees: `current_admin_fee` = 580, `current_trustee_fee` = 4200 (if off-plan)

2. **Proposal stage** (current proposal generation code)
   - Discount entered → write `current_discount_type`, `current_discount_value`
   - Recompute `current_agreed_price`
   - Update `current_values_updated_at` + `_by`

3. **Negotiation stage**
   - READ `current_*` values as starting point
   - Allow edit, write back to `current_*`

4. **Offer Accepted stage**
   - READ `current_agreed_price` (display read-only)
   - On confirm: write `opp.offer_price` = `current_agreed_price` (snapshot)

5. **Reserved stage**
   - Display `current_agreed_price` (for context)
   - No changes to current_*

6. **SPA Signed stage**
   - READ `current_agreed_price` (display pre-filled)
   - Allow override (with commission warning)
   - On confirm: write `opp.final_price` = `current_agreed_price` (snapshot)

7. **Closed Won stage**
   - READ `current_agreed_price`
   - Compute final commission

### Phase 2 (Day 5+ - Proposal versioning)

**Changes needed:**

1. **Send Proposal button** (current code generates email)
   - Replace with PDF generation + version insert
   - Show "Sending version 2..." progress
   - Update opp.current_* on send

2. **Proposal History view** (NEW)
   - Show all versions for an opp
   - Diff view between versions
   - "Resend" option for previous version

3. **Negotiation UX**
   - Show "Editing draft of version 3..."
   - "Send updated proposal" button

---

## 5. Test Plan

### Phase 1 verification (after Day 2 work)

**Test 1: New opp creation**
```
1. Create new opp from Lead, select unit EBT-11-07
2. After creation, query:
   SELECT current_agreed_price, current_admin_fee, current_trustee_fee
   FROM opportunities WHERE id = '<new-opp-id>';
3. Expected:
   current_agreed_price: 3,671,666 (from salePricing)
   current_admin_fee: 580
   current_trustee_fee: 4200
```

**Test 2: Proposal discount**
```
1. Open opp, go to Proposal stage
2. Enter 3% discount
3. Save proposal
4. Query:
   SELECT current_discount_type, current_discount_value, current_agreed_price
   FROM opportunities WHERE id = '<opp-id>';
5. Expected:
   current_discount_type: 'percent'
   current_discount_value: 3.0
   current_agreed_price: 3,561,516 (3,671,666 * 0.97)
```

**Test 3: Discount as amount**
```
1. Open opp, switch discount to "amount"
2. Enter AED 100,000
3. Save
4. Query as above
5. Expected:
   current_discount_type: 'amount'
   current_discount_value: 100000
   current_agreed_price: 3,571,666 (3,671,666 - 100,000)
```

**Test 4: Negotiation carries forward**
```
1. From Proposal (3% discount), advance to Negotiation
2. Negotiation dialog shows: discount 3%, price 3,561,516 (NOT blank)
3. Adjust to 5% discount
4. Save & advance
5. Query: current_discount_value = 5.0, current_agreed_price recomputed
```

**Test 5: SPA pre-fill**
```
1. From Negotiation (5% discount), advance through Acceptance, Reserved, to SPA Signed
2. SPA dialog shows: Final Agreed Price = current_agreed_price (NOT 0, NOT blank)
3. Expected: matches what was set in Negotiation
```

**Test 6: End-to-end with founder's acid test**
```
Use: Mohammed Ali, AGR-14-10
Steps:
  - Create opp with this unit
  - Proposal: 2% discount → current_agreed_price = 7,633,529
  - Negotiation: change to 3% → current_agreed_price = 7,404,523
  - Negotiation: set DLD = 50/50 split
  - Acceptance: confirms 7,404,523 (NOT list price)
  - Reserved: 10% = 740,452
  - SPA: pre-fills 7,404,523 (NOT budget, NOT 0)
  - Closed Won: commission calculated on 7,404,523

Pass criteria: numbers tie through ALL stages.
```

### Phase 2 verification (after Day 5+ work)

**Test 7: Proposal versioning**
```
1. Create opp, send Proposal v1 (3% discount)
2. Query pp_proposal_versions WHERE opportunity_id = '<id>'
3. Expected: 1 row, version_number=1, status='sent'
4. Modify proposal, send v2 (5% discount)
5. Query: 2 rows total
   v1: status='superseded'
   v2: status='sent'
6. Accept v2
7. Query: v2 status='accepted'
8. opp.current_proposal_version_number = 2
```

---

## 6. Migration Execution Plan (Day 2 - Tomorrow)

### Pre-flight checks (5 min)
- [ ] Backup Supabase database
- [ ] Note current opp count for verification
- [ ] Verify Supabase admin access
- [ ] Have rollback SQL ready in another tab

### Execute Phase 1 migration (10 min)
1. Run schema additions SQL (the ALTER TABLE)
2. Verify with verification queries 1-3
3. Run backfill SQL
4. Verify with verification query 4
5. Confirm app still works (no breaking changes - new columns are nullable)

### Refactor app to use current_* (60 min)
- File: src/App.jsx
- Touch points: ~7 places (listed in Section 4 above)
- Test each touch with corresponding test case

### Commit + tag
```bash
git add src/App.jsx
git commit -m "Phase 1 math flow: opportunities.current_* columns"
git tag day2-math-flow-foundation-done
git push --tags
```

---

## 7. Open Questions for Tomorrow

These need verification before/during Day 2 execution:

1. **Existing `discount_pct` column** — keep or deprecate?
   - Recommendation: Keep for backwards compat. App reads `current_*`. Old code reading `discount_pct` still works.

2. **Off-plan vs ready detection** — for trustee fee default
   - Need to check: does any column distinguish? `unit.type`? `unit.sub_type`?
   - If not: default trustee_fee = NULL, broker enters at proposal

3. **Developer-specific fees** — where stored today?
   - Check `pp_developers` table for fee fields
   - If exists: pull defaults at opp creation
   - If not: default to standards (580/4200/null), broker adjusts

4. **Concurrency** — what if 2 brokers edit same opp?
   - Use `current_values_updated_at` for optimistic locking later
   - For now: last write wins (Phase B/C concern)

---

## 8. Out of Scope (Future Phases)

- **Developer offer integration** — When PropPulse detects developer announcement, auto-update current_* (Phase C)
- **AI-suggested discount based on inventory health** — slow movers get more discount (Phase C)
- **Mortgage flow** — separate payment plan structure (Phase C)
- **Multi-buyer opps** — joint purchase scenarios (Phase D)
- **Cross-developer comparison** — broker showing same buyer multiple units (Phase B)

---

## 9. Document Status

| Phase | Status |
|---|---|
| Phase 1 Schema design | ✅ APPROVED |
| Phase 1 Migration SQL | ✅ READY |
| Phase 1 Backfill SQL | ✅ READY |
| Phase 1 Rollback SQL | ✅ READY |
| Phase 1 Test cases | ✅ DEFINED |
| Phase 1 App refactor plan | ✅ DEFINED |
| Phase 2 Versioning design | ✅ APPROVED |
| Phase 2 Migration SQL | ✅ DRAFTED |
| Phase 2 App changes | ✅ OUTLINED |

**Ready for Day 2 execution tomorrow morning.**

---

*Document created: 13 May 2026, Wednesday evening*
*Author: Claude (in collaboration with founder Abid Mirza)*
*Approved by: Founder (Q&A 13 May 2026 evening)*
*Execution: Day 2 (14 May 2026)*
