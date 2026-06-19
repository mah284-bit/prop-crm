import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { ProposalHome } from './ProposalHome';
import { ViewProposalsDialog } from './ViewProposalsDialog';

export default function QuickProposalsPanel({
  onConvertUnit,
  leadId,
  leadEmail,
  leadName,
  leadPhone,
  company,
  currentUser,
}) {
  const [pastProposals, setPastProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showViewDialog, setShowViewDialog] = useState(false);

  useEffect(() => {
    fetchData();
  }, [leadId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: activities } = await supabase
        .from('activities')
        .select('*')
        .eq('lead_id', leadId)
        .eq('type', 'proposal_sent')
        .order('created_at', { ascending: false });
      const proposals = activities?.map((a) => ({
        id: a.id,
        created_at: a.created_at,
        pdf_url: a.metadata?.pdf_url || a.structured_data?.pdf_url,
        units_quoted: a.metadata?.units_quoted || a.structured_data?.units_quoted || [],
        unit_count: a.metadata?.unit_count || a.structured_data?.unit_count || 0,
        note: a.note,
      })) || [];
      setPastProposals(proposals || []);
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch data:', err);
      setError('Failed to load data');
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '20px', color: '#94A3B8', textAlign: 'center' }}>Loading...</div>;
  }

  return (
    <div style={{ padding: '20px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#F8FAFC', marginTop: '16px' }}>
      {error && <div style={{ padding: '10px 12px', borderRadius: '6px', background: '#FEE2E2', color: '#C53030', fontSize: '12px', marginBottom: '12px' }}>⚠️ {error}</div>}
      <ProposalHome
        pastProposals={pastProposals}
        onSendNew={() => alert('Send New Proposal - Modal Coming Soon')}
        onViewProposals={() => setShowViewDialog(true)}
      />
      {showViewDialog && <ViewProposalsDialog leadId={leadId} onClose={() => setShowViewDialog(false)} />}
    </div>
  );
}
