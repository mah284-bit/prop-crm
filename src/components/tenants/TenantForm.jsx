import { useState } from "react";
import { supabase } from "../../lib/supabase.js";
import { PHONE_FORMATS } from "../../lib/phoneFormats.js";

// Day 102: ONE TENANT FORM.
//
// There were two, and they disagreed. The one on the Leads screen offered "Trade License" as an ID
// type and had no WhatsApp field; the one under Prop. Mgmt offered "Residency Visa" instead and had
// no Notes. So a company tenant added from one place could not record its licence, and a tenant
// added from the other could not have a WhatsApp number - for the same record, in the same table.
// Founder: "both should call one form - easier to make a new one and remove both."
//
// ⚠️ AND THE PHONE FIX IS BUILT IN. The old forms validated the phone against the NATIONALITY: pick
// Indian and it demanded +91. But an Indian tenant living in Dubai has a UAE number, and so does
// most of this market - that is the point of the market. NATIONALITY is who he is; PHONE COUNTRY is
// its own selector, defaulting to UAE, and validation follows that.
//
// The table carries three generations of identity columns and only the GENERIC set is live: all 13
// rows have id_type + id_number, and every specific column (emirates_id, passport_no,
// trade_license_no) is empty. This writes the live set only.

const COUNTRIES = ["UAE", "Saudi Arabia", "India", "UK", "Pakistan", "Egypt", "Jordan", "USA", "Russia", "China", "Philippines", "Other"];

const ID_TYPES = {
  Individual: ["Emirates ID", "Passport", "Residency Visa"],
  Company: ["Trade License"],
};

const blank = {
  full_name: "", tenant_type: "Individual", nationality: "",
  phone_country: "UAE", phone: "", whatsapp_same: true, whatsapp: "", email: "",
  id_type: "Emirates ID", id_number: "", id_expiry: "", notes: "",
};

// Digits only, then the country's prefix - so a broker can type "501234567" or "+971 50 123 4567"
// and both land the same way.
function composePhone(country, local) {
  const raw = String(local || "").trim();
  if (!raw) return "";
  const fmt = PHONE_FORMATS[country];
  if (!fmt) return raw;
  if (raw.startsWith("+")) return raw;
  const digits = raw.replace(/\D/g, "").replace(/^0+/, "");
  return digits ? fmt.prefix + digits : "";
}

export default function TenantForm({ currentUser, showToast, tenant = null, onSaved, onClose }) {
  const [f, setF] = useState(() => {
    if (!tenant) return blank;
    return {
      ...blank,
      ...tenant,
      phone_country: "UAE",
      phone: tenant.phone || "",
      whatsapp_same: !tenant.whatsapp || tenant.whatsapp === tenant.phone,
      whatsapp: tenant.whatsapp || "",
      id_expiry: tenant.id_expiry || "",
      notes: tenant.notes || "",
    };
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState({});

  const set = (k) => (e) => {
    const v = e?.target ? (e.target.type === "checkbox" ? e.target.checked : e.target.value) : e;
    setF((p) => {
      const next = { ...p, [k]: v };
      // Switching type changes what identity documents make sense.
      if (k === "tenant_type") next.id_type = ID_TYPES[v][0];
      return next;
    });
    setErr((p) => ({ ...p, [k]: "" }));
  };

  const save = async () => {
    const e = {};
    if (!f.full_name.trim()) e.full_name = "A name is required";
    const phone = composePhone(f.phone_country, f.phone);
    if (f.phone && PHONE_FORMATS[f.phone_country] && !PHONE_FORMATS[f.phone_country].pattern.test(phone)) {
      e.phone = "Does not look like a " + f.phone_country + " number";
    }
    if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) e.email = "Check the email";
    setErr(e);
    if (Object.keys(e).length) return;

    setSaving(true);
    const payload = {
      full_name: f.full_name.trim(),
      tenant_type: f.tenant_type,
      nationality: f.nationality || null,
      phone: phone || null,
      whatsapp: (f.whatsapp_same ? phone : composePhone(f.phone_country, f.whatsapp)) || null,
      email: f.email.trim() || null,
      id_type: f.id_type,
      id_number: f.id_number.trim() || null,
      id_expiry: f.id_expiry || null,
      notes: f.notes.trim() || null,
      company_id: currentUser.company_id,
      is_active: true,
    };
    let res;
    if (tenant?.id) res = await supabase.from("tenants").update(payload).eq("id", tenant.id).select().single();
    else res = await supabase.from("tenants").insert({ ...payload, created_by: currentUser.id }).select().single();
    setSaving(false);
    if (res.error) { showToast?.("Could not save: " + res.error.message, "error"); return; }
    showToast?.(f.full_name + (tenant?.id ? " updated" : " added"), "success");
    onSaved?.(res.data);
    onClose?.();
  };

  const L = { fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: ".5px", display: "block", marginBottom: 4 };
  const I = (bad) => ({ width: "100%", padding: "8px 10px", border: "1px solid " + (bad ? "#FCA5A5" : "#D1D5DB"), borderRadius: 7, fontSize: 13, boxSizing: "border-box" });
  const E = ({ m }) => m ? <div style={{ fontSize: 10.5, color: "#B91C1C", marginTop: 3 }}>{m}</div> : null;
  const Row = ({ children }) => <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>{children}</div>;

  return (
    <div style={{ maxWidth: 560 }}>
      <Row>
        <div>
          <label style={L}>Full name *</label>
          <input value={f.full_name} onChange={set("full_name")} style={I(err.full_name)} autoFocus />
          <E m={err.full_name} />
        </div>
        <div>
          <label style={L}>Type</label>
          <select value={f.tenant_type} onChange={set("tenant_type")} style={I()}>
            <option>Individual</option>
            <option>Company</option>
          </select>
        </div>
      </Row>

      <Row>
        <div>
          <label style={L}>Nationality</label>
          <select value={f.nationality} onChange={set("nationality")} style={I()}>
            <option value="">Select&hellip;</option>
            {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 3 }}>Who he is, not where his phone is.</div>
        </div>
        <div>
          <label style={L}>Email</label>
          <input value={f.email} onChange={set("email")} placeholder="name@example.com" style={I(err.email)} />
          <E m={err.email} />
        </div>
      </Row>

      {/* ⚠️ Phone country is SEPARATE from nationality - most tenants here hold a UAE number
          whatever their passport says. */}
      <div style={{ marginBottom: 12 }}>
        <label style={L}>Phone</label>
        <div style={{ display: "flex", gap: 8 }}>
          <select value={f.phone_country} onChange={set("phone_country")} style={{ ...I(), width: 150 }}>
            {Object.keys(PHONE_FORMATS).map((c) => <option key={c} value={c}>{c + " " + PHONE_FORMATS[c].prefix}</option>)}
          </select>
          <input value={f.phone} onChange={set("phone")} placeholder={PHONE_FORMATS[f.phone_country]?.example || ""} style={I(err.phone)} />
        </div>
        <E m={err.phone} />
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#475569", marginTop: 7 }}>
          <input type="checkbox" checked={f.whatsapp_same} onChange={set("whatsapp_same")} />
          WhatsApp is the same number
        </label>
        {!f.whatsapp_same && (
          <input value={f.whatsapp} onChange={set("whatsapp")} placeholder="WhatsApp number" style={{ ...I(), marginTop: 6 }} />
        )}
      </div>

      <Row>
        <div>
          <label style={L}>{f.tenant_type === "Company" ? "Licence type" : "ID type"}</label>
          <select value={f.id_type} onChange={set("id_type")} style={I()}>
            {ID_TYPES[f.tenant_type].map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label style={L}>{f.id_type} number</label>
          <input value={f.id_number} onChange={set("id_number")} placeholder={f.id_type === "Emirates ID" ? "784-XXXX-XXXXXXX-X" : ""} style={I()} />
        </div>
      </Row>

      <Row>
        <div>
          <label style={L}>Expires</label>
          <input type="date" value={f.id_expiry} onChange={set("id_expiry")} style={I()} />
        </div>
        <div />
      </Row>

      <div style={{ marginBottom: 14 }}>
        <label style={L}>Notes</label>
        <textarea value={f.notes} onChange={set("notes")} rows={2} style={{ ...I(), resize: "vertical", fontFamily: "inherit" }} />
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button onClick={onClose} style={{ padding: "8px 16px", borderRadius: 8, border: "1.5px solid #E2E8F0", background: "#fff", color: "#475569", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
        <button onClick={save} disabled={saving} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#0F2540", color: "#fff", fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer" }}>
          {saving ? "Saving\u2026" : (tenant?.id ? "Save changes" : "Add tenant")}
        </button>
      </div>
    </div>
  );
}
