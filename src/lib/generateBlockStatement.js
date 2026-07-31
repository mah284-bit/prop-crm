import { jsPDF } from "jspdf";

// Day 80: THE BLOCK STATEMENT - what the buyer receives.
// Founder: "a report showing the block first and then the split - collections information,
// everything from one place. If the buyer asks for the split we send it, because he should know
// his investment on each unit for either selling later, renting, or handing over to family."
// The per-unit section is the buyer's ASSET REGISTER: he bought as one arrangement but will
// dispose one at a time, and for each he needs that unit's cost basis.
// It prints the RECORDED ALLOCATION, never a tidier pro-rata recomputed at print time.
export function generateBlockStatement({ block, buyer, company, blockBill, paidByParticular, paidByUnit, childRows, dLatest }) {
  const doc = new jsPDF("p", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 16;
  const W = pageWidth - 2 * margin;
  const hexToRgb = (hex) => {
    const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "");
    return r ? [parseInt(r[1],16), parseInt(r[2],16), parseInt(r[3],16)] : [11,31,58];
  };
  const brand = hexToRgb(company?.brand_color);
  // Whole dirhams: the bill sums per-unit expecteds rounded independently, so it can sit a few
  // fils from a collection allocated off the exact total. Immaterial, and every other surface
  // shows whole dirhams.
  const aed = (n) => "AED " + Math.round(Number(n || 0)).toLocaleString();
  const dmy = (d) => d ? new Date(d).toLocaleDateString("en-GB") : "-";

  doc.setFillColor(brand[0], brand[1], brand[2]);
  doc.rect(0, 0, pageWidth, 38, "F");
  doc.setTextColor(255,255,255);
  doc.setFontSize(19); doc.setFont(undefined, "bold");
  doc.text(company?.name || "Al Mansoori Properties", margin, 19);
  doc.setFontSize(10); doc.setFont(undefined, "normal");
  doc.text("BLOCK STATEMENT", margin, 29);
  doc.setFontSize(9);
  doc.text("Date: " + dmy(new Date()), pageWidth - margin, 29, { align: "right" });

  let y = 50;
  doc.setTextColor(30,30,30);
  doc.setFontSize(13); doc.setFont(undefined, "bold");
  doc.text(block.title || "Block", margin, y); y += 7;
  doc.setFontSize(10); doc.setFont(undefined, "normal"); doc.setTextColor(90,90,90);
  doc.text("Buyer: " + (buyer?.name || "-") + "   |   Units: " + (childRows || []).length
    + (block.developer_name ? "   |   Developer: " + block.developer_name : ""), margin, y); y += 6;
  if (dLatest?.payment_plan_preset) {
    doc.text("Payment plan: " + dLatest.payment_plan_preset + "   |   DLD: " + (dLatest.dld_payer || "buyer"), margin, y);
    y += 6;
  }
  y += 4;

  // SECTION 1 - THE BLOCK
  doc.setFontSize(11); doc.setFont(undefined, "bold"); doc.setTextColor(brand[0],brand[1],brand[2]);
  doc.text("THE BLOCK", margin, y); y += 6;
  doc.setFillColor(245,247,250); doc.rect(margin, y - 4, W, 7, "F");
  doc.setFontSize(9); doc.setTextColor(70,70,70);
  doc.text("Particular", margin + 2, y); doc.text("Bill", margin + 95, y, {align:"right"});
  doc.text("Collected", margin + 135, y, {align:"right"}); doc.text("Outstanding", pageWidth - margin - 2, y, {align:"right"});
  y += 8;
  const resGot = (childRows||[]).reduce((t,r)=>t+Number(r.child?.reservation_amount||0),0);
  const ROWS = [
    ["Reservation", Number(blockBill?.tot?.reservation||0), resGot],
    ["First instalments (per plan)", Number(blockBill?.tot?.initial||0), Number(paidByParticular?.initial_advance||0)],
    ["SPA fees", Number(blockBill?.tot?.spa||0), Number(paidByParticular?.spa_fee||0)],
    ["DLD fees", Number(blockBill?.tot?.dld||0), Number(paidByParticular?.dld_fee||0)],
    ["Oqood fees", Number(blockBill?.tot?.oqood||0), Number(paidByParticular?.oqood_fee||0)],
  ];
  doc.setFont(undefined, "normal");
  let tBill = 0, tGot = 0;
  ROWS.forEach(([lbl, bill, got]) => {
    const left = Math.max(0, bill - got);
    tBill += bill; tGot += got;
    doc.setTextColor(60,60,60); doc.text(lbl, margin + 2, y);
    doc.text(aed(bill), margin + 95, y, {align:"right"});
    doc.text(got > 0 ? aed(got) : "-", margin + 135, y, {align:"right"});
    doc.setTextColor(left > 0.5 ? 180 : 22, left > 0.5 ? 30 : 101, left > 0.5 ? 30 : 52);
    doc.text(left > 0.5 ? aed(left) : "Nil", pageWidth - margin - 2, y, {align:"right"});
    y += 6.5;
  });
  y += 1; doc.setDrawColor(200,200,200); doc.line(margin, y, pageWidth - margin, y); y += 6;
  doc.setFont(undefined, "bold"); doc.setTextColor(brand[0],brand[1],brand[2]);
  doc.text("Total", margin + 2, y);
  doc.text(aed(tBill), margin + 95, y, {align:"right"});
  doc.text(aed(tGot), margin + 135, y, {align:"right"});
  doc.text((tBill - tGot) > 0.5 ? aed(tBill - tGot) : "Nil", pageWidth - margin - 2, y, {align:"right"});
  y += 14;

  // SECTION 2 - PER UNIT (the buyer's asset register)
  doc.setFontSize(11); doc.setTextColor(brand[0],brand[1],brand[2]);
  doc.text("PER UNIT", margin, y); y += 5;
  doc.setFontSize(8); doc.setFont(undefined, "normal"); doc.setTextColor(120,120,120);
  doc.text("Each unit's own cost basis - what you need when selling, renting or transferring one.", margin, y); y += 6;
  doc.setFillColor(245,247,250); doc.rect(margin, y - 4, W, 7, "F");
  doc.setFontSize(9); doc.setTextColor(70,70,70);
  const CX = [margin + 2, margin + 56, margin + 90, margin + 118, margin + 143, pageWidth - margin - 2];
  ["Unit","Net price","Instalment","DLD","Fees","Paid"].forEach((h,i) => doc.text(h, CX[i], y, {align: i === 0 ? "left" : "right"}));
  y += 8;
  doc.setFont(undefined, "normal");
  (blockBill?.per || []).forEach((u) => {
    const res = Number(((childRows||[]).find(r => r.child?.id === u.child_id)?.child?.reservation_amount) || 0);
    const rest = Object.keys(paidByUnit || {}).filter(k => k.endsWith("|" + u.child_id)).reduce((t,k)=>t+Number(paidByUnit[k]||0),0);
    const fees = Number(u.bill?.spa_fee?.expected||0) + Number(u.bill?.oqood_fee?.expected||0);
    doc.setTextColor(30,30,30); doc.setFont(undefined, "bold"); doc.text(u.unit_ref || "-", CX[0], y);
    doc.setFont(undefined, "normal"); doc.setTextColor(60,60,60);
    doc.text(aed(u.price), CX[1], y, {align:"right"});
    doc.text(aed(u.bill?.initial_advance?.expected), CX[2], y, {align:"right"});
    doc.text(aed(u.bill?.dld_fee?.waived ? 0 : u.bill?.dld_fee?.expected), CX[3], y, {align:"right"});
    doc.text(aed(fees), CX[4], y, {align:"right"});
    doc.setTextColor(22,101,52); doc.setFont(undefined, "bold");
    doc.text(aed(res + rest), CX[5], y, {align:"right"});
    doc.setFont(undefined, "normal");
    y += 7;
  });
  doc.setFontSize(8); doc.setTextColor(150,150,150);
  doc.text("Amounts shown are as recorded against this block. Allocations reflect what was actually applied to each unit.", margin, 288, { maxWidth: W });
  doc.save("Block_Statement_" + String(block.title||"block").replace(/[^A-Za-z0-9-]/g,"_") + "_" + new Date().toISOString().slice(0,10) + ".pdf");
}
