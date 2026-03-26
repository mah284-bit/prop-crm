-- ═══════════════════════════════════════════════════════════════
--  Fix Companies RLS — allow super_admin to read/write all
-- ═══════════════════════════════════════════════════════════════

-- Drop existing policies
drop policy if exists "companies_read"  on public.companies;
drop policy if exists "companies_write" on public.companies;

-- Super admin sees all companies, others see only their own
create policy "companies_select"
  on public.companies for select
  using (
    (select is_super_admin from public.profiles where id = auth.uid()) = true
    or
    id = (select company_id from public.profiles where id = auth.uid())
  );

-- Only super admin can insert/update/delete companies
create policy "companies_insert"
  on public.companies for insert
  with check (
    (select is_super_admin from public.profiles where id = auth.uid()) = true
  );

create policy "companies_update"
  on public.companies for update
  using (
    (select is_super_admin from public.profiles where id = auth.uid()) = true
  );

create policy "companies_delete"
  on public.companies for delete
  using (
    (select is_super_admin from public.profiles where id = auth.uid()) = true
  );

-- Also fix profiles RLS so super_admin can see all profiles
drop policy if exists "profiles_company_isolation" on public.profiles;

create policy "profiles_select"
  on public.profiles for select
  using (
    (select is_super_admin from public.profiles p2 where p2.id = auth.uid()) = true
    or
    company_id = (select company_id from public.profiles p3 where p3.id = auth.uid())
    or
    id = auth.uid()
  );

-- Confirm
select schemaname, tablename, policyname
from pg_policies
where tablename in ('companies','profiles')
order by tablename, policyname;
