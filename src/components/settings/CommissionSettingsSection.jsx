import React, { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "../../lib/supabase.js";

/*
  CommissionSettingsSection — company-level commission defaults (SM/Owner controlled).
  Two distinct settings on the companies table:
    1. default_commission_pct        — Layer A: developer->company commission rate (what company EARNS)
    2. default_agent_split_mode/value — Layer B Tier 1: company-wide standard agent split (what company
       PAYS the agent). Broker brackets + per-deal overrides can override this.
  Mirrors LeadRoutingRulesSection load -> form -> dirty-check -> save pattern.
*/
export default function CommissionSettingsSection({ currentUser, showToast }) {
  const companyId = currentUser?.company_id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    default_commission_pct: "",
    default_agent_split_mode: "",   // "" | "percentage" | "fixed"
    default_agent_split_value: "",
  });
  const [originalForm, setOriginalForm] = useState(null);

  const load = useCallback(async () => {
    if (!companyId) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data: co, error } = await supabase
        .from("companies")
        .select("default_commission_pct, default_agent_split_mode, default_agent_split_value")
        .eq("id", companyId)
        .single();
      if (error) throw error;
      const loaded = {
        default_commission_pct: co?.default_commission_pct != null ? String(co.default_commission_pct) : "",
        default_agent_split_mode: co?.default_agent_split_mode || "",
        default_agent_split_value: co?.default_agent_split_value != null ? String(co.default_agent_split_value) : "",
      };
      setForm(loaded);
      setOriginalForm(loaded);
    } catch (e) {
      console.error("[CommissionSettingsSection] load error:", e);
      showToast?.("Couldn't load commission settings: " + e.message, "error");
    } finally {
      setLoading(false);
    }
  }, [companyId, showToast]);

  useEffect(() => { load(); }, [load]);

  const isDirty = useMemo(() => {
    if (!originalForm) return false;
    return form.default_commission_pct !== originalForm.default_commission_pct
      || form.default_agent_split_mode !== originalForm.default_agent_split_mode
      || form.default_agent_split_value !== originalForm.default_agent_split_value;
  }, [form, originalForm]);

  const handleSave = async () => {
    // Layer A — developer commission %
    const rawPct = String(form.default_commission_pct).trim();
    let commissionPct = null;
    if (rawPct !== "") {
      const n = Number(rawPct);
      if (Number.isNaN(n) || n < 0 || n > 100) {
        showToast?.("Default commission % must be between 0 and 100 (or blank to clear)", "error");
        return;
      }
      commissionPct = n;
    }

    // Layer B Tier 1 — company-wide agent split
    const mode = form.default_agent_split_mode || null;
    const rawSplit = String(form.default_agent_split_value).trim();
    let splitValue = null;
    if (mode) {
      if (rawSplit === "") {
        showToast?.("Enter a split value, or set mode to blank to clear the standard split", "error");
        return;
      }
      const sv = Number(rawSplit);
      if (Number.isNaN(sv) || sv < 0) {
        showToast?.("Agent split value must be a positive number", "error");
        return;
      }
      if (mode === "percentage" && sv > 100) {
        showToast?.("Percentage split can't exceed 100%", "error");
        return;
      }
      splitValue = sv;
    }
    // if mode is blank, clear both (no company-wide standard)
    const splitMode = mode;
    if (!splitMode) splitValue = null;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("companies")
        .update({
          default_commission_pct: commissionPct,
          default_agent_split_mode: splitMode,
          default_agent_split_value: splitValue,
        })
        .eq("id", companyId);
      if (error) throw error;
      const saved = {
        default_commission_pct: commissionPct != null ? String(commissionPct) : "",
        default_agent_split_mode: splitMode || "",
        default_agent_split_value: splitValue != null ? String(splitValue) : "",
      };
      setForm(saved);
      setOriginalForm(saved);
      showToast?.("Commission settings saved", "success");
    } catch (e) {
      showToast?.("Couldn't save: " + e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 24, color: "#A0AEC0" }}>Loading commission settings...</div>;
  }

  const cardStyle = { background: "#fff", border: "1px solid #E6EAF0", borderRadius: 12, padding: 20, marginBottom: 16 };
  const labelStyle = { display: "block", fontSize: 13, fontWeight: 600, color: "#0F2540", marginBottom: 6 };
  const helpStyle = { fontSize: 12, color: "#94A3B8", margin: "10px 0 0", lineHeight: 1.5 };

  return (
    <div style={{ maxWidth: 640 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: "#0F2540", margin: "0 0 4px" }}>
        Commission Defaults
      </h2>
      <p style={{ fontSize: 13, color: "#64748B", margin: "0 0 24px" }}>
        Company-level commission settings. These apply across your deals unless overridden.
      </p>

      {/* Layer A — developer->company commission rate (what the COMPANY EARNS) */}
      <div style={cardStyle}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#1A7F5A", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 10 }}>
          Company revenue — what you earn from the developer
        </div>
        <label style={labelStyle}>Default Commission %</label>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="number" min="0" max="100" step="0.01"
            value={form.default_commission_pct}
            onChange={(e) => setForm(f => ({ ...f, default_commission_pct: e.target.value }))}
            placeholder="e.g. 4"
            style={{ width: 140, fontSize: 14 }}
          />
          <span style={{ fontSize: 14, color: "#64748B" }}>%</span>
        </div>
        <p style={helpStyle}>
          The developer-commission rate used only when no active Master Agreement exists for that
          developer. Master Agreement rates always take priority. Leave blank to require manual entry.
        </p>
      </div>

      {/* Layer B Tier 1 — company-wide standard agent split (what the COMPANY PAYS the agent) */}
      <div style={cardStyle}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#1D4ED8", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 10 }}>
          Agent split — your house standard for what agents earn
        </div>
        <label style={labelStyle}>Default Agent Split</label>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <select
            value={form.default_agent_split_mode}
            onChange={(e) => setForm(f => ({ ...f, default_agent_split_mode: e.target.value }))}
            style={{ fontSize: 14, padding: "7px 10px", borderRadius: 8, border: "1.5px solid #D1D9E6" }}
          >
            <option value="">— not set —</option>
            <option value="percentage">Percentage of commission</option>
            <option value="fixed">Fixed amount (AED)</option>
          </select>
          {form.default_agent_split_mode && (
            <>
              <input
                type="number" min="0" step="0.01"
                value={form.default_agent_split_value}
                onChange={(e) => setForm(f => ({ ...f, default_agent_split_value: e.target.value }))}
                placeholder={form.default_agent_split_mode === "percentage" ? "e.g. 20" : "e.g. 30000"}
                style={{ width: 140, fontSize: 14 }}
              />
              <span style={{ fontSize: 14, color: "#64748B" }}>
                {form.default_agent_split_mode === "percentage" ? "%" : "AED"}
              </span>
            </>
          )}
        </div>
        <p style={helpStyle}>
          The standard split every agent gets unless their individual bracket or a specific deal
          overrides it. Percentage = a share of the company commission. Fixed = a flat AED amount
          (keeps your margin confidential from the agent). Leave mode "not set" for no house standard.
        </p>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
        <button
          onClick={handleSave}
          disabled={!isDirty || saving}
          style={{
            padding: "10px 24px", fontSize: 14, fontWeight: 600, borderRadius: 8, border: "none",
            background: (!isDirty || saving) ? "#CBD5E1" : "#0F2540", color: "#fff",
            cursor: (!isDirty || saving) ? "default" : "pointer",
          }}
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
