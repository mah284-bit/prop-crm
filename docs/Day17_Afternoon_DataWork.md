# Day 17 Afternoon — Demo Data Work (SQL-only, no Git diff)

**Date:** 27 May 2026 (Wednesday, Eid Day)
**Session:** Day 17 PM (~11 AM — break for lunch)
**Status:** All work is in Supabase. ZERO code changes.

## What was shipped (database-only)

### 1. Demo Personas Phase 2.2D — 4 leads with full contact graphs

| # | Lead | Type | Intent | Budget | Persons | Contacts |
|---|---|---|---|---|---|---|
| 1 | Anoop K | International | Investor | AED 2M | 3 | 7 |
| 2 | Al Khaleej Trading LLC | Corporate | Corporate | AED 12M (story pivoted to penthouse) | 4 | 10 |
| 3 | Abdullah Al-Ghamdi | GCC Expat | Owner-Occupier | AED 3.5M | 3 | 7 |
| 4 | Mohammed Al Mansoori | Local National | Owner-Occupier | AED 8.5M | 4 | 7 |

**14 persons + 31 contacts created** across these 4 leads.

### 2. Commission Outstanding cleanup
- Was: 9% realization (founder eyebrow-watcher concern)
- After cleanup: 82% (mix of paid/partial/issued/draft)
- After Al Khaleej draft invoice added: 44% (with conversation hook)
- 1 unlinked invoice linked to Aldar Properties
- 16 invoices now span 4 developers (Emaar, Sobha, Aldar)

### 3. Al Khaleej Trading — Deep Demo Journey

**Opp ID:** `2f206a18-7e2e-4f5b-9645-7ed87dd0f05e`
- Unit: EPR-008 Atlantis The Royal (4BR Penthouse)
- AED 20M asking → AED 18.5M agreed (7.5% discount)
- Stage: Negotiation
- 3 proposals (V1 superseded, V2 superseded, V3 sent/reviewing)
- 7 activities across 7-day timeline
- 1 draft commission invoice (AED 790,875 net)

### 4. Story arcs created
- **Stakeholder graph:** MD signs, CFO scrutinizes, EA gatekeeps, Manager brings tech team
- **Negotiation drama:** V1 (asking) → CFO pushback → V2 (5% off + DLD split) → MD wants more → V3 (7.5% + 30/70 + parking)
- **Activity timeline:** cold inquiry → discovery → site visit → V1 → CFO call → V2 → WhatsApp → V3

## What's NOT in Git
- All SQL above was run interactively, not committed as migration files
- Future option: extract these as Supabase migration SQL files for replay on fresh DBs (Phase 2.5 nice-to-have)

## Demo readiness score (architect's read, 27 May lunch)

| Surface | Status |
|---|---|
| Dashboard (AED 36.2M pipeline, 25% conv) | ✅ Demo-ready |
| Leads list (Anoop, Al Khaleej, Abdullah, Mohammed visible) | ✅ Demo-ready |
| Lead Detail with 4-stakeholder People sections | ✅ Demo-ready |
| Al Khaleej opp 7-tab dashboard | ✅ Demo-ready |
| Proposals V1→V2→V3 audit trail | ✅ Demo-ready |
| Activities timeline | ✅ Demo-ready (Day 19 will wire person_id) |
| Commission Outstanding (44%, conversation hook) | ✅ Demo-ready |
| PropPulse | ✅ Demo-ready (unchanged from prior) |
| AI Coach | ✅ Demo-ready (unchanged from prior) |

## Resume at 3 PM — options menu

**Option A — More persona deep journeys** (1-2 hrs each)
- Anoop K opp + proposals + activities (investor angle)
- Mohammed Al Mansoori opp + villa story (Emirati family angle)

**Option B — Demo polish**
- "abc" test project cleanup
- Sample brochure uploads (15-30 min)
- ✏ edit-icon variation-selector fix

**Option C — Day 19 activity logging integration**
- Schema migration (add person_id to activities)
- UI dropdown in LogActivity modal
- Activity card displays person+role
- ~3-4 hours

**Option D — Investor narrative rehearsal**
- Walk through demo script v3 with current state
- Update v3 to v4 with new persona names + 36.2M pipeline + 44% Commission
- Practice the conversation hooks
