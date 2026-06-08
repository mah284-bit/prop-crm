-- ============================================================
-- MULTI-TENANT ISOLATION TEST HARNESS  (read-only, re-runnable)
-- Reports row count per company_id for every LIVE company-scoped table.
-- Run before every release + after every enforcement change.
-- Excludes _backup_* / _deleted_* archive tables.
-- ============================================================

-- PART 1: per-company row counts across all live company-scoped tables.
-- Any table where an "empty" company (e.g. Emirates e536de3f) shows rows
-- that belong elsewhere = investigate. Counts grouped by company.
with scoped as (
  select 'activities'            as tbl, company_id from activities
  union all select 'agent_pools',            company_id from agent_pools
  union all select 'discount_requests',      company_id from discount_requests
  union all select 'lead_assignment_log',    company_id from lead_assignment_log
  union all select 'lead_person_contacts',   company_id from lead_person_contacts
  union all select 'lead_persons',           company_id from lead_persons
  union all select 'lead_units',             company_id from lead_units
  union all select 'leads',                  company_id from leads
  union all select 'lease_cheques',          company_id from lease_cheques
  union all select 'lease_contracts',        company_id from lease_contracts
  union all select 'lease_opportunities',    company_id from lease_opportunities
  union all select 'lease_payments',         company_id from lease_payments
  union all select 'leases',                 company_id from leases
  union all select 'maintenance',            company_id from maintenance
  union all select 'opportunities',          company_id from opportunities
  union all select 'payment_plan_templates', company_id from payment_plan_templates
  union all select 'permission_sets',        company_id from permission_sets
  union all select 'pp_commission_invoices', company_id from pp_commission_invoices
  union all select 'pp_master_agreements',   company_id from pp_master_agreements
  union all select 'pp_sales_closures',      company_id from pp_sales_closures
  union all select 'pp_watchlist',           company_id from pp_watchlist
  union all select 'profiles',               company_id from profiles
  union all select 'project_units',          company_id from project_units
  union all select 'projects',               company_id from projects
  union all select 'proposals',              company_id from proposals
  union all select 'reminders',              company_id from reminders
  union all select 'rent_payments',          company_id from rent_payments
  union all select 'reservations',           company_id from reservations
  union all select 'sales_contracts',        company_id from sales_contracts
  union all select 'sales_payments',         company_id from sales_payments
  union all select 'stage_history',          company_id from stage_history
  union all select 'tenants',                company_id from tenants
  union all select 'unit_lease_pricing',     company_id from unit_lease_pricing
  union all select 'unit_sale_pricing',      company_id from unit_sale_pricing
)
select
  s.tbl,
  coalesce(c.name, '(null/unknown company_id)') as company,
  count(*) as rows
from scoped s
left join companies c on c.id = s.company_id
group by s.tbl, c.name
order by s.tbl, company;

-- ============================================================
-- PART 2: ORPHAN CHECK - rows with NULL company_id (cannot be scoped = leak risk).
-- Any nonzero count here = rows that RLS cannot partition by company.
-- ============================================================
select tbl, null_rows from (
  select 'activities' as tbl, count(*) as null_rows from activities where company_id is null
  union all select 'leads',                 count(*) from leads where company_id is null
  union all select 'opportunities',         count(*) from opportunities where company_id is null
  union all select 'proposals',             count(*) from proposals where company_id is null
  union all select 'reservations',          count(*) from reservations where company_id is null
  union all select 'pp_commission_invoices', count(*) from pp_commission_invoices where company_id is null
  union all select 'pp_master_agreements',  count(*) from pp_master_agreements where company_id is null
  union all select 'sales_contracts',       count(*) from sales_contracts where company_id is null
  union all select 'sales_payments',        count(*) from sales_payments where company_id is null
  union all select 'stage_history',         count(*) from stage_history where company_id is null
  union all select 'reminders',             count(*) from reminders where company_id is null
  union all select 'lead_assignment_log',   count(*) from lead_assignment_log where company_id is null
) x
where null_rows > 0
order by null_rows desc;
-- (empty result = GOOD: no orphaned rows. Any row here needs a company_id assigned.)
