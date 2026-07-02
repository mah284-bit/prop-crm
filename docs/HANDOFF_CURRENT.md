# PropCRM - Current Handoff (resume point)
_Last updated: 2 Jul 2026 (Day 45+)_

## WHERE WE ARE: Access-Control build COMPLETE; app-layer de-hardcoding (Path B) IN PROGRESS

### DONE + committed + pushed
- Commission Model: agent tier complete (Stage 5b), per earlier handoff. Live.
- ACCESS-CONTROL BUILD B-G COMPLETE (tag: acl-build-complete-day45). Harness, capability model
  (18 caps), crown-jewel double-locking (master agreements + brokerage commission), two-tier identity
  (super_admin=platform via is_super_admin flag, DB CHECK constraint; admin=tenant-top), capability-driven
  broker-visibility RLS (agent own / manager branch), Settings config UI (RoleCapabilitiesSection).
  Full role x table sign-off all green.
- GOVERNANCE BIBLE written (docs/Access_Control_Configurable_Roles_Design.md): PropCRM = enabler,
  complete first-cut setup, customer owns config post-handover via 1 trained role under change-approval;
  PropCRM retains leak-prevention + monitoring + structural/PropPulse/schema layers.

### IN PROGRESS: Path B - remove hard-coded roles from the APP layer
- Decision: super_admin (platform, is_super_admin flag) auto-pass OK; admin + ALL tenant roles configurable.
- DONE: hasCapability de-hardcoded; canDo(user,action) helper (src/lib/permissions.js) + ACTION_TO_CAPABILITY
  map; capabilities attached to currentUser (App.jsx loadUserCapabilities); InventoryModule fully migrated
  + VISUALLY VERIFIED (agent manage_inventory=false loses Add/Edit/Excel). First screen off hard-coded roles.
- HEAD = ab51162. Tree clean. All pushed.

## NEXT: continue Path B screen-by-screen (THE RECIPE)
grep screen for can(...) + inline "includes(currentUser.role)" arrays -> read what each gates -> map to
capability -> remove local duplicate can(), import canDo -> swap to canDo(currentUser, action) ->
build + visual verify (agent loses what they shouldn't) -> commit.

REMAINING ~34 sites: App.jsx(8), LeadDetail(5), Dashboard(3), DiscountApprovals(2), LeasingLeads(2),
LeasingModule(2), OpportunityDetail(2), ActivityLog(2), Opportunities(2), getVisibleCompanyIds(1),
PropertyMaster(1), LeaseOpportunityDetail(1), PaymentPlanTemplates(1). WATCH for hidden inline role arrays.
FINAL: retire can()+PERMS arrays from permissions.js; add 6 business caps to Settings matrix.

## OPEN / DEFERRED
- getVisibleCompanyIds can(role,"see_all") is HIGH-STAKES (visibility scoping, not a button) - migrate with care.
- group-GM cross-branch (forward-ready, no test surface). manage_settings edit-control (bible TBD).
- Monitoring routine (extend harness into scheduled leak-check - PropCRM retained duty).
