-- 1 Jul 2026 (Day 45) Stage C task 1: seed canonical capability model (per doc "hard-coded defaults first")
-- 12 canonical caps x 7 roles x all companies, MULTI-AGENT strict defaults. Idempotent (ON CONFLICT DO UPDATE).
-- Fills previously-missing caps (manage_users/settings/inventory, assign_leads, manage_commissions,
-- see_own_data, see_group_data, see_own_commission). Harness-verified: crown jewels held (agent 0/0,
-- manager 4/10); manage_users=admin-only; see_group_data=group_gm-only; see_own_data=all.
-- NOTE: retired-name rows (see_own_opportunities_only, see_team_opportunities, see_all_opportunities,
-- see_agent_commission_split) still exist as orphans — migrated/dropped in next session (task 2).
insert into role_capabilities (company_id, role, capability, enabled)
select c.id, m.role, m.capability, m.enabled
from companies c
cross join (values
  ('sales_agent','see_own_data',true),('sales_agent','see_branch_data',false),('sales_agent','see_group_data',false),
  ('sales_agent','see_own_commission',true),('sales_agent','see_brokerage_commission',false),
  ('sales_agent','view_master_agreements',false),('sales_agent','manage_master_agreements',false),
  ('sales_agent','manage_users',false),('sales_agent','manage_settings',false),('sales_agent','manage_inventory',false),
  ('sales_agent','assign_leads',false),('sales_agent','manage_commissions',false),
  ('leasing_agent','see_own_data',true),('leasing_agent','see_branch_data',false),('leasing_agent','see_group_data',false),
  ('leasing_agent','see_own_commission',true),('leasing_agent','see_brokerage_commission',false),
  ('leasing_agent','view_master_agreements',false),('leasing_agent','manage_master_agreements',false),
  ('leasing_agent','manage_users',false),('leasing_agent','manage_settings',false),('leasing_agent','manage_inventory',false),
  ('leasing_agent','assign_leads',false),('leasing_agent','manage_commissions',false),
  ('sales_manager','see_own_data',true),('sales_manager','see_branch_data',true),('sales_manager','see_group_data',false),
  ('sales_manager','see_own_commission',true),('sales_manager','see_brokerage_commission',true),
  ('sales_manager','view_master_agreements',true),('sales_manager','manage_master_agreements',true),
  ('sales_manager','manage_users',false),('sales_manager','manage_settings',false),('sales_manager','manage_inventory',false),
  ('sales_manager','assign_leads',true),('sales_manager','manage_commissions',true),
  ('leasing_manager','see_own_data',true),('leasing_manager','see_branch_data',true),('leasing_manager','see_group_data',false),
  ('leasing_manager','see_own_commission',true),('leasing_manager','see_brokerage_commission',true),
  ('leasing_manager','view_master_agreements',true),('leasing_manager','manage_master_agreements',true),
  ('leasing_manager','manage_users',false),('leasing_manager','manage_settings',false),('leasing_manager','manage_inventory',false),
  ('leasing_manager','assign_leads',true),('leasing_manager','manage_commissions',true),
  ('admin','see_own_data',true),('admin','see_branch_data',true),('admin','see_group_data',false),
  ('admin','see_own_commission',true),('admin','see_brokerage_commission',true),
  ('admin','view_master_agreements',true),('admin','manage_master_agreements',true),
  ('admin','manage_users',true),('admin','manage_settings',true),('admin','manage_inventory',true),
  ('admin','assign_leads',true),('admin','manage_commissions',true),
  ('group_gm','see_own_data',true),('group_gm','see_branch_data',true),('group_gm','see_group_data',true),
  ('group_gm','see_own_commission',true),('group_gm','see_brokerage_commission',true),
  ('group_gm','view_master_agreements',true),('group_gm','manage_master_agreements',true),
  ('group_gm','manage_users',false),('group_gm','manage_settings',false),('group_gm','manage_inventory',false),
  ('group_gm','assign_leads',true),('group_gm','manage_commissions',true),
  ('viewer','see_own_data',true),('viewer','see_branch_data',false),('viewer','see_group_data',false),
  ('viewer','see_own_commission',false),('viewer','see_brokerage_commission',false),
  ('viewer','view_master_agreements',false),('viewer','manage_master_agreements',false),
  ('viewer','manage_users',false),('viewer','manage_settings',false),('viewer','manage_inventory',false),
  ('viewer','assign_leads',false),('viewer','manage_commissions',false)
) as m(role, capability, enabled)
on conflict (company_id, role, capability) do update set enabled = excluded.enabled;
