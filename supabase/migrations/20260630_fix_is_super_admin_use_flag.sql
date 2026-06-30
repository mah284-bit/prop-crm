-- 30 Jun 2026 — ROOT-CAUSE identity fix
-- is_super_admin() was checking role='super_admin' (hard-coded string), so a TENANT super_admin
-- (role=super_admin, is_super_admin flag=false) was treated as a PLATFORM owner by RLS across all
-- ~50 tables, leaking cross-company data. Fixed to check the is_super_admin FLAG instead.
-- Effect: only the platform owner (flag=true) bypasses company scoping; tenant users (flag=false)
-- are RLS-scoped to their own company_id everywhere, at the database level.
create or replace function is_super_admin()
returns boolean language sql security definer stable as $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND is_super_admin = true
  );
$$;
