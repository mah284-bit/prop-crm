# Phase 2.2 — Property Pack Content Seeding Guide (Day 24)

**Goal:** Populate 2-4 REAL projects with media so the Property Pack panel
renders fully for the demo. Reusable — run the template block once per project.

**Reliability rule:** Images + brochures go through **Supabase Storage upload**
(URLs never break). Videos use **YouTube** (embed-safe). Do NOT hotlink
developer-site images — they break on demo day.

---

## STEP 0 — Discovery: confirm exact project names

Run this in **Supabase SQL Editor** first. It lists your verified catalog
projects so we key the seed on REAL names (an UPDATE on a wrong name silently
changes nothing).

```sql
SELECT name, pp_developers.name AS developer,
       (hero_image_url IS NOT NULL)            AS has_hero,
       COALESCE(array_length(photo_gallery_urls,1),0) AS gallery_count,
       COALESCE(array_length(amenities,1),0)          AS amenity_count,
       (master_plan_url IS NOT NULL)           AS has_master_plan,
       (video_url IS NOT NULL)                 AS has_video,
       (brochure_file_url IS NOT NULL)         AS has_brochure_file
FROM public.projects
LEFT JOIN public.pp_developers ON pp_developers.id = projects.pp_developer_id
WHERE is_pp_verified = true
ORDER BY developer, name;
```

Note the EXACT `name` values for the projects you want to seed (e.g. is it
"DAMAC Lagoons" or "Damac Lagoons"? "Sobha Hartland" or "Sobha Hartland Estates"?).
Use those exact strings in STEP 2.

---

## STEP 1 — Upload images + brochure to Supabase Storage

For each project, gather media from the OFFICIAL developer page, then upload:

**Official sources:**
- Emaar Creek Harbour → https://www.emaar.com/en/our-communities/dubai-creek-harbour
- DAMAC Lagoons → https://www.damacproperties.com (search "Lagoons")
- Sobha Hartland → https://www.sobharealty.com (search "Hartland")

**Gather per project (save to your computer first):**
- 1 hero image (wide, landscape — community/skyline shot)
- 3-5 gallery photos (amenities, exteriors, views)
- 1 master plan image (if available)
- 1 brochure PDF (if available)

**Upload steps (Supabase Dashboard):**
1. Left sidebar → **Storage**
2. Use an existing **public** bucket, or click **New bucket** → name it
   `project-media` → toggle **Public bucket = ON** → Save
   (Public is required so images load without a login.)
3. Open the bucket → **Upload files** → select your saved images + PDF
4. For each uploaded file: click it → **Copy URL** (the public URL)
5. Keep these URLs handy for STEP 2 — label which is hero, gallery, etc.

Tip: make a folder per project inside the bucket (e.g. `creek-harbour/`) to stay
organized. The "Copy URL" still gives a full working link.

---

## STEP 2 — Seed SQL (reusable template — one block per project)

Copy the block, fill the PASTE markers with your Storage URLs + amenities,
set the exact project name from STEP 0, and run. Repeat per project.

```sql
-- ===== PROJECT SEED BLOCK (duplicate per project) =====
UPDATE public.projects SET
  hero_image_url     = 'PASTE_HERO_URL_HERE',
  photo_gallery_urls = ARRAY[
    'PASTE_GALLERY_URL_1',
    'PASTE_GALLERY_URL_2',
    'PASTE_GALLERY_URL_3'
    -- add more lines with commas as needed
  ]::text[],
  master_plan_url    = 'PASTE_MASTER_PLAN_URL_OR_REMOVE_THIS_LINE',
  video_url          = 'PASTE_YOUTUBE_URL_OR_REMOVE_THIS_LINE',
  brochure_file_url  = 'PASTE_BROCHURE_STORAGE_URL_OR_REMOVE_THIS_LINE',
  amenities          = ARRAY[
    'Pool','Gym','Concierge','24/7 Security','Retail','Beach Access'
    -- edit to match THIS project's real amenities
  ]::text[]
WHERE name = 'EXACT_PROJECT_NAME_FROM_STEP_0' AND is_pp_verified = true;
-- ======================================================
```

**Rules:**
- Keep the quotes — paste each URL BETWEEN the single quotes.
- If a project has no master plan / video / brochure, DELETE that whole line
  (the panel section self-hides automatically).
- Amenities: free text, any names — the emoji map matches common words
  (Pool, Gym, Marina, Beach, Concierge, Security, Retail, Kids, Spa, Golf, etc.).

**Ready-to-use video (DAMAC Lagoons):**
`https://www.youtube.com/watch?v=x9dDLuhhxwE`  (official DAMAC community film)

---

## STEP 3 — Verify + view

After running each block, re-run the STEP 0 discovery query — the project's
flags (has_hero, gallery_count, etc.) should now show populated.

Then in the app (dev2, `npm run dev`):
PropPulse → Projects → click the project → scroll past the description.
Hero, gallery, master plan, video, amenities render in the light theme.

---

## CLEANUP — remove the Creek Harbour test seed

Creek Harbour currently has picsum placeholder images from Day 23 testing.
Before real content, either overwrite it with a real seed block above, OR
clear the placeholders:

```sql
UPDATE public.projects SET
  hero_image_url     = NULL,
  photo_gallery_urls = ARRAY[]::text[],
  master_plan_url    = NULL,
  amenities          = ARRAY[]::text[]
WHERE name = 'Creek Harbour' AND is_pp_verified = true;
```

(Best: just overwrite Creek Harbour with a real seed block using genuine
Emaar images — it's your flagship project for Scene 1.)

---

## SAFETY

- These are UPDATEs to existing rows (no schema change, no new tables).
- They only touch the named project. A wrong name = 0 rows changed (harmless).
- No git tag needed (data edit, not schema). But if you want a DB snapshot
  first, take a Supabase backup from the dashboard.
