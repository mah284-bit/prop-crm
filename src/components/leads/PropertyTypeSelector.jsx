import React from 'react';

const PROPERTY_TYPES = ['Studio', '1BR', '2BR', '3BR', '4BR+', 'Villa'];

export function PropertyTypeSelector({ onSelect, onCancel }) {
  return (
    <div>
      <h4 style={{ margin: '0 0 12px 0', fontSize: '12px', fontWeight: '600' }}>
        What type of property?
      </h4>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '8px',
          marginBottom: '12px',
        }}
      >
        {PROPERTY_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => onSelect(type)}
            style={{
              padding: '10px 8px',
              borderRadius: '6px',
              border: '1px solid #D1D9E6',
              background: '#fff',
              color: '#0F2540',
              fontSize: '11px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.target.style.background = '#0F2540';
              e.target.style.color = '#fff';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = '#fff';
              e.target.style.color = '#0F2540';
            }}
          >
            {type}
          </button>
        ))}
      </div>
      <button
        onClick={onCancel}
        style={{
          width: '100%',
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
        Cancel
      </button>
    </div>
  );
}
