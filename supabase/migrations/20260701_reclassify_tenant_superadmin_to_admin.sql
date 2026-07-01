-- 1 Jul 2026 (Day 45) Stage D task 1: reclassify the lone tenant super_admin to admin.
-- Enforces the Stage D invariant: super_admin role = PLATFORM tier only (is_super_admin=true).
-- SoleBrokerUser was super_admin/is_super_admin=false (tenant owner of solo Sole Broker Test) — the last
-- tenant holding super_admin. Reclassified to admin (tenant-top role; full company visibility = everything
-- a solo broker needs; zero platform reach). Guarded WHERE ensures only the intended user is touched.
-- Verified: invariant now holds (only mah284 is super_admin/true); SoleBrokerUser as admin sees own
-- company fully (companies 1, leads 1), zero cross-tenant.
update profiles
set role = 'admin'
where id = 'f85784c9-8cb4-4449-9dcc-54d1210a8521'
  and role = 'super_admin'
  and is_super_admin = false;
