# Leasing — the build plan

Written Day 104, to be executed from Day 105. Ordered so that nothing is built on top of something
unproven, and so each day ends somewhere safe to stop.

Read first: `docs/Leasing_Inventory_Design.md` (the model), `docs/Property_Model_Design.md` (one
property, three businesses), `docs/UAE_Leasing_Inventory_Research.md` (why the model is what it is).

Branch: `feature/leasing-revival`. Nothing merges to main until Day 5's walk passes.

---

## The division of work

The architect owns the order, the cutting and the checking. The founder walks the screens and says
what is true. Every real fault this month came from a button being pressed, not from code being
read — the property-management module was found by clicking a tab, "nationality is not a dialling
code" came from looking at a form, and `pp_listings` was nearly rebuilt because nobody checked.

⚠️ **So each day below names what it needs walked.** Building without walking is how twelve
refactor casualties sat undiscovered for five months.

---

## Day 1 — Prove what is already built

⚠️ **Nothing new gets built until the existing work is walked.** Three pieces are written and
untested, and an untested cheque register underneath a new inventory module is how faults compound.

**1.1 The cheque register** *(needs walking)*
The Payments tab was rewired to `lease_cheques` on Day 103 and nobody has logged one. It needs a
lease to attach to, so this follows 1.2.
- Log a cheque · check it appears · clear it · check the dashboard's overdue count moves.

**1.2 The lease join** *(build, then walk)*
⚠️ The fault found by digging on Day 102: `LeaseOpportunityDetail` signs a lease into
`lease_contracts` while `LeasingModule` and both dashboards read `leases`. **A lease signed on the
deal screen never appears in Prop. Mgmt**, and the rent roll stays empty however many are signed.
- Point the signing at `leases`, carrying the fields it already collects.
- `lease_contracts` becomes dead, like the specific ID columns on `tenants` — left in place, read by
  nothing.
- Walk: sign a lease on the opportunity → see it in Prop. Mgmt → see the rent roll move.

**1.3 The tenant form** *(needs walking)*
One form, both call sites, since Day 102. Not yet exercised properly.
- Add a Company tenant with a trade licence · check the ID list changes with the type.
- Nationality India + phone country UAE + a Dubai number → must be accepted.

**Ends with:** enquiry → opportunity → lease → cheques, working end to end for the first time.

---

## Day 2 — The building

**2.1 `pp_listings` becomes the Building table.**
It is empty, read by nothing, and already carries `building_name`, `community`, `emirate`,
`plot_number`, `title_deed_no`. Extend rather than create: street, building number, area, floors,
total units, year built, developer, and an optional one-way link to a catalogue `project`.

⚠️ **Tenant-owned, RLS by company.** A building a brokerage holds is their record, not PropPulse's
catalogue — the same distinction that sent the developer fees to `pp_developer_fees` on Day 96.

**2.2 The Buildings screen** — list, search, create, edit. Modest; the work is in the model.

**Walk:** create a building by hand, with an address that matters (Sharjah, so Day 6's switch has
something to bite on).

---

## Day 3 — The leasing unit, and tenure

**3.1 The unit.** ⭐ Less work than the design assumed: `unit_lease_pricing` already holds
`chiller_included`, `chiller_monthly`, `cheques_allowed`, `rent_free_months`, `escalation_pct`,
`notice_period_months`, `fit_out_contribution`, `agency_fee_leasing`, `min`/`max_lease_months`,
`security_deposit`. Most letting attributes exist.

What is missing is the identity — floor, unit number, type, size — and:

**3.2 ⚠️ The tenure block, which is the heart of it.**
`tenure ∈ {owned, head_leased, managed}` · `owner_agreement_id` (null when owned) · `tenure_from` ·
`tenure_to`.

⚠️ **On the UNIT, never the building.** The research confirmed the founder's own example: a firm can
own floors 1–5, head-lease 6–10, and manage a single flat for a third-party owner in the same tower.

**Walk:** three units in one building, one of each tenure. If that is awkward to enter, the model is
wrong and better found now.

---

## Day 4 — Bulk import

⚠️ **Nobody types 400 units.** A mid-size firm runs tens of buildings and hundreds to thousands of
units; the founder said it plainly — *"we have to upload the inventory or create every building they
have with sizes etc."*

Two sheets: buildings, then units keyed to them. Follow the *Download Template / Upload Data*
pattern the Leads screen already has.

⚠️ **Import must be forgiving.** A half-known unit is worth more than a unit not entered because a
column was blank — the Day-102 doctrine: the app must never be the reason a broker says "I can't".
Report what could not be read; import the rest.

**Walk:** a sheet of twenty units across two buildings, with a deliberate error in it.

---

## Day 5 — The owner agreement, and who the lessor is

**5.1 One agreement table, two ways to be paid.** `payment_basis ∈ {margin, fee}` — head lease or
management. Common terms either way: owner, scope, term, renewal, deposit and who holds it, service
charge / chiller / maintenance liability, escalation, break clause.
- Head lease adds `head_rent` and its schedule. ⚠️ **Money leaving the brokerage — the first time
  the app has modelled that.**
- Management adds `management_fee_pct` (5–8% residential, 7–10% commercial), `tenant_placement_fee`,
  `maintenance_markup_pct`.

**5.2 ⚠️ Owner and lessor on every tenancy.** Ejari's unified contract has both fields by law: the
title holder in Owner, the party granting the lease in Lessor. Where a unit is owned they are the
same; where head-leased or managed they differ, and that difference is what gets registered.

**Walk:** a head lease over floors 6–10, then a tenancy beneath it. The tenancy must show the
building's owner as Owner and the brokerage as Lessor, without anyone typing it twice.

⚠️ **If Day 5 walks clean, the branch merges to main.**

---

## Day 6 — The emirate as a behavioural switch

⚠️ Not a field on an address. It changes what is permitted.

| | Dubai | Sharjah |
|---|---|---|
| Registration | Ejari | Municipality attestation, **within 15 days** |
| Housing fee | 5% via DEWA | 4% via SEWA, min AED 500 |
| Head lease | management contract on Ejari | ⚠️ **investment contract only** |
| Renewal fee to tenant | convention | ⚠️ **illegal** |

⚠️ **A gate that explains itself** — warn, give the fact, let the broker decide. Never a silent
refusal. And setting `tenure = head_leased` on a Sharjah unit demands an investment-contract
reference.

⚠️ **Blocked until the emirate data is corrected** — `projects` currently says Yas Acres is in Abu
Dhabi with a city of Dubai, and Aldar Grove the reverse. Boarded Day 104. Fix the data first or the
app applies the wrong law.

---

## Day 7 — The head-lease P&L

Rent out against rent in, per building, with occupancy. ⚠️ **The business the app has never
modelled:** a fixed obligation to the owner whatever happens, so an empty floor costs the brokerage
money and occupancy is the number that matters — not commission.

---

## Carried, and deliberately not in the first seven days

- **Prospect versus tenant.** Everything in `tenants` is called a tenant whether or not anyone has
  signed. The `status` column exists; drive it. *(Small, but it touches two screens and can wait.)*
- **The phone-country fix elsewhere.** `validatePhone(phone, nationality)` is app-wide, so every
  person form has it. `TenantForm` is fixed; the others are not.
- **Two `Av.jsx` files** — `components/Av.jsx` and `modules/shared/Av.jsx`, same component.
- **`leases` duplicate columns** — contract_no/contract_number, agency_commission/agency_fee,
  ejari_no/ejari_number, no_of_cheques/number_of_cheques. The live ones are `agency_fee` and
  `number_of_cheques` per the INSERT. Leave them; a cleanup pass once leasing is proven.
- **Cheque generation from a lease.** Four cheques logged one at a time is four trips through a
  dialog. `no_of_cheques` is already on the lease — generate them, quarterly, from the annual rent.
  ⚠️ This is the feature a leasing manager would actually ask for, and it belongs right after Day 1.

---

## The standing rules, which cost a day each when broken

1. **Check before cutting.** Does the table exist? Does anything read it? Does the screen exist?
   And press the button. Four times in one month a piece turned out to be already built.
2. **A clean build says nothing about runtime.** Five dependency-array faults and four
   temporal-dead-zone errors this month, every one of them passing `npm run build`.
3. **Extracting means following every reference** — not only the obvious ones. Three build breaks
   came from moving a component without the constant it read.
4. **Warn, do not refuse.** A gate states the fact and lets the broker decide. The app must never be
   the reason someone says "I can't".

---

# ⚠️ AMENDMENT — DAY 105 (24 Oct 2026). THE PLAN HAD NO DAY FOR THE DEAL.

## What Day 1 found
Day 1 said "prove what is already built." It proved that the back half of the
leasing deal was never built. The stage gate dialog does not exist, so Offer
Made, Reserved, Lease Signed and Lost are unreachable; no lease can be created
by any sequence of clicks. Full record: `docs/Leasing_Day105_Findings.md`.

Seven faults were fixed and the detail screen renders for the first time. Day 1
is otherwise VOID — there was nothing reachable to walk.

## Why the plan missed it
Days 2-7 design INVENTORY: buildings, units, tenure, owner agreement, emirate,
import, P&L. All correct, all still needed. But the plan assumed the DEAL
JOURNEY worked and only the inventory beneath it was missing. It did not.
`Leasing_Inventory_Design.md` and `Property_Model_Design.md` contain no section
on the lease deal. It was never designed.

## ⭐ DAY 0 — THE LEASE DEAL JOURNEY (design first, then build)
Comes BEFORE Day 2. Without it there is no tenancy for the inventory to serve.

### Design, and these are founder rulings — NOT to be assumed
- What does the broker actually put to the landlord at OFFER MADE? Rent, term,
  cheques, rent-free months, move-in date — and what else is haggled (deposit,
  who pays the agency fee, chiller, maintenance)?
- What does RESERVED capture? The deposit, presumably — how much, and does it
  credit toward the first cheque the way a sales reservation credits the
  initial advance?
- What does LEASE SIGNED do beyond flipping a status — Ejari reference,
  attestation reference, the signed document?
- What does LOST record? Sales has loss reasons; leasing has `lost_reason` on
  the table and nothing driving it.
- Does the leasing ladder need an EVIDENCE MODEL (finding 9), or do ticks
  suffice for a shorter cycle?

### Then build
- The gate dialog itself (the thing that does not exist).
- ⚠️ The Offer Made gate IS the lease terms form. Capture there and the
  agreement renders what was agreed instead of prompting for it. One build,
  not two — and it kills the interim prompts from Day 105.
- `final_rent` written at Offer Made; the lease then takes `final_rent` ONLY,
  refusing without it (finding 10).

### Destination, already ruled (Leasing_Inventory_Design 3.4)
A tenancy carries: owner_party_id AND lessor_party_id (both mandatory) ·
tenant · unit · term · annual rent · deposit · cheques · agency commission ·
permitted use · registration reference and status.
⚠️ `leases` today has NONE of owner/lessor/permitted use/registration. Day 5
extends it. Day 105's join fix points at the old shape and holds, but it is
not the finished tenancy.

## Days 2-7 — UNCHANGED, and still right
The inventory work stands exactly as written. It moves behind Day 0 because a
building full of units serves no purpose while no tenancy can be signed.
