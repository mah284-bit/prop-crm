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
