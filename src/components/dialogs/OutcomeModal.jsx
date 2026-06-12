import React, { useState } from 'react';

function OutcomeModal({activity, onClose, onSave}){
  const [outcome, setOutcome] = useState(activity._pendingOutcome||"completed");
  const [notes, setNotes] = useState("");
  const [reschedDt, setReschedDt] = useState("");
  const titles = {completed:"✅ Mark as Completed",no_show:"📵 No Show / No Answer",rescheduled:"🔄 Reschedule",cancelled:"❌ Cancel Activity"};
  const placeholders = {
    completed:"What was discussed? What was the outcome?",
    no_show:"Any notes? e.g. Left voicemail, will try again tomorrow",
    rescheduled:"Why is it being rescheduled?",
    cancelled:"Reason for cancellation"
  };
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2000,padding:"1rem"}}>
      <div style={{background:"#fff",borderRadius:16,width:440,maxWidth:"100%",boxShadow:"0 20px 60px rgba(11,31,58,.35)",overflow:"hidden"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"1rem 1.5rem",borderBottom:"1px solid #E8EDF4",background:"#0F2540"}}>
          <span style={{fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:700,color:"#fff"}}>{titles[outcome]}</span>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:20,color:"#C9A84C",cursor:"pointer"}}>×</button>
        </div>
        <div style={{padding:"1.25rem 1.5rem"}}>
          {outcome==="rescheduled"&&(
            <div style={{marginBottom:12}}>
              <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:".5px"}}>📅 New Date & Time *</label>
              <input type="datetime-local" value={reschedDt} onChange={e=>setReschedDt(e.target.value)} style={{width:"100%",padding:"8px 10px",border:"1.5px solid #E2E8F0",borderRadius:8,fontSize:13,outline:"none",boxSizing:"border-box"}}/>
            </div>
          )}
          <div style={{marginBottom:16}}>
            <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:".5px"}}>
              {outcome==="completed"?"💬 Outcome Notes":"📝 Notes"}{outcome==="cancelled"?" *":""}
            </label>
            <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3}
              placeholder={placeholders[outcome]}
              style={{width:"100%",padding:"8px 10px",border:"1.5px solid #E2E8F0",borderRadius:8,fontSize:13,resize:"vertical",outline:"none",boxSizing:"border-box"}}/>
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <button onClick={onClose} style={{padding:"8px 18px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancel</button>
            <button onClick={()=>{
              if(outcome==="rescheduled"&&!reschedDt){alert("Please select a new date");return;}
              if(outcome==="cancelled"&&!notes.trim()){alert("Please provide a reason");return;}
              onSave(outcome,notes,reschedDt);
            }} style={{padding:"8px 20px",borderRadius:8,border:"none",background:"#0F2540",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>
              Save Outcome
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OutcomeModal;
