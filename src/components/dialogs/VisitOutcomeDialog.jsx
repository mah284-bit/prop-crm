import React, { useState } from 'react';
import { supabase } from "../../lib/supabase";
import { Btn } from "../../modules/shared/Btn.jsx";
import { Modal } from "../../modules/shared/Modal.jsx";
import { FF } from "../../modules/shared/FormComponents.jsx";
import { FOLLOW_TYPES } from "../../modules/constants.js";
import { uid } from "../../modules/utils.js";

function VisitOutcomeDialog({ visitActivity, opp, lead, units, projects, currentUser, onClose, onSaved, showToast }) {
  const [unitsViewed, setUnitsViewed] = useState(()=>visitActivity?.structured_data?.units_to_show || []);
  const [actualAttendees, setActualAttendees] = useState("");
  const [feedback, setFeedback] = useState("");
  const [interestLevel, setInterestLevel] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [followUpDate, setFollowUpDate] = useState(()=>{
    const d = new Date(); d.setDate(d.getDate()+2);
    return d.toISOString().split("T")[0];
  });
  const [saving, setSaving] = useState(false);

  if(!visitActivity) return null;

  const sd = visitActivity.structured_data || {};
  const expectedAttendees = sd.expected_attendees || "";
  const visitTime = sd.visit_at ? new Date(sd.visit_at) : null;

  // Resolve unit options the same way the multi-select does
  const unitOpts = (units||[]).map(u => {
    const proj = (projects||[]).find(p => p.id === u.project_id);
    const bedLabel = u.bedrooms === 0 ? "Studio" : (u.bedrooms ? `${u.bedrooms}BR` : "");
    return {
      id: u.id,
      label: [u.unit_ref || u.id, bedLabel, u.view].filter(Boolean).join(" · "),
      sub: proj?.name,
      isPlanned: (sd.units_to_show||[]).includes(u.id),
    };
  }).filter(u => u.isPlanned || (sd.units_to_show||[]).length === 0)
    .sort((a,b) => (a.isPlanned===b.isPlanned?0:(a.isPlanned?-1:1)));

  const toggleUnit = (id) => {
    setUnitsViewed(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]);
  };

  const interestOpts = [
    {value:"Hot — ready to negotiate", color:"#DC2626", bg:"#FEE2E2"},
    {value:"Warm — needs more info",   color:"#D97706", bg:"#FEF3C7"},
    {value:"Cold — not the right fit", color:"#0891B2", bg:"#CFFAFE"},
    {value:"Lost interest",            color:"#6B7280", bg:"#F3F4F6"},
  ];

  const submit = async()=>{
    if(unitsViewed.length===0){showToast("Tick at least one unit that was actually viewed","error");return;}
    if(feedback.trim().length<20){showToast("Feedback needs at least 20 characters","error");return;}
    if(!interestLevel){showToast("Pick an interest level","error");return;}
    if(!nextStep){showToast("Pick a next step","error");return;}
    if(!followUpDate){showToast("Set a follow-up date","error");return;}
    setSaving(true);
    try{
      const company_id = opp.company_id || currentUser.company_id || null;
      // Merge outcome data into the original activity's structured_data
      const newSd = {
        ...sd,
        units_viewed: unitsViewed,
        actual_attendees: actualAttendees.trim() || expectedAttendees,
        feedback: feedback.trim(),
        interest_level: interestLevel,
        next_step: nextStep,
        follow_up_date: followUpDate,
        outcome_captured_at: new Date().toISOString(),
      };
      const newNote = `[Site Visit completed] ${feedback.trim().slice(0,200)}`;
      const{data:updatedRow,error:updErr}=await supabase
        .from("activities")
        .update({
          status: "completed",
          note: newNote,
          structured_data: newSd,
          activity_subtype: "site_visit_completed",
        })
        .eq("id", visitActivity.id)
        .select()
        .single();
      if(updErr){
        console.error("Visit outcome update failed:", updErr);
        showToast(`Failed: ${updErr.message||"unknown"}`,"error");
        setSaving(false);
        return;
      }
      // Cancel the imminent-visit reminder if it's still pending — visit is over
      await supabase.from("reminders")
        .update({status:"completed"})
        .eq("related_activity_id", visitActivity.id)
        .eq("reason", "auto_visit_imminent")
        .eq("status", "pending");
      // Create follow-up reminder for the agreed follow-up date
      const triggerAt = new Date(followUpDate);
      triggerAt.setHours(9,0,0,0);
      let reminder = null;
      if(triggerAt > new Date()){
        const interestShort = interestLevel.split("—")[0].trim();
        const{data:remRow,error:remErr}=await supabase.from("reminders").insert({
          company_id, user_id: currentUser.id,
          related_opportunity_id: opp.id, related_lead_id: lead.id, related_activity_id: visitActivity.id,
          trigger_at: triggerAt.toISOString(),
          title: `Follow up after site visit — ${lead.name}`,
          body: `Next step: ${nextStep}${interestShort?` · Interest: ${interestShort}`:""}`,
          reason: "auto_follow_up_after_site_visit",
          status: "pending",
          created_by: currentUser.id,
        }).select().single();
        if(!remErr) reminder = remRow;
      }
      onSaved(updatedRow, reminder);
    } catch(e){
      console.error("Visit outcome save error:", e);
      showToast(`Save failed: ${e.message||"unknown"}`,"error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,.65)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1100,padding:"1rem"}}>
      <div style={{background:"#fff",borderRadius:16,width:600,maxWidth:"100%",maxHeight:"90vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 24px 64px rgba(11,31,58,.4)"}}>
        <div style={{padding:"1.1rem 1.4rem",borderBottom:"1px solid #E8EDF4",background:"#0F2540"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
            <div>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:700,color:"#fff"}}>📋 Capture Visit Outcome</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,.65)",marginTop:3}}>What actually happened during the visit?</div>
              {visitTime && (
                <div style={{fontSize:11,color:"#C9A84C",marginTop:6,fontWeight:600}}>
                  Visit was scheduled for {visitTime.toLocaleString("en-AE",{dateStyle:"medium",timeStyle:"short"})}
                </div>
              )}
            </div>
            <button onClick={onClose} style={{background:"none",border:"none",fontSize:22,color:"#C9A84C",cursor:"pointer",lineHeight:1}}>×</button>
          </div>
        </div>
        <div style={{padding:"1.1rem 1.4rem",flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:14}}>

          {/* Units actually viewed */}
          <div>
            <label style={{fontSize:11,fontWeight:700,color:"#0F2540",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:".4px"}}>
              Units actually viewed *
            </label>
            <div style={{fontSize:10,color:"#94A3B8",marginBottom:6}}>
              Pre-filled with what was planned. Untick if a unit wasn't actually shown, or add others.
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:4,maxHeight:200,overflowY:"auto",border:"1.5px solid #D1D9E6",borderRadius:8,padding:6,background:"#fff"}}>
              {unitOpts.length === 0 ? (
                <div style={{fontSize:12,color:"#94A3B8",fontStyle:"italic",padding:"8px 12px"}}>No units to choose from.</div>
              ) : unitOpts.map(o=>{
                const sel = unitsViewed.includes(o.id);
                return (
                  <button key={o.id} onClick={()=>toggleUnit(o.id)}
                    style={{
                      display:"flex",alignItems:"center",gap:9,padding:"7px 10px",borderRadius:6,
                      border:"none",
                      background: sel ? "#E6EFF9" : "transparent",
                      cursor:"pointer", textAlign:"left", transition:"all .1s",
                    }}>
                    <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:16,height:16,borderRadius:4,border:`1.5px solid ${sel?"#0F2540":"#CBD5E1"}`,background:sel?"#0F2540":"#fff",color:"#fff",fontSize:11,lineHeight:1,flexShrink:0}}>{sel?"✓":""}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:600,color:"#0F2540"}}>{o.label}</div>
                      {o.sub && <div style={{fontSize:11,color:"#64748B"}}>{o.sub}</div>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Attendees (override) */}
          <div>
            <label style={{fontSize:11,fontWeight:700,color:"#0F2540",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:".4px"}}>
              Who actually attended? <span style={{fontWeight:500,color:"#94A3B8",textTransform:"none",letterSpacing:0}}>(leave blank if as planned)</span>
            </label>
            {expectedAttendees && (
              <div style={{fontSize:11,color:"#94A3B8",marginBottom:5,fontStyle:"italic"}}>Planned: {expectedAttendees}</div>
            )}
            <input type="text" value={actualAttendees} onChange={e=>setActualAttendees(e.target.value)}
              placeholder={expectedAttendees ? `Same as planned, or override here` : `e.g. Mr. Khan only — wife couldn't make it`}
              style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1.5px solid #D1D9E6",fontSize:13,fontFamily:"inherit",boxSizing:"border-box"}}/>
          </div>

          {/* Feedback */}
          <div>
            <label style={{fontSize:11,fontWeight:700,color:"#0F2540",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:".4px"}}>Customer feedback *</label>
            <textarea value={feedback} onChange={e=>setFeedback(e.target.value)} rows={4}
              placeholder="What did they like? Any concerns? Reactions to specific units, layout, finish, view, location, price, payment plan…"
              style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1.5px solid #D1D9E6",fontSize:13,fontFamily:"inherit",resize:"vertical",boxSizing:"border-box"}}/>
            <div style={{fontSize:10,color:"#94A3B8",marginTop:3}}>{feedback.length} / 20 characters minimum</div>
          </div>

          {/* Interest */}
          <div>
            <label style={{fontSize:11,fontWeight:700,color:"#0F2540",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:".4px"}}>Interest level after visit *</label>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {interestOpts.map(o=>{
                const sel = interestLevel === o.value;
                return (
                  <button key={o.value} onClick={()=>setInterestLevel(o.value)}
                    style={{
                      padding:"7px 14px",borderRadius:20,
                      border:`1.5px solid ${sel?o.color:"#D1D9E6"}`,
                      background:sel?o.bg:"#fff",
                      color:sel?o.color:"#4A5568",
                      fontSize:12,fontWeight:600,cursor:"pointer",
                    }}>
                    {o.value}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Next step */}
          <div>
            <label style={{fontSize:11,fontWeight:700,color:"#0F2540",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:".4px"}}>Next step agreed *</label>
            <select value={nextStep} onChange={e=>setNextStep(e.target.value)}
              style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1.5px solid #D1D9E6",fontSize:13,fontFamily:"inherit",background:"#fff",cursor:"pointer"}}>
              <option value="">— Select —</option>
              {["Send proposal","Show more units","Follow up call","Customer needs time","Lost interest"].map(o=><option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          {/* Follow up date */}
          <div>
            <label style={{fontSize:11,fontWeight:700,color:"#0F2540",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:".4px"}}>Follow up by *</label>
            <input type="date" value={followUpDate} onChange={e=>setFollowUpDate(e.target.value)}
              style={{padding:"9px 12px",borderRadius:8,border:"1.5px solid #D1D9E6",fontSize:13,fontFamily:"inherit",background:"#fff"}}/>
          </div>
        </div>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end",padding:"1rem 1.4rem",borderTop:"1px solid #E8EDF4",background:"#F8FAFC"}}>
          <button onClick={onClose} disabled={saving}
            style={{padding:"9px 18px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:13,fontWeight:600,cursor:saving?"not-allowed":"pointer"}}>
            Cancel
          </button>
          <button onClick={submit} disabled={saving}
            style={{padding:"9px 24px",borderRadius:8,border:"none",background:saving?"#94A3B8":"#1A7F5A",color:"#fff",fontSize:13,fontWeight:700,cursor:saving?"not-allowed":"pointer"}}>
            {saving?"Saving…":"✓ Save Visit Outcome"}
          </button>
        </div>
      </div>
    </div>
  );
}


export default VisitOutcomeDialog;
