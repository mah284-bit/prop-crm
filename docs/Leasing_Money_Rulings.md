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
