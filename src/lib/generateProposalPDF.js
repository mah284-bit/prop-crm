import { jsPDF } from 'jspdf';

/**
 * Phase 2.2 — Professional Branded Proposal PDF
 * Generates rich proposal with images, branding, pricing boxes
 */
export async function generateProposalPDF({
  lead,
  coverNotes,
  proposalUnits,
  selectedPaymentPlan,
  validityDays,
  dldHandling,
  dldCustomAmount,
  serviceChargePreset,
  serviceChargeCustom,
  unit,
  project,
  currentUser,
  company,
}) {
  
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;

  // Get company details
  const companyName = company?.name || 'Al Mansoori Properties';
  const brandColor = company?.brand_color || '#0B1F3A';
  const accentColor = company?.brand_accent || '#C9A84C';

  // Helper: RGB from hex
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : [11, 31, 58];
  };

  const brandRgb = hexToRgb(brandColor);
  const accentRgb = hexToRgb(accentColor);

  let yPos = margin;

  // Header background
  doc.setFillColor(brandRgb[0], brandRgb[1], brandRgb[2]);
  doc.rect(0, 0, pageWidth, 40, 'F');

  // Company name header
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont(undefined, 'bold');
  doc.text(companyName, margin, 20);

  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.text('PROPERTY PROPOSAL', margin, 30);

  yPos = 50;

  // Hero image
  if (project?.hero_image_base64 || project?.hero_image_url) {
    try {
      const heroImage = project.hero_image_base64 || project.hero_image_url;
      doc.addImage(heroImage, 'JPEG', margin, yPos, contentWidth, 80);
      yPos += 85;
    } catch (e) {
      console.warn('Hero image failed:', e);
      yPos += 10;
    }
  }

  // Property Overview Box - GF-01: one card per unit
  const _unitsToRender = (proposalUnits && proposalUnits.length > 0) ? proposalUnits : (unit ? [unit] : []);
  for (const _u of _unitsToRender) {
    if (yPos > pageHeight - 60) { doc.addPage(); yPos = margin; }
    doc.setFillColor(245, 249, 255);
    doc.rect(margin, yPos, contentWidth, 50, 'F');
    doc.setDrawColor(26, 95, 168);
    doc.setLineWidth(0.5);
    doc.rect(margin, yPos, contentWidth, 50);
  
    doc.setTextColor(15, 37, 64);
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text(`${_u?.unit_ref || 'N/A'} · ${project?.name || 'Property'}`, margin + 5, yPos + 8);
  
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Developer: ${project?.name || 'N/A'}`, margin + 5, yPos + 18);
    doc.text(`Unit: ${_u?.bedrooms || 'Studio'}BR · ${_u?.size_sqft || 'N/A'} sqft · ${_u?.view || 'N/A'}`, margin + 5, yPos + 24);
    doc.text(`Status: ${_u?.status || 'Available'}`, margin + 5, yPos + 30);
  
    yPos += 55;
  }

  // Photos
  if (project?.photo_gallery_urls && project.photo_gallery_urls.length > 0) {
    if (yPos > pageHeight - 100) {
      doc.addPage();
      yPos = margin;
    }
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(15, 37, 64);
    doc.text('Community Photos', margin, yPos);
    yPos += 8;

    const photoUrls = project.photo_gallery_urls.slice(0, 3);
    const photoWidth = (contentWidth - 4) / 3;
    const photoHeight = 40;

    for (let i = 0; i < photoUrls.length; i++) {
      const photoX = margin + i * (photoWidth + 2);
      try {
        const photoImage = project.photo_gallery_base64 ? project.photo_gallery_base64[i] : photoUrls[i];
        if (photoImage) {
          doc.addImage(photoImage, 'JPEG', photoX, yPos, photoWidth, photoHeight);
        }
      } catch (e) {
        console.error("Photo load failed:", e.message);
        doc.setFillColor(240, 240, 240);
        doc.rect(photoX, yPos, photoWidth, photoHeight, 'F');
      }
    }
    yPos += photoHeight + 8;
  }

  // Amenities
  if (project?.amenities && project.amenities.length > 0) {
    if (yPos > pageHeight - 60) {
      doc.addPage();
      yPos = margin;
    }
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(15, 37, 64);
    doc.text('Amenities', margin, yPos);
    yPos += 8;

    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    const amenities = project.amenities.slice(0, 8);
    for (let i = 0; i < amenities.length; i += 2) {
      doc.text(`✓ ${amenities[i]}`, margin + 5, yPos + (i / 2) * 5);
      if (amenities[i + 1]) {
        doc.text(`✓ ${amenities[i + 1]}`, margin + contentWidth / 2, yPos + (i / 2) * 5);
      }
    }
    yPos += (Math.ceil(amenities.length / 2)) * 5 + 5;
  }

  // Pricing Boxes
  if (yPos > pageHeight - 80) {
    doc.addPage();
    yPos = margin;
  }

  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(15, 37, 64);
  doc.text('Pricing & Payment Terms', margin, yPos);
  yPos += 10;

  const boxWidth = (contentWidth - 4) / 2;
  const boxes = [
    { title: 'Asking Price', value: proposalUnits[0]?.asking_price ? `AED ${Number(proposalUnits[0].asking_price).toLocaleString()}` : 'N/A' },
    { title: 'Discount', value: proposalUnits[0]?.discount_pct ? `${proposalUnits[0].discount_pct}%` : '0%' },
    { title: 'Final Price', value: proposalUnits[0]?.discounted_price ? `AED ${Number(proposalUnits[0].discounted_price).toLocaleString()}` : 'N/A' },
    { title: 'Payment Plan', value: selectedPaymentPlan || 'N/A' },
    // Day 84: DLD and the service-charge waiver were AGREED in the proposal builder and never
    // printed. On a 611,220 deal the DLD alone is 24,449 the buyer is bound by and could not see
    // on the document he was sent - while the app's own viewer showed it correctly. The buyer's
    // copy was the only place it was missing.
    // The AMOUNT is shown, not just the label: a buyer told "developer absorbs" does not know what
    // he has been saved; told "AED 24,449" he does, and a concession he can measure is worth more.
    // Absent terms read "To be discussed" - the same honesty the quick quote already uses for the
    // payment plan, rather than silence a buyer could read as agreement.
    { title: 'DLD Fee (4%)', value: (() => {
        const price = Number(proposalUnits[0]?.discounted_price || proposalUnits[0]?.asking_price || 0);
        const full = Math.round(price * 0.04);
        const aed = (n) => 'AED ' + Number(n).toLocaleString();
        if (!dldHandling) return 'To be discussed';
        if (dldHandling === 'buyer_pays')      return 'Buyer pays \u00b7 ' + aed(full);
        if (dldHandling === 'developer_pays')  return 'Developer absorbs \u00b7 ' + aed(full) + ' saved';
        if (dldHandling === 'split_5050')      return '50/50 split \u00b7 you pay ' + aed(Math.round(full/2));
        if (dldHandling === 'specific_amount') return dldCustomAmount ? (aed(dldCustomAmount) + ' waived \u00b7 you pay ' + aed(Math.max(0, full - Number(dldCustomAmount)))) : 'Specific amount waived';
        return 'To be discussed';
      })() },
    { title: 'Service Charge', value: (() => {
        if (!serviceChargePreset || serviceChargePreset === 'none') return 'Standard - no waiver';
        if (serviceChargePreset === 'custom') return serviceChargeCustom || 'Custom waiver';
        const m = { '6_months': '6 months waived', '1_year': '1 year waived', '2_years': '2 years waived' };
        return m[serviceChargePreset] || serviceChargePreset;
      })() },
  ];

  for (let i = 0; i < boxes.length; i++) {
    const boxX = margin + (i % 2) * (boxWidth + 4);
    const boxY = yPos + Math.floor(i / 2) * 32;

    doc.setFillColor(245, 249, 255);
    doc.rect(boxX, boxY, boxWidth, 28, 'F');
    doc.setDrawColor(accentRgb[0], accentRgb[1], accentRgb[2]);
    doc.setLineWidth(1);
    doc.rect(boxX, boxY, boxWidth, 28);

    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text(boxes[i].title, boxX + 4, boxY + 7);

    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(26, 95, 168);
    doc.text(boxes[i].value, boxX + 4, boxY + 18);
  }

  // Day 84: was a hard-coded 60 - two rows of boxes at 32mm plus a margin. Adding DLD and
  // Service Charge made it THREE rows, so the validity line drew 32mm too high and landed
  // INSIDE the grid, between Payment Plan and DLD. Derived from the box count now, so the
  // next term added will not break the layout again.
  yPos += Math.ceil(boxes.length / 2) * 32 - 4;

  // Validity
  if (yPos > pageHeight - 40) {
    doc.addPage();
    yPos = margin;
  }

  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(64, 118, 187);
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + Number(validityDays || 10));
  doc.text(`Valid until: ${expiryDate.toLocaleDateString('en-AE')}`, margin, yPos);

  return doc.output('blob');
}
