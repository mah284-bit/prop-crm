-- ═══════════════════════════════════════════════════════════════
--  PropCRM — Multiple Units per Lead
--  Run in Supabase → SQL Editor
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.lead_units (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid references public.leads(id) on delete cascade,
  unit_id     uuid references public.project_units(id) on delete cascade,
  company_id  uuid references public.companies(id),
  is_primary  boolean default false,
  status      text default 'Viewing' check (status in ('Viewing','Proposed','Accepted','Declined')),
  notes       text,
  added_at    timestamptz default now(),
  unique(lead_id, unit_id)
);

alter table public.lead_units enable row level security;

create policy "lead_units_company" on public.lead_units for all
  using (
    company_id = (select company_id from public.profiles where id = auth.uid())
    or (select is_super_admin from public.profiles where id = auth.uid()) = true
  )
  with check (
    company_id = (select company_id from public.profiles where id = auth.uid())
  );

-- Index
create index if not exists lead_units_lead_idx on public.lead_units(lead_id);

select 'lead_units table created' as result;
