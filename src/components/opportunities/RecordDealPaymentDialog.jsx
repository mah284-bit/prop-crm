import { useState, useMemo } from "react";
import { allocateDealPayment, PARTICULAR_LABELS } from "../../lib/allocateDealPayment.js";

// Day 91: ONE PAYMENT IN, ALLOCATED ACROSS THE LINES.
//
// FOUNDER: "nobody will transfer or send a cheque for a, then b, then c - the expectation is all
// payments coming in. Why not like block payment: one entry, amount received, and distribute."
//
// So he records what ARRIVED - one amount, one mode, one reference, one date - and the app proposes
// the split. He can adjust any line before it is staged, because he may have been told what the
// money was for; the app is proposing, not deciding.
//
// Nothing is written here. The rows are STAGED in the parent and become facts only when Save
// payments is pressed - so Cancel discards them, which is what Cancel should have always meant.

const MODES = ["Cheque", "Bank Transfer", "Cash", "Credit Card", "Card Machine"];
const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;
const aed = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function RecordDealPaymentDialog({ opp, ledger, staged = [], currentUser, showToast, onClose, onStage }) {
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState("");
  const [reference, setReference] = useState("");
  const [receivedDate, setReceivedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [edited, setEdited] = useState(null);

  // Staged payments count as already paid, so a second entry cannot overshoot what the first left.
  const effectiveLedger = useMemo(() => {
    const out = { ...(ledger || {}) };
    (staged || []).forEach((s) => {
      const row = out[s.particular];
      if (!row) return;
      out[s.particular] = { ...row, amount: String(Number(row.amount || 0) + Number(s.amount || 0)) };
    });
    return out;
  }, [ledger, staged]);

  const proposed = useMemo(
    () => allocateDealPayment({ amount, ledger: effectiveLedger }),
    [amount, effectiveLedger]
  );

  // `edited` holds the broker's overrides keyed by particular; null means "use the proposal".
  const split = useMemo(() => {
    if (!edited) return proposed.rows;
    return proposed.rows.map((r) => ({ ...r, amount: edited[r.particular] !== undefined ? Number(edited[r.particular]) || 0 : r.amount }));
  }, [proposed, edited]);

  const splitTotal = r2(split.reduce((t, r) => t + Number(r.amount || 0), 0));
  const entered = Number(amount) || 0;
  const diff = r2(entered - splitTotal);

  const F = { display: "block", width: "100%", padding: "7px 9px", border: "1px solid #D1D5DB", borderRadius: 7, fontSize: 13, marginBottom: 10 };
  const L = { fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: ".5px", display: "block", marginBottom: 4 };

  const stage = () => {
    if (!(entered > 0)) { showToast("Enter the amount received", "error"); return; }
    if (!String(mode || "").trim()) { showToast("How was it paid? A mode is required", "error"); return; }
    if (!receivedDate) { showToast("When was it received? The date is required", "error"); return; }

    const today = new Date().toISOString().slice(0, 10);
    const born = String(opp?.created_at || "").slice(0, 10);
    let w = null;
    if (receivedDate > today) w = "That date is in the future.";
    else if (born && receivedDate < born) w = "That is before this deal existed (" + new Date(born).toLocaleDateString("en-GB") + ").";
    if (w && !window.confirm(w + "\n\nRecord it with this date anyway?")) return;

    if (Math.abs(diff) > 0.5) {
      showToast(
        diff > 0
          ? "AED " + aed(diff) + " of this payment is not allocated. Put it against a line, or reduce the amount."
          : "The split is AED " + aed(-diff) + " more than the payment. Reduce a line.",
        "error"
      );
      return;
    }
    if (!split.length) { showToast("Nothing is outstanding on this deal", "error"); return; }

    // One payment becomes one staged row PER PARTICULAR - they share the reference and date, so the
    // record still shows they arrived together.
    split.filter((r) => Number(r.amount) > 0).forEach((r) => {
      onStage({
        particular: r.particular,
        label: PARTICULAR_LABELS[r.particular] || r.particular,
        amount: Number(r.amount),
        mode, reference: reference || null, receivedDate,
        notes: notes || null,
      });
    });
    showToast("Added - press Save payments to record it", "info");
    onClose && onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(11,31,58,.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1400, padding: "1rem" }}>
      <div style={{ background: "#fff", borderRadius: 14, width: 520, maxWidth: "96vw", maxHeight: "92vh", overflow: "auto", padding: "1.1rem 1.25rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#0F2540" }}>Money received</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, color: "#94A3B8", cursor: "pointer" }}>&times;</button>
        </div>
        <div style={{ fontSize: 12, color: "#64748B", marginBottom: 14 }}>
          Recorded once and distributed across what is owed &middot; {opp?.title || ""}
        </div>

        <label style={L}>Amount received (AED) *</label>
        <input type="number" autoFocus value={amount} onChange={(e) => { setAmount(e.target.value); setEdited(null); }} placeholder="0" style={F} />

        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={L}>How was it paid? *</label>
            <select value={mode} onChange={(e) => setMode(e.target.value)} style={F}>
              <option value="">Select...</option>
              {MODES.map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={L}>Received on *</label>
            <input type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} style={F} />
          </div>
        </div>

        <label style={L}>Reference</label>
        <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Cheque no, TT reference, receipt no" style={F} />

        {entered > 0 && (
          <div style={{ marginTop: 4, marginBottom: 10, border: "1px solid #E2E8F0", borderRadius: 9, overflow: "hidden" }}>
            <div style={{ padding: "7px 11px", background: "#F8FAFC", fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: ".5px" }}>
              How this is applied {edited ? "\u00b7 adjusted" : "\u00b7 proposed"}
            </div>
            {split.length === 0 && (
              <div style={{ padding: "10px 11px", fontSize: 12, color: "#B45309" }}>Nothing is outstanding on this deal.</div>
            )}
            {split.map((r) => (
              <div key={r.particular} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 11px", borderTop: "1px solid #F1F5F9" }}>
                <span style={{ flex: 1, fontSize: 12, color: "#0F2540" }}>{r.label}</span>
                <span style={{ fontSize: 10, color: "#94A3B8" }}>{"owes " + aed(r.owed_before)}</span>
                <input
                  type="number"
                  value={edited && edited[r.particular] !== undefined ? edited[r.particular] : r.amount}
                  onChange={(e) => setEdited((x) => ({ ...(x || {}), [r.particular]: e.target.value }))}
                  style={{ width: 110, padding: "4px 7px", border: "1px solid #D1D5DB", borderRadius: 6, fontSize: 12, textAlign: "right" }}
                />
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 11px", background: Math.abs(diff) > 0.5 ? "#FFFBEB" : "#ECFDF5", borderTop: "1px solid #E2E8F0", fontSize: 12, fontWeight: 700 }}>
              <span style={{ color: Math.abs(diff) > 0.5 ? "#B45309" : "#166534" }}>
                {Math.abs(diff) <= 0.5 ? "Fully applied" : (diff > 0 ? "Not yet applied: AED " + aed(diff) : "Over by AED " + aed(-diff))}
              </span>
              <span style={{ color: "#0F2540" }}>{"AED " + aed(splitTotal)}</span>
            </div>
          </div>
        )}

        <label style={L}>Notes</label>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any condition on this payment" style={F} />

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
          <button onClick={onClose} style={{ padding: "8px 16px", borderRadius: 8, border: "1.5px solid #E2E8F0", background: "#fff", color: "#475569", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
          <button onClick={stage} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#0F2540", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Add this payment</button>
        </div>
      </div>
    </div>
  );
}
