-- ═══════════════════════════════════════════════════════════════
--  PROPCCRM — Inventory v2 Migration
--  Adds missing columns for Projects and Units
--  Run in Supabase → SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- ── Projects new columns ─────────────────────────────────────────
alter table public.projects
  add column if not exists launch_date        date,
  add column if not exists description        text,
  add column if not exists brochure_file_url  text,
  add column if not exists brochure_url       text,
  add column if not exists master_plan_url    text,
  add column if not exists website_url        text;

-- ── Project Units new columns ────────────────────────────────────
alter table public.project_units
  add column if not exists floor_plan_url     text,
  add column if not exists brochure_url       text,
  add column if not exists render_url         text,
  add column if not exists block_or_tower     text,
  add column if not exists facing             text,
  add column if not exists parking_spaces     integer default 0,
  add column if not exists maid_room          boolean default false,
  add column if not exists private_pool       boolean default false,
  add column if not exists private_garden     boolean default false,
  add column if not exists furnishing         text default 'Unfurnished',
  add column if not exists condition          text default 'Off-plan',
  add column if not exists handover_date      date,
  add column if not exists fit_out            text;

-- ── Unit Sale Pricing new columns ────────────────────────────────
alter table public.unit_sale_pricing
  add column if not exists during_construction_pct  numeric default 40,
  add column if not exists on_handover_pct           numeric default 50,
  add column if not exists post_handover_pct         numeric default 0,
  add column if not exists booking_pct               numeric default 10,
  add column if not exists agency_fee_pct            numeric default 2,
  add column if not exists dld_fee_pct               numeric default 4;

-- ── Unit Lease Pricing new columns ───────────────────────────────
alter table public.unit_lease_pricing
  add column if not exists municipality_tax_pct  numeric default 5,
  add column if not exists cheques_allowed        integer default 4,
  add column if not exists chiller_included       boolean default false,
  add column if not exists security_deposit       numeric;

-- ── Supabase Storage bucket (if not already created) ─────────────
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- Storage policies (safe to re-run)
drop policy if exists "documents_upload" on storage.objects;
create policy "documents_upload" on storage.objects for insert
  with check (bucket_id = 'documents' and auth.role() = 'authenticated');

drop policy if exists "documents_read" on storage.objects;
create policy "documents_read" on storage.objects for select
  using (bucket_id = 'documents' and auth.role() = 'authenticated');

drop policy if exists "documents_delete" on storage.objects;  
create policy "documents_delete" on storage.objects for delete
  using (bucket_id = 'documents' and auth.role() = 'authenticated');

-- ── Confirm ──────────────────────────────────────────────────────
select 
  column_name, data_type 
from information_schema.columns
where table_schema = 'public'
  and table_name = 'project_units'
  and column_name in ('floor_plan_url','brochure_url','render_url','maid_room','private_pool')
order by column_name;
