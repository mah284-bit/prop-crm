# Naming — "Quote" (lead stage) vs "Proposal" (opp stage)
Decided 23 June 2026. UI-LABEL-ONLY divergence. Read this before grepping for "quote".

## THE DECISION
- LEAD stage UI label  = "Quote"     (fast, standard-priced, no discount/terms; filters tyre-kickers)
- OPP stage UI label   = "Proposal"  (V1/V2/V3, discount + payment plan + DLD, negotiated, tracked)

## CRITICAL: code/data names did NOT change — only what the USER sees
There is NO "quote" table, function, or column. Searching the codebase for "quote" will
return little/nothing. The underlying names stay "proposal" everywhere:
  - DB table .................... proposals (unchanged)
  - activity type .............. proposal_sent (unchanged)
  - helper / lib ............... src/lib/quickProposalFlow.js, src/lib/createProposal.js (unchanged)
  - components ................. QuickProposalsPanel.jsx, ViewProposalsDialog.jsx, ProposalFormModal.jsx,
                                  ProposalBuilderDialog.jsx, UnitPickerMulti.jsx (unchanged)

## WHY the divergence is intentional
A lead-stage send is just unit + standard price (no terms) — calling it a full "Proposal"
overloaded the word and confused the workflow. "Quote" = universal sales term for an early,
indicative price with no commitment. The REAL proposal (terms, versions, negotiation) lives
in the Opp. Naming reinforces the flow: quote at the door, proposal once they are serious.

## LABEL MAP (what shows "Quote" in the UI; code stays "proposal")
  - QuickProposalsPanel header "Quick Proposals"  -> "Quick Quote"
  - button "Send New Proposal" (lead)             -> "Send Quote"
  - ViewProposalsDialog (lead context) titles     -> "Quotes" / "Quote"
  - lead-send lock message wording                -> "Quotes are sent from leads; proposals from the Opportunity"
  - Opp-side labels (Proposals tab, Send Revised) -> UNCHANGED, stay "Proposal"

## RULE FOR FUTURE SESSIONS / SUPPORT
If a user says "quote" they mean a LEAD-stage proposal record. It is stored in the proposals
table like any other. Do not build a separate quotes table. This divergence is by design.
