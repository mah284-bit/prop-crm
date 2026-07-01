-- 1 Jul 2026 (Day 45) Stage D task 2: structurally enforce the identity invariant.
-- super_admin role REQUIRES is_super_admin=true (platform tier). Prevents any tenant from ever holding
-- super_admin — app bug, direct DB write, or malice all rejected by the database. Verified data clean
-- first (no super_admin with is_super_admin<>true). CHECK chosen over trigger: declarative, zero-cost,
-- self-documenting, unbypassable. Guards the security-relevant direction (tenant->super_admin escalation).
-- Guard PROVEN: attempting to set a tenant (is_super_admin=false) to super_admin is rejected by the DB.
alter table profiles
add constraint chk_superadmin_requires_platform_flag
check (role <> 'super_admin' or is_super_admin = true);
