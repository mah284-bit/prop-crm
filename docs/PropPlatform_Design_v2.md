# PropPlatform — Configurable Property Industry Platform
## Design Specification v2.0

**Status:** DRAFT — for internal review with broker community
**Date:** 03 May 2026
**Owner:** Abid Mirza
**Engineering:** Claude (Anthropic)
**Mission NOW:** Ship Broker Edition as the awaited solution to broker market pain
**Vision:** Configurable platform for the entire UAE property industry, expanded segment-by-segment over 2-3 years
**Anchor customer:** Al Mansoori Properties (broker)

---

## 1. Mission and vision — clarity before code

### 1.1 What we are shipping NOW (immediate)

**PropPlatform — Broker Edition.**

The mission is singular and disciplined: **deliver the awaited solution to the UAE broker market's pain points.**

Brokers in UAE are underserved by current software. They use Zoho/HubSpot adapted poorly, or Excel, or nothing. None of these are AI-native, none are UAE-specific, none understand the broker workflow end-to-end.

PropPlatform Broker Edition is the answer:
- AI-native (Briefing, Coach, Match, Compose, Suggest)
- UAE-specific (Arabic greetings, AED, payment plans, DLD references where relevant)
- End-to-end broker workflow (lead → site visit → proposal → forwarded to developer → commission collected)
- Multi-tenant SaaS (each brokerage isolated, scales to thousands of firms)

**This is what goes live. Nothing else right now.**

### 1.2 What we are NOT shipping (deliberate restraint)

**No Builder Edition. No Contractor Edition. No Construction Edition. No Facilities Management. No big-bang platform launch.**

> *"I don't believe in big bang. I know I will lose interest as it goes beyond a limit and project shut down."* — Abid

This is hard-earned founder wisdom. Most platform plays die because they try to be everything before they're great at one thing. Customers don't pay for "configurable platform that could do many things." They pay for "the tool that solved my specific pain."

**Discipline: ship broker first. Sign 10-20 broker customers. Prove the model. THEN expand.**

### 1.3 The longer-term vision (2-3 years, segment by segment)

**PropPlatform — the operating system for the UAE property industry.**

Once Broker Edition is shipped and validated:

- **Year 1:** Broker Edition launches. Sign anchor + 10-20 customers. Prove product-market fit.
- **Year 2 H1:** Builder Edition added. Existing customers see the announcement. New market opened. Most architecture reused.
- **Year 2 H2:** Contractor Edition added. Construction project tracking, sub-contractor management.
- **Year 3 H1:** Construction Planning Edition. Land acquisition, master plan tracking, regulatory submissions.
- **Year 3 H2:** Facilities Management Edition. Post-handover building operations, tenant requests, maintenance.

**Cadence: 1-2 new segments per year, never more.** Each release is a market announcement, a press moment, a customer expansion opportunity.

By Year 3-4: PropPlatform is the unified system across the property industry value chain. **No competitor in UAE has this position.**

### 1.4 The architectural commitment

The architecture decision made in design v1.0 — **configurable workflows, template-driven, field-type registry** — is exactly the foundation that supports this vision.

**What gets built for Broker Edition (today's work) becomes the foundation, not throwaway code.** Each future segment edition reuses:
- The same configurable workflow engine
- The same field type registry
- The same Lead/Opportunity/Activity/AI infrastructure
- The same multi-tenant architecture

Each new segment edition adds:
- A new workflow template (set of stages and fields)
- Possibly 2-3 new field types specific to that segment
- Segment-specific reports and dashboards

**No reinvention. No throwaway. Each release builds on the last.**

This is the central architectural commitment of this document.

---

## 2. Strategic context — why broker first

### 2.1 Market reality

| Segment | UAE firm count | Per-firm budget | Sales motion | Time to revenue |
|---|---|---|---|---|
| **Broker** | ~5,000+ | AED 200-2,000/mo SaaS | High-velocity SaaS | 2-3 months |
| **Builder/Developer** | ~30-50 major | AED 10K-100K/mo enterprise | Long enterprise sale | 6-12 months |
| **Contractor** | ~500+ | AED 500-5,000/mo SaaS | Medium-velocity | 3-6 months |
| **Construction Planning** | Tens | Enterprise | Long sale | 12+ months |
| **Facilities Management** | Hundreds | AED 1K-10K/mo | Medium-velocity | 3-6 months |

**Broker is the volume play.** Highest firm count, fastest sales cycle, recurring SaaS revenue, most direct path to product-market fit and meaningful MRR.

### 2.2 Why broker pain is "awaited solution" territory

Specific, validated pains brokers face today:
- **No AI-native CRM in UAE.** Zoho/HubSpot are generic, not optimised for property workflows.
- **Lead duplication and inter-agent conflict** is industry-wide pain (already solved with Layer 1 + 3 dedup).
- **Site visit follow-up is manual.** Agents lose deals because reminders fall through. (Solved with Reminders Bell + AI Briefing.)
- **Proposals are written by hand.** Time-consuming, inconsistent. (Solved with AI Compose + Suggest Terms.)
- **Inventory matching to buyer is mental work.** Agents memorise stock or scroll lists. (Solved with AI Match.)
- **No visibility for managers.** Can't see team activity at a glance. (Manager Activity Log redesign in backlog.)

**PropPlatform Broker Edition addresses every one of these specifically. That's why it's the awaited solution.**

### 2.3 Anchor customer

**Al Mansoori Properties** — broker firm, our first customer.

Al Mansoori validates:
- Broker workflow (their daily process)
- Multi-tenant architecture
- AI features in real broker context
- UAE-specific requirements (Arabic, AED, DLD references where relevant)
- Pricing model (broker SaaS subscription)

Once Al Mansoori is live, we go to second and third broker customers, publish reference cases, scale.

---

## 3. Broker vs other segments — what each does

### 3.1 Broker responsibility (TO BE CONFIRMED with brokers)

> *"Broker does not make any collections as it is all done by builder. Once the customer is handed over to the builder, broker responsibility ends."* — Abid

**Broker's core responsibilities (validate with broker community):**

1. Source the lead (referral, marketing, walk-in, online listings)
2. Qualify the buyer (budget, timeline, requirements, residency status)
3. Conduct site visits and property tours
4. Negotiate offer terms with buyer
5. Forward accepted offer to developer / property owner
6. Track commission status until paid
7. Maintain relationship for repeat business and referrals

**Broker DOES NOT:**

- Collect deposits or major payments from buyer (developer's role)
- Issue receipts or reservation forms (developer's role)
- Handle SPA drafting or DLD registration (developer's role)
- Manage payment plans (developer's role)
- Verify buyer documents for compliance (developer's role)

**OPEN QUESTIONS for broker community feedback:**

1. Does broker collect any token amount or agency fee directly from buyer?
2. What's the typical workflow from "offer accepted" to "commission paid"?
3. How do you track which developer received the forwarded offer?
4. How long does commission collection typically take after handover?
5. Do you re-engage rejected leads? On what trigger?
6. Do you track post-handover for repeat business / referrals?
7. What lost reasons do you encounter most? (Top 5)
8. Are there RERA / regulatory checkpoints in your workflow?
9. Do you ever co-broker (split commission with another firm)?
10. How is commission divided internally (firm vs individual agent vs sub-agent)?
11. What's your handling of "buyer goes to another broker after seeing units with you"?
12. What documents do YOU need from buyer at any stage?
13. If we built ONE broker workflow you'd actually use, what would the stages be?

### 3.2 Other segments (architectural awareness only — NOT being built now)

**Builder/Developer (Year 2):**
- Reservation deposit collection (multiple methods)
- Offer acceptance form issuance
- Receipt management
- Validity period management
- Name insertions on contract (per-name developer fees)
- SPA drafting and execution
- DLD/Oqood registration
- Payment plan management
- Document compliance and verification
- Handover scheduling and execution
- Commission payment to brokers

**Contractor (Year 2-3):**
- Project bidding and quoting
- Sub-contractor management
- Materials sourcing and tracking
- Site progress reporting
- Invoice and payment milestones
- Quality inspections

**Construction Planning (Year 3):**
- Land acquisition tracking
- Master plan submissions
- Regulatory approvals (Trakhees, DM, Civil Defense)
- Architect and engineer coordination
- Pre-launch sales coordination

**Facilities Management (Year 3):**
- Tenant management (post-handover)
- Maintenance request workflow
- Annual contract renewals
- Vendor/contractor coordination
- Service level tracking

**Each is a future template. Same platform. Not built now.**

### 3.3 The architectural commitment

**Decisions made today must not block future segment expansion.**

Specifically:
- Stage definitions are template-driven, not hardcoded
- Field types are registry-based, extensible without rebuilding
- Multi-tenant data isolation works for any segment, any company size
- AI features are workflow-aware (read whatever fields the template defines)
- Reports are template-aware
- Single-codebase, single-deployment model holds across all segments

---

## 4. Architectural design

### 4.1 Data model

#### 4.1.1 New JSON column on `companies` table

```
companies.workflow_config = JSONB

Structure:
{
  "version": 1,
  "template_origin": "broker_v1" | "builder_v1" | ...,
  "segment": "broker" | "builder" | "contractor" | ...,
  "edition": "broker" | "builder" | ...,
  "stages": [ /* see 4.1.2 */ ],
  "transitions": { /* see 4.1.4 */ }
}
```

Defaults:
- New companies: assigned a template based on `segment` at creation
- Al Mansoori (existing): assigned `broker_v1` template, mapped from current hardcoded stages

#### 4.1.2 Stage definition

```
{
  "id": "site_visit",                 // STABLE identifier; never change after release
  "label": "Site Visit",              // Display name (editable per company)
  "color": {"bg": "#EDE9FE", "fg": "#7C3AED"},
  "icon": "🏠",
  "is_terminal": false,
  "is_won": false,
  "is_lost": false,
  "section_color": "purple",
  "fields": [ /* field definitions */ ],
  "validation_rules": [ /* required-fields and cross-field rules */ ]
}
```

**Stable IDs are critical:** if an admin renames "Site Visit" to "Property Tour," the underlying ID stays the same so historical opp data still maps. Renames affect the label, not the ID.

#### 4.1.3 Field type registry

| Type | Renders as | Used by | Edition |
|---|---|---|---|
| `text` | text input | reference numbers, names | All |
| `number` | number input | amounts, counts | All |
| `date` | date picker | event dates | All |
| `checkbox` | checkbox | acknowledgements | All |
| `select` | dropdown | enumerated values | All |
| `textarea` | multiline text | notes | All |
| `file_upload` | file picker | proof documents | All |
| `name_insertions` | multi-row composite | contract co-buyers | Builder (Year 2) |
| `deposit_amount` | composite (AED/% toggle) | reservation deposits | Builder (Year 2) |
| `forfeiture_radio` | radio with conditional % | forfeiture terms | Builder (Year 2) |

**Broker Edition v1 only needs the 7 simple types.** The 3 composite types are designed but built only when Builder Edition is queued.

#### 4.1.4 Transitions

```
"transitions": {
  "new":          ["contacted", "closed_lost"],
  "contacted":    ["site_visit", "closed_lost"],
  ...
  "any":          ["closed_lost"]
}
```

Two modes:
- **Strict** — must follow defined transitions
- **Flexible** — agent can pick any stage (sales reality)

**Broker Edition v1: flexible.** Sales is messy.
**Builder Edition (future): strict.** Compliance-driven.

#### 4.1.5 Validation rules

Per-field `required: true` is the simplest. Cross-field rules (Builder need) deferred to v2.

### 4.2 Template library

**Broker Edition v1 (NOW)** — DRAFT pending broker community confirmation:

```
Stages:
1. New                          (no required fields)
2. Contacted                    (call type + notes)
3. Site Visit                   (date + units + outcome)
4. Proposal Sent                (offer + validity)
5. Negotiation                  (rounds, existing logic)
6. Offer Accepted               (final terms + buyer commit)
7. Forwarded to Developer       (developer + ref + expected commission + date)
8. Awaiting Confirmation        (status + follow-up date)
9. Confirmed                    (confirmed date + handover date + notes)
10. Commission Pending          (invoice # + dates + invoice PDF upload)
11. Closed Won                  (actual commission + payment date + payment proof)
12. Closed Lost                 (reason + competitor + re-engage date)
```

**Builder Edition (Year 2)** — designed in Appendix A. Built when queued.

**Contractor / Construction / FM Editions** — designed when queued in Year 2-3.

### 4.3 Code architecture

#### 4.3.1 New components

- **`<DynamicStageGate>`** — replaces hardcoded showStageGate dialog. Reads stage config, renders fields dynamically, validates per stage rules, persists to opp.structured_data.
- **`<DynamicFieldRenderer>`** — renders one field by type from registry.
- **`<StageCapturedDataCard>`** — generic card showing what was captured at any stage.
- **`<WorkflowConfigEditor>`** (deferred) — admin UI to inspect/edit workflow_config.

#### 4.3.2 Module-level helpers

```javascript
getWorkflowConfig(currentUser, companies) -> workflow_config
getStageConfig(workflowConfig, stageId) -> stage object
getStagesList(workflowConfig) -> [stages]
getGatedStages(workflowConfig) -> [stage IDs]
validateStageData(stageConfig, capturedData) -> {valid, errors}

BROKER_TEMPLATE_V1 = { ... }
BUILDER_TEMPLATE_V1 = { ... }   // Year 2
```

#### 4.3.3 Migration of existing hardcoded values

- `OPP_STAGES` constant → `getStagesList(currentCompanyConfig)`
- `OPP_STAGE_META` → derived from stage.color + stage.icon
- `GATED_STAGES` → `getGatedStages(currentCompanyConfig)`
- Existing showStageGate JSX → `<DynamicStageGate>`

**Backward compatibility:** companies without `workflow_config` get `BROKER_TEMPLATE_V1` assigned automatically. Al Mansoori's existing opps map naturally (broker template stage IDs match current hardcoded names).

### 4.4 What survives from Phase F W7

The W7 Reserved-stage upgrade (in `/mnt/user-data/outputs/App.jsx`, NOT pushed):

**Survives — used in Broker Edition v1:**
- `uploadProofFile()` — generic file upload helper
- `addWorkingDays()` — UAE working week calculator
- Defensive INSERT/UPDATE retry pattern

**Captured for Builder Edition (Year 2):**
- `reservationData` shape → Builder Reservation field set
- Reservation Details card UI → Builder stage display widget
- Composite field types — built when Builder Edition queued

**Drops (replaced by config-driven):**
- Hardcoded Reserved-only validation logic
- Hardcoded Reserved gate JSX block
- The `reservationData` state (replaced by generic stageGateData)

**The W7 work is preserved here. NOT pushed to git, NOT lost. Foundation of Builder Edition when its turn comes.**

---

## 5. Implementation plan — Broker Edition v1

### 5.1 Phased commits (sequential, each shippable)

**Phase 1 — Foundation (~2 hours)**
- Add `workflow_config` JSONB column to `companies` table (Supabase UI, ~5 min)
- Define `BROKER_TEMPLATE_V1` constant
- Define field type registry (7 simple types)
- Build `<DynamicFieldRenderer>` for simple types
- Existing hardcoded stages keep working

**Phase 2 — Stage gate refactor (~2 hours)**
- Build `<DynamicStageGate>` component
- Replace existing showStageGate dialog
- Validate Broker template end-to-end
- Companies without workflow_config default to BROKER_TEMPLATE_V1

**Phase 3 — Captured data display (~1 hour)**
- Build `<StageCapturedDataCard>`
- Used post-capture on opp detail page

**Phase 4 — Migration (~1 hour)**
- Map current stage names to broker template stage IDs
- Migration script for existing opps
- Defensive on mismatch

**Phase 5 — Polish + handoff (~1 hour)**
- Default templates by `companies.business_type`
- Sample broker company
- Manual test all 12 stages
- Production-ready

**Total: ~7 hours focused work for Broker Edition v1.**

### 5.2 Deferred to future releases

- **Builder Edition v1** (Year 2 H1, ~6-8 hours when queued)
- **WorkflowConfigEditor** (Year 1 H2 or Year 2)
- **Cross-field validation rules** (when Builder needs them)
- **Custom stage / field creation** (Year 2-3)

### 5.3 Database changes

```sql
-- Add workflow_config column
ALTER TABLE companies
  ADD COLUMN workflow_config JSONB DEFAULT NULL;

-- Optional: index for filtering by template_origin
CREATE INDEX idx_companies_workflow_template
  ON companies ((workflow_config->>'template_origin'));

-- Verify business_type column (likely already exists):
SELECT column_name FROM information_schema.columns
  WHERE table_name='companies' AND column_name='business_type';

-- If not:
ALTER TABLE companies
  ADD COLUMN business_type TEXT
  CHECK (business_type IN ('broker','builder','contractor','construction_planning','facilities_management','both'));
```

Run in Supabase SQL editor. ~2 minutes.

### 5.4 Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Existing opps break on migration | Low | Migration script preserves stage names → IDs; defensive on mismatch |
| Field type registry incomplete for broker | Low | 7 types cover broker fully |
| Templates need adjustment after broker feedback | High | Templates are constants — easy to edit between phases |
| Performance with large workflow_config JSON | Low | JSONB, indexed, cached at company-load |
| Hard to extend platform later | Low | Architecture explicitly designed for segment-by-segment expansion |

---

## 6. Outstanding questions before build

### 6.1 For broker community meeting

(See section 3.1 — 13 questions)

### 6.2 For Abid (after broker meeting)

1. Final broker template — confirmed stages and fields?
2. Any new field types needed beyond the 7 simple types?
3. WorkflowConfigEditor in v1 or deferred?
4. Migration approach for existing Al Mansoori data?

### 6.3 Locked decisions

- ✅ One product, configurable workflows, segment-by-segment expansion
- ✅ Broker first, no big-bang
- ✅ Architecture supports future segments without reinventing
- ✅ Demo timing flexible — pick technical right answer
- ✅ Broker Edition v1: flexible transitions
- ✅ Phase F W7 preserved as Builder Edition foundation, not pushed
- ✅ `golden-pre-stages` git tag is current truth

---

## 7. The roadmap — segment-by-segment

```
═══════════════════════════════════════════════════════════════
NOW (May 2026)
═══════════════════════════════════════════════════════════════

  Broker Edition v1 — IN DEVELOPMENT
  - 5 phases, ~7 hours focused work
  - Demo when stable
  - Anchor: Al Mansoori Properties

═══════════════════════════════════════════════════════════════
SOON (Jul-Aug 2026) — Broker Edition v1.x
═══════════════════════════════════════════════════════════════

  - Reports redesign with KPI cards and charts
  - Manager Activity Log (day-at-a-glance)
  - PDF generation for proposals (broker-branded)
  - Searchable dropdowns globally, typography pass
  - Lib/ refactor (centralise Supabase, shared constants)
  - WorkflowConfigEditor v1 (read-only inspect for admins)

═══════════════════════════════════════════════════════════════
LATE 2026 — Broker Edition v1.5
═══════════════════════════════════════════════════════════════

  - Layer 2 lead-ownership policy (post-customer-conversation)
  - AI extensions (speech, autonomous actions, Site Visit feedback)
  - Holds, documents, payment status as bell signals
  - Post-handover repeat-business tracking

═══════════════════════════════════════════════════════════════
YEAR 2 H1 (~Q1-Q2 2027) — Builder Edition v1
═══════════════════════════════════════════════════════════════

  - BUILDER_TEMPLATE_V1 (Appendix A)
  - Composite field types (deposit_amount, name_insertions, forfeiture_radio)
  - W7 work integrated as Builder Reservation stage
  - Document checklist with verification gates
  - SPA workflow (DLD/Oqood/NOC tracking)
  - Branded PDF generation
  - Marketing: "PropPlatform now serves brokers AND builders"

═══════════════════════════════════════════════════════════════
YEAR 2 H2 (~Q3-Q4 2027) — Contractor Edition v1
═══════════════════════════════════════════════════════════════

  - Project bidding/quoting
  - Sub-contractor management
  - Materials/site progress/milestones
  - Marketing: "Now serving contractors"

═══════════════════════════════════════════════════════════════
YEAR 3+ (2028+)
═══════════════════════════════════════════════════════════════

  - Construction Planning Edition (~H1 2028)
  - Facilities Management Edition (~H2 2028)

  By end of Year 3: PropPlatform is the unified OS for the
  UAE property industry. No competitor has this position.
```

**Discipline: 1-2 segments per year, never more. Each release validated before next is started.**

---

## 8. Glossary

| Term | Meaning |
|---|---|
| **PropPlatform** | The product family — configurable property industry platform |
| **Edition** | A segment-specific version (Broker Edition, Builder Edition, etc.) |
| **Template** | A pre-defined workflow_config for an Edition |
| **Segment** | A market vertical (broker, builder, contractor, etc.) |
| **Workflow** | The sequence of stages a deal goes through |
| **Stage** | A discrete state in the workflow |
| **Field** | A data point captured at a stage |
| **Stage Gate** | A capture dialog shown when moving to a stage that requires data |
| **Composite field** | A field type containing nested sub-fields |
| **Broker** | Agent firm sourcing buyers, connecting to developers |
| **Builder / Developer** | Company that owns and sells property |
| **Contractor** | Company that builds on behalf of developer |
| **DLD** | Dubai Land Department — UAE property registration body |
| **Oqood** | Off-plan property registration system in Dubai |
| **NOC** | No Objection Certificate — required for resale |
| **SPA** | Sale and Purchase Agreement — legally binding contract |
| **RERA** | Real Estate Regulatory Authority — UAE broker regulator |
| **PDC** | Post-Dated Cheque — common UAE payment method |

---

## 9. Sign-off

This document is **DRAFT v2.0**. Final version requires:

- [ ] Broker community feedback on broker template stages and fields
- [ ] Confirmation of broker scope (where responsibility ends)
- [ ] Abid's sign-off on phasing and Broker Edition v1 scope
- [ ] Tech lead (Claude) confirmation that estimates are realistic
- [ ] Investor pitch deck updated to reflect broker-first, platform-vision narrative

**No code is built until this document is signed off.**

---

## Appendix A — Builder Edition design (preserved for Year 2)

The Phase F W7 work in `/mnt/user-data/outputs/App.jsx` (NOT pushed) is the foundation of Builder Edition's Reservation stage. Preserved here for when its turn comes.

### A.1 Builder template stages (draft for Year 2)

1. **Lead Received** (from broker or direct)
2. **Site Visit** (date + outcome)
3. **Reservation** — full workflow:
   - Offer Acceptance Form: signed checkbox + date + signed-by name + REQUIRED PDF upload
   - Deposit: AED/% toggle + payment method + receipt # + cheque # (conditional) + received date + REQUIRED receipt PDF upload
   - Names on Contract: buyer pre-filled (cannot delete) + add-another-name + per-name developer fee + per-name docs (passport/visa/Emirates ID with uploads)
   - Validity: working days input + computed expiry (UAE Mon-Fri)
   - Forfeiture Terms: non-refundable / partial (with %) / full refundable
   - Notes
4. **Payment Plan Active** — plan structure + first instalment + payment proof
5. **SPA Signed** — SPA execution + DLD ref + Oqood (off-plan) + NOC (resale) + advance payment + SPA PDF upload
6. **DLD Registered** — registration date + ref number + DLD certificate upload
7. **Handover Scheduled** — handover date + remaining payments + final inspection
8. **Closed Won** — handover complete + final payment + commission paid to broker + handover docs
9. **Closed Lost** — cancellation reason + forfeiture amount + refund processed

### A.2 Builder-specific composite field types

**`deposit_amount`** — AED/% toggle, live computation, returns `{amount_aed, type, percent}`

**`name_insertions`** — multi-row, buyer pre-filled with BUYER badge, add-another-name, per-row name + dev fee + sub-doc-checklist (passport/visa/Emirates ID with uploads), auto-summed total fees

**`forfeiture_radio`** — non_refundable / partial / full_refundable, conditional refund_percent input

### A.3 Module-level helpers (already designed)

- `uploadProofFile(file, oppId, docKind)` → `{url, path, name, size, uploaded_at}`
- `addWorkingDays(date, days)` — UAE Mon-Fri working week

### A.4 Display widgets

- Reservation Details Card → became `<StageCapturedDataCard>` in v1 architecture
- Validity countdown badge with urgency colours
- Document badges (clickable)

**This Builder Edition design is captured here. When Year 2 comes, this Appendix becomes the Builder Edition specification.**

---

## Appendix B — Decisions log

**Decisions made in design v1.0 (still valid):**
- Configurable workflow_config JSON column on companies
- Field type registry approach
- Stable stage IDs vs editable labels
- Template-driven stages, not hardcoded
- Defensive DB writes with retry-without-rich-fields

**Decisions revised in v2.0:**
- Framing: "broker product or builder product" → "configurable platform, broker first edition"
- Roadmap: "ship both editions" → "ship broker, expand segment-by-segment over 2-3 years"
- Mission: "broker/builder CRM" → "OS for UAE property industry"

**Decisions made in this conversation:**
- Path B (one product, configurable workflows) confirmed
- Demo timing flexible
- Broker first, no big-bang — anchor Abid's discipline principle
- Year 2-3 segments: builder, contractor, construction planning, facilities management
- Architecture must support all without reinvention

---

## Appendix C — Backlog impact

**Items consolidated into Builder Edition Year 2 (no separate work):**
- Phase F W7 (Reserved upgrade) — Builder Reservation stage
- Phase F W8/W9/W10 (SPA/Closed Won/Closed Lost upgrades) — Builder later stages
- Phase F W11 (Document checklist) — Builder field types
- Phase F W12 (PDF generation) — Builder workstream

**Items preserved as separate workstreams (Broker Edition v1.x):**
- Demo dry-run + script
- Reports redesign with KPI cards
- Activity Log manager view
- lib/ refactor
- Searchable dropdowns globally
- Typography pass
- AI extensions
- Layer 2 lead-ownership policy

**Newly explicit roadmap items:**
- WorkflowConfigEditor (read-only → editable → custom)
- Per-Edition template library (Broker → Builder → Contractor → ...)
- Cross-field validation rules

---

*End of design document v2.0 — DRAFT for broker community review*
