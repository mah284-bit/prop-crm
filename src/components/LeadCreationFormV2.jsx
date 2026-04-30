// src/components/LeadCreationFormV2.jsx
//
// Sprint 1 / Phase A.3 — new lead creation form.
//
// Self-contained component. Side-by-side with the existing form (old form
// untouched). Renders buyer-type-aware fields: as the user picks a buyer
// type, fields show/hide/become required dynamically.
//
// On mount: fetches /api/reference/countries and /api/reference/buyer-type-rules
//   once, populates dropdowns and validation rules.
// On submit: POSTs to /api/leads with the user's Supabase JWT.
//   Returns the created lead via onCreated().
//
// Dependencies: React 19. Phone validation is plain E.164 regex.
// No direct Supabase client — parent provides onSubmit(payload) callback
// to perform the actual database write. Keeps this component portable.

import React, { useEffect, useMemo, useState } from "react";

// IMPORTANT: This component does NOT import supabase directly. The parent
// (App.jsx) handles all data persistence via the `onSubmit` prop. This
// avoids the multiple-GoTrueClient warning and makes the form storage-agnostic.

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

const BUYER_TYPE_LABELS = {
  local_national: "Local national (UAE/GCC citizen)",
  gcc_resident_expat: "Expat with GCC residency",
  international_non_resident: "International (non-resident)",
  corporate: "Corporate / company purchase",
};

const SOURCE_OF_FUNDS_OPTIONS = [
  { value: "salary", label: "Salary" },
  { value: "business_income", label: "Business income" },
  { value: "investment_returns", label: "Investment returns" },
  { value: "inheritance", label: "Inheritance" },
  { value: "loan_mortgage", label: "Loan / mortgage" },
  { value: "sale_of_property", label: "Sale of another property" },
  { value: "other", label: "Other" },
];

// ----------------------------------------------------------------------------
// Styles (inline to match the rest of your app)
// ----------------------------------------------------------------------------

const styles = {
  modal: {
    position: "fixed", inset: 0, background: "rgba(15,37,64,0.55)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 1000, padding: 20,
  },
  panel: {
    background: "#fff", borderRadius: 12, width: "100%", maxWidth: 720,
    maxHeight: "92vh", overflow: "auto", boxShadow: "0 24px 80px rgba(0,0,0,0.25)",
    padding: 28,
  },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  h2: { margin: 0, fontSize: 18, color: "#0F2540", fontWeight: 700 },
  closeBtn: {
    background: "none", border: "none", fontSize: 22, color: "#C9A84C",
    cursor: "pointer", lineHeight: 1,
  },
  badgeRow: {
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "3px 10px", borderRadius: 999, background: "#FFF5DA",
    color: "#7A5C00", fontSize: 11, fontWeight: 600, marginBottom: 14,
  },
  fieldGroup: { marginBottom: 14 },
  label: { display: "block", fontSize: 12, color: "#0F2540", fontWeight: 600, marginBottom: 6 },
  required: { color: "#D14343", marginLeft: 4 },
  input: {
    width: "100%", padding: "9px 12px", borderRadius: 8, border: "1.5px solid #D1D9E6",
    fontSize: 13, fontFamily: "inherit", boxSizing: "border-box",
  },
  select: {
    width: "100%", padding: "9px 12px", borderRadius: 8, border: "1.5px solid #D1D9E6",
    fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", background: "#fff",
  },
  twoCol: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  hint: {
    fontSize: 11, color: "#5A6B85", marginTop: 4, fontStyle: "italic",
  },
  docHint: {
    background: "#EAF1FB", border: "1px solid #B8CFE8", borderRadius: 8,
    padding: "10px 12px", fontSize: 12, color: "#0F2540", marginTop: 8, marginBottom: 12,
  },
  errorBox: {
    background: "#FEE", border: "1px solid #F5A6A6", borderRadius: 8,
    padding: "10px 12px", fontSize: 12, color: "#A33", marginBottom: 12,
  },
  footer: {
    display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18,
    paddingTop: 16, borderTop: "1px solid #E8EDF4",
  },
  btnSecondary: {
    padding: "9px 18px", borderRadius: 8, border: "1.5px solid #D1D9E6",
    background: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
  },
  btnPrimary: (saving) => ({
    padding: "9px 24px", borderRadius: 8, border: "none",
    background: saving ? "#A0AEC0" : "#0F2540",
    color: "#fff", fontSize: 13, fontWeight: 600,
    cursor: saving ? "not-allowed" : "pointer",
  }),
  phoneRow: { display: "grid", gridTemplateColumns: "auto 1fr", gap: 8, alignItems: "center" },
  callingCodeBox: {
    padding: "9px 10px", borderRadius: 8, border: "1.5px solid #D1D9E6",
    background: "#F5F7FB", fontSize: 13, fontFamily: "monospace",
    minWidth: 60, textAlign: "center",
  },
};

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

/**
 * Props:
 *   - onSubmit   (required): async function (payload) => {lead} | throws Error
 *                            Parent handles the actual database write.
 *   - companyId  (required): the company_id this lead belongs to
 *   - onCancel   (required): called when user clicks Cancel or close
 *   - onCreated  (required): called with the created lead object on success
 *   - currentUserId (optional): for created_by / assigned_to
 */
export default function LeadCreationFormV2({ onSubmit, companyId, onCancel, onCreated, currentUserId }) {
  // Reference data (fetched once on mount)
  const [countries, setCountries] = useState([]);
  const [rules, setRules] = useState({});
  const [refLoading, setRefLoading] = useState(true);
  const [refError, setRefError] = useState("");

  // Form state
  const [buyerType, setBuyerType] = useState(""); // empty = no selection yet
  const [form, setForm] = useState({
    display_name: "",
    legal_name_en: "",
    legal_name_ar: "",
    nationality_iso2: "",
    residence_iso2: "",
    tax_residency_iso2: "",
    email: "",
    phone_country_code: "AE", // default to UAE
    phone_local: "",
    source_of_funds: "",
    pep_flag: false,
    notes: "",
  });

  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  // ----- Fetch reference data on mount -----
  useEffect(() => {
    let cancelled = false;
    async function loadRef() {
      setRefLoading(true);
      setRefError("");
      try {
        const [cRes, bRes] = await Promise.all([
          fetch("/api/reference/countries"),
          fetch("/api/reference/buyer-type-rules"),
        ]);
        if (!cRes.ok) throw new Error("Failed to load countries");
        if (!bRes.ok) throw new Error("Failed to load buyer-type rules");
        const cJson = await cRes.json();
        const bJson = await bRes.json();
        if (cancelled) return;
        setCountries(cJson.countries || []);
        setRules(bJson.rules || {});
      } catch (err) {
        if (!cancelled) setRefError(err.message || "Failed to load form data");
      } finally {
        if (!cancelled) setRefLoading(false);
      }
    }
    loadRef();
    return () => { cancelled = true; };
  }, []);

  // ----- Active rules for the chosen buyer type -----
  const activeRules = buyerType ? (rules[buyerType] || {}) : {};

  // Map buyer-type-rules field names → our form field names
  const fieldMap = {
    display_name: "display_name",
    legal_name_en: "legal_name_en",
    legal_name_ar: "legal_name_ar",
    nationality_country_code: "nationality_iso2",
    residence_country_code: "residence_iso2",
    phone_e164: "phone_local",  // we capture as country_code + local
    email: "email",
  };

  function fieldRequirement(ruleField) {
    if (!buyerType) return "optional";
    return activeRules[ruleField] || "optional";
  }

  function isVisible(ruleField) {
    return fieldRequirement(ruleField) !== "hidden";
  }

  function isRequired(ruleField) {
    return fieldRequirement(ruleField) === "required";
  }

  // ----- "You will need these documents" hint -----
  const requiredDocs = useMemo(() => {
    if (!buyerType || !activeRules) return [];
    const docFields = [
      ["emirates_id", "Emirates ID / national ID"],
      ["national_id", "National ID"],
      ["passport", "Passport"],
      ["residence_visa", "Residence visa"],
      ["address_proof", "Proof of address (utility bill / bank statement)"],
    ];
    return docFields
      .filter(([f]) => activeRules[f] === "required")
      .map(([, label]) => label);
  }, [buyerType, activeRules]);

  // ----- Helpers -----
  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
    setFieldErrors((e) => ({ ...e, [key]: undefined }));
  }

  function callingCodeForIso(iso) {
    const c = countries.find((x) => x.iso2 === iso);
    return c ? c.calling_code : "";
  }

  // Build the E.164 phone from country_code + local number
  function buildE164() {
    if (!form.phone_local) return null;
    const cc = callingCodeForIso(form.phone_country_code);
    if (!cc) return null;
    const stripped = String(form.phone_local).replace(/[^\d]/g, "");
    if (!stripped) return null;
    // Strip leading 0 (common UAE convention: 0501234567 → 501234567)
    const cleaned = stripped.startsWith("0") ? stripped.substring(1) : stripped;
    return `+${cc}${cleaned}`;
  }

  // ----- Client-side validation (before sending to server) -----
  function validate() {
    const errs = {};
    if (!form.display_name.trim()) errs.display_name = "Required";
    if (!buyerType) errs.buyer_type = "Required";

    if (buyerType) {
      for (const [ruleField, formField] of Object.entries(fieldMap)) {
        if (isRequired(ruleField)) {
          const value = ruleField === "phone_e164" ? buildE164() : form[formField];
          if (!value || (typeof value === "string" && !value.trim())) {
            errs[formField] = "Required";
          }
        }
      }
    }

    // Email format if provided
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errs.email = "Invalid email";
    }

    // Phone format: must produce a valid E.164 if user typed anything
    if (form.phone_local) {
      const e164 = buildE164();
      if (!e164 || !/^\+[1-9][0-9]{1,14}$/.test(e164)) {
        errs.phone_local = "Enter a valid phone number";
      }
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ----- Submit -----
  async function handleSubmit() {
    setSubmitError("");
    if (!validate()) {
      setSubmitError("Please fix the errors above.");
      return;
    }

    setSaving(true);
    try {
      // Build payload. The parent component (App.jsx) handles the actual
      // database write via the onSubmit prop. Keeps this component free of
      // any direct database client, fixes the multiple-GoTrueClient issue,
      // and makes V2 portable to any future storage backend.

      const phoneE164 = buildE164();

      const payload = {
        company_id: companyId,
        display_name: form.display_name.trim(),
        name: form.display_name.trim(), // mirror for legacy code that reads `name`
        buyer_type: buyerType,
        legal_name_en: form.legal_name_en.trim() || null,
        legal_name_ar: form.legal_name_ar.trim() || null,
        nationality_iso2: form.nationality_iso2 || null,
        residence_iso2: form.residence_iso2 || null,
        tax_residency_iso2: form.tax_residency_iso2 || null,
        email: form.email.trim() || null,
        phone_e164: phoneE164,
        phone_country_code: form.phone_country_code || null,
        phone: phoneE164, // mirror for legacy code paths that read `phone`
        source_of_funds: form.source_of_funds || null,
        pep_flag: !!form.pep_flag,
        notes: form.notes.trim() || null,
        ...(currentUserId ? { assigned_to: currentUserId, created_by: currentUserId } : {}),
      };

      if (typeof onSubmit !== "function") {
        setSubmitError("Form misconfigured: onSubmit callback missing.");
        setSaving(false);
        return;
      }

      let createdLead;
      try {
        createdLead = await onSubmit(payload);
      } catch (err) {
        setSubmitError(err?.message || "Failed to create lead");
        setSaving(false);
        return;
      }

      if (!createdLead) {
        setSubmitError("Failed to create lead (no result returned).");
        setSaving(false);
        return;
      }

      // Success
      onCreated && onCreated(createdLead);
    } catch (err) {
      setSubmitError(err.message || "Network error");
    } finally {
      setSaving(false);
    }
  }

  // ----- Render -----

  if (refLoading) {
    return (
      <div style={styles.modal}>
        <div style={styles.panel}>
          <div style={styles.header}>
            <h2 style={styles.h2}>Add Contact (V2)</h2>
            <button onClick={onCancel} style={styles.closeBtn}>×</button>
          </div>
          <p>Loading form…</p>
        </div>
      </div>
    );
  }

  if (refError) {
    return (
      <div style={styles.modal}>
        <div style={styles.panel}>
          <div style={styles.header}>
            <h2 style={styles.h2}>Add Contact (V2)</h2>
            <button onClick={onCancel} style={styles.closeBtn}>×</button>
          </div>
          <div style={styles.errorBox}>{refError}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.modal}>
      <div style={styles.panel}>
        <div style={styles.header}>
          <h2 style={styles.h2}>Add Contact (V2)</h2>
          <button onClick={onCancel} style={styles.closeBtn}>×</button>
        </div>

        <div style={styles.badgeRow}>NEW · Sprint 1 form · buyer-type aware</div>

        {submitError && <div style={styles.errorBox}>{submitError}</div>}

        {/* Display name — always required */}
        <div style={styles.fieldGroup}>
          <label style={styles.label}>
            Display name<span style={styles.required}>*</span>
          </label>
          <input
            style={{ ...styles.input, borderColor: fieldErrors.display_name ? "#D14343" : "#D1D9E6" }}
            value={form.display_name}
            onChange={(e) => setField("display_name", e.target.value)}
            placeholder="Sales-facing name (e.g. Mohammed Al Mansoori)"
          />
          {fieldErrors.display_name && <div style={{ ...styles.hint, color: "#D14343" }}>{fieldErrors.display_name}</div>}
        </div>

        {/* Buyer type — drives the rest */}
        <div style={styles.fieldGroup}>
          <label style={styles.label}>
            Buyer type<span style={styles.required}>*</span>
          </label>
          <select
            style={{ ...styles.select, borderColor: fieldErrors.buyer_type ? "#D14343" : "#D1D9E6" }}
            value={buyerType}
            onChange={(e) => setBuyerType(e.target.value)}
          >
            <option value="">— Select —</option>
            {Object.keys(rules).map((bt) => (
              <option key={bt} value={bt}>{BUYER_TYPE_LABELS[bt] || bt}</option>
            ))}
          </select>
          {fieldErrors.buyer_type && <div style={{ ...styles.hint, color: "#D14343" }}>{fieldErrors.buyer_type}</div>}
          <div style={styles.hint}>Drives which fields and documents will be needed.</div>
        </div>

        {/* Required-documents hint */}
        {requiredDocs.length > 0 && (
          <div style={styles.docHint}>
            <strong>Documents you will need at the Reserved stage:</strong>
            <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
              {requiredDocs.map((d, i) => <li key={i}>{d}</li>)}
            </ul>
          </div>
        )}

        {/* Legal names — show based on rules */}
        {buyerType && (isVisible("legal_name_en") || isVisible("legal_name_ar")) && (
          <div style={styles.twoCol}>
            {isVisible("legal_name_en") && (
              <div style={styles.fieldGroup}>
                <label style={styles.label}>
                  Legal name (English)
                  {isRequired("legal_name_en") && <span style={styles.required}>*</span>}
                </label>
                <input
                  style={{ ...styles.input, borderColor: fieldErrors.legal_name_en ? "#D14343" : "#D1D9E6" }}
                  value={form.legal_name_en}
                  onChange={(e) => setField("legal_name_en", e.target.value)}
                  placeholder="Exactly as on passport / EID"
                />
                {fieldErrors.legal_name_en && <div style={{ ...styles.hint, color: "#D14343" }}>{fieldErrors.legal_name_en}</div>}
              </div>
            )}
            {isVisible("legal_name_ar") && (
              <div style={styles.fieldGroup}>
                <label style={styles.label}>
                  Legal name (Arabic)
                  {isRequired("legal_name_ar") && <span style={styles.required}>*</span>}
                </label>
                <input
                  style={{
                    ...styles.input,
                    borderColor: fieldErrors.legal_name_ar ? "#D14343" : "#D1D9E6",
                    direction: "rtl",
                  }}
                  value={form.legal_name_ar}
                  onChange={(e) => setField("legal_name_ar", e.target.value)}
                  placeholder="بالعربية"
                />
                {fieldErrors.legal_name_ar && <div style={{ ...styles.hint, color: "#D14343" }}>{fieldErrors.legal_name_ar}</div>}
              </div>
            )}
          </div>
        )}

        {/* Country fields */}
        {buyerType && (
          <div style={styles.twoCol}>
            {isVisible("nationality_country_code") && (
              <div style={styles.fieldGroup}>
                <label style={styles.label}>
                  Nationality
                  {isRequired("nationality_country_code") && <span style={styles.required}>*</span>}
                </label>
                <select
                  style={{ ...styles.select, borderColor: fieldErrors.nationality_iso2 ? "#D14343" : "#D1D9E6" }}
                  value={form.nationality_iso2}
                  onChange={(e) => setField("nationality_iso2", e.target.value)}
                >
                  <option value="">—</option>
                  {countries.map((c) => (
                    <option key={c.iso2} value={c.iso2}>
                      {c.flag_emoji} {c.name_en}
                    </option>
                  ))}
                </select>
                {fieldErrors.nationality_iso2 && <div style={{ ...styles.hint, color: "#D14343" }}>{fieldErrors.nationality_iso2}</div>}
              </div>
            )}
            {isVisible("residence_country_code") && (
              <div style={styles.fieldGroup}>
                <label style={styles.label}>
                  Residence
                  {isRequired("residence_country_code") && <span style={styles.required}>*</span>}
                </label>
                <select
                  style={{ ...styles.select, borderColor: fieldErrors.residence_iso2 ? "#D14343" : "#D1D9E6" }}
                  value={form.residence_iso2}
                  onChange={(e) => setField("residence_iso2", e.target.value)}
                >
                  <option value="">—</option>
                  {countries.map((c) => (
                    <option key={c.iso2} value={c.iso2}>
                      {c.flag_emoji} {c.name_en}
                    </option>
                  ))}
                </select>
                {fieldErrors.residence_iso2 && <div style={{ ...styles.hint, color: "#D14343" }}>{fieldErrors.residence_iso2}</div>}
              </div>
            )}
          </div>
        )}

        {/* Phone */}
        {buyerType && isVisible("phone_e164") && (
          <div style={styles.fieldGroup}>
            <label style={styles.label}>
              Phone
              {isRequired("phone_e164") && <span style={styles.required}>*</span>}
            </label>
            <div style={styles.phoneRow}>
              <select
                style={{ ...styles.select, width: "auto", minWidth: 110 }}
                value={form.phone_country_code}
                onChange={(e) => setField("phone_country_code", e.target.value)}
              >
                {countries.map((c) => (
                  <option key={c.iso2} value={c.iso2}>
                    {c.flag_emoji} +{c.calling_code}
                  </option>
                ))}
              </select>
              <input
                style={{ ...styles.input, borderColor: fieldErrors.phone_local ? "#D14343" : "#D1D9E6" }}
                value={form.phone_local}
                onChange={(e) => setField("phone_local", e.target.value)}
                placeholder="50 123 4567"
              />
            </div>
            {fieldErrors.phone_local && <div style={{ ...styles.hint, color: "#D14343" }}>{fieldErrors.phone_local}</div>}
            <div style={styles.hint}>Will be saved as: {buildE164() || "(enter number)"}</div>
          </div>
        )}

        {/* Email */}
        {buyerType && isVisible("email") && (
          <div style={styles.fieldGroup}>
            <label style={styles.label}>
              Email
              {isRequired("email") && <span style={styles.required}>*</span>}
            </label>
            <input
              type="email"
              style={{ ...styles.input, borderColor: fieldErrors.email ? "#D14343" : "#D1D9E6" }}
              value={form.email}
              onChange={(e) => setField("email", e.target.value)}
              placeholder="name@example.com"
            />
            {fieldErrors.email && <div style={{ ...styles.hint, color: "#D14343" }}>{fieldErrors.email}</div>}
          </div>
        )}

        {/* KYC extras (always optional at lead creation) */}
        {buyerType && (
          <>
            <div style={styles.twoCol}>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Tax residency (optional)</label>
                <select
                  style={styles.select}
                  value={form.tax_residency_iso2}
                  onChange={(e) => setField("tax_residency_iso2", e.target.value)}
                >
                  <option value="">— same as residence —</option>
                  {countries.map((c) => (
                    <option key={c.iso2} value={c.iso2}>
                      {c.flag_emoji} {c.name_en}
                    </option>
                  ))}
                </select>
              </div>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Source of funds (optional)</label>
                <select
                  style={styles.select}
                  value={form.source_of_funds}
                  onChange={(e) => setField("source_of_funds", e.target.value)}
                >
                  <option value="">—</option>
                  {SOURCE_OF_FUNDS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={styles.fieldGroup}>
              <label style={{ ...styles.label, display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={form.pep_flag}
                  onChange={(e) => setField("pep_flag", e.target.checked)}
                  style={{ width: 16, height: 16, cursor: "pointer" }}
                />
                Politically Exposed Person (PEP)
              </label>
              <div style={styles.hint}>Flag if buyer is a PEP. Triggers enhanced due diligence.</div>
            </div>
          </>
        )}

        {/* Notes */}
        <div style={styles.fieldGroup}>
          <label style={styles.label}>Notes</label>
          <textarea
            style={{ ...styles.input, minHeight: 60, resize: "vertical", fontFamily: "inherit" }}
            value={form.notes}
            onChange={(e) => setField("notes", e.target.value)}
            placeholder="Any context worth remembering"
          />
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <button onClick={onCancel} style={styles.btnSecondary} disabled={saving}>Cancel</button>
          <button onClick={handleSubmit} style={styles.btnPrimary(saving)} disabled={saving}>
            {saving ? "Saving…" : "Add Contact"}
          </button>
        </div>
      </div>
    </div>
  );
}
