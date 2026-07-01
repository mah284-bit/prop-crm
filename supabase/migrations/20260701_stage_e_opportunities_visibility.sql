-- 1 Jul 2026 (Day 45) Stage E: capability-driven visibility on opportunities (WHERE axis).
-- Was flat: is_super_admin() OR company_id=my_company_id() → every user saw ALL company opps (agent leak,
-- masked only at app layer). Now capability-driven per doc: own/branch/group scopes, no hard-coded roles.
--   see_branch_data (manager+)  → all branch opps
--   see_group_data  (group GM)  → cross-branch (group)
--   see_own_data    (agent)     → only assigned_to = self
-- Broker-visibility is thus CONFIGURABLE (grant see_branch_data to widen an agent). Tenant floor
-- (company_id) always wraps. Harness-verified: agent 8 (own), manager 38 (branch), cross-tenant 0.
drop policy if exists opportunities_select_policy on opportunities;
create policy opportunities_select_policy on opportunities
for select using (
  is_super_admin()
  OR (
    company_id = my_company_id()
    AND (
      has_capability('see_branch_data')
      OR has_capability('see_group_data')
      OR (has_capability('see_own_data') AND assigned_to = auth.uid())
    )
  )
);
