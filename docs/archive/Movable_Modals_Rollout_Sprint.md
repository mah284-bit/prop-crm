# Movable Modals — App-Wide Rollout Sprint

**Captured:** 1 June 2026 (Day 23). **Status:** Foundation built; rollout pending.
**Founder ask:** "make all the popup forms around the app moveable as 1 subject."

## What's DONE (foundation — build once)
- **`src/lib/useDraggable.js`** — reusable drag hook. Extracted from proven
  PropertyPackModal logic. Returns `{ ref, posStyle, handleProps, resetPos }`.
  - `ref` -> put on the panel div
  - `posStyle` -> spread into the panel's style (gives position:absolute + top/left once dragged)
  - `handleProps` -> spread onto the header (drag handle); ignores clicks on buttons
  - viewport-clamped; mouse + touch; resets to default on open
- **PropertyPackModal** — draggable, NO backdrop (work-beside-proposal use case). ✅ live
- **Shared `<Modal>` (App.jsx ~line 367)** — draggable, light backdrop.
  Covers the 4 Inventory form modals (Add/Edit Project, Category, Building, Unit). ✅

## What's PENDING (the rollout — mechanical, ~12-16 inline modals)
These are hand-rolled inline in App.jsx (each own backdrop+panel+header). Apply the
hook to each: import is already there; for each modal (a) add `const {ref,posStyle,handleProps}=useDraggable({open:true})`
near its render, (b) add `ref` + `...posStyle` to the panel div, (c) spread `handleProps`
onto its header row. Test each before moving on. Do in small batches with a build between.

### Inline modal inventory (App.jsx line numbers, Day 23)
| Line | Likely modal | Priority |
|---|---|---|
| 1101 | (z2000) confirm/small dialog | med |
| 1938 | 560px modal | med |
| 2953 | 580px modal | med |
| 3155 | 680px modal | high (proposal-area?) |
| 3979 | 680px modal | high (proposal-area?) |
| 4458 | 600px modal | med |
| 4658 | 520px modal | med |
| 4832 | 600px modal | med |
| 7969 | 560px modal | med |
| 8126 | 460px modal | low |
| 8406 | 520px modal | med |
| 8469 | 880px wide modal | med |
| 9331 | 520px modal | med |
| (>9331) | more exist — re-grep `position:"fixed"` past 9331 | — |

Also feature-folder modals (separate files, same hook applies):
- src/components/leadqueue/ReleaseDialog.jsx, ReassignDialog.jsx, AssignPoolDropdown
- src/components/settings/PoolEditModal.jsx
- src/components/PropPulse.jsx (selProject panel, AddDev, AddProject, VerifyQueue)

### Standard retrofit recipe (per inline modal)
1. Confirm it's a real modal (fixed backdrop + centered panel + header).
2. `const { ref, posStyle, handleProps } = useDraggable({ open: true });` in its component/render scope.
3. Panel div: add `ref={ref}` and `...posStyle` at end of its style object.
4. Header row: spread `{...handleProps}` + add `cursor:"move",userSelect:"none"` to its style.
5. Leave backdrop as-is for form modals (light dim); drop backdrop only for
   "work-beside" panels like the Pack.
6. Build + drag-test each before committing a batch.

### Risk notes
- Some "fixed" hits are NOT modals (Toast line 398, hover shadows). Skip those.
- Modals rendered inside scrollable containers (e.g. line 3041 uses position:absolute
  inset) need posStyle's absolute to resolve against the right parent — test.
- Keep each batch small; App.jsx is ~17k lines, anchors must be unique per edit.

## Effort estimate
- ~12-16 inline + ~8 feature-folder modals = 20-24 retrofits.
- ~10-15 min each with test = a focused 1-1.5 day sprint. NOT a 2-hour job.
- Pure polish: NOT demo-critical (the demo-critical Pack is already done).

## Recommendation
Post-demo, or a dedicated fresh-session block. Do NOT bulk-rush before 15 Jun.
