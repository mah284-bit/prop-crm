import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase.js";

const NAVY = "#0F2540";
const LINE = "#CBD5E1";
const BG = "#F8FAFC";

const initials = (name) =>
  (name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || "").join("") || "?";

const ROLE_LABEL = {
  super_admin: "Super Admin", admin: "Admin", group_gm: "Group GM",
  sales_manager: "Sales Manager", leasing_manager: "Leasing Manager",
  sales_agent: "Sales Agent", leasing_agent: "Leasing Agent", viewer: "Viewer",
};
const ROLE_COLOR = {
  super_admin: "#7C3AED", admin: "#0EA5E9", group_gm: "#0891B2",
  sales_manager: "#059669", leasing_manager: "#0D9488",
  sales_agent: "#475569", leasing_agent: "#64748B", viewer: "#D97706",
};

export default function OrgChartPage({ currentUser, showToast }) {
  const [loading, setLoading] = useState(true);
  const [people, setPeople] = useState([]);
  const [err, setErr] = useState("");
  const [savingId, setSavingId] = useState(null);
  const [editId, setEditId] = useState(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const cid = currentUser?.company_id || null;
      let q = supabase.from("profiles").select("id, full_name, role, manager_id, is_active").order("full_name");
      if (cid) q = q.eq("company_id", cid);
      const { data, error } = await q;
      if (error) throw error;
      setPeople(data || []);
    } catch (e) {
      setErr(e.message || "Failed to load org chart");
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => { load(); }, [load]);

  const childrenOf = {};
  for (const p of people) { if (p.manager_id) (childrenOf[p.manager_id] ||= []).push(p); }
  const hasReports = (id) => (childrenOf[id] || []).length > 0;
  const rootsWithTeam = people.filter((p) => !p.manager_id && hasReports(p.id));
  const unassigned = people.filter((p) => !p.manager_id && !hasReports(p.id));

  const downlineCount = (id) => {
    let n = 0; const stack = [...(childrenOf[id] || [])];
    while (stack.length) { const c = stack.pop(); n++; (childrenOf[c.id] || []).forEach((k) => stack.push(k)); }
    return n;
  };

  const q = query.trim().toLowerCase();
  const matches = (p) => !q || (p.full_name || "").toLowerCase().includes(q) || (ROLE_LABEL[p.role] || p.role || "").toLowerCase().includes(q);

  async function reassign(personId, newManagerId) {
    if (newManagerId === personId) { showToast?.("A person cannot report to themselves."); return; }
    setSavingId(personId);
    try {
      const { error } = await supabase.from("profiles").update({ manager_id: newManagerId || null }).eq("id", personId);
      if (error) throw error;
      showToast?.("Reporting line updated.");
      setEditId(null);
      await load();
    } catch (e) {
      showToast?.(e.message || "Failed to update reporting line.");
    } finally {
      setSavingId(null);
    }
  }

  const ring = (role, size) => ({
    width: size, height: size, borderRadius: "50%", flexShrink: 0,
    background: "#fff", border: "2px solid " + (ROLE_COLOR[role] || "#64748B"),
    color: ROLE_COLOR[role] || "#64748B",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontWeight: 700, fontSize: size > 42 ? 15 : 12,
    boxShadow: "0 1px 3px rgba(15,37,64,0.12)",
  });

  const Editor = ({ person }) => (
    <select autoFocus value={person.manager_id || ""} disabled={savingId === person.id}
      onChange={(e) => reassign(person.id, e.target.value)} onBlur={() => setEditId(null)}
      style={{ fontSize: 11, padding: "3px 6px", borderRadius: 7, border: "1px solid " + NAVY, color: NAVY, background: "#fff", maxWidth: 190, marginTop: 6 }}>
      <option value="">— none (top) —</option>
      {people.filter((m) => m.id !== person.id).map((m) => (
        <option key={m.id} value={m.id}>{m.full_name} · {ROLE_LABEL[m.role] || m.role}</option>
      ))}
    </select>
  );

  // a single node "card" (centered, for the horizontal tree)
  const Card = ({ person, size = "md", dim }) => {
    const rc = ROLE_COLOR[person.role] || "#64748B";
    const apex = size === "lg";
    return (
      <div style={{
        display: "inline-flex", flexDirection: "column", alignItems: "center",
        background: "#fff", border: "1px solid " + (apex ? rc : "#E2E8F0"),
        borderTop: "3px solid " + rc, borderRadius: 12,
        padding: "10px 14px", minWidth: 160,
        boxShadow: apex ? "0 4px 12px rgba(15,37,64,0.12)" : "0 1px 5px rgba(15,37,64,0.06)",
        opacity: dim ? 0.4 : 1, transition: "opacity .15s",
      }}>
        <div style={ring(person.role, 40)}>{initials(person.full_name)}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 7 }}>
          {apex && <span title="Top of hierarchy" style={{ fontSize: 12 }}>{"\u2605"}</span>}
          <span style={{ fontWeight: 700, color: NAVY, fontSize: 12.5, textAlign: "center", whiteSpace: "nowrap" }}>{person.full_name || "Unnamed"}</span>
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, color: rc, marginTop: 2 }}>{ROLE_LABEL[person.role] || person.role}</span>
        {downlineCount(person.id) > 0 && <span style={{ fontSize: 10, color: "#94A3B8", marginTop: 1 }}>{downlineCount(person.id)} in team</span>}
        {editId === person.id
          ? <Editor person={person} />
          : <button onClick={() => setEditId(person.id)} title="Change reporting line"
              style={{ marginTop: 6, fontSize: 10.5, color: "#64748B", background: BG, border: "1px solid #E2E8F0", borderRadius: 6, cursor: "pointer", padding: "2px 8px" }}>{"\u270e edit"}</button>}
      </div>
    );
  };

  // recursive horizontal subtree: node on top, children in a row beneath with connectors
  const Subtree = ({ person, size }) => {
    const kids = childrenOf[person.id] || [];
    const dim = !!q && !matchesSubtree(person);
    return (
      <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", padding: "0 10px", verticalAlign: "top" }}>
        <Card person={person} size={size} dim={dim} />
        {kids.length > 0 && (
          <>
            <span style={{ width: 2, height: 18, background: LINE }} />
            <div style={{ display: "flex", alignItems: "flex-start", position: "relative" }}>
              {kids.length > 1 && <span style={{ position: "absolute", top: 0, left: "10%", right: "10%", height: 2, background: LINE }} />}
              {kids.map((k) => (
                <div key={k.id} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <span style={{ width: 2, height: 14, background: LINE }} />
                  <Subtree person={k} size="md" />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );

    function matchesSubtree(node) {
      if (matches(node)) return true;
      return (childrenOf[node.id] || []).some(matchesSubtree);
    }
  };

  const wrap = { padding: "22px 24px" };
  const rolesPresent = [...new Set(people.map((p) => p.role))].filter(Boolean);

  return (
    <div style={wrap}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 6 }}>
        <div>
          <h2 style={{ color: NAVY, margin: "0 0 4px", fontSize: 22 }}>Org Chart</h2>
          <p style={{ color: "#64748B", margin: 0, fontSize: 13 }}>Reporting structure — click edit on anyone to change who they report to.</p>
        </div>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search person or role…"
          style={{ fontSize: 13, padding: "8px 12px", borderRadius: 10, border: "1px solid #E2E8F0", minWidth: 220, color: NAVY, background: "#fff" }} />
      </div>

      {rolesPresent.length > 0 && (
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", margin: "10px 0 18px" }}>
          {rolesPresent.map((r) => (
            <span key={r} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: "#64748B" }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: ROLE_COLOR[r] || "#64748B" }} />
              {ROLE_LABEL[r] || r}
            </span>
          ))}
        </div>
      )}

      {loading && <p style={{ color: "#64748B" }}>Loading…</p>}
      {err && <p style={{ color: "#DC2626" }}>{err}</p>}
      {!loading && !err && rootsWithTeam.length === 0 && unassigned.length === 0 && (
        <p style={{ color: "#64748B" }}>No people found for this company.</p>
      )}

      {!loading && !err && (rootsWithTeam.length > 0 || unassigned.length > 0) && (
        <div style={{ overflowX: "auto", paddingBottom: 20 }}>
          <div style={{ display: "inline-flex", gap: 40, alignItems: "flex-start", minWidth: "100%", justifyContent: rootsWithTeam.length === 1 ? "center" : "flex-start" }}>
            {rootsWithTeam.map((r) => <Subtree key={r.id} person={r} size="lg" />)}
          </div>

          {unassigned.length > 0 && (
            <div style={{ marginTop: 28, borderTop: "1px dashed " + LINE, paddingTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#64748B", marginBottom: 10 }}>
                Unassigned — no manager set ({unassigned.length})
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                {unassigned.map((p) => <Card key={p.id} person={p} size="md" dim={!!q && !matches(p)} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
