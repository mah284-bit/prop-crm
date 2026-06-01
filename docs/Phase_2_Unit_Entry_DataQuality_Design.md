# Phase 2 — Unit Entry & Data-Quality Marriage (Add Unit ↔ PropPulse ↔ Inventory)

**Captured:** 1 June 2026 (Day 23 evening). **Status:** DESIGN / EXPLORE — build POST-DEMO.
**Source:** Founder review of the manual "Add Unit" form vs PropPulse data richness.
**Demo posture:** Founder will lightly skim Add Unit in the demo, NOT emphasise it.
**Founder principle in force:** "we cannot take a call half-heartedly" — this doc captures
the leaning decisions AND the open questions that must be resolved before building.

---

## The problem (named precisely)

Inventory has TWO entry doors that produce DIFFERENT data quality:
- **Door 1 — PropPulse import:** rich. Photos, master plan, video, amenities, verified
  specs — all inherited at import (via the `...cloneable` spread, confirmed Day 23).
- **Door 2 — manual "Add Unit":** thin. Specs only. Selecting a project stores an id but
  inherits NONE of that project's media/amenities.

Result: a hand-entered resale unit looks impoverished beside an imported one. Founder wants
to "marry" the two so manual entry reaches PropPulse/Inventory quality.

## Reality check: the split (founder's answer)
Manual-add projects are **~50/50** — half ARE already in PropPulse, half are NOT
(off-market, resale, new buildings PropPulse hasn't catalogued). So the solution MUST
handle both halves. A single pattern won't do.

---

## What ALREADY EXISTS (assets — do NOT rebuild)
(from src/components/InventoryModule.jsx, Day 23 inspection)

1. **AI Brochure Scanner — WORKS** (`scanBrochure` ~line 298). Sends a developer
   brochure to Claude, extracts unit fields as JSON, applies to the form (`applyScan`
   ~line 352). Extracts: unit_ref, sub_type, size_sqft, bedrooms, bathrooms, floor,
   view, asking_price, annual_rent, booking_pct.
   ⚠️ LIMIT: extracts SPEC TEXT only — NOT photos, floor plans, master plans,
   amenities, or videos.
2. **Per-unit document upload — partial** (`uploadDoc` ~line 662). Fields exist:
   floor_plan_url, brochure_url, render_url (~line 105).
3. **Project link** — Add Unit requires project_id (~line 221), but `openAdd` (~line 204)
   only sets the id; pulls NO project data forward.
4. **Property Pack resolver** (Day 23, src/components/property/getPropertyPackAssets.js)
   — already resolves unit → parent project → media/amenities. THIS is the inheritance
   engine we can reuse for Door 2.

## The TRUE gap (narrow, not "form is basic")
- ❌ Selecting a KNOWN PropPulse project does not inherit its media/amenities into the unit.
- ❌ No media/plan capture path for NEW projects not in PropPulse.
- ❌ AI scanner enriches specs but not media.

---

## Decision captured (LEANING — confirm before build)

### Where do manually-added NEW projects/units live?
**Founder leaning: TENANT-PRIVATE (company-scoped), NOT global to PropPulse.**

**Rationale (founder):**
- A broker's off-market / resale / pre-launch data is their COMPETITIVE ASSET.
  Pushing it global into PropPulse gives that edge away to other tenants.
- Verification & liability: unverified broker-entered data shouldn't pollute the
  PropPulse "verified moat" without a review gate.

**⚠️ OPEN QUESTIONS (resolve before building — do NOT decide half-heartedly):**
1. If a broker enters a project that LATER appears in PropPulse (verified), do we
   merge / de-dupe? How is the link reconciled?
2. Is there EVER an opt-in "contribute to PropPulse" path (broker chooses to share a
   project, e.g. for a verification credit)? Or strictly never?
3. Does tenant-private project data still get the rich media-upload UI, or a lighter one?
4. Multi-tenant identity (see Architecture_Multi_Tenant_Identity_Model.md): tenant-private
   projects must be company_id-scoped and invisible to other tenants AND to PropPulse
   global views. Confirm RLS covers a tenant-created project row.
5. Does PropPulse's AI agent ever try to "verify" a tenant-private project (it shouldn't)?

---

## Proposed build shape (POST-DEMO — for discussion, not locked)

**Pattern A — Known project (the ~50% in PropPulse): INHERIT, don't re-type.**
- On project select in Add Unit, surface "✓ This project has N photos · video · M amenities
  · master plan — inherited automatically." Unit inherits project-level media via the
  existing resolver. Broker only fills unit-specifics + can add unit-level photos/plan.

**Pattern B — New project (the ~50% not in PropPulse): RICHER create, tenant-private.**
- Let broker create the project as a COMPANY-PRIVATE project (company_id-scoped), with
  media upload (hero, gallery, amenities, master plan) — same columns PropPulse uses
  (added Day 23: hero_image_url, photo_gallery_urls[], amenities[], project_units.photo_urls[]).
- Optionally seed it via the EXISTING AI Brochure Scanner (extend it to also pull/attach
  media, not just specs — see "scanner upgrade" below).
- Stays private per founder decision. Verification/merge path = open question #1/#2.

**Scanner upgrade (leverage existing asset):**
- Extend scanBrochure to extract + attach media (floor plan image, renders) in addition
  to spec text. Biggest effort is media handling, not the AI call.

**Data-quality enforcement (the real goal):**
- Every unit must attach to a project (already enforced).
- New projects go through the richer create flow → no thin orphan projects.
- De-dupe guard on project create (see bug below).

---

## DATA-QUALITY BUG found during this review
- The Add Unit project dropdown shows BOTH "Blue Diamond" AND "BlueDiamond" — a duplicate
  project with inconsistent naming. Exactly the quality problem this initiative targets.
- **Action (can be pre-demo, tiny):** identify the two project rows, decide canonical
  name, merge/relink units, delete the dupe. SQL in Supabase. Capture unit counts first.

---

## Demo posture (June 15)
- Founder skims Add Unit lightly; does NOT emphasise.
- If asked: "Manual entry exists today (incl. an AI brochure scanner that auto-extracts
  unit specs). Phase 2 marries manual entry to our PropPulse data quality — known projects
  inherit rich media automatically; new off-market projects get a rich, company-private
  create flow. We keep broker-sourced data private by design."

## Effort (rough, post-demo)
- Pattern A (inherit on select): ~1 day (reuses resolver).
- Pattern B (tenant-private rich create): ~2-3 days + the open-questions decisions.
- Scanner media upgrade: ~1-2 days (media handling).
- Blue Diamond de-dupe: ~30 min (pre-demo OK).

## Connects to
- Architecture_Multi_Tenant_Identity_Model.md (tenant-private scoping, RLS)
- Phase_2_2b Property Pack resolver (the inheritance engine)
- PropPulse import flow (Door 1 — the quality bar to match)
