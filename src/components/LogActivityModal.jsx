// LogActivityModal — extracted from App.jsx (MAP A4). Used directly (App.jsx) + passed as prop into LeadDetail.
import { useState, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useLeadPersons, ROLE_LABELS } from "../lib/useLeadPersons.js";

export default function LogActivityModal({lead, opp, currentUser, showToast, onClose, onSaved, defaultType="Call"}) {
  // Canonical activity-logging modal (Day 18 consolidation).
  // Used by BOTH Opportunity Detail and Lead Detail. Handles the universal
  // parts: type, status, duration, person-tagging, notes, next-step inputs,
  // note-text composition, and the activities INSERT (with person_id +
  // stage_at_event when an opp is present).
  //
  // Reminder creation is NOT done here — the modal returns the next-step
  // intent to the parent via onSaved(activity, nextStepIntent). Each parent
  // owns its reminders state, so it creates the reminder + updates its panel.
  const [form, setForm] = useState({
    type: defaultType, note:"", scheduled_at:"", duration_mins:"", status:"completed",
    person_id:"", ns_enabled:false, ns_type:"Call", ns_due:"", ns_time:"", ns_place:"", ns_note:"",
  });
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);  // Day 18: synchronous double-click guard (ref flips instantly, before re-render)
  const { persons: actPersons } = useLeadPersons(lead?.id);
  const sf = k => e => setForm(f=>({...f,[k]:e.target.value}));

  const save = async() => {
    if(!lead && !opp?.lead_id){showToast("No lead found","error");return;}
    const hasNextStep = form.ns_enabled && form.ns_due && form.status==="completed";
    if(!(form.note||"").trim() && !hasNextStep){showToast("Please add discussion notes or set a next step","error");return;}
    if(savingRef.current) return;  // Day 18: block double-click — a save already in flight
    savingRef.current = true;
    setSaving(true);
    try{
      const isScheduled = form.scheduled_at && new Date(form.scheduled_at) > new Date();
      const nsLine = hasNextStep ? `\n\n✅ Next: ${form.ns_type} on ${new Date(form.ns_due).toLocaleDateString("en-AE",{day:"numeric",month:"short",year:"numeric"})}${form.ns_time?(" at "+form.ns_time):""}${form.ns_place?(" · 📍 "+form.ns_place):""}${form.ns_note?(" — "+form.ns_note):""}` : "";
      const noteText = [
        form.note,
        nsLine,
        form.scheduled_at?("\n📅 Scheduled: "+new Date(form.scheduled_at).toLocaleString("en-AE",{dateStyle:"medium",timeStyle:"short"})):"",
        form.duration_mins?("\n⏱ Duration: "+form.duration_mins+" mins"):"",
      ].filter(Boolean).join("");
      const payload = {
        lead_id: lead?.id || opp?.lead_id || null,
        lead_name: lead?.name || null,
        company_id: (opp?.company_id) || currentUser.company_id || null,
        type: form.type,
        note: noteText || null,
        scheduled_at: form.scheduled_at || new Date().toISOString(),
        duration_mins: form.duration_mins?Number(form.duration_mins):null,
        status: isScheduled?"upcoming":"completed",
        user_id: currentUser.id,
        user_name: currentUser.full_name,
        opportunity_id: opp?.id||null,
        person_id: form.person_id||null,
        stage_at_event: opp?.stage || null,
        activity_subtype: "free_note",
      };
      const{data,error}=await supabase.from("activities").insert(payload).select().single();
      if(error)throw error;
      if (hasNextStep) {
        await supabase.from("activities").insert({
          lead_id: lead?.id || opp?.lead_id || null,
          lead_name: lead?.name || null,
          company_id: (opp?.company_id) || currentUser.company_id || null,
          type: form.ns_type,
          note: form.ns_note || null,
          scheduled_at: new Date(form.ns_due + (form.ns_time ? "T"+form.ns_time : "T09:00")).toISOString(),
          location: form.ns_place || null,
          status: "upcoming",
          user_id: currentUser.id,
          user_name: currentUser.full_name,
          opportunity_id: opp?.id || null,
          person_id: form.person_id || null,
          stage_at_event: opp?.stage || null,
          activity_subtype: "next_step",
        });
      }
      const nextStepIntent = hasNextStep ? {type:form.ns_type, due:form.ns_due, time:form.ns_time, place:form.ns_place, note:form.ns_note} : null;
      onSaved(data, nextStepIntent);
    }catch(e){showToast(e.message,"error"); setSaving(false); savingRef.current=false;}
  };

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1100,padding:"1rem"}}>
      <div style={{background:"#fff",borderRadius:16,width:500,maxWidth:"100%",maxHeight:"92vh",overflow:"auto",boxShadow:"0 20px 60px rgba(11,31,58,.25)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"1rem 1.5rem",borderBottom:"1px solid #E8EDF4"}}>
          <div>
            <div style={{fontSize:15,fontWeight:700,color:"#0F2540",letterSpacing:"-.3px"}}>Log Activity</div>
            <div style={{fontSize:12,color:"#94A3B8",marginTop:2}}>{lead?.name}{opp?" · "+opp.title:""}</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:22,color:"#94A3B8",cursor:"pointer"}}>×</button>
        </div>
        <div style={{padding:"1.25rem 1.5rem"}}>
          <div style={{marginBottom:14}}>
            <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:".5px"}}>Activity Type</label>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {[["Call","📞"],["Email","✉️"],["Meeting","🤝"],["Site Visit","🏠"],["WhatsApp","💬"],["Note","📝"],["Proposal","📄"]].map(([t,icon])=>(
                <button key={t} onClick={()=>setForm(f=>({...f,type:t}))}
                  style={{padding:"6px 12px",borderRadius:20,border:`1.5px solid ${form.type===t?"#0F2540":"#E2E8F0"}`,background:form.type===t?"#0F2540":"#fff",color:form.type===t?"#fff":"#475569",fontSize:12,cursor:"pointer",fontWeight:form.type===t?600:400,display:"flex",alignItems:"center",gap:4}}>
                  <span style={{fontSize:13}}>{icon}</span>{t}
                </button>
              ))}
            </div>
          </div>

          <div style={{marginBottom:12}}>
            <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:".5px"}}>Status</label>
            <div style={{display:"flex",gap:6}}>
              {[["completed","✅ Completed"],["upcoming","⏰ Scheduled"]].map(([v,l])=>(
                <button key={v} onClick={()=>setForm(f=>({...f,status:v, ns_enabled: v==="completed"?f.ns_enabled:false}))}
                  style={{padding:"5px 12px",borderRadius:7,border:`1.5px solid ${form.status===v?"#0F2540":"#E2E8F0"}`,background:form.status===v?"#0F2540":"#fff",color:form.status===v?"#fff":"#475569",fontSize:12,cursor:"pointer",fontWeight:form.status===v?600:400}}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {actPersons && actPersons.length > 0 && (
            <div style={{marginBottom:12}}>
              <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:".5px"}}>Who did you talk to?</label>
              <select value={form.person_id} onChange={sf("person_id")} style={{width:"100%"}}>
                <option value="">— Not specified —</option>
                {actPersons.map(p=>(
                  <option key={p.id} value={p.id}>
                    {p.name}{p.is_primary_buyer?" 👑":""} · {ROLE_LABELS[p.role]||p.role}
                  </option>
                ))}
              </select>
            </div>
          )}

          {["Call","Meeting","Site Visit"].includes(form.type)&&(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
              <div>
                <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:".5px"}}>Date & Time</label>
                <input type="datetime-local" value={form.scheduled_at} onChange={sf("scheduled_at")} max={form.status==="completed"? new Date().toISOString().slice(0,16): undefined} min={form.status==="upcoming"? new Date().toISOString().slice(0,16): undefined}/>
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:".5px"}}>Duration</label>
                <select value={form.duration_mins} onChange={sf("duration_mins")}>
                  <option value="">Select…</option>
                  {["15","30","45","60","90","120"].map(m=><option key={m} value={m}>{m} mins</option>)}
                </select>
              </div>
            </div>
          )}

          <div style={{marginBottom:12}}>
            <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:".5px"}}>Discussion / Notes</label>
            <textarea value={form.note} onChange={sf("note")} rows={3} placeholder="What was discussed? Key points, client feedback, objections…"/>
          </div>

          {form.status==="completed" && <div style={{padding:"10px 12px",background:"#F8FAFC",border:"1px solid #E8EDF4",borderRadius:8,marginBottom:16}}>
            <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:12,fontWeight:600,color:"#0F2540"}}>
              <input type="checkbox" checked={form.ns_enabled} onChange={e=>setForm(f=>({...f,ns_enabled:e.target.checked}))}/>
              📅 Schedule a next step
            </label>
            {form.ns_enabled&&(
              <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid #E2E8F0",display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div>
                  <label style={{fontSize:10,fontWeight:600,color:"#64748B",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:".4px"}}>Type</label>
                  <select value={form.ns_type} onChange={sf("ns_type")} style={{width:"100%"}}>
                    {["Call","Email","Meeting","Visit","WhatsApp","Task"].map(t=><option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{fontSize:10,fontWeight:600,color:"#64748B",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:".4px"}}>Due Date</label>
                  <input type="date" value={form.ns_due} onChange={sf("ns_due")} min={new Date().toISOString().slice(0,10)} style={{width:"100%"}}/>
                </div>
                <div>
                  <label style={{fontSize:10,fontWeight:600,color:"#64748B",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:".4px"}}>Time</label>
                  <input type="time" value={form.ns_time} onChange={sf("ns_time")} style={{width:"100%"}}/>
                </div>
                {["Meeting","Visit"].includes(form.ns_type)&&(
                <div>
                  <label style={{fontSize:10,fontWeight:600,color:"#64748B",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:".4px"}}>Location</label>
                  <input type="text" value={form.ns_place} onChange={sf("ns_place")} placeholder="e.g. Sales office / project site" style={{width:"100%"}}/>
                </div>
                )}
                <div style={{gridColumn:"span 2"}}>
                  <label style={{fontSize:10,fontWeight:600,color:"#64748B",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:".4px"}}>Note (optional)</label>
                  <input type="text" value={form.ns_note} onChange={sf("ns_note")} placeholder="e.g. Follow up on budget question" style={{width:"100%"}}/>
                </div>
              </div>
            )}
          </div>}

          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <button onClick={onClose} style={{padding:"8px 18px",borderRadius:8,border:"1.5px solid #E2E8F0",background:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",color:"#475569"}}>Cancel</button>
            <button onClick={save} disabled={saving} style={{padding:"8px 20px",borderRadius:8,border:"none",background:"#0F2540",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>{saving?"Saving…":"Save Activity"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
