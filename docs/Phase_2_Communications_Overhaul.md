# Phase 2 — Communications & Output Overhaul

**Date captured:** 23 May 2026 (Saturday morning, Day 11)
**Source:** Founder review during Day 11 polish session
**Founder quote:** *"all the docs, reports and mails needs to be relooked at the end which are at the moment very minimal below the basic level"*
**Strategic value:** CRITICAL — currently the WEAKEST area of the product
**Effort:** 5-7 days focused work (broken into phases)
**Timing:** Q3 2026 (post-pilot, sequenced with FAB + Lead Lifecycle)

---

## TL;DR

Every customer-facing output of PropCRM today is BELOW PROFESSIONAL STANDARD. Proposals are text-based, emails are minimal, reports are barebones, site visit invitations lack location pins, brochures aren't attached anywhere, no PDF generation exists. **This is the area most likely to embarrass us in front of buyers and investors.**

Phase 2 overhauls ALL output:
- **Documents** (proposals, reports, invoices)
- **Communications** (emails, WhatsApp, site visit invites)
- **Attachments** (brochures, floor plans, location pins, pick-and-drop)

**One comprehensive sprint solves the entire customer-facing gap.**

---

## The Problem Today

### What broker can do today
```
✅ Create proposal → text-based, no PDF
✅ Send email → manual, generic
✅ Log site visit → text note, no location auto-attached
✅ Generate reports → minimal templates, no PDF export polish
✅ Commission invoice → text-only, no professional invoice template
```

### What broker CANNOT do today
```
❌ Send buyer a polished PDF proposal with brochure attached
❌ Auto-include unit location pin in site visit invitation
❌ Offer pick-and-drop coordination from invite
❌ Send branded marketing email (investor alerts, owner-occupier content)
❌ Generate end-of-quarter manager report ready for investors
❌ Send SPA-ready closure summary with all docs bundled
❌ Email investor customers about new project launches
❌ Track which buyer received what document
```

### Founder's honest assessment
> *"all the docs, reports and mails needs to be relooked at the end which are at the moment very minimal below the basic level"*

**This is a domain-wide gap, not isolated features.** Phase 2 addresses it comprehensively.

---

## Part 1 — Customer-Facing Attachments (Bundle System)

### Connects to existing Phase 2 docs
- `Phase_2_Backlog_Master_Doc.md` (Section: Customer-Facing Context Bundle)
- `Phase_2_Proposal_Communication_Model.md` (Brahma Lipi — broker PDF + developer upload)

### What's in the bundle

**Per project (uploaded once, attached many times):**
- Master plan / community layout
- Amenities brochure
- Location map / community plan
- Construction progress photos
- Developer payment plan options
- Service charge schedule
- RERA registration certificate

**Per unit (uploaded per unit):**
- Floor plan (specific to this unit)
- Unit photos (if available)
- View photos from this unit
- Unit-specific specs sheet

**Computed at bundle time:**
- Cover page (broker logo, buyer name, prepared date)
- Unit summary (project + unit details + price)
- Proposal terms (from current opp)
- Composite PDF (single download or multi-attachment)

### Entry points (multi-entry pattern from Day 9 doc)

```
Inventory → click unit → "Send unit pack to..." button
Lead Detail → click "Send Bundle" → choose unit + send
Opportunity Detail → click "Share Project Details" → bundle composed
Proposal Builder → checkbox "Include bundle attachments" → PDF auto-bundled
```

All four converge on same SEND ACTION with same backend.

### Site Visit Invite (CLARIFICATION from founder)

**Founder note:** *"site visit location is already a part of inventory attachment to site visit invite is new"*

So:
- ✅ Unit has location data already (lat/long + Google Maps URL in inventory)
- ❌ Site visit invite doesn't pull location automatically
- ❌ Site visit invite doesn't include pin

**Phase 2 fix:** When broker logs a "Visit" activity with scheduled_at:
- Auto-compose visit invite (email + WhatsApp)
- Include: Date, time, unit reference, address, **Google Maps link from inventory**
- Include: Broker contact + escalation contact
- Include: "Need a ride?" → triggers pick-and-drop coordination

### Pick-and-Drop Coordination (NEW)

**Founder vision:** *"setup up a pick and drop... so it becomes easy for the buyer to drive in or setup up a pick and drop"*

**The workflow:**

```
Buyer receives site visit invite
  ↓
Choice: "I'll drive myself" OR "I need pickup"
  ↓
If pickup:
  - Buyer specifies origin (hotel, home, office)
  - Broker confirms transport arrangement
  - Day-of: broker or driver coordinates
  - Status: "Pickup confirmed" / "On the way" / "Arrived"
  ↓
Site visit happens
  ↓
Return option: same arrangement or independent
```

**Why it matters:**
- Premium UAE buyers expect concierge service
- Removes friction (especially for international buyers)
- Differentiator vs portal-based property search (no service layer)
- Captures more data (where buyer comes from, travel time, repeat visits)

**Schema:**
```sql
-- Extend activities table OR create new transport_requests
ALTER TABLE activities ADD COLUMN transport_required boolean DEFAULT false;
ALTER TABLE activities ADD COLUMN pickup_address text;
ALTER TABLE activities ADD COLUMN pickup_status text 
  CHECK (pickup_status IN ('not_required', 'requested', 'confirmed', 'in_transit', 'arrived', 'completed', 'cancelled'));
ALTER TABLE activities ADD COLUMN pickup_notes text;
```

---

## Part 2 — Documents & Reports Overhaul

### Current state (BELOW basic)

| Document Type | Current State | What Broker Actually Needs |
|---|---|---|
| Proposal | Inline text in proposal builder | Branded PDF with attachments, downloadable, shareable |
| Site visit invite | Text in activity note | Email + WhatsApp invite with location pin, calendar event |
| Commission invoice | Inline in dashboard | Professional invoice PDF for developer submission |
| Closure summary | Doesn't exist | SPA-ready bundle: signed proposal, KYC docs, payment plan, agreement |
| Pipeline report | Excel/PDF basic | Branded executive summary with charts, narrative |
| Manager weekly report | Doesn't exist | Auto-generated Monday email: pipeline movement, agent performance, risks |
| Investor quarterly review | Doesn't exist | Board-ready PDF: portfolio status, returns, market analysis |

### Target state by document

#### Proposal PDF (Tier 1, broker-generated)
**Per `Phase_2_Proposal_Communication_Model.md` (Brahma Lipi doc):**
- 2-3 page polished PDF
- Page 1: Broker brand header + Buyer info + Property snapshot
- Page 2: Pricing + payment plan + discounts + DLD treatment
- Page 3: Terms + signatures + broker contact
- Optional bundle: brochures, floor plans appended as later pages
- Generated on demand, audit trail

#### Site Visit Invite
**Triggered when:** broker logs Visit activity with scheduled_at
**Channels:** Email + WhatsApp (parallel)
**Content:**
- Branded header (company logo)
- Visit details: date, time, duration, unit ref
- **Location pin** (Google Maps embed/link from inventory)
- Broker contact (call/WhatsApp)
- "Need a ride?" CTA → pick-and-drop request
- Calendar attachment (.ics file for email)
- Confirmation request button

#### Commission Invoice
**Generated when:** Opp moves to "SPA Signed" or admin creates manually
**Format:** Professional invoice PDF
**Content:**
- Brokerage letterhead
- Developer details (billing party)
- Invoice number, date, due date
- Property + buyer details
- Commission breakdown (gross, VAT, net)
- Payment terms
- Bank details for transfer
- Auto-emailed to developer's accounts contact

#### Closure Summary (NEW)
**Generated when:** Opp moves to "SPA Signed"
**Content:**
- Cover: Property + Buyer + Closing date
- Section 1: Final proposal terms (last accepted V_n)
- Section 2: KYC documents bundle (Emirates ID, passport, etc.)
- Section 3: Payment plan + schedule
- Section 4: Commission breakdown
- Section 5: Linked SPA reference
- Format: One PDF, all documents embedded or linked
- Purpose: Audit trail, broker's own records, compliance

#### Pipeline Report
**Current:** Basic Excel + PDF
**Phase 2:** Executive-grade
- Branded cover
- Pipeline chart by stage + value
- Conversion funnel
- Top deals + risk deals
- Agent performance summary
- AI-generated narrative summary
- Trend vs prior period

#### Manager Weekly Report (NEW)
**Auto-generated Monday 7am**
- Email + PDF attached
- Pipeline movement (deals added/closed/lost since last week)
- Stale deals alert (no activity 7+ days)
- Top performer + bottom performer
- Stuck stages (deals 14+ days in same stage)
- AI insights: patterns, recommendations

#### Investor Quarterly Review (NEW)
**Triggered:** End of quarter or on demand
- Board-ready PDF
- Portfolio summary (units sold, AED, by developer)
- Returns analysis (commission realization rate)
- Market intelligence (PropPulse trends)
- Customer segmentation breakdown (investor vs end-user)
- Strategic recommendations

---

## Part 3 — Email & WhatsApp Templates

### Current state
- Email: manual composition, generic content
- WhatsApp: manual, no templates
- No persona-aware content
- No automation

### Target state — Template Library

#### Investor templates (buyer_intent='investor')
```
1. INVESTOR_NEW_LAUNCH
   Trigger: New project added to PropPulse + matches buyer's preference profile
   Content: Project details + projected yield + early access offer
   CTA: Book a call

2. INVESTOR_MARKET_INTEL_QUARTERLY  
   Trigger: Quarterly auto-send
   Content: UAE market trends + opportunity highlights + portfolio review
   CTA: Schedule strategy session

3. INVESTOR_PORTFOLIO_REPORT
   Trigger: Customer has 2+ properties, annual or semi-annual
   Content: Yield analysis on owned portfolio + diversification recommendations
   CTA: Discuss next purchase
```

#### Owner-Occupier templates (buyer_intent='owner_occupier')
```
4. OWNER_LIFESTYLE_NEIGHBOURHOOD
   Trigger: After 1 month residency
   Content: Local lifestyle, community events, recommendations
   CTA: Community group invite

5. OWNER_ANNIVERSARY  
   Trigger: 1 year after became_customer_at
   Content: Anniversary message + service check-in
   CTA: Feedback + referral

6. OWNER_NURTURE_SEQUENCE
   Trigger: Owner-occupier raw lead, day 1/3/7/14
   Content: Lifestyle content, family-oriented properties, financing tips
   CTA: Schedule viewing
```

#### Transactional templates (lifecycle-driven)
```
7. PROPOSAL_DELIVERY
   Trigger: Broker sends proposal
   Content: "Your proposal for [unit]..." + PDF attached + next steps
   CTA: Schedule call to discuss

8. SITE_VISIT_CONFIRMATION
   Trigger: Visit activity logged with future scheduled_at
   Content: Date + location pin + broker contact + pick-up option
   CTA: Confirm attendance / Request pickup

9. SITE_VISIT_REMINDER
   Trigger: 24 hours before scheduled visit
   Content: Reminder + location + checklist (ID, family members, etc.)
   CTA: Reconfirm

10. SITE_VISIT_FOLLOWUP
    Trigger: Day after visit
    Content: Thanks + summary + next steps
    CTA: Book next viewing / Send proposal

11. PROPOSAL_FOLLOWUP_7DAYS
    Trigger: Proposal sent + 7 days no response
    Content: Gentle nudge + alternative units + flexibility offer
    CTA: Schedule discussion

12. CLOSED_WON_WELCOME
    Trigger: Closed Won
    Content: Congratulations + onboarding info + handover timeline
    CTA: Begin handover process
```

### Template engine requirements
- **Variables:** {{buyer_name}}, {{unit_ref}}, {{project}}, {{price}}, {{date}}, {{broker_name}}, {{broker_phone}}
- **Branding:** Per-company logo, colors, signature (already in Companies table)
- **Personalization:** Pull from lead + opp + unit + proposal data
- **Multilingual:** EN + AR support
- **Preview:** Before send, broker sees final composed message
- **Audit:** Logged as activity with template_id reference

### Bulk send (per lead lifecycle doc)
- Select customers by buyer_intent + lifecycle_stage
- Apply template
- Preview compose
- Schedule send time
- Track delivery + open + click

---

## Part 4 — Build Plan

### Phase 2A — Foundation (Week 1, 5 days)
- Day 1: PDF generation library setup (jsPDF or react-pdf)
- Day 2: Branded template system (header, footer, fonts)
- Day 3: Proposal PDF generation (Brahma Lipi)
- Day 4: Commission invoice PDF
- Day 5: Closure summary bundle

**Output:** All core documents generate as professional PDFs

### Phase 2B — Site Visit + Bundle (Week 2, 5 days)
- Day 1: Brochure upload UI (project + unit level)
- Day 2: Bundle composition service (combine PDFs)
- Day 3: Multi-entry-point send action (Inventory/Lead/Opp/Proposal)
- Day 4: Site visit invite generator (email + WhatsApp + .ics)
- Day 5: Pick-and-drop coordination workflow

**Output:** Customer-facing context flows from broker to buyer professionally

### Phase 2C — Email & WhatsApp Templates (Week 3, 5 days)
- Day 1: Template engine + variable substitution
- Day 2: Branded email templates (transactional)
- Day 3: WhatsApp Business API integration
- Day 4: Marketing templates (investor + owner-occupier)
- Day 5: Bulk send + scheduling + tracking

**Output:** Marketing automation foundation

### Phase 2D — Reports (Week 4, 5 days)
- Day 1: Pipeline report executive PDF
- Day 2: Manager weekly auto-report
- Day 3: Investor quarterly review template
- Day 4: AI narrative generation for reports
- Day 5: Email delivery + scheduling

**Output:** All reporting at executive standard

### Total Phase 2 Communications: ~4 weeks focused work

---

## Part 5 — Demo Positioning (June 5)

### If investor asks: "Can I see a proposal PDF?"

Today's honest answer:
> "Today proposals are text-based for speed — broker creates V1, V2, V3 in seconds without PDF generation overhead. Phase 2 (Q3 2026) adds the polished PDF layer — branded, with attachments, downloadable, shareable. The data model is ready; we add the rendering layer."

### If investor asks: "What about marketing emails?"

> "PropCRM today is workflow-focused. Phase 2 adds the marketing layer — investor newsletters, owner-occupier nurture sequences, automated follow-ups. We capture buyer_intent at lead creation (investor, owner-occupier, hybrid, corporate, reseller) so campaigns are targeted, not spray-and-pray."

### If investor asks: "How professional are the outputs?"

**Honest answer with confidence:**
> "Right now, basic. Phase 2 Communications Overhaul (4 weeks Q3 2026) brings everything to executive standard: branded PDFs, professional email templates, WhatsApp Business API integration, automated reports. The foundation is solid — capture the data, generate the outputs. Phase 2 just builds the rendering layer on top of clean data."

**Investor takeaway:** Founder knows the gaps, has them roadmapped, doesn't pretend.

---

## Why This Document Matters

### Risk if NOT captured
- Buyer asks "where's my proposal PDF?" → broker improvises with screenshots
- Manager asks for weekly report → broker exports raw Excel, embarrasses pipeline
- Investor asks "show me a customer email" → nothing to show
- These small gaps compound into "not ready" perception

### Strategic value if captured
- One comprehensive Phase 2 sprint solves a domain-wide gap
- Marketing automation enables revenue acceleration
- Professional output = brokerage scaling justification
- Investor confidence: "they know what they don't have"

---

## Connection to Other Phase 2 Work

| Phase 2 Doc | Connection |
|---|---|
| `Phase_2_Proposal_Communication_Model.md` (Brahma Lipi) | Proposal PDFs = part of this overhaul |
| `Phase_2_Lead_Lifecycle_Segmentation.md` | Buyer intent drives template selection |
| `Phase_2_Activity_Logging_Everywhere.md` (FAB) | Activities trigger comms (visit logged → invite sent) |
| `Phase_2_Role_Based_Dashboard_Vision.md` | Manager weekly report = part of role view |
| `Phase_2_Backlog_Master_Doc.md` | Master tracker — link this from there |
| `Dev2_Refactor_Activity_Logging.md` | Architecture clean enough to add templates atop |

**Everything compounds.** Phase 2 builds in 4 weeks what scattered effort would take 12.

---

## Founder Notes Preserved

> "pick up and drop is new but the site visit location is already a part of inventory attachment to site visit invite is new"

> "all the docs, reports and mails needs to be relooked at the end which are at the moment very minimal below the basic level"

**The architect's reading:** Founder accepts current outputs are weak and wants comprehensive overhaul — not piecemeal fixes.

---

## Status

- [x] Captured in Phase 2 strategic docs
- [ ] PDF library selected
- [ ] Template engine designed
- [ ] WhatsApp Business API account
- [ ] Email service provider (Resend / Sendgrid / SES)
- [ ] Built in dev2 / Phase 2

---

## What's IN scope for Phase 1 demo

**Phase 1 (June 5) keeps current state:**
- Proposals: text-based (current is sufficient for demo)
- Reports: existing Excel/PDF export
- Emails: not auto-sent
- WhatsApp: not integrated

**Demo narrative for any of the above:**
> "Phase 1 today. Phase 2 Communications Overhaul (4 weeks Q3 2026) brings all output to executive standard."

**That's enough.** Don't promise more than today's truth.

---

*Document created: 23 May 2026 (Saturday morning, Day 11)*
*Source: Founder review of current vs target output quality*
*Status: Phase 2 priority, sequenced after Lead Lifecycle + FAB*
*Estimated effort: 4 weeks focused build*
*Connects to: All other Phase 2 docs (master tracker references)*
