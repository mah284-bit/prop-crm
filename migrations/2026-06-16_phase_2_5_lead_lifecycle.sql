-- Phase 2.5: Lead Lifecycle schema
-- Date: 16 Jun 2026

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS lifecycle_stage text DEFAULT 'Raw'
  CHECK (lifecycle_stage IN ('Raw', 'Qualified', 'Active Prospect', 'Customer', 'Portfolio'));

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS buyer_intent text DEFAULT 'Investor'
  CHECK (buyer_intent IN ('Investor', 'Owner-Occupier', 'Hybrid', 'Corporate', 'Reseller'));

-- Verify
SELECT COUNT(*) as columns_added FROM information_schema.columns
WHERE table_schema='public' AND table_name='leads'
  AND column_name IN ('lifecycle_stage', 'buyer_intent');
