# Resale — the design

Written Day 101, from `docs/Resale_Practitioner_Answers.md` and the founder's rulings in session.
Nothing here is built. This is what to build and why, so the next session starts from a document
rather than from memory.

---

## 1. What makes resale different

Off-plan has **one counterparty who is slow**: the developer. Resale has **four** — the seller, the
buyer, the developer's NOC desk, and the bank — and any one of them can stall the deal while a
clock runs.

Every deal-killer the practitioner named is the same failure in a different place:

| What he said | What it is |
|---|---|
| The bank does not issue the NOC on time | A deadline nobody watched |
| The buyer's funds were never verified before Form F | A check nobody made |
| The seller changed his mind, tempted by a better offer | A person nobody kept warm |

> "This could be identified earlier if the CRM tracked the bank NOC deadline and followed up
> automatically." — the practitioner, unprompted, describing the product.

⚠️ **So the app's job in resale is watching, not recording.** The stages are only what sits between
the deadlines. Design from the clocks outward.

---

## 2. The object model

**A resale deal IS an opportunity.** Founder's ruling: the same object, with the seller's details on
it and the buyer arriving later. Not a new type, not a parallel table.

What it carries that an off-plan opportunity does not:

- **A seller** — a person, with an ID and a title deed
- **A property** — which *may or may not* already exist in PropPulse (founder: "may or may not be").
  So the app must accept both: link to a known `project_unit`, or capture a new one from the title
  deed. A resale of an Emaar unit the platform already knows should reuse that record; a villa in a
  building nobody has catalogued must be typeable.
- **Two sides**, either of which may belong to another brokerage
- **Two agents**, potentially — one who won the listing, one who brought the buyer

⚠️ **A LISTING EXISTS BEFORE A BUYER DOES.** The broker wins the right to sell, markets it, and
finds a buyer later. So the pipeline has two halves — *acquire the listing*, then *find the buyer* —
and a deal can sit legitimately in the first half for months.

---

## 3. The stages

From the practitioner's phase description. Each arrow is a place a deal can die.

```
  LISTING WON            Form A signed - the seller's listing agreement
       |
  MARKETING              Dubizzle, Property Finder, MLS, the agent's own network
       |
  BUYER FOUND            Form B - the buyer's representation agreement
       |
  QUALIFIED              ⚠️ purpose (investor / flipper / end-user) AND PROOF OF FUNDS
       |
  FORM F SIGNED          the MOU. ⚠️ A LEGAL COUNTDOWN STARTS HERE
       |
  PHASE 1: DEVELOPER NOC   seller applies · 3-7 working days · ⚠️ VALID ONLY 15-30 DAYS
       |
  PHASE 2: TRUSTEE APPOINTMENT   booked 1-3 days ahead
       |
  PHASE 3: TRANSFER DAY    manager's cheques · liability clearance · ⚠️ COMMISSION COLLECTED HERE
       |
  PHASE 4: HANDOVER        keys, once the required amounts are paid
```

**In parallel, where there is a mortgage** — and there is in more than half of deals:

```
  MORTGAGE PRE-APPROVAL  ->  BANK NOC  ->  (must land before the trustee appointment)
```

⚠️ **The bank NOC is the single most common cause of loss.** It runs alongside the main chain and
nothing in the stage list forces anyone to look at it. It needs its own visible clock.

---

## 4. The deadlines — the heart of it

These are not stage names. They are dated obligations, each with a consequence.

| Clock | Starts | Runs | If it lapses |
|---|---|---|---|
| **Form F countdown** | Form F signed | per contract | Breach, penalties, dispute |
| **Developer NOC issue** | seller applies | 3–7 working days | Nothing yet — but the transfer waits |
| **⚠️ NOC validity** | NOC issued | **15–30 days** | ⚠️ **Reapply and pay again** (AED 500–5,000) |
| **Bank NOC** | mortgage applied | varies, often late | The most common deal-killer |
| **Trustee appointment** | booked | 1–3 days ahead | Rebooking, and both parties must attend |

⚠️ **THE NOC IS THE PIECE THE APP MUST HOLD.** It expires, it is single-use, and it is void if the
buyer, seller or property details change between issue and transfer. An expired NOC costs money and
days. That is a deadline with a price attached — exactly what the app's gates exist for.

**What the app should do about it:**
- Record the issue date and compute the expiry
- Warn as it approaches, in the deal and on the dashboard
- ⚠️ **Refuse silently at nothing** — an expired NOC does not block the deal; it tells the broker
  plainly that a new one is needed and what it will cost
- Flag it as void if the buyer, seller or unit changes after issue

---

## 5. Commission — a different shape entirely

Off-plan: one developer, one rate from one master agreement, invoiced and chased for weeks.

Resale: **two sides, both paying, on one day, in a room.**

- **2% from the seller and 2% from the buyer** when the brokerage represents both — the norm, not a
  rule. Founder: the rate must be a free hand per deal, "that is where the money is in resale."
- **Collected at the trustee office on transfer day**, from both parties.
- **Either side may belong to another brokerage**, in which case only one side is yours.

**So the model is per-side, not per-deal:**

```
  seller side:  rate or flat fee  ·  our agent  ·  or "other brokerage: <name>"
  buyer side:   rate or flat fee  ·  our agent  ·  or "other brokerage: <name>"
```

⚠️ **AND TWO AGENTS CAN SHARE ONE DEAL** — the one who won the listing and the one who brought the
buyer. Today `agent_commission` is one figure for one agent. Resale needs attribution per side.
That also answers referrals: a colleague who introduces a buyer is that side's agent, or a named
share of it.

### ⚠️ Open, and asked of the practitioner (docs/Resale_Followup_Questions.md)

**Who physically collects when two brokerages are involved?**

- **(a)** Each firm takes its own cheque at the trustee office, or
- **(b)** One firm collects both and passes the other its share?

**Working assumption until he answers: (a).** It is simpler and more likely, and if (b) turns out to
be common the change is additive.

⚠️ **But (b) would be structural.** The app has only ever tracked money owed **IN** — a developer
owes, the brokerage chases. If a firm can owe money **OUT** to another brokerage or to a referrer,
that is a second kind of record, and the Receipts & Payouts view would need a third half.

---

## 6. Inventory — the broker builds it

⚠️ **This is the piece that surprised the architect and it changes the work considerably.**

Off-plan inventory arrives automatically: PropPulse collects units from developers, and the broker
picks from what exists.

**Resale inventory is the broker's own.** He wins a listing on a specific unit in an existing
building and must record it himself — from the title deed, with the seller in front of him.

So resale needs:
- A way to **create a property record** that is not in PropPulse
- A way to **link to one that is**, without duplicating it
- **The title deed** as the source document, and the seller's ID
- The **service-charge position**, because the developer will check it before issuing the NOC

⚠️ **And the listing itself is an asset.** A brokerage with forty exclusive listings has something
worth more than forty leads. Whether the app should treat listings as inventory to be marketed —
matching them to buyer requirements — is a genuine product question, not yet decided.

---

## 7. Leasing — shorter than resale, not smaller

Worth stating now because it is often assumed to be a variant of sale, and it is not.

- **Commission: 5% of the annual rent, paid by the TENANT** — minimum around AED 5,000, whichever is
  higher, plus 5% VAT. One side, not two.
- Documents: unified tenancy contract · **Ejari registration** · identity and ownership verification
- ⚠️ **The brokerage's involvement ENDS** at Ejari registration and commission collection. What
  follows is a property management company's work, under its own RERA agreement.

So leasing is a **short, one-sided transaction with a hard stop** — closer to a well-defined task
than to the four-phase chase resale requires. It should be built after resale and will take less.

---

## 8. What to build first

In order, and the first is not code:

1. **⚠️ Settle the commission-collection question** with the practitioner. It decides whether money
   can flow out of the brokerage, and that is structural.
2. **The property record** — create-or-link, from the title deed. Nothing else can start without it.
3. **The listing as an opportunity** — seller, Form A, asking price, marketing state.
4. **The stage chain** through to transfer day.
5. **⚠️ The deadlines, with the NOC first.** This is the differentiator and the practitioner named
   it himself. Build it early enough that the rest is designed around it rather than after it.
6. **Per-side commission**, with two agents.
7. **Transfer day** — the ceremony where both commissions arrive at once.

## ⭐⭐ ADDED DAY 102 - A RESALE IS TWO SHAPES, AND ONE OF THEM IS THE APP'S BEST ARGUMENT
A resale is not one transaction type. It depends on whether the DEVELOPER IS STILL OWED.
 1. **COMPLETED PROPERTY** - title transferred, the developer is gone. The buyer pays the seller,
    the trustee registers it, both sides pay commission. Two parties and a clock.
 2. ⚠️ **OFF-PLAN, PART PAID** - the developer is STILL A PARTY. The buyer takes over the remaining
    payment plan, and the developer must ACCEPT HIM as the new debtor. That is part of why the NOC
    matters: he is not only confirming service charges are clear, he is accepting who pays him next.
    The practitioner's note that commission is normally taken "when 25% of the property is paid"
    points the same way - a resale before that may not be permitted at all.
⭐ THE SECOND CASE IS WHERE THE APP HAS AN ADVANTAGE NOBODY ELSE HAS. Founder's example: a man loses
his job, wants to leave the country, and is not interested in keeping anything. His first question is
"what do I actually walk away with?" - and that answer requires: everything he has paid across a
dozen instalments, the plan the buyer inherits, the DLD and admin fees he will NOT recover, and a
sale price that may be below what he has put in.
⚠️ THE APP ALREADY HOLDS EVERY ONE OF THOSE FIGURES, because it recorded them when the unit was sold.
A broker sitting with a distressed seller can show him his true position in a minute. No competitor
can compute it, because none of them were there for the first sale. THAT CONVERSATION EITHER WINS
THE LISTING OR LOSES IT.
BUILD ORDER NOTE: case 1 is simpler and probably more common. Build it first; the off-plan transfer
after.
