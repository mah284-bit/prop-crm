# PropCRM - MASTER CONTEXT (THE HEAD)
**READ THIS FIRST. EVERY SESSION. BEFORE ANY WORK.**
Last verified against repo: 27 Jul 2026 (Day 76) - HEAD 5704927
Governed by: docs/DOCUMENTATION_PRINCIPLES.md (six rules, founder-ratified)

## THE THREE LIVING DOCUMENTS - one job each, no overlap
| Document | Job | Discipline |
|---|---|---|
| **THIS DOC** | WHERE THINGS STAND + product frame + document index | REWRITTEN, never appended. Carries a "last verified" date. |
| `MASTER_PENDING_BOARD.md` | WHAT IS OUTSTANDING, verified, ranked | Items move to CLOSED with evidence, never deleted |
| `HANDOFF_CURRENT.md` | WHAT HAPPENED - the session log | APPENDED. History, not state. Not the head. |
Everything else is a DESIGN doc (spec of record, referenced) or lives in `docs/archive/`.

---

## 1. PRODUCT FRAME (the "why" - rarely changes)

### The core problem
Brokers are **data-poor at the moment a buyer connects.** They lack authentic information on
hand to advise well. Everything in the product serves closing that gap.

### PropPulse - the data engine
Aggregates property intelligence from multiple sources so the broker walks into the buyer
conversation already informed.
- **Today:** free, public-domain sources only.
- **Post-investment:** government sites + paid authentic feeds into PropPulse Inventory;
  brokers enable the slices relevant to their areas.
- **DO NOT MIS-STATE:** the ~20-developer figure is a development-tracking scope for build-phase
  cost control. It is **not a product ceiling.** Forward intention is broad market coverage.

### Scope boundary
The app is for **broker companies / individual brokers & agents.** The broker's role is to make
buyer and developer meet. **Developer-side features are intentionally low-intensity** (e.g.
Discount recording exists only so commission computes correctly - developer discretion, not
broker workflow). Do not over-invest engineering there.

### Positioning
**AI-heavy by design** - AI is used throughout the app as a deliberate positioning angle.

### North star (founder)
"A broker app, just recording, but depicting reality - the broker chases the buyer AND the
developer till the deal closes; after closing, follow-up calls till handover."

---

## 2. VERIFIED STATE (measured from repo 27 Jul 2026 - NOT remembered)

- **Repo:** `mah284-bit/prop-crm` · local `/d/prop-crm` (Windows MINGW64, CRLF)
- **Branch:** `main` -> auto-deploys to prop-crm-two.vercel.app
- **HEAD:** `5704927` · **1,459 commits** across **93 working days** (first commit 26 Mar 2026)
- **App.jsx:** **2,514 lines** (was 17,300 pre-refactor; the shrink held)
- **Structure:** 15 feature folders under `src/components/` + 26 helpers in `src/lib/`
- **Golden tags:** golden-data-freshness (latest) · golden-block-vertical-complete ·
  golden-block-vertical-cut6-complete · golden-pre-phase2-stage2 · golden-pre-bell ·
  golden-2026-05-07

### What is LIVE on production (verified)
- **Sales vertical end-to-end:** lead -> quote -> opportunity -> proposal -> negotiation ->
  Offer Accepted -> Reserved -> SPA Requirements -> SPA Signed -> Closed Won -> customer ->
  commission invoice. Walked end-to-end multiple times.
- **Block Sales vertical (COMPLETE):** create/adopt -> bidirectional distribution calculator ->
  developer approval -> confirm (N children born) -> reservation intake with tranches ->
  collection state (due/hold/accept-shortfall) -> settled gates. Merged Day 75.
- **Capability-driven access control:** 19+ capabilities in `role_capabilities`, `canDo()` the
  single check, RLS company-scoped, super_admin via `is_super_admin` flag only.
- **Data freshness (B1):** `useFreshData` hook - refetch on focus/visibility, 10s throttle,
  hold-during-dialog, silent variant (no loading flash). Master load split from realtime
  subscription. Merged Day 76.
- **Realtime:** Supabase subscriptions on leads/activities/opportunities (cross-tab verified).
- **Also live:** KYC v1.1 (docs, expiry, gates), PropPulse, Commission Outstanding, Lead
  Assignment + agent pools, Org Chart, Client-360, Launch Mode, Reports (role-gated),
  auto-advance + lifecycle chain, duplicate-lead prevention, My Earnings.

### What is PARKED by decision
- **Leasing vertical** - schema and some UI exist; sales-first is the ruling.
- **Developer persona** - founder signal is loud; sequenced post-tester-review.
- **Custom roles** - 7 roles + configurable capabilities is the ratified answer (Decision_Log).

---

## 3. DOCUMENT INDEX (Register item #23 - the map. Nothing is findable without this.)

### LIVING - state, must stay current
| Doc | Holds |
|---|---|
| `PropCRM_Master_Context_and_Takeover.md` | THIS. Product frame, verified state, this index |
| `MASTER_PENDING_BOARD.md` | Every outstanding item, verified, grouped A-D |
| `HANDOFF_CURRENT.md` | Session log (history only - NOT the head) |
| `DOCUMENTATION_PRINCIPLES.md` | The six rules governing all of the above |
| `FOUNDER_SESSION_PROCEDURE.md` | Abid's own session-start / session-close checklist |

### GOVERNANCE - read before acting in these areas
| Doc | Holds |
|---|---|
| `Decision_Log.md` | Settled decisions + rationale. **Never re-litigate what is in here** |
| `Implementation_Doctrine.md` | P1-P3 client onboarding: bring their DATA not their PROCESS. Excel-template intake only. Scope tiers. The enforcement line |
| `Go_Live_Readiness_Register.md` | 3 horizons to go-live: clean-slate reset spec (FK-verified, landmines caught), RLS audit method, backup/restore method, commission model, settings governance |
| `DOCUMENT_REGISTER_Target.md` | The 24-doc target set a SaaS needs; what exists vs to-create |
| `Access_Control_Configurable_Roles_Design.md` | The governance bible: PropCRM=enabler, customer owns config post-handover |

### ARCHITECTURE - how it is built
`Architecture_Multi_Tenant_Identity_Model.md` (platform vs tenant identity, the go-live split) ·
`Access_Control_and_Multi_Tenant_Security_Spec.md` · `ACL_Capability_Architecture_Sketch.md` ·
`Commission_Model_Architecture.md` (resolution hierarchy, visibility-as-capability, anti-miss gate) ·
`Math_Flow_Schema_Design.md` · `Architecture_TwoLayer_LiveStateAndHistory.md` (VERIFY: may be
superseded by honest-ledger) · `Architecture_FinalProposalFirst_PhaseB.md` (VERIFY: may be
superseded by V_latest cascade)

### DESIGN OF RECORD - built or building
`Block_Sales_Design.md` (FULL AND FINAL for the vertical) · `Block_Sales_Cut7_Design.md` (money
allocation + collection state) · `Block_Ledger_Phase_Design.md` (post-reservation money - NEXT) ·
`Wilderness_Design_Evidence_Ceremony.md` (evidence model E1-E4, ceremony tiers, unit switch,
Launch Mode) · `Opps_Journey_Redesign_Capture.md` (GF findings, money-tail, KYC v1) ·
`Phase_2_1_Lead_Ingestion_Design.md` · `Phase_2_2_Property_Detail_Pack_Design.md` ·
`Phase_2_Identity_And_Settings_Design.md` · `PropPulse_Data_Model.md` ·
`PropPulse_Complete_Documentation.md` · `Real_Estate_Workflow_Spec.md` ·
`PropCRM_Workflow_Config_Design.md` · `Naming_Lead_Quote_vs_Opp_Proposal.md` ·
`Title_Holders_Design_Capture.md` (in whose name - NOT built)

### DESIGN - specified, NOT yet built (each is a board item)
`Phase_2_Communications_Overhaul.md` · `Phase_2_Lead_Lifecycle_Segmentation.md` ·
`Phase_2_Activity_Logging_Everywhere.md` · `Phase_2_Role_Based_Dashboard_Vision.md` ·
`Phase_2_Proposal_Communication_Model.md` · `Phase_2_Reports_Strategy.md` ·
`Phase_2_Coach_Actions_Design.md` · `Phase_2_Inline_Intelligence_Theme.md` ·
`Phase_2_Commission_Invoice_Timing_Model.md` · `Phase_2_Unit_Entry_DataQuality_Design.md` ·
`Phase_2_Self_Narrating_Proposals.md` · `Dashboard_Redesign_Spec.md`

### USER-FACING
`Tester_Guide.md` · `README.md` · `FOUNDER_CONTEXT.md`

### ARCHIVE - `docs/archive/` (93 files, 27 Jul)
Session logs (Day_NN_*), dated handoffs, four investor-script versions, sprint plans,
superseded status docs, completed phase records, resolved backlogs. **History, not truth.**
Retrieve by path when needed; never treat as current.

---

## 4. WORKING DYNAMIC

- **Founder Abid executes ALL terminal / git / SQL himself.** Never edits files in an editor.
- **Architect decides technical direction and hands exact commands.** Founder rules on market,
  workflow, wording, and what a broker actually needs - and those rulings win.
- Founder cannot download files. Deliver content via **quoted heredoc** (`<< 'EOF'`) or Python
  file-scripts. Long heredocs split on paste in MINGW64 - keep scripts small.
- **The architect has NO MEMORY between sessions.** What the repo says IS what the architect
  believes. This is why the six documentation rules exist.

### Founder principles (standing)
"1 step forward, 2 steps back is bothering me" · "no half-hearted work which spoils" ·
"every button has meaning, or it is demeaning" · "do not depend on my memory" ·
broken states are never committed · each commit is a revertable checkpoint ·
tag a golden checkpoint before anything risky.

### Engineering laws (paid for in blood)
- **`python -c` is BANNED** - bash history expansion eats `!`. Python FILE-scripts only.
- **Anchor law:** every file-script verifies its anchors and ABORTS before writing. Never
  convert or wrap an effect read only at its top and bottom - the crash lives in the middle.
- **Straight-test after every cut.** `npm run build` verifies syntax, NOT behaviour.
- **Dev server restart + hard refresh after every cut.** A stale bundle has faked a data
  corruption bug, a permissions bug, and a blank screen. When local behaves impossibly,
  wipe `node_modules/.vite` or test on Vercel - **Vercel is truth.**
- **Cold-Look Law:** read every screen as a first-time broker holding a real cheque BEFORE
  proving the engine. A working engine behind an unreadable screen is the wrong order.
- **Systemic over silo:** ask "can this live in a shared helper?" before patching one spot.
- Feature folders are **all lowercase** (Vercel/Linux is case-sensitive).
- Branch for risky work; merge only when whole; delete the branch after.

---

## 5. KEY IDENTIFIERS

- Al Mansoori `company_id` = `c23a2320-1b35-4636-a840-532c247a6cf9`
- Abid `user_id` = `fa0aae73-847a-4bdc-b4be-f4c0ebb80974` (super_admin, `is_super_admin=true`)
- Test logins: `mah284@` (super_admin) · `testagent4@` (sales agent) · `testmgr@` (manager) ·
  `testviewer@` (viewer) - all `@testmans1.ae`
- **PropPulse tables are GLOBAL** - `projects`, `project_units`, `properties`, `pp_developers`.
  NEVER apply a `company_id` filter to them.
- App.jsx top-level nav addition = 4 edits: import, TABS array, MODE_TABS (sales + both),
  render handler.
- New capability = 3 steps: seed SQL + `ACTION_TO_CAPABILITY` map entry + the gate.

---

## 6. WHERE THE PROJECT IS HEADED

**Ratified plan (Day 68):** founder completes the app -> production cut -> 1 week pre-prod
hardening -> 1 week findings/setup -> 2-day tester review -> close.

**Immediate:** `MASTER_PENDING_BOARD.md` section A (block finish) is CLOSED; section B
(pre-prod hardening) is the live front, B1 data-freshness merged Day 76.

**Before any paying client:** `Go_Live_Readiness_Register.md` Horizon 2 - clean-slate reset
rehearsed twice, RLS audit, backup/restore drill, identity split.

**Vision (compass, not a build plan):** PropOS - a property-lifecycle operating system.
Broker (live) -> Developer -> CAFM -> Construction, on ONE data spine. Multi-geography via
per-market delta packs, never a forked core. Pitch the big vision, execute narrow.

---

*This document is REWRITTEN, never appended. If you are adding to the bottom, you are doing it
wrong - update the section that is now untrue and re-date the header.*
