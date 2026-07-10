import React, { useRef } from "react";
import { exportProposalPDF } from "../../lib/pdf/exportProposalPDF.js";
import Btn from "../Btn.jsx";

export default function DownloadProposalPDFBtn({ proposal, opportunity, currentUser, disabled = false }) {
  const templateRef = useRef(null);

  const handleDownload = async () => {
    if (!templateRef.current) return;
    const filename = `Proposal_${opportunity?.id || "unknown"}.pdf`;
    const success = await exportProposalPDF("proposal-template-hidden", filename);
    if (success) {
      console.log("PDF downloaded:", filename);
    } else {
      alert("Failed to generate PDF. Please try again.");
    }
  };

  return (
    <>
      {/* Hidden template for PDF generation */}
      <div id="proposal-template-hidden" style={{display: "none"}} ref={templateRef}>
        {/* ProposalPDFTemplate will be rendered here by parent */}
      </div>

      {/* Download button */}
      <Btn
        onClick={handleDownload}
        variant="gold"
        disabled={disabled || !proposal}
      >
        📥 Download PDF
      </Btn>
    </>
  );
}
