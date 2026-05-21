# Phase 2 — Role-Based Dashboard Vision
**Date captured:** 21 May 2026 (Thursday afternoon, Day 9)
**Captured during:** Founder-led app walkthrough finding "richness in app flows"
**Status:** Architectural decision documented, Phase 2 build
**Investor demo positioning:** Roadmap reference — explains why Activity Log is hidden
**Phase 1 impact:** Activity Log menu hidden; component preserved

---

## TL;DR

PropCRM's current Activity Log screen was originally planned as a manager-monitoring view but was incomplete. **Phase 2 replaces it with a role-aware Dashboard** — where Managers see team performance, drill into agents, view activity heatmaps — instead of a separate audit-page screen.

This is a **modern UX pattern** (Salesforce, HubSpot, Pipedrive) that beats 1990s "separate audit page" approach.

---

## Founder's Original Intent

> "This was supposed to become Manager's View where a manager of Brokerage company/Real estate company having sales managers and admins will have access purely monitor the performance of their brokers/sales agents. If we have any better possibility like giving good drill down reports bring it on dashboard and allow access to only the managers/admins, we can getaway with this page also."

**Founder's instinct was right.** Modern apps don't use separate audit pages — they use role-aware dashboards.

---

## What Modern SaaS Does (Industry Patterns)

### Salesforce "Forecast / Pipeline Inspection"
- Single Dashboard, role-aware content
- Agent sees: My pipeline, my tasks, my activity
- Manager sees: Team pipeline, individual rep cards, team activity heatmap
- Drill-down: Manager → Agent → Deal → Activity
- **No separate "Activity Log" menu item**

### HubSpot "Sales Hub Reports"
- Performance reports embedded in Dashboard widgets
- "Top performers this month" card
- "Activity score" per rep (calls, emails, meetings)
- Drill-down into specific agent's calendar/activities
- **Audit log lives in Settings, not main navigation**

### Pipedrive "Insights / Goals"
- Single "Insights" section with deep filters
- Manager filters by agent, period, deal stage
- "Activity per rep" visualizations
- **No standalone Activity Log**

### Linear/Notion (modern productivity apps)
- Personal dashboard vs team dashboard
- Embedded analytics
- Filtered views replace separate "log" pages

### Common pattern
- **Role-aware widgets** > separate role-specific screens
- **Drill-down** > flat lists
- **Embedded analytics** > separate report pages
- **Manager view = enriched Dashboard**, not a different app section

---

## PropCRM Implementation — Phase 2 Design

### Today (Phase 1)
- Agent sees Dashboard with KPIs, pipeline, recent activity (single role view)
- Activity Log: separate page (now hidden)
- Reports: separate page with 5 templates

### Phase 2 (Role-Aware Dashboard)

**For Agent role (current behavior preserved):**
- My pipeline value
- My active opps
- My won value
- My available units assigned
- My recent activity
- My today's tasks

**For Manager role (NEW):**
- **Team pipeline value** (sum of all reports)
- **Per-agent breakdown card:**
  - Name + photo
  - Pipeline value
  - Active opps count
  - Conversion rate this month
  - Activity score (color-coded: green/amber/red)
  - "Last active" timestamp
  - Drill-down arrow → agent's detail page (read-only)
- **Stalled deals across team** (deals with no activity 7+ days, all agents)
- **Activity heatmap** (who's active, who's quiet, last 30 days)
- **Team conversion funnel** by stage
- **Outliers detection** (agents performing above/below team average)

**For Admin role:**
- Everything Manager sees
- Plus: Cross-team views (multi-brokerage if applicable)
- Plus: System health (data quality alerts, integration status)
- Plus: Cross-company analytics

### Drill-Down Flow

```
Manager Dashboard
   ↓ click an agent card
Agent's read-only "My View"
   ↓ click a deal
Opportunity Detail (read-only)
   ↓ click an activity
Activity context
```

**One click drill-down. No separate menu items.**

---

## Data Model — Already Supports This

Current schema captures everything needed:

| Table | Field | Use for Manager view |
|---|---|---|
| activities | user_id, lead_id, created_at | Activity heatmap |
| opportunities | assigned_to, stage, current_agreed_price | Pipeline per agent |
| activities | activity_subtype, structured_data | Activity type breakdown |
| leads | assigned_to, status, last_activity_at | Stale leads per agent |
| proposals | created_by, status | Proposal velocity |
| reminders | user_id, status | Task completion rate |

**No schema changes needed** — just queries grouped by `assigned_to` / `user_id`.

---

## Why This Beats Activity Log

| Activity Log (1990s) | Role-Aware Dashboard (Modern) |
|---|---|
| Chronological dump | Insightful narrative |
| Same view for everyone | Role-aware (Agent/Manager/Admin) |
| Need to scroll/filter | Pre-aggregated, drillable |
| Separate menu item | Single Dashboard |
| Hard to find patterns | Heatmaps, outliers, trends |
| Doesn't teach what matters | Highlights what's stalled, who's exceeding |
| Pure audit | Operational + audit |

---

## Implementation Plan

### Phase 2.1 — Role detection (1 day)
- Already exists via `currentUser.role`
- Add `isManager()`, `isAdmin()` helpers
- Wire Dashboard to render conditionally

### Phase 2.2 — Per-agent KPI cards (3-4 days)
- Query: aggregate by assigned_to
- Card component: name, pipeline value, conversion, activity
- Drill-down link

### Phase 2.3 — Activity heatmap (2-3 days)
- Visualization library (recharts or similar)
- Calendar-grid view per agent
- Activity score calculation

### Phase 2.4 — Stalled deals widget (1-2 days)
- Query for deals with no activity 7+ days
- Group by assigned_to
- Action buttons (reassign, prod the agent, archive)

### Phase 2.5 — Outliers + trends (2-3 days)
- Statistical comparisons (deviations from team mean)
- Notification system for managers

### Total: ~2 weeks of focused work

---

## Demo Positioning (June 5)

### When investor asks "What does the manager see?"

**Answer:**
> "Currently Phase 1 is broker-focused. Each broker sees their own dashboard. Phase 2 — scheduled for July — adds role-aware enhancement. Manager logs in, same dashboard URL, but enriched with team views: per-agent KPIs, stalled deals across team, activity heatmaps, outliers detection. One-click drill-down from team to individual to deal. We follow Salesforce / HubSpot pattern — role-aware dashboard, not separate manager app. The architecture already supports this — every record is tagged by assigned_to. We just add the aggregation queries."

**Investor takeaway:**
- Founder understands modern UX
- Architecture is ready (no schema changes)
- Clear phased delivery (not vapor)
- Cost-effective (2 weeks, not 2 months)

---

## Open Questions for Phase 2 Build

### Q1: Notification engine
- Should managers get alerts when an agent's deal stalls?
- Email? Push? In-app?
- Daily summary or real-time?

### Q2: Drill-down permissions
- Can manager see EVERYTHING an agent sees, or limited fields?
- Compensation/commission data — visible?
- Activity notes — should agents have privacy from manager?

### Q3: Team boundaries
- One brokerage = one team?
- Or multi-team within brokerage (e.g., Dubai team, Abu Dhabi team)?
- How are agents assigned to managers?

### Q4: Historical views
- Last 30 days / last quarter / custom range?
- Year-over-year comparisons?

### Q5: Mobile-first manager view
- Manager on the road — what's the mobile experience?
- Push notifications for critical events?

---

## Connection to PropOS Vision

This Role-Based Dashboard is also a **stepping stone toward the PropOS vision** documented separately.

Each persona gets their own role-aware Dashboard:
- **Broker / Sales Agent:** Personal performance + pipeline
- **Sales Manager:** Team performance + drill-downs
- **Admin:** Cross-team + system health
- **Developer Operations:** Project sales velocity, payment milestones (Phase 2)
- **Construction Manager:** Project handover status (Phase 3)
- **Facilities Manager:** Post-handover operations (Phase 4)

**One Dashboard component. Many roles. Configurable widgets.**

This is how Property Operating System gets built incrementally.

---

## What's NOT in Scope for Current Sprint

**Phase 1 (June 5 demo):** Hide Activity Log menu. Mention Phase 2 enhancement in Q&A if asked.

**Phase 2 (July build):** Role-aware Dashboard for Manager + Admin roles.

**Phase 3+ (post-pilot):** Persona-specific dashboards (developer ops, construction, facilities).

---

## What to do with this document

1. ✅ Commit to repo
2. ✅ Reference in Demo Script v3.1 Q&A section if asked
3. ✅ Revisit after June 5 investor demo
4. ✅ Estimate properly with team after pilot feedback
5. ✅ Schedule build for July (alongside PDF generation from Phase_2_Proposal_Communication_Model.md)

---

## Founder Quotes Preserved

> "This was supposed to become Manager's View where a manager of Brokerage company/Real estate company having sales managers and admins will have access purely monitor the performance of there brokers/sales agents"

> "If we have any better possibility like giving good drill down reports bring it on dashboard and allow access to only the managers/admins, we can getaway with this page also"

> "Role based Dashboard is a fantastic decision"

---

*Document created: 21 May 2026 (Thursday)*
*Captured during: Founder app walkthrough — looking for "richness in app flows"*
*Architectural decision: Activity Log replaced by role-aware Dashboard in Phase 2*
*Phase 1 action: Activity Log menu hidden, component preserved*
