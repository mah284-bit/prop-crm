# PHASE 3 — CRITICAL ARCHITECTURAL DEBT

**Date:** 11 July 2026
**Severity:** BLOCKING Phase 3.2+

## Problem: THREE OPP CREATION FORMS

1. LeadDetail.jsx (inline)
2. OpportunityDetail.jsx (edit)  
3. CreateOpportunityDialog.jsx (users see THIS)

Features added to wrong form = invisible to users.

## CRITICAL LOGIC RULES FOR CONSOLIDATED FORM

### Rule 1: Lead Context Awareness
- **If called from LeadDetail** → Lead ALREADY KNOWN
  - Don't ask "which lead?"
  - Auto-populate lead from context
  - User sees: "For: [Lead Name]" (read-only)
  
- **If called from CreateOpportunityDialog** → Need to select lead
  - Ask "Find or create buyer" first
  - Then show opp details

### Rule 2: Lead-First Flow
- Opp creation always needs valid lead
- Lead selection = Step 1
- Opp details = Step 2
- Cannot proceed without lead

## The Consolidated Form Must Handle:

✅ Auto-detect caller context (LeadDetail vs Dialog)
✅ Adjust flow based on context
✅ Never ask for lead twice
✅ Reusable in all 3 locations

## Status

BLOCKED: Phase 3.2+ until form consolidated
NEXT: Consolidation with above logic
