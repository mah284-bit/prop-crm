import { PAYMENT_PLAN_PRESETS } from "../../modules/constants.js";

// Day 80: the block TERMS edit form. Lives in its own file so the Workspace stays readable.
// See the BLOCK TERMS EDITOR comment in BlockWorkspace.jsx for why terms are editable after
// confirmation while prices stay locked.
export default function BlockTermsForm({ plan, setPlan, dld, setDld, saving, onSave, onCancel }) {
  const L = { fontSize: 10, fontWeight: 700, color: "#64748B", display: "block", marginBottom: 3 };
  const DLD = [["buyer","Buyer pays"],["developer","Developer absorbs"],["split","Split"],["negotiated","Negotiated"]];
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "flex-end", flexWrap: "wrap" }}>
      <div>
        <label style={L}>PAYMENT PLAN</label>
        <select value={plan} onChange={(e) => setPlan(e.target.value)}
          style={{ padding: "7px 9px", border: "1px solid #D1D5DB", borderRadius: 7, fontSize: 13, minWidth: 130 }}>
          <option value="">- Select -</option>
          {PAYMENT_PLAN_PRESETS.map((p) => <option key={p.label} value={p.label}>{p.label}</option>)}
        </select>
      </div>
      <div>
        <label style={L}>DLD FEE</label>
        <div style={{ display: "flex", gap: 5 }}>
          {DLD.map(([v, lb]) => (
            <button key={v} onClick={() => setDld(v)}
              style={{ padding: "7px 11px", borderRadius: 7, border: dld === v ? "none" : "1px solid #D1D5DB",
                background: dld === v ? "#16A34A" : "#fff", color: dld === v ? "#fff" : "#475569",
                fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{lb}</button>
          ))}
        </div>
      </div>
      <button onClick={onSave} disabled={saving}
        style={{ padding: "8px 16px", borderRadius: 7, border: "none", background: "#0F2540",
          color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
        {saving ? "Saving..." : "Save terms"}
      </button>
      <button onClick={onCancel}
        style={{ padding: "8px 12px", borderRadius: 7, border: "1px solid #CBD5E1", background: "#fff",
          color: "#64748B", fontSize: 12, cursor: "pointer" }}>Cancel</button>
    </div>
  );
}
