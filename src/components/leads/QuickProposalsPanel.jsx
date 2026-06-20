import { useState } from 'react';
import { ViewProposalsDialog } from './ViewProposalsDialog';
import { ProposalFormModal } from "./ProposalFormModal";

export default function QuickProposalsPanel({
  leadId,
  leadEmail,
  leadName,
  leadPhone,
  company,
  currentUser,
}) {
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showProposalModal, setShowProposalModal] = useState(false);

  return (
    <div style={{ padding: '16px', border: '1px solid #E2E8F0', borderRadius: '8px', background: '#F8FAFC', marginTop: '16px' }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '700' }}>Quick Proposals</h3>
      <button onClick={() => setShowViewDialog(true)} style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #0F2540', background: '#fff', color: '#0F2540', fontSize: '11px', fontWeight: '600', cursor: 'pointer', marginBottom: '8px' }}>📋 View Proposals</button>
      <button onClick={() => setShowProposalModal(true)} style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: 'none', background: '#0F2540', color: '#fff', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>📤 Send New Proposal</button>

      {showViewDialog && (
        <ViewProposalsDialog
          leadId={leadId}
          onClose={() => setShowViewDialog(false)}
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
