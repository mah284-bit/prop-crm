# PropCRM — Configurable Workflow System
## Design Specification v1.0

**Status:** Draft — for internal review with broker community before build
**Date:** 03 May 2026
**Owner:** Abid Mirza
**Engineering:** Claude (Anthropic)
**Anchor customer:** Al Mansoori Properties

---

## 1. Strategic context

### 1.1 The product question

PropCRM serves UAE real-estate businesses. There are two distinct customer types:

- **Brokers** — agents who source buyers and connect them to developers. Volume play. ~5,000+ firms in UAE. SaaS subscription pricing model.
- **Builders / Developers** — companies that own and sell properties (Emaar, DAMAC, Sobha, etc.). Enterprise play. ~30-50 major firms in UAE. Higher per-deal value.

Until this point, the codebase mixed broker and builder workflows in the same hardcoded stages. This design separates them into **configurable workflow templates** so one product serves both markets without forking the code.

### 1.2 The decision

**Path B — One product, configurable per-company workflows.**

- Single codebase, single deployment, single brand
- At company creation, customer picks `business_type`: broker / builder / both
- The selection drives a `workflow_template` that defines stages, fields, and transitions
- Workflow templates ship with sensible defaults; admins can adjust later
- Same Lead/Opportunity/Activity/AI infrastructure underneath — only late-stage workflow differs

### 1.3 Why this is the right architectural call

- **Broker market is a volume play.** Volume drives recurring revenue, faster product-market fit. Building broker first inside a configurable platform means we don't lose builder-market option later.
- **The divergence between broker and builder workflows is small** — only ~20% of the code (late-stage capture dialogs, stage names, stage gates). The other 80% (leads, opps, AI features, reports) is shared.
- **Configurability becomes a sales asset.** "PropCRM adapts to your business" beats "PropCRM is for brokers only."
- **No fork, no two-codebase tax.** One bug fix, one feature add, both customer types benefit.

---

## 2. The actual problem

### 2.1 What broker responsibility actually is (TO BE CONFIRMED with brokers)

> *"Broker does not make any collections as it is all done by builder. Once the customer is handed over to the builder I believe the broker responsibility ends."* — Abid

**Broker's core responsibilities (as currently understood — VALIDATE):**

1. Source the lead (referral, marketing, walk-in)
2. Qualify the buyer (budget, timeline, requirements)
3. Conduct site visits and property tours
4. Negotiate offer terms with buyer
5. Forward accepted offer to developer / property owner
6. Track commission status until paid

**Broker does NOT:**

- Collect deposits or any money from buyer
- Issue receipts or reservation forms
- Handle SPA drafting or DLD registration
- Manage payment plans
- Verify buyer documents for compliance (developer's job)

**OPEN QUESTIONS for broker community feedback:**

- Do brokers ever collect a token amount or agency fee from buyer directly?
- What happens if developer rejects the offer? Does broker re-engage?
- How is commission paid — by developer to broker firm, then split internally?
- Do brokers track post-handover for repeat business / referrals?
- Are there regulatory requirements (RERA registration, broker license) that affect workflow?

### 2.2 What builder responsibility is

Builders own the compliance-heavy part of the deal:

1. Receive forwarded offer from broker
2. Issue offer acceptance form (signed by buyer)
3. Collect reservation deposit (fixed or % of price)
4. Handle multiple payment methods (cheque, bank transfer, etc.)
5. Issue receipts and reservation form to buyer
6. Manage validity period (typically 10-30 working days)
7. Handle name insertions on contract (each adds developer fee)
8. Verify buyer documents (passport, visa, Emirates ID, etc.)
9. Draft and execute SPA (Sale and Purchase Agreement)
10. Register with DLD (Dubai Land Department) / Oqood (off-plan)
11. Manage payment plan against contract
12. Schedule and execute handover
13. Pay broker commission

The work already designed in **Phase F W7** (Reservation full upgrade with offer acceptance, deposit, name insertions, forfeiture, file uploads) — **all belongs in the builder workflow, not broker.**

### 2.3 Why this matters

If we ship the broker product with builder fields like "Reservation Deposit" and "Forfeiture Terms," brokers will rightly say *"this isn't our job."* The product will feel mismatched. Trust in the team drops. Customer churns or never closes.

If we ship the builder product without those fields, builders will say *"this is missing half my workflow."* Same outcome.

**Configurability solves this.**

---

## 3. Architectural design

### 3.1 Data model

#### 3.1.1 New JSON column on `companies` table

```
companies.workflow_config = JSONB

Structure:
{
  "version": 1,
  "template_origin": "broker" | "builder" | "custom",
  "business_type": "broker" | "builder" | "both",
  "stages": [ /* see 3.1.2 */ ],
  "transitions": { /* see 3.1.4 */ }
}
```

Defaults:

- New companies: assigned a template based on `business_type` at creation
- Existing companies (Al Mansoori, etc.): kept as-is, gradual migration

#### 3.1.2 Stage definition

Each stage is an object:

```
{
  "id": "site_visit",                      // STABLE identifier; never change
  "label": "Site Visit",                   // Display name (editable)
  "color": {
    "bg": "#EDE9FE",
    "fg": "#7C3AED"
  },
  "icon": "🏠",
  "is_terminal": false,
  "is_won": false,
  "is_lost": false,
  "section_color": "purple",               // for visual grouping in UI
  "fields": [ /* see 3.1.3 */ ],
  "validation_rules": [ /* see 3.1.5 */ ]
}
```

**Stable IDs matter:** if an admin renames "Site Visit" to "Property Tour," the underlying ID stays the same so historical data still maps.

#### 3.1.3 Field definitions

A stage's `fields` array contains field objects. Each field has a `type` from a fixed registry:

**Field types (v1):**

| Type | Renders as | Used for |
|---|---|---|
| `text` | text input | name, reference numbers, notes |
| `number` | number input | amounts, counts |
| `date` | date picker | event dates |
| `checkbox` | checkbox | boolean acknowledgements |
| `select` | dropdown | enumerated values (payment method, etc.) |
| `textarea` | multiline text | notes, descriptions |
| `file_upload` | file picker + preview | proof documents |
| `name_insertions` | multi-row composite | contract co-buyers with per-person docs |
| `deposit_amount` | composite (AED/% toggle) | reservation deposits |
| `forfeiture_radio` | radio with conditional % | forfeiture terms |

**Field schema:**

```
{
  "key": "offer_signed_pdf",               // STABLE identifier in structured_data
  "type": "file_upload",
  "label": "Upload signed Offer Acceptance Form",
  "required": true,
  "section": "📝 Offer Acceptance",        // visual grouping
  "section_color": "green",
  "config": {
    "accept": "application/pdf,image/*",
    "max_size_mb": 10
  },
  "show_if": {                              // optional conditional visibility
    "field": "offer_signed",
    "equals": true
  },
  "validation_message": "Form must be uploaded as proof"
}
```

#### 3.1.4 Transitions

Defines which stage moves are allowed:

```
"transitions": {
  "new":          ["contacted", "closed_lost"],
  "contacted":    ["site_visit", "closed_lost"],
  "site_visit":   ["proposal_sent", "closed_lost"],
  ...
  "any":          ["closed_lost"]            // can mark lost from anywhere
}
```

Two modes (template-level setting):

- **Strict** — must follow defined transitions
- **Flexible** — agent can pick any stage at any time (sales reality)

#### 3.1.5 Validation rules

Per-field `required: true` is the simplest. More complex rules:

```
{
  "type": "all_of",
  "rules": [
    {"field": "offer_signed", "equals": true},
    {"field": "offer_signed_pdf", "exists": true}
  ],
  "message": "Cannot proceed without signed form AND uploaded proof"
}
```

V1 keeps validation simple: per-field required + custom validation messages. Cross-field rules deferred to v2.

### 3.2 Template library

Two templates ship with PropCRM v1:

- **Broker template** — stages and fields appropriate to broker workflow
- **Builder template** — stages and fields appropriate to builder workflow

Both are **defined as constants in the codebase**, not in the database. When a new company is created, the chosen template is **deep-copied into `companies.workflow_config`** so admins can customise without affecting other companies.

#### 3.2.1 Broker template — DRAFT (PENDING BROKER FEEDBACK)

```
Stages:
1. New                          (no fields, just acknowledgement)
2. Contacted                    (call/whatsapp/email log + notes)
3. Site Visit                   (date + units + outcome)
4. Proposal Sent                (offer details + validity)
5. Negotiation                  (asks/counter-asks + rounds)
6. Offer Accepted               (final offer terms agreed by buyer)
7. Forwarded to Developer       (developer name + deal ref + expected commission + expected payment date)
8. Awaiting Confirmation        (developer's response status)
9. Confirmed                    (developer accepted + handover complete)
10. Commission Pending          (invoice sent + payment expected date)
11. Closed Won                  (commission received + actual amount + closure notes)
12. Closed Lost                 (lost reason + competitor + re-engage date)
```

**Key broker-specific fields per stage:**

| Stage | Key fields |
|---|---|
| Forwarded to Developer | `developer_name` (text), `deal_reference_at_developer` (text), `expected_commission_aed` (number), `expected_commission_date` (date), `forwarded_date` (date) |
| Confirmed | `confirmed_date` (date), `actual_handover_date` (date), `confirmation_notes` (textarea) |
| Commission Pending | `invoice_number` (text), `invoice_date` (date), `expected_payment_date` (date), `invoice_pdf` (file_upload) |
| Closed Won | `actual_commission_aed` (number), `payment_received_date` (date), `payment_proof` (file_upload) |
| Closed Lost | `lost_reason` (select), `lost_to_competitor` (text), `re_engage_date` (date), `lost_notes` (textarea) |

**Broker DOES NOT have:** offer acceptance forms, deposits, name insertions, forfeiture, SPA, DLD — that's the builder's responsibility.

#### 3.2.2 Builder template — DRAFT

```
Stages:
1. Lead Received                (from broker or direct)
2. Site Visit                   (date + outcome)
3. Reservation                  (offer acceptance + deposit + name insertions + forfeiture + uploads)
4. Payment Plan Active          (plan structure + first instalment received)
5. SPA Signed                   (SPA execution + DLD ref + Oqood + advance payment)
6. DLD Registered               (registration date + ref number)
7. Handover Scheduled           (handover date + remaining payments)
8. Closed Won                   (handover complete + final payment + commission paid to broker)
9. Closed Lost                  (cancellation reason + forfeiture amount + refund processed)
```

**Reservation stage uses fields from Phase F W7 work:**

| Section | Fields |
|---|---|
| Offer Acceptance | `offer_signed` (checkbox), `offer_signed_date` (date), `offer_signed_by` (text), `offer_signed_pdf` (file_upload, REQUIRED) |
| Deposit | `deposit_amount` (composite AED/% with computation), `payment_method` (select), `receipt_number` (text), `cheque_number` (text, conditional), `received_date` (date), `receipt_pdf` (file_upload, REQUIRED) |
| Names on Contract | `name_insertions` (composite with per-person docs) |
| Validity | `validity_working_days` (number, default 10), `expires_at` (computed) |
| Forfeiture | `forfeiture_type` (radio: non_refundable / partial / full_refundable), `forfeiture_refund_percent` (number, conditional) |
| Notes | `notes` (textarea) |

#### 3.2.3 "Both" template

Companies that act as both broker and builder (rare but exists) get a **superset** of stages with branching paths. V1 may not support this — companies pick "broker" or "builder" at creation. "Both" is a v2 enhancement.

### 3.3 Code architecture

#### 3.3.1 New components

**`<DynamicStageGate>`** — replaces existing hardcoded showStageGate dialog.
- Receives: `stage` (current company's stage config), `opp`, `lead`, `onSave`, `onCancel`
- Renders fields dynamically based on stage.fields array
- Validates per stage.validation_rules
- Outputs: nested data object keyed by field.key, persisted to opp.structured_data

**`<DynamicFieldRenderer>`** — renders one field based on its type.
- Field type registry maps type string to React renderer component
- Each renderer receives: `field` config, `value`, `onChange`, `disabled`
- Composite types (name_insertions, deposit_amount) are full sub-components

**`<WorkflowConfigEditor>` (deferred to phase 2)** — admin UI to view/edit workflow_config.
- v1 ships templates as read-only — companies see what they have, can't change
- v2 lets admins reorder stages, rename labels, toggle field requirements
- v3 lets admins add custom fields and stages

#### 3.3.2 Module-level helpers

```javascript
// Get the workflow config for the current company
getWorkflowConfig(currentUser, companies) -> workflow_config object

// Get a specific stage's config
getStageConfig(workflowConfig, stageId) -> stage object

// Get the full stages list (replaces hardcoded OPP_STAGES)
getStagesList(workflowConfig) -> [stage objects]

// Validate captured data against stage's rules
validateStageData(stageConfig, capturedData) -> {valid: bool, errors: [...]}

// Two ship-with-app templates
BROKER_TEMPLATE = { ... }
BUILDER_TEMPLATE = { ... }
```

#### 3.3.3 Migration of existing code

Hardcoded values to remove:

- `OPP_STAGES` constant → replaced by `getStagesList(currentCompanyConfig)`
- `OPP_STAGE_META` constant → derived from stage.color + stage.icon
- `GATED_STAGES` constant → derived (any stage with required fields)
- Existing showStageGate JSX → replaced by `<DynamicStageGate>`

Backward compatibility:

- Old hardcoded stages (current Al Mansoori behaviour) become the **default broker template**
- Companies without `workflow_config` get default broker template assigned
- `OPP_STAGES` window-exposure still works (templates expose their stage IDs the same way)

### 3.4 What survives from Phase F W7 work

The Reservation work built in Phase F W7 (already exists in /mnt/user-data/outputs/App.jsx, NOT pushed):

**Keep:**
- `uploadProofFile()` module-level helper — generic, used by file_upload field type
- `addWorkingDays()` module-level helper — used by validity computation
- `reservationData` JSON shape — becomes the builder template's Reservation stage data structure
- Reservation Details card UI — becomes the builder template's reservation display widget

**Drop:**
- Hardcoded Reserved-only validation (replaced by config-driven validation)
- Hardcoded Reserved gate JSX block (replaced by DynamicStageGate)
- The `reservationData` state in OpportunityDetail (replaced by generic stageGateData)

---

## 4. Implementation plan

### 4.1 Phased commits (sequential, each independently shippable)

**Phase 1 — Foundation (~2 hours)**
- Add `workflow_config` JSON column to `companies` table (Supabase UI, ~5 min)
- Define `BROKER_TEMPLATE` and `BUILDER_TEMPLATE` constants in App.jsx
- Define field type registry (text, number, date, checkbox, select, textarea, file_upload to start)
- Build `<DynamicFieldRenderer>` for the simple field types
- All existing hardcoded stages keep working (feature is opt-in)

**Phase 2 — Stage gate refactor (~2 hours)**
- Build `<DynamicStageGate>` component
- Replace existing showStageGate dialog with it
- Stage capture for Broker template works end-to-end
- Stage capture for Builder template works end-to-end
- Companies with no workflow_config default to BROKER_TEMPLATE

**Phase 3 — Composite field types (~2 hours)**
- `name_insertions` field type (multi-row with per-row docs)
- `deposit_amount` field type (AED/% toggle with computation)
- `forfeiture_radio` field type
- File upload progress UI inside dynamic fields

**Phase 4 — Display widgets (~1 hour)**
- Reservation Details card → generic `<StageCapturedDataCard>`
- Reads any stage's captured data, renders fields appropriately
- Used for showing post-capture reservation/SPA/handover data on opp detail

**Phase 5 — Polish + admin editor (deferred decision) (~2 hours)**
- Optional: read-only WorkflowConfigEditor for admins to inspect their template
- Sample data for both templates
- Migration script for existing Al Mansoori opps to broker template

**Total: ~9 hours focused work**

### 4.2 Database changes

Add to `companies` table:

```sql
ALTER TABLE companies
  ADD COLUMN workflow_config JSONB DEFAULT NULL;

-- Optional: index for queries that filter by template_origin
CREATE INDEX idx_companies_workflow_template
  ON companies ((workflow_config->>'template_origin'));
```

Plus to `companies` table (likely already exists):

```sql
-- Verify column exists; if not:
ALTER TABLE companies
  ADD COLUMN business_type TEXT
  CHECK (business_type IN ('broker', 'builder', 'both'));
```

### 4.3 Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Existing opps break when stage IDs change | Medium | Migration script preserves stage names → IDs mapping |
| Field type registry is incomplete | Medium | Start with 7 types, add as needed; don't over-engineer |
| Templates need adjustment after broker feedback | High | Templates are constants — easy to edit |
| Performance issues with large workflow_config JSON | Low | Validated as JSONB, indexed, cached at company-load |
| Two companies need different builder templates | Low (v1) | v2: customisable templates, v1 just one of each |

### 4.4 What this commit does NOT include (v1 scope)

Deliberately NOT in v1:

- Custom stage creation by admins (use templates as-is)
- Custom field creation by admins (use predefined fields)
- Cross-stage validation rules
- Workflow versioning / migration tools
- Multi-language stage labels
- Stage-specific reports
- Per-role permission on stages
- Approval workflows on stage transitions

These are v2/v3 considerations. Don't build them now.

---

## 5. Outstanding questions for broker community

**Before broker meeting, prepare answers from contacts to these:**

1. What are the actual stages in your sales process today?
2. How many days does an average deal take from new lead to commission paid?
3. Do you ever collect any money from the buyer? (Token amount, agency fee?)
4. How do you track which developer the deal was forwarded to?
5. How long after handover do you typically wait for commission payment?
6. What lost reasons do you encounter most? (Pick top 5)
7. Do you re-engage lost leads? On what trigger?
8. Do you track post-handover for repeat business?
9. What documents do YOU need from buyer (vs what builder needs)?
10. Are there RERA / regulatory checkpoints in your workflow?
11. Do you ever co-broker (split commission with another broker)?
12. How do you handle the "buyer goes to another broker after seeing you" situation?

**Before builder meeting, prepare answers from contacts to these:**

1. What's your standard reservation deposit policy?
2. What's your typical validity period for reservation?
3. Do you allow partial refundable forfeiture? Under what conditions?
4. What documents do you require at each stage from buyer?
5. Who verifies documents — sales team, compliance team, or external?
6. How is commission calculated and paid to broker?
7. What's the typical timeline from reservation to handover for off-plan vs ready?

---

## 6. Decision points to confirm before build

**Questions for Abid (after broker meeting):**

1. ✅ One product, configurable workflows? *(confirmed)*
2. ✅ Demo timing flexible — pick technical right answer? *(confirmed)*
3. Templates ship with both broker and builder, or broker first only?
4. Workflow Config Editor (admin UI) in v1 or v2?
5. After broker meeting: any changes to draft broker template stages?
6. After broker meeting: any new field types needed?
7. Strict transitions vs flexible? Different per template?
8. New `business_type` column on companies — confirm it's needed?

---

## 7. Backlog impact

**Items now consolidated under this work:**

- ❌ Phase F W7 (Reserved stage upgrade) — superseded by builder template config
- ❌ Phase F W8/W9/W10 (SPA / Closed Won / Closed Lost upgrades) — superseded by template config
- ❌ Phase F W11 (Document checklist) — partially absorbed (file_upload field type), partially deferred (cross-stage gating logic = v2)
- ❌ Phase F W12 (PDF generation) — deferred, separate workstream
- ✅ Phase F W7 helpers (`uploadProofFile`, `addWorkingDays`) — kept and used in template

**Items still standalone:**

- Demo dry-run + script
- Layer 2 lead-ownership policy (post-customer-conversation)
- Reports redesign (post-demo)
- Activity Log manager view (post-demo)
- lib/ refactor — Supabase client centralisation, shared constants (post-demo)
- Searchable dropdowns globally (post-demo)
- Typography pass (post-demo)
- AI extensions — speech, autonomous actions, Site Visit feedback → next-step (post-demo)

---

## 8. Glossary

| Term | Meaning |
|---|---|
| **Broker** | Agent firm that sources buyers and connects them to property owners/developers |
| **Builder / Developer** | Company that owns and sells property (Emaar, DAMAC, Sobha, etc.) |
| **Workflow** | The sequence of stages a deal goes through |
| **Stage** | A discrete state in the workflow (New, Contacted, Closed Won, etc.) |
| **Field** | A data point captured at a stage (deposit amount, payment method, etc.) |
| **Template** | A pre-defined workflow_config for a customer type |
| **Stage Gate** | A capture dialog shown when moving to a stage that requires data |
| **Composite field** | A field type that contains nested sub-fields (e.g. name_insertions) |
| **DLD** | Dubai Land Department — UAE property registration body |
| **Oqood** | Off-plan property registration system in Dubai |
| **NOC** | No Objection Certificate — required for resale transactions |
| **SPA** | Sale and Purchase Agreement — the legally binding contract |
| **RERA** | Real Estate Regulatory Authority — UAE broker regulatory body |
| **PDC** | Post-Dated Cheque — common rent payment method in UAE |

---

## 9. Sign-off

This document is **DRAFT**. Final version requires:

- [ ] Broker community feedback on broker template stages and fields
- [ ] Confirmation of broker scope (where responsibility ends)
- [ ] Builder community feedback on builder template (or use existing W7 work)
- [ ] Abid's sign-off on phasing and v1 scope
- [ ] Tech Lead (Claude) confirmation that estimates are realistic

**No code is built until this document is signed off.**

---

## Appendix A — Phase F W7 work to preserve

The Reserved stage upgrade work in `/mnt/user-data/outputs/App.jsx` (NOT pushed to git) contains:

- `uploadProofFile()` — module-level Supabase Storage helper, generic
- `addWorkingDays()` — UAE working week calculator, generic
- Rich `reservationData` shape — becomes builder template Reservation field set
- Reservation Details card UI — becomes builder template stage display widget
- ~485 lines of working code for reservation capture

**This work is NOT lost.** It becomes the foundation of the builder template's Reservation stage when the Phase 1 build begins.

---

## Appendix B — Reference: existing PropCRM stages

Current hardcoded stages in App.jsx (will become broker template default):

```
New → Contacted → Site Visit → Proposal Sent → Negotiation
    → Offer Accepted → Reserved → SPA Signed → Closed Won
                                                ↘ Closed Lost
```

Note: this is a hybrid that has both broker and builder concepts mixed. The work in this design separates them cleanly.

---

*End of design document v1.0 — DRAFT*
