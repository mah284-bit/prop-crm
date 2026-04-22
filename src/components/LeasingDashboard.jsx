function LeasingDashboard({currentUser, activities=[], units=[], salePricing=[], leasePricing=[], leasingData=null, onNavigate=()=>{}, followupAlerts={}}) {
  const [leases,     setLeases]     = useState([]);
  const [tenants,    setTenants]    = useState([]);
  const [payments,   setPayments]   = useState([]);
  const [maintenance,setMaintenance]= useState([]);
  const [loading,    setLoading]    = useState(true);

  useEffect(()=>{
    // Use pre-loaded data if available — instant render
    if(leasingData?.loaded){
      setLeases(leasingData.leases);
      setTenants(leasingData.tenants);
      setPayments(leasingData.payments);
      setMaintenance(leasingData.maintenance);
      setLoading(false);
      return;
    }
    // Fallback: fetch own data
    const load = async () => {
      setLoading(true);
      try {
        const qsafe = q => q.then(r=>r).catch(()=>({data:[]}));
        const cid = currentUser.company_id || localStorage.getItem("propccrm_company_id") || null;
        const [l,t,p,m] = await Promise.all([
          qsafe(cid ? supabase.from("leases").select("*").eq("company_id",cid).order("end_date") : supabase.from("leases").select("*").order("end_date")),
          qsafe(cid ? supabase.from("tenants").select("*").eq("company_id",cid) : supabase.from("tenants").select("*")),
          qsafe(supabase.from("rent_payments").select("*").order("due_date")),
          qsafe(supabase.from("maintenance").select("*").order("created_at",{ascending:false})),
        ]);
        setLeases(l.data||[]); setTenants(t.data||[]);
        setPayments(p.data||[]); setMaintenance(m.data||[]);
      } catch(e) { console.error("Leasing dashboard load error:", e); }
      setLoading(false);
    };
    load();
  },[leasingData]);

  // Show spinner only on first load, not on refresh
  if(loading && leases.length===0 && tenants.length===0) return <Spinner msg="Loading Leasing Dashboard…"/>;

  const today         = new Date();
  const activeLeases  = leases.filter(l=>l.status==="Active");
  const expiring30    = activeLeases.filter(l=>{const d=new Date(l.end_date);return d>=today&&(d-today)/864e5<=30;});
  const overduePmts   = payments.filter(p=>p.status==="Pending"&&new Date(p.due_date)<today);
  const openMaint     = maintenance.filter(m=>m.status==="Open"||m.status==="In Progress");
  const totalRent     = activeLeases.reduce((s,l)=>s+(l.annual_rent||0),0);
  const leaseUnits    = units.filter(u=>u.purpose==="Lease"||u.purpose==="Both");
  const availUnits    = leaseUnits.filter(u=>u.status==="Available");
  const recentActs    = [...activities].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,5);

  const SC=({label,value,sub,accent,icon,onClick})=>(
    <div onClick={onClick} style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:12,padding:"1rem 1.25rem",borderTop:`3px solid ${accent}`,display:"flex",alignItems:"flex-start",gap:10,cursor:onClick?"pointer":"default",transition:"all .15s",position:"relative"}}
      onMouseOver={e=>{if(onClick){e.currentTarget.style.boxShadow="0 4px 16px rgba(0,0,0,.1)";e.currentTarget.style.transform="translateY(-2px)";}}}
      onMouseOut={e=>{e.currentTarget.style.boxShadow="none";e.currentTarget.style.transform="none";}}>
      <div style={{fontSize:22}}>{icon}</div>
      <div style={{flex:1}}>
        <div style={{fontSize:10,color:"#A0AEC0",textTransform:"uppercase",letterSpacing:".7px",fontWeight:600,marginBottom:4}}>{label}</div>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:24,fontWeight:700,color:"#0F2540",lineHeight:1}}>{value}</div>
        {sub&&<div style={{fontSize:12,color:"#718096",marginTop:4}}>{sub}</div>}
      </div>
      {onClick&&<div style={{position:"absolute",top:10,right:10,fontSize:12,color:"#A0AEC0"}}>→</div>}
    </div>
  );

  return (
    <div className="fade-in" style={{display:"flex",flexDirection:"column",gap:16,height:"100%",overflowY:"auto",paddingRight:4}}>

      {/* Alerts */}
      {(expiring30.length>0||overduePmts.length>0)&&(
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          {expiring30.length>0&&(
            <div onClick={()=>onNavigate("leasing")} style={{flex:1,background:"#FDF3DC",border:"1.5px solid #E8C97A",borderRadius:10,padding:"10px 14px",display:"flex",alignItems:"center",gap:10,cursor:"pointer"}}
              onMouseOver={e=>e.currentTarget.style.opacity=".85"} onMouseOut={e=>e.currentTarget.style.opacity="1"}>
              <span style={{fontSize:20}}>⏰</span>
              <div><div style={{fontWeight:700,color:"#8A6200",fontSize:13}}>{expiring30.length} lease{expiring30.length>1?"s":""} expiring in 30 days — click to manage</div>
              <div style={{fontSize:12,color:"#A06810"}}>Contact tenants for renewal</div></div>
              <span style={{fontSize:12,color:"#8A6200",fontWeight:600,marginLeft:"auto"}}>Go →</span>
            </div>
          )}
          {overduePmts.length>0&&(
            <div onClick={()=>onNavigate("leasing")} style={{flex:1,background:"#FAEAEA",border:"1.5px solid #F0BCBC",borderRadius:10,padding:"10px 14px",display:"flex",alignItems:"center",gap:10,cursor:"pointer"}}
              onMouseOver={e=>e.currentTarget.style.opacity=".85"} onMouseOut={e=>e.currentTarget.style.opacity="1"}>
              <span style={{fontSize:20}}>💳</span>
              <div><div style={{fontWeight:700,color:"#B83232",fontSize:13}}>{overduePmts.length} overdue payment{overduePmts.length>1?"s":""} — click to view</div>
              <div style={{fontSize:12,color:"#B83232"}}>Total: AED {overduePmts.reduce((s,p)=>s+(p.amount||0),0).toLocaleString()}</div></div>
              <span style={{fontSize:12,color:"#B83232",fontWeight:600,marginLeft:"auto"}}>Go →</span>
            </div>
          )}
        </div>
      )}

      {/* Hero */}
      <div style={{background:"linear-gradient(135deg,#1A0B3A 0%,#2D1558 100%)",borderRadius:14,padding:"1.5rem 2rem",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:"#fff",fontWeight:700}}>Good {new Date().getHours()<12?"morning":new Date().getHours()<17?"afternoon":"evening"}, {currentUser.full_name?.split(" ")[0]} {new Date().getHours()<12?"☀️":new Date().getHours()<17?"🌤️":"🌙"}</div>
          <div style={{color:"#C9A84C",fontSize:13,marginTop:4}}>{new Date().toLocaleDateString("en-AE",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</div>
          <div style={{display:"flex",gap:8,marginTop:6,alignItems:"center"}}>
            <RoleBadge role={currentUser.role}/>
            <span style={{fontSize:10,fontWeight:700,padding:"2px 10px",borderRadius:20,background:"rgba(155,127,212,.25)",color:"#C4ACEC"}}>🔑 Leasing CRM</span>
          </div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{color:"rgba(255,255,255,.5)",fontSize:11,textTransform:"uppercase",letterSpacing:".6px"}}>Annual Rent Roll</div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:30,color:"#C9A84C",fontWeight:700,marginTop:2}}>{fmtM(totalRent)}</div>
        </div>
      </div>

      {/* Empty state banner when no leasing data */}
      {leases.length===0&&tenants.length===0&&(
        <div style={{background:"#F0F7FF",border:"1.5px solid #D1E4F7",borderRadius:12,padding:"16px 20px",display:"flex",alignItems:"center",gap:14}}>
          <div style={{fontSize:32}}>🔑</div>
          <div>
            <div style={{fontWeight:700,color:"#0F2540",fontSize:14,marginBottom:4}}>No leasing data yet</div>
            <div style={{fontSize:12,color:"#4A5568"}}>Start by adding tenants and creating leases in the <strong>Enquiries</strong> and <strong>Leasing</strong> tabs. Stats will appear here once data is entered.</div>
          </div>
          <button onClick={()=>onNavigate("l_leads")} style={{marginLeft:"auto",padding:"8px 16px",borderRadius:8,border:"none",background:"#5B3FAA",color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>
            + Add Enquiry →
          </button>
        </div>
      )}

      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
        <SC label="Active Leases"      value={activeLeases.length}  sub={tenants.length>0?`${tenants.length} tenants`:"Add tenants to start"}    accent="#5B3FAA" icon="📄" onClick={()=>onNavigate("leasing",{type:"tab",value:"leases"})}/>
        <SC label="Annual Rent Roll"   value={fmtM(totalRent)}      sub={activeLeases.length>0?`${activeLeases.length} contracts`:"No active leases"} accent="#1A7F5A" icon="💰" onClick={()=>onNavigate("leasing",{type:"tab",value:"leases"})}/>
        <SC label="Available Units"    value={availUnits.length}    sub={`${leaseUnits.length} total for lease`}       accent="#9B7FD4" icon="🔑" onClick={()=>onNavigate("builder",{type:"status",value:"Available"})}/>
        <SC label="Open Maintenance"   value={openMaint.length}     sub={`${overduePmts.length} overdue payments`}     accent={openMaint.length>0?"#B83232":"#A0AEC0"} icon="🔧" onClick={()=>onNavigate("leasing",{type:"tab",value:"maintenance"})}/>
      </div>

      {/* Leases + Task */}
      <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr)",gap:12}}>
        {/* Expiring leases */}
        <div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:12,padding:"1.125rem"}}>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:700,color:"#0F2540",marginBottom:14}}>⏰ Expiring / Needs Renewal</div>
          {expiring30.length===0&&<Empty icon="✓" msg="No leases expiring in 30 days"/>}
          {expiring30.slice(0,5).map(l=>{
            const tenant=tenants.find(t=>t.id===l.tenant_id);
            const unit=units.find(u=>u.id===l.unit_id);
            const daysLeft=Math.ceil((new Date(l.end_date)-today)/864e5);
            return(
              <div key={l.id} style={{padding:"9px 11px",background:"#FDF3DC",borderRadius:8,border:"1px solid #E8C97A",marginBottom:7}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                  <div style={{fontSize:13,fontWeight:600,color:"#0F2540"}}>{tenant?.full_name||"Unknown"}</div>
                  <div style={{fontSize:12,fontWeight:700,color:"#B83232"}}>{daysLeft}d left</div>
                </div>
                <div style={{fontSize:11,color:"#718096"}}>Unit {unit?.unit_ref||"—"} · AED {Number(l.annual_rent||0).toLocaleString()}/yr</div>
                <div style={{fontSize:11,color:"#A06810"}}>Expires {fmtDate(l.end_date)}</div>
              </div>
            );
          })}
          {expiring30.length===0&&activeLeases.slice(0,3).map(l=>{
            const tenant=tenants.find(t=>t.id===l.tenant_id);
            const unit=units.find(u=>u.id===l.unit_id);
            return(
              <div key={l.id} style={{padding:"8px 10px",background:"#F7F9FC",borderRadius:8,border:"1px solid #E2E8F0",marginBottom:6}}>
                <div style={{fontSize:12,fontWeight:600,color:"#0F2540"}}>{tenant?.full_name||"Unknown"}</div>
                <div style={{fontSize:11,color:"#718096"}}>Unit {unit?.unit_ref||"—"} · AED {Number(l.annual_rent||0).toLocaleString()}/yr · Expires {fmtDate(l.end_date)}</div>
              </div>
            );
          })}
        </div>

        {/* Recent activity */}
        <div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:12,padding:"1.125rem"}}>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:700,color:"#0F2540",marginBottom:14}}>📋 Recent Activity</div>
          {recentActs.length===0&&<Empty icon="📋" msg="No recent activity"/>}
          {recentActs.map(a=>(
            <div key={a.id} style={{padding:"8px 10px",background:"#F7F9FC",borderRadius:8,border:"1px solid #F0F2F5",marginBottom:7}}>
              <div style={{fontSize:12,fontWeight:600,color:"#0F2540"}}>{a.type} — {a.lead_name||"—"}</div>
              <div style={{fontSize:11,color:"#718096"}}>{a.user_name} · {fmtDate(a.created_at)}</div>
              {a.note&&<div style={{fontSize:11,color:"#A0AEC0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.note}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Maintenance + Available units */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        <div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:12,padding:"1.125rem"}}>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:700,color:"#0F2540",marginBottom:14}}>🔧 Open Maintenance</div>
          {openMaint.length===0&&<Empty icon="✓" msg="No open maintenance requests"/>}
          {openMaint.slice(0,4).map(m=>{
            const PC={Urgent:{c:"#B83232",bg:"#FAEAEA"},High:{c:"#B85C10",bg:"#FDF0E6"},Normal:{c:"#1A5FA8",bg:"#E6EFF9"},Low:{c:"#718096",bg:"#F7F9FC"}};
            const pc=PC[m.priority]||PC.Normal;
            const unit=units.find(u=>u.id===m.unit_id);
            return(
              <div key={m.id} style={{padding:"8px 10px",background:"#F7F9FC",borderRadius:8,border:"1px solid #E2E8F0",marginBottom:6}}>
                <div style={{display:"flex",gap:6,marginBottom:3}}>
                  <span style={{fontSize:10,fontWeight:600,padding:"1px 7px",borderRadius:20,background:pc.bg,color:pc.c}}>{m.priority}</span>
                  <span style={{fontSize:11,fontWeight:600,color:"#0F2540"}}>{m.title}</span>
                </div>
                <div style={{fontSize:11,color:"#718096"}}>Unit {unit?.unit_ref||"—"} · {m.category}</div>
              </div>
            );
          })}
        </div>
        <div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:12,padding:"1.125rem"}}>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:700,color:"#0F2540",marginBottom:14}}>🏠 Available for Lease</div>
          {availUnits.length===0&&<Empty icon="🔑" msg="No units currently available"/>}
          {availUnits.slice(0,5).map(u=>{
            const lp=leasePricing.find(l=>l.unit_id===u.id);
            return(
              <div key={u.id} style={{padding:"8px 10px",background:"#EEE8F9",borderRadius:8,border:"1px solid #C4ACEC",marginBottom:6}}>
                <div style={{display:"flex",justifyContent:"space-between"}}>
                  <div style={{fontSize:12,fontWeight:700,color:"#0F2540"}}>{u.unit_ref}</div>
                  <div style={{fontSize:12,fontWeight:700,color:"#5B3FAA"}}>{lp?`AED ${Number(lp.annual_rent).toLocaleString()}/yr`:"TBD"}</div>
                </div>
                <div style={{fontSize:11,color:"#718096"}}>{u.sub_type}{u.size_sqft?` · ${Number(u.size_sqft).toLocaleString()} sqft`:""}{u.view?` · ${u.view}`:""}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:12,padding:"1rem"}}>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:13,fontWeight:700,color:"#0F2540",marginBottom:10}}>Quick Actions</div>
          {[
            {icon:"👤",label:"Add Enquiry",       tab:"l_leads",     bg:"#5B3FAA",col:"#fff"},
            {icon:"🏠",label:"View Inventory",    tab:"l_inventory", bg:"#1A5FA8",col:"#fff"},
            {icon:"🔀",label:"Pipeline Board",    tab:"l_pipeline",  bg:"#9B7FD4",col:"#fff"},
            {icon:"📄",label:"Active Leases",     tab:"leasing",     bg:"#1A7F5A",col:"#fff"},
            {icon:"✦", label:"Ask AI Assistant",  tab:"l_ai",        bg:"#0F2540",col:"#C9A84C"},
          ].map(({icon,label,tab,bg,col})=>(
            <button key={tab} onClick={()=>onNavigate(tab)}
              style={{width:"100%",padding:"8px 12px",borderRadius:8,border:"none",background:bg,color:col,fontSize:12,fontWeight:600,cursor:"pointer",marginBottom:6,textAlign:"left",display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:16}}>{icon}</span>{label}
            </button>
          ))}
        </div>
        <div style={{background:"#2D1558",borderRadius:12,padding:"1rem"}}>
          <div style={{fontSize:12,fontWeight:700,color:"#C9A84C",marginBottom:10}}>Today at a Glance</div>
          {[
            ["New Enquiries", tenants.filter(t=>t.created_at&&new Date(t.created_at).toDateString()===new Date().toDateString()).length, "l_leads"],
            ["Expiring ≤30d", expiring30.length, "leasing"],
            ["Overdue Payments", overduePmts.length, "leasing"],
            ["Open Maintenance", openMaint.length, "leasing"],
          ].map(([l,v,t])=>(
            <div key={l} onClick={()=>onNavigate(t)} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid rgba(255,255,255,.07)",cursor:"pointer"}}>
              <span style={{fontSize:12,color:"rgba(255,255,255,.5)"}}>{l}</span>
              <span style={{fontSize:13,fontWeight:700,color:v>0?"#F87171":"#fff"}}>{v}</span>
            </div>
          ))}
        </div>
      </div>


      {/* Quick Actions + Today summary */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:12,padding:"1rem"}}>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:13,fontWeight:700,color:"#0F2540",marginBottom:10}}>Quick Actions</div>
          {[
            {icon:"👤",label:"Add Enquiry",      tab:"l_leads",     bg:"#5B3FAA",col:"#fff"},
            {icon:"🏠",label:"View Inventory",   tab:"l_inventory", bg:"#1A5FA8",col:"#fff"},
            {icon:"🔀",label:"Pipeline Board",   tab:"l_pipeline",  bg:"#9B7FD4",col:"#fff"},
            {icon:"📄",label:"Active Leases",    tab:"leasing",     bg:"#1A7F5A",col:"#fff"},
            {icon:"✦", label:"AI Assistant",     tab:"l_ai",        bg:"#0F2540",col:"#C9A84C"},
          ].map(({icon,label,tab,bg,col})=>(
            <button key={tab} onClick={()=>onNavigate(tab)}
              style={{width:"100%",padding:"8px 12px",borderRadius:8,border:"none",background:bg,color:col,fontSize:12,fontWeight:600,cursor:"pointer",marginBottom:6,textAlign:"left",display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:16}}>{icon}</span>{label}
            </button>
          ))}
        </div>
        <div style={{background:"#2D1558",borderRadius:12,padding:"1rem"}}>
          <div style={{fontSize:12,fontWeight:700,color:"#C9A84C",marginBottom:10}}>Today at a Glance</div>
          {[
            ["Expiring ≤30d",    expiring30.length,   "leasing"],
            ["Overdue Payments", overduePmts.length,  "leasing"],
            ["Open Maintenance", openMaint.length,    "leasing"],
            ["Available Units",  availUnits.length,   "l_inventory"],
          ].map(([l,v,t])=>(
            <div key={l} onClick={()=>onNavigate(t)} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid rgba(255,255,255,.07)",cursor:"pointer"}}>
              <span style={{fontSize:12,color:"rgba(255,255,255,.5)"}}>{l}</span>
              <span style={{fontSize:13,fontWeight:700,color:v>0?"#F87171":"#fff"}}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Reservations Widget */}
      <ReservationsWidget currentUser={currentUser} units={units}/>
    </div>
  );
}



// ══════════════════════════════════════════════════════════════════
// COMPANIES MODULE — Super Admin only
// ══════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════
// USER MANAGEMENT
// ══════════════════════════════════════════════════════════════════
