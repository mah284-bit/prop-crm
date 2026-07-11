import { PDFDocument } from 'pdf-lib';

/**
 * Merge multiple PDF blobs/URLs into one PDF
 * @param {Array} pdfs - Array of {blob, title?} or URLs
 * @returns {Promise<Blob>} - Merged PDF blob
 */
export async function mergePDFs(pdfs) {
  const mergedPdf = await PDFDocument.create();
  
  for (const pdf of pdfs) {
    let pdfBuffer;
    
    // Handle blob or URL
    if (pdf.blob) {
      pdfBuffer = await pdf.blob.arrayBuffer();
    } else if (typeof pdf === 'string') {
      // URL
      const response = await fetch(pdf);
      pdfBuffer = await response.arrayBuffer();
    } else {
      // Direct blob
      pdfBuffer = await pdf.arrayBuffer();
    }
    
    // Load and copy pages
    const srcPdf = await PDFDocument.load(pdfBuffer);
    const pages = await mergedPdf.copyPages(srcPdf, srcPdf.getPageIndices());
    pages.forEach(page => mergedPdf.addPage(page));
  }
  
  const pdfBytes = await mergedPdf.save();
  return new Blob([pdfBytes], {type: 'application/pdf'});
}
