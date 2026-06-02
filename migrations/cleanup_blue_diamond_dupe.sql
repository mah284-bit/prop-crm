-- =====================================================================
-- DATA-QUALITY CLEANUP — Blue Diamond duplicate project
-- KEEP : "Blue Diamond"  (0072f2fb-af5b-4d6e-a8ff-3eff5560a63d)  [proper spacing]
-- DELETE: "BlueDiamond"  (6927360b-158f-4c4c-b563-0d53da01ddcf)  [dupe]
-- Also fixes keeper's developer "Emaar Nakheel" -> "Emaar".
-- Both rows have 0 units -> nothing to relink. Reversible (snapshot first).
-- Run in Supabase SQL editor.
-- =====================================================================

DO $$
DECLARE
  keeper uuid := '0072f2fb-af5b-4d6e-a8ff-3eff5560a63d';
  dupe   uuid := '6927360b-158f-4c4c-b563-0d53da01ddcf';
BEGIN
  -- idempotency: if the dupe is already gone, stop.
  IF NOT EXISTS (SELECT 1 FROM projects WHERE id = dupe) THEN
    RAISE NOTICE 'Dupe already removed. No changes.';
    RETURN;
  END IF;

  -- Safety: refuse to run if the dupe somehow has units (protects against surprise data)
  IF EXISTS (SELECT 1 FROM project_units WHERE project_id = dupe) THEN
    RAISE EXCEPTION 'Dupe has units! Aborting — relink needed first.';
  END IF;

  -- Snapshot the row we are about to delete (undo source of truth)
  CREATE TABLE IF NOT EXISTS _deleted_projects_backup AS
    SELECT * FROM projects WHERE false;
  INSERT INTO _deleted_projects_backup SELECT * FROM projects WHERE id = dupe;

  -- Clean the keeper's developer field
  UPDATE projects SET developer = 'Emaar', updated_at = now() WHERE id = keeper;

  -- Remove the duplicate
  DELETE FROM projects WHERE id = dupe;

  RAISE NOTICE 'Done. Kept Blue Diamond (developer fixed to Emaar); deleted BlueDiamond. Backup in _deleted_projects_backup.';
END $$;

-- VERIFY (should show ONE Blue Diamond, developer = Emaar)
SELECT id, name, developer, is_pp_verified, created_at
FROM projects WHERE name ILIKE '%blue%diamond%';

-- =====================================================================
-- UNDO (if ever needed):
--   INSERT INTO projects SELECT * FROM _deleted_projects_backup
--     WHERE id='6927360b-158f-4c4c-b563-0d53da01ddcf';
--   -- (and optionally revert keeper developer back to 'Emaar Nakheel')
--   DROP TABLE _deleted_projects_backup;
-- =====================================================================
