-- ═══════════════════════════════════════════════════════════════
--  PROPCCRM — Multi-Company Migration
--  Run in Supabase → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════════

-- ── 1. COMPANIES TABLE ──────────────────────────────────────────
create table if not exists public.companies (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  logo_url        text,
  business_type   text default 'both' check (business_type in ('sales','leasing','both')),
  primary_contact text,
  phone           text,
  email           text,
  address         text,
  city            text,
  country         text default 'UAE',
  brand_color     text default '#0B1F3A',
  brand_accent    text default '#C9A84C',
  plan            text default 'professional' check (plan in ('starter','professional','enterprise')),
  is_active       boolean default true,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- Insert a default company for existing data
insert into public.companies (id, name, business_type, country, plan)
values ('00000000-0000-0000-0000-000000000001', 'Default Company', 'both', 'UAE', 'professional')
on conflict (id) do nothing;

-- ── 2. ADD company_id TO ALL TABLES ─────────────────────────────
alter table public.profiles
  add column if not exists company_id uuid references public.companies(id) default '00000000-0000-0000-0000-000000000001';

alter table public.leads
  add column if not exists company_id uuid references public.companies(id) default '00000000-0000-0000-0000-000000000001';

alter table public.activities
  add column if not exists company_id uuid references public.companies(id) default '00000000-0000-0000-0000-000000000001';

alter table public.projects
  add column if not exists company_id uuid references public.companies(id) default '00000000-0000-0000-0000-000000000001';

alter table public.project_units
  add column if not exists company_id uuid references public.companies(id) default '00000000-0000-0000-0000-000000000001';

alter table public.unit_sale_pricing
  add column if not exists company_id uuid references public.companies(id) default '00000000-0000-0000-0000-000000000001';

alter table public.unit_lease_pricing
  add column if not exists company_id uuid references public.companies(id) default '00000000-0000-0000-0000-000000000001';

alter table public.tenants
  add column if not exists company_id uuid references public.companies(id) default '00000000-0000-0000-0000-000000000001';

alter table public.leases
  add column if not exists company_id uuid references public.companies(id) default '00000000-0000-0000-0000-000000000001';

alter table public.rent_payments
  add column if not exists company_id uuid references public.companies(id) default '00000000-0000-0000-0000-000000000001';

alter table public.maintenance
  add column if not exists company_id uuid references public.companies(id) default '00000000-0000-0000-0000-000000000001';

alter table public.discount_requests
  add column if not exists company_id uuid references public.companies(id) default '00000000-0000-0000-0000-000000000001';

alter table public.stage_history
  add column if not exists company_id uuid references public.companies(id) default '00000000-0000-0000-0000-000000000001';

-- ── 3. ADD is_super_admin TO PROFILES ───────────────────────────
alter table public.profiles
  add column if not exists is_super_admin boolean default false;

-- Make your admin account a super admin
update public.profiles
set is_super_admin = true
where email = 'mah284@gmail.com';

-- ── 4. RLS ON COMPANIES ──────────────────────────────────────────
alter table public.companies enable row level security;

drop policy if exists "companies_read" on public.companies;
create policy "companies_read"
  on public.companies for select
  using (auth.role() = 'authenticated');

drop policy if exists "companies_write" on public.companies;
create policy "companies_write"
  on public.companies for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ── 5. CONFIRM ───────────────────────────────────────────────────
select
  c.name as company,
  c.business_type,
  c.plan,
  c.is_active,
  count(p.id) as users
from public.companies c
left join public.profiles p on p.company_id = c.id
group by c.id, c.name, c.business_type, c.plan, c.is_active
order by c.name;

-- ── 6. UPDATE ROLE CONSTRAINT TO INCLUDE super_admin ────────────
alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('super_admin','admin','sales_manager','sales_agent','leasing_manager','leasing_agent','viewer'));

-- Set your account as super_admin role too
update public.profiles
set role = 'super_admin', is_super_admin = true
where email = 'mah284@gmail.com';

-- ── 7. FINAL CHECK ───────────────────────────────────────────────
select full_name, email, role, is_super_admin, company_id
from public.profiles
order by role;
