# Phase 2 — Coach Actions That Act-and-Return (Design)

**Captured:** Day 29. Part of inline-intelligence theme.
**Founder vision:** *"Click an action the broker can take, go to the exact place,
perform the act, and come back — a blast of a feature."*

## Key finding (navigation audit, Day 29)
The feared "rebuild all navigation" is NOT needed. Two separable layers:

1. SCREEN-level Back (opp -> origin): ALREADY context-aware.
   OpportunityDetail takes an `onBack` prop; each parent wires it correctly
   (Opportunities screen -> list; Leads screen -> lead detail). Works today.

2. INTRA-OPP return (Coach action -> do it -> back to Coach): the actual gap.
   Inside OpportunityDetail, `dashboardTab` controls the panel (proposals,
   coach, negotiations...). Coach lives at dashboardTab="coach". Action buttons
   need to: switch to the right place, let broker act, then return to "coach".

## Scope: small + contained (NOT a global nav-stack)
Add a lightweight "return tab" memory inside OpportunityDetail:
- When a Coach action fires, record `returnTab = "coach"`.
- Navigate to the action target (e.g. open proposal dialog, or switch
  dashboardTab to the relevant panel).
- On completion/close of that action, `setDashboardTab(returnTab)` -> lands
  back on Coach.

## The Coach actions to wire (from current Coach output)
- "Build proposal" / "Send V4" -> open proposal dialog -> on close, return to Coach
- "Schedule follow-up" -> open reminder/schedule dialog -> return to Coach
- "Mark as lost" -> stage action (confirm) -> return to Coach (or list if lost)
Each: act, then return to the Coach tab that launched it.

## Build plan (staged, low-risk)
Step 1: Add `returnTab` state to OpportunityDetail (default null).
Step 2: Wire ONE action end-to-end first ("Schedule follow-up" — simplest,
        opens a dialog, closes, return to coach). Test.
Step 3: Wire "Build proposal" (opens proposal dialog, saves new version,
        return to coach — the new version should also appear).
Step 4: Wire "Mark as lost" (confirm -> stage change -> onBack to list since
        the deal is closed).
Each step = its own commit + test. No big-bang.

## Why this is safe
- Doesn't touch the working screen-level onBack pattern.
- Purely additive: a return-tab memory + existing dialog/tab switches.
- Each action wired and tested independently.

## Risk
- Some Coach action buttons may currently be display-only (not wired at all).
  Verify each button's onClick before wiring return behavior.
- The proposal dialog is `requestProposalDialog()` (seen in proposals tab);
  reuse it, just add return-to-coach on close.
