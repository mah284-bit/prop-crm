import { useState } from "react";
import { allocateBlockPayment } from "../../lib/allocateBlockPayment.js";

// Day 80: THE COLLECTION DIALOG - the phase AFTER the reservation.
// Founder's model: a chunk of money arrives for the BLOCK. The broker records ONE amount; the app
// allocates it across particulars and then across units, proportionally to what each still owes.
// He never chooses a particular and never types a per-unit figure - his only question is whether
// the chunk is fully collected. The detail lives on the Money tab and in the block statement.
// The RESERVATION keeps its own dialog: it is a fixed fee, split equally, and gated.
const MODES = ["Wire", "Cheque", "Cash", "Card"];
const LABEL = { initial_advance: "First instalment", spa_fee: "SPA fee", dld_fee: "DLD fee", oqood_fee: "Oqood fee", other_fees: "Other fees" };

export default function BlockCollectionDialog({ block, blockBill, paidByParticular, paidByUnit, currentUser, showToast, onClose, onRecord }) {
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState("Wire");
  const [reference, setReference] = useState("");
  const [receivedOn, setReceivedOn] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const fmt = (n) => "AED " + Math.round(Number(n || 0)).toLocaleString();
  const landed = Number(amount) || 0;

  const billTotal = ["initial", "spa", "dld", "oqood"].reduce((t, k) => t + Number((blockBill?.tot || {})[k] || 0), 0);
  const collected = Object.values(paidByParticular || {}).reduce((t, v) => t + Number(v || 0), 0);
  const outstanding = Math.max(0, billTotal - collected);
  const after = Math.max(0, outstanding - landed);
  const plan = allocateBlockPayment({ amount: landed, bill: blockBill, paidByParticular, paidByUnit });

  const submit = async () => {
    if (landed <= 0) { showToast("Enter the amount received", "error"); return; }
    setSaving(true);
    await onRecord({ amount: landed, mode, reference, receivedOn, notes, plan });
    setSaving(false);
  };
  const L = { fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: ".4px" };
  const IN = { padding: "8px 10px", border: "1px solid #D1D5DB", borderRadius: 7, fontSize: 13 };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,37,64,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 90, padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 16, width: 720, maxWidth: "96vw", maxHeight: "92vh", overflow: "auto" }}>
        <div style={{ padding: "1.1rem 1.4rem", borderBottom: "1px solid #E8EDF4" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#0F2540" }}>Money received for this block</div>
          <div style={{ fontSize: 12, color: "#94A3B8" }}>{block.title} - recorded once, allocated automatically</div>
        </div>
        <div style={{ padding: "1.1rem 1.4rem" }}>
          <div style={{ background: after <= 0 && landed > 0 ? "#E6F4EE" : "#FFFBEB", border: "1px solid " + (after <= 0 && landed > 0 ? "#A7D8C3" : "#FCD34D"), borderRadius: 10, padding: "11px 14px", marginBottom: 14, display: "flex", gap: 26 }}>
            <div><div style={L}>Bill</div><div style={{ fontSize: 15, fontWeight: 800, color: "#0F2540" }}>{fmt(billTotal)}</div></div>
            <div><div style={L}>Collected</div><div style={{ fontSize: 15, fontWeight: 800, color: "#16A34A" }}>{fmt(collected)}</div></div>
            <div><div style={L}>{landed > 0 ? "Outstanding after this" : "Outstanding"}</div><div style={{ fontSize: 15, fontWeight: 800, color: (landed > 0 ? after : outstanding) <= 0.5 ? "#16A34A" : "#B91C1C" }}>{(landed > 0 ? after : outstanding) <= 0.5 ? ("Nil " + String.fromCodePoint(0x2713)) : fmt(landed > 0 ? after : outstanding)}</div></div>
          </div>
          {outstanding <= 0.5 ? (
            <div style={{ background: "#E6F4EE", border: "1px solid #A7D8C3", borderRadius: 10, padding: "12px 14px", fontSize: 13, color: "#14603F", fontWeight: 600 }}>
              This block is fully collected. Nothing further is owed - there is nothing to record.
            </div>
          ) : (<>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
            <div><label style={L}>Amount received</label><br /><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" style={{ ...IN, width: 160, fontWeight: 700 }} /></div>
            <div><label style={L}>Mode</label><br /><select value={mode} onChange={(e) => setMode(e.target.value)} style={IN}>{MODES.map((m) => <option key={m}>{m}</option>)}</select></div>
            <div><label style={L}>Reference</label><br /><input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="TT / cheque no" style={{ ...IN, width: 180 }} /></div>
            <div><label style={L}>Received on</label><br /><input type="date" value={receivedOn} onChange={(e) => setReceivedOn(e.target.value)} style={IN} /></div>
          </div>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any conditions on this payment..." style={{ ...IN, width: "100%", boxSizing: "border-box", marginBottom: 14 }} />
          {landed > 0 && (
            <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 10, padding: "10px 14px", marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#0F2540", marginBottom: 2 }}>How this will be applied</div>
              <div style={{ fontSize: 11, color: "#94A3B8", marginBottom: 8 }}>Proportional to what each still owes. Each unit is credited underneath, for its own cost basis.</div>
              {plan.particulars.map((p) => (
                <div key={p.particular} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0", borderBottom: "1px dashed #F1F5F9" }}>
                  <span style={{ color: "#475569" }}>{LABEL[p.particular] || p.particular}</span>
                  <span style={{ fontWeight: 700, color: "#16A34A" }}>{fmt(p.amount)}</span>
                </div>
              ))}
              {plan.unallocated > 0.5 && <div style={{ fontSize: 11, color: "#B91C1C", fontWeight: 700, marginTop: 6 }}>Overpayment of {fmt(plan.unallocated)} - more than this block owes.</div>}
            </div>
          )}
          </>)}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button onClick={onClose} style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid #CBD5E1", background: "#fff", color: "#64748B", fontSize: 13, cursor: "pointer" }}>Cancel</button>
            <button onClick={submit} disabled={saving || landed <= 0} style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: (landed > 0 ? "#16A34A" : "#CBD5E1"), color: "#fff", fontSize: 13, fontWeight: 700, cursor: landed > 0 ? "pointer" : "not-allowed" }}>{saving ? "Recording..." : "Record payment"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
