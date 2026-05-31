# Phase 2.2 — Property Detail Pack (Design)

**Date captured:** 31 May 2026 (Sunday morning, Day 20)
**Source:** Founder Day 19 evening — raised pain point that PropPulse data exists but has no display surface in the app
**Status:** Design locked. Build scheduled Day 22.
**Demo target:** 15 June 2026 (15 days out)
**Estimated effort:** 1 day focused build + 0.5 day demo content seeding
**Reference docs:** `Phase_2_Backlog_Master_Doc.md` (Section 2.9 Customer-Facing Context Bundle), `Phase_2_Communications_Overhaul.md` (Part 1 bundle system)

---

## Why this doc exists

PropCRM has collected rich project intelligence via PropPulse since Day 1 — brochures, master plans, website URLs, video links are stored on the `projects` table. But there is NO surface in the app that displays this data to the broker, no way to attach it to a proposal, no way to send it to a buyer. **Backend built, frontend missing.**

Day 19 evening, founder named this directly:

> *"there is no place on the app from where i can show it to the client or even attach to the proposal or even send it as a separate attachment of all this... the best would be a point from where we can show attach and make use of the data we have."*

Architect's call: build this pre-demo, scoped carefully. PropPulse is a top-3 demo scene; adding visual property packs transforms it from "data table" to "intelligence platform." Day 22 build slot, ~1 day work, leverages what backend already has.

---

## What's already in the database (Day 19 PM inspection)

A column-level audit of `projects` and `project_units` revealed the backend is much further along than expected:

### `projects` table — what already exists
- `brochure_url` (text) — link to developer's hosted brochure PDF
- `brochure_file_url` (text) — Supabase Storage public URL for uploaded brochure
- `master_plan_url` (text) — community master plan image
- `website_url` (text) — developer's project website
- `video_url` (text) — walkthrough/marketing video URL (YouTube, Vimeo, direct)

### `project_units` table — what already exists
- `floor_plan_url` (text) — unit-specific floor plan image

### What's missing (4 columns to add)
- `projects.hero_image_url` (text) — the lead photo shown at top of detail panel
- `projects.photo_gallery_urls` (text[]) — array of community/amenity/exterior photos
- `projects.amenities` (text[]) — list of named amenities ("Pool", "Gym", "Concierge", "24/7 Security", "Beach Access", "Co-working")
- `project_units.photo_urls` (text[]) — array of unit-specific photos (views, interior)

**Net result:** Schema delta is tiny. 4 columns. Most of the heavy lift is **UI components and demo content**, not data modeling.

---

## Scope — pre-demo vs post-demo (deliberate split)

### Pre-demo (Phase 2.2 — this doc)
**The DISPLAY layer.** Surfaces where the broker SEES the property pack:
- `ProjectDetailPanel` component — opens when broker clicks a project in PropPulse
- `UnitDetailPanel` extension — opens when broker clicks a unit in Inventory
- Both panels render: hero image, brochure preview, master plan, photo gallery, video player, amenities grid, website CTA
- Demo content seeded: 3-4 hero projects with full media (Emaar Creek Harbour, Aldar Grove Residences, DAMAC Lagoons, one more TBD)

### Post-demo (Phase 2 Communications Overhaul — already documented)
**The SHARE layer.** What broker does with the pack:
- "Share Pack" button → composes email/WhatsApp message with bundle attached
- Multi-entry-point sending (Inventory → Lead Detail → Opp Detail → Proposal)
- PDF bundling (combine brochure + master plan + unit floor plan into one downloadable)
- Audit trail of who received what
- Template engine for accompanying message

**Why split this way:**
- Display layer = visible in demo, makes PropPulse story stronger, fits in 1 day
- Share layer = invisible during 30-min demo, requires email infrastructure (Resend/SendGrid) + WhatsApp Business API, fits Phase 2 Communications Overhaul (4 weeks scoped)
- Demo investor sees the pack and immediately understands "Phase 2 wires this to comms"

---

## Schema migration

**Single migration, idempotent, tiny:**

```sql
-- File: migrations/2026-05-31_phase_2_2_property_pack.sql

-- 1. Add missing columns to projects
ALTER TABLE public.projects 
  ADD COLUMN IF NOT EXISTS hero_image_url text;
ALTER TABLE public.projects 
  ADD COLUMN IF NOT EXISTS photo_gallery_urls text[] DEFAULT ARRAY[]::text[];
ALTER TABLE public.projects 
  ADD COLUMN IF NOT EXISTS amenities text[] DEFAULT ARRAY[]::text[];

-- 2. Add missing column to project_units
ALTER TABLE public.project_units 
  ADD COLUMN IF NOT EXISTS photo_urls text[] DEFAULT ARRAY[]::text[];

-- 3. Verification
SELECT 'projects' AS tbl, column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='projects'
  AND column_name IN ('hero_image_url','photo_gallery_urls','amenities')
UNION ALL
SELECT 'project_units' AS tbl, column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='project_units'
  AND column_name = 'photo_urls';
-- Expected: 4 rows
```

**Notable absences (deliberate):**
- NO RLS additions — `projects` and `project_units` already have RLS from prior schema
- NO realtime publication adds — these tables aren't realtime-critical (content is editorial, not transactional)
- NO new tables — everything lives on existing tables
- NO upload UI build — content seeded via Supabase Dashboard for demo (broker upload UI is Phase 2.2 Extended post-demo)

**Safety:**
- Migration is fully idempotent (`IF NOT EXISTS` on every ALTER)
- Re-running is safe
- Rollback is trivial (3 `DROP COLUMN` statements, commented at bottom of migration file)

---

## UI components

### `ProjectDetailPanel`

**Trigger:** Click any project row in PropPulse → panel slides in from right (or modal overlay, TBD during build)

**Layout (top to bottom):**

1. **Hero section**
   - Large hero image (1600x900 ratio, lazy-loaded from `hero_image_url`)
   - Overlay: project name, developer, status badge
   - Quick action: "View Website" button (links to `website_url`)

2. **Quick facts ribbon** (already-available data)
   - Developer name | Status (Under Construction / Completed / Off-Plan) | Total units | Starting price | Completion year | Community

3. **Brochure section**
   - If `brochure_file_url` exists → inline PDF preview (iframe to public URL)
   - Else if `brochure_url` exists → "View Brochure" CTA button (opens external)
   - Else → "Brochure not yet uploaded" placeholder

4. **Master plan section**
   - Master plan image displayed at full width, clickable to fullscreen
   - If absent → placeholder

5. **Photo gallery**
   - Horizontal carousel of `photo_gallery_urls`
   - Click any photo → fullscreen lightbox
   - 3-6 photos ideal; system handles 0 photos gracefully (hidden section)

6. **Video section** (if `video_url` exists)
   - Embedded player (YouTube/Vimeo iframe or HTML5 video)
   - Section hidden entirely if no video

7. **Amenities grid**
   - 3-column grid of `amenities` array
   - Each amenity rendered as small card with icon + name
   - Icons mapped from amenity name (Pool → 🏊, Gym → 💪, Concierge → 🛎️, etc.)
   - If empty array → section hidden

8. **Footer actions**
   - "Share Pack" button (greyed out, tooltip "Phase 2 — coming Q3 2026")
   - "View Units in this Project" button → navigates to Inventory filtered

**Component file:** `src/components/property/ProjectDetailPanel.jsx` (new file, single component, ~250-300 lines)

### `UnitDetailPanel` (extension of unit display)

**Trigger:** Click any unit row in Inventory → existing unit detail view, EXTENDED with property pack data

**What's new (on top of existing unit display):**

1. **Unit floor plan** prominently displayed (image from `floor_plan_url`)
   - This is the buyer's #1 question — floor plan
   - Clickable to fullscreen
   - If absent → placeholder

2. **Unit photos carousel** (from `photo_urls` array on `project_units`)
   - Same lightbox UX as project gallery
   - Hidden if empty

3. **"Project Pack" section** at bottom
   - Embeds a compact version of `ProjectDetailPanel` for this unit's parent project
   - User can expand to full project view

**Implementation:** Extend existing `UnitDetail` component in App.jsx (already exists). Add a "Property Pack" tab or section.

### Reusable sub-components

- `MediaGallery` — handles photo array + lightbox (used by both panels)
- `AmenityGrid` — handles amenity array + icon mapping
- `PdfPreview` — handles brochure URL with iframe fallback
- `VideoEmbed` — detects YouTube/Vimeo/direct and renders correctly

These live in `src/components/property/` as small focused components, NOT in App.jsx. **First time we use this pattern in PropCRM** — and it's the right time, since App.jsx is already 16,900 lines and any new feature added there is technical debt.

---

## Day 22 build plan

Single focused day. ~6-8 hours of engineering + ~3 hours content seeding.

### Morning block (4 hours)
- **Schema migration** (30 min): write SQL file, safety tag git, apply via Supabase SQL Editor, verify
- **`MediaGallery` component** (1 hour): photo array + lightbox + carousel
- **`AmenityGrid` component** (30 min): array + icon mapping
- **`PdfPreview` component** (45 min): iframe embed + fallback
- **`VideoEmbed` component** (45 min): URL detection + embed

### Afternoon block (4 hours)
- **`ProjectDetailPanel` composition** (2 hours): assemble sub-components into full panel
- **PropPulse integration** (1 hour): wire click-project → opens panel
- **`UnitDetailPanel` extension** (1 hour): add property pack section to existing UnitDetail

### Day 23 (content + polish)
- **Demo content seeding** (3 hours): for 3-4 hero projects, populate columns via Supabase Dashboard
  - Hero image: 1 per project (download from developer site, store URL or upload to Supabase Storage)
  - Photo gallery: 3-5 per project (developer site, official photos)
  - Amenities: array of 6-10 per project (read from brochure)
  - Master plan: 1 per project (from developer)
  - Video URL: 1 per project (developer's YouTube walkthrough if available)
  - Unit floor plan: for ~5 demo units linked to these projects
- **Polish + edge cases** (2 hours): empty states, broken image handling, mobile responsive check
- **Cross-browser verify** (1 hour): Chrome, Safari (iPhone Safari for mobile demo backup)

### Day 24 (Phase 2.1 testing + Pack polish)
- Phase 2.1 testing absorbs this day per existing plan
- Property Pack polish if anything regressed

---

## Demo content strategy

**The 3-4 hero projects** for demo content:

### Project 1 — Emaar Creek Harbour (existing in PropPulse, flagship)
- Already in DB with verified PropPulse data
- Needs: hero image, photo gallery, amenities array, possibly video URL
- Connects to: nothing specific in current demo opps, but it's the verified flagship for "PropPulse data quality" narrative

### Project 2 — Aldar Grove Residences (already a demo opp)
- Shrikant's AGR-09-05 deal opp lives here
- Connects to: Scene 4 (Proposals) demo flow
- High value because investor sees the same project surface across multiple scenes

### Project 3 — DAMAC Lagoons (3rd developer, market range)
- Different developer family, different community style
- Demonstrates PropCRM works across developer types

### Project 4 (optional) — Sobha Hartland (4th developer if time permits)

**Content sourcing:**
- All four developers publish high-quality brochures, photos, master plans, videos publicly on their websites
- Sourcing is URL curation, not creation — 30-45 min per project
- Founder drives content selection (knows which images best represent each project)

---

## Demo positioning

### Existing Scene 1 (PropPulse) — current narrative
> "Twenty active developers in our database. Twenty-six verified projects. Watch the metadata: project type, community, total units, starting prices, handover dates."

### Enhanced Scene 1 after Property Pack ships
> "Twenty-six verified projects — and let's go deeper on Emaar Creek Harbour. *[click project]* Brochure preview right here. Master plan. Community photos. Video walkthrough from Emaar's own marketing. Amenities. This isn't a data table — this is the project the way a buyer sees it. Phase 2 wires the same pack into proposals and customer comms, so the broker shares with one click."

**Investor takeaway:** *"They have BOTH the intelligence AND the presentation layer. Most CRMs have one or the other."*

### Closing pitch tie-in
The Day 19 closing pitch already says: *"Layer 1: Intelligence. Layer 2: Compliance. Layer 3: Workflow."* Property Pack makes Layer 1 visible during the demo, not just claimed.

---

## What's deferred (and where it lives)

| Capability | Pre-demo? | Where it lives |
|---|---|---|
| Display brochure/plans/photos/video/amenities | ✅ Yes | Phase 2.2 (this doc) |
| Upload UI for content (admin or broker) | ❌ No | Phase 2.2 Extended — admin uploads via Supabase dashboard for demo |
| "Share Pack" send-to-customer flow | ❌ No | Phase 2 Communications Overhaul Part 1 |
| Attach pack as PDF bundle to proposal | ❌ No | Phase 2 Communications Overhaul Part 1 |
| Track who received what bundle | ❌ No | Phase 2 Communications Overhaul Part 2 |
| WhatsApp Business API integration | ❌ No | Phase 2 Communications Overhaul Part 3 |
| Per-buyer customized pack (branded cover) | ❌ No | Phase 2 Communications Overhaul Part 1 |
| 360° virtual tour embed | ❌ No | Phase 3 (if pilot demands) |

**The deferred items are RESPECTED, not forgotten.** Phase 2 Communications Overhaul doc already covers them at 4-week scope. This Phase 2.2 doc is the prerequisite that puts the display layer in place.

---

## Risks

### Risk 1 — Component complexity creep
Building 4 sub-components + 2 main panels in 1 day is tight. **Mitigation:** ship the panels with placeholder fallbacks for missing data. Don't polish empty states until Day 23.

### Risk 2 — Content sourcing taking longer than 3 hours
Some developers may not have high-quality public images. **Mitigation:** if a project's content takes >45 min to source, drop it and use only 3 hero projects. Demo works fine with 3.

### Risk 3 — Mobile rendering edge cases
Demo is likely desktop but investor may ask "show on phone." **Mitigation:** Tailwind responsive classes baked in from start. Hero image, photo gallery, brochure preview must work on mobile.

### Risk 4 — Day 22 slot conflicts with Phase 2.1 build
Phase 2.1 day-by-day has Day 22 marked for Lead Queue + Lead Detail Assignment section. **Mitigation:** Property Pack day is Day 23 (originally stale-detection day, which moves to Day 24). Re-sequence:

**Revised pre-demo schedule:**
- Day 20 (today): Phase 2.1 assignment service RPC + lead creation flow
- Day 21: Phase 2.1 Settings UI (Agent Pools + Lead Routing Rules)
- Day 22: Phase 2.1 Lead Queue page + Lead Detail Assignment section
- Day 23: **Property Detail Pack build** ← INSERTED
- Day 24: Phase 2.1 stale-detection + cross-checks + Property Pack content seeding
- Day 25: Phase 2.1 testing + Pack polish (buffer day)
- Day 26+: Demo Hardening (unchanged)

**Floor of Day 26 hardening = preserved.** Buffer absorbed: 1 day. Acceptable because Phase 2.0 finished 2 days ahead of plan.

---

## Implementation discipline

1. **Schema migration with full safety net** — git tag `pre-phase-2.2-schema`, Supabase backup window verified, idempotent SQL, ALL the same discipline as Phase 2.1 schema (Day 19 PM precedent)
2. **Components live in `/src/components/property/`** — first organized component directory in PropCRM. Sets pattern for future modules.
3. **No App.jsx bloat** — sub-components are imported, not inlined. App.jsx integration is minimal: 1 import + 1 panel render call.
4. **Content seeded via Supabase Dashboard** for demo, NOT via app upload UI. Upload UI is post-demo.
5. **Greyed-out "Share Pack" button** — visible but disabled. Investor sees the placeholder + understands Phase 2 trajectory.
6. **Update master backlog** + strategic roadmap at end of Day 23 to reflect what shipped.

---

## Open design decisions

### Decision 1 — Modal vs slide-out panel
Project detail surfaces as a right-side slide-out (300-400px wide) OR full-screen modal overlay.

**Architect lean:** Right-side slide-out. Preserves context of the PropPulse list behind. Investor sees both at once during demo.

### Decision 2 — Sub-component directory structure
`/src/components/property/` for all property-pack-related components.

**Architect lean:** Yes. First time we organize by feature. Sets pattern for future.

### Decision 3 — Amenity icon library
Hard-code emoji map (🏊 Pool, 💪 Gym, etc.) OR pull from a library like lucide-react.

**Architect lean:** Hard-code emoji map. Zero dependencies, demo-perfect, 5 min implementation. Library swap is a post-demo polish if needed.

### Decision 4 — PDF preview library
Native iframe to public URL OR a library like react-pdf?

**Architect lean:** Native iframe. Browsers render PDFs in iframes well. react-pdf adds 200KB bundle. Iframe is 0 KB.

All 4 leans land toward: minimal dependencies, maximum demo impact, post-demo polish negotiable.

---

## Founder principles preserved

> *"there is no place on the app from where i can show it to the client or even attach to the proposal or even send it as a separate attachment of all this... the best would be a point from where we can show attach and make use of the data we have."*

This doc captures the DISPLAY part of that vision pre-demo. The ATTACH and SEND parts are in Phase 2 Communications Overhaul, post-demo. The display layer is the prerequisite for both.

> *"as an Architect I want you to lead the best and modern and keeping the market trend in mind you decide... impressive demo is another."*

Architect's lead: build the display, defer the send. UAE proptech market trend (2026) is visual property intelligence — Bayut, PropertyFinder, DAMAC Sales Channel app all show buyers rich media. PropCRM gives the broker the SAME experience for their customers, embedded in workflow. That's modern. That's impressive.

> *"no half hearted work which spoils"*

Display is fully shipped. Send is fully deferred. No half-built send UI lingering in the codebase. Clean line.

---

## Status

- [x] Backend audit (Day 19 PM) — schema state confirmed
- [x] Design captured (this doc, Day 20 morning)
- [ ] Founder reads + greenlights
- [ ] Migration file written: `migrations/2026-05-31_phase_2_2_property_pack.sql`
- [ ] Safety net before schema: git tag `pre-phase-2.2-schema` + Supabase backup confirmed
- [ ] Schema applied + verified
- [ ] Sub-components built (MediaGallery, AmenityGrid, PdfPreview, VideoEmbed)
- [ ] ProjectDetailPanel composed
- [ ] PropPulse integration (click project opens panel)
- [ ] UnitDetailPanel extension
- [ ] Demo content seeded for 3-4 hero projects
- [ ] Polish + edge case handling
- [ ] Pre_Demo_Phase_2_Sprint.md updated with Phase 2.2
- [ ] Phase_2_Strategic_Roadmap_v1.md updated (new Item 2.2 entry)
- [ ] Demo Script v3.1 Scene 1 enhanced with Property Pack moment

---

*Document created: 31 May 2026 (Sunday morning, Day 20)*
*Source: Founder Day 19 evening pain-point capture + DB column audit*
*Status: Architect-locked. Build slot Day 23. Content slot Day 24.*
*Next: founder greenlights this doc, then Day 20 Phase 2.1 RPC work begins.*
