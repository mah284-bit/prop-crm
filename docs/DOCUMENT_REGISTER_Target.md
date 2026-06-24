# PropCRM — Tester Guide
**For:** internal expert testers · **Window:** weekend session · **From:** Abid Mirza

---

## A note before you start

You both know me well enough to know I don't sell the world. So this guide opens with the truth, not a pitch.

PropCRM is a real, working multi-tenant CRM built for UAE real estate — but it is **pre-launch**. Some areas are solid and production-shaped; some are deliberately stubbed; some are openly not-yet-built. This guide tells you exactly which is which **before** you start, so you spend your time probing what matters and not reporting things I already know.

I want you to push it hard. You're here because you'll find what a polite tester won't. Be blunt. The more honest the critique, the more useful it is.

---

## 1. What's REAL vs what's NOT (read this first)

**SOLID — built, verified on production, test it hard:**
- Multi-tenant isolation (every record scoped by company; brokerages don't see each other)
- PropPulse — UAE project/developer intelligence (the data moat; aggregation engine, verify queue)
- Lead -> Quote -> Opportunity -> Proposal workflow, with stage gates
- Proposal versioning (V1, V2, V3...) with audit trail
- Lead-stage "Quote" vs Opp-stage "Proposal" naming + the lock/gate logic between them
- Commission Outstanding (receivables view)
- AI Coach (per-deal analysis)
- Master Agreements, Lead Queue + round-robin assignment, Settings (company-level config)
- Real-time sync (changes propagate across tabs/users)

**IN PROGRESS / PARTIAL — usable but rough, feedback welcome but expect gaps:**
- Documents & outputs (proposal PDFs are basic; branded/templated output is a planned overhaul — not here yet)
- Reports (functional, not yet executive-grade)
- Emails / WhatsApp / marketing templates — **not built** (planned Phase 2)

**DELIBERATELY NOT BUILT YET (don't test, don't report — this is by design):**
- Legacy data import (Excel-template migration — designed, not built)
- Customer-branded proposal/letter formats
- Bulk communications, automated nurture, site-visit invites with location pins / pick-drop
- Custom roles per company (fixed 7 roles for now; capabilities are configurable)
- Platform/tenant identity split (today the founder account doubles as platform + tenant for testing)

---

## 2. Known issues — please DON'T report these

These are known and either by-design or already scheduled. Reporting them just adds noise:

1. **Browser Back button** doesn't sync with in-app navigation — known, Phase 2 fix.
2. **"Stale leads = 7 days"** appears in some dashboard alerts as a fixed number even though Settings lets you configure it — a systemic unification fix is scheduled (Monday). The Lead Queue *does* honor the configured value.
3. **"AED 0" / unpriced warnings** on some proposals — this is the price-integrity feature working *as designed* (it flags unpriced items on purpose), not a bug.
4. **PDF hero image missing** on some project PDFs — external image blocked by CORS; the PDF still builds. Cosmetic, Phase 2 polish.
5. Anything in the "deliberately not built" list above.

---

## 3. Access

- **URL:** prop-crm-two.vercel.app
- **Login:** (Abid provides credentials + which company/role you're in)
- **Tip:** if something looks stale after an update, fully **close and reopen** the browser tab (a plain refresh can serve a cached version).
- Use **Chrome incognito** for a clean session.

---

## 4. Awad — Flow, Architecture, Data & Governance lens

You think in systems — and you love testing the flow. You saw an early cut of this and liked where it was heading; it's come a long way since. So do both: walk the workflow end to end as a critic, *and* probe the foundations underneath it. You're the sharpest critic here; nothing is too small to flag.

**The flow, end to end (your systems lens)**
- Walk the full path: lead -> quote -> promote to opportunity -> proposal V1/V2/V3 -> negotiation -> toward close. Does the flow hold together logically at every hop, with no dead-ends, no "now what?" moments, no step that contradicts an earlier one?
- Where does the flow assume something it shouldn't, lose state, or force an unnatural order? You'll spot the logic gaps a domain user walks past.

**Multi-tenancy & isolation**
- Can you find ANY way one company's data leaks into another's view? (This is the trust foundation — try to break it.)
- Does company-scoping hold across every screen (leads, opps, proposals, inventory, commission, reports)?

**Data integrity**
- Create a lead -> quote -> promote to opportunity -> build proposals V1/V2/V3. Does the data stay consistent at every hop? Any value that should carry but doesn't, or shows blank when it shouldn't?
- Stress the price/commission numbers — do they reconcile across screens?

**Governance & audit**
- Lead assignment, reassignment, release — is every action audit-trailed? Can anything change without a trace?
- Commission visibility — is the margin appropriately controlled (who can see what)?

**PropPulse (the moat)**
- Examine the aggregation engine + verify queue. Is the data credible? How would you trust/verify it at scale? Where would it break with 10x the developers?

**The question I most want from you:** *Would you stake an enterprise rollout on this architecture? Where's the weakest joint?*

---

## 5. Atallah — Workflow & Adoption lens

You live the broker's day. Point your skepticism here:

**Does it match real broker life?**
- Walk a real deal as you'd actually do it: capture a lead -> send a quote -> negotiate -> promote to opportunity -> revise the proposal -> toward closing. Does the flow match how deals *really* move, or does it force unnatural steps?
- Where does it assume something a real broker wouldn't do, or miss a step they always do?

**Adoption — would your agents actually use it?**
- Is it faster or slower than what your team does today? Where's the friction?
- What would make a busy agent abandon it and go back to WhatsApp + Excel?

**The deal economics**
- Buyer outflow vs broker commission separation, the proposal/negotiation versioning, commission outstanding — does this reflect how UAE brokerage money actually works?

**The question I most want from you:** *Would your agents adopt this willingly — and if not, what's the one thing standing in the way?*

---

## 6. How to give feedback (so it's usable, not lost)

For each finding, give me five things — short is fine:

| Field | Example |
|---|---|
| **Area** | "Proposal builder" / "Lead Queue" / "PropPulse" |
| **What I did** | "Promoted a quote with 2 units" |
| **What happened** | "Only 1 unit carried to the opportunity" |
| **What I expected** | "Both units, or a prompt to choose" |
| **Severity** | Blocker / Major / Minor / Cosmetic / Suggestion |

**Severity guide:**
- **Blocker** — can't proceed, data wrong, something breaks
- **Major** — works but wrong, or a real workflow gap
- **Minor** — small bug, workaround exists
- **Cosmetic** — looks off, doesn't affect function
- **Suggestion** — "this would be better if..."

Send findings to Abid (whichever channel we agreed). Group by Area if you can.

---

## 7. Test data etiquette

- **Safe to create freely:** leads, quotes, opportunities, proposals, activities. Make a mess — that's the point.
- **Safe to edit:** company Settings, your own test records.
- **Please DON'T:** delete other testers' data, or touch PropPulse global project/developer records (that's shared intelligence, not tenant data).
- This is a test environment — breaking things is welcome. If something dies, note what you did and move on.

---

*Thank you both. You're here because you'll tell me the truth — about the app, and about whether it's ready for the world. That's exactly what I need.*
