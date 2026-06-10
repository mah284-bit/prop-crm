import React, { useState } from 'react';
import { generatePropertyPackPDF, uploadPropertyPackPDF } from './generatePropertyPackPDF';

const PropertyPackShareModal = ({
  isOpen = false,
  onClose = () => {},
  supabase = null,
  unit = {},
  project = {},
  opportunity = {},
  lead = {},
  currentUser = {},
  showToast = () => {}
}) => {
  const [mode, setMode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [emailForm, setEmailForm] = useState({
    to: lead.email || '',
    subject: `Property Proposal — ${unit.unit_ref || 'Unit'} at ${project.name || 'Project'}`,
    message: `Hi ${lead.name || 'Buyer'},\n\nPlease find attached the detailed property pack for your consideration.\n\nBest regards,\n${currentUser.full_name || 'Your Broker'}`
  });

  const [whatsappForm, setWhatsappForm] = useState({
    to: lead.phone || '',
    message: `Hi ${lead.name || 'Buyer'}! 🏠\n\nI've prepared a detailed property pack for ${unit.unit_ref}. Download link will be shared in the next message.\n\nBest,\n${currentUser.full_name || 'Your Broker'}`
  });

  if (!isOpen) return null;

  const generateAndShare = async () => {
    if (!unit || !project) {
      showToast('Unit or project data missing', 'error');
      return;
    }

    setLoading(true);
    try {
      const pdfBlob = await generatePropertyPackPDF(
        supabase,
        unit.id,
        unit,
        project,
        currentUser,
        {
          name: currentUser.full_name || 'PropCRM Broker',
          phone: currentUser.phone || '',
          email: currentUser.email || ''
        }
      );

      const uploadResult = await uploadPropertyPackPDF(
        supabase,
        pdfBlob,
        currentUser.company_id,
        unit.id,
        unit.unit_ref || 'unit'
      );

      return { blob: pdfBlob, url: uploadResult.url };
    } catch (err) {
      console.error('PDF generation failed:', err);
      showToast('Failed to generate PDF: ' + err.message, 'error');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSend = async () => {
    if (!emailForm.to) {
      showToast('Enter recipient email', 'error');
      return;
    }

    setLoading(true);
    try {
      const { url } = await generateAndShare();
      const emailBody = `${emailForm.message}\n\n📄 Property Pack: ${url}`;
      const mailtoUrl = `mailto:${emailForm.to}?subject=${encodeURIComponent(emailForm.subject)}&body=${encodeURIComponent(emailBody)}`;

      window.location.href = mailtoUrl;

      if (supabase && opportunity.id && lead.id) {
        await supabase.from('activities').insert({
          opportunity_id: opportunity.id,
          lead_id: lead.id,
          type: 'Email',
          note: `Property pack sent to ${emailForm.to}`,
          user_id: currentUser.id,
          user_name: currentUser.full_name,
          lead_name: lead.name,
          company_id: currentUser.company_id || null
        });
      }

      showToast('Property pack sent! Email client opening...', 'success');
      setMode(null);
    } catch (err) {
      showToast('Failed to send: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleWhatsappShare = async () => {
    if (!whatsappForm.to) {
      showToast('Enter recipient phone number', 'error');
      return;
    }

    setLoading(true);
    try {
      const { url } = await generateAndShare();
      const cleanPhone = whatsappForm.to.replace(/\D/g, '');
      const whatsappMessage = `${whatsappForm.message}\n\n📄 Property Pack: ${url}`;
      const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(whatsappMessage)}`;

      window.open(whatsappUrl, '_blank');

      if (supabase && opportunity.id && lead.id) {
        await supabase.from('activities').insert({
          opportunity_id: opportunity.id,
          lead_id: lead.id,
          type: 'WhatsApp',
          note: `Property pack shared via WhatsApp to ${whatsappForm.to}`,
          user_id: currentUser.id,
          user_name: currentUser.full_name,
          lead_name: lead.name,
          company_id: currentUser.company_id || null
        });
      }

      showToast('Opening WhatsApp...', 'success');
      setMode(null);
    } catch (err) {
      showToast('Failed to share: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    setLoading(true);
    try {
      const pdfBlob = await generatePropertyPackPDF(supabase, unit.id, unit, project, currentUser, {name: currentUser.full_name || 'PropCRM Broker', phone: currentUser.phone || '', email: currentUser.email || ''});

      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${unit.unit_ref || 'property'}-pack-${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast('PDF downloaded', 'success');
      setMode(null);
    } catch (err) {
      showToast('Failed to download: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{position: 'fixed', inset: 0, background: 'rgba(11, 31, 58, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '1rem'}}>
      <div style={{background: '#fff', borderRadius: 16, width: 540, maxWidth: '100%', maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(11, 31, 58, 0.4)'}}>
        <div style={{background: '#fff', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <div><div style={{fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700, color: '#0F2540'}}>📸 Share Property Pack</div><div style={{fontSize: 11, color: '#64748B', marginTop: 2}}>{unit.unit_ref} • {project.name}</div></div>
          <button onClick={onClose} style={{background: 'none', border: 'none', fontSize: 22, color: '#C9A84C', cursor: 'pointer'}}>×</button>
        </div>

        <div style={{overflowY: 'auto', padding: '1.25rem 1.5rem', flex: 1, display: 'flex', flexDirection: 'column', gap: 12}}>
          {!mode ? (
            <div style={{display: 'grid', gridTemplateColumns: '1fr', gap: 10}}>
              <button onClick={() => setMode('email')} disabled={loading} style={{padding: '14px', borderRadius: 8, border: '1.5px solid #D1D9E6', background: '#fff', fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1, textAlign: 'left'}} onMouseEnter={(e) => !loading && (e.target.style.background = '#F0F9FF')} onMouseLeave={(e) => (e.target.style.background = '#fff')}>
                📧 <strong>Send via Email</strong><div style={{fontSize: 11, color: '#64748B', marginTop: 4}}>Send PDF link to {lead.email || 'buyer email'}</div>
              </button>

              <button onClick={() => setMode('whatsapp')} disabled={loading} style={{padding: '14px', borderRadius: 8, border: '1.5px solid #D1D9E6', background: '#fff', fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1, textAlign: 'left'}} onMouseEnter={(e) => !loading && (e.target.style.background = '#F0FDF4')} onMouseLeave={(e) => (e.target.style.background = '#fff')}>
                💬 <strong>Share via WhatsApp</strong><div style={{fontSize: 11, color: '#64748B', marginTop: 4}}>Send message + PDF link to {lead.phone || 'buyer phone'}</div>
              </button>

              <button onClick={() => setMode('download')} disabled={loading} style={{padding: '14px', borderRadius: 8, border: '1.5px solid #D1D9E6', background: '#fff', fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1, textAlign: 'left'}} onMouseEnter={(e) => !loading && (e.target.style.background = '#FEF6E0')} onMouseLeave={(e) => (e.target.style.background = '#fff')}>
                📥 <strong>Download PDF</strong><div style={{fontSize: 11, color: '#64748B', marginTop: 4}}>Save to your computer</div>
              </button>
            </div>
          ) : mode === 'email' ? (
            <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
              <div><label style={{fontSize: 11, fontWeight: 600, color: '#4A5568', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.5px'}}>To *</label><input type="email" value={emailForm.to} onChange={(e) => setEmailForm(f => ({...f, to: e.target.value}))} placeholder="buyer@example.com" style={{width: '100%', padding: '8px 12px', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box'}} /></div>
              <div><label style={{fontSize: 11, fontWeight: 600, color: '#4A5568', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.5px'}}>Subject</label><input type="text" value={emailForm.subject} onChange={(e) => setEmailForm(f => ({...f, subject: e.target.value}))} style={{width: '100%', padding: '8px 12px', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box'}} /></div>
              <div><label style={{fontSize: 11, fontWeight: 600, color: '#4A5568', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.5px'}}>Message</label><textarea value={emailForm.message} onChange={(e) => setEmailForm(f => ({...f, message: e.target.value}))} rows={4} style={{width: '100%', padding: '8px 12px', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', lineHeight: 1.5}} /></div>
              <div style={{background: '#E6EFF9', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#1A5FA8'}}>💡 PDF link will be added to your email</div>
            </div>
          ) : mode === 'whatsapp' ? (
            <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
              <div><label style={{fontSize: 11, fontWeight: 600, color: '#4A5568', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.5px'}}>Phone Number *</label><input type="text" value={whatsappForm.to} onChange={(e) => setWhatsappForm(f => ({...f, to: e.target.value}))} placeholder="+971 50 123 4567 or 00971501234567" style={{width: '100%', padding: '8px 12px', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box'}} /></div>
              <div><label style={{fontSize: 11, fontWeight: 600, color: '#4A5568', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.5px'}}>Message</label><textarea value={whatsappForm.message} onChange={(e) => setWhatsappForm(f => ({...f, message: e.target.value}))} rows={4} style={{width: '100%', padding: '8px 12px', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', lineHeight: 1.5}} /></div>
              <div style={{background: '#E6F4EE', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#1A7F5A'}}>💡 PDF link will be added to your WhatsApp message</div>
            </div>
          ) : null}
        </div>

        <div style={{padding: '1rem 1.5rem', borderTop: '1px solid #E2E8F0', display: 'flex', gap: 10, justifyContent: 'flex-end'}}>
          <button onClick={() => (mode ? setMode(null) : onClose())} disabled={loading} style={{padding: '9px 18px', borderRadius: 8, border: '1.5px solid #D1D9E6', background: '#fff', fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1}}>{mode ? 'Back' : 'Cancel'}</button>
          {mode && (
            <button onClick={mode === 'email' ? handleEmailSend : mode === 'whatsapp' ? handleWhatsappShare : handleDownload} disabled={loading} style={{padding: '9px 24px', borderRadius: 8, border: 'none', background: loading ? '#CBD5E0' : '#1A5FA8', color: '#fff', fontSize: 13, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1}}>{loading ? '⏳ Generating PDF...' : mode === 'email' ? '📧 Send Email' : mode === 'whatsapp' ? '💬 Open WhatsApp' : '📥 Download'}</button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PropertyPackShareModal;
