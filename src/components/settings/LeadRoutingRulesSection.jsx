import React, { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "../../lib/supabase.js";

/* ═══════════════════════════════════════════════════════════════
   LeadRoutingRulesSection — Phase 2.1 Day 21 PM
   Single-form settings for company-wide lead routing config.
   All fields live on the companies table (columns added Day 19).
   
   Fields:
     1. lead_admin_user_id        — designated Lead Admin
     2. pool_sources (text[])     — sources that route through Lead Queue
     3. default_pool_id (NEW)     — default pool for pool-sourced leads
                                    (NOTE: this field doesn't exist yet — we
                                    use a local state variable for now, will
                                    persist when Lead Queue page is built)
     4. stale_lead_threshold_days — number of days before stale flag (default 7)
     5. stale_action              — 'flag_for_admin' | 'auto_return_to_queue'
═══════════════════════════════════════════════════════════════ */

const PRESET_SOURCES = [
  { id: "website_form",    label: "Website Form",       description: "Inquiries from your company website" },
  { id: "bayut",           label: "Bayut",              description: "Leads forwarded from Bayut listings" },
  { id: "propertyfinder",  label: "PropertyFinder",     description: "Leads forwarded from PropertyFinder" },
  { id: "dubizzle",        label: "Dubizzle",           description: "Leads forwarded from Dubizzle" },
  { id: "facebook_ads",    label: "Facebook Lead Gen",  description: "Meta Lead Ads campaigns" },
  { id: "google_ads",      label: "Google Ads",         description: "Google Ads form submissions" },
  { id: "instagram_dm",    label: "Instagram DM",       description: "Inbound Instagram direct messages" },
  { id: "campaign",        label: "Marketing Campaign", description: "Custom campaigns (Q3 launch, etc.)" },
];

const STALE_ACTIONS = [
  { 
    id: "flag_for_admin", 
    label: "Flag for Lead Admin", 
    description: "Stale leads appear in Lead Assignment 'Stale Flagged' tab. Admin decides what to do.",
  },
  { 
    id: "auto_return_to_queue", 
    label: "Auto-return to Queue", 
    description: "Stale leads automatically become unassigned and re-enter the round-robin pool.",
  },
];

export default function LeadRoutingRulesSection({ currentUser, users = [], showToast }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [originalForm, setOriginalForm] = useState(null);
  const [form, setForm] = useState({
    lead_admin_user_id: null,
    pool_sources: [],
    stale_lead_threshold_days: 7,
    stale_action: "flag_for_admin",
  });
  const [customSource, setCustomSource] = useState("");
  const [pools, setPools] = useState([]);

  const companyId = currentUser?.company_id;

  // Eligible users for Lead Admin: sales_manager or admin or super_admin within this company
  const eligibleAdmins = useMemo(() => 
    users.filter(u => 
      u.is_active && 
      u.company_id === companyId &&
      ["super_admin", "admin", "sales_manager"].includes(u.role)
    ),
    [users, companyId]
  );

  // Load company config + pools
  const load = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [{ data: co, error: cErr }, { data: pls, error: pErr }] = await Promise.all([
        supabase
          .from("companies")
          .select("lead_admin_user_id, pool_sources, stale_lead_threshold_days, stale_action")
          .eq("id", companyId)
          .single(),
        supabase
          .from("agent_pools")
          .select("id, name, is_active")
          .eq("company_id", companyId)
          .eq("is_active", true)
          .order("name"),
      ]);
      if (cErr) throw cErr;
      if (pErr) throw pErr;

      const loaded = {
        lead_admin_user_id: co?.lead_admin_user_id || null,
        pool_sources: co?.pool_sources || [],
        stale_lead_threshold_days: co?.stale_lead_threshold_days ?? 7,
        stale_action: co?.stale_action || "flag_for_admin",
      };
      setForm(loaded);
      setOriginalForm(loaded);
      setPools(pls || []);
    } catch (e) {
      console.error("[LeadRoutingRulesSection] load error:", e);
      showToast?.(`Couldn't load routing rules: ${e.message}`, "error");
    } finally {
      setLoading(false);
    }
  }, [companyId, showToast]);

  useEffect(() => { load(); }, [load]);

  // Detect dirty state
  const isDirty = useMemo(() => {
    if (!originalForm) return false;
    return (
      form.lead_admin_user_id !== originalForm.lead_admin_user_id ||
      JSON.stringify(form.pool_sources.slice().sort()) !== JSON.stringify(originalForm.pool_sources.slice().sort()) ||
      form.stale_lead_threshold_days !== originalForm.stale_lead_threshold_days ||
      form.stale_action !== originalForm.stale_action
    );
  }, [form, originalForm]);

  // Pool sources helpers
  const isSourceSelected = (id) => form.pool_sources.includes(id);
  const toggleSource = (id) => {
    setForm(f => ({
      ...f,
      pool_sources: f.pool_sources.includes(id) 
        ? f.pool_sources.filter(s => s !== id) 
        : [...f.pool_sources, id],
    }));
  };
  const addCustomSource = () => {
    const trimmed = customSource.trim().toLowerCase().replace(/\s+/g, "_");
    if (!trimmed) return;
    if (form.pool_sources.includes(trimmed)) {
      showToast?.("That source is already added", "error");
      return;
    }
    setForm(f => ({ ...f, pool_sources: [...f.pool_sources, trimmed] }));
    setCustomSource("");
  };
  const customSources = useMemo(() => 
    form.pool_sources.filter(s => !PRESET_SOURCES.some(p => p.id === s)),
    [form.pool_sources]
  );

  const handleSave = async () => {
    if (form.stale_lead_threshold_days < 1 || form.stale_lead_threshold_days > 90) {
      showToast?.("Stale threshold must be between 1 and 90 days", "error");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("companies")
        .update({
          lead_admin_user_id: form.lead_admin_user_id,
          pool_sources: form.pool_sources,
          stale_lead_threshold_days: form.stale_lead_threshold_days,
          stale_action: form.stale_action,
        })
        .eq("id", companyId);
      if (error) throw error;
      setOriginalForm(form);
      showToast?.("Routing rules saved", "success");
    } catch (e) {
      showToast?.(`Couldn't save: ${e.message}`, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (originalForm) setForm(originalForm);
  };

  // ── RENDER ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ background: "#fff", borderRadius: 16, padding: 60, textAlign: "center", color: "#6B7785" }}>
        Loading routing rules...
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0F2540", margin: 0, marginBottom: 6 }}>
          Lead Routing Rules
        </h2>
        <div style={{ fontSize: 13, color: "#6B7785" }}>
          Configure how pool-sourced leads flow into the Lead Assignment and how stale leads are handled.
        </div>
      </div>

      {/* ── CARD 1: Lead Admin ─────────────────────────────────── */}
      <Card 
        icon="👤" 
        title="Lead Admin" 
        description="The team member who reviews and assigns pool-sourced leads."
      >
        <select
          value={form.lead_admin_user_id || ""}
          onChange={(e) => setForm(f => ({ ...f, lead_admin_user_id: e.target.value || null }))}
          style={selectStyle}
        >
          <option value="">— No Lead Admin designated —</option>
          {eligibleAdmins.map(u => (
            <option key={u.id} value={u.id}>
              {u.full_name} ({u.role.replace(/_/g, " ")})
            </option>
          ))}
        </select>
        {!form.lead_admin_user_id && (
          <div style={hintTextStyle}>
            ⚠️ Without a designated Lead Admin, pool-sourced leads will accumulate in the queue without anyone notified.
          </div>
        )}
      </Card>

      {/* ── CARD 2: Pool Sources ────────────────────────────────── */}
      <Card 
        icon="📥" 
        title="Pool-Sourced Lead Sources" 
        description="Lead source values that route through the admin queue instead of going straight to a broker. Sources NOT listed here are treated as broker-created (broker who entered the lead owns it)."
      >
        {/* Preset grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 8,
          marginBottom: 16,
        }}>
          {PRESET_SOURCES.map(src => {
            const selected = isSourceSelected(src.id);
            return (
              <div
                key={src.id}
                onClick={() => toggleSource(src.id)}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: "10px 12px",
                  border: `1.5px solid ${selected ? "#C9A84C" : "#E5E9EF"}`,
                  borderRadius: 10,
                  background: selected ? "rgba(201, 168, 76, 0.08)" : "#fff",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                <div style={{
                  width: 16,
                  height: 16,
                  borderRadius: 4,
                  border: `1.5px solid ${selected ? "#C9A84C" : "#D1D9E6"}`,
                  background: selected ? "#C9A84C" : "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  marginTop: 2,
                }}>
                  {selected && (
                    <svg width="10" height="10" viewBox="0 0 11 11" fill="none">
                      <path d="M1.5 5.5L4 8L9.5 2.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#0F2540", marginBottom: 2 }}>
                    {src.label}
                  </div>
                  <div style={{ fontSize: 11, color: "#6B7785", lineHeight: 1.4 }}>
                    {src.description}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Custom source input */}
        <div style={{
          marginTop: 8,
          padding: 14,
          background: "#FAFBFC",
          borderRadius: 10,
          border: "1px dashed #D1D9E6",
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#0F2540", marginBottom: 8 }}>
            ➕ Custom Source
          </div>
          <div style={{ fontSize: 11, color: "#6B7785", marginBottom: 10 }}>
            Add a source not in the list above. Use lowercase with underscores (e.g., "q3_mall_campaign").
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              value={customSource}
              onChange={(e) => setCustomSource(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCustomSource()}
              placeholder="e.g. q3_mall_campaign"
              style={{ ...inputStyle, flex: 1 }}
            />
            <button
              onClick={addCustomSource}
              disabled={!customSource.trim()}
              style={{
                padding: "10px 16px",
                background: customSource.trim() ? "#0F2540" : "#F0F2F5",
                color: customSource.trim() ? "#fff" : "#9CA3AF",
                border: "none",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                cursor: customSource.trim() ? "pointer" : "not-allowed",
              }}
            >
              + Add
            </button>
          </div>
          {customSources.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
              {customSources.map(s => (
                <CustomChip key={s} label={s} onRemove={() => toggleSource(s)} />
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* ── CARD 3: Stale Lead Detection ────────────────────────── */}
      <Card 
        icon="⏱️" 
        title="Stale Lead Detection" 
        description="A lead is 'stale' if no activity happens for a configured period. Stale detection prevents leads from being silently abandoned."
      >
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 18 }}>
          <div style={{ flex: "0 0 auto" }}>
            <Label>Threshold (days)</Label>
            <input
              type="number"
              min={1}
              max={90}
              value={form.stale_lead_threshold_days}
              onChange={(e) => setForm(f => ({ ...f, stale_lead_threshold_days: parseInt(e.target.value) || 1 }))}
              style={{ ...inputStyle, width: 110 }}
            />
            <div style={{ fontSize: 11, color: "#6B7785", marginTop: 4 }}>
              Between 1–90 days
            </div>
          </div>
        </div>
        
        <Label>Action on Stale</Label>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
          {STALE_ACTIONS.map(act => {
            const selected = form.stale_action === act.id;
            return (
              <div
                key={act.id}
                onClick={() => setForm(f => ({ ...f, stale_action: act.id }))}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  padding: "12px 14px",
                  border: `1.5px solid ${selected ? "#C9A84C" : "#E5E9EF"}`,
                  borderRadius: 10,
                  background: selected ? "rgba(201, 168, 76, 0.08)" : "#fff",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                <div style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  border: `2px solid ${selected ? "#C9A84C" : "#D1D9E6"}`,
                  background: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  marginTop: 2,
                }}>
                  {selected && (
                    <div style={{ width: 9, height: 9, borderRadius: "50%", background: "#C9A84C" }} />
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#0F2540", marginBottom: 2 }}>
                    {act.label}
                  </div>
                  <div style={{ fontSize: 12, color: "#6B7785", lineHeight: 1.4 }}>
                    {act.description}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* ── FOOTER: Save / Reset (sticky) ────────────────────────── */}
      <div style={{
        position: "sticky",
        bottom: 0,
        marginTop: 20,
        padding: "16px 20px",
        background: "#fff",
        borderRadius: 12,
        boxShadow: "0 -2px 12px rgba(15,37,64,0.08)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
      }}>
        <div style={{ fontSize: 12, color: isDirty ? "#C9A84C" : "#6B7785", fontWeight: isDirty ? 700 : 500 }}>
          {isDirty ? "⚠️ Unsaved changes" : "✓ All changes saved"}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={handleReset}
            disabled={!isDirty || saving}
            style={{
              padding: "10px 18px",
              background: "#fff",
              color: "#0F2540",
              border: "1.5px solid #D1D9E6",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
              cursor: (!isDirty || saving) ? "not-allowed" : "pointer",
              opacity: (!isDirty || saving) ? 0.5 : 1,
            }}
          >
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={!isDirty || saving}
            style={{
              padding: "10px 24px",
              background: (!isDirty || saving) ? "#9CA3AF" : "#0F2540",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
              cursor: (!isDirty || saving) ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components & styles ────────────────────────────────────

function Card({ icon, title, description, children }) {
  return (
    <div style={{
      background: "#fff",
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      boxShadow: "0 2px 8px rgba(15,37,64,0.06)",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
        <div style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: "rgba(201, 168, 76, 0.12)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18,
          flexShrink: 0,
        }}>
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0F2540", margin: 0, marginBottom: 4 }}>
            {title}
          </h3>
          <div style={{ fontSize: 12, color: "#6B7785", lineHeight: 1.5 }}>
            {description}
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}

function Label({ children }) {
  return (
    <div style={{
      fontSize: 12,
      fontWeight: 700,
      color: "#0F2540",
      marginBottom: 6,
      letterSpacing: "0.3px",
    }}>
      {children}
    </div>
  );
}

function CustomChip({ label, onRemove }) {
  return (
    <div style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "5px 6px 5px 10px",
      background: "#0F2540",
      color: "#fff",
      borderRadius: 6,
      fontSize: 12,
      fontWeight: 600,
    }}>
      <span style={{ fontFamily: "monospace", fontSize: 11 }}>{label}</span>
      <button
        onClick={onRemove}
        style={{
          background: "rgba(255,255,255,0.2)",
          border: "none",
          color: "#fff",
          width: 16,
          height: 16,
          borderRadius: 4,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          padding: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}

const inputStyle = {
  padding: "10px 12px",
  border: "1.5px solid #D1D9E6",
  borderRadius: 8,
  fontSize: 13,
  color: "#0F2540",
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

const selectStyle = {
  ...inputStyle,
  width: "100%",
  background: "#fff",
  appearance: "none",
  cursor: "pointer",
};

const hintTextStyle = {
  fontSize: 12,
  color: "#B45309",
  marginTop: 8,
  padding: "8px 12px",
  background: "#FEF3C7",
  borderRadius: 6,
  border: "1px solid #FCD34D",
};
