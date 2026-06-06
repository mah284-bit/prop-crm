# Sales UX Polish Backlog

Cosmetic / layout items found during the Sales completeness walk (Day 28).
These are NOT functional bugs — the workflows work. Batch these into one
dedicated UX polish pass rather than fixing piecemeal mid-walk.

## Open items

### 1. Lead detail — opps list buried at bottom
- On a lead with opps, the screen is full (header, contact, people, log-activity
  buttons) so the Opportunities(N) list at the bottom shows ~1 row and scrolling
  feels ineffective.
- Broker pain: the most actionable part of the lead (its deals) is hardest to see.
- Possible fixes: move opps list higher / make it a collapsible section / give it
  its own scroll area / compact the upper sections.
- Found: Day 28, testing Nadal Rafael with 2 opps.

### 2. AI Bubble (floating assistant circle, bottom-right) is in the way
- Fixed floating element overlaps content; founder wants it movable / repositioned
  / given room so it doesn't cover the work area.
- Possible fixes: make it draggable, dock it, add a minimize/collapse, or reposition.
- Found: Day 28.

## Deferred (bigger, already planned)
- Context-aware Back / navigation breadcrumb: Back from an opp should return to
  entry point (Lead detail vs Opportunities screen vs Dashboard). Touches every
  opp entry point — do as its own focused, fully-tested change. See workflow
  discussion Day 28.

### 3. Rename opp workspace tab "Plan" → "Payment Plan"
- The tab labeled "🏗️ Plan" is ambiguous (plan for what?). Content is the
  payment plan / terms (20/80, advance, handover). Rename to "Payment Plan"
  (or "Payment Terms"). One-word label tweak in the opp workspace tabs.
- Found: Day 28.

## Data hygiene (verify before testers — not page bugs)

### Commission Outstanding — "Partial" rows with 0 comm / 0 received
- Several Emaar AED 2,000,000 rows show status=Partial but Net Comm AED 0 and
  Received AED 0. "Partial" implies some payment received — inconsistent. Check
  how status is set vs commission calc. Found Day 28.

### Commission Outstanding — duplicate identical paid invoices
- ~8 identical Emaar "AED 2,000,000 → AED 84,000 → Paid" rows. Likely demo/test
  duplicates. Looks glitchy to testers. Cleanup candidate. Found Day 28.

### 5. Reports export — Contact column shows "—"
- Pipeline report (Excel + PDF) Contact column is empty for all rows though opps
  have linked leads. Buyer name should populate. Minor data-mapping fix in
  ReportsModule report generators. Found Day 28.

### 6. Commission Outstanding — active filter not obvious ("1 of 9")
- When a filter (developer/age/overdue) is active, page shows e.g. "1 of 9
  invoices" and totals reflect only the filtered subset — easy to misread as
  "data lost". A "Clear" exists but the active-filter state isn't prominent.
  Make active filters visually obvious (highlight, chip, or banner). Found Day 28.

## DONE (data hygiene)
- ✅ Duplicate invoices cleaned (Day 28): opp fcd9e34f (Rajesh EBT-09-05, Closed Won)
  had 10 invoice rows; kept 1 paid (b9437234), deleted 9 junk. Backup table
  _backup_dup_invoices_20260605 holds the deleted rows. Verified: 9 invoices
  remain for Al Mansoori, totals sane (net comm 1.24M).
- ✅ Sobha duplicate resolved (Day 28): opp 76aac3ec (Rajesh, Closed Won) had 2
  invoice rows (one paid no-number, one issued INV-2026-0019 unpaid). Founder
  confirmed paid. Merged: kept paid row b71c4d3e, set its invoice_number to
  INV-2026-0019, deleted issued dup f0eb8125. Backup: _backup_sobha_dup_20260605.
- ✅ pb_projects junk rows cleaned (Day 28): deleted 2 test rows ("project/emar",
  "asdf"); verified zero references from leads/leases/maintenance first. Table
  KEPT (FK-wired to leads.pb_project_id, leases.project_id, maintenance.project_id).
  Backup: _backup_pb_projects_junk_20260605.
- NOTE: 'properties' table (0 rows) KEPT — empty but FK-referenced by leads.property_id.
  Dropping would break the FK; not worth it. Leave as-is.
- DECISION: "Test Brokerage Z" + "Hussain Test" user KEPT as multi-tenant isolation
  test fixtures (useful, not junk).

## AI Concierge panel height (Day 29, low priority)
Now that the launcher is docked in the header (commit 387faaa), the floating
panel could stretch taller to show more info when querying. Currently 440x680,
maxHeight 92vh (already near-full). Revisit ONLY if it feels cramped in real use.
Founder flagged as "maybe, only if important." Not urgent.

## KNOWN ISSUE — Pipeline Report "Contact" column blank (Day 29)
Status: KNOWN, deferred (founder call — low severity, name already appears in
the Opportunity column for most rows e.g. "EBT-09-05 — Rajesh Haridas").

Confirmed broken: Contact shows "—" for ALL 35 rows in exported Pipeline PDF.
Data is FINE — SQL join (opportunities.lead_id → leads.name) resolves every name
correctly; leads array IS loaded company-scoped on mount (App.jsx ~16918, same
array the working Leads report uses). Lookup code: ReportsModule.jsx lines 89/116
`leads.find(l=>l.id===o.lead_id)?.name||"—"`.

So logic + data both check out, yet column is blank → suspect leads prop is empty
at the exact render/generate moment, OR an id type mismatch, OR globalOpps vs the
leads array scoping. Needs live debug (console.log leads.length inside generator).
Likely a 1-line fix once root cause seen. Revisit only if a tester complains.
