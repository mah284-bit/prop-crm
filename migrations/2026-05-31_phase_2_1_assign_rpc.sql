-- ═══════════════════════════════════════════════════════════════════════════
-- Phase 2.1 Day 20 — assign_lead_via_pool RPC function
-- ═══════════════════════════════════════════════════════════════════════════
-- Date: 31 May 2026 (Sunday, Day 20)
-- Design ref: docs/Phase_2_1_Lead_Ingestion_Design.md (Assignment service logic section)
-- Branch: dev2
-- Depends on: 2026-05-30_phase_2_1_lead_ingestion.sql (schema already applied)
--
-- WHAT THIS RPC DOES:
--   Atomically assigns a lead to the next agent in a pool via round-robin.
--   "Next agent" = active pool member with oldest last_assigned_at
--   (NULLs first so new pool members get their first lead quickly).
--
--   The function performs three writes in one transaction:
--     1. UPDATE leads — set assigned_to, assignment_status, timestamps
--     2. UPDATE agent_pool_members — set last_assigned_at for the chosen agent
--     3. INSERT lead_assignment_log — audit row
--
--   If any step fails (e.g., lead already assigned, pool empty, agent inactive),
--   the entire transaction rolls back. No partial state.
--
-- SECURITY:
--   - SECURITY DEFINER so the function bypasses RLS (needed because the function
--     must see the full pool membership list regardless of who calls it). The
--     function does its OWN authorization: caller's company_id must match the
--     lead's company_id.
--   - RLS still applies to direct table access — this function is the ONLY path
--     for assignment writes, ensuring consistency.
--
-- RUN: Paste this entire file into Supabase Dashboard → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.assign_lead_via_pool(
  p_lead_id uuid,
  p_pool_id uuid,
  p_triggered_by uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead_company_id uuid;
  v_lead_status text;
  v_pool_company_id uuid;
  v_caller_company_id uuid;
  v_chosen_agent_id uuid;
  v_chosen_agent_name text;
  v_now timestamptz := now();
BEGIN
  -- ─────────────────────────────────────────────────────────────────────
  -- 1. VALIDATE LEAD
  -- ─────────────────────────────────────────────────────────────────────
  SELECT company_id, assignment_status
    INTO v_lead_company_id, v_lead_status
    FROM public.leads
   WHERE id = p_lead_id;

  IF v_lead_company_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'lead_not_found',
      'message', 'Lead does not exist'
    );
  END IF;

  -- Idempotency: refuse to assign a lead that's already assigned.
  -- Lead Admin should use a separate force-reassign function for that case.
  IF v_lead_status = 'assigned' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'lead_already_assigned',
      'message', 'Lead is already assigned. Use force_reassign for reassignment.'
    );
  END IF;

  -- ─────────────────────────────────────────────────────────────────────
  -- 2. VALIDATE POOL
  -- ─────────────────────────────────────────────────────────────────────
  SELECT company_id
    INTO v_pool_company_id
    FROM public.agent_pools
   WHERE id = p_pool_id AND is_active = true;

  IF v_pool_company_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'pool_not_found',
      'message', 'Pool does not exist or is inactive'
    );
  END IF;

  -- ─────────────────────────────────────────────────────────────────────
  -- 3. VALIDATE CALLER + MULTI-TENANT SAFETY
  -- ─────────────────────────────────────────────────────────────────────
  -- Caller must belong to the same company as the lead AND the pool.
  -- This is the multi-tenant safety check — RLS-bypass via SECURITY DEFINER
  -- means we MUST enforce company match ourselves.
  SELECT company_id
    INTO v_caller_company_id
    FROM public.profiles
   WHERE id = p_triggered_by;

  IF v_caller_company_id IS NULL OR 
     v_caller_company_id != v_lead_company_id OR
     v_caller_company_id != v_pool_company_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'company_mismatch',
      'message', 'Caller, lead, and pool must belong to the same company'
    );
  END IF;

  -- ─────────────────────────────────────────────────────────────────────
  -- 4. PICK NEXT AGENT (round-robin: oldest last_assigned_at, NULLs first)
  -- ─────────────────────────────────────────────────────────────────────
  -- ORDER BY: NULLS FIRST so new members get their first lead immediately.
  -- Ties broken by user_id for determinism (not random).
  -- FILTER: only active agents (profiles.is_active=true).
  SELECT m.user_id, p.full_name
    INTO v_chosen_agent_id, v_chosen_agent_name
    FROM public.agent_pool_members m
    JOIN public.profiles p ON p.id = m.user_id
   WHERE m.pool_id = p_pool_id
     AND p.is_active = true
   ORDER BY m.last_assigned_at ASC NULLS FIRST, m.user_id ASC
   LIMIT 1;

  IF v_chosen_agent_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'no_active_members',
      'message', 'Pool has no active members eligible for assignment'
    );
  END IF;

  -- ─────────────────────────────────────────────────────────────────────
  -- 5. UPDATE LEAD (atomic — if this fails, all rollback)
  -- ─────────────────────────────────────────────────────────────────────
  UPDATE public.leads
     SET assigned_to             = v_chosen_agent_id,
         assignment_status       = 'assigned',
         last_assigned_at        = v_now,
         last_broker_activity_at = v_now
   WHERE id = p_lead_id;

  -- ─────────────────────────────────────────────────────────────────────
  -- 6. UPDATE POOL MEMBER (rotates round-robin)
  -- ─────────────────────────────────────────────────────────────────────
  UPDATE public.agent_pool_members
     SET last_assigned_at = v_now
   WHERE pool_id = p_pool_id
     AND user_id = v_chosen_agent_id;

  -- ─────────────────────────────────────────────────────────────────────
  -- 7. WRITE AUDIT LOG
  -- ─────────────────────────────────────────────────────────────────────
  INSERT INTO public.lead_assignment_log
    (lead_id, company_id, action, from_user_id, to_user_id, pool_id,
     method, reason, triggered_by)
  VALUES
    (p_lead_id, v_lead_company_id, 'initial_assignment',
     NULL, v_chosen_agent_id, p_pool_id,
     'round_robin', p_reason, p_triggered_by);

  -- ─────────────────────────────────────────────────────────────────────
  -- 8. RETURN SUCCESS
  -- ─────────────────────────────────────────────────────────────────────
  RETURN jsonb_build_object(
    'success', true,
    'lead_id', p_lead_id,
    'assigned_to', v_chosen_agent_id,
    'assigned_to_name', v_chosen_agent_name,
    'pool_id', p_pool_id,
    'assigned_at', v_now
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Catch-all: log to Postgres logs, return structured error
    RAISE NOTICE 'assign_lead_via_pool error: % %', SQLERRM, SQLSTATE;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'unexpected_error',
      'message', SQLERRM,
      'sqlstate', SQLSTATE
    );
END;
$$;

COMMENT ON FUNCTION public.assign_lead_via_pool(uuid, uuid, uuid, text) IS
'Phase 2.1: Atomic round-robin assignment of a lead to the next eligible agent in a pool. Returns jsonb with success/error structure. Enforces multi-tenant company match. Idempotent — refuses to assign already-assigned leads.';

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICATION QUERIES (run after applying the function)
-- ═══════════════════════════════════════════════════════════════════════════

-- V1: Function exists?
SELECT 
  routine_name, 
  routine_type, 
  data_type AS return_type, 
  security_type
FROM information_schema.routines
WHERE routine_schema='public' 
  AND routine_name='assign_lead_via_pool';
-- Expected: 1 row, security_type=DEFINER

-- V2: Quick dry-run test (no real lead/pool to test against yet, but validates
--     the function compiles + returns structured errors).
--     Replace the UUIDs with random ones — they should NOT exist.
SELECT public.assign_lead_via_pool(
  '00000000-0000-0000-0000-000000000001'::uuid,  -- fake lead
  '00000000-0000-0000-0000-000000000002'::uuid,  -- fake pool
  '00000000-0000-0000-0000-000000000003'::uuid,  -- fake user
  'test call - expect lead_not_found error'
) AS result;
-- Expected: {"success": false, "error": "lead_not_found", "message": "..."}

-- ═══════════════════════════════════════════════════════════════════════════
-- END
-- ═══════════════════════════════════════════════════════════════════════════
