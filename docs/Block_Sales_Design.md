# Block Sales — Design of Record
**Ratified:** 23 Jul 2026 (Day 72). Founder problem statement + architect execution.
**Riding on:** Day 65 capture (opp = deal atom), Day 67 wilderness Part 6 sketch.

## THE SPINE (stable forever — everything else is additive)
1. block_deals: parent entity. Buyer, developer/project context, block terms as
   ENTERED (pct or flat - the developer's language), status, company-scoped RLS.
2. block_deal_units: APPEND-ONLY event lines. Status lifecycle:
   proposed -> confirmed -> dropped -> re_allocated. Changes ADD rows/transitions,
   never overwrite. Drop-outs, staging, resale = new events on the same shape.
3. block_distributions: VERSIONED (D1, D2...) like proposals V1->V2. Each version =
   full allocation snapshot (unit line -> its exact discounted price). Any
   renegotiation/drop-out/swap = Dn+1. Audit-grade, schema never changes for it.
4. Children are ORDINARY OPPS: born at block confirmation via existing creation
   path, carrying their D_latest per-unit price + block_deal_id (one nullable
   column on opportunities - the ONLY touch on existing code). All machinery
   (ledger, gates, ceremony, SPA, commission, fieldset locks) works unchanged.

## DISTRIBUTION CEREMONY (ratified today)
Block terms entered as pct OR flat. System SUGGESTS pro-rata by list price.
Broker sees allocation table: every line, list price, suggested discount, EDITABLE.
Live footer: allocated vs block total, remainder highlighted. LOCKS at remainder=0.
(The honest-ledger discipline applied to distribution: total reconciles to lines,
variance visible until zero.)

## EVIDENCE MODEL (from wilderness Part 6)
Terms/KYC at BLOCK level. Money/SPA at UNIT level (DLD registers per-unit).
Commission per-unit, reports roll up.

## BUILD PLAN (each cut shippable alone, append-only on the last)
CUT 1: schema (3 tables + RLS + opportunities.block_deal_id nullable)
CUT 2: block creation UI (src/components/blockdeals/ feature folder)
CUT 3: distribution table ceremony (suggest/edit/remainder-lock)
CUT 4: confirm -> birth N child opps (existing path, D_latest prices)
CUT 5: block roll-up view (read-only aggregation of children)
CUT 6+: drop-out/re-allocation flows (Q2 - designed when reached; spine already
   holds them), bulk stage advance, portfolio view, resale angle.

## OPEN (parked, spine-safe)
- Q2 drop-out market flows (renegotiate remaining? developer hold window?) -
  founder input at Cut 6; ANY answer fits event-lines + Dn+1.
- Bulk inventory holds; staged handovers; Reseller intent wiring.

## CUT 4b - ADOPT-INTO-BLOCK (founder insight, 23 Jul during Cut 1)
Organic blocks: buyer with 2+ existing opps renegotiates as bulk. Convert flow: select
existing opps of same buyer -> block_deals parent created -> one line per opp
(status confirmed, child_opportunity_id back-ref) -> block_deal_id stamped on opps ->
distribution ceremony D1 over the adopted set (renegotiated terms flow down as amended
per-unit prices). Spine holds it unchanged - lines are agnostic to born vs adopted.
Guard: all opps must be same buyer + not closed. Sequenced after Cut 4.

## CUT 3 AMENDED - BIDIRECTIONAL DISTRIBUTION CALCULATOR (founder design, 23 Jul during Cut 2)
One screen, two entry doors, always reconciled:
- TOP-DOWN: block discount (pct or flat) -> pro-rata suggestion fills all lines.
- BOTTOM-UP: edit any line (per-unit pct or flat, MIXED modes allowed) -> block
  effective totals recompute live.
Per-line cost preview: list price, discount, net price, DLD/fees - the honest-ledger
preview per unit (broker sees what buyer actually pays).
LOCK at reconciliation -> FEED TO PROPOSAL: locked distribution becomes the block terms
document = E2 evidence at block level.
RENEGOTIATION: calculator reopens on D_latest, edits produce Dn+1 (spine versioning,
zero new machinery).
