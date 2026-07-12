# 🚨 CRITICAL CLEANUP — MUST COMPLETE POST-DEADLINE

**Status:** MANDATORY  
**Priority:** 🔴 CRITICAL  
**Owner:** Abid Mirza (architect decision)  
**Timeline:** Immediately after 18 July 2026 deadline  
**Deadline:** No later than 25 July 2026  

---

## WHAT MUST BE DONE

**52 orphaned files** must be audited and deleted:

### Location 1: src/components/
- auth/ (6 files) — duplicate of modules/auth/
- comms/ (7 files) — superseded Phase 2 attempt
- dialogs/ (4 files) — unused
- form/ (4 files) — unused
- leads/ (4 files) — unused
- property/ (2 files) — ProjectDetailPanel, UnitDetailPanel
- Plus: 15+ individual orphaned files

### Location 2: src/lib/
- business.js
- conversionHandler.js
- proposalSuccessHandler.js
- quickProposalFlow.js

### Location 3: src/modules/
- auth/ (6 files) — old version

---

## CLEANUP BRANCH

**Branch:** `cleanup/orphaned-code-removal` (already created)  
**Safe tag:** `before-orphaned-cleanup` (already tagged)

Ready to use. No setup needed.

---

## PROCESS (NON-NEGOTIABLE)

1. **Manual review** — EACH file verified before deletion
2. **Git history check** — understand why it was created
3. **Search for hidden imports** — ensure nothing uses it
4. **Delete on cleanup branch** — isolated, safe
5. **Test thoroughly** — app must work without it
6. **Merge to main** — only after confidence

---

## WHY THIS MATTERS

- **Audit readiness** — clean codebase, documented cleanup
- **Developer onboarding** — no confusion about old vs new code
- **Technical debt** — prevents compounding complexity
- **Maintainability** — reduces maintenance surface area

---

## NON-NEGOTIABLE DEADLINE

**Must be complete by: 25 July 2026**

This is NOT a nice-to-have. This is foundational.

---

*Document created: 12 July 2026, 6am*  
*Architect: Claude*  
*Decision: DEFER to post-deadline, EXECUTE without fail*  
*Audit readiness: This document proves intentional cleanup, not neglect*

### FINDING: QuickProposalsPanel Duplication (Day 12)

**Location:** `src/components/leads/QuickProposalsPanel.jsx`

**Issue:** Proposal sending logic duplicated here + in Opportunities module
- Line 21: "Quick Quote" button
- Line 23: "📋 View Quotes" button
- Separate from opp-level proposal workflow

**Status:** WORKING but architecturally suspect (appears orphaned or duplicative)

**Action:** Audit in cleanup sprint - determine if:
1. Actually used/imported?
2. Can be consolidated with Opportunities proposals?
3. Should be deleted?

**Date Found:** 12 July 2026
