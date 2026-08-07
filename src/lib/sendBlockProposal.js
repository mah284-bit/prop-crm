import { supabase } from "./supabase.js";
import { insertProposalRecord } from "./createProposal.js";

// Day 87: THE BLOCK PROPOSAL.
//
// Until now a block reached Closed Won with NOTHING the buyer had ever agreed to in writing. Units
// were claimed, a five-day clock started and 75,000 was demanded - and no document stated what he
// was buying, at what price, on what terms. The 1-to-1 has the whole grammar (V1, V2, change chips,
// supersession); the block had none of it.
//
// ⭐ ONE SOURCE OF TRUTH: THE DISTRIBUTION STAYS MASTER. It is already versioned (D1, D2), already
// carries the terms, already births the children, and the developer approves it. So a block
// proposal is RENDERED FROM D_latest - never typed independently. Lock D1 -> send V1. Renegotiate
// -> D2 -> V2. Two version histories (D and V) drifting apart is the exact fault behind a week of
// findings: two sources for one number.
//
// From the buyer's side it behaves exactly like a 1-to-1: he receives V1, then V2, and the block
// runs on the latest version. One document, per-unit schedule.

export async function sendBlockProposal({ block, distribution, lines, units, currentUser, notes }) {
  if (!block?.id) return { ok: false, error: "no block" };
  if (!distribution) return { ok: false, error: "Lock a distribution first - the proposal is rendered from it" };
  const companyId = block.company_id || currentUser?.company_id || null;

  try {
    // Version number is per BLOCK, so a block's own history reads V1, V2, V3.
    const { data: prior } = await supabase
      .from("proposals")
      .select("id, version")
      .eq("block_deal_id", block.id)
      .order("version", { ascending: false })
      .limit(1);
    const nextVersion = ((prior && prior[0]?.version) || 0) + 1;

    // Supersede everything before it - same rule as the 1-to-1: the latest is the live offer.
    if (prior && prior.length) {
      await supabase
        .from("proposals")
        .update({ status: "superseded" })
        .eq("block_deal_id", block.id)
        .neq("status", "superseded");
    }

    const allocs = distribution.allocations || [];
    const unitRows = allocs.map((a) => {
      const line = (lines || []).find((l) => l.unit_id === a.unit_id);
      const unit = (units || []).find((u) => u.id === a.unit_id);
      return {
        unit_id: a.unit_id,
        unit_ref: line?.unit_ref || unit?.unit_ref || "",
        bedrooms: unit?.bedrooms ?? null,
        size_sqft: unit?.size_sqft ?? null,
        asking_price: Number(a.list_price) || 0,
        discount_pct: Number(a.discount_pct) || 0,
        discounted_price: Number(a.net_price) || 0,
      };
    });

    const totalList = unitRows.reduce((s, r) => s + r.asking_price, 0);
    const totalNet = unitRows.reduce((s, r) => s + r.discounted_price, 0);

    const payload = {
      company_id: companyId,
      block_deal_id: block.id,
      lead_id: block.lead_id || null,
      version: nextVersion,
      status: "sent",
      sent_at: new Date().toISOString(),
      created_by: currentUser?.id || null,
      structured_data: {
        // Stamped from the distribution this version was rendered from, so the two can always be
        // reconciled - and so a later D version cannot silently change what the buyer was sent.
        block_distribution_id: distribution.id,
        block_distribution_version: distribution.version ?? null,
        proposal_units: unitRows,
        unit_count: unitRows.length,
        total_list_price: totalList,
        total_value: totalNet,
        block_discount_amount: totalList - totalNet,
        block_discount_pct: totalList ? Number((((totalList - totalNet) / totalList) * 100).toFixed(2)) : 0,
        payment_plan: distribution.payment_plan_preset || null,
        dld_handling: distribution.dld_payer || null,
        dld_split_pct: distribution.dld_split_pct ?? null,
        reservation_expected: Number(block.reservation_expected) || null,
        notes: notes || null,
      },
    };

    const res = await insertProposalRecord(payload);
    if (res.error) return { ok: false, error: res.error.message };

    await supabase.from("activities").insert({
      company_id: companyId,
      block_deal_id: block.id,
      type: "note",
      activity_subtype: "block_terms",
      note:
        "BLOCK PROPOSAL V" + nextVersion + " sent - " + unitRows.length + " unit(s), " +
        "total AED " + Math.round(totalNet).toLocaleString() +
        " after a " + payload.structured_data.block_discount_pct + "% block discount. " +
        "Rendered from distribution D" + (distribution.version ?? "?") + ".",
      user_id: currentUser?.id || null,
      user_name: currentUser?.full_name || currentUser?.email || "system",
    });

    return { ok: true, proposal: res.data, version: nextVersion };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}
