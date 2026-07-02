// =====================================================================
// getVisibleCompanyIds — the ONE scope primitive for group RLS.
// Answers: "which company_ids may THIS user see right now?"
//
// Returns an array of company_id strings, ALWAYS. Fail-safe = [own]:
// any error, ambiguity, or missing config shrinks visibility to the
// user's own company — never leaks across branches.
//
// Policy (driven by groups.branch_visibility + the see_all capability,
// NOT hardcoded roles — future group_manager role just needs see_all):
//   no group_id                  -> [own]            (standalone/individual)
//   branch_visibility=isolated   -> [own]            (branches never cross)
//   branch_visibility=group_admin_only -> see_all ? [all branches] : [own]
//   branch_visibility=shared           -> see_all ? [all branches] : [own]
//        (per-user multi-branch grants under 'shared' = future enhancement)
//
// Usage (replaces .eq("company_id", cid) with .in("company_id", ids)):
//   const ids = await getVisibleCompanyIds(currentUser);
//   supabase.from("leads").select("*").in("company_id", ids)
// =====================================================================
import { supabase } from "../lib/supabase";
import { canDo } from "../lib/permissions";

export async function getVisibleCompanyIds(currentUser) {
  // own company = the floor, always present in the result
  const own =
    (typeof localStorage !== "undefined" && localStorage.getItem("propccrm_company_id")) ||
    currentUser?.company_id ||
    null;

  // no company at all -> empty (caller should treat as "see nothing")
  if (!own) return [];

  try {
    // this company's group_id
    const { data: myco, error: e1 } = await supabase
      .from("companies")
      .select("id, group_id")
      .eq("id", own)
      .single();
    if (e1 || !myco) return [own];

    // standalone / individual -> own only
    if (!myco.group_id) return [own];

    // the group's visibility policy
    const { data: group, error: e2 } = await supabase
      .from("groups")
      .select("id, branch_visibility")
      .eq("id", myco.group_id)
      .single();
    if (e2 || !group) return [own];

    const vis = group.branch_visibility;

    // isolated: branches never see each other, regardless of role
    if (vis === "isolated") return [own];

    // group_admin_only + shared: cross-branch ONLY if user has see_all capability
    const seesAll = canDo(currentUser, "see_all");  // capability-driven (null user -> false via canDo guard)
    if (!seesAll) return [own];

    // gather all branches under this group
    const { data: branches, error: e3 } = await supabase
      .from("companies")
      .select("id")
      .eq("group_id", myco.group_id);
    if (e3 || !branches || branches.length === 0) return [own];

    const ids = branches.map((b) => b.id);
    // ensure own is always included (defensive)
    return ids.includes(own) ? ids : [own, ...ids];
  } catch {
    // any unexpected failure shrinks to own — never leak
    return [own];
  }
}
