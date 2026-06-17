# Industry Research: Proposal & Unit Management Best Practices

**Research Date:** June 17, 2026  
**Focus:** How Salesforce, Zoho, HubSpot, Proposify, and specialized real estate CRMs handle proposals

## Key Findings

### 1. Decouple Proposals from Opportunities
- Proposals exist at LEAD level (before opportunity created)
- Also link to opportunities when deal formed
- Zoho stores documents at BOTH lead AND opportunity levels

### 2. Always Track Unit per Proposal
- Every proposal version records: which unit was quoted
- Enables: "What unit was in V2?" question
- Proposify auto-flags unit changes between versions

### 3. Multi-Version with Highlighted Diffs
- Zoho Contracts: Shows negotiation activity + version history
- When V2 created: "Changed from V1: Unit now DAM-06-03, Price -5%, Plan changed"
- Timestamps on every change with full audit trail

### 4. Unit Status Visibility
- Real estate CRMs track: Available → Reserved → Sold
- When unit becomes Reserved, ALL proposals with that unit show: "RESERVED - Change unit"
- Other brokers/buyers immediately aware

### 5. Real-time Sync Across Proposals
- Change unit status → auto-alert all proposals referencing it
- Suggest: "This unit now reserved. Change to alternate unit?"
- Update all buyer statuses simultaneously

## For PropCRM Phase 2.3

**Database Changes:**
```sql
-- Track unit per proposal
ALTER TABLE
