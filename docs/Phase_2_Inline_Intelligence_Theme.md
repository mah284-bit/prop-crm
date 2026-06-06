# Phase 2 — Inline Intelligence (the "app that thinks" theme)

**Captured:** Day 28 (Sales completeness walk).
**Founder principle:** *"It's plain capture of intent — actions have to be performed
based on this. If we show hints/reminders that there are pending actions recorded
but not acted on, that's a real AI app. The Coach is probably bringing this data already."*

## The pattern (found twice, same root)
The app HOLDS rich data and the AI Coach can REASON over it — but the working
screens (Proposals, Negotiations) display it PASSIVELY. The intelligence is
trapped in the Coach tab instead of nudging the broker where they actually work.

### Instance 1 — Self-narrating proposals (see Phase_2_Self_Narrating_Proposals.md)
Proposal versions show prices but not WHY they changed. Coach already explains
the 3%-vs-5% gap. Surface that ON the version.

### Instance 2 — Negotiation rounds that nag
All 3 rounds on Shrikant AGR-09-05 are status=OPEN. R3 "Developer checking"
since 21 May (16+ days). The data screams "act on me" but the tab is passive.
Coach already flagged "developer checking, no resolution, 8 overdue reminders."

## The unifying idea — make working screens self-aware
Surface the intelligence INLINE, where the broker is looking, from data we
already have + Coach-style reasoning:
- Open negotiation rounds older than N days → visual nag / reminder ("R3 open 16 days")
- Proposals → auto "what changed & why" per version
- Stalled deals / overdue asks → surface on the deal, not just in Coach
- Pending-but-unacted items → gentle hints, badges, reminders

## Why it matters
This is the line between "a CRM that stores things" and "an app that thinks."
The reasoning already exists (Coach proves it). The work is PLUMBING it into the
working surfaces so the broker doesn't have to open Coach to discover what's urgent.

## Sequencing
Theme-level. Build incrementally:
1. Negotiation round age/nag (small, high value)
2. Self-narrating proposals (~1 day)
3. Broader inline nudges (deal-level stalled signals)
Do AFTER the completeness walk + after picking from the full gap map.

## Connection
- Phase_2_Self_Narrating_Proposals.md (instance 1)
- AI Coach (the reasoning engine already exists per-deal)
- Reminders system (overdue reminders already computed)

## Instance 3 — Coach actions that actually ACT (and return)
**Founder (Day 28):** *"If we allow the broker to click on the actions he can take,
take him to the exact place, perform the act, and come back — it would be a blast."*

Coach recommendations ALREADY render action buttons (Schedule follow-up, Build
proposal, Mark as lost). Need to verify which are truly wired end-to-end vs
display-only, then complete them so each button:
1. Navigates to the exact place (proposal builder pre-filled, reminder dialog, etc.)
2. Lets the broker perform the act
3. Returns to the Coach it launched from (needs context-aware Back — already a
   deferred item; this is why it matters)

This is the completion of the inline-intelligence theme: not just SHOW the
reasoning, but make every recommended action one click from done.
Connects to: AI Coach Clickable Results (backlog 2.10/2.11), context-aware Back.

## SHIPPED (Day 29)
- ✅ Self-narrating proposals (Part A+B) — commits dfbbbe7, 7d69dfa
- ✅ Negotiation-round nags — open rounds show age-scaled "open Nd — chase" badge.

## Observed workflow gap (Day 29) — open rounds never closed
The nags revealed R1/R2/R3 all still "Open" though superseded by later rounds/V4.
Brokers don't formally resolve old rounds when they deliver. Consider: auto-resolve
prior open rounds when a new proposal version addresses them, OR a one-click
"resolve round" action. The nag surfacing this is itself valuable. Capture for later.
