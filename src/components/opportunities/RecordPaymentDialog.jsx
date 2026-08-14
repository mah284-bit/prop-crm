import { useState } from "react";
import { recordPayment } from "../../lib/recordPayment.js";

// Day 89: ONE PAYMENT, ONE ROW.
//
// The particular is passed IN, from the ledger row the broker clicked - it is never chosen here.
// A dropdown would let money be filed against the wrong line and nothing would catch it; clicking
// "First instalment" and getting a form headed "First instalment" cannot go wrong that way.
//
// Everything asked for is something the broker was TOLD by the developer or the bank: how much,
// how, when, and the reference on the advice. Nothing is computed or defaulted except today's date,
// which he can change.

const MODES = ["Cheque", "Bank Transfer", "Cash", "Credit Card", "Card Machine"];

// Day 89: TWO KINDS OF MONEY, TWO RULES ON OVERPAYMENT.
//  - FLAT FEES (reservation, booking) are fixed figures the developer named. Nobody sends more than
//    a reservation, so an excess is almost always a MISCLICK on the wrong row. Warn firmly.
//  - COMPUTED FEES (instalment, DLD, SPA, Oqood) come off percentages, so small differences are
//    NORMAL - bank charges, rounding on a 4% DLD, the developer's own rounding. Warn only when it is
//    MATERIALLY over. Founder's own tolerance reasoning from Day 86: a bank-charge-sized difference
//    is not a variance, it is arithmetic.
// Never REFUSE either: the app records what arrived. A buyer who sent 25,500 sent 25,500.
const FLAT = ["reservation_fee", "booking_fee"];
const TOLERANCE = 500;

export default function RecordPaymentDialog({ opp, particular, label, expected, alreadyPaid, currentUser, showToast, onClose, onSaved }) {
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState("");
  const [reference, setReference] = useState("");
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Day 91: DATE SANITY. There were no date checks anywhere - an SPA created on the 14th accepted a
  // signing date of the 12th without a murmur. WARN AND ALLOW rather than refuse: back-dating is
  // legitimate and common, because the data entry happens days after the money arrives. What is not
  // legitimate is a date the deal could not have had.
  const dateWarning = () => {
    const d = receivedDate;
    if (!d) return null;
    const today = new Date().toISOString().slice(0, 10);
    if (d > today) return "That date is in the future.";
    const born = String(opp?.created_at || "").slice(0, 10);
    if (born && d < born) return "That is before this deal existed (" + new Date(born).toLocaleDateString("en-GB") + ").";
    return null;
  };

  const save = async () => {
    // Day 89: VALIDATE BEFORE WARNING. It asked the broker to confirm an overpayment and only then
    // told him the mode was missing - two dialogs to reach a refusal the first field could have
    // given him.
    if (!(Number(amount) > 0)) { showToast("Enter an amount", "error"); return; }
    if (!String(mode || "").trim()) { showToast("How was this paid? A mode is required", "error"); return; }
    const dw = dateWarning();
    if (dw && !window.confirm(dw + "\n\nRecord it with this date anyway?")) return;
    const exp = Number(expected || 0);
    const paid = Number(alreadyPaid || 0);
    const after = paid + (Number(amount) || 0);
    if (exp > 0 && after > exp) {
      const over = after - exp;
      const flat = FLAT.includes(particular);
      if (flat) {
        if (!window.confirm(label + " is already fully paid - " + paid.toLocaleString() + " of " + exp.toLocaleString() + ".\n\nThis would put it AED " + Math.round(over).toLocaleString() + " over. Is this meant for another line?")) return;
      } else if (over > TOLERANCE) {
        // Day 90: REFUSED, not confirmed. FOUNDER: "the entry itself should not happen if there is
        // more money - he has to manually distribute it to the max." Money beyond what a line owes
        // belongs somewhere else, and letting it land here makes the per-line record meaningless.
        // Within tolerance still passes: a bank charge is arithmetic, not a decision.
        // NOT AUTOMATED, deliberately: the block allocator spreads a payment because there is no
        // per-unit instruction. Here the developer usually SAYS what a payment is against, so the
        // broker knows and the app would only be guessing over him.
        showToast(label + " only owes AED " + Math.round(exp - paid).toLocaleString() +
          ". Record that here and put the rest against the line it belongs to.", "error");
        return;
      }
    }
    setSaving(true);
    const r = await recordPayment({
      opp, particular, amount, mode, reference, receivedDate, notes, currentUser,
    });
    setSaving(false);
    if (!r.ok) { showToast(r.error || "Could not record", "error"); return; }
    if (r.warning) showToast(r.warning, "warning");
    else showToast("AED " + Number(amount).toLocaleString() + " recorded against " + label, "success");
    onSaved && onSaved();
    onClose && onClose();
  };

  const F = { display: "block", width: "100%", padding: "7px 9px", border: "1px solid #D1D5DB", borderRadius: 7, fontSize: 13, marginBottom: 10 };
  const L = { fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: ".5px", display: "block", marginBottom: 4 };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(11,31,58,.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1400, padding: "1rem" }}>
      <div style={{ background: "#fff", borderRadius: 14, width: 420, maxWidth: "95vw", padding: "1.1rem 1.25rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#0F2540" }}>Record a payment</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, color: "#94A3B8", cursor: "pointer" }}>&times;</button>
        </div>
        <div style={{ fontSize: 12, color: "#64748B", marginBottom: 14 }}>
          Against <strong style={{ color: "#0F2540" }}>{label}</strong> &middot; {opp?.title || ""}
        </div>

        <label style={L}>Amount received (AED) *</label>
        <input type="number" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" style={F} />

        <label style={L}>How was it paid? *</label>
        <select value={mode} onChange={(e) => setMode(e.target.value)} style={F}>
          <option value="">Select...</option>
          {MODES.map((m) => <option key={m}>{m}</option>)}
        </select>

        <label style={L}>Reference</label>
        <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Cheque no, TT reference, receipt no" style={F} />

        <label style={L}>Received on *</label>
        <input type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} style={F} />

        <label style={L}>Notes</label>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any condition on this payment" style={F} />

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
          <button onClick={onClose} style={{ padding: "8px 16px", borderRadius: 8, border: "1.5px solid #E2E8F0", background: "#fff", color: "#475569", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
          <button disabled={saving} onClick={save} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#0F2540", color: "#fff", fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer" }}>
            {saving ? "Recording..." : "Record payment"}
          </button>
        </div>
      </div>
    </div>
  );
}
