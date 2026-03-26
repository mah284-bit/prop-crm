-- ═══════════════════════════════════════════════════════════════
--  PROPCCRM — Run this in Supabase SQL Editor
--  Creates the 3 tables the Property Builder needs
-- ═══════════════════════════════════════════════════════════════

-- Drop old conflicting tables first
drop table if exists public.pb_units          cascade;
drop table if exists public.pb_subtypes       cascade;
drop table if exists public.pb_types          cascade;
drop table if exists public.unit_lease_pricing cascade;
drop table if exists public.unit_sale_pricing  cascade;
drop table if exists public.project_units      cascade;

-- ── TABLE 1: project_units ───────────────────────────────────────
create table public.project_units (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references public.projects(id) on delete cascade,
  unit_ref         text not null,
  unit_type        text not null default 'Residential',
  sub_type         text not null default '1 Bed',
  purpose          text not null default 'Sale' check (purpose in ('Sale','Lease','Both')),
  floor_number     integer,
  block_or_tower   text,
  view             text,
  facing           text,
  size_sqft        numeric,
  built_up_sqft    numeric,
  plot_sqft        numeric,
  balcony_sqft     numeric,
  terrace_sqft     numeric,
  bedrooms         integer default 1,
  bathrooms        numeric default 1,
  en_suite         integer default 0,
  parking_spaces   integer default 0,
  guest_bathroom   boolean default false,
  powder_room      boolean default false,
  maid_room        boolean default false,
  maid_bathroom    boolean default false,
  driver_room      boolean default false,
  store_room       boolean default false,
  laundry_room     boolean default false,
  study_room       boolean default false,
  garage           boolean default false,
  private_pool     boolean default false,
  private_garden   boolean default false,
  private_beach    boolean default false,
  roof_terrace     boolean default false,
  furnishing       text default 'Unfurnished',
  condition        text default 'Off-plan',
  fit_out          text,
  handover_date    date,
  status           text default 'Available',
  is_featured      boolean default false,
  notes            text,
  created_by       uuid references public.profiles(id),
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  unique (project_id, unit_ref)
);

-- ── TABLE 2: unit_sale_pricing ───────────────────────────────────
create table public.unit_sale_pricing (
  id                   uuid primary key default gen_random_uuid(),
  unit_id              uuid not null unique references public.project_units(id) on delete cascade,
  project_id           uuid not null references public.projects(id) on delete cascade,
  asking_price         numeric,
  original_price       numeric,
  price_per_sqft       numeric,
  service_charge_sqft  numeric,
  dld_fee_pct          numeric default 4,
  agency_fee_pct       numeric default 2,
  noc_fee              numeric,
  admin_fee            numeric,
  oqood_fee            numeric,
  expected_rent        numeric,
  gross_yield          numeric,
  net_yield            numeric,
  total_buyer_cost     numeric,
  booking_pct          numeric default 10,
  during_construction_pct numeric default 40,
  on_handover_pct      numeric default 50,
  post_handover_pct    numeric default 0,
  post_handover_years  integer default 0,
  post_handover_freq   text default 'Annual',
  payment_plan_notes   text,
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);

-- ── TABLE 3: unit_lease_pricing ──────────────────────────────────
create table public.unit_lease_pricing (
  id                   uuid primary key default gen_random_uuid(),
  unit_id              uuid not null unique references public.project_units(id) on delete cascade,
  project_id           uuid not null references public.projects(id) on delete cascade,
  annual_rent          numeric,
  rent_per_sqft        numeric,
  security_deposit     numeric,
  agency_fee_leasing   numeric,
  municipality_tax_pct numeric default 5,
  chiller_included     boolean default false,
  chiller_monthly      numeric,
  cheques_allowed      integer default 4,
  min_lease_months     integer default 12,
  max_lease_months     integer default 24,
  notice_period_months integer default 3,
  fit_out_contribution numeric,
  rent_free_months     integer default 0,
  escalation_pct       numeric,
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);

-- ── RLS ──────────────────────────────────────────────────────────
alter table public.project_units     enable row level security;
alter table public.unit_sale_pricing enable row level security;
alter table public.unit_lease_pricing enable row level security;

create policy "project_units_all"
  on public.project_units for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "unit_sale_pricing_all"
  on public.unit_sale_pricing for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "unit_lease_pricing_all"
  on public.unit_lease_pricing for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ── CONFIRM ──────────────────────────────────────────────────────
select table_name, 
       (select count(*) from information_schema.columns c 
        where c.table_name = t.table_name 
        and c.table_schema = 'public') as col_count
from information_schema.tables t
where table_schema = 'public'
  and table_name in ('project_units','unit_sale_pricing','unit_lease_pricing','projects')
order by table_name;
