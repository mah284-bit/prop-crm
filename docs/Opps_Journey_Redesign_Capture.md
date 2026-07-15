# Opps-Journey & Lead-Workflow Redesign — Design Capture
**Source:** Founder walk-through (dry-run), 14 July 2026, Day 64. Abid Mirza (domain) + Architect (structure).
**Status:** DESIGN INPUT — master document for the redesign build. Not yet implemented.

## 1. KYC v1 — progressive, gated, override-able
- States: Not Started (grey - normal at Raw) -> Docs Collected (amber) -> Verified (green).
- Badge on lead is CLICKABLE -> dialog: set state + doc checklist (passport / EID-visa / proof of funds
  as checkboxes; file uploads = Phase 2) + note.
- Soft gates: Reserve requires >= Docs Collected; SPA requires Verified. Gate dialog offers
  [Update KYC] or [Proceed anyway - reason required]; override logged as an activity (who/when/why).
- Persistent reminder: amber chip on opp header + follow-up alert line while KYC < Verified on any
  deal past Reserved. Collect what you can; remind, never silently allow.
- History: earlier pushbacks deferred KYC until the core workflow existed - correct sequencing; now built on a proven money-path.

## 2. Lead lifecycle wiring
- First COMPLETED activity on a Raw lead -> auto Qualified. (Opp-create -> active_prospect and
  Won -> customer already exist.) Completes the chain raw -> qualified -> active_prospect -> customer.

## 3. Evidence-based stage auto-advance ("the journey follows the broker's actions, not his clicks")
- Evidence -> implied minimum stage: completed activity -> Contacted; site-visit outcome -> Site Visit;
  proposal sent -> Quoted; negotiation round -> Negotiation; reservation fee -> Reserved.
- Auto-advance passes through implied stages, each logged in the journey ("auto - inferred from X")
  + a toast so the broker SEES the system move with him.
- Manual/gated stages stay deliberate: Offer Accepted (no natural evidence), Reserved (KYC + fee),
  SPA (document), Closed Won (developer SPA copy). Unit assignment at New is allowed (interest != contact).

## 4. Negotiation resolution gate ("rounds must close")
- Round lifecycle: Open -> Applied (revised proposal sent, linked to the round) / Declined (final
  answer recorded with reason) / Withdrawn (buyer dropped the ask).
- Any OPEN round blocks Offer Accepted / SPA - guard dialog shows the ask verbatim so the broker
  amends the proposal knowing exactly what to amend: [Send revised proposal] [Declined - reason] [Withdrawn].
- Resolution status ("applied yes/no") visible on the Negotiations tab. Decision source is external
  (developer's final word) - system holds the door until the human answers.

## 5. Money-tail redesign (Reserved -> Closed Won)
- ONE reservation fee (remove booking/reservation duplication; survivor: Reservation). FIXED amount
  per developer (not %), configured at developer/master-agreement level, pickable at reserve-time,
  broker may adjust. An INVOICE is issued to the customer for it. Nature: an advance - adjusted into
  the first payment when the deal proceeds; forfeit/refund per developer policy only on cancellation.
- Ledger purpose: commission truth. Payment milestones are recorded because broker commission is
  calculated/claimable from them; the developer is the source of truth and communicates changes.
- Payments Collection = a STATE within Reserved (journey stays 9 chips): due window 5-10 days,
  reminder cycle (default cadence company-set, broker-adjustable, snoozable), extensions for
  permissible reasons, after ~5-6 reminders -> cancellation path.
- Cancellation (buyer withdrew post-reservation): record amount + forfeit/refund choice + reason
  (v1 record-only, no auto refund computation); commission expectation voided; unit released to
  Available; buyer history flagged (prior withdrawal = intelligence for future deals).
- SPA is the DEVELOPER'S document: payments complete -> await developer-executed SPA -> upload the
  developer's signed copy -> that upload is the Closed-Won gate. Day-62 founder instinct ("SPA cannot
  precede full collection") formalized.

## Open items intentionally deferred
- Per-user commission split override; KYC file uploads; automated refund computation; reminder
  automation via email templates (Comms Overhaul dependency); developer portal/API for SPA status.

## 6. Bulk / Portfolio deals (block sales) - DESIGN LATER, captured 15 Jul (Day 65 golden-flow walk)
Scenario: investor buys multiple units / a floor. Principle AGREED: opp stays the deal atom (1 unit -
all machinery assumes it: saturation, dup-gate, payment ledger, commission invoice). What's missing =
a BUNDLE layer above:
- Create-once: pick N units -> N opps auto-created (shared buyer/terms, auto-titled).
- Multi-unit quote -> promote should offer per-unit opp creation via checkboxes (GF-04b, nearer-term).
- Bundle-level NEGOTIATION (the hard part): 'all 8 at 7% off' negotiated as a bundle but distributed
  to per-unit values/discounts - each unit's SPA + commission invoice needs ITS OWN number.
  Distribution rules (pro-rata by price? manual per-unit? developer-driven?) = founder design input.
- Bulk stage progression where gates allow; portfolio view on the buyer (the floor as one engagement).
STATUS: identified as 1-unit vs multi-unit at intake; engineer separately after dedicated design
session. Explicitly out of tester scope for the weekend.

## GOLDEN-FLOW WALK FINDINGS - Day 65, 15 Jul 2026 (full lead->Won cycle as agent, prod)
WALK VERDICT: spine passed end-to-end SECOND time (GoldenFlow Test1: lead -> 2-unit quote -> AI promote
-> auto-advance Contacted -> Site Visit -> proposal -> negotiation -> Offer -> Reserved -> SPA ledger +
UI upload (WORKS - yesterday's 'missing upload' = skipped moment, machinery sound, re-entry path just
needs visibility) -> Closed Won -> customer #2 -> commission invoice 97,932 = 4% verified).

### Findings ledger (fix-batch triage pending)
GF-01 Quick-quote PDF renders only FIRST unit (data layer correct: '2 units' in record + activity note).
GF-02 Earning banner absent on Promote-to-Opp path (works on manual unit pick).
GF-03 proposal_sent activity author 'Unknown' (user_name not carried).
GF-04 Lead-side activity + exactly ONE active opp at New -> auto-advance it (founder-agreed rule);
      2+ opps -> touch nothing. GF-04b: multi-unit quote promote -> offer per-unit opp creation (checkboxes).
GF-06 Opp 'Log Activity' TAB = read-only history by original design (crowding fix) but renders a DEAD
      '+ Log Activity' button + misleading name. Fix: remove button, retitle 'Activity History'.
GF-07 Location field needed on MAIN activity form when Type=Meeting/SiteVisit (any status) - ribbon
      fields work but main-form scheduled meetings have no location. Map-pin = later polish.
GF-08 RESOLVED BY DESIGN (founder+architect): quick quotes are teasers - do NOT advance to Quoted, do
      NOT count in Quoted chip; Quoted = real proposal exists. Promote lands at Contacted.
GF-09 Reservation amount recorded at Reserve has NO display surface anywhere (founder-confirmed).
      Surface on Financials tab = first brick of money-tail redesign.
GF-10 Reserve-step payment recording does NOT flow into SPA dialog's ledger (re-entered manually).
GF-11 All-received flow forces per-row amount+date entry though most amounts are computable; 5b
      redesign dissolves this. Booking fee -> optional/waivable meanwhile.
GF-12 Manager Weekly + Investor Quarterly report tabs VISIBLE TO AGENT - report-level role gating
      needed (same capability treatment as nav tabs). Dashboards+reports = own walk-through later.
GF-13 Opp financials panel: stray '0' under Final Agreed Price; Commission Invoice panel shows
      NET/Outstanding AED 0 while invoice carries 97,932 gross - wrong field read or draft renders zeros.
GF-14 My Earnings tile: 3 deals counted but sum stuck at 17,691 - second Won deal's agent_commission
      (~39,173 expected) missing. POSSIBLE REGRESSION: split may not have computed on this invoice. PRIORITY.

### Design amendments from the walk (into the redesign capture)
- Booking vs Reservation = TWO products, not dups (booking 5k immediate/non-refundable 'hold NOW';
  reservation 25k formal hold during bank approvals). Both optional, both credit toward initial
  advance (Credit Note math verified good). Developer charging pattern defines which exist.
- Initial advance likely = payment-plan first installment - CODE-CHECK whether derived or freehand.
- 'Confirm SPA Signed' does NOT belong in the ledger dialog: ledger completes -> developer processes
  -> developer's executed SPA arrives (channel TBC) -> upload = Won/Close trigger. Dialog's two jobs split.
- Post-close follow-up till handover = existing activity/reminder machinery on Won opps; verify Won
  opps aren't frozen for logging; nothing new to build.
- Property Management module (broker manages investors' units) = post-release enhancement, planned.
- North star (founder): 'a broker app, just recording, but depicting reality - the broker chases the
  buyer AND the developer till the deal closes; after closing, follow-up calls till handover.'

## GF-04b RESOLUTION (founder ruling, Day 65 evening)
Promote-to-Opp = ONE unit, ONE opp - always. Multi-unit quotes are MENUS (options shown), not
commitments; spawning N opps would flood the pipeline with fiction (saturation, dashboards, manager
views all treat an opp as intent). Junk-in-opps avoided by design.
V1 FIX (queued, not tonight): promote prefills unit[0] FROM THE STORED QUOTE RECORD (no AI
unit-guessing on our own PDF - deterministic, never fails at 1 or 10 units; wizard's existing unit
picker is the override). AI extraction stays for its real job: external/uploaded documents.
4-unit promote today arrived EMPTY (extractor choked on multi-card PDF) - confirms the redesign.
ARCHITECT HOMEWORK (no rush, founder-ordered): the in-between state - buyer engaging a shortlist,
not yet committed - lives nowhere today (just a sent quote). Shortlist-engagement tracking design
for the redesign session; connects to Quoted-stage semantics (GF-08).
