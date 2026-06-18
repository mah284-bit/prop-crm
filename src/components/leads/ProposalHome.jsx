import React from 'react';

export function ProposalHome({ pastProposals, onSendNew, onViewProposals }) {
  return (
    <div>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '700' }}>Quick Proposals</h3>
      <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#64748B' }}>
        {pastProposals.length > 0 ? `${pastProposals.length} proposal${pastProposals.length !== 1 ? 's' : ''} sent` : 'No proposals sent yet'}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {pastProposals.length > 0 && (
          <button onClick={onViewProposals} style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #0F2540', background: '#fff', color: '#0F2540', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
            📋 View Proposals ({pastProposals.length})
          </button>
        )}
        <button onClick={onSendNew} style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: 'none', background: '#0F2540', color: '#fff', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
          📤 Send New Proposal
        </button>
      </div>
    </div>
  );
}
