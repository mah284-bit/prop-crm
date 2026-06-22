// =====================================================================
// getGroupConsolidatedData — the ONE resolver for the Group view.
// Resolves the current user's group, all its branches (companies), and
// aggregates pipeline / won / agent stats per branch + a group rollup.
//
// Reuses the proven group-resolution pattern from GroupBranchesSection:
//   company -> group_id -> group + sibling branches (eq group_id).
//
// Returns:
//   { group, branches[], rollup }            on success
//   { error: "<reason>" }                    when no group (standalone/individual)
//
//   branch = { id, name, business_type, pipeline, activeCount, won, wonValue, conv, agents }
//   rollup = { totalPipeline, totalActive, totalWon, totalWonValue,
//              branchCount, agentCount, avgConv }
//
// Group-scope is enforced by querying ONLY companies sharing this user's
// group_id — never global. Standalone users (group_id null) get a clean
// "not linked to a group" error, NOT a wall.
// =====================================================================
import { supabase } from "../lib/supabase";

const ACTIVE_EXCLUDE = ["Closed Won", "Closed Lost", "Won", "Lost"];

export async function getGroupConsolidatedData(currentUser) {
  // 1. resolve current company (branch)
  const cid =
    (typeof localStorage !== "undefined" && localStorage.getItem("propccrm_company_id")) ||
    currentUser?.company_id;
  if (!cid) return { error: "No active company found." };

  // 2. this branch's group_id
  const { data: myco, error: e1 } = await supabase
    .from("companies")
    .select("id, name, group_id")
    .eq("id", cid)
    .single();
  if (e1) return { error: e1.message };
  if (!myco?.group_id) return { error: "This account is not linked to a group." };

  // 3. the group + all branches under it (group-scoped, never global)
  const { data: group, error: e2 } = await supabase
    .from("groups")
    .select("id, name, branch_visibility")
    .eq("id", myco.group_id)
    .single();
  if (e2) return { error: e2.message };

  const { data: branchRows, error: e3 } = await supabase
    .from("companies")
    .select("id, name, business_type")
    .eq("group_id", myco.group_id)
    .order("name");
  if (e3) return { error: e3.message };

  const branchIds = (branchRows || []).map((b) => b.id);
  if (branchIds.length === 0) {
    return {
      group,
      branches: [],
      rollup: { totalPipeline: 0, totalActive: 0, totalWon: 0, totalWonValue: 0, branchCount: 0, agentCount: 0, avgConv: 0 },
    };
  }

  // 4. all opps + all agents across the group's branches, in two batched queries
  const [{ data: opps }, { data: agents }] = await Promise.all([
    supabase.from("opportunities").select("company_id, budget, final_price, stage, status").in("company_id", branchIds),
    supabase.from("profiles").select("id, company_id").in("company_id", branchIds),
  ]);

  const oppsByCo = {};
  (opps || []).forEach((o) => {
    (oppsByCo[o.company_id] = oppsByCo[o.company_id] || []).push(o);
  });
  const agentsByCo = {};
  (agents || []).forEach((a) => {
    agentsByCo[a.company_id] = (agentsByCo[a.company_id] || 0) + 1;
  });

  // 5. per-branch aggregation
  const branches = (branchRows || []).map((b) => {
    const list = oppsByCo[b.id] || [];
    const active = list.filter((o) => !ACTIVE_EXCLUDE.includes(o.stage) && o.status === "Active");
    const won = list.filter((o) => o.stage === "Closed Won" || o.status === "Won");
    const pipeline = active.reduce((s, o) => s + (o.budget || 0), 0);
    const wonValue = won.reduce((s, o) => s + (o.final_price || o.budget || 0), 0);
    const conv = list.length > 0 ? Math.round((won.length / list.length) * 100) : 0;
    return {
      id: b.id,
      name: b.name,
      business_type: b.business_type,
      pipeline,
      activeCount: active.length,
      won: won.length,
      wonValue,
      conv,
      agents: agentsByCo[b.id] || 0,
    };
  });

  // 6. group rollup
  const rollup = branches.reduce(
    (acc, b) => {
      acc.totalPipeline += b.pipeline;
      acc.totalActive += b.activeCount;
      acc.totalWon += b.won;
      acc.totalWonValue += b.wonValue;
      acc.agentCount += b.agents;
      return acc;
    },
    { totalPipeline: 0, totalActive: 0, totalWon: 0, totalWonValue: 0, branchCount: branches.length, agentCount: 0, avgConv: 0 }
  );
  const convs = branches.filter((b) => b.activeCount + b.won > 0).map((b) => b.conv);
  rollup.avgConv = convs.length > 0 ? Math.round(convs.reduce((a, c) => a + c, 0) / convs.length) : 0;

  return { group, branches, rollup };
}
