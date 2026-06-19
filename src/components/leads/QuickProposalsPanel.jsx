import { useState, useEffect } from 'react';
import { supabase } from "../../lib/supabase";
import { ViewProposalsDialog } from './ViewProposalsDialog';
import UnitPickerMulti from "./UnitPickerMulti";
import { ProposalSuccessDialog } from './ProposalSuccessDialog';
import { sendQuickProposal } from "../../lib/quickProposalFlow";
import { prepareUnitForConversion } from "../../lib/conversionHandler";
import { ProposalFormModal } from "./ProposalFormModal";

export default function QuickProposalsPanel({
  onConvertUnit,
  leadId,
  leadEmail,
  leadName,
  leadPhone,
  company,
  currentUser,
}) {
  const [step, setStep] = useState(0);
  const [selectedType, setSelectedType] = useState(null);
  const [selectedUnits, setSelectedUnits] = useState([]);
  const [showPicker, setShowPicker] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [successPdfUrl, setSuccessPdfUrl] = useState(null);
  const [pastProposals, setPastProposals] = useState([]);
  const [allUnits, setAllUnits] = useState([]);
  const [allProjects, setAllProjects] = useState([]);
  const [salePricing, setSalePricing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [convertingUnitId, setConvertingUnitId] = useState(null);

  useEffect(() => {
    fetchData();
  }, [leadId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setPastProposals([]);
      const { data: activities } = await supabase
        .from('activities')
        .select('*')
        .eq('lead_id', leadId)
        .eq('type', 'proposal_sent')
        .order('created_at', { ascending: false });
      const proposals = activities?.map(a => ({
        id: a.id,
        created_at: a.created_at,
        pdf_url: a.metadata?.pdf_url,
        units_quoted: a.metadata?.units_quoted || [],
        unit_count: a.metadata?.unit_count || 0,
      })) || [];
      const { data: units } = await supabase.from('project_units').select('*');
      const { data: projects } = await supabase.from('projects').select('*');
      const { data: pricing } = await supabase.from('unit_sale_pricing').select('*');
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
      const result = await sendQuickProposal({ leadId, leadEmail, leadName, selectedUnits, company, currentUser });
  leadPhone,
      console.log("🎯 Setting successPdfUrl:", result.pdfUrl); setSuccessPdfUrl(result.pdfUrl);
      setSending(false);
    } catch (err) {
      console.error("Send failed:", err);
      setError(`Failed to send proposal: ${err.message}`);
      setSending(false);
    }
  };

  const handleConvertUnit = async (unitId) => {
    setConvertingUnitId(unitId);
    setError(null);
    try {
      const unitData = await prepareUnitForConversion(unitId);
      if (onConvertUnit) {
        onConvertUnit(unitData);
      }
      setConvertingUnitId(null);
    } catch (err) {
      console.error("Convert failed:", err);
      setError(`Failed to convert: ${err.message}`);
      setConvertingUnitId(null);
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
      {error && <div style={{ padding: '8px 10px', borderRadius: '6px', background: '#FEE2E2', color: '#C53030', fontSize: '11px', marginBottom: '12px' }}>⚠️ {error}</div>}
      
      {step === 0 && (
        <div>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '700' }}>Quick Proposals</h3>
          <button onClick={() => setShowViewDialog(true)} style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #0F2540', background: '#fff', color: '#0F2540', fontSize: '11px', fontWeight: '600', cursor: 'pointer', marginBottom: '8px' }}>📋 View Proposals</button>
          <button onClick={() => setShowProposalModal(true)} style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: 'none', background: '#0F2540', color: '#fff', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>📤 Send New Proposal</button>
        </div>
      )}


      {showViewDialog && (
        <ViewProposalsDialog
          leadId={leadId}
          onClose={() => setShowViewDialog(false)}
        />
      )}

      {successPdfUrl && (
        <ProposalSuccessDialog
          pdfUrl={successPdfUrl}
          leadName={leadName}
          leadEmail={leadEmail}
          leadPhone={leadPhone}
          onClose={() => {
            setSuccessPdfUrl(null);
            setStep(0);
            setSelectedUnits([]);
          }}
        />
      )}
      {showProposalModal && <ProposalFormModal leadId={leadId} leadEmail={leadEmail} leadName={leadName} leadPhone={leadPhone} company={company} currentUser={currentUser} onClose={() => setShowProposalModal(false)} onSuccess={() => { setShowProposalModal(false); fetchData(); }} />}
    </div>
  );
}
