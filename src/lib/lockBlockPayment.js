import { supabase } from "./supabase.js";

// Cut 7-3: lock a block payment and distribute it to member deals.
// All-or-nothing in spirit: the bank line is written first, then each member is
// served. Any member failure is reported back with what did land, so the broker
// sees truth rather than a silent partial.
export async function lockBlockPayment({ block, bank, allocations, members, currentUser }) {
  const companyId = block.company_id || currentUser?.company_id || null;

  const { data: pay, error: payErr } = await supabase
    .from("block_payments")
    .insert({
      block_deal_id: block.id,
      company_id: companyId,
      milestone: bank.milestone,
      amount: Number(bank.amount) || 0,
      payment_type: bank.payment_type || null,
      reference: bank.reference || null,
      received_date: bank.received_date || null,
      expected_total: bank.expected_total != null ? Number(bank.expected_total) : null,
      variance_reason: bank.variance_reason || null,
      status: "allocated",
      created_by: currentUser?.id || null,
    })
    .select()
    .single();
  if (payErr || !pay) return { ok: false, error: payErr?.message || "Could not record the payment" };

  // THE GATE: Reserved is EARNED when the reservation is fully collected.
  // Tranches are allowed - money is recorded honestly either way - but the units
  // stay on hold until the balance reaches zero. The payment that closes the
  // balance is the one that earns the reservation.
  const due = Number(block.reservation_expected || 0);
  const collectedBefore = members.reduce((t, m) => t + Number(m.child?.reservation_amount || 0), 0);
  const nowPaid = allocations.reduce((t, a) => t + (Number(a.amount) || 0), 0);
  const completesReservation = bank.milestone === "Reservation" && due > 0 && (collectedBefore + nowPaid) >= due - 0.5;

  const failed = [];
  let served = 0;

  for (const a of allocations) {
    const m = members.find(x => x.child.id === a.opportunity_id);
    const child = m ? m.child : null;
    const unitRef = m ? m.line.unit_ref : "";
    try {
      const { error: aErr } = await supabase.from("block_payment_allocations").insert({
        block_payment_id: pay.id,
        opportunity_id: a.opportunity_id,
        company_id: companyId,
        amount: Number(a.amount) || 0,
        created_by: currentUser?.id || null,
      });
      if (aErr) throw aErr;

      if (bank.milestone === "Reservation") {
        const prior = Number(child?.reservation_amount || 0);
        const upd = {
          reservation_amount: prior + (Number(a.amount) || 0),
          reservation_date: bank.received_date || new Date().toISOString().slice(0, 10),
          reservation_method: bank.payment_type || null,
          reservation_cheque_no: bank.reference || null,
        };
        if (completesReservation && child && child.stage === "Offer Accepted") { upd.stage = "Reserved"; upd.status = "Active"; }
        const { error: oErr } = await supabase.from("opportunities").update(upd).eq("id", a.opportunity_id);
        if (oErr) throw oErr;
        if (completesReservation && child && child.stage === "Offer Accepted" && child.unit_id) {
          await supabase.from("project_units").update({ status: "Reserved" }).eq("id", child.unit_id);
        }
      }

      await supabase.from("activities").insert({
        opportunity_id: a.opportunity_id,
        lead_id: child?.lead_id || null,
        company_id: companyId,
        type: "Note",
        status: "completed",
        user_id: currentUser?.id || null,
        user_name: currentUser?.full_name || null,
        activity_subtype: "block_payment_allocation",
        note: bank.milestone + " AED " + Math.round(Number(a.amount) || 0).toLocaleString() +
              " allocated from block payment" + (bank.reference ? " (ref " + bank.reference + ")" : "") +
              " on " + (block.title || "block") + (unitRef ? " - unit " + unitRef : ""),
      });
      served += 1;
    } catch (e) {
      failed.push((unitRef || a.opportunity_id) + ": " + (e.message || "failed"));
    }
  }

  if (completesReservation) {
    await supabase.from("block_deals").update({ collection_status: "satisfied" }).eq("id", block.id);
  }
  return { ok: failed.length === 0, paymentId: pay.id, served, failed, completed: completesReservation };
}

// Cut 7-4: amend a recorded block payment in place. No second row.
// Doctrine: money paid is money paid - a downward amendment corrects the RECORD,
// it does not reverse the EVENT. Stages are never pulled back here; a genuine
// buyer withdrawal is the cancellation path, not an amend.
export async function amendBlockPayment({ block, payment, bank, allocations, members, priorAllocs, currentUser, reason }) {
  if (!reason || !reason.trim()) return { ok: false, error: "A reason is required to amend" };
  const companyId = block.company_id || currentUser?.company_id || null;

  const { error: pErr } = await supabase
    .from("block_payments")
    .update({
      milestone: bank.milestone,
      amount: Number(bank.amount) || 0,
      expected_total: bank.expected_total != null ? Number(bank.expected_total) : null,
      variance_reason: bank.variance_reason || null,
      payment_type: bank.payment_type || null,
      reference: bank.reference || null,
      received_date: bank.received_date || null,
      status: "amended",
      notes: reason.trim(),
    })
    .eq("id", payment.id);
  if (pErr) return { ok: false, error: pErr.message };

  const priorOf = (oppId) => {
    const row = (priorAllocs || []).find(x => x.opportunity_id === oppId);
    return row ? Number(row.amount) || 0 : 0;
  };

  const failed = [];
  let changed = 0;

  const touched = new Set([
    ...(priorAllocs || []).map(x => x.opportunity_id),
    ...allocations.map(x => x.opportunity_id),
  ]);

  await supabase.from("block_payment_allocations").delete().eq("block_payment_id", payment.id);

  for (const oppId of touched) {
    const m = members.find(x => x.child.id === oppId);
    const child = m ? m.child : null;
    const unitRef = m ? m.line.unit_ref : "";
    const now = Number((allocations.find(a => a.opportunity_id === oppId) || {}).amount) || 0;
    const was = priorOf(oppId);
    const delta = now - was;
    try {
      if (now > 0) {
        const { error: aErr } = await supabase.from("block_payment_allocations").insert({
          block_payment_id: payment.id,
          opportunity_id: oppId,
          company_id: companyId,
          amount: now,
          created_by: currentUser?.id || null,
        });
        if (aErr) throw aErr;
      }
      if (delta !== 0 && bank.milestone === "Reservation") {
        const base = Number(child?.reservation_amount || 0);
        const { error: oErr } = await supabase
          .from("opportunities")
          .update({ reservation_amount: Math.max(base + delta, 0) })
          .eq("id", oppId);
        if (oErr) throw oErr;
      }
      if (delta !== 0) {
        await supabase.from("activities").insert({
          opportunity_id: oppId,
          lead_id: child?.lead_id || null,
          company_id: companyId,
          type: "Note",
          status: "completed",
          user_id: currentUser?.id || null,
          user_name: currentUser?.full_name || null,
          activity_subtype: "block_payment_amendment",
          note: "Block payment amended" + (unitRef ? " - unit " + unitRef : "") + ": " +
                bank.milestone + " AED " + Math.round(was).toLocaleString() + " changed to AED " +
                Math.round(now).toLocaleString() + ". Reason: " + reason.trim(),
        });
        changed += 1;
      }
    } catch (e) {
      failed.push((unitRef || oppId) + ": " + (e.message || "failed"));
    }
  }

  return { ok: failed.length === 0, changed, failed };
}

// Cut 7-6c: accept a shortfall and close the collection.
// Doctrine: accepting does NOT record money that never arrived. The block's story stays
// honest - collected X of Y, shortfall Z accepted by <who> for <reason>. The units are
// released to Reserved because a human with authority declared the reservation satisfied.
export async function acceptShortCollection({ block, members, currentUser, reason, due, collected }) {
  if (!reason || !reason.trim()) return { ok: false, error: "A reason is required" };
  const companyId = block.company_id || currentUser?.company_id || null;
  const shortfall = Number(due || 0) - Number(collected || 0);

  const { error: bErr } = await supabase.from("block_deals").update({
    collection_status: "accepted_short",
    collection_note: reason.trim(),
    collection_closed_by: currentUser?.id || null,
    collection_closed_at: new Date().toISOString(),
  }).eq("id", block.id);
  if (bErr) return { ok: false, error: bErr.message };

  const failed = [];
  let moved = 0;
  for (const m of members) {
    const child = m.child;
    const unitRef = m.line?.unit_ref || "";
    try {
      if (child && child.stage === "Offer Accepted") {
        const { error: oErr } = await supabase.from("opportunities")
          .update({ stage: "Reserved", status: "Active" }).eq("id", child.id);
        if (oErr) throw oErr;
        if (child.unit_id) {
          await supabase.from("project_units").update({ status: "Reserved" }).eq("id", child.unit_id);
        }
        moved += 1;
      }
      await supabase.from("activities").insert({
        opportunity_id: child.id,
        lead_id: child.lead_id || null,
        company_id: companyId,
        type: "Note",
        status: "completed",
        user_id: currentUser?.id || null,
        user_name: currentUser?.full_name || null,
        activity_subtype: "collection_accepted_short",
        note: "Reservation collection closed with a shortfall of AED " +
              Math.round(shortfall).toLocaleString() + " (collected AED " +
              Math.round(Number(collected||0)).toLocaleString() + " of AED " +
              Math.round(Number(due||0)).toLocaleString() + ") on " + (block.title || "block") +
              (unitRef ? " - unit " + unitRef : "") + ". Accepted by " +
              (currentUser?.full_name || "user") + ". Reason: " + reason.trim(),
      });
    } catch (e) {
      failed.push((unitRef || child?.id) + ": " + (e.message || "failed"));
    }
  }
  return { ok: failed.length === 0, moved, shortfall, failed };
}
