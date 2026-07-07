import { useState } from "react";

/*
   AppConfigSection — Phase 2 settings consolidation
   Migrated from legacy SettingsTab (was Users > Settings subtab).
   CRM Mode is LIVE/load-bearing: App.jsx MODE_TABS[cfg.mode] drives which tabs show.
   Company Name + Currency are white-label stubs (not yet fully wired app-wide) — surfaced here for future wiring.
*/
export default function AppConfigSection({ appConfig, onConfigChange, showToast }) {
  const cfg = appConfig || {};
  const [form, setForm] = useState({
    mode:     cfg.mode     || "both",
    company:  cfg.company  || "PropCRM",
    currency: cfg.currency || "AED",
    country:  cfg.country  || "UAE",
  });
  const [saved, setSaved] = useState(false);

  const save = () => {
    onConfigChange(form);
    setSaved(true);
    if (showToast) showToast("App configuration saved");
    setTimeout(() => setSaved(false), 2000);
  };

  const lbl = { fontSize: 11, fontWeight: 600, color: "#4A5568", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: ".5px" };
  const inp = { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #D1D9E6", fontSize: 13, background: "#fff" };

  return (
    <div style={{ maxWidth: 520 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

        <div>
          <label style={lbl}>CRM Mode</label>
          <select value={form.mode} onChange={e => setForm(f => ({ ...f, mode: e.target.value }))} style={inp}>
            <option value="both">Sales &amp; Leasing (both)</option>
            <option value="sales">Sales only</option>
            <option value="leasing">Leasing only</option>
          </select>
          <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 4 }}>Controls which modules appear in the top navigation.</div>
        </div>

        <div>
          <label style={lbl}>Company Name</label>
          <input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} style={inp} />
          <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 4 }}>White-label app name (full app-wide wiring is a later step).</div>
        </div>

        <div>
          <label style={lbl}>Currency</label>
          <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} style={inp}>
            <option value="AED">AED — UAE Dirham</option>
            <option value="SAR">SAR — Saudi Riyal</option>
            <option value="USD">USD — US Dollar</option>
          </select>
          <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 4 }}>Display currency (full app-wide wiring is a later step).</div>
        </div>

        <div>
          <button onClick={save} style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: "#0F2540", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", alignSelf: "flex-start" }}>
            {saved ? "✓ Saved" : "Save configuration"}
          </button>
        </div>

      </div>
    </div>
  );
}
