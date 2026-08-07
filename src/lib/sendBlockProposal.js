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

// Day 87: APPROVAL BELONGS ON THE VERSION. Each version records who at the developer approved
// THAT discount - a block-level field goes stale the moment D2 raises it. And the threshold comes
// from the master agreement's DISCOUNT AUTHORITY, which was captured on the agreement form and
// read nowhere until now: within it, approval is optional but recordable; above it, mandatory.
// FOUNDER: "the broker cannot take a decision on behalf of the developer - if the developer
// refuses, the deal is dusted."
export async function sendBlockProposal({ block, distribution, lines, units, currentUser, notes, approvedBy, approvalRef }) {
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
    // Day 87: FETCH THE UNIT DETAIL. The caller passes availUnits, which EXCLUDES units already in
    // the block - so the lookup found nothing and the buyer received a document listing
    // "EBT-07-03 - AED 1,414,581" with no idea whether it is a studio or a four-bedroom. On a 3.8M
    // offer that is not a detail. Read them rather than depend on what happens to be in scope.
    const unitIds = allocs.map(a2 => a2.unit_id).filter(Boolean);
    let detail = {};
    if (unitIds.length) {
      const { data: pu } = await supabase.from("project_units")
        .select("id, unit_ref, bedrooms, size_sqft, view, sub_type").in("id", unitIds);
      (pu || []).forEach(u => { detail[u.id] = u; });
    }
    const unitRows = allocs.map((a) => {
      const line = (lines || []).find((l) => l.unit_id === a.unit_id);
      const unit = detail[a.unit_id] || (units || []).find((u) => u.id === a.unit_id);
      return {
        unit_id: a.unit_id,
        unit_ref: line?.unit_ref || unit?.unit_ref || "",
        bedrooms: unit?.bedrooms ?? null,
        size_sqft: unit?.size_sqft ?? null,
        view: unit?.view ?? null,
        sub_type: unit?.sub_type ?? null,
        asking_price: Number(a.list_price) || 0,
        discount_pct: Number(a.discount_pct) || 0,
        discounted_price: Number(a.net_price) || 0,
      };
    });

    const totalList0 = unitRows.reduce((s, r) => s + r.asking_price, 0);
    const totalNet0 = unitRows.reduce((s, r) => s + r.discounted_price, 0);
    const discPct = totalList0 ? ((totalList0 - totalNet0) / totalList0) * 100 : 0;
    // The authority for THIS developer. Null means no agreement on file - then nothing is enforced,
    // because a threshold nobody set cannot be exceeded.
    let authority = null;
    try {
      const { data: ma } = await supabase.from("pp_master_agreements")
        .select("discount_authority_pct")
        .eq("company_id", companyId).eq("developer_id", block.pp_developer_id || block.developer_id)
        .eq("status", "active").order("created_at", { ascending: false }).limit(1);
      if (ma && ma.length) authority = ma[0].discount_authority_pct;
    } catch (e) { /* no agreement readable - do not block the send */ }
    // Day 87: THE AUTHORITY GATE IS GONE. Founder: "one approval from the developer is good
    // enough - they play within it." The negotiation happens at the developer's office, so a broker
    // is not inventing discounts version by version; he gets an approval and works inside it.
    // Recording it on every version was bureaucracy, and with nothing passing approvedBy the gate
    // would have blocked the send outright. The block header's single Record developer approval
    // remains the gate. The authority is still STAMPED below, for the record.
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
        approved_by: approvedBy || null,
        approval_ref: approvalRef || null,
        discount_authority_pct: authority,
      },
    };

    const res = await insertProposalRecord(payload);
    if (res.error) return { ok: false, error: res.error.message };
    // Day 87: THE BLOCK HOLDS ITS CURRENT OFFER. Founder: "we remember it this way." Two problems
    // it solves at once. First, the calculator's top-down field reset to 0 on every open, so a
    // broker had to re-enter a rate he had already given - and might mistype it. Second, "the
    // latest proposal" was INFERRED from status != superseded; if a send half-failed there would be
    // two live offers or none, and nothing authoritative to ask. One field, one writer, one moment.
    await supabase.from("block_deals").update({
      current_proposal_id: res.data?.id || null,
      current_discount_pct: payload.structured_data.block_discount_pct,
    }).eq("id", block.id);

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
