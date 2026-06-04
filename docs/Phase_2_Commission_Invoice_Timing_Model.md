# Phase 2 — Commission Invoice Timing & Eligibility Model

**Captured:** 2 June 2026 (Day 25). **Status:** DESIGN / capture — build POST-DEMO.
**Source:** Founder, while completing the Scene 7 invoicing cycle.

## The problem
The commission invoice should NOT be dated the deal-closure/SPA date. A brokerage usually
cannot invoice the developer on SPA day — payment eligibility comes later (down-payment
cleared, Oqood registered, net-30/60, or when the developer signals). Using closure date
as invoice date misrepresents aging/realization. Free-editing the date is dangerous
(backdating gamed aging).

## Demo decision (locked, already true in build)
- Invoice date = **the date "Issue" is clicked** (the raised date). Draft has NO invoice
  date until issued. This is real-world-correct and sidesteps the closure-date problem.
  Verified in code: draft invoice_date is null; Issue action sets date = today. No change needed.
- The proper eligibility model below is POST-DEMO.

## Founder's key domain insight (must shape the model)
> Commission is often a STANDARD market rate. MANY developers avoid formal per-deal master
> agreements to reduce admin. So the system must NOT depend on a master_agreement row
> existing for every deal.

Implications:
- The invoice/commission engine needs a fallback: **agreement rate IF present, else a
  company/market STANDARD default rate.** (Confirmed by data: many invoices had
  master_agreement_id = NULL yet still computed commission — so a default already operates;
  formalise it.)
- "Per Master Agreement [X]" wording on the invoice should gracefully degrade to
  "per standard brokerage commission terms" when no agreement exists.
- Founder's quick idea: let the broker create a lightweight "unsigned / standard terms"
  agreement when none exists — captures the agreed rate without forcing heavy paperwork,
  and need not be referenced on the invoice if it's informal.

## Proposed eligibility model (post-demo)
Add an "eligible to invoice from" concept so the system TELLS accounts when an invoice can
be raised — instead of a free/dangerous date field.

Trigger options (per developer / per deal, configurable; default = standard):
- ON_SPA — invoice immediately on SPA signing
- ON_DOWNPAYMENT — after buyer's down-payment (e.g. 10-20%) clears
- NET_DAYS — N days after SPA (e.g. 30/60)
- ON_DEVELOPER_SIGNAL — manual: developer notifies broker eligible
- SPLIT — part on SPA, balance on handover

Data (post-demo):
- commission_terms on developer (default) and optional override per opportunity/agreement:
  { trigger, net_days, split_pct_on_spa }
- invoice gains: eligible_from_date (computed), raised_date (= issue click), due_date
  (raised + net terms). Aging measured from raised/eligible, not closure.

UI (post-demo):
- Commission Outstanding shows drafts as "Eligible to invoice on [date]" or "Eligible now".
- "Issue" allowed only when eligible (or with an explicit override + reason -> audit trail,
  consistent with the governance pattern used in Lead Queue).
- Invoice date auto = issue/raised date; NOT editable freely (override = logged).

## Why post-demo
Touches developer/agreement data model + Commission Outstanding logic + governance. Not a
demo blocker — demo uses raised-date = issue-click, which is correct. Build properly with
the Communications Overhaul / data-model work.

## Connects to
- Phase_2_Communications_Overhaul.md (invoice PDF + send)
- Master Agreements (rate source, when present)
- App_Normalisation_Priority.md (do after consolidation so it's built once)
