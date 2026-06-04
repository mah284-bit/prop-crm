-- ============================================================
-- Migration: Fix handle_new_user() trigger — Day 27 (4 Jun 2026)
-- ============================================================
-- CONTEXT:
--   "Add User" (and self-signup) failed on ALL environments with
--   a generic "Database error creating new user" toast. The
--   serverless function api/create-user.js calls
--   supabase.auth.admin.createUser(), which fires the AFTER INSERT
--   trigger on_auth_user_created -> handle_new_user(). That trigger
--   insert was failing, which 500'd the whole auth call.
--
-- ROOT CAUSES (found + fixed in order):
--   1. Trigger did NOT insert `email`, but profiles.email is
--      NOT NULL with no default  -> NOT NULL violation.
--   2. Trigger/column used role 'agent', but profiles_role_check
--      only allows: super_admin, admin, sales_manager, sales_agent,
--      leasing_manager, leasing_agent, viewer  -> CHECK violation.
--      (Column default 'agent' was also invalid — fixed separately,
--       see ALTER below.)
--   3. THE ACTUAL BLOCKER: trigger used bare `profiles` instead of
--      `public.profiles`. As a SECURITY DEFINER function running in
--      the auth context, its search_path did not include `public`,
--      so Postgres logged: relation "profiles" does not exist
--      -> transaction aborted -> auth.admin.createUser returned 500.
--      (This is why a manual INSERT in the SQL editor SUCCEEDED —
--       the editor's search_path includes public — but the trigger
--       FAILED. Classic SECURITY DEFINER search_path gotcha.)
--
-- FIX:
--   - Schema-qualify: INSERT INTO public.profiles
--   - Pin search_path: SET search_path = public
--   - Add email (from NEW.email)
--   - Resilient fallbacks for full_name and role
--
-- This was applied LIVE via Supabase SQL editor on 4 Jun 2026.
-- This file records it for repo discipline (DB rebuild safety).
-- Idempotent: CREATE OR REPLACE + IF-safe ALTER.
-- ============================================================

-- 1. Corrected trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, company_id)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.email),
    new.email,
    COALESCE(new.raw_user_meta_data->>'role', 'sales_agent'),
    (new.raw_user_meta_data->>'company_id')::uuid
  );
  RETURN new;
END;
$function$;

-- 2. Fix the invalid column default ('agent' violated profiles_role_check)
ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'sales_agent';

-- ============================================================
-- VERIFICATION (run after applying):
--   select pg_get_functiondef(oid) from pg_proc where proname='handle_new_user';
--   -- should show: public.profiles, SET search_path=public, email included
--
-- Then test: Add User on prod with a fresh unique email.
-- Confirmed working 4 Jun 2026 (user "Hussain Test" created OK).
-- ============================================================
