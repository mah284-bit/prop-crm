-- 1 Jul 2026 (Day 45) Stage C task 2: drop retired-name capability rows (superseded by canonical seed).
-- Verified first: NO live RLS policy references these names (pg_policies check returned no rows).
-- Removed: see_own_opportunities_only, see_team_opportunities, see_all_opportunities, see_agent_commission_split.
-- Result: role_capabilities now holds exactly the 12 canonical caps, uniform 49 rows each (7 roles x 7 companies).
delete from role_capabilities
where capability in (
  'see_own_opportunities_only',
  'see_team_opportunities',
  'see_all_opportunities',
  'see_agent_commission_split'
);
