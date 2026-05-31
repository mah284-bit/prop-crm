-- ═══════════════════════════════════════════════════════════════════════════
-- Phase 2.1 — Lead Ingestion, Assignment & Governance — Schema Migration
-- ═══════════════════════════════════════════════════════════════════════════
-- Date: 30 May 2026 (Day 19 afternoon)
-- Design ref: docs/Phase_2_1_Lead_Ingestion_Design.md
-- Branch: dev2
-- 
-- WHAT THIS MIGRATION DOES:
--   1. Creates 3 new tables (agent_pools, agent_pool_members, lead_assignment_log)
--   2. Adds 4 columns to leads (origin, assignment_status, last_assigned_at,
--      last_broker_activity_at)
--   3. Adds 4 columns to companies (lead_admin_user_id, pool_sources,
--      stale_lead_threshold_days, stale_action)
--   4. Backfills existing leads to origin='broker_created', assignment_status='assigned'
--   5. Enables RLS on new tables with multi-tenant policies
--   6. Adds new tables to Supabase Realtime publication
--   7. Rollback SQL at bottom (commented out)
--
-- TWO-LAYER ASSIGNMENT MODEL (per design doc):
--   - leads.assigned_to     = lead-level owner (this migration governs this)
--   - opportunities.assigned_to = per-deal owner (UNTOUCHED by this migration)
--   - One lead can have multiple opps with different brokers
--
-- RUN: Paste this entire file into Supabase Dashboard → SQL Editor → Run
-- VERIFY: At bottom, run the verification queries
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- 1. NEW TABLES
-- ───────────────────────────────────────────────────────────────────────────

-- 1.1 agent_pools — per-company agent groupings for round-robin distribution
CREATE TABLE IF NOT EXISTS public.agent_pools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id),
  UNIQUE (company_id, name)
);
COMMENT ON TABLE public.agent_pools IS 'Per-company groupings of agents for round-robin lead distribution. Phase 2.1.';

CREATE INDEX IF NOT EXISTS idx_agent_pools_company 
  ON public.agent_pools(company_id) 
  WHERE is_active = true;


-- 1.2 agent_pool_members — pool membership (many-to-many: agent can be in multiple pools)
CREATE TABLE IF NOT EXISTS public.agent_pool_members (
  pool_id uuid NOT NULL REFERENCES public.agent_pools(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_assigned_at timestamptz,
  added_at timestamptz DEFAULT now(),
  PRIMARY KEY (pool_id, user_id)
);
COMMENT ON TABLE public.agent_pool_members IS 'Pool membership + last-assigned timestamp for round-robin ordering. NULL last_assigned_at = never assigned, gets next lead first. Phase 2.1.';

CREATE INDEX IF NOT EXISTS idx_pool_members_user 
  ON public.agent_pool_members(user_id);


-- 1.3 lead_assignment_log — append-only audit trail of every assignment action
CREATE TABLE IF NOT EXISTS public.lead_assignment_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN (
    'initial_assignment',
    'broker_created',
    'manual_override',
    'broker_released',
    'broker_transferred',
    'admin_force_reassigned',
    'stale_flagged'
  )),
  from_user_id uuid REFERENCES public.profiles(id),
  to_user_id uuid REFERENCES public.profiles(id),
  pool_id uuid REFERENCES public.agent_pools(id) ON DELETE SET NULL,
  method text CHECK (method IN ('round_robin','manual','transfer','release','auto_stale')),
  reason text,
  triggered_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now()
);
COMMENT ON TABLE public.lead_assignment_log IS 'Append-only audit of lead assignment lifecycle: creation, assignment, release, transfer, stale, force-reassign. Phase 2.1.';

CREATE INDEX IF NOT EXISTS idx_assignment_log_lead 
  ON public.lead_assignment_log(lead_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_assignment_log_company 
  ON public.lead_assignment_log(company_id, created_at DESC);


-- ───────────────────────────────────────────────────────────────────────────
-- 2. NEW COLUMNS ON leads
-- ───────────────────────────────────────────────────────────────────────────

-- origin: how this lead entered the system
ALTER TABLE public.leads 
  ADD COLUMN IF NOT EXISTS origin text 
  DEFAULT 'broker_created'
  CHECK (origin IN ('broker_created', 'pool_sourced'));

-- assignment_status: current state of the lead's ownership
ALTER TABLE public.leads 
  ADD COLUMN IF NOT EXISTS assignment_status text
  DEFAULT 'assigned'
  CHECK (assignment_status IN ('unassigned', 'assigned', 'released', 'stale_flagged'));

-- last_assigned_at: timestamp of most recent (re)assignment
ALTER TABLE public.leads 
  ADD COLUMN IF NOT EXISTS last_assigned_at timestamptz;

-- last_broker_activity_at: latest activity by current assignee (for stale detection)
ALTER TABLE public.leads 
  ADD COLUMN IF NOT EXISTS last_broker_activity_at timestamptz;

-- Index to make stale-detection queries fast
CREATE INDEX IF NOT EXISTS idx_leads_stale_check 
  ON public.leads(company_id, last_broker_activity_at) 
  WHERE assignment_status = 'assigned';


-- ───────────────────────────────────────────────────────────────────────────
-- 3. NEW COLUMNS ON companies
-- ───────────────────────────────────────────────────────────────────────────

-- The user designated as Lead Admin for this brokerage (handles the Lead Queue)
ALTER TABLE public.companies 
  ADD COLUMN IF NOT EXISTS lead_admin_user_id uuid REFERENCES public.profiles(id);

-- Lead source names that route through the Lead Queue (rest go broker-created path)
-- Example: ARRAY['website_form', 'bayut', 'propertyfinder']
ALTER TABLE public.companies 
  ADD COLUMN IF NOT EXISTS pool_sources text[] DEFAULT ARRAY[]::text[];

-- Org-configurable stale threshold (days without activity before flag)
ALTER TABLE public.companies 
  ADD COLUMN IF NOT EXISTS stale_lead_threshold_days int DEFAULT 7;

-- Stale behavior: 'flag_for_admin' (visibility only) or 'auto_return_to_queue' (auto-unassign)
ALTER TABLE public.companies 
  ADD COLUMN IF NOT EXISTS stale_action text DEFAULT 'flag_for_admin'
  CHECK (stale_action IN ('flag_for_admin', 'auto_return_to_queue'));


-- ───────────────────────────────────────────────────────────────────────────
-- 4. BACKFILL EXISTING LEADS
--    All existing leads in the system were broker-created (since Phase 2.1
--    didn't exist before). Set their state to match.
-- ───────────────────────────────────────────────────────────────────────────

UPDATE public.leads 
SET 
  origin = 'broker_created',
  assignment_status = CASE 
    WHEN assigned_to IS NULL THEN 'unassigned' 
    ELSE 'assigned' 
  END,
  last_assigned_at = COALESCE(last_assigned_at, created_at),
  last_broker_activity_at = COALESCE(last_broker_activity_at, created_at)
WHERE origin IS NULL OR origin = 'broker_created';
-- Note: WHERE clause is defensive; safe to re-run.


-- ───────────────────────────────────────────────────────────────────────────
-- 5. ROW-LEVEL SECURITY (RLS)
--    Multi-tenant safety: each company sees only its own data.
-- ───────────────────────────────────────────────────────────────────────────

ALTER TABLE public.agent_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_pool_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_assignment_log ENABLE ROW LEVEL SECURITY;

-- agent_pools: users see pools in their own company
DROP POLICY IF EXISTS agent_pools_select ON public.agent_pools;
CREATE POLICY agent_pools_select ON public.agent_pools FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS agent_pools_insert ON public.agent_pools;
CREATE POLICY agent_pools_insert ON public.agent_pools FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
    AND (
      SELECT role FROM public.profiles WHERE id = auth.uid()
    ) IN ('super_admin', 'admin', 'sales_manager')
  );

DROP POLICY IF EXISTS agent_pools_update ON public.agent_pools;
CREATE POLICY agent_pools_update ON public.agent_pools FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
    AND (
      SELECT role FROM public.profiles WHERE id = auth.uid()
    ) IN ('super_admin', 'admin', 'sales_manager')
  );

DROP POLICY IF EXISTS agent_pools_delete ON public.agent_pools;
CREATE POLICY agent_pools_delete ON public.agent_pools FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
    AND (
      SELECT role FROM public.profiles WHERE id = auth.uid()
    ) IN ('super_admin', 'admin')
  );


-- agent_pool_members: users see memberships for pools in their company
DROP POLICY IF EXISTS agent_pool_members_select ON public.agent_pool_members;
CREATE POLICY agent_pool_members_select ON public.agent_pool_members FOR SELECT
  USING (
    pool_id IN (
      SELECT id FROM public.agent_pools 
      WHERE company_id IN (
        SELECT company_id FROM public.profiles WHERE id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS agent_pool_members_insert ON public.agent_pool_members;
CREATE POLICY agent_pool_members_insert ON public.agent_pool_members FOR INSERT
  WITH CHECK (
    pool_id IN (
      SELECT id FROM public.agent_pools 
      WHERE company_id IN (
        SELECT company_id FROM public.profiles WHERE id = auth.uid()
      )
    )
    AND (
      SELECT role FROM public.profiles WHERE id = auth.uid()
    ) IN ('super_admin', 'admin', 'sales_manager')
  );

DROP POLICY IF EXISTS agent_pool_members_update ON public.agent_pool_members;
CREATE POLICY agent_pool_members_update ON public.agent_pool_members FOR UPDATE
  USING (
    pool_id IN (
      SELECT id FROM public.agent_pools 
      WHERE company_id IN (
        SELECT company_id FROM public.profiles WHERE id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS agent_pool_members_delete ON public.agent_pool_members;
CREATE POLICY agent_pool_members_delete ON public.agent_pool_members FOR DELETE
  USING (
    pool_id IN (
      SELECT id FROM public.agent_pools 
      WHERE company_id IN (
        SELECT company_id FROM public.profiles WHERE id = auth.uid()
      )
    )
    AND (
      SELECT role FROM public.profiles WHERE id = auth.uid()
    ) IN ('super_admin', 'admin', 'sales_manager')
  );


-- lead_assignment_log: users see logs for their company (read-only via API; INSERTs happen via service role)
DROP POLICY IF EXISTS lead_assignment_log_select ON public.lead_assignment_log;
CREATE POLICY lead_assignment_log_select ON public.lead_assignment_log FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS lead_assignment_log_insert ON public.lead_assignment_log;
CREATE POLICY lead_assignment_log_insert ON public.lead_assignment_log FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.profiles WHERE id = auth.uid()
    )
  );
-- No UPDATE or DELETE policy: log is append-only. Even super_admin should not be
-- able to alter history via app. (Db owner can still do it manually if needed.)


-- ───────────────────────────────────────────────────────────────────────────
-- 6. SUPABASE REALTIME — add new tables to publication for cross-tab sync
-- ───────────────────────────────────────────────────────────────────────────

-- Wrap each in DO block so it skips silently if already a publication member
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_pools;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_pool_members;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_assignment_log;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;


-- ───────────────────────────────────────────────────────────────────────────
-- 7. VERIFICATION QUERIES (run these to confirm migration succeeded)
-- ───────────────────────────────────────────────────────────────────────────

-- 7.1 Tables exist?
SELECT 
  'agent_pools' AS table_name, 
  COUNT(*) AS exists 
FROM information_schema.tables 
WHERE table_schema='public' AND table_name='agent_pools'
UNION ALL
SELECT 
  'agent_pool_members', 
  COUNT(*) 
FROM information_schema.tables 
WHERE table_schema='public' AND table_name='agent_pool_members'
UNION ALL
SELECT 
  'lead_assignment_log', 
  COUNT(*) 
FROM information_schema.tables 
WHERE table_schema='public' AND table_name='lead_assignment_log';
-- Expected: 3 rows, each with exists=1

-- 7.2 New columns on leads?
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema='public' AND table_name='leads'
  AND column_name IN ('origin','assignment_status','last_assigned_at','last_broker_activity_at')
ORDER BY column_name;
-- Expected: 4 rows

-- 7.3 New columns on companies?
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema='public' AND table_name='companies'
  AND column_name IN ('lead_admin_user_id','pool_sources','stale_lead_threshold_days','stale_action')
ORDER BY column_name;
-- Expected: 4 rows

-- 7.4 Realtime publication includes new tables?
SELECT tablename FROM pg_publication_tables 
WHERE pubname='supabase_realtime' 
  AND tablename IN ('agent_pools','agent_pool_members','lead_assignment_log')
ORDER BY tablename;
-- Expected: 3 rows

-- 7.5 Existing leads got backfilled?
SELECT 
  origin, 
  assignment_status, 
  COUNT(*) 
FROM public.leads 
GROUP BY origin, assignment_status 
ORDER BY origin, assignment_status;
-- Expected: most/all in (broker_created, assigned) or (broker_created, unassigned)

-- 7.6 RLS enabled?
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname='public' 
  AND tablename IN ('agent_pools','agent_pool_members','lead_assignment_log');
-- Expected: 3 rows, all rowsecurity=true


-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK (commented out — uncomment + run only if migration needs to be reversed)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- WARNING: rollback DROPS the 3 new tables. Any data in them is permanently lost.
-- The leads.assigned_to + opportunities.assigned_to columns are NOT touched by rollback.
--
-- /*
-- -- Remove from realtime publication
-- ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.lead_assignment_log;
-- ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.agent_pool_members;
-- ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.agent_pools;
--
-- -- Drop tables (cascades drop policies, indexes, foreign keys from these tables)
-- DROP TABLE IF EXISTS public.lead_assignment_log;
-- DROP TABLE IF EXISTS public.agent_pool_members;
-- DROP TABLE IF EXISTS public.agent_pools;
--
-- -- Remove added columns from leads
-- ALTER TABLE public.leads DROP COLUMN IF EXISTS origin;
-- ALTER TABLE public.leads DROP COLUMN IF EXISTS assignment_status;
-- ALTER TABLE public.leads DROP COLUMN IF EXISTS last_assigned_at;
-- ALTER TABLE public.leads DROP COLUMN IF EXISTS last_broker_activity_at;
-- DROP INDEX IF EXISTS public.idx_leads_stale_check;
--
-- -- Remove added columns from companies
-- ALTER TABLE public.companies DROP COLUMN IF EXISTS lead_admin_user_id;
-- ALTER TABLE public.companies DROP COLUMN IF EXISTS pool_sources;
-- ALTER TABLE public.companies DROP COLUMN IF EXISTS stale_lead_threshold_days;
-- ALTER TABLE public.companies DROP COLUMN IF EXISTS stale_action;
-- */

-- ═══════════════════════════════════════════════════════════════════════════
-- END MIGRATION
-- ═══════════════════════════════════════════════════════════════════════════
