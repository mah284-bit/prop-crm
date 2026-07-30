# BLOCK AS A FIRST-CLASS DEAL - DESIGN OF RECORD
Ratified Day 77 (29 Jul 2026). Founder + architect, after a full 1-to-1 cycle walkthrough.
Supersedes the "block is a control panel above some deals" framing.

## WHY BLOCK SALES EXIST (founder)
1. A benefit to the buyer - deeper discount and better terms because he is committing a lot.
2. Giving him IMPORTANCE - the stakes are high.
3. Composition (picking units, dropping, adding, leaving some on budget) is all PRE-CONFIRM work.
4. Post-reservation change needs its own rules - see the three tiers below.

## THE CORE RULING: THE BLOCK IS WHERE THE DEAL IS WORKED
Founder: "some how we have to lock all the proceedings for 1-to-1, and Block should take over."
A block IS a deal in every way that matters - one buyer, one negotiation, one relationship. The
broker calls HIM, chases HIM, follows up with HIM. Khalid does not have three conversations about
three units; he has ONE conversation about the block. Logging a call against EBT-08-04 would be a
lie about what happened.
TODAY THIS IS BACKWARDS: a 700K 1-to-1 deal has a journey, activities, communications and next
steps. A 5,000,000 block has status words and buttons. Higher stakes, LESS attention from the
system.

## WHAT THE BLOCK CARRIES (the deal surface)
- **Journey** - where the block stands, visible at a glance (not just setup states)
- **Activities + communications** - calls, meetings, WhatsApp, notes, at BLOCK level
- **Next steps** - follow-ups that chase the block
- **Money** - the collection across all children, one ledger view
- **Children roll-up** - the units and where each stands on its own rungs
- **Terms** - plan + DLD, uniform across the block (Day-77 ruling)

## WHAT THE CHILD OPP CARRIES (the execution record)
Unit, price, terms inherited from the block, its OWN SPA, its OWN DLD registration, its OWN
commission invoice. DLD registers per unit - that is why children exist at all.
A child opp is NOT worked independently. Opening one shows what it is and where the work happens:
a banner - "This unit is part of <block> - worked from the block" - with a link. No deal actions,
no stage buttons, no activity logging on the child.
FOUNDER RULING on hedging: do not mirror the block's activity feed onto the child read-only.
"That is keeping your feet on two boats - imagine the state." ONE place for the conversation.

## THE OPEN COUNTER-CASE (architect's challenge, not resolved)
A genuinely unit-level conversation exists ("he wants to swap 09-05 for a higher floor", "he is
unhappy with the view on 08-04"). Logged at block level it never surfaces on that unit's screen,
including at SPA time. AND: a DETACHED child (Cut 6) walks away with no history at all - every
call and meeting stayed with the block, at the moment the standalone deal most needs it.
NOT RESOLVED. Do not hedge it into a half-mirror. Decide deliberately when building.

## THE 1-TO-1 FLOW SIMPLIFICATION (founder, Day 77) - TWO DEAD STEPS
TODAY: Record Reservation (ceremony) -> Advance to SPA Requirements (only recolours buttons) ->
open "Record SPA Signing" (a dialog named for an act not performed) -> only THERE does the
broker see what he is collecting. Three doors before the money story appears.
RULING: merge the reservation ceremony with the LEDGER'S BIRTH. Record Reservation -> ceremony
fires (fee, method, date, 5-working-day expiry) -> stage Reserved, unit Reserved, AND the ledger
opens already showing Reservation received / Bill / To collect. ONE door.
QUALIFICATION (architect): merge the STEP, not the FORM. The ceremony must stay visible - this
money claims the unit, starts a clock, and is forfeit-exposed. If the reservation becomes row two
of seven in a ledger, the commitment is buried. Ceremony first, confirm, THEN the ledger opens
with it credited.
THREE ACTS, each meaning one thing: Record Reservation (claim) -> record receipts as the
developer confirms them, partials allowed, save freely (chase) -> Record SPA: reference, date,
document (execute).
SCOPE CAUTION: this changes the CERTIFIED 1-to-1 money path. Own cut, own straight-test.

## METHOD FINDING (founder, Day 77) - WHY THIS SURFACED ONLY NOW
"When you test in silo the mode is different. When you sit and test end-to-end it is your USAGE
FEELING which is the result." Every previous end-to-end walk was interrupted by discussion and
fixes, so the friction never accumulated enough to be felt. Today's uninterrupted walk made two
dead steps obvious within minutes.
CONSEQUENCE: silo tests prove CORRECTNESS; only an UNINTERRUPTED walk exposes FEEL. There are
probably more findings of this kind, and they will surface the same way - walk without stopping,
note the friction, fix afterwards.

## POST-RESERVATION CHANGE - THREE TIERS (ratified Day 77)
Founder raised cancel-and-recreate for all post-reservation change. Architect challenged it
against the Day-68 unit-switch ruling (re-point, do not close-and-clone: cloning breaks history,
orphans payments, fakes Lost metrics). Founder accepted the challenge and asked for the best
route. This is it.

TIER 1 - COMPOSITION CHANGE (swap / drop / add a unit)
Same buyer, same developer, adjusted arrangement. Use the machinery already built: DETACH (unit
leaves, child survives standalone), DROP (child Closed Lost, unit freed), ADD (new line, needs
next lock), UNIT SWITCH (re-point, terms reset, money stays). Mandatory reason, audit line,
distribution goes to D(n+1). Money already collected STAYS on the block and re-allocates across
the new composition.

TIER 2 - TERMS CHANGE (plan, DLD, deeper discount)
Developer-authority doctrine, already live: capture approval, then D(n+1) locks and re-prices
pre-SPA children; contract-locked deals skipped by name. Money untouched - it was paid against
the deal, not against a price.

TIER 3 - THE ARRANGEMENT ENDS (cancel and recreate)
Buyer walks, developer withdraws, or the deal is restructured so fundamentally the developer
treats it as new. Block closes with reason; money recorded as refund/forfeit; a fresh block is
created if the buyer returns.

## THE LINE BETWEEN THEM: THE FORFEIT
FOUNDER'S TEST, adopted as the rule: **if the DEVELOPER FORFEITS, the old arrangement is dead
-> cancel. If not -> ceremony.**
Clean because it is not our judgment call. The developer decides what is material enough to
forfeit against, and the broker records it.

## WHY CANCELLING IS NOT "PIPELINE POLLUTION" ON A BLOCK (founder correction, accepted)
The architect objected that cancel-and-recreate produces a fake Closed Lost. Founder: on a BLOCK
the whole organisation knows - 5,000,000 does not quietly vanish. A cancelled block SHOULD show
in reports because it genuinely happened. The pollution argument applies to a broker quietly
re-creating a 700K deal to tidy his numbers, not to this.

## MONEY IS RECORDED, NEVER COMPUTED (founder)
1. The DEVELOPER decides the forfeit amount. The broker cannot challenge it - he records it.
2. Debit/credit lives at the developer's end. PropCRM records the movement, never calculates it.
3. Consistent with the north star: "a broker app, just recording, but depicting reality."

## SHAPE IT DEVELOPER-READY (founder: "not PropCRM - it is a BROKER PORTAL, developer coming")
Today these are one-directional records: the broker types what the developer told him. When the
developer persona lands, the SAME events become two-party: the developer records the forfeit and
the broker sees it; debit/credit becomes a real movement on one spine.
CONSEQUENCE FOR THE BUILD: model money events as EVENTS WITH AN AUTHOR, not as notes on a broker
screen - so the developer module INHERITS them rather than replacing them. (The existing
developer-approval capture - reference + proof + approver - is already the right shape.)

## THE RECEIPT (founder, Day 77) - THE COMMERCIAL REASON THE LEDGER IS BORN AT RESERVATION
"They will give him exactly how much he has to pay from this step - we can print the receipt
with balance amount to be paid within this time to proceed further."
At the reservation moment the app already knows: RECEIVED (the fee), the FULL BILL (plan-derived
first instalment + SPA fee + DLD + Oqood), the BALANCE, and the DEADLINE (the expiry the ceremony
already computes). Today none of it assembles until someone opens the SPA dialog days later.
A printable receipt at that moment - "Received AED 25,000 . Balance AED 358,900 . Due by
05/08/2026" - turns a payment into a clear obligation with a date, in the buyer's hand, while he
is still in the room. This is the commercial argument for ledger-at-reservation, beyond saving
two clicks.
BLOCK VERSION: the same receipt at block level - what the block owes across all units, what was
received, what remains, by when.

## SHIPPED (Day 79) - BLOCK VISIBILITY LADDER, LIVE-PROVEN
block_deals.assigned_to added (uuid -> profiles), backfilled from created_by on all 8 existing
blocks. RLS rewritten so blocks follow the SAME ladder as opportunities:
  is_super_admin() OR (company_id = my_company_id() AND (
    see_group_data OR (see_branch_data AND assigned_to IN my_downline()) OR
    (see_own_data AND assigned_to = auth.uid())))
Four policies on block_deals - SELECT (the ladder), INSERT (company), UPDATE (the ladder),
DELETE (owner only). The children (block_deal_units, block_distributions, block_payments,
block_payment_allocations) scope THROUGH the parent - "block_deal_id IN (SELECT id FROM
block_deals)" - so they inherit the ladder automatically, one definition, no duplication.
TRAP CAUGHT MID-CUT: the first version had a block_deals_write policy for ALL commands with only
a company check. Postgres RLS is PERMISSIVE (OR), so that policy bypassed the select ladder
entirely - every user in the company still saw every block. Narrowed to INSERT/UPDATE/DELETE.
LESSON: an ALL policy alongside a restrictive SELECT policy DEFEATS it. Never grant ALL when a
ladder is the point.
VERIFIED LIVE: an agent who does not own the blocks now sees NONE (closes the Day-77 leak the
founder found); his manager sees them via downline. Both tiers correct.

## RULING REVERSED (Day 79) - DO NOT MERGE THE RESERVATION CEREMONY INTO THE LEDGER
Day 77 proposed merging Record Reservation with the ledger's birth to kill two dead steps.
FOUNDER PULLED BACK on Day 79 and the architect agrees. The merge is DROPPED.
WHY: **the reservation is a CEREMONY; the ledger is an INSTRUMENT.** A ceremony is a moment - it
claims a unit, starts a clock, commits money that is now forfeit-exposed. An instrument is a
running record. Merging them makes the commitment feel like data entry and buries the thing that
matters most. Two extra clicks is a smaller cost than a buried commitment.
WHAT SURVIVES FROM C0b: the LEDGER IS STILL BORN AT RESERVATION (persisted then, not at the SPA
dialog) - but the ceremony is untouched and the broker's flow does not change. Today a reserved
deal has NO record of what is owed; that is the defect being fixed, nothing more.
THE PRICE RULE (settled here):
- RESERVATION AMOUNT: fixed. Never recalculates - it is a fee, not a percentage.
- FEES (SPA / Oqood / DLD pct): frozen at reservation from company policy.
- PRICE-DERIVED AMOUNTS (first instalment, DLD amount): follow the CURRENT AGREED PRICE. Not
  over-engineering - a 10% instalment on a renegotiated price MUST move, or the ledger
  contradicts the developer's payment plan.
