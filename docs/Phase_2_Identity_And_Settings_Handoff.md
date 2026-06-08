# PropCRM Phase 2 Identity & Settings — Current State Handoff (Day 29, 8 June 2026)

**Date:** 8 June 2026 (Day 29)  
**Demo target:** 15 June 2026 (7 days)  
**Status:** Stages 1–2 complete. Stage 3 scope clarified. Ready for build.

---

## Executive Summary

The Identity & Settings refactor (Phase 2) is a **multi-stage architectural work** that adds group/branch hierarchy + configurable access control. Stages 1–2 (schema + read-only UI) are shipped and verified. Stage 3 (app-layer context) is next. Stage 4+ (full RLS lockdown) deferred post-demo.

**Current:** The foundation is proven clean. No blocking issues. Path to demo is clear.

---

## Stage Summary

### Stage 0 — Design (LOCKED)
**Document:** `docs/Phase_2_Identity_And_Settings_Design.md`  
**Status:** ✅ All decisions locked before any code.

**Key decisions:**
- Group → Branch → Data hierarchy (company_id stays as branch anchor)
- Two-tier identity (Platform Operator vs Tenant User)
- Fused 7-role system (super_admin, admin, sales_manager, sales_agent, leasing_manager, leasing_agent, viewer)
- Break-glass access deferred to go-live/first-customer

---

### Stage 1 — Schema (COMPLETE)
**Commits:** `eba5fe4` (schema), tagged `stage1-complete`  
**Status:** ✅ Shipped. Verified in production.

**What shipped:**
- `groups` table created (id, company_id, name, branch_visibility)
- `companies.group_id` added (FK to groups)
- `profiles.is_platform_operator` boolean added
- All 5 existing companies backfilled 1:1 to isolated groups (idempotent DO loop)
- Safety tag: `pre-stage1-identity-schema`

**Verified:** All companies correctly linked to their own group. No orphans.

---

### Stage 2 — Settings UI + RLS Fix (COMPLETE)
**Commits:** `2484792` (UI), tagged `stage2-complete`  
**Status:** ✅ Shipped. Verified in production.

**What shipped:**
- `src/components/settings/GroupBranchesSection.jsx` (118 lines, read-only, self-fetching)
- Registered in `SettingsPage.jsx` as "🏛️ Group & Branches" tab
- RLS gap caught and fixed: `groups` table had no policy → HTTP 406 errors
  - Fix: `alter table groups enable row level security`
  - Added: read policy `using (true)` for authenticated users
- Safety tag: `pre-stage2-rlsgap-fix`

**Verified:** Super-admin switching to Emirates now shows Emirates group correctly (Fix #5, commit `3167db9`). RLS working.

---

### Stage 3 — SPLIT (Immediate next)
**Status:** 🎯 Scope clarified. Ready to build. **Two parts:**

#### Stage 3a — App-layer context (BUILD NOW)
**What it does:**
1. Audit the super-admin branch switcher (how it works, what it changes)
2. Make active-branch context real in queries
   - `currentUser.company_id` alone no longer sufficient (company = branch)
   - Add active-branch tracking (localStorage? context state? TBD in build)
   - Leads list, opp counts, etc. filter by active branch
3. No RLS changes. Purely app-layer data flow.

**Demo impact:** ✅ Real. Testable. Strengthens UX.

**Effort:** 1–2 days (depends on current state of switcher + context wiring)

#### Stage 3b — Cross-branch RLS (DEFER to Stage 4)
**Why deferred:**
- Stage 2 locked principle: "RLS scoping coherently, all-at-once at lockdown audit"
- Cross-branch RLS is *piecemeal* — speculative work on a condition (multi-branch group) that doesn't exist yet
- All 5 companies are isolated (1:1 group), no multi-branch group to test against
- Belongs in full RLS coherency audit (Stage 4), not alone

**When:** Stage 4 lockdown audit (post-demo), alongside other RLS tightening

---

## Supporting Documents

| Document | Captures | Commit |
|---|---|---|
| `Phase_2_Identity_And_Settings_Design.md` | All Stage 0 decisions + stage-by-stage breakdown | `4d11bbb` |
| `Multi_Tenant_Isolation_Audit_Day30.md` | 7 isolation issues investigated + verdict: company isolation proven | `08fbcb6` |
| `Access_Control_Configurable_Roles_Design.md` | Full Stage A (capability model, schema, defense-in-depth, defaults) | `4d21c25` |
| `isolation_test_harness.sql` | Re-runnable regression tool: per-company row counts + orphan check + expected-global verification | `b53aff1` |

**All design docs committed and read-only.** Safe to reference.

---

## Demo Readiness (7 days to June 15)

| Component | Status | Demo impact |
|---|---|---|
| Stage 1 (schema + groups) | ✅ Live | Foundation for branch model |
| Stage 2 (Settings UI) | ✅ Live | Broker can see Group & Branches |
| Stage 3a (app context) | 🎯 Ready to build | Branch switching feels real (not just UI) |
| Stage 3b (cross-branch RLS) | ⏭️ Deferred | Not demoed (no multi-branch group exists anyway) |
| Stage 4 (full lockdown) | ⏭️ Post-demo | After demo |

**Demo narrative:** "PropCRM multi-branch architecture is foundational. Right now, a broker's view is per-company (one group = one company). In Phase 3, we add the ability for a group to manage multiple companies with cross-branch visibility rules — we're laying that groundwork. Today you see the isolation working cleanly; Phase 3 adds the flexibility."

---

## Current Blockers & Open Questions

### None blocking demo. But clarify before Stage 3a build:

1. **Branch switcher state:** Is it already built (just needs audit), or zero?
2. **Active-branch context:** Is the app already threading it, or not wired?
3. **localStorage vs context:** How should active-branch be stored/passed?

**Once answered:** Stage 3a effort estimate is clear.

---

## Next Immediate Actions

**Priority 1 (this session):**
1. ✅ Confirm Stage 3a status (switcher + context wiring state)
2. Decide: build Stage 3a now, or defer (depends on effort vs. 7-day window)
3. If building: clarify active-branch storage mechanism + add to design doc

**Priority 2 (if Stage 3a deferred):**
- Assess what else is critical for demo (ask founder: anything blocking June 15?)
- Update roadmap to reflect post-demo sequencing

---

## Git References

**All work is on main (production).** Both branches synced.

| Stage | Commit | Tag | Status |
|---|---|---|---|
| Stage 0 | `4d11bbb` | design-locked | ✅ Design doc committed |
| Stage 1 | `eba5fe4` | stage1-complete | ✅ Schema live |
| Stage 2 | `2484792` | stage2-complete | ✅ UI + RLS fix live |
| Fix #5 | `3167db9` | — | ✅ localStorage resolved |

**Latest:** `main` at `b53aff1` (harness committed)

---

## How to Hand This Off

This doc should be:
1. ✅ Read by any developer joining the work
2. ✅ Updated after each stage completes (append new section, keep history)
3. ✅ Linked from the Phase 2 Backlog Master Doc

**To share:** Commit this to `docs/Phase_2_Identity_And_Settings_Handoff.md` alongside the design docs.

---

*Document created: 8 June 2026 (Day 29, end-of-session handoff)*  
*Captures: Stages 1–2 complete, Stage 3 scope clarified, demo readiness assessed*  
*Next: Clarify Stage 3a status, decide build/defer, proceed accordingly*
