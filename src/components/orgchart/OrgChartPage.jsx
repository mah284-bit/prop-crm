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
  const [collapsed, setCollapsed] = useState({});
  const [showUnassigned, setShowUnassigned] = useState(false);
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

  // count whole downline (for the apex badge)
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

  const ring = (role, size = 38) => ({
    width: size, height: size, borderRadius: "50%", flexShrink: 0,
    background: "#fff", border: "2px solid " + (ROLE_COLOR[role] || "#64748B"),
    color: ROLE_COLOR[role] || "#64748B",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontWeight: 700, fontSize: size > 40 ? 14 : 12,
    boxShadow: "0 1px 3px rgba(15,37,64,0.12)",
  });

  const EditPopover = ({ person }) => (
    <select autoFocus value={person.manager_id || ""} disabled={savingId === person.id}
      onChange={(e) => reassign(person.id, e.target.value)}
      onBlur={() => setEditId(null)}
      style={{ fontSize: 12, padding: "4px 8px", borderRadius: 8, border: "1px solid " + NAVY, color: NAVY, background: "#fff", maxWidth: 230 }}>
      <option value="">— none (top) —</option>
      {people.filter((m) => m.id !== person.id).map((m) => (
        <option key={m.id} value={m.id}>{m.full_name} · {ROLE_LABEL[m.role] || m.role}</option>
      ))}
    </select>
  );

  const NodeRow = ({ person, depth, isApex }) => {
    const kids = (childrenOf[person.id] || []).filter((k) => matchesSubtree(k));
    const isCollapsed = collapsed[person.id];
    const rc = ROLE_COLOR[person.role] || "#64748B";
    return (
      <div style={{ position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", position: "relative", paddingLeft: depth * 30 }}>
          {depth > 0 && <span style={{ position: "absolute", left: (depth - 1) * 30 + 18, top: -6, height: "50%", width: 2, background: LINE }} />}
          {depth > 0 && <span style={{ position: "absolute", left: (depth - 1) * 30 + 18, top: "50%", width: 14, height: 2, background: LINE }} />}
          {kids.length > 0 ? (
            <button onClick={() => setCollapsed((c) => ({ ...c, [person.id]: !c[person.id] }))}
              style={{ width: 18, height: 18, border: "1px solid " + LINE, borderRadius: 5, background: "#fff", cursor: "pointer", fontSize: 11, lineHeight: "16px", color: NAVY, flexShrink: 0, zIndex: 1 }}>
              {isCollapsed ? "+" : "\u2212"}
            </button>
          ) : <span style={{ width: 18, flexShrink: 0 }} />}
          <div style={{
            display: "flex", alignItems: "center", gap: 11, padding: isApex ? "10px 16px" : "8px 14px",
            background: "#fff", border: "1px solid " + (isApex ? rc : "#E2E8F0"),
            borderLeft: "4px solid " + rc, borderRadius: 12, minWidth: 230,
            boxShadow: isApex ? "0 3px 10px rgba(15,37,64,0.10)" : "0 1px 4px rgba(15,37,64,0.05)",
          }}>
            <div style={ring(person.role, isApex ? 46 : 38)}>{initials(person.full_name)}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {isApex && <span title="Top of hierarchy" style={{ fontSize: 13 }}>{"\u2605"}</span>}
                <span style={{ fontWeight: 700, color: NAVY, fontSize: isApex ? 15 : 13.5, whiteSpace: "nowrap" }}>{person.full_name || "Unnamed"}</span>
                {person.is_active === false && <span style={{ fontSize: 10, color: "#94A3B8", border: "1px solid #E2E8F0", borderRadius: 4, padding: "0 4px" }}>inactive</span>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: rc, whiteSpace: "nowrap" }}>{ROLE_LABEL[person.role] || person.role}</span>
                {kids.length > 0 && <span style={{ fontSize: 10.5, color: "#94A3B8" }}>{"\u2022"} {downlineCount(person.id)} in team</span>}
              </div>
            </div>
            {editId === person.id
              ? <EditPopover person={person} />
              : <button onClick={() => setEditId(person.id)}
                  style={{ fontSize: 12, color: "#94A3B8", background: BG, border: "1px solid #E2E8F0", borderRadius: 7, cursor: "pointer", padding: "3px 7px" }}
                  title="Change reporting line">{"\u270e"}</button>}
          </div>
        </div>
        {!isCollapsed && kids.map((k) => <NodeRow key={k.id} person={k} depth={depth + 1} isApex={false} />)}
      </div>
    );

    function matchesSubtree(node) {
      if (matches(node)) return true;
      return (childrenOf[node.id] || []).some(matchesSubtree);
    }
  };

  const wrap = { padding: "22px 24px", maxWidth: 960 };
  const panel = { background: BG, borderRadius: 16, padding: "18px 20px", border: "1px solid #E2E8F0", marginBottom: 16 };

  const rolesPresent = [...new Set(people.map((p) => p.role))].filter(Boolean);

  return (
    <div style={wrap}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 6 }}>
        <div>
          <h2 style={{ color: NAVY, margin: "0 0 4px", fontSize: 22 }}>Org Chart</h2>
          <p style={{ color: "#64748B", margin: 0, fontSize: 13 }}>Reporting structure — click the pencil on anyone to change who they report to.</p>
        </div>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search person or role…"
          style={{ fontSize: 13, padding: "8px 12px", borderRadius: 10, border: "1px solid #E2E8F0", minWidth: 220, color: NAVY, background: "#fff" }} />
      </div>

      {rolesPresent.length > 0 && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "10px 0 16px" }}>
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

      {!loading && !err && rootsWithTeam.map((r) => (
        <div key={r.id} style={panel}><NodeRow person={r} depth={0} isApex={true} /></div>
      ))}

      {!loading && !err && unassigned.length > 0 && (
        <div style={panel}>
          <button onClick={() => setShowUnassigned((v) => !v)}
            style={{ background: "none", border: "none", cursor: "pointer", color: NAVY, fontWeight: 700, fontSize: 13, padding: 0, display: "flex", alignItems: "center", gap: 6 }}>
            <span>{showUnassigned ? "\u25BC" : "\u25B6"}</span>
            Unassigned — no manager set
            <span style={{ background: "#E2E8F0", color: "#475569", borderRadius: 10, padding: "1px 8px", fontSize: 11 }}>{unassigned.length}</span>
          </button>
          {showUnassigned && (
            <div style={{ marginTop: 10 }}>
              {unassigned.filter(matches).map((p) => <NodeRow key={p.id} person={p} depth={0} isApex={false} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
