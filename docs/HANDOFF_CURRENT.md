# PropCRM — Live Handoff (resume point)
Last updated: 23 June 2026. Branch: main. Read this FIRST on any new session.

## TRUE CURRENT STATE (repo is truth)
- Branch: main. Production: prop-crm-two.vercel.app (auto-deploys from main).
- App.jsx ~2,866 lines, refactored into src/components/<feature>/ + src/lib/ helpers.
- June 5 demo PAST. Target: WEEKEND TESTER HANDOFF.
- Latest commit: 88b2523. Golden tag: lead-quote-and-opp-gate-day43.

## SHIPPED + VERIFIED ON PROD (this session, all committed/pushed)
1. V1 carry-over: promote a lead Quote -> creates Opp + carries it in as V1 (draft, carries PDF).
   Builder insert now routes through shared src/lib/createProposal.js (insertProposalRecord +
   nextProposalVersion). One write point, no duplication.
2. Lead-send LOCK: once a lead has an Opp, lead-stage "Send Quote" is replaced by a lock message.
3. "+ New Opportunity" GATE: locked on a lead that already has an Opp (shows "add units from the
   Opp" hint). Additional investor units = created from the Opp side. New-lead path stays open.
4. PRICE-STAMP fix: UnitPickerMulti now stamps real price (from pricingMap) onto selected units —
   killed the AED 0 bug in quick-quote review + units_quoted + V1 carry-over.
5. NAMING: lead-stage UI = "Quote", opp-stage UI = "Proposal". UI-LABEL-ONLY divergence; table/code
   stay "proposals". Documented in docs/Naming_Lead_Quote_vs_Opp_Proposal.md. Opp side verified
   still says "Proposal" (no leak). Labels: Quick Quote / Send Quote / View Quotes / lock message.

## PARKED / LOGGED (do not lose — backlog for next sessions)
- ORPHAN CLEANUP: test runs left orphan proposals/activities + a deleted-PDF reference (Ramu Kaka).
  Needs a focused cleanup pass (find records with no valid parent).
- PATH B (naming consistency): post-tester, add a stage/is_quote signal so code+data agree with the
  UI. Removes the permanent "UI says Quote, code says proposal" trap. See Naming doc tail.
- MULTI-UNIT PROMOTE: quick quote allows multiple units; promote handles ONE (Option 1 = unit-picker
  on promote when >1). Build only if brokers ask. Logged in Feature_AI_Proposal_To_Opp_BUILD_READY.md.
- PRICE INTEGRITY: warn-now / hard-block-later on no-price proposals; dashboard flash-count of
  unpriced proposals/units; no-price inventory report. See Feature_Price_Integrity_BUILD_READY.md.
- CORS external image: PDF hero image from aldar.com blocked by CORS (non-fatal, PDF still builds).
  Phase 2 polish: proxy/pre-cache external images.
- quickProposalFlow_old.js orphan twin — delete in cleanup pass.
- Browser Back not synced to in-app nav (Phase 2 Nav-History) — known, documented for testers.

## METHOD NOTES
- Commit each gated piece, push every time (main), tag golden checkpoints.
- Heredocs: NO triple-backtick fences inside — indentation only.
- Vercel serverless (/api/*) 404s on localhost — test those on prod.
- DEPLOY CACHE: after a prod deploy, fully CLOSE + REOPEN incognito (hard-refresh alone can serve a
  stale bundle). Cost us a phantom "AED 0 still showing" chase this session.
- Golden tags: refactor-and-dashboard-day41, group-view-and-rls-foundation-day42,
  lead-quote-and-opp-gate-day43.

## BACKLOG ADD (logged 23 Jun, end of session) — V1 carry-over net price shows "—"
On a promoted Quote, the Opp Proposals row shows V1 with Discount 0% but Net Price / Plan / DLD as "—".
ROOT CAUSE (confirmed in LeadDetail.jsx ~903-922): the V1 carry-over insert writes asking_price +
status:"draft" but does NOT write discount_pct or discounted_price. The Opp table reads
discounted_price for Net Price, so it renders blank.
FOUNDER RULE: 0% discount is VALID (means full price) and must never blank the line — Net Price should
compute from asking (net = asking when discount is 0). Plan/DLD blanks are legitimately "not entered
yet" for a fresh draft V1 — only Net Price is the real gap.
FIX (next session, small): stamp discount_pct:0 + discounted_price:v1price on the V1 insert so Net Price
shows asking. Status stays draft. Test on prod, commit.

## RESOLVED 23 Jun PM — V1 carry-over net price now renders
Root cause was TWO things: (1) proposals table has NO discounted_price column (schema drift) and
(2) the Opp table reads ONLY structured_data (sd.total_value || proposal_units[0].discounted_price),
never top-level fields. Fix (commit 6a0a930): V1 carry-over now writes total_value + discount_pct +
proposal_units[] into structured_data, matching the builder's shape. VERIFIED on prod with a FRESH
promote (AGR-07-03): Net Price AED 1,670,660, Discount 0%, Commission 5%. Plan/DLD stay blank by
design (broker sets when pricing). Old pre-fix rows (e.g. AGR-11-07) still show — and can be ignored
or cleaned in the orphan-cleanup pass.
LESSON: when a display value is missing, read the actual DB row + the display code's field path
BEFORE patching — three blind patches were avoidable by checking schema first.
