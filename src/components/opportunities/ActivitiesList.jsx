import OutcomeModal from "../dialogs/OutcomeModal.jsx";
import React, { useState } from 'react';
import { supabase } from "../../lib/supabase.js";
import AppendNote from "./AppendNote.jsx";
import { Btn } from "../../modules/shared/Btn.jsx";
import { Badge } from "../../modules/shared/Badge.jsx";
import { Toast } from "../../modules/shared/Toast.jsx";
import { useLeadPersons, ROLE_LABELS } from "../../lib/useLeadPersons.js";

function ActivitiesList({activities, setActivities, opp, canEdit, showToast, isLeasing=false, currentStage=null, units=[], onCaptureVisitOutcome=null, currentUser=null}){
  const [outcomeModal, setOutcomeModal] = useState(null); // {activity, pendingOutcome}
  const { persons: actCardPersons } = useLeadPersons(opp?.lead_id);
  const personsById = (actCardPersons||[]).reduce((m,p)=>{m[p.id]=p;return m;},{});
  const [scope, setScope] = useState("stage"); // "stage" | "all"
  // Filter activities based on scope
  const filtered = (currentStage && scope === "stage")
    ? activities.filter(a => a.stage_at_event === currentStage)
    : activities;
  const upcoming = filtered.filter(a=>a.status==="upcoming"||(a.scheduled_at&&new Date(a.scheduled_at)>new Date()&&a.status!=="completed"&&a.status!=="no_show"&&a.status!=="cancelled"));
  const past = filtered.filter(a=>!upcoming.find(u=>u.id===a.id));
  const stageOnlyCount = currentStage ? activities.filter(a => a.stage_at_event === currentStage).length : 0;
  const icons = {Call:"📞",Email:"✉️",Meeting:"🤝",Visit:"🏠",WhatsApp:"💬",Note:"📝"};
  const statusColors = {completed:"#1A7F5A",upcoming:"#C9A84C",no_show:"#E53E3E",rescheduled:"#1A5FA8",cancelled:"#718096"};
  const statusLabels = {completed:"✅ Completed",upcoming:"⏰ Upcoming",no_show:"📵 No Show",rescheduled:"🔄 Rescheduled",cancelled:"❌ Cancelled"};

  const markOutcome = async(a, outcome, notes, reschedDt)=>{
    // Phase E W2: rescheduling a stage-advance visit (Site Visit, Handover, etc.) should
    // UPDATE the existing upcoming activity in place rather than mark it "rescheduled" and
    // create a generic clone. This preserves structured_data (units, attendees, prep notes)
    // and keeps the rich "Capture Outcome" button visible on the moved card.
    const isStructuredVisit = outcome === "rescheduled"
      && reschedDt
      && (a.activity_subtype === "stage_advance" || a.activity_subtype === "handover_meeting");

    if (isStructuredVisit) {
      // Build the new note line — keep the existing prefix but update the date
      const newSd = {...(a.structured_data||{}), visit_at: new Date(reschedDt).toISOString(), reschedule_reason: notes||"", rescheduled_at: new Date().toISOString()};
      const{error:updErr}=await supabase.from("activities").update({
        scheduled_at: reschedDt,
        status: "upcoming",
        structured_data: newSd,
        outcome: notes ? `Rescheduled: ${notes}` : null,
      }).eq("id", a.id);
      if(updErr){
        console.error("Reschedule update failed:", updErr);
        showToast(`Reschedule failed: ${updErr.message||"unknown"}`,"error");
        return;
      }
      // Move the imminent-visit reminder if we know about one
      // (60 min before new visit time)
      const newReminderAt = new Date(reschedDt);
      newReminderAt.setMinutes(newReminderAt.getMinutes() - 60);
      if(newReminderAt > new Date()){
        await supabase.from("reminders")
          .update({trigger_at: newReminderAt.toISOString()})
          .eq("related_activity_id", a.id)
          .eq("reason", "auto_visit_imminent")
          .eq("status", "pending");
      } else {
        // New time is in the past or too close — cancel the imminent reminder
        await supabase.from("reminders")
          .update({status:"cancelled"})
          .eq("related_activity_id", a.id)
          .eq("reason", "auto_visit_imminent")
          .eq("status", "pending");
      }
      // Drop a small audit note into the timeline so the move is visible historically
      const visitDateLabel = new Date(reschedDt).toLocaleDateString("en-AE",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
      await supabase.from("activities").insert({
        opportunity_id:isLeasing?null:a.opportunity_id,
        lease_opportunity_id:isLeasing?opp.id:null,
        lead_id:isLeasing?null:a.lead_id,
        company_id:a.company_id,
        type:"Note",
        note:`🔄 ${a.to_stage||"Visit"} rescheduled → ${visitDateLabel}${notes?` — ${notes}`:""}`,
        status:"completed",
        user_id:a.user_id, user_name:a.user_name, lead_name:a.lead_name,
        stage_at_event: a.stage_at_event||null,
        activity_subtype: "visit_rescheduled",
      });
    } else {
      // Legacy/non-structured path — keeps existing behaviour for regular calls/emails/notes
      await supabase.from("activities").update({status:outcome, outcome:notes||null, rescheduled_to:reschedDt||null}).eq("id",a.id);
      if(reschedDt){
        await supabase.from("activities").insert({
          opportunity_id:isLeasing?null:a.opportunity_id,
          lease_opportunity_id:isLeasing?opp.id:null,
          lead_id:isLeasing?null:a.lead_id,
          type:a.type, note:"Rescheduled: "+(notes||""),
          scheduled_at:reschedDt, status:"upcoming",
          user_id:a.user_id, user_name:a.user_name,
          lead_name:a.lead_name, company_id:a.company_id,
        });
      }
    }
    const col=isLeasing?"lease_opportunity_id":"opportunity_id";
    const{data}=await supabase.from("activities").select("*").eq(col,opp.id).order("created_at",{ascending:false});
    if(data) setActivities(data);
    setOutcomeModal(null);
    showToast(outcome==="rescheduled"?"Visit rescheduled":"Task updated","success");
  };

  const ActCard = ({a})=>{
    const st = a.status||(a.scheduled_at&&new Date(a.scheduled_at)>new Date()?"upcoming":"completed");
    const isUpcoming = st==="upcoming";
    // Phase E: stage advance activities are rendered with extra context
    const isStageAdvance = a.triggered_stage_change === true || a.activity_subtype === "stage_advance";
    const sd = a.structured_data || {};
    const isSiteVisit = isStageAdvance && a.to_stage === "Site Visit";

    // Try to derive the headline channel/icon from structured_data for stage advances
    let displayType = a.type;
    let displayIcon = icons[a.type] || "📋";
    if (isStageAdvance && sd.channel) {
      // Use the captured channel (Call/WhatsApp/Email/etc.) for icon
      const channelToType = {Call:"Call", WhatsApp:"WhatsApp", Email:"Email", "In-person":"Meeting", Other:"Note"};
      const mapped = channelToType[sd.channel];
      if (mapped) {
        displayType = mapped;
        displayIcon = icons[mapped] || displayIcon;
      }
    }
    // Site Visit: override icon/type even without channel
    if (isSiteVisit) {
      displayType = "Site Visit";
      displayIcon = "🏠";
    }

    // Interest level color map — keyed by leading word so "Hot — ready to negotiate" maps to Hot
    const interestColors = {Hot:{c:"#DC2626",bg:"#FEE2E2"},Warm:{c:"#D97706",bg:"#FEF3C7"},Cold:{c:"#0891B2",bg:"#CFFAFE"},Lost:{c:"#6B7280",bg:"#F3F4F6"},"Not interested":{c:"#6B7280",bg:"#F3F4F6"}};
    const interestKey = (sd.interest_level||"").split("—")[0].trim().split(" ")[0]; // "Hot", "Warm", "Cold", "Lost", "Not"
    const interestColor = interestColors[interestKey] || interestColors[sd.interest_level];
    const interestLabel = (sd.interest_level||"").split("—")[0].trim();

    // Resolve unit IDs -> readable labels for Site Visit
    // Phase E W2: shape varies by lifecycle:
    //   - Scheduled visit (upcoming):  sd.units_to_show
    //   - Completed visit (after outcome capture): sd.units_viewed
    const visitUnitIds = sd.units_viewed || sd.units_to_show || [];
    const unitsViewedLabels = (Array.isArray(visitUnitIds) ? visitUnitIds : []).map(uid => {
      const u = (units||[]).find(x => x.id === uid);
      if (!u) return null;
      return u.unit_ref || uid;
    }).filter(Boolean);

    // Attendees label — prefer actual over expected
    const visitAttendees = sd.actual_attendees || sd.attendees || sd.expected_attendees;

    // Body text: discussion (Contacted) or feedback (Site Visit) or prep_notes (scheduled visit) or note (free-form)
    const bodyText = isStageAdvance ? (sd.discussion || sd.feedback || sd.prep_notes || sd.broker_notes) : a.note;

    return(
      <div style={{background:"#fff",border:"1px solid "+(isStageAdvance?"#1A5FA8":isUpcoming?"#C9A84C":"#E2E8F0"),borderRadius:8,padding:"9px 12px",display:"flex",gap:8,borderLeft:isStageAdvance?"3px solid #1A5FA8":undefined}}>
        <div style={{width:26,height:26,borderRadius:"50%",background:isStageAdvance?"#E6EFF8":isUpcoming?"rgba(201,168,76,.12)":"#F7F9FC",border:isStageAdvance?"1px solid #1A5FA8":isUpcoming?"1px solid #C9A84C":"none",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0}}>
          {displayIcon}
        </div>
        <div style={{flex:1,minWidth:0}}>
          {/* Phase E: stage transition badge */}
          {isStageAdvance && a.from_stage && a.to_stage && (
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4,fontSize:9,fontWeight:700,color:"#1A5FA8",textTransform:"uppercase",letterSpacing:".5px"}}>
              <span>🎯 Stage</span>
              <span style={{fontWeight:500,color:"#94A3B8",textTransform:"none",letterSpacing:0}}>
                {a.from_stage} → <strong style={{color:"#0F2540"}}>{a.to_stage}</strong>
              </span>
            </div>
          )}

          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4,flexWrap:"wrap",gap:6}}>
            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
              <span style={{fontSize:13,fontWeight:700,color:"#0F2540"}}>{displayType}</span>
              {!isStageAdvance && (
                <span style={{fontSize:10,fontWeight:700,color:statusColors[st]||"#718096",background:"rgba(0,0,0,.05)",padding:"2px 8px",borderRadius:10}}>
                  {statusLabels[st]||st}
                </span>
              )}
              {/* Phase E: subtle "during X stage" tag for free-form activities */}
              {!isStageAdvance && a.stage_at_event && (
                <span style={{fontSize:10,fontWeight:600,color:"#64748B",background:"#F1F5F9",padding:"2px 8px",borderRadius:10,border:"1px solid #E2E8F0"}}>
                  during {a.stage_at_event}
                </span>
              )}
              {/* Day 18 — person tag: who this activity was with */}
              {a.person_id && personsById[a.person_id] && (
                <span style={{fontSize:10,fontWeight:600,color:"#3730A3",background:"#E0E7FF",padding:"2px 8px",borderRadius:10,border:"1px solid #A5B4FC"}}>
                  👤 {personsById[a.person_id].name}{personsById[a.person_id].is_primary_buyer?" 👑":""} · {ROLE_LABELS[personsById[a.person_id].role]||personsById[a.person_id].role}
                </span>
              )}
              {/* Phase E: interest level badge */}
              {isStageAdvance && interestColor && interestLabel && (
                <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:10,background:interestColor.bg,color:interestColor.c}}>
                  {interestLabel}
                </span>
              )}
            </div>
            <span style={{fontSize:11,color:"#A0AEC0"}}>{new Date(a.created_at).toLocaleDateString("en-AE",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</span>
          </div>

          {/* Phase E: Site Visit context strip — visit time + attendees + units */}
          {isSiteVisit && (sd.visit_at || visitAttendees || unitsViewedLabels.length>0) && (
            <div style={{display:"flex",gap:10,flexWrap:"wrap",fontSize:11,color:"#475569",marginBottom:6,padding:"6px 8px",background:"#F8FAFC",borderRadius:6,border:"1px solid #E2E8F0"}}>
              {sd.visit_at && (
                <span><span style={{color:"#94A3B8",fontWeight:600}}>🗓</span> <strong style={{color:"#0F2540"}}>{new Date(sd.visit_at).toLocaleString("en-AE",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</strong></span>
              )}
              {visitAttendees && (
                <span><span style={{color:"#94A3B8",fontWeight:600}}>👥</span> <strong style={{color:"#0F2540"}}>{visitAttendees}</strong></span>
              )}
              {unitsViewedLabels.length>0 && (
                <span><span style={{color:"#94A3B8",fontWeight:600}}>🏢 {sd.units_viewed?"Units viewed":"Units to show"}:</span> <strong style={{color:"#0F2540"}}>{unitsViewedLabels.join(", ")}</strong></span>
              )}
            </div>
          )}

          {/* Discussion / feedback / note */}
          {bodyText && (
            <div style={{fontSize:12,color:"#4A5568",lineHeight:1.6,whiteSpace:"pre-wrap",marginBottom:6}}>
              {bodyText}
            </div>
          )}

          {/* Phase E: structured data summary row */}
          {isStageAdvance && (sd.next_step || sd.follow_up_date) && (
            <div style={{display:"flex",gap:14,flexWrap:"wrap",fontSize:11,color:"#475569",marginBottom:4,paddingTop:6,borderTop:"1px dashed #E2E8F0"}}>
              {sd.next_step && (
                <div><span style={{color:"#94A3B8",fontWeight:600}}>Next step:</span> <strong style={{color:"#0F2540"}}>{sd.next_step}</strong></div>
              )}
              {sd.follow_up_date && (
                <div><span style={{color:"#94A3B8",fontWeight:600}}>⏰ Follow up:</span> <strong style={{color:"#0F2540"}}>{new Date(sd.follow_up_date).toLocaleDateString("en-AE",{day:"numeric",month:"short",year:"numeric"})}</strong></div>
              )}
              {sd.channel && (
                <div><span style={{color:"#94A3B8",fontWeight:600}}>via:</span> <strong style={{color:"#0F2540"}}>{sd.channel}</strong></div>
              )}
            </div>
          )}

          {a.outcome&&<div style={{fontSize:11,color:"#718096",fontStyle:"italic",marginBottom:4}}>Note: {a.outcome}</div>}
          <div style={{fontSize:11,color:"#A0AEC0"}}>{a.user_name}</div>
          {!isUpcoming && <AppendNote a={a} canEdit={canEdit} setActivities={setActivities} showToast={showToast} currentUser={currentUser} />}
          {isUpcoming&&canEdit&&(
            <div style={{marginTop:10,paddingTop:10,borderTop:"1px dashed #E2E8F0"}}>
              {/* Phase E W2 — for Site Visit upcoming cards, offer a rich outcome capture */}
              {a.activity_subtype === "stage_advance" && a.to_stage === "Site Visit" && onCaptureVisitOutcome ? (
                <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                  <button onClick={()=>onCaptureVisitOutcome(a)}
                    style={{padding:"6px 14px",borderRadius:7,border:"none",background:"#0F2540",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                    📋 Capture Visit Outcome
                  </button>
                  <button onClick={()=>setOutcomeModal({activity:a,pendingOutcome:"no_show"})}
                    style={{padding:"4px 12px",borderRadius:16,border:"1px solid #E53E3E",background:"transparent",color:"#E53E3E",fontSize:11,cursor:"pointer",fontWeight:500}}>
                    📵 No Show
                  </button>
                  <button onClick={()=>setOutcomeModal({activity:a,pendingOutcome:"rescheduled"})}
                    style={{padding:"4px 12px",borderRadius:16,border:"1px solid #1A5FA8",background:"transparent",color:"#1A5FA8",fontSize:11,cursor:"pointer",fontWeight:500}}>
                    🔄 Reschedule
                  </button>
                  <button onClick={()=>setOutcomeModal({activity:a,pendingOutcome:"cancelled"})}
                    style={{padding:"4px 12px",borderRadius:16,border:"1px solid #718096",background:"transparent",color:"#718096",fontSize:11,cursor:"pointer",fontWeight:500}}>
                    ❌ Cancel
                  </button>
                </div>
              ) : (
                <>
                  <div style={{fontSize:11,fontWeight:600,color:"#718096",marginBottom:6}}>Mark outcome:</div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    {[["completed","✅ Completed","#1A7F5A"],["no_show","📵 No Show","#E53E3E"],["rescheduled","🔄 Reschedule","#1A5FA8"],["cancelled","❌ Cancel","#718096"]].map(([o,label,col])=>(
                      <button key={o} onClick={()=>setOutcomeModal({activity:a,pendingOutcome:o})}
                        style={{padding:"4px 12px",borderRadius:16,border:"1px solid "+col,background:"transparent",color:col,fontSize:11,cursor:"pointer",fontWeight:500}}>
                        {label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      {outcomeModal&&<OutcomeModal activity={{...outcomeModal.activity,_pendingOutcome:outcomeModal.pendingOutcome}} onClose={()=>setOutcomeModal(null)} onSave={(o,n,r)=>markOutcome(outcomeModal.activity,o,n,r)}/>}

      {/* Phase E dense layout: scope toggle — only when we know the current stage */}
      {currentStage&&(
        <div style={{display:"flex",gap:4,padding:3,background:"#F1F5F9",borderRadius:8,alignSelf:"flex-start",marginBottom:2}}>
          <button onClick={()=>setScope("stage")}
            style={{padding:"5px 12px",borderRadius:6,border:"none",fontSize:11,fontWeight:600,cursor:"pointer",
              background:scope==="stage"?"#fff":"transparent",
              color:scope==="stage"?"#0F2540":"#64748B",
              boxShadow:scope==="stage"?"0 1px 2px rgba(0,0,0,.06)":"none"}}>
            This stage{stageOnlyCount>0?` (${stageOnlyCount})`:""}
          </button>
          <button onClick={()=>setScope("all")}
            style={{padding:"5px 12px",borderRadius:6,border:"none",fontSize:11,fontWeight:600,cursor:"pointer",
              background:scope==="all"?"#fff":"transparent",
              color:scope==="all"?"#0F2540":"#64748B",
              boxShadow:scope==="all"?"0 1px 2px rgba(0,0,0,.06)":"none"}}>
            All time{activities.length>0?` (${activities.length})`:""}
          </button>
        </div>
      )}

      {/* Empty state when filter returns nothing */}
      {filtered.length===0&&currentStage&&scope==="stage"&&(
        <div style={{textAlign:"center",padding:"1.5rem 1rem",color:"#94A3B8",fontSize:12,border:"1px dashed #E2E8F0",borderRadius:10}}>
          No activity yet in <strong>{currentStage}</strong> stage. Use Quick log on the left to record your first interaction.
        </div>
      )}

      {upcoming.length>0&&(
        <div style={{marginBottom:4}}>
          <div style={{fontSize:11,fontWeight:700,color:"#C9A84C",textTransform:"uppercase",letterSpacing:"1px",marginBottom:8,display:"flex",alignItems:"center",gap:6}}>
            ⏰ Upcoming ({upcoming.length})
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {upcoming.map(a=><ActCard key={a.id} a={a}/>)}
          </div>
        </div>
      )}
      {past.length>0&&(
        <div>
          {upcoming.length>0&&(
            <div style={{fontSize:11,fontWeight:700,color:"#718096",textTransform:"uppercase",letterSpacing:"1px",marginBottom:8,marginTop:8,display:"flex",alignItems:"center",gap:6}}>
              📋 History ({past.length})
            </div>
          )}
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {past.map(a=><ActCard key={a.id} a={a}/>)}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STAGE CAPTURE DIALOG (Phase E Workstream 1)
   Generic dialog component used to gate stage transitions with
   structured activity capture. Each transition specifies its own
   config (fields, validation, follow-up reminder offset).
═══════════════════════════════════════════════════════════════ */

// Configs per stage transition. Key = target stage. Value = field spec.
// Each field is rendered by StageCaptureDialog based on its `kind`.

// Phase E W2 — standard asks the buyer can put on the negotiation table.
// Each ask has a `key` (used in structured_data), `label`, optional `detail` config
// for the conditional input that appears when the ask is ticked.
//   detail.kind: "percent" | "text"
//   detail.placeholder: hint shown in the input
// Designed for UAE off-plan primary-market — items reflect what real buyers actually
// negotiate (DLD fee, post-handover %, service charge waivers, free parking).
export const ASKS_GRID_OPTIONS = [
  { key:"discount",       label:"Price discount",        icon:"💰", detail:{kind:"percent", placeholder:"e.g. 5"}, hint:"% off the asking price" },
  { key:"payment_plan",   label:"Payment plan flex",     icon:"📅", detail:{kind:"text",    placeholder:"e.g. 50/50 with 30% post-handover over 2 yrs"}, hint:"Stretched, post-handover, more milestones" },
  { key:"dld_waiver",     label:"DLD fee help",          icon:"🏛️", detail:{kind:"text",    placeholder:"e.g. 50/50 split, or full waiver"}, hint:"Dubai Land Department 4% fee" },
  { key:"service_charge", label:"Service charge waiver", icon:"🧾", detail:{kind:"text",    placeholder:"e.g. First 2 years waived"}, hint:"Annual maintenance fees" },
  { key:"free_parking",   label:"Extra parking / storage", icon:"🚗", detail:{kind:"text",    placeholder:"e.g. 1 extra parking + storage room"}, hint:"Additional bays, storage rooms" },
  { key:"freebies",       label:"Furniture / freebies",  icon:"🎁", detail:{kind:"text",    placeholder:"e.g. White-goods package, light fittings"}, hint:"Furniture, appliances, fittings" },
  { key:"other",          label:"Other request",         icon:"📌", detail:{kind:"text",    placeholder:"What else are they asking for?"}, hint:"Any custom ask" },
];



export default ActivitiesList;
