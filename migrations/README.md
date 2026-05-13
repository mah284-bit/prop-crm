# Migrations

**Purpose:** Database schema migrations for PropPlatform CRM.

This folder contains SQL files that modify the database schema. Each migration
is timestamped and numbered for clear execution order.

---

## Naming Convention

```
YYYY-MM-DD_NNN_description.sql
```

- **YYYY-MM-DD** = date the migration was authored
- **NNN** = sequence number for that day (001, 002, ...)
- **description** = brief snake_case description
- **999** sequence reserved for rollback scripts

Examples:
- `2026-05-14_001_add_current_columns.sql` (apply this)
- `2026-05-14_002_backfill_current_columns.sql` (then apply this)
- `2026-05-14_999_rollback_phase1.sql` (emergency use only)

---

## Execution Order

Migrations MUST be applied in numerical order:
1. `_001_` first
2. `_002_` second
3. etc.

The `_999_` rollback scripts are NOT run in normal flow.
Use ONLY when migrations fail and need to be undone.

---

## How to Execute

### Production (Supabase)

1. **Backup first** — Supabase Dashboard → Database → Backups → Create
2. Open Supabase SQL Editor
3. Open the migration file in this folder
4. Copy entire contents
5. Paste into SQL Editor
6. Click "Run"
7. Verify by running verification queries at the bottom of the file
8. Mark migration applied (note in `MIGRATION_LOG.md` if you maintain one)

### Local dev (if you have a local Postgres copy)

```bash
# From repo root
psql $DATABASE_URL -f migrations/2026-05-14_001_add_current_columns.sql
```

---

## Sprint Day 2 Execution Plan (14 May 2026)

### Pre-flight (5 min)
- [ ] Verify Supabase admin access
- [ ] Backup database (Supabase Dashboard)
- [ ] Note current opportunities count: `SELECT COUNT(*) FROM opportunities;`
- [ ] Open both SQL files in Supabase SQL Editor (separate tabs)

### Execute (10 min)
- [ ] Run `2026-05-14_001_add_current_columns.sql`
- [ ] Confirm "Success" or no errors
- [ ] Run verification queries at bottom of file (uncomment to run)
- [ ] Run `2026-05-14_002_backfill_current_columns.sql`
- [ ] Check NOTICE output (should show backfill statistics)
- [ ] Run manual verification queries (Section 7 of file 002)

### Sanity check (5 min)
- [ ] Open localhost app, verify it still loads
- [ ] Open an existing opp, verify it displays correctly
- [ ] No console errors

### If anything fails
1. Stop immediately
2. Note exact error message
3. Run `2026-05-14_999_rollback_phase1.sql` (uncomment Section 2 first)
4. Verify rollback complete
5. Discuss before retrying

---

## Spec Reference

For full design rationale, see:
- `docs/Math_Flow_Schema_Design.md` (Section 2 = Phase 1 details)
- `docs/Sprint_Plan_15_to_27_May_2026.md` (Day 2 task)

---

## Future Migrations (Planned)

### Phase 2 (Day 5+): Proposal Versioning
- `2026-05-DD_001_add_proposal_versions_table.sql`
- `2026-05-DD_002_link_current_proposal_to_opps.sql`
- `2026-05-DD_999_rollback_phase2.sql`

See `docs/Math_Flow_Schema_Design.md` Section 3 for full design.

---

*Last updated: 13 May 2026 (Wednesday evening)*
