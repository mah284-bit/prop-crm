      {step === 4 && (
        <div style={{ textAlign: 'center', padding: '16px' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>✅</div>
          <h4 style={{ margin: '0 0 4px 0', fontSize: '13px', fontWeight: '700' }}>Proposal Sent!</h4>
          <p style={{ margin: '0 0 12px 0', fontSize: '11px', color: '#94A3B8' }}>PDF sent to {leadEmail}</p>
          <button onClick={handleReset} style={{ padding: '8px 12px', borderRadius: '6px', border: 'none', background: '#0F2540', color: '#fff', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>← Back</button>
        </div>
      )}

      {successPdfUrl && (
        <ProposalSuccessDialog
          pdfUrl={successPdfUrl}
          leadName={leadName}
          leadEmail={leadEmail}
          leadPhone={leadPhone}
          onClose={() => {
            setSuccessPdfUrl(null);
            setStep(0);
            setSelectedUnits([]);
          }}
        />
      )}
    </div>
  );
}
