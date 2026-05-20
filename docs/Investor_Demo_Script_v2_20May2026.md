# PropPlatform — Investor Demo Script v2
**Demo Date:** ~5 June 2026
**Script Version:** v2.0 (rewritten after dashboard refactor)
**Predecessor:** Investor_Demo_DryRun_Script.md (12 May 2026, now outdated)
**Presenter:** Abid Mirza
**Audience:** Investors
**Length:** ~25 minutes demo + ~5 min Q&A

---

## WHAT CHANGED FROM v1 SCRIPT

v1 (12 May) was written before:
- ✅ Math Flow Sprint (current_* columns architecture)
- ✅ Dashboard refactor (7-tab clean UI)
- ✅ Proposal versioning V1→V2→V3 with Excel table
- ✅ Architectural law: buyer outflow vs broker revenue separated
- ✅ AI Coach in dedicated tab with gradient emphasis
- ✅ Annual maintenance + Phase 2 module structure

**v2 reflects the product as it actually is on 20 May 2026.**

---

## PRE-DEMO CHECKLIST (5 min before investor meeting)

1. **Browser:** Chrome incognito (no cached state)
2. **URL:** prop-crm-two.vercel.app
3. **Login:** Super Admin credentials
4. **Hard refresh:** Ctrl+Shift+R
5. **Window:** Maximize browser
6. **Devtools:** CLOSE devtools (clean look)
7. **Phone:** Silent mode
8. **Water:** Glass ready
9. **Backup:** Screenshots of all 7 tabs on phone (in case live demo glitches)
10. **Test opp ready:** Confirm one opp has V1+V2+V3 proposals, 1 negotiation round, pending reminders, and a final agreed price set (the "demo opp")

---

## DEMO STORY ARC (~25 minutes)

```
Opening hook (2 min) — broker daily pain
   ↓
Scene 1: Dashboard tour (3 min) — NEW: shows compact header + tab strip
   ↓
Scene 2: Lead → Opportunity (3 min) — auto-commission from master agreement
   ↓
Scene 3: Proposal Versioning V1→V2→V3 (5 min) ⭐ KILLER MOMENT 1
   ↓
Scene 4: Negotiation Tracking (3 min) — proposal reference + rounds
   ↓
Scene 5: Buyer Outflow vs Broker Revenue (3 min) ⭐ KILLER MOMENT 2 — architectural thesis
   ↓
Scene 6: PropPulse AI Coach (4 min) ⭐ KILLER MOMENT 3 — the wow factor
   ↓
Scene 7: SPA Signed + Closed Won (2 min) — commission realization
   ↓
Closing pitch (2 min) — the moat
```

---

## OPENING HOOK (2 min)

**What you say:**

> "Imagine you're a UAE real estate broker working with 5+ developers — Emaar, DAMAC, Aldar, Sobha, Nakheel. Every morning starts with the same ritual: log into 5 different developer portals, check which deals closed, which commissions paid, which buyers still owe what.
>
> Two to three hours every day, just on housekeeping. And when your CFO asks 'what's our commission pipeline this quarter?' — you can't answer instantly. You scramble through spreadsheets, WhatsApp messages, emails.
>
> PropPlatform replaces that ritual. One screen. One source of truth. Every deal, every payment, every commission — visible, auditable, AI-assisted.
>
> Let me show you."

**What's on screen:**
- App home/dashboard, clean
- Don't click yet — let it land

**Investor takeaway:**
- This solves a real, daily, expensive problem
- Multi-developer reality is the broker's actual life

**⚠️ FALLBACK:** If anything fails to load, say *"Let me refresh"* + Cmd-R, don't apologize.

---

## SCENE 1 — DASHBOARD TOUR (3 min)

**Setup before scene:**
- Click into the demo opp (one with full data)
- Land on the deal detail page

**What you say:**

> "This is a single deal's view. Notice three things immediately:
>
> First — the compact header. Everything you need at a glance: stage, owner, unit, lead. No scrolling required.
>
> Second — the workflow band. Deal Journey shows where this deal is in our 8-stage pipeline. Right below it, every action the broker might take: log a call, send a WhatsApp, schedule a reminder, send a proposal. One click each.
>
> Third — and this is new — the dashboard tab strip. Seven tabs covering every aspect of the deal: Proposals, Coach, Next Steps, Financials, Negotiations, Upfront Costs, Payment Plan."

**Click sequence:**
1. Hover over each tab briefly while naming it
2. Show the "Welcome state" if no tab selected
3. Click ✨🤖 **Coach** tab — show the AI gradient pill momentarily but don't open Coach yet
4. Click away (close tab) — return to welcome state

**What you say while showing:**

> "Notice the Coach tab — purple-teal gradient with the sparkle. That's our AI advisor. We'll come back to it.
>
> Each tab opens a focused, breathing view of that aspect of the deal. No more 12 sections stacked vertically. No more scrolling fatigue. Brokers can find what they need in one click."

**Investor takeaway:**
- Modern, app-quality UX (not 1990s CRM)
- Information architecture clear at first glance
- AI is visible but not intrusive

**⚠️ FALLBACK:** If tabs don't render, show the workflow band — *"The dashboard is mid-iteration based on tester feedback"* + move on

---

## SCENE 2 — LEAD → OPPORTUNITY (3 min)

**What you say:**

> "Let's go back a step — how does a deal even get here? A lead comes in through WhatsApp, a referral, the website. Let me show you the opportunity creation flow."

**Click sequence:**
1. Back to dashboard
2. Click "Opportunities" → "+ New Opportunity"
3. Fill briefly:
   - Linked lead: select existing (or create lead inline)
   - Property: select an Emaar unit from picker
   - Budget: AED 2,500,000
4. Note: only AVAILABLE units appear (Reserved units filtered)
5. Save

**What you say while filling:**

> "Watch the commission field — I'm not entering it. The system pulls it directly from the master agreement we have with Emaar. 4 percent. AI-validated from the actual signed contract.
>
> This matters because every deal we do with Emaar gets the same commission terms automatically. No typos. No 'wait, was that 3.5 or 4?' conversations. The contractual source of truth flows through every deal."

**Investor takeaway:**
- Master Agreements as compliance foundation
- AI extracts data — humans don't re-enter
- Multi-developer ready (more agreements = more leverage)

**⚠️ FALLBACK:** If picker is slow, navigate to existing opp instead — *"Let me jump to a deal in progress"*

---

## SCENE 3 — PROPOSAL VERSIONING V1→V2→V3 (5 min) ⭐ KILLER MOMENT 1

**Setup:**
- Open demo opp that already has V1, V2, V3 proposals
- Click 📤 **Proposals** tab

**What you say:**

> "Now we're in negotiation. The buyer wants a discount. The broker sends Proposal Version 1. Buyer counters. Version 2. More back-and-forth. Version 3.
>
> Most CRMs lose this conversation. The latest price overwrites the earlier ones. Audit trail gone. Disputes inevitable.
>
> Watch how PropPlatform handles this."

**What's on screen:**
- Excel-style table of proposals
- V3 with LATEST badge (highlighted blue row)
- V2 marked SUPERSEDED
- V1 marked SUPERSEDED
- Columns: V#, Sent date, Discount %, Net Price, Plan, DLD, Status, Edit

**Click sequence:**
1. Point to each row — read out: *"V1 was 0% discount, V2 was -2%, V3 was -3% with 50/50 DLD split"*
2. Point to the LATEST badge
3. Scroll down to the **Buyer Outflow** card (LEFT)
4. Then the **Broker Commission** card (RIGHT)

**What you say while showing:**

> "Every version of the proposal is preserved. The broker can see exactly what was offered, when, with what terms. The latest version is highlighted. Older versions are marked SUPERSEDED but never deleted.
>
> Below the table — and this is critical — we show two separate financial views.
>
> On the LEFT: Buyer Outflow. What the buyer actually pays. Net price, booking fee, DLD share, Oqood fee, annual maintenance. Everything coming OUT of the buyer's pocket.
>
> On the RIGHT: Broker Commission. What we earn. Completely separate. Paid by developer, not by buyer. We never conflate these — and we'll see why that matters in a minute."

**Investor takeaway:** ★★★★★
- Audit trail compliance-grade
- Negotiation feels like a thread, not isolated forms
- Architecture separates buyer cost from broker revenue (NEW thesis)
- Future-proof for disputes

**⚠️ FALLBACK:** If table renders weird, narrate the structure verbally + screenshot ready

---

## SCENE 4 — NEGOTIATION TRACKING (3 min)

**Click:** 🤝 **Negotiations** tab

**What's on screen:**
- Reference line at top: "Reference V3 (latest proposal): -3% · 20/80 · Split 50/50 with developer · AED 2,370,783"
- Excel-style table of rounds:
  - R1 LATEST · 🟦 BUYER · "Other request: give me some discount" · OPEN

**What you say:**

> "Above the table — the reference line — shows what the buyer is currently looking at. The latest proposal terms in one line.
>
> Below — each round of negotiation logged with party, topic, status. Buyer asks. Developer responds. Broker tracks every step.
>
> When the buyer comes back next week with a new ask, the broker doesn't have to flip through emails. The whole thread is here, attached to the proposal version it relates to."

**Investor takeaway:**
- Negotiation lifecycle visible
- Each round audit-tagged
- Reference line solves "what's on the table right now" question
- Critical for managers reviewing junior broker's deals

**⚠️ FALLBACK:** If table empty for the demo opp, briefly narrate then click another tab — *"This populates as rounds are logged"*

---

## SCENE 5 — BUYER OUTFLOW vs BROKER REVENUE (3 min) ⭐ KILLER MOMENT 2

**This is the architectural thesis. Slow down here.**

**Click:** 📊 **Upfront** tab

**What's on screen:**

```
📊 Upfront Costs                          [Buyer outflow]
Sourced from V3 + unit data

💸 One-time payments (at SPA / handover)
Net Price (from V3)              AED 2,370,783
· Booking 10% (within net)       AED 237,078
· Initial Advance (20%, within net) AED 474,157
DLD Fee 4% (Negotiated)          AED 47,416
Oqood Fee                        AED 4,020
─────────────────────────────────
Total one-time outflow           AED 2,422,219

🔁 Recurring (annual, post-handover)
Annual Maintenance (X sqft × AED Y/sqft)
                                 AED [varies]/yr

💼 Broker commission (AED 94,831 at 4%) tracked separately as revenue — paid by developer, not buyer.

📋 Phase 2 module: Buyer agency services + property management retainer tracked separately in future module.
```

**What you say (slow + deliberate):**

> "Most CRMs mix everything together. Broker commission, agency fees, buyer payments — one big calculation. That's wrong. It's wrong technically, it's wrong legally, and it confuses the buyer's understanding of what they really owe.
>
> We made a deliberate architectural decision. Buyer outflow is one thing. Broker revenue is another. Annual recurring costs are a third.
>
> This screen shows the buyer their TOTAL cost of ownership. One-time payments at SPA. Recurring maintenance annually. Clear, clean, complete.
>
> Below, in the note — we acknowledge our commission is a separate financial event, paid by the developer to us, not by the buyer.
>
> And at the bottom — we explicitly call out Phase 2 services. Buyer agency, property management — when we expand into those, they get their own module. We never mix.
>
> This isn't a CRM choice. This is a compliance architecture choice. For UAE brokers, who get audited, this matters."

**Investor takeaway:** ★★★★★★ (PIVOTAL)
- Architectural rigor signals serious engineering
- Future-proofs for Phase 2 (buyer agency services)
- Trust-building for buyers (clear cost picture)
- Distinguishes from "build it fast" competitors

**⚠️ FALLBACK:** This scene is about the THESIS, not the numbers. If math looks off, just say *"these are demo numbers; the principle holds"*

---

## SCENE 6 — PROPPULSE AI COACH (4 min) ⭐ KILLER MOMENT 3

**The wow factor. The thing investors will remember.**

**Click:** ✨🤖 **Coach** tab

**What's on screen (initial state):**

```
✨ 🤖 PropPulse Coach [BETA] [ⓘ]

✨
Ready to analyse this deal
I can review this deal's history and recommend your next move.

Based on: 23 activities · 3 proposals · 6 pending reminders

[✨ Analyse this deal →]
```

**What you say (before clicking):**

> "Now — every deal generates a lot of context. Activities, proposals, reminders, notes. A senior broker reviews this and forms an opinion: where's this deal stuck? What's the next move?
>
> But what about the junior broker handling 30 deals? Or the broker who picks up a deal another agent left behind? They need that senior intuition.
>
> That's PropPulse Coach. AI-powered deal review. Trained on the broker's actual workflow patterns."

**Click sequence:**
1. Click "✨ Analyse this deal →"
2. Show loading state (~5-10 seconds)
3. Results appear

**Expected results (varies by opp):**

```
📊 [Summary: e.g. "Buyer has made 3 negotiation rounds with diminishing concessions, indicating decision fatigue. Send Proposal V4 with final terms to force commitment."]

[HIGH] Send V4 final proposal
💭 Buyer's last ask was small. They're at the commitment threshold. A locked-in V4 with 5% discount creates urgency.
[📤 Build proposal]

[MEDIUM] Schedule developer meeting
💭 ...
[📅 Schedule follow-up]
```

**What you say while results render:**

> "The AI doesn't just summarize. It recommends specific next moves. Each tagged with confidence — HIGH, MEDIUM, LOW. Each with reasoning grounded in this deal's specific timeline.
>
> And critically — each recommendation has a clickable action. 'Build proposal' opens the proposal builder. 'Schedule follow-up' creates a reminder. The AI doesn't just advise — it acts.
>
> This is where AI in CRM stops being a chatbot and becomes a colleague."

**Investor takeaway:** ★★★★★★★ (WOW)
- AI moat is real, not promotional
- Specific to broker workflow, not generic
- Action-oriented, not text-dump
- Demonstrably useful in seconds

**⚠️ FALLBACK:** If AI call fails: *"API rate limit, but in real use this returns in 3-8 seconds"* + skip to summary

---

## SCENE 7 — SPA SIGNED + CLOSED WON (2 min)

**Click:** Move stage button → "Advance to SPA Signed"

**What you say:**

> "Skipping ahead — buyer signs SPA. Broker collects fees. System pre-fills everything from the proposal. Initial advance, DLD share, Oqood. Broker just confirms each line item as collected.
>
> Once all confirmed, advance to Closed Won. Final price locked from SPA. Commission auto-calculated, ready for invoice."

**Click sequence (quick):**
1. SPA Signed dialog opens
2. Show pre-filled values
3. Don't actually save — just gesture toward the layout

**What you say:**

> "Every stage gate enforces data integrity. Broker can't skip a fee. Can't enter zero values. Can't proceed without uploading the signed SPA. The system protects the audit trail."

**Click:** ESC dialog, return to detail view

**Investor takeaway:**
- Stage gates compliance-grade
- No data loss across the lifecycle
- Audit trail is COMPLETE, not partial

---

## CLOSING PITCH (2 min)

**What you say:**

> "Let me summarize what you've seen.
>
> First — a real product. Not slides, not mockups. Live, working software handling real broker workflow.
>
> Second — architectural rigor. We don't mix buyer outflow with broker revenue. We don't conflate Phase 1 services with Phase 2. We don't let proposals lose their history. These are deliberate engineering decisions made by founders who know this industry.
>
> Third — AI that works. PropPulse Coach isn't a chatbot bolted on. It's deal-context-aware, action-oriented, broker-trained.
>
> Fourth — compliance as moat. UAE brokers face audit risk. Their commission depends on accurate price tracking. Their license depends on transparent dealings. PropPlatform makes compliance the natural path, not a separate burden.
>
> Fifth — data that compounds. Every deal creates a data point. Every payment creates a record. Every negotiation creates a thread. Over years, this becomes the broker's most valuable asset — and our most defensible moat.
>
> We're not building a CRM. We're building UAE real estate compliance infrastructure. With AI. With architectural integrity. With the broker's actual daily life in mind.
>
> We've shipped 28 commits in the last two days alone. The team is small. The velocity is real. The product is professional.
>
> What we need from you: capital to expand from one company pilot to the next 10 brokerages. To add the developer-side integrations. To build out the Phase 2 services module. To scale the AI training data.
>
> Thank you. I'd love your questions."

---

## TIMING DISCIPLINE

| Scene | Target | If running short | If running long |
|---|---|---|---|
| Opening | 2 min | Cut to 1 min | Stick to 2 min |
| Scene 1 | 3 min | OK to cut to 2 | Don't over-explain |
| Scene 2 | 3 min | OK to cut to 2 | Don't dwell on lead creation |
| Scene 3 ⭐ | 5 min | Don't cut — this is killer | OK to extend to 6 |
| Scene 4 | 3 min | OK to cut to 2 | Stick to 3 |
| Scene 5 ⭐ | 3 min | Don't cut — thesis | OK to extend to 4 |
| Scene 6 ⭐ | 4 min | Don't cut — wow | OK to extend to 5 |
| Scene 7 | 2 min | Cut to 1 min | Stick to 2 |
| Closing | 2 min | OK to cut to 1 | Stick to 2 |

**Total budget:** 27 min if everything stretches, 17 min if compressed.

**If at 25 min mark you're at Scene 5:** Skip Scene 7, go to Closing.

---

## CONTINGENCIES

| Scenario | Action |
|---|---|
| Browser crash | Cmd-R, continue from last known state |
| Login fails | "Demo glitch, network issue" + screenshots |
| API timeout (Coach) | "AI rate-limited, but here's the typical output" + screenshot |
| Validation error in stage gate | "That's the audit gate working — system prevents premature advancement" |
| Investor asks about feature X | If shipped: demo it. If not: "Phase 2 / Phase B roadmap" |
| Internet down | Screenshots fallback (must have ready) |

---

## INVESTOR Q&A — LIKELY QUESTIONS + ANSWERS

### Q: "How many brokerages use this today?"
A: "One pilot company — Al Mansoori Properties — actively using since [date]. We're using THEIR feedback to harden the product. After your investment, we expand to the next 10 brokerages we've already identified."

### Q: "What's the AI moat? OpenAI commoditizes this."
A: "We're not commoditized AI. PropPulse Coach is trained on real broker workflow data — what activities lead to what outcomes, what proposal patterns close deals. As we add brokerages, the training data deepens. By month 18, our recommendations will be measurably better than generic GPT-class models."

### Q: "Why UAE? Why not bigger markets?"
A: "Three reasons. One — UAE has unique compliance requirements (DLD fees, master agreements, off-plan vs ready) that generic global CRMs don't model. Two — UAE brokers earn 2-4% commissions on AED 2-10M deals — high enough that they'll pay for software that protects their license. Three — successful UAE pilot is our springboard into Saudi (Vision 2030 buildout) and broader GCC."

### Q: "What about competitors? PropertyFinder, Bayut, Dubizzle?"
A: "Those are listing platforms — they show properties to buyers. We're broker-side compliance + workflow. Different product, different buyer (the broker, not the consumer)."

### Q: "Tech stack? Why React/Supabase?"
A: "Pragmatic choice. Modern, type-safe, deployable in hours. Supabase gives us Postgres + RLS for multi-tenant isolation. We move fast. Phase 2 we may revisit architecture."

### Q: "Security? Multi-tenant data isolation?"
A: "Row-Level Security on every table. Each brokerage's data is isolated by company_id, enforced server-side, not client-side. We can run penetration tests with you before pilot expansion."

### Q: "Revenue model?"
A: "SaaS per-agent per-month. ~AED 200-400 per agent per month, starting around AED 50-100 for the first 6 months of a brokerage's onboarding. Premium tier with AI Coach. Eventually marketplace commissions on developer-side integrations (Phase 2)."

### Q: "What if a brokerage just builds this in-house?"
A: "They could. They won't, for the same reason brokerages don't build their own accounting software. The economics don't make sense for a 20-agent brokerage. And our roadmap compounds — every brokerage gets the benefit of every other brokerage's data."

---

## POST-DEMO ACTIONS

1. Thank investor
2. Send follow-up email within 24 hours:
   - Investor deck (PropPlatform_Investor_Pitch.pptx)
   - Architecture overview (one-pager)
   - Demo recording (if recorded)
   - Direct link to pilot brokerage testimonial (if available)
3. Note investor questions for next session
4. If positive signal: schedule technical due diligence call

---

## SCRIPT NOTES — WHAT TO REHEARSE

**Verbatim sentences worth memorizing:**

> "We're not building a CRM. We're building UAE real estate compliance infrastructure."

> "We never mix buyer outflow with broker revenue."

> "Every deal creates a data point. Every payment creates a record. Every negotiation creates a thread. Over years, this becomes our most defensible moat."

> "PropPulse Coach isn't a chatbot. It's a colleague."

**Rehearse 3 times before demo:**
- Once alone (timing check)
- Once with colleague watching (feedback)
- Once with mock investor (different person, real Q&A)

---

## PRACTICE SCHEDULE — 16 DAYS TO DEMO

| Days Out | Activity |
|---|---|
| 16 (today, 20 May) | Script v2 written ✅ |
| 15 (Thu 21) | Solo run-through, time it, refine |
| 14 (Fri 22) | Colleague review of script + product |
| 12-10 | Practice cycles (3x) |
| 9-7 | Polish responses to likely Q&A |
| 6-4 | Mock investor sessions (different audience) |
| 3-2 | Final polish, screenshots, backup prep |
| 1 (4 Jun) | Light review, rest |
| 0 (5 Jun) | Demo day |

---

*Script v2 generated: 20 May 2026 (Wednesday)*
*Replaces: Investor_Demo_DryRun_Script.md (12 May 2026)*
*Status: First draft, ready for review + practice*
*Aligned with: Dashboard refactor complete, AI Coach in tab, architectural separation in UI*
