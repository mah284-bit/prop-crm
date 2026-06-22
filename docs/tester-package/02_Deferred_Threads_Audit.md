# PropCRM — Deferred-Threads Audit (re-verified against current code + founder intent)
**Date:** 22 June 2026
**Why:** CURRENT_STATUS.md (12 May, commit 663fd49) listed open/pending threads. That doc is
~40 days + many commits stale. Each thread RE-VERIFIED against today's code and founder intent.

| # | Thread (from 12-May doc) | Was (12 May) | Verified now (22 Jun) | Verdict |
|---|---|---|---|---|
| 1 | Closed Won "Confirm does nothing" (CRITICAL) | status unknown | Closed&Won CREATES A DRAFT INVOICE (designed behavior); invoice machinery present (OppDetail 201/817). "Forward to final close" = documented future stage. | ✅ WORKS AS DESIGNED — not a loose end |
| 2 | Save Draft button | not shipped | still not shipped | 🟡 Demo-optional, never required; deprioritized |
| 3 | Discount approval wiring (check at deal time) | not wired | discount_authority_pct STORED on master agreement; deal-time enforcement deliberately NOT wired | ✅ BY FOUNDER DESIGN — brokers follow builder & correct commissions; hard check would impose unwanted rigidity. CLOSED. |
| 4 | Quick-fill auto-apply (date input) | abandoned 11 May | minor UX nit | 🟡 Post-MVP polish, non-blocking |
| 5 | Stage rename SPA Signed -> Payment Collection | deferred (founder call) | still "SPA Signed" (4 refs) | ✅ DEFERRED BY DECISION — not a loose end |
| 8 | prePaymentsState backward compat | risk on pre-v2 records | current shape in use (OppDetail 94/439/495); risk only on old records | 🟢 Low — test data is post-v2; data check not code gap |

## Bottom line
NO genuine loose ends from deferred work. Every "pending" thread from the stale doc is either:
(a) working as designed (1), (b) a deliberate founder product decision (3),
(c) an explicit deferral by decision (5), or (d) non-blocking post-MVP polish (2,4,8).
None block the weekend sales test.

## Note
This audit supersedes the PENDING/DEFERRED sections of CURRENT_STATUS.md (12 May) for
sales-flow purposes. CURRENT_STATUS.md should be marked superseded or archived.
