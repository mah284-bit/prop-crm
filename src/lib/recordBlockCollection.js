import { supabase } from "./supabase.js";

// Day 80: record a post-reservation CHUNK for a block.
// One bank line, then one allocation row per (particular, unit) from the allocator's plan.
// The allocation row carries its own `particular` because a single payment now spans several -
// the parent's `milestone` can no longer describe it, so it is simply "Collection".
export async function recordBlockCollection({ block, entry, currentUser }) {
  const companyId = block.company_id || currentUser?.company_id || null;
  const { data: pay, error: payErr } = await supabase.from("block_payments").insert({
    block_deal_id: block.id,
    company_id: companyId,
    milestone: "Collection",
    amount: Number(entry.amount) || 0,
    payment_type: entry.mode || null,
    reference: entry.reference || null,
    received_date: entry.receivedOn || null,
    notes: entry.notes || null,
    status: "allocated",
    created_by: currentUser?.id || null,
  }).select().single();
  if (payErr || !pay) return { ok: false, error: payErr?.message || "Could not record the payment" };

  const rows = (entry.plan?.units || []).map((u) => ({
    block_payment_id: pay.id,
    company_id: companyId,
    opportunity_id: u.child_id,
    particular: u.particular,
    amount: u.amount,
    created_by: currentUser?.id || null,
  }));
  if (rows.length) {
    const { error: allocErr } = await supabase.from("block_payment_allocations").insert(rows);
    if (allocErr) return { ok: false, error: "Payment recorded but allocation failed: " + allocErr.message };
  }
  return { ok: true, payment: pay, allocated: rows.length };
}
