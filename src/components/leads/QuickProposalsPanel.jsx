import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import UnitPickerMulti from './UnitPickerMulti';
import { sendQuickProposal } from '../../lib/quickProposalFlow';
import { prepareUnitForConversion } from '../../lib/conversionHandler';
import { ProposalHome } from './ProposalHome';
import { PropertyTypeSelector } from './PropertyTypeSelector';
import { ConfirmProposal } from './ConfirmProposal';
import { ProposalSent } from './ProposalSent';
import { ProposalSuccessDialog } from './ProposalSuccessDialog';
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
  const [successPdfUrl, setSuccessPdfUrl] = useState(null);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [successPdfUrl, setSuccessPdfUrl] = useState(null);
  const [showViewDialog, setShowViewDialog] = useState(false);
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
        pdf_url: a.metadata?.pdf_url || a.structured_data?.pdf_url,
        units_quoted: a.metadata?.units_quoted || a.structured_data?.units_quoted || [],
        unit_count: a.metadata?.unit_count || a.structured_data?.unit_count || 0,
        note: a.note,
        version: a.metadata?.unit_count || a.structured_data?.unit_count || 0,
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
      setError('Please select at least one unit');
      return;
    }
    setSending(true);
    setError(null);
    try {
      const result = await sendQuickProposal({
        leadId,
        leadEmail,
        leadName,
  leadPhone,
        selectedUnits,
        company,
        currentUser,
      });
      console.log('🎯 Setting successPdfUrl:', result.pdfUrl);
      setSuccessPdfUrl(result.pdfUrl);
      setSending(false);
    } catch (err) {
      console.error('Send failed:', err);
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
      console.error('Convert failed:', err);
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

  if (loading) {
    return (
      <div style={{ padding: '16px', textAlign: 'center', color: '#94A3B8' }}>
        Loading proposals...
      </div>
    );
  }

  return (
    <div
      style={{
        padding: '16px',
        border: '1px solid #E2E8F0',
        borderRadius: '8px',
        background: '#F8FAFC',
        marginTop: '16px',
      }}
    >
      {error && (
        <div
          style={{
            padding: '10px 12px',
            borderRadius: '6px',
            background: '#FEE2E2',
            color: '#C53030',
            fontSize: '12px',
            marginBottom: '12px',
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {step === 0 && (
        <ProposalHome
          pastProposals={pastProposals}
          onSendNew={() => setStep(1)}
          onViewProposals={() => setShowViewDialog(true)}
        />
      )}

      {step === 1 && (
        <PropertyTypeSelector
          onSelect={handleTypeSelect}
          onCancel={handleReset}
        />
      )}

      {showPicker && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 37, 64, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
          onClick={() => setShowPicker(false)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <UnitPickerMulti
              initialBedrooms={
                selectedType === 'Studio'
                  ? 0
                  : selectedType === 'Villa'
                  ? null
                  : parseInt(selectedType)
              }
              onSelect={handleUnitsSelected}
              onClose={() => setShowPicker(false)}
              units={allUnits}
              projects={allProjects}
              salePricing={salePricing}
            />
          </div>
        </div>
      )}

      {step === 3 && (
        <ConfirmProposal
          selectedUnits={selectedUnits}
          onSend={handleSendProposal}
          onBack={() => setStep(1)}
          isSending={sending}
        />
      )}

      {step === 4 && <ProposalSent leadEmail={leadEmail} onReset={handleReset} />}

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
    </div>
  );
}