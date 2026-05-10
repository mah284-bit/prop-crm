# Stage 7 Spec — Doomed Opportunity Workflow with Buyer Consent

**Status:** Spec captured 10 May 2026. Build target: post-investor-demo.
**Founder spec:** Abid Mirza, BFC

---

## The Problem

When a unit is taken by another deal (going Reserved/SPA Signed/Closed Won), all OTHER opportunities pointing to that unit_id become "doomed" — they cannot complete the original buyer's intent.

**Current state (10 May 2026):**
- Issue D Phase 1+2 shipped: backend guard blocks stage advances + warning banner shows on opp detail
- Banner says "Pick a different unit" but the "Change Unit" button is just a placeholder

**Gap:** No proper workflow for handling these doomed opps.

---

## Founder's Design Principle

> *"Take the buyer's consent and move forward, right?"*

**Core ethical principle:** Broker must NEVER silently change a unit on a buyer's deal. Real-world workflow:

1. Broker calls buyer: "EBT-05-01 was taken, are you OK with similar unit X?"
2. Buyer agrees / disagrees / wants different unit / walks away
3. THEN broker updates the system based on buyer response

Skipping the conversation = broker fraud risk + customer trust violation + audit trail gap.

---

## Proposed Workflow

### Phase 1 — Trigger
Broker clicks "Discuss with Buyer" button on the unit-conflict banner.

### Phase 2 — Log Conversation Dialog

```
📞 Discuss Unit Change with Buyer

Buyer: Faisal Al Blooshi (+97150123456789)
Original Unit: DAM-07-03 (DAMAC Hills Lagoon)
Reason for change: Unit taken by "Inquiry from Rajesh Haridas" (Closed Won, 1 day ago)

What did the buyer say?

  ○ Buyer agreed to alternative unit
  ○ Buyer wants to wait for similar unit  
  ○ Buyer walked away (mark this deal Lost)
  ○ Other (notes required)

Conversation Notes: [textarea]
Date of Conversation: [date picker, default today, max=today]
Method: [Phone / WhatsApp / Email / In-person]

[Cancel]  [Save & Continue]
```

### Phase 3 — Branch By Response

#### Branch A: "Agreed to alternative unit"
1. Save conversation as activity log entry (type: "Note", note: conversation text)
2. Open SMART unit picker filtered by:
   - Same project as original unit OR similar projects
   - Same bedroom count
   - Similar price range (±20% of original asking)
   - Currently Available status
   - NOT taken by other opps
3. Broker selects new unit → updates `opportunities.unit_id`
4. Banner disappears (no more conflict)
5. Toast: "Unit updated. Original conversation logged."

#### Branch B: "Wants to wait"
1. Save conversation as activity log entry
2. Set follow-up reminder (default 14 days from today, configurable)
3. Opp stays at current stage
4. Banner still shows (reminder for broker)
5. Toast: "Reminder set for [date]. Banner will remain visible."

#### Branch C: "Walked away"
1. Save conversation as activity log entry
2. Confirm dialog: "Mark this deal as Lost?"
3. If confirmed: 
   - `opp.stage = 'Closed Lost'`
   - `opp.lost_reason = 'unit_taken'`
   - `opp.lost_at = now()`
4. Banner disappears (opp is now closed)
5. Toast: "Deal marked Lost: Unit taken before buyer commitment."

#### Branch D: "Other"
1. Save conversation as activity log entry (notes required)
2. Opp stays at current stage
3. Banner still shows
4. Toast: "Note logged. Take action when buyer decides."

---

## Schema Changes Needed

### Activity log
- Existing `activities` table can hold these conversation entries
- Type: "Note", with structured note format (or new type "Unit Change Discussion")

### Opportunities  
- `lost_reason` field already exists ✅
- New enum value: `'unit_taken'` for the lost reason taxonomy

### Master Agreements (Phase 3 future)
- New column: `reservation_expiry_days INT DEFAULT 14`
- Used by auto-release logic (not part of Stage 7 directly)

---

## Smart Alternative-Unit Picker Logic

When Branch A selected, filter units by:

```sql
SELECT * FROM project_units
WHERE status = 'Available'
  AND id != [original unit_id]
  AND id NOT IN (
    SELECT unit_id FROM opportunities 
    WHERE stage IN ('Reserved','SPA Signed','Closed Won')
    AND unit_id IS NOT NULL
  )
  AND (
    project_id = [original.project_id]    -- prefer same project
    OR price_range overlaps [original ±20%]
    OR bedrooms = [original.bedrooms]
  )
ORDER BY 
  (project_id = [original.project_id]) DESC,
  ABS(price - [original.price]) ASC
LIMIT 20;
```

Show as cards: project, unit_ref, price, bedrooms, view, status badge.

---

## Tie-in to AI Daily Briefing (Stage 7+ companion feature)

The conversation log entries from this workflow feed the AI Daily Briefing:

> *"Yesterday Faisal Al Blooshi agreed to alternative units. You haven't proposed any yet. Suggested action: send him 3 alternatives in Damac Hills (matching his original DAM-07-03 specs)."*

The buyer-consent log becomes training data + action triggers for the AI agent.

---

## UI Spec — Banner Update

**Today (placeholder):**
```
[Discuss with Buyer]  ← shows toast guiding broker to call buyer
```

**Future (Stage 7):**
```
[📞 Discuss with Buyer]  ← opens the consent dialog
```

The banner remains visible during the discussion phase. Disappears only when:
- Unit is changed (Branch A success)
- Opp is marked Lost (Branch C)

---

## Effort Estimate

| Component | Effort |
|---|---|
| Consent dialog UI | ~45 min |
| Branch A: Alternative unit picker | ~1.5 hours |
| Branch B/C/D: action logic | ~30 min |
| Activity log integration | ~30 min |
| Testing all branches | ~30 min |
| **Total** | **~3-4 hours focused work** |

---

## Build Order (when ready)

1. Consent dialog with branch radios (foundation)
2. Activity log writes for all 4 branches
3. Branch A: smart alternative picker
4. Branch C: Lost-with-reason flow
5. Branch B/D: simpler save+stay logic
6. Test all 4 branches with real data
7. Tie into AI Daily Briefing prompts (later)

---

## Linked Issues

- **Issue D Phase 3** — Auto-release with per-master-agreement timeout (related but separate work)
- **AI Daily Briefing** — Future major feature that consumes this workflow's output
- **Discount approvals** (Stage 3) — separate workflow but similar consent pattern

---

*— Spec captured 10 May 2026 by Claude during Issue D Phase 1+2 implementation, based on founder feedback on broken "Change Unit" button. Build target: post-investor-demo (after Thursday 14 May 2026).*
