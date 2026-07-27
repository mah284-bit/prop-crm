# Day 17 — Morning Start Note

**Created:** Day 16 evening (26 May 2026)
**Purpose:** Wake up, read this, know exactly where to begin

---

## Current state (banked + pushed as of Day 16 end)

- **Branch:** `dev2`
- **Latest commit:** `1199872` — Lead Detail country name display polish
- **Phase 2.2A:** ✅ CLOSED (10 commits across Day 15-16)
- **Demo date:** **15 June 2026** (pushed from 5 June — 20 days runway)
- **Working tree:** clean

## Today's mission — Phase 2.2B: Contacts Subsystem (Day 1 of ~4)

**The full vision (from Day 16 evening discussion):**
PropCRM tracks not just the buyer, but the entire stakeholder graph around a lead — spouse, representative, secretary, accounts, manager, family. Each person has their own contact channels (phone, email, WhatsApp, telegram). Every activity (call, WhatsApp, email) gets logged against a specific PERSON, not just the lead.

This is THE Contacts Subsystem. It's the heart of any CRM, done right from day 1 — no slicing/dicing later. Founder's call: build the proper schema now, even if it takes more code, because schema refactors cascade everywhere.

## Architectural decisions already made

**Two tables (full schema from day 1):**

1. **`lead_persons`** — people in the deal
   - id, lead_id, company_id
   - name (required)
   - role (buyer | spouse | representative | secretary | accounts | manager | local_contact | family | other)
   - is_primary_buyer (bool, exactly ONE true per lead)
   - relationship_notes
   - created_at, created_by

2. **`lead_person_contacts`** — channels
   - id, person_id, company_id
   - channel (phone | email | whatsapp | telegram)
   - value (the number/address)
   - label (Home | Work | UAE | India | etc)
   - is_primary_for_channel (per person+channel, only ONE true)
   - created_at

**Existing `leads.phone` + `leads.email`** stays as denormalized convenience fields — read-only mirror of primary buyer's primary phone/email. Backward compatible with all existing code.

## Step-by-step plan for today (Day 17, ~6 hours)

### Step 1 — Schema migrations (45 min)
- Write SQL to create both tables
- Add CHECK constraints for role + channel enums
- Add unique partial index: exactly one is_primary_buyer per lead
- Add unique partial index: exactly one is_primary_for_channel per (person_id, channel)
- RLS policies (authenticated SELECT/INSERT/UPDATE/DELETE within company_id)
- Run in Supabase SQL Editor

### Step 2 — Backfill from existing leads (30 min)
- For every existing lead with phone or email:
  - Create 1 lead_persons row (role='buyer', is_primary_buyer=true, name=lead.name)
  - If phone present, create 1 lead_person_contacts row (channel='phone', is_primary_for_channel=true)
  - If email present, create 1 lead_person_contacts row (channel='email', is_primary_for_channel=true)
- Verify counts match: total leads == total primary buyers in lead_persons

### Step 3 — Frontend hook (30 min)
- Create src/lib/useLeadPersons.js — fetch lead_persons + their contacts for a lead_id
- Returns: { persons: [{...person, contacts: [...]}], loading, error }
- Used by Lead Detail's new "People" section

### Step 4 — Lead Detail "People" section (READ-ONLY) (1-1.5 hr)
- New collapsible section under existing Identity card
- Lists all persons with their role badge + primary phone + primary email
- "Buyer" person highlighted with crown icon or similar
- No edit UI yet — that's Step 5
- Goal: read-only display proves the data flow works

### Step 5 — V2 form integration (2 hr)
- New section in V2: "Contact Persons"
- Show existing persons (read from lead_persons if editLead)
- Add Person button → inline form (name, role dropdown, phone/email rows)
- Mark Primary Buyer (radio across persons)
- Save logic: diff old vs new, INSERT/UPDATE/DELETE rows appropriately
- Validation: at least 1 person with at least 1 contact

### Step 6 — Test + commit (30 min)
- Test: existing leads still display correctly (backfill worked)
- Test: create new lead with 2 persons, primary buyer flag works
- Test: edit existing lead, add second person, save
- Test: Lead Detail "People" section reflects all changes
- Commit + push

## Open questions for founder (decide quickly tomorrow)

**Q1 — Channels list:** I proposed `phone | email | whatsapp | telegram`. Add `landline` separately from phone? Add `sms`?

**Q2 — Roles list:** I proposed `buyer | spouse | representative | secretary | accounts | manager | local_contact | family | other`. Anything missing from founder's experience?

**Q3 — Activity logging:** Day 17 scope OR Day 18-19? Wiring person_id into activities is the natural next step but adds another day.

## What we are NOT doing today

- Activity logging integration (Day 18)
- Communications/WhatsApp send-from-correct-channel logic (Phase 2.3)
- Lead routing / auto-assignment (Day 21+)
- Property Management Services workflow (Post-demo)

## Reference docs

- Phase_2_Backlog_Master_Doc.md (Section 10 — Day 15-16 Phase 2.2A SHIPPED)
- Phase_2_Lead_Lifecycle_Segmentation.md (original 2.2 spec)

## Quick start commands (paste these tomorrow)

```bash
cd /d/prop-crm
git status                    # confirm clean
git log --oneline -5          # confirm 1199872 at HEAD
npm run dev                   # start dev server
```

Then paste this to Claude:
> "Day 17 resume. Read /docs/Day17_Morning_Start.md and let's begin with Step 1 schema migrations."

---

*"PropCRM = the rigor of Salesforce, the simplicity of WhatsApp, with AI doing the heavy lifting that a sales ops team would do in a traditional CRM."* — Founder, Day 16 evening

---

## DEMO DATA REALISM — Critical workstream (added Day 16 evening)

**Founder insight:** Bad demo numbers tell the wrong story. Even a great app loses credibility when investors see "9% realization rate" or 11 identical AED 2M entries. Founder (35 years IT, watches eyebrows in meetings) called this trap before any data scrub started.

**Audit needed across:**
- Commission Outstanding (realization rate must be 70-85%, 13 unlinked deals need real developers)
- Dashboard headline numbers
- PropPulse ("abc" test project must go)
- Leads (corrupted Anoop, generic test names → realistic UAE+international personas)
- Opportunities (coherent deal stories, not test stages)
- Proposals V1→V3 chains on demo opps
- Activities (look "active broker" not "demo seed")

**Personas to design (founder writes narratives, architect writes SQL):**
- Local national: Mohammed Al Mansoori (Sharjah villa, family of 5)
- International investor: India-based, Dubai investment, multi-visit
- Corporate buyer: company + CFO + secretary contacts, office floor
- GCC expat owner-occupier: Saudi family relocating, 3BR apartment

Each persona = coherent journey: lead → opp → proposal V1→V3 → SPA signed → commission invoiced → partially paid.

**Timing:** Week 2 (Days 24-30) — after Phase 2.2B Contacts ships (personas use full schema with multiple persons per lead). Before Week 3 demo practice so practice runs use realistic data.

**Founder rule:** "1st demo win, else you may not get another chance."
