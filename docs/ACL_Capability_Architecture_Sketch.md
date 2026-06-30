# PropCRM — Capability / ACL Architecture Sketch

**Prepared:** 30 Jun 2026 · for review, then the focused ACL pass
**Trigger:** Founder concern during Stage 7 manager-view test — "we are hard-coding role→capability
rules in code AND data; if brokerages want to freely assign this, issues will arise."
**Status:** SKETCH for decision. No build yet.

---

## 1. The core problem, named precisely

There are **two places** a permission decision lives today, and they fight each other:

1. **`role_capabilities` table** (per company, per role, per capability, `enabled` boolean) —
   this is the GOOD part. It is already data-driven and company-configurable. This is the
   mechanism we WANT.
2. **Hard-coded role lists in code** — e.g. in `OpportunityDetail`, the `canSeeCommission` effect
   auto-passes `["admin","super_admin"]` BEFORE it ever consults the table. This BYPASSES the table.

The conflict: the table says "admin=true, sales_manager=false," but the code *also* hard-codes an
admin bypass. So the table is not really the source of truth — the code overrides it. That's the
rigidity the founder is worried about. If a brokerage wants sales_manager to decide commission and
admin NOT to, the table can express that — but the hard-coded auto-pass won't honor it.

**Root cause:** the gate is enforced in two layers with different logic, and the hard-coded layer wins.

---

## 2. The principle to adopt

> **The `role_capabilities` table is the single source of truth. Code TRUSTS the table.
> Hard-coded role lists in gates are removed (with ONE structural exception below).**

- **Structural (not assignable):** `super_admin` = the company owner. Always sees their own company's
  data. This is ownership, not a grantable permission. Keep this as the only auto-pass.
- **Assignable (everything else):** admin, sales_manager, sales_agent, accounts, etc. — their
  capabilities come ENTIRELY from `role_capabilities`, set per company. No hard-coding.

This matches the founder's repeated principle (and the doc's existing ACL notes):
- **Sales Manager = the commission authority** (sees team deals, decides per-deal adjustments).
- **Admin = operational, not financial** (user/password/company setup) — NOT a commission decider
  by default, but a brokerage CAN grant it if they want.
- **Owner (super_admin) = above all, sees everything** (the real check on the manager).

---

## 3. Where the gate should live — App-layer vs RLS

Two enforcement points. They are NOT either/or — money wants BOTH.

### App-layer (what we have today)
- The React component checks the capability and hides/shows UI.
- **Strength:** fast, flexible, easy to build, good UX (hide what you can't use).
- **Weakness:** it only HIDES in the UI. The data still arrives at the browser. A determined user
  (or a bug, or a direct API call) could read commission numbers that were merely hidden, not denied.

### RLS (Row-Level Security, database-enforced)
- Postgres policies decide, per row, whether a user can even READ the data.
- **Strength:** server-side, un-bypassable. The browser never receives data the user can't see.
- **Weakness:** more complex to write/test; harder to make per-company-configurable (policies are
  schema-level, not per-tenant rows — though they CAN read the role_capabilities table inside the policy).

### Recommendation
- **Commission / money figures: enforce in BOTH.** RLS as the hard wall (company_net, company gross,
  agent payouts of OTHERS must never reach an unauthorized browser), app-layer for UX.
- **General features: app-layer capability check is sufficient** (lower sensitivity).
- **Key insight:** an RLS policy CAN query `role_capabilities` to stay company-configurable — so RLS
  does NOT mean hard-coding. The policy says "allow if this user's role has see_brokerage_commission
  enabled for this company" — reading the same table the UI reads. One source of truth, two enforcers.

---

## 4. What's structural vs assignable (the proposed line)

| Decision | Structural (code) | Assignable (role_capabilities) |
|---|---|---|
| super_admin sees own company | ✅ ownership | — |
| Who sees commission panel | — | ✅ see_brokerage_commission |
| Who sees company margin (gross/net) | — | ✅ (new) see_company_margin |
| Who can adjust per-deal bonus/override | — | ✅ (new) manage_commission_adjustments |
| Who sees only own money (agent) | — | ✅ default when above caps are off |
| Multi-tenant company_id isolation | ✅ structural (RLS, always) | — |

Note: Stage 7 introduced `canSeeCompanyMargin = isAdmin || isManager` — that is ALSO a hard-coded role
list. Under this model it should become a CAPABILITY (`see_company_margin`), read from the table, not
a role check. So the ACL pass also revisits the Stage 7 gate (it works today, but it's hard-coded).

---

## 5. Current state (Al Mansoori) — what the data says today

```
admin          see_brokerage_commission = true   (doc says should default OFF — operational, not financial)
sales_manager  see_brokerage_commission = false  (doc says should be normally GRANTED — he's the authority)
sales_agent    see_brokerage_commission = false  (correct — agents don't see brokerage-side; Stage 7 gives them own-money view)
```

This is BACKWARDS vs the documented intent. The ACL pass corrects the defaults AND removes the code
auto-pass so the table actually governs.

---

## 6. Proposed migration (the focused ACL pass — NOT now)

**Phase A — capability schema (0.5 day)**
- Confirm `role_capabilities` covers the needed capabilities; add `see_company_margin` and
  `manage_commission_adjustments` if we split them out.
- Seed sane per-company defaults (SM granted commission + margin + adjust; admin off by default;
  agent own-money only).

**Phase B — code trusts the table (1 day)**
- Remove the `["admin","super_admin"]` auto-pass in `OpportunityDetail` → keep only `super_admin`
  structural, everything else reads `role_capabilities`.
- Replace Stage 7 `canSeeCompanyMargin = isAdmin || isManager` with a `see_company_margin` capability read.
- Replace the bonus/override button gate with `manage_commission_adjustments`.

**Phase C — RLS for money (1–2 days)**
- Add/verify RLS on `pp_commission_invoices`, and any view exposing company_net/gross, so the DB
  enforces what the UI hides. Policies read `role_capabilities` to stay configurable.

**Phase D — Settings UI (1–2 days)**
- A per-company screen where the owner/admin assigns capabilities to roles freely (the "free
  assignment" the founder wants). This makes the whole model self-serve per brokerage.

**Total: ~3–5 days, post-Stage-7/8, as its own pass.**

---

## 7. Recommendation for RIGHT NOW (to finish the Stage 7 test)

Two clean options:

- **Option A (config-only, recommended):** flip `sales_manager → true` in `role_capabilities` (one
  UPDATE). This is USING the configurable table as intended — NOT new hard-coding. Arun then passes
  `canSeeCommission`, and the Stage 7 `canSeeCompanyMargin` (manager=true) gives him the full panel.
  Test continues. The deeper ACL pass still happens later; this changes no code.

- **Option B (pause + do ACL pass now):** stop the test, do Phase A–B now. Bigger detour; risks the
  "1 step forward 2 back" the founder avoids. Not recommended mid-test.

**Architect lean: Option A** — finish the test using the table (the right mechanism), capture the ACL
pass (already sticky-noted), do it properly post-Stage-8.

---

## 8. The one honest caveat

Even after Option A, two hard-coded role lists remain in code until the ACL pass:
1. `OpportunityDetail` canSeeCommission auto-pass `["admin","super_admin"]`
2. Stage 7 `canSeeCompanyMargin = isAdmin || isManager`

Both WORK today and don't leak agents into company margin. But they are the exact rigidity the founder
flagged. The ACL pass removes them. Until then, the system is correct-but-rigid: changing who sees what
needs a code touch for those two, OR the table grant for canSeeCommission. That's the debt we're
knowingly carrying, documented, to be paid in the ACL pass.

## ⚠️ CLEANUP TAB FOR THE ACL PASS (30 Jun)
During the Stage 7 test we MANUALLY flipped one row to unblock Arun:
  role_capabilities: company c23a2320..., sales_manager, see_brokerage_commission = true (was false).
This was test-setup, NOT the final seeded model. When the ACL pass runs Phase A (seed sane per-company
defaults), this hand-edited row must be RECONCILED — either it becomes the proper seeded default, or
it is removed/overwritten by the seed. DO NOT leave a manual one-off alongside seeded defaults =
double source of truth = the exact "double checks and issues" the founder warned about. Reconcile this
row as part of Phase A.

## GUIDING PRINCIPLE (30 Jun, founder) — hard-codings are the killers
Founder's organizing insight after the 40% mystery + the visibility bugs: things were built as "quick
fixes without futuristic thought," and hard-coded role lists in code are the killers. The 40% split is
the GOOD pattern (companies.default_agent_split_* read from DATA, company-configurable). The BAD pattern
is hard-coded role lists that bypass config: see_all=p_view_leads||p_view_leasing (conflation),
canSeeCommission auto-pass ["admin","super_admin"], canSeeCompanyMargin=isAdmin||isManager.
NORTH STAR FOR THE ACL PASS: every permission/visibility decision reads from configurable data
(role_capabilities / company settings), NEVER a hard-coded role list in code. Only true ownership
(super_admin owns their company) stays structural. If a brokerage wants to reassign who-sees-what, they
do it in Settings — code obeys the table. This is the test for every gate during the ACL pass: "is this
reading config, or hard-coding a role?" If hard-coding → fix it.

## 🔴 ROOT-CAUSE PATTERN (30 Jun) — code trusts hard-coded ROLE STRINGS, not DATA flags/config
Founder has flagged this repeatedly ("it should be free flow", "think before acting"). Today's bugs are
ALL the same disease — code keys off a hard-coded role string instead of the data-driven flag/config
that already exists:

PROVEN INSTANCES:
1. Platform vs tenant super_admin: App.jsx:1352/1379 (Companies tab roles:["super_admin"]) and 2650
   (isSA = role==="super_admin") gate on the STRING. The data already has the correct flag:
   mah284 is_super_admin=true (real platform owner), solebrokeruser is_super_admin=false (tenant owner)
   — but code ignores the flag, so a tenant super_admin gets platform reach (Companies tab, company
   switcher, all-companies user list). Should gate on is_super_admin flag, not role string.
2. see_all = p_view_leads || p_view_leasing (conflation — viewing leads ≠ seeing all deals).
3. canSeeCommission auto-pass ["admin","super_admin"]; canSeeCompanyMargin = isAdmin||isManager.
4. Opportunities list defaulted "All owners" for everyone (fixed app-layer; RLS still pending).

THE CURE (one principle, applied everywhere in the ACL/identity pass):
Every permission/visibility/platform decision must read DATA — is_super_admin flag, role_capabilities
table, company settings — NEVER a hard-coded role string in code. Role strings describe a job title;
they must not BE the access decision. The flags/config are the source of truth; code obeys them.

DO NOT fix piecemeal. The string→flag swap for super_admin LOOKS small but a UI-only swap (hide
Companies tab) while the DATA layer (RLS, queries) still leaks via API = the "looks fixed but isn't"
half-measure. UI gating + RLS scoping must ship together. This is the identity refactor
(Architecture_Multi_Tenant_Identity_Model.md Phases A-E) + ACL pass, done as ONE coherent body of work,
thought through fully before acting. Today's job was to PROVE the pattern (done); the FIX is its own
deliberate pass.
