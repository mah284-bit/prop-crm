import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase.js";

const NAVY = "#0F2540";
const initials = (name) =>
  (name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || "").join("") || "?";

const ROLE_LABEL = {
  super_admin: "Super Admin", admin: "Admin", group_gm: "Group GM",
  sales_manager: "Sales Manager", leasing_manager: "Leasing Manager",
  sales_agent: "Sales Agent", leasing_agent: "Leasing Agent", viewer: "Viewer",
};

export default function OrgChartPage({ currentUser, showToast }) {
  const [loading, setLoading] = useState(true);
  const [people, setPeople] = useState([]);
  const [err, setErr] = useState("");
  const [savingId, setSavingId] = useState(null);

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
  for (const p of people) { (childrenOf[p.manager_id || "ROOT"] ||= []).push(p); }
  const roots = childrenOf["ROOT"] || [];

  async function reassign(personId, newManagerId) {
    if (newManagerId === personId) { showToast?.("A person cannot report to themselves."); return; }
    setSavingId(personId);
    try {
      const { error } = await supabase.from("profiles").update({ manager_id: newManagerId || null }).eq("id", personId);
      if (error) throw error;
      showToast?.("Reporting line updated.");
      await load();
    } catch (e) {
      showToast?.(e.message || "Failed to update reporting line.");
    } finally {
      setSavingId(null);
    }
  }

  const card = { background: "#fff", borderRadius: 14, padding: 14, boxShadow: "0 2px 8px rgba(15,37,64,0.06)", border: "1px solid #E2E8F0", minWidth: 240 };
  const avatar = { width: 40, height: 40, borderRadius: "50%", background: NAVY, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, flexShrink: 0 };

  const Node = ({ person, depth }) => {
    const kids = childrenOf[person.id] || [];
    return (
      <div style={{ marginLeft: depth ? 28 : 0, marginTop: 10 }}>
        <div style={{ ...card, opacity: person.is_active === false ? 0.55 : 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={avatar}>{initials(person.full_name)}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, color: NAVY, fontSize: 14 }}>{person.full_name || "Unnamed"}</div>
              <div style={{ fontSize: 12, color: "#64748B" }}>{ROLE_LABEL[person.role] || person.role || "—"}</div>
            </div>
          </div>
          <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: "#94A3B8" }}>Reports to</span>
            <select value={person.manager_id || ""} disabled={savingId === person.id}
              onChange={(e) => reassign(person.id, e.target.value)}
              style={{ flex: 1, fontSize: 12, padding: "5px 8px", borderRadius: 8, border: "1px solid #E2E8F0", color: NAVY, background: "#F8FAFC" }}>
              <option value="">— none (top) —</option>
              {people.filter((m) => m.id !== person.id).map((m) => (
                <option key={m.id} value={m.id}>{m.full_name} · {ROLE_LABEL[m.role] || m.role}</option>
              ))}
            </select>
          </div>
        </div>
        {kids.map((k) => <Node key={k.id} person={k} depth={depth + 1} />)}
      </div>
    );
  };

  return (
    <div style={{ padding: 20 }}>
      <h2 style={{ color: NAVY, margin: "0 0 4px" }}>Org Chart</h2>
      <p style={{ color: "#64748B", margin: "0 0 16px", fontSize: 13 }}>
        Reporting structure — who reports to whom. Change a reporting line with the dropdown on each card.
      </p>
      {loading && <p style={{ color: "#64748B" }}>Loading…</p>}
      {err && <p style={{ color: "#DC2626" }}>{err}</p>}
      {!loading && !err && roots.length === 0 && <p style={{ color: "#64748B" }}>No people found for this company.</p>}
      {!loading && !err && roots.map((r) => <Node key={r.id} person={r} depth={0} />)}
    </div>
  );
}
