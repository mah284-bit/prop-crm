-- Phase 2.2: Property Detail Pack schema
-- Date: 16 Jun 2026
-- Add 4 columns for property display layer

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS hero_image_url text;
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS photo_gallery_urls text[] DEFAULT ARRAY[]::text[];
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS amenities text[] DEFAULT ARRAY[]::text[];

ALTER TABLE public.project_units
  ADD COLUMN IF NOT EXISTS photo_urls text[] DEFAULT ARRAY[]::text[];

-- Verify
SELECT COUNT(*) as columns_added FROM information_schema.columns
WHERE table_schema='public' AND (
  (table_name='projects' AND column_name IN ('hero_image_url','photo_gallery_urls','amenities'))
  OR (table_name='project_units' AND column_name='photo_urls')
);
