-- ═══════════════════════════════════════════════════════════════
--  PROPCCRM — Add Leasing Enquiry Fields to Leads Table
--  Run in Supabase → SQL Editor
-- ═══════════════════════════════════════════════════════════════

alter table public.leads
  add column if not exists preferred_bedrooms  text,
  add column if not exists preferred_area      text,
  add column if not exists move_in_date        date;

-- Confirm
select column_name, data_type
from information_schema.columns
where table_name = 'leads'
  and column_name in ('preferred_bedrooms','preferred_area','move_in_date','property_type')
order by column_name;
