-- 1 Jul 2026 (Day 45) Stage C: fix profiles UPDATE policy off the broken is_admin_of function.
-- is_admin_of checked role IN ('admin','manager') but there is NO 'manager' role (it's sales_manager/
-- leasing_manager) — phantom-role bug, silently denied all managers. Replaced with capability check:
-- company_id = my_company_id() AND has_capability('manage_users'). Trusts config, not hard-coded roles.
-- Per doc A2, user management = admin (manage_users seeded admin-only), so this is the correct intent
-- (the old policy's inclusion of the phantom 'manager' was itself the bug).
-- Harness-verified: agent updating others 0 (blocked); admin updating company profile 1 (works — bug fixed);
-- agent updating own row 1 (self-edit intact).
drop policy if exists profiles_update_policy on profiles;
create policy profiles_update_policy on profiles
for update
using (
  is_super_admin() OR (id = auth.uid())
  OR (company_id = my_company_id() AND has_capability('manage_users'))
)
with check (
  is_super_admin() OR (id = auth.uid())
  OR (company_id = my_company_id() AND has_capability('manage_users'))
);
