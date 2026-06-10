import React from 'react';

const PropertyPackPDF = ({
  unit = {},
  project = {},
  amenities = [],
  photos = [],
  masterPlanUrl = '',
  brochureUrl = '',
  heroImageUrl = '',
  videoUrl = '',
  brokerName = 'PropCRM Broker',
  brokerPhone = '+971 50 000 0000',
  brokerEmail = 'broker@propcrm.ae',
  companyLogo = '',
  companyName = 'PropCRM'
}) => {
  const bedLabel = unit.bedrooms === 0 ? 'Studio' : (unit.bedrooms ? `${unit.bedrooms}BR` : 'N/A');
  const formatPrice = (price) => {
    if (!price) return 'N/A';
    return `AED ${Number(price).toLocaleString()}`;
  };

  return (
    <div id="property-pack-pdf" style={{
      width: '210mm',
      height: '297mm',
      margin: '0 auto',
      padding: '20mm',
      fontFamily: "'Segoe UI', 'Helvetica Neue', sans-serif",
      backgroundColor: '#fff',
      color: '#0F2540',
      lineHeight: 1.6,
      fontSize: 14,
      pageBreakAfter: 'always',
      boxSizing: 'border-box'
    }}>
      {/* HEADER */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        paddingBottom: '15px',
        borderBottom: '2px solid #C9A84C'
      }}>
        <div>
          <div style={{fontSize: 24, fontWeight: 700, color: '#0F2540'}}>
            {project.name || 'Property Detail Pack'}
          </div>
          <div style={{fontSize: 13, color: '#64748B', marginTop: 4}}>
            {unit.unit_ref || 'Unit'} • {bedLabel} • {unit.size_sqft ? `${unit.size_sqft} sqft` : 'N/A'}
          </div>
        </div>
        <div style={{textAlign: 'right', fontSize: 11, color: '#64748B'}}>
          <div>{new Date().toLocaleDateString('en-US', {year: 'numeric', month: 'short', day: 'numeric'})}</div>
          <div style={{marginTop: 4}}>{companyName}</div>
        </div>
      </div>

      {/* HERO IMAGE */}
      {heroImageUrl && (
        <div style={{marginBottom: '20px'}}>
          <img src={heroImageUrl} alt="Property hero" style={{width: '100%', height: 'auto', maxHeight: '150px', objectFit: 'cover', borderRadius: '8px'}} />
        </div>
      )}

      {/* UNIT SPECS */}
      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px', backgroundColor: '#F8FAFC', padding: '15px', borderRadius: '8px', border: '1px solid #E2E8F0'}}>
        <div><div style={{fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.4px'}}>Type</div><div style={{fontSize: 13, fontWeight: 600, color: '#0F2540', marginTop: 4}}>{unit.sub_type || 'Residential'}</div></div>
        <div><div style={{fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.4px'}}>Bedrooms</div><div style={{fontSize: 13, fontWeight: 600, color: '#0F2540', marginTop: 4}}>{bedLabel}</div></div>
        <div><div style={{fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.4px'}}>Size</div><div style={{fontSize: 13, fontWeight: 600, color: '#0F2540', marginTop: 4}}>{unit.size_sqft ? `${unit.size_sqft} sqft` : 'N/A'}</div></div>
        <div><div style={{fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.4px'}}>View</div><div style={{fontSize: 13, fontWeight: 600, color: '#0F2540', marginTop: 4}}>{unit.view || 'N/A'}</div></div>
        <div style={{gridColumn: '1 / -1'}}><div style={{fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.4px'}}>Price</div><div style={{fontSize: 15, fontWeight: 700, color: '#1A5FA8', marginTop: 4}}>{formatPrice(unit.asking_price)}</div></div>
      </div>

      {/* AMENITIES */}
      {amenities.length > 0 && (
        <div style={{marginBottom: '20px'}}>
          <div style={{fontSize: 12, fontWeight: 700, color: '#0F2540', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12}}>Community Amenities</div>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px'}}>
            {amenities.slice(0, 9).map((amenity, idx) => (
              <div key={idx} style={{display: 'flex', alignItems: 'center', gap: '8px', fontSize: 12, padding: '8px', backgroundColor: '#F0F9FF', borderRadius: '6px', border: '1px solid #BAE6FD'}}>
                <span style={{fontSize: 16}}>📍</span>
                <span style={{color: '#0C4A6E', fontWeight: 600}}>{amenity}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PHOTOS */}
      {photos.length > 0 && (
        <div style={{marginBottom: '20px'}}>
          <div style={{fontSize: 12, fontWeight: 700, color: '#0F2540', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12}}>Community Photos</div>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px'}}>
            {photos.slice(0, 3).map((photo, idx) => (
              <img key={idx} src={photo} alt={`Photo ${idx + 1}`} style={{width: '100%', height: '80px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #E2E8F0'}} />
            ))}
          </div>
        </div>
      )}

      {/* DOCUMENTS */}
      <div style={{backgroundColor: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0', marginBottom: '20px'}}>
        <div style={{fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10}}>Documents & Links</div>
        <div style={{display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11}}>
          {masterPlanUrl && <div>📋 <strong>Master Plan:</strong> {masterPlanUrl}</div>}
          {brochureUrl && <div>📄 <strong>Brochure:</strong> {brochureUrl}</div>}
          {videoUrl && <div>🎥 <strong>Video Tour:</strong> {videoUrl}</div>}
        </div>
      </div>

      {/* BROKER CONTACT */}
      <div style={{marginTop: '25px', paddingTop: '15px', borderTop: '1px solid #E2E8F0', fontSize: 11, color: '#64748B'}}>
        <div style={{fontWeight: 700, color: '#0F2540', marginBottom: 8}}>Your Broker</div>
        <div>{brokerName}</div>
        <div>📱 {brokerPhone}</div>
        <div>📧 {brokerEmail}</div>
        <div style={{marginTop: 12, fontSize: 10, color: '#94A3B8'}}>Generated by PropCRM • {new Date().toLocaleDateString()}</div>
      </div>
    </div>
  );
};

export default PropertyPackPDF;
