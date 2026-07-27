# Phase 2.2b — Global Property Pack Viewer (Design)

**Date:** 1 June 2026 (Day 24)
**Founder principle driving this:** "Build future-usable. Send (parked) must
bolt on with ZERO rework of Display. No 1-step-forward-2-steps-back."
**Status:** Architect-locked. Building Phase 1 now.

---

## Why this shape (founder's UX call)

A Property Pack buried in ONE Inventory tab serves almost no one — brokers see
a unit in many places (Inventory, Lead, Opp, Proposal builder) and won't
screen-hop to show a buyer. So the pack must be **one tap from wherever a unit
already appears.** Display now; Send later; both reuse the same foundation.

---

## The build-once foundation (the anti-rework contract)

### 1. ONE asset resolver — `getPropertyPackAssets(unitId)`
`src/components/property/getPropertyPackAssets.js`
- Fetches the unit (project_units) + its parent project (projects, with media)
- Returns a structured object:
  `{ unit, project, developerName, amenities, assets[] }`
- `assets[]` is a TYPED list: each item `{ type, label, url, scope }`
  (e.g. `{type:'floor_plan', label:'Floor Plan', url, scope:'unit'}`)
- **Display ignores `type`** and just renders. **Send (Phase 2.3) consumes the
  SAME list** — offers a checkbox per asset to attach. No new data plumbing later.
- Single source of truth: Display and Send read the identical resolver.

### 2. ONE trigger — `openPropertyPack(unitId)`
`src/components/property/propertyPackBus.js`
- Tiny helper: dispatches a CustomEvent `propcrm:open-property-pack`
- Any component (Inventory, Lead, Opp, Proposal builder, App.jsx inline)
  imports it and calls `openPropertyPack(unitId)` — one line, no prop-drilling
- Decoupled via event bus → no window-global timing issues, no ordering coupling

### 3. ONE modal, mounted ONCE — `PropertyPackModal.jsx`
`src/components/property/PropertyPackModal.jsx`
- Mounted a single time at App root; floats over everything
- Listens for the event → calls resolver → renders pack (reusing the 5 leaf
  components already built: FullImage, MediaGallery, PdfPreview, VideoEmbed,
  AmenityGrid)
- Contains the greyed **"Share Pack — coming Q3 2026"** button = the exact seam
  where Send plugs in (enable button → asset-picker reads `assets[]`)

### 4. The Send seam (Phase 2.3, NOT built now)
When Send arrives it is ADDITIVE only:
- Enable the existing greyed button
- Add an asset-picker panel that reads the SAME `assets[]` (checkboxes)
- Add the email/WhatsApp/PDF-bundle backend (the 4-week Comms sprint)
- **Display code is not touched.** That is the contract.

### What we deliberately do NOT build now (avoid dead scaffolding)
- No send stubs, no fake attach UI, no empty WhatsApp hooks.
- Foundation + clean seams = yes. Half-built Send features = no.

---

## Phasing (demo-safe, buffer-safe)

- **Phase 1 (now):** resolver + bus + modal + mount once + ONE proving entry
  point (Inventory unit → "Property Pack" button). Commit.
- **Phase 2 (next):** add the one-line trigger to demo-path unit references —
  Opp detail (Scene 3/4) + Proposal builder (Scene 4). Commit per spot.
- **Later (trivial):** Lead detail and anywhere else a unit shows.

## Entry points (where the trigger goes — incremental)
| Location | Phase | Effort |
|---|---|---|
| Inventory unit panel | 1 (prove it) | button + 1 import |
| Opportunity detail (unit ref) | 2 | 1-line onClick |
| Proposal builder (unit shown) | 2 | 1-line onClick |
| Lead detail | later | 1-line onClick |

## Data columns used (all already exist)
- project: hero_image_url, photo_gallery_urls[], amenities[], video_url,
  master_plan_url, brochure_file_url, brochure_url
- unit: floor_plan_url, photo_urls[], brochure_url, render_url

## Parked (Phase 2.3 Communications Overhaul — post-demo)
- Attach pack assets to proposals (the "developer-details proposal")
- Send selected assets (floor plan, master plan, brochure) via email/WhatsApp
- Delivery tracking. All ADDITIVE on this foundation.
