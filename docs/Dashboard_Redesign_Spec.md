# Dashboard Card Grid Redesign — Opportunity Detail + Negotiations

**Captured:** 19 May 2026 (Tuesday afternoon)  
**Source:** Founder design insight during Tuesday session  
**Status:** P0 - Major refactor planned for Tuesday afternoon / Wednesday  
**Target sessions:** Tuesday afternoon (start) → Wednesday (continue if needed)

---

## 1. The Insight

**Founder verbatim:**

> "very simply bringing up the Proposals Card Up in the order and all other cards 
> have buttons to go and open the new cards instead of going one below the other"
>
> "I dont see the need of property card as it is already showing the same details on top"
>
> "when the proposals sections comes up and visible you have all the proposal listed 
> and we can make smaller each proposal as excel format and keep a edit at the right 
> on the last proposal click that the proposal form opens with and edit and when save 
> it saves as a revision and adjusts the excel type form"

**Translation:** Replace long-scroll layout with dashboard-card grid + progressive disclosure.

---

## 2. Why This Solves Multiple Problems Through Design

### Bugs that disappear automatically
- **Issue D1 (Proposal Builder doesn't pre-fill)** — When the proposal LIST shows latest version inline (Excel-style row), broker SEES the discount before clicking edit. Forgetting impossible.
- **Issue C (Financials hidden)** — Financials becomes a clickable card. Less clutter when not needed.
- **Information overload** — Same data, less scroll, more space.

### Bugs that get easier to fix
- **Edit context** — Editing last proposal as revision becomes natural UX, not separate flow.
- **Proposal comparison** — Excel-style rows let broker spot deltas (V2 changed discount from V1).

---

## 3. Current Layout (Problem)

```
┌─────────────────────────────────────────────────────────┐
│ HEADER: Lead/Unit/Stage                                 │ ← Stays
│ Deal Journey (9 stages)                                 │ ← Stays
│ Log Activity buttons + Move Stage buttons               │ ← Stays
├─────────────────────────────────────────────────────────┤
│ 🤖 PropPulse Coach (big card, takes ~150px)            │ ← Move to grid
├─────────────────────────────────────────────────────────┤
│ ⏰ Next Steps (big card, takes ~300px with reminders)  │ ← Move to grid
├─────────────────────────────────────────────────────────┤
│ 📤 Proposals (big card with proposal details)           │ ← MOVE UP + redesign
├─────────────────────────────────────────────────────────┤
│ 🤝 Negotiation Rounds (varies)                          │ ← Move to grid
├─────────────────────────────────────────────────────────┤
│ Activity Log (timeline, big)                            │ ← Stays (timeline)
├─────────────────────────────────────────────────────────┤
│ Property card                                            │ ← REMOVE (duplicate)
│ Financials card                                          │ ← Move to grid
│ 🏗️ Off-Plan Payment Plan card                          │ ← Move to grid
│ Client Upfront Costs card                                │ ← Move to grid
└─────────────────────────────────────────────────────────┘

Result: 3-4 screens of scroll. Context lost. Bugs hide in scroll.
```

---

## 4. Proposed Layout (Solution)

```
┌─────────────────────────────────────────────────────────┐
│ HEADER (Lead/Unit/Stage)                                │
│ Deal Journey                                             │
│ Log Activity buttons + Move Stage buttons               │
├─────────────────────────────────────────────────────────┤
│ DASHBOARD CARD GRID (2-3 cards per row, responsive)     │
│ ┌──────────────┐┌──────────────┐┌──────────────┐       │
│ │📤 Proposals  ││🤖 PropPulse  ││⏰ Next Steps │       │
│ │  (2)         ││  Coach       ││  (4)         │       │
│ │  Latest:     ││  Click to    ││  3 today     │       │
│ │  -2%         ││  analyze     ││  1 overdue   │       │
│ │  AED 2.4M    ││              ││              │       │
│ │  ▶ Open      ││  ▶ Analyze   ││  ▶ Open      │       │
│ └──────────────┘└──────────────┘└──────────────┘       │
│ ┌──────────────┐┌──────────────┐┌──────────────┐       │
│ │💰 Financials ││🤝 Negotiation││📊 Upfront    │       │
│ │  Final:2.4M  ││  Rounds (3)  ││  AED 395K    │       │
│ │  Disc: 2%    ││  Latest: V2  ││  Booking:24K │       │
│ │  ▶ Open      ││  ▶ Open      ││  ▶ Open      │       │
│ └──────────────┘└──────────────┘└──────────────┘       │
│ ┌──────────────┐                                        │
│ │🏗️ Payment    │                                        │
│ │  Plan: 20/80 │                                        │
│ │  ▶ Open      │                                        │
│ └──────────────┘                                        │
├─────────────────────────────────────────────────────────┤
│ Activity Log (timeline below the grid)                  │
└─────────────────────────────────────────────────────────┘

Result: Everything visible at-a-glance. Click for detail. No scroll for context.
```

---

## 5. Card Click Behavior — Progressive Disclosure

### Pattern: Click card → opens detail panel/modal

**Two implementation options:**

### Option A — Inline expand (card grows in place)
- Click card → it expands to full content
- Other cards stay visible (slightly dimmed)
- Click again or X to collapse
- **Pros:** Context preserved, less jarring
- **Cons:** Cards rearrange on expand

### Option B — Modal popup (card stays compact, opens full overlay)
- Click card → modal opens with full content
- X to close → back to grid
- **Pros:** Clean grid stays intact, focused view
- **Cons:** Modal feels heavier

**Architect's call: Option A (inline expand)** — feels more dashboard-like, less interruptive.

---

## 6. Special Card: Proposals (the genius part)

### Compact card view
```
┌────────────────────────────┐
│ 📤 Proposals (2)            │
│                             │
│ V2 | -2% | AED 2,395,224 ✏│ ← Edit button (latest only)
│ V1 | -2% | AED 2,395,224   │
│                             │
│ + Send revised              │
│ ▶ Expand                    │
└────────────────────────────┘
```

### Expanded view (click ▶ Expand)
```
┌─────────────────────────────────────────────────────────┐
│ 📤 PROPOSALS - Excel-style table                        │
│                                                          │
│ V# | Sent  | Disc | Net Price  | Plan  | DLD     | ⚙️   │
│ V2 | 19May | -2%  | 2,395,224  | 20/80 | Buyer   | ✏️   │ ← Edit
│ V1 | 19May | -2%  | 2,395,224  | 20/80 | Buyer   |     │
│                                                          │
│ Click ✏️ → opens proposal builder PRE-FILLED with V2    │
│ Save = creates V3 (auto-version)                        │
│                                                          │
│ + Send revised proposal (always shows current latest)   │
└─────────────────────────────────────────────────────────┘
```

**Why this kills Issue D1 (pre-fill bug):**
- Broker sees V2's discount = 2% IN THE TABLE
- Can't forget
- Edit button = opens form pre-filled (because we know which version)
- No more "0% by mistake"

---

## 7. Negotiations Card (same pattern)

### Compact card view
```
┌────────────────────────────┐
│ 🤝 Negotiation Rounds (3)   │
│                             │
│ R3 | Buyer  | Open    | ✏️ │
│ R2 | Broker | Done    |    │
│ R1 | Buyer  | Done    |    │
│                             │
│ + Log Round                 │
│ ▶ Expand                    │
└────────────────────────────┘
```

### Expanded view
```
┌─────────────────────────────────────────────────────────┐
│ 🤝 NEGOTIATION ROUNDS - Excel-style                     │
│                                                          │
│ R# | Date  | Party  | Topic        | Status | Note  | ⚙ │
│ R3 | 19May | Buyer  | Discount req | Open   | "..." | ✏│
│ R2 | 18May | Broker | Counter offer| Done   | "..." |  │
│ R1 | 17May | Buyer  | First ask    | Done   | "..." |  │
│                                                          │
│ Reference: Latest proposal (V2): -2%, 20/80, Buyer DLD │ ← Context
│                                                          │
│ + Log Round (opens form pre-filled with latest context) │
└─────────────────────────────────────────────────────────┘
```

**Why this kills Issue D2 (Negotiation form lacks context):**
- Reference line at bottom shows latest proposal info
- New round dialog can pre-populate with proposal context
- Editable last round only (same pattern as proposals)

---

## 8. Property Card Decision

### Decision: REMOVE
Founder verbatim: *"I dont see the need of property card as it is already showing the same details on top"*

**Current property card duplicates:**
- Unit reference (already in header)
- Bedrooms/baths (header has it)
- Sqft (header has it)
- View (header has it)
- Status (header)

**Move ONLY missing details (if any) to header or Financials card.**

---

## 9. Financials Card Restructuring

### Current
```
Asking Price: AED 2,444,106
Final Price:  AED 2,395,224
Discount:     2% (proposal_v2)
DLD Arrangement: Buyer pays
Payment Plan: 20/80
Commission %: 4.00%
```

### Proposed (in card)
Compact view:
```
💰 Financials
Final: AED 2,395,224
Disc:  -2%
▶ Open
```

Expanded view (click):
```
💰 FINANCIALS
Budget:        AED 850,000
Asking:        AED 2,444,106
Final Agreed:  AED 2,395,224
Discount:      2% (from proposal_v2)
DLD:           Buyer pays (4% = AED 95,809)
Payment Plan:  20/80
Initial Adv:   AED 479,045 (20%)
Commission:    4.00% (AED 95,809)
```

---

## 10. PropPulse Coach Card

### Current
Big card at top, takes lots of space, broker may not interact with it.

### Proposed
```
🤖 PropPulse Coach
Based on: 5 act · 2 prop · 4 reminders
▶ Analyze this deal
```
Compact. Click to analyze. Result shows in expanded panel.

---

## 11. Next Steps Card

### Current
Big block listing all pending reminders.

### Proposed
```
⏰ Next Steps (4)
🟡 2 due today
🟢 2 future
▶ Open
```

Click to see full list with done/snooze/edit actions.

---

## 12. Off-Plan Payment Plan + Client Upfront Costs

### Current
Two separate cards at bottom showing static unit-level info.

### Proposed
Merge into one card:
```
📊 Upfront Costs (AED 395,077)
Booking 10%
Plan: 20/80 agreed
▶ Open
```

Expanded view shows:
- Off-plan structure (10% / 40% / 50%)
- Agreed plan (20/80)
- Calculated upfront amounts

---

## 13. Implementation Plan

### Phase 1 — Wireframe + Approval (1 hour, may happen Tue afternoon)
- Create HTML mockup of new layout
- Founder reviews wireframe
- Confirm design before code

### Phase 2 — Card Component (1-2 hours, Tue/Wed)
- Build reusable `DashboardCard` component
- Props: title, compactBody, expandedBody, badgeCount
- Click toggles expanded state
- Maintains state per card (Map of expanded IDs)

### Phase 3 — Migrate Existing Sections (3-4 hours, Wed)
- Replace Proposals section → use Card with Excel-table inside
- Replace PropPulse → Card
- Replace Next Steps → Card
- Replace Financials → Card
- Replace Off-Plan + Upfront → merged Card
- Replace Negotiations → Card with Excel-table

### Phase 4 — Remove Property Card (15 min, Wed)
- Verify no info loss
- Move any missing details to header or Financials

### Phase 5 — Edit Last Item Flow (1 hour, Wed)
- Proposals: ✏️ icon on latest → opens builder pre-filled
- Negotiation Rounds: ✏️ icon on latest → opens round dialog pre-filled
- Save creates new version

### Phase 6 — Mobile Responsive (1 hour, Wed)
- Grid stacks to 1 column on phone
- Touch-friendly expand/collapse
- Verify on real device

### Phase 7 — Testing (1-2 hours, Wed/Thu)
- Each card opens/closes properly
- Edit flows work
- Data consistency across cards
- No regression from today's work

**Total estimated effort: 8-12 hours across 2 days.**

---

## 14. Risk Assessment

### What could break
- Existing onClick handlers in proposal section
- Existing state management for round dialogs
- Mobile layout if grid not responsive
- Edit flows if version handling missed

### Mitigation
- Safety tag before starting (`pre-dashboard-redesign`)
- Incremental commits (one card at a time)
- Test each card before moving to next
- Keep existing dialogs (they still work, just open differently)

---

## 15. Why This Is Worth the Refactor

### Multiple bugs become non-issues
- D1 (Proposal pre-fill) → solved by visible Excel-row
- D2 (Negotiation context) → solved by reference line
- C (Financials visibility) → solved by promoting card
- A (Quoted click confusing) → no longer relevant (Quoted in grid)
- B (Quoted as stage) → can address separately later

### UX improvements
- 3-4 screens of scroll → 1 screen with progressive disclosure
- Information at-a-glance → broker scans, doesn't search
- Mental model matches dashboards (industry standard)
- Investor demo wow factor

### Code maintenance
- Each card = isolated component
- Easier to maintain/test individual sections
- Pattern reusable in other parts of app (lead detail, project detail)

---

## 16. Acceptance Criteria

When complete:
- [ ] Opp detail fits in viewport without scroll for primary info
- [ ] All cards click to expand, click again to collapse
- [ ] Proposals card shows Excel-style version list
- [ ] Latest proposal has edit button → opens builder pre-filled
- [ ] Save in revised proposal creates new version
- [ ] Negotiations card shows Excel-style round list
- [ ] Latest round has edit button (if applicable)
- [ ] Property card removed (no info loss)
- [ ] Financials shows all current_* data (compact + expanded)
- [ ] Mobile responsive (works on iPhone width)
- [ ] No regression in any today/yesterday's commits

---

## 17. Same Pattern for Lead Detail Eventually

If this pattern proves itself on opp detail:
- Apply same card grid to lead detail
- Activities, opportunities, notes as cards
- Consistent UX across the app

---

*Document created: 19 May 2026 (Tuesday afternoon, before break)*  
*Founder design insight: "visibility > development"*  
*Multiple bugs solve through better layout, not more code*  
*Status: Architect's spec complete, ready for build phase*
