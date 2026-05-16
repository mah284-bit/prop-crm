# Opportunity Form Consolidation Plan
**Single Source of Truth for Opportunity Creation**

**Created:** 16 May 2026 (Saturday afternoon)
**Status:** Plan ready for execution (Sunday or Monday)
**Estimated effort:** 1-1.5 hours
**Priority:** P1 (UX consistency)

---

## 1. The Problem

PropCRM has TWO opportunity creation forms:

### Form A — CreateOpportunityDialog (canonical, rich)
- **Location:** `src/App.jsx` line 8406
- **Trigger:** Opportunities tab → "+ New Opportunity" button
- **Flow:** Multi-step wizard (Step 1: find/create lead → Step 2: opp details)
- **Unit picker:** Inline with rich filters + price (fixed 16 May 2026)
- **Features:** Lead conflict detection, AI context, comprehensive

### Form B — showAddOpp form (legacy, simple)
- **Location:** `src/App.jsx` line 10362-10460ish
- **Trigger:** Leads tab → Lead detail → "+ Add First Opportunity" or "+ New Opportunity"
- **Flow:** Single-step form
- **Unit picker:** UnitPickerRich component (from src/components/UnitPickerRich.jsx)
- **Features:** Basic fields only

### Why this is a problem
1. **Two UIs to maintain** — risk of drift over time
2. **Inconsistent UX** — broker feels app is incomplete
3. **Two unit pickers** — Form A inline (price added), Form B component (no price)
4. **Tester confusion** — "Why does it look different here?"

---

## 2. The Solution

**Consolidate to Form A (CreateOpportunityDialog).**

When user is in Leads tab with a lead selected, opening "+ New Opportunity" 
should:
1. Open CreateOpportunityDialog
2. Pass the current lead as pre-selected
3. Skip Step 1 (lead is already known)
4. Show Step 2 (opp details) directly

---

## 3. Implementation Steps

### Step 1: Modify CreateOpportunityDialog signature
Add `prefilledLead` prop:

```javascript
function CreateOpportunityDialog({ 
  leads, setLeads, units, projects, salePricing, users, 
  currentUser, showToast, onClose, onCreated,
  prefilledLead = null   // NEW
}) {
  const [step, setStep] = useState(prefilledLead ? 2 : 1);
  const [selectedLead, setSelectedLead] = useState(prefilledLead);
  // rest of component logic stays
}
```

### Step 2: Add state for triggering from Leads tab
In the Leads component (around line 9773 area):

```javascript
const [showCreateOpp, setShowCreateOpp] = useState(false);
const [oppLead, setOppLead] = useState(null);
```

### Step 3: Modify the two buttons to use new dialog
Find buttons at lines 10146 and 10211:

```javascript
// BEFORE:
{canEdit && <button onClick={() => {
  setOppForm({title:"",unit_id:"",budget:"",...});
  setShowAddOpp(true);  // ← opens local form
}}>+ Add First Opportunity</button>}

// AFTER:
{canEdit && <button onClick={() => {
  setOppLead(selLead);          // pass current lead
  setShowCreateOpp(true);       // open canonical dialog
}}>+ Add First Opportunity</button>}
```

### Step 4: Render CreateOpportunityDialog from Leads component
At end of Leads function:

```javascript
{showCreateOpp && (
  <CreateOpportunityDialog
    leads={leads}
    setLeads={setLeads}
    units={units}
    projects={projects}
    salePricing={salePricing}
    users={users}
    currentUser={currentUser}
    showToast={showToast}
    prefilledLead={oppLead}   // pre-fill lead
    onClose={() => setShowCreateOpp(false)}
    onCreated={(newOpp, newLead) => {
      if (setOpps) setOpps(prev => [newOpp, ...prev]);
      setShowCreateOpp(false);
      setOppLead(null);
      // Stay on lead detail (or navigate to opp - founder choice)
    }}
  />
)}
```

### Step 5: Remove old showAddOpp form (lines 10362-10460ish)
- Comment out for safety on first commit
- Delete in follow-up commit after verifying nothing depends on it
- Remove related state: `showAddOpp`, `setShowAddOpp`

---

## 4. Things to Watch For

### CreateOpportunityDialog's Step 2 needs to handle prefilledLead
Currently Step 2 references `selectedLead`. With prefilledLead, ensure:
- Lead context flows through correctly
- "for {lead.name}" header still works
- Save uses correct lead.id

### Save behavior may differ
- Form B (legacy): Saves opp and stays on lead detail screen
- Form A (canonical): Saves opp and navigates to opp detail

**Decision needed:** When triggered from Leads tab, where should user go after save?
- A) Stay on lead detail (show new opp in list) → match old behavior
- B) Navigate to opp detail → match Form A behavior
- C) Make it a callback option

**Recommendation:** Option A. Broker is in "lead mode" - keep them there.

### Step 1 skip logic
When prefilledLead is provided:
- Don't show Step 1 UI at all
- Header shows "for [LEAD NAME]" directly
- Cancel button still works
- Back to Step 1 NOT shown (no Step 1 happened)

### Edge case: leads array might not contain prefilledLead
If lead was just created and not yet in `leads` prop:
- Fail-open: use prefilledLead directly
- Don't crash if leads.find(id) returns undefined

---

## 5. Test Checklist

After implementation:
1. ✅ Opportunities tab → "+ New Opportunity" → Works as before (Step 1 → Step 2)
2. ✅ Leads tab → click lead → "+ New Opportunity" → Opens dialog at Step 2
3. ✅ Leads tab → click lead → "+ Add First Opportunity" → Opens dialog at Step 2
4. ✅ Lead name shows correctly in Step 2 header
5. ✅ Unit picker shows price (already fixed)
6. ✅ Save creates opp linked to correct lead
7. ✅ After save, broker stays on lead detail
8. ✅ Cancel from Step 2 (with prefilledLead) closes cleanly
9. ✅ Old showAddOpp form is gone (or commented out)
10. ✅ No console errors

---

## 6. Rollback Plan

If consolidation breaks:
```bash
git reset --hard pre-saturday-work-16-may-2026
```

---

## 7. Why This Approach Is Right

### Aligns with morning's strategic clarity
> "PropCRM is broker's source of action. One UI for one task."

### Aligns with Phase B vision
> "Final-Proposal-First architecture = single source of truth."

This consolidation is the same principle applied to UI.

### Investor narrative gain
> "PropCRM has one form per task. No duplicate UIs. No drift. Consistent UX 
> across the application. This is what engineering discipline looks like."

---

## 8. Estimated Time

| Phase | Time |
|---|---|
| Read code + understand current state | 10 min |
| Modify CreateOpportunityDialog signature + Step 1 skip | 20 min |
| Add state + render to Leads component | 15 min |
| Update both buttons | 10 min |
| Test scenarios | 20 min |
| Comment out old form | 5 min |
| Commit + tag | 5 min |
| Buffer | 15 min |
| **Total** | **~1.5 hours** |

---

## 9. When to Execute

### Best windows
- **Sunday morning (fresh brain)** — 1.5 hr, low-distraction
- **Monday morning (start of work week)** — natural slot

### Avoid
- Late evening (tired brain + medium complexity)
- During investor demo prep (focus elsewhere)

---

## 10. Status

**Plan:** ✅ Locked
**Effort:** ~1.5 hours
**Risk:** LOW (well-understood components)
**Dependency:** None
**Blocking:** Nothing
**Aligned with:** July 1 launch + Phase B vision

---

*Document created: 16 May 2026 (Saturday afternoon)*  
*Purpose: Plan ready for execution Sunday/Monday*  
*Founder insight: "Why don't we redirect to the same New Rich Opportunity Form"*  
*Status: APPROVED, awaiting fresh-brain execution*
