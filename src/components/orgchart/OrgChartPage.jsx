import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase.js";

const NAVY = "#0F2540";
const LINE = "#CBD5E1";
const initials = (name) =>
  (name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || "").join("") || "?";

const ROLE_LABEL = {
  super_admin: "Super Admin", admin: "Admin", group_gm: "Group GM",
  sales_manager: "Sales Manager", leasing_manager: "Leasing Manager",
  sales_agent: "Sales Agent", leasing_agent: "Leasing Agent", viewer: "Viewer",
};
const ROLE_COLOR = {
  super_admin: "#7C3AED", admin: "#0EA5E9", group_gm: "#0891B2",
  sales_manager: "#059669", leasing_manager: "#059669",
  sales_agent: "#64748B", leasing_agent: "#64748B", viewer: "#94A3B8",
};

export default function OrgChartPage({ currentUser, showToast }) {
  const [loading, setLoading] = useState(true);
  const [people, setPeople] = useState([]);
  const [err, setErr] = useState("");
  const [savingId, setSavingId] = useState(null);
  const [editId, setEditId] = useState(null);
  const [collapsed, setCollapsed] = useState({});
  const [showUnassigned, setShowUnassigned] = useState(false);

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

  const dot = (role) => ({
    width: 30, height: 30, borderRadius: "50%", background: ROLE_COLOR[role] || "#64748B",
    color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
    fontWeight: 700, fontSize: 11, flexShrink: 0,
  });

  const EditPopover = ({ person }) => (
    <select autoFocus value={person.manager_id || ""} disabled={savingId === person.id}
      onChange={(e) => reassign(person.id, e.target.value)}
      onBlur={() => setEditId(null)}
      style={{ fontSize: 12, padding: "3px 6px", borderRadius: 6, border: "1px solid " + NAVY, color: NAVY, background: "#fff", maxWidth: 220 }}>
      <option value="">— none (top) —</option>
      {people.filter((m) => m.id !== person.id).map((m) => (
        <option key={m.id} value={m.id}>{m.full_name} · {ROLE_LABEL[m.role] || m.role}</option>
      ))}
    </select>
  );

  const NodeRow = ({ person, depth }) => {
    const kids = childrenOf[person.id] || [];
    const isCollapsed = collapsed[person.id];
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", position: "relative", paddingLeft: depth * 26 }}>
          {depth > 0 && (
            <span style={{ position: "absolute", left: (depth - 1) * 26 + 9, top: 0, bottom: "50%", width: 1, background: LINE }} />
          )}
          {depth > 0 && (
            <span style={{ position: "absolute", left: (depth - 1) * 26 + 9, top: "50%", width: 14, height: 1, background: LINE }} />
          )}
          {kids.length > 0 ? (
            <button onClick={() => setCollapsed((c) => ({ ...c, [person.id]: !c[person.id] }))}
              style={{ width: 16, height: 16, border: "1px solid " + LINE, borderRadius: 4, background: "#fff", cursor: "pointer", fontSize: 10, lineHeight: "14px", color: NAVY, flexShrink: 0 }}>
              {isCollapsed ? "+" : "\u2212"}
            </button>
          ) : <span style={{ width: 16, flexShrink: 0 }} />}
          <div style={dot(person.role)}>{initials(person.full_name)}</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
            <span style={{ fontWeight: 600, color: NAVY, fontSize: 13, whiteSpace: "nowrap" }}>{person.full_name || "Unnamed"}</span>
            <span style={{ fontSize: 11, color: ROLE_COLOR[person.role] || "#64748B", whiteSpace: "nowrap" }}>{ROLE_LABEL[person.role] || person.role}</span>
            {kids.length > 0 && <span style={{ fontSize: 10, color: "#94A3B8" }}>({kids.length})</span>}
          </div>
          {editId === person.id
            ? <EditPopover person={person} />
            : <button onClick={() => setEditId(person.id)}
                style={{ fontSize: 11, color: "#94A3B8", background: "none", border: "none", cursor: "pointer", marginLeft: 4 }}
                title="Change reporting line">{"\u270e"}</button>}
        </div>
        {!isCollapsed && kids.map((k) => <NodeRow key={k.id} person={k} depth={depth + 1} />)}
      </div>
    );
  };

  const wrap = { padding: 20, maxWidth: 900 };
  const panel = { background: "#fff", borderRadius: 12, padding: "14px 18px", boxShadow: "0 1px 4px rgba(15,37,64,0.05)", border: "1px solid #E2E8F0", marginBottom: 14 };

  return (
    <div style={wrap}>
      <h2 style={{ color: NAVY, margin: "0 0 4px" }}>Org Chart</h2>
      <p style={{ color: "#64748B", margin: "0 0 16px", fontSize: 13 }}>
        Reporting structure - click the pencil on any person to change who they report to.
      </p>
      {loading && <p style={{ color: "#64748B" }}>Loading...</p>}
      {err && <p style={{ color: "#DC2626" }}>{err}</p>}

      {!loading && !err && rootsWithTeam.length === 0 && unassigned.length === 0 && (
        <p style={{ color: "#64748B" }}>No people found for this company.</p>
      )}

      {!loading && !err && rootsWithTeam.map((r) => (
        <div key={r.id} style={panel}><NodeRow person={r} depth={0} /></div>
      ))}

      {!loading && !err && unassigned.length > 0 && (
        <div style={panel}>
          <button onClick={() => setShowUnassigned((v) => !v)}
            style={{ background: "none", border: "none", cursor: "pointer", color: NAVY, fontWeight: 600, fontSize: 13, padding: 0 }}>
            {showUnassigned ? "\u25BC" : "\u25B6"} Unassigned - no manager set ({unassigned.length})
          </button>
          {showUnassigned && (
            <div style={{ marginTop: 8 }}>
              {unassigned.map((p) => <NodeRow key={p.id} person={p} depth={0} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
