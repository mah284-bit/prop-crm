import { supabase } from "./supabase.js";

// Day 89: THE 1-TO-1 GETS A PAYMENT TRAIL.
//
// Until now the deal's money lived in ONE JSON FIELD PER PARTICULAR on pp_sales_closures, and every
// save replaced the whole object. FOUNDER: "if he changes 50k to 25k by mistake and saves, what
// happens?" It was overwritten silently - nothing recorded that it had ever been 50,000. Three
// cheques against a first instalment became a single number, and the individual payments did not
// exist as records at all.
//
// The BLOCK always did this properly: every payment a row in block_payments with amount, mode,
// reference, date and who recorded it. The 1-to-1 now matches.
//
// ⭐ THE RULE, and it is the Day-86 ruling applied to the other vertical: THE ROWS ARE THE TRUTH,
// THE LEDGER IS THE SUM. pre_spa_payments is no longer typed into - it is DERIVED from the rows
// after every write, so the two can never disagree. Nothing else in the app has to change: every
// panel that reads the ledger keeps reading it, and now finds a figure that is always the sum of
// real payments.

const LEDGER_KEYS = [
  "booking_fee", "reservation_fee", "initial_advance",
  "spa_fee", "dld_fee", "oqood_fee", "other_fees",
];

// Rebuild the ledger's received figures from the rows. Expected amounts, status of `waived`, and
// anything else on the row are left exactly as they were - this only ever touches what was PAID.
export async function syncLedgerFromPayments(oppId) {
  if (!oppId) return { ok: false, error: "no opportunity" };
  try {
    const { data: closure } = await supabase
      .from("pp_sales_closures").select("id, pre_spa_payments")
      .eq("opportunity_id", oppId).maybeSingle();
    if (!closure) return { ok: true, skipped: "no ledger yet" };

    const { data: rows } = await supabase
      .from("pp_payments")
      .select("particular, amount, payment_mode, received_date")
      .eq("opportunity_id", oppId)
      .neq("status", "voided")
      .order("received_date", { ascending: true });

    const byParticular = {};
    (rows || []).forEach((r) => {
      const k = r.particular;
      if (!byParticular[k]) byParticular[k] = { total: 0, first: null, last: null, modes: new Set() };
      byParticular[k].total += Number(r.amount) || 0;
      if (!byParticular[k].first) byParticular[k].first = r.received_date;
      byParticular[k].last = r.received_date;
      if (r.payment_mode) byParticular[k].modes.add(r.payment_mode);
    });

    const pre = { ...(closure.pre_spa_payments || {}) };
    LEDGER_KEYS.forEach((k) => {
      const row = pre[k];
      if (!row) return;
      // A WAIVED row is a decision, not a balance - never overwrite it from the rows.
      if (row.status === "waived") return;
      const agg = byParticular[k];
      if (!agg) {
        // No payments against this particular: it is pending, whatever was typed before.
        pre[k] = { ...row, amount: "", status: "pending", method: "", date: "" };
        return;
      }
      pre[k] = {
        ...row,
        amount: String(agg.total),
        status: agg.total > 0 ? "received" : "pending",
        // Several payments can differ in mode. Name them rather than pick one.
        method: agg.modes.size === 1 ? [...agg.modes][0] : (agg.modes.size > 1 ? "Mixed" : ""),
        // The date shown is the LAST payment against it - what a broker means by "when was it paid".
        date: agg.last || row.date || "",
      };
    });

    const { error } = await supabase
      .from("pp_sales_closures").update({ pre_spa_payments: pre }).eq("id", closure.id);
    if (error) return { ok: false, error: error.message };
    return { ok: true, particulars: Object.keys(byParticular).length };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

export async function recordPayment({ opp, particular, amount, mode, reference, receivedDate, notes, currentUser }) {
  const amt = Number(amount) || 0;
  if (!opp?.id) return { ok: false, error: "no deal" };
  if (!particular) return { ok: false, error: "no particular" };
  if (amt <= 0) return { ok: false, error: "Enter an amount" };
  // Day 88's rule, now enforced at the source: an amount and a date with no mode cannot be
  // reconciled against a bank statement.
  if (!String(mode || "").trim()) return { ok: false, error: "How was this paid? A mode is required" };
  try {
    const { error } = await supabase.from("pp_payments").insert({
      opportunity_id: opp.id,
      company_id: opp.company_id || currentUser?.company_id || null,
      particular,
      amount: amt,
      payment_mode: mode,
      reference: reference || null,
      received_date: receivedDate || new Date().toISOString().slice(0, 10),
      notes: notes || null,
      created_by: currentUser?.id || null,
    });
    if (error) return { ok: false, error: error.message };

    await supabase.from("activities").insert({
      opportunity_id: opp.id,
      lead_id: opp.lead_id || null,
      company_id: opp.company_id || currentUser?.company_id || null,
      type: "Note",
      status: "completed",
      activity_subtype: "payment_recorded",
      stage_at_event: opp.stage || null,
      user_id: currentUser?.id || null,
      user_name: currentUser?.full_name || null,
      note: "PAYMENT RECORDED - AED " + amt.toLocaleString() + " against " +
        particular.replace(/_/g, " ") + " by " + mode +
        (reference ? " (ref " + reference + ")" : "") + ".",
    });

    const sync = await syncLedgerFromPayments(opp.id);
    if (!sync.ok) return { ok: true, warning: "Recorded, but the ledger did not refresh: " + sync.error };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

// Voiding, not deleting. A payment that was recorded and should not have been is a FACT about the
// record - the row stays with a reason, and the ledger re-derives without it.
export async function voidPayment({ paymentId, oppId, reason, currentUser }) {
  if (!paymentId || !reason?.trim()) return { ok: false, error: "A reason is required" };
  try {
    const { error } = await supabase.from("pp_payments")
      .update({ status: "voided", notes: "VOIDED: " + reason.trim(), updated_at: new Date().toISOString() })
      .eq("id", paymentId);
    if (error) return { ok: false, error: error.message };
    await supabase.from("activities").insert({
      opportunity_id: oppId,
      company_id: currentUser?.company_id || null,
      type: "Note", status: "completed", activity_subtype: "payment_voided",
      user_id: currentUser?.id || null, user_name: currentUser?.full_name || null,
      note: "PAYMENT VOIDED - " + reason.trim(),
    });
    await syncLedgerFromPayments(oppId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}
