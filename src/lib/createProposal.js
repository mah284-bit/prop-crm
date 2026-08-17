// createProposal.js — shared proposal-insert helper (single source of truth for the WRITE).
// Both ProposalBuilderDialog (full send flow) and the promote-to-Opp V1 carry-over call this,
// so the actual insert + schema-drift field-routing lives in ONE place.
//
// It does NOT generate PDFs, branding, activities, or reminders — those stay in the builder.
// This is ONLY the defensive insert: route known-JSONB fields into structured_data, then insert.
import { supabase } from "./supabase";
import { dealBill } from "./dealBill.js";

// Fields that may not exist as real columns (schema drift) — routed into structured_data.
const KNOWN_JSONB_FIELDS = ["discounted_price", "lead_id", "payment_plan"];

export async function insertProposalRecord(fullPayload) {
  const payload = { ...fullPayload };
  const sd = { ...(fullPayload.structured_data || {}) };
  KNOWN_JSONB_FIELDS.forEach((f) => {
    if (payload[f] !== undefined) {
      sd[f] = payload[f];
      delete payload[f];
    }
  });
  payload.structured_data = sd;
  const res = await supabase.from("proposals").insert(payload).select().single();
  if (!res.error && payload.opportunity_id) {
    await syncLedgerToProposal(payload.opportunity_id, sd);
  }
  return res;
}

// Day 79: THE LEDGER FOLLOWS THE PROPOSAL (founder ruling).
// Negotiation rounds are internal and change nothing. A PROPOSAL is the instrument - it is what
// the buyer is actually sent. So on a deal at Reserved or later, a new proposal recomputes the
// stored ledger's PRICE-DERIVED rows. Lives HERE, beside the write, so every entry point
// (opp page, Lead Detail, any future surface) behaves identically.
// NEVER touched: the reservation (a fixed fee), SPA/Oqood/DLD-pct (frozen company policy at
// reservation), and any row already RECEIVED or WAIVED.
async function syncLedgerToProposal(oppId, sd) {
  try {
    const { data: opp } = await supabase.from("opportunities")
      .select("stage, current_agreed_price, current_payment_plan_preset, current_dld_payer, current_dld_split_pct")
      .eq("id", oppId).maybeSingle();
    if (!opp || !["Reserved","SPA Requirements","SPA Signed"].includes(opp.stage)) return;
    const { data: cl } = await supabase.from("pp_sales_closures")
      .select("id, pre_spa_payments, frozen_fee_policy").eq("opportunity_id", oppId).maybeSingle();
    if (!cl?.pre_spa_payments) return;
    const price = Number(sd.discounted_price || sd.asking_price || opp.current_agreed_price || 0);
    if (!price) return;
    const plan = sd.payment_plan_preset || opp.current_payment_plan_preset;
    const payer = sd.dld_handling === "split_5050" ? "split"
                : sd.dld_handling === "developer_pays" ? "developer"
                : sd.dld_handling ? "buyer" : (opp.current_dld_payer || "buyer");
    const bill = dealBill({
      price, planPreset: plan, dldPayer: payer,
      dldSplitPct: opp.current_dld_split_pct || 50,
      dldPct: cl.frozen_fee_policy?.dldPct,
      // Day 93: from the FROZEN policy, like the DLD percentage above it. A proposal revised after
      // reservation must quote the fees the deal was priced on - if it quoted the developer's
      // current figure instead, the proposal and the ledger would disagree, which is the Day-83
      // fault in a new place.
      adminFeePerUnit: cl.frozen_fee_policy?.adminFeePerUnit || 0,
    });
    const next = { ...cl.pre_spa_payments };
    const bump = (k, expected, pct) => {
      const r = next[k];
      if (!r || r.status === "received" || r.status === "waived") return;
      next[k] = { ...r, expected_amount: expected, ...(pct ? { expected_percent: pct } : {}) };
    };
    bump("initial_advance", bill.initial_advance.expected, bill.initial_advance.pct);
    if (!bill.dld_fee.waived) bump("dld_fee", bill.dld_fee.expected);
    await supabase.from("pp_sales_closures")
      .update({ pre_spa_payments: next, final_sale_price: price }).eq("id", cl.id);
  } catch (e) { console.error("ledger sync to proposal:", e); }
}

// Compute the next version number for an opportunity's proposals.
// Returns 1 for the first proposal, else max(version)+1.
export async function nextProposalVersion(opportunityId) {
  const { data } = await supabase
    .from("proposals")
    .select("version")
    .eq("opportunity_id", opportunityId)
    .order("version", { ascending: false })
    .limit(1);
  return data && data.length > 0 ? (data[0].version || 0) + 1 : 1;
}
