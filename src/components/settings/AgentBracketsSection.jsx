import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase.js";

/*
  AgentBracketsSection — Stage 5b of the Commission Model (Layer B Tier 2).
  SM/Owner sets & ADVANCES each broker's commission bracket (the per-agent split that overrides the
  company-wide standard). Every change is REASON-MANDATORY and writes a commission_audit_log row.
  Audit is FATAL-if-fails (a commission change must never succeed unaudited).
*/
export default function AgentBracketsSection({ currentUser, users = [], showToast }) {
  const companyId = currentUser?.company_id;

  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editAgent, setEditAgent] = useState(null);
  const [editForm, setEditForm] = useState({ mode: "", value: "", reason: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!companyId) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, role, commission_split_mode, commission_split_value")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .order("full_name");
      if (error) throw error;
      setAgents(data || []);
    } catch (e) {
      console.error("[AgentBracketsSection] load error:", e);
      showToast?.("Couldn't load agents: " + e.message, "error");
    } finally {
      setLoading(false);
    }
  }, [companyId, showToast]);

  useEffect(() => { load(); }, [load]);

  const openEdit = (agent) => {
    setEditAgent(agent);
    setEditForm({
      mode: agent.commission_split_mode || "",
      value: agent.commission_split_value != null ? String(agent.commission_split_value) : "",
      reason: "",
    });
  };

  const closeEdit = () => { setEditAgent(null); setEditForm({ mode: "", value: "", reason: "" }); };

  const bracketLabel = (a) => {
    if (!a.commission_split_mode) return "— not set (uses company standard) —";
    if (a.commission_split_mode === "percentage") return `${a.commission_split_value}% of commission`;
    return `AED ${Number(a.commission_split_value).toLocaleString()} fixed`;
  };

  const handleSave = async () => {
    const mode = editForm.mode || null;
    const rawVal = String(editForm.value).trim();
    const reason = editForm.reason.trim();

    if (!reason) {
      showToast?.("A reason is required for any bracket change (audit trail)", "error");
      return;
    }
    let value = null;
    if (mode) {
      if (rawVal === "") {
        showToast?.("Enter a bracket value, or set mode to 'not set' to clear", "error");
        return;
      }
      const n = Number(rawVal);
      if (Number.isNaN(n) || n < 0) {
        showToast?.("Bracket value must be a positive number", "error");
        return;
      }
      if (mode === "percentage" && n > 100) {
        showToast?.("Percentage bracket can't exceed 100%", "error");
        return;
      }
      value = n;
    }

    const fromMode = editAgent.commission_split_mode || null;
    const fromValue = editAgent.commission_split_value != null ? Number(editAgent.commission_split_value) : null;

    if (fromMode === mode && fromValue === value) {
      showToast?.("No change to save", "error");
      return;
    }

    setSaving(true);
    try {
      const logRow = {
        company_id: companyId,
        action: "bracket_change",
        subject_user_id: editAgent.id,
        opportunity_id: null,
        from_mode: fromMode,
        from_value: fromValue,
        to_mode: mode,
        to_value: value,
        reason: reason,
        triggered_by: currentUser.id,
      };
      const { error: logErr } = await supabase.from("commission_audit_log").insert(logRow);
      if (logErr) throw new Error("Audit log failed — change not applied: " + logErr.message);

      const { error: upErr } = await supabase
        .from("profiles")
        .update({ commission_split_mode: mode, commission_split_value: value })
        .eq("id", editAgent.id);
      if (upErr) throw upErr;

      setAgents(list => list.map(a => a.id === editAgent.id
        ? { ...a, commission_split_mode: mode, commission_split_value: value }
        : a));
      showToast?.(`Bracket updated for ${editAgent.full_name || "agent"}`, "success");
      closeEdit();
    } catch (e) {
      showToast?.("Couldn't save bracket: " + e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 24, color: "#A0AEC0" }}>Loading agents...</div>;
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: "#0F2540", margin: "0 0 4px" }}>
        Agent Brackets
      </h2>
      <p style={{ fontSize: 13, color: "#64748B", margin: "0 0 24px" }}>
        Set each agent's commission bracket based on role, performance, or ability. A bracket overrides
        the company-wide standard split. Every change requires a reason and is recorded.
      </p>

      <div style={{ background: "#fff", border: "1px solid #E6EAF0", borderRadius: 12, overflow: "hidden" }}>
        {agents.length === 0 ? (
          <div style={{ padding: 20, color: "#94A3B8", fontSize: 13 }}>No active agents found.</div>
        ) : agents.map((a, idx) => (
          <div key={a.id} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 18px", borderTop: idx === 0 ? "none" : "1px solid #F1F5F9",
          }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#0F2540" }}>
                {a.full_name || a.email || "Unnamed"}
                <span style={{ fontSize: 11, fontWeight: 500, color: "#94A3B8", marginLeft: 8 }}>{a.role}</span>
              </div>
              <div style={{ fontSize: 12, color: a.commission_split_mode ? "#1D4ED8" : "#94A3B8", marginTop: 2 }}>
                {bracketLabel(a)}
              </div>
            </div>
            <button
              onClick={() => openEdit(a)}
              style={{
                padding: "7px 16px", fontSize: 13, fontWeight: 600, borderRadius: 8,
                border: "1.5px solid #D1D9E6", background: "#fff", color: "#0F2540", cursor: "pointer",
              }}
            >
              Set bracket
            </button>
          </div>
        ))}
      </div>

      {editAgent && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(15,37,64,0.45)", display: "flex",
          alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16,
        }} onClick={closeEdit}>
          <div style={{ background: "#fff", borderRadius: 14, padding: 24, width: "100%", maxWidth: 460 }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: "#0F2540", margin: "0 0 4px" }}>
              Set bracket — {editAgent.full_name || editAgent.email}
            </h3>
            <p style={{ fontSize: 12, color: "#64748B", margin: "0 0 18px" }}>
              Current: {bracketLabel(editAgent)}
            </p>

            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#0F2540", marginBottom: 6 }}>Bracket mode</label>
            <select
              value={editForm.mode}
              onChange={e => setEditForm(f => ({ ...f, mode: e.target.value }))}
              style={{ width: "100%", fontSize: 14, padding: "9px 10px", borderRadius: 8, border: "1.5px solid #D1D9E6", marginBottom: 14 }}
            >
              <option value="">— not set (use company standard) —</option>
              <option value="percentage">Percentage of commission</option>
              <option value="fixed">Fixed amount (AED)</option>
            </select>

            {editForm.mode && (
              <>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#0F2540", marginBottom: 6 }}>
                  {editForm.mode === "percentage" ? "Percentage (%)" : "Fixed amount (AED)"}
                </label>
                <input
                  type="number" min="0" step="0.01"
                  value={editForm.value}
                  onChange={e => setEditForm(f => ({ ...f, value: e.target.value }))}
                  placeholder={editForm.mode === "percentage" ? "e.g. 30" : "e.g. 30000"}
                  style={{ width: "100%", fontSize: 14, padding: "9px 10px", borderRadius: 8, border: "1.5px solid #D1D9E6", marginBottom: 14 }}
                />
              </>
            )}

            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#0F2540", marginBottom: 6 }}>
              Reason <span style={{ color: "#B42318" }}>*</span>
            </label>
            <textarea
              value={editForm.reason}
              onChange={e => setEditForm(f => ({ ...f, reason: e.target.value }))}
              placeholder="e.g. Promoted to senior — Q2 top performer"
              rows={2}
              style={{ width: "100%", fontSize: 13, padding: "9px 10px", borderRadius: 8, border: "1.5px solid #D1D9E6", marginBottom: 4, resize: "vertical", fontFamily: "inherit" }}
            />
            <p style={{ fontSize: 11, color: "#94A3B8", margin: "0 0 18px" }}>
              Required — recorded in the commission audit trail.
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={closeEdit} disabled={saving}
                style={{ padding: "9px 18px", fontSize: 13, fontWeight: 600, borderRadius: 8, border: "1.5px solid #D1D9E6", background: "#fff", color: "#475569", cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                style={{ padding: "9px 20px", fontSize: 13, fontWeight: 600, borderRadius: 8, border: "none", background: saving ? "#CBD5E1" : "#0F2540", color: "#fff", cursor: saving ? "default" : "pointer" }}>
                {saving ? "Saving..." : "Save bracket"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
