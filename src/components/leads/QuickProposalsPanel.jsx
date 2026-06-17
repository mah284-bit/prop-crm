import { useState, useEffect } from 'react';
import { supabase } from "../../lib/supabase";
import UnitPickerMulti from "./UnitPickerMulti";
import { sendQuickProposal } from "../../lib/quickProposalFlow";

export default function QuickProposalsPanel({
  leadId,
  leadEmail,
  leadName,
  company,
  currentUser,
}) {
  const [step, setStep] = useState(0);
  const [selectedType, setSelectedType] = useState(null);
  const [selectedUnits, setSelectedUnits] = useState([]);
  const [showPicker, setShowPicker] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [pastProposals, setPastProposals] = useState([]);
  const [allUnits, setAllUnits] = useState([]);
  const [allProjects, setAllProjects] = useState([]);
  const [salePricing, setSalePricing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [convertingUnitId, setConvertingUnitId] = useState(null);
  const [onConvertUnit, setOnConvertUnit] = useState(null);

  useEffect(() => {
    fetchData();
  }, [leadId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: proposals } = await supabase.from('proposals').select('*').eq('lead_id', leadId).eq('type', 'quick_send').order('created_at', { ascending: false });
      const { data: units } = await supabase.from('project_units').select('*').eq('status', 'Available');
      const { data: projects } = await supabase.from('projects').select('*');
      const { data: pricing } = await supabase.from('sale_pricing').select('*');
      setPastProposals(proposals || []);
      setAllUnits(units || []);
      setAllProjects(projects || []);
      setSalePricing(pricing || []);
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch data:', err);
      setError('Failed to load data');
      setLoading(false);
    }
  };

  const handleTypeSelect = (type) => {
    setSelectedType(type);
    setStep(2);
    setShowPicker(true);
  };

  const handleUnitsSelected = (units) => {
    setSelectedUnits(units);
    setShowPicker(false);
    setStep(3);
  };

  const handleSendProposal = async () => {
    if (!selectedUnits || selectedUnits.length === 0) {
      setError('Please select at least one unit');
      return;
    }
    setSending(true);
    setError(null);
    try {
      await sendQuickProposal({ leadId, leadEmail, leadName, selectedUnits, company, currentUser });
      setStep(4);
      setSelectedUnits([]);
      setSelectedType(null);
      await fetchData();
      setTimeout(() => setStep(0), 3000);
    } catch (err) {
      console.error('Send failed:', err);
      setError(`Failed to send proposal: ${err.message}`);
      setSending(false);
    }
  };

  const handleReset = () => {
    setStep(0);
    setSelectedType(null);
    setSelectedUnits([]);
    setError(null);
  };

  if (loading) return <div style={{ padding: '16px', textAlign: 'center', color: '#94A3B8' }}>Loading proposals...</div>;

  return (
    <div style={{ padding: '16px', border: '1px solid #E2E8F0', borderRadius: '8px', background: '#F8FAFC', marginTop: '16px' }}>
      {error && <div style={{ padding: '10px 12px', borderRadius: '6px', background: '#FEE2E2', color: '#C53030', fontSize: '12px', marginBottom: '12px' }}>⚠️ {error}</div>}
      
      {step === 0 && (
        <div>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '700' }}>Quick Proposals</h3>
          {pastProposals.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#64748B', fontWeight: '600' }}>Sent Proposals ({pastProposals.length})</h4>
              {pastProposals.map((proposal) => (
                <div key={proposal.id} style={{ padding: '8px 12px', borderRadius: '6px', background: '#fff', border: '1px solid #E2E8F0', marginBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                  <div><span style={{ color: '#0F2540', fontWeight: '600' }}>{new Date(proposal.created_at).toLocaleDateString('en-AE')}</span><span style={{ color: '#94A3B8', marginLeft: '8px' }}>{proposal.units_quoted?.length || 0} units</span></div>
                  {proposal.pdf_url && <a href={proposal.pdf_url} target="_blank" rel="noopener noreferrer" style={{ color: '#1A5FA8', textDecoration: 'none', fontWeight: '600' }}>📥 PDF</a>}
                </div>
              ))}
            </div>
          )}
          {pastProposals.length === 0 && <div style={{ padding: '12px', borderRadius: '6px', background: '#fff', border: '1px solid #E2E8F0', color: '#94A3B8', fontSize: '12px', marginBottom: '12px' }}>No proposals sent yet</div>}
          <button onClick={() => setStep(1)} style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: 'none', background: '#0F2540', color: '#fff', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>📤 Send New Proposal</button>
        </div>
      )}

      {step === 1 && (
        <div>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '12px', fontWeight: '600' }}>What type of property?</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '12px' }}>
            {['Studio', '1BR', '2BR', '3BR', '4BR+', 'Villa'].map((type) => (
              <button key={type} onClick={() => handleTypeSelect(type)} style={{ padding: '10px 8px', borderRadius: '6px', border: '1px solid #D1D9E6', background: '#fff', color: '#0F2540', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>{type}</button>
            ))}
          </div>
          <button onClick={handleReset} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #D1D9E6', background: '#fff', color: '#64748B', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
        </div>
      )}

      {showPicker && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 37, 64, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={() => setShowPicker(false)}>
          <div onClick={(e) => e.stopPropagation()}>
            <UnitPickerMulti initialBedrooms={selectedType === 'Studio' ? 0 : selectedType === 'Villa' ? null : parseInt(selectedType)} onSelect={handleUnitsSelected} onClose={() => setShowPicker(false)} units={allUnits} projects={allProjects} salePricing={salePricing} />
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '12px', fontWeight: '600' }}>Ready to send?</h4>
          <div style={{ padding: '12px', borderRadius: '6px', background: '#fff', border: '1px solid #E2E8F0', marginBottom: '12px' }}>
            <p style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#64748B' }}>{selectedUnits.length} unit{selectedUnits.length !== 1 ? 's' : ''} selected:</p>
            {selectedUnits.map((unit) => (
              <div key={unit.id} style={{ padding: '6px 8px', borderRadius: '4px', background: '#F8FAFC', marginBottom: '4px', fontSize: '11px', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: '600', color: '#0F2540' }}>{unit.unit_ref}</span>
                <span style={{ color: '#94A3B8' }}>{unit.bedrooms === 0 ? 'Studio' : `${unit.bedrooms}BR`} • AED {Math.round(unit.price || 0).toLocaleString()}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setStep(1)} style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid #D1D9E6', background: '#fff', color: '#64748B', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>← Back</button>
            <button onClick={handleSendProposal} disabled={sending} style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: 'none', background: sending ? '#CBD5E1' : '#0F2540', color: '#fff', fontSize: '11px', fontWeight: '600', cursor: sending ? 'not-allowed' : 'pointer' }}>{sending ? 'Sending...' : '📤 Send Proposal'}</button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div style={{ textAlign: 'center', padding: '16px' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>✅</div>
          <h4 style={{ margin: '0 0 4px 0', fontSize: '13px', fontWeight: '700' }}>Proposal Sent!</h4>
          <p style={{ margin: '0 0 12px 0', fontSize: '11px', color: '#94A3B8' }}>PDF sent to {leadEmail}</p>
          <button onClick={handleReset} style={{ padding: '8px 12px', borderRadius: '6px', border: 'none', background: '#0F2540', color: '#fff', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>← Back</button>
        </div>
      )}
    </div>
  );
}
