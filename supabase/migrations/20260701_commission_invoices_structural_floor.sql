-- 1 Jul 2026 (Day 45) Stage C: add A7 structural floor to pp_commission_invoices (crown jewel symmetry).
-- Previously config-only (has_capability('see_brokerage_commission')) — correct but single-lock. Added a
-- structural role-tier floor so agents are refused even if config is wrong (defense-in-depth, matching the
-- master-agreements fix). Allowed tier: admin, sales_manager, leasing_manager, group_gm, platform owner.
-- Both locks required (AND): structural floor = hard guarantee agents-never; config = tenant may further tighten.
create or replace function can_see_brokerage_commission()
returns boolean language sql security definer stable as $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND ( is_super_admin = true
            OR role IN ('admin','sales_manager','leasing_manager','group_gm') )
  );
$$;

drop policy if exists invoices_select_same_company on pp_commission_invoices;
create policy invoices_select_same_company on pp_commission_invoices
for select using (
  company_id = my_company_id()
  AND can_see_brokerage_commission()
  AND has_capability('see_brokerage_commission')
);
-- Harness-verified: agent 0 (refused), manager 10 (both locks pass).
