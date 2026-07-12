import React, { useState } from "react";
import UnitSearchPicker from "../UnitSearchPicker.jsx";
import UnitSaturationInline from "./UnitSaturationInline.jsx";
import { analyzeUnitSaturation } from "../../lib/unitSaturationAnalyzer.js";

/**
 * OpportunityForm — Consolidated form for all opp creation/edit contexts
 * 
 * Props:
 * - mode: "create-from-lead" | "create-standalone" | "edit"
 * - lead: (optional) pre-filled lead context
 * - opp: (optional) existing opp for edit mode
 * - onSubmit: (formData) => void
 * - onCancel: () => void
 */
export default function OpportunityForm({
  mode = "create-standalone",
  lead = null,
  opp = null,
  units = [],
  projects = [],
  salePricing = [],
  users = [],
  opps = [],
  currentUser,
  onSubmit,
  onCancel,
}) {
  const [form, setForm] = useState({
    title: opp?.title || "",
    unit_id: opp?.unit_id || "",
    budget: opp?.budget || "",
    assigned_to: opp?.assigned_to || currentUser?.id || "",
    notes: opp?.notes || "",
    property_category: opp?.property_category || "Off-Plan",
  });

  const handleChange = (field, value) => {
    setForm(f => ({ ...f, [field]: value }));
  };

  const handleUnitSelect = (unitId) => {
    setForm(f => ({ ...f, unit_id: unitId }));
  };

  const handleSubmit = () => {
    if (!form.title.trim()) {
      alert("Title required");
      return;
    }
    onSubmit(form);
  };

  const selectedUnit = units.find(u => u.id === form.unit_id);
  const [saturation, setSaturation] = useState(null);
  useEffect(() => {
    if (!form.unit_id) return;
    (async () => {
      const sat = await analyzeUnitSaturation(form.unit_id, currentUser?.id, supabase);
      setSaturation(sat);
    })();
  }, [form.unit_id, currentUser?.id]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Lead context (if provided) */}
      {lead && mode !== "edit" && (
        <div style={{ padding: 8, background: "#E6EFF9", borderLeft: "3px solid #1A5FA8", borderRadius: 4, fontSize: 11 }}>
          <strong>For:</strong> {lead.name} · {lead.phone}
        </div>
      )}

      {/* Title */}
      <div>
        <label style={{ fontSize: 10, fontWeight: 600, color: "#4A5568", display: "block", marginBottom: 4, textTransform: "uppercase" }}>
          Title
        </label>
        <input
          type="text"
          value={form.title}
          onChange={(e) => handleChange("title", e.target.value)}
          placeholder="e.g., AGR-05-01 for Shrikant"
          style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #E2E8F0", fontSize: 12 }}
        />
      </div>

      {/* Property Category */}
      <div>
        <label style={{ fontSize: 10, fontWeight: 600, color: "#4A5568", display: "block", marginBottom: 4, textTransform: "uppercase" }}>
          Property Category
        </label>
        <select
          value={form.property_category}
          onChange={(e) => handleChange("property_category", e.target.value)}
          style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #E2E8F0", fontSize: 12 }}
        >
          <option value="Off-Plan">Off-Plan</option>
          <option value="Ready">Ready</option>
          <option value="Resale">Resale</option>
        </select>
      </div>

      {/* Budget */}
      <div>
        <label style={{ fontSize: 10, fontWeight: 600, color: "#4A5568", display: "block", marginBottom: 4, textTransform: "uppercase" }}>
          Budget (AED)
        </label>
        <input
          type="number"
          value={form.budget}
          onChange={(e) => handleChange("budget", e.target.value)}
          placeholder="e.g., 2500000"
          style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #E2E8F0", fontSize: 12 }}
        />
      </div>

      {/* Unit Selection */}
      <div>
        <label style={{ fontSize: 10, fontWeight: 600, color: "#4A5568", display: "block", marginBottom: 4, textTransform: "uppercase" }}>
          Linked Unit (optional)
        </label>
        {selectedUnit && (
          <div style={{ padding: "8px 12px", background: "#F0F9FF", border: "1px solid #BAE6FD", borderRadius: 6, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <strong style={{ color: "#0C4A6E", fontSize: 11 }}>{selectedUnit.unit_ref}</strong>
              <span style={{ fontSize: 10, color: "#0369A1", marginLeft: 6 }}>· {selectedUnit.bedrooms}BR · {projects.find(p => p.id === selectedUnit.project_id)?.name}</span>
            </div>
            <button type="button" onClick={() => handleChange("unit_id", "")} style={{ padding: "2px 8px", borderRadius: 4, border: "none", background: "#E2E8F0", color: "#64748B", fontSize: 9, fontWeight: 700, cursor: "pointer" }}>
              ✕ Clear
            </button>
          </div>
        )}
        <UnitSearchPicker
          units={units}
          projects={projects}
          salePricing={salePricing}
          onSelect={handleUnitSelect}
          placeholder="🔍 Search unit..."
          maxHeight={140}
        />
        {saturation && <UnitSaturationInline saturation={saturation} />}
      </div>

      {/* Assigned Agent */}
      <div>
        <label style={{ fontSize: 10, fontWeight: 600, color: "#4A5568", display: "block", marginBottom: 4, textTransform: "uppercase" }}>
          Assigned Agent
        </label>
        <select
          value={form.assigned_to}
          onChange={(e) => handleChange("assigned_to", e.target.value)}
          style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #E2E8F0", fontSize: 12 }}
        >
          <option value="">— Unassigned —</option>
          {users.map(u => (
            <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
          ))}
        </select>
      </div>

      {/* Notes */}
      <div>
        <label style={{ fontSize: 10, fontWeight: 600, color: "#4A5568", display: "block", marginBottom: 4, textTransform: "uppercase" }}>
          Notes
        </label>
        <textarea
          value={form.notes}
          onChange={(e) => handleChange("notes", e.target.value)}
          placeholder="Any notes about this opportunity..."
          rows={3}
          style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #E2E8F0", fontSize: 12, fontFamily: "inherit", resize: "none" }}
        />
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={handleSubmit} style={{ flex: 1, padding: "10px 16px", borderRadius: 6, border: "none", background: "#0F2540", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          {mode === "edit" ? "Save Changes" : "Create Opportunity"}
        </button>
        <button onClick={onCancel} style={{ flex: 1, padding: "10px 16px", borderRadius: 6, border: "1px solid #E2E8F0", background: "#fff", color: "#475569", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}
