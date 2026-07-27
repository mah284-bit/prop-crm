# lib/supabase.js Refactor — Copy-Paste-Ready Guide

**Purpose:** Eliminate "Multiple GoTrueClient instances detected" warnings + intermittent auth-lock errors by centralising the Supabase client.

**Time to execute:** 25-30 minutes
**Difficulty:** Mechanical (no logic changes)
**Risk:** Low (rollback is one git command)

**Date created:** 04 May 2026
**Status:** Diffs verified against all 6 component files in your repo

---

## What this refactor fixes

Six components currently each call `createClient(SUPABASE_URL, SUPABASE_ANON)` at module-load time. Each call creates a separate `GoTrueClient` instance. They all use the same auth-token storage key (`sb-ysceukgpimzfqixtnbnp-auth-token`), so they fight over reading and refreshing the auth token.

Symptoms you've seen:
- Console warning: *"Multiple GoTrueClient instances detected in the same browser context"*
- Occasional error: *"@supabase/gotrue-js: Acquiring an exclusive Navigator LockManager lock for "lock:sb-..." was not released within 5000ms"*
- Auth seems to work fine but feels flaky during demos

After this refactor: one shared client, one auth instance, clean console.

---

## Files affected (6 components)

| # | File | Path |
|---|---|---|
| 1 | InventoryModule.jsx | `D:\prop-crm\src\components\InventoryModule.jsx` |
| 2 | LeaseOpportunityDetail.jsx | `D:\prop-crm\src\components\LeaseOpportunityDetail.jsx` |
| 3 | LeasingLeads.jsx | `D:\prop-crm\src\components\LeasingLeads.jsx` |
| 4 | LeasingModule.jsx | `D:\prop-crm\src\components\LeasingModule.jsx` |
| 5 | PropPulse.jsx | `D:\prop-crm\src\components\PropPulse.jsx` |
| 6 | ReportsModule.jsx | `D:\prop-crm\src\components\ReportsModule.jsx` |

**Note:** Path adjustment may be needed if your folder structure has subfolders. The import becomes `../lib/supabase` if the component is at `src/components/Foo.jsx`. If you have `src/components/leasing/Foo.jsx`, use `../../lib/supabase`. Adjust accordingly.

---

## STEP 0 — Pre-flight (5 min)

```bash
cd D:\prop-crm
git status
```
Should be clean. If not, commit or stash current changes first.

```bash
git checkout -b refactor/centralize-supabase-client
```
This creates a branch so you can roll back easily.

---

## STEP 1 — Create the central file (2 min)

**Create new file:** `D:\prop-crm\src\lib\supabase.js`

Note: you'll need to create the `lib` folder first since it doesn't exist yet.

```bash
mkdir D:\prop-crm\src\lib
```

Then create the file with this exact content:

```javascript
// src/lib/supabase.js
// Single Supabase client shared across all components.
// Eliminates "Multiple GoTrueClient instances" warnings and
// auth-token storage-key contention errors.
//
// All components import from this file:
//   import { supabase } from "../lib/supabase";

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://ysceukgpimzfqixtnbnp.supabase.co";
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzY2V1a2dwaW16ZnFpeHRuYm5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNDI5OTQsImV4cCI6MjA4OTkxODk5NH0.WZSyGeOEbiRo1wt13syheTOyiAToMWXInxIaBgaqq8k";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);
```

**Why this exact code:** matches the URL + ANON key already hardcoded into all 6 components, uses the same `https://esm.sh` import URL they all use, so behaviour is unchanged — only the storage location moves.

---

## STEP 2 — Apply the diff to each component (15 min)

**Same pattern for ALL 6 files.** Just open each file in VS Code and apply this exact change:

### THE PATTERN (applies to all 6 files identically)

**FIND these 6 lines at the top of the file** (lines 1-6 typically, may shift if there's a comment block):

```javascript
import React, { useState, useEffect, useMemo, useRef } from "react";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL  = "https://ysceukgpimzfqixtnbnp.supabase.co";
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzY2V1a2dwaW16ZnFpeHRuYm5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNDI5OTQsImV4cCI6MjA4OTkxODk5NH0.WZSyGeOEbiRo1wt13syheTOyiAToMWXInxIaBgaqq8k";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);
```

**Note:** the React import may have different hooks listed depending on the file. Just leave that line alone — only the 4 lines below it change.

**REPLACE the 4 Supabase-related lines with:**

```javascript
import { supabase } from "../lib/supabase";
```

### Full before/after for each file

#### File 1 — InventoryModule.jsx

**BEFORE (lines 1-6):**
```javascript
import React, { useState, useEffect, useMemo, useRef } from "react";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL  = "https://ysceukgpimzfqixtnbnp.supabase.co";
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);
```

**AFTER:**
```javascript
import React, { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "../lib/supabase";
```

#### File 2 — LeaseOpportunityDetail.jsx

**Same pattern** — remove lines 2, 4, 5, 6 (the `createClient` import, the URL const, the ANON const, the supabase client creation), replace with the single line:
```javascript
import { supabase } from "../lib/supabase";
```

#### File 3 — LeasingLeads.jsx

**Same pattern.** Same 4 lines to remove, same 1 line to add.

#### File 4 — LeasingModule.jsx

**Same pattern.** Same 4 lines to remove, same 1 line to add.

#### File 5 — PropPulse.jsx

**Same pattern.** Same 4 lines to remove, same 1 line to add.

#### File 6 — ReportsModule.jsx

**Same pattern.** Same 4 lines to remove, same 1 line to add.

---

## STEP 3 — Test locally (5 min)

```bash
cd D:\prop-crm
npm run dev
```

Open `http://localhost:5173` (or whatever Vite reports) → DevTools (F12) → Console tab.

**Hard refresh** with `Ctrl+Shift+R` to clear any cached JS.

### Expected results

✅ **Console should be clean** of these warnings:
- "Multiple GoTrueClient instances detected"
- "Acquiring an exclusive Navigator LockManager lock... not released within 5000ms"

✅ **App functionality unchanged:**
- Login works
- Dashboard loads
- PropPulse browse works
- Inventory works
- Leasing modules work
- Reports work

### If something breaks

**Most likely issue: import path wrong**
If a component lives at `src/components/leasing/SomeFile.jsx` (in a subfolder), the import needs to be `../../lib/supabase` not `../lib/supabase`.

Quick check in VS Code: hover over the import line — VS Code will tell you if it can't resolve the path.

**Less likely: file rendering issue**
If a specific page won't load, check the Console for the specific error. 99% chance it's a typo in the import path.

**Rollback:** see Step 6.

---

## STEP 4 — Commit on the branch (2 min)

```bash
git status
```
Should show:
- New file: `src/lib/supabase.js`
- Modified: 6 component files

```bash
git add src/lib/supabase.js src/components/
git commit -m "Centralize Supabase client into src/lib/supabase.js

Eliminates Multiple GoTrueClient warnings and auth-token contention.
6 components now import shared client instead of creating their own.

Files affected:
- src/components/InventoryModule.jsx
- src/components/LeaseOpportunityDetail.jsx
- src/components/LeasingLeads.jsx
- src/components/LeasingModule.jsx
- src/components/PropPulse.jsx
- src/components/ReportsModule.jsx"
```

---

## STEP 5 — Merge to main and push (2 min)

```bash
git checkout main
git merge refactor/centralize-supabase-client
git push
```

Vercel will auto-deploy. Wait 1-2 minutes, then visit `prop-crm-two.vercel.app`, open DevTools, hard-refresh, verify console is clean in production too.

---

## STEP 6 — Rollback options (just in case)

### If issues found before merging
You're on a branch. Just:
```bash
git checkout main
git branch -D refactor/centralize-supabase-client
```
Nothing on `main` was touched.

### If issues found after merging
Either revert the commit:
```bash
git revert HEAD
git push
```

Or restore the golden tag:
```bash
git checkout golden-pre-stages -- src/components/
# Note: this won't delete src/lib/supabase.js — you'd remove it manually
git commit -m "Revert: restore pre-refactor component files"
git push
```

---

## STEP 7 — Cleanup (1 min)

After verifying everything works on production:

```bash
git branch -d refactor/centralize-supabase-client
```

This deletes the local branch. Done.

---

## Verification checklist

- [ ] `D:\prop-crm\src\lib\supabase.js` exists with the 1-export module
- [ ] All 6 component files import from `../lib/supabase`
- [ ] None of the 6 component files contain `createClient(SUPABASE_URL, SUPABASE_ANON)` anymore
- [ ] Console is clean of GoTrueClient warnings (local + production)
- [ ] App functionality unchanged (login, PropPulse, inventory, leasing, reports)
- [ ] Branch merged to main and pushed
- [ ] Refactor branch deleted

---

## What changes in your repo

**Before:**
```
src/
└── components/
    ├── InventoryModule.jsx       ← creates own Supabase client
    ├── LeaseOpportunityDetail.jsx ← creates own Supabase client
    ├── LeasingLeads.jsx           ← creates own Supabase client
    ├── LeasingModule.jsx          ← creates own Supabase client
    ├── PropPulse.jsx              ← creates own Supabase client
    └── ReportsModule.jsx          ← creates own Supabase client
```

**After:**
```
src/
├── lib/
│   └── supabase.js                ← single source of truth
└── components/
    ├── InventoryModule.jsx        ← imports from lib
    ├── LeaseOpportunityDetail.jsx ← imports from lib
    ├── LeasingLeads.jsx           ← imports from lib
    ├── LeasingModule.jsx          ← imports from lib
    ├── PropPulse.jsx              ← imports from lib
    └── ReportsModule.jsx          ← imports from lib
```

Cleaner. Centralised. Future-proof — when you add new components, they all import from one place. When you need to change Supabase config, one file changes, not six.

---

## Bonus tip — environment variables

You might notice `SUPABASE_URL` is hardcoded in `src/lib/supabase.js`. For better security and dev/staging/prod separation, eventually move it to an env var:

```javascript
// future improvement (not urgent)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://ysceukgpimzfqixtnbnp.supabase.co";
```

Then add `VITE_SUPABASE_URL=...` to your `.env` file and Vercel env vars. Skipping this for now keeps the refactor minimal — one change at a time.

---

*This refactor was overdue and is the highest-leverage 30-minute fix in your codebase right now. Doing it before your next demo means a clean console and no auth-lock errors during live presentations.*

— Refactor guide for Abid Mirza · 04 May 2026
