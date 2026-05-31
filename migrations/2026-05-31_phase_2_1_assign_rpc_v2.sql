-- ═══════════════════════════════════════════════════════════════════════════
-- Phase 2.1 Day 22 PM: assign_lead_via_pool RPC — add force-reassign support
-- ═══════════════════════════════════════════════════════════════════════════
-- File: migrations/2026-05-31_phase_2_1_assign_rpc_v2.sql
-- Date: 31 May 2026
-- Author: Architect (with Abid Mirza)
--
-- WHAT THIS CHANGES
-- ─────────────────
-- The original assign_lead_via_pool RPC (committed Day 20) refused to operate
-- on leads that were already in 'assigned' state. This was correct for the
-- initial-assignment use case (fresh pool-sourced leads).
--
-- However, the Lead Queue UI (Day 22) needs the SAME RPC to handle the
-- stale-reassignment workflow: admin sees a stale lead, picks a new pool,
-- the system rotates ownership and logs WHY.
--
-- This migration adds two new arguments:
--   p_force  boolean DEFAULT false  — bypass the "already assigned" guard
--   p_reason text    DEFAULT NULL   — mandatory when p_force=true
--
-- When p_force=true:
--   - Existing assignment is overwritten
--   - lead_assignment_log row uses action='manual_override' (not 'initial_assignment')
--   - method='manual' (not 'round_robin')
--   - from_user_id captures the previous owner (governance)
--
-- ROLLBACK
-- ────────
-- Safe to re-run. CREATE OR REPLACE FUNCTION replaces the existing function.
-- To roll back fully, re-run the Day 20 migration file.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.assign_lead_via_pool(
  p_lead_id      uuid,
  p_pool_id      uuid,
  p_triggered_by uuid,
  p_reason       text DEFAULT NULL,
  p_force        boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id     uuid;
  v_lead_company   uuid;
  v_pool_company   uuid;
  v_lead_status    text;
  v_previous_owner uuid;
  v_next_agent     uuid;
  v_agent_name     text;
  v_action         text;
  v_method         text;
BEGIN
  -- ── Step 1: Resolve triggering user's company (multi-tenant guard) ──────
  SELECT company_id INTO v_company_id
  FROM public.profiles
  WHERE id = p_triggered_by;

  IF v_company_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'invalid_user',
      'message', 'Triggering user not found or has no company.'
    );
  END IF;

  -- ── Step 2: Validate lead exists + same company ─────────────────────────
  SELECT company_id, assignment_status, assigned_to
    INTO v_lead_company, v_lead_status, v_previous_owner
  FROM public.leads
  WHERE id = p_lead_id;

  IF v_lead_company IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'lead_not_found',
      'message', 'Lead does not exist.'
    );
  END IF;

  IF v_lead_company <> v_company_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'cross_company',
      'message', 'Lead belongs to a different company.'
    );
  END IF;

  -- ── Step 3: Validate pool exists + same company + is active ─────────────
  SELECT company_id INTO v_pool_company
  FROM public.agent_pools
  WHERE id = p_pool_id AND is_active = true;

  IF v_pool_company IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'pool_not_found',
      'message', 'Pool not found or inactive.'
    );
  END IF;

  IF v_pool_company <> v_company_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'cross_company_pool',
      'message', 'Pool belongs to a different company.'
    );
  END IF;

  -- ── Step 4: Guard against double-assignment (unless p_force=true) ───────
  IF v_lead_status = 'assigned' AND p_force = false THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'already_assigned',
      'message', 'Lead is already assigned. Pass p_force=true to override.'
    );
  END IF;

  -- ── Step 4b: When forcing, reason is mandatory (audit trail) ────────────
  IF p_force = true AND (p_reason IS NULL OR length(trim(p_reason)) = 0) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'reason_required',
      'message', 'Reason is required when force-reassigning an already-assigned lead.'
    );
  END IF;

  -- ── Step 5: Pick next agent (oldest last_assigned_at NULLS FIRST) ───────
  SELECT apm.user_id INTO v_next_agent
  FROM public.agent_pool_members apm
  JOIN public.profiles p ON p.id = apm.user_id
  WHERE apm.pool_id = p_pool_id
    AND p.is_active = true
  ORDER BY apm.last_assigned_at ASC NULLS FIRST, apm.user_id ASC
  LIMIT 1;

  IF v_next_agent IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'pool_empty',
      'message', 'Selected pool has no active members.'
    );
  END IF;

  -- Get agent's name for the success response
  SELECT full_name INTO v_agent_name
  FROM public.profiles
  WHERE id = v_next_agent;

  -- ── Step 6: Determine action + method based on whether this is force ────
  IF p_force = true THEN
    v_action := 'manual_override';
    v_method := 'manual';
  ELSE
    v_action := 'initial_assignment';
    v_method := 'round_robin';
  END IF;

  -- ── Step 7: Atomic transaction — update lead + pool member + audit log ──
  -- Update lead
  UPDATE public.leads
  SET assigned_to            = v_next_agent,
      assignment_status      = 'assigned',
      last_assigned_at       = NOW(),
      last_broker_activity_at = NOW()
  WHERE id = p_lead_id;

  -- Update pool member's last_assigned_at (rotate round-robin)
  UPDATE public.agent_pool_members
  SET last_assigned_at = NOW()
  WHERE pool_id = p_pool_id AND user_id = v_next_agent;

  -- Insert audit log row
  INSERT INTO public.lead_assignment_log (
    lead_id, company_id, action,
    from_user_id, to_user_id, pool_id,
    method, reason, triggered_by
  ) VALUES (
    p_lead_id, v_company_id, v_action,
    v_previous_owner, v_next_agent, p_pool_id,
    v_method, p_reason, p_triggered_by
  );

  -- ── Step 8: Return success ──────────────────────────────────────────────
  RETURN jsonb_build_object(
    'success',          true,
    'lead_id',          p_lead_id,
    'assigned_to',      v_next_agent,
    'assigned_to_name', v_agent_name,
    'pool_id',          p_pool_id,
    'action',           v_action,
    'forced',           p_force
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error',   'unexpected_error',
    'message', SQLERRM
  );
END;
$$;

-- Grant execute to authenticated users (RLS still applies to leads/pools)
GRANT EXECUTE ON FUNCTION public.assign_lead_via_pool(uuid, uuid, uuid, text, boolean) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICATION QUERIES (run after migration)
-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Confirm function signature includes p_force and p_reason:
--    SELECT proname, pg_get_function_identity_arguments(oid)
--    FROM pg_proc WHERE proname = 'assign_lead_via_pool';
--
-- 2. Test force-reassign on a known-assigned lead (will write audit row):
--    SELECT assign_lead_via_pool(
--      'YOUR_LEAD_UUID'::uuid,
--      'YOUR_POOL_UUID'::uuid,
--      'YOUR_USER_UUID'::uuid,
--      'Testing force-reassign migration',
--      true
--    );
--
-- 3. Confirm audit log row was written with action='manual_override':
--    SELECT action, method, from_user_id, to_user_id, reason
--    FROM lead_assignment_log
--    ORDER BY created_at DESC LIMIT 1;
-- ═══════════════════════════════════════════════════════════════════════════
