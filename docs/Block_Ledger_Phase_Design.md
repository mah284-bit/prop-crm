# BLOCK LEDGER PHASE - DESIGN OF RECORD
Ratified Day 75. Founder ruling: reuse the 1-to-1 SPA ledger grammar (screens 4-5) at block
level - consistency, zero learning curve, better design. No new vocabulary.

## WHAT IT IS
After the reservation is SETTLED (satisfied or accepted_short), the block's money story
continues: instalments, SPA fee, DLD fee, Oqood, other developer fees - for N children at
once. This screen is Khalid's COMBINED bill.

## THE THREE RULINGS (founder, Day 75)
1. UNLOCKS at settled reservation - lives where Record payment stood (the settled chip
   becomes/joins the door to the ledger).
2. SPLIT BY EACH CHILD'S ACTUAL BILL, not equally. DLD is 4 pct of each unit's price; SPA/
   Oqood are per-unit fixed; instalments follow each child's plan. The reservation was
   uniform - these are not. Suggested allocation = per-child expected for that particular;
   broker can edit; remainder reconciles to what landed (actuals law).
3. ONE PARTICULAR PER PAYMENT EVENT (same as reservation intake). Mixed lump = two events.

## THE SCREEN (ledger grammar, block face)
Headline: BILL (post-reservation) / COLLECTED / TO COLLECT - block-wide totals.
Table: one row per PARTICULAR (First instalment, SPA fee, DLD fee, Oqood, Other):
  Particulars | Expected (sum of N children) | Received | Mode | Date | Variance | waive
Each row EXPANDS to per-child lines (unit ref, that child's expected, received, still owed).
Reservation appears as a SETTLED row at top (credits toward initial advance - same story
the child ledgers tell).
Record-money flow: pick particular -> amount landed -> suggested per-child split by each
child's outstanding for that particular -> edit -> reconcile to landed -> lock -> writes.

## WHERE MONEY LANDS (the critical wiring)
Every allocation writes into the CHILD's pre-SPA payment state (pp_sales_closures
pre_spa_payments jsonb per child) so the child's own SPA dialog, Payment Summary and
Close-Won gate see the same truth. The block screen is a FACE over child truth, never a
second store. block_payments + block_payment_allocations record the bank line and the split
(existing tables, milestone = the particular).
NOTE: child pre-SPA state is a jsonb blob keyed on opportunity_id - allocation = read-modify-
write per child. Concurrency accepted (single-broker reality), amend path per ruling 4.
Waive at block level = waive that particular on EVERY child (logged); per-child waive lives
in the expanded row.

## WHAT DOES NOT CHANGE
- Reservation intake ceremony: as certified (distribution + stage gate). Untouched.
- Actuals law, amendability with reason, manager gates - all inherited.
- Close-Won per child still gated on every AED collected (proven in 1-to-1).

## BUILD ORDER (post A-merge; this is phase 2 of block money)
BL-1 read child pre-SPA states + compute per-child expected per particular (plan preset,
     DLD pct, fee schedule - same derivation the child SPA dialog uses; EXTRACT that
     derivation into src/lib/dealBill.js, one truth two callers)
BL-2 the ledger screen (read-only first: bill/collected/to-collect + expandable rows)
BL-3 record-money flow (particular -> split by outstanding -> lock -> child writes)
BL-4 waive + amend + variance at block level

## A14 - CALCULATOR LOCK AFTER SETTLEMENT (founder catch, Day 75)
Once the reservation collection is SETTLED, the distribution calculator is LOCKED on that
block. Repricing children whose money was collected against D_locked prices silently
diverges bills, DLD (4 pct of price), and the settled record. INTERIM (shipped Day 75):
Open Calculator blocked with an explanatory toast when collection is settled/accepted_short.
FULL: repricing after money = manager-gated ceremony with mandatory reason + audit, arrives
with the ledger phase. Legitimate late-terms cases (developer-approved further discount,
drop-out re-allocation) go through that ceremony, never the open door.

## STICKY (founder, Day 77) - THE LEDGER IS BORN AT RESERVATION, NOT AT SPA
Today the pre-SPA payments ledger only appears inside the SPA Signed dialog. Founder: it should
be CREATED THE MOMENT the reservation is recorded, and used continuously from there - collect,
collect, collect - until the money is complete; THEN document collection, THEN SPA clearance,
THEN upload the executed SPA and close. The ledger is the collection instrument for the whole
Reserved->SPA period, not a form that appears at the end. (Do not build now - sticky.)

## WHAT THE BLOCK CALCULATOR IS MISSING (founder cold-look, Day 77)
The 1-to-1 ledger answers "what does this buyer OWE and what has he PAID" - particulars in
dirhams, totals, Bill/Collected/To-Collect. Terms produce readable CONSEQUENCES.
The block calculator takes the same inputs (plan, DLD) and shows only price and discount - the
consequence is invisible. Founder reading it cold could not tell what the buyer pays, what DLD
amounts to, or whether the terms were locked or being drafted.
FIX: once terms are set, show a BILL PREVIEW per unit and for the block, computed by
lib/dealBill.js (already written, BL-1): first instalment (net x plan pct), DLD (4% split per
arrangement), SPA fee, Oqood - and the block total due at reservation. Terms then visibly
produce the deal, not just record inputs.
ALSO: the calculator is two things at once - a VIEWER of the locked version and a DRAFTING
surface for the next - and nothing says which. Header says "D1 locked" while the terms sit
editable. Needs an explicit viewing-vs-drafting state.
