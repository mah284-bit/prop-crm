import React from "react";
import { fmtAED, fmtDate } from "../../lib/format.js";

export default function ProposalPDFTemplate({ proposal, currentUser, opportunity }) {
  if (!proposal || !opportunity) return null;

  const company = currentUser?.company;
  const branding = company?.company_branding || {};
  const colors = branding.brand_colors || { primary: "#0F2540", secondary: "#C9A84C" };

  return (
    <div style={{
      fontFamily: "Arial, sans-serif",
      maxWidth: "800px",
      margin: "0 auto",
      padding: "40px",
      color: "#333"
    }}>
      <div style={{ pageBreakAfter: "always", marginBottom: "60px" }}>
        <div style={{
          borderBottom: `3px solid ${colors.secondary}`,
          paddingBottom: "20px",
          marginBottom: "40px"
        }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: colors.primary, marginBottom: 8 }}>
            ◆ {company?.name || "PropCRM"}
          </div>
          <div style={{ fontSize: 12, color: "#666" }}>
            {company?.address || "Real Estate Brokerage"}
          </div>
        </div>

        <div style={{ marginBottom: 30 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: colors.primary, marginBottom: 10 }}>
            Property Proposal
          </div>
          <div style={{ fontSize: 11, color: "#666", lineHeight: 1.6 }}>
            <div><strong>Prepared for:</strong> {opportunity?.lead_name || "Buyer"}</div>
            <div><strong>Date:</strong> {fmtDate(new Date())}</div>
            <div><strong>Reference:</strong> {opportunity?.id || "---"}</div>
          </div>
        </div>

        <div style={{
          background: "#f9f9f9",
          padding: 20,
          borderRadius: 8,
          marginTop: 30
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: colors.primary }}>
            {opportunity?.unit_name || "Unit Details"}
          </div>
          <table style={{ width: "100%", fontSize: 11, lineHeight: 1.8 }}>
            <tbody>
              <tr>
                <td style={{ fontWeight: 600, width: "50%" }}>Project:</td>
                <td>{opportunity?.project_name || "---"}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Type:</td>
                <td>{opportunity?.unit_type || "---"}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ pageBreakAfter: "always", marginBottom: "60px" }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: colors.primary, marginBottom: 20 }}>
          Proposal Terms
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 30, fontSize: 11 }}>
          <tbody>
            <tr style={{ borderBottom: `1px solid ${colors.secondary}` }}>
              <td style={{ padding: 12, fontWeight: 600 }}>Net Price:</td>
              <td style={{ padding: 12, textAlign: "right", fontWeight: 700 }}>
                {fmtAED(proposal?.net_price)}
              </td>
            </tr>
            <tr>
              <td style={{ padding: 12 }}>Final Price:</td>
              <td style={{ padding: 12, textAlign: "right", fontWeight: 700 }}>
                {fmtAED(proposal?.final_price)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div>
        <div style={{ fontSize: 18, fontWeight: 700, color: colors.primary, marginBottom: 40 }}>
          Acceptance
        </div>
        <div style={{ borderTop: `1px solid ${colors.secondary}`, paddingTop: 20, marginTop: 40, fontSize: 9, color: "#999", textAlign: "center" }}>
          {branding.footer_text || `${company?.name || "PropCRM"} | Confidential`}
        </div>
      </div>
    </div>
  );
}
