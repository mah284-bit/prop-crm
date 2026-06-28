# PropCRM - Current Handoff (resume point)
_Last updated: 28 Jun 2026 (Day 43)_

## WHERE WE ARE: Commission Model - agent tier DONE through Stage 5b

The Commission Model (the revenue heart) is built in stages. Agent-level tier is complete:

### DONE + committed + tested
- Correction (3-tier + bonus model): Layer A (company-developer) + Layer B (company-agent:
  company-standard -> broker-bracket -> deal-override, + appreciation bonus). Resolution + display
  verified via SQL on Shrikant opp (7490080c). Commits 9c2675a, b7b9236.
- Stage 5a - company standard capture: Settings > Commission Defaults captures BOTH company
  revenue pct AND agent-split house standard (mode + value). Commit 5f3a0a6.
- Stage 5b - Agentwise Commission Breakup (the living cycle): Settings section (renamed from
  "Agent Brackets"). Per-agent rate that OVERRIDES the house standard. Complete cycle:
  SET (UI) -> FLOOR GATE (bracket >= company standard; inherits company single mode pct or fixed;
  live above/below hint; no-standard-set blocks setting) -> REASON forced -> AUDIT (commission_audit_log,
  RLS-secured, fatal-if-audit-fails) -> CALC flows to opportunity -> RATE HISTORY visible in dialog
  (from->to + reason + date). Commits a2c5790, 42e0a43. Tested end-to-end (34/35 blocked, 35.5 saved,
  history renders, audit rows confirmed).
- HEAD = 7413950. Tree clean. All pushed to main.

### Tables/columns (all live in Supabase)
- companies: default_commission_pct, default_agent_split_mode, default_agent_split_value
- profiles: commission_split_mode, commission_split_value
- opportunities: agent_split_mode, agent_split_value, appreciation_bonus_mode/value/reason
- pp_commission_invoices: agent_id, agent_split_mode/value, agent_commission, company_net
- commission_audit_log (NEW table, RLS insert+select policies added - company_id scoped via profiles)

## NEXT: Stage 5c - per-deal bonus + override ON THE OPPORTUNITY
SM-only, capability-gated, mandatory reason -> commission_audit_log (action bonus_grant / deal_override).
The opportunity already has the schema (appreciation_bonus_*, agent_split_* override). Stage 5c builds
the UI to SET them per-deal in OpportunityDetail Financials (resolution + display already read them).

## THEN: Stage 6 (invoice freeze - extend SPA-signed auto-invoice ~OppDetail 787-836 to freeze
agent_commission + company_net), Stage 7 (agent-facing money-only view), Stage 8 (verify both worlds).

## PARKED (sticky notes in docs/Commission_Model_Architecture.md - read before resuming)
- Management Commission Hierarchy (broker-manager-group rollup; needs ORG REPORTING TREE first; pure
  Sales not ERP; dedicated future phase) - the big one.
- SM/Admin direct-earning eligibility (earning=assignment not role; reconcile w/ ACL + SM-override).
- Mixed top-up (fixed kicker on pct base, e.g. +10K/sale negotiation) - standing per-agent bonus, design
  after seeing response.
- ACL refinement (canSeeCommission: change auto-pass from [admin,super_admin] to [super_admin] only).
- Movable commission dialogs (UX polish).
- Property management revenue cycle (after-release Phase 2).

## OPERATIONAL NOTES
- Repo /d/prop-crm, Windows MINGW64, branch main -> prop-crm-two.vercel.app
- File delivery: heredoc cat > / Python scripts (abort-safe). Arrows/special chars jam heredocs - use Python.
- supabase import: "../../lib/supabase.js"
- Vite stale-module "no default export" after full-file rewrite -> clears on incognito/fresh load.
- commission_audit_log: any new tenant table needs RLS insert+select policies (company_id via profiles).
- Tags: pre-commission-model, pre-commission-correction, commission-agent-tier-5b-day43 (golden).
- npm run build before every commit. One cut, one visual check. No half-built commits.
