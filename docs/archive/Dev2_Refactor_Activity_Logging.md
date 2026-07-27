# Dev2 Refactor — Activity Logging Consolidation

**Date captured:** 23 May 2026 (Saturday morning, Day 11)
**Status:** Demo-ready code shipped on main with accepted duplication. Dev2 will refactor.
**Founder concern:** *"we have duplicated code in App.jsx... we are not doing a normalised development at the moment"*
**Architect response:** Conscious trade-off, not negligence. Refactor in dev2 to avoid demo risk.

---

## Current State (after commit 91f46c2)

### Where duplication lives

```
src/App.jsx contains:

  Opp Detail logging (original):
    - State:        showLog, logForm, saveLog       (line ~4989)
    - Save handler: saveLog async function          (line ~5763)
    - Dialog JSX:   showLog && (... full form ...)  (line ~8060)
    - Wired into Opp Detail render

  Lead Detail logging (restored 23 May):
    - State:        showLeadLog, leadLogForm        (line ~11076)
    - Save handler: INLINE in dialog onClick        (line ~11595+)
    - Dialog JSX:   showLeadLog && (... full form ...) (line ~11550)
    - Wired into Lead Detail render
```

### Duplication metrics

- **~150 lines of redundant code** between the two implementations
- **2 state shapes** with same fields (type/note/scheduled_at/duration_mins/ns_*)
- **2 dialog JSX blocks** with same form (~80 lines each)
- **2 save handlers** with same logic (~40 lines each)

### Why accepted now (main branch reasoning)

1. **Demo proximity:** 13 days to investor demo, refactor near demo = bug risk
2. **Working software:** Both flows tested and demo-ready
3. **Phase 2 FAB redesign** will REPLACE this duplication anyway (single dialog component everywhere)
4. **Doing it twice** (refactor now + redesign for FAB) = wasted effort
5. **Founder approved** the ship-and-flag approach

### Cost of accepting

- Every future change to logging logic must touch BOTH places
- Bug fix in one won't appear in other (silent skew)
- Maintenance compounds if more contexts added (Inventory logging, Dashboard quick-action, etc.)

---

## Dev2 Refactor Target

### Goal

**Single `<LogActivityDialog>` component used everywhere. Single `saveActivity` function. Zero duplication.**

### Architecture

```
src/components/LogActivityDialog.jsx (NEW)

  Props:
    context: { lead?: Lead, opp?: Opp, currentStage?: string }
    open: boolean
    initialType: string
    onClose: () => void
    onSaved: (activity, reminder?) => void

  Renders:
    - Type chips (Call/WhatsApp/Email/Meeting/Visit/Note)
    - Date/Time + Duration (conditional on type)
    - Discussion notes
    - Schedule Next Step toggle + sub-fields
    - Cancel + Save buttons

  Internal logic:
    - Builds activity row with appropriate IDs:
        * Both lead & opp present: lead_id + opportunity_id + stage_at_event
        * Lead only: lead_id only
        * Opp only: opportunity_id + stage_at_event (lead derived from opp)
    - Reminder creation handles both related_lead_id and related_opportunity_id
    - Returns saved activity to caller via onSaved

src/lib/activityService.js (NEW)
  
  saveActivity({lead, opp, form, currentUser}) -> {activity, reminder?}
  
  - Single source of truth for activity logging
  - Single source of truth for reminder creation
  - Used by LogActivityDialog and any future entry point
```

### Migration plan in dev2

```
Day 1 morning:
  1. Create src/components/LogActivityDialog.jsx
  2. Create src/lib/activityService.js with saveActivity()
  3. Test in isolation

Day 1 afternoon:
  1. Replace Opp Detail's inline dialog with <LogActivityDialog context={{opp, currentStage: opp.stage}}/>
  2. Replace Lead Detail's inline dialog with <LogActivityDialog context={{lead}}/>
  3. Test both contexts thoroughly
  4. Remove the duplicate code

Day 2:
  1. Use same component for FAB (Phase 2 Activity Logging Everywhere)
  2. Add Inventory unit logging
  3. Add Dashboard quick-action
  4. Single component, multiple call sites
```

**Estimated effort: 1 day of focused work in dev2**

---

## Why Dev2 is the right home

### Not main (current)
- 13 days to demo
- Refactor risk near demo = catastrophic
- Working code shouldn't be touched
- Discipline: main = polish only after polish phase

### Dev2 is the right place
- Refactor without demo timing pressure
- Naturally combines with FAB redesign (Phase 2)
- Tested independently before considering merge
- If dev2 doesn't ship by demo, main still works

### Decision criteria for dev2 merge to main
- All tests pass on dev2
- Opp Detail logging unchanged from user perspective
- Lead Detail logging unchanged from user perspective
- FAB added on dev2 if scope allows
- Then merge dev2 → main (or use dev2 as new main)

---

## What this captures

✅ Architectural debt acknowledged  
✅ Reason for accepting in main explained  
✅ Solution path defined  
✅ Effort estimated (1 day)  
✅ Connects to Phase 2 FAB work  
✅ Decision criteria for merge documented  

**This is technical debt managed responsibly:** acknowledged, documented, scheduled.

---

## Founder Quote Preserved

> "we have duplicated code in App.jsx. which we need to manage, and we are not doing a normalised development at the moment. Please revert your thoughts on this"

**Architect's response (captured here):**
- Trade-off was conscious (speed + safety vs DRY)
- Refactor belongs in dev2, not main
- FAB redesign in Phase 2 naturally eliminates duplication
- One refactor effort, not two

---

## Cross-references

- `Phase_2_Activity_Logging_Everywhere.md` — FAB design intent (same component)
- `Phase_2_Backlog_Master_Doc.md` — Master Phase 2 tracker
- Commit `91f46c2` — The shipped restoration with accepted duplication

---

*Document created: 23 May 2026 (Saturday morning, Day 11)*
*Purpose: Capture architectural debt for dev2 attention*
*Status: Live document, will update when dev2 branch starts*
