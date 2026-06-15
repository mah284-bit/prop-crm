# PreOperative: Lead-Opportunity Unified Component Analysis

## QUESTION 1: What flows exist?

### Sales Path
Lead → Opportunity (Deal) → Proposal → Negotiation → SPA → Closed Won

### Leasing Path  
Lead → Lease Opportunity (Rental) → Lease Agreement → Lease Signed → Active Tenant

## QUESTION 2: What's COMMON to BOTH?
- Activity log
- Person management
- Unit/project reference
- Stage tracking

## QUESTION 3: What's DIFFERENT?

### Sales Opp (OpportunityDetail.jsx - 4776 lines)
- Proposal versioning (V1, V2, V3)
- Negotiation rounds
- Commission tracking
- Payment plan builder
- SPA signing

### Leasing Opp
- Lease agreement terms
- Rent schedule
- Tenant eligibility
- Lease renewal

## QUESTION 4: Architecture Options

**OPTION A:** Single component (8000+ lines)
- Risk: Sales logic bleeds into leasing

**OPTION B:** Separate components + shared pieces
- SalesOppDetail (proposal + negotiation)
- LeasingOppDetail (lease terms)
- Shared: ActivitiesList, PersonManager
- Cleanest, no compromise

**OPTION C:** Polymorphic component
- One component, type prop
- Complex conditional rendering

## PRE-OPERATIVE DECISION REQUIRED

1. Does leasing opp exist as separate file or in App.jsx?
2. Can leads + opps truly be merged or stay separate?
3. ARCHITECT REC: OPTION B (separate with shared pieces)

Founder decision: Which OPTION?
