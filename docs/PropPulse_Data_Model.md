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
