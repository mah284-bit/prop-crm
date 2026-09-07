# The property model — sales, leasing and management

Written Day 102, from an hour's conversation with the founder. It supersedes the narrower assumption
in `docs/Resale_Design.md` that resale is simply another deal type. It is not. Resale is one act in a
property's life, and the app's real value is holding all of them.

**Nothing here is built.** This is the foundation the next months rest on.

---

## 1. What we got wrong, and how

The architect began the morning designing a `pp_listings` table with a `listing_type` of sale or
lease. The founder's questions took it apart in three steps:

1. *"A property can be listed for sale and for rent at the same time."* — so type is not a property
   of the listing.
2. *"Al Mansoori may rent other properties where they have taken buildings on lease."* — so the
   brokerage is not always an agent. Sometimes it is the **principal**.
3. *"I am living in Majaz Tower, and for all lease agreements I go to H&H Real Estate."* — H&H holds
   the head lease on that building. Every tenancy there is theirs, not an owner's. And the same firm
   separately sells property and takes other buildings.

⚠️ **The insight: these are not three product types. They are three businesses that touch the same
property**, and a firm may run one, two or all three.

---

## 2. The property is durable; the engagement is not

**A PROPERTY exists whoever owns it and whatever the brokerage is doing with it.** Its address, size,
title deed, developer and community do not change when it is sold, let, or managed.

**An ENGAGEMENT is what the brokerage is doing with it now.** It has a start, an end, a counterparty
and its own money. A property has many engagements over its life, sometimes two at once.

⚠️ **THE LIFECYCLE THIS MAKES POSSIBLE**, and it is the reason the app is worth more than a CRM:

```
  2026  sold off-plan       the brokerage earns from the developer
  2028  handed over         the buyer is abroad and needs it run
  2028  MANAGED             an owner agreement, a fee, tenants found and rent remitted
  2031  RESOLD              ⭐ and the cost basis from 2026 is still on the record
```

The same firm, the same property, four engagements, five years. Nobody else can show a seller what
his unit cost him in 2026 because nobody else was there.

---

## 3. The three businesses

| | **Sales** | **Leasing** | **Management** |
|---|---|---|---|
| Counterparty | developer, or seller | the **building's owner** | the **unit's owner** |
| The brokerage is | agent | ⚠️ **principal** | agent |
| Money in | commission on completion | rent from subtenants | a fee, usually % of rent |
| Money out | none | ⚠️ **rent to the owner, whatever happens** | rent remitted to the owner |
| Bears a void | nobody | ⚠️ **the brokerage** | the owner |
| Grain | a unit | ⚠️ **a whole building** | a unit |

⚠️ **LEASING IS THE ODD ONE AND THE RISKIEST.** The brokerage takes a building on a head lease, pays
the owner a fixed rent, and sublets. Occupancy is the number that matters, not commission. An empty
floor costs them money. That is a different business from broking, with a P&L per building, and the
app models none of it today.

**Management sits with sales, not apart from it** — founder's ruling. A broker manages the
properties he sold: his buyer is abroad, the flat needs running, and the relationship already
exists. It is the natural continuation of a sale, not a separate line of business.

---

## 4. The modes — unchanged, and correct

`companies.mode` already carries three values and they still fit:

| Mode | What it covers |
|---|---|
| **Sales** | off-plan · resale · **and managing what he sold** |
| **Leasing** | taking buildings on lease and subletting them |
| **Both** | everything |

⚠️ **NO MIGRATION NEEDED.** The architect proposed replacing the mode with three independent flags;
the founder's framing showed that management belongs inside sales, so three values are enough.

⚠️⚠️ **THE PROPERTY IS THE ONLY LINK.** Founder, on how the three connect: "only the property is
linked, that's all - so any time they want to see it from the leasing point." A leasing user opening
a property sees its tenancies, its rent, its maintenance. He does not see the commission earned on
its sale, the buyer's payment plan, or the developer's terms. The property is the join and nothing
else crosses it.

⚠️ **AND THE INDEPENDENCE RULE IS ABSOLUTE:** a firm doing only off-plan must never see a head-lease
screen, a maintenance request or a tenancy. Nothing in one business may require a record from
another. A letting must not need a management agreement; a resale must not need the property to have
been sold through the app.

---

## 5. The owner agreement — one document, two ways to be paid

⚠️ The founder collapsed two structures into one: *"This contract easily can play a role for the
buyer who bought the flat and has a contract to maintain their property at the same time."*

A **management agreement** and a **head lease** are the same shape. They differ only in how the
brokerage is paid:

| | Management | Head lease |
|---|---|---|
| Over | one unit, or several | usually a whole building |
| Brokerage pays the owner | nothing — collects and remits | ⚠️ a fixed rent, whatever happens |
| Brokerage takes | a **fee** | the **margin** |
| If a unit sits empty | the owner loses | ⚠️ the brokerage loses |

So: **one owner agreement**, with a term saying `fee` or `margin`. What it carries either way —
the owner, the property or building, the term, renewal, deposit and who holds it, what is included
(maintenance, service charges, utilities), annual escalation, and any break clause.

---

## 6. What exists already, and what does not

⚠️ Checked Day 102, and it matters — three times this month a piece turned out to be half-built.

**Tables that exist and are EMPTY AND UNREAD by any screen:**
`pp_listings` (created months ago, matches this design closely by coincidence) · `maintenance` ·
`rent_payments` · `tenants` · `unit_lease_pricing`

**Leasing has ~2,000 lines of screen code** — `LeasingModule.jsx`, `LeaseOpportunityDetail.jsx`,
`LeasingLeads.jsx` — against `lease_opportunities`, `lease_contracts`, `leases`, `lease_cheques`,
all of which hold **zero rows**. Built months ago, never walked.

⚠️ **AND LEASING GOES STRAIGHT TO `project_units` FOR THE PROPERTY** — so it assumes the unit is
already in the PropPulse catalog. That is fine for a developer's tower and wrong for a landlord's
villa nobody has catalogued. Resale has the same gap: ⭐ **resale and leasing inventory is the
BROKER'S OWN**, recorded from a title deed with the seller in front of him. PropPulse does not
supply it.

---

## 7. Open questions

1. **⚠️ Is a BUILDING a record distinct from a unit?** A head lease is over a building; a sale is
   over a unit. `projects` may already serve — worth checking whether a project can be one tower
   rather than a development.
2. **Who collects commission when two brokerages share a resale?** Out with the practitioner
   (`docs/Resale_Followup_Questions.md`). If one firm collects both sides and passes the other its
   share, money flows OUT of the brokerage for the first time.
3. **Can one property carry two live engagements** — listed for sale while tenanted? Almost
   certainly yes, and the model must allow it.

---

## 8. Build order

1. **⭐ The property record** — durable, create-or-link, from the title deed. Everything rests on it.
2. **Resale** — as designed in `docs/Resale_Design.md`, now hanging off the property.
3. **Leasing** — walk the 2,000 existing lines first and find out whether they are a week from
   working or a rewrite. Do not assume either.
4. **Management** — the owner agreement, tenancy on the owner's behalf, rent collection and
   remittance, maintenance, and an owner statement. Nothing of this exists.

⚠️ **Build the property record ONCE, correctly, for all three businesses.** Doing it three times is
how a codebase acquires three tables for the same idea — which is exactly what the four role lists
had become before Day 97.

## ⚠️ CORRECTION (Day 102, same session) - MANAGEMENT IS LARGELY BUILT
Section 6 above says the management tables exist "empty and unread by any screen." That was wrong,
and pressing the button found it: `LeasingModule.jsx` is a full PROPERTY MANAGEMENT module with five
tabs - Dashboard, Tenants, Leases, Payments, Maintenance - holding real tenant records including a
company tenant with a trade licence. It was unreachable only because the App.jsx render referenced a
component that was NEVER IMPORTED; every click threw "LeasingModule is not defined". Shelved work
decaying, not work never done.
⚠️ SO THE GAP IS NARROWER AND DIFFERENT: the TENANT-FACING machinery is there. What is absent is the
OWNER SIDE - the owner whose flat it is, the agreement with him, the fee the brokerage takes, and
the statement it sends him. Which fits: this was built for the LEASING ARM AS PRINCIPAL, where the
brokerage IS the landlord and there is no owner to report to. Managing someone else's unit for a fee
needs the owner relationship added on top of machinery that already works.
