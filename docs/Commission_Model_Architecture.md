# PropCRM — Commission Model Architecture

**Status:** DESIGN / Stage 0 — for founder approval BEFORE any schema or code change.
**Date:** 30 June 2026.
**Why this doc:** Commission is the revenue heart of the app. A wrong model = sudden death.
This is the "carefully designed first" step the founder has insisted on since early sessions.
NOTHING gets built until this is approved.

---

## THE CORE INSIGHT — two worlds, two layers, one model

PropCRM serves TWO kinds of users, and commission works differently for each:

**World 1 — Independent Broker (solo).** One person. The developer commission IS his income,
whole and sole. No team, no split.

**World 2 — Broker Company (firm with a sales team).** Two layers on the same deal:
- **Layer A (Company ↔ Developer):** the developer pays the COMPANY its commission = company revenue.
- **Layer B (Company ↔ Agent):** the company shares a slice with the agent who closed it, OUT OF its
  own pocket, SOURCED FROM the developer commission.

**The unifying elegance:** the solo broker is just "agent split = 100%". One model serves both
worlds, no separate code path. Solo = a company-of-one where the agent gets the whole commission.

---

## LAYER A — Company ↔ Developer (company revenue)

### Resolution hierarchy (most-specific wins, ALWAYS resolves)
1. Unit/Deal override (manual entry on the opportunity)
2. Master Agreement default (`pp_master_agreements.default_commission_pct`)
3. Company-level default (NEW — fallback when no MA exists)
4. (final safety: 0 with a warning, never blank-crash)

### What ALREADY EXISTS (verified in code — CreateOpportunityDialog.jsx)
- On unit selection, looks up the project's developer's Master Agreement (lines 73-91).
- Auto-populates `commission_pct` from `default_commission_pct` (line 90).
- Stores `commission_pct` + `master_agreement_id` on the opportunity (lines 459-460).
- Override flag `commissionUserOverride` — if no MA, broker enters manually (line 1026 warning).

### What is MISSING / to ADD for Layer A
- A **company-level default commission %** as the fallback BETWEEN "MA exists" and "manual entry".
  Real-world reason (founder): many developers refuse to sign/maintain 1000s of master agreements,
  so a company needs a sensible default rate to apply when no MA is on file — without forcing the
  broker to type it every time.
- Where it lives: `companies.default_commission_pct` (company-level setting).
- Resolution becomes: MA → else company default → else manual override.

### Math
```
company_commission = sale_price × layerA_pct / 100
```
(sale_price = the final agreed/net price from the latest accepted proposal, as today.)

---

## LAYER B — Company <-> Agent (the agent's cut) — NET-NEW  [CORRECTED MODEL — authoritative]

An earlier 2-tier draft (agent_default ?? deal_override) was built in Stage 4 with correct math but is
an INCOMPLETE model. The authoritative model below is 3-TIER + APPRECIATION BONUS + a complete
per-broker bracket CYCLE + agent-money-only view + full audit. (Decision trail: correction blocks at
end of doc.)

### Two MODES (per agent, both required)
| Mode | Agent gets | Protects |
|---|---|---|
| percentage | X% of COMPANY commission | scales with deal; agent CAN back-calc company margin |
| fixed | a flat amount (e.g. AED 50,000) | company margin CONFIDENTIALITY — agent learns nothing |

Fixed mode matters: a % agent can reverse-engineer company margin; fixed shows ONLY their amount.

### Split resolution — 3 TIERS (most-specific wins, mirrors Layer A)
1. TIER 1 company-wide standard split — a SETTINGS field (e.g. house 20%). Base every broker gets
   unless their bracket overrides. Lives on companies. SM/Owner sets.
2. TIER 2 per-broker bracket — role/performance/ability (senior 30%, junior 15%). Overrides company
   standard for that broker. Lives on profiles. SM/Owner sets AND advances (cycle below).
3. TIER 3 per-deal override — a specific deal differs. Lives on opportunities.

```
agent_base = deal_override ?? broker_bracket ?? company_standard
```

### Per-broker bracket = a COMPLETE LIVING CYCLE (not a dead stored value)
- SET: SM/Owner configures each broker's bracket (mode + value). [UI = Stage 5]
- ADVANCE: bracket is a motivation mechanism — SM MANUALLY moves a broker between brackets on
  role/performance/ability. NOT auto-metrics (founder's call). Every advance REASON-MANDATORY + AUDITED.
- APPLY: at deal calc, the bracket feeds agent_base.
- VERIFY: loop must be demonstrable end-to-end (set -> advance -> apply -> agent sees -> audit).

### APPRECIATION BONUS (per-deal — the motivation lever)
- ADDITIVE on top of agent_base. Per-deal (specific achievement). Per-period = future.
- WHO: SM/Owner ONLY (capability-gated). Agent NEVER sets it. Admin not by default.
- HOW: flat AED or percentage of deal commission. REASON-MANDATORY + AUDITED. Lives on opportunities (+audit log).

### Math
```
agent_base  = (deal_override ?? broker_bracket ?? company_standard)   // percentage or fixed
agent_total = agent_base + appreciation_bonus                          // bonus additive
company_net = company_commission - agent_total                         // agent NEVER sees this
```

### Agent view = THEIR MONEY ONLY (founder: "this field is all money they see, nothing else")
- Agent sees agent_base + appreciation_bonus = TOTAL earning. Bonus itemized as "Performance Bonus".
  NEVER company commission / margin / company_net. SM/Owner sees full breakdown. [agent view = Stage 7]
- "If there is no motivation there is no progress" — the visible number is the lever.

### Governance (locked)
ALL bracket changes AND all bonuses are TRACEABLE + AUDITABLE WITH REASONS (same rigor as lead
reassignment) — a mandatory-reason audit log entry per change.

### Solo broker (World 1)
- No company-standard / bracket / bonus set → agent_base = company_commission (100%). Single-figure
  behaviour unchanged. ONE model, both worlds.
---

## SCHEMA (the DB changes — DBA-grade, persisted, never cache-derived)

**Founder principle (DBA instinct, LOCKED):** all commission values live in Postgres, are READ from
Postgres, and the authoritative money number is a FROZEN DB record — never a client-side recompute
that could drift with cache/stale state. The app must never show a money number that can flicker, or
it gets blamed for errors and loses trust inside the company.

### New columns

**`companies`** (Layer A fallback)
```sql
ALTER TABLE companies ADD COLUMN IF NOT EXISTS default_commission_pct numeric;
-- company-level developer-commission fallback when no Master Agreement exists
```

**`profiles`** (Layer B agent DEFAULT)
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS commission_split_mode text
  CHECK (commission_split_mode IN ('percentage','fixed'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS commission_split_value numeric;
-- the agent's STANDARD cut; mode = percentage|fixed; value = % or flat AED
-- NULL mode = treat as no split set yet (SM must configure); solo super_admin can default to 100% pct
```

**`opportunities`** (Layer B per-deal OVERRIDE)
```sql
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS agent_split_mode text
  CHECK (agent_split_mode IN ('percentage','fixed'));
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS agent_split_value numeric;
-- per-deal override; NULL = use the agent's profile default
```

**`pp_commission_invoices`** (the FROZEN authoritative record — extend, do NOT break)
- Already stores company-side: commission_pct, commission_gross, vat, commission_net (verified
  OpportunityDetail.jsx lines 825-829).
- ADD agent-side frozen fields so the agent's earning is a STORED record, not a live calc:
```sql
ALTER TABLE pp_commission_invoices ADD COLUMN IF NOT EXISTS agent_id uuid;
ALTER TABLE pp_commission_invoices ADD COLUMN IF NOT EXISTS agent_split_mode text;
ALTER TABLE pp_commission_invoices ADD COLUMN IF NOT EXISTS agent_split_value numeric;
ALTER TABLE pp_commission_invoices ADD COLUMN IF NOT EXISTS agent_commission numeric;
ALTER TABLE pp_commission_invoices ADD COLUMN IF NOT EXISTS company_net numeric;
```
- At SPA-signed, the invoice freezes BOTH company_net AND agent_commission. This is the number the
  agent trusts. It never recomputes.

All migrations: `IF NOT EXISTS`, idempotent, safety-tagged before running.

---

## VISIBILITY MATRIX (who sees what — by capability, reusing existing mechanism)

The app already has `hasCapability()` + `role_capabilities` table (App.jsx 2618-2632), already gating
the Commission Outstanding screen via `see_brokerage_commission` (line 2804). We REUSE this — no new
infrastructure.

| Figure | Agent (no cap) | SM/Owner/Admin (has cap) | Solo |
|---|---|---|---|
| Layer A: company_commission | ❌ HIDDEN | ✅ sees | ✅ (it's their income) |
| Layer A: developer % | ❌ HIDDEN | ✅ sees | ✅ |
| Layer B: agent_commission (their cut) | ✅ sees ONLY this | ✅ sees all agents' | ✅ (=company comm) |
| company_net (margin) | ❌ HIDDEN | ✅ sees | ✅ |

**Capability:** reuse `see_brokerage_commission` (holder = sees company-side figures). Agents lacking
it see ONLY their own `agent_commission`. In fixed mode they see just their amount — zero leak.

**The gate applies to:**
- CreateOpportunityDialog commission field (currently shown to all — must gate).
- OpportunityDetail "Broker Commission (Revenue)" panels (lines 1456-1526, 1783-1870 — must gate).
- Any commission display surfaces the agent shouldn't see company-side numbers on.

---

## WHAT IS PRESERVED vs CHANGED vs NEW (so we extend, never break)

**PRESERVED (do not touch the working logic):**
- Master Agreement lookup + auto-populate in CreateOpportunityDialog.
- The SPA-signed auto-create commission invoice (OpportunityDetail 787-836) — the anti-miss gate.
- The capability mechanism (`hasCapability`, `role_capabilities`).
- Buyer-outflow vs broker-commission architectural separation.

**CHANGED (extend carefully):**
- Layer A resolution: add company-default fallback (MA → company default → manual).
- Invoice creation: extend to ALSO freeze agent_commission + company_net (not just company side).
- Commission displays: gate behind capability.

**NEW (net build):**
- Layer B entirely: agent split mode/value on profile + opportunity, the calc, the agent-facing
  "your commission" view, and the SM-facing "full picture" (company comm, each agent split, net).
- Company default commission % setting.
- Agent split config UI (where SM sets each agent's default mode+value).

---

## BUILD STAGES (each = one safe, build-verified, committed checkpoint)

> Pace = willpower/energy, not clock. Rest between stages. No half-built commission state committed.

- **Stage 1 — Schema.** Add all columns (companies, profiles, opportunities, pp_commission_invoices).
  Idempotent migration. Safety tag `pre-commission-model`. Verify columns exist. No UI yet.
- **Stage 2 — Layer A company-default fallback.** Add `companies.default_commission_pct` to the
  resolution chain (MA → company default → manual). Verify auto-populate still works.
- **Stage 3 — Visibility gating.** Gate the commission field (CreateOpportunityDialog) + the
  OpportunityDetail commission panels behind `see_brokerage_commission`. Verify: admin sees, a
  plain-broker test role does NOT. (This satisfies the original "broker shouldn't see commission".)
- **Stage 4 — Layer B schema-to-logic.** Agent split resolution (deal override ?? profile default),
  the percentage|fixed math, company_net. Read-only display first (no invoice change yet).
- **Stage 5 — Agent split config UI.** Where SM sets each agent's default mode + value (likely in
  Settings or Users). Per-deal override field on the opportunity (gated to SM).
- **Stage 6 — Invoice freeze extension.** Extend the SPA-signed invoice to store agent_commission +
  company_net as frozen records. The agent's authoritative, non-drifting number.
- **Stage 7 — Agent-facing view + full-picture view.** Agent sees ONLY their cut; SM sees everything.
- **Stage 8 — End-to-end verify** for BOTH worlds (solo = 100%; company = multi-agent, both modes).

Each stage: read real code → abort-safe edit → `npm run build` → visual check → commit + push.
Safety-tag before schema and before any risky stage.

---

## OPEN ITEMS / DEFERRED (named, not chased)
- Bonus commission (`bonus_commission_pct` + threshold exist on MA — screenshot shows "Bonus 0.50,
  Threshold 5+"). Layer A bonus handling = consider in Stage 2 or defer. FLAG for founder.
- Multi-company agents (agent at >1 firm with different splits) = deferred; profile-default assumes
  one company (normal case).
- Tiered/target-based auto-splits = deliberately NOT built (founder's call: SM decides manually;
  config-not-engine, per Implementation Doctrine).

---

## FOUNDER PRINCIPLES PRESERVED
- "This is the heart — careful design or sudden death." → this doc IS that design.
- DBA instinct: DB-stored, DB-read, frozen-invoice authoritative number, no cache drift → LOCKED as
  the trust rule (the app must never be blamed for a flickering money number).
- "Give the options, let the SM decide, don't drive them where they won't walk" → two modes,
  default+override, manual judgment; no rules-engine.
- Config not implementation (Implementation Doctrine) → SM configures; app applies; no per-company forks.

---

## APPROVAL GATE
Founder reviews this doc. Confirms/corrects against market reality. ONLY on approval do we run Stage 1
(schema). Until then: zero code, zero schema.

## MARKET VALIDATION + BONUS DECISION (30 Jun 2026)
Researched whether developer/situational bonuses are real in UAE off-plan. CONFIRMED standard:
- Developers add bonuses on harder-to-move / less-desirable / lesser-known-developer units, and vary
  commission by market conditions (multiple sources).
- Two-tier systems: standard ~5% + extra incentives for bulk sales (e.g. > AED 10M); launch bonuses
  push off-plan commissions to 10-15% on some projects.
- INTERNAL AGENCY SPLITS (validates Layer B): agents typically get 50-70% of the commission they
  generate, balance to the agency. Use 50-70% as the real-world default range when configuring agent
  splits.
- Sub-agency/referral: referring agent gets 25-50% of total commission (NOTED for future, not now).

ARCHITECTURAL DECISION (locked):
- The SITUATIONAL developer bonus (extra % on a specific hard/strategic unit, market-driven) is NOT a
  new system — it is just a higher Layer-A % on that deal. It is ALREADY handled by the existing
  resolution hierarchy's TOP tier: Unit/Deal override. SM enters the bonus % as a deal override; it
  beats the MA default. Works from day one, no new schema.
- DEFERRED: only the MA volume-threshold auto-bonus (bonus_commission_pct + bonus_threshold, e.g.
  "5+ deals -> +0.5%"). That needs deal-counting-over-a-period logic = its own mini-feature. Build
  AFTER the two core layers work. Naming it, not chasing it.
NET: the important real-world bonus behaviour is covered now via override; only the periodic
auto-tier is deferred. Founder's memory of developer bonuses was correct and is market-standard.

## STICKY NOTE (30 Jun) — Sales Manager override commission (Layer B variant, FUTURE)
Founder insight mid-build: an SM who does NOT personally close a deal but acts as a CATALYST
(coaching/enabling agents to close) may still earn a commission — a MANAGEMENT OVERRIDE on
deals his team closes. Standard in brokerage comp (managers earn a small percent on team output).
- THIRD Layer-B participant: Company to Agent (closer) AND Company to Manager (override).
- Likely shape: a manager-override percent (on company commission, or on agent deals he oversees),
  configurable per manager, sourced from company commission (NOT the agent cut — TBD).
- Visibility: manager sees his override; still gated from plain agents.
- DECISION: log as ADDITIONAL OPTION, build AFTER the core two-participant model works.
  Do not widen current stages. Revisit at Stage 5 (agent split config) — natural home.
- Open question: is the override drawn from company_net or a separate slice? Founder decides later.

## STICKY NOTE (30 Jun) — Commission ACL refinement: admin is operational, not financial (DEFER)
Founder clarified mid-build: ADMIN role is operational (config, add users, maintain standards,
redirect/reassign leads when agents are away) — NOT financial. Admin should see commission ONLY if
the company explicitly grants it, NOT by default.
- Current BUILT state: canSeeCommission effect auto-passes ["admin","super_admin"] (inherited from
  App.jsx hasCapability pattern). This is OVER-permissive for admin (safe — no agent leak — but admin
  sees commission today when by design they shouldn't unless granted).
- Doc's actual intent (visibility matrix line 148): "SM/Owner/Admin (HAS CAP)" = capability-driven for
  all, NOT auto-pass. The admin auto-pass diverged from doc.
- TARGET model:
  * super_admin (owner) -> auto-pass (their company/income)
  * admin -> NO auto-pass; capability-gated, OFF by default, grantable per company
  * sales_manager / accounts -> capability-gated (normally granted)
  * plain agent -> never (sees only own cut, later)
- FIX when we do it: in OpportunityDetail canSeeCommission effect, change auto-pass from
  ["admin","super_admin"] to ["super_admin"] only; admin falls through to the capability check.
- NOTE TO RECORD: this makes commission gating INTENTIONALLY STRICTER than the global hasCapability
  helper (which auto-passes admin). That is correct — money is more sensitive than general features.
- Also revisit: is "Accounts" a distinct role in the system, or folded into another? If distinct,
  grant it the capability by default.
- DECISION: DEFER. No exposure risk in waiting (current state is over-permissive, not leaky). Do this
  as a focused ACL pass AFTER the core Layer B model works. Do not fragment the current build flow.

## STICKY NOTE (30 Jun) — Property management revenue cycle (AFTER-RELEASE, Phase 2)
The "Buyer agency services + property management tracked separately" note in the commission panels
points at a REAL bigger picture: most UAE broker companies ALSO act as property handlers/managers —
managing rentals, rent-rise concerns, tenant issues, maintenance coordination, owner retainers, etc.
This is a SECOND revenue cycle alongside sales commission.
- Scope (future): property-management retainers, rent-collection cuts, renewal commissions, tenant
  service fees — a recurring-revenue stream distinct from one-off sales commission.
- Why it matters: brokerages want ONE platform covering sales commission AND management revenue.
- DECISION: marked AFTER-RELEASE, Phase 2. Discuss properly AFTER the commission model is fully
  finished (no deviation now). The current commission build is sales-side only.
- UI note today: the "Buyer agency services + property management tracked separately (Phase 2 module)"
  line in both commission panels is the breadcrumb for this. Decision on whether to keep/remove/reword
  that line is DEFERRED to this same future discussion (see decimals note below — handled separately).

## ⚠️ EXPANDED CORRECTION (30 Jun) — Per-broker bracket = COMPLETE CYCLE, not just stored math
Founder sharpened the gap: I delivered only 1 STEP (the split math on a stored value). The per-broker
bracket must be a COMPLETE, WORKING, VERIFIABLE CYCLE. Three requirements:

1. WHERE WE SET IT — SM/Owner configures each broker's bracket ("Ahmed is on 30%"). No UI today (only
   the profiles column exists, SQL-only). The setting screen is MISSING.

2. HOW IT ADVANCES + GETS APPRECIATED — the bracket is a LIVING motivation mechanism, not static:
   - ADVANCEMENT IS MANUAL + SM-DECIDED (NOT auto-metrics — confirmed; matches doc line 216 "SM decides
     manually"). SM judges role/performance/ability and MOVES the broker between brackets. Every move
     REASON-MANDATORY + AUDITED.
   - APPRECIATION = SM-granted bonus on TOP of wherever the broker sits (per-deal, reason+audit).
   - The SYSTEM records + applies the SM's human decisions traceably; it does NOT auto-promote.

3. CYCLE WITH RESULT — must be VERIFIABLE END-TO-END:
   SET bracket -> (SM ADVANCES bracket w/ reason+audit) -> APPRECIATE (bonus, audited) -> APPLY (deal
   closes, correct split+bonus computed) -> AGENT SEES their money (motivation) -> AUDIT (every change
   traceable w/ reason) -> VERIFY the loop closes with correct numbers.
   Today only APPLY (math) exists. The rest of the cycle is MISSING.

FULL CORRECTED LAYER B MODEL (locked with founder):
- TIER 1 company-wide standard split — SETTINGS field (e.g. house 20%). MISSING schema+UI.
- TIER 2 per-broker bracket — role/perf/ability; SM manually advances, reason+audited. Storage built,
  cycle (set/advance/audit) MISSING.
- TIER 3 per-deal override — built.
- APPRECIATION BONUS — per-deal, SM/Owner-only, additive, reason-mandatory, audited. MISSING entirely.
- AGENT VIEW = their money only (base + bonus = total earning; NEVER company margin). Founder: "this
  field is all money they see, nothing else. No motivation, no progress." MISSING (Stage 7 + guarantee).
- ALL CHANGES traceable + auditable WITH REASONS (founder principle, locked).

resolution: agent_base = deal_override ?? broker_bracket ?? company_standard; agent_total = agent_base
+ appreciation_bonus; company_net = company_commission − agent_total (agent never sees).

## STICKY NOTE (30 Jun) — SM/Admin direct-earning eligibility (DISCUSS; reconcile w/ notes above)
NEW facet (distinct from the two notes above): can an SM/Admin DIRECTLY EARN deal commission?
- By default NO (operational/management roles don't close deals). EXCEPTION: they may earn IF they
  personally handle a walk-in or an assigned customer — but only if the COMPANY ALLOWS it (discretion).
- This is about DIRECT earning on a deal they close — NOT the SM team-override (see note ~282) and NOT
  commission VISIBILITY (see ACL note ~294). Three related-but-different facets.
- BUILD QUESTION raised at the "Agentwise Commission Breakup" screen: should that list FILTER OUT
  non-earning roles (admin/SM) by default, or show everyone with "not set" = earns nothing?
- CURRENT STATE (safe): the per-deal override on the opportunity already lets ANY assigned person earn
  on a specific deal — so the walk-in case technically works today via override. Missing = the
  default-eligibility model + a company toggle ("allow managers/admins to earn on deals they close").
- DECISION: DISCUSS. Reconcile THIS + SM-override (~282) + ACL (~294) into ONE coherent
  "who earns commission, who sees it, and how" model. No code now. Do it as the focused commission-ACL
  + eligibility pass after the core capture UIs (Stage 5) are done.

## DESIGN NOTE (30 Jun) - Management Commission Hierarchy (CAPTURE ONLY; dedicated future phase)
Founder "downloaded the instinct" while seeing the agent-tier built (the fish-in-hand reveals the real
shape). CAPTURE NOW, do NOT build now - finish the agent cycle (Stage 5) first, then a dedicated phase.

### The crux founder named (architecturally important)
You CANNOT forbid anyone in a brokerage from closing a deal - can't tell a customer "the sales manager
won't sell you" or "admin won't either". So commission eligibility must NOT be a role lockout.
RESOLUTION: EARNING FOLLOWS ASSIGNMENT, NOT ROLE. Whoever OWNS (is assigned) a deal earns the split on
it - agent, SM, or admin alike. Role neither grants nor denies. This is already how the agent tier
works (per-deal assignment). The Agentwise Commission Breakup showing everyone is therefore CORRECT
(set a rate for anyone who may ever own a deal), not a bug. An optional role filter = tidiness only.

### This is PURE SALES COMMISSION - it lives HERE, not ERP (corrects earlier ERP lean)
Finance and HR CONSUME the sales commission split; they do not produce it. The Sales Manager must
SUBMIT the COMPLETE commission breakdown (agent -> manager -> group) on completion - that submission IS
the deliverable Finance/HR receive. If manager/group tiers are punted to ERP, the SM cannot submit a
complete report. So the full hierarchy is the PRODUCT. Sensitive money ("all a money game - 1 fil off
and the place goes up and down") => must be exact + auditable, DBA-grade.

### The three earning tiers (rollup from one deal)
GROUP MANAGER - earns group-wise pct across all branches/teams under them
  MANAGER(s)  - each earns team-wise pct across their team's deals
    BROKERS   - each earns their own split (company std -> bracket -> deal override) [BUILT]
    DEAL closes -> agent split -> manager override -> group override, all rolling up from the same deal
Manager/group tiers are a pct of the deals BENEATH them (not deals they personally closed - that's the
agent tier via assignment). A manager who personally closes a walk-in earns as the AGENT on that deal
(assignment) AND separately the manager-pct on their team's other deals. Two distinct things.

### Q to architect: "1 sales team per org - what if multiple teams?" - ANSWERED
Do NOT assume one team. Model a REPORTING TREE from the start, which handles both:
  broker.manager_id points to manager ; manager.group_manager_id points to group manager
  One team  = all brokers point to one manager (tree with one branch)
  Many teams = brokers point to different managers, all under one group manager
Same structure; the "1 team" case is a single-branch tree. Build the tree, both fall out free.

### THE DEPENDENCY (foundation that must exist first)
ORG REPORTING HIERARCHY (broker -> manager -> group manager) does NOT fully exist yet. Today there are
groups/branches but not individual reporting lines. Management-commission tiers CANNOT compute without
this tree. Build order:
  1. Org reporting hierarchy (the tree)      [foundation - NOT built]
  2. Manager override pct (team-wise)        needs #1
  3. Group-manager override pct (group-wise) needs #1
  4. Rollup engine + SM submission report    (the complete chain Finance/HR receive)

### Looking complete without over-building
Acknowledge the management layer in design/UI (a visible "Manager and Group overrides" concept, even if
marked future) so it never looks FORGOTTEN - while the engine waits. Thought-through != built.

### DECISION
CAPTURE ONLY (this note). Build AFTER the agent-tier cycle (Stage 5) is finished. Then a DEDICATED
"Management Commission + Org Hierarchy" phase (Stage number TBD when we connect docs and re-plan).
Reconcile with the three related sticky notes above (SM-override, ACL, SM/Admin eligibility) into ONE
coherent "who earns, who sees, and how it rolls up" model at that time.
Founder principle: "one thing looks good for now, lets dive in and catch the fish - touching the fish
tells you the current, so you catch the missed ones better."

## CORRECTION to above note (30 Jun) — GATE is NOW, only the MIXED top-up is parked
Founder clarified: the GATE (bracket cannot be less than company standard, same mode % or fixed) must
be BUILT NOW — it is in scope. Brackets inherit the company's single mode; gate = bracket value >=
standard value. Build immediately.

PARKED (next week) = only the MIXED case: a FIXED top-up layered on a PERCENTAGE base. Example: company
standard 35%; manager negotiates "can't raise your %, but +AED 10K per sale". A STANDING per-agent
fixed kicker ON TOP of the % base — a real negotiation pattern (can't rule it out). Overlaps existing
appreciation_bonus schema but that is per-deal one-off; this is a standing per-agent arrangement (every
sale). Design next week after seeing response. NOT the gate — the gate is now.

## STICKY NOTE (30 Jun) — Make commission dialogs movable (UX polish, LATER)
Most app dialogs are already movable/draggable. The new commission dialogs (Set rate, and later the
per-deal bonus/override dialog) are fixed-center modals. Founder: make them movable too for consistency
— LATER, after the core commission cycle is done. Pure UX polish, no logic. Low priority.

## STICKY NOTE (30 Jun) — Stage 5c governance decisions + deferred items
Stage 5c (per-deal bonus + override on the opportunity) is complete. Decisions + open items captured:

1. DEFERRED — floor on per-deal OVERRIDE. Brackets have a hard floor (>= company standard). The
   per-deal override does NOT (inform-don't-block): manager can go below standard, but it requires a
   two-step amber->red confirm, a mandatory reason, and shows a PERSISTENT below-standard flag in the
   breakdown. Founder: "the call is very difficult, perception differs by person/org — do as planned
   (inform, not block) for now." REVISIT: whether deal-override should be floored, or stay the
   explicit exception tool. Flipping warn->block later is a ~1-line change. Real below-standard cases
   are being captured in commission_audit_log meanwhile — decide from real data.

2. PRINCIPLE — audit trail as PREVENTION, not policing. Founder: managers won't manipulate (they share
   in the same commission, incentive-aligned), but "things do happen — if there is an audit trail they
   will use it carefully and inform the agent accordingly." The trail's purpose is to make everyone act
   carefully up front (sunlight), with the OWNER/super_admin above the manager as the real check (they
   see all). Below-standard splits are deliberate-to-set and impossible-to-hide by design.

3. FOR STAGE 7 (agent-facing view) — agent transparency. Founder thought: "informing the agent
   accordingly." Consider letting the AGENT see their OWN deal's commission history (the changes that
   affect their pay), not just the manager. Transparency to the person affected. Build in Stage 7.

4. UX NOTE — the two-step below-standard confirm (amber Review -> red Confirm) is two clicks to exit.
   Founder: "fine for now." Alternative if revisited: single red Save disabled until a checkbox
   "I confirm this is below standard" is ticked. Low priority.

## STICKY NOTE (30 Jun) — SPA / stage-gate revisit (CAPTURE ONLY — revisit, no build now)
Surfaced while testing the Stage 6 invoice freeze (moving a deal to SPA Signed). Notes to revisit:

1. RESERVATION FEE not surfacing on the SPA stage-gate form. A reservation fee paid in a PRIOR step
   does not show in the Pre-SPA Payments list, so the user had to mark it "Waived" to proceed. The
   form should READ and DISPLAY already-captured reservation/booking payments, not require re-entry.
   -> Review the SPA stage-gate form's payment capture/display + how prior payments are linked.

2. BOOKING vs RESERVATION fee model (founder open question — needs proper design):
   - Is a BOOKING fee taken first to mark the unit "Booked", then ADJUSTED into the reservation fee
     or the initial advance? Sequence + adjustment rules unclear.
   - Refund/reversal on cancellation (loan not approved, buyer loses interest, etc.): reverse all
     payments BUT retain an administration/admin fee for work done + handle advances. Define the
     refundable vs non-refundable split and the reversal flow.
   - COMMISSION RULE (important): NO commission on any fees (booking/reservation/DLD/admin/etc.).
     Commission is computed on PRICE ONLY. Confirm the commission base everywhere excludes fees.

3. SPA form itself needs a full review pass to ensure correct capture of all pre-SPA payments and
   their statuses. Important but DEFERRED — note now, revisit as a focused SPA pass (not in commission
   stages). No deviation now.

## SPA UPLOAD UX NOTE (30 Jun) — append to the SPA revisit (no build now)
NOT a bug — the SPA upload control works, but the UX ordering has a gap:
- The "Click to upload SPA" control renders INSIDE the SPA-Signed stage gate (optional there — can be
  skipped). The Close-Won dialog only VALIDATES that a doc exists (hasSpaDoc, ~line 4722) and offers
  NO upload control. So if upload is skipped at SPA-Signed, Close-Won blocks with no way forward
  except returning to the SPA-Signed gate to upload.
- Working path exists: upload at SPA-Signed -> Close-Won passes. So testers are not hard-blocked.
- DECISION for the SPA pass: either (a) make SPA upload REQUIRED at SPA-Signed (can't confirm without
  it), or (b) ADD an upload control to the Close-Won dialog too, or (c) both. Workflow design choice —
  decide during the focused SPA revisit, not piecemeal.

## SPA RE-EDIT — REFINEMENT (30 Jun): manager-amend, not hard-lock
Refinement on the immutability note above. A hard "no changes after SPA Signed" is too rigid —
GENUINE errors happen (wrong final price, wrong document). Better model:
- AGENTS: SPA gate is read-only once Signed (cannot change a signed commitment).
- MANAGERS (sales_manager / admin / super_admin): CAN amend a signed SPA, but the amendment must be
  AUDITED (who, what changed, reason) — same governance as commission overrides.
- Open question for the SPA pass: when a manager amends a signed SPA that already froze an invoice,
  does the invoice RE-freeze to new values, or stay locked with an audited amendment record? (Lean:
  audited re-freeze, since the correction is deliberate + on record.) Decide during the SPA revisit.

## STICKY NOTE (30 Jun) — Commission REPORTS (future phase, after Stage 7/8)
Once per-agent and per-manager commission views exist (Stage 7), reporting is the natural next build:
- AGENT report: my earnings — base + bonuses per deal, per period, with reasons (motivation). No company margin.
- MANAGER/OWNER report: full commission P&L — company gross, agent payouts, company net margin,
  by agent / by period / by developer. Below-standard overrides surfaced for review.
- Feeds / aligns with the existing Commission Outstanding screen (invoiced -> received).
- Frozen invoice values (Stage 6) are the source of truth for closed deals — reports read frozen
  numbers, not live recompute, so reported commission matches what was closed.
Scope as its own reporting phase. Note now, build after the agent/manager views (7) + end-to-end (8).

## STICKY NOTE (30 Jun) — Capability assignment must be company-configurable (ACL architecture, REVISIT)
Founder concern (raised during Stage 7 manager-view test): we are hard-coding role->capability rules
in CODE (the OpportunityDetail canSeeCommission auto-pass for ["admin","super_admin"]) AND partly in
data (role_capabilities table). If brokerages want to FREELY assign who sees/decides commission, the
hard-coded code gate will fight the configurable table and cause issues.

PRINCIPLE TO ADOPT: the role_capabilities table is the source of truth (per-company, per-role,
toggleable) — it is the RIGHT, flexible mechanism. The CODE should TRUST that table, not hard-code
role lists that bypass it. Auto-pass in code (super_admin aside, as company owner) is what diverges.

REVISIT as a focused ACL pass (not piecemeal):
- Decide what is STRUCTURAL (e.g. super_admin owner always sees own company) vs ASSIGNABLE (everything
  else flows from role_capabilities, set per company in Settings UI).
- Remove/limit hard-coded role lists in commission gates; read capability from the table.
- Decide gate location: app-layer capability check vs RLS (DB-enforced). Money may warrant RLS so it
  is enforced server-side, not just hidden in UI.
- Provide a Settings UI for brokerages to assign capabilities to roles freely (the "free assignment"
  the founder is protecting).
- Current data state (Al Mansoori) at time of note: admin=true, sales_manager=false, sales_agent=false
  for see_brokerage_commission. Per doc, SM should be normally-granted; admin should default OFF
  (admin is operational, not financial — see ACL refinement note above).
NO deviation now — note + continue. Fix in the dedicated ACL pass.
