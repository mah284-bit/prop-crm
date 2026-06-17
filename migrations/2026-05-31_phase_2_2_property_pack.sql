-- Phase 2.2 Property Detail Pack schema migration
-- Date: 31 May 2026
-- Adds 4 columns for rich property media display

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

-- 3. Verification query (run this separately to confirm)
-- SELECT 'projects' AS tbl, column_name FROM information_schema.columns
-- WHERE table_schema='public' AND table_name='projects'
--   AND column_name IN ('hero_image_url','photo_gallery_urls','amenities')
-- UNION ALL
-- SELECT 'project_units' AS tbl, column_name FROM information_schema.columns
-- WHERE table_schema='public' AND table_name='project_units'
--   AND column_name = 'photo_urls';
-- Expected: 4 rows
