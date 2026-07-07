# PropCRM — Leasing Module: Current State & % Complete

**Prepared:** 29 Jun 2026 · for the directors / investor picture
**Basis:** Code audit (file inventory, line counts, field-level inspection) — 29 Jun 2026.
**Status:** ASSESSMENT ONLY. No Leasing build is happening until Sales is complete (locked, final).
**Supersedes:** the earlier build-effort scoping draft — this is the current-state % the meeting needs.

---

## 1. The answer for the meeting

> **Leasing is roughly 55–60% complete.**
> The full structure and the core leasing workflow are already built and real — not stubs.
> What remains is the **leasing commission variant** (which depends on the Sales commission engine
> we just finished, so it correctly couldn't exist before now) and **deeper deal-management
> parity** with Sales. Both are scheduled *after* Sales completes.

A confident one-liner: *"Leasing is more than half built — roles, navigation, dashboards, leads,
deals, property management, tenant management, and the UAE rent + post-dated-cheque model are all
in. The remaining piece is the leasing commission engine and deal-depth parity, sequenced after Sales."*

---

## 2. What is ALREADY built (verified by audit)

| Area | Evidence | State |
|---|---|---|
| **Roles & permissions** | `leasing_manager`, `leasing_agent` roles; `view_leasing` capability wired into permission sets | ✅ ~100% |
| **Navigation & app-switch** | Full leasing tab set; `currentApp==="leasing"` routing; Sales/Leasing toggle live | ✅ ~100% |
| **Leasing Dashboard** | `LeasingDashboard.jsx` — 295 lines | ✅ built |
| **Leasing Leads** | `LeasingLeads.jsx` — 476 lines; lead → opportunity with annual budget | ✅ built |
| **Lease deal detail** | `LeaseOpportunityDetail.jsx` — 956 lines; activity logging, payments | ✅ built |
| **Rent + cheque / PDC model** | Inside lease deal detail: annual rent, payment recording, **post-dated cheques** (cheque number, bank) | ✅ built (the hard UAE-specific part) |
| **Property management** | `LeasingModule.jsx` — 595 lines; tenant management (Emirates ID, passport), **maintenance tickets**, contractor assignment | ✅ built |
| **Shared infra is leasing-aware** | Inventory, Projects, PropPulse, Reports, Companies, Reservation all branch on leasing | ✅ |

**Important:** the audit found **no "coming soon" / stub placeholders** in these files — only normal
input-field hints. These are real implementations, not shells.

---

## 3. What REMAINS (the ~40%)

| Gap | Why | Priority |
|---|---|---|
| **Leasing commission variant** | ~0% built — depends on the Sales commission engine, which was *just* completed. A leasing variant (% of annual rent, landlord vs tenant, renewal commissions) reuses that engine's governance + audit pattern. | After Sales |
| **Deal-management depth parity** | Sales `OpportunityDetail` is 4,891 lines (proposal versioning, negotiation tracking, AI coach); leasing's is 956. Leasing has the core but not yet the deep sales-grade features adapted for leasing. | After Sales |
| **Ejari / tenancy-contract registration** | Not confirmed present in the audit — the leasing equivalent of Oqood/DLD. | After Sales |
| **Renewals lifecycle** | Annual lease renewal flow (recurring relationship) — partial/unconfirmed. | After Sales |

---

## 4. Percent-complete summary (by weight)

| Layer | Weight | % done | Notes |
|---|---|---|---|
| Structure (roles, nav, mode-switch) | 20% | ~100% | Solid |
| Core workflow (leads, deals, dashboard, PM) | 35% | ~80% | Real, working |
| Rent + cheque/PDC model | 15% | ~70% | The hard UAE part — present |
| Commission (leasing variant) | 15% | ~5% | Waits on Sales engine |
| Deal depth (offers, nego, AI, renewals, Ejari) | 15% | ~30% | The main remaining build |
| **Overall** | **100%** | **≈ 55–60%** | Honest, defensible band |

> This is a structural + field-level audit, not a click-through functional test. The band firms to
> a single number with a 30-minute walkthrough of the live Leasing mode when we resume.

---

## 5. When we DO build it (not now — for the picture only)

After Sales completes, bringing Leasing to full parity is a **~2–3 week focused block** (lower than a
from-scratch estimate, because more than half already exists). The two big pieces are the **leasing
commission variant** (reuses the Sales engine) and **deal-depth parity + Ejari/renewals**.

---

## 6. Captured for later (founder thought, 29 Jun — DO NOT act now)

> *"We also need to compare with the leasing modules available [in the market] and ingest full AI and
> ensure we are better."*

Future work item: a **competitive benchmark** of leasing/property-management products in the UAE
market + a plan to **lead on AI** (e.g. AI tenant comms, renewal prediction, maintenance triage,
rent-optimization). Scope this as its own discovery when Leasing build begins — **not now.**

---

## 7. Bottom line for the directors

- Leasing is **~55–60% done**, with the structure and the hard UAE-specific rent/cheque +
  property-management pieces **already built**.
- The remaining ~40% is mostly the **commission variant** (which sensibly waited for the Sales engine)
  and **deal-depth parity** — a **~2–3 week block** scheduled **after Sales completes**.
- **Nothing is being built on Leasing now** — Sales completion is the single priority, locked.

---

*Assessment basis: code audit 29 Jun 2026 (file inventory + line counts + field-level inspection).
Estimate firms with a short live walkthrough on resume. No Leasing build started; Sales is the priority.*
