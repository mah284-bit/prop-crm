# PropPlatform — Investor Demo Dry-Run Script

**Demo Date:** Thursday 14 May 2026
**Dry-Run Date:** Tuesday 12 May 2026
**Presenter:** Abid Mirza (Super Admin)
**Audience:** Investors

This script is a step-by-step walkthrough for the investor demo. Run through it yourself today to find gaps. The same script doubles as a tester instruction document.

---

## PRE-DEMO CHECKLIST (5 min before investor meeting)

1. **Browser:** Open Chrome in incognito mode (clean state, no cached login)
2. **URL:** Navigate to prop-crm-two.vercel.app
3. **Login:** Use your Super Admin credentials
4. **Hard refresh:** Ctrl+Shift+R
5. **Window:** Maximize browser (full screen for visibility)
6. **Devtools:** CLOSE devtools (no scary console)
7. **Network:** Verify good connection (UAE servers ~50ms)
8. **Backup plan:** Have screenshots ready in case live demo glitches
9. **Phone:** Silent mode
10. **Water:** Glass of water ready (long talk ahead)

---

## DEMO STORY ARC (~25 minutes total)

The story follows ONE complete deal lifecycle, showing how PropPlatform replaces 5+ developer portals with one professional CRM. Each scene builds on the previous.

```
Opening hook (2 min)
   ↓
Scene 1: Master Agreement = pricing power (3 min)
   ↓
Scene 2: Lead → Opportunity = auto-commission (4 min)
   ↓
Scene 3: Negotiation → Offer Accepted = price override + commission warning (5 min)
   ↓
Scene 4: Reserved = booking + reservation commitment (3 min)
   ↓
Scene 5: SPA Signed = payment collection + live commission preview (5 min)
   ↓
Scene 6: Closed Won = signature + audit trail (2 min)
   ↓
Scene 7: Commission Outstanding Dashboard = the killer feature (3 min)
   ↓
Closing pitch (1 min)
```

---

## OPENING HOOK (2 min)

**What you say:**
> "Imagine you're a UAE real estate broker. You have deals with 5+ developers — Emaar, DAMAC, Aldar, Sobha, Nakheel. Every morning you log into 5 different developer portals just to check: has my deal closed yet? Have I been paid yet? You waste 2-3 hours a day on this ritual. And when investors ask about your commission pipeline, you can't answer instantly. That's what PropPlatform solves."

**What's on screen:**
- Open the home page (Dashboard)
- Don't click anything yet — let them absorb the layout

**Investor takeaway:**
- "This solves a real, painful, daily problem"

---

## SCENE 1 — Master Agreement = Pricing Power (3 min)

**What you say:**
> "Everything starts with the master agreement. This is the contract between us — the broker — and each developer. It defines commission rate, payment terms, discount authority. Once configured, the system uses it as the source of truth for every deal we do with that developer."

**Click sequence:**
1. Click "Master Agreements" in left nav
2. Show the list — multiple developers visible
3. Click on "Emaar Properties" agreement
4. Show:
   - Commission %: 4.0%
   - Payment trigger: SPA Signed
   - Discount authority: up to 5%
   - Status: Active

**What you say while showing:**
> "Notice the AI-validated terms — we use Claude to read the actual signed PDF agreement and extract the commission terms, so we don't rely on manual data entry. This prevents disputes later."

**Investor takeaways:**
- AI moat
- Compliance-grade source of truth
- Foundation for everything else

**⚠️ FALLBACK IF GLITCH:**
- If page doesn't load, say: "The system has 20+ developers configured" and move to next scene
- Don't dwell on errors

---

## SCENE 2 — Lead → Opportunity (4 min)

**What you say:**
> "A lead comes in — could be from WhatsApp, a referral, our website. Let me create a quick example."

**Click sequence:**
1. Navigate to "Leads"
2. Click "+ New Lead"
3. Fill in:
   - Name: "Mohammed Al-Rashid"
   - Phone: +971 50 555 1234
   - Email: mohammed.alrashid@example.com
   - Budget: AED 2,500,000
   - Status: New
4. Save

**What you say:**
> "Now I qualify them, schedule a site visit... let me jump ahead to where I create the opportunity for a specific unit."

**Click sequence:**
5. Convert lead to opportunity OR navigate to existing buyer with opp creation
6. Open New Opportunity dialog
7. Find a specific Emaar Beachfront unit (e.g., EBT-10-06)
8. Note: AVAILABLE units only (Reserved units are filtered or warned)
9. Save opportunity

**What you say while showing:**
> "Watch this — the system auto-populates the commission percentage from the Emaar master agreement. The broker doesn't enter this. It's pulled from the contractual source. That's data integrity."

**Investor takeaways:**
- Auto-data from master agreement
- Multi-source lead capture
- Unit-level inventory integration

**⚠️ FALLBACK:**
- If creation fails, navigate to an existing opp like Satish Sabnis EBT-10-06

---

## SCENE 3 — Negotiation → Offer Accepted (5 min) ⭐ KILLER MOMENT 1

**What you say:**
> "Now the negotiation happens. Buyer wants a discount. Watch how the system enforces broker compliance."

**Click sequence:**
1. Open Mohammed's opp (or existing opp at Negotiation)
2. Click "Advance to Offer Accepted"
3. Stage gate dialog opens
4. Show the "Agreed Pricing" card:
   - Unit Asking Price: AED 2,500,000
   - Approved Discount: 4%
   - Net Offer Price: AED 2,400,000 (calculated)
5. Click "⚠️ Override Price (negotiated separately)" button

**What you say:**
> "Sometimes the negotiation results in a different price than the standard discount allows. The broker can override — but watch what happens."

6. Change the override price to AED 2,300,000 (lower than calculated)

**EXPECTED:** Commission Impact Warning appears in yellow box:
```
⚠️ Commission Impact Warning
Calculated: AED 2,400,000    Override: AED 2,300,000
Original commission @ 4%: AED 96,000
New commission @ 4%: AED 92,000 (-AED 4,000)

Confirm this price matches developer's authorization.
Your broker license depends on accurate price tracking.
```

**What you say:**
> "The system shows the broker EXACTLY how their commission changes. AED 4,000 less in this case. It reminds them their license depends on accurate pricing. This isn't a CRM — this is compliance software that protects both the broker and the developer."

7. Click "Confirm Offer Accepted"

**Investor takeaways:** ★★★★★
- Real-time commission impact
- Broker self-policing
- Audit trail (override gets logged to activities)
- Compliance-grade

**⚠️ FALLBACK:**
- If override button doesn't appear, just show the calculated price + say "system enforces calculated pricing"
- Skip the override demo

---

## SCENE 4 — Reserved (3 min)

**What you say:**
> "Buyer commits with booking and reservation fees. These are the deal anchor — non-refundable in most cases."

**Click sequence:**
1. Advance opp to "Reserved" stage
2. Reservation dialog opens
3. Fill in:
   - Reservation fee: AED 50,000
   - Reservation date: today
4. Save

**EXPECTED:** Stage advances to Reserved. Banner on opp detail shows the unit reference.

**What you say:**
> "Notice the unit reference is now prominent — EBT-10-06. Brokers handling 50+ deals can never forget what unit is what. Plus, this unit is now locked out from other brokers' opportunities — preventing double-booking."

**Investor takeaways:**
- Anti-double-booking
- Unit visibility throughout workflow
- Data integrity

---

## SCENE 5 — SPA Signed = Payment Collection (5 min) ⭐ KILLER MOMENT 2

**What you say:**
> "Now we enter the payment collection phase. The buyer pays multiple fees over days or weeks. The broker tracks each payment as it happens."

**Click sequence:**
1. Click "Advance to SPA Signed"
2. SPA Signed dialog opens
3. Show:
   - Title: "📄 Record SPA Signing — Mohammed Al-Rashid · 🏠 EBT-10-06"
   - Pre-filled fees: Booking fee, Reservation fee, DLD fee (from earlier stages)
4. Mark fees one by one:
   - Initial advance: AED 300,000 received today
   - SPA fee: AED 5,000 received
   - Oqood: AED 4,020 received
   - Other developer fees: Waived
5. Upload SPA document (sample PDF)
6. Click DLD payer = "Buyer pays"

**EXPECTED to show:**

```
📊 Payment Summary
Total Received: AED 459,020
Total Waived: AED 0
Pending items: 0
Buyer paid %: 19.1%
Outstanding to developer: AED 1,940,980

💰 Your Commission Preview
Sale price × 4%: AED 96,000
VAT 5%: AED 4,800
Net commission: AED 100,800

💳 Initial Advance Credit Note
Recorded as Received: AED 300,000
Less Booking fee credit: (AED 100,000)
Less Reservation fee credit: (AED 50,000)
Actual buyer paid this stage: AED 150,000
```

**What you say while pointing:**
> "Three things investors should notice:
> 1. Live payment summary — broker sees what's collected, what's outstanding
> 2. Live commission preview — at every save, broker knows exactly what they earn
> 3. Credit note — booking and reservation fees credit toward initial advance, no double-counting"

7. Click "Confirm SPA Signed" to save

**Investor takeaways:** ★★★★★★
- Real-time financial visibility
- Commission as a continuous live calculation
- Production-grade payment tracking

**⚠️ FALLBACK:**
- Use Rajesh EBT-09-05 as backup demo opp (already shipped + tested)

---

## SCENE 6 — Closed Won (2 min)

**What you say:**
> "All payments are collected. Buyer signs SPA at developer's office. Now we close the deal."

**Click sequence:**
1. Click "Advance to Closed Won"
2. Closed Won dialog opens

**EXPECTED:**
- Final Sale Price shows AED 2,300,000 with `🔒 Locked from SPA Signed`
- No edit button (read-only)
3. Click "🏆 Close Won" button

**EXPECTED:** Stage advances to Closed Won, opp marked as won.

**What you say:**
> "Price is locked — SPA is legally signed, can't be changed. The system creates a commission invoice draft automatically. Let me show you the killer dashboard."

**⚠️ FALLBACK:**
- If validation blocks (e.g., a fee still pending), explain "Gate enforces all fees + SPA doc — that's what prevents premature deal closure"

---

## SCENE 7 — Commission Outstanding Dashboard (3 min) ⭐ KILLER MOMENT 3

**What you say:**
> "Remember the opening — broker logs into 5+ developer portals daily? This dashboard replaces that ritual."

**Click sequence:**
1. Navigate to "Commission Outstanding"
2. Show:
   - Total outstanding: AED X across deals
   - By developer breakdown
   - By aging buckets (0-30 / 31-60 / 60-90 / 90+)
   - Realization rate
   - Per-deal drill-down

**What you say:**
> "Every closed deal becomes a commission invoice draft. Broker can mark each as Issued, Paid (partial or full). The dashboard shows their entire receivables position at a glance. By developer, by age, by realization rate. This is what brokers tell me is the #1 missing feature in every other CRM."

**Investor takeaways:** ★★★★★★
- Single source of truth for cash flow
- Replaces multiple developer portals
- Real-time receivables management
- Data nobody else has (long-term moat)

---

## CLOSING PITCH (1 min)

**What you say:**
> "What you've seen:
>
> 1. **Master Agreements as source of truth** — AI-validated, auto-populated commission
> 2. **Stage gates enforce data integrity** — broker can't bypass commitment payments, send zero-value proposals, or skip evidence
> 3. **Live commission preview** at every save — broker always knows what they earn
> 4. **Multi-day deal closing** — save partial state, return, no data lost
> 5. **Commission Outstanding Dashboard** — one screen replaces 5+ portals
> 6. **Multi-tenant architecture** — built for scale from day one, security-first
>
> PropPlatform isn't a CRM. It's UAE broker compliance software with a CRM frontend. We're building the data moat that brokers need but no incumbent provides."

---

## DRY-RUN FINDINGS LOG

During your dry-run today, capture any issues here:

### Things that worked ✅
- (list as you go)

### Things that need fixing 🔴
- (list as you go)

### Things to mention to investors 💡
- (list as you go)

### Edge cases to test 🔍
- (list as you go)

---

## CONTINGENCIES

| Scenario | Action |
|---|---|
| Browser crash | Refresh page, reload last state |
| Login fails | Check Supabase status, fallback to screenshots |
| API timeout | Wait 10 sec, refresh, continue from last known state |
| Unexpected validation error | Acknowledge: "Demo glitch, system has X feature" + move on |
| Investor asks about feature X | If shipped: demo it. If not: "On our roadmap, here's the spec" |
| Internet down | Use screenshots fallback |

---

## TIMING DISCIPLINE

- 25 minutes total demo
- ~5 min Q&A
- Don't go over 35 min total
- Watch the time — if running long, skip Scene 4 (Reserved is easiest to compress)

---

## POST-DEMO ACTIONS

1. Thank investor
2. Send follow-up with:
   - Spec docs links (CURRENT_STATUS, Stage_Gate_Enforcement, Access_Control)
   - Investor pitch deck PDF
   - Demo recording (if they recorded)
3. Update demo prep doc with findings
4. Note investor questions for follow-up

---

*Demo script generated 12 May 2026 for dry-run + actual demo Thursday 14 May 2026.*
