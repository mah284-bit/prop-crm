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

## CONFIRMED ON THE LIVE WALK (Day 77) - THE FORM DOES TWO JOBS
The "Record SPA Signing" dialog opens from the SPA REQUIREMENTS stage and is really the
COLLECTION ledger (Bill / Collected / To collect, per-particular Received+Mode+Date, waive,
variance, commission preview). Nothing has been signed at that point.
Live numbers on SHI-13-09: Bill 383,899.98 . Collected 25,000 (reservation credited) . To
collect 358,899.98 . First instalment 249,735.70 (10% of 2,497,357) . SPA fee 5,250 . DLD 4%
99,894.28 . Oqood 4,020 . Outstanding to developer 2,472,357 . Commission preview 104,888.99.
lib/dealBill.js computes the SAME figures - the engine is correct, only its TIMING is wrong.
CORRECTION (founder, Day 77): the button label "Advance to SPA Signed" at the SPA Requirements
rung is simply a LABEL not updated after the stage-split process change - not a design fault.
And opening the dialog writes NOTHING; it is read-only until Record SPA is pressed.
THE REAL FINDING STANDS: the ledger EXISTS ONLY INSIDE THAT DIALOG. Open it and the numbers
assemble from opp fields; close it and nothing persists - pp_sales_closures is empty. So the
broker's collection state lives NOWHERE between visits. He cannot see what he is owed without
opening a dialog named for an act he has not performed.
FIX: persist the ledger from RESERVATION onward and surface Bill/Collected/To-collect on the
deal itself. The SPA signing ceremony (reference, date, document) stays a separate final act.

## OPEN QUESTION (Day 77, founder - DISCUSS, do not build) - PARTIAL COLLECTION HAS NO SAVE DOOR
OBSERVED: with 200,000 of 249,735.70 recorded against the first instalment, the only button is
"Record SPA", which correctly refuses (variance 158,899.98 vs tolerance 3,839) and demands an
approval note. So mid-collection progress has nowhere to be saved without attempting an act the
broker is not performing.
FOUNDER'S CORRECTION - do not conclude too fast: PropCRM is a BROKER system. The broker does not
receive the money; the DEVELOPER does. The broker RECORDS what the developer confirms received.
So the gate may be exactly right - he records the SPA only once the developer says the money is
in - and a "save partial progress" door may be modelling something the broker never does.
TO DISCUSS: does the broker track running partial receipts (developer confirms in instalments),
or does he record once, when the developer confirms the collection is complete? The answer
decides whether the ledger needs a save-progress door at all - and the same answer applies to
the block ledger one level up.

## RULE (founder question, Day 78) - FEES ARE FROZEN AT THE RESERVATION MOMENT
FOUNDER: "once the SPA fee is set and the reservation is made and you informed the buyer about
the balance, it should not change - only for the new ones - otherwise there will be a dispute."
CORRECT AND NOT YET GUARANTEED. Today: once a ledger is SAVED, expected amounts persist in
pp_sales_closures.pre_spa_payments and reload from there. But a deal that is RESERVED and not
yet ledger-saved recomputes from CURRENT settings on every open - so a policy change silently
alters what an existing buyer was told.
THE RULE: the fee policy in force AT RESERVATION is that deal's policy, permanently. Later
policy changes apply only to deals reserved after them. If a deal's fees genuinely must change,
that is an AMENDMENT with a reason - never a silent recalculation. Same principle as the locked
distribution and the honest ledger: money agreed is money agreed.
IMPLEMENTATION: this is another argument for the ledger being BORN AT RESERVATION - birth is
what freezes the policy. Persist the resolved fees onto the deal (or its closure row) at the
reservation ceremony; every later read uses the frozen copy, never the live settings.
BLOCK: identical - the block's expected reservation and fee policy freeze when the block's
collection opens.

## REFINEMENT (Day 79) - WHAT FREEZES AND WHAT FOLLOWS
The freeze rule needs a distinction, ruled with the founder:
- **FEES FREEZE at reservation** - SPA fee, Oqood, DLD percentage. These come from COMPANY POLICY.
  A brokerage changing its policy must never alter what an existing buyer was already told.
- **PRICE-DERIVED AMOUNTS FOLLOW THE PRICE** - first instalment (plan % of price) and the DLD
  amount (frozen pct x current price). A price change is a NEGOTIATED EVENT the buyer knows about
  (a new proposal version), not silent policy drift. Different things.
BACKGROUND: current_agreed_price already works this way - each proposal version sets it, V(n)
supersedes V(n-1), and "final sale price" at SPA is simply the last agreed price. No separate
final-price concept is needed (Day-66 V_latest cascade).

## RULED (Day 79) - THE LEDGER FOLLOWS THE PROPOSAL, NEVER THE NEGOTIATION
FOUNDER: "though we have the negotiations, it is not directly applied - only noted for internal
approvals. Using this print they will again have to resend a proposal, else the old prices stay."
NEGOTIATION ROUNDS ARE INTERNAL: buyer asked 5%, developer countered 3% - logged, approval trail,
NOTHING changes on the deal.
THE PROPOSAL IS THE INSTRUMENT: only when a proposal is ISSUED do price, plan and DLD change.
TRIGGER: a proposal saved on a deal at RESERVED OR LATER recomputes the stored ledger's
PRICE-DERIVED rows (first instalment = plan pct x current price; DLD amount = frozen pct x
current price). NEVER touched: the reservation (fixed fee), SPA/Oqood/DLD-pct (frozen policy),
and any row already RECEIVED or WAIVED.
NO ANNOUNCEMENT NEEDED: the proposal IS the communication to the buyer. The ledger recomputes
silently and the receipt prints what is stored - so a receipt can never show a figure the buyer
has not been sent. (Architect had proposed a "terms revised" banner; founder correctly called it
over-thinking.)
DEFECT THIS FIXES (seen live Day 79): Boris's deal went from 6,753,047 / 10-90 to 6,617,986 /
50-50 via a new proposal, and the saved ledger still showed the OLD first instalment 675,304.70
and DLD 270,121.88. seedRow skips any row that already has an expected_amount, so a saved ledger
never recalculates.

## BANKED, NOT NOW (founder suggestion, Day 79) - THE UNAPPLIED-NEGOTIATION NUDGE
At the SPA gate, warn if negotiation rounds were logged AFTER the latest proposal: "3 rounds
since the last proposal - has everything been applied?" Catches the gap between what was agreed
and what was issued.
ARCHITECT CALL - defer: a nag needs evidence before it earns its place, or brokers learn to click
past it. Revisit after the tester round. The data already exists (round timestamps vs proposal
timestamps), so it is computable whenever wanted.

## GAP FOUND (Day 79) - THE LEDGER STORES TOTALS, NOT PAYMENT EVENTS
FOUNDER ASKED: if the buyer pays 20 and 5 is pending, will the receipt handle it?
PARTLY. Outstanding per particular is correct (expected minus received), so the BALANCE on the
receipt is right. But `pre_spa_payments` stores ONE amount per particular, not a LIST of payments.
Two payments of 20,000 and 5,000 against one row collapse into 25,000 - no dates, no methods, no
history. So the receipt's "RECEIVED WITH THANKS" band can only ever show the RESERVATION, because
that is the only payment stored as a discrete event.
CONSEQUENCE: you cannot issue a receipt for a payment the system never recorded as an event. A
second receipt after a further 5,000 would still say "Received: AED 25,000".
NOT AN ISSUE FOR THE RESERVATION - that is fully gated (Reserved is earned only on full
collection; partials hold at Offer Accepted). It bites in the COLLECTION PHASE, where a 3.2M
first instalment will arrive in several confirmed tranches - which is exactly the partial-receipt
model the founder ruled FOR on Day 78.
FIX SHAPE: payments become ROWS (a payments table keyed to opportunity + particular), and the
jsonb becomes a derived view or is retired. Same conclusion as the Day-78 jsonb-vs-table question,
now with a concrete consequence rather than a theoretical one. Each recorded payment then has its
own receipt.

## RULED (Day 79) - ONE BILL AT THE BLOCK, THE SPLIT VISIBLE PER UNIT
FOUNDER: "if we put per record, imagine 15 units on a floor - cumbersome. The block is the meaning
of record from ONE source and distribute."
THE LEDGER: money is recorded ONCE at block level and allocated across children - the same engine
already used for the reservation (block_payments + block_payment_allocations). The BILL is computed
per particular, summed across children: instalments (plan pct x each net price), SPA fees (units x
policy), DLD (pct x block value), Oqood (units x policy). dealBill() run per child and summed -
same engine, same grammar as the 1-to-1.

## THE BLOCK STATEMENT (founder requirement, Day 79) - THE BUYER NEEDS BOTH VIEWS
"There should be a report showing the block first and then the split - collections information,
everything from one place. If the buyer asks for the split we send it, because he should know his
investment on each unit for either selling later, renting, or handing over to family."
WHY THIS MATTERS: the buyer bought 15 units as ONE arrangement but will dispose of them ONE AT A
TIME - sell 07-03, rent 08-04, transfer 09-05 to a son. For each he needs that unit's cost basis:
net price, its share of DLD, its Oqood, its SPA fee. Without the split he holds a lump sum and no
basis for a capital-gains position or a rental yield. The per-unit view is the buyer's ASSET
REGISTER, not a nicety.
SHAPE - one document, two sections:
  1. THE BLOCK - total value, discount, collected, outstanding, by particular.
  2. PER UNIT - each unit's net price, its share of every fee, what has been allocated to it,
     its own balance.
ARCHITECT CAVEAT (accepted): the split must print the RECORDED ALLOCATION, never a tidier
pro-rata recomputed at print time. If a payment was split equally across children whose prices
differ, unit A's share is what was ACTUALLY allocated - not its proportional share. Honest-ledger
doctrine applied to a document: report what happened, not what looks neat.
BUILD ORDER: (1) block bill engine - dealBill per child, summed. (2) block ledger screen - record
once, allocate across children. (3) block statement PDF - both sections.
