# BLOCK OWNERSHIP GOVERNANCE - THE POLITICAL QUESTION (open, Day 79)
Raised by the founder while building the block owner display. NOT SOLVED. Design owed before any
reassign control is built. Founder's frame: **"ensuring democracy with gates"** - do not block
managers from managing; make every move visible, reasoned and recoverable.

## WHAT IS BUILT
block_deals.assigned_to drives visibility (agent sees own, manager sees downline, group manager
sees territories, viewer sees all). The owner is DISPLAYED in the Workspace header. There is NO
reassign control yet - deliberately.

## WHY NOT: THE STAKES
A block is one buyer, many units, and a commission an order of magnitude larger than a 1-to-1
(250,000+ on a 5M block). Whoever owns it at the wrong moment gains or loses a lot. So the
reassign control is not a convenience button - it moves money.

## THE SITUATIONS (founder)
1. TEMPORARY ABSENCE - Rajesh on emergency leave; Ahmed must be able to work the block so the
   deal does not stall. "No agent will miss this opportunity of a block sale."
2. MANAGER FAVOURITISM - a manager can silently move a large commission to a preferred agent.
   Rajesh returns and has no recourse. "We have to be careful about A also."
3. DEPARTURE MID-DEAL - the hardest. Rajesh is leaving the company. He has every incentive to
   close before he goes (commission); the company has every reason to protect the relationship.
   BOTH are legitimate. A gate that merely says "manager may reassign" hands the deal to whoever
   acts first.

## THE SHAPE THAT SEEMS RIGHT (proposal, not ruled)
TWO DISTINCT ACTS, because they mean different things:
- **COVER** (temporary): a named agent gains access to work the block while the owner is away.
  OWNERSHIP AND COMMISSION DO NOT MOVE. Ends by date or explicit hand-back. Logged.
- **REASSIGN** (permanent): ownership moves, and the child deals move with it (Option A - one
  owner throughout; otherwise an agent owns units inside a block he cannot see). Requires a
  MANDATORY REASON, writes a permanent audit line, and the OUTGOING OWNER IS NOTIFIED.

## THE UNRESOLVED CORE: WHOSE COMMISSION?
If ownership alone decides commission, a single click moves 250,000. Candidate rule: **commission
follows whoever owned the deal when the money landed**, not whoever owns it now - so a reassign
changes who WORKS the deal, not who EARNED what is already collected. Needs to be checked against
Commission_Model_Architecture.md and ruled by the founder.
Related open question: on departure, does the leaver keep commission on money not yet received?
That is a company POLICY question (and may belong in company settings, not in code).

## NEXT STEP
A dedicated design session. Do not build a reassign control before the commission rule is ruled -
a half-gated money transfer is worse than no control at all.

## FOUNDER'S MARKET REALITY (Day 79) - WHAT THE GATE IS ACTUALLY FOR
"Most of the cases, if Rajesh's buyers are loyal they will go with him to the new company. And
chances are if Rajesh is not responding and the buyer is not happy, the gate is the best."
THIS REFRAMES THE PROBLEM. The gate is NOT a retention tool - a loyal buyer follows the agent and
no CRM setting prevents that. Trying to hold a relationship by holding a record is a fiction.
The gate is a SERVICE INSTRUMENT. Its legitimate trigger is not "the agent is leaving" but
**"the buyer is not being served"** - unresponsive owner, stalled deal, buyer complaint. That
framing also defuses the favouritism worry: a reassign justified by service has evidence behind
it (no activity for N days, a logged complaint), whereas one justified by nothing is visible as
exactly that in the audit line.
DESIGN CONSEQUENCE: the reason field on a reassign should not be free prose alone. Offer the real
triggers - unresponsive owner / buyer request / agent departed / workload rebalance / other with
text - so the audit log says WHY in a way that can be reviewed. Stale-deal signals the app already
computes (last_broker_activity_at, days in stage) can EVIDENCE the "unresponsive" case rather than
relying on the manager's word.
