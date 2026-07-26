# Block Sales - Cut 7: Block Money Allocation
**Ratified:** 25 Jul 2026 (Day 74). Founder rulings + design-of-record line 27.

## DOCTRINE (settled, not re-openable)
Design of record: "Terms/KYC at BLOCK level. Money/SPA at UNIT level (DLD registers
per-unit)." Wilderness Part 6: "money can land at block and allocate down."
FOUNDER RULING (25 Jul): the BLOCK is the operating surface - money arrives at block,
distributes to members, block operations run from the block. Broker never opens a child
to record block money. But money LANDS at unit level: each member gets its own
reservation, its own SPA, its own DLD registration, its own commission invoice.
Block = operating surface. Unit = surface of record. Both halves of line 27.

## WHAT THE MONEY IS (money-tail sec 5)
Reservation fee = FIXED amount per developer (not pct), configured at developer/MA level,
pickable at reserve-time, broker may adjust. Nature: an ADVANCE - credited into the first
payment as the deal proceeds; forfeit/refund per developer policy on cancellation only.
Booking (immediate, non-refundable hold) and Reservation (formal hold) are TWO products,
both crediting toward initial advance. Serious money with legal consequence - an allocation
is a LEGAL SPLIT, not an accounting convenience.

## FOUR RULINGS (founder, 25 Jul)
1. ONE PARTICULAR per payment event. Mixed lump = two events. No fee-type ceiling.
2. Suggestion basis = each member's OUTSTANDING expected amount for that particular
   (reservation fees are fixed per developer, so N members x fixed = exact; pro-rata
   applies only when the wire is SHORT). Fully-satisfied member shows zero WITH REASON,
   never a silent 0.
3. NO developer-approval gate. Day-73 developer-authority covers TERMS changes; money-in
   is not a terms change. Record obligations stand (ref, mode, date, audit) - testimony,
   not permission.
4. Allocations are AMENDABLE with reason (three-verb grammar), not frozen at lock.

## THE CEREMONY
Entry: Record Payment action on Block Workspace header.
Bank line: particular, amount, mode, reference, received date.
Member table: each child - unit ref, expected for this particular, already received,
still owed, ALLOCATE (editable). Satisfied members greyed with reason shown.
Footer: Remainder - green at zero, red otherwise. Lock DISABLED until remainder = 0.
(Honest-ledger discipline, same as the distribution calculator: total reconciles to
lines, variance visible until zero.)

## ON LOCK (all-or-nothing, same guard shape as Cut 4 birth engine)
Per member, in one transaction:
- reservation stamped on the opp (reservation_amount/date/method/cheque_no) - the
  mainstream Reserve capture, fired from the block
- stage -> Reserved; unit Booked -> Reserved (moveStage writes status unconditionally)
- allocation row written (block_payment_allocations)
- activity logged: allocated from block payment, ref, amount, who
Any member failing = whole lock rolls back. No partial ceremonies.
NOTE: this satisfies Cut 6a Booking Clock - the clock waits on exactly this event.

## AMEND
Find allocations by block_payment_id -> reverse -> re-split -> mandatory reason ->
audit line. Members already past Reserved keep their stage (money paid is money paid,
Part 4 doctrine); only the split record changes.

## SCHEMA
LIVE (Cut 7-1, 25 Jul):
  block_payments - the bank line. id, block_deal_id, company_id, milestone, amount,
  payment_type, reference, received_date, notes, status, created_by, created_at. RLS
  company-scoped (select/insert/update).
TO ADD (Cut 7-2):
  block_payment_allocations - id, block_payment_id, opportunity_id, amount, company_id,
  created_by, created_at. RLS company-scoped. This is what makes the split queryable
  and Amend-able.
UNUSED / DOCUMENTED ERROR:
  sales_payments.block_payment_id was added Cut 7-1 on the assumption that block money
  lands in the milestone schedule. It does NOT - reservation money lands on opportunity
  columns. Column is nullable and harmless; DO NOT USE. Retire in a later cleanup.

## BUILD ORDER
7-1 schema (DONE - block_payments live, tag pre-block-cut7-schema)
7-2 block_payment_allocations + ceremony screen (founder judges the picture HERE)
7-3 lock engine (N reservation ceremonies) + Amend path
Founder ruling: judge at 7-2 before ledger wiring - cheapest place to change course.


# CUT 7-6 - THE COLLECTION STATE (supersedes the field-by-field patches)
**Ratified shape:** 25 Jul 2026 (Day 74 eve). Founder: 'we are cutting field by field' - correct
criticism. Expected/landed/variance was built, removed in the rebuild, and nearly re-added as a
fresh idea. This section designs the WHOLE problem once.

## THE PROBLEM IN ONE PLACE
A block needs a reservation total to be collected (e.g. 25,000 x 3 units = 75,000). Money arrives
in ONE OR MANY tranches. Any tranche can differ from what was promised - bank charges, rounding,
a short cheque. Someone must decide: ACCEPT the difference and proceed, or DEMAND the balance and
hold. The block stays open until that decision closes it.
That is not three features. It is ONE COLLECTION STATE with three facts and one decision.

## THE THREE FACTS
1. DUE - block-level, persists. v1: broker types 'Expected amount to reserve' at block level.
   (Source deferred: architect ruling was fixed-per-developer on the MA with a block override -
   founder parked it for fresh eyes. v1 is typed, so the build does not wait on that answer.)
2. RECEIVED - the sum of recorded payments. Each payment splits EQUALLY across live members and
   writes honestly (existing certified engine, unchanged).
3. OUTSTANDING - due minus received. Displayed on the payment screen and on the workspace header.

## THE ONE DECISION
When outstanding is NOT zero, the block is UNSATISFIED and stays open. Two exits:
- DEMAND AND HOLD (default): outstanding stands. This is what Cut 6a's booking clock chases, what
  the reminders quote, and what escalates to the sales manager. Nothing auto-cancels (founder
  ruling Day 74) - a human decides cancellation + damages claim.
- ACCEPT AND PROCEED: someone with authority declares the reservation satisfied DESPITE the gap
  (bank charges, rounding, a negotiated shortfall). Requires a REASON, is logged, and closes the
  collection. This is the same grammar as the close-gate materiality prompt - small gaps pass
  cheaply, real gaps are a deliberate act.
  GATE: capability amend_payments (manager tier, already seeded Day 74) - accepting a shortfall is
  a money decision, not a recording action.
  TOLERANCE: company setting (reuse close_variance_tolerance_aed/pct). Under tolerance = accept
  with a note. Over tolerance = manager decision with a reason.

## WHAT DOES NOT CHANGE
- Equal split across live members - the rule, no broker lever (uneven needs a logged reason).
- Stage advance on first money (money-tail sec 5: 'Payments Collection = a STATE within Reserved').
  A partially-paid block IS Reserved and IS in collection. The hold is claimed; the chase continues.
- The app records ACTUALS. Only what arrived is distributed. Nothing is ever fabricated.

## SCHEMA DELTA (additive)
  block_deals.reservation_expected   numeric   - the DUE figure, block-level
  block_deals.collection_status      text      - open | satisfied | accepted_short
  block_deals.collection_note        text      - reason when accepted short
  block_deals.collection_closed_by   uuid
  block_deals.collection_closed_at   timestamptz
No change to block_payments or block_payment_allocations - the payment engine is certified and
stays as it is.

## WHAT THE BROKER SEES
Payment screen, before typing anything:
  Reservation due AED 75,000 . Received AED 0 . Outstanding AED 75,000
After a 60,000 tranche:
  Reservation due AED 75,000 . Received AED 60,000 . OUTSTANDING AED 15,000
  (and, for a manager) [Accept and close collection] - reason required
Workspace header carries the same line so the block's collection state is visible without opening
anything.

## BUILD ORDER
7-6a schema + 'Expected amount to reserve' captured at block creation (editable later)
7-6b due/received/outstanding on the payment screen and the workspace header
7-6c accept-and-close decision, manager-gated, reason logged, tolerance-aware
Then Cut 6a booking clock reads outstanding - it finally has something real to chase.

## POST-RESERVATION BLOCK MONEY - FOUNDER RULING (Day 75): REUSE THE LEDGER, DON'T INVENT
Founder, reviewing the 1-to-1 SPA ledger (Particulars/Expected/Received/Mode/Date/Variance/
waive + Bill/Collected/ToCollect headline + quick-fill): "use screens 4 & 5 for the rest of
the block payments to receive... it gives consistency, people already know how to do it,
and better design."
RULING: the block's post-reservation collections (instalments, DLD, SPA fees across N
children) are the LEDGER PATTERN AT BLOCK LEVEL - same columns, same words, each particular
expandable to per-child rows, writing into each child's pre-SPA state so child SPA dialogs
and Close-Won gates see the same truth. Zero new vocabulary.
The reservation intake ceremony (certified Day 74-75) stays as-is - it is a DISTRIBUTION
ceremony (one wire -> N children -> stage gate), genuinely block-specific.
SCOPE: this is the design of record for block money phase 2 (post-6a), NOT today's build.
Today's A1 = small alignment only: Towards->Particulars, strip labels ->
Bill (reservation)/Collected/To Collect, add Notes field.
