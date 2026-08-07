import jsPDF from "jspdf";

// Day 87: THE BLOCK PROPOSAL PDF.
//
// Until now "sent" was notional: a block proposal existed as a row in the app with its terms, and
// nothing the buyer could hold. The 1-to-1 has a PDF on every version; the block had none - so a
// buyer was being asked for 75,000 against a document that did not exist.
//
// WHAT THE BUYER SEES, and what he does not:
//   - PER-UNIT NET PRICES, so he knows what each unit costs him.
//   - ONE BLOCK DISCOUNT figure, not a per-unit breakdown. Showing the split invites an argument
//     about which unit got what, when the concession was granted for the block as a whole.
//   - NOT the commission, NOT the developer's approval reference, NOT anything internal.
//
// Rendered from the SENT VERSION's structured_data - never from the live calculator - so what is
// printed is exactly what was offered, even after the terms have moved on.

export function generateBlockProposal({ proposal, block, buyer, company }) {
  const sd = proposal?.structured_data || {};
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

  doc.setFillColor(brand[0], brand[1], brand[2]);
  doc.rect(0, 0, pageWidth, 38, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(19);
  doc.setFont(undefined, "bold");
  doc.text(company?.name || "Al Mansoori Properties", margin, 19);
  doc.setFontSize(10);
  doc.setFont(undefined, "normal");
  doc.text("PROPOSAL - MULTIPLE UNITS", margin, 29);
  doc.setFontSize(9);
  doc.text("Version " + (proposal?.version ?? "-") + "   |   " + dmy(proposal?.sent_at), pageWidth - margin, 29, { align: "right" });

  let y = 50;
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(13);
  doc.setFont(undefined, "bold");
  doc.text(block?.title || "Block", margin, y);
  y += 7;

  doc.setFontSize(10);
  doc.setFont(undefined, "normal");
  doc.setTextColor(90, 90, 90);
  doc.text(
    "Prepared for: " + (buyer?.name || "-") +
      "   |   Units: " + (sd.unit_count || 0) +
      (block?.developer_name ? "   |   Developer: " + block.developer_name : ""),
    margin, y
  );
  y += 6;

  const dldLabel = {
    buyer_pays: "Buyer pays (4%)",
    developer_pays: "Developer absorbs",
    split_5050: "50/50 with the developer",
    buyer: "Buyer pays (4%)",
    developer: "Developer absorbs",
    split: "50/50 with the developer",
    negotiated: "Negotiated",
  }[sd.dld_handling] || (sd.dld_handling || "-");
  doc.text("Payment plan: " + (sd.payment_plan || "-") + "   |   DLD: " + dldLabel, margin, y);
  y += 10;

  // The offer, in one line the buyer can read at a glance.
  doc.setFillColor(246, 249, 252);
  doc.rect(margin, y - 5, W, 26, "F");
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(10);
  doc.setFont(undefined, "normal");
  doc.text("List price for " + (sd.unit_count || 0) + " unit(s)", margin + 4, y + 2);
  doc.text(aed(sd.total_list_price), pageWidth - margin - 4, y + 2, { align: "right" });
  doc.setTextColor(brand[0], brand[1], brand[2]);
  doc.setFont(undefined, "bold");
  doc.text("Block discount" + (sd.block_discount_pct ? " (" + sd.block_discount_pct + "%)" : ""), margin + 4, y + 9);
  doc.text("- " + aed(sd.block_discount_amount), pageWidth - margin - 4, y + 9, { align: "right" });
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(12);
  doc.text("Total payable", margin + 4, y + 17);
  doc.text(aed(sd.total_value), pageWidth - margin - 4, y + 17, { align: "right" });
  y += 32;

  // Per-unit schedule. NET prices only - the discount split between units is ours, not his.
  doc.setFontSize(11);
  doc.setFont(undefined, "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("Units in this proposal", margin, y);
  y += 6;

  doc.setFillColor(240, 243, 247);
  doc.rect(margin, y - 4, W, 8, "F");
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  doc.text("Unit", margin + 3, y + 1);
  doc.text("Description", margin + 38, y + 1);
  doc.text("Price", pageWidth - margin - 3, y + 1, { align: "right" });
  y += 9;

  doc.setTextColor(30, 30, 30);
  doc.setFont(undefined, "normal");
  (sd.proposal_units || []).forEach((u) => {
    if (y > 250) { doc.addPage(); y = 24; }
    const desc = [
      u.bedrooms === 0 ? "Studio" : u.bedrooms ? u.bedrooms + "BR" : null,
      u.size_sqft ? u.size_sqft + " sqft" : null,
    ].filter(Boolean).join(" · ");
    doc.setFont(undefined, "bold");
    doc.text(String(u.unit_ref || "-"), margin + 3, y);
    doc.setFont(undefined, "normal");
    doc.setTextColor(90, 90, 90);
    doc.text(desc || "-", margin + 38, y);
    doc.setTextColor(30, 30, 30);
    doc.text(aed(u.discounted_price), pageWidth - margin - 3, y, { align: "right" });
    y += 7;
  });

  y += 4;
  doc.setDrawColor(220, 226, 233);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  if (sd.reservation_expected) {
    doc.setFontSize(10);
    doc.setFont(undefined, "bold");
    doc.text("To reserve these units: " + aed(sd.reservation_expected), margin, y);
    y += 7;
  }

  doc.setFont(undefined, "normal");
  doc.setFontSize(9);
  doc.setTextColor(110, 110, 110);
  const terms = [
    "Prices are quoted for these units taken together. The discount reflects the combined purchase and",
    "does not apply to any unit bought separately.",
    "Each unit is registered individually with the Dubai Land Department and carries its own SPA and",
    "Oqood certificate.",
    "This proposal supersedes any earlier version and is subject to the developer's confirmation.",
  ];
  terms.forEach((t) => { doc.text(t, margin, y); y += 5; });

  return doc.output("blob");
}
