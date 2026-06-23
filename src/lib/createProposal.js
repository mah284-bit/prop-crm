// createProposal.js — shared proposal-insert helper (single source of truth for the WRITE).
// Both ProposalBuilderDialog (full send flow) and the promote-to-Opp V1 carry-over call this,
// so the actual insert + schema-drift field-routing lives in ONE place.
//
// It does NOT generate PDFs, branding, activities, or reminders — those stay in the builder.
// This is ONLY the defensive insert: route known-JSONB fields into structured_data, then insert.
import { supabase } from "./supabase";

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
  return await supabase.from("proposals").insert(payload).select().single();
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
