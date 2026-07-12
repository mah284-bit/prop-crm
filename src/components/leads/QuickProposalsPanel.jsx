import { useState } from 'react';
import { ViewProposalsDialog } from './ViewProposalsDialog';
import { ProposalFormModal } from "./ProposalFormModal";

export default function QuickProposalsPanel({
  leadHasOpp = false,
  onOpenOpp,
  leadId,
  leadEmail,
  leadName,
  leadPhone,
  company,
  currentUser,
  onPromote,
}) {
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showProposalModal, setShowProposalModal] = useState(false);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
      <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '700', whiteSpace: 'nowrap', color: '#0F2540' }}>Quick Quote</h3>
      <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
        <button onClick={() => setShowViewDialog(true)} style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #0F2540', background: '#fff', color: '#0F2540', fontSize: '11px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap' }}>📋 View Quotes</button>
        <button onClick={() => setShowProposalModal(true)} style={{ padding: '8px 14px', borderRadius: '6px', border: 'none', background: '#0F2540', color: '#fff', fontSize: '11px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap' }}>📤 Send Quote</button>
      </div>

      {showViewDialog && (
        <ViewProposalsDialog
          leadId={leadId}
          onClose={() => setShowViewDialog(false)}
          onPromote={onPromote ? (proposal) => { setShowViewDialog(false); onPromote(proposal); } : undefined}
        />
      )}

      {showProposalModal && (
        <ProposalFormModal
          leadId={leadId}
          leadEmail={leadEmail}
          leadName={leadName}
          leadPhone={leadPhone}
          company={company}
          currentUser={currentUser}
          onClose={() => setShowProposalModal(false)}
          onSuccess={() => setShowProposalModal(false)}
        />
      )}
    </div>
  );
}
