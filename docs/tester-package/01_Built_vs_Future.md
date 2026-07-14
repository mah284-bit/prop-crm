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


---
## UPDATE — 14 July 2026 (pre-handoff refresh)

### Newly BUILT & verified since 22 June (test these too)
| Feature | What it does |
|---|---|
| **Full deal spine** | Walked end-to-end AS AN AGENT: lead -> quote -> AI promote-to-opp -> site visit -> 3 proposal versions -> negotiation -> offer -> Reserved (fee collected) -> SPA Signed -> Closed Won -> customer auto-created -> commission invoice auto-created (draft) |
| **Unit Saturation banner** | Pick a unit in New Opportunity: shows total active opps on that unit incl. OTHER agents' (counts only, no deal details) |
| **Duplicate warning** | Picking a unit the same buyer already has an active opp on shows an amber warning (does not block) |
| **Forgot password** | Login screen link -> reset email (custom SMTP via Resend) -> set new password. WORKS with real email addresses only |
| **Quick Quote (lead level)** | Send Quote from a lead -> PDF proposal -> View Quotes -> Promote to Opp (AI reads the PDF, prefills the form; takes 5-10s = AI reading time) |
| **Client 360** | Lead header -> 360 View: opportunity counts + Total Business (won value) |

### KNOWN BEHAVIORS — do NOT log as bugs
| What you'll see | Why |
|---|---|
| Proposal PDFs missing the project hero image | External image host blocks cross-site fetch; PDF generates without it (known, queued) |
| A few duplicate test opportunities on some units (e.g. AGR-06-02) | Deliberate test data proving the duplicate-warning feature |
| Reports mixing odd old deals ("2 beds", missing buyer names) | Historic test data; a clean-data pass is scheduled |
| Commission Outstanding tab not visible as Agent | By design - agents do not see brokerage commission |
| "Company Config" tab absent for everyone but platform owner | By design |
| Meeting/Site-Visit "next step" has date but no time/place fields | Known gap; put details in the note (redesign scheduled) |
| Sold units absent from unit picker | By design - cannot open opps on sold units |

### Out of scope (unchanged)
Leasing module, Group View, org-chart editing rules, agent commission-split display.
