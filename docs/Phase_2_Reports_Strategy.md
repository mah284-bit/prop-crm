# Phase 2 — Reports Strategy (avoiding the report-builder graveyard)

**Captured:** Day 28. Founder: *"Reports is the most annoying part of any project.
Everyone wants their own. Should we let users build their own reports?"*

## Architect's position: DO NOT build a custom report builder
A user-facing report builder (field pickers, filters, grouping, save/share) is a
product inside the product — months of work, classic project graveyard. Building
a half one is worse than 5 good fixed ones. Avoid.

## The three-tier strategy (in order)

### Tier 1 — Strong FIXED reports + bulletproof EXCEL export  ← the real answer
PropCRM already has 5: Pipeline, Sales Payments, Agent Performance, Lead
Conversion, Tasks. Data + math work (verified Day 28). 
THE KEY INSIGHT: once data is in Excel, the broker builds ANY custom view
themselves (pivot/filter/chart). Excel IS the custom-report builder, and every
broker already knows it. So "let users make their own" = "give clean Excel exports."
This sidesteps the graveyard entirely.
**Action: make Export Excel + Export PDF actually work (currently not firing).**

### Tier 2 — Saved views (light, demand-driven, LATER)
Let users SAVE filter combinations on existing screens (e.g. "my Negotiation
deals >30 days"). NOT a builder — just persisted filters. Only if testers ask.

### Tier 3 — Full custom builder: only if market clearly demands + funded
Explicitly deferred. Revisit only with strong, repeated customer pull.

## Immediate work
1. Fix Export Excel (xlsx) on all 5 reports
2. Fix Export PDF on all 5 reports
3. Ensure exports include the full underlying rows (not just the summary), so
   Excel becomes the broker's own analysis surface.

## Why this is the right call
- Kills the #1 project-killer (report builder scope creep)
- Gives brokers real power (Excel) without us building a builder
- Small, finishable, shippable for testers next week

## Refinement (founder, Day 28) — the "small gateways" middle path
Founder pain (lived across many projects): every org LEVEL wants a different
perspective on the SAME data (CEO=portfolio rollup, manager=team perf,
broker=own pipeline). True fix = BI tool (Power BI/Tableau/Metabase), but
MID-MARKET WON'T PAY for or learn BI. That gap is PropCRM's opportunity.

The 80/20 middle path (NOT a full builder):
- On each EXISTING fixed report, add light "gateways":
  - Column show/hide toggles (pick which fields appear)
  - Filters (date range, agent, developer, stage, segment)
  - Then Export to Excel for anything deeper
- This gives "different perspectives" without building a report builder.
- Excel still = the final custom surface for power users.

Sequence: Tier 1 (working exports) FIRST. Column-toggle/filter gateways = a
light enhancement AFTER exports work and AFTER testers confirm demand.
Embedded-BI (later, premium tier) only if customers pull hard + will fund it.
