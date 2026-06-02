# PropPlatform — Investor Demo Script v3.1
**Demo Date:** 15 June 2026
**Script Version:** v3.1 (updated 2 June 2026 — reflects Phase 2.0/2.1/2.2 shipped + commission cycle complete)
**Predecessor:** Investor_Demo_Script_v3_21May2026.md (superseded)
**Presenter:** Abid Mirza
**Audience:** Investors
**Length:** ~28 min demo + ~5 min Q&A (optional Team beat adds ~3 min)

---

## WHAT CHANGED FROM v3.0 (21 May)

Since v3.0, a lot shipped. v3.1 updates the script to match the real build:
- **Realtime sync is LIVE** — the old "hard refresh between scenes" workaround is GONE. Realtime is now a *feature to show off*, not a glitch to apologize for.
- **Commission Outstanding (Scene 7) is now a full receivables cycle** — payable invoice document, issue & send, overdue chase, CSV export. The "money moment" is far stronger.
- **Property Pack** — rich project/unit detail (brochures, floor plans, photos) folds into Scene 1 + Scene 4.
- **Lead Queue + governance + Manager Team Performance** — new OPTIONAL "Team & Governance" beat (include for operational investors, skip for pure-financial).
- Date corrected to 15 June.

**Positioning unchanged (still right):** "UAE Property Intelligence Platform with compliance + workflow."

---

## PRE-DEMO CHECKLIST (5 min before)

1. **Browser:** Chrome incognito
2. **URL:** prop-crm-two.vercel.app
3. **Login:** Super Admin
4. **One hard refresh** at start (then NO more — realtime handles updates now)
5. **Window:** Maximized · **DevTools:** CLOSED · **Phone:** Silent
6. **Backup:** Screenshots of all 7 scenes on phone
7. **Demo opp ready:** Shrikant's AGR-09-05 (V1+V2+V3 proposals, 1+ negotiation round, pending reminders)
8. **Commission Outstanding seeded:** overdue invoice present (INV-2026-0019, Sobha, ~75d) so the chase story shows
9. **Note:** AI bubble sits bottom-right — don't let it cover the Clear/filter controls when on Commission Outstanding

---

## DEMO STORY ARC (~28 min, +3 optional)

```
Opening hook (2 min) — broker's 5-portal pain
   |
Scene 1: PropPulse + Property Pack (4 min) * THE MOAT
   |
Scene 2: Master Agreement — Contractual Foundation (3 min)
   |
Scene 3: Lead -> Opportunity (3 min)
   |  [OPTIONAL Team & Governance beat (+3 min) — Lead Queue + Manager view]
   |
Scene 4: Proposal V1->V2->V3 + Property Pack attach (4 min) * KILLER 1
   |
Scene 5: Negotiation + Buyer/Broker financial separation (4 min)
   |
Scene 6: AI Coach (4 min) * KILLER 2
   |
Scene 7: Commission Outstanding — FULL CYCLE (4 min) * KILLER 3 — THE MONEY MOMENT
   |
Closing pitch (2 min) — includes realtime as quality signal
```

---

## OPENING HOOK (2 min)

> "Imagine you're a UAE real estate broker working with 5+ developers — Emaar, DAMAC, Aldar, Sobha, Nakheel. Every morning starts with the same ritual: log into 5 different developer portals, check which deals closed, which commissions paid, which buyers still owe what.
>
> Two to three hours every day, just on housekeeping. And when your CFO asks 'what's our commission pipeline this quarter?' — you can't answer instantly. You scramble through spreadsheets, WhatsApp, emails.
>
> PropPlatform rebuilds the broker's day around three pillars: **intelligence** about every UAE property, **compliance** baked into every workflow, **money visibility** at every moment.
>
> Let me show you, starting with the intelligence layer."

**Screen:** Land on Dashboard, navigate to PropPulse.

---

## SCENE 1 — PROPPULSE + PROPERTY PACK (4 min) * THE MOAT

**Setup:** Click PropPulse in left nav.

**Say (slow, deliberate):**
> "This is PropPulse. Every UAE real estate project we know about. Every developer. Twenty active developers. Verified projects, with metadata: project type, community, total units, starting prices, handover dates — confirmed by our AI agents against RERA, DLD, and developer websites.
>
> This is the broker's market view. Not a chatbot. Not a portal. A single screen showing the entire active inventory across UAE."

**Click sequence:**
1. Filter by a developer (e.g. Emaar) → show filtered list
2. Click a project (e.g. Creek Harbour) → detail panel: status, type, emirate, verified badge, starting price, units, handover, community, service charge, Maps link
3. **NEW — Property Pack:** open the project/unit detail pack → show brochures, floor plans, photos, amenities

**Say while showing the pack:**
> "Click any project — full intelligence. And now the Property Pack: brochures, floor plans, unit photos, amenities — everything a broker needs to present a property, in one place. The broker doesn't assemble this. The platform brings the data AND the collateral."

**Takeaway:** ***** Data nobody else has at this scope · AI-verified · multi-developer (impossible from one portal) · cross-tenant intelligence · now with presentable property collateral.

**FALLBACK:** If slow, pre-filtered list + narrate from screenshots.

---

## SCENE 2 — MASTER AGREEMENT (3 min)

**Setup:** Click Master Agreements.

**Say:**
> "The contractual layer. Every broker-developer relationship is governed by a master agreement — commission percentages, bonus structures, validity, payment triggers.
>
> When the broker creates a deal with any of these developers, the commission rate auto-populates. They can't accidentally type 3% when it should be 4%. It can't be forgotten or fudged.
>
> This is where compliance starts — Master Agreements as source of truth, auto-flowing through every deal, every proposal, every commission invoice."

**Click:** Open one agreement row → commission breakdown + bonus terms → back.

**Takeaway:** Contractual rigor · auto-data not manual · broker can't deviate without trail.

**NOTE (honesty card for Q&A):** Not every developer signs a per-deal agreement — many use a standard market rate. The system supports BOTH: agreement rate when present, standard rate fallback when not. (This is captured for the post-demo build; mention only if asked.)

---

## SCENE 3 — LEAD -> OPPORTUNITY (3 min)

**Setup:** Open existing demo opp (Shrikant — AGR-09-05).

**Say:**
> "A lead comes in — WhatsApp, referral, website. The broker captures basic info, then converts to an opportunity by linking a unit.
>
> Notice the unit reference — AGR-09-05. The system knows it's Aldar Grove Residences, 3 bedrooms, 1800 sqft, Burj View — because we pulled it from PropPulse. The broker doesn't type unit data. They pick from inventory. Master Agreement commission auto-applies. We're in workflow mode."

**Takeaway:** Unit data inherited from PropPulse · lead linked with audit trail · commission auto-flows.

---

## [OPTIONAL] TEAM & GOVERNANCE BEAT (+3 min)
*Include for operational/strategic investors. Skip for pure-financial audiences or if running long.*

**Setup:** Lead Queue + Manager Dashboard.

**Say:**
> "One more thing for brokerages with teams. Leads come in from many sources — portals, referrals, walk-ins. PropPlatform routes them. Here's the Lead Queue: unassigned leads, round-robin assignment across agent pools, a designated Lead Admin.
>
> And every assignment, reassignment, and release is logged — with a mandatory reason on any force-reassign. No lead silently disappears. Governance is built in, not bolted on.
>
> For the manager — a Team Performance view: who's converting, who's stalling, where the pipeline is moving."

**Click:** Lead Queue (Unassigned / Stale / History tabs) → show an assignment → show History audit trail → Manager Dashboard Team Performance panel.

**Takeaway:** Multi-agent ready · audit-grade governance · manager visibility. (Signals "this scales to a real brokerage, not just a solo broker.")

---

## SCENE 4 — PROPOSAL V1->V2->V3 (4 min) * KILLER 1

**Setup:** Proposals tab.

**Say:**
> "Negotiations happen. Buyer wants a discount. Broker sends V1 — 2% off, buyer pays DLD. Buyer counters. V2. Buyer pushes harder. V3 — 3% off, split DLD 50/50.
>
> Most CRMs lose this thread — latest price overwrites earlier ones, audit trail gone, disputes inevitable. PropPlatform keeps every version. V3 is LATEST; V1 and V2 are SUPERSEDED but never deleted. Edit V3 and the form pre-fills with V3's terms — tweak one thing, save as V4. Continuous negotiation, full audit."

**Click:** Highlight V3 LATEST → Edit V3 (form pre-fills) → close without saving. **+ mention:** "And the Property Pack — brochures, floor plans — attaches right to the proposal."

**Takeaway:** ***** Audit-grade versioning · continuous negotiation · forms pre-fill · property collateral attached.

**FALLBACK:** If pre-fill misbehaves, narrate it.

---

## SCENE 5 — NEGOTIATIONS + ARCHITECTURE (4 min)

**Setup:** Negotiations tab → then Upfront tab.

**Say (Negotiations):**
> "The reference line shows what's on the table right now — latest proposal terms in one line. Below, every negotiation round: who asked, what they requested, current status. The whole thread, not buried in emails."

**Say (Upfront — the architecture point):**
> "An architectural choice that matters. On the LEFT, what the buyer pays — net price, DLD, Oqood, maintenance. On the RIGHT, what the broker earns — completely separate, paid by the developer, never mixed.
>
> This isn't a UI choice. It's a compliance choice. UAE brokers get audited; their license depends on clean financial separation. We made the architecture enforce it."

**Takeaway:** ***** Negotiation lifecycle visible · reference line solves 'what's on the table' · architectural rigor signals serious engineering.

---

## SCENE 6 — AI COACH (4 min) * KILLER 2

**Setup:** Coach tab → "Analyse this deal".

**Say:**
> "Every deal generates context — activities, proposals, reminders. A senior broker reviews this and forms an opinion: where's it stuck, what's the next move. But the junior broker with 30 deals? The broker who inherits someone else's deal? They need that senior intuition. That's PropPulse Coach.
>
> [after results] It doesn't just summarize — it recommends specific next moves, each tagged HIGH/MEDIUM/LOW confidence, each grounded in this deal's timeline. And each recommendation has a clickable action — 'Build proposal' opens the builder, 'Schedule follow-up' creates a reminder. AI as colleague, not chatbot."

**Takeaway:** ****** AI moat, workflow-specific · action-oriented · useful in seconds.

**FALLBACK:** If AI call fails — "API rate limit, typical output looks like this" + screenshot.

---

## SCENE 7 — COMMISSION OUTSTANDING — FULL CYCLE (4 min) * KILLER 3 — THE MONEY MOMENT

**Setup:** Click Commission Outstanding. (Numbers below are illustrative — read what's on screen.)

**Say (slow, dramatic):**
> "Remember the opening — the broker logging into 5 developer portals daily? This screen replaces that ritual.
>
> Total invoiced. Received. Outstanding. Realization rate. Cash flow visibility nobody else has. By developer — exactly where the money sits. Aging buckets — what's getting old."

**Then walk the FULL CYCLE (this is the upgrade — show, don't just describe):**

1. **The follow-up strip:** "The system tells the broker what needs attention — *drafts to invoice* (closed deals not yet billed) and *overdue to chase* (past 60 days). One click filters to each."
2. **Click a draft → View Invoice:** "When a deal closes, a commission invoice auto-drafts. Here's the actual document — brokerage header, billed to the developer, the property, the buyer, the SPA date, commission calculated per agreement, VAT, total payable, bank details. Everything the developer's accounts team needs to pay — no follow-up questions."
3. **Issue & Send to Developer:** "Broker raises it — invoice number, date — and it's issued to the developer."
4. **Overdue card → Chase:** "Past 60 days — the chase list. With follow-up notes: 'called Aldar accounts, payment promised by the 15th.' The chase has memory."
5. **Record Payment:** "Payment comes in — recorded, status moves to paid, realization rate updates live."
6. **Export CSV:** "And accounts can export the whole filtered list — for their own books, for the auditor, for you."

**Say (close the scene):**
> "This is the broker's most valuable view. At quarter-end, sitting with the accountant — or with you, the investor — they don't need spreadsheets. They have this. The whole commission lifecycle: raise, send, chase, collect, report. In one place."

**Takeaway:** ******* THE money moment · full receivables lifecycle · replaces portal logins · real-time receivables · data that compounds.

**FALLBACK:** If a number looks odd, filter to a clean developer slice. The invoice document + export are the stars — lead with those.

---

## CLOSING PITCH (2 min)

> "What you've seen:
>
> **Layer 1: Intelligence.** PropPulse — twenty developers, verified projects, the data moat, now with full property collateral.
>
> **Layer 2: Compliance.** Master Agreements, audit-grade proposal versioning, governed lead assignment, enforced buyer/broker financial separation.
>
> **Layer 3: Workflow.** AI Coach, smart fields, and the full commission cycle — raise, send, chase, collect, report.
>
> **And it all syncs live.** Everything you saw updates in real time across every user and tab — no refreshing, no stale data. Built for a brokerage team working the same deals at once.
>
> We're not building a CRM. We're building UAE real estate operating infrastructure — with AI, with architectural rigor, with data that compounds.
>
> What we need from you: capital to expand from one pilot brokerage to the next ten, to add developer-side integrations, to scale the AI verification layer.
>
> Thank you. I'd love your questions."

---

## TIMING DISCIPLINE

| Scene | Target | Notes |
|---|---|---|
| Opening | 2 min | |
| 1 PropPulse + Pack * | 4 min | DO NOT SKIP |
| 2 Master Agreements | 3 min | OK to trim to 2 |
| 3 Lead -> Opp | 3 min | OK to trim to 2 |
| [Team & Governance] | +3 min | OPTIONAL — include for operational investors |
| 4 Proposals * | 4 min | DO NOT SKIP |
| 5 Negotiations + Arch | 4 min | OK to trim to 3 |
| 6 AI Coach * | 4 min | DO NOT SKIP |
| 7 Commission FULL CYCLE * | 4 min | DO NOT SKIP — the upgrade |
| Closing | 2 min | DO NOT SKIP |
| **Total** | **~28 min** (31 with Team beat) | Min: 23 min |

If running late at ~22 min: skip Scene 3 detail + Team beat, Scene 2 -> Scene 4.

---

## Q&A — UPDATED ANSWERS

**Q: State sync / real-time?**
> "Live in production. Supabase Realtime subscriptions — proposals, activities, opportunities, leads sync across users and tabs instantly. Verified working. No refresh needed."

**Q: How do you handle teams / lead distribution?**
> "Lead Queue with round-robin assignment across agent pools, a designated Lead Admin, and a permanent audit trail — force-reassign requires a written reason. Live on production."

**Q: Commission — what if a developer has no formal agreement?**
> "Common — many developers use a standard market rate to avoid admin. The system supports both: agreement rate when present, standard rate otherwise. The invoice still generates fully."

**Q: Can accounts get the numbers out?**
> "Yes — the commission view exports to CSV, filtered however you like (developer, date range, status, aging). Formal branded reports are on the Q3 roadmap."

**Q: How professional are the outputs (PDFs, emails)?**
> "The commission invoice is a complete, payable document today. Branded PDF generation and automated email/WhatsApp delivery are the Q3 Communications Overhaul — designed and scheduled."

**Q: Multi-tenant security?**
> "Row-Level Security on every table, scoped by company_id. Platform operators (our staff) have a separate identity that cannot read tenant CRM data — documented, post-demo refactor formalizes the split. Enterprise-grade from the design."

**Q: What's NOT built yet?**
> "Branded PDF/email (Q3 Comms Overhaul). Formal report builder (Q3). Full graphical dashboard with drill-down (post-demo — direction locked). None structural — all additive on a clean data model."

**Q: Tech stack / scale?**
> "React + Supabase (Postgres, RLS). Multi-tenant from day one. We move fast — the commission cycle you saw was built this week."

---

## REHEARSAL FOCUS — sentences worth memorizing

> "We're not building a CRM. We're building UAE real estate operating infrastructure."
> "The platform brings the data — and the collateral."
> "The whole commission lifecycle: raise, send, chase, collect, report. In one place."
> "It all syncs live — built for a team working the same deals at once."
> "Compliance isn't a feature we added. It's the architecture."

---

*Script v3.1 — updated 2 June 2026 (Day 25)*
*Reflects: Phase 2.0 Realtime, 2.1 Lead Queue/governance, 2.2 Property Pack, commission cycle complete*
*Replaces: Investor_Demo_Script_v3_21May2026.md*
*Next: rehearsal run-throughs (timed), mock investor session*
