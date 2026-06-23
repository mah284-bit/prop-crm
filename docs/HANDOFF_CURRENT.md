# PropCRM — Live Handoff (resume point)
Last updated: 23 June 2026. Branch: main. Read this FIRST on any new session.

## TRUE CURRENT STATE (repo is truth; ignore any older "dev2 / June 5 demo / 14,900-line" notes)
- Branch: main (NOT dev2). Production: prop-crm-two.vercel.app (auto-deploys from main).
- App.jsx is ~2,866 lines — REFACTORED into src/components/<feature>/ folders + src/lib/ helpers.
- June 5 demo is PAST. Now working toward: WEEKEND TESTER HANDOFF.
- Founder Abid runs all terminal/git on Windows MINGW64; Claude gives exact commands.
- Founder cannot download files — deliver content via heredoc (cat > file << 'EOF').

## WHAT SHIPPED + WORKING ON PRODUCTION (this session)
1. AI-Extract Proposal -> Opportunity (LIVE, tested on prod):
   - api/extract-proposal.js — AI reads proposal PDF, extracts unit_ref + price + payment_plan + buyer.
   - "Promote to Opp" button on each proposal in ViewProposalsDialog (gold button).
   - Flow: ViewProposalsDialog -> QuickProposalsPanel (pass-through) -> LeadDetail handlePromoteProposal (brain).
   - Brain: extract -> match unit_ref to inventory unit -> availability check (Reserved/Sold warn,
     mirrors CreateOpportunityDialog line ~799) -> price from unit's salePricing -> open pre-filled
     CreateOpportunityDialog -> creates Opp. VERIFIED on prod with AGR-10-06.
   - Model fix: claude-sonnet-4-20250514 -> claude-sonnet-4-5 in BOTH extract-proposal.js AND
     validate-agreement.js (shared stale-model bug, was 404ing).

## IN PROGRESS RIGHT NOW (the V1 carry-over — mid-build)
GOAL: when promoting, carry the lead-proposal INTO the new Opp as its first proposal (V1, DRAFT).
Broker then prices/sends it FROM the Opp; versioning (V2,V3...) continues there. One send point.
DESIGN LOCKED: V1 status="draft", price from matched unit's asking_price, carries pdf_url +
extracted data in structured_data. Zero-value guarded (skip+warn if no price).

REUSE POLICY (founder insisted, correct): do NOT duplicate proposal-insert logic. The builder's
insert (ProposalBuilderDialog ~538-560) is tangled in a PDF/branding pipeline (risky to extract
whole pre-tester). DECISION: built a small shared helper instead:
  src/lib/createProposal.js -> insertProposalRecord(payload) + nextProposalVersion(oppId).
  Does ONLY the clean insert + schema-drift field-routing (KNOWN_JSONB_FIELDS). DONE, build-clean.

REMAINING STEPS:
  STEP 2: rewire ProposalBuilderDialog's insert (~538) to call insertProposalRecord — then TEST
          proposal-send still works (critical gate; builder is demo-critical, don't break it).
  STEP 3: in LeadDetail, add promotedProposal state; handlePromoteProposal stashes
          {pdf_url, extracted, unit_id, asking_price}; CreateOpportunityDialog onCreated (LeadDetail
          ~881) inserts V1 via insertProposalRecord (version 1, status draft, opportunity_id=newOpp.id,
          price from unit, structured_data.source="promoted_from_lead_proposal"). Zero-value guard.
  STEP 4: test V1 lands in Opp Proposals tab as draft; commit; push.

## PARKED / LOGGED (do not lose — all in docs/)
- Feature_AI_Proposal_To_Opp_BUILD_READY.md — the feature spec + multi-unit-promote idea (investor
  buyers may want >1 unit; build multi-select promote if brokers ask, post-test).
- Feature_Price_Integrity_BUILD_READY.md — warn (later block) on no-price OR no-payment-plan
  proposals at SEND time (Lead+Opp); no-price inventory report; dashboard flashing count of
  proposals/units missing price. Warn-now, hard-block after broker test.
- tester-package/ docs 00-04 (audit snapshot, built-vs-future, deferred-threads, nothing-pending,
  architecture). Remaining: Testing Plan + Tester Handout (need the deal-flow run first).
- #11 Group RLS enforcement: getVisibleCompanyIds primitive built+proven; GroupConsolidatedView
  live. Remaining: wire group-scope into ~43 company_id queries + the filterByCo filter, needs
  multi-branch test data built FIRST. Own session.
- Browser Back not synced to in-app nav (Phase 2 Nav-History) — known, documented for testers.

## METHOD NOTES
- Commit each gated piece, push every time (main). Tag golden checkpoints.
- Heredocs: NO triple-backtick code fences inside (breaks the terminal paste) — use indentation.
- Vercel serverless (/api/*) returns 404 on localhost — test those on the prod deploy.
- Golden tags so far: refactor-and-dashboard-day41, group-view-and-rls-foundation-day42.
