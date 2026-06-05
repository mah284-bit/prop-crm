# ✅ PART A SHIPPED (Day 28) — version diff line live. Part B (link notes/negos by timestamp) = next.

# Phase 2 — Self-Narrating Proposal Versions

**Captured:** Day 28 (Sales completeness walk, Proposals tab)
**Founder principle:** *"if we have to give a text field to enter the reason again
then broker will say excel is better. The data is already there — history should speak."*

## The gap
Proposal versions (V1, V2, V3) show prices/terms but NOT why they changed.
The reason lives scattered across notes + negotiation rounds + DLD/plan changes.
A broker viewing proposals is "blank" — has to investigate to reconstruct the story.

## The principle (founder)
Do NOT add a manual "reason for change" field — that's duplicate data entry and
makes the app no better than Excel. The app ALREADY HOLDS the data (notes,
negotiations, version-to-version differences). It should ASSEMBLE the narrative
itself. The history should speak.

## The feature — auto-assembled "what changed & why" per version
Two parts, both derived (zero re-entry):

1. WHAT CHANGED (version diff): compare each version to its predecessor across
   ALL fields — discount %, net price, payment plan (e.g. 20/80 → 30/70),
   DLD handling (buyer → split → waiver), booking %, etc. Show the delta.

2. WHY (context linking): pull the notes + negotiation rounds that fall in time
   BETWEEN the previous version and this one (timestamps already exist) and
   attach them to the version they produced.
   e.g. "Buyer asked 5% + full DLD waiver (19 May) → developer countered."

Result: each version self-explains. Latest proposal tells its own story.
"V3 (3% off, DLD split 50/50, 30/70 plan) — after buyer pushed 5% + waiver;
developer met partway."

## Why it matters
- Strengthens the exact thing Proposals is pitched on (audit trail / nego history)
- Makes a returning broker / a broker inheriting a deal instantly oriented
- This is what makes the feature REAL vs cosmetic — Excel can't do this
- Signature feature if built well; half-baked if rushed

## Connection
- Builds on Phase_2_Proposal_Communication_Model.md (Brahma Lipi)
- Uses existing data: proposals (versioned), activities (notes), negotiation rounds
- No new manual input. Diff + time-window linking + display.

## Effort (rough)
- Version-diff logic: compare adjacent versions across fields
- Time-window activity linking: notes/negos between version timestamps
- Display: a "what changed & why" block on each version (esp. latest)
- Estimate: ~1 focused day (build), worth doing properly not rushed
