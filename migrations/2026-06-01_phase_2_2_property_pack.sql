-- =====================================================================
-- Phase 2.2 — Property Detail Pack — Schema Migration
-- =====================================================================
-- File:      migrations/2026-06-01_phase_2_2_property_pack.sql
-- Date:      01 June 2026 (Day 23 build)
-- Safety tag: pre-phase-2.2-schema (create BEFORE running this)
-- Purpose:   Add 4 missing columns for the Property Detail Pack display layer.
--            All other required columns already exist (brochure_url,
--            brochure_file_url, master_plan_url, website_url, video_url,
--            floor_plan_url).
--
-- Discipline: Fully idempotent. IF NOT EXISTS on every ALTER.
--             Re-running is safe. No RLS changes, no new tables,
--             no realtime publication changes (editorial content, not
--             transactional).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. projects — add 3 columns
-- ---------------------------------------------------------------------
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS hero_image_url text;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS photo_gallery_urls text[] DEFAULT ARRAY[]::text[];

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS amenities text[] DEFAULT ARRAY[]::text[];


-- ---------------------------------------------------------------------
-- 2. project_units — add 1 column
-- ---------------------------------------------------------------------
ALTER TABLE public.project_units
  ADD COLUMN IF NOT EXISTS photo_urls text[] DEFAULT ARRAY[]::text[];


-- ---------------------------------------------------------------------
-- 3. Verification — expected: 4 rows
-- ---------------------------------------------------------------------
SELECT 'projects' AS tbl, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'projects'
  AND column_name IN ('hero_image_url', 'photo_gallery_urls', 'amenities')
UNION ALL
SELECT 'project_units' AS tbl, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'project_units'
  AND column_name = 'photo_urls'
ORDER BY tbl, column_name;
-- Expected output:
--   project_units | photo_urls
--   projects      | amenities
--   projects      | hero_image_url
--   projects      | photo_gallery_urls


-- =====================================================================
-- ROLLBACK (commented — uncomment + run only if you need to revert)
-- =====================================================================
-- ALTER TABLE public.projects      DROP COLUMN IF EXISTS hero_image_url;
-- ALTER TABLE public.projects      DROP COLUMN IF EXISTS photo_gallery_urls;
-- ALTER TABLE public.projects      DROP COLUMN IF EXISTS amenities;
-- ALTER TABLE public.project_units DROP COLUMN IF EXISTS photo_urls;
-- =====================================================================
