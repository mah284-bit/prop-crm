import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase.js";
import { FALLBACK, clearFeeCache } from "../../lib/feeSettings.js";

// Day 78: the company's BUYER FEE POLICY - what the buyer pays.
// Distinct from Commission Defaults (what the brokerage EARNS). Founder: brokerages charge
// according to the government fees they pay, and some add their admin cost on top - this screen
// is that freedom. Blank means "use the standard".
export default function BuyerFeesSection({ currentUser, showToast, canEdit }) {
  const [form, setForm] = useState({ spa: "", oqood: "", reservation: "", dld: "" });
  const [saved, setSaved] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { (async () => {
    const { data } = await supabase.from("companies")
      .select("default_spa_fee, default_oqood_fee, default_reservation_fee, default_dld_pct, fees_updated_at")
      .eq("id", currentUser.company_id).maybeSingle();
    setSaved(data || null);
    setForm({
      spa: data?.default_spa_fee != null ? String(data.default_spa_fee) : "",
      oqood: data?.default_oqood_fee != null ? String(data.default_oqood_fee) : "",
      reservation: data?.default_reservation_fee != null ? String(data.default_reservation_fee) : "",
      dld: data?.default_dld_pct != null ? String(data.default_dld_pct) : "",
    });
    setLoading(false);
  })(); }, [currentUser.company_id]);

  const save = async () => {
    setSaving(true);
    const n = (v) => (String(v).trim() === "" ? null : Number(v));
    const { error } = await supabase.from("companies").update({
      default_spa_fee: n(form.spa),
      default_oqood_fee: n(form.oqood),
      default_reservation_fee: n(form.reservation),
      default_dld_pct: n(form.dld),
      fees_updated_at: new Date().toISOString(),
    }).eq("id", currentUser.company_id);
    setSaving(false);
    if (error) { showToast(error.message, "error"); return; }
    clearFeeCache(currentUser.company_id);
    showToast("Buyer fee policy saved", "success");
    setSaved({ ...saved, default_spa_fee: n(form.spa), default_oqood_fee: n(form.oqood),
               default_reservation_fee: n(form.reservation), default_dld_pct: n(form.dld),
               fees_updated_at: new Date().toISOString() });
  };

  const fmt = (v) => "AED " + Number(v || 0).toLocaleString();
  const lbl = { display: "block", fontSize: 13, fontWeight: 600, color: "#0F2540", marginBottom: 6 };
  const inp = { width: 200, padding: "9px 11px", border: "1px solid #D1D5DB", borderRadius: 8, fontSize: 14 };
  const hint = { fontSize: 11, color: "#94A3B8", marginTop: 4 };

  if (loading) return <div style={{ color: "#94A3B8", fontSize: 13 }}>Loading fee policy...</div>;

  const rows = [
    ["reservation", "Reservation fee", fmt(FALLBACK.reservationFee), "", "What the buyer pays to reserve a unit. A block expects this multiplied by the number of units."],
    ["spa", "SPA fee", fmt(FALLBACK.spaFee), "", "Charged at SPA. Set your figure including any admin uplift."],
    ["oqood", "Oqood fee", fmt(FALLBACK.oqoodFee), "", "Off-plan registration fee."],
    ["dld", "DLD fee", FALLBACK.dldPct + "%", "% of the sale price", "Dubai Land Department transfer fee. Who pays it (buyer / developer / split) is decided per deal."],
  ];

  return (
    <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 2px 8px rgba(15,37,64,0.06)" }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: "#0F2540", margin: "0 0 4px" }}>Buyer Fees</h2>
      <div style={{ fontSize: 13, color: "#64748B", marginBottom: 6 }}>
        What the BUYER pays - government fees and whatever admin cost your brokerage adds on top.
        Separate from Commission Defaults, which is what the brokerage earns.
      </div>
      <div style={{ fontSize: 12, color: "#94A3B8", marginBottom: 20 }}>
        These become the expected amounts on every deal ledger. A broker can still adjust an
        individual deal; this is the standard he starts from.
      </div>

      {rows.map(([id, label, standard, suffix, note]) => (
        <div key={id} style={{ marginBottom: 20 }}>
          <label style={lbl}>{label}</label>
          <input type="number" value={form[id]} disabled={!canEdit}
            onChange={e => setForm(f => ({ ...f, [id]: e.target.value }))}
            placeholder={"standard: " + standard} style={inp} />
          {suffix && <span style={{ marginLeft: 8, fontSize: 13, color: "#64748B" }}>{suffix}</span>}
          <div style={hint}>{note}</div>
          {String(form[id]).trim() === "" &&
            <div style={{ fontSize: 11, color: "#B45309", marginTop: 3 }}>Not set - using the standard {standard}</div>}
        </div>
      ))}

      {saved?.fees_updated_at &&
        <div style={{ fontSize: 11, color: "#94A3B8", marginBottom: 14 }}>
          Last updated {new Date(saved.fees_updated_at).toLocaleString("en-GB")}
        </div>}

      {canEdit ? (
        <button onClick={save} disabled={saving}
          style={{ padding: "10px 22px", borderRadius: 9, border: "none", background: "#0F2540",
                   color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
          {saving ? "Saving..." : "Save fee policy"}
        </button>
      ) : (
        <div style={{ fontSize: 12, color: "#94A3B8" }}>Only an administrator can change the fee policy.</div>
      )}
    </div>
  );
}
