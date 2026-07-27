# FOUNDER'S SESSION PROCEDURE
Abid's own checklist. Written Day 76 so session-start no longer depends on memory or on
pasting old conversations.

## AT SESSION START - say exactly this
> "Read docs/PropCRM_Master_Context_and_Takeover.md (the head), then
>  docs/MASTER_PENDING_BOARD.md. Tell me where we stand and what is next."

Then STOP. Do not explain anything.
The architect must come back with: current state, what shipped last, what is outstanding.
- If it is RIGHT -> the documentation is working. Begin work.
- If it is WRONG or thin -> **the head is stale. Fix the head first.** That is the real finding.
DO NOT paste the previous conversation. If a paste is needed, the head has failed - and pasting
hides the failure instead of fixing it.

## DURING THE SESSION
YOURS to rule (architect defers): market reality, broker workflow, wording on screens, what is
worth building, when to stop, when to push.
ARCHITECT'S to decide: technical direction, sequencing, exact commands.
SAY "check the head / check the Decision_Log" whenever something already settled is reopened.
REFUSE any item recorded without being verified against repo or DB.
WATCH FOR: an architect APPENDING to the head instead of REWRITING it. That is how the last
handoff reached 137KB. Call it out immediately.

## AT SESSION CLOSE - three acts, in this order
1. **HEAD** - update only the sections that became untrue; re-date "Last verified against repo".
2. **BOARD** - move finished items to CLOSED with evidence; add new ones VERIFIED.
3. **LOG** - append what happened to HANDOFF_CURRENT.md.
Nothing is "done" until it is in the repo and pushed.

## THE TEST OF GOOD DOCUMENTATION
A stranger opens the head and can act correctly without Abid in the room.
If only Abid's memory keeps something alive, the documentation has failed.
