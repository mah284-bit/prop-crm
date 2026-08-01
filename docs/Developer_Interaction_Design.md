# THE DEVELOPER SIDE - CLOSING THE LOOP (design of record, Day 81)

## THE GAP (founder, felt for some time, never raised until now)
"Interaction with the developer is missing for the deal - I have not mentioned it before because
the BUYER side was more important and I thought this could come later."
The app records OUTCOMES - money received, terms agreed, an approval reference - but not the WORK
that produced them. On the developer side it holds a NAME and an APPROVAL REFERENCE STRING and
nothing else. A block IS a negotiation with a developer; none of that negotiation is anywhere.

## THE CONSTRAINT (founder, and it is the important part)
"Not too many things like you have to run a CRM." NOT a developer CRM. NOT a developer login. NOT
a two-party workflow. Everything happens IN THE BROKER'S PRESENCE - at the developer's office, in
a meeting - and he takes away the documents and makes his own recording. So the app records what
he WITNESSED, exactly as it does for the buyer.

## THE SHAPE - THREE SMALL PIECES
1. **THE QUESTION.** A buyer asks something the broker cannot answer - service charge, handover
   date, payment flexibility, a specific unit's view. He logs it against the deal or the block:
   the question, who he will ask, when he needs it by. It stands OPEN.
2. **THE ANSWER.** The developer replies - call, meeting, email. The broker records the answer and
   the question closes. The deal now carries "buyer asked X, developer said Y on the 3rd", which
   is what he needs when the buyer rings back a week later.
3. **THE NUDGE.** An open question with a needed-by date appears in his reminders - the SAME
   mechanism as any other follow-up. No approval chain, no new machinery.

## WHY THIS SHAPE AND NOT MORE
It is ONE entity - an open question with an answer - hanging off the activity system that already
exists. It does not model the developer as a USER, which is where it would balloon into the
developer persona (a separate, already-captured piece of work).

## WHAT THE MANAGER GETS (founder, and it justifies the feature on its own)
"Even the manager knows the broker is not just talking to the buyer but following up also, and
where needed he may have to go for meetings sometimes WITH the broker."
Today a manager sees money and stages - nothing shows that the broker chased the developer four
times. The effort is INVISIBLE, so "he is only talking to the buyer" is the impression. Open
questions with dates make the developer-side work visible, and tell the manager when to step in
himself: three unanswered for a week is a signal he should attend the next meeting.

## OPEN
- Does the question hang off the OPPORTUNITY, the BLOCK, or either? (Probably either - a block
  question is about the arrangement; a unit question is about one deal.)
- Does it need a developer CONTACT (a person at the developer), or is a free-text "who" enough
  for now? Free text is the smaller start.
