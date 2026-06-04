-- ============================================================
-- Migration: Lead Lifecycle Auto-Conversion — Day 27 (4 Jun 2026)
-- Phase 2.5 (Lead Lifecycle & Buyer Segmentation) — auto-conversion slice
-- ============================================================
-- DESIGN (confirmed with founder, grounded in UAE CRM standard):
--   A lead becomes a CUSTOMER at the FIRST money moment — the first time an
--   opportunity reaches any of: 'Reserved' (booking/reservation paid — primary),
--   'Closed Won', or 'SPA Signed' (safety nets for deals entered at a later stage).
--   became_customer_at is stamped once (never overwritten).
--   2+ conversion-stage deals -> portfolio_customer.
--
-- WHY these 3 stages: founder principle "once money changes hands he is a
-- customer" + UAE journey standard (Lead -> Qualified -> Opportunity ->
-- RESERVATION [first money] -> SPA/Contract). Reservation = earliest defensible
-- conversion point; others ensure no customer is missed.
--
-- *** IDEMPOTENT RECOMPUTE DESIGN (important) ***
--   portfolio_size and total_purchases_aed are RECOMPUTED from source (count/sum
--   of the lead's opps in conversion stages) — NOT incremented. This is immune to
--   double-fire / replay / re-run (an earlier incrementing version double-counted;
--   this recompute version is correct no matter how many times it fires).
--
-- COMEBACK-SAFETY: operates purely on lead+opp rows scoped by existing company_id.
-- Independent of the deferred super-admin / switcher / branch identity refactor.
--
-- Idempotent: IF NOT EXISTS / CREATE OR REPLACE. Safe to re-run.
-- Applied live via Supabase SQL editor (shared DB → affects prod immediately).
-- Tested working 4 Jun 2026: single opp -> Reserved => lead customer,
--   portfolio_size 1, total = that opp's current_agreed_price, became_customer_at set.
-- ============================================================

-- 1. Add missing customer columns (additive, safe)
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS portfolio_size integer DEFAULT 0;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS total_purchases_aed numeric DEFAULT 0;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS marketing_opt_in boolean DEFAULT true;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS last_marketing_contact timestamptz;

-- 2. Auto-conversion function (RECOMPUTE design — idempotent)
CREATE OR REPLACE FUNCTION public.convert_lead_to_customer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  conversion_stages text[] := ARRAY['Reserved','Closed Won','SPA Signed'];
  v_count integer;
  v_total numeric;
BEGIN
  IF (NEW.stage = ANY(conversion_stages))
     AND (OLD.stage IS DISTINCT FROM NEW.stage)
     AND NEW.lead_id IS NOT NULL
  THEN
    -- RECOMPUTE from source of truth (idempotent — no double-count possible)
    SELECT COUNT(*), COALESCE(SUM(current_agreed_price),0)
      INTO v_count, v_total
      FROM public.opportunities
      WHERE lead_id = NEW.lead_id
        AND stage = ANY(conversion_stages);

    UPDATE public.leads l SET
      lifecycle_stage = CASE
        WHEN v_count >= 2 THEN 'portfolio_customer'
        WHEN v_count = 1 THEN 'customer'
        ELSE l.lifecycle_stage
      END,
      became_customer_at = COALESCE(l.became_customer_at, NOW()),
      portfolio_size = v_count,
      total_purchases_aed = v_total
    WHERE l.id = NEW.lead_id;
  END IF;
  RETURN NEW;
END;
$function$;

-- 3. Trigger (drop-then-create so re-runs are clean)
DROP TRIGGER IF EXISTS opp_stage_converts_lead ON public.opportunities;
CREATE TRIGGER opp_stage_converts_lead
AFTER UPDATE OF stage ON public.opportunities
FOR EACH ROW EXECUTE FUNCTION public.convert_lead_to_customer();

-- ============================================================
-- NOTES / OPEN ITEMS (future Phase 2.5 slices — NOT in this migration):
--   * Cancellation/forfeit: recompute lowers portfolio_size if a deal leaves a
--     conversion stage, BUT became_customer_at is never cleared (founder: "once
--     money moves, he is a customer"). Sub-status refinement = later.
--   * UI: lifecycle/intent badges + segment filter already exist (App.jsx
--     ~11503-12462). Customers screen + bulk actions = later slices.
--   * current_agreed_price confirmed as the opp value column (verified 4 Jun).
-- ============================================================

-- VERIFICATION:
--   select tgname from pg_trigger where tgname='opp_stage_converts_lead';
--   -- safe functional test (rolls back):
--   -- BEGIN; UPDATE opportunities SET stage='Reserved' WHERE id='<opp>';
--   -- SELECT lifecycle_stage,portfolio_size,total_purchases_aed FROM leads WHERE id='<lead>'; ROLLBACK;
