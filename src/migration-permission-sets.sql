-- ═══════════════════════════════════════════════════════════════
--  PROPCCRM — Permission Sets Migration
--  Run AFTER migration-multicompany.sql
-- ═══════════════════════════════════════════════════════════════

-- ── 1. PERMISSION SETS TABLE ─────────────────────────────────────
create table if not exists public.permission_sets (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid references public.companies(id) on delete cascade,
  name         text not null,
  description  text,
  is_template  boolean default false,  -- true = built-in, cannot delete
  based_on     text,                   -- which template it was cloned from
  color        text default '#1A5FA8', -- display colour
  -- SALES permissions
  p_view_leads        boolean default false,
  p_edit_leads        boolean default false,
  p_delete_leads      boolean default false,
  p_request_discount  boolean default false,
  p_approve_discount  boolean default false,
  -- INVENTORY permissions
  p_view_inventory    boolean default false,
  p_manage_inventory  boolean default false,
  -- LEASING permissions
  p_view_leasing      boolean default false,
  p_manage_leasing    boolean default false,
  -- GENERAL permissions
  p_view_dashboard    boolean default true,
  p_view_activity     boolean default false,
  p_use_ai            boolean default false,
  p_manage_users      boolean default false,
  -- META
  user_count   integer default 0,
  created_by   uuid references public.profiles(id),
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- ── 2. ADD permission_set_id TO PROFILES ─────────────────────────
alter table public.profiles
  add column if not exists permission_set_id uuid references public.permission_sets(id);

-- ── 3. INSERT BUILT-IN TEMPLATES (global, company_id = null) ─────
insert into public.permission_sets
  (id, company_id, name, description, is_template, based_on, color,
   p_view_leads, p_edit_leads, p_delete_leads, p_request_discount, p_approve_discount,
   p_view_inventory, p_manage_inventory,
   p_view_leasing, p_manage_leasing,
   p_view_dashboard, p_view_activity, p_use_ai, p_manage_users)
values
  -- Company Admin
  ('10000000-0000-0000-0000-000000000001', null,
   'Company Admin', 'Full access to all modules and user management',
   true, null, '#8A6200',
   true, true, true, true, true,
   true, true,
   true, true,
   true, true, true, true),
  -- Sales Manager
  ('10000000-0000-0000-0000-000000000002', null,
   'Sales Manager', 'All sales modules, can approve discounts up to limit',
   true, null, '#1A5FA8',
   true, true, true, true, true,
   true, false,
   false, false,
   true, true, true, false),
  -- Sales Agent
  ('10000000-0000-0000-0000-000000000003', null,
   'Sales Agent', 'Own leads only, can request discounts',
   true, null, '#1A7F5A',
   true, true, false, true, false,
   true, false,
   false, false,
   true, true, true, false),
  -- Leasing Manager
  ('10000000-0000-0000-0000-000000000004', null,
   'Leasing Manager', 'All leasing modules, can approve rent reductions',
   true, null, '#5B3FAA',
   false, false, false, false, true,
   false, false,
   true, true,
   true, true, true, false),
  -- Leasing Agent
  ('10000000-0000-0000-0000-000000000005', null,
   'Leasing Agent', 'Tenants, leases, payments and maintenance',
   true, null, '#0F6E56',
   false, false, false, false, false,
   false, false,
   true, true,
   true, true, true, false),
  -- Viewer
  ('10000000-0000-0000-0000-000000000006', null,
   'Viewer', 'Read-only access to dashboard and activity log',
   true, null, '#718096',
   false, false, false, false, false,
   false, false,
   false, false,
   true, true, false, false)
on conflict (id) do nothing;

-- ── 4. RLS ON PERMISSION SETS ────────────────────────────────────
alter table public.permission_sets enable row level security;

-- Everyone can read templates (company_id is null)
create policy "permission_sets_read_templates"
  on public.permission_sets for select
  using (
    auth.role() = 'authenticated' and
    (company_id is null or
     company_id = (select company_id from public.profiles where id = auth.uid()))
  );

-- Company admins can manage their own permission sets
create policy "permission_sets_manage"
  on public.permission_sets for all
  using (
    auth.role() = 'authenticated' and
    company_id = (select company_id from public.profiles where id = auth.uid())
  )
  with check (
    company_id = (select company_id from public.profiles where id = auth.uid())
  );

-- ── 5. RLS FOR COMPANY DATA ISOLATION (Option B) ─────────────────
-- Leads
drop policy if exists "leads_company_isolation" on public.leads;
create policy "leads_company_isolation"
  on public.leads for all
  using (
    company_id = (select company_id from public.profiles where id = auth.uid())
    or (select is_super_admin from public.profiles where id = auth.uid()) = true
  )
  with check (
    company_id = (select company_id from public.profiles where id = auth.uid())
  );

-- Projects
drop policy if exists "projects_company_isolation" on public.projects;
create policy "projects_company_isolation"
  on public.projects for all
  using (
    company_id = (select company_id from public.profiles where id = auth.uid())
    or (select is_super_admin from public.profiles where id = auth.uid()) = true
  )
  with check (
    company_id = (select company_id from public.profiles where id = auth.uid())
  );

-- Project Units
drop policy if exists "project_units_company_isolation" on public.project_units;
create policy "project_units_company_isolation"
  on public.project_units for all
  using (
    company_id = (select company_id from public.profiles where id = auth.uid())
    or (select is_super_admin from public.profiles where id = auth.uid()) = true
  )
  with check (
    company_id = (select company_id from public.profiles where id = auth.uid())
  );

-- Tenants
drop policy if exists "tenants_company_isolation" on public.tenants;
create policy "tenants_company_isolation"
  on public.tenants for all
  using (
    company_id = (select company_id from public.profiles where id = auth.uid())
    or (select is_super_admin from public.profiles where id = auth.uid()) = true
  )
  with check (
    company_id = (select company_id from public.profiles where id = auth.uid())
  );

-- Leases
drop policy if exists "leases_company_isolation" on public.leases;
create policy "leases_company_isolation"
  on public.leases for all
  using (
    company_id = (select company_id from public.profiles where id = auth.uid())
    or (select is_super_admin from public.profiles where id = auth.uid()) = true
  )
  with check (
    company_id = (select company_id from public.profiles where id = auth.uid())
  );

-- Discount Requests
drop policy if exists "discount_requests_company_isolation" on public.discount_requests;
create policy "discount_requests_company_isolation"
  on public.discount_requests for all
  using (
    company_id = (select company_id from public.profiles where id = auth.uid())
    or (select is_super_admin from public.profiles where id = auth.uid()) = true
  )
  with check (
    company_id = (select company_id from public.profiles where id = auth.uid())
  );

-- Profiles — users only see profiles in their own company
drop policy if exists "profiles_company_isolation" on public.profiles;
create policy "profiles_company_isolation"
  on public.profiles for select
  using (
    company_id = (select company_id from public.profiles p2 where p2.id = auth.uid())
    or (select is_super_admin from public.profiles where id = auth.uid()) = true
  );

-- ── 6. CONFIRM ───────────────────────────────────────────────────
select name, is_template, color,
  p_view_leads, p_edit_leads, p_manage_inventory,
  p_view_leasing, p_manage_users
from public.permission_sets
order by is_template desc, name;
