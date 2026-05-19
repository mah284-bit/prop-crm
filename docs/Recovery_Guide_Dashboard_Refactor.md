# Dashboard Refactor — Recovery Guide

**Created:** 19 May 2026 (Tuesday evening)  
**Purpose:** If dashboard refactor breaks something, this doc tells you how to recover  
**Owner:** Abid Mirza (founder)

---

## Quick Reference — Safety Tags

```
v2.5-monday-stable          ← Monday's golden tag (all working state)
pre-tuesday-work-19-may-2026 ← Before Tuesday work started
pre-dashboard-redesign-19-may-2026 ← Just before dashboard refactor (ACTIVE)
```

---

## Recovery Levels

### Level 1 — Single edit went wrong (most common)
**Symptom:** Just applied a Python fix script, browser shows broken UI

```bash
cd /d/prop-crm
git checkout src/App.jsx
```

This discards the uncommitted change. App.jsx returns to last commit.

---

### Level 2 — Bad commit was pushed
**Symptom:** Committed something, then realized it's broken

```bash
cd /d/prop-crm
git revert HEAD --no-edit
git push
```

This adds a NEW commit that undoes the bad one. History preserved.

---

### Level 3 — Multiple bad commits to revert
**Symptom:** Several commits ago things were good, want to roll back

```bash
cd /d/prop-crm
# Check recent commits first
git log --oneline -10

# Revert to a specific tag
git reset --hard pre-dashboard-redesign-19-may-2026
git push --force-with-lease
```

⚠️ **Use --force-with-lease, NOT --force** (safer)

---

### Level 4 — Everything is broken
**Symptom:** Dashboard refactor went sideways, want yesterday's state

```bash
cd /d/prop-crm
git reset --hard v2.5-monday-stable
git push --force-with-lease
```

This brings back Monday's golden state (before Tuesday's 8+ commits).

---

### Level 5 — Total disaster
**Symptom:** Local clone is corrupted, can't recover

```bash
# Backup uncommitted files first if any
cd /d
mv prop-crm prop-crm-broken-backup

# Re-clone from GitHub
git clone https://github.com/mah284-bit/prop-crm.git
cd prop-crm
# Reset to a known-good tag if needed
git reset --hard v2.5-monday-stable
```

---

## Verification After Recovery

After any recovery step, verify by running:

```bash
cd /d/prop-crm
# Check current state
git log --oneline -5
git status

# Hard refresh localhost:3000 in browser
# Test critical flows:
# 1. Open Opportunities tab - list should show
# 2. Open any opp - detail page should load
# 3. SPA dialog - should open and show calculations
```

If those 3 work, you're recovered.

---

## What NOT to Do

❌ **Don't run `git push --force` (without --force-with-lease)** — can overwrite teammates' work  
❌ **Don't manually edit .git folder** — use git commands  
❌ **Don't delete the local repo without backing up uncommitted changes**  
❌ **Don't run `git reset` AFTER successful push without checking origin** — verify what you're rolling back

---

## What's Reversible vs Permanent

### Reversible (any time)
- Uncommitted changes → `git checkout`
- Pushed commits → `git revert` (preserves history)
- Hard reset to tag → `git reset --hard`

### Permanent (requires re-doing)
- Schema migrations (SQL changes)
- Data backfills
- Files deleted outside git

**For dashboard refactor: schema is unchanged, only App.jsx + new doc files.** Easy recovery.

---

## Refactor Phase Checkpoints

As we build, commits are made per phase:

| Phase | Description | Recovery target if this fails |
|---|---|---|
| 1 | Safety tag + investigation | (no code change yet) |
| 2 | Tab strip + welcome state | `pre-dashboard-redesign-19-may-2026` |
| 3 | Proposals panel wired | Previous commit |
| 4 | Financials panel wired | Previous commit |
| 5 | Other panels wired | Previous commit |
| 6 | Edit-latest flow | Previous commit |
| 7 | Tight header + controls | Previous commit |
| 8 | Final polish + golden tag | Previous commit |

**After phase 8 succeeds:** Tag `v2.6-dashboard-redesign-stable`

---

## When to Stop and Recover

Stop and recover if:
- ❌ Opportunities tab won't load
- ❌ Opp detail shows white screen
- ❌ Console shows critical errors blocking interaction
- ❌ You feel uncertain about the state

**It's better to recover and re-try than push through confusion.**

---

## Confidence Boosters

Today's safety net:
1. ✅ Safety tag `pre-dashboard-redesign-19-may-2026` pushed to origin
2. ✅ Monday's golden tag `v2.5-monday-stable` exists
3. ✅ Each phase = separate commit (granular rollback)
4. ✅ This recovery doc exists
5. ✅ App.jsx is the only file being heavily modified

**You can always go back. You can always try again.**

---

## Emergency Contact Steps

If completely stuck:

1. Run `git status` to capture state
2. Run `git log --oneline -10` to see recent commits
3. Note any error messages exactly
4. Recovery to `pre-dashboard-redesign-19-may-2026`
5. Take a break (decisions made tired = bad decisions)
6. Try again with fresh eyes

---

*Document created: 19 May 2026 (Tuesday)*  
*Refactor in progress: Dashboard Card Grid → Tabs + Lavish Panel*  
*Aligned with: Investor demo prep + tester readiness*
