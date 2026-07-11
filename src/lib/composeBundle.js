import { mergePDFs } from './mergePDFs.js';

/**
 * Compose bundle: proposal PDF + optional docs
 * @param {Object} options - {proposalPdfUrl, brochureUrl?, floorPlanUrl?, otherDocs?}
 * @returns {Promise<Blob>} - Merged bundle
 */
export async function composeBundle(options) {
  const { proposalPdfUrl, brochureUrl, floorPlanUrl, otherDocs = [] } = options;
  
  if (!proposalPdfUrl) throw new Error('Proposal PDF required');
  
  const pdfs = [];
  
  // Always include proposal first
  pdfs.push(proposalPdfUrl);
  
  // Add optional docs if provided
  if (brochureUrl) pdfs.push(brochureUrl);
  if (floorPlanUrl) pdfs.push(floorPlanUrl);
  
  // Add any other docs
  pdfs.push(...otherDocs);
  
  // Merge all PDFs
  const bundleBlob = await mergePDFs(pdfs);
  return bundleBlob;
}

/**
 * Download bundle to user device
 */
export function downloadBundle(blob, fileName = 'property-bundle.pdf') {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
