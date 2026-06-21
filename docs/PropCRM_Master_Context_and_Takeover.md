# PropCRM — Master Context & Takeover

**Living document. Read this FIRST every session.**
Last updated: 20 Jun 2026 (evening) · Maintained by: Architect, per founder instruction
Supersedes scattered/stale project files for "where we stand" and "what this product is."

> Note on status: this is a living frame. Small or large changes will happen as outcomes
> teach us — nothing here is a stone tablet. Amend it at each session change rather than
> re-explaining context verbally.

---

## 0. HOW TO USE THIS DOC
- This is the single source of truth for product intent + current state.
- The older `Phase_2_Backlog_Master_Doc.md` and assorted phase docs are reference history,
  NOT current truth. Where they conflict with this doc or the repo, the REPO wins, then this doc.
- Repo numbering of phases ≠ old master-doc numbering. They drifted. Trust commit messages.

---

## 1. PRODUCT FRAME (the "why" — rarely changes)

### The core problem we solve
Brokers are **data-poor at the moment a buyer connects.** They don't have enough authentic
information on hand to advise well. Everything in the product serves closing that gap.

### PropPulse — the data engine
PropPulse collects property intelligence by sniffing/aggregating from multiple sources, so the
broker walks into the buyer conversation already informed.

**Staging (deliberate):**
- **Today:** free, public-domain sources only.
- **Post product-readiness + investment:** connect to government sites and paid authentic
  feeds; authenticated data is uploaded into **PropPulse Inventory.**
- Brokers then **enable the slices relevant to their organisation's areas of work.**

**Forward intention — IMPORTANT framing (do not mis-state):**
- The product is **NOT limited to ~20 developers.** That number is a *current
  development-tracking scope* used to keep a tab on expenses during the build phase.
- It is a **starting scope for development, explicitly not a product ceiling.**
- The forward intention is **broad market coverage** once authenticated government and paid
  sources come online. Never frame PropPulse as "we only cover 20 orgs."

### Scope boundary (who the app is for)
- The app today is for **broker companies / individual brokers & agents.**
- The broker/community role is to **make the buyer and the developer meet.**
- **Developer-side features are intentionally low-intensity.** Example: Discount recording
  exists only to capture what discounts a developer gives, so final broker **commission** can
  be computed correctly. It is developer discretion, not broker workflow. Do not over-invest
  engineering effort there.

### Positioning
- The product is **AI-heavy** by design — AI is utilised throughout the app, and that is a
  deliberate positioning angle, not incidental.

---

## 2. CURRENT TECHNICAL STATE (the "where" — update each session)

- **Repo:** `mah284-bit/prop-crm` · local `/d/prop-crm` (Windows MINGW64, CRLF)
- **Branch:** `main` (production → prop-crm-two.vercel.app, auto-deploy)
- **Latest commit:** `2a7f56b` (properties 400 fix)
- **Golden / revert floor:** `pre-refactor-resume` (stamped this session, pushed)
- **Prior golden:** `refactor-day40-complete`, `phase-2.7-complete-final`
- **App.jsx:** ~3,681 lines (down from 6,708 pre-Day-40 refactor; the shrink held)
- **Env health (this session):** clean tree, build green, dev server 200. PRE-OP verified.

### What is LIVE (verified from repo, not docs)
- Phase 2.0 Realtime sync; Phase 2.1 Lead Ingestion + governance (pools, assignment, audit).
- App-layer multi-tenant isolation (Stage 3a) + role_capabilities gating (Stage 4).
- Day-40 normalisation: 11 inline modules extracted from App.jsx; `aiInvoke` → shared lib.
- LeadDetail + OpportunityDetail extracted; Property Detail Pack (Project/Unit panels).
- **Phase 2.5 Lead Lifecycle is LIVE** (not "future" as old docs claim): `lifecycle_stage` +
  `buyer_intent` wired; `customers/CustomersPage.jsx` shows converted customers; intent
  segmentation in Coach + LeadCreationFormV2.
- Phase 2.7: ProposalFormModal (inline form removed; clean 2-column Lead Detail).

---

## 3. ACTIVE WORK — Refactor-Resume

**Direction (locked):** finish the normalisation refactor. **No new features built inline in
App.jsx.** Remaining inline/duplicated modules → own feature-folder components, one at a time.

**Method (Day-40, keep using):**
pre-op dep scan → ONE move → build/visual test → commit → next. No bulk.
Verify which copy renders before deleting twins. Tag a revert floor before risky moves.

**Helpers stay inline (decision):** tiny shared primitives (Av, Badge, Modal, Spinner, Btn,
FF, G2/G3, RoleBadge, PwInput, Toast, etc.) are NOT extraction targets — high churn, low
benefit, regression risk. Leave them.

**Big inline modules = the real extraction queue (Sales-first):**
- `AIAssistant` (App.jsx ~2182) — broker-facing, AI-heavy, demo-relevant → top candidate.
- `PaymentPlanTemplates` (~1960)
- `SetupWizard` (~2512)
- `UserManagement` (~3042) — ⚠️ possible twin with already-extracted UsersTab; verify first.
- Leasing modules (LeasingDashboard ~2747, LeasingChequeManager ~1632) — PARKED (leasing
  out of current scope).

**Completed operations this session:**
- Op #1 ✅ `properties` 400 fix — removed invalid `company_id` filter on global table (`2a7f56b`).
- Pre-cleanup ✅ QuickProposalsPanel dead-code strip, 163→43 lines (`98bb981`).

---

## 4. DEFERRED / PARKED (explicit — so nothing is silently forgotten)

- 🅿️ **Teething issues on the flows** — KNOWN, acknowledged by founder, **sealed by founder
  decision.** Not to be discussed or fixed mid-refactor. Order: finish listed refactor work →
  full app walkthrough together → THEN a dedicated teething-issues pass. Architect will not
  drag the conversation toward these early.
- 🅿️ **DiscountApprovals twin** — inline (App.jsx 1485) is live; `src/components/
  DiscountApprovals.jsx` is an orphan. Unresolved. Low priority (developer-side record-keeping).
  Resolve later, not now.
- 🅿️ **projects / project_units company_id filters** (App.jsx ~3328-3329) — conditional on
  `cid`; not confirmed safe to change. VERIFY against live schema before any edit.
- 🅿️ **Leasing module** — parked entirely; sales flows only in current scope.
- 🅿️ **RLS server-side audit** (`is_super_admin` bypass) — app-layer isolation is in; server
  hardening flagged before scaling beyond pilot. In-scope only if an external brokerage onboards.
- 🅿️ **Section C orphan deletes** (Day-40 list: old permissions tabs, old SettingsTab subtab,
  CountryPicker, LeadPersonEditModal, top-of-file inline twins) — harmless dead code; later or never.

---

## 5. PRODUCTION TARGET
- **Sales production-ready on or before 30 Jun 2026** (founder-set).
- Demo is founder-controlled and decoupled from this date (founder manages demo timing).
- June 30 is a **finish-and-harden** goal, not a new-build goal — functionally Sales is largely there.

---

## 6. KEY IDENTIFIERS & OPS NOTES
- `company_id` (Al Mansoori) = `c23a2320-1b35-4636-a840-532c247a6cf9`
- Abid `user_id` = `fa0aae73-847a-4bdc-b4be-f4c0ebb80974`
- Test users: Raja Shekhar (Al Mansoori admin); Roy James (Emirates Premium Realty,
  company `e536de3f-0090-474e-8036-315e474174f1`).
- Folder convention: `src/components/<feature>/` **all lowercase** (Vercel/Linux case-sensitive).
- App.jsx top-level nav add = 4 edits (import, TABS, MODE_TABS sales+both, render handler).
- PropPulse tables (`projects`, `project_units`, `properties`) are **GLOBAL** — never apply
  `company_id` filters to them.

---

## 7. WORKING DYNAMIC
- Founder Abid executes ALL terminal/git/SQL himself; never edits files directly in VS Code.
- Architect (Claude) decides technical direction, hands exact commands.
- Founder trusts architect on technicals; architect still defers to founder on
  momentum/energy/scope and reads back understanding before acting.
- Founder principles: "1 step forward, 2 steps back is bothering me" · "no half-hearted work
  which spoils" · broken states never committed · each commit = revertable checkpoint.
- File delivery: founder is on Claude desktop and CANNOT download. Deliver file content via
  **quoted heredoc** (`<< 'EOF'`) which is safe for content with backticks/quotes.

---

## 8. CHANGE LOG
- 20 Jun 2026 (eve): Doc created. Product frame captured (PropPulse staging + forward
  intention; "20 devs is not a ceiling" correction; broker-scope boundary; AI-heavy
  positioning). Refactor-resume started: Op#1 properties-400 fixed. Teething backlog parked.

---

## SESSION ADDENDUM — 21 Jun 2026 (refactor-resume continued)

### Completed this session
- Op: properties-400 fix (2a7f56b)
- Proposal flow polish: dead-code strip, Screen 3 removed, modal widened 500->920,
  picker row rebuilt (minWidth:0 fix) + enriched with view/floor/specs (conditional)
- Lead Detail header cards aligned
- EXTRACTION: AIAssistant -> src/components/ai/AIAssistant.jsx (d21b129).
  Brought buildContext + writeBrokerCreatedLog along (self-contained). App.jsx -366 lines.
- EXTRACTION: PaymentPlanTemplates -> src/components/payments/PaymentPlanTemplates.jsx
  (aff6228). Local Spinner + can() from lib/permissions. App.jsx -221 lines.
- App.jsx now ~3,095 lines (was 6,708 pre-Day-40; ~3,681 at session start).

### PARKED items logged this session (do NOT action without founder ask)
1. **Payment Plan Templates (`pay_plans` tab)** — deliberately HIDDEN from main nav.
   Developer-side responsibility, not broker MVP workflow. Component built + extracted +
   verified rendering, but kept hidden ON PURPOSE. Revisit POST-MVP (after couple-of-brokers
   pilot) ONLY if there's an ask. (Reason recorded so it isn't re-dug.)
2. **Hidden tabs generally** — pay_plans and other route-map-only tabs were parked for a
   SINGLE consolidated pass at the END of the build, deliberately, to avoid piecemeal
   revisiting. Do not expose hidden tabs one-by-one during refactor.
3. **Lead-Proposal AI (Phase-2 thread)** — Lead-level proposals are intentionally ephemeral
   (PDF-only, NOT in DB) to avoid junk-data bloat from unverified/repeat buyers; the friction
   is a deliberate signal to drop tyre-kickers. Proper DB sales cycle starts at Opportunity.
   Scope when its turn comes: (a) version the Sent-Proposals list + timestamps + sort
   latest->oldest [connects to logged "v4 for AGR-10-06" label bug]; (b) AI caution/provoke
   broker to decide on repeat-asking leads; (c) when buyer turns serious, broker picks unit
   PDF(s) and promotes to Opportunity, AI extracting since not in DB. Surfaces in proposal-flow
   UX pass, post-refactor.
4. **AI call-path unification** — 4 files call AI directly (App via AIAssistant now extracted,
   AIBubble, InventoryModule, LeasingModule) instead of shared lib/aiInvoke.js. AIAssistant's
   path is /api/ai (Vercel serverless, key in env) — architecturally fine, just not unified.
   Dedicated cleanup pass later; Leasing ones are parked scope anyway.
5. **writeBrokerCreatedLog duplicated** — defined in OpportunityDetail.jsx AND now copied into
   AIAssistant.jsx. Should be lifted to a shared lib (used by 4 callers). Cleanup pass later.
6. **Proposal-flow debris** — orphan files from Phase 2.7's 25+ failed attempts: ProposalHome,
   ProposalSent, ProposalTest, ConfirmProposal, PropertyTypeSelector, QuickProposalsPanel_ENDING_FINAL.js.
   Verify-then-delete pass later. Plus DiscountApprovals inline-vs-file twin (still unresolved).

### Remaining big inline extraction candidates in App.jsx
- SetupWizard (~admin-only, self-contained) — next likely target
- UserManagement (check twin vs already-extracted UsersTab first)
- Leasing modules (LeasingDashboard, LeasingChequeManager) — PARKED (leasing out of scope)
- helpers (Av/Badge/Modal/Spinner/etc.) stay inline — not extraction targets

---

## SESSION ADDENDUM — 21 Jun 2026 (evening: walkthrough + dashboard redesign)

### Code shipped
- ActivityLog crash FIXED (7f15e78): live src/components/sales/ActivityLog.jsx missing imports
  ACT_TYPES, ACT_META, fmtDate. Orphan twin src/components/ActivityLog.jsx deleted.
- DASHBOARD REDESIGN (1f0e935 + 16376ea): premium-dense. Slim navy greeting strip replaced
  tall gradient hero. Above-fold cockpit row (Opportunities-by-Stage + Quick Actions + Recent
  Activity). Kept Team Performance (role-gated, no-blanks). Cut Today-at-a-Glance band,
  Won/Lost row, Quick Actions 5->3. Nav fixed: Active/Won/stage -> "opportunities" (was
  reports/leads). Stat-card padding trimmed to fit one screen. Floor tag: pre-dashboard-redesign.

### Full 14-screen walkthrough COMPLETE — details in docs/Walkthrough_Findings.md (Findings #1-#12)
- #1 ActivityLog crash FIXED. #2/#3/#6 dashboard nav FIXED in redesign. #4/#5 wow-redesign +
  role-no-blanks DONE.
- #7 PropertyPackModal share button = intentional Phase 2.3 seam, NOT regression. Foundation
  (getPropertyPackAssets resolver) built; SEND UI unbuilt. Founder recalls a WORKING picker on
  ANOTHER surface (to locate). Park under Comms Overhaul.
- #8 Users>Settings = old SettingsTab (app-config mode/currency/country), park for Unified
  Settings consolidation. #9 Customers = Phase 2.5 lifecycle (works). #10 Commission empty =
  test-data only.

### MAJOR ARCHITECTURE captured (founder directives)
- #11 HIERARCHICAL RLS / need-to-know: simple model = everything is a Company (company_id is
  the foundation); individual = company-of-one (no separate type); optional group_id above
  (null = standalone). DIG FOUND IT'S ALREADY SCAFFOLDED: groups table exists (id, name,
  branch_visibility), companies.group_id nullable + code handles null, GroupBranchesSection.jsx
  (settings) + GroupConsolidatedView component (group_view tab, super_admin) exist. Scope =
  FINISH + ENFORCE not greenfield: wire group-scope into ~43 company_id queries (App.jsx) + 36
  components; consume branch_visibility for per-level need-to-know; super_admin endgame =
  setup/settings/first-user only, no CRM data (ties Multi_Tenant_Identity_Model.md). Founder's
  mental model verified correct by the dig.
- #12 FILTERED-LIST REDUNDANCY (design principle, app-wide): multiple buttons/cards opening the
  same pre-filtered list = one feature in many costumes. An element earns its place only if it
  shows info not otherwise visible OR goes somewhere not trivially reachable. List filters ARE
  the feature. Apply app-wide in content/UX pass.

### Method reinforced
"One cut, one visual check" when edits touch a live screen (build-clean != renders-right).
Mutual accountability active — founder holds architect to it.

---

## SESSION ADDENDUM — 21 Jun 2026 (evening: walkthrough + dashboard redesign)

### Code shipped
- ActivityLog crash FIXED (7f15e78): live src/components/sales/ActivityLog.jsx missing imports
  ACT_TYPES, ACT_META, fmtDate. Orphan twin src/components/ActivityLog.jsx deleted.
- DASHBOARD REDESIGN (1f0e935 + 16376ea): premium-dense. Slim navy greeting strip replaced
  tall gradient hero. Above-fold cockpit row (Opportunities-by-Stage + Quick Actions + Recent
  Activity). Kept Team Performance (role-gated, no-blanks). Cut Today-at-a-Glance band,
  Won/Lost row, Quick Actions 5->3. Nav fixed: Active/Won/stage -> "opportunities" (was
  reports/leads). Stat-card padding trimmed to fit one screen. Floor tag: pre-dashboard-redesign.

### Full 14-screen walkthrough COMPLETE — details in docs/Walkthrough_Findings.md (Findings #1-#12)
- #1 ActivityLog crash FIXED. #2/#3/#6 dashboard nav FIXED in redesign. #4/#5 wow-redesign +
  role-no-blanks DONE.
- #7 PropertyPackModal share button = intentional Phase 2.3 seam, NOT regression. Foundation
  (getPropertyPackAssets resolver) built; SEND UI unbuilt. Founder recalls a WORKING picker on
  ANOTHER surface (to locate). Park under Comms Overhaul.
- #8 Users>Settings = old SettingsTab (app-config mode/currency/country), park for Unified
  Settings consolidation. #9 Customers = Phase 2.5 lifecycle (works). #10 Commission empty =
  test-data only.

### MAJOR ARCHITECTURE captured (founder directives)
- #11 HIERARCHICAL RLS / need-to-know: simple model = everything is a Company (company_id is
  the foundation); individual = company-of-one (no separate type); optional group_id above
  (null = standalone). DIG FOUND IT'S ALREADY SCAFFOLDED: groups table exists (id, name,
  branch_visibility), companies.group_id nullable + code handles null, GroupBranchesSection.jsx
  (settings) + GroupConsolidatedView component (group_view tab, super_admin) exist. Scope =
  FINISH + ENFORCE not greenfield: wire group-scope into ~43 company_id queries (App.jsx) + 36
  components; consume branch_visibility for per-level need-to-know; super_admin endgame =
  setup/settings/first-user only, no CRM data (ties Multi_Tenant_Identity_Model.md). Founder's
  mental model verified correct by the dig.
- #12 FILTERED-LIST REDUNDANCY (design principle, app-wide): multiple buttons/cards opening the
  same pre-filtered list = one feature in many costumes. An element earns its place only if it
  shows info not otherwise visible OR goes somewhere not trivially reachable. List filters ARE
  the feature. Apply app-wide in content/UX pass.

### Method reinforced
"One cut, one visual check" when edits touch a live screen (build-clean != renders-right).
Mutual accountability active.
