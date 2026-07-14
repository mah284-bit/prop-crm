import { DLD_OPTIONS, SERVICE_CHARGE_PRESETS } from "../../modules/constants.js";
import React, { useState } from 'react';
import { Btn } from "../../modules/shared/Btn.jsx";
import { Modal } from "../../modules/shared/Modal.jsx";
import { Badge } from "../../modules/shared/Badge.jsx";
import { fmtM, fmtAED, fmtDate } from "../../modules/utils.js";

function ProposalViewerDialog({ proposal, opp, lead, units, projects, currentUser, onClose, showToast }) {
  if (!proposal) return null;
  const sd = proposal.structured_data || {};
  // Reconstruct the unit list — prefer multi-unit array, fallback to legacy single unit
  const proposalUnits = sd.proposal_units || [{
    unit_id: proposal.unit_id,
    asking_price: proposal.asking_price ?? sd.asking_price,
    discount_pct: proposal.discount_pct ?? sd.discount_pct,
    discounted_price: proposal.discounted_price ?? sd.discounted_price,
  }];
  const totalValue = sd.total_value || proposalUnits.reduce((s,pu)=>s+Number(pu.discounted_price||0),0);
  const expiry = proposal.expiry_date || sd.expiry_date;
  const expiryDate = expiry ? new Date(expiry) : null;
  const dldLabel = DLD_OPTIONS.find(o=>o.value===sd.dld_handling)?.label || sd.dld_handling || "—";
  const scLabel = SERVICE_CHARGE_PRESETS.find(o=>o.value===sd.service_charge_preset)?.label || "None";
  const paymentPlan = proposal.payment_plan || sd.payment_plan || "—";
  const coverNotes = proposal.notes || sd.notes || "";

  const fmtAed = (n) => `AED ${Number(n||0).toLocaleString()}`;

  // 20 May 2026 Phase 2b: Use module-level PROPOSAL_STATUS_META (was duplicated here)
  const STATUS_META = PROPOSAL_STATUS_META;
  const sm = STATUS_META[proposal.status] || STATUS_META.sent;

  // Build the email body (matches what was sent originally)
  const buildEmailBody = () => {
    const lines = [];
    if (coverNotes) {
      lines.push(coverNotes);
      lines.push("");
    }
    lines.push("PROPOSAL SUMMARY");
    lines.push("─".repeat(40));
    proposalUnits.forEach((pu, i) => {
      const u = units.find(x => x.id === pu.unit_id);
      const proj = u ? projects.find(p => p.id === u.project_id) : null;
      const bedLabel = u?.bedrooms === 0 ? "Studio" : (u?.bedrooms ? `${u.bedrooms} BR` : "");
      lines.push(`Option ${i+1}: ${u?.unit_ref||"—"}${proj?.name?` · ${proj.name}`:""}`);
      lines.push(`  ${[bedLabel, u?.size_sqft?`${u.size_sqft} sqft`:null, u?.view].filter(Boolean).join(" · ")}`);
      lines.push(`  Asking price: ${fmtAed(pu.asking_price)}`);
      if (Number(pu.discount_pct||0) > 0) {
        lines.push(`  Discount: ${pu.discount_pct}%`);
        lines.push(`  Final price: ${fmtAed(pu.discounted_price)}`);
      }
      lines.push("");
    });
    lines.push(`Payment plan: ${paymentPlan}`);
    lines.push(`DLD fee: ${dldLabel}`);
    if (sd.service_charge_preset && sd.service_charge_preset !== "none") {
      lines.push(`Service charge waiver: ${scLabel}${sd.service_charge_custom?` (${sd.service_charge_custom})`:""}`);
    }
    if (expiryDate) lines.push(`Valid until: ${expiryDate.toLocaleDateString("en-AE",{day:"numeric",month:"short",year:"numeric"})}`);
    return lines.join("\n");
  };

  const copyEmailBody = async () => {
    try {
      await navigator.clipboard.writeText(buildEmailBody());
      showToast("Email body copied to clipboard","success");
    } catch (e) {
      // Fallback: manual select-and-copy via temp textarea
      const ta = document.createElement("textarea");
      ta.value = buildEmailBody();
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      showToast("Email body copied","success");
    }
  };

  const reopenInMail = () => {
    const subject = `Property Proposal — ${proposalUnits.length} Option${proposalUnits.length===1?"":"s"} for ${lead?.name||"Buyer"}`;
    const mailto = `mailto:${encodeURIComponent(lead?.email||"")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(buildEmailBody())}`;
    window.location.href = mailto;
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,.65)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1100,padding:"1rem"}}>
      <div style={{background:"#fff",borderRadius:16,width:680,maxWidth:"100%",maxHeight:"92vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 24px 64px rgba(11,31,58,.4)"}}>
        <div style={{padding:"1.1rem 1.4rem",borderBottom:"1px solid #E8EDF4",background:"#0F2540"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:3}}>
                <span style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700,color:"#fff"}}>👁 View Proposal</span>
                <span style={{fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:10,background:sm.bg,color:sm.c,letterSpacing:".4px"}}>{sm.label}</span>
              </div>
              <div style={{fontSize:12,color:"rgba(255,255,255,.65)"}}>
                Sent {proposal.sent_at ? new Date(proposal.sent_at).toLocaleString("en-AE",{dateStyle:"medium",timeStyle:"short"}) : "—"}
                {expiryDate && ` · Valid until ${expiryDate.toLocaleDateString("en-AE",{day:"numeric",month:"short"})}`}
              </div>
            </div>
            <button onClick={onClose} style={{background:"none",border:"none",fontSize:22,color:"#C9A84C",cursor:"pointer",lineHeight:1}}>×</button>
          </div>
        </div>

        <div style={{padding:"1.1rem 1.4rem",flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:18}}>

          {/* Cover message */}
          {coverNotes && (
            <div>
              <div style={{fontSize:11,fontWeight:700,color:"#94A3B8",textTransform:"uppercase",letterSpacing:".5px",marginBottom:6}}>Cover message</div>
              <div style={{padding:"10px 14px",background:"#F8FAFC",border:"1px solid #E2E8F0",borderRadius:8,fontSize:13,color:"#0F2540",whiteSpace:"pre-wrap",lineHeight:1.6}}>
                {coverNotes}
              </div>
            </div>
          )}

          {/* Units */}
          <div>
            <div style={{fontSize:11,fontWeight:700,color:"#94A3B8",textTransform:"uppercase",letterSpacing:".5px",marginBottom:6}}>
              {proposalUnits.length} unit{proposalUnits.length===1?"":"s"} · Total {fmtAed(totalValue)}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {proposalUnits.map((pu,idx)=>{
                const u = units.find(x => x.id === pu.unit_id);
                const proj = u ? projects.find(p=>p.id===u.project_id) : null;
                const bedLabel = u?.bedrooms === 0 ? "Studio" : (u?.bedrooms ? `${u.bedrooms}BR` : "");
                const isLinked = u?.id === opp.unit_id;
                return (
                  <div key={pu.unit_id} style={{background:"#FAFBFE",border:`1px solid ${isLinked?"#FCD34D":"#E2E8F0"}`,borderRadius:10,padding:"11px 13px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,flexWrap:"wrap"}}>
                      <span style={{fontSize:9,fontWeight:700,color:"#94A3B8"}}>OPTION {idx+1}</span>
                      {/* Phase 2.2b — Property Pack trigger */}
                      <button onClick={e=>{e.stopPropagation();openPropertyPack(pu.unit_id);}} title="View Property Pack" style={{padding:"2px 8px",borderRadius:5,border:"none",background:"#0F2540",color:"#fff",fontSize:9,fontWeight:700,cursor:"pointer"}}>📸 Pack</button>
                      <span style={{fontSize:14,fontWeight:700,color:"#0F2540"}}>{u?.unit_ref||"—"}</span>
                      {isLinked && <span style={{fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:10,background:"#FEF3C7",color:"#7A4F01"}}>📍 LINKED</span>}
                    </div>
                    <div style={{fontSize:11,color:"#64748B",marginBottom:8}}>
                      {[bedLabel, u?.size_sqft?`${u.size_sqft} sqft`:null, u?.view, proj?.name].filter(Boolean).join(" · ")}
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,fontSize:11}}>
                      <div>
                        <div style={{color:"#94A3B8",textTransform:"uppercase",letterSpacing:".4px",fontWeight:600,fontSize:9,marginBottom:2}}>Asking</div>
                        <div style={{fontWeight:700,color:"#0F2540"}}>{fmtAed(pu.asking_price)}</div>
                      </div>
                      <div>
                        <div style={{color:"#94A3B8",textTransform:"uppercase",letterSpacing:".4px",fontWeight:600,fontSize:9,marginBottom:2}}>Discount</div>
                        <div style={{fontWeight:700,color:Number(pu.discount_pct||0)>0?"#A06810":"#94A3B8"}}>{Number(pu.discount_pct||0)>0 ? `${pu.discount_pct}%` : "—"}</div>
                      </div>
                      <div>
                        <div style={{color:"#94A3B8",textTransform:"uppercase",letterSpacing:".4px",fontWeight:600,fontSize:9,marginBottom:2}}>Final</div>
                        <div style={{fontWeight:700,color:"#1A5FA8"}}>{fmtAed(pu.discounted_price)}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Terms */}
          <div>
            <div style={{fontSize:11,fontWeight:700,color:"#94A3B8",textTransform:"uppercase",letterSpacing:".5px",marginBottom:6}}>Terms</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <div style={{background:"#F8FAFC",border:"1px solid #E2E8F0",borderRadius:8,padding:"9px 12px"}}>
                <div style={{fontSize:9,color:"#94A3B8",fontWeight:600,textTransform:"uppercase",letterSpacing:".4px",marginBottom:3}}>📅 Payment plan</div>
                <div style={{fontSize:12,fontWeight:600,color:"#0F2540"}}>{paymentPlan}</div>
              </div>
              <div style={{background:"#F8FAFC",border:"1px solid #E2E8F0",borderRadius:8,padding:"9px 12px"}}>
                <div style={{fontSize:9,color:"#94A3B8",fontWeight:600,textTransform:"uppercase",letterSpacing:".4px",marginBottom:3}}>🏛️ DLD fee</div>
                <div style={{fontSize:12,fontWeight:600,color:"#0F2540"}}>{dldLabel}</div>
                {sd.dld_handling==="specific_amount" && sd.dld_custom_amount && (
                  <div style={{fontSize:11,color:"#64748B",marginTop:2}}>{fmtAed(sd.dld_custom_amount)} waived</div>
                )}
              </div>
              <div style={{background:"#F8FAFC",border:"1px solid #E2E8F0",borderRadius:8,padding:"9px 12px"}}>
                <div style={{fontSize:9,color:"#94A3B8",fontWeight:600,textTransform:"uppercase",letterSpacing:".4px",marginBottom:3}}>🧾 Service charge</div>
                <div style={{fontSize:12,fontWeight:600,color:"#0F2540"}}>{scLabel}{sd.service_charge_custom?` (${sd.service_charge_custom})`:""}</div>
              </div>
              <div style={{background:"#F8FAFC",border:"1px solid #E2E8F0",borderRadius:8,padding:"9px 12px"}}>
                <div style={{fontSize:9,color:"#94A3B8",fontWeight:600,textTransform:"uppercase",letterSpacing:".4px",marginBottom:3}}>⏰ Validity</div>
                <div style={{fontSize:12,fontWeight:600,color:"#0F2540"}}>
                  {sd.validity_days?`${sd.validity_days} days`:"—"}
                  {expiryDate && ` (until ${expiryDate.toLocaleDateString("en-AE",{day:"numeric",month:"short"})})`}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"1rem 1.4rem",borderTop:"1px solid #E8EDF4",background:"#F8FAFC",flexWrap:"wrap",gap:8}}>
          <div style={{display:"flex",gap:6}}>
            <button onClick={copyEmailBody}
              style={{padding:"8px 14px",borderRadius:7,border:"1.5px solid #D1D9E6",background:"#fff",color:"#0F2540",fontSize:12,fontWeight:600,cursor:"pointer"}}>
              📋 Copy email body
            </button>
            <button onClick={reopenInMail}
              style={{padding:"8px 14px",borderRadius:7,border:"1.5px solid #1A5FA8",background:"#EFF6FF",color:"#1A5FA8",fontSize:12,fontWeight:700,cursor:"pointer"}}>
              📧 Open in mail client
            </button>
          </div>
          <button onClick={onClose}
            style={{padding:"8px 18px",borderRadius:7,border:"none",background:"#0F2540",color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}


export default ProposalViewerDialog;
