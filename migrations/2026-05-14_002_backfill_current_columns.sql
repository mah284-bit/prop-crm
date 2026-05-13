-- ============================================================================
-- Migration: 2026-05-14_002_backfill_current_columns.sql
-- Purpose:   Populate current_* columns for existing opportunities (Phase 1)
--
-- Sprint:    Sprint Plan 13-27 May 2026 (Day 2)
-- Spec:      docs/Math_Flow_Schema_Design.md (Section 2 - Backfill strategy)
-- Founder:   Q5 - "starts with the listprice, and upon offers, negotiations
--                  what ever is the final proposal sent which is accepted...
--                  for brokers keep this open they will come to know during
--                  SPA time or whenever they log to the developers apps"
--
-- Strategy:  Cascade fallback to populate current_agreed_price:
--            1. opp.final_price       (Closed Won opps - definitive)
--            2. opp.offer_price       (Offer Accepted opps - negotiated)
--            3. salePricing.asking_price (unit list price)
--            4. opp.budget            (buyer's budget - last resort)
--
-- Safety:    Idempotent - safe to re-run
--            Uses WHERE current_agreed_price IS NULL
--            Marks source as 'backfill_13_may_2026' for audit
--
-- Run after: 2026-05-14_001_add_current_columns.sql
-- ============================================================================

BEGIN;

-- ============================================================================
-- SECTION 1: Pre-backfill baseline (note counts)
-- ============================================================================

-- Capture baseline count before backfill
DO $$
DECLARE
  total_opps INT;
  null_price_opps INT;
BEGIN
  SELECT COUNT(*) INTO total_opps FROM opportunities;
  SELECT COUNT(*) INTO null_price_opps FROM opportunities WHERE current_agreed_price IS NULL;
  
  RAISE NOTICE '=== BACKFILL STARTING ===';
  RAISE NOTICE 'Total opportunities: %', total_opps;
  RAISE NOTICE 'Opportunities needing backfill: %', null_price_opps;
END $$;


-- ============================================================================
-- SECTION 2: Backfill current_agreed_price (the main cascade)
-- ============================================================================

UPDATE opportunities o
SET 
  current_agreed_price = COALESCE(
    -- Priority 1: Closed Won - definitive final price
    NULLIF(o.final_price, 0),
    -- Priority 2: Offer Accepted - negotiated price
    NULLIF(o.offer_price, 0),
    -- Priority 3: Unit's list price from salePricing
    (
      SELECT asking_price 
      FROM unit_sale_pricing usp 
      WHERE usp.unit_id = o.unit_id 
      LIMIT 1
    ),
    -- Priority 4: Buyer's budget (last resort - founder said brokers will adjust at SPA)
    NULLIF(o.budget, 0)
  ),
  current_discount_source = 'backfill_13_may_2026',
  current_values_updated_at = NOW(),
  current_values_updated_by = NULL  -- system backfill, no user
WHERE current_agreed_price IS NULL;


-- ============================================================================
-- SECTION 3: Backfill discount info from existing discount_pct column
-- ============================================================================

UPDATE opportunities
SET 
  current_discount_type = CASE 
    WHEN discount_pct IS NOT NULL AND discount_pct > 0 THEN 'percent'
    ELSE NULL
  END,
  current_discount_value = CASE 
    WHEN discount_pct IS NOT NULL AND discount_pct > 0 THEN discount_pct
    ELSE NULL
  END
WHERE current_discount_type IS NULL
  AND discount_pct IS NOT NULL
  AND discount_pct > 0;


-- ============================================================================
-- SECTION 4: Backfill DLD info from existing columns (if they exist)
-- ============================================================================

UPDATE opportunities
SET 
  current_dld_payer = dld_payer,
  current_dld_split_pct = dld_split_pct
WHERE current_dld_payer IS NULL
  AND dld_payer IS NOT NULL;


-- ============================================================================
-- SECTION 5: Set UAE standard fees for opps that don't have them
-- ============================================================================

-- Note: This is per founder's guidance that UAE standards always apply
-- AED 580 admin fee, AED 4,200 trustee fee (off-plan)
-- Brokers can override during negotiation

UPDATE opportunities
SET 
  current_admin_fee = 580.00
WHERE current_admin_fee IS NULL;

-- Trustee fee only for off-plan (where unit.type is 'Off-Plan' or property_category)
-- For now: set for all opps with property_category = 'Off-Plan'
-- Brokers can clear if not applicable

UPDATE opportunities
SET 
  current_trustee_fee = 4200.00
WHERE current_trustee_fee IS NULL
  AND property_category = 'Off-Plan';


-- ============================================================================
-- SECTION 6: Compute current_dld_amount for opps with payer + price
-- ============================================================================

-- DLD is 4% of agreed price, but actual amount depends on split
UPDATE opportunities
SET 
  current_dld_amount = CASE
    -- Buyer pays full 4%
    WHEN current_dld_payer = 'buyer' THEN 
      current_agreed_price * 0.04
    -- Developer absorbs all
    WHEN current_dld_payer = 'developer' THEN 
      0
    -- Split: buyer pays based on split_pct of the 4%
    WHEN current_dld_payer = 'split' AND current_dld_split_pct IS NOT NULL THEN
      current_agreed_price * 0.04 * (current_dld_split_pct / 100.0)
    -- Negotiated or NULL: leave as null, broker enters manually
    ELSE NULL
  END
WHERE current_dld_amount IS NULL
  AND current_dld_payer IS NOT NULL
  AND current_agreed_price IS NOT NULL;


-- ============================================================================
-- SECTION 7: Post-backfill verification
-- ============================================================================

-- Note completion
DO $$
DECLARE
  total_opps INT;
  with_current_price INT;
  with_discount INT;
  with_dld INT;
  still_null INT;
BEGIN
  SELECT COUNT(*) INTO total_opps FROM opportunities;
  SELECT COUNT(current_agreed_price) INTO with_current_price FROM opportunities;
  SELECT COUNT(current_discount_type) INTO with_discount FROM opportunities;
  SELECT COUNT(current_dld_payer) INTO with_dld FROM opportunities;
  SELECT COUNT(*) INTO still_null FROM opportunities WHERE current_agreed_price IS NULL;
  
  RAISE NOTICE '=== BACKFILL COMPLETE ===';
  RAISE NOTICE 'Total opportunities: %', total_opps;
  RAISE NOTICE 'With current_agreed_price: %', with_current_price;
  RAISE NOTICE 'With current_discount_type: %', with_discount;
  RAISE NOTICE 'With current_dld_payer: %', with_dld;
  RAISE NOTICE 'Still NULL (need manual review): %', still_null;
END $$;


COMMIT;


-- ============================================================================
-- MANUAL VERIFICATION (run separately AFTER commit to inspect data)
-- ============================================================================

-- 1. Check distribution of current_agreed_price sources
-- SELECT 
--   COUNT(*) FILTER (WHERE final_price IS NOT NULL AND current_agreed_price = final_price) AS from_final_price,
--   COUNT(*) FILTER (WHERE offer_price IS NOT NULL AND current_agreed_price = offer_price) AS from_offer_price,
--   COUNT(*) FILTER (WHERE budget IS NOT NULL AND current_agreed_price = budget) AS from_budget,
--   COUNT(*) FILTER (WHERE current_agreed_price IS NULL) AS still_null
-- FROM opportunities;

-- 2. Sample 5 backfilled opps
-- SELECT 
--   id, stage, 
--   current_agreed_price, current_discount_type, current_discount_value,
--   current_dld_payer, current_dld_split_pct, current_dld_amount,
--   current_admin_fee, current_trustee_fee
-- FROM opportunities
-- WHERE current_discount_source = 'backfill_13_may_2026'
-- LIMIT 5;

-- 3. Any opps STILL with NULL current_agreed_price (need investigation)
-- SELECT id, stage, unit_id, final_price, offer_price, budget
-- FROM opportunities
-- WHERE current_agreed_price IS NULL;
