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
