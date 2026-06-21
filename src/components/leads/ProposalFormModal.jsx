import { useState, useEffect } from 'react';
import UnitPickerMulti from './UnitPickerMulti';
import { supabase } from '../../lib/supabase';
import { sendQuickProposal } from '../../lib/quickProposalFlow';

export function ProposalFormModal({ leadId, leadEmail, leadName, leadPhone, company, currentUser, onClose, onSuccess }) {
  const [step, setStep] = useState(2);
  const [units, setUnits] = useState([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [allUnits, setAllUnits] = useState([]);
  const [allProjects, setAllProjects] = useState([]);
  const [salePricing, setSalePricing] = useState([]);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const { data: u } = await supabase.from('project_units').select('*');
      const { data: p } = await supabase.from('projects').select('*');
      const { data: pr } = await supabase.from('unit_sale_pricing').select('*');
      setAllUnits(u || []);
      setAllProjects(p || []);
      setSalePricing(pr || []);
    } catch (err) { console.error('Load failed:', err); setError('Failed to load'); }
  };

  const handleUnitsSelected = (selected) => { setUnits(selected); setStep(3); };
  const handleSend = async () => {
    if (units.length === 0) { setError('Select units'); return; }
    setSending(true);
    try {
      await sendQuickProposal({ leadId, leadEmail, leadName, selectedUnits: units, company, currentUser });
      setStep(4);
      if (onSuccess) onSuccess();
    } catch (err) { setError(err.message); setSending(false); }
  };

  return (
    <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:2000,padding:'20px'}} onClick={onClose}>
      <div style={{background:'#fff',borderRadius:'12px',width:'100%',maxWidth:'920px',maxHeight:'88vh',overflowY:'auto',position:'relative'}} onClick={e => e.stopPropagation()}>
        <button onClick={onClose} style={{position:'absolute',top:'12px',right:'12px',background:'none',border:'none',fontSize:'20px',cursor:'pointer',zIndex:10}}>✕</button>
        {error && <div style={{margin:'16px',padding:'10px',borderRadius:'6px',background:'#fee2e2',color:'#c53030',fontSize:'12px'}}>⚠️ {error}</div>}

        {step === 2 && (
          <UnitPickerMulti initialBedrooms={null} onSelect={handleUnitsSelected} onClose={onClose} units={allUnits} projects={allProjects} salePricing={salePricing} />
        )}

        {step === 3 && (
          <div style={{padding:'32px'}}>
            <h2 style={{fontSize:'18px',fontWeight:'700',marginBottom:'16px'}}>Review</h2>
            <div style={{background:'#f8fafc',padding:'12px',borderRadius:'6px',marginBottom:'16px'}}>
              <p style={{fontSize:'12px',color:'#64748b',marginBottom:'8px'}}>{units.length} unit{units.length !== 1 ? 's' : ''} selected</p>
              {units.map(u => (
                <div key={u.id} style={{fontSize:'11px',padding:'6px',background:'#fff',borderRadius:'4px',marginBottom:'4px',display:'flex',justifyContent:'space-between'}}>
                  <span style={{fontWeight:'600'}}>{u.unit_ref}</span>
                  <span style={{color:'#94a3b8'}}>AED {Math.round(u.price || 0).toLocaleString()}</span>
                </div>
              ))}
            </div>
            <div style={{display:'flex',gap:'8px'}}>
              <button onClick={() => setStep(2)} style={{flex:1,padding:'10px',borderRadius:'6px',border:'1px solid #d1d9e6',background:'#fff',cursor:'pointer',fontSize:'12px',fontWeight:'600'}}>Back</button>
              <button onClick={handleSend} disabled={sending} style={{flex:1,padding:'10px',borderRadius:'6px',border:'none',background:sending ? '#cbd5e1' : '#0f2540',color:'#fff',cursor:sending ? 'not-allowed' : 'pointer',fontSize:'12px',fontWeight:'600'}}>{sending ? 'Sending...' : 'Send'}</button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div style={{textAlign:'center',padding:'40px'}}>
            <div style={{fontSize:'48px',marginBottom:'12px'}}>✅</div>
            <p style={{fontSize:'12px',color:'#64748b',marginBottom:'16px'}}>Proposal sent to {leadEmail}</p>
            <button onClick={onClose} style={{width:'100%',padding:'10px',borderRadius:'6px',border:'none',background:'#0f2540',color:'#fff',cursor:'pointer',fontSize:'12px',fontWeight:'600'}}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
}
