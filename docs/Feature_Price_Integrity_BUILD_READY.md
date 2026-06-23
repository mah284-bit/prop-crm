# FEATURE — Price Integrity (warn on no-price proposals + inventory)
Logged 23 June 2026. Priority: WARN before testers; HARD-BLOCK later (post broker testing).
Origin: founder caught that the test proposal PDF showed "Asking Price: N/A" — meaning a
priceless proposal was sendable. A proposal with no price is not a complete proposal.

## Founder principle
"A proposal without price is not complete at all." Price integrity must be enforced EVERYWHERE
a price is expected (same spirit as the availability-check-everywhere principle).

## Why prices are missing
Units imported from PropPulse arrive UNPRICED (PropPulse extraction has no price). Broker must
get the price from the developer and add it. Until then, the unit price is N/A / zero.

## Three parts

### Part 1 — Send-time guard (proposal send, BOTH Lead and Opp)
When a broker tries to SEND a proposal with no price / zero price:
- NOW: HARD WARNING — clear message "This proposal has no price. A proposal without a price is
  incomplete. Get the price from the developer first." Broker may override (proceed) for now.
- LATER (post broker-testing): convert to HARD BLOCK (cannot send). Small tweak when ready.
Applies at BOTH send points: Lead-level quick proposal AND Opportunity proposal builder.

### Part 2 — No-price inventory report / worklist
A report/list showing units with no price (or no payment plan). Lets brokers see exactly which
units need pricing chased from the developer, and add it. Theme: close the price gap.

### Part 3 — Dashboard flag (visible nag)
On the dashboard, keep a flashing/highlighted COUNT of proposals (and/or units) without price or
payment method. Keeps the gap visible so it gets fixed. "These kinds of things actually matter."

## Connection to AI-Extract-Proposal-to-Opp (the feature in build now)
When promoting proposal -> Opp: price comes from the matched UNIT's pricing record (not the PDF,
which is often N/A). If that unit is ALSO unpriced -> apply the SAME warning before creating the
Opp. So the promote flow folds in Part 1's price check naturally. (Build this into the promote
flow now; Parts 1/2/3 as a separate focused build.)

## Build status
- Part of AI-extract promote flow: fold in during current build.
- Parts 1 (send-time warn) + 2 (report) + 3 (dashboard flag): separate build, before testers.
