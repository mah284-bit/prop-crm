import React, { useState } from 'react';
import { supabase } from "../../lib/supabase";
import { Btn } from "../../modules/shared/Btn.jsx";
import { Modal } from "../../modules/shared/Modal.jsx";
import { FF } from "../../modules/shared/FormComponents.jsx";
import { OPP_STAGE_META } from "../../modules/constants.js";
import { uid } from "../../modules/utils.js";

function NegotiationRoundDialog({ opp, lead, currentUser, lastRound, onClose, onSaved, showToast }) {
  // 21 May 2026 Phase A: Pre-fill from last round for continuity
  // Pre-fill: actor (often same party continues), asks (terms typically build incrementally)
  // Keep fresh: date (NOW), status ("Open" for new round), notes (blank for new content)
  const lastSd = lastRound?.structured_data || {};
  const [actor, setActor] = useState(lastSd.actor || "developer"); // who is speaking this round (default: developer responding)
  const [roundAt, setRoundAt] = useState(()=>{
    const d = new Date(); const pad = n=>String(n).padStart(2,"0");
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const [asks, setAsks] = useState(lastSd.asks || {});
  const [status, setStatus] = useState("Open");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const setAsk = (key, patch) => setAsks(prev => ({...prev, [key]: {...(prev[key]||{}), ...patch}}));

  const submit = async()=>{
    if(!notes.trim()){showToast("Add notes — what did they say?","error");return;}
    if(!roundAt){showToast("Set the round date","error");return;}
    setSaving(true);
    try{
      const enabledKeys = Object.keys(asks).filter(k=>asks[k]?.enabled);
      const sd = {actor, round_at:new Date(roundAt).toISOString(), asks, status, notes:notes.trim()};
      const summary = enabledKeys.map(k=>{
        const def = ASKS_GRID_OPTIONS.find(o=>o.key===k);
        if(!def) return null;
        const v = asks[k]?.value;
        const valLabel = def.detail?.kind==="percent" && v ? `${v}%` : v;
        return `${def.label}${valLabel?`: ${valLabel}`:""}`;
      }).filter(Boolean).join(" · ");
      const actorLabels = {buyer:"Buyer", developer:"Developer", broker:"Broker"};
      const noteText = `[${actorLabels[actor]} · ${status}] ${summary?summary+" — ":""}${notes.trim()}`;
      const{data,error}=await supabase.from("activities").insert({
        opportunity_id: opp.id, lead_id: lead.id,
        company_id: opp.company_id || currentUser.company_id || null,
        type: "Note", note: noteText, status: "completed",
        user_id: currentUser.id, user_name: currentUser.full_name, lead_name: lead.name,
        stage_at_event: opp.stage,
        activity_subtype: "negotiation_round",
        structured_data: sd,
      }).select().single();
      if(error){
        console.error("Round insert failed:", error);
        showToast(`Failed: ${error.message||"unknown"}`,"error");
        setSaving(false);
        return;
      }
      onSaved(data);
    } catch(e){
      console.error("Round save error:", e);
      showToast(`Save failed: ${e.message||"unknown"}`,"error");
    } finally {
      setSaving(false);
    }
  };

  const actorOptions = [
    {value:"buyer",     label:"Buyer says",     icon:"🟦", color:"#1A5FA8", bg:"#E6EFF8"},
    {value:"developer", label:"Developer says", icon:"🟩", color:"#1A7F5A", bg:"#E6F4EE"},
    {value:"broker",    label:"Broker note",    icon:"🟧", color:"#A06810", bg:"#FDF3DC"},
  ];
  const statusOptions = [
    {value:"Open",            color:"#1A5FA8", bg:"#E6EFF8"},
    {value:"Accepted",        color:"#1A7F5A", bg:"#E6F4EE"},
    {value:"Rejected",        color:"#C53030", bg:"#FEE2E2"},
    {value:"Counter-pending", color:"#D97706", bg:"#FEF3C7"},
  ];

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,.65)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1100,padding:"1rem"}}>
      <div style={{background:"#fff",borderRadius:16,width:600,maxWidth:"100%",maxHeight:"90vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 24px 64px rgba(11,31,58,.4)"}}>
        <div style={{padding:"1.1rem 1.4rem",borderBottom:"1px solid #E8EDF4",background:"#0F2540"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
            <div>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:700,color:"#fff"}}>🤝 Log Negotiation Round</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,.65)",marginTop:3}}>Capture the latest exchange between buyer, developer, and broker.</div>
            </div>
            <button onClick={onClose} style={{background:"none",border:"none",fontSize:22,color:"#C9A84C",cursor:"pointer",lineHeight:1}}>×</button>
          </div>
        </div>
        <div style={{padding:"1.1rem 1.4rem",flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:14}}>

          {/* Who's speaking */}
          <div>
            <label style={{fontSize:11,fontWeight:700,color:"#0F2540",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:".4px"}}>Who is this round from? *</label>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {actorOptions.map(o=>{
                const sel = actor === o.value;
                return (
                  <button key={o.value} onClick={()=>setActor(o.value)}
                    style={{
                      padding:"7px 14px",borderRadius:20,
                      border:`1.5px solid ${sel?o.color:"#D1D9E6"}`,
                      background:sel?o.bg:"#fff",
                      color:sel?o.color:"#4A5568",
                      fontSize:12,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:5,
                    }}>
                    {o.icon} {o.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* When */}
          <div>
            <label style={{fontSize:11,fontWeight:700,color:"#0F2540",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:".4px"}}>When was this? *</label>
            <input type="datetime-local" value={roundAt} onChange={e=>setRoundAt(e.target.value)}
              style={{padding:"9px 12px",borderRadius:8,border:"1.5px solid #D1D9E6",fontSize:13,fontFamily:"inherit",background:"#fff"}}/>
          </div>

          {/* Asks grid */}
          <div>
            <label style={{fontSize:11,fontWeight:700,color:"#0F2540",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:".4px"}}>What's on the table this round?</label>
            <div style={{fontSize:10,color:"#94A3B8",marginBottom:6}}>Tick what applies to this round. For developer rounds, this is what they offered/accepted. For buyer rounds, this is what they asked for.</div>
            <div style={{display:"flex",flexDirection:"column",gap:5,border:"1.5px solid #D1D9E6",borderRadius:8,padding:6,background:"#fff"}}>
              {ASKS_GRID_OPTIONS.map(opt=>{
                const sel = !!asks[opt.key]?.enabled;
                return (
                  <div key={opt.key} style={{
                    background: sel?"#FFFBEA":"transparent",
                    border: sel?"1px solid #FCD34D":"1px solid transparent",
                    borderRadius:6, padding: sel?"8px 10px":"6px 10px", transition:"all .12s",
                  }}>
                    <button onClick={()=>setAsk(opt.key,{enabled:!sel})}
                      style={{display:"flex",alignItems:"center",gap:9,width:"100%",background:"transparent",border:"none",cursor:"pointer",textAlign:"left",padding:0}}>
                      <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:16,height:16,borderRadius:4,border:`1.5px solid ${sel?"#0F2540":"#CBD5E1"}`,background:sel?"#0F2540":"#fff",color:"#fff",fontSize:11,lineHeight:1,flexShrink:0}}>{sel?"✓":""}</span>
                      <span style={{fontSize:14,flexShrink:0}}>{opt.icon}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12,fontWeight:sel?700:600,color:"#0F2540"}}>{opt.label}</div>
                      </div>
                    </button>
                    {sel && opt.detail && (
                      <div style={{marginTop:7,marginLeft:25,display:"flex",alignItems:"center",gap:6}}>
                        {opt.detail.kind === "percent" ? (
                          <>
                            <input type="number" min="0" max="100" step="0.1"
                              value={asks[opt.key]?.value||""} onChange={e=>setAsk(opt.key,{value:e.target.value})}
                              placeholder={opt.detail.placeholder||""}
                              style={{width:80,padding:"6px 9px",borderRadius:6,border:"1.5px solid #D1D9E6",fontSize:12,fontFamily:"inherit",background:"#fff"}}/>
                            <span style={{fontSize:12,color:"#64748B",fontWeight:600}}>%</span>
                          </>
                        ) : (
                          <input type="text" value={asks[opt.key]?.value||""} onChange={e=>setAsk(opt.key,{value:e.target.value})}
                            placeholder={opt.detail.placeholder||""}
                            style={{flex:1,padding:"6px 9px",borderRadius:6,border:"1.5px solid #D1D9E6",fontSize:12,fontFamily:"inherit",background:"#fff"}}/>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Status */}
          <div>
            <label style={{fontSize:11,fontWeight:700,color:"#0F2540",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:".4px"}}>Status of this round *</label>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {statusOptions.map(o=>{
                const sel = status === o.value;
                return (
                  <button key={o.value} onClick={()=>setStatus(o.value)}
                    style={{
                      padding:"6px 13px",borderRadius:20,
                      border:`1.5px solid ${sel?o.color:"#D1D9E6"}`,
                      background:sel?o.bg:"#fff",
                      color:sel?o.color:"#4A5568",
                      fontSize:11,fontWeight:600,cursor:"pointer",
                    }}>
                    {o.value}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label style={{fontSize:11,fontWeight:700,color:"#0F2540",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:".4px"}}>Notes *</label>
            <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3}
              placeholder="What was actually said? Any deadlines? Hints about flexibility?"
              style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1.5px solid #D1D9E6",fontSize:13,fontFamily:"inherit",resize:"vertical",boxSizing:"border-box"}}/>
          </div>
        </div>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end",padding:"1rem 1.4rem",borderTop:"1px solid #E8EDF4",background:"#F8FAFC"}}>
          <button onClick={onClose} disabled={saving}
            style={{padding:"9px 18px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:13,fontWeight:600,cursor:saving?"not-allowed":"pointer"}}>
            Cancel
          </button>
          <button onClick={submit} disabled={saving}
            style={{padding:"9px 24px",borderRadius:8,border:"none",background:saving?"#94A3B8":"#0F2540",color:"#fff",fontSize:13,fontWeight:700,cursor:saving?"not-allowed":"pointer"}}>
            {saving?"Saving…":"✓ Log Round"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Phase E W2 — Handover Meeting Dialog
   Schedules the buyer/broker/developer meeting where final terms
   are signed off and broker hands the buyer over to the developer.
═══════════════════════════════════════════════════════════════ */

export default NegotiationRoundDialog;
