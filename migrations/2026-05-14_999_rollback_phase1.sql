-- ============================================================================
-- Migration: 2026-05-14_999_rollback_phase1.sql
-- Purpose:   EMERGENCY ROLLBACK for Phase 1 migration
--            Removes all current_* columns and related artifacts
--
-- Sprint:    Sprint Plan 13-27 May 2026 (Day 2)
--
-- WHEN TO USE:
--   - Migration 001 was applied but caused unforeseen issues
--   - Need to restore opportunities table to pre-migration state
--   - All app code still references old columns (final_price, offer_price, budget)
--     so dropping current_* columns is safe
--
-- WHEN NOT TO USE:
--   - Migration 001 was NEVER applied (nothing to roll back)
--   - You've already started Phase 2 (proposal versioning)
--     which depends on current_* columns
--   - Production users have entered data in current_* columns
--     (data loss will occur - back up first!)
--
-- BACKUP FIRST:
--   pg_dump or Supabase backup before running this
-- ============================================================================

BEGIN;


-- ============================================================================
-- SECTION 1: Confirm intent (uncomment to actually run)
-- ============================================================================

-- This SECTION is intentionally commented out to prevent accidental execution.
-- Uncomment the entire SECTION 2 below to actually perform rollback.


-- ============================================================================
-- SECTION 2: ROLLBACK - Drop all current_* columns + constraints + index
-- ============================================================================

-- UNCOMMENT THIS SECTION TO EXECUTE ROLLBACK:

/*

-- Drop CHECK constraints first
ALTER TABLE opportunities DROP CONSTRAINT IF EXISTS chk_current_discount_type;
ALTER TABLE opportunities DROP CONSTRAINT IF EXISTS chk_current_dld_payer;
ALTER TABLE opportunities DROP CONSTRAINT IF EXISTS chk_current_dld_split_pct;

-- Drop index
DROP INDEX IF EXISTS idx_opportunities_current_updated;

-- Drop all current_* columns
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

-- Note rollback
DO $$ BEGIN
  RAISE NOTICE '=== ROLLBACK COMPLETE ===';
  RAISE NOTICE 'Removed all current_* columns from opportunities table.';
  RAISE NOTICE 'Existing code unaffected (still uses final_price, offer_price, budget).';
END $$;

*/


COMMIT;


-- ============================================================================
-- POST-ROLLBACK VERIFICATION
-- ============================================================================

-- Run after rollback to confirm clean state:

-- 1. Confirm columns are gone
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'opportunities' AND column_name LIKE 'current_%';
-- Expected: 0 rows

-- 2. Confirm constraints are gone
-- SELECT conname FROM pg_constraint
-- WHERE conrelid = 'opportunities'::regclass AND conname LIKE '%current%';
-- Expected: 0 rows

-- 3. Confirm index is gone
-- SELECT indexname FROM pg_indexes
-- WHERE tablename = 'opportunities' AND indexname LIKE '%current%';
-- Expected: 0 rows

-- 4. App still works (existing columns intact)
-- SELECT id, stage, final_price, offer_price, budget, discount_pct
-- FROM opportunities
-- LIMIT 5;
-- Expected: Original data unchanged
