# Sales UX Polish Backlog

Cosmetic / layout items found during the Sales completeness walk (Day 28).
These are NOT functional bugs — the workflows work. Batch these into one
dedicated UX polish pass rather than fixing piecemeal mid-walk.

## Open items

### 1. Lead detail — opps list buried at bottom
- On a lead with opps, the screen is full (header, contact, people, log-activity
  buttons) so the Opportunities(N) list at the bottom shows ~1 row and scrolling
  feels ineffective.
- Broker pain: the most actionable part of the lead (its deals) is hardest to see.
- Possible fixes: move opps list higher / make it a collapsible section / give it
  its own scroll area / compact the upper sections.
- Found: Day 28, testing Nadal Rafael with 2 opps.

### 2. AI Bubble (floating assistant circle, bottom-right) is in the way
- Fixed floating element overlaps content; founder wants it movable / repositioned
  / given room so it doesn't cover the work area.
- Possible fixes: make it draggable, dock it, add a minimize/collapse, or reposition.
- Found: Day 28.

## Deferred (bigger, already planned)
- Context-aware Back / navigation breadcrumb: Back from an opp should return to
  entry point (Lead detail vs Opportunities screen vs Dashboard). Touches every
  opp entry point — do as its own focused, fully-tested change. See workflow
  discussion Day 28.
