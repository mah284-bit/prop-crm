import { useState, useMemo } from "react";

// Day 92: A DEVELOPER SETTLES IN BULK.
//
// FOUNDER, during the first commission walk: "the settling also might come not invoice to invoice
// and as bulk." He is right - a developer pays one transfer against the account, and the brokerage
// then works out which invoices it cleared. Record Payment took one invoice at a time, so 500,000
// covering eight deals meant eight dialogs and the broker doing the arithmetic himself.
//
// ⭐ OLDEST FIRST, NOT PROPORTIONAL - and this is a DIFFERENT doctrine from the deal ledger
// deliberately. On a deal, the particulars are one debt arriving in instalments, so proportional
// keeps every line advancing together. INVOICES ARE SEPARATE DEBTS WITH THEIR OWN AGES: a developer
// settling is clearing the oldest, the aging report depends on it, and spreading proportionally
// would leave every invoice partly paid and permanently ageing - the one thing the module exists to
// prevent.
//
// The broker can override any line, because he may have been told exactly which invoices were
// covered. The app proposes; he decides.

const aed = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;

export default function SettleDeveloperDialog({ developerName, invoices, onClose, onSettle, showToast }) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [reference, setReference] = useState("");
  const [edited, setEdited] = useState(null);

  // Oldest first. An invoice with no date sorts last - it cannot be the one ageing.
  const open = useMemo(
    () =>
      [...(invoices || [])]
        .map((i) => ({ ...i, owed: r2(Number(i.commission_net || 0) - Number(i.amount_received || 0)) }))
        .filter((i) => i.owed > 0.5)
        .sort((a, b) => String(a.invoice_date || "9999").localeCompare(String(b.invoice_date || "9999"))),
    [invoices]
  );

  const proposed = useMemo(() => {
    let left = Number(amount) || 0;
    return open.map((i) => {
      const give = Math.min(left, i.owed);
      left = r2(left - give);
      return { id: i.id, number: i.invoice_number || "(no number)", date: i.invoice_date, owed: i.owed, amount: r2(give) };
    });
  }, [open, amount]);

  const split = useMemo(() => {
    if (!edited) return proposed;
    return proposed.map((r) => ({ ...r, amount: edited[r.id] !== undefined ? Number(edited[r.id]) || 0 : r.amount }));
  }, [proposed, edited]);

  const splitTotal = r2(split.reduce((t, r) => t + Number(r.amount || 0), 0));
  const entered = Number(amount) || 0;
  const diff = r2(entered - splitTotal);
  const totalOwed = r2(open.reduce((t, i) => t + i.owed, 0));

  const F = { display: "block", width: "100%", padding: "7px 9px", border: "1px solid #D1D5DB", borderRadius: 7, fontSize: 13, marginBottom: 10 };
  const L = { fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: ".5px", display: "block", marginBottom: 4 };

  const submit = () => {
    if (!(entered > 0)) { showToast("Enter the amount received", "error"); return; }
    if (!date) { showToast("When was it received? The date is required", "error"); return; }
    if (Math.abs(diff) > 0.5) {
      showToast(
        diff > 0
          ? "AED " + aed(diff) + " is not applied to any invoice. Reduce the amount, or put it against a line."
          : "The split is AED " + aed(-diff) + " more than the payment.",
        "error"
      );
      return;
    }
    const rows = split.filter((r) => Number(r.amount) > 0);
    if (!rows.length) { showToast("Nothing to settle", "error"); return; }
    onSettle(rows, date, reference);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(11,31,58,.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1400, padding: "1rem" }}>
      <div style={{ background: "#fff", borderRadius: 14, width: 560, maxWidth: "96vw", maxHeight: "92vh", overflow: "auto", padding: "1.1rem 1.25rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#0F2540" }}>{developerName} paid</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, color: "#94A3B8", cursor: "pointer" }}>&times;</button>
        </div>
        <div style={{ fontSize: 12, color: "#64748B", marginBottom: 14 }}>
          One transfer, settled across {open.length} outstanding invoice{open.length === 1 ? "" : "s"} &middot; AED {aed(totalOwed)} owed
        </div>

        <label style={L}>Amount received (AED) *</label>
        <input type="number" autoFocus value={amount} onChange={(e) => { setAmount(e.target.value); setEdited(null); }} placeholder="0" style={F} />

        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={L}>Received on *</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={F} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={L}>Reference</label>
            <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="TT reference" style={F} />
          </div>
        </div>

        {entered > 0 && (
          <div style={{ marginBottom: 10, border: "1px solid #E2E8F0", borderRadius: 9, overflow: "hidden" }}>
            <div style={{ padding: "7px 11px", background: "#F8FAFC", fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: ".5px" }}>
              How this is applied &middot; oldest first {edited ? "\u00b7 adjusted" : ""}
            </div>
            {split.map((r) => (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 11px", borderTop: "1px solid #F1F5F9" }}>
                <span style={{ flex: 1, fontSize: 12, color: "#0F2540" }}>{r.number}</span>
                <span style={{ fontSize: 10, color: "#94A3B8" }}>{r.date ? new Date(r.date).toLocaleDateString("en-GB") : "-"}</span>
                <span style={{ fontSize: 10, color: "#94A3B8", width: 96, textAlign: "right" }}>{"owes " + aed(r.owed)}</span>
                <input
                  type="number"
                  value={edited && edited[r.id] !== undefined ? edited[r.id] : r.amount}
                  onChange={(e) => setEdited((x) => ({ ...(x || {}), [r.id]: e.target.value }))}
                  style={{ width: 110, padding: "4px 7px", border: "1px solid #D1D5DB", borderRadius: 6, fontSize: 12, textAlign: "right" }}
                />
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 11px", background: Math.abs(diff) > 0.5 ? "#FFFBEB" : "#ECFDF5", borderTop: "1px solid #E2E8F0", fontSize: 12, fontWeight: 700 }}>
              <span style={{ color: Math.abs(diff) > 0.5 ? "#B45309" : "#166534" }}>
                {Math.abs(diff) <= 0.5 ? "Fully applied" : (diff > 0 ? "Not applied: AED " + aed(diff) : "Over by AED " + aed(-diff))}
              </span>
              <span style={{ color: "#0F2540" }}>{"AED " + aed(splitTotal)}</span>
            </div>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
          <button onClick={onClose} style={{ padding: "8px 16px", borderRadius: 8, border: "1.5px solid #E2E8F0", background: "#fff", color: "#475569", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
          <button onClick={submit} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#0F2540", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Record across these invoices</button>
        </div>
      </div>
    </div>
  );
}
