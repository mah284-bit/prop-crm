# INVENTORY COMPLETENESS - THE PROPPULSE IMPORT PROBLEM (Day 79, OPEN)

## THE BACKGROUND (founder)
Inventory is created by PROPPULSE from free public sources - "it gets what it gets." Units are
imported into a company's working set WITHOUT all the details, and the broker is expected to find
out and update. So INCOMPLETENESS IS INHERENT to the pipeline, not an accident.
The ideal is inventory received directly FROM THE DEVELOPER, but that carries "too many questions"
(feed format, per-developer integration, who owns corrections) - parked.

## WHY IT MATTERS TO THE MONEY ENGINE
A unit with no price produces a bill of ZERO silently. dealBill() computes plan pct x price, so a
zero price gives a zero instalment and the ledger looks settled when nothing has been agreed.
The PRICE INTEGRITY rule already covers the 1-to-1 path (zero price = incomplete = not offered in
the picker), which is why the founder has never hit it. NOT YET VERIFIED for the BLOCK picker,
which is a different code path.

## FOUNDER DIRECTION
"We need to make sure the data is complete when we allow the listing as available units, OR when
picked show the anomalies - otherwise that unit will remain in inventory without a price."
So the guard is NOT "reject incomplete units" - that would empty an inventory whose incompleteness
is by design. It is: SURFACE THE GAPS so the broker completes them before transacting.
SHAPE (not yet designed): a completeness state per unit (price / payment plan / floor / view /
size), visible in Inventory as a badge, and an explicit block on offering a unit that lacks the
fields money depends on. "Show the anomalies at pick time" is the founder's phrasing.

## OPEN
- Verify the price-integrity guard on the BLOCK unit picker (separate path from the 1-to-1).
- Decide what MINIMUM makes a unit offerable (price certainly; payment plan?).
- Developer-supplied inventory feeds: parked, with the questions named above.

## RELATED - THE LOST PAYMENT-PLAN TEMPLATES (founder recollection, Day 79)
Two tables exist and are UNUSED: `payment_plan_templates` and `pp_payment_plans`. Zero
opportunities carry a payment_plan_id. Origin (founder): when a unit is hard to sell - poor facing,
slow area, market conditions - the DEVELOPER offers a CUSTOM plan, and the app was to record the
plan first and work forward from it. It was moved to the database and then FORGOTTEN because there
was no master document keeping it alive. "Exactly how it is."
CONSEQUENCE TODAY: the app expresses "Custom" as a LABEL with no structure. planInitialPct()
regex-parses "N/M" and returns null for Custom, so a custom-plan deal computes a ZERO instalment.
Never surfaced because every test to date used a standard preset.
NOT A BUG TODAY - a parked asset. Decide whether to revive the tables or give Custom real
structure before any deal uses one.
