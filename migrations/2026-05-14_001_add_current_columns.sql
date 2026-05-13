-- ============================================================================
-- Migration: 2026-05-14_001_add_current_columns.sql
-- Purpose:   Phase 1 of Math Flow Sprint
--            Add 13 "current_*" columns to opportunities table to establish
--            single source of truth for price/discount/fees across all stages.
--
-- Sprint:    Sprint Plan 13-27 May 2026 (Day 2)
-- Spec:      docs/Math_Flow_Schema_Design.md (Section 2 - Phase 1)
--
-- Safety:    Backwards compatible (all columns nullable)
--            Existing code unaffected (no breaking changes)
--            Can run on production safely
--
-- Rollback:  See 2026-05-14_999_rollback_phase1.sql
-- ============================================================================

BEGIN;

-- ============================================================================
-- SECTION 1: Add current_* columns
-- ============================================================================

ALTER TABLE opportunities
  -- Price (the live "current" agreed price - cascading single source of truth)
  -- Initial value: salePricing.asking_price at opp creation
  -- Updated by: Proposal discount, Negotiation outcome, SPA override
  ADD COLUMN IF NOT EXISTS current_agreed_price NUMERIC(15,2),

  -- Discount (% OR amount, never both - broker chooses based on negotiation style)
  -- 'percent' = current_discount_value is 0-100 (e.g. 3.5)
  -- 'amount'  = current_discount_value is AED amount (e.g. 50000)
  -- NULL      = no discount applied
  ADD COLUMN IF NOT EXISTS current_discount_type TEXT,
  ADD COLUMN IF NOT EXISTS current_discount_value NUMERIC(15,2),

  -- Source of current discount (for audit/explainability)
  -- 'proposal' | 'negotiation' | 'override' | 'developer_offer' | 'backfill_13_may_2026'
  ADD COLUMN IF NOT EXISTS current_discount_source TEXT,

  -- DLD fees (actual AED amounts, not just %, per founder Q3)
  -- 'buyer'      = buyer pays full 4%
  -- 'developer'  = developer absorbs full 4%
  -- 'split'      = split per current_dld_split_pct
  -- 'negotiated' = custom arrangement, see current_dld_amount
  ADD COLUMN IF NOT EXISTS current_dld_payer TEXT,
  ADD COLUMN IF NOT EXISTS current_dld_split_pct NUMERIC(5,2),  -- buyer's % if split (0-100)
  ADD COLUMN IF NOT EXISTS current_dld_amount NUMERIC(15,2),    -- AED buyer actually pays

  -- Other UAE standard + developer-specific fees
  ADD COLUMN IF NOT EXISTS current_admin_fee NUMERIC(15,2),       -- AED 580 standard
  ADD COLUMN IF NOT EXISTS current_trustee_fee NUMERIC(15,2),     -- AED 4,200 off-plan
  ADD COLUMN IF NOT EXISTS current_oqood_fee NUMERIC(15,2),       -- AED Oqood registration
  ADD COLUMN IF NOT EXISTS current_developer_fees NUMERIC(15,2),  -- catch-all developer fees

  -- Audit trail (who changed what when)
  ADD COLUMN IF NOT EXISTS current_values_updated_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS current_values_updated_by UUID REFERENCES profiles(id);


-- ============================================================================
-- SECTION 2: Add CHECK constraints for data integrity
-- ============================================================================

-- Discount type must be 'percent' or 'amount' (or NULL for no discount)
DO $$ BEGIN
  ALTER TABLE opportunities
    ADD CONSTRAINT chk_current_discount_type
    CHECK (current_discount_type IN ('percent', 'amount') OR current_discount_type IS NULL);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- DLD payer must be valid value (or NULL for unspecified)
DO $$ BEGIN
  ALTER TABLE opportunities
    ADD CONSTRAINT chk_current_dld_payer
    CHECK (current_dld_payer IN ('buyer', 'developer', 'split', 'negotiated') OR current_dld_payer IS NULL);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- DLD split percent must be valid (0-100)
DO $$ BEGIN
  ALTER TABLE opportunities
    ADD CONSTRAINT chk_current_dld_split_pct
    CHECK ((current_dld_split_pct IS NULL) OR (current_dld_split_pct >= 0 AND current_dld_split_pct <= 100));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================================
-- SECTION 3: Add index for performance
-- ============================================================================

-- Index on updated_at for queries like "show opps with recent price changes"
CREATE INDEX IF NOT EXISTS idx_opportunities_current_updated 
  ON opportunities(current_values_updated_at);


-- ============================================================================
-- SECTION 4: Verification queries (run AFTER commit to confirm)
-- ============================================================================

-- Uncomment and run after migration to verify:

-- 1. Confirm all 13 columns exist
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'opportunities' AND column_name LIKE 'current_%'
-- ORDER BY ordinal_position;
-- Expected: 13 rows

-- 2. Confirm CHECK constraints exist
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'opportunities'::regclass
--   AND conname LIKE '%current_%';
-- Expected: 3 constraints

-- 3. Confirm index exists
-- SELECT indexname FROM pg_indexes
-- WHERE tablename = 'opportunities' AND indexname LIKE '%current%';
-- Expected: idx_opportunities_current_updated


COMMIT;

-- ============================================================================
-- POST-MIGRATION: Run backfill script (2026-05-14_002_backfill_current_columns.sql)
-- ============================================================================
