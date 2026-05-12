# Code Cleanup & Structured Refactor Plan
**Phase B — Post-Demo Architectural Hygiene**

**Captured:** 12 May 2026 (Tuesday evening, pre-demo)
**Target execution:** Week of 19 May 2026 (post-demo)
**Author context:** Captured during Tuesday dry-run session where multiple
orphan code paths AND massive file size were discovered. Founder
observations:
- *"i feel there is a lot of orphan code around here"*
- *"app.jsx file is 15000 lines any thoughts"*
- *"vercel runs ai runs and api dire no need here in this doc"*

---

## 1. Why This Document Exists

PropPlatform has grown rapidly. Today we have:

- Working monolithic `App.jsx` (the live code path) — **14,932 lines**
- Multiple `src/components/*.jsx` files that are NOT imported (dead code)
- Dual implementations of same feature (Leads, OpportunityDetail)
- Comments like "Phase F W5 cut-over" indicating incomplete migrations
- Pattern duplication (two different unit pickers)

**The app works.** This is technical debt, not a bug. But left unmanaged
it will: confuse engineers, slow features, create risk when "fixing the
wrong file" (this happened tonight!), inflate bundle size, make code
review impossible.

**Today's lesson:** During Edit Opportunity development on 12 May, the
fix was first applied to `src/components/OpportunityDetail.jsx` (orphan,
not imported). After ~30 minutes debugging, we discovered the live code
is INLINE in App.jsx (line 4815). Reverted orphan, re-applied to App.jsx.

---

## 2. Known Orphan Files (Verified)

| File | Size | Live equivalent |
|---|---|---|
| `src/components/Leads.jsx` | 394 lines | App.jsx line 9487 |
| `src/components/OpportunityDetail.jsx` | 1,119 lines | App.jsx line 4815 |

Verification:
```bash
grep -rn "from.*components/Leads\|import Leads" src/ 2>/dev/null
grep -rn "from.*components/OpportunityDetail\|import OpportunityDetail" src/ 2>/dev/null
# Both empty -> orphan confirmed
```

**Audit step needed:** Run `npx knip` for systematic dead-code detection.

---

## 3. Architectural Issues

### 3.1 Dual Form Implementations
- **Lead creation:** V1 form (App.jsx) + V2 form (LeadCreationFormV2.jsx) — feature flag `useNewForm`
- **Opportunity creation:** Rich multi-step CreateOpportunityDialog (line 8127) + simpler form (line 9847)

### 3.2 State Variable Naming Collisions
`selOpp` declared in TWO scopes:
- App.jsx line 9220 (Opportunities component)
- App.jsx line 9493 (Leads component)

JavaScript scoping handles this, but grep-based debugging is unreliable.

### 3.3 Unit Picker Inconsistency
- **Pattern 2** (simple) — was in proposal builder until 12 May
- **W6.2** (rich: project pills, bedroom filters, reserved toggle) — opportunity creation
- **UnitSearchPicker** (extracted Pattern 2, 12 May) — proposal builder + Edit Opp

**Phase B target:** ONE component (UnitSearchPicker upgraded to W6.2's richness) everywhere.

### 3.4 Incomplete Migration Comments
- "Phase F W5 cut-over"
- "Phase F W6.2 — searchable unit picker"  
- "Phase E dense layout"
- "Finding 1/2 fix (11 May 2026)"

---

## 3.5 File Size Evidence — Hard Numbers (12 May 2026)

### Frontend (src/) inventory

| File | Lines | % of frontend |
|---|---|---|
| **src/App.jsx** | **14,932** | **58%** |
| MasterAgreements.jsx | 1,660 | 6.4% |
| OpportunityDetail.jsx (ORPHAN) | 1,119 | 4.3% |
| InventoryModule.jsx | 961 | 3.7% |
| LeaseOpportunityDetail.jsx | 956 | 3.7% |
| PropPulse.jsx | 839 | 3.3% |
| LeadCreationFormV2.jsx | 642 | 2.5% |
| LeasingModule.jsx | 595 | 2.3% |
| CommissionOutstanding.jsx | 478 | 1.9% |
| LeasingLeads.jsx | 476 | 1.8% |
| ReportsModule.jsx | 435 | 1.7% |
| AIBubble.jsx | 428 | 1.7% |
| Leads.jsx (ORPHAN) | 394 | 1.5% |
| CompaniesModule.jsx | 362 | 1.4% |
| PermissionSetsModule.jsx | 355 | 1.4% |
| LeasingDashboard.jsx | 295 | 1.1% |
| UserManagement.jsx | 227 | 0.9% |
| Dashboard.jsx | 210 | 0.8% |
| UnitSearchPicker.jsx | 182 | 0.7% |
| DiscountApprovals.jsx | 147 | 0.6% |
| **TOTAL frontend JSX** | **25,788** | **100%** |

**File size:** App.jsx = 930K

### The smoking gun
- App.jsx alone has 14,932 lines — **9x larger** than next biggest file
- App.jsx is **58% of entire frontend** codebase
- Other 20 components combined: 10,856 lines

### Industry benchmarks

| Range | Status |
|---|---|
| < 500 lines | Healthy |
| 500-1,500 | Acceptable for major modules |
| 1,500-3,000 | Smell |
| 3,000-5,000 | Strong smell |
| 5,000-10,000 | Anti-pattern |
| **>10,000 lines** | **God Object — refactor mandatory** |

**App.jsx at 14,932 lines = firmly in "God Object" territory.**

### Real consequences experienced tonight
- 30 min debugging Edit Opp in wrong file (orphan)
- Vite hot reload lost changes (had to restart vercel dev)
- grep returns flood of results across 15K lines
- "Where does X live?" requires line-number archaeology

### Phase B target

After Phase B, no single file should exceed **3,000 lines**.
App.jsx target: reduce from 14,932 to **<5,000 lines** by extracting
big inline functions to dedicated component files.

---

## 4. Three-Phase Architecture Journey

### Phase A — Now → Demo (12-14 May 2026)
- Finish features in App.jsx, don't refactor
- Capture debt in this document
- Demo with working software

### Phase B — Post-Demo Cleanup Sprint (Week of 19 May 2026)
- 5 days of dedicated cleanup
- See Section 5 detailed plan
- Heavy testing after each change
- **Target: App.jsx <5,000 lines**

### Phase C — Long-Term Architecture (Post-Funding)
- Hire experienced engineer
- App.jsx → <1,000 lines (pure orchestrator)
- Test coverage + TypeScript migration
- Component library
- CI/CD automated checks

---

## 5. Phase B Detailed Plan (5 Days)

### Day 1: Discovery (4h)
- Run `npx knip` / `npx ts-prune` — list all unused exports
- Update this doc with complete orphan inventory + risk levels
- Tag `pre-cleanup-19-may-2026` for safety

### Day 2: Low-Risk Cleanup (4h)
- Delete confirmed orphans: Leads.jsx (394 lines), OpportunityDetail.jsx (1,119 lines)
- Verify after each delete: `npm run build && npm run dev`
- Test critical flows: Login, Leads CRUD, Opps CRUD, Stage gates, Master Agreements, Proposal builder, Commission outstanding
- Commit + tag "low-risk-cleanup-done"
- **Expected: ~1,500+ lines of dead code removed**

### Day 3: Picker Unification (4h)
- Extract W6.2 features (project pills, bedroom pills, reserved toggle, result count, reserved confirmation dialog) into UnitSearchPicker
- Replace W6.2 inline picker in `CreateOpportunityDialog`
- All UnitSearchPicker invocations use rich version
- Test all unit-picking flows

### Day 4: Form Consolidation (4h)
- Decide V1 vs V2 lead form, remove unused
- Same for opportunity creation
- Make Edit Opp share form with Create Opp (deferred from 12 May)
- Remove `useNewForm` feature flag

### Day 5: Module Extraction (4h)
- Extract top 3 biggest inline functions from App.jsx:
  1. `OpportunityDetail` (~3,000 lines) → its own file
  2. `Leads` (~700 lines) → its own file
  3. `Opportunities` (~500 lines) → its own file
- Add lint rule: `no-unused-imports: error`
- Add `npm run audit:dead-code` (runs knip)
- Document in `ARCHITECTURE.md`
- **Target verified: App.jsx <5,000 lines**

---

## 6. Risk Management

### What can go wrong
1. Deleting an "orphan" that turns out to be used → build/smoke test after each delete
2. Breaking flow during picker unification → test ALL picker uses
3. Form consolidation breaking saved data → test create + edit end-to-end
4. Module extraction breaking imports → small extractions, build verify

### Safety net
- `pre-cleanup-19-may-2026` tag = absolute rollback
- `v1.5-stage-gates-complete-pre-demo` tag = working demo state
- Git history = every commit recoverable

---

## 7. OUT OF SCOPE for Phase B

### 7.1 Backend (`/api/`) — HEALTHY, OUT OF SCOPE

**Inventory (12 May 2026):**
- 12 serverless functions
- 1,562 total lines (avg ~130 lines/file)
- No reported issues

**Verdict:** Backend is in healthy shape. Vercel handles deployment.
Each function isolated. No urgent cleanup needed.

If issues arise, schedule separate **Phase B' Backend Audit** for:
- Unused endpoints
- AI prompt version control
- Rate limit configuration
- Error handling consistency

### 7.2 Database schema — Phase C
- Orphan columns possible (Issue 8: old vs new payment shape)
- Unused tables possible
- FK audit needed
- Requires careful migrations

### 7.3 Build/Deploy — Phase C
- Bundle size optimization
- Code splitting
- Currently works fine

### 7.4 CSS/Styling — Phase C
- Currently inline styles
- Future: Tailwind or CSS modules
- Touches every file → big scope

### 7.5 TypeScript Migration — Future
- Would prevent class of bugs
- Major undertaking
- Post-funding decision

### 7.6 Testing — Phase C
- Currently no unit tests
- Need: Vitest + React Testing Library
- Test critical flows first

---

## 8. Founder Observations Preserved

> *"before this chat since the app was growing bigger broken to components
> now back to square one let use finish all the code and finally keeping
> a clean copy will take a call to try to cleanup the broken/orphan code"*

> *"app.jsx file is 15000 lines any thoughts"*

> *"i cant decide i leave it to my Architect i only flagged"*

> *"vercel runs ai runs and api dire no need here in this doc"*

> *"i agree with you explanation... never thought even the ask should be structured"*

**These are correct engineering instincts.** Most startups go through:
1. Build fast (monolith works)
2. Try to extract components (incomplete)
3. Realize technical debt exists
4. **Notice size starts hurting** ← founder flagged this
5. Deliberate cleanup sprint
6. Clean architecture maintained

We're at step 4 → 5. This document is the plan.

---

## 9. Success Criteria

Phase B is "done" when:

- ✅ No orphan files in src/components/
- ✅ `knip` returns clean (no unused exports)
- ✅ ONE unit picker used everywhere (UnitSearchPicker w/ W6.2 features)
- ✅ ONE form per CRUD operation (no V1/V2 duplication)
- ✅ **App.jsx reduced from 14,932 to <5,000 lines**
- ✅ Build passes
- ✅ All critical flows tested
- ✅ ARCHITECTURE.md documents current state

**Estimated effort: 20-25 hours of focused work over 5 days.**

---

## 10. Beyond Phase B

| Phase | When | Goal |
|---|---|---|
| Phase B' | After Phase B (if needed) | Backend audit |
| Phase C | Post-funding | Long-term clean architecture |
| Phase C.1 | Engineer hire | App.jsx → <1,000 lines |
| Phase C.2 | Quality gates | Test coverage, TypeScript |
| Phase C.3 | Scale prep | Performance, monitoring, CI/CD |

---

*Last updated: 12 May 2026 (Tuesday evening, late)*
*Founder energy at capture: 14+ hours into day, after 3-hour nap, still flagging quality concerns. Excellent instinct.*
