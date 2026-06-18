import React from 'react';

export function ConfirmProposal({ 
  selectedUnits, 
  onSend, 
  onBack, 
  isSending 
}) {
  return (
    <div>
      <h4 style={{ margin: '0 0 12px 0', fontSize: '12px', fontWeight: '600' }}>
        Ready to send?
      </h4>
      <div
        style={{
          padding: '12px',
          borderRadius: '6px',
          background: '#fff',
          border: '1px solid #E2E8F0',
          marginBottom: '12px',
        }}
      >
        <p style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#64748B' }}>
          {selectedUnits.length} unit{selectedUnits.length !== 1 ? 's' : ''} selected:
        </p>
        {selectedUnits.map((unit) => (
          <div
            key={unit.id}
            style={{
              padding: '6px 8px',
              borderRadius: '4px',
              background: '#F8FAFC',
              marginBottom: '4px',
              fontSize: '11px',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontWeight: '600', color: '#0F2540' }}>
              {unit.unit_ref}
            </span>
            <span style={{ color: '#94A3B8' }}>
              {unit.bedrooms === 0 ? 'Studio' : `${unit.bedrooms}BR`} • AED{' '}
              {Math.round(unit.price || 0).toLocaleString()}
            </span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={onBack}
          style={{
            flex: 1,
            padding: '8px 12px',
            borderRadius: '6px',
            border: '1px solid #D1D9E6',
            background: '#fff',
            color: '#64748B',
            fontSize: '11px',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          ← Back
        </button>
        <button
          onClick={onSend}
          disabled={isSending}
          style={{
            flex: 1,
            padding: '8px 12px',
            borderRadius: '6px',
            border: 'none',
            background: isSending ? '#CBD5E1' : '#0F2540',
            color: '#fff',
            fontSize: '11px',
            fontWeight: '600',
            cursor: isSending ? 'not-allowed' : 'pointer',
          }}
        >
          {isSending ? 'Sending...' : '📤 Send Proposal'}
        </button>
      </div>
    </div>
  );
}
