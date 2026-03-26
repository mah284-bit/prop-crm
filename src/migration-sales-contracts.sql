-- ═══════════════════════════════════════════════════════════════
--  PROPCCRM — Sales Payments, Contracts & Leasing PDC Migration
--  Run in Supabase → SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- ── 1. SALES CONTRACTS ───────────────────────────────────────────
create table if not exists public.sales_contracts (
  id                  uuid primary key default gen_random_uuid(),
  lead_id             uuid references public.leads(id) on delete cascade,
  unit_id             uuid references public.project_units(id),
  company_id          uuid references public.companies(id),
  buyer_name          text,
  buyer_nationality   text,
  buyer_id_number     text,
  buyer_phone         text,
  buyer_email         text,
  spa_number          text,
  contract_date       date,
  final_price         numeric,
  currency            text default 'AED',
  dld_fee_pct         numeric default 4,
  dld_fee_amount      numeric,
  agency_fee_pct      numeric default 2,
  agency_fee_amount   numeric,
  booking_pct         numeric default 10,
  construction_pct    numeric default 40,
  handover_pct        numeric default 50,
  post_handover_pct   numeric default 0,
  post_handover_years numeric default 0,
  payment_plan_notes  text,
  status              text default 'Draft' check (status in ('Draft','Executed','Registered','Cancelled')),
  ejari_number        text,
  dld_registration    text,
  contract_file_url   text,
  notes               text,
  created_by          uuid references public.profiles(id),
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- ── 2. SALES PAYMENT SCHEDULE ────────────────────────────────────
create table if not exists public.sales_payments (
  id                  uuid primary key default gen_random_uuid(),
  contract_id         uuid references public.sales_contracts(id) on delete cascade,
  lead_id             uuid references public.leads(id),
  unit_id             uuid references public.project_units(id),
  company_id          uuid references public.companies(id),
  milestone           text not null,
  milestone_order     integer default 1,
  amount              numeric not null,
  percentage          numeric,
  due_date            date,
  payment_type        text default 'Cheque' check (payment_type in ('Cash','Cheque','Bank Transfer','Credit Card')),
  cheque_number       text,
  cheque_date         date,
  bank_name           text,
  cheque_file_url     text,
  status              text default 'Pending' check (status in ('Pending','Received','Deposited','Cleared','Bounced','Cancelled')),
  received_date       date,
  cleared_date        date,
  bounce_reason       text,
  notes               text,
  created_by          uuid references public.profiles(id),
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- ── 3. LEASING PDC (Post-Dated Cheques) ──────────────────────────
create table if not exists public.lease_cheques (
  id                  uuid primary key default gen_random_uuid(),
  lease_id            uuid references public.leases(id) on delete cascade,
  unit_id             uuid references public.project_units(id),
  tenant_id           uuid references public.tenants(id),
  company_id          uuid references public.companies(id),
  cheque_number       text,
  cheque_date         date not null,
  amount              numeric not null,
  bank_name           text,
  cheque_file_url     text,
  period_from         date,
  period_to           date,
  cheque_sequence     integer default 1,
  total_cheques       integer default 4,
  status              text default 'Pending' check (status in ('Pending','Deposited','Cleared','Bounced','Replaced','Cancelled')),
  deposit_date        date,
  cleared_date        date,
  bounce_reason       text,
  replacement_cheque_id uuid references public.lease_cheques(id),
  notes               text,
  created_by          uuid references public.profiles(id),
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- ── 4. SUPABASE STORAGE BUCKET ───────────────────────────────────
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

drop policy if exists "documents_upload" on storage.objects;
create policy "documents_upload" on storage.objects for insert
  with check (bucket_id = 'documents' and auth.role() = 'authenticated');

drop policy if exists "documents_read" on storage.objects;
create policy "documents_read" on storage.objects for select
  using (bucket_id = 'documents' and auth.role() = 'authenticated');

drop policy if exists "documents_delete" on storage.objects;
create policy "documents_delete" on storage.objects for delete
  using (bucket_id = 'documents' and auth.role() = 'authenticated');

-- ── 5. RLS ON NEW TABLES ─────────────────────────────────────────
alter table public.sales_contracts enable row level security;
drop policy if exists "sales_contracts_company" on public.sales_contracts;
create policy "sales_contracts_company" on public.sales_contracts for all
  using (company_id = (select company_id from public.profiles where id = auth.uid())
    or (select is_super_admin from public.profiles where id = auth.uid()) = true)
  with check (company_id = (select company_id from public.profiles where id = auth.uid()));

alter table public.sales_payments enable row level security;
drop policy if exists "sales_payments_company" on public.sales_payments;
create policy "sales_payments_company" on public.sales_payments for all
  using (company_id = (select company_id from public.profiles where id = auth.uid())
    or (select is_super_admin from public.profiles where id = auth.uid()) = true)
  with check (company_id = (select company_id from public.profiles where id = auth.uid()));

alter table public.lease_cheques enable row level security;
drop policy if exists "lease_cheques_company" on public.lease_cheques;
create policy "lease_cheques_company" on public.lease_cheques for all
  using (company_id = (select company_id from public.profiles where id = auth.uid())
    or (select is_super_admin from public.profiles where id = auth.uid()) = true)
  with check (company_id = (select company_id from public.profiles where id = auth.uid()));

-- ── 6. CONFIRM ───────────────────────────────────────────────────
select table_name from information_schema.tables
where table_schema = 'public'
  and table_name in ('sales_contracts','sales_payments','lease_cheques')
order by table_name;
