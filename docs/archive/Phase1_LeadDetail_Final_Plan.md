# Phase 1: LeadDetail Extraction — Final Plan

**Status:** READY TO EXTRACT (Audit complete)
**Date:** 16 June 2026
**Confidence:** HIGH (all dependencies mapped)

---

## GO/NO-GO Checklist

- ✅ Supabase: Import directly
- ✅ React hooks: Standard imports
- ✅ can(), canWithPS(): Already exported (Phase 0)
- ✅ Forms: All inline state (no extraction needed)
- ✅ Props: 17 received from App.jsx (manageable)
- ✅ Components: Pass as props (CreateOppDialog, LogActivityModal, etc.)

---

## Extraction Steps (Ready to Execute)

### Step 1: Create LeadDetail.jsx
- Copy Leads function (lines 2060-3034)
- Add imports: React hooks, supabase, can/canWithPS
- Add default export

### Step 2: Update App.jsx
- Import LeadDetail from "./components/sales/LeadDetail.jsx"
- Replace Leads function with LeadDetail component
- Wire tab render: `{tab==="leads" && <LeadDetail {...all 17 props} />}`

### Step 3: Test
- Login → Leads tab
- All 7 core flows work
- No console errors

### Step 4: Commit
- `Extract: Leads function to LeadDetail.jsx component`

---

## Why We're Ready

1. **Dependencies audited** — know exactly what LeadDetail needs
2. **Phase 0 complete** — permissions already exported
3. **No architectural surprises** — all forms are state, not components
4. **Props identified** — 17 concrete props to pass

**Risk Level: LOW**

---

## If Something Breaks

Revert: `git checkout HEAD~1`

Re-read audit doc, check imports.

---

*Audit locked: c63d5bd*
*Next: Execute extraction*
