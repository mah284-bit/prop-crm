function ActivityLog({leads,activities,setActivities,currentUser,showToast,initialFilter=null}){
  const[fType,setFType]=useState("All");
  const[fLead,setFLead]=useState("All");
  const[fStatus,setFStatus]=useState(initialFilter?.type==="status"?initialFilter.value:"All");
  const statusColors={completed:"#1A7F5A",upcoming:"#C9A84C",no_show:"#E53E3E",rescheduled:"#1A5FA8",cancelled:"#718096"};
  const statusLabels={completed:"✅ Completed",upcoming:"⏰ Upcoming",no_show:"📵 No Show",rescheduled:"🔄 Rescheduled",cancelled:"❌ Cancelled"};
  const filtered=useMemo(()=>[...activities].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).filter(a=>
    (fType==="All"||a.type===fType)&&
    (fLead==="All"||a.lead_id===fLead)&&
    (fStatus==="All"||(a.status||"completed")===fStatus)
  ),[activities,fType,fLead,fStatus]);
  const upcoming = activities.filter(a=>a.status==="upcoming");
  const del=async id=>{if(!can(currentUser.role,"delete"))return;const{error}=await supabase.from("activities").delete().eq("id",id);if(!error)setActivities(p=>p.filter(a=>a.id!==id));};
  return(
    <div className="fade-in" style={{display:"flex",flexDirection:"column",height:"100%"}}>
      {/* Upcoming alert */}
      {upcoming.length>0&&(
        <div style={{background:"rgba(201,168,76,.1)",border:"1.5px solid #C9A84C",borderRadius:10,padding:"10px 14px",marginBottom:12,display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:20}}>⏰</span>
          <div style={{flex:1}}>
            <div style={{fontWeight:700,color:"#8A6200",fontSize:13}}>{upcoming.length} upcoming task{upcoming.length>1?"s":""}</div>
            <div style={{fontSize:11,color:"#718096"}}>{upcoming.slice(0,3).map(a=>`${a.type} with ${a.lead_name||"—"}`).join(" · ")}{upcoming.length>3?` +${upcoming.length-3} more`:""}</div>
          </div>
          <button onClick={()=>setFStatus("upcoming")} style={{padding:"4px 12px",borderRadius:6,border:"1.5px solid #C9A84C",background:"transparent",color:"#8A6200",fontSize:11,fontWeight:600,cursor:"pointer"}}>View →</button>
        </div>
      )}
      {/* Filters */}
      <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap"}}>
        <select value={fType} onChange={e=>setFType(e.target.value)} style={{padding:"6px 10px",borderRadius:8,border:"1.5px solid #E2E8F0",fontSize:12}}>
          <option value="All">All Types</option>
          {ACT_TYPES.map(t=><option key={t}>{t}</option>)}
        </select>
        <select value={fStatus} onChange={e=>setFStatus(e.target.value)} style={{padding:"6px 10px",borderRadius:8,border:"1.5px solid #E2E8F0",fontSize:12}}>
          <option value="All">All Statuses</option>
          {["upcoming","completed","no_show","rescheduled","cancelled"].map(s=><option key={s} value={s}>{statusLabels[s]}</option>)}
        </select>
        <select value={fLead} onChange={e=>setFLead(e.target.value)} style={{padding:"6px 10px",borderRadius:8,border:"1.5px solid #E2E8F0",fontSize:12}}>
          <option value="All">All Contacts</option>
          {leads.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        {(fType!=="All"||fStatus!=="All"||fLead!=="All")&&(
          <button onClick={()=>{setFType("All");setFStatus("All");setFLead("All");}} style={{padding:"6px 10px",borderRadius:8,border:"1.5px solid #E2E8F0",background:"#fff",fontSize:12,cursor:"pointer",color:"#718096"}}>✕ Clear</button>
        )}
        <div style={{marginLeft:"auto",fontSize:12,color:"#A0AEC0",alignSelf:"center"}}>{filtered.length} task{filtered.length!==1?"s":""}</div>
      </div>
      {/* List */}
      <div style={{flex:1,overflowY:"auto"}}>
        {filtered.length===0&&<Empty icon="📋" msg="No tasks found"/>}
        {filtered.map((a,i)=>{
          const m=ACT_META[a.type]||ACT_META.Note;
          const prev=filtered[i-1];
          const showDate=!prev||new Date(prev.created_at).toDateString()!==new Date(a.created_at).toDateString();
          const st=a.status||"completed";
          const isUpcoming=st==="upcoming";
          return(
            <div key={a.id}>
              {showDate&&<div style={{display:"flex",alignItems:"center",gap:10,margin:"14px 0 8px"}}><div style={{height:1,flex:1,background:"#E2E8F0"}}/><span style={{fontSize:11,fontWeight:600,color:"#A0AEC0"}}>{fmtDate(a.created_at)}</span><div style={{height:1,flex:1,background:"#E2E8F0"}}/></div>}
              <div style={{display:"flex",gap:12,marginBottom:8,padding:"12px 14px",background:"#fff",border:`1px solid ${isUpcoming?"#C9A84C":"#E2E8F0"}`,borderRadius:10}}>
                <div style={{width:38,height:38,borderRadius:10,background:m.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{m.icon}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}>
                    <span style={{fontSize:13,fontWeight:700,color:m.c}}>{a.type}</span>
                    <span style={{fontSize:10,fontWeight:700,color:statusColors[st],background:"rgba(0,0,0,.05)",padding:"2px 8px",borderRadius:10}}>{statusLabels[st]||st}</span>
                    <span style={{fontSize:12,color:"#718096"}}>·</span>
                    <span style={{fontSize:13,fontWeight:600,color:"#0F2540"}}>{a.lead_name||"—"}</span>
                  </div>
                  <div style={{fontSize:13,color:"#4A5568",lineHeight:1.6,marginBottom:4,whiteSpace:"pre-wrap"}}>{a.note}</div>
                  {a.outcome&&<div style={{fontSize:11,color:"#718096",fontStyle:"italic",marginBottom:4}}>Outcome: {a.outcome}</div>}
                  <div style={{fontSize:11,color:"#A0AEC0"}}>
                    {a.user_name} · {fmtDate(a.created_at)}
                    {a.scheduled_at&&<span> · 📅 {new Date(a.scheduled_at).toLocaleDateString("en-AE",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</span>}
                  </div>
                </div>
                {can(currentUser.role,"delete")&&<button onClick={()=>del(a.id)} style={{background:"none",border:"none",color:"#E2E8F0",fontSize:16,alignSelf:"flex-start",padding:0,transition:"color 0.15s"}} onMouseOver={e=>e.currentTarget.style.color="#B83232"} onMouseOut={e=>e.currentTarget.style.color="#E2E8F0"}>×</button>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


