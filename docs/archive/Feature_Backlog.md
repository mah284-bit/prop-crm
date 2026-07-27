# PropPlatform Feature Backlog
**Captured during product development sessions**

**Started:** 13 May 2026 (Wednesday afternoon)
**Purpose:** Capture founder-level product insights, tester feedback, and future
feature requirements so they're not lost between sessions. Triaged by
phase (B = post-demo cleanup, C = post-funding, D = scale).

---

## Living Document

This document grows as testers, founders, and engineers surface new
requirements. It is the primary source for:
- Phase B sprint planning (week of 19 May 2026)
- Phase C roadmap (post-funding)
- Investor "what's next" conversations
- Tester feedback triage

**When to add an item:** When founder/tester says "this needs to..." or
"we should also..." — capture immediately, decide later.

---

## 1. Stage Gate Discipline (Cowboy vs Enterprise Mode)

### Founder observation (13 May 2026)
> *"we call but if not recorded the conversation and next steps I can
> straight jump to proposal or any other stage which is good for cowboy
> selling, If company they have to close the tasks and make notes and
> ensure they are in constant touch and updates looking your thought on
> this atleast it should warn do you want to close the previous task
> before moving to another task"*

### Problem
PropCRM currently allows free movement between stages without enforcing
activity capture. This works for solo brokers but fails enterprise
audit requirements.

### Business value
- **Enterprise sales:** Audit trail, broker accountability, manager visibility
- **Solo brokers:** Flexibility preserved (configurable)
- **Investor pitch:** Two market segments addressable (SMB + Enterprise)

### Proposed solution
**Configurable Discipline Mode** per company:
- **Cowboy Mode** (default for small companies): No enforcement, free stage movement
- **Enterprise Mode**: 
  - Warning dialog when advancing stage with open tasks: 
    *"You have N open tasks. Close them before moving to [next stage]?"*
  - Required activity log entry on each stage transition
  - Optional: prevent stage advance until tasks closed
  - Audit log of all stage changes with timestamps

### Effort
- Mode toggle in company settings: 1 hr
- Open task detection + warning dialog: 2 hr
- Required activity capture flow: 2 hr
- Audit log table + viewer: 4 hr
- **Total: ~9 hr**

### Phase
**Phase C** (post-funding) — feature for enterprise customers, not MVP-critical

---

## 2. Negotiation Outcome Capture

### Founder observation (13 May 2026)
> *"when in negotiation we are taking the negotaion points, but at the
> end we need to record the result, concession if any given discounts if
> any given if not pad and allow for 0 value for things like discounts
> and others where developer has agreed because for a company this is
> important what a agent/broker is doing really"*

### Problem
When opp moves from Negotiation → Offer Accepted, no structured capture
of negotiation outcomes. Management can't see what broker actually
negotiated (price concessions, discounts given, freebies agreed).

### Business value
- **Manager oversight:** Visibility on broker decisions
- **Margin tracking:** Detect aggressive discounting patterns
- **Audit compliance:** Required for company-level operations
- **Commission accuracy:** Final price affects commission calculation

### Proposed solution
**Negotiation Outcome Form** triggered when moving to "Offer Accepted":

Required fields:
- Final agreed price (default: asking price)
- Discount % (default: 0)
- Discount AED value (auto-calculated)
- Concessions checklist (multi-select):
  - DLD paid by developer
  - Maintenance fee waived (months)
  - Parking included
  - Furniture included
  - Service charge waived (months)
  - Free upgrade/view
  - Custom (text field)
- Negotiation notes (required, min 20 chars)
- Manager approval needed if discount > X% (configurable threshold)

### Effort
- Form UI: 2 hr
- DB schema additions (opportunity columns or separate table): 1 hr
- Manager approval workflow (if threshold exceeded): 3 hr
- Reports/analytics on negotiation patterns: 4 hr
- **Total: ~10 hr**

### Phase
**Phase B** (post-demo) — high value for enterprise, simpler version without
manager approval can ship Phase B Day 4-5

---

## 3. Task Closure Workflow (companion to #1)

### Founder observation (13 May 2026)
> *"we need to put closures to the tasks created"*

### Problem
Activity log captures tasks created (calls, meetings, site visits) but
no formal closure mechanism. Tasks remain "open" indefinitely.

### Business value
- **Activity completeness:** Know which tasks happened vs missed
- **Broker accountability:** Show task completion rates
- **Forecast accuracy:** Open tasks = ongoing engagement signal

### Proposed solution
**Task lifecycle:**
- **Open** (created with future date)
- **Completed** (actual call/meeting happened, broker logs outcome)
- **No-show** (planned but didn't happen)
- **Cancelled** (planned but cancelled by either party)

Each closed task captures:
- Outcome (one of above)
- Outcome notes (e.g., "Call went well, client interested in 2BR")
- Next action (auto-suggest based on outcome)

### Effort
- Task status field + UI: 2 hr
- Closure dialog: 2 hr
- Outcome-based next-action suggestions: 3 hr
- Reports: open vs closed task ratios: 2 hr
- **Total: ~9 hr**

### Phase
**Phase B** (post-demo) — companion to negotiation outcome work,
ship together

---

## 4. PropPulse Intelligence Roadmap

### Founder observation (13 May 2026)
> *"make the PropPulse more intelligent as and when you keep getting
> more and more details about the units keep update, hopefully we will
> have less inventory without pricing. This also keeps any
> announcements, offers, attraction and more this depends on how
> intelligently we have the PropPulse a game changer"*

### Problem
PropPulse currently is static — generated when admin clicks button.
Doesn't auto-update as data changes. Doesn't surface new offers,
price changes, or status updates.

### Business value
- **Product differentiator:** Living intelligence vs static dashboard
- **Investor pitch:** *"PropPulse is our learning engine — every data
  improvement compounds into broker intelligence"*
- **Broker engagement:** Daily check for new opportunities
- **Data quality flywheel:** Better data → better PropPulse → more
  data motivation

### Proposed solution

**PropPulse v2: Living Intelligence Engine**

#### Trigger Events
PropPulse refreshes automatically when:
- Unit price added/changed
- New project announced
- Unit status changes (Available → Reserved → Sold)
- Developer announcement entered (offers, discounts, payment plans)
- Lead profile enriched (KYC complete, preferences updated)
- Master agreement signed (new commission terms)

#### Output Layers
1. **Personal Pulse** (per broker)
   - "Your client Mohammed Ali might like new unit AGR-08-04 (just priced)"
   - "Aldar announced 5% discount on Aldar Grove until 30 May"
   - "Your reserved unit SHI-06-02 has cleared - reservation timer reset"

2. **Company Pulse** (per company)
   - "Inventory health: 89% units priced (up from 78% last week)"
   - "Top performer this week: Rajesh - 3 closures"
   - "Market signal: 4BR demand up 23% this month"

3. **Market Pulse** (cross-company, anonymized)
   - "Median 2BR price in Dubai Marina trending up"
   - "Most active developer this month: Sobha (12 units sold)"

#### AI Match Intelligence
- Re-score leads when new units arrive
- Re-score leads when prices change
- Surface "Hot" leads (high match score + recent activity)
- Predict deal velocity per lead

### Effort
- v2 architecture: 8 hr (event-driven refresh, queue, scoring engine)
- Personal Pulse UI: 6 hr
- Company Pulse UI: 4 hr
- Market Pulse (later phase): 12 hr
- AI Match re-scoring: 8 hr
- **Total: ~38 hr** (significant feature)

### Phase
**Phase C** (post-funding) — investor pitch differentiator. Pre-funding
roadmap teaser only.

---

## 5. Data Integrity Gates

### Founder observation (13 May 2026)
> *"keep showing the dashboard report, AND filter if not priced so no
> picking any unit without pricing"*

### Problem
PropCRM allows creation of opportunities pointing to units that lack
critical data (no price, no KYC, no master agreement). This corrupts
downstream calculations (commission, PropPulse, reports).

### Business value
- **Data quality:** Cannot enter bad data at source
- **Operational efficiency:** Admins fix gaps before they impact workflow
- **Reliability:** Calculations always accurate

### Pattern (already partially implemented)
**Two-tier strategy:**
1. **Dashboard widget** (admin-facing): "X items need attention"
2. **Workflow-level filter** (broker-facing): Hide invalid items from pickers

### Application areas
- ✅ Unit pricing (implemented 13 May in UnitPickerRich)
- ⏳ Lead KYC (block opp creation if buyer not KYC complete)
- ⏳ Master Agreement (warn if developer has no agreement)
- ⏳ Bank/escrow setup (block Reserved without escrow account)
- ⏳ DLD details (block SPA Signed without DLD plan)

### Proposed solution
**Data_Integrity_Spec.md** (separate spec doc) defining:
- Each gate's trigger
- UX pattern (warn vs block)
- Admin dashboard widget per gate
- Phase B implementation order

### Effort
- Spec doc: 30 min
- Each gate implementation: ~2-3 hr
- Dashboard widgets: ~3 hr each
- **Total: ~15-20 hr** for full system

### Phase
**Phase B** (post-demo) — high value, ship gates incrementally Day 2-4

---

## 6. Code Architecture Cleanup

See `docs/Code_Cleanup_Plan.md` for the complete plan covering:
- Orphan file removal
- Picker unification (W6.2 → UnitPickerRich everywhere)
- Form consolidation (V1/V2 collapse)
- Module extraction (App.jsx from 14,932 → <5,000 lines)
- ARCHITECTURE.md authoring

**Phase B** — 5-day sprint planned for week of 19 May 2026

---

## 7. Browser Navigation (Back/Forward/Refresh)

### Founder observation (13 May 2026, during dry-run)
- Browser ← Back button doesn't navigate within app
- F5 / Refresh kicks user back to dashboard (loses state)
- Internal back buttons work fine

### Problem
App uses internal state for navigation but doesn't sync with URL.
Browser history not maintained. Refresh loses position.

### Business value
- **User trust:** Standard web behavior expected
- **Bookmarking:** Users want to bookmark specific opp/lead
- **Sharing links:** "Hey check this lead" with URL
- **Multi-tab workflow:** Open multiple opps in tabs

### Proposed solution
**React Router migration:**
- Install react-router-dom
- Define routes: `/dashboard`, `/leads`, `/leads/:id`, `/opportunities`, `/opp/:id`
- Replace state-based navigation with `<Link>` and `useNavigate`
- URL params sync to app state
- Refresh restores from URL

### Effort
- Router setup + routes: 2 hr
- Update all nav points: 3 hr
- Test all flows: 2 hr
- Edge cases (deep-links, modals, query params): 2 hr
- **Total: ~9 hr**

### Phase
**Phase B** (post-demo) — Day 4-5 work, not demo-critical

---

## 8. Tester Feedback Slot (Reserved for Thursday 14 May 2026)

This section will be populated when testers visit Thursday morning.
Expected feedback areas:
- UI/UX clarity
- Missing fields they want
- Workflow friction points
- Performance observations
- Real-world scenarios we missed

Each item logged with:
- Tester name (anonymized if needed)
- Date observed
- Severity (P1/P2/P3)
- Founder triage decision
- Target phase

---

## Conventions for adding items

When adding new items to this backlog:

1. **Number sequentially**
2. **Quote the source** (founder, tester, customer) verbatim where possible
3. **Capture business value** (not just technical solution)
4. **Estimate effort** (rough hours)
5. **Assign phase:**
   - **B** = Post-demo cleanup (week 19 May 2026)
   - **B'** = Backend audit (after Phase B if needed)
   - **C** = Post-funding feature
   - **D** = Scale phase (multi-tenant, performance)

---

*Last updated: 13 May 2026 (Wednesday afternoon, mid-session)*
*Items 1-7 captured during/after Tuesday-Wednesday build marathon*
*Item 8 placeholder for Thursday tester feedback*
