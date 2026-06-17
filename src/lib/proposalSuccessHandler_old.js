/**
 * proposalSuccessHandler.js
 * Handles all proposal success actions: download, WhatsApp, email
 */

export function downloadProposalPDF(pdfUrl) {
  window.open(pdfUrl, '_blank');
}

export function shareViaWhatsApp(pdfUrl, leadName, leadPhone) {
  if (!leadPhone) {
    console.warn('No phone number available for WhatsApp share');
    return;
  }

  const message = `Hi ${leadName}, here's your property proposal:\n\n${pdfUrl}`;
  const encodedMessage = encodeURIComponent(message);
  const cleanPhone = leadPhone.replace(/\D/g, ''); // Remove non-digits

  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
  window.open(whatsappUrl, '_blank');
}

export function shareViaEmail(pdfUrl, leadName, leadEmail) {
  if (!leadEmail) {
    console.warn('No email available for email share');
    return;
  }

  const subject = `Your Property Proposal - ${leadName}`;
  const body = `Hi ${leadName},\n\nPlease find attached your property proposal:\n\n${pdfUrl}\n\nBest regards`;

  const mailtoUrl = `mailto:${leadEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = mailtoUrl;
}

export function generateShareText(leadName, pdfUrl) {
  return {
    whatsapp: `Hi ${leadName}, here's your property proposal: ${pdfUrl}`,
    email: {
      subject: `Your Property Proposal`,
      body: `Hi ${leadName},\n\nPlease find your property proposal:\n${pdfUrl}\n\nBest regards`,
    },
  };
}
