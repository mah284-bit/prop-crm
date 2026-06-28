import React, { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "../../lib/supabase.js";

/*
  CommissionSettingsSection — company-level commission defaults (SM/Owner controlled).
  Stage 2b of the Commission Model. Field lives on the companies table:
    default_commission_pct — Layer A fallback used when no Master Agreement exists for a deal.
  Mirrors the LeadRoutingRulesSection load -> form -> dirty-check -> save pattern.
*/
export default function CommissionSettingsSection({ currentUser, showToast }) {
  const companyId = currentUser?.company_id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ default_commission_pct: "" });
  const [originalForm, setOriginalForm] = useState(null);

  const load = useCallback(async () => {
    if (!companyId) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data: co, error } = await supabase
        .from("companies")
        .select("default_commission_pct")
        .eq("id", companyId)
        .single();
      if (error) throw error;
      const loaded = {
        default_commission_pct: co?.default_commission_pct != null ? String(co.default_commission_pct) : "",
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
    return form.default_commission_pct !== originalForm.default_commission_pct;
  }, [form, originalForm]);

  const handleSave = async () => {
    const raw = String(form.default_commission_pct).trim();
    let value = null;
    if (raw !== "") {
      const n = Number(raw);
      if (Number.isNaN(n) || n < 0 || n > 100) {
        showToast?.("Default commission % must be between 0 and 100 (or blank to clear)", "error");
        return;
      }
      value = n;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("companies")
        .update({ default_commission_pct: value })
        .eq("id", companyId);
      if (error) throw error;
      const saved = { default_commission_pct: value != null ? String(value) : "" };
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

  return (
    <div style={{ maxWidth: 640 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: "#0F2540", margin: "0 0 4px" }}>
        Commission Defaults
      </h2>
      <p style={{ fontSize: 13, color: "#64748B", margin: "0 0 24px" }}>
        Company-level commission settings. These apply across your deals unless overridden.
      </p>

      <div style={{ background: "#fff", border: "1px solid #E6EAF0", borderRadius: 12, padding: 20 }}>
        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#0F2540", marginBottom: 6 }}>
          Default Commission %
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={form.default_commission_pct}
            onChange={(e) => setForm(f => ({ ...f, default_commission_pct: e.target.value }))}
            placeholder="e.g. 4"
            style={{ width: 140, fontSize: 14 }}
          />
          <span style={{ fontSize: 14, color: "#64748B" }}>%</span>
        </div>
        <p style={{ fontSize: 12, color: "#94A3B8", margin: "10px 0 0", lineHeight: 1.5 }}>
          Used as the developer-commission rate on a deal only when no active Master Agreement exists
          for that developer. Master Agreement rates always take priority. Leave blank to require
          manual entry when there's no agreement.
        </p>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
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
