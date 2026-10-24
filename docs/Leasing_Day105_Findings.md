# LEASING — DAY 105 (24 Oct 2026). WHAT PRESSING THE BUTTONS FOUND
First session after a two-month pause. Intent: Day 1 of the build plan —
"prove what is already built." Outcome: most of it was never built.
Branch feature/leasing-revival. Commits b9ca8f1, de09bb3.

## THE HEADLINE
⚠️ **The stage gate dialog does not exist.** `moveStage` sets `showStageGate`;
nothing reads it. `stageGateForm` is written and never used.
`LEASE_GATED = ["Offer Made","Reserved","Lease Signed","Lost"]` — so FOUR OF
SIX STAGES ARE UNREACHABLE. The ladder stops at Viewing. Reserved can never be
set, so Payments and Agreement stay padlocked forever, and NO LEASE CAN BE
CREATED BY ANY SEQUENCE OF CLICKS.
Everything else fixed tonight sits behind that door.

## FIXED TONIGHT (walked where reachable)
1. LeaseOpportunityDetail wrote `lease_contracts`; everything else reads
   `leases`. Read, insert and sign repointed. Migration: `lease_opportunity_id`
   added to `leases`.
2. ⚠️ `leases.company_id` DEFAULTED TO 00000000-...-000000000001 — not Al
   Mansoori. Any insert omitting it landed the row in another tenant, where RLS
   then hid it. A row that silently vanishes. Default dropped.
3. ⚠️ The sign step wrote `status:"Signed"`. `leases_status_check` allows
   Draft/Active/Expired/Terminated/Renewed/Under Renewal. It would have THROWN
   on every signature. Now writes Active.
4. The insert wrote `terms`, `opportunity_id`, `lease_opportunity_id`; the sign
   step wrote `signed_at`. None exist on `leases`. Mapped to `notes` / removed.
5. `opp.move_in_date` does not exist on `lease_opportunities` — the table has NO
   date field at all. Start date is now prompted (interim; belongs in the gate).
6. `LeasingLeads` wrote `property_category` into `lease_opportunities` — a SALES
   column, hard-coded "Off-Plan". On a lease. Enquiry creation failed outright.
   The file is a clone of the sales lead form.
7. ⚠️ `LEASE_STAGES` / `LEASE_STAGE_META` were never imported after the Day-102
   extraction. The detail screen CRASHED ON OPEN. 22nd refactor casualty.
   It had been dead since Day 102 and compiled green every time.

## OPEN, FOUND TONIGHT
8. ⚠️ THE GATE DIALOG (above). Nothing proceeds without it.
9. ⚠️ Leasing stages have NO EVIDENCE MODEL. Contacted and Viewing just tick —
   no activity, no communication, nothing recorded. Sales has E1-E4 and
   auto-advance. The leasing ladder is decorative. Same fault as Day 85's
   "the block stops at status words."
10. ⚠️ `budget` vs `final_rent`. My first insert took `final_rent || budget` —
    WRONG. Budget is the tenant's ceiling, not the rent. On this test enquiry
    it would have recorded 100,000 against a unit asking 60,000. The lease must
    take `final_rent` ONLY and refuse without it — which makes the Offer Made
    gate load-bearing. NOT YET CORRECTED (no gate to read from).
11. The PDC generator in LeaseOpportunityDetail (L~933) writes `lease_payments`.
    PDC cheques ARE the rent schedule and belong in `lease_cheques`. It is a
    second cheque generator in the wrong file, and it does rent/n — which R1
    outlaws. Kill it; the register already does this job.
12. `ReportsModule` reads `rent_payments` (L57) and `lease_payments` (L59), never
    `lease_cheques`. LEASING REPORTS ARE BLIND to every cheque recorded.
13. `shared.jsx` L65/68/131/180 "Auto-Generate N Cheques" = annual_rent / n.
    Contradicts R1. Delete or demote to an overwritable pre-fill. UNRULED.

## COUNTS THAT DISAGREE (cold-look failures, none blocking)
14. Dashboard says "10 tenants"; the Leads list says 18.
15. "New Enquiry 18" when `lease_opportunities` held ZERO rows — the chip counts
    tenants and labels them with an enquiry stage.
16. Dashboard says "50 total for lease"; `unit_lease_pricing` has 80 rows.
17. The header reads "SALES ONLY" while standing inside the Leasing CRM. Either
    the company mode is not enforced or the badge lies.

## CONFIRMED, NOT A FAULT
18. The leasing unit picker draws from `project_units` (off-plan sales projects).
    Correct for today: `pp_listings` = 0, the Building table does not exist yet.
    That is Days 2-3. Founder caught it unprompted.
19. `unit_lease_pricing` = 80, `project_units` = 110, `pp_listings` = 0,
    and `leases` / `lease_contracts` / `lease_cheques` / `lease_payments` /
    `rent_payments` ALL ZERO. Nothing has ever been recorded. This is the
    cheapest moment this module will ever be fixed in.

## THE LAW THIS SESSION EARNED
⚠️ **NOTHING IS BUILT UNTIL IT HAS BEEN RUN.** Seven faults, one cause: this code
was written, refactored, extracted and compiled — never executed. `npm run build`
was green through every single one. A missing module import is a build error; a
missing SYMBOL import is a runtime crash, and the build says nothing.

⚠️ **A `||` FALLBACK ON A FIELD THAT DOES NOT EXIST IS INDISTINGUISHABLE FROM ONE
ON A FIELD THAT IS EMPTY.** `opp.move_in_date || null` looked like a kindness for
five months. It was a column that was never there.
