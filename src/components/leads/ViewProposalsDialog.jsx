import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export function ViewProposalsDialog({ leadId, onClose, onPromote }) {
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProposals();
  }, [leadId]);

  const fetchProposals = async () => {
    try {
      const { data: activities } = await supabase
        .from('activities')
        .select('*')
        .eq('lead_id', leadId)
        .eq('type', 'proposal_sent')
        .order('created_at', { ascending: false });

      const proposals = activities?.map((a, index) => ({
        id: a.id,
        created_at: a.created_at,
        pdf_url: a.metadata?.pdf_url || a.structured_data?.pdf_url,
        units_quoted: a.metadata?.units_quoted || a.structured_data?.units_quoted || [],
        unit_count: a.metadata?.unit_count || a.structured_data?.unit_count || 0,
        note: a.note,
        version: index + 1,
      })) || [];

      setProposals(proposals);
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch proposals:', err);
      setLoading(false);
    }
  };

  const handleDownloadPDF = async (pdfUrl) => {
    try {
      const response = await fetch(pdfUrl);
      if (!response.ok) throw new Error('Failed to fetch PDF');
      
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      // Open in tab instead
      window.open(pdfUrl, '_blank');
      return;
      
      // Already opened
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Download failed:', error);
      window.open(pdfUrl, '_blank');
    }
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
        maxWidth: 760,
        maxHeight: '80vh',
        overflow: 'auto',
        boxShadow: '0 10px 40px rgba(15, 37, 64, 0.2)',
      }}>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ margin: '0 0 8px 0', color: '#0F2540', fontSize: 18, fontWeight: 700 }}>
            📋 Sent Proposals
          </h2>
          <p style={{ margin: 0, color: '#64748B', fontSize: 14 }}>
            {proposals.length} quote{proposals.length !== 1 ? 's' : ''} sent
          </p>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px', color: '#94A3B8' }}>
            Loading...
          </div>
        ) : proposals.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px', color: '#94A3B8' }}>
            No quotes sent yet
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {proposals.map((proposal) => (
              <div
                key={proposal.id}
                style={{
                  padding: 12,
                  borderRadius: 6,
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ color: '#0F2540', fontWeight: 600, fontSize: 13 }}>
                      v{proposal.version}
                    </span>
                    <span style={{ color: '#64748B', fontSize: 12 }}>
                      {new Date(proposal.created_at).toLocaleDateString('en-AE')}
                    </span>
                  </div>
                  <p style={{
                    margin: 0,
                    color: '#64748B',
                    fontSize: 12,
                    maxWidth: 560,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {proposal.note}
                  </p>
                  <div style={{ marginTop: 4, fontSize: 11, color: '#94A3B8' }}>
                    {proposal.unit_count > 0 ? `${proposal.unit_count} unit${proposal.unit_count !== 1 ? 's' : ''}` : 'No units'}
                  </div>
                </div>

                {proposal.pdf_url && onPromote && (
                  <button
                    onClick={() => onPromote(proposal)}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 4,
                      border: 'none',
                      background: '#C9A84C',
                      color: '#0F2540',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      marginLeft: 8,
                    }}
                    title="AI reads this proposal and pre-fills a new Opportunity"
                  >
                    ⇪ Promote to Opp
                  </button>
                )}
                {proposal.pdf_url && (
                  <button
                    onClick={() => handleDownloadPDF(proposal.pdf_url)}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 4,
                      border: 'none',
                      background: '#0F2540',
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      marginLeft: 8,
                    }}
                  >
                    📥 PDF
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <button
          onClick={onClose}
          style={{
            width: '100%',
            padding: 10,
            marginTop: 20,
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
