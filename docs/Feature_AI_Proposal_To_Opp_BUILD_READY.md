# BUILD-READY SPEC — AI-Extract Proposal PDF -> Opportunity
Logged 22 June 2026 (evening). Priority: BEFORE TESTERS (founder call).
Status: Scoped, NOT yet built. Build fresh next session.

## Story (confirmed vs master-context line 185c)
Lead proposals are PDF-only (intentionally not in DB — filters tyre-kickers). When a buyer turns serious, broker picks a sent proposal (latest or any) and promotes it to an Opportunity. Since it is a PDF (no DB row), AI reads the PDF and extracts fields to populate the new Opp. Broker reviews + confirms before save.

## De-risk finding
The "AI reads a PDF, extracts structured data" pattern already exists: api/validate-agreement.js does this for Master Agreements (fetch doc url, base64, contentType pdf, send to Claude, get fields). ADAPT this — not inventing the hard part. NOTE: validate-agreement not yet seen in action (no sample on hand) — verify it works when building.

## Foundation that exists
- PDF storage: src/lib/uploadProposalPDF.js -> Supabase Storage bucket property-pack, private/proposals/{companyId}/{ts}_{name}, returns url.
- PDF gen: src/lib/generateProposalPDF.js
- Proposal list UI: src/components/leads/ViewProposalsDialog.jsx
- AI-PDF reference impl: api/validate-agreement.js (clone this)
- Opp create form to pre-fill: src/components/CreateOpportunityDialog.jsx

## Build steps (next fresh session)
1. Picker: add "Promote to Opportunity" on each sent proposal in ViewProposalsDialog.
2. New endpoint api/extract-proposal.js — clone validate-agreement.js. In: proposal PDF url. Out: JSON {unit_ref, project, price, payment_plan, dld_treatment, buyer_name}. Prompt Claude to return ONLY JSON; parse safely.
3. Wire: picker calls endpoint -> fields -> opens CreateOpportunityDialog PRE-FILLED.
4. Broker review (MANDATORY): extraction never 100%; broker verifies price + unit before save. Never auto-save.
5. Save via standard Opp path; log activity "Promoted from proposal (AI-extracted)".

## Guardrails
Extract essentials first (unit, project, price, payment plan). Broker-review step is non-negotiable. Test with 2-3 real proposal PDFs; confirm price + unit extract correctly.

## Connects to
Master-context line 185 item 3, part (c). Parts (a) version sent-proposals list and (b) AI provoke-on-repeat-ask remain separate, lower priority, not before-tester.

## UPDATE (23 Jun AM) — design fully de-risked, two key findings
1. AVAILABILITY CHECK ALREADY EXISTS (and must be mirrored): CreateOpportunityDialog.jsx
   line ~799: `if (!unitShowReserved) pool = pool.filter(u => u.status !== "Reserved" && u.status !== "Sold")`.
   The normal Opp-create path ALREADY hides Reserved/Sold units by default, with a
   `unitShowReserved` toggle to override. Unit statuses: Available / Reserved / Sold
   (Hold/Block = developer-side, PARKED per founder until broker testing asks for it).
   -> Promote-from-proposal MUST mirror this: extracted unit_ref -> match unit_id -> check
   status. Available = proceed. Reserved/Sold = warn broker, offer pick-different / override
   (same as unitShowReserved) / cancel. NEVER silently create Opp on unavailable unit.
   FOUNDER PRINCIPLE: "this availability check has to be EVERYWHERE — if it's not there, it's missed."
2. EXTRACTION TARGET refined: Opp form builds from unit_id, which auto-cascades
   project/developer/commission (via master-agreement useEffect). So AI extracts IDENTIFIERS
   not free text: unit_ref (match to unit_id), budget, buyer_name (confirm lead). Form derives
   the rest. Also extract price/payment as FALLBACK if no unit match (option 3).

## FINAL BUILD SEQUENCE (fresh session, all unknowns retired)
0. Reference proven: api/validate-agreement.js is WIRED (MasterAgreements.jsx:697) + complete.
1. api/extract-proposal.js — clone validate-agreement.js plumbing; swap prompt to extract
   {unit_ref, budget, buyer_name, price, payment_plan}; return ONLY JSON.
2. Test endpoint alone with 2-3 real proposal PDFs — confirm unit_ref + price extract right.
3. Picker: "Promote to Opportunity" on each sent proposal in ViewProposalsDialog.
4. Match unit_ref -> unit_id; CHECK STATUS (mirror line 799). Available/Reserved/Sold branch.
5. Pre-fill CreateOpportunityDialog; broker review MANDATORY (verify price+unit); never auto-save.
6. Save standard path; log activity "Promoted from proposal (AI-extracted)".
