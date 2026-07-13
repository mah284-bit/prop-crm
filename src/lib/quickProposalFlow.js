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


    const timestamp = Date.now();
    const filename = `quick-proposal-${leadId.substring(0, 8)}-${timestamp}.pdf`;
    const pdfUrl = await uploadProposalPDF(pdfBlob, filename, currentUser.company_id);


    // Log activity: proposal sent
    try {
      // Count existing proposals to get version
      const { data: existingProposals } = await supabase
        .from('activities')
        .select('*')
        .eq('lead_id', leadId)
        .eq('type', 'proposal_sent');
      const version = (existingProposals?.length || 0) + 1;

      await supabase.from('activities').insert({
        lead_id: leadId,
        company_id: currentUser.company_id,
        type: 'proposal_sent',
        note: `Sent proposal v${version} for ${selectedUnits.map(u => u.unit_ref).join(', ')}`,
        structured_data: {
          pdf_url: pdfUrl,
          units_quoted: selectedUnits.map(u => ({
            id: u.id,
            unit_ref: u.unit_ref,
            bedrooms: u.bedrooms,
            price: u.price,
          })),
          unit_count: selectedUnits.length,
        },
        user_id: currentUser.id,
        user_name: currentUser.name || 'Unknown',
      });
    } catch (activityErr) {
      console.error('⚠️ Activity logging failed (non-blocking):', activityErr);
      // Don't throw - proposal was sent successfully
    }

    return {
      success: true,
      pdfUrl: pdfUrl,
    };
  } catch (error) {
    console.error('❌ Failed to send proposal:', error);
    throw new Error(`Failed to send proposal: ${error.message}`);
  }
}
