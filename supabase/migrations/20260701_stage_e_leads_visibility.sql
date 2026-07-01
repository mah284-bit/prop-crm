-- 1 Jul 2026 (Day 45) Stage E: capability-driven visibility on leads (WHERE axis).
-- Was flat company-scoped (agent saw all 25). Now own/branch/group per doc. Leads DIFFER from opps:
-- lead & opp assignment are decoupled (Phase 2.1 two-layer) — an agent works opps spun off from leads
-- owned by others (verified: all 8 of Rajesh's opps link to leads owned by others). So agent "own" leads =
-- directly assigned OR the lead behind one of my own opportunities (else opp detail shows blank buyer).
--   see_branch_data (manager+) → all branch leads
--   see_group_data  (group GM) → cross-branch
--   see_own_data    (agent)    → assigned_to=self OR id IN (leads behind my opps)
-- Harness-verified: agent 6 (6 distinct leads behind his 8 opps), manager 25 (branch). Tenant floor wraps.
drop policy if exists leads_select_policy on leads;
create policy leads_select_policy on leads
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
          assigned_to = auth.uid()
          OR id IN (SELECT lead_id FROM opportunities WHERE assigned_to = auth.uid())
        )
      )
    )
  )
);
