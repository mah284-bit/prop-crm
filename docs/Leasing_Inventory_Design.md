# Leasing inventory — the design

Written Day 104, from research into how Dubai and Sharjah leasing firms actually hold stock
(`docs/UAE_Leasing_Inventory_Research.md`) and a survey of what the database already has.

It is the leasing half of `docs/Property_Model_Design.md`. Nothing here is built yet.

---

## 1. Why leasing inventory cannot reuse the sales tables

The founder said it before the research confirmed it: *"the inventories cannot be merged for sales
and leasing."* The column lists settle it.

**`project_units` is a sales record.** Its money columns are `original_price`, `current_price`,
`price_per_sqft`, `eoi_amount`, `booking_amount`; its dates are `handover_date`; its provenance is
`is_pp_listed`, `pp_source_unit_id`, `pp_last_updated`. It describes **a unit a developer is
selling**.

It carries **none** of what letting a unit requires:

| A letting needs | `project_units` has |
|---|---|
| Chiller provider, and **who pays** | — |
| Parking bays allocated | `parking_spaces` (a count, not an allocation) |
| Cheques accepted (1/2/4/6/12) | — |
| Rent-free period offered | — |
| Ejari status / Sharjah attestation | — |
| Current tenancy end date | — |
| Permitted use (trade-licence match) | `purpose` |
| Rent | ⚠️ bolted on the side in `unit_lease_pricing` |

⚠️ **And `projects` is mostly PropPulse catalogue data** — 178 rows, only 35 with a `company_id`,
alongside `pp_developer_id`, `pp_confidence_score`, `pp_data_source`, `is_pp_verified`. The Decision
Log says PropPulse tables are **global, never tenant-filtered**. A building a brokerage holds on a
head lease is **their** record, not the market's catalogue — the same distinction that sent the
developer fees to `pp_developer_fees` on Day 96 rather than the shared `pp_developers`.

**So: a separate inventory, joined to the sales catalogue only where a building happens to appear in
both.**

---

## 2. What the research changed

Three findings neither of us would have reached by reasoning:

### ⚠️ 2.1 Owner and Lessor are different fields, by law

Ejari's unified tenancy contract has a section headed *Owner / Lessor Information* with **two
separate fields**: the **Owner** (from the title deed) and the **Lessor** (the party actually
granting the lease). Where a brokerage holds a head lease or a management mandate, **the brokerage
is recorded as Lessor while the title holder stays as Owner.**

⭐ **So every tenancy stores two parties, always.** Not "landlord". Owner *and* lessor.

The enabling instrument in Dubai is a **property-management contract registered on Ejari**, plus a
building *leasing details upload* — a property must exist in DLD's leasing database before any
tenancy against it can be registered.

### ⚠️ 2.2 Sharjah bans subletting

**Law No. 5 of 2024 prohibits subletting in Sharjah** — it is a ground for eviction. The head-lease
model is legal there **only** through a Municipality-ratified **investment contract**, which
requires the sub-lessor's commercial licence, the title deed, the map and the printed contract.

Sharjah also: has **no Ejari** (contracts are attested at the Municipality within **15 days**),
charges a **4% housing fee via SEWA** (minimum AED 500) rather than Dubai's 5% via DEWA, and makes
**charging a tenant a renewal fee illegal**.

⭐ **So the emirate is not a field on an address. It changes what is permitted.**

### ⚠️ 2.3 Tenure sits on the unit

Confirmed directly: a firm can own floors 1–5, head-lease floors 6–10, and manage a single flat for
a third-party owner **in the same tower**. Buying a floor from a developer and letting it is a
standard acquisition path.

⭐ **So tenure attaches to the unit (or a floor-group of units), never to the building.**

---

## 3. The model

```
  BUILDING            the physical thing. No ownership claim.
      |               city · area · building number · name · plot · floors · units
      |               developer (where known) · optional link to a catalogue project
      |
      +-- UNIT        floor · number · type · size · asking rent
      |               ⚠️ TENURE: owned | head_leased | managed
      |               + the owner agreement it falls under, when not owned
      |               + the letting attributes (chiller, parking, cheques, Ejari…)
      |
  OWNER AGREEMENT     with a landlord, over a building, floors, or single units.
                      ⚠️ ONE SHAPE, TWO WAYS TO BE PAID:
                        head lease  -> we pay a fixed rent, we keep the margin, we bear the void
                        management  -> we collect and remit, we take a fee, the owner bears the void
      |
      +-- TENANCY     tenant · term · rent · cheques
                      ⚠️ owner_party AND lessor_party, both recorded
                      + registration: Ejari (Dubai) or Municipality attestation (Sharjah)
```

### 3.1 Building

Tenant-owned. `pp_listings` already carries `building_name`, `community`, `emirate`, `plot_number`,
`title_deed_no` — so part of this exists, unused, and should be examined before a new table is cut.

Fields: company · name · building number · street · area/community · city · emirate · plot number ·
developer (text, or a link to `pp_developers`) · floors · total units · year built · optional
`project_id` where the building **is** a catalogued project · notes.

⚠️ **The `project_id` link is optional and one-way.** A building the brokerage holds need not exist
in PropPulse, and linking must never make the building's record depend on catalogue data.

### 3.2 Unit

Fields: building · floor · unit number · type (studio/1BR/office/retail/warehouse) · size ·
bedrooms · bathrooms · view · parking bays · furnishing.

**Letting-specific, all absent from `project_units`:**
- `chiller_provider` (Empower / Emicool / central / none) and **`chiller_paid_by`** (landlord /
  tenant). Chiller is 20–30% of a tenant's monthly cost, so *chiller-free* is a headline filter.
- `cheques_accepted` — 1/2/4/6/12. A core negotiating lever.
- `rent_free_months` — and other incentives.
- `permitted_use` — for commercial, must match the tenant's trade licence.
- `asking_rent`, `service_charge_liability`, `maintenance_liability`.
- `current_tenancy_id` and its end date, for the renewal window.

**And the tenure block:**
- `tenure` — `owned` | `head_leased` | `managed`
- `owner_agreement_id` — null when owned
- `tenure_from`, `tenure_to` — because tenure changes over the years

### 3.3 Owner agreement

One table, a `payment_basis` of `margin` (head lease) or `fee` (management).

Common: owner party · scope (whole building / named floors / named units) · term · start · end ·
renewal · deposit and who holds it · service-charge liability · chiller liability · maintenance
liability · escalation (percent or index) · break clause · notes · document.

**Head lease only:** `head_rent` payable to the owner, and its schedule. ⚠️ This is money going
**out** of the brokerage — the first time the app has modelled that.

**Management only:** `management_fee_pct` (5–8% residential, 7–10% commercial per the research) ·
`tenant_placement_fee` · `maintenance_markup_pct`.

**Registration:** `dld_management_contract_ref` for Dubai; `sharjah_investment_contract_ref` where
the Sharjah route applies.

### 3.4 Tenancy

⚠️ **`owner_party_id` and `lessor_party_id` are both mandatory.** Where tenure is `owned` they are
the same; where it is `head_leased` or `managed` they differ, and that difference is what Ejari
records.

Plus: tenant · unit · term · annual rent · deposit · cheques (already modelled well in
`lease_cheques`) · agency commission · permitted use · registration reference and status.

---

## 4. What the emirate changes

⚠️ **Not a display field. A behavioural switch.**

| | **Dubai** | **Sharjah** |
|---|---|---|
| Registration | Ejari | Municipality attestation, **within 15 days** |
| Housing fee | 5%, via DEWA | **4%, via SEWA**, minimum AED 500 |
| Subletting | permitted with owner consent | ⚠️ **prohibited** — investment contract only |
| Renewal fee to tenant | convention | ⚠️ **illegal** |
| Rent increase | RERA index, 90 days' notice | own rules |

⚠️ **So `tenure = head_leased` must be refused in Sharjah** unless an investment-contract reference
is present. That is a gate with a legal consequence, and it is exactly the kind the app exists for —
warn, explain, record, and let the broker decide with the fact in front of him.

---

## 5. The money, by tenure

| | Rent in | Rent out | Our revenue | Void costs |
|---|---|---|---|---|
| **Owned** | ours | — | the rent | lost income |
| **Head leased** | ours | ⚠️ fixed, whatever happens | ⚠️ **the margin** | ⚠️ real money |
| **Managed** | the owner's | remitted to him | a fee | the owner's |

⚠️ **Head lease is the one the app has never modelled:** a fixed obligation going out, occupancy as
the number that matters, and a P&L per building. An empty floor costs the brokerage money.

**Commission** (research-confirmed, and configurable rather than hard-coded because it is convention
and not statute): **5% of annual rent, minimum ~AED 5,000, plus 5% VAT, paid by the tenant** for
residential; **5–10% for commercial**. ⚠️ **On head-leased or owned stock the brokerage charges no
commission at all** — it is the landlord, and its return is the rent or the margin.

---

## 6. Before anything is built

Following the Day-102 rule, three checks first:

1. **`pp_listings`** — it has `building_name`, `community`, `emirate`, `plot_number`,
   `title_deed_no` and is read by nothing. Does it become the Building table, or part of it?
2. **`projects` with a `company_id`** — 35 of 178 rows have one. What are they, and does a
   tenant-owned building already live there?
3. **`unit_lease_pricing`** — it holds the rent today. What else is in it, and does it become part
   of the leasing unit?

⚠️ Four times this month a piece turned out to be already built. Check before cutting.

---

## 7. Build order

1. **The three checks above.**
2. **Building and Unit**, tenant-owned, with the letting attributes and the tenure block.
3. **Bulk import** — a firm with fifteen buildings and 400 units will not type them. Two sheets:
   buildings, then units. The Leads screen already has a *Download Template / Upload Data* pattern
   to follow.
4. **Owner agreement** — one table, `margin` or `fee`.
5. **Point the tenancy at the new unit**, with owner and lessor both recorded.
6. **The emirate switch** — Sharjah's constraints as a gate that explains itself.
7. **The head-lease P&L** — rent out against rent in, per building, with occupancy.

⚠️ **Steps 1–3 are the foundation.** Everything after depends on a unit record that knows what it
is and who holds it.

## 8. ⚠️ "Subletting" means two different things

Worth stating plainly, because the two are confused in ordinary speech and are entirely different in
law. The founder raised it and he was right about the thing he was describing.

**A TENANT subletting his flat** — taking a two-bedroom and putting a family in the spare room — is
**banned across the UAE**. It breaches the tenancy, it is a ground for eviction, and it happens
quietly until something goes wrong.

**A LICENSED COMPANY taking a head lease** on a building and letting the units is a **registered
commercial structure**, not that. In Dubai it runs through a property-management contract registered
on Ejari; in Sharjah through a Municipality-ratified investment contract. The firm is the lessor of
record, with the title holder in the Owner field.

⚠️ So when this design says "head lease", it means the second. The app should never be the system of
record for the first - and where a broker records a tenancy on a unit whose tenure says `managed`
and whose owner agreement has expired, that is worth a warning, not silence.
