function Dashboard({leads,opps=[],properties,activities,currentUser,meetings=[],followups=[],crmContext="sales",units=[],salePricing=[],leasePricing=[],leases=[],onNavigate=()=>{}}){
  const visible      = can(currentUser.role,"see_all")?leads:leads.filter(l=>l.assigned_to===currentUser.id);
  // Use opportunities for pipeline stats
  const visibleOpps  = can(currentUser.role,"see_all")?opps:opps.filter(o=>o.assigned_to===currentUser.id);
  const active       = visibleOpps.filter(o=>!["Closed Won","Closed Lost","Won","Lost"].includes(o.stage)&&o.status==="Active");
  const won          = visibleOpps.filter(o=>o.stage==="Closed Won"||o.status==="Won");
  const pipeVal      = active.reduce((s,o)=>s+(o.budget||0),0);
  const wonVal       = won.reduce((s,o)=>s+(o.final_price||o.budget||0),0);
  const saleUnits    = units.filter(u=>u.purpose==="Sale"||u.purpose==="Both");
  const leaseUnits   = units.filter(u=>u.purpose==="Lease"||u.purpose==="Both");
  const ctxUnits     = crmContext==="leasing"?leaseUnits:saleUnits;
  const availUnits   = ctxUnits.filter(u=>u.status==="Available");
  const reservedUnits= ctxUnits.filter(u=>u.status==="Reserved");
  const today        = new Date();
  const upcomingTasks = activities.filter(a=>a.status==="upcoming");
  const overdueTasksCount = activities.filter(a=>a.status==="upcoming"&&a.scheduled_at&&new Date(a.scheduled_at)<today).length;
  const convRate = visibleOpps.length>0?Math.round(won.length/visibleOpps.length*100):0;
  const recent       = [...activities].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,5);
  const overdueFollowups=[...followups].filter(f=>f.status==="Pending"&&new Date(f.due_at)<today);
  const staleLeads   = active.filter(o=>o.stage_updated_at&&Math.floor((today-new Date(o.stage_updated_at))/(864e5))>=7);

  // Clickable stat card
  const SC=({label,value,sub,accent,icon,onClick,badge})=>(
    <div onClick={onClick} style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:12,padding:"1rem 1.125rem",borderTop:`3px solid ${accent}`,display:"flex",alignItems:"flex-start",gap:10,cursor:onClick?"pointer":"default",transition:"all .15s",position:"relative"}}
      onMouseOver={e=>{if(onClick){e.currentTarget.style.boxShadow="0 4px 16px rgba(0,0,0,.1)";e.currentTarget.style.transform="translateY(-2px)";}}}
      onMouseOut={e=>{e.currentTarget.style.boxShadow="none";e.currentTarget.style.transform="none";}}>
      <div style={{fontSize:22}}>{icon}</div>
      <div style={{flex:1}}>
        <div style={{fontSize:10,color:"#A0AEC0",textTransform:"uppercase",letterSpacing:"0.7px",fontWeight:600,marginBottom:4}}>{label}</div>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:24,fontWeight:700,color:"#0F2540",lineHeight:1}}>{value}</div>
        {sub&&<div style={{fontSize:12,color:"#718096",marginTop:4}}>{sub}</div>}
      </div>
      {onClick&&<div style={{position:"absolute",top:10,right:10,fontSize:12,color:"#A0AEC0"}}>→</div>}
      {badge&&<div style={{position:"absolute",top:-6,right:-6,background:"#B83232",color:"#fff",fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:20}}>{badge}</div>}
    </div>
  );

  return(
    <div className="fade-in" style={{display:"flex",flexDirection:"column",gap:14}}>

      {/* ── Alerts bar ─────────────────────────────────────── */}
      {(overdueFollowups.length>0||staleLeads.length>0)&&(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {overdueFollowups.length>0&&(
            <div onClick={()=>onNavigate("leads")} style={{background:"#FAEAEA",border:"1.5px solid #F0BCBC",borderRadius:10,padding:"10px 16px",display:"flex",alignItems:"center",gap:12,cursor:"pointer"}}
              onMouseOver={e=>e.currentTarget.style.opacity=".85"} onMouseOut={e=>e.currentTarget.style.opacity="1"}>
              <span style={{fontSize:18}}>⏰</span>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,color:"#B83232",fontSize:13}}>{overdueFollowups.length} overdue follow-up{overdueFollowups.length>1?"s":" "} — click to view leads</div>
                <div style={{fontSize:11,color:"#718096"}}>{overdueFollowups.slice(0,3).map(f=>f.lead_name).join(", ")}{overdueFollowups.length>3?` +${overdueFollowups.length-3} more`:""}</div>
              </div>
              <span style={{fontSize:12,color:"#B83232",fontWeight:600}}>Go to Leads →</span>
            </div>
          )}
          {staleLeads.length>0&&(
            <div onClick={()=>onNavigate("leads")} style={{background:"#FDF3DC",border:"1.5px solid #E8C97A",borderRadius:10,padding:"10px 16px",display:"flex",alignItems:"center",gap:12,cursor:"pointer"}}
              onMouseOver={e=>e.currentTarget.style.opacity=".85"} onMouseOut={e=>e.currentTarget.style.opacity="1"}>
              <span style={{fontSize:18}}>📌</span>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,color:"#8A6200",fontSize:13}}>{staleLeads.length} lead{staleLeads.length>1?"s":""} with no activity for 7+ days</div>
                <div style={{fontSize:11,color:"#718096"}}>{staleLeads.slice(0,3).map(o=>o.title||"Opportunity").join(", ")}{staleLeads.length>3?` +${staleLeads.length-3} more`:""}</div>
              </div>
              <span style={{fontSize:12,color:"#8A6200",fontWeight:600}}>Review →</span>
            </div>
          )}
        </div>
      )}

      {/* ── Hero banner ─────────────────────────────────────── */}
      <div style={{background:"#fff",borderRadius:14,padding:"1.25rem 1.5rem",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
        <div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:"#fff",fontWeight:700}}>Good {new Date().getHours()<12?"morning":new Date().getHours()<17?"afternoon":"evening"}, {currentUser.full_name?.split(" ")[0]} ☀️</div>
          <div style={{color:"rgba(255,255,255,.5)",fontSize:12,marginTop:2}}>{new Date().toLocaleDateString("en-AE",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</div>
          <RoleBadge role={currentUser.role}/>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:30,color:"#C9A84C",fontWeight:700}}>{fmtAED(pipeVal)}</div>
          <div style={{fontSize:11,color:"rgba(255,255,255,.5)"}}>Pipeline Value</div>
        </div>
      </div>

      {/* ── Stat cards ──────────────────────────────────────── */}
      <div className="stat-grid" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10}}>
        <SC label="Upcoming Tasks"   value={upcomingTasks.length}  sub={overdueTasksCount>0?`⚠️ ${overdueTasksCount} overdue`:"All on track"} accent={overdueTasksCount>0?"#E53E3E":"#1A7F5A"} icon="📋" onClick={()=>onNavigate("activity",{type:"status",value:"upcoming"})} badge={overdueTasksCount>0?overdueTasksCount:null}/>
        <SC label="Active Opps"      value={active.length}         sub={`${won.length} won · ${convRate}% conv.`}   accent="#0F2540"  icon="🎯"  onClick={()=>onNavigate("reports",{type:"report",value:"pipeline"})}/>
        <SC label="Won Value"        value={fmtM(wonVal)}          sub={`${won.length} deals closed`}      accent="#1A7F5A"  icon="🏆"  onClick={()=>onNavigate("reports",{type:"report",value:"pipeline",stage:"Closed Won"})}/>
        <SC label="Available Units"  value={availUnits.length}     sub={`${ctxUnits.length} total`}        accent="#C9A84C"  icon="🏠"  onClick={()=>onNavigate("builder",{type:"status",value:"Available"})}/>
        <SC label="Reserved"         value={reservedUnits.length}  sub="Pending confirmation"              accent="#A06810"  icon="🔒"  onClick={()=>onNavigate("builder",{type:"status",value:"Reserved"})} badge={reservedUnits.length>0?reservedUnits.length:null}/>
      </div>

      {/* ── Stage Pipeline ──────────────────────────────────── */}
      <div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:12,padding:"16px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:14,fontWeight:700,color:"#0F2540"}}>Opportunities by Stage</div>
          <button onClick={()=>onNavigate("reports")} style={{fontSize:12,color:"#1A5FA8",background:"none",border:"none",cursor:"pointer",fontWeight:600}}>Pipeline Report →</button>
        </div>
        {OPP_STAGES.filter(s=>!["Closed Won","Closed Lost"].includes(s)).map(s=>{
          const cnt=visibleOpps.filter(o=>o.stage===s&&o.status==="Active").length;
          const val=visibleOpps.filter(o=>o.stage===s&&o.status==="Active").reduce((a,o)=>a+(o.budget||0),0);
          const m=OPP_STAGE_META[s]||{c:"#718096",bg:"#F7F9FC"};
          const maxCnt=Math.max(...OPP_STAGES.map(st=>visibleOpps.filter(o=>o.stage===st).length),1);
          return (
            <div key={s} onClick={()=>onNavigate("leads")} style={{marginBottom:10,cursor:"pointer"}}
              onMouseOver={e=>e.currentTarget.style.opacity=".85"} onMouseOut={e=>e.currentTarget.style.opacity="1"}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:11,fontWeight:600,padding:"1px 8px",borderRadius:20,background:m.bg,color:m.c}}>{s}</span>
                  <span style={{fontSize:12,fontWeight:700,color:"#0F2540"}}>{cnt}</span>
                </div>
                {val>0&&<span style={{fontSize:11,color:"#718096"}}>AED {fmtM(val)}</span>}
              </div>
              <div style={{background:"#F7F9FC",borderRadius:6,height:8,overflow:"hidden"}}>
                <div style={{width:`${maxCnt>0?Math.round(cnt/maxCnt*100):0}%`,height:"100%",background:m.c,borderRadius:6,transition:"width .4s"}}/>
              </div>
            </div>
          );
        })}
        {/* Closed summary row */}
        <div style={{display:"flex",gap:8,marginTop:12,paddingTop:10,borderTop:"1px solid #F0F2F5"}}>
          <div onClick={()=>onNavigate("leads")} style={{flex:1,padding:"8px 10px",borderRadius:8,background:"#E6F4EE",cursor:"pointer",textAlign:"center"}}
            onMouseOver={e=>e.currentTarget.style.opacity=".85"} onMouseOut={e=>e.currentTarget.style.opacity="1"}>
            <div style={{fontSize:14,fontWeight:700,color:"#1A7F5A"}}>{won.length}</div>
            <div style={{fontSize:10,color:"#1A7F5A",fontWeight:600}}>Won</div>
          </div>
          <div onClick={()=>onNavigate("leads")} style={{flex:1,padding:"8px 10px",borderRadius:8,background:"#FAEAEA",cursor:"pointer",textAlign:"center"}}
            onMouseOver={e=>e.currentTarget.style.opacity=".85"} onMouseOut={e=>e.currentTarget.style.opacity="1"}>
            <div style={{fontSize:14,fontWeight:700,color:"#B83232"}}>{visibleOpps.filter(o=>o.stage==="Closed Lost"||o.status==="Lost").length}</div>
            <div style={{fontSize:10,color:"#B83232",fontWeight:600}}>Lost</div>
          </div>
        </div>
      </div>

      {/* ── Two column: Recent Activity + Quick Actions ─────── */}
      <div style={{display:"grid",gridTemplateColumns:"minmax(0,1.5fr) minmax(0,1fr)",gap:12}}>

        {/* Recent Activity */}
        <div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:12,padding:"16px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:14,fontWeight:700,color:"#0F2540"}}>Recent Activity</div>
            <button onClick={()=>onNavigate("activity")} style={{fontSize:12,color:"#1A5FA8",background:"none",border:"none",cursor:"pointer",fontWeight:600}}>View All →</button>
          </div>
          {recent.length===0&&<div style={{textAlign:"center",padding:"1.5rem",color:"#A0AEC0",fontSize:12}}>No activity yet</div>}
          {recent.map(a=>{
            const icons={Call:"📞",Email:"✉",Meeting:"🤝",Visit:"🏠",WhatsApp:"💬",Note:"📝"};
            return (
              <div key={a.id} style={{display:"flex",gap:10,padding:"8px 0",borderBottom:"1px solid #F7F9FC",cursor:"pointer"}}
                onClick={()=>onNavigate("leads")}
                onMouseOver={e=>e.currentTarget.style.background="#F7F9FC"} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                <div style={{width:28,height:28,borderRadius:"50%",background:"#F7F9FC",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0}}>{icons[a.type]||"📋"}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:600,color:"#0F2540",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.type} — {a.lead_name||"Lead"}</div>
                  <div style={{fontSize:11,color:"#A0AEC0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.note}</div>
                </div>
                <div style={{fontSize:10,color:"#A0AEC0",flexShrink:0}}>{new Date(a.created_at).toLocaleDateString("en-AE",{day:"numeric",month:"short"})}</div>
              </div>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:12,padding:"14px"}}>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:13,fontWeight:700,color:"#0F2540",marginBottom:10}}>Quick Actions</div>
            {[
              {icon:"👤",label:"Add New Lead",       tab:"leads",    bg:"#0F2540",col:"#C9A84C"},
              {icon:"🏠",label:"View Inventory",     tab:"builder",  bg:"#1A5FA8",col:"#fff"},
              {icon:"📋",label:"Pipeline Report",    tab:"reports",  bg:"#5B3FAA",col:"#fff"},
              {icon:"⚡",label:"Pending Discounts",  tab:"discounts",bg:"#A06810",col:"#fff"},
              {icon:"✦",label:"Ask AI Assistant",   tab:"ai",       bg:"#1A7F5A",col:"#fff"},
            ].map(({icon,label,tab,bg,col})=>(
              <button key={tab} onClick={()=>onNavigate(tab)}
                style={{width:"100%",padding:"8px 12px",borderRadius:8,border:"none",background:bg,color:col,fontSize:12,fontWeight:600,cursor:"pointer",marginBottom:6,textAlign:"left",display:"flex",alignItems:"center",gap:8,transition:"opacity .15s"}}
                onMouseOver={e=>e.currentTarget.style.opacity=".85"} onMouseOut={e=>e.currentTarget.style.opacity="1"}>
                <span style={{fontSize:16}}>{icon}</span>{label}
              </button>
            ))}
          </div>

          {/* Today's summary */}
          <div style={{background:"#0F2540",borderRadius:12,padding:"14px"}}>
            <div style={{fontSize:12,fontWeight:700,color:"#C9A84C",marginBottom:10}}>Today at a Glance</div>
            {[
              ["New Opps",       visibleOpps.filter(o=>o.created_at&&new Date(o.created_at).toDateString()===today.toDateString()).length, "leads"],
              ["Activities",     activities.filter(a=>a.created_at&&new Date(a.created_at).toDateString()===today.toDateString()).length, "activity"],
              ["Reserved Units", reservedUnits.length, "builder"],
            ].map(([l,v,t])=>(
              <div key={l} onClick={()=>onNavigate(t)} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid rgba(255,255,255,.07)",cursor:"pointer"}}
                onMouseOver={e=>e.currentTarget.style.opacity=".7"} onMouseOut={e=>e.currentTarget.style.opacity="1"}>
                <span style={{fontSize:12,color:"rgba(255,255,255,.5)"}}>{l}</span>
                <span style={{fontSize:13,fontWeight:700,color:"#fff"}}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Reservations Widget ─────────────────────────────── */}
      <ReservationsWidget currentUser={currentUser} units={units}/>

    </div>
  );
}


// ══════════════════════════════════════════════════════
// PIPELINE (same as v2)
// ══════════════════════════════════════════════════════


// ── Standalone Log Activity Modal (used in Pipeline + anywhere else) ──
