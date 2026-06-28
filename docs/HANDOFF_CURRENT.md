# HANDOFF — CURRENT RESUME POINT

**Last updated:** 30 Jun 2026 (Day 44 evening) — Commission Stages 1-4 shipped, BUT Layer B model
needs correction before Stage 5. START with the correction.
**Latest main commit:** (the EXPANDED correction doc commit)
**Safety tag:** pre-commission-model

## ⚠️ START HERE NEXT SESSION — READ docs/Commission_Model_Architecture.md FIRST
Specifically the two correction blocks at the END of that doc:
"STAGE 4 CORRECTION NEEDED" + "EXPANDED CORRECTION — Per-broker bracket = COMPLETE CYCLE".
Founder caught that Stage 4 shipped a plain 2-tier split (correct MATH, INCOMPLETE MODEL). The real
model is bigger and must be corrected BEFORE building Stage 5 UI.

## WHAT'S DONE (committed, build-verified)
- Stage 1 SCHEMA — 10 cols (companies/profiles/opportunities/pp_commission_invoices). Verified.
- Stage 2 LAYER A — company-default commission fallback (MA->company default->manual). 2a (97c9fce)
  + 2b Commission Defaults settings section, save-verified (fa6842f).
- Stage 3 VISIBILITY — both OpportunityDetail commission panels gated by canSeeCommission
  (c2bf956, a8e0650, 9782d66). Dialog field NOT gated (creation privileged). Stage 3 done.
- Stage 4 LAYER B (math only, INCOMPLETE model) — split resolution deal_override ?? agent_default;
  percentage|fixed; company_net; read-only display in Financials panel; both modes verified (c6d9140).
  ^ This is the part needing correction (see below).

## ⚠️ NEXT SESSION — STAGE 4 CORRECTION (before Stage 5)
The full corrected Layer B model (locked with founder):
- TIER 1 company-wide standard split — SETTINGS field (e.g. 20%). MISSING schema+UI.
- TIER 2 per-broker bracket — role/perf; SM MANUALLY advances w/ reason+audit. Storage built; the
  SET/ADVANCE/AUDIT cycle MISSING. Must be a COMPLETE working cycle, not a dead field.
- TIER 3 per-deal override — built.
- APPRECIATION BONUS (per-deal) — SM/Owner-only, additive, reason-mandatory, audited. MISSING entirely.
- AGENT VIEW = their money only (base+bonus total; never company margin). MISSING (Stage 7 + guarantee).
- EVERYTHING traceable+auditable WITH REASONS.

Sequence next session:
1. Update doc Layer B section to the 3-tier + bonus + agent-only-view + audit model.
2. Add schema: companies.default_agent_split_mode/value; opportunities.appreciation_bonus_mode/value/
   reason; bracket-change + bonus AUDIT LOG (reason-mandatory).
3. Correct Stage 4 resolution to full hierarchy + bonus; re-verify math.
4. THEN Stage 5 — config UIs (company-standard settings field; per-broker bracket set/advance screen
   with reason+audit; per-deal bonus control gated to SM/Owner with reason). Each gated, each logged.
5. Stage 6 invoice freeze; Stage 7 agent-facing money-only view; Stage 8 e2e verify both worlds.

## OTHER STICKY NOTES (in design doc)
- SM override commission (catalyst/mgmt cut on team deals) — build after core.
- ACL: admin operational-not-financial; target super_admin-only auto-pass (admin currently
  over-permissive but NOT leaky) — fix during correction or after.
- Property management revenue cycle — after-release Phase 2.

## DISCIPLINE
- npm run build before every commit; visual check UI; commit per stage; push always.
- Pay-math: DB-stored, DB-read, invoice=frozen authoritative; never alter company commission.
- ALL commission/bracket/bonus changes: reason-mandatory + audited (founder principle).
- Repo /d/prop-crm, branch main, MINGW64. supabase import "../../lib/supabase.js".
- Test opp for splits: 7490080c-de51-4ad2-818d-65085d7895e9 (reset to null/null).
