# PropCRM — What's Built vs What's Coming
**For:** Testers & stakeholders
**Date:** 22 June 2026
**Product:** PropCRM — UAE Real Estate Broker CRM
**Test focus:** SALES workflow (Leasing/Property-Management is parked — see "Not in scope")

---

## How to read this document
This tells you **what to test** (Built & Ready), **what to expect partial** (Built, Depth Varies),
and **what NOT to test** (Future / Not in scope) — so you don't log "bugs" against features
that were never meant to be live yet.

---

## ✅ BUILT & READY TO TEST (Sales)

These are structurally complete — screen exists, reachable from the nav, renders real data.

### Core sales workflow
| Feature | What it does |
|---|---|
| **Dashboard** | Sales cockpit — pipeline value, stage breakdown, recent activity, quick actions |
| **Leads** | Lead list + Lead Detail with activity logging (calls, notes, scheduling) |
| **Opportunities** | Opportunity list + 7-tab Opportunity Detail (the deal workspace) |
| **Proposals** | Versioned proposals V1 → V2 → V3… with audit trail + pre-fill from latest |
| **Negotiations** | Negotiation rounds tracked against latest proposal terms |
| **Inventory** | Unit inventory (browse, reserve) |
| **Master Agreements** | Developer commission agreements — auto-applies commission % to deals |

### Intelligence & assistance
| Feature | What it does |
|---|---|
| **PropPulse** | UAE project/developer intelligence + AI agent (verified projects, developers) |
| **AI Coach** | Per-deal AI review — analyses a deal, recommends next moves with confidence levels |

### Financial
| Feature | What it does |
|---|---|
| **Commission Outstanding** | Receivables view — invoiced vs received vs outstanding, by developer + aging |

### Phase 2 (shipped)
| Feature | What it does |
|---|---|
| **Lead Queue** | Unassigned / Stale-flagged / History tabs; round-robin assignment via Agent Pools |
| **Lead assignment governance** | Force-reassign + release require written reason; permanent audit log |
| **Real-time sync** | Changes propagate across tabs/users live (no manual refresh) |
| **Customers** | Lead → Customer lifecycle (converts on deal confirmation) |
| **Group View** | Consolidated cockpit across all branches in a group (NEW — built 22 Jun) |
| **Settings** | Agent Pools + Lead Routing Rules configuration |

---

## 🟡 BUILT — DEPTH BEING VERIFIED

Structurally present; full end-to-end flow being confirmed in functional testing.
Test normally, but these are the areas most likely to surface rough edges.

| Feature | Note |
|---|---|
| **Proposal Builder (deep flow)** | Versioning + pre-fill present; full V1→Vn→accept path under verification |
| **Negotiation first-round pre-fill** | Pre-fills from prior rounds; first-round-from-proposal pre-fill may vary |
| **Property Detail Pack** | PropPulse-side display shipped; Inventory-side display wiring in progress |

---

## 🔜 FUTURE — DO NOT TEST (not built yet / intentionally disabled)

These appear in roadmap docs but are **not live**. If you see a "coming soon" seam or a
disabled control, that's intentional — not a bug.

| Feature | Status | Planned |
|---|---|---|
| **Share / Attach Pack (send to buyer)** | Disabled seam ("coming Q3 2026") | Phase 2.3 Comms |
| **PDF generation** (proposals, invoices, closure) | Not built | Phase 2.3 (Q3) |
| **Email / WhatsApp templates + send** | Not built | Phase 2.3 (Q3) |
| **Site Visit Invite with location pin + pick-drop** | Not built | Phase 2.3 (Q3) |
| **Manager / Role-based Dashboard** | Not built | Phase 2.6 (July) |
| **Portfolio-level AI Coach** | Not built | Q3 2026 |
| **Configurable roles per company** | Not built | Q3 2026 |
| **Group RLS enforcement** | Foundation built; cross-branch data scoping not yet wired | Next sprint |

---

## 🚫 NOT IN SCOPE FOR THIS TEST

| Area | Why |
|---|---|
| **Leasing / Property Management** | Parked module — stale, no data, not part of sales test. Stay in **Sales** mode. |
| **Discounts (developer persona)** | Hidden — developer-side feature, not broker workflow |
| **Activity Log tab** | Superseded by role-aware Dashboard |
| **Permissions (admin config)** | Admin setup, not part of sales-flow testing |

---

## Test environment note
- Test in **Sales** mode (top toggle), not Leasing.
- Some screens show test data that may look incomplete (e.g. Commission Outstanding figures)
  — data hygiene is a separate workstream; focus on whether **features work**, not whether
  every number is final.

---

*Generated 22 Jun 2026 from structural completeness audit + Phase 2 backlog master doc.*
