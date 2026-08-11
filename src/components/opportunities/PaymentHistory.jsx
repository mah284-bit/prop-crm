import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase.js";
import { voidPayment } from "../../lib/recordPayment.js";
import { canDo } from "../../lib/permissions.js";

// Day 89: THE PAYMENTS BEHIND THE FIGURE.
//
// The ledger row now shows a SUM - 104,279 against a first instalment. Correct, and useless on its
// own: six payments sit behind it and the broker cannot see one of them. FOUNDER: "how the payments
// come still shows all the instalments as a report which can be sent if the buyer asks." A buyer who
// has paid six times will ask what he paid and when, and a single total is not an answer.
//
// This is the on-screen half. A buyer-facing statement PDF is a separate cut and should read the
// same rows.
//
// VOIDING, NOT DELETING: a payment recorded in error is a fact about the record. The row stays with
// a reason, the ledger re-derives without it, and an activity says who did it and why. Manager only -
// the same discipline as amending a block payment.

const LABELS = {
  booking_fee: "Booking fee",
  reservation_fee: "Reservation fee",
  initial_advance: "First instalment",
  spa_fee: "SPA fee",
  dld_fee: "DLD fee",
  oqood_fee: "Oqood fee",
  other_fees: "Other developer fees",
};

export default function PaymentHistory({ opp, currentUser, showToast, onChanged, tick }) {
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      if (!opp?.id) return;
      const { data } = await supabase
        .from("pp_payments")
        .select("id, particular, amount, payment_mode, reference, received_date, notes, status, created_at, created_by")
        .eq("opportunity_id", opp.id)
        .order("received_date", { ascending: false })
        .order("created_at", { ascending: false });
      setRows(data || []);
    })();
  }, [opp?.id, tick, busy]);

  const live = rows.filter((r) => r.status !== "voided");
  if (!rows.length) return null;

  const aed = (n) => Math.round(Number(n || 0)).toLocaleString();
  const dmy = (d) => (d ? new Date(d).toLocaleDateString("en-GB") : "-");
  const mayVoid = canDo(currentUser, "amend_payment");

  return (
    <div style={{ marginTop: 12, border: "1px solid #E2E8F0", borderRadius: 8, overflow: "hidden" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 12px", background: "#F8FAFC", border: "none", cursor: "pointer" }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, color: "#0F2540", textTransform: "uppercase", letterSpacing: ".5px" }}>
          Payment history ({live.length})
        </span>
        <span style={{ fontSize: 11, color: "#64748B" }}>{open ? "Hide" : "Show"}</span>
      </button>

      {open && (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead>
            <tr style={{ background: "#fff", color: "#64748B", textAlign: "left", borderBottom: "1px solid #E2E8F0" }}>
              <th style={{ padding: "6px 10px", fontWeight: 700 }}>Received</th>
              <th style={{ padding: "6px 10px", fontWeight: 700 }}>Against</th>
              <th style={{ padding: "6px 10px", fontWeight: 700, textAlign: "right" }}>Amount</th>
              <th style={{ padding: "6px 10px", fontWeight: 700 }}>How</th>
              <th style={{ padding: "6px 10px", fontWeight: 700 }}>Reference</th>
              <th style={{ padding: "6px 10px" }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const voided = r.status === "voided";
              return (
                <tr key={r.id} style={{ borderBottom: "1px solid #F1F5F9", opacity: voided ? 0.45 : 1 }}>
                  <td style={{ padding: "6px 10px", color: "#64748B" }}>{dmy(r.received_date)}</td>
                  <td style={{ padding: "6px 10px", color: "#0F2540" }}>
                    {LABELS[r.particular] || r.particular}
                    {voided && <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, color: "#B91C1C" }}>VOIDED</span>}
                  </td>
                  <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 700, textDecoration: voided ? "line-through" : "none" }}>
                    {aed(r.amount)}
                  </td>
                  <td style={{ padding: "6px 10px", color: "#64748B" }}>{r.payment_mode || "-"}</td>
                  <td style={{ padding: "6px 10px", color: "#64748B" }}>{r.reference || "-"}</td>
                  <td style={{ padding: "6px 10px", textAlign: "right" }}>
                    {!voided && mayVoid && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={async () => {
                          const why = window.prompt(
                            "Voiding AED " + aed(r.amount) + " against " + (LABELS[r.particular] || r.particular) +
                            ".\n\nThe row stays on the record with this reason, and the ledger recalculates without it.\n\nWhy?"
                          );
                          if (!why || !why.trim()) return;
                          setBusy(true);
                          const res = await voidPayment({ paymentId: r.id, oppId: opp.id, reason: why.trim(), currentUser });
                          setBusy(false);
                          if (!res.ok) { showToast(res.error || "Could not void", "error"); return; }
                          showToast("Payment voided", "success");
                          onChanged && onChanged();
                        }}
                        style={{ padding: "2px 8px", borderRadius: 5, border: "1px solid #FCA5A5", background: "#fff", color: "#B91C1C", fontSize: 10, fontWeight: 700, cursor: "pointer" }}
                      >
                        void
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
