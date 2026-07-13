import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

export default function OpenItemsGuard({ opp, lead, activities, units, projects, currentUser, onAllClosed, onCancel, onCaptureVisit, showToast, refreshActivities }) {
  const [cancelDialog, setCancelDialog] = useState(null); // {activity, reason}

  // Compute open items each render
  const openItems = activities.filter(a =>
    a.status === "upcoming" && (
      (a.activity_subtype === "stage_advance" && a.to_stage === "Site Visit")
      || a.activity_subtype === "handover_meeting"
    )
  );

  // Auto-close the guard when no open items remain
  useEffect(() => {
    if (openItems.length === 0) {
      onAllClosed();
    }
    // eslint-disable-next-line
  }, [openItems.length]);

  if (openItems.length === 0) return null;

  const cancelItem = async () => {
    if (!cancelDialog || !(cancelDialog.reason||"").trim()) {
      showToast("Please give a reason for cancelling","error");
      return;
    }
    const a = cancelDialog.activity;
    const company_id = opp.company_id || currentUser.company_id || null;
    // Mark activity cancelled — DON'T delete it, audit trail required
    const{error: updErr}=await supabase.from("activities").update({
      status:"cancelled",
      outcome:`Cancelled (open-items guard): ${cancelDialog.reason.trim()}`,
    }).eq("id", a.id);
    if(updErr){
      showToast(`Failed: ${updErr.message}`,"error");
      return;
    }
    // Cancel any pending visit-imminent reminders for this activity
    await supabase.from("reminders")
      .update({status:"cancelled"})
      .eq("related_activity_id", a.id)
      .eq("status","pending");
    // Drop a permanent timeline note
    const itemName = a.activity_subtype === "handover_meeting" ? "Handover Meeting" : "Site Visit";
    await supabase.from("activities").insert({
      opportunity_id: opp.id, lead_id: lead.id, company_id,
      type:"Note",
      note:`✕ ${itemName} cancelled before proposal — Reason: ${cancelDialog.reason.trim()}`,
      status:"completed",
      user_id: currentUser.id, user_name: currentUser.full_name, lead_name: lead.name,
      stage_at_event: opp.stage,
      activity_subtype:"item_cancelled_pre_proposal",
    });
    setCancelDialog(null);
    refreshActivities();
    showToast("Item cancelled with reason logged","success");
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,.65)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1100,padding:"1rem"}}>
      <div style={{background:"#fff",borderRadius:16,width:580,maxWidth:"100%",maxHeight:"90vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 24px 64px rgba(11,31,58,.4)"}}>
        <div style={{padding:"1.1rem 1.4rem",borderBottom:"1px solid #E8EDF4",background:"#0F2540"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
            <div>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:700,color:"#fff"}}>🛑 Close open items first</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,.65)",marginTop:3}}>
                A proposal is the first official document sent to the buyer.<br/>Resolve these items before sending so nothing is left dangling on the record.
              </div>
            </div>
            <button onClick={onCancel} style={{background:"none",border:"none",fontSize:22,color:"#C9A84C",cursor:"pointer",lineHeight:1}}>×</button>
          </div>
        </div>

        <div style={{padding:"1.1rem 1.4rem",flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:10}}>
          {openItems.map(a => {
            const sd = a.structured_data || {};
            const isHandover = a.activity_subtype === "handover_meeting";
            const isSiteVisit = a.activity_subtype === "stage_advance" && a.to_stage === "Site Visit";
            const dt = sd.visit_at || sd.meeting_at || a.scheduled_at;
            const itemName = isHandover ? "Handover Meeting" : "Site Visit";
            const icon = isHandover ? "📅" : "🏠";
            const unitsList = (() => {
              const ids = sd.units_to_show || sd.units_viewed || [];
              return ids.map(uid => {
                const u = (units||[]).find(x => x.id === uid);
                return u?.unit_ref;
              }).filter(Boolean).join(", ");
            })();

            return (
              <div key={a.id} style={{background:"#FFFBEA",border:"1.5px solid #FCD34D",borderRadius:10,padding:"12px 14px"}}>
                <div style={{display:"flex",alignItems:"flex-start",gap:9}}>
                  <span style={{fontSize:20,flexShrink:0}}>{icon}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:4}}>
                      <span style={{fontSize:13,fontWeight:700,color:"#0F2540"}}>{itemName}</span>
                      <span style={{fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:10,background:"#FEE2E2",color:"#C53030",letterSpacing:".4px"}}>OUTCOME PENDING</span>
                    </div>
                    {dt && (
                      <div style={{fontSize:11,color:"#7A4F01",marginBottom:3}}>
                        Scheduled for {new Date(dt).toLocaleString("en-AE",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}
                      </div>
                    )}
                    {(sd.expected_attendees || sd.attendees) && (
                      <div style={{fontSize:11,color:"#64748B",marginBottom:3}}>
                        👥 {sd.expected_attendees || sd.attendees}
                      </div>
                    )}
                    {unitsList && (
                      <div style={{fontSize:11,color:"#64748B",marginBottom:3}}>
                        🏢 {unitsList}
                      </div>
                    )}

                    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:8}}>
                      {isSiteVisit && (
                        <button onClick={()=>onCaptureVisit(a)}
                          style={{padding:"6px 12px",borderRadius:6,border:"none",background:"#1A7F5A",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                          📋 Capture Outcome
                        </button>
                      )}
                      <button onClick={()=>setCancelDialog({activity:a, reason:""})}
                        style={{padding:"6px 12px",borderRadius:6,border:"1.5px solid #C53030",background:"#fff",color:"#C53030",fontSize:11,fontWeight:600,cursor:"pointer"}}>
                        ✕ Cancel with reason
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          <div style={{fontSize:11,color:"#94A3B8",fontStyle:"italic",padding:"6px 4px",marginTop:4}}>
            💡 Open negotiation rounds are not blocking — sending a new proposal supersedes any pending counter.
          </div>
        </div>

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"1rem 1.4rem",borderTop:"1px solid #E8EDF4",background:"#F8FAFC"}}>
          <span style={{fontSize:11,color:"#64748B"}}>{openItems.length} item{openItems.length===1?"":"s"} to resolve</span>
          <button onClick={onCancel}
            style={{padding:"9px 18px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>
            Back to opportunity
          </button>
        </div>

        {/* Inline cancel-with-reason mini dialog */}
        {cancelDialog && (
          <div style={{position:"absolute",inset:0,background:"rgba(11,31,58,.5)",display:"flex",alignItems:"center",justifyContent:"center",borderRadius:16,padding:"1.5rem"}}>
            <div style={{background:"#fff",borderRadius:12,width:440,maxWidth:"100%",boxShadow:"0 12px 32px rgba(11,31,58,.25)",overflow:"hidden"}}>
              <div style={{padding:"12px 16px",background:"#0F2540",color:"#fff"}}>
                <div style={{fontSize:14,fontWeight:700}}>Cancel with reason</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,.7)",marginTop:2}}>This is recorded permanently in the activity timeline.</div>
              </div>
              <div style={{padding:"14px 16px"}}>
                <label style={{fontSize:11,fontWeight:700,color:"#0F2540",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:".4px"}}>Why are you cancelling? *</label>
                <textarea value={cancelDialog.reason} onChange={e=>setCancelDialog(d=>({...d,reason:e.target.value}))} rows={3}
                  placeholder="e.g. Buyer asked for proposal directly, didn't visit; or Visit happened informally and feedback already known"
                  style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1.5px solid #D1D9E6",fontSize:13,fontFamily:"inherit",resize:"vertical",boxSizing:"border-box"}}/>
                <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:12}}>
                  <button onClick={()=>setCancelDialog(null)}
                    style={{padding:"7px 14px",borderRadius:7,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>
                    Back
                  </button>
                  <button onClick={cancelItem}
                    style={{padding:"7px 18px",borderRadius:7,border:"none",background:"#C53030",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                    Cancel item
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
