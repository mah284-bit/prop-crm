# ⭐ APP NORMALISATION / DE-DUPLICATION — TOP ARCHITECTURAL PRIORITY

**Raised by founder:** repeatedly (his words: "I have kept pushing for the normalisation
of APP first but pushed back... when I was pushed 2-3 times after demo I left it. I don't
know why — I should have cleaned first.")
**Status:** VALIDATED with hard evidence (Day 24). Founder's instinct was correct each time.
**Captured:** 2 June 2026.

## What this is
PropCRM was partially migrated from a monolithic App.jsx (~17,300 lines) toward feature
components in src/components/. The migration is INCOMPLETE, leaving DUPLICATE implementations
of the same forms/dialogs — one inline in App.jsx, one as a component — for the same action.

## Hard evidence (surfaced Day 24 during contrast-bug dissection)
- "Send Proposal" exists as BOTH:
  - `ProposalBuilderDialog` inline in App.jsx (the one we made draggable + tested), AND
  - a "Send Proposal" dialog inside src/components/OpportunityDetail.jsx (L1007)
- Same duplication pattern for: Add/Edit Payment, Log Task, New Opportunity, etc.
- `OpportunityDetail.jsx` IS rendered (App.jsx L10950, L12088; Leads.jsx L374) — so its
  duplicate forms are live, not dead — BUT may serve different entry paths than App's inline.
- This is WHY:
  - The contrast bug felt endless (every form to fix in ~2 places)
  - Yesterday's "View Proposal" drag patch was untestable (patched a version not on the
    screen being viewed)
  - Bugs recur and fixes drift between twins

## Why it must come FIRST (founder was right)
- Every fix/feature currently risks being done to the WRONG twin, or needing doing twice.
- "1 step forward, 2 steps back" — founder's exact stated frustration. Root cause = this.
- Polishing/feature work ON TOP of duplicated code compounds the debt.
- Clean consolidation first = every subsequent change is done ONCE, cleanly.

## The work (post-demo, dedicated sprint — NOT a squeeze)
1. MAP: inventory every form/dialog. For each, list all implementations (App.jsx inline +
   component file) and which entry points render which version.
2. DECIDE canonical: one component per form (the feature-folder version, per the
   established Settings/LeadQueue pattern).
3. CONSOLIDATE: point all entry points at the canonical component; delete the duplicate.
4. VERIFY: each form opens correctly from every entry path; no orphan/dead components.
5. THEN: contrast theming, draggable rollout, etc. become single-pass clean jobs.

## Relationship to other work
- The full contrast/invisible-text sweep (Day 24) SHOULD WAIT for this — fixing 110 lines
  across duplicated files is wasted/error-prone effort. Fix only confirmed demo-path Sales
  forms pre-demo; do the rest as part of consolidation.
- Movable-modals rollout (Movable_Modals_Rollout_Sprint.md) ALSO benefits — apply the
  draggable wrapper once per canonical form, not per duplicate.

## Demo stance (15 June)
- Demo runs on the CURRENTLY-RENDERED Sales-path forms (already working + fixed where visible).
- Do NOT attempt consolidation before the demo — it's a structural refactor, high-risk in
  the demo window. This is explicitly a POST-DEMO priority — but THE FIRST post-demo priority,
  ahead of new features.

## Founder principle locked
"Clean first, then build." The normalisation is not optional cleanup — it is the
foundation that makes every later change cheap instead of doubled. Do not let it be
pushed back a 4th time.

---

## ADDENDUM — Day 24 findings (the evidence that forced the priority)

**Confirmed renderer:** the Sales deal screen renders `<OpportunityDetail/>` (App.jsx
L10950 AND L12088 — note TWO render sites for the same view, itself a smell).

**Duplication confirmed, NOT yet fully mapped (mapping = part of the sprint, deliberately
NOT done pre-demo to avoid starting the refactor under time pressure):**
- App.jsx has inline `ProposalBuilderDialog` (the full proposal BUILDER — units, pricing,
  payment plan, AI Match) — we made it draggable + believed-tested Day 24.
- OpportunityDetail.jsx has its OWN "Send Proposal Email Modal" (L1007) + Log Task (L590)
  + Add/Edit Payment (L1039) + cost-label blocks (L419/458) — several white-on-light = invisible.
- ⚠️ UNRESOLVED: whether the draggable App.jsx `ProposalBuilderDialog` is the version that
  actually renders from the deal screen, or a leftover twin. This uncertainty is the whole
  point: we cannot safely patch/feature without first consolidating.

**History (founder):** an earlier cleanup pass cut App.jsx inline to ~6,500 lines as logic
moved into components; afterward, NEW inline code accreted back into App.jsx, recreating
twins. Leasing was intentionally PAUSED to finish Sales after that cleanup — so Leasing
components are expected to lag and should be normalised in the same sweep.

## DECISION (architect call, founder endorsed) — Day 24
- **Pre-demo:** FREEZE structural work. Do NOT patch more contrast/dead-twin code.
  Founder handles the demo narrative on known-good Sales screens (PropPulse Scene 1 banner
  already fixed; key demo moments already polished). Remaining faint headers are cosmetic,
  not show-stoppers, and founder controls which screens are shown.
- **Post-demo (FIRST job, on a clone/branch):** the normalisation sprint —
  1) full duplication MAP, 2) pick canonical component per form, 3) consolidate all entry
  points, 4) delete twins/orphans (CountryPicker & LeadPersonEditModal show 0 App imports —
  verify dead), 5) THEN contrast + draggable rollout as single clean passes.
- Rationale (founder's own words): patching now risks "spending more time doing things on
  dead code and repeat." Correct. Clean first, then build.

## Orphan suspects to verify in the sprint (0 App.jsx imports)
- CountryPicker, LeadPersonEditModal — confirm dead or used by other components; delete if dead.
- TWO `<OpportunityDetail/>` render sites (App.jsx L10950 + L12088) — consolidate to one.

## EVIDENCE (Day 27, 4 Jun) — duplicate form cost real time
The "Add New Company" form exists TWICE:
- src/components/CompaniesModule.jsx (imported via {tab==="companies" && <CompaniesModule/>})
- src/App.jsx inline copy (~line 16101-16235)
DESPITE CompaniesModule being the imported component, the App.jsx INLINE copy is what
actually renders. Spent ~1hr fixing the AI Assistant Name white-on-white bug in
CompaniesModule (the wrong/non-rendering twin) before discovering App.jsx renders.
Proven via: [LIVE-CM] label marker + garish red/lime test colors showed NO change in
incognito → CompaniesModule edits never reached screen → App.jsx copy is live.
Fix finally applied to App.jsx (commit dce094d).

LESSON: duplicate forms = fixing phantoms. Normalisation must collapse these twins to
ONE source of truth. Likely other duplicated forms exist (App.jsx.bak references,
duplicate "Add Company", and the activity-logging twins noted earlier). This is the
#1 post-MVP-onboarding cleanup. A real tester would eventually hit a "fixed but still
broken" bug from editing the wrong copy.
