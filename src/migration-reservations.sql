-- ═══════════════════════════════════════════════════════════════
--  PROPCCRM — Reservations Migration
--  Run in Supabase → SQL Editor
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.reservations (
  id                  uuid primary key default gen_random_uuid(),
  unit_id             uuid references public.project_units(id) on delete cascade,
  lead_id             uuid references public.leads(id) on delete set null,
  tenant_id           uuid references public.tenants(id) on delete set null,
  company_id          uuid references public.companies(id),
  -- Type
  reservation_type    text default 'Sale' check (reservation_type in ('Sale','Lease')),
  -- Client info (denormalised for quick display)
  client_name         text not null,
  client_phone        text,
  client_email        text,
  client_nationality  text,
  -- Fee
  reservation_fee     numeric not null default 5000,
  fee_payment_method  text default 'Cash' check (fee_payment_method in ('Cash','Credit Card','Bank Transfer')),
  fee_received_date   date default current_date,
  fee_receipt_url     text,
  -- Dates
  reserved_at         timestamptz default now(),
  expires_at          timestamptz default (now() + interval '2 days'),
  extended_until      timestamptz,
  -- Status
  status              text default 'Active' check (status in ('Active','Expired','Confirmed','Released','Extended')),
  confirmed_at        timestamptz,
  released_at         timestamptz,
  release_reason      text,
  -- Notes
  notes               text,
  -- Meta
  created_by          uuid references public.profiles(id),
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- RLS
alter table public.reservations enable row level security;

drop policy if exists "reservations_company" on public.reservations;
create policy "reservations_company" on public.reservations for all
  using (
    company_id = (select company_id from public.profiles where id = auth.uid())
    or (select is_super_admin from public.profiles where id = auth.uid()) = true
  )
  with check (
    company_id = (select company_id from public.profiles where id = auth.uid())
    or (select is_super_admin from public.profiles where id = auth.uid()) = true
  );

-- Index for fast status queries
create index if not exists reservations_status_idx on public.reservations(status, expires_at);
create index if not exists reservations_unit_idx   on public.reservations(unit_id, status);

-- Verify
select table_name from information_schema.tables
where table_schema = 'public' and table_name = 'reservations';
