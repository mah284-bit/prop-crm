function Leads({leads,setLeads,opps:globalOppsFromParent=[],setOpps:setGlobalOpps=()=>{},properties,activities,setActivities,discounts,setDiscounts,currentUser,users,showToast}){
  const [search,   setSearch]   = useState("");
  const [fStage,   setFStage]   = useState("All");
  const [fType,    setFType]    = useState("All");
  const [view,     setView]     = useState("list");   // list | lead | opportunity
  const [selLeadId,setSelLeadId]= useState(null);
  const [selOpp,   setSelOpp]   = useState(null);
  const [showAdd,  setShowAdd]  = useState(false);
  const [editLead, setEditLead] = useState(null);
  const [saving,   setSaving]   = useState(false);
  const [opps,     setOpps]     = useState(globalOppsFromParent); // sync with global
  const [units,    setUnits]    = useState([]);
  const [projects, setProjects] = useState([]);
  const [salePricing,setSalePricing]=useState([]);
  const [showAddOpp, setShowAddOpp]=useState(false);
  const [oppForm,  setOppForm]  = useState({title:"",unit_id:"",budget:"",assigned_to:"",notes:"",property_category:"Off-Plan"});
  const canEdit = can(currentUser.role,"write");
  const canDel  = can(currentUser.role,"delete_leads");

  const blank = {name:"",phone:"",email:"",nationality:"",source:"Walk-In",property_type:"Sale",notes:"",assigned_to:currentUser.id,budget:""};
  const [form, setForm] = useState(blank);
  const sf = k => e => setForm(f=>({...f,[k]:e.target?.value??e}));

  // Load data
  useEffect(()=>{
    supabase.from("opportunities").select("*").order("created_at",{ascending:false}).then(({data})=>setOpps(data||[]));
    supabase.from("project_units").select("id,unit_ref,sub_type,project_id,status,purpose,floor_number,view,size_sqft,bedrooms").then(({data})=>setUnits(data||[]));
    supabase.from("projects").select("id,name").then(({data})=>setProjects(data||[]));
    supabase.from("unit_sale_pricing").select("unit_id,asking_price").then(({data})=>setSalePricing(data||[]));
  },[]);

  if(!currentUser) return null;
  const selLead = leads.find(l=>l&&l.id===selLeadId);
  const leadOpps = selLeadId ? opps.filter(o=>o.lead_id===selLeadId) : [];

  // Filter leads — exclude pure lease leads from Sales CRM
  const visible = (can(currentUser.role,"see_all")?leads:leads.filter(l=>l&&l.assigned_to===currentUser.id))
    .filter(l=>l&&l.property_type!=="Lease");

  // Aggregated stage from opportunities
  const leadBestStage = (leadId)=>{
    const lo=opps.filter(o=>o.lead_id===leadId&&o.status==="Active");
    if(lo.length===0) return opps.find(o=>o.lead_id===leadId)?.stage||"New";
    const order=["Negotiation","Proposal Sent","Site Visit","Contacted","New"];
    for(const s of order){ if(lo.find(o=>o.stage===s)) return s; }
    return lo[0]?.stage||"New";
  };

  const filtered = visible.filter(l=>{
    const q=search.toLowerCase();
    const stage = leadBestStage(l.id);
    return(!q||l.name?.toLowerCase().includes(q)||l.email?.toLowerCase().includes(q)||l.phone?.includes(q)||l.source?.toLowerCase().includes(q))
      &&(fType==="All"||l.property_type===fType)
      &&(fStage==="All"||stage===fStage);
  });

  const saveLead = async()=>{
    if(!form.name.trim()){showToast("Name required","error");return;}
    setSaving(true);
    try{
      // Duplicate detection (skip when editing)
      if(!editLead){
        const dupCheck = leads.filter(l=>
          (form.email&&l.email&&l.email.toLowerCase()===form.email.toLowerCase()) ||
          (form.phone&&l.phone&&l.phone.replace(/\s/g,"")===form.phone.replace(/\s/g,""))
        );
        if(dupCheck.length>0){
          setSaving(false);
          const dup=dupCheck[0];
          const go=window.confirm(`A contact with this ${form.email&&dup.email?.toLowerCase()===form.email.toLowerCase()?"email":"phone"} already exists:\n\n${dup.name} (${dup.email||dup.phone})\n\nClick OK to open their profile, or Cancel to continue creating.`);
          if(go){setShowAdd(false);setSelLeadId(dup.id);setView("lead");}
          return;
        }
      }
      const payload={...form,budget:form.budget?Number(form.budget):null,final_price:form.final_price?Number(form.final_price):null,no_response_count:form.no_response_count?Number(form.no_response_count):0,phone:form.phone||null,assigned_to:form.assigned_to||currentUser.id,company_id:currentUser.company_id||null,created_by:currentUser.id};
      let data,error;
      if(editLead){
        ({data,error}=await supabase.from("leads").update(form).eq("id",editLead.id).select().single());
        setLeads(p=>p.map(l=>l.id===editLead.id?data:l));
      }else{
        ({data,error}=await supabase.from("leads").insert(payload).select().single());
        setLeads(p=>[data,...p]);
      }
      if(error)throw error;
      showToast(editLead?"Contact updated":"Contact added","success");
      setShowAdd(false);setEditLead(null);setForm(blank);
    }catch(e){showToast(e.message,"error");}
    setSaving(false);
  };

  const saveOpp = async()=>{
    if(!selLeadId){return;}
    setSaving(true);
    try{
      const unit=units.find(u=>u.id===oppForm.unit_id);
      const payload={
        lead_id:selLeadId,
        company_id:currentUser.company_id||null,
        title:oppForm.title||(unit?`${unit.unit_ref} — ${selLead?.name}`:`Opportunity — ${selLead?.name}`),
        unit_id:oppForm.unit_id||null,
        budget:oppForm.budget?Number(oppForm.budget):null,
        assigned_to:oppForm.assigned_to||currentUser.id,
        notes:oppForm.notes||null,
        property_category:oppForm.property_category||"Off-Plan",
        stage:"New",status:"Active",
        created_by:currentUser.id,
      };
      const{data,error}=await supabase.from("opportunities").insert(payload).select().single();
      if(error)throw error;
      setOpps(p=>{const n=[data,...p];setGlobalOpps(n);return n;});
      showToast("Opportunity created","success");
      setShowAddOpp(false);
      setOppForm({title:"",unit_id:"",budget:"",assigned_to:"",notes:"",property_category:"Off-Plan"});
      // Open the opportunity immediately
      setSelOpp(data);
      setView("opportunity");
    }catch(e){showToast(e.message,"error");}
    setSaving(false);
  };

  // ── LIST VIEW ──────────────────────────────────────────────────
  if(view==="list") return (
    <div className="fade-in" style={{display:"flex",flexDirection:"column",height:"100%"}}>
      {/* Toolbar */}
      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
        <div style={{position:"relative",flex:1,minWidth:160}}>
          <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",fontSize:14}}>🔍</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, phone, email…" style={{paddingLeft:32,width:"100%"}}/>
        </div>
        <select value={fType} onChange={e=>setFType(e.target.value)} style={{width:"auto"}}>
          <option value="All">All Types</option>
          <option value="Sale">Sale</option>
          <option value="Both">Both</option>
        </select>
        <select value={fStage} onChange={e=>setFStage(e.target.value)} style={{width:"auto"}}>
          <option value="All">All Stages</option>
          {["Walk-In","Referral","Online","Social Media","Cold Call","Exhibition","Portal","Other"].map(s=><option key={s}>{s}</option>)}
        </select>
        <span style={{fontSize:12,color:"#A0AEC0",whiteSpace:"nowrap"}}>{filtered.length}/{visible.length}</span>
        {canEdit&&<button onClick={()=>{setForm(blank);setEditLead(null);setShowAdd(true);}} style={{padding:"8px 18px",borderRadius:8,border:"none",background:"#0F2540",color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>+ Add Contact</button>}
      </div>

      {/* Lead summary strip */}
      <div style={{display:"flex",gap:8,marginBottom:12,flexShrink:0,flexWrap:"wrap"}}>
        <div style={{padding:"6px 14px",borderRadius:8,background:"#fff",border:"1px solid #E8EDF4",fontSize:12,color:"#0F2540",fontWeight:600}}>{visible.length} total contacts</div>
        <div style={{padding:"6px 14px",borderRadius:8,background:"#EFF6FF",border:"1px solid #BFDBFE",fontSize:12,color:"#1A5FA8",fontWeight:600}}>{opps.filter(o=>o.status==="Active").length} active opportunities</div>
        <div style={{padding:"6px 14px",borderRadius:8,background:"#E6F4EE",border:"1px solid #A8D5BE",fontSize:12,color:"#1A7F5A",fontWeight:600}}>{opps.filter(o=>o.stage==="Closed Won").length} won deals</div>
      </div>

      {/* Lead cards */}
      <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:4}}>
        {filtered.length===0&&<div style={{textAlign:"center",padding:"3rem",color:"#A0AEC0"}}>No contacts found</div>}
        {filtered.map(l=>{
          const lo=opps.filter(o=>o.lead_id===l.id);
          const activeOpps=lo.filter(o=>o.status==="Active");
          const wonOpps=lo.filter(o=>o.status==="Won");
          const bestStage=leadBestStage(l.id);
          const sm2=OPP_STAGE_META[bestStage]||{c:"#718096",bg:"#F7F9FC"};
          const assignedUser=users.find(u=>u.id===l.assigned_to);
          const totalVal=lo.reduce((s,o)=>s+(o.budget||0),0);
          if(fStage!=="All"&&bestStage!==fStage)return null;
          return (
            <div key={l.id} onClick={()=>{setSelLeadId(l.id);setView("lead");}}
              style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:8,padding:"10px 14px",cursor:"pointer",borderLeft:"3px solid #E2E8F0",transition:"all .12s"}}
              onMouseOver={e=>{e.currentTarget.style.background="#F7F9FC";e.currentTarget.style.boxShadow="0 2px 8px rgba(0,0,0,.06)";}}
              onMouseOut={e=>{e.currentTarget.style.background="#fff";e.currentTarget.style.boxShadow="none";}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <Av name={l.name} size={32}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                    <span style={{fontWeight:700,fontSize:13,color:"#0F2540"}}>{l.name}</span>
                    {activeOpps.length>0&&<span style={{fontSize:10,fontWeight:600,padding:"1px 7px",borderRadius:20,background:"#EFF6FF",color:"#1A5FA8"}}>{activeOpps.length} active opp{activeOpps.length!==1?"s":""}</span>}
                    {wonOpps.length>0&&<span style={{fontSize:10,fontWeight:600,padding:"1px 7px",borderRadius:20,background:"#E6F4EE",color:"#1A7F5A"}}>✓ {wonOpps.length} Won</span>}
                    {activeOpps.length===0&&wonOpps.length===0&&<span style={{fontSize:10,fontWeight:500,padding:"1px 7px",borderRadius:20,background:"#F7F9FC",color:"#94A3B8"}}>No opportunities</span>}
                  </div>
                  <div style={{display:"flex",gap:10,fontSize:11,color:"#718096",marginTop:2,flexWrap:"wrap"}}>
                    {l.phone&&<span>{l.phone}</span>}
                    {l.email&&<span>{l.email}</span>}
                    {l.nationality&&<span>🌍 {l.nationality}</span>}
                  </div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontSize:12,fontWeight:700,color:"#0F2540"}}>{activeOpps.length} active opp{activeOpps.length!==1?"s":""}</div>
                  {totalVal>0&&<div style={{fontSize:11,color:"#718096"}}>AED {fmtM(totalVal)}</div>}
                  <div style={{fontSize:10,color:"#A0AEC0"}}>{assignedUser?.full_name||"Unassigned"}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add/Edit Contact Modal */}
      {showAdd&&(
        <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:"1rem"}}>
          <div style={{background:"#fff",borderRadius:16,width:480,maxWidth:"100%",maxHeight:"90vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 20px 60px rgba(11,31,58,.35)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"1rem 1.5rem",borderBottom:"1px solid #E8EDF4",background:"#fff"}}>
              <span style={{fontFamily:"'Inter',sans-serif",fontSize:16,fontWeight:700,color:"#0F2540",letterSpacing:"-.3px"}}>{editLead?"Edit":"New"} Contact</span>
              <button onClick={()=>{setShowAdd(false);setEditLead(null);}} style={{background:"none",border:"none",fontSize:22,color:"#C9A84C",cursor:"pointer"}}>×</button>
            </div>
            <div style={{overflowY:"auto",padding:"1.25rem 1.5rem"}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div style={{gridColumn:"1/-1"}}><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Full Name *</label><input value={form.name} onChange={sf("name")}/></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Phone</label><input value={form.phone} onChange={sf("phone")}/></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Email</label><input type="email" value={form.email} onChange={sf("email")}/></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Nationality</label><input value={form.nationality} onChange={sf("nationality")}/></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Source</label>
                  <select value={form.source} onChange={sf("source")}>
                    {MASTER.lead_source.map(s=><option key={s}>{s}</option>)}
                  </select></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Property Type</label>
                  <select value={form.property_type} onChange={sf("property_type")}>
                    <option value="Sale">Sale</option><option value="Both">Both</option>
                  </select></div>
                <div style={{gridColumn:"1/-1"}}><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Notes</label><textarea value={form.notes} onChange={sf("notes")} rows={3}/></div>
              </div>
            </div>
            <div style={{display:"flex",gap:10,justifyContent:"flex-end",padding:"1rem 1.5rem",borderTop:"1px solid #E2E8F0"}}>
              <button onClick={()=>{setShowAdd(false);setEditLead(null);}} style={{padding:"9px 18px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancel</button>
              <button onClick={saveLead} disabled={saving} style={{padding:"9px 24px",borderRadius:8,border:"none",background:saving?"#A0AEC0":"#0F2540",color:"#fff",fontSize:13,fontWeight:600,cursor:saving?"not-allowed":"pointer"}}>{saving?"Saving…":editLead?"Save":"Add Contact"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ── LEAD DETAIL VIEW (contact + opportunities) ─────────────────
  if(view==="lead"&&selLead) return (
    <div className="fade-in" style={{display:"flex",flexDirection:"column",height:"100%"}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16,flexWrap:"wrap"}}>
        <button onClick={()=>setView("list")} style={{padding:"6px 14px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>← Contacts</button>
        <Av name={selLead.name} size={40}/>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontFamily:"'Inter',sans-serif",fontSize:16,fontWeight:700,color:"#0F2540",letterSpacing:"-.4px"}}>{selLead.name}</div>
          <div style={{fontSize:12,color:"#718096"}}>{selLead.phone} {selLead.email?`· ${selLead.email}`:""} {selLead.nationality?`· ${selLead.nationality}`:""}</div>
        </div>
        <div style={{display:"flex",gap:6}}>
          {canEdit&&<button onClick={()=>{setForm({...blank,...selLead});setEditLead(selLead);setShowAdd(true);}} style={{padding:"6px 14px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>✏ Edit</button>}
          {canEdit&&<button onClick={()=>{setOppForm({title:"",unit_id:"",budget:"",assigned_to:currentUser.id,notes:"",property_category:"Off-Plan"});setShowAddOpp(true);}} style={{padding:"6px 14px",borderRadius:8,border:"none",background:"#0F2540",color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>+ New Opportunity</button>}
        </div>
      </div>

      {/* Contact info strip */}
      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
        {[["📞 Phone",selLead.phone||"—"],["✉ Email",selLead.email||"—"],["🌍 Nationality",selLead.nationality||"—"],["🏷 Source",selLead.source||"—"],["📋 Type",selLead.property_type||"—"]].map(([l,v])=>(
          <div key={l} style={{background:"#F7F9FC",borderRadius:8,padding:"8px 14px",flex:1,minWidth:120}}>
            <div style={{fontSize:9,color:"#A0AEC0",textTransform:"uppercase",letterSpacing:".5px",fontWeight:600,marginBottom:3}}>{l}</div>
            <div style={{fontSize:13,fontWeight:600,color:"#0F2540",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v}</div>
          </div>
        ))}
      </div>

      {/* Opportunities */}
      <div style={{fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:700,color:"#0F2540",marginBottom:12}}>
        Opportunities ({leadOpps.length})
      </div>
      <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:8}}>
        {leadOpps.length===0&&(
          <div style={{textAlign:"center",padding:"3rem",color:"#A0AEC0"}}>
            <div style={{fontSize:36,marginBottom:10}}>🎯</div>
            <div style={{fontSize:14,fontWeight:600,color:"#0F2540",marginBottom:6}}>No opportunities yet</div>
            <div style={{fontSize:12,marginBottom:16}}>Add an opportunity for each property this contact is interested in</div>
            {canEdit&&<button onClick={()=>{setOppForm({title:"",unit_id:"",budget:"",assigned_to:currentUser.id,notes:"",property_category:"Off-Plan"});setShowAddOpp(true);}} style={{padding:"10px 24px",borderRadius:8,border:"none",background:"#0F2540",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>+ Add First Opportunity</button>}
          </div>
        )}
        {leadOpps.map(opp=>{
          const unit=units.find(u=>u.id===opp.unit_id);
          const proj=unit?projects.find(p=>p.id===unit.project_id):null;
          const sp=unit?salePricing.find(s=>s.unit_id===unit.id):null;
          const sm3=OPP_STAGE_META[opp.stage]||{c:"#718096",bg:"#F7F9FC"};
          const agent=users.find(u=>u.id===opp.assigned_to);
          return (
            <div key={opp.id} onClick={()=>{setSelOpp(opp);setView("opportunity");}}
              style={{background:"#fff",border:"1.5px solid #E2E8F0",borderRadius:12,padding:"14px 16px",cursor:"pointer",borderLeft:`4px solid ${sm3.c}`,transition:"all .12s"}}
              onMouseOver={e=>{e.currentTarget.style.boxShadow="0 4px 16px rgba(0,0,0,.08)";e.currentTarget.style.transform="translateY(-1px)";}}
              onMouseOut={e=>{e.currentTarget.style.boxShadow="none";e.currentTarget.style.transform="none";}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:4}}>
                    <span style={{fontWeight:700,fontSize:14,color:"#0F2540"}}>{opp.title||"Opportunity"}</span>
                    <span style={{fontSize:11,fontWeight:600,padding:"2px 9px",borderRadius:20,background:sm3.bg,color:sm3.c}}>{opp.stage}</span>
                    {opp.status==="Won"&&<span style={{fontSize:11,fontWeight:600,padding:"2px 9px",borderRadius:20,background:"#E6F4EE",color:"#1A7F5A"}}>✓ Won</span>}
                    {opp.status==="Lost"&&<span style={{fontSize:11,fontWeight:600,padding:"2px 9px",borderRadius:20,background:"#F7F9FC",color:"#718096"}}>Lost</span>}
                    {opp.status==="On Hold"&&<span style={{fontSize:11,fontWeight:600,padding:"2px 9px",borderRadius:20,background:"#FDF3DC",color:"#8A6200"}}>On Hold</span>}
                  </div>
                  {unit&&<div style={{fontSize:12,color:"#4A5568",marginBottom:2}}>🏠 {unit.unit_ref} — {unit.sub_type}{proj?` · ${proj.name}`:""}</div>}
                  {sp&&<div style={{fontSize:13,fontWeight:700,color:"#1A5FA8"}}>AED {Number(sp.asking_price).toLocaleString()}</div>}
                  {opp.budget&&!sp&&<div style={{fontSize:13,fontWeight:700,color:"#1A5FA8"}}>Budget: AED {Number(opp.budget).toLocaleString()}</div>}
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontSize:11,color:"#A0AEC0"}}>{agent?.full_name||"Unassigned"}</div>
                  <div style={{fontSize:11,color:"#A0AEC0",marginTop:2}}>{opp.stage_updated_at?Math.floor((new Date()-new Date(opp.stage_updated_at))/864e5)+"d in stage":""}</div>
                  {opp.proposal_sent_at&&<div style={{fontSize:10,color:"#A06810",marginTop:2}}>📤 Proposal sent {fmtDate(opp.proposal_sent_at)}</div>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Opportunity Modal */}
      {showAddOpp&&(
        <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,.65)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1100,padding:"1rem"}}>
          <div style={{background:"#fff",borderRadius:16,width:500,maxWidth:"100%",maxHeight:"90vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 24px 64px rgba(11,31,58,.4)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"1rem 1.5rem",borderBottom:"1px solid #E8EDF4",background:"#fff"}}>
              <div>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:16,fontWeight:700,color:"#fff"}}>🎯 New Opportunity</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,.5)",marginTop:2}}>for {selLead.name}</div>
              </div>
              <button onClick={()=>setShowAddOpp(false)} style={{background:"none",border:"none",fontSize:22,color:"#C9A84C",cursor:"pointer"}}>×</button>
            </div>
            <div style={{overflowY:"auto",padding:"1.25rem 1.5rem",flex:1}}>
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Opportunity Title</label>
                  <input value={oppForm.title} onChange={e=>setOppForm(f=>({...f,title:e.target.value}))} placeholder="e.g. 2BR Palm Jumeirah (auto-filled if unit selected)"/>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Property Category *</label>
                  <div style={{display:"flex",gap:8}}>
                    {[["Off-Plan","🏗️"],["Ready / Resale","🔑"],["Commercial","🏢"]].map(([cat,icon])=>(
                      <button key={cat} onClick={()=>setOppForm(f=>({...f,property_category:cat}))}
                        style={{flex:1,padding:"8px",borderRadius:8,border:`1.5px solid ${oppForm.property_category===cat?"#0F2540":"#E2E8F0"}`,background:oppForm.property_category===cat?"#0F2540":"#fff",color:oppForm.property_category===cat?"#fff":"#4A5568",fontSize:12,cursor:"pointer",fontWeight:oppForm.property_category===cat?600:400}}>
                        {icon} {cat}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Linked Unit *</label>
                  <select value={oppForm.unit_id} onChange={e=>{
                    const u=units.find(x=>x.id===e.target.value);
                    const p=u?projects.find(x=>x.id===u.project_id):null;
                    setOppForm(f=>({...f,unit_id:e.target.value,title:u&&!f.title?`${u.unit_ref} — ${selLead?.name||""}`:f.title}));
                  }}>
                    <option value="">— Select a unit —</option>
                    {units.filter(u=>u.status==="Available"&&(u.purpose==="Sale"||u.purpose==="Both")).map(u=>{
                      const sp2=salePricing.find(s=>s.unit_id===u.id);
                      const pr=projects.find(p=>p.id===u.project_id);
                      return <option key={u.id} value={u.id}>{u.unit_ref} · {u.sub_type} · {pr?.name||"—"}{sp2?` · AED ${Math.round(sp2.asking_price/1000)}K`:""}</option>;
                    })}
                  </select>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Budget (AED)</label>
                  <input type="number" value={oppForm.budget} onChange={e=>setOppForm(f=>({...f,budget:e.target.value}))} placeholder="Client's budget"/>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Assign To</label>
                  <select value={oppForm.assigned_to} onChange={e=>setOppForm(f=>({...f,assigned_to:e.target.value}))}>
                    {users.filter(u=>u.is_active).map(u=><option key={u.id} value={u.id}>{u.full_name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Notes</label>
                  <textarea value={oppForm.notes} onChange={e=>setOppForm(f=>({...f,notes:e.target.value}))} rows={3} placeholder="Any initial notes…"/>
                </div>
              </div>
            </div>
            <div style={{display:"flex",gap:10,justifyContent:"flex-end",padding:"1rem 1.5rem",borderTop:"1px solid #E2E8F0"}}>
              <button onClick={()=>setShowAddOpp(false)} style={{padding:"9px 18px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancel</button>
              <button onClick={saveOpp} disabled={saving} style={{padding:"9px 24px",borderRadius:8,border:"none",background:saving?"#A0AEC0":"#0F2540",color:"#fff",fontSize:13,fontWeight:600,cursor:saving?"not-allowed":"pointer"}}>{saving?"Saving…":"Create Opportunity"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ── OPPORTUNITY DETAIL VIEW ────────────────────────────────────
  if(view==="opportunity"&&selOpp) return (
    <OpportunityDetail
      opp={selOpp}
      lead={selLead||leads.find(l=>l.id===selOpp.lead_id)||{}}
      units={units}
      projects={projects}
      salePricing={salePricing}
      users={users}
      currentUser={currentUser}
      showToast={showToast}
      onBack={()=>{setView("lead");setSelOpp(null);}}
      onUpdated={(updated)=>{
        setSelOpp(updated);
        setOpps(p=>{const n=p.map(o=>o.id===updated.id?updated:o);setGlobalOpps(n);return n;});
      }}
    />
  );

  return null;
}


