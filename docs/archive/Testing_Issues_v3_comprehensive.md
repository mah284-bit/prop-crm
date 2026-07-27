# PropPlatform — Testing Issues Log (10 May 2026, comprehensive)

**Last updated:** Stage 5 SHIPPED + v2 redesign + final state fix all live.
**Stage 6 starting:** Phase 1 (schema) deployed, Phase 2 (auto-create) ready to run.

This log captures EVERYTHING found during testing — across multiple sessions —
to be batched into a focused QA Sprint after Stage 6 ships.

---

## ✅ FIXED & SHIPPED

### Stage 1 (Master Agreement) - 8 days
All 8 days shipped to production. AI validation working.

### Stage 5 (SPA Signed = Sale Closed)
- SPA dialog with all fields ✅
- pp_sales_closures table + RLS ✅
- 3-state pre-SPA payments (Pending/Received/Waived) ✅
- Quick-fill date with Apply button ✅
- Date validation gate ✅
- "Final price required" toast resolved (useEffect syncs state) ✅
- 4 validation paths reconciled ✅

### Stage 6 (Commission Outstanding) - in progress
- Phase 1: pp_commission_invoices table + RLS ✅ (deployed today)
- Phase 2: auto-create on SPA Signed (ready to run)
- Phase 3: Dashboard UI (next)
- Phase 4: Mark Received flow (after dashboard)

---

## 🔴 OPEN ISSUES — Categorized by priority

### CRITICAL (must fix before production demo to investor)

#### Issue 1 — Closed Won "Confirm does nothing" (Status: TBD)
**Symptom:** User reported clicking Confirm in Closed Won dialog appears to do nothing.
**Hypothesis:** Either silent JavaScript error OR validation passing but commit silently failing.
**Action:** Capture browser console errors during reproduction. **Defer fix until Stage 6 ships then diagnose with fresh console output.**
**Effort:** 15-30 min once console errors captured.

---

### HIGH (production rollout blocker, not demo blocker)

#### Issue 2 — Unit Double-Booking
**Symptom:** Multiple opportunities for the same unit_id can advance through Reserved/SPA Signed/Closed Won independently. The unit's status flips Sold/Reserved on commit but doesn't BLOCK other opps.
**Real-world rule:**
- Unit Reserved by Opp A → Other opps cannot select it
- Unit booked (paid) → Other opps locked out
- Released after stipulated time (e.g. 14 days no payment) → Available again
- Permanent lock once Closed Won → Sold

**Implementation needed:**
1. **Pre-flight check in commitStageMove:** if toStage in [Reserved, SPA Signed, Closed Won], verify no OTHER opp on same unit_id has reached Reserved+
2. **Block message on unit picker:** filter out units already Reserved/Sold from unit search dropdowns in opportunity creation
3. **Auto-release timer:** background job marks units back to Available if reserved >X days without booking payment received
4. **Override path:** admin can force-release a unit (with reason logged)

**Effort:** ~45 min for basic block (1+2). ~2 hours for full auto-release logic (1+2+3+4).
**Priority:** HIGH but not Stage 6 demo blocker (single-broker single-unit demo path).

#### Issue 3 — Proposals Table Schema Mismatch (pre-existing)
**Symptom:** Browser console shows multiple `400 Bad Request` errors when creating proposals:
```
Proposals table is missing column 'discounted_price'
Proposals table is missing column 'lead_id'
Proposals table is missing column 'payment_plan'
Proposals table is missing column 'structured_data'  (even fallback fails!)
```
**Root cause:** Code expects columns that don't exist in proposals table, falls back to structured_data, but THAT also fails.
**Severity:** HIGH — but this is PRE-EXISTING, not introduced by Stage 5/6 work.
**Effort:** ~30 min to add migration that creates the missing columns OR fix code to use existing structure.

---

### MEDIUM (Stage 5 polish — deferred to QA Sprint)

#### Issue 4 — Booking/Reservation should pre-fill as "Received" at SPA stage
Process flow already has booking + reservation fee captured during Reserved stage. Should pre-fill those 2 checkboxes as "Received" with dates from earlier flow when SPA Signed dialog opens. **Effort:** ~45 min (need to investigate where booking/reservation data lives).

#### Issue 5 — Quick-fill applies retroactively, not prospectively
When marking NEW items as Received AFTER clicking Apply, those new items don't inherit the quick-fill date. **Effort:** ~15 min for auto-apply on status change.

#### Issue 6 — Save Draft button missing
Currently SPA Signed dialog has only Confirm. Broker may have partial state due to fund delays. Need DB column + button + load logic. **Effort:** ~45 min.

#### Issue 7 — Final price toast can race-condition
useEffect schedules state update but Confirm clicked before commit shows transient empty state. **Effort:** ~15 min — add fallback to validation directly.

#### Issue 8 — Backward compat for old prePaymentsState
v2 changed JSONB shape from `{received: bool}` to `{status: enum}`. Old records need coercion on read. **Effort:** ~10 min once edit-existing-closure flow is built.

#### Issue 9 — Offer Accepted shows AED — (pre-existing)
Falls back to opp.budget needed. **Effort:** ~15 min.

---

## 📊 QA Sprint Total Estimate

| Priority | Items | Effort |
|---|---|---|
| CRITICAL | 1 | ~30 min |
| HIGH | 2 | ~75 min (basic) |
| MEDIUM | 6 | ~145 min |
| **TOTAL** | **9** | **~4 hours** |

**Recommended scheduling:** After Stage 6 ships, before final investor demo.

---

## 🚀 NEXT — Stage 6 Build Continues

### Phase 2 — Auto-create commission invoice on SPA Signed
**Status:** Script ready in working tree (`stage6_phase2_auto_create_invoice.py`)
**Action:** Run it next.

### Phase 3 — Commission Outstanding Dashboard UI (~90 min)
The killer feature. Aggregate by developer, aging buckets, realization rate.

### Phase 4 — Mark Received flow (~30 min)
Click invoice → enter received amount + date → status updates.

### Phase 5 — Final golden tag

---

## DEMO PATH FOR INVESTOR

**The story we can demo end-to-end (with current state):**

1. **Master Agreement** — Stage 1 (live since Day 8)
   - Create agreement with developer (Emaar 4%)
   - Upload signed PDF
   - AI validates terms

2. **Lead → Opportunity** — Stage 2 (existing)
   - Lead captured, qualified
   - Opportunity created, commission auto-populates from master agreement (4%)

3. **Site visit + Offer** — Stage 3 (existing)

4. **SPA Signed = Sale Closed** — Stage 5 (live)
   - SPA reference + document upload
   - Pre-SPA payments confirmed
   - Closure record created in pp_sales_closures

5. **Commission Invoice** — Stage 6 (in progress)
   - Auto-created draft invoice
   - Broker enters invoice number + date
   - Tracks outstanding from developer
   - Dashboard shows aging buckets

6. **The wedge** — "Brokers stop logging into 5 developer portals daily"

**This is investor-grade.**

---

*— Updated 10 May 2026 evening. Claude in command of execution sequence.*
