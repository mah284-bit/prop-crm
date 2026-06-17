import { supabase } from './supabaseClient';
import { generateProposalPDF } from './generateProposalPDF';
import { uploadProposalPDF } from './uploadProposalPDF';
import { sendEmail } from './sendEmail';

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
  if (!leadEmail) {
    throw new Error('Lead email is required');
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
        sub_type: u.sub_type,
        view: u.view,
      })),
      selectedPaymentPlan: 'To be discussed',
      validityDays: 10,
      unit: primaryUnit,
      project: { name: company.name },
      company: company,
      currentUser: currentUser,
    });

    console.log('Uploading PDF to Storage...');
    
    const timestamp = Date.now();
    const filename = `quick-proposal-${leadId.substring(0, 8)}-${timestamp}.pdf`;
    
    const pdfUrl = await uploadProposalPDF(pdfBlob, filename, company.id);

    console.log('Sending email to', leadEmail);
    
    const unitSummary = selectedUnits
      .map(u => `${u.unit_ref} (${u.bedrooms === 0 ? 'Studio' : `${u.bedrooms}BR`})`)
      .join(', ');

    await sendEmail({
      to: leadEmail,
      subject: `${company.name} - Your Property Options`,
      context: {
        leadName: leadName,
        companyName: company.name,
        unitCount: selectedUnits.length,
        unitSummary: unitSummary,
        pdfUrl: pdfUrl,
        companyPhone: company.phone || 'Contact us',
        companyEmail: company.email || 'info@company.ae',
      },
      attachmentUrl: pdfUrl,
    });

    console.log('Saving proposal record...');
    
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

    console.log('✅ Quick proposal sent successfully!');

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
