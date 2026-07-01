-- RLS ISOLATION / PERMISSION TEST HARNESS (Stage B deliverable)
-- Run whole file in Supabase SQL editor after ANY RLS/policy/capability change.
-- Compare output to EXPECTED values in comments. Mismatch = leak (too many) or break (too few).
--
-- MECHANISM: SQL editor runs as postgres (bypasses RLS). Impersonate a user with:
--   begin; select set_config('request.jwt.claims','{"sub":"<uuid>","role":"authenticated"}',true);
--   set local role authenticated; <queries>; rollback;
--
-- TEST USERS:
--   mah284      fa0aae73-847a-4bdc-b4be-f4c0ebb80974  platform owner (is_super_admin=true)
--   SoleBroker  f85784c9-8cb4-4449-9dcc-54d1210a8521  solo tenant (flag=false)
--   Rajesh      eb26f15e-bfa7-4224-8442-28488691a378  sales_agent Al Mansoori
--   Arun        78284963-14d1-4b16-b973-5f50f2c5e3e9  sales_manager Al Mansoori
--   EPR_agent   6668999c-9fcb-47b7-93f8-673aa6368379  sales_agent EPR (cross-tenant)
-- Al Mansoori c23a2320-... ; EPR e536de3f-... ; baseline: leads 25, opps 38, activities 189, MA 4, invoices 10

-- USER 1: mah284 (PLATFORM OWNER) — sees all
begin;
select set_config('request.jwt.claims','{"sub":"fa0aae73-847a-4bdc-b4be-f4c0ebb80974","role":"authenticated"}',true);
set local role authenticated;
select 'mah284' u,'companies' t,count(*) n,'all: 7' e from companies
union all select 'mah284','profiles',count(*),'all: 15' from profiles
union all select 'mah284','master_agreements',count(*),'all: 5' from pp_master_agreements;
rollback;

-- USER 2: SoleBroker (SOLO) — own company only
begin;
select set_config('request.jwt.claims','{"sub":"f85784c9-8cb4-4449-9dcc-54d1210a8521","role":"authenticated"}',true);
set local role authenticated;
select 'solebroker' u,'companies' t,count(*) n,'EXPECT 1' e from companies
union all select 'solebroker','leads',count(*),'EXPECT 1' from leads
union all select 'solebroker','opportunities',count(*),'EXPECT 1' from opportunities;
rollback;

-- USER 3: Rajesh (sales_agent) — crown jewels HARD 0
begin;
select set_config('request.jwt.claims','{"sub":"eb26f15e-bfa7-4224-8442-28488691a378","role":"authenticated"}',true);
set local role authenticated;
select 'rajesh' u,'master_agreements' t,count(*) n,'EXPECT 0 HARD' e from pp_master_agreements
union all select 'rajesh','commission_invoices',count(*),'EXPECT 0 HARD' from pp_commission_invoices;
rollback;

-- USER 4: Arun (sales_manager) — branch + crown jewels
begin;
select set_config('request.jwt.claims','{"sub":"78284963-14d1-4b16-b973-5f50f2c5e3e9","role":"authenticated"}',true);
set local role authenticated;
select 'arun' u,'master_agreements' t,count(*) n,'EXPECT 4' e from pp_master_agreements
union all select 'arun','commission_invoices',count(*),'EXPECT 10' from pp_commission_invoices
union all select 'arun','leads',count(*),'EXPECT 25' from leads
union all select 'arun','opportunities',count(*),'EXPECT 38' from opportunities;
rollback;

-- USER 5: EPR_agent (cross-tenant) — 0 Al Mansoori, crown jewels HARD 0
begin;
select set_config('request.jwt.claims','{"sub":"6668999c-9fcb-47b7-93f8-673aa6368379","role":"authenticated"}',true);
set local role authenticated;
select 'epr_agent' u,'companies' t,count(*) n,'EXPECT 1 (EPR only)' e from companies
union all select 'epr_agent','master_agreements',count(*),'EXPECT 0 HARD' from pp_master_agreements
union all select 'epr_agent','commission_invoices',count(*),'EXPECT 0 HARD' from pp_commission_invoices;
rollback;
