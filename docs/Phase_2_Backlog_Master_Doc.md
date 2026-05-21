# Phase 2 Backlog — Master Document
**Date captured:** 21 May 2026 (Thursday, Day 9)
**Captured during:** Founder-led app walkthrough finding "richness in app flows"
**Purpose:** Consolidate ALL Phase 2 backlog items + Phase 1 hidden features into one strategic record
**Audience:** Founder reference + investor Q&A backing + team onboarding when scaling
**Status:** Live document — updated as new items emerge

---

## TL;DR — What's in Phase 1 (June 5 demo) vs What's deferred

### Phase 1 (Live for June 5 demo)
**Workflow features:**
- Dashboard with KPIs, pipeline, recent activity
- Leads + Opportunities with stage gates
- Proposals V1→V2→V3 with audit trail + pre-fill
- Negotiations with reference line
- Dashboard's 7-tab opportunity view
- SPA Signed workflow
- Master Agreements (commission %, bonuses)

**Intelligence features:**
- PropPulse with AI Agent (Claude Sonnet 4.5 + web search)
- Verification Queue
- 20 developers + 90+ projects + 119 units

**Financial features:**
- Commission Outstanding dashboard
- Buyer outflow vs Broker revenue separation

**Infrastructure:**
- Multi-tenant (4 companies)
- Per-company config (business type, plan, brand, AI name)
- Role-based authentication
- AI Coach per deal

### Phase 1 — HIDDEN (built but hidden behind menu)
| Feature | Why hidden | When to re-enable |
|---|---|---|
| Discounts approval | Developer persona, broker doesn't use | Phase 2 (developer persona) |
| Activity Log | Replaced by role-aware Dashboard | Phase 2 (role-aware Dashboard) |
| Permissions #1 (RBAC) | Admin config, not broker workflow | Phase 2 (unified Settings) |
| Permissions #2 (duplicate) | Empty, looks broken | Phase 2 (consolidate or remove) |
| Group View | Placeholder "Planned for MVP" | Phase 2 (parent-subsidiary aggregation) |
| OpportunityDetail (old) | Orphan 87KB file | Phase 2 cleanup |
| Cover Message Preview | Will be replaced by PDF | Phase 2 (PDF generation) |

---

## Section 1 — Today's Hidden Features (in order discovered)

### 1.1 Discounts — Developer-persona approval workflow
**Commit:** `588c7df` — Hide Discounts menu for Phase 1 broker demo  
**Status:** Code preserved (DiscountApprovals.jsx, 147 lines)  
**Component reads from:** `discount_requests` table  
**Original intent:** Sales agent requests discount > threshold → manager/admin approves  
**Currently:** 0 records, not used in broker workflow (discounts handled inline in proposal)

**Phase 2 trigger:** When developer persona ships  
**Phase 2 effort:** Already built — just unhide + maybe extend workflow  
**Phase 2 timing:** Q3 2026 (post-pilot, after broker workflow proven)

### 1.2 Activity Log — Replaced by role-aware Dashboard
**Commit:** `0b84c73` — Hide Activity Log menu for Phase 1 demo  
**Status:** Code preserved  
**Original intent:** Manager's view of team activity  
**Currently:** Shows chronological dump (1990s pattern)

**Phase 2 design:** See `Phase_2_Role_Based_Dashboard_Vision.md`  
**Phase 2 effort:** 2 weeks for role-aware Dashboard  
**Phase 2 timing:** July 2026

### 1.3 Permissions (the real one — RBAC)
**Commit (this session):** Hide Permissions menu for Phase 1 demo  
**Status:** Code working — 6 built-in templates + custom sets  
**Why hide:** Admin config, not part of broker daily workflow demo

**Phase 2 plan:** Fold into unified Settings module  
**Phase 2 effort:** Settings module rework — 3-4 days  
**Phase 2 timing:** July-August 2026

### 1.4 Permissions (duplicate empty)
**Commit (this session):** Hide as part of above  
**Why hide:** Empty, looks broken in demo  
**Phase 2 plan:** Determine if this was intended distinct feature or accidental duplicate. Remove or consolidate.

### 1.5 Group View
**Commit (this session):** Hide as part of above  
**Status:** UI placeholder, no implementation  
**Original intent:** Consolidated reporting across parent + subsidiary brokerages  
**Example scenario:** Al Mansoori has subsidiaries in Dubai + Sharjah + Abu Dhabi — group view consolidates

**Phase 2 design needed:**
- Parent-subsidiary relationship schema
- Group-level KPI aggregation logic
- Drill-down: Group → Subsidiary → Agent → Deal
- Group-level reports

**Phase 2 effort:** 1-2 weeks  
**Phase 2 timing:** Q4 2026 (after multi-brokerage onboarding starts)

---

## Section 2 — Architectural Roadmap Items (raised in conversations)

### 2.1 PropPlatform / Property Operating System Vision
**Founder vision:** PropCRM is Phase 1 (broker). Long-term: Property Operating System for all real estate personas.

**Persona roadmap:**
| Persona | Phase | Timing |
|---|---|---|
| Broker / Sales Agent | Phase 1 | NOW (June 5 demo focus) |
| Real Estate Agency | Phase 1 | NOW (multi-tenant supports) |
| Sales Manager (with team view) | Phase 2 | July 2026 (role-aware Dashboard) |
| Developer Operations | Phase 2 | Q3 2026 |
| Construction Manager | Phase 3 | Q4 2026 |
| Facilities Manager | Phase 4 | 2027 |

**Common architecture:** Each persona gets role-aware dashboards, configurable workflows, persona-specific modules.

### 2.2 Two-Tier Proposal Model (Brahma Lipi)
**Document:** `Phase_2_Proposal_Communication_Model.md`  
**Vision:**
- Tier 1 (Broker PDF) — communication-grade, generated in PropCRM
- Tier 2 (Developer Document) — legal-grade, uploaded as PDF

**Phase 2 effort:** 14-18 hours (per Phase 2 doc)  
**Phase 2 timing:** July 2026

### 2.3 Configurable Roles per Company (RBAC builder)
**Founder note today:** *"Roles mentioned there are hard coded... we have to see how to define roles based on the company requirements"*

**Current state:** Hard-coded 7 roles (Super Admin / Admin / Sales Mgr / Sales Agent / Leasing Mgr / Leasing Agent / Viewer)

**Phase 2 vision:**
- Each brokerage can define their own role hierarchy
- Example: Al Mansoori has "Junior Agent / Senior Agent / Team Lead"
- Permissions assignable per custom role
- Inherit from built-in templates as starting point

**Phase 2 effort:** 3-5 days  
**Phase 2 timing:** Q3 2026 (after pilot feedback validates need)

### 2.4 Unified Settings Module
**Founder note today:** *"there are settings everywhere we have to actually design a better module"*

**Current state:** Settings scattered across:
- Companies (edit dialog — brand, AI name, business type, plan)
- Users (sub-tab Settings — CRM mode, currency)
- Permissions (RBAC templates)
- Various inline configs

**Phase 2 vision:** One Settings page with sections:
- Branding (logo, colors, AI name)
- Workflow (stage gates, approval thresholds)
- Roles & Permissions (custom RBAC builder)
- Integrations (Anthropic, Google Maps, payment gateways)
- Notifications (email, SMS, in-app rules)
- Data sources (PropPulse sources, paid feeds)

**Phase 2 effort:** 1 week  
**Phase 2 timing:** July-August 2026

### 2.5 Negotiation Round → Proposal Auto-Flow
**Mentioned this morning, EOD discussion pending**

**Vision:** When negotiation round status = "Accepted", offer broker:
- "📤 Agreed terms ready — Apply to next Proposal?"
- Click → opens Proposal Builder pre-filled with V_latest + accepted round terms

**Open architectural questions (4):**
1. Which terms apply (all asks vs party-owned)?
2. Conflict resolution across rounds?
3. Manual override semantics?
4. Visual signal in proposal builder?

**Phase 2 effort:** 30-45 min implementation when designed  
**Phase 2 timing:** Decide before June 5 demo OR Phase 2

### 2.6 Multi-tenant Verification
**Phase A Verification item from past chats**  
**Status:** Schema designed (company_id everywhere), needs penetration testing  
**Phase 2 effort:** 1 day  
**Phase 2 timing:** Before scaling beyond pilot

### 2.7 PDF Generation Capability
**Document:** `Phase_2_Proposal_Communication_Model.md`  
**Required for:**
- Broker proposal PDFs (Tier 1)
- Investor reports
- Commission invoices
- Master agreement exports
- Demo screenshots backup

**Phase 2 effort:** 4-6 hours (using jsPDF or react-pdf)  
**Phase 2 timing:** July 2026

### 2.8 Paid Data Source Integrations
**Founder quote:** *"if we connect to the paid services also it will be a Miracle"*

**Phase 2 targets:**
- RERA Dubai API (project registry, RERA numbers)
- DLD project registry (validated handover dates, project status)
- Bayut / PropertyFinder feeds (cross-validate inventory)
- Construction tracker services

**Phase 2 effort:** 2-3 weeks (per source)  
**Phase 2 timing:** Q3 2026 (after pilot validates broker workflow)

---

## Section 3 — Demo-Specific Improvements (Pre-June 5)

### 3.1 Dashboard CSS Bug (white-on-white greeting)
**Status:** Founder spotted, logged, NOT FIXED  
**Why deferred:** Cosmetic, batch with other CSS fixes  
**Effort:** 5 min  
**Schedule:** Days 2-3 before demo

### 3.2 Projects row not clickable
**Status:** UX bug, founder spotted, NOT FIXED  
**Effort:** 30 min — add onClick navigation to detail modal  
**Schedule:** Days 4-7 before demo (or skip — investor can use Edit button)

### 3.3 13 "Unlinked" deals in Commission Outstanding
**Status:** Data hygiene, makes demo look messy  
**Fix:** SQL UPDATE to link them to developers  
**Effort:** 30 min  
**Schedule:** Day before demo (pre-demo cleanup)

### 3.4 Sample brochure PDFs for demo opp
**Status:** Documents tab empty in Inventory  
**Fix:** Upload 1-2 brochure PDFs to Supabase Storage + link to Shrikant's AGR-09-05  
**Effort:** 45 min  
**Schedule:** Days 4-7 before demo

### 3.5 Sample floor plan for demo unit
**Status:** Same as 3.4  
**Effort:** 30 min  
**Schedule:** Days 4-7 before demo

### 3.6 RAK Properties scrape fix
**Status:** ✅ DONE today (commit `79ed411`)

### 3.7 Verify 5-10 high-confidence queue items
**Status:** 41 items in queue, want catalog to grow visibly  
**Action:** Click ✓ Verify on top 5-10 (95%+ confidence)  
**Effort:** 10 min  
**Schedule:** Day before demo

---

## Section 4 — Phase 2 Build Schedule (Tentative)

### Post-pilot (July 2026)
- **Week 1-2:** Role-Based Dashboard (Phase_2_Role_Based_Dashboard_Vision.md)
- **Week 3:** PDF Generation (Phase_2_Proposal_Communication_Model.md)
- **Week 4:** Unified Settings module

### Q3 2026
- **Aug:** Configurable RBAC per company
- **Aug-Sep:** Developer persona launch (re-enable Discounts approval)
- **Sep:** PropPulse paid source integration (RERA first)

### Q4 2026
- **Oct:** Group View / parent-subsidiary aggregation
- **Nov:** Construction persona Phase 3
- **Dec:** AI brochure scanner re-enable + extend

### 2027+
- Facilities Manager persona
- Marketplace commissions
- Property Operating System full breadth

---

## Section 5 — Founder Quotes Preserved (Today's Wisdom)

### On the PropOS vision
> "Initially I thought that this app will be all purpose app, and we will have setups salesforce/ms crm etc. and options for sales meaning (Developer, Broker Individual, Broker Company, Real estate agencies etc.) to setup everything... final aim is to have the Property Operating System 1stop shop for everything, I still have it in mind."

### On data refresh + PropPulse intent
> "I was always in the opinion it is not showing because there is no data"

### On the PropPulse breakthrough
> "It is not Gold it is more than that, only on the public domain we are getting this, if we connect to the paid services also it will be a Miracle"

### On role-based design
> "Role based Dashboard is a fantastic decision"

### On scattered settings
> "there are settings everywhere we have to actually design a better module"

### On hard-coded roles
> "Roles mentioned there are hard coded i think for 3-4... we have to see how to define roles based on the company requirements"

### On proposal communication model (Brahma Lipi)
> "all the proposals should go with all the details of the property with these details... the final proposal the buyer will accept and sign is from the developer this is only for the communication for the broker"

### On confining scope
> "we have to talk to much and confine to one concept first to articulate this situation"

### On the architectural maturity
> "Yes it is designed, thats why everywhere company id filtering is added"

---

## Section 6 — Investor Q&A Backing

When investor asks about gaps or roadmap, this doc backs your answers:

### Q: "What's NOT built yet?"
A: Refer to Section 1 (Phase 1 hidden) + Section 2 (Phase 2 roadmap). Be specific:
- "Discount approval workflow is built but hidden — developer persona feature, ready when we add developer-side users"
- "Role-aware Manager Dashboard is Phase 2 (July) — current Activity Log was the placeholder, we're replacing it with embedded analytics like Salesforce"
- "PDF proposal generation is Phase 2 (July) — current text-based proposal is sufficient for broker-buyer communication"

### Q: "How do you scale to 100 brokerages?"
A: "Multi-tenant from day one — `company_id` filtering on every query, per-company branding + AI naming + plan tiers. Permissions framework supports custom roles per brokerage in Phase 2. Group View consolidates parent-subsidiary aggregation in Phase 3."

### Q: "Where's your roadmap?"
A: Show Section 4. "We've planned through Q4 2026 with specific deliverables, not just slides."

---

## Section 7 — Document Cross-Reference Map

This master doc consolidates these specific Phase 2 documents:
- `Phase_2_Proposal_Communication_Model.md` — PDF + Developer upload (Section 2.2, 2.7)
- `Phase_2_Role_Based_Dashboard_Vision.md` — Manager view (Section 1.2)
- `Day9_App_Audit_Strategic_Plan.md` — Today's audit findings
- `Investor_Demo_Script_v3_1_21May2026.md` — Demo script (references this doc)

---

## Section 8 — Update Discipline

**This document gets updated when:**
- A new Phase 2 backlog item is identified
- A Phase 1 feature is hidden for demo
- A Phase 2 item is completed and graduates to Phase 1
- Investor Q&A reveals a question not yet addressed
- New strategic vision element emerges from founder

**Don't fragment Phase 2 into many tiny docs.** Add sections HERE.  
Exception: Big design specs (like Role-Based Dashboard Vision) get their own doc, but referenced here.

---

*Document created: 21 May 2026 (Thursday afternoon, Day 9)*
*Captured during: App walkthrough hidden-features discovery*
*Status: Live document, will update through Phase 1 and Phase 2 build*
*Next update trigger: When new Phase 2 item identified or Phase 1 hide decision made*
