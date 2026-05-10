# PropPlatform / PropCRM — Founder Context (Live)

**Last updated:** 10 May 2026 (Stage 1 + 5 + 6 shipped; v1.3 golden tag)

---

## ENTITY STRUCTURE (CRITICAL — readers must understand this first)

### Who's who in this product

| Entity | Role | Examples |
|---|---|---|
| **BFC** (Broking & Financial Consultancy) | **The founder's company** — owns and builds PropPlatform | Abid Mirza founded this |
| **PropPlatform / PropCRM** | The SaaS product BFC sells to brokers | This codebase |
| **Broker companies** | **The CUSTOMERS** of PropPlatform | Pay BFC for the SaaS subscription |
| **Brokers / Sales agents** | Individual users at broker companies | Use PropPlatform daily |
| **Developers** | UAE real-estate developers brokers contract with | Emaar, DAMAC, Aldar, Sobha, Nakheel, Al Mansoori Properties, etc. |
| **Buyers** | End consumers buying property via brokers | Individuals (e.g. Rajesh Haridas) |

### Common confusion to avoid

❌ **"Al Mansoori is the founder's company"** — NO. Al Mansoori Properties is a DEVELOPER (like Emaar). It's named in test data because it's a real UAE developer used in early testing.

❌ **"BFC is a broker company"** — NO. BFC is the SaaS provider. Broker companies are the CUSTOMERS.

✅ **Correct mental model:**
- BFC builds PropPlatform
- Broker company X subscribes to PropPlatform
- Broker company X has master agreements with developers (Emaar, DAMAC, Al Mansoori, etc.)
- Broker company X uses PropPlatform to track commissions owed by those developers
- Buyers buy properties from developers via broker company X

---

## FOUNDER

**Abid Mirza** — Founder of BFC, building PropPlatform as the SaaS product to sell to broker companies in UAE.

Personal goal achieved 10 May 2026: **"I have done it"** — Stage 1 + 5 + 6 shipped end-to-end.

---

## PRODUCT POSITION

PropPlatform's wedge: **"Brokers stop logging into 5+ developer portals daily"**

Currently in UAE, brokers waste 20-40% of daily time logging into Emaar's portal, DAMAC's portal, Aldar's portal, etc. — checking deal status, payment receipt status, commission outstanding from each developer.

PropPlatform replaces that with ONE dashboard: Master Agreement → SPA closure → auto-invoice → payment tracking. **What each developer owes your broker company, in one view.**

---

## PRODUCTION STATE (v1.3-stage1-stage5-stage6-complete)

### Stage 1 — Master Developer Agreement ✅ SHIPPED
The contract a broker company signs with each developer (Emaar, DAMAC, etc.) defining:
- Commission % on sales
- Bonus commission tiers
- Validity period
- Signed copy (PDF stored in private bucket, AI-validated against form data)

When a new opportunity is created for a unit by [Developer X], commission auto-populates from the active master agreement with [Developer X].

### Stage 5 — SPA Signed = Sale Closed ✅ SHIPPED
When the buyer signs the SPA (Sales & Purchase Agreement) with the developer:
- Closure record created in `pp_sales_closures`
- Pre-SPA payments captured (3-state: Pending/Received/Waived) for booking fee, reservation fee, initial advance, SPA fee, DLD fee 4%, Oqood fee, other fees
- SPA document uploaded to private bucket
- Final sale price locked in opp record
- Stage 4 (pre-SPA payment gates) folded into this dialog (no separate screen)

### Stage 6 — Commission Outstanding Dashboard ✅ SHIPPED (THE killer feature)
- Auto-creates draft commission invoice when SPA is signed
- KPI cards: Total Invoiced, Received, Outstanding, Realization Rate
- By Developer breakdown: how much each developer owes the broker (sorted, with aging)
- By Aging breakdown: Current (0-30d) / Overdue (31-60d) / Critical (60+d)
- Issue Invoice modal: draft → issued (broker enters invoice number + date)
- Record Payment modal: cumulative tracking, partial → paid lifecycle
- Dispute path: status='disputed' with reason

### Stage 4 — folded into Stage 5 dialog (per broker MOM 9 May 2026)
Original spec had detailed milestone tracking. Broker MOM clarified brokers don't track installments (developer's job). Folded simple "pre-SPA payment confirmation" checkboxes into Stage 5 dialog.

---

## TECH STACK

- **Frontend:** Vite + React 19
- **Backend:** Supabase (Postgres + RLS)
- **Hosting:** Vercel (`prop-crm-two.vercel.app`)
- **AI:** Anthropic API (Claude with vision for document validation)
- **Repo:** `github.com/mah284-bit/prop-crm`
- **Project ID:** Supabase `propcrm-dev` (`ysceukgpimzfqixtnbnp`, ap-south-1)

### File structure
- `src/App.jsx` (~14,500 lines)
- `src/components/MasterAgreements.jsx` (~1,180 lines, Stage 1)
- `src/components/CommissionOutstanding.jsx` (~440 lines, Stage 6)
- `api/validate-agreement.js` (Vercel function for AI doc validation)
- `docs/Sales_Cycle_Process_Flow.md` (original spec, Stages 4-6 superseded)
- `docs/Stage_4_5_6_REVISED_Spec.md` (current source of truth)
- `docs/Stage_1_Master_Agreement_Build_Spec.md`
- `docs/Stage_5_Testing_Issues_*.md` (multiple QA logs)

### Storage buckets
- `documents` (PRIVATE, RLS-enforced) — for sensitive agreements + SPAs
- `propcrm-files` (legacy public, deprecated)

---

## DATABASE TABLES (PropPlatform-specific, prefixed `pp_`)

| Table | Purpose | Stage |
|---|---|---|
| `pp_master_agreements` | Master agreement per broker-developer pair | Stage 1 |
| `pp_sales_closures` | One closure record per SPA-signed opp | Stage 5 |
| `pp_commission_invoices` | Commission receivable per closed deal | Stage 6 |
| `pp_developers` | UAE developer entities (Emaar, DAMAC, Al Mansoori, etc.) | Existing |

Plus existing tables: `companies`, `profiles`, `opportunities`, `leads`, `project_units`, etc.

---

## CURRENT TEST DATA (kept for investor demo)

The DB currently has test data including:
- BFC test broker company
- 3 TEST- master agreements (Emaar 4%/0.5%, DAMAC 5%, Aldar Q3 4.5%/1% bonus)
- A few test buyers (e.g. "Rajesh Haridas") with test opportunities
- Test SPA closures (AED 910,000 Emaar deal among others)
- Test commission invoice flowed draft → issued → paid (INV 12345, AED 84,000)

**This data PROVES the system works end-to-end.** Will be cleaned AFTER investor demo, replaced with real broker companies onboarding.

---

## COMMIT HISTORY (today's golden milestone)

```
v1.3-stage1-stage5-stage6-complete (HEAD)
└── 08f6a2f  Stage 6 Phase 3b: Issue + Payment + Dispute modals (STAGE 6 COMPLETE)
└── 2b9c54b  Stage 6 Phase 3a fix: empty developers fallback
└── e20d07f  WIP: Stage 6 Phase 3a (had menu visibility issue)
└── 6fdd38c  Stage 6 Phase 2: auto-create commission invoice on SPA Signed
└── cd46eed  Stage 5 final fix: useEffect syncs final_price state
└── b3578a3  Sprint 1.5: 4th validation path + date UX + unit-booking TODO
└── 99b0cf7  Sprint 1 round 2: Closed Won validation
└── 934ba49  Sprint 1: Stage 5 testing fixes (price fallback, validation)
└── a56ebec (tag: v1.2-golden-stage1-stage5)
```

**24 commits over Saturday + Sunday. ~16 focused hours.**

---

## OPEN ISSUES (to fix in QA Sprint, NOT blocking demo)

See `docs/Testing_Issues_v3_comprehensive.md` for full list.

### HIGH priority (production rollout blockers)
1. **Unit double-booking** — multiple opps for same unit_id can advance through Reserved/SPA/Closed Won independently. Need pre-flight check.
2. **Proposals table schema mismatch** — pre-existing, not Stage 5/6 fault.

### MEDIUM (Stage 5 polish)
1. Booking/Reservation should pre-fill as "Received" at SPA stage (data exists in earlier flow)
2. Quick-fill applies retroactively, not prospectively
3. Save Draft button missing from SPA dialog
4. "Final price required" toast can race-condition occasionally
5. Backward compat for old prePaymentsState (v1 → v2 shape change)
6. Offer Accepted dialog showing AED — (needs opp.budget fallback)

### LOW priority
- Real `developers` list connection in CommissionOutstanding (currently shows "(Unlinked)")
- Test data cleanup post-demo

---

## INVESTOR DEMO SCRIPT

**The story to tell:**

1. **Setup** — "BFC's PropPlatform replaces 5 developer portal logins with 1 dashboard"

2. **Show Master Agreement** — open Master Agreements menu, show Emaar 4%/0.5% agreement with AI-validated PDF

3. **Show new opportunity** — create one for an Emaar unit, point out commission auto-populated from master agreement

4. **Walk through stages** — opp progresses Lead → Site Visit → Offer → Reserved → SPA Signed

5. **At SPA Signed** — fill in Reference, upload PDF, check pre-SPA payments, save → opportunity becomes "SPA Signed" + closure record + auto-draft invoice

6. **Show Commission Outstanding** — open the killer dashboard. Point to:
   - Outstanding amount per developer (the wedge)
   - Aging buckets
   - Issue invoice → enter number → status flips
   - Mark received → status flips to paid
   - Realization rate updates

**Close with:** "Brokers stop juggling 5 portals. PropPlatform tracks the receivables for them."

---

## NEXT STEPS (post-investor demo)

1. **Test data cleanup** — write seed script with real UAE developers, real broker company schemas
2. **QA Sprint** — fix the 8 open issues (~3 hours total)
3. **Stage 3 wiring** — discount approvals into opportunity flow (small piece)
4. **Production onboarding** — first paying broker customer
5. **App.jsx splitting** — 14,500 lines is real tech debt for a future refactor session

---

## STANDING RULES FOR CLAUDE SESSIONS

- App.jsx surgical edits ONLY (Python str_replace scripts, never full file replacements)
- Atomic safety: `if content.count(old) == 1` check, no save if any edit fails
- For destructive SQL: never include casually. Always verify first with SELECT.
- New components in `src/components/`
- Storage: private `documents` bucket for sensitive PDFs, signed URL access
- Backup before edits: `cp src/App.jsx src/App.jsx.backup_<context>`
- Commit IMMEDIATELY after successful test (don't accumulate uncommitted state)
- Read MOM/spec docs first; don't build to imagined possibilities
- For "X required" bugs: grep for ALL paths checking the field (multi-path validation is common)
- Use `cat -A` to reveal invisible characters when patterns mysteriously fail

---

*— Updated 10 May 2026 by Claude after Stage 6 ship + entity structure correction.*
