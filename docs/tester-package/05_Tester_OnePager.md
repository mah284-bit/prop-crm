# PropCRM — Tester One-Pager (Weekend Round)
**Production:** https://prop-crm-two.vercel.app
**Passwords:** shared separately (WhatsApp) — never in this repo.

## Accounts
| Login | Role | What you exercise |
|---|---|---|
| testagent4@testmans4.ae | Sales Agent | The full selling workflow |
| arun.k@asdfasdf.ae | Sales Manager | Team visibility, manager screens |
| (viewer account) | Viewer | Read-only sanity |

## The one flow that matters most (run it at least twice, fresh data each time)
1. Create a NEW lead (your own name variant, unique phone/email)
2. Send Quote from the lead (pick any Available unit) -> check View Quotes
3. Promote to Opp from the quote (wait for the AI prefill) -> Create
4. Log a call + schedule a next step on the opp
5. Advance stages: Contacted -> Site Visit (capture outcome) -> send proposal ->
   negotiation round -> revised proposal -> Offer Accepted -> Reserve (enter fee)
6. SPA Signed (UPLOAD the signed SPA document here - any PDF) -> Close Won
7. Verify: Customers tab shows the buyer; Dashboard Won tiles moved
8. As MANAGER (arun.k): confirm you can see the agent's lead, opp, and the won deal

## Also poke at
- Forgot password (real email only), Change Password (key icon)
- Unit saturation + duplicate warnings when picking contested units
- Inventory browse, Reports (expect messy historic data - see Known Behaviors)
- Anything that looks wrong: screenshot + note the exact steps

## Where to report
WhatsApp group / shared sheet (link provided separately). Include: account used,
steps, screenshot, what you expected vs what happened.


---
## WHAT'S NEW (16 Jul refresh - READ FIRST)
**Environment: everything happens on https://prop-crm-two.vercel.app (production). Log in fresh in
an incognito window. If a screen looks stale: Ctrl+Shift+R.**

### New since last package:
1. **KYC on every lead** - click the KYC badge (top of lead page, has a pencil) -> upload documents
   (passport, Emirates ID, proof of funds), set expiry dates, mark Verified. Uploading a doc
   auto-moves status to 'In progress'. TRY: reserve a unit for a lead with KYC 'Not started' - the
   system prompts you (type a reason to proceed, it gets logged). SPA expects Verified.
2. **My Earnings (agents)** - Dashboard 💰 tile shows your commission; CLICK it for the per-deal list.
3. **Reservation card** - after reserving a unit, the fee shows on the deal's Financials tab (blue card).
4. **Proposal terms flow forward** - your latest proposal's price/DLD/plan pre-fill the Offer and SPA
   dialogs automatically. Check the Financials tab: it names which proposal version the price came from.
5. **Quote PDFs** - multi-unit quotes render every unit (try 3-4 units).

### Things to know (not bugs):
- **Master Agreements are OPTIONAL** - most developers pay a flat 4% (company default). An MA only
  documents an exception. Deals without MA still compute commission and link the developer correctly.
- **Viewer role sees mostly empty screens** - by design (read-only scope). Don't file this.
- **KYC gate prompts are intentional** - type a reason to proceed; it's audited, not blocked.
- **Stages can currently be advanced without evidence** (e.g. Reserve without a proposal) - known,
  redesign scheduled. Feel free to note where it lets you do something a real broker shouldn't.

### What we most want tested:
- Full deal spine: lead -> quote -> promote -> visit -> proposal (send a few versions!) -> offer ->
  reserve -> SPA confirm. Watch every number against your proposal.
- KYC round-trip: upload docs, set an expiry IN THE PAST, watch the badge and the gates.
- Break things: cancel dialogs midway, skip steps, use the back button. Report anything odd.


---
## WHAT'S NEW (16 Jul refresh - READ FIRST)
**Environment: everything happens on https://prop-crm-two.vercel.app (production). Log in fresh in
an incognito window. If a screen looks stale: Ctrl+Shift+R.**

### New since last package:
1. **KYC on every lead** - click the KYC badge (top of lead page, has a pencil) -> upload documents
   (passport, Emirates ID, proof of funds), set expiry dates, mark Verified. Uploading a doc
   auto-moves status to 'In progress'. TRY: reserve a unit for a lead with KYC 'Not started' - the
   system prompts you (type a reason to proceed, it gets logged). SPA expects Verified.
2. **My Earnings (agents)** - Dashboard 💰 tile shows your commission; CLICK it for the per-deal list.
3. **Reservation card** - after reserving a unit, the fee shows on the deal's Financials tab (blue card).
4. **Proposal terms flow forward** - your latest proposal's price/DLD/plan pre-fill the Offer and SPA
   dialogs automatically. Check the Financials tab: it names which proposal version the price came from.
5. **Quote PDFs** - multi-unit quotes render every unit (try 3-4 units).

### Things to know (not bugs):
- **Master Agreements are OPTIONAL** - most developers pay a flat 4% (company default). An MA only
  documents an exception. Deals without MA still compute commission and link the developer correctly.
- **Viewer role sees mostly empty screens** - by design (read-only scope). Don't file this.
- **KYC gate prompts are intentional** - type a reason to proceed; it's audited, not blocked.
- **Stages can currently be advanced without evidence** (e.g. Reserve without a proposal) - known,
  redesign scheduled. Feel free to note where it lets you do something a real broker shouldn't.

### What we most want tested:
- Full deal spine: lead -> quote -> promote -> visit -> proposal (send a few versions!) -> offer ->
  reserve -> SPA confirm. Watch every number against your proposal.
- KYC round-trip: upload docs, set an expiry IN THE PAST, watch the badge and the gates.
- Break things: cancel dialogs midway, skip steps, use the back button. Report anything odd.
