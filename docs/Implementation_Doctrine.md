# PropCRM — Implementation Doctrine
The non-negotiable principles that govern how we onboard clients. Every implementation lead, sales
person, and onboarding team member reads this FIRST. Purpose: protect the product's essence — keep
IMPLEMENTATION effort <= CONFIGURATION effort. The moment we customize per client, we die under fork
maintenance. (#13 on the Document Register. Founder will enforce.)

## WHY THIS DOCTRINE EXISTS
Founder (ex-Oracle DBA -> VP) has lived the two killers of enterprise software rollouts:
1. Legacy data migration (technical).
2. The COMFORT FACTOR — clients won't leave their old reports/process; they want the new app to MIMIC
   the legacy, which forks the product into unmaintainable bespoke versions.
Killer #2 destroys more SaaS companies than #1. This doctrine is the defense.

## THE THREE PRINCIPLES (P1-P3) — non-negotiable

### P1. Bring their DATA in, NOT their PROCESS.
PropCRM's workflow (lead -> quote -> opportunity -> proposal -> commission) is OPINIONATED and IS the
value. We do not reshape it to match a client's old process. Configuration flexes within bounds
(company-level settings); the WORKFLOW does not fork per client. If implementation effort starts to
exceed configuration effort, STOP — we are losing the product.

### P2. Adoption lever = their OWN DATA working BETTER in the new flow.
The comfort factor is not beaten with customization — it is beaten by showing the client their real
deals running in PropCRM with commission visibility, PropPulse intelligence, and audit working. Once
they see their own data work better, comfort shifts. Migration is therefore a strategic adoption
mechanism, not just a technical task.

### P3. Strong STANDARD reports + Excel export — NOT bespoke per-client reports.
Give a small set of excellent standard reports plus raw Excel export. Clients who must slice their own
way do it in Excel. The system of record stays clean. We never build a client's 47 custom reports.

## THE INTAKE BOUNDARY (how data comes in)
- Legacy data enters via PropCRM's EXCEL TEMPLATE ONLY. NO direct integration to a client's old system
  (Zoho/custom/etc.). WHY: direct integration = N bespoke projects (fork-hell); Excel collapses N into
  ONE import pipeline.
- The client (or their old vendor) exports + maps their data field-by-field INTO our template. The
  mapping burden sits with the DATA OWNER, not PropCRM.
- DATA CLEANSING IS NOT OUR RESPONSIBILITY. We may ADVISE on patterns we spot, but we NEVER take
  responsibility for removing/updating/adding their data. Liability boundary: we must not CREATE
  garbage; we do not fix theirs. The only IDs we touch are OUR ids (for relational integrity), with an
  optional legacy_ref to keep their original id traceable.

## THE ONBOARDING DISCIPLINE (the staged process)
1. Hand over the Excel template + a written runbook.
2. Client maps their data into the template.
3. 10-RECORD TEST first — and it must be a full VERTICAL SLICE (a lead WITH its phone, contact, opp) to
   prove relationships hold, not 10 flat leads.
4. Only after the 10-record test passes + is reviewed -> full upload, as a REVERSIBLE batch.
5. Import in dependency order (companies/users -> leads -> contacts/phones -> units -> opps ->
   proposals). Children never before parents.

## SCOPE TIERS (start every client at Tier 1; earn the rest)
- Tier 1 (safe base): leads + contacts + phones. Most clients, most value, lowest risk.
- Tier 2: + inventory/units (or re-import from PropPulse).
- Tier 3 (hardest): + opportunities + proposals + history. Relationships + historical integrity = pain.
  Only if genuinely needed.

## THE ENFORCEMENT LINE (founder's words)
"I have to enforce this to succeed, else I will be doing implementations more than the configuration and
we lose the essence of our app."
Every "can you just make it work like our old system" request is answered: we bring your DATA, not your
PROCESS. The app's opinion is the value. Hold the line.

## CROSS-REF
- Legacy_Data_Upload_and_Adoption.md (full migration architecture)
- Decision_Log.md (the decisions behind these principles)

## ⭐ THE APP MUST NEVER BE THE REASON A BROKER SAYS "I CAN'T" (Day 102)
Founder: "in property, mostly in brokering, unique cases and adaptability are the answer to making
more money. I can't, or I don't, actually loses dollars."
Every unusual case is a deal someone else will take if we refuse it. The seller whose deed is still
with the bank, the buyer paying 1.5% because he is a repeat client, the unit sold before 25% is
paid - these are not edge cases to be validated away. They are where the money is.
THE RULE: a gate WARNS AND RECORDS. It does not refuse. Where a figure must hold - a price after
money is collected - the app locks it and offers the honest alternative (a discount, recorded)
rather than blocking the work.
⚠️ AND THE COROLLARY: a field that MUST be filled is a deal that cannot be entered. Require almost
nothing; capture what is known; let the record show what is missing. A half-recorded deal is worth
more than a deal recorded on paper because the app would not take it.
