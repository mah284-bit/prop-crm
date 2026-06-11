import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from "../../lib/supabase";
import { Btn } from "../../modules/shared/Btn.jsx";
import { Spinner } from "../../modules/shared/Spinner.jsx";
import { Empty } from "../../modules/shared/Empty.jsx";
import { Toast } from "../../modules/shared/Toast.jsx";
import { STAGES, OPP_STAGES, ROLE_META, PROP_TYPES, UNIT_TYPES, SOURCES, ACT_TYPES, ROLES, VIEWS, MEET_TYPES, FOLLOW_TYPES, CAN_DELETE_LEADS, DISC_TYPES, STAGE_META, TYPE_META, ACT_META, OPP_STAGE_META } from "../../modules/constants.js";
import { fmtM, fmtAED, fmtDate, fmtDT, uid, getStrength, ini, can } from "../../modules/utils.js";

export default function Pipeline({leads, opps, setOpps, users, currentUser, showToast, activities=[]}) {
  const canEdit = can(currentUser.role, "write");
  const canReserve = can(currentUser.role, "reserve_unit");
  const [search, setSearch] = useState("");
  const [fStage, setFStage] = useState("All");
  const [fAgent, setFAgent] = useState("All");
  const [expandedId, setExpandedId] = useState(null);
  const [moving, setMoving] = useState(null);
  const [localOpps, setLocalOpps] = useState([]);
  const [showActivityModal, setShowActivityModal] = useState(null); // {lead, type}
  const [showReserveModal, setShowReserveModal] = useState(null);   // {opp, unit}
  const [units, setUnits] = useState([]);
  const [reservations, setReservations] = useState([]);

  useEffect(() => {
    supabase.from("opportunities").select("*").eq("status","Active").order("created_at",{ascending:false})
      .then(({data}) => setLocalOpps(data||[]));
    supabase.from("project_units").select("id,unit_ref,status,project_id,bedrooms,sub_type").then(({data})=>setUnits(data||[]));
    supabase.from("reservations").select("*").in("status",["Active","Extended","Confirmed"]).then(({data})=>setReservations(data||[]));
  }, []);


  const allOpps = localOpps.length > 0 ? localOpps : (opps||[]);
  const myOpps = can(currentUser.role,"see_all") ? allOpps : allOpps.filter(o=>o.assigned_to===currentUser.id);
  const activeOpps = myOpps.filter(o=>o.status==="Active" && o.stage!=="Closed Won" && o.stage!=="Closed Lost");
  const wonOpps = myOpps.filter(o=>o.stage==="Closed Won");
  const lostOpps = myOpps.filter(o=>o.stage==="Closed Lost");

  const filtered = activeOpps.filter(o=>{
    const lead = leads.find(l=>l.id===o.lead_id);
    const q = search.toLowerCase();
    return (!q||o.title?.toLowerCase().includes(q)||lead?.name?.toLowerCase().includes(q)||lead?.phone?.includes(q))
      && (fStage==="All"||o.stage===fStage)
      && (fAgent==="All"||o.assigned_to===fAgent);
  });

  const moveStage = async(opp, toStage) => {
    if(!canEdit){showToast("No permission","error");return;}

    // ISSUE D guard duplication — block from list-view advance too
    if (toStage !== "Closed Lost" && toStage !== "On Hold" && opp.unit_id) {
      try {
        const { data: conflictOpps } = await supabase
          .from("opportunities")
          .select("id, title, stage, stage_updated_at")
          .eq("unit_id", opp.unit_id)
          .neq("id", opp.id)
          .in("stage", ["Reserved", "SPA Signed", "Closed Won"]);
        if (conflictOpps && conflictOpps.length > 0) {
          const c = conflictOpps[0];
          const days = c.stage_updated_at
            ? Math.floor((Date.now() - new Date(c.stage_updated_at).getTime()) / 86400000)
            : null;
          const ageStr = days !== null ? ` (${days} day${days === 1 ? "" : "s"} ago)` : "";
          showToast(
            `⛔ Unit reserved by "${c.title}" at ${c.stage}${ageStr}. Pick a different unit or wait.`,
            "error"
          );
          return;
        }
      } catch (e) {
        console.error("list-view moveStage guard exception:", e);
      }
    }

    setMoving(opp.id);
    const updates = {stage:toStage, stage_updated_at:new Date().toISOString(),
      ...(toStage==="Closed Won"?{won_at:new Date().toISOString(),status:"Active"}:{}),
      ...(toStage==="Closed Lost"?{lost_at:new Date().toISOString()}:{})
    };
    const{error}=await supabase.from("opportunities").update(updates).eq("id",opp.id);
    setMoving(null);
    if(error){showToast(error.message,"error");return;}
    setLocalOpps(p=>p.map(o=>o.id===opp.id?{...o,...updates}:o));
    if(setOpps) setOpps(p=>p.map(o=>o.id===opp.id?{...o,...updates}:o));
    setExpandedId(null);
    showToast(`Moved to ${toStage}`,"success");
  };

  const stageActions = {
    "New":            [{label:"📞 Call",           act:"call"  },{label:"💬 WhatsApp",      act:"wa"      },{label:"📝 Log note",      act:"log"     }],
    "Contacted":      [{label:"📅 Schedule visit", act:"schedule"},{label:"📄 Send brochure",act:"brochure"},{label:"📝 Log note",      act:"log"     }],
    "Site Visit":     [{label:"📋 Log outcome",    act:"log"   },{label:"📞 Follow up",     act:"call"   },{label:"📝 Log note",      act:"log"     }],
    "Proposal Sent":  [{label:"📞 Follow up",      act:"call"  },{label:"💰 Negotiate",     act:"negotiate"},{label:"📝 Log note",     act:"log"     }],
    "Negotiation":    [{label:"📄 Send offer",     act:"offer" },{label:"✅ Get approval",  act:"approve" },{label:"📝 Log note",      act:"log"     }],
    "Offer Accepted": [{label:"📋 Reservation form",act:"log"  },{label:"💰 Collect res. fee",act:"log"  },{label:"📝 Log note",      act:"log"     }],
    "Reserved":       [{label:"✅ Confirm reservation",act:"log"},{label:"⏰ Extend 2 days", act:"log"   },{label:"📄 Draft SPA",     act:"log"     }],
    "SPA Signed":     [{label:"💰 Add payment",    act:"log"   },{label:"📋 Upload SPA",    act:"log"    },{label:"📝 Log note",      act:"log"     }],
  };

  const nextStage = {"New":"Contacted","Contacted":"Site Visit","Site Visit":"Proposal Sent","Proposal Sent":"Negotiation","Negotiation":"Offer Accepted","Offer Accepted":"Reserved","Reserved":"SPA Signed","SPA Signed":"Closed Won"};
  const totalVal = filtered.reduce((s,o)=>s+(o.budget||0),0);

  const StagePill = ({stage, count, value, color, bg, border}) => (
    <div onClick={()=>setFStage(fStage===stage?"All":stage)}
      style={{flexShrink:0, minWidth:110, background:fStage===stage?color:bg,
        border:`2px solid ${fStage===stage?color:border}`, borderRadius:10,
        padding:"10px 14px", cursor:"pointer", transition:"all .15s", textAlign:"center"}}>
      <div style={{fontSize:22, fontWeight:800, color:fStage===stage?"#fff":color, letterSpacing:"-1px", lineHeight:1}}>{count}</div>
      <div style={{fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:".6px", color:fStage===stage?"rgba(255,255,255,.85)":color, marginTop:3}}>{stage}</div>
      {value>0&&<div style={{fontSize:10, fontWeight:600, color:fStage===stage?"rgba(255,255,255,.7)":color, marginTop:2}}>{fmtM(value)}</div>}
    </div>
  );

  const Arrow = () => (
    <div style={{display:"flex",alignItems:"center",flexShrink:0,padding:"0 4px"}}>
      <svg width="20" height="12" viewBox="0 0 20 12"><path d="M0 6h16M12 1l7 5-7 5" stroke="#CBD5E1" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
    </div>
  );

  return (
    <div className="fade-in" style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden",gap:12}}>

      {/* Stage flow header */}
      <div style={{background:"#fff",border:"1px solid #E8EDF4",borderRadius:12,padding:"16px 20px",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,flexWrap:"wrap",gap:8}}>
          <div>
            <span style={{fontSize:15,fontWeight:700,color:"#0F2540",letterSpacing:"-.3px"}}>Sales Pipeline</span>
            <span style={{fontSize:12,color:"#94A3B8",marginLeft:10}}>{filtered.length} opportunities · {fmtM(totalVal)}</span>
          </div>
          <div style={{display:"flex",gap:8}}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search…" style={{width:180,fontSize:12}}/>
            <select value={fAgent} onChange={e=>setFAgent(e.target.value)} style={{width:"auto",fontSize:12}}>
              <option value="All">All Agents</option>
              {users.filter(u=>u.is_active).map(u=><option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
            {fStage!=="All"&&<button onClick={()=>setFStage("All")} style={{fontSize:11,padding:"4px 10px",borderRadius:6,border:"1px solid #E2E8F0",background:"#F7F9FC",cursor:"pointer",color:"#64748B"}}>✕ Clear</button>}
          </div>
        </div>

        {/* Stage flow with arrows */}
        <div style={{display:"flex",alignItems:"center",overflowX:"auto",paddingBottom:4,gap:0}}>
          <StagePill stage="New"            count={myOpps.filter(o=>o.stage==="New").length}            value={myOpps.filter(o=>o.stage==="New").reduce((s,o)=>s+(o.budget||0),0)}            color="#475569" bg="#F7F9FC" border="#CBD5E1"/>
          <Arrow/>
          <StagePill stage="Contacted"      count={myOpps.filter(o=>o.stage==="Contacted").length}      value={myOpps.filter(o=>o.stage==="Contacted").reduce((s,o)=>s+(o.budget||0),0)}      color="#1A5FA8" bg="#E6EFF9" border="#BFDBFE"/>
          <Arrow/>
          <StagePill stage="Site Visit"     count={myOpps.filter(o=>o.stage==="Site Visit").length}     value={myOpps.filter(o=>o.stage==="Site Visit").reduce((s,o)=>s+(o.budget||0),0)}     color="#5B3FAA" bg="#EEE8F9" border="#5EEAD4"/>
          <Arrow/>
          <StagePill stage="Proposal Sent"  count={myOpps.filter(o=>o.stage==="Proposal Sent").length}  value={myOpps.filter(o=>o.stage==="Proposal Sent").reduce((s,o)=>s+(o.budget||0),0)}  color="#A06810" bg="#FDF3DC" border="#FCD34D"/>
          <Arrow/>
          <StagePill stage="Negotiation"    count={myOpps.filter(o=>o.stage==="Negotiation").length}    value={myOpps.filter(o=>o.stage==="Negotiation").reduce((s,o)=>s+(o.budget||0),0)}    color="#B83232" bg="#FAEAEA" border="#FECACA"/>
          <Arrow/>
          <StagePill stage="Offer Accepted" count={myOpps.filter(o=>o.stage==="Offer Accepted").length} value={myOpps.filter(o=>o.stage==="Offer Accepted").reduce((s,o)=>s+(o.budget||0),0)} color="#0F766E" bg="#CCFBF1" border="#99F6E4"/>
          <Arrow/>
          <StagePill stage="Reserved"       count={myOpps.filter(o=>o.stage==="Reserved").length}       value={myOpps.filter(o=>o.stage==="Reserved").reduce((s,o)=>s+(o.budget||0),0)}       color="#7C3AED" bg="#EDE9FE" border="#C4B5FD"/>
          <Arrow/>
          <StagePill stage="SPA Signed"     count={myOpps.filter(o=>o.stage==="SPA Signed").length}     value={myOpps.filter(o=>o.stage==="SPA Signed").reduce((s,o)=>s+(o.budget||0),0)}     color="#1D4ED8" bg="#DBEAFE" border="#93C5FD"/>
          <Arrow/>
          <StagePill stage="Closed Won"     count={wonOpps.length}  value={wonOpps.reduce((s,o)=>s+(o.final_price||o.budget||0),0)}  color="#1A7F5A" bg="#E6F4EE" border="#A8D5BE"/>
        </div>
      </div>

      {/* Opportunity list */}
      <div style={{flex:1,overflowY:"auto",background:"#fff",border:"1px solid #E8EDF4",borderRadius:12,overflow:"hidden"}}>

        {/* Column headers */}
        <div style={{display:"grid",gridTemplateColumns:"32px 1fr 120px 90px 110px 70px",gap:12,padding:"8px 16px",background:"#FAFBFE",borderBottom:"1px solid #F1F5F9"}}>
          {["","Opportunity / Lead","Stage","Value","Agent","Days"].map(h=>(
            <div key={h} style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:".5px",color:"#94A3B8"}}>{h}</div>
          ))}
        </div>

        {filtered.length===0&&(
          <div style={{textAlign:"center",padding:"4rem",color:"#94A3B8"}}>
            <div style={{fontSize:36,marginBottom:10}}>🎯</div>
            <div style={{fontSize:14,fontWeight:600,color:"#0F2540",marginBottom:4}}>No opportunities found</div>
            <div style={{fontSize:12}}>Try adjusting your filters or create opportunities from Leads</div>
          </div>
        )}

        {filtered.sort((a,b)=>OPP_STAGES.indexOf(a.stage)-OPP_STAGES.indexOf(b.stage)).map(opp=>{
          const lead = leads.find(l=>l.id===opp.lead_id);
          const agent = users.find(u=>u.id===opp.assigned_to);
          const m = OPP_STAGE_META[opp.stage]||{c:"#718096",bg:"#F7F9FC"};
          const days = opp.stage_updated_at?Math.floor((new Date()-new Date(opp.stage_updated_at))/864e5):0;
          const isExpanded = expandedId===opp.id;
          const upcoming = activities.filter(a=>a.lead_id===opp.lead_id&&a.status==="upcoming").length;
          const actions = stageActions[opp.stage]||[];
          const next = nextStage[opp.stage];

          return (
            <div key={opp.id}>
              {/* Row */}
              <div onClick={()=>setExpandedId(isExpanded?null:opp.id)}
                style={{display:"grid",gridTemplateColumns:"32px 1fr 120px 90px 110px 70px",gap:12,
                  padding:"10px 16px",borderBottom:isExpanded?"none":"1px solid #F1F5F9",
                  cursor:"pointer",transition:"background .1s",alignItems:"center",
                  background:isExpanded?"#F0F6FF":"#fff",
                  borderLeft:`3px solid ${isExpanded?m.c:"transparent"}`}}
                onMouseOver={e=>{if(!isExpanded)e.currentTarget.style.background="#F8FAFC";}}
                onMouseOut={e=>{if(!isExpanded)e.currentTarget.style.background="#fff";}}>

                {/* Avatar */}
                <div style={{width:28,height:28,borderRadius:"50%",background:m.bg,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:10,color:m.c,flexShrink:0}}>
                  {(lead?.name||opp.title||"?").split(" ").map(w=>w[0]).slice(0,2).join("")}
                </div>

                {/* Title + lead */}
                <div style={{minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:600,color:"#0F2540",letterSpacing:"-.1px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{opp.title||lead?.name||"Opportunity"}</div>
                  <div style={{fontSize:11,color:"#94A3B8",marginTop:1,display:"flex",gap:8,flexWrap:"wrap"}}>
                    {lead?.name&&<span>{lead.name}</span>}
                    {lead?.phone&&<span>{lead.phone}</span>}
                    {upcoming>0&&<span style={{color:"#C9A84C",fontWeight:600}}>⏰ {upcoming} task{upcoming>1?"s":""}</span>}
                  </div>
                </div>

                {/* Stage badge */}
                <div style={{fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:20,background:m.bg,color:m.c,display:"inline-flex",alignItems:"center",width:"fit-content"}}>{opp.stage}</div>

                {/* Value */}
                <div style={{fontSize:13,fontWeight:700,color:"#0F2540",letterSpacing:"-.3px"}}>{opp.budget?fmtM(opp.budget):"—"}</div>

                {/* Agent */}
                <div style={{fontSize:11,color:"#64748B",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{agent?.full_name||"—"}</div>

                {/* Days */}
                <div style={{fontSize:11,fontWeight:days>7?700:400,color:days>14?"#E53E3E":days>7?"#A06810":"#94A3B8",display:"flex",alignItems:"center",gap:3}}>
                  {days>7&&"⏱"}{days}d{isExpanded&&<span style={{color:m.c,marginLeft:4}}>▴</span>}
                </div>
              </div>

              {/* Expanded actions */}
              {isExpanded&&(
                <div style={{background:"#F0F6FF",borderBottom:"2px solid #BFDBFE",padding:"10px 16px 12px 60px",display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                  {actions.map(a=>(
                    <button key={a.act}
                      onClick={()=>{
                        if(a.act==="call"||a.act==="wa"||a.act==="log"||a.act==="schedule"||a.act==="brochure"||a.act==="proposal"||a.act==="negotiate"||a.act==="offer"||a.act==="approve"){
                          const typeMap={call:"Call",wa:"WhatsApp",log:"Note",schedule:"Site Visit",brochure:"Call",proposal:"Proposal",negotiate:"Call",offer:"Call",approve:"Call"};
                          setShowActivityModal({lead, opp, type:typeMap[a.act]||"Note"});
                        }
                      }}
                      style={{padding:"6px 12px",borderRadius:7,border:"1.5px solid #E2E8F0",background:"#fff",fontSize:11,fontWeight:600,cursor:"pointer",color:"#0F2540",display:"flex",alignItems:"center",gap:5,transition:"all .12s"}}
                      onMouseOver={e=>{e.currentTarget.style.borderColor=m.c;e.currentTarget.style.color=m.c;}}
                      onMouseOut={e=>{e.currentTarget.style.borderColor="#E2E8F0";e.currentTarget.style.color="#0F2540";}}>
                      {a.label}
                    </button>
                  ))}

                  {/* Divider */}
                  <div style={{width:1,height:24,background:"#BFDBFE",margin:"0 4px"}}/>

                  {/* Next stage button */}
                  {next&&next!=="Closed Won"&&(
                    <button onClick={()=>moveStage(opp,next)} disabled={moving===opp.id}
                      style={{padding:"6px 14px",borderRadius:7,border:"none",background:"#0F2540",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
                      → {next}
                    </button>
                  )}

                  {/* Reserve / Won */}
                  {(opp.stage==="Offer Accepted"||opp.stage==="Negotiation")&&canReserve&&(
                    <button onClick={()=>{
                      const unit = opp.unit_id ? units.find(u=>u.id===opp.unit_id) : null;
                      setShowReserveModal({opp, unit, lead});
                    }} disabled={moving===opp.id}
                      style={{padding:"6px 14px",borderRadius:7,border:"none",background:"#1A7F5A",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                      ✓ Reserve Unit
                    </button>
                  )}

                  {/* Lost */}
                  <button onClick={()=>moveStage(opp,"Closed Lost")} disabled={moving===opp.id}
                    style={{padding:"6px 12px",borderRadius:7,border:"1.5px solid #FECACA",background:"#FEF2F2",color:"#B83232",fontSize:11,fontWeight:600,cursor:"pointer"}}>
                    ✗ Lost
                  </button>

                  {/* Skip to any stage */}
                  <select onChange={e=>{if(e.target.value)moveStage(opp,e.target.value);}}
                    defaultValue=""
                    style={{marginLeft:"auto",fontSize:11,padding:"5px 8px",borderRadius:7,border:"1px dashed #CBD5E1",background:"#fff",color:"#64748B",cursor:"pointer"}}>
                    <option value="" disabled>Skip to stage…</option>
                    {OPP_STAGES.filter(s=>s!==opp.stage).map(s=><option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              )}
            </div>
          );
        })}

        {/* Footer */}
        <div style={{padding:"10px 16px",background:"#FAFBFE",borderTop:"1px solid #F1F5F9",display:"flex",gap:16,fontSize:11,alignItems:"center"}}>
          <span style={{color:"#1A7F5A",fontWeight:700}}>✓ {wonOpps.length} Won · {fmtM(wonOpps.reduce((s,o)=>s+(o.final_price||o.budget||0),0))}</span>
          <span style={{color:"#B83232",fontWeight:700}}>✗ {lostOpps.length} Lost</span>
          <span style={{marginLeft:"auto",color:"#94A3B8"}}>{filtered.length} of {activeOpps.length} active</span>
        </div>
      </div>

      {/* Activity Log Modal */}
      {showActivityModal&&(
        <LogActivityModal
          lead={showActivityModal.lead}
          currentUser={currentUser}
          showToast={showToast}
          onClose={()=>setShowActivityModal(null)}
          onSaved={(act)=>{
            showToast("Activity logged","success");
            setShowActivityModal(null);
          }}
        />
      )}

      {/* Reservation Modal */}
      {showReserveModal&&(
        <ReservationModal
          unit={showReserveModal.unit||{id:showReserveModal.opp.unit_id,unit_ref:"Unit",status:"Available"}}
          reservation={null}
          currentUser={currentUser}
          leads={leads}
          opportunities={localOpps}
          showToast={showToast}
          onClose={()=>setShowReserveModal(null)}
          onSaved={(res)=>{
            moveStage(showReserveModal.opp,"Closed Won");
            setReservations(p=>[res,...p]);
            setShowReserveModal(null);
          }}
        />
      )}
    </div>
  );
}
