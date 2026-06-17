import { jsPDF } from 'jspdf';

/**
 * Phase 2.2 — Proposal PDF Generator (simplified)
 * Generates text-based proposal PDF without autoTable
 * Output: PDF blob ready to upload
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
  let yPos = 20;

  // Page 1: Cover
  doc.setFontSize(24);
  doc.text('Proposal', 20, yPos);
  yPos += 15;

  doc.setFontSize(12);
  doc.text(`For: ${lead.name}`, 20, yPos);
  yPos += 8;
  doc.text(`Date: ${new Date().toLocaleDateString('en-AE')}`, 20, yPos);
  yPos += 8;
  doc.text(`Broker: ${currentUser?.full_name || 'Al Mansoori Properties'}`, 20, yPos);
  yPos += 15;

  doc.setFontSize(11);
  doc.text('Cover Notes:', 20, yPos);
  yPos += 6;
  const coverLines = doc.splitTextToSize(coverNotes || 'N/A', 170);
  doc.text(coverLines, 20, yPos);
  yPos += coverLines.length * 5 + 10;

  // Unit details
  if (unit) {
    doc.setFontSize(11);
    doc.text(`Unit: ${unit.unit_ref}`, 20, yPos);
    yPos += 6;
    doc.text(`Type: ${unit.bedrooms || 0}BR | Size: ${unit.size_sqft} sqft`, 20, yPos);
    yPos += 6;
  }

  // Payment plan
  if (selectedPaymentPlan) {
    yPos += 5;
    doc.setFontSize(11);
    doc.text('Payment Plan:', 20, yPos);
    yPos += 6;
    doc.text(selectedPaymentPlan, 20, yPos);
  }

  // Validity
  yPos += 10;
  doc.setFontSize(10);
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + Number(validityDays || 10));
  doc.text(`Valid until: ${expiryDate.toLocaleDateString('en-AE')}`, 20, yPos);

  return doc.output('blob');
}
