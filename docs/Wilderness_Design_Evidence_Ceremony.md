# Wilderness Design - Evidence, Ceremony & Fluid Deals
**Session: Day 67 (17 Jul 2026). Parts 1-4 RATIFIED by founder. Parts 5-6 pending presentation.**
Commissioned Day 66: 'controlled, traceable, flexible, easy to use.'

## PART 1 - UNIFIED EVIDENCE MODEL (RATIFIED)
Every stage transition asks: what must be TRUE? Four evidence types, each hard or soft per stage:
- E1 Unit truth: linked unit with price
- E2 Terms truth: documented terms buyer has seen (proposal; later: launch record/developer paper)
- E3 Identity truth: KYC at required level
- E4 Money truth: required payments at required completeness

| Transition | E1 | E2 | E3 | E4 |
|---|---|---|---|---|
| -> Quoted | soft | true BY act | - | - |
| -> Offer Accepted | HARD | soft nag | - | - |
| -> Reserved | HARD | soft+logged (Path B) | soft >=docs | reservation BY act |
| -> SPA Requirements | HARD | soft+logged | verified (soft) | - |
| -> SPA Signed (true) | HARD | HARD V_latest | HARD no-override (govt line) | HARD collection complete |
| -> Closed Won | inherited | | | |

GRADUATION PRINCIPLE: everything starts soft-with-logged-reason; graduates to HARD only where
reality itself is hard. The system never pretends stricter than the world.

## PART 2 - PATH B FORMALIZED: TERMS PENDING (RATIFIED)
Reserve via E2-override -> deal enters visible TERMS PENDING state:
- Amber chip beside stage (KYC-chip pattern); What's-next: 'Send the proposal - money held on
  unagreed terms'; surfaces in manager risk view
- Exit: proposal sent -> chip clears -> V_latest cascade feeds SPA math (already live)
- Free metric: reserved_at minus first_proposal_sent_at = wilderness gap (broker discipline KPI)
- v1 = visibility only; escalation rules (7-day manager notify etc) = config later

## PART 3 - POST-RESERVATION CHANGE CONTROL: CEREMONY TIERS (RATIFIED)
- Tier 1 Silent: non-terms edits (wording, attachments, validity) - normal versioning
- Tier 2 Flagged (default): any terms change post-Reserve -> version marked post_reservation:true,
  badge on version row, MANDATORY short reason stored+shown in audit chain; cascade flows normally
- Tier 3 Guarded: discount INCREASES post-Reserve -> Tier 2 + manager attention view ('discount
  deepened after money taken'). Graduates to approval workflow via dormant Discounts module.
- THE LOCK: at true SPA Signed, builder refuses new versions ('terms contractually executed');
  messaging/activities continue, terms freeze.

## PART 4 - UNIT SWITCH WITH FUND TRANSFER (RATIFIED)
DECISION: RE-POINT, not close-and-clone (opp = buyer's pursuit; unit = attribute; clone breaks
history, orphans payments, fakes Lost metrics).
Switch Unit action (Reserved/SPA-Req only): picker -> old-vs-new comparison w/ price delta +
collected-so-far -> mandatory reason -> atomically: unit_id repointed, unit A released to inventory,
payments STAY on opp (money paid is money paid - founder), current_* cleared -> deal enters TERMS
PENDING (Part 2 double duty), unit_switched activity logs A->B/delta/reason/who, KYC untouched.
Delta handling v1: DISPLAY only ('collected X against A; B differs; obligations recompute at next
proposal') - developer-side transfer is offline reality we record, not simulate.

## PART 5 - LAUNCH MODE (PENDING PRESENTATION)
Sketch: kiosk-day rapid capture (buyer+unit+allocation+price-as-quoted), deferred documentation
post-event, launch record = E2 evidence form, bulk import + reconciliation vs developer confirmations.

## PART 6 - BLOCK SALES (PENDING - may deserve own session)

## PART 5 - LAUNCH MODE (RATIFIED Day 67)
Two pieces serving two moments:
PIECE 1 - LAUNCH CAPTURE (the frenzy): Launch Event entity (name/developer/project/date, manager
pre-creates). During event: stripped rapid form - buyer name+phone, unit ref FREE-TEXT (kiosk list
may not match inventory), price-as-quoted, allocation status (allocated/waitlist/lost), note. 10
seconds, mobile-first. Each capture = launch_record, NOT an opp. No gates. Frenzy is sacred.
PIECE 2 - MORNING-AFTER RECONCILIATION: work-queue per event: match buyer->lead (or create), match
unit-ref->inventory (import via PropPulse if new), developer confirmation check. One click 'Convert
to deal' -> opp born at Reserved with evidence_source:launch_record - the launch record IS E2
evidence (first-class alternative form, no override theater). Lands in Terms Pending naturally,
KYC nags begin, normal spine takes over. Unmatched/lost stay as event history -> launch analytics
(hit rate per event/developer).

## PART 6 - BLOCK SALES (SKETCH RATIFIED, OWN SESSION POST-TESTERS)
Shape: Block Deal entity ABOVE opps - one buyer, one negotiation thread, master terms (bulk
discount, payment structure), N unit lines. Each line births child opp at confirmation (per-unit
inventory/invoice/SPA - DLD registers per-unit); children inherit block terms, locked. Negotiation/
proposals at BLOCK level; money can land at block and allocate down; commission per-unit, reports
roll up. Evidence: terms/KYC at block, money/SPA at unit. Session needs: schema (parent entity),
invoice allocation, bulk inventory holds, resale angle (Reseller intent), staging/drop-out/
re-allocation flows from real broker input.

## BUILD SEQUENCING (post-ratification note)
Foundation order: stage split (SPA Requirements/Signed) -> Terms Pending state -> ceremony tiers ->
unit switch -> Launch Mode -> Block Sales. Each rides the previous. Timing: post-tester feedback.
