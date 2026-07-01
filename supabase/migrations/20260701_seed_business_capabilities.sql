-- 1 Jul 2026 (Day 45) Path B Step 1: seed the 6 business capabilities the app's can() uses,
-- moving them from hard-coded arrays into role_capabilities (de-hardcoding foundation).
-- Defaults MIRROR the live permissions.js array exactly, so behavior is identical at cutover (nothing
-- reads these yet — the can() rewrite is the next step). Pure addition, zero behavior change.
--   edit_records (was 'write'), delete_records (was 'delete'), delete_leads, reserve_units (was
--   'reserve_unit'), request_discounts (was 'request_discount'), approve_discounts (was approve_manager/all).
-- Verified: 56 rows each (8 roles x 7 companies); sales_agent edit/request=true, delete/approve=false (matches array).
insert into role_capabilities (company_id, role, capability, enabled)
select c.id, m.role, m.capability, m.enabled
from companies c
cross join (values
  ('super_admin','edit_records',true),('admin','edit_records',true),('sales_manager','edit_records',true),
  ('sales_agent','edit_records',true),('leasing_manager','edit_records',true),('leasing_agent','edit_records',true),
  ('group_gm','edit_records',true),('viewer','edit_records',false),
  ('super_admin','delete_records',true),('admin','delete_records',true),('sales_manager','delete_records',true),
  ('sales_agent','delete_records',false),('leasing_manager','delete_records',true),('leasing_agent','delete_records',false),
  ('group_gm','delete_records',true),('viewer','delete_records',false),
  ('super_admin','delete_leads',true),('admin','delete_leads',true),('sales_manager','delete_leads',true),
  ('sales_agent','delete_leads',false),('leasing_manager','delete_leads',true),('leasing_agent','delete_leads',false),
  ('group_gm','delete_leads',true),('viewer','delete_leads',false),
  ('super_admin','reserve_units',true),('admin','reserve_units',true),('sales_manager','reserve_units',true),
  ('sales_agent','reserve_units',true),('leasing_manager','reserve_units',true),('leasing_agent','reserve_units',true),
  ('group_gm','reserve_units',true),('viewer','reserve_units',false),
  ('super_admin','request_discounts',true),('admin','request_discounts',true),('sales_manager','request_discounts',true),
  ('sales_agent','request_discounts',true),('leasing_manager','request_discounts',false),('leasing_agent','request_discounts',false),
  ('group_gm','request_discounts',true),('viewer','request_discounts',false),
  ('super_admin','approve_discounts',true),('admin','approve_discounts',true),('sales_manager','approve_discounts',true),
  ('sales_agent','approve_discounts',false),('leasing_manager','approve_discounts',true),('leasing_agent','approve_discounts',false),
  ('group_gm','approve_discounts',true),('viewer','approve_discounts',false)
) as m(role, capability, enabled)
on conflict (company_id, role, capability) do update set enabled = excluded.enabled;
