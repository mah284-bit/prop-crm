import React, { useState } from 'react';
import { supabase } from "../../lib/supabase";
import { Btn } from "../../modules/shared/Btn.jsx";
import { Modal } from "../../modules/shared/Modal.jsx";
import { FF } from "../../modules/shared/FormComponents.jsx";
import { MEET_TYPES } from "../../modules/constants.js";
import { uid, fmtDT } from "../../modules/utils.js";

function HandoverMeetingDialog({ opp, lead, currentUser, onClose, onSaved, showToast }) {
  const [meetingAt, setMeetingAt] = useState(()=>{
    const d = new Date(); d.setDate(d.getDate()+3); d.setHours(11,0,0,0);
    const pad = n=>String(n).padStart(2,"0");
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const [location, setLocation] = useState("");
  const [attendees, setAttendees] = useState("");
  const [agenda, setAgenda] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async()=>{
    if(!meetingAt){showToast("Set the meeting date/time","error");return;}
    if(!location.trim()){showToast("Where will it happen?","error");return;}
    if(!attendees.trim()){showToast("List who's attending","error");return;}
    setSaving(true);
    try{
      const company_id = opp.company_id || currentUser.company_id || null;
      const sd = {meeting_at:new Date(meetingAt).toISOString(), location:location.trim(), attendees:attendees.trim(), agenda:agenda.trim()};
      const{data:actRow,error}=await supabase.from("activities").insert({
        opportunity_id: opp.id, lead_id: lead.id, company_id,
        type:"Meeting",
        note:`📅 Handover meeting scheduled at ${location.trim()} · attendees: ${attendees.trim()}${agenda.trim()?` · agenda: ${agenda.trim()}`:""}`,
        scheduled_at: new Date(meetingAt).toISOString(),
        status:"upcoming",
        user_id: currentUser.id, user_name: currentUser.full_name, lead_name: lead.name,
        stage_at_event: opp.stage,
        activity_subtype: "handover_meeting",
        structured_data: sd,
      }).select().single();
      if(error){
        console.error("Handover insert failed:", error);
        showToast(`Failed: ${error.message||"unknown"}`,"error");
        setSaving(false);
        return;
      }
      // Create reminder 1 day before the meeting
      const remindAt = new Date(meetingAt);
      remindAt.setDate(remindAt.getDate()-1);
      remindAt.setHours(9,0,0,0);
      let reminder = null;
      if(remindAt > new Date()){
        const{data:remRow,error:remErr}=await supabase.from("reminders").insert({
          company_id, user_id: currentUser.id,
          related_opportunity_id: opp.id, related_lead_id: lead.id, related_activity_id: actRow.id,
          trigger_at: remindAt.toISOString(),
          title: `Handover meeting tomorrow — ${lead.name}`,
          body: `${location.trim()} · ${attendees.trim()}`,
          reason: "auto_handover_meeting_reminder",
          status: "pending",
          created_by: currentUser.id,
        }).select().single();
        if(!remErr) reminder = remRow;
      }
      onSaved(actRow, reminder);
    } catch(e){
      console.error("Handover save error:", e);
      showToast(`Save failed: ${e.message||"unknown"}`,"error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,.65)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1100,padding:"1rem"}}>
      <div style={{background:"#fff",borderRadius:16,width:520,maxWidth:"100%",maxHeight:"90vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 24px 64px rgba(11,31,58,.4)"}}>
        <div style={{padding:"1.1rem 1.4rem",borderBottom:"1px solid #E8EDF4",background:"#0F2540"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
            <div>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:700,color:"#fff"}}>📅 Schedule Handover Meeting</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,.65)",marginTop:3}}>Where buyer, broker, and developer rep finalise the deal.</div>
            </div>
            <button onClick={onClose} style={{background:"none",border:"none",fontSize:22,color:"#C9A84C",cursor:"pointer",lineHeight:1}}>×</button>
          </div>
        </div>
        <div style={{padding:"1.1rem 1.4rem",flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:14}}>
          <div>
            <label style={{fontSize:11,fontWeight:700,color:"#0F2540",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:".4px"}}>Meeting date & time *</label>
            <input type="datetime-local" value={meetingAt} onChange={e=>setMeetingAt(e.target.value)}
              style={{padding:"9px 12px",borderRadius:8,border:"1.5px solid #D1D9E6",fontSize:13,fontFamily:"inherit",background:"#fff"}}/>
          </div>
          <div>
            <label style={{fontSize:11,fontWeight:700,color:"#0F2540",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:".4px"}}>Location *</label>
            <input type="text" value={location} onChange={e=>setLocation(e.target.value)}
              placeholder="e.g. Sobha Sales Gallery, Sobha Hartland — or 3-way Zoom call"
              style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1.5px solid #D1D9E6",fontSize:13,fontFamily:"inherit",boxSizing:"border-box"}}/>
          </div>
          <div>
            <label style={{fontSize:11,fontWeight:700,color:"#0F2540",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:".4px"}}>Attendees *</label>
            <input type="text" value={attendees} onChange={e=>setAttendees(e.target.value)}
              placeholder="e.g. Mr. Khan (buyer), Sara (Sobha rep), Abid (broker)"
              style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1.5px solid #D1D9E6",fontSize:13,fontFamily:"inherit",boxSizing:"border-box"}}/>
          </div>
          <div>
            <label style={{fontSize:11,fontWeight:700,color:"#0F2540",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:".4px"}}>Agenda / prep notes</label>
            <textarea value={agenda} onChange={e=>setAgenda(e.target.value)} rows={3}
              placeholder="Final price, payment terms to confirm, documents needed, anything that could derail it"
              style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1.5px solid #D1D9E6",fontSize:13,fontFamily:"inherit",resize:"vertical",boxSizing:"border-box"}}/>
          </div>
          <div style={{padding:"8px 12px",background:"#FFFBEA",borderRadius:7,border:"1px solid #FCD34D",fontSize:11,color:"#7A4F01"}}>
            💡 A reminder will be auto-set for 9am the day before the meeting.
          </div>
        </div>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end",padding:"1rem 1.4rem",borderTop:"1px solid #E8EDF4",background:"#F8FAFC"}}>
          <button onClick={onClose} disabled={saving}
            style={{padding:"9px 18px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:13,fontWeight:600,cursor:saving?"not-allowed":"pointer"}}>
            Cancel
          </button>
          <button onClick={submit} disabled={saving}
            style={{padding:"9px 24px",borderRadius:8,border:"none",background:saving?"#94A3B8":"#7C3AED",color:"#fff",fontSize:13,fontWeight:700,cursor:saving?"not-allowed":"pointer"}}>
            {saving?"Saving…":"📅 Schedule"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Phase E W2 — Visit Outcome Dialog
   Captures what happened AFTER the site visit. Updates the original
   upcoming visit activity to completed, writes outcome data into
   structured_data, and creates a follow-up reminder.
═══════════════════════════════════════════════════════════════ */

export default HandoverMeetingDialog;
