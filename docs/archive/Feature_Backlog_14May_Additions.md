# Feature Backlog — Additions from 14 May 2026 (Day 2 Dry-Run)

## Items added during Day 2 of Math Flow Sprint

These items emerged from systematic dry-run testing on 14 May 2026.
All P1 items must be addressed before Mon 19 May tester visit.

---

## P1 — TESTER VISIT CRITICAL

### ARCH-SIMPLIFY-001: Remove "Send Proposal" from Site Visit closure

**Status:** Documented, Phase B implementation
**Effort:** 1-2 hours
**Trigger:** Dry-run revealed UX confusion

**Problem:**
When closing Site Visit stage, "Send Proposal" appeared as an option
alongside visit-recording fields. This:
- Confused the broker (which to do first?)
- Opened blank proposal form, ignoring existing proposals
- Created duplicate path to proposal sending
- Conflated visit-recording with proposal-management

**Solution:**
Remove "Send Proposal" from Site Visit stage gate dialog. Each stage
has one clear purpose:
- Site Visit gate = record what happened during visit
- Proposals = managed entirely in proposal subsystem (opp detail page)

**Implementation:**
- Edit `STAGE_CAPTURE_CONFIGS["Site Visit"]` to remove proposal action
- Site Visit closure form keeps: date, attendees, units visited, feedback,
  next step, follow-up date
- Brokers send proposals separately from opp detail page

**Founder principle:**
"KEEP IT SIMPLE :)" — 14 May 2026

**Founder verbatim:**
> "After sent the message I realised lets leave it like this and remove
> the option of sending to proposal from the site visit closure. Let the
> broker close this and convey he will send a proposal later or go to
> proposal pick the last proposal what he has sent"

**Investor narrative:**
PropCRM has clear separation of concerns. Each stage focuses on one thing.
Brokers don't get confused by overlapping paths.

---

### UX-PROPOSAL-HISTORY-001: Show proposal history on opp detail page

**Status:** Documented, Phase B implementation
**Effort:** 1-2 days
**Trigger:** Day 2 acid test revealed proposal data not visible

**Problem:**
When broker clicks "Send revised proposal" on opp with existing proposals,
the form opens blank. Broker loses context of:
- What was previously quoted
- What discount was offered
- What payment plan was proposed
- What DLD arrangement was discussed

**Solution:**
"Send revised proposal" opens form pre-filled with LATEST version's values.
Broker edits → saves as next version. Previous versions auto-marked
superseded.

Display proposal history list on opp detail page:
- V1 (sent 14 May, superseded) — Asking 623K, no discount, buyer pays DLD
- ▶ V2 (sent 14 May, active) — Asking 623K, 50/50 split, 20/80 plan
- "Send revised proposal" button → opens V2 in edit mode

**Founder verbatim:**
> "it should say this is the proposal you have send have a button/checkbox
> for changes when you save it will be a new version that way we keep the
> revisions as well as know what we had quoted"

**Architecture:**
Built on existing proposal versioning (`proposals` table with `version`
column). UX layer reads latest version and pre-fills form. Save creates
next version, marks previous as superseded.

**Investor narrative:**
PropCRM tracks every negotiation round. Brokers see full quote history
at a glance. Disputes and price questions resolved with audit trail.

---

### BUG-CONTACTED-VALIDATION-001: Stage gate validation requires ALL 5 fields

**Status:** Working as designed (NOT a bug)
**Lesson learned:** Document this in user guides

**Background:**
During dry-run, founder thought form was broken when "Save & Advance"
showed "Please complete the required fields" error.

**Reality:**
The form correctly validates all 5 required fields:
1. Channel (radio): Call/WhatsApp/Email/In-person/Other
2. Discussion (textarea): min 20 chars
3. Interest level (radio): Hot/Warm/Cold/Not interested
4. Next step (select): Site visit/Send info/Follow up call/Lost interest
5. Follow-up date (date picker)

**All 5 must be filled** for stage to advance.

**Lesson:**
Document required fields in tester guide. Mention that "Save" requires
ALL radio buttons clicked, not just visible. Better field hint UX possible
but not P1.

---

## P2 — POST-DEMO

### UX-PROPOSAL-DETAILS-INLINE: Show price + budget on opp detail

**Trigger:** Founder UX observation 14 May 2026:
> "on the opp screen after selecting the unit it should show the price
> against the unit selected here also so we keep track of things, what
> price we have selected and what is budget also"

**Solution:**
Opp detail page shows unit price (from current_agreed_price) prominently
alongside buyer budget.

**Status:** Phase B UX work

---

### UX-UNIT-PICKER-PRICE: Show price in unit picker dropdown

**Trigger:** Founder UX observation 14 May 2026:
> "unit picker does not show the price by side which will give a good
> idea to pick based on the buyers budget"

**Solution:**
Unit picker shows price next to each unit in dropdown:
`SHI-05-01 · Studio · Sobha Hartland II · AED 623,694`

**Status:** Phase B UX work (already implemented in UnitPickerRich for
showAddOpp form, needs propagation to multi-step CreateOpportunityDialog)

---

### BUG-AI-NO-FALLBACK: AI failures must not block save

**Trigger:** Day 2 dry-run hit `/api/ai` 500 error which blocked proposal
save UI. ANTHROPIC_API_KEY was empty in environment.

**Problem:**
Proposal save calls AI for auto-generated content. If AI fails:
- User stuck on form (no error feedback)
- Cannot bypass or save without AI
- Single point of failure

**Solution:**
- All AI calls wrapped in try-catch
- AI failure shows warning but allows manual entry
- "Use AI" button (if exists) optional, not blocking save

**Status:** Phase B P2 - tester visit might hit this

---

## DOC-001: Environment setup procedure

**Trigger:** ANTHROPIC_API_KEY was lost from .env.local during dev.

**Solution:**
Create `docs/Environment_Setup.md` documenting:
- Required env vars and where they're set
- How to recover from key loss
- Best practices for env management
- Procedure: changes to Vercel dashboard, sync to local

**Status:** Phase B work

---

*Document created: 14 May 2026 (Thursday afternoon)*
*Captured during Day 2 Math Flow Sprint dry-run*
*Founder: Abid Mirza*

