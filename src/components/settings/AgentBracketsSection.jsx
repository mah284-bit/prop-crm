import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase.js";

/*
  AgentBracketsSection (Agentwise Commission Breakup) — Layer B Tier 2.
  SM sets a per-agent commission rate that OVERRIDES the company-wide standard.
  RULES (locked 30 Jun):
    - Company operates in ONE mode at a time (% or fixed). Brackets INHERIT that mode.
    - GATE: a bracket value must be >= the company standard value (positive-only floor).
    - No company standard set => block bracket-setting (set the standard first).
    - Every change is REASON-MANDATORY and writes commission_audit_log (FATAL if audit fails).
*/
export default function AgentBracketsSection({ currentUser, users = [], showToast }) {
  const companyId = currentUser?.company_id;

  const [agents, setAgents] = useState([]);
  const [companyStd, setCompanyStd] = useState({ mode: null, value: null }); // the house standard (floor)
  const [loading, setLoading] = useState(true);
  const [editAgent, setEditAgent] = useState(null);
  const [editForm, setEditForm] = useState({ value: "", reason: "" }); // mode is inherited, not chosen
  const [agentHistory, setAgentHistory] = useState([]); // this agent commission_audit_log rows
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!companyId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [{ data: ags, error: aErr }, { data: co, error: cErr }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, email, role, commission_split_mode, commission_split_value")
          .eq("company_id", companyId)
          .eq("is_active", true)
          .order("full_name"),
        supabase
          .from("companies")
          .select("default_agent_split_mode, default_agent_split_value")
          .eq("id", companyId)
          .single(),
      ]);
      if (aErr) throw aErr;
      if (cErr) throw cErr;
      setAgents(ags || []);
      setCompanyStd({
        mode: co?.default_agent_split_mode || null,
        value: co?.default_agent_split_value != null ? Number(co.default_agent_split_value) : null,
      });
    } catch (e) {
      console.error("[AgentBracketsSection] load error:", e);
      showToast?.("Couldn't load agents: " + e.message, "error");
    } finally {
      setLoading(false);
    }
  }, [companyId, showToast]);

  useEffect(() => { load(); }, [load]);

  const stdSet = companyStd.mode && companyStd.value != null;
  const stdLabel = !stdSet ? "no company standard set"
    : companyStd.mode === "percentage" ? `${companyStd.value}%`
    : `AED ${Number(companyStd.value).toLocaleString()}`;

  const openEdit = async (agent) => {
    setEditAgent(agent);
    const sameMode = agent.commission_split_mode === companyStd.mode;
    setEditForm({
      value: (sameMode && agent.commission_split_value != null) ? String(agent.commission_split_value) : "",
      reason: "",
    });
    // fetch this agent's rate-change history (audit trail)
    setAgentHistory([]);
    try {
      const { data } = await supabase
        .from("commission_audit_log")
        .select("from_mode, from_value, to_mode, to_value, reason, created_at")
        .eq("company_id", companyId)
        .eq("subject_user_id", agent.id)
        .eq("action", "bracket_change")
        .order("created_at", { ascending: false })
        .limit(20);
      setAgentHistory(data || []);
    } catch (e) { console.warn("history load error:", e); }
  };

  const fmtVal = (mode, val) => {
    if (val == null || !mode) return "not set";
    return mode === "percentage" ? `${val}%` : `AED ${Number(val).toLocaleString()}`;
  };
  const fmtDate = (iso) => {
    try { return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }); }
    catch { return ""; }
  };

  const closeEdit = () => { setEditAgent(null); setEditForm({ value: "", reason: "" }); setAgentHistory([]); };

  const bracketLabel = (a) => {
    if (!a.commission_split_mode) return "— not set (uses company standard) —";
    if (a.commission_split_mode === "percentage") return `${a.commission_split_value}% of commission`;
    return `AED ${Number(a.commission_split_value).toLocaleString()} fixed`;
  };

  // live delta hint while typing
  const deltaHint = () => {
    const raw = String(editForm.value).trim();
    if (raw === "" || !stdSet) return null;
    const n = Number(raw);
    if (Number.isNaN(n)) return null;
    const diff = Math.round((n - companyStd.value) * 100) / 100;
    if (diff < 0) return { text: `↓ ${Math.abs(diff)}${companyStd.mode === "percentage" ? "%" : " AED"} below standard — not allowed`, color: "#B42318" };
    if (diff === 0) return { text: "= equal to company standard", color: "#64748B" };
    return { text: `↑ ${diff}${companyStd.mode === "percentage" ? "%" : " AED"} above standard`, color: "#067647" };
  };

  const handleSave = async () => {
    const reason = editForm.reason.trim();
    const rawVal = String(editForm.value).trim();

    if (!stdSet) {
      showToast?.("Set a company standard in Commission Defaults first", "error");
      return;
    }
    if (!reason) {
      showToast?.("A reason is required for any change (audit trail)", "error");
      return;
    }
    if (rawVal === "") {
      showToast?.("Enter a rate value", "error");
      return;
    }
    const value = Number(rawVal);
    if (Number.isNaN(value) || value < 0) {
      showToast?.("Value must be a positive number", "error");
      return;
    }
    if (companyStd.mode === "percentage" && value > 100) {
      showToast?.("Percentage can't exceed 100%", "error");
      return;
    }
    // THE GATE — bracket cannot be below the company standard
    if (value < companyStd.value) {
      showToast?.(`Bracket can't be below the company standard of ${stdLabel}`, "error");
      return;
    }

    const mode = companyStd.mode; // inherited
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
      showToast?.(`Rate updated for ${editAgent.full_name || "agent"}`, "success");
      closeEdit();
    } catch (e) {
      showToast?.("Couldn't save: " + e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 24, color: "#A0AEC0" }}>Loading agents...</div>;
  }

  const hint = editAgent ? deltaHint() : null;

  return (
    <div style={{ maxWidth: 720 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: "#0F2540", margin: "0 0 4px" }}>
        Agentwise Commission Breakup
      </h2>
      <p style={{ fontSize: 13, color: "#64748B", margin: "0 0 8px" }}>
        Set an individual commission rate for a specific agent — based on role, performance, or ability.
      </p>
      <div style={{ fontSize: 12, color: "#1D4ED8", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 8, padding: "10px 14px", margin: "0 0 20px", lineHeight: 1.6 }}>
        <strong>Why this screen:</strong> your company sets one house-standard split in <em>Commission Defaults</em>.
        This screen lets you give chosen agents a <strong>higher rate that overrides that standard</strong> —
        to reward performers. A bracket can never be below the standard. Agents left "not set" use the
        house standard. Every change needs a reason and is recorded.
      </div>

      <div style={{ fontSize: 12, fontWeight: 600, color: stdSet ? "#0F2540" : "#B42318", marginBottom: 12 }}>
        Company standard (floor): {stdLabel}
        {!stdSet && " — set it in Commission Defaults before assigning brackets"}
      </div>

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
              disabled={!stdSet}
              title={!stdSet ? "Set a company standard first" : ""}
              style={{
                padding: "7px 16px", fontSize: 13, fontWeight: 600, borderRadius: 8,
                border: "1.5px solid #D1D9E6", background: stdSet ? "#fff" : "#F0F2F5",
                color: stdSet ? "#0F2540" : "#9CA3AF", cursor: stdSet ? "pointer" : "not-allowed",
              }}
            >
              Set rate
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
              Set rate — {editAgent.full_name || editAgent.email}
            </h3>
            <p style={{ fontSize: 12, color: "#64748B", margin: "0 0 6px" }}>
              Current: {bracketLabel(editAgent)}
            </p>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#1D4ED8", background: "#EFF6FF", borderRadius: 8, padding: "8px 12px", margin: "0 0 18px" }}>
              Company standard (floor): {stdLabel} — this agent must be at or above it.
            </div>

            {agentHistory.length > 0 && (
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 6 }}>Rate history</div>
                <div style={{ border: "1px solid #E6EAF0", borderRadius: 8, maxHeight: 140, overflowY: "auto" }}>
                  {agentHistory.map((h, i) => (
                    <div key={i} style={{ padding: "8px 12px", borderTop: i === 0 ? "none" : "1px solid #F1F5F9", fontSize: 12 }}>
                      <div style={{ color: "#0F2540", fontWeight: 600 }}>
                        {fmtVal(h.from_mode, h.from_value)} <span style={{ color: "#94A3B8" }}>→</span> {fmtVal(h.to_mode, h.to_value)}
                        <span style={{ float: "right", color: "#94A3B8", fontWeight: 500 }}>{fmtDate(h.created_at)}</span>
                      </div>
                      {h.reason && <div style={{ color: "#64748B", marginTop: 2, fontStyle: "italic" }}>{h.reason}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#0F2540", marginBottom: 6 }}>
              {companyStd.mode === "percentage" ? "Rate (%)" : "Fixed amount (AED)"}
            </label>
            <input
              type="number" min="0" step="0.01"
              value={editForm.value}
              onChange={e => setEditForm(f => ({ ...f, value: e.target.value }))}
              placeholder={companyStd.mode === "percentage" ? "e.g. 40" : "e.g. 40000"}
              style={{ width: "100%", fontSize: 14, padding: "9px 10px", borderRadius: 8, border: "1.5px solid #D1D9E6", marginBottom: 4 }}
            />
            <div style={{ fontSize: 11, color: hint ? hint.color : "#94A3B8", minHeight: 16, marginBottom: 14 }}>
              {hint ? hint.text : ""}
            </div>

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
                {saving ? "Saving..." : "Save rate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
