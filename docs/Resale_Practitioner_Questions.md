# RESALE — QUESTIONS FOR THE PRACTITIONER
**Day 91.** For the contact the partner offered — someone who does resale daily.

The design document (`Resale_Secondary_Market_Question.md`) already has the shape. What it does
not have is how the work **actually goes**, and two of its open questions decide whether this is a
fortnight or considerably more. Those two are marked ⭐.

This is deliberately short. A long questionnaire gets skimmed; these are the questions whose
answers change what gets built.

---

## THE TWO THAT SIZE THE BUILD

### ⭐ 1. Does the broker ever HOLD money?
A deposit, an earnest payment, anything sitting in the brokerage's account even briefly?

- **If he only ever witnesses and records** transfers between buyer, seller and the trustee —
  the existing ledger works almost as-is. The parties change, not the mechanics.
- **If he holds it** — that is escrow, with liability attached, reconciliation, and a materially
  bigger build.

### ⭐ 2. Who pays the broker, and when?
Off-plan it is the developer, on a master agreement, at SPA or on registration.

- Buyer, seller, or **both sides**?
- Is it a percentage each side, or one fee split?
- Paid at the trustee office on the day, or invoiced afterwards?
- **What happens when the deal collapses after the NOC** — is anything owed?

---

## HOW THE WORK ACTUALLY GOES

### 3. Walk one deal end to end
From the day a seller instructs you to the day the keys change hands. Name each step and roughly
how long it takes. We want the **real** sequence, including the parts everyone complains about.

### 4. What documents exist, and who issues them?
Form A, Form B, Form F, the NOC, the MOU — which are real in practice, which are formalities, and
which one being late stops everything?

### 5. The NOC
- Who requests it, and from whom?
- How long does it take, and what does it cost?
- **Does it expire?** If so, in how long — and what happens if it does?

### 6. Mortgage deals
- What share of resales involve a buyer mortgage?
- What does it add to the timeline — valuation, pre-approval, the bank's own NOC?
- Where does it most often go wrong?

### 7. The transfer appointment
- Who books it, and how far ahead?
- What must be in hand before the day?
- **What happens if one party does not appear?**

---

## THE ONE THAT MATTERS MOST

### ⭐ 8. Where do you LOSE deals?
Not what is slow — what actually **costs you the commission**. The seller who changed his mind at
week six, the NOC that expired unnoticed, the buyer whose mortgage fell through, the appointment
nobody confirmed.

For each: **how far in advance could you have seen it coming?**

This is the question the software answers. The founder's own framing to the partner:

> "No pain, no gain — agreed. We are not selling relief from the work. We are selling **not losing
> the deal to the mess**. A broker who chases an NOC for three weeks and then loses the deal
> because the appointment lapsed got the pain without the gain."

---

## LEASING, BRIEFLY

Basic leasing forms exist in the app already and `companies.business_type` drives the vertical
switch, so leasing is part-built rather than absent.

### 9. Is leasing a different job, or a smaller sale?
- Ejari, the tenancy contract, cheques post-dated across the year
- Who pays the commission, and is it a percentage of annual rent?
- **Does the brokerage manage the property afterwards** — collecting rent, holding deposits,
  arranging maintenance? That is where the broker starts holding other people's money, and it is a
  different ledger with different obligations.

---

## WHAT WE WILL DO WITH THE ANSWERS

Questions 1 and 2 size the build. Question 8 decides what the product is *for* — the app already
does exactly this for off-plan: a booking clock that counts down, a nudge when a developer goes
silent, a variance that will not settle quietly. The resale equivalents come straight from his
answer.

Everything else shapes the ladder: the stages, the gates, the documents, the fees.

⚠️ **Nothing here should be guessed at.** The design document says it plainly and it is worth
repeating: *speculation in a design doc reads as fact six months later.*
