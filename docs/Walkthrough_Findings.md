# PropCRM — Walkthrough Findings

**Method:** Systematic screen-by-screen sweep. Trivial defects fixed inline during walk.
Non-trivial items LOGGED and PARKED until the full sweep completes — no live-fixing big
things mid-walk (that's the deviation pattern we guard against).

**Data rule:** Do NOT chase number-correctness during walkthrough. With messy data every
figure becomes a reason-hunt. Verify data only AFTER a clean, understandable dataset exists
so movement is visible, not investigated.

---

## SCREEN 1 — DASHBOARD (Sales mode) — swept 21 Jun 2026

**Overall:** Functionally healthy. Renders, all sections load, no crash on the dashboard
itself. Findings below.

### Finding #1 — ActivityLog crash (parked, trivial fix)
`ActivityLog.jsx:35 — ReferenceError: ACT_TYPES is not defined`. Missing constant after a
prior extraction — needs import from constants OR pass-as-prop from App.jsx. Contained crash:
only the ActivityLog component; other reports fine. Pre-existing (NOT from 21-Jun session).
Low priority — admin/reports sub-view, not core broker flow. Same class as the LeadDetail
dependency fixes; quick once we sit on it.

### Finding #2 — Stage rows mis-navigate (parked, trivial fix)
Dashboard "Opportunities by Stage" bars → clicking any stage navigates to LEADS page instead
of a filtered Opportunities/Pipeline view. Wrong onNavigate target.

### Finding #3 — Won/Lost cards mis-navigate (parked, trivial fix)
"7 Won / 0 Lost" cards → clicking also goes to LEADS instead of won/lost opportunities.
Almost certainly SAME root cause as #2 (onNavigate pointing to "leads"). One fix likely
resolves both.

### Finding #4 — Dashboard WOW-redesign (MAJOR — in-scope, priority SOON, NOT post-MVP)
Founder decision: this is in the cards soon, not deferred.

Problem: hero band + stat cards consume the entire first screen; broker's daily working tools
(Quick Actions, Recent Activity, Today at a Glance) sit below the fold. Dashboard currently
optimises for at-a-glance "wow" over daily broker working flow.

Direction:
- Compress the hero greeting/pipeline-value band (beautiful but ~40% of first screen for one number)
- Lift Quick Actions + Recent Activity above the fold
- Keep the 5 stat cards as the at-a-glance layer (already compact + clickable)
- Elevate visual design to a genuine "wow" standard — distinctive, not templated-CRM.
  Founder wants a first screen strong enough to lead/break with.
- Serves BOTH investor-wow and broker-daily-flow on one screen via re-ranking, not either/or.

Findings #2 and #3 (mis-nav) fold into this rework.

### Finding #5 — Role-aware, NO BLANKS (design constraint on #4)
Founder experience note. When dashboard becomes role-based (agent / manager / admin /
super-admin), low-data roles must NOT see blank cards or dead space. Every widget either
renders a deliberate empty-state ("You're all caught up") or is hidden for roles it doesn't
apply to. The least-data role's dashboard must look as intentional and complete as the
super-admin's. No blanks, no orphaned widgets.

Implication: design the WOW-layout and the role-awareness as ONE pass (ties in old-doc
Phase 2.6 Role-Based Dashboard). Smarter than bolting role-filtering onto a full-data layout.

### Dashboard DATA verification — PARKED
Do not chase dashboard number-correctness until clean seed data exists. Revisit post-clean-data.

---

## SCREENS NOT YET SWEPT
2. Leads / Lead Detail   3. Opportunities / Opp Detail   4. Projects   5. Inventory / Unit Detail
6. Reports   7. PropPulse   8. AI Coach   9. Companies   10. Users / Settings   11. Master Agreements
12. Commission Outstanding   13. Lead Queue   14. Customers

(Also: smoke-test of today's 5 extractions still pending — confirm AI bubble, Lead Detail,
Users/Settings render live before/at start of next session.)

### Finding #4 — UPDATE (21 Jun evening, founder + screenshots)
Confirmed visually: alert banner + hero band consume ~HALF the first screen before any
working element. Hero band is the worst offender — a billboard for ONE number (pipeline value)
+ greeting, with large empty middle. Stat cards (the useful at-a-glance layer) barely above
fold; Quick Actions + Recent Activity not visible without scrolling.

Sharpened direction:
- COLLAPSE hero band to a slim strip (greeting + pipeline value on ~one line + role badge),
  not a billboard. Biggest space reclaim for least loss.
- THIN the alert banner to a single compact line, not a full padded card.
- PROMOTE stat cards + Quick Actions + Recent Activity into reclaimed space — broker's daily
  cockpit lands above the fold.
- Principle: "wow" = dense, intentional, beautiful information design — NOT whitespace/billboard.

### Finding #1 — RESOLVED (commit 7f15e78)
ActivityLog crash fixed. Root cause: TWO ActivityLog files exist —
LIVE = src/components/sales/ActivityLog.jsx (App.jsx imports this);
ORPHAN = src/components/ActivityLog.jsx (88 lines, unimported, mixed-depth paths).
Live file used ACT_TYPES, ACT_META, fmtDate but never imported them (lost in move).
Added: import {ACT_TYPES, ACT_META} from constants + fmtDate to the utils import.
TODO: delete orphan twin src/components/ActivityLog.jsx.

### Finding #6 — Dashboard stat-card nav imprecise (folds into #4 redesign)
Clicking the 5 dashboard stat cards:
- Upcoming Tasks -> Activity Log (CORRECT, now works post-#1-fix)
- Active Opps -> Pipeline Report (should be active opportunities list)
- Won Value -> Pipeline Report (should be won deals)
- Available Units -> Inventory listing (acceptable)
- Reserved -> Inventory listing (should be reserved-filtered, or acceptable)
Same family as #2 (stage bars) and #3 (won/lost) — all dashboard click-targets are
roughly wired but not precise. Fix ALL together during the #4 wow-redesign, not piecemeal.

### Finding #6 — CONFIRMED (founder verified all 4 cards)
Active Opps + Won Value -> both land on full Pipeline Report (not their filtered slice).
Available + Reserved -> both land on full Inventory list (not filtered).
Card promises a slice; click delivers the whole table. NOT presentable as-is.
Reports + Inventory screens themselves render fine — defect is purely card->destination wiring.
Fix ALL dashboard nav (#2,#3,#6) in ONE pass during #4 wow-redesign. Do NOT patch piecemeal.

## SCREEN 2 — LEADS / LEAD DETAIL — swept 21 Jun
Clean. List, Lead Detail, proposal flow (ProposalFormModal + UnitPickerMulti), activity
logging, lifecycle badges, assignment strip — all working.
PARKED (not new): View-Proposal versioning + AI-picker promote-to-Opportunity = the
Lead-Proposal AI thread already logged in master context doc. Surfaces in proposal-flow UX pass.

## SCREEN 3 — OPPORTUNITIES / OPP DETAIL — swept 21 Jun
All forms/tabs render and work (Deal Journey, Log Call/WhatsApp/Note/Send Proposal,
Proposals(9), Coach, Next Steps, Financials, Negotiations, Payment Plan). Good.

### Finding #7 — Share Pack shows placeholder, not the document picker (REGRESSION?)
Opp Detail "Share Pack" opens the Property Pack card (type/beds/size/view/amenities render
fine) BUT the action reads "Share / Attach Pack — coming Q3 2026" (coming-soon placeholder).
Founder memory: this was BUILT and working — clicking used to list the brochure/floor-plan
PDFs (the docs/"herodocs") ready to send to customer, with re-ask-if-not-sent flow.
Likely lost/reverted in a refactor. Fix-pass step 1: git-history check — was the working
picker present then overwritten by the placeholder, or never wired here? Then restore.
Priority: real broker value (customer-facing doc send). Confirm scope vs Q3 Comms-Overhaul.

## SCREEN 4 — PROJECTS — swept 21 Jun
Clean. All major forms open, no issues.

## SCREENS 5–14 — swept 21 Jun (one-pass founder sweep)

### Screen 5 — Inventory: CLEAN. No issues (list, filters, 50/50, Add Unit, unit rows).
### Screen 6 — Reports: CLEAN. All report tabs present and open.
  NOTE: Reports content is the SAME as what the Dashboard 4–5 stat cards drill into —
  confirms Finding #6: cards route to these full reports instead of filtered slices.
  Fix together in #4 wow-redesign.
### Screen 7 — Companies: CLEAN. All major forms open.
### Screen 8 — PropPulse: NOT TESTED (deliberate). Renders clean. AI Agent run costs $ and
  can't exercise from localhost — defer live-site test. Visually one of the cleanest screens.
### Screen 9 — AI Coach: NOT TESTED (deliberate, same reason — live-site only).
### Screen 10 — Master Agreements: CLEAN. No issues.
### Screen 11 — Settings (main tab): CLEAN. No issues.
### Screen 12 — Lead Queue: CLEAN (good for now).
### Screen 13 — Master Agreements / Users — see Finding #8 below.
### Screen 14 — Customers: opens, all forms work, no issues. See Finding #9 (purpose recall).

### Finding #8 — Users screen has TWO buttons incl. its own "Settings" (duplicate? old?)
The Users screen contains a Settings button/sub-view, but Settings ALSO exists as a main
top-level tab. Possible duplicate OR pre-dates the main Settings tab (legacy sub-view left
behind). Same twin-pattern as UserManagement/ActivityLog. Fix-pass: check if Users>Settings
is the old SettingsTab now superseded by the main Settings tab; reconcile or remove. Low risk.

### Finding #9 — "Customers" tab purpose (founder recall pending, NOT a defect)
New Customers tab (Phase 2.5 Lead Lifecycle — leads convert to customers on SPA/win, plus
buyer_intent segmentation: investor/owner-occupier/etc). Opens fine, all forms work. Founder
memory-recall pending on full intent; revisit when it comes up. No action needed now.

### Finding #10 — Commission Outstanding shows empty (DATA issue, not code — OK)
Shows nothing now. Cause: during earlier testing, founder reassigned many customers (and
likely wins) to other brokers to test assignment. Data state, not a defect. Will resolve with
clean data. No code action.

## WALKTHROUGH SWEEP COMPLETE — all 14 screens covered 21 Jun.

### Finding #8 — UPDATE (scanned): NOT a duplicate/fossil — PARK for Settings consolidation
Investigated. Users>Settings sub-view = OLD SettingsTab (src/components/SettingsTab.jsx, 38
lines) managing app-level config: mode (sales/leasing/both), currency, country. It is LIVE
and unique (this config has no other home — it superseded the deleted SetupWizard). The main
Settings tab = SettingsPage (settings/, Agent Pools + Lead Routing) — a DIFFERENT surface.
NOT interchangeable, NOT a delete. This is "scattered settings" = belongs in the Unified
Settings consolidation (old-doc Phase 2.9: migrate Users/Companies/AI-Quotas/Branding/this
app-config INTO one Settings module). PARKED until that consolidation pass. No action now.
