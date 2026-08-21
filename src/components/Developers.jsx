import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase.js";
import { clearFeeCache } from "../lib/feeSettings.js";
import { recordFeeChanges, getFeeHistory, describeChange } from "../lib/feeHistory.js";

// Day 96: WHAT EACH DEVELOPER CHARGES THE BUYER.
//
// The fee chain has four levels: frozen policy -> master agreement -> DEVELOPER RECORD -> company
// default. Day 93 put a developer's fees on the master agreement alone, and the founder caught the
// flaw: not every developer has one, and those deals then take the company's figures silently. Six
// Senses had already proved it - two deals invoiced at a company default nobody had agreed with
// anyone.
//
// So the developer record holds WHAT HE CHARGES EVERYONE, and the agreement holds WHAT WE
// NEGOTIATED WITH HIM. Two different facts, and until now neither could be set outside SQL: the
// columns existed on pp_developers since an earlier, abandoned attempt, and nothing ever wrote to
// them.
//
// ⚠️ BLANK AND ZERO ARE DIFFERENT ANSWERS. Blank means "we do not know his figure, use ours"; zero
// means "he charges nothing for this". A default of 0 on admin_fee_per_unit had to be dropped on
// Day 93 for exactly this reason - it made every developer read as charging nothing.

const FEES = [
  ["default_reservation_fee", "Reservation per unit", "AED", "What he asks to hold a unit."],
  ["default_spa_fee", "SPA fee", "AED", "Charged at signing."],
  ["default_oqood_fee", "Oqood fee", "AED", "Off-plan registration."],
  ["default_dld_pct", "DLD", "%", "Usually 4% across the market."],
  ["admin_fee_per_unit", "Admin fee per unit", "AED", "His own charge, per unit registered."],
];

const aed = (n) => (n === null || n === undefined || n === "" ? "—" : Number(n).toLocaleString());

export default function Developers({ currentUser, showToast }) {
  const [devs, setDevs] = useState([]);
  const [fees, setFees] = useState([]);   // this brokerage's own figures, per developer
  const [agreements, setAgreements] = useState([]);
  const [sel, setSel] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");
  const [agFilter, setAgFilter] = useState("all");   // Day 96: find the developers needing attention
  const [history, setHistory] = useState([]);
  useEffect(() => { (async () => {
    setHistory(sel ? await getFeeHistory(currentUser.company_id, sel.id) : []);
  })(); }, [sel?.id, currentUser.company_id, saving]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [d, f, a] = await Promise.all([
        // Day 96: pp_developers is GLOBAL CATALOG DATA - "read-only for all", per the Access Control
        // spec and the Decision Log. A brokerage must not write to it: Aldar's SPA fee as recorded by
        // one firm is not a fact about Aldar, it is a fact about THAT FIRM'S dealings with him, and
        // writing it to the catalog would push it into every other tenant's deals.
        // So the fees live in pp_developer_fees, keyed on (company_id, developer_id).
        supabase.from("pp_developers")
          .select("id, name, logo_url, website, rera_developer_no, ded_licence, city, country, phone, email, is_active")
          .order("name"),
        supabase.from("pp_developer_fees")
          .select("developer_id, default_spa_fee, default_oqood_fee, default_dld_pct, default_reservation_fee, admin_fee_per_unit, default_dld_payer, updated_at")
          .eq("company_id", currentUser.company_id),
        supabase.from("pp_master_agreements")
          .select("developer_id, agreement_title, status")
          .eq("company_id", currentUser.company_id).eq("status", "active"),
      ]);
      setFees(f.data || []);
      setDevs(d.data || []);
      setAgreements(a.data || []);
    } catch (e) {
      showToast?.("Could not load developers: " + (e.message || e), "error");
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [currentUser.company_id]);

  // Day 96: declared ABOVE the memo that filters on it - fourth temporal-dead-zone this week.
  const hasAgreement = (id) => agreements.some((a) => a.developer_id === id);

  const feesFor = (id) => fees.find((f) => f.developer_id === id) || {};

  const open = (d) => {
    setSel(d);
    const own = feesFor(d.id);
    setForm({
      default_reservation_fee: own.default_reservation_fee ?? "",
      default_spa_fee: own.default_spa_fee ?? "",
      default_oqood_fee: own.default_oqood_fee ?? "",
      default_dld_pct: own.default_dld_pct ?? "",
      admin_fee_per_unit: own.admin_fee_per_unit ?? "",
      default_dld_payer: own.default_dld_payer ?? "",
    });
  };

  const save = async () => {
    if (!sel) return;
    setSaving(true);
    // An empty box is NULL, not zero - "we do not know" rather than "he charges nothing".
    const num = (v) => (v === "" || v === null || v === undefined ? null : Number(v));
    const payload = {
      default_reservation_fee: num(form.default_reservation_fee),
      default_spa_fee: num(form.default_spa_fee),
      default_oqood_fee: num(form.default_oqood_fee),
      default_dld_pct: num(form.default_dld_pct),
      admin_fee_per_unit: num(form.admin_fee_per_unit),
      default_dld_payer: form.default_dld_payer || null,
      company_id: currentUser.company_id,
      developer_id: sel.id,
      updated_by: currentUser.id,
      updated_at: new Date().toISOString(),
    };
    // One row per brokerage per developer - the unique key makes this a clean upsert.
    const { error } = await supabase.from("pp_developer_fees")
      .upsert(payload, { onConflict: "company_id,developer_id" });
    setSaving(false);
    if (error) { showToast?.("Could not save: " + error.message, "error"); return; }
    // Day 96: record WHAT MOVED. These figures change often - that is why they freeze onto a deal -
    // but the freeze protects the deal, not the policy. Without this, an edit from 2,500 to 4,000
    // leaves two deals frozen at different figures and nothing to explain the difference.
    await recordFeeChanges({
      companyId: currentUser.company_id, developerId: sel.id, source: "developer",
      before: feesFor(sel.id), after: payload, currentUser,
    });
    clearFeeCache();   // the resolver caches per developer; a saved figure must apply at once
    showToast?.(sel.name + " updated", "success");
    await load();

  };

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();

    const byText = devs.filter((d) => !t || (d.name || "").toLowerCase().includes(t) || (d.city || "").toLowerCase().includes(t));
    if (agFilter === "all") return byText;
    return byText.filter((d) => agFilter === "with" ? hasAgreement(d.id) : !hasAgreement(d.id));
  }, [devs, q, agFilter, agreements]);


  const isSet = (d) => { const f = feesFor(d.id); return FEES.some(([k]) => f[k] !== null && f[k] !== undefined); };

  const L = { fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: ".5px", display: "block", marginBottom: 4 };
  const F = { width: "100%", padding: "7px 9px", border: "1px solid #D1D5DB", borderRadius: 7, fontSize: 13 };

  return (
    <div style={{ padding: "1.25rem" }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#0F2540" }}>Developers</div>
      <div style={{ fontSize: 12, color: "#64748B", marginBottom: 14 }}>
        What each developer charges the buyer &middot; used unless a master agreement with him says otherwise
      </div>

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        {/* ── The list ─────────────────────────────────────────────────────── */}
        <div style={{ width: 300, background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ padding: 10, borderBottom: "1px solid #E2E8F0" }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search developers" style={{ ...F, fontSize: 12 }} />
            <div style={{ display: "flex", gap: 4, marginTop: 7 }}>
              {[["all", "All"], ["with", "With agreement"], ["without", "Without"]].map(([k, lbl]) => (
                <button key={k} onClick={() => setAgFilter(k)}
                  style={{ flex: 1, padding: "4px 6px", borderRadius: 6, border: "1px solid " + (agFilter === k ? "#0F2540" : "#E2E8F0"), background: agFilter === k ? "#0F2540" : "#fff", color: agFilter === k ? "#fff" : "#64748B", fontSize: 10.5, fontWeight: 700, cursor: "pointer" }}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>
          <div style={{ maxHeight: 520, overflowY: "auto" }}>
            {loading && <div style={{ padding: 12, fontSize: 12, color: "#94A3B8" }}>Loading…</div>}
            {!loading && filtered.map((d) => (
              <button key={d.id} onClick={() => open(d)}
                style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 12px", border: "none", borderBottom: "1px solid #F1F5F9", background: sel?.id === d.id ? "#F0F5FF" : "#fff", cursor: "pointer" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#0F2540" }}>{d.name}</div>
                <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 2 }}>
                  {isSet(d) ? <span style={{ color: "#166534", fontWeight: 700 }}>fees set</span> : "no fees set"}
                  {hasAgreement(d.id) && <span style={{ marginLeft: 8, color: "#3730A3", fontWeight: 700 }}>{"\u00b7 agreement"}</span>}
                </div>
              </button>
            ))}
            {!loading && filtered.length === 0 && <div style={{ padding: 12, fontSize: 12, color: "#94A3B8" }}>Nothing matches.</div>}
          </div>
        </div>

        {/* ── The developer ────────────────────────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 380 }}>
          {!sel && (
            <div style={{ padding: "40px 20px", textAlign: "center", color: "#94A3B8", fontSize: 13, border: "1px dashed #E2E8F0", borderRadius: 10 }}>
              Pick a developer to see what he charges.
            </div>
          )}

          {sel && (
            <>
              <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10, padding: 14, marginBottom: 14 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#0F2540" }}>{sel.name}</div>
                <div style={{ fontSize: 11, color: "#64748B", marginTop: 4, lineHeight: 1.7 }}>
                  {[sel.rera_developer_no && "RERA " + sel.rera_developer_no,
                    sel.ded_licence && "Licence " + sel.ded_licence,
                    [sel.city, sel.country].filter(Boolean).join(", "),
                    sel.website].filter(Boolean).join("  \u00b7  ") || "No registration details recorded."}
                </div>
                {hasAgreement(sel.id) && (
                  <div style={{ marginTop: 9, padding: "7px 10px", background: "#EEF2FF", border: "1px solid #C7D2FE", borderRadius: 7, fontSize: 11.5, color: "#3730A3" }}>
                    There is an active master agreement with this developer. Anything it states overrides what is set here.
                  </div>
                )}
              </div>

              <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#A0AEC0", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 3 }}>
                  Fees this developer charges the buyer
                </div>
                <div style={{ fontSize: 11.5, color: "#64748B", marginBottom: 12, lineHeight: 1.5 }}>
                  Leave a box <strong>blank</strong> to use your company&rsquo;s standard. Enter <strong>0</strong> only if he genuinely charges
                  nothing for it &mdash; those are different answers, and the app treats them differently.
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {FEES.map(([key, label, unit, hint]) => (
                    <div key={key}>
                      <label style={L}>{label} {unit === "%" ? "(%)" : "(AED)"}</label>
                      <input type="number" value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                        placeholder="company standard" style={F} />
                      <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 3 }}>{hint}</div>
                    </div>
                  ))}
                  <div>
                    <label style={L}>Who usually pays the DLD</label>
                    <select value={form.default_dld_payer} onChange={(e) => setForm((f) => ({ ...f, default_dld_payer: e.target.value }))} style={F}>
                      <option value="">company standard</option>
                      <option value="buyer">Buyer pays</option>
                      <option value="developer">Developer absorbs</option>
                      <option value="split">Split 50/50</option>
                    </select>
                    <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 3 }}>Pre-fills a new deal; still changeable per deal.</div>
                  </div>
                </div>

                {/* Day 96: what moved, and when. A figure that changes often needs its own record -
                    the freeze protects each deal, not the policy behind it. */}
                {history.length > 0 && (
                  <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #F1F5F9" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#A0AEC0", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 6 }}>What has changed</div>
                    {history.slice(0, 6).map((h) => (
                      <div key={h.id} style={{ display: "flex", gap: 8, alignItems: "baseline", fontSize: 11.5, color: "#475569", padding: "3px 0" }}>
                        <span style={{ color: "#94A3B8", minWidth: 66 }}>{new Date(h.changed_at).toLocaleDateString("en-GB")}</span>
                        <span style={{ color: "#0F2540" }}>{describeChange(h)}</span>
                        <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 9, background: h.source === "agreement" ? "#EEF2FF" : "#F1F5F9", color: h.source === "agreement" ? "#3730A3" : "#64748B" }}>
                          {h.source === "agreement" ? "AGREEMENT" : "STANDARD"}
                        </span>
                        {h.reason && <span style={{ color: "#94A3B8", fontStyle: "italic" }}>{h.reason}</span>}
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
                  <div style={{ fontSize: 10.5, color: "#94A3B8" }}>
                    {(() => { const u = feesFor(sel.id).updated_at; return u ? "Last confirmed " + new Date(u).toLocaleDateString("en-GB") : "Never confirmed"; })()}
                  </div>
                  <button onClick={save} disabled={saving}
                    style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#0F2540", color: "#fff", fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer" }}>
                    {saving ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
