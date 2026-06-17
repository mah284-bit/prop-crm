import jsPDF from 'jspdf';
import 'jspdf-autotable';

/**
 * Phase 2.2 — Proposal PDF Generator
 * Composes: cover page + unit details + amenities + payment plan
 * Input: proposal data, unit, project, lead
 * Output: PDF blob ready to download
 */

export async function generateProposalPDF({
  lead,
  coverNotes,
  proposalUnits,
  selectedPaymentPlan,
  validityDays,
  unit,
  project,
  currentUser,
}) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPos = 20;

  // ============ PAGE 1: COVER ============
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(24);
  doc.text('Property Proposal', pageWidth / 2, yPos, { align: 'center' });
  yPos += 15;

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(100, 100, 100);
  
  // Buyer name
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(lead?.name || 'Valued Client', pageWidth / 2, yPos, { align: 'center' });
  yPos += 12;

  // Date + broker
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(10);
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  doc.text(`Prepared: ${today}`, 20, yPos);
  doc.text(`By: ${currentUser?.name || 'Your Broker'}`, pageWidth - 60, yPos);
  yPos += 15;

  // Divider
  doc.setDrawColor(200, 200, 200);
  doc.line(20, yPos, pageWidth - 20, yPos);
  yPos += 12;

  // Cover notes
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(40, 40, 40);
  const noteLines = doc.splitTextToSize(coverNotes || 'Thank you for your interest.', pageWidth - 40);
  doc.text(noteLines, 20, yPos);
  yPos += noteLines.length * 6 + 15;

  // Property overview
  if (project && unit) {
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(26, 95, 168);
    doc.text('Property Overview', 20, yPos);
    yPos += 8;

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text(`Project: ${project.name || 'N/A'}`, 20, yPos);
    yPos += 6;
    doc.text(`Unit Type: ${unit.unit_type || 'N/A'}`, 20, yPos);
    yPos += 6;
    doc.text(`Size: ${unit.size_sqft || 'N/A'} sq ft`, 20, yPos);
    yPos += 6;
    doc.text(`Starting Price: AED ${(unit.starting_price || 0).toLocaleString()}`, 20, yPos);
    yPos += 12;
  }

  // Validity
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + (validityDays || 30));
  doc.text(`Valid until: ${expiryDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, 20, yPos);

  // ============ NEW PAGE: UNIT DETAILS & PRICING ============
  doc.addPage();
  yPos = 20;

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(26, 95, 168);
  doc.text('Pricing & Payment Plan', 20, yPos);
  yPos += 12;

  // Pricing table
  const tableData = proposalUnits.map(pu => {
    const u = unit?.id === pu.unit_id ? unit : null;
    return [
      u?.unit_type || 'Unit',
      `AED ${(pu.asking_price || 0).toLocaleString()}`,
      `${pu.discount_pct || 0}%`,
      `AED ${(pu.discounted_price || 0).toLocaleString()}`,
    ];
  });

  doc.autoTable({
    startY: yPos,
    head: [['Unit Type', 'Asking Price', 'Discount', 'Final Price']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [26, 95, 168], textColor: [255, 255, 255], fontSize: 10, fontStyle: 'bold' },
    bodyStyles: { fontSize: 10, textColor: [40, 40, 40] },
    alternateRowStyles: { fillColor: [245, 248, 252] },
    margin: { left: 20, right: 20 },
  });

  yPos = doc.lastAutoTable.finalY + 12;

  // Payment plan summary
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(40, 40, 40);
  doc.text(`Payment Plan: ${selectedPaymentPlan || '10/90'}`, 20, yPos);
  yPos += 6;

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text('Flexible payment schedule. Contact for detailed milestone breakdown.', 20, yPos);
  yPos += 12;

  // ============ NEW PAGE: AMENITIES (if available) ============
  if (project?.amenities && project.amenities.length > 0) {
    doc.addPage();
    yPos = 20;

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(26, 95, 168);
    doc.text('Community Amenities', 20, yPos);
    yPos += 12;

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    const amenityList = Array.isArray(project.amenities) ? project.amenities : JSON.parse(project.amenities || '[]');
    amenityList.forEach((amenity, idx) => {
      if (yPos > pageHeight - 20) {
        doc.addPage();
        yPos = 20;
      }
      doc.text(`• ${amenity}`, 20, yPos);
      yPos += 6;
    });
  }

  // ============ FINAL PAGE: CONTACT ============
  doc.addPage();
  yPos = 20;

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(26, 95, 168);
  doc.text('Next Steps', 20, yPos);
  yPos += 12;

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(80, 80, 80);
  const stepsText = `We're excited to show you this property.\n\nTo schedule a site visit or for questions, please contact us:`;
  const stepsLines = doc.splitTextToSize(stepsText, pageWidth - 40);
  doc.text(stepsLines, 20, yPos);
  yPos += stepsLines.length * 6 + 10;

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(currentUser?.name || 'Your Broker', 20, yPos);
  yPos += 6;

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Email: ${currentUser?.email || 'broker@propcrm.com'}`, 20, yPos);
  yPos += 6;
  doc.text(`Phone: ${currentUser?.phone || '+971 (0) 000 0000'}`, 20, yPos);

  return doc.output('blob');
}
