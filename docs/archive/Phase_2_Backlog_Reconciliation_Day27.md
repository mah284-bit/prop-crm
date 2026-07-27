# Phase 2 Backlog — Reconciliation (Day 27, 4 Jun 2026)

The Day 27 session revealed the master backlog is STALE — several items listed as
pending/future are in fact already built. This doc records the TRUE state so we stop
rebuilding done work and report accurate status. Fold these corrections into
`Phase_2_Backlog_Master_Doc.md` at next tidy-up.

---

## Corrections — items marked pending that are ACTUALLY BUILT

### Property Pack (Phase 2.2) — VIEWER DONE (was "display layer remaining")
- PropertyPackModal works, opens from Inventory unit detail, pulls correct data,
  Share button correctly deferred "Q3 2026".
- TRUE remaining = CONTENT SEEDING only (photos/brochures per project) — content task.

### Lead Lifecycle & Segmentation (Phase 2.5) — MOSTLY BUILT (was "2-3 days, not started")
Actually built:
- ✅ Auto-conversion trigger (Day 27): lead→customer at first money
  (Reserved/Closed Won/SPA Signed), idempotent recompute, tested.
- ✅ Buyer-intent CAPTURE: dropdown in LeadCreationFormV2.jsx (investor/owner_occupier/
  hybrid/corporate/reseller), saved in payload. (lines ~498-515)
- ✅ Lifecycle badges (App.jsx ~11501-11505: raw/qualified/active_prospect/customer/
  portfolio_customer).
- ✅ Buyer-intent segment filter + segment buttons (App.jsx ~12367-12572), used by
  AI Coach "By Segment".
TRUE remaining (genuinely NOT built):
- 🛑 Customers SCREEN (dedicated nav tab, lifecycle_stage IN customer/portfolio,
  cards: portfolio_size, total_purchases_aed, buyer-intent badge). Confirmed absent.
- Buyer-intent badge on the Leads LIST rows (badges exist elsewhere, not on list).
- Bulk actions / per-segment email-WhatsApp (depends on Comms 2.3).
- Manager per-segment metrics.

### AI Coach — broad/segment/portfolio coach already built (verified earlier days)
Single-opp + broad + by-segment + portfolio all live. Single-LEAD coach = the only
gap (bundle with Lead Lifecycle).

---

## Confirmed status of other items (accurate)

- ✅ 2.0 Realtime Sync — shipped (prod)
- ✅ 2.1 Lead Ingestion + Governance — shipped (prod)
- ✅ User-creation onboarding — FIXED Day 27 (was silently broken)
- ✅ Tenant isolation RLS — swept Day 27 (4 leaky tables sealed)
- 🛑 Customers screen — NOT built (next build target)
- ⏳ 2.3 Comms Overhaul — genuinely later (4wk, Q3)
- ⏳ 2.4 FAB — not built
- ⏳ Deferred identity/segregation cluster (switcher, super-admin lockdown, support
  model, branch/group hierarchy, Layer-2 ownership RLS) — design together, FINAL step.
- 🆕 i18n / Multi-language — NEW item (Arabic-first w/ RTL foundational, then incremental)

---

## Lesson / discipline

This session repeatedly found features ALREADY BUILT when about to rebuild them
(Property Pack, buyer-intent capture). Before building ANY Phase 2 item, grep/verify
current state first. The backlog doc lags the codebase — trust the code, update the doc.

---

## Next build target (evening / next session)

**Customers screen** — confirmed genuinely missing, well-scoped, deserves a fresh full
slot (it's a top-level nav addition = 4-edit integration pattern per Day 22 notes:
import + TABS array + MODE_TABS arrays + render handler, then dev-server restart + test).
Not started Day-27-afternoon because it's too big to finish+test safely in the time left.

---

*Captured Day 27, 4 Jun 2026.*
