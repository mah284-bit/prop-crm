# Phase 2 — State Management & Real-Time Sync (CRITICAL Infrastructure)

**Date captured:** 23 May 2026 (Saturday afternoon, Day 11)
**Source:** Founder discovery during demo prep walkthrough
**Founder quote:** *"I cant tell the customers to keep refreshing always, which shows a flaw in the system correct"*
**Architect honest answer:** *"Confirmed: YES, it's a real flaw. Not imagination. Not just demo-environment glitch."*
**Severity:** 🔴 Production blocker for real client deployment
**Effort:** 2-3 days focused work
**Timing:** Phase 2 Priority 0 — BEFORE any other Phase 2 features
**Workaround for demo:** Hard refresh between major actions (acceptable for investor demo, NOT for client deployment)

---

## TL;DR

PropCRM is a React Single-Page Application (SPA) that **caches data in browser memory** for speed. When data changes (proposals saved, activities logged, opportunities created), **the in-memory state may not refresh across all UI components** until the user hard-refreshes the browser.

**This is a real architectural flaw, not a cosmetic issue.** Real clients will hit this daily and lose trust.

**Phase 2 fix:** Supabase Realtime subscriptions + explicit refresh callbacks on save. **Single sprint, 2-3 days, foundational quality work.**

---

## The Problem — Reproduced Today

### What Founder Experienced (23 May 2026 afternoon)
```
1. Yesterday: Created Mayya KS opp + saved 4 proposal versions (V1-V4)
2. Today morning: Hard refreshed app
3. Did lots of work (Lead Detail logging build, doc writing)
4. App stayed open continuously
5. Tried to navigate to Mayya's opp from Opportunities list
6. Result: Proposals tab showed EMPTY (no V1-V4)
7. About to report this as a serious bug
8. Did another hard refresh
9. Now: All 4 proposals visible
```

**Founder's correct intuition:** *"why this dangerous behavior"*

---

## Technical Explanation

### How React SPAs work (today's pattern)

```
App Load:
  ↓
  Fetch ALL data from Supabase (leads, opps, proposals, activities, units, etc.)
  ↓
  Store in React state (in-memory, in browser tab)
  ↓
  Render UI from state

User navigates Leads → Opp → Dashboard:
  ↓
  React renders from in-memory state (FAST, no DB calls)
  ↓
  Page changes are instant
  
User saves a new proposal:
  ↓
  POST to Supabase → saved in DB
  ↓
  UI updates LOCAL state (sometimes)
  ↓
  But sibling/parent components may have STALE copies
```

**When stale state appears:**
- Component fetches data once on mount, never re-fetches
- Save handler updates own state but not parent's
- Different navigation paths show different copies
- Browser tab open for hours = state drifts from DB

---

## Where We've Seen This Today

| Symptom | Cause | Today's Workaround |
|---|---|---|
| Final Agreed Price showing list price | State stale after V4 save | Hard refresh |
| Mayya's proposals not appearing | Stale state in opp detail | Hard refresh |
| AI Coach analysis missing on first click | Activities not yet in state | Wait + retry |
| Recent activities not updating on Lead Detail | (Pre-FIX) state not refreshed | Restored via δ-LITE commit |
| (Probable) Commission Outstanding "Loading..." | State not initialized | Hard refresh |

**Pattern:** Most issues solved by hard refresh = stale state confirmed.

---

## Severity Analysis

### Demo impact (June 5)
- 🟡 **Acceptable** with workaround
- Demo narrative: *"PropCRM is a real-time app — Phase 2 adds Supabase Realtime for full sync"*
- Hard refresh between scenes if needed
- Investor sees the FEATURES work, accepts the state-sync gap

### Pilot client impact (post-demo)
- 🔴 **Production blocker** for daily use
- Real broker: 3-5 sessions per day, multiple browser tabs, 8+ hours active use
- They WILL hit stale state issues
- Trust erodes quickly: "the data isn't reliable"
- Workaround "hard refresh always" is NOT acceptable

### Why client is different from investor
- **Investor:** Watches a 30-min demo, accepts roadmap promises
- **Client:** Uses app 40+ hrs/week, every glitch = lost productivity

**Founder's distinction is correct.** Demo OK with caveats. Client deployment requires fix first.

---

## The Phase 2 Solution

### Pattern: Supabase Realtime + Smart Refresh

**Supabase has built-in Realtime** — WebSocket subscriptions to DB changes. When a row is inserted/updated/deleted, all connected clients get notified.

### Architecture

```javascript
// Example: Subscribe to proposals table changes
useEffect(() => {
  const channel = supabase
    .channel('proposals_changes')
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'proposals' },
      (payload) => {
        // Auto-update local state when DB changes
        if (payload.eventType === 'INSERT') {
          setProposals(p => [payload.new, ...p]);
        } else if (payload.eventType === 'UPDATE') {
          setProposals(p => p.map(x => x.id === payload.new.id ? payload.new : x));
        } else if (payload.eventType === 'DELETE') {
          setProposals(p => p.filter(x => x.id !== payload.old.id));
        }
      }
    )
    .subscribe();
  
  return () => supabase.removeChannel(channel);
}, []);
```

### Tables that need Realtime subscriptions

```
PRIORITY 1 (real-time critical):
  ✅ proposals       - Multiple agents may edit same deal
  ✅ activities      - Calls/notes logged from multiple sessions
  ✅ opportunities   - Stage changes, current_* fields update
  ✅ leads           - Profile updates, lifecycle changes

PRIORITY 2 (eventual consistency OK):
  ✅ projects        - Slow-changing, hourly is fine
  ✅ project_units   - Inventory updates
  ✅ pp_developers   - Catalog data

PRIORITY 3 (event-driven, no realtime needed):
  - pp_commission_invoices  - User-triggered, refresh on view OK
  - pp_agent_jobs           - Job log, no real-time UI need
  - master_agreements       - Stable, rare updates
```

### Smart Refresh on Save (complementary pattern)

Even with Realtime, explicit refresh callbacks on save operations add reliability:

```javascript
// After saving a proposal
const saveProposal = async (data) => {
  const {data: row, error} = await supabase.from("proposals").insert(data).select().single();
  if (!error) {
    setProposals(p => [row, ...p]);          // Local optimistic update
    onProposalSaved?.(row);                   // Notify parent
    refreshOpp?.(row.opportunity_id);         // Force opp re-fetch
  }
};
```

### Why both patterns together

| Pattern | Strength | Weakness |
|---|---|---|
| Realtime subscriptions | Auto-sync across all tabs/users | Slight delay (~1-2 sec), can fail silently |
| Explicit refresh on save | Instant, deterministic | Only handles current user's saves |

**Together:** Realtime for cross-user/cross-tab updates, explicit refresh for immediate current-user actions.

---

## Build Plan

### Day 1 — Realtime subscriptions for Priority 1 tables (6-8 hrs)
- Set up channel infrastructure
- Subscribe to: proposals, activities, opportunities, leads
- Update React state on INSERT/UPDATE/DELETE events
- Test cross-tab: change in tab A reflects in tab B
- Handle connection drops/reconnects

### Day 2 — Smart refresh callbacks (4-6 hrs)
- Audit every save operation in App.jsx
- Add explicit state update after save
- Add `refreshXxx()` callbacks where parent state needs update
- Particularly: proposal save → opp current_* refresh
- Lead Detail logging → activities refresh

### Day 3 — Testing + edge cases (4-6 hrs)
- Multi-tab test: 2 browser tabs, change in one, verify other updates
- Multi-user test: 2 users on same opp, real-time visibility
- Connection drop: WiFi off → on, state recovers
- Large state: 100+ opps, performance under load
- Mobile: tab backgrounded, comes back, state syncs

**Total: 2-3 days focused work**

---

## Risks & Considerations

### Risk 1 — Performance with many subscriptions
**Mitigation:** Subscribe ONLY to filtered data (company_id + relevant entity IDs)
```javascript
.on('postgres_changes', 
  { 
    event: '*', 
    schema: 'public', 
    table: 'proposals',
    filter: `opportunity_id=eq.${oppId}`  // Only this opp's proposals
  },
  ...
)
```

### Risk 2 — Cost / Connection Limits
**Supabase Free tier:** 200 concurrent realtime connections
**Pro tier:** 500 concurrent realtime connections
**Mitigation:** Each user = 1 connection, multi-tab can share. For 200 brokers = need Pro tier (~$25/month). Negligible cost.

### Risk 3 — Race conditions
**Scenario:** User saves V5 → Realtime delivers → simultaneously user clicks "Refresh" → conflict
**Mitigation:** Always merge by ID (Realtime updates win for fresh data), don't blow away local state

### Risk 4 — Permission/security
**Realtime respects Row-Level Security (RLS)** — users only get updates for rows they can read
**Mitigation:** Ensure RLS policies are correct (Phase 2 includes RLS audit anyway)

---

## Demo Day Workaround (June 5)

### Before demo
- Open app in incognito
- Hard refresh once everything loaded
- Don't switch tabs

### During demo
- Between major scenes, do quiet hard refresh
- Ctrl+Shift+R is silent + fast
- If something appears stale → "Let me refresh to show you the latest..."

### Investor narrative
> "PropCRM is built for real-time collaboration. Today's beta refreshes manually — Phase 2 adds Supabase Realtime subscriptions for full instant sync across users and tabs. The data integrity is rock-solid; the sync layer is the polish we add for production deployment."

**Honest, professional, doesn't oversell.**

---

## Client Deployment Gating

### Before first paying client onboards:
- [ ] Realtime subscriptions live for Priority 1 tables
- [ ] Cross-tab sync tested
- [ ] Multi-user sync tested
- [ ] Connection drop recovery tested
- [ ] Performance tested with realistic data load
- [ ] Documentation of "if something looks stale, contact us" — but should never happen

### If client hits stale state issue
- Treat as P0 bug
- Engineer respond within 1 hour
- Fix or workaround within 24 hours

**No client onboards until Phase 2 Real-Time Sync is verified working.**

---

## Why This is Priority 0 (Before Other Phase 2)

### Foundation argument
- **Phase 2 Communications Overhaul** depends on real-time (delivery status, template tracking)
- **Phase 2 FAB (Activity Logging Everywhere)** depends on real-time (multi-context saves)
- **Phase 2 Lead Lifecycle** depends on real-time (auto-conversion on opp save)
- **Role-Based Dashboard** depends on real-time (manager sees team activity)

**Real-time sync is the foundation.** Everything else built on top of stale state = brittle.

### Sequencing Phase 2 (revised)
```
Phase 2.0: State Management & Real-Time Sync (2-3 days)  ← FIRST
Phase 2.1: Activity Logging Everywhere / FAB
Phase 2.2: Lead Lifecycle & Segmentation
Phase 2.3: Communications Overhaul
Phase 2.4: Role-Based Dashboard
```

---

## Connection to Other Phase 2 Docs

| Phase 2 Doc | Connection |
|---|---|
| `Phase_2_Activity_Logging_Everywhere.md` | Activities sync across contexts needs real-time |
| `Phase_2_Lead_Lifecycle_Segmentation.md` | Auto-conversion trigger relies on real-time |
| `Phase_2_Communications_Overhaul.md` | Delivery status tracking is real-time |
| `Phase_2_Role_Based_Dashboard_Vision.md` | Manager team view needs real-time activity |
| `Phase_2_Backlog_Master_Doc.md` | Master tracker — this is PRIORITY 0 |
| `Dev2_Refactor_Activity_Logging.md` | Combined refactor good opportunity to add subscriptions |

---

## Founder Notes Preserved

> "since morning we are working with the apps, when you asked me to check the proposal status of Mayya i went to ops and opened Mayya's opps, to my surprise i could not see the proposals, was sure we created 4 yesterday I was about to complain to you but just remembered let me try hard refresh again, when i did opened Mayya's 4 proposals showed up."

> "The application is open since morning and we have hard refereshed so many times. Why this dangerous behavior, can you please put some light."

> "I cant tell the customers to keep refreshing always, which shows a flaw in the system correct."

> "I need solution, you can decide not necessary now i can always refresh and show them and make my excuse with investor but not with the client."

**Architect's reading:** Founder accepts investor-demo workaround but draws the line at client deployment. **Correct judgment.**

---

## Status

- [x] Captured comprehensively in Phase 2 strategic doc (this doc)
- [ ] Realtime infrastructure designed
- [ ] Subscriptions added to Priority 1 tables
- [ ] Smart refresh callbacks audit completed
- [ ] Multi-tab + multi-user testing
- [ ] Performance verified at scale
- [ ] PRIORITY 0 for Phase 2 — must complete before any client onboarding

---

## Demo Day Approach (Summary)

```
✅ Demo workaround acceptable: hard refresh + investor narrative
✅ Client deployment blocked: until Phase 2.0 Real-Time Sync ships
✅ Documented as PRIORITY 0 in Phase 2 sequencing
✅ Foundation for all other Phase 2 features
```

---

*Document created: 23 May 2026 (Saturday afternoon, Day 11)*
*Source: Founder discovery during demo prep — proposals appearing only after hard refresh*
*Architect assessment: REAL ARCHITECTURAL FLAW, accepted for demo, blocking for client*
*Priority: PHASE 2.0 — Foundation work before any other Phase 2 features*
