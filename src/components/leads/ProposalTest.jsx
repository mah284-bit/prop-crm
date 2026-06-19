import { useState } from 'react';
import { ProposalFormModal } from './ProposalFormModal';

export default function ProposalTest({ leadId, leadEmail, leadName, leadPhone, company, currentUser }) {
  const [showModal, setShowModal] = useState(false);

  return (
    <div style={{ padding: '20px' }}>
      <button onClick={() => setShowModal(true)} style={{ padding: '10px 20px', background: '#0F2540', color: '#fff', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '14px' }}>
        Open Proposal Form
      </button>

      {showModal && (
        <ProposalFormModal
          leadId={leadId}
          leadEmail={leadEmail}
          leadName={leadName}
          leadPhone={leadPhone}
          company={company}
          currentUser={currentUser}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); alert('Success!'); }}
        />
      )}
    </div>
  );
}