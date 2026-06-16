# Phase 1: LeadDetail Extraction — Dependency Audit

**Date:** 16 June 2026 (Day 39)
**Status:** PRE-EXTRACTION ANALYSIS
**Goal:** Document ALL dependencies before extraction attempt

---

## Leads Function Signature (Line 2060)

**Props it receives from App.jsx:**
```javascript
function Leads({
  leads, setLeads,                          // Lead data + setter
  opps: globalOppsFromParent = [],         // Opp data (aliased)
  setOpps: setGlobalOpps = () => {},       // Opp setter (aliased)
  properties,                               // Properties list
  activities, setActivities,                // Activities + setter
  discounts, setDiscounts,                  // Discounts + setter
  currentUser,                              // Auth context
  users,                                    // Team users list
  showToast,                                // Toast handler (function)
  initialFilter = null,                     // Navigation state
  onNavigateToOpp = null,                   // Callback to parent
  refCountries = [],                        // Reference data
  refRules = {}                             // Reference data
})
```

**Total props: 17**

---

## Dependencies Found in Code (First 30 lines)

### 1. **Imported Utilities** (Must export from App.jsx)
- `can(role, action)` — Line 2088 ✅ ALREADY EXPORTED (Phase 0)
- `useState` — React hook
- `useEffect` — React hook
- `useCallback` — React hook

### 2. **Props Received** (17 total)
- ✅ All are passed from App.jsx
- ✅ LeadDetail receives them, no extraction needed

### 3. **Component References** (Likely inline)
- `CreateOpportunityDialog` — used in function
- `LeadCreationFormV2` — likely used
- `LogActivityModal` — for activity logging
- Search for these in Leads code

---

## Next Steps (BEFORE Extraction)

1. **Full dependency scan:** Search Leads function for ALL undefined references
2. **Identify what can't leave App.jsx:** Components, dialogs, handlers
3. **Identify what CAN be extracted:** Pure state, calculations, UI rendering
4. **Create wrapper props list:** What LeadDetail needs from parent

---

## Risk Assessment

**High Risk:**
- 975 lines of code (large extraction)
- Deeply coupled to parent state
- 17 props is manageable but suggests tight binding

**Mitigation:**
- Extract in safe commits
- Test each step
- Keep all props as-is (no refactoring)
- Defer any prop consolidation to Phase 2

---

*Prepared: Day 39 morning*
*Next: Full code scan for undeclared identifiers*
