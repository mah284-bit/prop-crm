# Sprint Roadmap — Week of 19-25 May 2026
**Post Math Flow Sprint — Polish + Tester Prep**

**Created:** 15 May 2026 (Friday afternoon, post-brunch)
**Status:** Active plan
**Predecessor:** v2.1-math-flow-end-to-end (Day 3 of Math Flow Sprint)
**Next milestone:** Investor demo (~22-27 May 2026)

---

## 1. Current State

### What's done (3 days of sprint)
- ✅ Phase 1 schema migration (13 current_* columns)
- ✅ 7 Touch Points complete (math flows through all 8 stages)
- ✅ Proposal versioning fixed (V1, V2, V3 work correctly)
- ✅ Two-Layer architecture spec documented
- ✅ Final-Proposal-First Phase B vision captured
- ✅ Math validated: 623,694 → 604,983 (3% discount) → 24,199.32 commission
- ✅ Golden tag: `v2.1-math-flow-end-to-end`

### Backlog accumulated
- 5 P1 items (tester critical)
- 8 P2 items (polish)
- 4 Phase B items (post-investor)

### Risk assessment
**LOW risk:** Math foundation is solid. UI gaps don't block demo.  
**MEDIUM risk:** Some UX issues are visible (proposal blank form, stage gates).  
**HIGH risk:** None blocking.

---

## 2. Goals for the Week

### Primary goal
**Tester-visit-ready system** by Thu 21 May evening or Fri 22 May.
Brokers should be able to walk through a deal without obvious gaps.

### Secondary goal
**Investor demo polish** — confidence in showing real workflow + math.

### Non-goals
- Final-Proposal-First refactor (Phase B, June)
- PDF generation (Phase B)
- Major architectural changes

---

## 3. Daily Plan

### Monday 19 May 2026 — Quick Wins Day

**Goal:** Clear the "duplicate path" UX confusion.

| Task | Effort | Impact |
|---|---|---|
| ARCH-SIMPLIFY-001: Remove "Send Proposal" from Site Visit closure | 1.5 hr | High — removes broker confusion |
| ARCH-SIMPLIFY-002: Remove "Send Proposal" from Proposal Sent stage actions | 1.5 hr | High — single path for proposals |
| BUG-ACTIVITY-DUPLICATE: Fix failed save creating activity log entry | 30 min | Medium — cleaner audit trail |

**Pattern:** Each is a small surgical edit in App.jsx + test.

**Day-end goal:** 3 commits, 3 P1 items done, cleaner UI for brokers.

**Safety tag:** `pre-monday-cleanup-19-may-2026` before any work.

---

### Tuesday 20 May 2026 — Completed Stage UX

**Goal:** Brokers can see what happened in completed stages without re-entering data.

| Task | Effort | Impact |
|---|---|---|
| UX-COMPLETED-STAGE-001: Clicking completed stage shows readonly view | 3 hr | High — major UX win |
| UX-PROPOSAL-DETAILS-INLINE: Show price + budget on opp detail screen | 2 hr | Medium — better at-a-glance |

**Implementation pattern for UX-COMPLETED-STAGE-001:**
- Detect when stage is < current opp.stage (completed)
- Render readonly view from stored activity data
- "Edit" button to switch to editable mode if needed
- Don't open blank form

**Day-end goal:** Brokers see past stage data, no re-entry confusion.

---

### Wednesday 21 May 2026 — Proposal History Day

**Goal:** Brokers can see proposal history and edit-as-new-version.

| Task | Effort | Impact |
|---|---|---|
| UX-PROPOSAL-HISTORY-001: Show proposal history + pre-fill form on "Send Revised" | 1 full day | **CRITICAL** — biggest UX gap |

**Why this is a full day:**
- Modify ProposalBuilderDialog to detect existing proposals
- Show history view at top of dialog (V1, V2, V3 with status)
- "Edit and send as new version" button → pre-fills form with latest version's values
- Save creates next version, auto-marks previous as superseded
- All math values carry forward
- Test thoroughly

**Day-end goal:** Negotiation feels like a continuous conversation, not blank forms.

**This is the item brokers will most appreciate.** Investor demo win.

---

### Thursday 22 May 2026 — SPA Dialog Cleanup

**Goal:** SPA Signed dialog is clean, pre-fills properly, no confusing repetition.

| Task | Effort | Impact |
|---|---|---|
| SPA dialog UX cleanup (your noted "many data point issues") | 3-4 hr | High — most complex stage |
| Buffer for issues found during cleanup | 1-2 hr | — |

**What needs cleaning (founder's observations 15 May 2026):**
- Repetitive fields (some asked multiple times)
- Doesn't pre-fill DLD payer from current_dld_payer (should be 'split')
- Doesn't pre-fill from proposal V3 (last sent)
- Final Agreed Price field behavior (already fixed today, verify holds)
- Pre-SPA payments status defaults could be smarter
- Booking + Reservation credits need clearer display

**Day-end goal:** SPA dialog is clean enough for tester walkthrough.

---

### Friday 23 May 2026 — Buffer + Tester Smoke Test

**Goal:** Verify everything works in a clean end-to-end test.

| Task | Effort | Impact |
|---|---|---|
| Catch-up on any pending P1 items | 2 hr | — |
| Tester smoke test: Walk through Rajesh's opp from scratch | 1.5 hr | Critical |
| Document tester-visit script | 1 hr | Polish |
| Final commit + golden tag | 30 min | Safety |

**Smoke test path:**
1. Create new opp (or use Rajesh's)
2. Advance through all 8 stages
3. Verify math at each stage
4. Note any remaining issues
5. Fix critical issues
6. Re-test
7. Lock in with golden tag

**Day-end goal:** `v2.5-tester-ready` golden tag, ready for tester visit.

---

## 4. Items Deferred to Phase B (June 2026)

These are explicitly NOT being done this week:

| Item | Reason | When |
|---|---|---|
| Final-Proposal-First architecture | Big refactor, needs dedicated 5 days | Post-investor |
| PDF generation for proposals | Nice-to-have, not blocking | Post-investor |
| pp_negotiations subsystem refinement | Already working at MVP level | Post-investor |
| VALIDATION-STAGE-FLOW-001 (auto-advance) | Workaround exists | Post-tester |
| UX-NEGOTIATION-PAYMENT-001 (preset payment plans) | Minor inconsistency | Post-tester |
| UX-UNIT-PICKER-PRICE | Already done in some places | Post-tester |
| BUG-AI-NO-FALLBACK | API key is set now | Post-tester |
| DOC-001 Environment Setup procedure | Documentation only | Anytime |

---

## 5. Daily Discipline (Rules of the Sprint)

### Before any code change
- ✅ Pull latest from main
- ✅ Create safety tag (`pre-{task}-{date}`)
- ✅ Read relevant file sections first

### During coding
- ✅ Surgical edits only (Python `apply_edit` pattern from Day 1-3)
- ✅ Pure ASCII anchors
- ✅ One file at a time

### After each task
- ✅ Test in browser (hard refresh + fresh tab if needed)
- ✅ Verify in Supabase if DB involved
- ✅ Commit immediately on success
- ✅ Tag if it's a milestone

### When in doubt
- ✅ Use dry-run methodology
- ✅ Find real bug, document, fix surgically
- ✅ Don't refactor under pressure
- ✅ Phase B is when team grows

---

## 6. Success Criteria

### End of Monday
- [ ] 3 P1 items done
- [ ] No "Send Proposal" duplicate paths
- [ ] No phantom activity entries

### End of Tuesday
- [ ] Completed stage views work
- [ ] Opp screen shows full math context

### End of Wednesday
- [ ] Proposal "send revised" pre-fills from V_latest
- [ ] Proposal history visible on opp screen
- [ ] V1, V2, V3 status clearly shown

### End of Thursday
- [ ] SPA dialog is clean and pre-fills correctly
- [ ] Multiple test walkthroughs without UX confusion

### End of Friday (Tester visit ready)
- [ ] Full end-to-end dry-run passes
- [ ] Tester visit script ready
- [ ] All P1 items committed and tagged
- [ ] Golden tag: `v2.5-tester-ready`

---

## 7. Investor Demo Path (~22-27 May)

After tester visit and fixes, investor demo path:

### Demo flow
1. **Show landing** — clean dashboard
2. **Open opportunity** — math visible (price, discount, commission)
3. **Walk through stage transitions** — math flows correctly
4. **Show proposal history** — V1, V2, V3 with full audit trail
5. **Show negotiation rounds** — buyer asks captured separately
6. **Show SPA Signed** — final price, commission, VAT all calculated
7. **Show Closed Won** — deal complete, audit trail full

### Demo narrative
> "PropCRM tracks every change in a deal's lifecycle. Watch the math
> flow: 623,694 list price, 3% discount in proposal V3, 50/50 DLD split,
> 604,983 final agreed price. Every stage shows the same math. Every
> change is auditable. Brokers can revert to any prior proposal with
> one click. This is real estate CRM with engineering discipline."

### Architecture pitch points
- Two-Layer architecture (live state + history)
- Proposal versioning + audit trail
- Stage-gated workflow with validation
- Phase B: Final-Proposal-First simplification

---

## 8. Contingency

### If we fall behind
**Priority drop order:**
1. UX-PROPOSAL-DETAILS-INLINE (Tuesday) — can skip
2. SPA dialog full cleanup (Thursday) — do minimum
3. Friday buffer — use for catching up

### If we're ahead
**Pull from P2:**
- UX-NEGOTIATION-PAYMENT-001
- VALIDATION-STAGE-FLOW-001
- BUG-AI-NO-FALLBACK polish

### If big issue found during testing
- Stop, document precisely
- Decide: fix now vs Phase B
- Don't get stuck on edge cases

---

## 9. Tracking

### Daily updates expected
- Morning: confirm safety tag, plan today's task
- Mid-day: progress check
- End-of-day: commit, summary, tomorrow's prep

### Weekly snapshot (Fri afternoon)
- What got done vs planned
- What's pushed to Phase B
- Investor demo readiness rating (1-10)
- Tester visit feedback (if visited Mon-Tue scenario)

---

## 10. Notes

### Things that went well in past sprint
- Dry-run integration testing caught real bugs
- Surgical edit pattern (Python apply_edit) zero broken commits
- Architecture documentation while building (not after)
- Safety tags every day prevented disasters
- Founder + AI collaboration style is productive

### What to continue
- Same methodology
- Document insights as they emerge
- Commit small, commit often
- Test in browser AND DB after each change

### What to improve
- Don't get stuck on single bugs > 30 min
- Recognize stale browser tab issues faster
- Lean on Phase B more for deeper architecture work

---

*Created: 15 May 2026 (Friday afternoon)*
*Author: Founder Abid Mirza + AI assistant*
*Status: Active plan, review at end of each day*
*Next checkpoint: End of Monday 19 May*
