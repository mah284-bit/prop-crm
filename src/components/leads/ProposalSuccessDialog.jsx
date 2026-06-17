import React from 'react';
import { downloadProposalPDF, shareViaWhatsApp, shareViaEmail } from '../../lib/proposalSuccessHandler';

export function ProposalSuccessDialog({ pdfUrl, leadName, leadEmail, leadPhone, onClose }) {
  const handleDownload = async () => {
    await downloadProposalPDF(pdfUrl);
  };

  const handleWhatsApp = () => {
    shareViaWhatsApp(pdfUrl, leadName, leadPhone);
  };

  const handleEmail = () => {
    shareViaEmail(pdfUrl, leadName, leadEmail);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(15, 37, 64, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 8,
        padding: 24,
        maxWidth: 400,
        boxShadow: '0 10px 40px rgba(15, 37, 64, 0.2)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <h2 style={{ margin: '0 0 8px 0', color: '#0F2540', fontSize: 18, fontWeight: 700 }}>
            Proposal Sent!
          </h2>
          <p style={{ margin: 0, color: '#64748B', fontSize: 14 }}>
            PDF ready to share with {leadName}
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          <button
            onClick={handleDownload}
            style={{
              padding: '12px 16px',
              borderRadius: 6,
              border: 'none',
              background: '#0F2540',
              color: '#fff',
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            📥 Download PDF
          </button>

          {leadPhone && (
            <button
              onClick={handleWhatsApp}
              style={{
                padding: '12px 16px',
                borderRadius: 6,
                border: '1px solid #0F2540',
                background: '#fff',
                color: '#0F2540',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              💬 Share on WhatsApp
            </button>
          )}

          {leadEmail && (
            <button
              onClick={handleEmail}
              style={{
                padding: '12px 16px',
                borderRadius: 6,
                border: '1px solid #0F2540',
                background: '#fff',
                color: '#0F2540',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              ✉️ Send Email
            </button>
          )}
        </div>

        <button
          onClick={onClose}
          style={{
            width: '100%',
            padding: '10px 16px',
            borderRadius: 6,
            border: '1px solid #E2E8F0',
            background: '#fff',
            color: '#64748B',
            fontWeight: 600,
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
