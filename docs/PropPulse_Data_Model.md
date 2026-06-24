# PropPulse — Data Model & Mechanism (evidenced 24 Jun 2026)

## What PropPulse IS
A pure DATA-AGGREGATION layer (NO AI decisioning lives here — interactive-AI ideas are app-internal
and separate). PropPulse keeps a curated set of UAE developer data current and feeds it into PropCRM
as the cross-tenant intelligence moat. It is a CHANGE-DETECTION layer over a FIXED developer set, not
an open discovery crawler. New developers are added deliberately (+ Developer), never by the agent.

## Mechanism (observed + SQL-evidenced via a live run, 24 Jun)
"Run AI Agent" sweeps the FIXED set of 20 registered developers one by one
("Checking 1/20: Aldar Properties..." ... 20/20), checking each developer's sources for new and
changed projects, then drops results into the VERIFY QUEUE for confirmation before they become
displayed/verified.

LIVE RUN DIFF (one run, measured):
  projects_total      134 -> 163   (+29 NEW projects created today)
  projects updated     —  -> 53    (53 existing projects refreshed today)
  agent_jobs_total    177 -> 197   (+20 = exactly one logged job per developer in the fixed set)
  verify_queue (UI)    84 -> 100   (+16 items queued for verification)
  units_total         110 -> 110   (unchanged — this run pulled PROJECT-level data, not new units)
  developers           20 -> 20    (fixed set — agent never grows it)

CONFIRMED CLAIM (evidence-backed, safe to pitch):
  A single run BRINGS NEW projects (29) AND UPDATES existing ones (53), sweeping all 20 developers.
  PRECISION: the claim is about PROJECT / developer-level data. Unit-level inventory is a separate
  import depth (units stayed 110 this run). State it precisely so the claim is bulletproof.

## UI count vs table count (important nuance)
UI header "Projects" (e.g. 36-38) = the VERIFIED/DISPLAYED set. The projects TABLE (134/163) = ALL
ingested incl. unverified. The Verify Queue (84/100) holds ingested-but-unverified items. So:
displayed + verify-queue ≈ table total. The number depends on WHERE you look; document both.

## Data flow: PropPulse -> tenant inventory -> broker
1. PropPulse repository = GLOBAL pool (all ingested data, 20 fixed developers). Belongs to platform.
2. "Import to my inventory" (from a tenant e.g. Al Mansoori): tenant SELECTS specific units/projects
   OR does a COMPLETE import -> copies into THEIR inventory (creates unit_sale_pricing rows stamped
   with their company_id). Price VALUE is developer-sourced; the ROW is the tenant's selling-inventory
   copy (this is exactly why reset WIPES unit_sale/lease_pricing — re-import regenerates them).
3. Until imported AND assigned, data sits in the app repository UNASSIGNED to any broker.
   Flow = PropPulse (global) -> Import (tenant copy) -> Assign (broker working set).

## GOVERNANCE DECISIONS (24 Jun)
1. RUN AI AGENT = PLATFORM-OPERATOR ONLY (not a tenant capability). Reason: each run = 20 developers
   x source checks x AI tokens = real infra + API cost. If every company runs it freely -> runaway
   cost. Companies CONSUME PropPulse data; they do NOT trigger the expensive aggregation. Ties to the
   Multi-Tenant Identity Model (Platform Operator owns PropPulse).
2. VERIFY QUEUE = PLATFORM-OPERATOR responsibility (PropPulse quality is the PRODUCT/moat, not the
   tenant's job; a tenant verifying could bias data toward self-interest). HOW to trust verification:
   each queue item must be checked against SOURCE EVIDENCE (RERA / DLD / developer site). OPEN DESIGN
   ITEM: surface the source link/evidence beside each queue item so verification = "check against
   evidence", not "guess". (Verification UX = build-phase design.)
3. IMPORT = tenant self-service (select or complete import); creates tenant-scoped pricing copies;
   unassigned until a broker is assigned the inventory.

## Status
Mechanism CONFIRMED with live SQL evidence (24 Jun). Governance decided. Verification-UX (source
evidence beside queue items) = open build-phase design item. Agent-run access control (platform-only)
= build-phase enforcement (today founder runs it as super_admin/platform during testing).

## VERIFICATION — how it works today + forward design (evidenced 24 Jun, schema + live queue + data dump)
PROVENANCE ALREADY IN SCHEMA (projects table): is_pp_verified (bool), pp_data_source (e.g.
"ai_agent_v2"), pp_confidence_score (int %), pp_source_id (uuid), pp_last_updated, plus
rera_project_no + dld_project_no + website_url. So the BASIS for verification already exists in data
— we need a POLICY on top, not new ingestion.

TODAY (observed live): AI discovers -> assigns confidence (seen 72%-98%) -> EVERYTHING queues for
MANUAL ✓Verify/✗Reject ("Review AI-discovered projects before publishing to the PropPulse catalog").
Currently pure-manual with confidence as a hint. Queue = platform responsibility (confirmed).

CONFIDENCE CORRELATES WITH COMPLETENESS (from the dump): 95-98% items carry specific verifiable facts
(contract values, exact unit counts, RERA-style detail); 72-80% items are vague (no price/units, soft
descriptions). So confidence is a usable quality signal.

FORWARD VERIFICATION POLICY (tiered, uses fields we ALREADY have — scales + keeps trust, same GIGO
discipline as commission):
  1. AUTO-VERIFY candidate: confidence >= 90% AND corroboration (rera_project_no OR dld_project_no OR
     website_url present). Strong evidence -> low-risk auto-publish.
  2. MANUAL REVIEW (human): confidence 75-90%, OR missing RERA/DLD number. Human checks dev site,
     verify/reject. Human effort concentrates HERE.
  3. HOLD / likely-reject: confidence < 75% OR no price/units/registration. Real scrutiny or reject.
  4. DEDUP CHECK (the BIGGER quality risk — caught in the dump): agent RE-PULLS same project under
     near-duplicate names each run (e.g. "Island B Infrastructure" x4 variants; "The Acres New Phase"
     x6; "Affordable Housing Baniyas & MBZ" x5). So 134->163 (+29) is partly near-dups, NOT all truly
     new. Before queueing, fuzzy-match name+developer+community against existing catalog -> flag likely
     dups for MERGE, not treat as new. Verification's real job = "is it NEW + true", not just "true".

FUTURE UPGRADE (parked): when govt-site (RERA/DLD) integration lands, step 1 upgrades from "has a RERA
number" to "RERA number VALIDATED against registry" — policy improves without redesign. This is the
authoritative-source basis we want long-term.

WHO: verification = PLATFORM responsibility (PropPulse quality is the product/moat). Tenants consume,
do not verify. Audit each verify/reject (who, when, confidence-at-decision).

## FUTURE DEDICATED SESSION — open items checklist (capture 24 Jun, do PRE-LIVE)
PropPulse is a serious selling point -> no blind spots allowed. Parked for a focused session:
1. DEDUP ENGINE (known new-routine artifact): agent re-pulls same project under near-dup names. Build
   fuzzy-match (name+developer+community) -> merge-not-duplicate. Decide canonical-name rule. Highest
   priority — it inflates counts + pollutes the catalog.
2. TIERED VERIFICATION build (per policy above): auto-verify >=90%+RERA/DLD; manual 75-90%; hold <75%.
3. STALE-DATA decay: a project verified once can go out of date (price changes, status moves
   Announced->Under Construction->Completed). Need a re-check / freshness flag (pp_last_updated exists
   — use it to surface "verified but old" items for re-verification).
4. SOURCE TRANSPARENCY: surface pp_source_id / website_url beside each queue item so a human verifies
   against evidence, not memory. (Investor question "how do you know it's real?" answered by showing
   the source.)
5. CONFLICTING PULLS: same project, two runs, different facts (price/units/handover differ). Define
   which wins (newest? highest-confidence? human-decides?). Audit the change.
6. COVERAGE GAPS: agent only sweeps 20 FIXED developers. Define how/when new developers get added
   (manual +Developer today). A "missing developer" = a coverage hole in the selling point.
7. UNIT-LEVEL depth: runs bring PROJECT data; units lag (110 flat). Decide if/when unit-level
   ingestion is needed (affects "import inventory" richness).
8. COST/CADENCE tuning: use before/after diff data to set the right scheduled-run period (slow-
   announcement market -> maybe monthly enough; tune with real deltas).
9. REJECT LEARNING: when a human rejects an item, can the agent learn (avoid re-pulling rejected
   items each run)? Otherwise rejected dups keep returning.
STATUS: PropPulse mechanism + governance + verification basis CAPTURED (24 Jun). Above = the focused
build/design backlog for a dedicated PropPulse session, all PRE-LIVE. Closing PropPulse capture here.
