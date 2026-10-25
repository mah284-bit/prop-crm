# LEASING MONEY — RULINGS (Day 105, 24 Oct 2026)
Founder rulings from the Day 1 restart. These govern the lease record,
the cheque register, and anything that computes rent.

## R1 — THE CHEQUE SCHEDULE IS THE SOURCE OF TRUTH
Founder: "it is flexible... some take a quarter cheque 1st and the next
cheque date will be qtr+month free date, some do it at the end of the
term — it is managed by the cheques to avoid the confusion."
CONSEQUENCE: no automatic cheque generation. Each cheque carries its OWN
date and its OWN amount. Never "rent / number_of_cheques".
The boarded item "cheque generation from a lease" is DEMOTED to a
suggestion the user overwrites, or stays unbuilt.

## R2 — RENT-FREE EXTENDS THE TERM; IT DOES NOT DISCOUNT THE RENT
Founder: "no — pays for 12 and lives for 13 or whatever."
- `annual_rent` holds the HEADLINE figure, undiscounted. No net column.
- Commission is computed on `annual_rent` — correct as-is.
- The tenant occupies 12 + rent_free_months.

## R3 — end_date IS ENTERED, NOT DERIVED
"13 or ++ months depending" means the app must not guess.
Default to start + 12 months + rent_free_months, SHOW it, let it be changed.

## R4 — rent_free_months ON THE LEASE IS A RECORD OF WHAT WAS AGREED
It drives nothing. It is for reporting and for the Ejari term.
`unit_lease_pricing.rent_free_months` is the unit's ASKING terms — a
different fact. A lease must not read the unit's value at display time,
or a unit later re-listed at zero free months recomputes old leases wrong.

## R5 — CHEQUES SHOULD SUM TO annual_rent — AS A WARNING, NOT A BLOCK
Legitimate reasons exist for a mismatch (deposit cheques, fees collected
separately). If four cheques total 88,000 against a rent of 96,000, the
app says so quietly. It does not refuse to save.

---

# THE LEASE JOIN — WHAT THE DIG FOUND (not yet fixed)
`LeaseOpportunityDetail.jsx` writes `lease_contracts` (L43 read, L634
insert, L718 sign). Everything else reads `leases`. A straight redirect
would throw — four reasons:

1. INSERT WRITES COLUMNS `leases` DOES NOT HAVE:
   opportunity_id, lease_opportunity_id, terms. Sign step writes signed_at.
2. `leases` DEMANDS COLUMNS THE INSERT NEVER SETS:
   end_date is NOT NULL, no default, absent from the insert.
   tenant_id / unit_id / start_date / annual_rent are NOT NULL but the
   insert passes `||null` on every one.
3. THE LINK BACK TO THE OPPORTUNITY DISAPPEARS:
   L43 reads .eq("lease_opportunity_id", opp.id) — no such column on leases.
4. STATUS VOCABULARY DIFFERS: insert writes "Draft"; leases.status
   defaults to "Active".

## LANDMINE — leases.company_id DEFAULTS TO 00000000-...-000000000001
That is not Al Mansoori (c23a2320-...). Any insert that does not set
company_id explicitly lands the row in a tenant that is not yours, where
RLS then hides it. A row that silently vanishes.
Same shape as the Day-93 admin_fee_per_unit default.
LAW: NULL MEANS FALL THROUGH; ZERO — OR A WRONG DEFAULT — MEANS A LIE.

## OPEN — DUPLICATE COLUMNS ON `leases` (four pairs, all live)
contract_no / contract_number · ejari_no / ejari_number ·
no_of_cheques / number_of_cheques · agency_commission / agency_fee
The insert must pick one of each AND the dashboards must read the same one.
NOT YET RULED — needs a grep of what the dashboards actually read.

## ALSO SPOTTED
Two "Print Agreement" buttons in LeaseOpportunityDetail (L652 calls
printAgreement, L657 builds HTML inline). Separate cleanup.

---

# DUPLICATE COLUMNS — SETTLED BY EVIDENCE (grep, Day 105)
Live code reads/writes ONLY these. The insert uses the same four.
  contract_number · ejari_number · number_of_cheques · agency_fee
DEAD, zero references in src/: contract_no · ejari_no · no_of_cheques ·
agency_commission. Drop after the join is fixed and walked, not before.
CAUTION: agency_fee_pct (InventoryModule, OpportunityDetail) is the SALE
side on unit_sale_pricing. Different fact. Do not conflate.

# ⚠️ R1 VIOLATION ALREADY IN THE CODE
src/components/leasing/shared.jsx L65,68,131,180 — "Auto-Generate N
Cheques" computes annual_rent / number_of_cheques. Equal cheques on clean
dates. That is the assumption R1 overturns. Built before the ruling; live.
PENDING FOUNDER CALL: delete the button, or demote it to a pre-fill the
user overwrites with no claim of correctness.

---

# DUPLICATE COLUMNS — SETTLED BY EVIDENCE (grep, Day 105)
Live code reads/writes ONLY these. The insert uses the same four.
  contract_number · ejari_number · number_of_cheques · agency_fee
DEAD, zero references in src/: contract_no · ejari_no · no_of_cheques ·
agency_commission. Drop after the join is fixed and walked, not before.
CAUTION: agency_fee_pct (InventoryModule, OpportunityDetail) is the SALE
side on unit_sale_pricing. Different fact. Do not conflate.

# ⚠️ R1 VIOLATION ALREADY IN THE CODE
src/components/leasing/shared.jsx L65,68,131,180 — "Auto-Generate N
Cheques" computes annual_rent / number_of_cheques. Equal cheques on clean
dates. That is the assumption R1 overturns. Built before the ruling; live.
PENDING FOUNDER CALL: delete the button, or demote it to a pre-fill the
user overwrites with no claim of correctness.

---

# DAY 0 RULINGS (Day 106, 25 Oct 2026)

## R6 — BREADTH OVER DEPTH FOR LEASING V1
Leasing exists because a sales prospect asks "do you do leasing too?" — brokers
do not want two apps. What loses that evaluation is a MISSING STAGE, not a
shallow one. So: all four gates exist and capture the few fields that matter.
None tries to match the sales ceremony. Depth arrives when a real leasing
brokerage pulls for it.

## R7 — NO NEGOTIATION ROUNDS IN LEASING
Founder: "rental is high demanding, not much negotiating like sales here —
either it will be yes or no."
The agreed rent IS the record. The gate shows the unit's asking rent beside the
agreed rent so the discount is visible, and nothing else is stored. No rounds,
no open/applied/declined lifecycle.

## R8 — THE OFFER MADE GATE IS THE LEASE TERMS FORM
Captured once, at the moment terms are agreed:
  agreed annual rent (writes final_rent) · start date · term months (default 12)
  · rent-free months (default 0) · number of cheques · security deposit
Displays asking rent and the gap. The agreement then RENDERS what was agreed
rather than prompting for it — one build, not two. Kills the Day-105 interim
prompts.
