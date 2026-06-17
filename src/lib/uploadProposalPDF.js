import { supabase } from './supabase.js';

/**
 * Upload proposal PDF to Supabase Storage
 * Returns public URL if successful
 */
export async function uploadProposalPDF(pdfBlob, fileName, companyId) {
  if (!pdfBlob || !companyId) {
    throw new Error('PDF blob and company ID required');
  }

  const fileNameSafe = fileName.replace(/[^a-z0-9._-]/gi, '_').toLowerCase();
  const timestamp = Date.now();
  const storagePath = `private/proposals/${companyId}/${timestamp}_${fileNameSafe}`;

  const { data, error } = await supabase.storage
    .from('property-pack')
    .upload(storagePath, pdfBlob, {
      contentType: 'application/pdf',
      upsert: false,
    });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  // Get public URL
  const { data: publicData } = supabase.storage
    .from('property-pack')
    .getPublicUrl(storagePath);

  return publicData?.publicUrl || null;
}
