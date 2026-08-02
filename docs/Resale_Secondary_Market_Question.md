# RESALE / SECONDARY MARKET - SCOPE QUESTION (Day 79, OPEN)
Surfaced while checking VAT. Not a VAT question with a small answer - resale is a SECOND
TRANSACTION TYPE. Captured now; deliberately NOT in scope today.

## WHAT THE APP MODELS TODAY
NEW OFF-PLAN RESIDENTIAL only. One buyer, one developer, a developer payment plan, DLD 4%,
Oqood registration, SPA with the developer. Every ceremony, gate and money surface assumes this.

## WHY RESALE IS DIFFERENT - AND NOT JUST TAX
- **There is a SELLER.** A resale has two parties the app does not model. Who is the client?
  Does the broker act for both sides? Commission may come from both.
- **No Oqood** - that is off-plan registration. A resale is a TITLE TRANSFER.
- **No developer payment plan** - the buyer pays the seller, often with a MORTGAGE (a financing
  path the app has no concept of).
- **Different fee set** - NOC fee, trustee fee, agency fee on both sides, mortgage registration.
  DLD is still 4% but the split conventions differ.
- **VAT**: new residential = first supply, ZERO-RATED. Resale residential = subsequent supply,
  generally EXEMPT. Different rule, same practical outcome on the price - but the seller's
  position differs. Commission stays standard-rated 5% either way.
  (NOT tax advice - to be confirmed with the founder's accountant. See the VAT question below.)

## FOUNDER'S COMMERCIAL OBJECTION (Day 79) - THE REAL ISSUE
"If a broker company cannot do resale, why should I buy your software? Will be HEAVY PUSHBACK."
CORRECT. Most UAE brokerages transact both primary and secondary. An off-plan-only CRM answers
half a brokerage's business. This is a GO-TO-MARKET question, not only an engineering one:
either resale ships before wide sale, or the pitch is deliberately positioned as off-plan/primary
specialist (which is a real segment, but a narrower one).
DECISION TODAY: resale is NOT being built now. The question is BANKED with its full shape so it
can be sized properly when the founder chooses.

## THE VAT QUESTION (open, for the accountant)
Already handled: brokerage COMMISSION is standard-rated 5% and the app computes it (commission
preview shows net + VAT).
TO CONFIRM: (1) is the brokerage's SPA fee / admin uplift VAT-rated, or a developer pass-through?
(2) must the payment RECEIPT be a valid TAX INVOICE - TRN, sequential number, date of supply,
net/VAT/gross, the words "Tax Invoice"? (3) any commercial units in scope? (commercial property
IS standard-rated 5% on the price - that would touch every money surface).
SIZING: if VAT applies only to commission, NOTHING to build. If brokerage fees are VAT-rated or
documents must be tax invoices, roughly half a day each. Commercial units in scope would be large.

## HOW BIG IS THIS? (open, Day 79)
Founder's recollection is that brokers may earn more from resale than from new sales. Unverified,
but the mechanics are consistent with it: resale often pays commission from both sides and lands
at transfer, whereas off-plan is paid once by the developer, sometimes in tranches.
IF that holds, an off-plan-only CRM would be evaluated against work a brokerage earns less on -
which is a positioning question as much as a build one.
TO ESTABLISH BEFORE DECIDING: the real primary/secondary revenue split for the brokerages we are
targeting. If the target segment is developer-aligned and primary-weighted, off-plan-only is a
defensible specialism. If not, resale rises up the list.

## THE TWO QUESTIONS THAT SHAPE THE BUILD (Day 80, founder to establish)
Raised by the architect and deliberately NOT answered by assumption - this is market knowledge
the founder will confirm.
1. **DOES THE BROKER EVER HOLD MONEY IN A RESALE?** A deposit, an earnest payment - or does he
   only ever WITNESS and RECORD transfers between buyer, seller and the trustee office?
   - ONLY RECORDS -> the ledger model works largely as-is; the PARTIES change, not the mechanics.
   - HOLDS MONEY -> that is escrow, with liability attached, and a materially bigger build.
2. **WHO PAYS THE BROKER?** Off-plan it is the developer. In a resale - buyer, seller, or both?
   Two-sided commission changes the commission model, not just the deal record.
HOW RESALE MONEY ACTUALLY MOVES: NOT ESTABLISHED. To be confirmed by the founder from the market,
not assumed here. Speculation in a design doc reads as fact six months later.

## WHAT IS STRUCTURALLY DIFFERENT (not just "some calculations change")
- THERE IS A SELLER - a person, often the broker's own client. The app has one counterparty
  (a developer). Two clients in one deal, possibly two commissions. Nothing models this.
- NO DEVELOPER means no payment plan, no Oqood, no developer approval, no master-agreement rate -
  half the money engine's inputs come from a party that does not exist in a resale.
- THE MONEY FLOW REVERSES: buyer pays the SELLER, usually in one transfer, often with a MORTGAGE -
  which introduces a bank, a valuation and a timeline the app has no concept of.
- DIFFERENT FEES: NOC from the developer, trustee office fee, DLD 4% still, NO Oqood.
CONCLUSION: a SECOND TRANSACTION TYPE, not a variant. Roughly a fortnight, not an afternoon.

## VAT — ANSWERED DAY 82 (public sources), TWO ITEMS STILL FOR THE ACCOUNTANT
UAE standard, confirmed across several 2026 sources: 5% VAT applies to the brokerage COMMISSION,
never to the property price. Commission 40,000 -> VAT 2,000 -> 42,000 payable to the agency. The
brokerage must be VAT-REGISTERED and must issue a valid TAX INVOICE. The 4% DLD transfer fee is a
government charge and is NOT subject to VAT.
The app's arithmetic already matches this. The LABEL did not: "Net commission" named the
commission-plus-VAT figure - the one thing that is not net, since the VAT is remitted. Corrected.
STILL FOR THE ACCOUNTANT:
1. TAX INVOICE COMPLIANCE - agents must issue VAT-compliant invoices. Does the app's commission
   invoice carry the TRN, a sequential invoice number, and the required fields? Not checked.
2. AGENT SPLITS - the market operates on brokerage splits (commonly 50-70% to the agent). The app
   has NO agent-split model, so "what the agent takes home" is computed nowhere. Whether that
   belongs in v1 is a founder call, not an accountant one.
