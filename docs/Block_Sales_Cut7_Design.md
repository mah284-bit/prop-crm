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
