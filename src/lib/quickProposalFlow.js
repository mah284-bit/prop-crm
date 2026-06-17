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

    // Fetch project data for primary unit
    const { data: project, error: projErr } = await supabase
      .from('projects')
      .select('*')
      .eq('id', primaryUnit.project_id)
      .single();

    if (projErr || !project) {
      throw new Error('Project not found for unit');
    }

    console.log('Project loaded:', project.name);

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
      project: project,
      company: company,
      currentUser: currentUser,
    });

    console.log('PDF generated');

    const timestamp = Date.now();
    const filename = `quick-proposal-${leadId.substring(0, 8)}-${timestamp}.pdf`;
    const pdfUrl = await uploadProposalPDF(pdfBlob, filename, currentUser.company_id);

    console.log('PDF uploaded:', pdfUrl);

    // Save pdf_url to proposals table
    const { data, error } = await supabase
      .from('proposals')
      .insert({
        pdf_url: pdfUrl,
        status: 'sent',
        created_at: new Date().toISOString(),
        created_by: currentUser.id,
      })
      .select()
      .single();

    if (error) {
      console.error('❌ DB insert error:', error);
      throw error;
    }

    console.log('✅ Proposal saved:', data.id);

    return {
      success: true,
      proposalId: data.id,
      pdfUrl: pdfUrl,
    };

  } catch (error) {
    console.error('❌ Failed to send proposal:', error);
    throw new Error(`Failed to send proposal: ${error.message}`);
  }
}
