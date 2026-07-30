import { jsPDF } from "jspdf";

// Day 79: PAYMENT RECEIPT - what the buyer walks away with.
// Founder: "they will give him exactly how much he has to pay from this step - print the receipt
// with the balance to be paid within this time to proceed further."
// Matches the proposal PDF's letterhead so both look like they came from the same company.
export function generateReceiptPDF({ lead, opp, unit, project, company, currentUser, ledger, expiresOn }) {
  const doc = new jsPDF("p", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;
  const companyName = company?.name || "Al Mansoori Properties";
  const hexToRgb = (hex) => {
    const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "");
    return r ? [parseInt(r[1],16), parseInt(r[2],16), parseInt(r[3],16)] : [11,31,58];
  };
  const brand = hexToRgb(company?.brand_color);
  const accent = hexToRgb(company?.brand_accent || "#C9A84C");
  const aed = (n) => "AED " + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dmy = (d) => d ? new Date(d).toLocaleDateString("en-GB") : "-";

  // Letterhead
  doc.setFillColor(brand[0], brand[1], brand[2]);
  doc.rect(0, 0, pageWidth, 40, "F");
  doc.setTextColor(255,255,255);
  doc.setFontSize(20); doc.setFont(undefined, "bold");
  doc.text(companyName, margin, 20);
  doc.setFontSize(10); doc.setFont(undefined, "normal");
  doc.text("PAYMENT RECEIPT", margin, 30);
  doc.setFontSize(9);
  doc.text("Date: " + dmy(new Date()), pageWidth - margin, 30, { align: "right" });

  let y = 54;
  // What was received - the headline
  doc.setFillColor(accent[0], accent[1], accent[2]);
  doc.rect(margin, y, contentWidth, 26, "F");
  doc.setTextColor(255,255,255);
  doc.setFontSize(9); doc.setFont(undefined, "normal");
  doc.text("RECEIVED WITH THANKS", margin + 5, y + 9);
  doc.setFontSize(18); doc.setFont(undefined, "bold");
  doc.text(aed(opp?.reservation_amount), margin + 5, y + 20);
  doc.setFontSize(9); doc.setFont(undefined, "normal");
  doc.text((opp?.reservation_method || "") + "  " + dmy(opp?.reservation_date), pageWidth - margin - 5, y + 20, { align: "right" });
  y += 36;

  doc.setTextColor(40,40,40);
  doc.setFontSize(10);
  const line = (label, value) => {
    doc.setFont(undefined, "normal"); doc.setTextColor(110,110,110);
    doc.text(label, margin, y);
    doc.setFont(undefined, "bold"); doc.setTextColor(30,30,30);
    doc.text(String(value || "-"), margin + 45, y);
    y += 7;
  };
  line("Received from", lead?.name);
  line("Property", (unit?.unit_ref || "") + (project?.name ? "  " + project.name : ""));
  line("Agreed price", aed(opp?.current_agreed_price));
  line("Payment plan", opp?.current_payment_plan_preset || "-");
  if (opp?.reservation_cheque_no) line("Cheque no.", opp.reservation_cheque_no);
  y += 4;
  // The balance - why this receipt matters
  doc.setFillColor(248, 250, 252);
  doc.rect(margin, y, contentWidth, 9, "F");
  doc.setFontSize(9); doc.setFont(undefined, "bold"); doc.setTextColor(70,70,70);
  doc.text("TO PROCEED TO SPA", margin + 3, y + 6);
  doc.text("AMOUNT", pageWidth - margin - 3, y + 6, { align: "right" });
  y += 14;

  const LABEL = {
    booking_fee: "Booking fee", reservation_fee: "Reservation fee",
    initial_advance: "First instalment (per plan)", spa_fee: "SPA fee",
    dld_fee: "DLD fee", oqood_fee: "Oqood fee", other_fees: "Other developer fees",
  };
  const ORDER = ["initial_advance","spa_fee","dld_fee","oqood_fee","other_fees"];
  doc.setFontSize(10); doc.setFont(undefined, "normal");
  let due = 0;
  ORDER.forEach((k) => {
    const r = ledger?.[k];
    if (!r || r.status === "waived") return;
    const outstanding = Number(r.expected_amount || 0) - Number(r.amount || 0);
    if (outstanding <= 0) return;
    due += outstanding;
    doc.setTextColor(60,60,60);
    doc.text(LABEL[k] || k, margin + 3, y);
    doc.text(aed(outstanding), pageWidth - margin - 3, y, { align: "right" });
    y += 7;
  });

  y += 2;
  doc.setDrawColor(200,200,200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;
  doc.setFontSize(12); doc.setFont(undefined, "bold"); doc.setTextColor(brand[0], brand[1], brand[2]);
  doc.text("BALANCE TO PROCEED", margin + 3, y);
  doc.text(aed(due), pageWidth - margin - 3, y, { align: "right" });
  y += 12;

  if (expiresOn) {
    doc.setFontSize(10); doc.setFont(undefined, "bold"); doc.setTextColor(180,30,30);
    doc.text("Payable on or before " + dmy(expiresOn) + " to hold this unit.", margin, y);
    y += 10;
  }

  // Footer
  doc.setFontSize(9); doc.setFont(undefined, "normal"); doc.setTextColor(110,110,110);
  y += 6;
  doc.text("Prepared by: " + (currentUser?.full_name || currentUser?.email || ""), margin, y); y += 6;
  if (currentUser?.phone) { doc.text("Contact: " + currentUser.phone, margin, y); y += 6; }
  y += 10;
  doc.setDrawColor(180,180,180);
  doc.line(margin, y, margin + 60, y);
  doc.text("Authorised signature", margin, y + 6);
  doc.setFontSize(8); doc.setTextColor(150,150,150);
  doc.text("This receipt confirms funds recorded against the above property reservation. Amounts remain subject to the developer's confirmation.", margin, 285, { maxWidth: contentWidth });

  const ref = (unit?.unit_ref || "receipt").replace(/[^A-Za-z0-9-]/g, "");
  doc.save("Receipt_" + ref + "_" + new Date().toISOString().slice(0,10) + ".pdf");
}
