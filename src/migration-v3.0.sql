-- ═══════════════════════════════════════════════════════════════════
--  PROPCCRM — Migration v3.0
--  Full restructure: Property Builder + Complete Leasing Module
--  Run in Supabase → SQL Editor → New Query
--  IMPORTANT: Run this AFTER migration v2.3
-- ═══════════════════════════════════════════════════════════════════

-- ── DROP OLD TABLES (if they exist from v2.3) ────────────────────
drop table if exists public.units       cascade;
drop table if exists public.buildings   cascade;
drop table if exists public.categories  cascade;
drop table if exists public.projects    cascade;

-- ════════════════════════════════════════════════════════════════════
--  PROPERTY BUILDER — 4 Level Hierarchy
--  Level 1: Project
--  Level 2: Property Type  (Commercial | Residential)
--  Level 3: Sub-type       (Villa / Office / etc.)
--  Level 4: Unit           (full spec + Sales or Leasing purpose)
-- ════════════════════════════════════════════════════════════════════

-- ── LEVEL 1: PROJECTS ────────────────────────────────────────────
create table if not exists public.pb_projects (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  developer         text,
  location          text,
  area              text,                    -- e.g. Downtown Dubai, JVC, DIFC
  description       text,
  status            text default 'Active'
                      check (status in ('Active','Upcoming','Completed','On Hold')),
  launch_date       date,
  completion_date   date,
  total_units       integer default 0,
  website           text,
  cover_image_url   text,
  master_plan_url   text,
  created_by        uuid references public.profiles(id),
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- ── LEVEL 2: PROPERTY TYPES (under each project) ─────────────────
create table if not exists public.pb_types (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.pb_projects(id) on delete cascade,
  type        text not null check (type in ('Commercial','Residential')),
  description text,
  created_at  timestamptz default now()
);

-- ── LEVEL 3: SUB-TYPES (under each type) ─────────────────────────
create table if not exists public.pb_subtypes (
  id          uuid primary key default gen_random_uuid(),
  type_id     uuid not null references public.pb_types(id) on delete cascade,
  project_id  uuid not null references public.pb_projects(id) on delete cascade,
  name        text not null,
  -- Commercial: Office | Retail/Shop | Warehouse | Labour Camp | Showroom | Mixed Use
  -- Residential: Villa | Apartment/Flat | Townhouse | Penthouse | Studio | Duplex | Plot
  purpose     text not null check (purpose in ('Sales','Leasing','Both')),
  description text,
  total_units integer default 0,
  created_at  timestamptz default now()
);

-- ── LEVEL 4: UNITS (under each sub-type) ─────────────────────────
create table if not exists public.pb_units (
  id                   uuid primary key default gen_random_uuid(),
  subtype_id           uuid not null references public.pb_subtypes(id) on delete cascade,
  type_id              uuid not null references public.pb_types(id)    on delete cascade,
  project_id           uuid not null references public.pb_projects(id) on delete cascade,

  -- Identity
  unit_ref             text not null,         -- e.g. "A-101", "Villa-12", "Shop-G04"
  floor_number         integer,
  view                 text,
  purpose              text not null default 'Sales'
                         check (purpose in ('Sales','Leasing','Both')),

  -- Dimensions
  size_sqft            numeric,
  size_sqm             numeric,
  built_up_sqft        numeric,
  plot_sqft            numeric,               -- for villas / plots
  bedrooms             integer,
  bathrooms            integer,
  parking_spaces       integer default 0,
  balcony_sqft         numeric,

  -- Sales Pricing
  sale_price           numeric,
  price_per_sqft       numeric,               -- auto: sale_price / size_sqft
  original_price       numeric,               -- for discounts / offers
  service_charge_sqft  numeric,               -- AED/sqft/year
  gross_yield          numeric,               -- %
  net_yield            numeric,               -- %

  -- Sales Payment Plan
  booking_pct          numeric default 10,
  construction_pct     numeric default 40,
  handover_pct         numeric default 50,
  post_handover_pct    numeric default 0,
  post_handover_years  integer default 0,
  payment_plan_notes   text,
  dld_fee_pct          numeric default 4,     -- Dubai Land Department fee %
  agency_fee_pct       numeric default 2,     -- Agency commission %

  -- Leasing Pricing
  annual_rent          numeric,               -- AED/year
  monthly_rent         numeric,               -- auto: annual / 12
  rent_per_sqft        numeric,               -- auto: annual / size_sqft
  security_deposit     numeric,               -- AED
  cheques_allowed      integer default 4,     -- 1/2/4/6/12 cheques
  chiller_included     boolean default false,
  municipality_fee_pct numeric default 5,     -- % of annual rent

  -- Status
  status               text default 'Available'
                         check (status in ('Available','Reserved','Under Offer',
                                           'Sold','Rented','Blocked','Off Market')),
  handover_date        date,
  furnishing           text default 'Unfurnished'
                         check (furnishing in ('Furnished','Semi-Furnished','Unfurnished')),
  condition            text default 'Off-plan'
                         check (condition in ('Off-plan','Ready','Resale','Renovated')),
  facing               text,                  -- North / South / East / West / Corner

  notes                text,
  is_featured          boolean default false,
  created_by           uuid references public.profiles(id),
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);

-- ════════════════════════════════════════════════════════════════════
--  LEASING MODULE
-- ════════════════════════════════════════════════════════════════════

-- ── TENANTS ──────────────────────────────────────────────────────
create table if not exists public.tenants (
  id                   uuid primary key default gen_random_uuid(),
  -- Personal Info
  full_name            text not null,
  email                text,
  phone                text,
  whatsapp             text,
  nationality          text,
  -- Documents
  passport_no          text,
  passport_expiry      date,
  visa_no              text,
  visa_expiry          date,
  emirates_id          text,
  emirates_id_expiry   date,
  trade_license_no     text,             -- for commercial tenants
  company_name         text,             -- for commercial tenants
  -- Classification
  tenant_type          text default 'Individual'
                         check (tenant_type in ('Individual','Company')),
  status               text default 'Active'
                         check (status in ('Active','Inactive','Blacklisted')),
  notes                text,
  created_by           uuid references public.profiles(id),
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);

-- ── LEASE CONTRACTS ───────────────────────────────────────────────
create table if not exists public.leases (
  id                   uuid primary key default gen_random_uuid(),
  -- Parties
  tenant_id            uuid not null references public.tenants(id),
  unit_id              uuid not null references public.pb_units(id),
  project_id           uuid references public.pb_projects(id),
  assigned_to          uuid references public.profiles(id),
  -- Contract Terms
  contract_no          text,                  -- e.g. RERA registration no.
  lease_type           text default 'Residential'
                         check (lease_type in ('Residential','Commercial')),
  start_date           date not null,
  end_date             date not null,
  notice_period_days   integer default 90,
  -- Financials
  annual_rent          numeric not null,
  security_deposit     numeric,
  municipality_fee     numeric,               -- 5% of annual rent (auto)
  agency_commission    numeric,
  total_contract_value numeric,               -- auto: annual_rent * years
  no_of_cheques        integer default 4,
  -- Status
  status               text default 'Active'
                         check (status in ('Draft','Active','Expired','Terminated',
                                           'Renewed','Under Renewal')),
  renewal_offered      boolean default false,
  renewal_rent         numeric,               -- offered renewal rent
  termination_date     date,
  termination_reason   text,
  -- Documents
  ejari_no             text,                  -- Dubai Ejari registration
  rera_no              text,
  notes                text,
  created_by           uuid references public.profiles(id),
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);

-- ── RENT PAYMENTS ────────────────────────────────────────────────
create table if not exists public.rent_payments (
  id                   uuid primary key default gen_random_uuid(),
  lease_id             uuid not null references public.leases(id) on delete cascade,
  tenant_id            uuid not null references public.tenants(id),
  unit_id              uuid references public.pb_units(id),
  -- Payment Details
  cheque_no            text,
  bank_name            text,
  amount               numeric not null,
  due_date             date not null,
  payment_date         date,
  payment_method       text default 'Cheque'
                         check (payment_method in ('Cheque','Bank Transfer',
                                                    'Cash','Online','PDC')),
  period_from          date,
  period_to            date,
  -- Status
  status               text default 'Pending'
                         check (status in ('Pending','Received','Cleared',
                                           'Bounced','Cancelled','Waived')),
  bounce_charge        numeric default 0,
  late_fee             numeric default 0,
  notes                text,
  recorded_by          uuid references public.profiles(id),
  created_at           timestamptz default now()
);

-- ── MAINTENANCE REQUESTS ─────────────────────────────────────────
create table if not exists public.maintenance (
  id                   uuid primary key default gen_random_uuid(),
  lease_id             uuid references public.leases(id),
  tenant_id            uuid not null references public.tenants(id),
  unit_id              uuid references public.pb_units(id),
  project_id           uuid references public.pb_projects(id),
  -- Request Details
  title                text not null,
  description          text,
  category             text check (category in ('Plumbing','Electrical','AC/HVAC',
                                                'Structural','Painting','Cleaning',
                                                'Security','Pest Control','Other')),
  priority             text default 'Medium'
                         check (priority in ('Low','Medium','High','Emergency')),
  -- Assignment
  assigned_to          uuid references public.profiles(id),
  contractor_name      text,
  contractor_phone     text,
  -- Financials
  estimated_cost       numeric,
  actual_cost          numeric,
  charged_to           text check (charged_to in ('Owner','Tenant','Insurance','TBD')),
  -- Status & Timeline
  status               text default 'Open'
                         check (status in ('Open','In Progress','Completed',
                                           'On Hold','Cancelled')),
  reported_at          timestamptz default now(),
  scheduled_at         timestamptz,
  completed_at         timestamptz,
  notes                text,
  created_by           uuid references public.profiles(id),
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);

-- ── RENEWAL REMINDERS (auto-view for expiring leases) ────────────
-- This is handled as a computed query, but we store config here
create table if not exists public.renewal_config (
  id                   uuid primary key default gen_random_uuid(),
  reminder_days        integer[] default '{90,60,30,14,7}',  -- days before expiry
  auto_increase_pct    numeric default 0,
  created_at           timestamptz default now()
);
insert into public.renewal_config (reminder_days) values ('{90,60,30,14,7}')
  on conflict do nothing;

-- ════════════════════════════════════════════════════════════════════
--  UPDATE LEADS TABLE — link to new property builder
-- ════════════════════════════════════════════════════════════════════
alter table public.leads
  add column if not exists pb_unit_id    uuid references public.pb_units(id),
  add column if not exists pb_project_id uuid references public.pb_projects(id);

-- ════════════════════════════════════════════════════════════════════
--  TRIGGERS
-- ════════════════════════════════════════════════════════════════════
create or replace function update_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger pb_projects_upd before update on public.pb_projects for each row execute function update_updated_at();
create trigger pb_units_upd    before update on public.pb_units    for each row execute function update_updated_at();
create trigger tenants_upd     before update on public.tenants     for each row execute function update_updated_at();
create trigger leases_upd      before update on public.leases      for each row execute function update_updated_at();
create trigger maintenance_upd before update on public.maintenance for each row execute function update_updated_at();

-- ════════════════════════════════════════════════════════════════════
--  ROW LEVEL SECURITY
-- ════════════════════════════════════════════════════════════════════
alter table public.pb_projects  enable row level security;
alter table public.pb_types     enable row level security;
alter table public.pb_subtypes  enable row level security;
alter table public.pb_units     enable row level security;
alter table public.tenants      enable row level security;
alter table public.leases       enable row level security;
alter table public.rent_payments enable row level security;
alter table public.maintenance  enable row level security;

-- All authenticated users can read
do $$ declare t text;
begin for t in select unnest(array['pb_projects','pb_types','pb_subtypes','pb_units',
  'tenants','leases','rent_payments','maintenance']) loop
  execute format('create policy %I on public.%I for select using (auth.role()=''authenticated'')', t||'_r', t);
  execute format('create policy %I on public.%I for insert with check (auth.role()=''authenticated'')', t||'_i', t);
  execute format('create policy %I on public.%I for update using (auth.role()=''authenticated'')', t||'_u', t);
  execute format('create policy %I on public.%I for delete using (exists(select 1 from public.profiles where id=auth.uid() and role in (''admin'',''manager'')))', t||'_d', t);
end loop; end $$;

-- ════════════════════════════════════════════════════════════════════
--  REALTIME
-- ════════════════════════════════════════════════════════════════════
alter publication supabase_realtime add table public.leases;
alter publication supabase_realtime add table public.rent_payments;
alter publication supabase_realtime add table public.maintenance;

select 'Migration v3.0 complete ✓' as status;
select table_name from information_schema.tables
where table_schema='public' and table_name like 'pb_%'
   or table_schema='public' and table_name in ('tenants','leases','rent_payments','maintenance')
order by table_name;
