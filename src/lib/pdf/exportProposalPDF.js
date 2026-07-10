import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export const exportProposalPDF = async (elementId, filename) => {
  const element = document.getElementById(elementId);
  if (!element) return false;
  const canvas = await html2canvas(element, {scale: 2, useCORS: true, logging: false, backgroundColor: "#ffffff"});
  const pdf = new jsPDF({orientation: "portrait", unit: "mm", format: "a4"});
  const pageHeight = pdf.internal.pageSize.getHeight();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const imgHeight = (canvas.height * pageWidth) / canvas.width;
  let heightLeft = imgHeight;
  let position = 0;
  const imgData = canvas.toDataURL("image/png");
  while (heightLeft > 0) {
    pdf.addImage(imgData, "PNG", 0, position, pageWidth, imgHeight);
    heightLeft -= pageHeight;
    position -= pageHeight;
    if (heightLeft > 0) pdf.addPage();
  }
  pdf.save(filename || "proposal.pdf");
  return true;
};
