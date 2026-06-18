import React from 'react';

export function ProposalHome({ 
  pastProposals, 
  onSendNew, 
  onViewProposals 
}) {
  return (
    <div>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '700' }}>
        Quick Proposals
      </h3>

      {pastProposals.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#64748B', fontWeight: '600' }}>
            Sent Proposals ({pastProposals.length})
          </h4>
          {pastProposals.map((proposal) => (
            <div
              key={proposal.id}
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                background: '#fff',
                border: '1px solid #E2E8F0',
                marginBottom: '6px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '12px',
              }}
            >
              <div>
                <span style={{ color: '#0F2540', fontWeight: '600' }}>
                  {new Date(proposal.created_at).toLocaleDateString('en-AE')}
                </span>
                <span style={{ color: '#94A3B8', marginLeft: '8px' }}>
                  {proposal.units_quoted?.length || 0} units
                </span>
              </div>
              {proposal.pdf_url && (
                <a
                  href={proposal.pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: '#1A5FA8',
                    textDecoration: 'none',
                    fontWeight: '600',
                  }}
                >
                  📥 PDF
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {pastProposals.length === 0 && (
        <div
          style={{
            padding: '12px',
            borderRadius: '6px',
            background: '#fff',
            border: '1px solid #E2E8F0',
            color: '#94A3B8',
            fontSize: '12px',
            marginBottom: '12px',
          }}
        >
          No proposals sent yet
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button
          onClick={onViewProposals}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: '6px',
            border: '1px solid #0F2540',
            background: '#fff',
            color: '#0F2540',
            fontSize: '12px',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          📋 View Proposals
        </button>
        <button
          onClick={onSendNew}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: '6px',
            border: 'none',
            background: '#0F2540',
            color: '#fff',
            fontSize: '12px',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          📤 Send New Proposal
        </button>
      </div>
    </div>
  );
}
