# Normalisation MAP — Day 40 (16 Jun 2026)

Operating checklist for the clean-up sprint. Rule: pre-op check -> ONE move -> save -> next.
No bulk movement. Verify which copy renders BEFORE deleting anything.

## App.jsx target: 6,708 lines -> goal under ~1,500 (shell + routing only)

## SECTION A — INLINE MODULES STILL IN App.jsx (extraction worklist)
| # | Component | App.jsx line | Component file? | Verdict |
|---|---|---|---|---|
| A1 | CompaniesModule | 5441 (294L) | YES (stale 362L, since 22 Apr) | TWIN — inline canonical |
| A2 | CreateOpportunityDialog | 977 (~1060L) | NO | EXTRACT (largest) |
| A3 | CoachPage | 2064 | NO | EXTRACT (dep: aiInvoke) |
| A4 | LogActivityModal | 2366 | NO | EXTRACT |
| A5 | GroupConsolidatedView | 2839 | NO | EXTRACT (small) |
| A6 | ProjectsModule | 2963 | NO | EXTRACT |
| A7 | ReservationModal | 3318 | NO | EXTRACT |
| A8 | UsersTab | 5204 | NO | EXTRACT |
| A9 | SettingsTab | 5405 | NO | EXTRACT |
| A10 | PermissionSetsModule | 5803 | YES? (7ab0069) | VERIFY TWIN |
| A11 | PwRecoveryForm | 6158 | NO | EXTRACT (small) |

## SECTION B — DEAD .bak FILES (delete, git holds history)
- src/App.jsx.bak
- src/components/CommissionOutstanding.jsx.bak
- src/components/InventoryModule.jsx.bak
- src/components/property/PropertyPackModal.jsx.bak
- src/components/PropPulse.jsx.bak

## SECTION C — ORPHAN SUSPECTS (verify whole tree before delete)
- CountryPicker, LeadPersonEditModal, Dashboard, UnitDetailPanel
- Likely NOT orphans (used by other components): ProposalBuilderDialog, OutcomeModal, StageCaptureDialog, PropertyPack leaves

## SECTION D — FORMS INLINE IN OpportunityDetail.jsx (defer)
- Send Proposal Email Modal (L4543), Add/Edit Payment Modal (L4576)

## OPERATING ORDER
1. Section B (.bak deletes) — zero risk
2. A1 CompaniesModule — confirmed twin, method template
3. A10 PermissionSetsModule — verify same-pattern twin
4. Rest smallest-first: A5, A11, A8, A9, A6, A7, A4, A3, A2
5. Section C orphan deletes
6. Section D — post-cleanup

Each row: pre-op dep check -> move -> npm run dev test -> commit -> next.
