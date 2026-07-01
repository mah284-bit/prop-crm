-- 1 Jul 2026 (Day 45) — Stage B harness found profiles RLS was DISABLED
-- profiles was the ONE tenant table with relrowsecurity=false: its (correct) select policy
-- (is_super_admin() OR company_id = my_company_id()) existed but was DORMANT, so every user
-- saw all 15 profiles across all companies. App-layer UI gating masked it, but a direct API
-- query leaked all users. Enabling RLS activates the existing correct policy.
-- Verified safe: all RLS helper functions (is_super_admin, my_company_id, has_capability,
-- is_admin_of) are SECURITY DEFINER, so they read profiles without recursive lockout.
-- Harness-verified: SoleBrokerUser profiles 15->1 (own only); platform owner still sees 15;
-- users can still read own row (login intact).
alter table profiles enable row level security;
