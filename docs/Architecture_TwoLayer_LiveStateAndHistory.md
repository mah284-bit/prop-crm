# Two-Layer Architecture Pattern
**Live State + Versioned History — The Right Pattern for PropCRM**

**Captured:** 14 May 2026 (Thursday afternoon)
**Status:** APPROVED architecture pattern
**Origin:** Founder Q&A during Day 2 dry-run when investigating proposal-vs-opportunity data model

---

## 1. The Question That Led Here

During Day 2 of the Math Flow Sprint, while testing how proposal data flows
through stages, founder raised a critical architectural question:

> *"what we are selecting for send a proposal is part of Opportunity, I told
> in here that after this a proposal will go which a print document, the actual
> design when in the flow it got changed to opportunity and proposal i cant
> remember"*

> *"thats the reason i pushed you that i need a edit on the opportunity as we
> go with standards and broker know he will put all the details, on this and
> when you negotiate these are the things you edit and send a another revised
> proposal which should have been report firing using the data lying in the
> opportunity"*

**The initial frustration was valid:** the proposal form felt disconnected
from the opportunity — like there were two places to enter the same data.

---

## 2. The Insight That Resolved It

Founder evolved the thinking in real-time:

> *"the data capture during the proposal, and the edits we do on the
> opportunity, history has to recorded to for analysis how this started
> how many changes, negotiations happening. all the key elements we are
> asking is i think let be as this will give us the history"*

> *"only thing is we have to change the naming conventions, but we also
> have a negotiation model which can take care of the history"*

**Key realization:** History IS the feature, not a bug.

The two-table pattern (opportunities + proposals) isn't duplication — it's
**structurally correct** for audit trail systems.

---

## 3. The Pattern: Live State + Versioned History

This is how mature systems handle entities that change over time with
auditability requirements.

### The Two Layers

```
LAYER 1: LIVE STATE (current truth)
─────────────────────────────────────
opportunities.current_*  ← "what is true right now"
- current_agreed_price
- current_discount_*
- current_dld_*
- current_admin_fee
- current_trustee_fee

Used by: next stage gates, calculations, displays, decisions
```

```
LAYER 2: VERSIONED HISTORY (audit trail)
─────────────────────────────────────
proposals table         ← "what we sent to buyer"
- version 1, 2, 3, ...
- each row is a snapshot
- status: sent / superseded / accepted / rejected

(Future) pp_negotiations table ← "internal negotiation rounds"
- version 1, 2, 3, ...
- each row captures internal team agreement
```

### The Synchronization Rule

When a versioned entity is saved (Layer 2 INSERT), the live state (Layer 1)
must sync automatically:

```javascript
// Save proposal (Layer 2)
const proposal = await supabase.from('proposals').insert({
  version: nextVersion,
  asking_price, discount_pct, dld_handling, ...
});

// Sync live state (Layer 1) - MANDATORY
await supabase.from('opportunities').update({
  current_agreed_price: proposal.final_price,
  current_discount_type: proposal.discount_type,
  current_dld_payer: proposal.dld_payer,
  current_values_updated_at: NOW(),
  current_values_updated_by: user.id,
}).eq('id', opp.id);
```

**Both happen in the same transaction.** Layer 2 = history, Layer 1 = current.

---

## 4. Why This Pattern Is Correct

### Pattern 1 — Banking
```
Bank account:
  Balance:     $5,000          ← Live state (Layer 1)
  Transactions: ...history...   ← Audit trail (Layer 2)
  
You can see your balance instantly.
You can trace every transaction that got you there.
Same pattern.
```

### Pattern 2 — Email
```
Mailbox view:
  Inbox:        12 unread       ← Live state
  Email log:    every email ever ← History
  
Inbox shows what's relevant now.
History shows the full record.
```

### Pattern 3 — Git
```
Repository:
  HEAD:        latest commit    ← Live state
  All commits: every version    ← Versioned history
  
HEAD is the current code.
Every commit is preserved forever.
```

**PropCRM follows this same pattern:**
- `opportunities.current_*` = HEAD (live)
- `proposals` table = commit history (versioned)

---

## 5. Why Brokers Will Love This

### Business value
- **"How did we get to this price?"** → Show proposal history (V1: 5%, V2: 3%, V3: final)
- **"What changed in last round?"** → Diff V2 vs V3
- **"Who made the last edit?"** → audit fields tell you
- **Disputes:** "I never agreed to that price" → Show signed V3 PDF + proposal record

### Analytics that emerge
- Average number of negotiation rounds per Closed Won
- Common discount % per developer  
- Time-to-Closed Won by negotiation complexity
- Which brokers close fastest

### Investor narrative
> "PropCRM tracks every price change, every concession, every counter-offer
> across the deal lifecycle. Brokers and developers can prove what was
> agreed, when, and by whom. This is the auditability that real estate
> compliance demands."

---

## 6. The Workflow This Enables

### Initial proposal
```
1. Broker opens opp
2. Clicks "Send Proposal"
3. Enters: asking price, discount, DLD, payment plan, validity
4. Save:
   → proposals table: INSERT v1 (status: sent)
   → opportunities: UPDATE current_* from this proposal
   → activities log: "Proposal v1 sent"
```

### Negotiation
```
1. Buyer responds (verbal or written)
2. Broker clicks "Send Revised Proposal"
3. Edits values (new discount, etc.)
4. Save:
   → proposals: INSERT v2 (status: sent)
   → proposals: UPDATE v1 (status: superseded)
   → opportunities: UPDATE current_* from v2
   → activities: "Proposal v2 sent"
```

### Acceptance
```
1. Buyer accepts (signed copy, email, etc.)
2. Broker marks v2 as accepted
3. opp advances to "Offer Accepted" stage
4. opp.current_* is now the FINAL agreed values
```

### History view (UX needed in Phase B)
```
Proposal History
─────────────────
v1   5% discount, buyer pays DLD    (sent → superseded)
v2   3% discount, 50/50 DLD         (sent → accepted) ← LATEST
                                    
Buyer paid: AED 605,683
Negotiated total: 2 rounds
Time to acceptance: 7 days
```

---

## 7. What Stays the Same

### Architecture
- ✅ proposals table is the audit trail (don't remove)
- ✅ opportunities.current_* is live state (today's fix completes this)
- ✅ ProposalBuilderDialog is the "edit" interface
- ✅ Versioning via `version_number` column

### Code
- ✅ Day 1 schema migration (current_* columns)
- ✅ Day 2 Touch Point #1 fix (opp creation sets current_*)
- ✅ Day 2 Touch Point #2 fix (proposal save syncs to current_*)
- ✅ Day 2 Touch Point #6 fix (SPA reads from current_*)

---

## 8. What Changes (Phase B Work)

### Naming clarifications (UX clarity, not architecture)
- "Send Proposal" → maybe "Send Quote" or "Generate Proposal"
- "Edit Proposal" → could be "Negotiate Terms"
- Show "Proposal V3 (current)" prominently

### UX improvements (visible audit)
- Show proposal history strip on opp detail page
- "What changed?" tooltip between versions
- Filter: "show me opps with >3 negotiation rounds"

### PDF generation (real customer-facing)
- "Send Proposal" should generate actual PDF
- PDF stored in pp_documents
- Email PDF to buyer (with copy in system)
- Buyer signs PDF, returns it, marks "accepted"

### Same pattern for Negotiation
- `pp_negotiations` table (NEW, Phase B)
- Each negotiation round = new row
- Marks previous rounds as superseded
- opportunities.current_* sync from latest negotiation

---

## 9. Document This Pattern Elsewhere

This pattern should be referenced in:
- ✅ This document (the canonical spec)
- ✅ `Math_Flow_Schema_Design.md` (technical implementation)
- ✅ `Sprint_Plan_15_to_27_May_2026.md` (Day 3+ plan: apply same pattern to Negotiation)
- ✅ `Real_Estate_Workflow_Spec.md` (business context)
- ✅ Investor pitch ("PropCRM tracks every deal change")

---

## 10. Founder Realization (Verbatim)

The thinking that led to this clarity:

**Initial concern:**
> *"i need a edit on the opportunity as we go with standards and broker
> know he will put all the details"*

**The pivot:**
> *"history has to recorded to for analysis how this started how many
> changes, negotiations happening"*

**The conclusion:**
> *"i think let be as this will give us the history... we also have a
> negotiation model which can take care of the history"*

**The principle that emerges:**
> Live state + versioned history is the right pattern for real estate CRM.

---

## 11. What's RIGHT vs What Needs Improvement

| Aspect | Status | Notes |
|---|---|---|
| Two-layer architecture | ✅ RIGHT | Keep this pattern |
| current_* as live state | ✅ RIGHT | Single source of truth |
| Proposals as versioned history | ✅ RIGHT | Audit trail built-in |
| Sync between layers | ✅ NOW RIGHT | Today's Touch Point #2 fix |
| UX clarity (live vs history) | ⏳ Phase B | Show history on opp screen |
| Naming consistency | ⏳ Phase B | Send Quote vs Send Proposal |
| PDF generation | ⏳ Phase B | Currently no PDF |
| Negotiation table | ⏳ Phase B | Apply same pattern |

---

## 12. Status of This Document

**Architecture pattern:** APPROVED ✅  
**Applied to:** opportunities + proposals ✅  
**To apply to:** opportunities + pp_negotiations (Phase B)  
**Investor narrative:** Ready to articulate ✅  
**Phase B implementation:** Clear path forward  

---

*Document created: 14 May 2026 (Thursday afternoon)*  
*Captured during Day 2 of Math Flow Sprint dry-run*  
*Founder + AI collaborative reasoning session*  
*Pattern: Live State + Versioned History*
