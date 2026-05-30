// Phase 2.2B — Add/Edit Person modal for the Contacts Subsystem.
// Modal-based UX (not inline) — opens from Lead Detail's People section
// + button (Add mode) or per-row edit icon (Edit mode).
//
// Manages: name, role (non-buyer roles only), primary phone, primary email,
// relationship_notes. Saves to lead_persons + lead_person_contacts in a
// best-effort sequence (no transactions in supabase-js; uses defensive
// error handling).
//
// PRIMARY BUYER is intentionally NOT editable here — that's a future
// Phase 2.2C workflow (transfer-with-audit). This modal will never let
// role='buyer' be selected.

import React, { useState } from "react";
import { supabase } from "../lib/supabase";
import CountryPicker from "./CountryPicker.jsx";

const ROLE_OPTIONS = [
  { value: "spouse",         label: "Spouse" },
  { value: "representative", label: "Representative" },
  { value: "secretary",      label: "Secretary / EA" },
  { value: "accounts",       label: "Accounts / Finance" },
  { value: "manager",        label: "Manager / In-charge" },
  { value: "local_contact",  label: "Local Contact" },
  { value: "family",         label: "Family" },
  { value: "other",          label: "Other" },
];

export default function LeadPersonEditModal({
  leadId,
  companyId,
  currentUserId,
  person = null,   // null = Add mode, row = Edit mode
  countries = [],
  onClose,
  onSaved,
}) {
  const isEdit = !!person;

  // Helper: extract primary phone/email from existing person.contacts
  const getPrimary = (channel) => {
    if (!person?.contacts) return null;
    return person.contacts.find(
      (c) => c.channel === channel && c.is_primary_for_channel
    );
  };
  const existingPhone = getPrimary("phone");
  const existingEmail = getPrimary("email");

  const [form, setForm] = useState({
    name: person?.name || "",
    role: person?.role || "representative",
    relationship_notes: person?.relationship_notes || "",
    phone_country_code: existingPhone
      ? (countries.find((c) => "+" + c.calling_code === existingPhone.value.replace(/[0-9]/g, "").trim())?.iso2 || "AE")
      : "AE",
    phone_local: existingPhone
      ? existingPhone.value.replace(/^\+\d{1,4}/, "")
      : "",
    email: existingEmail?.value || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Build E.164 phone from country code + local digits
  function buildE164() {
    if (!form.phone_local.trim()) return null;
    const cc = countries.find((c) => c.iso2 === form.phone_country_code);
    if (!cc) return null;
    const digitsOnly = form.phone_local.replace(/[^\d]/g, "");
    if (!digitsOnly) return null;
    const cleaned = digitsOnly.startsWith("0") ? digitsOnly.substring(1) : digitsOnly;
    return `+${cc.calling_code}${cleaned}`;
  }

  async function handleSave() {
    setError("");
    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }
    setSaving(true);

    try {
      const phoneE164 = buildE164();
      const personPayload = {
        lead_id: leadId,
        company_id: companyId,
        name: form.name.trim(),
        role: form.role,
        is_primary_buyer: false, // never set true from this modal
        relationship_notes: form.relationship_notes.trim() || null,
      };
      if (!isEdit && currentUserId) personPayload.created_by = currentUserId;

      let personRow;
      if (isEdit) {
        const { data, error: e } = await supabase
          .from("lead_persons")
          .update(personPayload)
          .eq("id", person.id)
          .select()
          .single();
        if (e) throw e;
        personRow = data;
      } else {
        const { data, error: e } = await supabase
          .from("lead_persons")
          .insert(personPayload)
          .select()
          .single();
        if (e) throw e;
        personRow = data;
      }

      // ── Phone contact sync ────────────────────────────────────
      if (phoneE164) {
        if (existingPhone) {
          // UPDATE existing
          const { error: e } = await supabase
            .from("lead_person_contacts")
            .update({
              value: phoneE164,
              label: "Mobile",
              is_primary_for_channel: true,
            })
            .eq("id", existingPhone.id);
          if (e) throw e;
        } else {
          // INSERT new
          const { error: e } = await supabase
            .from("lead_person_contacts")
            .insert({
              person_id: personRow.id,
              company_id: companyId,
              channel: "phone",
              value: phoneE164,
              label: "Mobile",
              is_primary_for_channel: true,
            });
          if (e) throw e;
        }
      } else if (existingPhone) {
        // Removed phone → DELETE the existing record
        await supabase.from("lead_person_contacts").delete().eq("id", existingPhone.id);
      }

      // ── Email contact sync ────────────────────────────────────
      const emailTrimmed = form.email.trim();
      if (emailTrimmed) {
        if (existingEmail) {
          const { error: e } = await supabase
            .from("lead_person_contacts")
            .update({
              value: emailTrimmed,
              label: "Primary",
              is_primary_for_channel: true,
            })
            .eq("id", existingEmail.id);
          if (e) throw e;
        } else {
          const { error: e } = await supabase
            .from("lead_person_contacts")
            .insert({
              person_id: personRow.id,
              company_id: companyId,
              channel: "email",
              value: emailTrimmed,
              label: "Primary",
              is_primary_for_channel: true,
            });
          if (e) throw e;
        }
      } else if (existingEmail) {
        await supabase.from("lead_person_contacts").delete().eq("id", existingEmail.id);
      }

      onSaved && onSaved();
      onClose && onClose();
    } catch (e) {
      setError(e?.message || "Failed to save");
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!isEdit) return;
    if (!window.confirm(`Remove ${person.name} from this lead's contacts?`)) return;
    setSaving(true);
    try {
      const { error: e } = await supabase
        .from("lead_persons")
        .delete()
        .eq("id", person.id);
      if (e) throw e;
      onSaved && onSaved();
      onClose && onClose();
    } catch (e) {
      setError(e?.message || "Failed to delete");
      setSaving(false);
    }
  }

  const inputStyle = {
    width: "100%",
    padding: "9px 12px",
    border: "1.5px solid #D1D9E6",
    borderRadius: 8,
    fontSize: 13,
    fontFamily: "inherit",
    color: "#0F2540",
    background: "#fff",
    boxSizing: "border-box",
  };
  const labelStyle = {
    fontSize: 11,
    fontWeight: 600,
    color: "#4A5568",
    display: "block",
    marginBottom: 5,
    textTransform: "uppercase",
    letterSpacing: ".5px",
  };

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(11,31,58,.6)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1100,
      padding: "1rem",
    }}>
      <div style={{
        background: "#fff",
        borderRadius: 16,
        width: 520,
        maxWidth: "100%",
        maxHeight: "90vh",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 20px 60px rgba(11,31,58,.35)",
      }}>
        {/* Header */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "1rem 1.5rem",
          borderBottom: "1px solid #E8EDF4",
        }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0F2540" }}>
            {isEdit ? `Edit ${person.name}` : "Add Person"}
          </h2>
          <button onClick={onClose} disabled={saving}
            style={{ background: "none", border: "none", fontSize: 22, color: "#C9A84C", cursor: "pointer" }}>
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "1.25rem 1.5rem", overflowY: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Name *</label>
              <input
                style={inputStyle}
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                placeholder="Full name"
              />
            </div>

            <div>
              <label style={labelStyle}>Role *</label>
              <select
                style={inputStyle}
                value={form.role}
                onChange={(e) => setField("role", e.target.value)}
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                style={inputStyle}
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
                placeholder="optional"
              />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Phone</label>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ width: 140 }}>
                  <CountryPicker
                    countries={countries}
                    value={form.phone_country_code}
                    onChange={(iso2) => setField("phone_country_code", iso2)}
                    placeholder="+code"
                    variant="phone"
                  />
                </div>
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  value={form.phone_local}
                  onChange={(e) => setField("phone_local", e.target.value)}
                  placeholder="optional"
                  inputMode="tel"
                />
              </div>
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Notes</label>
              <textarea
                style={{ ...inputStyle, minHeight: 60, resize: "vertical" }}
                value={form.relationship_notes}
                onChange={(e) => setField("relationship_notes", e.target.value)}
                placeholder="e.g., wife of buyer, joint decision-maker on schools"
              />
            </div>
          </div>

          {error && (
            <div style={{
              marginTop: 12,
              padding: 10,
              borderRadius: 8,
              background: "#FED7D7",
              color: "#C53030",
              fontSize: 12,
            }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: "flex",
          gap: 10,
          justifyContent: "space-between",
          padding: "1rem 1.5rem",
          borderTop: "1px solid #E2E8F0",
        }}>
          <div>
            {isEdit && (
              <button onClick={handleDelete} disabled={saving}
                style={{
                  padding: "9px 18px",
                  borderRadius: 8,
                  border: "1.5px solid #FCA5A5",
                  background: "#fff",
                  color: "#C53030",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: saving ? "not-allowed" : "pointer",
                }}>
                Remove
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onClose} disabled={saving}
              style={{
                padding: "9px 18px",
                borderRadius: 8,
                border: "1.5px solid #D1D9E6",
                background: "#fff",
                fontSize: 13,
                fontWeight: 600,
                cursor: saving ? "not-allowed" : "pointer",
              }}>
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              style={{
                padding: "9px 24px",
                borderRadius: 8,
                border: "none",
                background: saving ? "#A0AEC0" : "#0F2540",
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
                cursor: saving ? "not-allowed" : "pointer",
              }}>
              {saving ? "Saving…" : isEdit ? "Save Changes" : "Add Person"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
