# Phase 2.4: Unit-to-Opportunity Conversion

## OBJECTIVE
Clean conversion from Quick Proposal → Opportunity without database junk.

## FLOW

### Phase 1: Send (No DB Save)
- Broker: "Send proposal Units 1,2,3"
- Generate PDF + upload to Storage
- Send to buyer
- ✓ PDF URL persists in Storage
- ✗ NO proposal record saved in DB

### Phase 2: Wait (No DB Impact)
- Buyer responds: "I like Unit 2"
- Hours/days/weeks pass
- ✓ PDF still accessible
- ✗ Nothing in DB

### Phase 3: Convert (Smart Opp Creation)
- Broker clicks: "Unit 2 → Create Opp"
- AI auto-fills:
  - Buyer: Peter (from lead)
  - Unit: DAM-06-02 (broker confirmed)
  - Price: AED 988,210 (fetch unit_pricing)
  - Payment Plan: 50/50 (fetch unit_pricing)
  - Developer: DAMAC (fetch unit)
  - Project: DAMAC Lagoons (fetch project)
  - Amenities: (fetch project)
- Broker reviews (2 seconds)
- [Create Opportunity] ← ONE CLICK
- ✓ ONE clean Opp record in DB

## BENEFITS
- ✅ No proposal records = clean DB
- ✅ No duplicate data
- ✅ Scales to 1000 proposals/month
- ✅ Broker workflow: 2 clicks
- ✅ All data auto-fresh from source tables

## TECHNICAL APPROACH
1. Add "Convert to Opp" button to QuickProposalsPanel
2. Pass unit_id to conversion handler
3. Fetch unit_pricing, project, developer data
4. Pre-fill CreateOpportunityDialog
5. Broker clicks [Create]

## DATABASE IMPACT
- proposals table: NOT used (or minimal metadata only)
- opportunities table: Single record per deal
- Data stays in: unit_pricing, units, projects, developers

## NEXT STEPS
1. Modify QuickProposalsPanel: Add convert button per unit
2. Create conversionHandler.js
3. Integrate with CreateOpportunityDialog
4. Test end-to-end
