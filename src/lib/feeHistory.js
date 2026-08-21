import { supabase } from "./supabase.js";

// Day 96: A FEE THAT CHANGES LEAVES NO TRACE, AND THESE CHANGE OFTEN.
//
// The founder's own words when the tier was designed: a developer's admin charge "may change
// regularly" - which is exactly why it is frozen onto each deal at reservation. But the freeze
// protects the DEAL, not the POLICY. Edit an agreement from 2,500 to 4,000 and the old figure is
// simply gone: a deal frozen at 2,500 sits beside one frozen at 4,000 and nobody can say why.
//
// This records the change itself. One row per field that ACTUALLY moved - a save that alters
// nothing writes nothing, so the history stays worth reading.
//
// SOURCE MATTERS: changing what a developer charges everyone is a different act from changing what
// we negotiated with him, even when it is the same number on the same developer.

const FIELDS = [
  ["default_reservation_fee", "Reservation per unit"],
  ["default_spa_fee", "SPA fee"],
  ["default_oqood_fee", "Oqood fee"],
  ["default_dld_pct", "DLD %"],
  ["admin_fee_per_unit", "Admin fee per unit"],
];

export const FEE_FIELD_LABELS = Object.fromEntries(FIELDS);

const norm = (v) => (v === "" || v === null || v === undefined ? null : Number(v));

// Same value? Null and zero are NOT the same - null means "not set here, fall through", zero means
// "he charges nothing". Treating them alike would hide a real change.
const same = (a, b) => {
  const x = norm(a), y = norm(b);
  if (x === null && y === null) return true;
  if (x === null || y === null) return false;
  return Math.abs(x - y) < 0.005;
};

export async function recordFeeChanges({ companyId, developerId, source, before, after, reason, currentUser }) {
  if (!companyId || !developerId) return { ok: false, error: "missing company or developer" };
  const rows = [];
  FIELDS.forEach(([key]) => {
    if (same(before?.[key], after?.[key])) return;
    rows.push({
      company_id: companyId,
      developer_id: developerId,
      source,
      field: key,
      old_value: norm(before?.[key]),
      new_value: norm(after?.[key]),
      reason: reason || null,
      changed_by: currentUser?.id || null,
    });
  });
  if (!rows.length) return { ok: true, changed: 0 };
  const { error } = await supabase.from("pp_fee_history").insert(rows);
  if (error) return { ok: false, error: error.message };
  return { ok: true, changed: rows.length };
}

export async function getFeeHistory(companyId, developerId, limit = 20) {
  if (!companyId || !developerId) return [];
  const { data } = await supabase
    .from("pp_fee_history")
    .select("id, source, field, old_value, new_value, reason, changed_by, changed_at")
    .eq("company_id", companyId)
    .eq("developer_id", developerId)
    .order("changed_at", { ascending: false })
    .limit(limit);
  return data || [];
}

// "Admin fee per unit  2,500 -> 4,000" · a set-from-nothing reads as "not set -> 4,000", which is
// the honest description of what happened.
export function describeChange(row) {
  const label = FEE_FIELD_LABELS[row.field] || row.field;
  const fmt = (v) => (v === null || v === undefined ? "not set" : Number(v).toLocaleString());
  return label + "  " + fmt(row.old_value) + " \u2192 " + fmt(row.new_value);
}
