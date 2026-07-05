// getMyTeamIds — person-level companion to getVisibleCompanyIds.
// "Which user_ids are in THIS manager's team (downline)?"
// Fail-safe = [self]. Role-agnostic, NO hardcode: walks profiles.manager_id
// downward (self -> reports -> their reports -> any depth). No reports = [self].
// COMPOSES WITH getVisibleCompanyIds (Day-29 decides companies; this decides people).
import { supabase } from "../lib/supabase";

export async function getMyTeamIds(currentUser) {
  const self = currentUser?.id || null;
  if (!self) return [];
  try {
    const cid = currentUser?.company_id || null;
    let q = supabase.from("profiles").select("id, manager_id");
    if (cid) q = q.eq("company_id", cid);
    const { data, error } = await q;
    if (error || !data || data.length === 0) return [self];
    const childrenOf = new Map();
    for (const row of data) {
      if (!row.manager_id) continue;
      if (!childrenOf.has(row.manager_id)) childrenOf.set(row.manager_id, []);
      childrenOf.get(row.manager_id).push(row.id);
    }
    const team = new Set([self]);
    const queue = [self];
    while (queue.length) {
      const cur = queue.shift();
      const kids = childrenOf.get(cur) || [];
      for (const k of kids) {
        if (!team.has(k)) { team.add(k); queue.push(k); }
      }
    }
    return Array.from(team);
  } catch {
    return [self];
  }
}
