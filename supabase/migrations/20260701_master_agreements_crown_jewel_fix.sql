-- 1 Jul 2026 (Day 45) — Stage C: master-agreements crown-jewel fix (A5 hard rule + A7 defense-in-depth)
-- Harness (Stage B) found agents saw master agreements (Rajesh sales_agent saw 4, should see 0).
-- Three holes: (a) config granted view_master_agreements to agents/viewer; (b) a loose duplicate
-- SELECT policy "Tenants see own agreements" (company-match only) OR-bypassed the capability gate;
-- (c) no structural floor. Fixed with TWO independent locks per A7.

-- LOCK B (structural floor): role-tier function, correct role strings (NOT the phantom 'manager'
-- that broke is_admin_of). Refuses agents/viewer regardless of config.
create or replace function can_view_master_agreements()
returns boolean language sql security definer stable as $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND ( is_super_admin = true
            OR role IN ('admin','sales_manager','leasing_manager','group_gm') )
  );
$$;

-- Rewrite the SELECT policy to require structural floor AND company scope
drop policy if exists pp_master_agreements_select on pp_master_agreements;
create policy pp_master_agreements_select on pp_master_agreements
for select using (
  is_super_admin()
  OR ( company_id = my_company_id() AND can_view_master_agreements() )
);

-- Drop the loose bypass policy
drop policy if exists "Tenants see own agreements" on pp_master_agreements;

-- LOCK A (config hygiene): agents/viewer no longer claim the capability (both tenants)
update role_capabilities
set enabled = false
where capability = 'view_master_agreements'
  and role in ('sales_agent','leasing_agent','viewer');

-- Harness-verified: sales_agent 4->0 (via structural floor even before config lock),
-- sales_manager 4, admin 4, platform owner 5 (all companies), config aligned.
