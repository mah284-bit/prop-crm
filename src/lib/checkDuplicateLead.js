import { supabase } from "./supabase.js";

// Duplicate-prevention v1 (exact match, company-scoped).
// Returns the first existing lead whose phone OR email exactly matches, else null.
// Deeper canonical-contact/merge + AI-fuzzy matching are deferred (Phase 2).
export async function checkDuplicateLead({ phone, email, company_id, excludeId = null }) {
  if (!company_id) return null;
  const p = (phone || "").trim();
  const e = (email || "").trim().toLowerCase();
  if (!p && !e) return null;

  // Build an OR filter across only the fields we actually have.
  const ors = [];
  if (p) ors.push(`phone.eq.${p}`);
  if (e) ors.push(`email.ilike.${e}`); // case-insensitive exact via ilike (no % wildcards)

  let q = supabase
    .from("leads")
    .select("id, name, phone, email")
    .eq("company_id", company_id)
    .or(ors.join(","))
    .limit(1);

  if (excludeId) q = q.neq("id", excludeId);

  const { data, error } = await q;
  if (error) { console.warn("checkDuplicateLead error:", error.message); return null; }
  return (data && data.length) ? data[0] : null;
}
