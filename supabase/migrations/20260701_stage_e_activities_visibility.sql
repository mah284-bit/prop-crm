-- 1 Jul 2026 (Day 45) Stage E: capability-driven visibility on activities (WHERE axis).
-- Activities have NO assigned_to (only company_id, lead_id, opportunity_id) — scoped via PARENT.
-- Was flat company-scoped (agent saw all 189). Now own/branch/group per doc:
--   see_branch_data (manager+) → all branch activities
--   see_group_data  (group GM) → cross-branch
--   see_own_data    (agent)    → activities on opps I own OR leads assigned to me
-- Cleaner-than-nested design chosen (own opps + own leads, not re-deriving full leads-visibility inline)
-- to avoid logic drift; starting tighter is safe (widening later is additive, not a leak). Doc principle:
-- start coarse/restrictive, refine later.
-- Harness-verified: agent 40 (own opps/leads), manager 189 (branch).
drop policy if exists activities_select_policy on activities;
create policy activities_select_policy on activities
for select using (
  is_super_admin()
  OR (
    company_id = my_company_id()
    AND (
      has_capability('see_branch_data')
      OR has_capability('see_group_data')
      OR (
        has_capability('see_own_data')
        AND (
          opportunity_id IN (SELECT id FROM opportunities WHERE assigned_to = auth.uid())
          OR lead_id IN (SELECT id FROM leads WHERE assigned_to = auth.uid())
        )
      )
    )
  )
);
