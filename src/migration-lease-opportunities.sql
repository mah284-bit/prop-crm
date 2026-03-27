-- ═══════════════════════════════════════════════════════════════
--  PropCRM — Lease Opportunities Table
--  Run in Supabase → SQL Editor
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.lease_opportunities (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid references public.tenants(id) on delete cascade,
  unit_id           uuid references public.project_units(id) on delete set null,
  company_id        uuid references public.companies(id),
  title             text,
  stage             text default 'New Enquiry' check (stage in (
                      'New Enquiry','Contacted','Viewing','Offer Made',
                      'Reserved','Lease Signed','Lost')),
  status            text default 'Active' check (status in ('Active','Won','Lost','On Hold')),
  assigned_to       uuid references public.profiles(id) on delete set null,
  budget            numeric,
  final_rent        numeric,
  stage_updated_at  timestamptz default now(),
  won_at            timestamptz,
  lost_at           timestamptz,
  lost_reason       text,
  notes             text,
  created_by        uuid references public.profiles(id),
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

alter table public.lease_opportunities enable row level security;

drop policy if exists "lopp_company" on public.lease_opportunities;
create policy "lopp_company" on public.lease_opportunities for all
  using (
    company_id = (select company_id from public.profiles where id = auth.uid())
    or (select is_super_admin from public.profiles where id = auth.uid()) = true
  )
  with check (
    company_id = (select company_id from public.profiles where id = auth.uid())
    or (select is_super_admin from public.profiles where id = auth.uid()) = true
  );

-- Add lease_opportunity_id to activities
alter table public.activities
  add column if not exists lease_opportunity_id uuid references public.lease_opportunities(id) on delete set null;

create index if not exists lopp_tenant_idx  on public.lease_opportunities(tenant_id);
create index if not exists lopp_unit_idx    on public.lease_opportunities(unit_id);
create index if not exists lopp_company_idx on public.lease_opportunities(company_id);

select 'lease_opportunities table created' as result;
