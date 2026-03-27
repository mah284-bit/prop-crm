-- ═══════════════════════════════════════════════════════════════
--  PropCRM — Opportunities Table
--  Run in Supabase → SQL Editor
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.opportunities (
  id                    uuid primary key default gen_random_uuid(),
  lead_id               uuid references public.leads(id) on delete cascade,
  unit_id               uuid references public.project_units(id) on delete set null,
  company_id            uuid references public.companies(id),

  -- Identity
  title                 text,
  stage                 text default 'New' check (stage in (
                          'New','Contacted','Site Visit',
                          'Proposal Sent','Negotiation',
                          'Closed Won','Closed Lost')),
  status                text default 'Active' check (status in ('Active','Won','Lost','On Hold')),

  -- People
  assigned_to           uuid references public.profiles(id) on delete set null,

  -- Financials
  budget                numeric,
  offer_price           numeric,
  final_price           numeric,
  discount_pct          numeric default 0,

  -- Proposal
  proposal_sent_at      timestamptz,
  proposal_notes        text,

  -- Payment plan
  payment_plan_id       uuid references public.payment_plan_templates(id) on delete set null,
  payment_plan_agreed   boolean default false,
  payment_plan_custom   jsonb,   -- custom milestones if overriding template

  -- Workflow
  stage_updated_at      timestamptz default now(),
  won_at                timestamptz,
  lost_at               timestamptz,
  lost_reason           text,
  on_hold_reason        text,

  -- Notes
  notes                 text,

  -- Meta
  created_by            uuid references public.profiles(id),
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

-- RLS
alter table public.opportunities enable row level security;

create policy "opportunities_company" on public.opportunities for all
  using (
    company_id = (select company_id from public.profiles where id = auth.uid())
    or (select is_super_admin from public.profiles where id = auth.uid()) = true
  )
  with check (
    company_id = (select company_id from public.profiles where id = auth.uid())
    or (select is_super_admin from public.profiles where id = auth.uid()) = true
  );

-- Add opportunity_id to related tables
alter table public.activities
  add column if not exists opportunity_id uuid references public.opportunities(id) on delete set null;

alter table public.sales_contracts
  add column if not exists opportunity_id uuid references public.opportunities(id) on delete set null;

alter table public.sales_payments
  add column if not exists opportunity_id uuid references public.opportunities(id) on delete set null;

alter table public.discount_requests
  add column if not exists opportunity_id uuid references public.opportunities(id) on delete set null;

-- Indexes
create index if not exists opp_lead_idx    on public.opportunities(lead_id);
create index if not exists opp_unit_idx    on public.opportunities(unit_id);
create index if not exists opp_stage_idx   on public.opportunities(stage, status);
create index if not exists opp_company_idx on public.opportunities(company_id);

-- Migrate existing leads → create one opportunity per lead
-- (preserves all existing data)
insert into public.opportunities (
  lead_id, unit_id, company_id, title, stage, status,
  assigned_to, budget, final_price, proposal_notes,
  payment_plan_agreed, stage_updated_at, created_by, created_at
)
select
  id as lead_id,
  unit_id,
  company_id,
  coalesce(name, 'Opportunity') as title,
  coalesce(stage, 'New') as stage,
  case
    when stage = 'Closed Won'  then 'Won'
    when stage = 'Closed Lost' then 'Lost'
    else 'Active'
  end as status,
  assigned_to,
  budget,
  final_price,
  proposal_notes,
  coalesce(payment_plan_agreed, false),
  coalesce(stage_updated_at, created_at),
  created_by,
  created_at
from public.leads
where id not in (select lead_id from public.opportunities where lead_id is not null)
on conflict do nothing;

select count(*) as opportunities_created from public.opportunities;
