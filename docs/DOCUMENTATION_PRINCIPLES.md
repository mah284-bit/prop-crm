# DOCUMENTATION PRINCIPLES - PropCRM
Ratified Day 76 (26 Jul 2026) by founder after a live failure: the architect began writing a
go-live section from scratch while docs/Go_Live_Readiness_Register.md already held 286 verified
lines on exactly that subject. Cause: the HANDOFF carried no pointer to it. An incomplete
handoff does not merely omit - IT STEERS THE PROJECT WRONG.

## THE SIX RULES
1. SINGLE SOURCE OF TRUTH PER SUBJECT. One document owns a topic. Others POINT at it. Never
   duplicate a subject across documents.
2. LIVING vs HISTORICAL, KEPT SEPARATE. A running/state document says WHERE THINGS STAND and is
   REWRITTEN. A log says WHAT HAPPENED and is APPENDED. Mixing them produces an unreadable
   append-only pile that only a human witness can interpret.
3. VERIFY BEFORE RECORDING. Nothing enters a state document unchecked against repo and DB.
   However small the item. A wrong entry is WORSE than a missing one - it misdirects.
4. EVERY ITEM TRACEABLE. Source, evidence that closed it, or current state and why it is open.
5. RECONCILE BEFORE CREATING. Before writing any new document or section, check what already
   exists. Reconciliation first, creation second.
6. FRESHNESS IS VISIBLE. Every state document carries "Last verified against repo: <date>".
   Staleness must announce itself, never hide.

## FOUNDER'S STANDING INSTRUCTION
"Do not depend on my memory." If the only thing keeping a decision alive is the founder's recall,
the documentation has failed. The measure of a good state document: a stranger could act on it
correctly without the founder in the room.

## WHY IT MATTERS (founder, Day 76)
Four months, 91 working days, 1,432 commits. A backlog that is endless and foggy erodes the will
to finish. Documentation that tells the truth is what keeps the end in sight.
