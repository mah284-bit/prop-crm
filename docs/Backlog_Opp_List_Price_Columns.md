# Backlog: Add Price Columns to Opportunities List View

**Captured:** 18 May 2026 (Monday afternoon)  
**Source:** Founder request during testing  
**Priority:** P2 - UX improvement, broker workflow value  
**Target:** Wednesday session (or next code window)  
**Estimated effort:** 30 min - 2 hours (depends on layout choices)

---

## 1. The Request

**Founder verbatim:**

> "One quick small request to put the price column on the Opportunity Form 
> next to budget in your next update and if the Final agreed price so makes 
> a full view."

---

## 2. What It Means

The Opportunities **LIST view** (table showing all opps) currently shows ONE financial value per row. Founder wants THREE values visible side-by-side:

### Currently shows
```
Rajesh Haridas
SHI-05-01 · Sobha Hartland II
Closed Won
AED 45,000          ← Just one value (budget)
3d ago
```

### Should show
```
Rajesh Haridas
SHI-05-01 · Sobha Hartland II
Closed Won
Budget: AED 45,000   Price: AED 623,694   Final: AED 604,983
3d ago
```

---

## 3. Three Financial Columns to Display

| Column | Source | What it shows |
|---|---|---|
| **Budget** | `opp.budget` | What the buyer can afford (their ceiling) |
| **Price** | Unit's `asking_price` from `salePricing` | The unit's list price (what developer is asking) |
| **Final** | `opp.current_agreed_price` | The negotiated final price (after discount) |

---

## 4. Why This Matters for Broker Workflow

Multi-column view enables at-a-glance:

1. **Spot stretch deals** - Budget << Price = aggressive negotiation needed
2. **Track wins** - Final << Price = broker negotiated discount
3. **Verify budget alignment** - Final near Budget = on target
4. **Quick disqualification** - Budget too far from Price = wrong fit

---

## 5. Design Considerations

### Layout
- 3 columns side-by-side might be tight on mobile
- Consider: smaller fonts, abbreviated labels, or responsive stacking
- Maintain visual hierarchy: Final Price most prominent (it's the truth)

### Visual treatment
- **Budget** - Gray/subtle (buyer's wish)
- **Price** - Standard (developer's ask)
- **Final** - Bold/blue (the actual deal)

### Edge cases
- Final = NULL (deal still negotiating) → show "—" or fade
- Budget = NULL (not captured) → omit or show "—"
- Price = NULL (no unit linked) → omit or show "—"

### Stage-aware display (optional polish)
- Early stages (New/Contacted/Site Visit): Show Budget + Price (no Final yet)
- Quoted onwards: Show all 3
- Closed Won: Final dominates, others subtle

---

## 6. Implementation Plan

### Phase 1 — Investigation (10 min)
- Find the Opportunities list rendering code
- Identify where budget column currently renders
- Check if salePricing is in scope
- Verify current_agreed_price availability

### Phase 2 — Layout decision (10 min)
- Decide: inline 3 columns OR stacked OR responsive
- Pick visual treatment (colors, weights)

### Phase 3 — Implement (15-30 min)
- Surgical edit to add 2 new fields next to budget
- Add fallback handling (NULL values)
- Test on real opps

### Phase 4 — Test + Commit (15 min)
- Verify on Rajesh's opps (full data)
- Verify on partial data opps
- Commit + push

---

## 7. Risks / Considerations

### Layout risk
Opportunities list is already info-dense. Adding 2 columns might cause:
- Text wrapping issues
- Mobile responsive problems
- Visual clutter

**Mitigation:** Start with simple inline approach, iterate based on real screen testing.

### Data risk
Some opps don't have all 3 values. Need graceful fallbacks.

### Same fix elsewhere?
If Leads tab also shows opps for a lead, similar treatment might apply.

---

## 8. Acceptance Criteria

When complete:
- [ ] Opportunities list shows Budget + Price + Final on each row
- [ ] NULL values gracefully handled
- [ ] Visual hierarchy clear (Final most prominent)
- [ ] Mobile responsive (no horizontal scroll)
- [ ] Tested on real opps with various data states

---

## 9. When to Execute

### Earliest window
**Wednesday morning** (founder back from Mon-Tue commitments)

### Quick win or proper UX?
Depends on broker feedback - is "side-by-side" the right answer or should they hover/expand for details?

### Could be combined with
- Founder's questionnaire answers (Wednesday)
- Other small UX improvements
- Pre-tester polish

---

*Document created: 18 May 2026 (Monday afternoon)*  
*Captured during SPA refactor testing session*  
*Status: Backlog - awaiting Wednesday execution*  
*Aligns with: Broker workflow visibility improvements*
