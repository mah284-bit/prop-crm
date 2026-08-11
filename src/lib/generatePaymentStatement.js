import jsPDF from "jspdf";

// Day 89: THE STATEMENT A BUYER ASKS FOR.
//
// FOUNDER: "how the payments come still shows all the instalments as a report which can be sent if
// the buyer asks." A buyer who has paid six times will ask what he paid and when, and until the
// payment rows existed there was no honest answer - only a single total that had been typed over
// each time.
//
// It reads pp_payments directly, so it can never disagree with the ledger: both are the same rows.
//
// WHAT IT SHOWS AND WHAT IT DOES NOT:
//  - Every payment in DATE order, with how it was paid and its reference, so he can match each line
//    against his own bank record.
//  - A summary per particular: expected, paid, outstanding.
//  - VOIDED payments are EXCLUDED. A buyer's statement shows what he paid, not what was recorded in
//    error. The internal history keeps them.
//  - No commission, no internal notes, no who-recorded-it.
//  - It stops at the PRE-SPA bill. What remains on the price after the SPA is the developer's
//    payment plan, not this document's business.

const LABELS = {
  booking_fee: "Booking fee",
  reservation_fee: "Reservation fee",
  initial_advance: "First instalment",
  spa_fee: "SPA fee",
  dld_fee: "DLD registration",
  oqood_fee: "Oqood registration",
  other_fees: "Other developer fees",
};
const ORDER = ["booking_fee", "reservation_fee", "initial_advance", "spa_fee", "dld_fee", "oqood_fee", "other_fees"];

export function generatePaymentStatement({ opp, buyer, unit, company, payments, ledger }) {
  const doc = new jsPDF("p", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 16;
  const W = pageWidth - 2 * margin;

  const hexToRgb = (hex) => {
    const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "");
    return r ? [parseInt(r[1], 16), parseInt(r[2], 16), parseInt(r[3], 16)] : [11, 31, 58];
  };
  const brand = hexToRgb(company?.brand_color);
  const aed = (n) => "AED " + Math.round(Number(n || 0)).toLocaleString();
  const dmy = (d) => (d ? new Date(d).toLocaleDateString("en-GB") : "-");

  const live = (payments || []).filter((p) => p.status !== "voided");

  doc.setFillColor(brand[0], brand[1], brand[2]);
  doc.rect(0, 0, pageWidth, 38, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(19);
  doc.setFont(undefined, "bold");
  doc.text(company?.name || "Al Mansoori Properties", margin, 19);
  doc.setFontSize(10);
  doc.setFont(undefined, "normal");
  doc.text("PAYMENT STATEMENT", margin, 29);
  doc.setFontSize(9);
  doc.text("As at " + dmy(new Date()), pageWidth - margin, 29, { align: "right" });

  let y = 50;
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(13);
  doc.setFont(undefined, "bold");
  doc.text(buyer?.name || opp?.title || "Buyer", margin, y);
  y += 7;
  doc.setFontSize(10);
  doc.setFont(undefined, "normal");
  doc.setTextColor(90, 90, 90);
  const desc = [
    unit?.unit_ref,
    unit?.bedrooms === 0 ? "Studio" : unit?.bedrooms ? unit.bedrooms + "BR" : null,
    unit?.size_sqft ? unit.size_sqft + " sqft" : null,
    unit?.project_name || null,
  ].filter(Boolean).join(" \u00b7 ");
  if (desc) { doc.text(desc, margin, y); y += 6; }
  doc.text("Agreed price: " + aed(opp?.current_agreed_price || opp?.budget), margin, y);
  y += 10;

  // ── Payments received ────────────────────────────────────────────────────────
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(11);
  doc.setFont(undefined, "bold");
  doc.text("Payments received", margin, y);
  y += 6;

  doc.setFillColor(240, 243, 247);
  doc.rect(margin, y - 4, W, 8, "F");
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  doc.text("Date", margin + 3, y + 1);
  doc.text("Towards", margin + 28, y + 1);
  doc.text("How paid", margin + 78, y + 1);
  doc.text("Reference", margin + 112, y + 1);
  doc.text("Amount", pageWidth - margin - 3, y + 1, { align: "right" });
  y += 9;

  doc.setFont(undefined, "normal");
  doc.setTextColor(30, 30, 30);
  let received = 0;
  const sorted = [...live].sort((a, b) => String(a.received_date || "").localeCompare(String(b.received_date || "")));
  if (!sorted.length) {
    doc.setTextColor(120, 120, 120);
    doc.text("No payments recorded yet.", margin + 3, y);
    y += 8;
  }
  sorted.forEach((p) => {
    if (y > 250) { doc.addPage(); y = 24; }
    received += Number(p.amount) || 0;
    doc.setTextColor(90, 90, 90);
    doc.text(dmy(p.received_date), margin + 3, y);
    doc.setTextColor(30, 30, 30);
    doc.text(LABELS[p.particular] || p.particular, margin + 28, y);
    doc.setTextColor(90, 90, 90);
    doc.text(String(p.payment_mode || "-").slice(0, 18), margin + 78, y);
    doc.text(String(p.reference || "-").slice(0, 20), margin + 112, y);
    doc.setTextColor(30, 30, 30);
    doc.text(aed(p.amount), pageWidth - margin - 3, y, { align: "right" });
    y += 6.5;
  });

  y += 2;
  doc.setDrawColor(200, 208, 218);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;
  doc.setFont(undefined, "bold");
  doc.setFontSize(10);
  doc.text("Total received", margin + 3, y);
  doc.text(aed(received), pageWidth - margin - 3, y, { align: "right" });
  y += 12;

  // ── Where it stands ──────────────────────────────────────────────────────────
  if (y > 225) { doc.addPage(); y = 24; }
  doc.setFontSize(11);
  doc.text("Where it stands", margin, y);
  y += 6;

  doc.setFillColor(240, 243, 247);
  doc.rect(margin, y - 4, W, 8, "F");
  doc.setFontSize(9);
  doc.setFont(undefined, "normal");
  doc.setTextColor(90, 90, 90);
  doc.text("Item", margin + 3, y + 1);
  doc.text("Due", margin + 92, y + 1, { align: "right" });
  doc.text("Paid", margin + 130, y + 1, { align: "right" });
  doc.text("Outstanding", pageWidth - margin - 3, y + 1, { align: "right" });
  y += 9;

  let totDue = 0, totPaid = 0;
  ORDER.forEach((k) => {
    const row = (ledger || {})[k];
    if (!row) return;
    const due = Number(row.expected_amount || 0);
    const paid = live.filter((p) => p.particular === k).reduce((s, p) => s + (Number(p.amount) || 0), 0);
    if (due <= 0 && paid <= 0) return;
    const waived = row.status === "waived";
    totDue += waived ? 0 : due;
    totPaid += paid;
    const out = waived ? 0 : Math.max(0, due - paid);
    if (y > 262) { doc.addPage(); y = 24; }
    doc.setTextColor(30, 30, 30);
    doc.text(LABELS[k] + (waived ? " (waived)" : ""), margin + 3, y);
    doc.setTextColor(90, 90, 90);
    doc.text(waived ? "-" : aed(due), margin + 92, y, { align: "right" });
    doc.text(aed(paid), margin + 130, y, { align: "right" });
    doc.setTextColor(out > 0 ? 180 : 30, out > 0 ? 83 : 30, out > 0 ? 9 : 30);
    doc.text(out > 0 ? aed(out) : "Settled", pageWidth - margin - 3, y, { align: "right" });
    y += 6.5;
  });

  y += 2;
  doc.setDrawColor(200, 208, 218);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;
  doc.setTextColor(30, 30, 30);
  doc.setFont(undefined, "bold");
  doc.setFontSize(10);
  doc.text("Total", margin + 3, y);
  doc.text(aed(totDue), margin + 92, y, { align: "right" });
  doc.text(aed(totPaid), margin + 130, y, { align: "right" });
  doc.text(totDue - totPaid > 0 ? aed(totDue - totPaid) : "Settled", pageWidth - margin - 3, y, { align: "right" });
  y += 12;

  doc.setFont(undefined, "normal");
  doc.setFontSize(9);
  doc.setTextColor(110, 110, 110);
  [
    "This statement covers amounts payable before the SPA. Instalments falling due after signing",
    "follow the developer's payment plan.",
    "Government and registration fees apply at the rate in force on the date of registration.",
    "Please quote the reference above when matching a payment against your own records.",
  ].forEach((t) => { doc.text(t, margin, y); y += 5; });

  return doc.output("blob");
}
