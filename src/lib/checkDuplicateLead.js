import { supabase } from "./supabase.js";

// Duplicate-prevention v1 (exact match, company-scoped).
// Returns the first existing lead whose phone OR email exactly matches, else null.
// Uses two simple queries instead of .or() to avoid PostgREST filter-string issues
// with special characters (@ . , in emails). Deeper canonical/merge + AI-fuzzy = Phase 2.
export async function checkDuplicateLead({ phone, email, company_id, excludeId = null }) {
  if (!company_id) return null;
  const p = (phone || "").trim();
  const e = (email || "").trim();
  if (!p && !e) return null;

  const runQuery = async (column, value, useIlike) => {
    let q = supabase
      .from("leads")
      .select("id, name, phone, email")
      .eq("company_id", company_id);
    q = useIlike ? q.ilike(column, value) : q.eq(column, value);
    if (excludeId) q = q.neq("id", excludeId);
    q = q.limit(1);
    const { data, error } = await q;
    if (error) { 
      console.error("checkDuplicateLead(" + column + ") error:", error); 
      return null; 
    }
    return (data && data.length) ? data[0] : null;
  };

  // Phone: exact match. Email: case-insensitive exact (ilike, no wildcards).
  if (p) { const hit = await runQuery("phone", p, false); if (hit) return hit; }
  if (e) { const hit = await runQuery("email", e, true); if (hit) return hit; }
  return null;
}
