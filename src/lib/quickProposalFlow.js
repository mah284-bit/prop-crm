import { supabase } from "./supabase";
import { generateProposalPDF } from "./generateProposalPDF";
import { uploadProposalPDF } from "./uploadProposalPDF";

export async function sendQuickProposal({
  leadId,
  leadEmail,
  leadName,
  selectedUnits,
  company,
  currentUser,
}) {
  if (!selectedUnits || selectedUnits.length === 0) {
    throw new Error('No units selected');
  }

  try {
    console.log('Sending quick proposal with', selectedUnits.length, 'units...');

    const primaryUnit = selectedUnits[0];

    const pdfBlob = await generateProposalPDF({
      lead: { name: leadName, email: leadEmail },
      proposalUnits: selectedUnits.map(u => ({
        unit_id: u.id,
        unit_ref: u.unit_ref,
        asking_price: u.price,
        bedrooms: u.bedrooms,
        size_sqft: u.size_sqft,
      })),
      selectedPaymentPlan: 'To be discussed',
      validityDays: 10,
      unit: primaryUnit,
      project: { name: company.name },
      company: company,
      currentUser: currentUser,
    });

    const timestamp = Date.now();
    const filename = `quick-proposal-${leadId.substring(0, 8)}-${timestamp}.pdf`;
    const pdfUrl = await uploadProposalPDF(pdfBlob, filename, company.id);

    const { data, error } = await supabase
      .from('proposals')
      .insert({
        lead_id: leadId,
        type: 'quick_send',
        units_quoted: selectedUnits.map(u => u.id),
        pdf_url: pdfUrl,
        status: 'sent',
        created_at: new Date().toISOString(),
        created_by: currentUser.id,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      proposalId: data.id,
      pdfUrl: pdfUrl,
    };

  } catch (error) {
    console.error('Failed to send proposal:', error);
    throw new Error(`Failed to send proposal: ${error.message}`);
  }
}
