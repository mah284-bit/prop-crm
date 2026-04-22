function OpportunityDetail({ opp, lead, units, projects, salePricing, users, currentUser, showToast, onBack, onUpdated }) {
  const [activeTab,  setActiveTab]  = useState("details");
  const [activities, setActivities] = useState([]);
  const [payments,   setPayments]   = useState([]);
  const [contract,   setContract]   = useState(null);
  const [saving,     setSaving]     = useState(false);
  const [showLog,    setShowLog]    = useState(false);
  const [showPayment,setShowPayment]= useState(false);
  const [showEmail,  setShowEmail]  = useState(false);
  const [showStageGate, setShowStageGate] = useState(null); // stage name being gated
  const [stageGateForm, setStageGateForm] = useState({});
  const [showDiscReq, setShowDiscReq] = useState(false);
  const [discReqForm, setDiscReqForm] = useState({type:"sale_price",discount_pct:"",reason:"",discount_source:"Developer",developer_auth_ref:""});
  const [logForm,    setLogForm]    = useState({type:"Call",note:""});
  const [payForm,    setPayForm]    = useState({milestone:"Booking Deposit",amount:"",percentage:"",due_date:"",payment_type:"Cheque",cheque_number:"",cheque_date:"",bank_name:"",status:"Pending",notes:"",cheque_file_url:""});
  const [emailForm,  setEmailForm]  = useState({to:"",subject:"",body:""});
  const [editPayment,setEditPayment]= useState(null);
  const canEdit  = can(currentUser.role,"write");
  const [tookOwnership, setTookOwnership] = useState(false);
  const [showReassign, setShowReassign] = useState(false);
  const [reassignForm, setReassignForm] = useState({assigned_to:"", reason:""});
  const isOwner  = opp.assigned_to === currentUser.id;
  const isAdmin  = ["super_admin","admin"].includes(currentUser.role);
  const isManager = ["sales_manager","leasing_manager"].includes(currentUser.role);
  const canAction = isOwner || tookOwnership;
  const canReassign = isAdmin || isManager;
  const isWon    = opp.stage==="Closed Won";
  const isDeveloper = (()=>{try{const c=JSON.parse(localStorage.getItem("propccrm_company_cache")||"null");return c?.company_category==="Developer";}catch{return false;}})();
  const isOffPlan = opp.property_category==="Off-Plan" || (!opp.property_category && sp?.booking_pct>0);
  const isResale = opp.property_category==="Ready / Resale";
  const isCommercial = opp.property_category==="Commercial";
  const isLocked = ["Proposal Sent","Negotiation","Closed Won","Closed Lost"].includes(opp.stage);

  const unit     = units.find(u=>u.id===opp.unit_id);
  const proj     = unit ? projects.find(p=>p.id===unit.project_id) : null;
  const sp       = unit ? salePricing.find(s=>s.unit_id===unit.id) : null;
  const agent    = users.find(u=>u.id===opp.assigned_to);
  const sm       = OPP_STAGE_META[opp.stage]||OPP_STAGE_META["New"];

  useEffect(()=>{
    supabase.from("activities").select("*").eq("opportunity_id",opp.id).order("created_at",{ascending:false}).then(({data})=>setActivities(data||[]));
    supabase.from("sales_payments").select("*").eq("opportunity_id",opp.id).order("created_at").then(({data})=>setPayments(data||[]));
    supabase.from("sales_contracts").select("*").eq("opportunity_id",opp.id).limit(1).then(({data})=>setContract(data?.[0]||null));
  },[opp.id]);

  const GATED_STAGES = ["Offer Accepted","Reserved","SPA Signed","Closed Won","Closed Lost"];

  const moveStage = async(toStage) => {
    if(GATED_STAGES.includes(toStage)) {
      setStageGateForm({});
      setShowStageGate(toStage);
      return;
    }
    await commitStageMove(toStage, {});
  };

  const commitStageMove = async(toStage, extraData) => {
    const newStatus = toStage==="Closed Won"?"Won":toStage==="Closed Lost"?"Lost":"Active";
    const extra = {
      ...(toStage==="Closed Won"?{won_at:new Date().toISOString()}:{}),
      ...(toStage==="Closed Lost"?{lost_at:new Date().toISOString()}:{}),
      ...extraData,
    };
    const{error}=await supabase.from("opportunities").update({
      stage:toStage, status:newStatus,
      stage_updated_at:new Date().toISOString(),
      ...extra
    }).eq("id",opp.id);
    if(error){showToast(error.message,"error");return;}
    onUpdated({...opp,stage:toStage,status:newStatus,...extra});
    if(toStage==="Closed Won"&&opp.unit_id)
      await supabase.from("project_units").update({status:"Sold"}).eq("id",opp.unit_id);
    if(toStage==="Reserved"&&opp.unit_id)
      await supabase.from("project_units").update({status:"Reserved"}).eq("id",opp.unit_id);
    showToast(`Moved to ${toStage}`,"success");
    setShowStageGate(null);
  };

  const saveLog = async()=>{
    if(!(logForm.note||"").trim()&&!(logForm.next_steps||"").trim()){showToast("Please add discussion notes or next steps","error");return;}
    setSaving(true);
    const isScheduled = logForm.scheduled_at && new Date(logForm.scheduled_at) > new Date();
    const noteText = [
      logForm.note,
      logForm.next_steps?("\n\n✅ Next Steps: "+logForm.next_steps):"",
      logForm.scheduled_at?("\n📅 Scheduled: "+new Date(logForm.scheduled_at).toLocaleString("en-AE",{dateStyle:"medium",timeStyle:"short"})):"",
      logForm.duration_mins?("\n⏱ Duration: "+logForm.duration_mins+" mins"):"",
    ].filter(Boolean).join("");
    const{data,error}=await supabase.from("activities").insert({
      opportunity_id:opp.id, lead_id:lead.id,
      type:logForm.type, note:noteText,
      scheduled_at:logForm.scheduled_at||null,
      status:isScheduled?"upcoming":"completed",
      user_id:currentUser.id, user_name:currentUser.full_name,
      lead_name:lead.name, company_id:currentUser.company_id||null,
    }).select().single();
    if(!error){setActivities(p=>[data,...p]);showToast("Task logged","success");setShowLog(false);setLogForm({type:"Call",note:"",scheduled_at:"",next_steps:"",duration_mins:""});}
    setSaving(false);
  };

  const savePayment=async()=>{
    if(!payForm.amount){showToast("Amount required","error");return;}
    setSaving(true);
    try{
      const payload={
        opportunity_id:opp.id, lead_id:lead.id,
        ...payForm, amount:Number(payForm.amount),
        percentage:payForm.percentage?Number(payForm.percentage):null,
        company_id:currentUser.company_id||null,created_by:currentUser.id,
      };
      let data,error;
      if(editPayment){
        ({data,error}=await supabase.from("sales_payments").update(payload).eq("id",editPayment.id).select().single());
        setPayments(p=>p.map(x=>x.id===editPayment.id?data:x));
      }else{
        ({data,error}=await supabase.from("sales_payments").insert(payload).select().single());
        setPayments(p=>[...p,data]);
      }
      if(error)throw error;
      showToast("Payment saved","success");
      setShowPayment(false);setEditPayment(null);
    }catch(e){showToast(e.message,"error");}
    setSaving(false);
  };

  const printReceipt=(pay)=>{
    const html=`<!DOCTYPE html><html><head><meta charset="UTF-8">
    <style>body{font-family:Arial,sans-serif;max-width:420px;margin:40px auto}
    .hdr{background:#1E3A5F;color:#fff;padding:20px;border-radius:8px 8px 0 0;text-align:center}
    .logo{font-size:20px;font-weight:700;color:#C9A84C}.bdy{border:1px solid #E2E8F0;border-top:none;padding:20px;border-radius:0 0 8px 8px}
    .amt{font-size:30px;font-weight:700;color:#0F2540;text-align:center;padding:16px 0;border-bottom:2px solid #E2E8F0;margin-bottom:16px}
    .row{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #F0F2F5;font-size:13px}
    .stamp{border:3px solid #1A7F5A;color:#1A7F5A;padding:6px 16px;border-radius:6px;font-size:14px;font-weight:700;display:inline-block;margin:12px auto;transform:rotate(-5deg)}
    </style></head><body>
    <div class="hdr"><div class="logo">◆ PropCRM</div><div style="font-size:13px;opacity:.7">Payment Receipt</div></div>
    <div class="bdy">
      <div class="amt">AED ${Number(pay.amount).toLocaleString()}</div>
      ${[["Client",lead.name],["Opportunity",opp.title||unit?.unit_ref||"—"],["Milestone",pay.milestone],["Type",pay.payment_type],pay.cheque_number&&["Cheque No.",pay.cheque_number],pay.bank_name&&["Bank",pay.bank_name],["Status",pay.status],["Date",new Date().toLocaleDateString("en-AE",{day:"numeric",month:"long",year:"numeric"})]].filter(Boolean).map(([l,v])=>`<div class="row"><span style="color:#718096">${l}</span><span style="font-weight:600">${v}</span></div>`).join("")}
      ${pay.cheque_file_url?`<img src="${pay.cheque_file_url}" style="width:100%;margin-top:12px;border-radius:6px;border:1px solid #E2E8F0"/>`:""}
      <div style="text-align:center"><div class="stamp">${pay.status==="Cleared"?"✓ CLEARED":"✓ RECEIVED"}</div></div>
    </div></body></html>`;
    const w=window.open("","_blank","width=500,height=700");
    if(w){w.document.write(html);w.document.close();setTimeout(()=>w.print(),500);}
  };

  const totalPaid = payments.filter(p=>["Cleared","Received","Deposited"].includes(p.status)).reduce((s,p)=>s+(p.amount||0),0);
  const totalDue  = payments.reduce((s,p)=>s+(p.amount||0),0);

  return (
    <div className="fade-in" style={{display:"flex",flexDirection:"column",height:"100%"}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,flexWrap:"wrap"}}>
        <button onClick={onBack} style={{padding:"6px 14px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>← Back</button>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            <span style={{fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:700,color:"#0F2540"}}>{opp.title||`Opportunity — ${lead.name}`}</span>
            <span style={{padding:"3px 10px",borderRadius:20,background:sm.bg,color:sm.c,fontSize:11,fontWeight:700}}>{opp.stage}</span>
            {opp.status==="On Hold"&&<span style={{padding:"3px 10px",borderRadius:20,background:"#F7F9FC",color:"#718096",fontSize:11,fontWeight:600}}>On Hold</span>}
          </div>
          <div style={{fontSize:12,color:"#718096",marginTop:2}}>{lead.name} · {lead.phone||""} {unit?`· ${unit.unit_ref} — ${unit.sub_type}`:""}</div>
        </div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {canEdit&&["New","Contacted","Site Visit"].includes(opp.stage)&&unit&&(
            <button onClick={()=>{
              setEmailForm({to:lead.email||"",subject:`Property Proposal — ${lead.name}`,
                body:`Dear ${lead.name},\n\nPlease find your personalised property proposal.\n\nProperty: ${unit.unit_ref} — ${unit.sub_type}${proj?` (${proj.name})`:""}\n${sp?`Price: AED ${Number(sp.asking_price).toLocaleString()}\n`:""}\nKindly review and let us know your preferred next step.\n\nBest regards,\n${currentUser.full_name}`});
              setShowEmail(true);
            }} style={{padding:"6px 14px",borderRadius:8,border:"none",background:"#1A5FA8",color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>📤 Send Proposal</button>
          )}
          {canEdit&&<button onClick={()=>setShowLog(true)} style={{padding:"6px 14px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>+ Task</button>}
        </div>
      </div>

      {/* Summary strip */}
      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
        {[
          ["💰 Budget",    opp.budget?`AED ${Number(opp.budget).toLocaleString()}`:"—",    "#0F2540","#C9A84C"],
          ["🏠 Unit",      unit?`${unit.unit_ref} — ${unit.sub_type}`:"Not linked",         "#F7F9FC","#4A5568"],
          ["👤 Agent",     agent?.full_name||"Unassigned",                                  "#F7F9FC","#4A5568"],
          ["📊 Payments",  totalDue>0?`${totalPaid/totalDue*100|0}% collected`:"No payments","#F7F9FC","#4A5568"],
          opp.final_price&&["✅ Final",`AED ${Number(opp.final_price).toLocaleString()}`,"#E6F4EE","#1A7F5A"],
        ].filter(Boolean).map(([l,v,bg,col])=>(
          <div key={l} style={{background:bg,borderRadius:8,padding:"8px 14px",flex:1,minWidth:120}}>
            <div style={{fontSize:9,color:bg==="#0F2540"?"rgba(255,255,255,.5)":"#A0AEC0",textTransform:"uppercase",letterSpacing:".5px",fontWeight:600,marginBottom:3}}>{l}</div>
            <div style={{fontSize:13,fontWeight:700,color:col,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{v}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:4,marginBottom:14,borderBottom:"1px solid #E2E8F0"}}>
        {[
          {id:"details",  label:"Details",   locked:false},
          {id:"activities",label:`Tasks${activities.length>0?` (${activities.length})`:""}`,locked:false},
          {id:"payments", label:isDeveloper?`Payments${payments.length>0?` (${payments.length})`:""}`:`Commission${payments.length>0?` (${payments.length})`:""}`  , locked:!isWon, lockMsg:"Unlocks at Closed Won"},
          {id:"contract", label:`Contract${contract?" ✓":""}`,  locked:!isWon, lockMsg:"Unlocks at Closed Won"},
        ].map(({id,label,locked,lockMsg})=>(
          <button key={id} onClick={()=>{if(locked){showToast(`${lockMsg}`,"error");return;}setActiveTab(id);}}
            style={{padding:"8px 16px",borderRadius:"8px 8px 0 0",border:"none",borderBottom:activeTab===id?"2.5px solid #1E3A5F":"2.5px solid transparent",background:"transparent",fontSize:13,fontWeight:activeTab===id?700:400,color:locked?"#CBD5E0":activeTab===id?"#0F2540":"#718096",cursor:locked?"not-allowed":"pointer",display:"flex",alignItems:"center",gap:4}}>
            {locked&&"🔒 "}{label}
          </button>
        ))}
      </div>

      <div style={{flex:1,overflowY:"auto"}}>

        {/* ── DETAILS TAB ── */}
        {activeTab==="details"&&(
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            {/* Ownership Notice */}
            {!isOwner&&canEdit&&(
              <div style={{background:canAction?"#E6F4EE":"#FFFBEB",border:`1px solid ${canAction?"#A8D5BE":"#FDE68A"}`,borderRadius:10,padding:"10px 16px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                <div style={{flex:1}}>
                  <span style={{fontSize:12,fontWeight:600,color:canAction?"#1A7F5A":"#92400E"}}>
                    {canAction?"✓ You have taken ownership of this deal":"⚠ You are viewing this deal — assigned to "}<strong>{users?.find(u=>u.id===opp.assigned_to)?.full_name||"another agent"}</strong>
                  </span>
                  {!canAction&&<div style={{fontSize:11,color:"#92400E",marginTop:2}}>Stage actions are restricted to the assigned agent. Take ownership or reassign to make changes.</div>}
                </div>
                <div style={{display:"flex",gap:8}}>
                  {!canAction&&canReassign&&(
                    <button onClick={async()=>{
                      const confirm = window.confirm(`Take ownership of this deal?

This will be logged and the current agent (${users?.find(u=>u.id===opp.assigned_to)?.full_name||"unknown"}) will be notified.

You will become the assigned agent.`);
                      if(!confirm) return;
                      const{error}=await supabase.from("opportunities").update({assigned_to:currentUser.id,stage_updated_at:new Date().toISOString()}).eq("id",opp.id);
                      if(error){showToast(error.message,"error");return;}
                      setTookOwnership(true);
                      onUpdated({...opp,assigned_to:currentUser.id});
                      showToast("You have taken ownership of this deal","success");
                      // Log activity
                      await supabase.from("activities").insert({lead_id:opp.lead_id,company_id:currentUser.company_id||null,type:"Note",note:`Ownership transferred to ${currentUser.full_name}`,status:"completed",created_by:currentUser.id,opportunity_id:opp.id});
                    }}
                      style={{padding:"6px 14px",borderRadius:7,border:"none",background:"#0F2540",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                      Take Ownership
                    </button>
                  )}
                  {canReassign&&(
                    <button onClick={()=>{setReassignForm({assigned_to:"",reason:""});setShowReassign(true);}}
                      style={{padding:"6px 14px",borderRadius:7,border:"1.5px solid #E2E8F0",background:"#fff",color:"#0F2540",fontSize:11,fontWeight:600,cursor:"pointer"}}>
                      Reassign
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Workflow bar */}
            <div style={{background:"#fff",border:"1px solid #E8EDF4",borderRadius:12,padding:"16px 20px"}}>
              <div style={{fontSize:10,fontWeight:700,color:"#94A3B8",textTransform:"uppercase",letterSpacing:".6px",marginBottom:12}}>Deal Journey</div>
              
              {/* Stage pills */}
              <div style={{display:"flex",alignItems:"center",overflowX:"auto",gap:0,marginBottom:16,paddingBottom:4}}>
                {OPP_STAGES.filter(s=>s!=="Closed Lost").map((s,i,arr)=>{
                  const curIdx=OPP_STAGES.indexOf(opp.stage);
                  const thisIdx=OPP_STAGES.indexOf(s);
                  const isDone=curIdx>thisIdx;
                  const isCur=opp.stage===s;
                  const m=OPP_STAGE_META[s]||{c:"#718096",bg:"#F7F9FC"};
                  return (
                    <div key={s} style={{display:"flex",alignItems:"center",flexShrink:0}}>
                      <div onClick={()=>canAction&&moveStage(s)}
                        title={canAction?"Click to move to this stage":isOwner?"":"You are not the assigned agent — reassign first"}
                        style={{padding:"5px 14px",borderRadius:20,
                          background:isCur?m.c:isDone?"#E6F4EE":"#F7F9FC",
                          color:isCur?"#fff":isDone?"#1A7F5A":"#94A3B8",
                          border:`1.5px solid ${isCur?m.c:isDone?"#A8D5BE":"#E2E8F0"}`,
                          fontSize:11,fontWeight:isCur||isDone?700:400,
                          cursor:canEdit?"pointer":"default",whiteSpace:"nowrap",transition:"all .15s"}}>
                        {isDone?"✓ ":isCur?"▶ ":""}{s}
                      </div>
                      {i<arr.length-1&&(
                        <div style={{width:20,height:1,background:isDone?"#A8D5BE":"#E2E8F0",flexShrink:0,position:"relative"}}>
                          <div style={{position:"absolute",right:-4,top:-3,width:0,height:0,borderTop:"4px solid transparent",borderBottom:"4px solid transparent",borderLeft:`5px solid ${isDone?"#A8D5BE":"#E2E8F0"}`}}/>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Stage action buttons */}
              {canAction&&!isWon&&opp.stage!=="Closed Lost"&&(()=>{
                const m=OPP_STAGE_META[opp.stage]||{c:"#718096",bg:"#F7F9FC"};
                const stageIdx=OPP_STAGES.indexOf(opp.stage);
                const nextStageName=OPP_STAGES[stageIdx+1];
                const stageActionMap={
                  "New":           [{label:"📞 Log Call",type:"Call"},{label:"💬 WhatsApp",type:"WhatsApp"},{label:"📝 Add Note",type:"Note"}],
                  "Contacted":     [{label:"📅 Schedule Visit",type:"Site Visit"},{label:"📞 Follow Up",type:"Call"},{label:"📝 Add Note",type:"Note"}],
                  "Site Visit":    [{label:"📋 Log Outcome",type:"Note"},{label:"📄 Send Proposal",type:"Proposal"},{label:"📞 Follow Up",type:"Call"}],
                  "Proposal Sent": [{label:"📞 Follow Up",type:"Call"},{label:"💰 Negotiate",type:"Note"},{label:"📝 Add Note",type:"Note"}],
                  "Negotiation":   [{label:"📄 Send Offer",type:"Note"},{label:"✅ Get Approval",type:"Note"},{label:"📝 Add Note",type:"Note"}],
                  "Offer Accepted":[{label:"📋 Reservation Form",type:"Note"},{label:"💰 Collect Fee",type:"Note"},{label:"📝 Add Note",type:"Note"}],
                  "Reserved":      [{label:"✅ Confirm Reservation",type:"Note"},{label:"📄 Draft SPA",type:"Note"},{label:"📝 Add Note",type:"Note"}],
                  "SPA Signed":    [{label:"💰 Add Payment",type:"Note"},{label:"📋 Upload SPA",type:"Note"},{label:"📝 Add Note",type:"Note"}],
                };
                const actions=stageActionMap[opp.stage]||[];
                return(
                  <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",paddingTop:12,borderTop:"1px solid #F1F5F9"}}>
                    <span style={{fontSize:10,fontWeight:700,color:"#94A3B8",textTransform:"uppercase",letterSpacing:".5px",marginRight:4}}>Actions</span>
                    {actions.map((a,i)=>(
                      <button key={i} onClick={()=>setShowLog(true)}
                        style={{padding:"6px 12px",borderRadius:7,border:"1.5px solid #E2E8F0",background:"#fff",fontSize:11,fontWeight:600,cursor:"pointer",color:"#0F2540",transition:"all .12s"}}
                        onMouseOver={e=>{e.currentTarget.style.borderColor=m.c;e.currentTarget.style.color=m.c;e.currentTarget.style.background=m.bg;}}
                        onMouseOut={e=>{e.currentTarget.style.borderColor="#E2E8F0";e.currentTarget.style.color="#0F2540";e.currentTarget.style.background="#fff";}}>
                        {a.label}
                      </button>
                    ))}
                    <div style={{flex:1}}/>
                    {nextStageName&&nextStageName!=="Closed Won"&&(
                      <button onClick={()=>moveStage(nextStageName)}
                        style={{padding:"6px 16px",borderRadius:7,border:"none",background:m.c,color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
                        → {nextStageName}
                      </button>
                    )}
                    {(opp.stage==="Offer Accepted"||opp.stage==="Negotiation"||opp.stage==="Reserved")&&(
                      <button onClick={()=>moveStage("Reserved")}
                        style={{padding:"6px 14px",borderRadius:7,border:"none",background:"#7C3AED",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                        🔒 Reserve Unit
                      </button>
                    )}
                    {opp.stage==="SPA Signed"&&(
                      <button onClick={()=>moveStage("Closed Won")}
                        style={{padding:"6px 14px",borderRadius:7,border:"none",background:"#1A7F5A",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                        ✓ Close Won
                      </button>
                    )}
                    <button onClick={()=>moveStage("Closed Lost")}
                      style={{padding:"6px 12px",borderRadius:7,border:"1.5px solid #FECACA",background:"#FEF2F2",color:"#B83232",fontSize:11,fontWeight:600,cursor:"pointer"}}>
                      ✗ Lost
                    </button>
                  </div>
                );
              })()}

              {isWon&&<div style={{padding:"8px 12px",background:"#E6F4EE",borderRadius:8,fontSize:12,color:"#1A7F5A",fontWeight:600,border:"1px solid #A8D5BE"}}>🎉 Deal Won — Payments and Contract are unlocked</div>}
            </div>

            {/* Unit details */}
            <div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:12,padding:"16px"}}>
              <div style={{fontSize:11,fontWeight:700,color:"#A0AEC0",textTransform:"uppercase",letterSpacing:".6px",marginBottom:12}}>Property</div>
              {unit?(
                <div style={{display:"flex",gap:12,alignItems:"flex-start",flexWrap:"wrap"}}>
                  <div style={{flex:1,minWidth:200}}>
                    <div style={{fontWeight:700,fontSize:15,color:"#0F2540",marginBottom:4}}>{unit.unit_ref} — {unit.sub_type}</div>
                    <div style={{fontSize:12,color:"#718096",marginBottom:6}}>{proj?.name||"—"} · Floor {unit.floor_number||"—"} · {unit.view||"—"} · {unit.size_sqft?`${Number(unit.size_sqft).toLocaleString()} sqft`:""}</div>
                    {sp&&<div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,color:"#1A5FA8"}}>AED {Number(sp.asking_price).toLocaleString()}</div>}
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,minWidth:200}}>
                    {[["Beds",unit.bedrooms===0?"Studio":unit.bedrooms||"—"],["Baths",unit.bathrooms||"—"],["Sqft",unit.size_sqft?Number(unit.size_sqft).toLocaleString():"—"],["Status",unit.status]].map(([l,v])=>(
                      <div key={l} style={{background:"#FAFBFC",borderRadius:8,padding:"8px 10px"}}>
                        <div style={{fontSize:9,color:"#A0AEC0",textTransform:"uppercase",letterSpacing:".5px",marginBottom:2}}>{l}</div>
                        <div style={{fontSize:12,fontWeight:600,color:"#0F2540"}}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ):(
                <div style={{color:"#A0AEC0",fontSize:12,textAlign:"center",padding:"1rem"}}>No unit linked to this opportunity yet</div>
              )}
            </div>

            {/* Financials */}
            <div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:12,padding:"16px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <div style={{fontSize:11,fontWeight:700,color:"#A0AEC0",textTransform:"uppercase",letterSpacing:".6px"}}>Financials</div>
                {canAction&&can(currentUser.role,"request_discount")&&!isWon&&(
                  <button onClick={()=>{setDiscReqForm({type:"sale_price",discount_pct:"",reason:"",discount_source:"Developer",developer_auth_ref:""});setShowDiscReq(true);}}
                    style={{padding:"5px 12px",borderRadius:7,border:"1.5px solid #C9A84C",background:"#FDF3DC",color:"#8A6200",fontSize:11,fontWeight:600,cursor:"pointer"}}>
                    💰 Request Discount
                  </button>
                )}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10}}>
                {[["Budget",opp.budget],["Offer Price",opp.offer_price],["Final Price",opp.final_price],["Discount %",opp.discount_pct?opp.discount_pct+"%":null]].filter(([,v])=>v).map(([l,v])=>(
                  <div key={l} style={{background:"#FAFBFC",borderRadius:8,padding:"10px 12px"}}>
                    <div style={{fontSize:9,color:"#A0AEC0",textTransform:"uppercase",letterSpacing:".5px",marginBottom:2}}>{l}</div>
                    <div style={{fontSize:13,fontWeight:700,color:"#0F2540"}}>{typeof v==="number"?`AED ${Number(v).toLocaleString()}`:v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment Plan Card */}
            {unit&&sp&&(
              <div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:12,padding:"16px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                  <div style={{fontSize:11,fontWeight:700,color:"#A0AEC0",textTransform:"uppercase",letterSpacing:".6px"}}>
                    {isOffPlan?"🏗️ Off-Plan Payment Plan":isResale?"🔑 Ready / Resale":"🏢 Commercial"} 
                  </div>
                  <span style={{fontSize:11,color:"#718096",background:"#F7F9FC",padding:"3px 10px",borderRadius:10}}>
                    {opp.property_category||"Off-Plan"}
                  </span>
                </div>
                {/* Off-Plan breakdown */}
                {(isOffPlan||(!opp.property_category))&&(
                  <>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:8,marginBottom:12}}>
                      {[
                        ["Asking Price",sp.asking_price?`AED ${Number(sp.asking_price).toLocaleString()}`:"—"],
                        ["Booking",sp.booking_pct?sp.booking_pct+"%":"10%"],
                        ["During Construction",sp.during_construction_pct?sp.during_construction_pct+"%":"—"],
                        ["On Handover",sp.on_handover_pct?sp.on_handover_pct+"%":"—"],
                        ["Post Handover",sp.post_handover_pct>0?sp.post_handover_pct+"%":"—"],
                        ["DLD Fee",sp.dld_fee_pct?sp.dld_fee_pct+"%":"4%"],
                        ["Agency Fee",sp.agency_fee_pct?sp.agency_fee_pct+"%":"2%"],
                        ["OQOOD Fee","AED 4,020"],
                      ].filter(([,v])=>v&&v!=="—").map(([l,v])=>(
                        <div key={l} style={{background:"#F7F9FC",borderRadius:8,padding:"8px 10px"}}>
                          <div style={{fontSize:9,color:"#A0AEC0",textTransform:"uppercase",letterSpacing:".5px",marginBottom:2}}>{l}</div>
                          <div style={{fontSize:13,fontWeight:700,color:"#0F2540"}}>{v}</div>
                        </div>
                      ))}
                    </div>
                    {sp.asking_price&&(
                      <div style={{background:"#fff",borderRadius:10,padding:"12px 14px"}}>
                        <div style={{fontSize:10,color:"rgba(255,255,255,.5)",textTransform:"uppercase",letterSpacing:".5px",marginBottom:8}}>Client Upfront Costs</div>
                        <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
                          {[
                            ["Booking Deposit",`AED ${Math.round(sp.asking_price*(sp.booking_pct||10)/100).toLocaleString()}`],
                            ["DLD Fee (4%)",`AED ${Math.round(sp.asking_price*(sp.dld_fee_pct||4)/100).toLocaleString()}`],
                            ["Agency Fee",`AED ${Math.round(sp.asking_price*(sp.agency_fee_pct||2)/100).toLocaleString()}`],
                            ["OQOOD","AED 4,020"],
                            ["Total Upfront",`AED ${(Math.round(sp.asking_price*((sp.booking_pct||10)+(sp.dld_fee_pct||4)+(sp.agency_fee_pct||2))/100)+4020).toLocaleString()}`],
                          ].map(([l,v])=>(
                            <div key={l}>
                              <div style={{fontSize:9,color:"rgba(255,255,255,.4)",textTransform:"uppercase",letterSpacing:".5px"}}>{l}</div>
                              <div style={{fontSize:13,fontWeight:700,color:"#C9A84C"}}>{v}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
                {/* Ready/Resale breakdown */}
                {isResale&&(
                  <>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:8,marginBottom:12}}>
                      {[
                        ["Sale Price",sp.asking_price?`AED ${Number(sp.asking_price).toLocaleString()}`:"—"],
                        ["DLD Fee","4%"],
                        ["Agency Fee",sp.agency_fee_pct?sp.agency_fee_pct+"%":"2%"],
                        ["NOC Fee","AED 500–5,000"],
                        ["Trustee Fee","AED 4,200"],
                        ["Mortgage Reg.","0.25% (if financed)"],
                      ].filter(([,v])=>v&&v!=="—").map(([l,v])=>(
                        <div key={l} style={{background:"#F7F9FC",borderRadius:8,padding:"8px 10px"}}>
                          <div style={{fontSize:9,color:"#A0AEC0",textTransform:"uppercase",letterSpacing:".5px",marginBottom:2}}>{l}</div>
                          <div style={{fontSize:13,fontWeight:700,color:"#0F2540"}}>{v}</div>
                        </div>
                      ))}
                    </div>
                    {sp.asking_price&&(
                      <div style={{background:"#fff",borderRadius:10,padding:"12px 14px"}}>
                        <div style={{fontSize:10,color:"rgba(255,255,255,.5)",textTransform:"uppercase",letterSpacing:".5px",marginBottom:8}}>Client Transfer Costs</div>
                        <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
                          {[
                            ["Sale Price",`AED ${Number(sp.asking_price).toLocaleString()}`],
                            ["DLD Fee (4%)",`AED ${Math.round(sp.asking_price*0.04).toLocaleString()}`],
                            ["Agency Fee (2%)",`AED ${Math.round(sp.asking_price*(sp.agency_fee_pct||2)/100).toLocaleString()}`],
                            ["Trustee + NOC","≈ AED 6,000"],
                            ["Total Cost",`AED ${(Math.round(sp.asking_price*1.06)+6000).toLocaleString()}`],
                          ].map(([l,v])=>(
                            <div key={l}>
                              <div style={{fontSize:9,color:"rgba(255,255,255,.4)",textTransform:"uppercase",letterSpacing:".5px"}}>{l}</div>
                              <div style={{fontSize:13,fontWeight:700,color:"#C9A84C"}}>{v}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
                {/* Commercial */}
                {isCommercial&&(
                  <div style={{fontSize:12,color:"#718096",padding:"8px 0"}}>
                    Commercial transactions follow custom terms. Add notes in the opportunity and track payments in the Payments tab once closed.
                  </div>
                )}
              </div>
            )}

            {/* Notes */}
            {opp.notes&&(
              <div style={{background:"#F7F9FC",borderRadius:12,padding:"14px 16px",fontSize:12,color:"#4A5568",lineHeight:1.7}}>
                <div style={{fontSize:10,fontWeight:700,color:"#A0AEC0",textTransform:"uppercase",letterSpacing:".6px",marginBottom:6}}>Notes</div>
                {opp.notes}
              </div>
            )}
          </div>
        )}

        {/* ── ACTIVITIES TAB ── */}
        {activeTab==="activities"&&(
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <button onClick={()=>setShowLog(true)} style={{alignSelf:"flex-end",padding:"7px 16px",borderRadius:8,border:"none",background:"#0F2540",color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>+ Log Activity</button>
            {activities.length===0&&<div style={{textAlign:"center",padding:"2.5rem",color:"#A0AEC0"}}>No tasks yet — log a call, meeting, site visit or note</div>}
            {activities.length>0&&<ActivitiesList activities={activities} setActivities={setActivities} opp={opp} canEdit={canEdit} showToast={showToast}/>}
          </div>
        )}

        {/* ── PAYMENTS TAB ── */}
        {activeTab==="payments"&&(
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {!isWon?(
              <div style={{textAlign:"center",padding:"3rem",color:"#A0AEC0"}}>
                <div style={{fontSize:40,marginBottom:10}}>🔒</div>
                <div style={{fontSize:14,fontWeight:600,color:"#0F2540",marginBottom:6}}>Locked until Closed Won</div>
                <div style={{fontSize:12}}>{isDeveloper?"Track developer payment collection here":"Track your commission once deal is closed"}</div>
              </div>
            ):(
              <>
                {/* Progress bar */}
                {totalDue>0&&(
                  <div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:10,padding:"14px 16px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                      <span style={{fontSize:12,fontWeight:600,color:"#0F2540"}}>AED {totalPaid.toLocaleString()} collected</span>
                      <span style={{fontSize:12,color:"#718096"}}>of AED {totalDue.toLocaleString()}</span>
                    </div>
                    <div style={{background:"#F7F9FC",borderRadius:6,height:10,overflow:"hidden"}}>
                      <div style={{width:`${totalDue>0?totalPaid/totalDue*100:0}%`,height:"100%",background:"#1A7F5A",borderRadius:6,transition:"width .4s"}}/>
                    </div>
                  </div>
                )}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontSize:13,fontWeight:600,color:"#0F2540"}}>Payment Schedule ({payments.length})</span>
                  <button onClick={()=>{setPayForm({milestone:"Booking Deposit",amount:"",percentage:"",due_date:"",payment_type:"Cheque",cheque_number:"",cheque_date:"",bank_name:"",status:"Pending",notes:"",cheque_file_url:""});setEditPayment(null);setShowPayment(true);}}
                    style={{padding:"6px 14px",borderRadius:8,border:"none",background:"#0F2540",color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>+ Add Payment</button>
                </div>
                {payments.map(pay=>{
                  const pm=PAYMENT_STATUS_META[pay.status]||{c:"#718096",bg:"#F7F9FC"};
                  return (
                    <div key={pay.id} style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:10,padding:"12px 14px"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8}}>
                        <div>
                          <div style={{fontWeight:700,fontSize:14,color:"#0F2540",marginBottom:2}}>AED {Number(pay.amount).toLocaleString()}</div>
                          <div style={{fontSize:12,color:"#718096"}}>{pay.milestone}{pay.percentage?` · ${pay.percentage}%`:""}</div>
                          {pay.cheque_number&&<div style={{fontSize:11,color:"#A0AEC0",marginTop:2}}>Cheque #{pay.cheque_number}{pay.bank_name?` · ${pay.bank_name}`:""}</div>}
                          {pay.due_date&&<div style={{fontSize:11,color:"#A0AEC0"}}>Due: {fmtDate(pay.due_date)}</div>}
                        </div>
                        <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                          <span style={{fontSize:11,fontWeight:600,padding:"3px 9px",borderRadius:20,background:pm.bg,color:pm.c}}>{pay.status}</span>
                          <select value={pay.status} onChange={async e=>{
                            await supabase.from("sales_payments").update({status:e.target.value}).eq("id",pay.id);
                            setPayments(p=>p.map(x=>x.id===pay.id?{...x,status:e.target.value}:x));
                          }} style={{fontSize:11,padding:"3px 6px",borderRadius:5,border:"1px solid #E2E8F0"}}>
                            {Object.keys(PAYMENT_STATUS_META).map(s=><option key={s}>{s}</option>)}
                          </select>
                          <button onClick={()=>{setPayForm({...pay});setEditPayment(pay);setShowPayment(true);}} style={{fontSize:11,padding:"3px 8px",borderRadius:5,border:"1px solid #E2E8F0",background:"#fff",cursor:"pointer"}}>✏</button>
                          <button onClick={()=>printReceipt(pay)} style={{fontSize:11,padding:"3px 8px",borderRadius:5,border:"none",background:"#1A5FA8",color:"#fff",cursor:"pointer"}}>🖨</button>
                        </div>
                      </div>
                      {pay.cheque_file_url&&<a href={pay.cheque_file_url} target="_blank" rel="noreferrer" style={{fontSize:11,color:"#1A5FA8",marginTop:6,display:"inline-block"}}>📎 View cheque</a>}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* ── CONTRACT TAB ── */}
        {activeTab==="contract"&&(
          <div>
            {!isWon?(
              <div style={{textAlign:"center",padding:"3rem",color:"#A0AEC0"}}>
                <div style={{fontSize:40,marginBottom:10}}>🔒</div>
                <div style={{fontSize:14,fontWeight:600,color:"#0F2540",marginBottom:6}}>Locked until Closed Won</div>
              </div>
            ):contract?(
              <div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:12,padding:"16px"}}>
                <div style={{fontSize:14,fontWeight:700,color:"#0F2540",marginBottom:10}}>📄 Sales Contract</div>
                <div style={{fontSize:12,color:"#718096"}}>Contract #{contract.contract_number||"—"} · SPA signed {fmtDate(contract.spa_date)}</div>
              </div>
            ):(
              <div style={{textAlign:"center",padding:"2rem",color:"#A0AEC0",fontSize:12}}>No contract yet — create one after confirming payment plan</div>
            )}
          </div>
        )}
      </div>

      {/* Log Activity Modal */}
      {showLog&&(
        <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:"1rem"}}>
          <div style={{background:"#fff",borderRadius:16,width:500,maxWidth:"100%",maxHeight:"92vh",overflow:"auto",boxShadow:"0 20px 60px rgba(11,31,58,.35)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"1rem 1.5rem",borderBottom:"1px solid #E8EDF4",background:"#fff"}}>
              <span style={{fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:700,color:"#fff"}}>Log Task</span>
              <button onClick={()=>setShowLog(false)} style={{background:"none",border:"none",fontSize:20,color:"#C9A84C",cursor:"pointer"}}>×</button>
            </div>
            <div style={{padding:"1.25rem 1.5rem"}}>
              <div style={{marginBottom:14}}>
                <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:".5px"}}>Activity Type</label>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {[["Call","📞"],["Email","✉️"],["Meeting","🤝"],["Visit","🏠"],["WhatsApp","💬"],["Note","📝"]].map(([t,icon])=>(
                    <button key={t} onClick={()=>setLogForm(f=>({...f,type:t}))}
                      style={{padding:"6px 14px",borderRadius:20,border:`1.5px solid ${logForm.type===t?"#0F2540":"#E2E8F0"}`,background:logForm.type===t?"#0F2540":"#fff",color:logForm.type===t?"#fff":"#4A5568",fontSize:12,cursor:"pointer",fontWeight:logForm.type===t?600:400,display:"flex",alignItems:"center",gap:4}}>
                      <span>{icon}</span>{t}
                    </button>
                  ))}
                </div>
              </div>
              {["Call","Meeting","Visit"].includes(logForm.type)&&(
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
                  <div>
                    <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:".5px"}}>📅 Date & Time</label>
                    <input type="datetime-local" value={logForm.scheduled_at} onChange={e=>setLogForm(f=>({...f,scheduled_at:e.target.value}))} style={{width:"100%",padding:"8px 10px",border:"1.5px solid #E2E8F0",borderRadius:8,fontSize:13,outline:"none",boxSizing:"border-box"}}/>
                  </div>
                  <div>
                    <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:".5px"}}>⏱ Duration</label>
                    <select value={logForm.duration_mins} onChange={e=>setLogForm(f=>({...f,duration_mins:e.target.value}))} style={{width:"100%",padding:"8px 10px",border:"1.5px solid #E2E8F0",borderRadius:8,fontSize:13,outline:"none",boxSizing:"border-box"}}>
                      <option value="">Select…</option>
                      {["15","30","45","60","90","120"].map(m=><option key={m} value={m}>{m} mins</option>)}
                    </select>
                  </div>
                </div>
              )}
              <div style={{marginBottom:12}}>
                <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:".5px"}}>💬 Discussion / Key Details</label>
                <textarea value={logForm.note} onChange={e=>setLogForm(f=>({...f,note:e.target.value}))} rows={3} placeholder="What was discussed? Key points, client feedback, objections…" style={{width:"100%",padding:"8px 10px",border:"1.5px solid #E2E8F0",borderRadius:8,fontSize:13,resize:"vertical",outline:"none",boxSizing:"border-box"}}/>
              </div>
              <div style={{marginBottom:12}}>
                <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:".5px"}}>✅ Next Steps</label>
                <textarea value={logForm.next_steps} onChange={e=>setLogForm(f=>({...f,next_steps:e.target.value}))} rows={2} placeholder="Follow-up action, who's responsible, by when?" style={{width:"100%",padding:"8px 10px",border:"1.5px solid #E2E8F0",borderRadius:8,fontSize:13,resize:"vertical",outline:"none",boxSizing:"border-box"}}/>
              </div>
              <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
                <button onClick={()=>setShowLog(false)} style={{padding:"8px 18px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancel</button>
                <button onClick={saveLog} disabled={saving} style={{padding:"8px 20px",borderRadius:8,border:"none",background:"#0F2540",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>{saving?"Saving…":"Save"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reassign Modal */}
      {showReassign&&(
        <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1200,padding:"1rem"}}>
          <div style={{background:"#fff",borderRadius:16,width:460,maxWidth:"100%",boxShadow:"0 20px 60px rgba(11,31,58,.25)"}}>
            <div style={{padding:"1.25rem 1.5rem",borderBottom:"1px solid #E8EDF4",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontSize:15,fontWeight:700,color:"#0F2540",letterSpacing:"-.3px"}}>🔄 Reassign Opportunity</div>
                <div style={{fontSize:12,color:"#94A3B8",marginTop:2}}>This action will be logged in the activity trail</div>
              </div>
              <button onClick={()=>setShowReassign(false)} style={{background:"none",border:"none",fontSize:22,color:"#94A3B8",cursor:"pointer"}}>×</button>
            </div>
            <div style={{padding:"1.25rem 1.5rem",display:"flex",flexDirection:"column",gap:14}}>
              <div>
                <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Assign To *</label>
                <select value={reassignForm.assigned_to} onChange={e=>setReassignForm(f=>({...f,assigned_to:e.target.value}))}>
                  <option value="">Select agent…</option>
                  {users?.filter(u=>u.is_active&&u.id!==opp.assigned_to).map(u=>(
                    <option key={u.id} value={u.id}>{u.full_name} — {u.role?.replace("_"," ")}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Reason for Reassignment *</label>
                <textarea rows={3} placeholder="Why is this deal being reassigned? This will be logged for audit purposes." value={reassignForm.reason} onChange={e=>setReassignForm(f=>({...f,reason:e.target.value}))}/>
              </div>
              <div style={{display:"flex",gap:10,justifyContent:"flex-end",paddingTop:8,borderTop:"1px solid #F1F5F9"}}>
                <button onClick={()=>setShowReassign(false)} style={{padding:"8px 18px",borderRadius:8,border:"1.5px solid #E2E8F0",background:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",color:"#475569"}}>Cancel</button>
                <button onClick={async()=>{
                  if(!reassignForm.assigned_to){showToast("Please select an agent","error");return;}
                  if(!reassignForm.reason?.trim()){showToast("Please provide a reason","error");return;}
                  const prevAgent = users?.find(u=>u.id===opp.assigned_to)?.full_name||"unknown";
                  const newAgent = users?.find(u=>u.id===reassignForm.assigned_to)?.full_name||"unknown";
                  const{error}=await supabase.from("opportunities").update({assigned_to:reassignForm.assigned_to}).eq("id",opp.id);
                  if(error){showToast(error.message,"error");return;}
                  // Log the reassignment
                  await supabase.from("activities").insert({
                    lead_id:opp.lead_id, company_id:currentUser.company_id||null,
                    type:"Note", status:"completed",
                    note:`Deal reassigned from ${prevAgent} to ${newAgent}. Reason: ${reassignForm.reason}`,
                    created_by:currentUser.id, opportunity_id:opp.id,
                  });
                  onUpdated({...opp,assigned_to:reassignForm.assigned_to});
                  showToast(`Deal reassigned to ${newAgent}`,"success");
                  setShowReassign(false);
                  if(reassignForm.assigned_to===currentUser.id) setTookOwnership(true);
                }}
                  style={{padding:"8px 20px",borderRadius:8,border:"none",background:"#0F2540",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>
                  Confirm Reassignment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stage Gate Modal */}
      {showStageGate&&(
        <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1200,padding:"1rem"}}>
          <div style={{background:"#fff",borderRadius:16,width:500,maxWidth:"100%",maxHeight:"90vh",overflow:"auto",boxShadow:"0 20px 60px rgba(11,31,58,.25)"}}>
            <div style={{padding:"1.25rem 1.5rem",borderBottom:"1px solid #E8EDF4",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontSize:15,fontWeight:700,color:"#0F2540",letterSpacing:"-.3px"}}>
                  {showStageGate==="Offer Accepted"&&"✅ Record Offer Accepted"}
                  {showStageGate==="Reserved"&&"🔒 Record Reservation"}
                  {showStageGate==="SPA Signed"&&"📄 Record SPA Signing"}
                  {showStageGate==="Closed Won"&&"🏆 Close as Won"}
                  {showStageGate==="Closed Lost"&&"❌ Close as Lost"}
                </div>
                <div style={{fontSize:12,color:"#94A3B8",marginTop:2}}>{opp.title||lead?.name}</div>
              </div>
              <button onClick={()=>setShowStageGate(null)} style={{background:"none",border:"none",fontSize:22,color:"#94A3B8",cursor:"pointer"}}>×</button>
            </div>

            <div style={{padding:"1.25rem 1.5rem",display:"flex",flexDirection:"column",gap:14}}>

              {/* OFFER ACCEPTED fields */}
              {showStageGate==="Offer Accepted"&&(<>
                {/* Pricing breakdown - read only */}
                <div style={{background:"#F7F9FC",border:"1px solid #E8EDF4",borderRadius:10,padding:"14px 16px"}}>
                  <div style={{fontSize:11,fontWeight:700,color:"#94A3B8",textTransform:"uppercase",letterSpacing:".5px",marginBottom:10}}>Agreed Pricing</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
                    <div>
                      <div style={{fontSize:10,color:"#94A3B8",marginBottom:3}}>Unit Asking Price</div>
                      <div style={{fontSize:14,fontWeight:700,color:"#0F2540"}}>AED {opp.budget?Number(opp.budget).toLocaleString():"—"}</div>
                    </div>
                    <div>
                      <div style={{fontSize:10,color:"#94A3B8",marginBottom:3}}>Approved Discount</div>
                      <div style={{fontSize:14,fontWeight:700,color:"#B83232"}}>{opp.discount_pct?`${opp.discount_pct}%`:"None"}</div>
                    </div>
                    <div>
                      <div style={{fontSize:10,color:"#94A3B8",marginBottom:3}}>Net Offer Price</div>
                      <div style={{fontSize:14,fontWeight:700,color:"#1A7F5A"}}>
                        AED {opp.budget?Number(opp.discount_pct?opp.budget*(1-opp.discount_pct/100):opp.budget).toLocaleString():"—"}
                      </div>
                    </div>
                  </div>
                  {opp.discount_pct&&<div style={{marginTop:8,fontSize:11,color:"#64748B"}}>Discount source: <strong>{opp.discount_source||"Not specified"}</strong></div>}
                </div>
                <div style={{background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#92400E"}}>
                  ℹ Price is based on approved inventory pricing. To request a discount, use the <strong>💰 Request Discount</strong> button in the Financials section first.
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Offer Valid Until</label>
                  <input type="date" value={stageGateForm.offer_valid_until||""} onChange={e=>setStageGateForm(f=>({...f,offer_valid_until:e.target.value}))}/>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Notes</label>
                  <textarea rows={2} placeholder="Any conditions or notes on the offer…" value={stageGateForm.notes||""} onChange={e=>setStageGateForm(f=>({...f,notes:e.target.value}))}/>
                </div>
              </>)}

              {/* RESERVED fields */}
              {showStageGate==="Reserved"&&(<>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                  <div>
                    <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Reservation Fee (AED) *</label>
                    <input type="number" placeholder="e.g. 10000" value={stageGateForm.reservation_fee||""} onChange={e=>setStageGateForm(f=>({...f,reservation_fee:e.target.value}))}/>
                  </div>
                  <div>
                    <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Payment Method *</label>
                    <select value={stageGateForm.payment_method||"Cheque"} onChange={e=>setStageGateForm(f=>({...f,payment_method:e.target.value}))}>
                      {["Cheque","Bank Transfer","Cash","Credit Card"].map(m=><option key={m}>{m}</option>)}
                    </select>
                  </div>
                  {(stageGateForm.payment_method==="Cheque"||!stageGateForm.payment_method)&&(
                    <div>
                      <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Cheque Number</label>
                      <input placeholder="e.g. 001234" value={stageGateForm.cheque_number||""} onChange={e=>setStageGateForm(f=>({...f,cheque_number:e.target.value}))}/>
                    </div>
                  )}
                  <div>
                    <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Reservation Date</label>
                    <input type="date" value={stageGateForm.reservation_date||new Date().toISOString().slice(0,10)} onChange={e=>setStageGateForm(f=>({...f,reservation_date:e.target.value}))}/>
                  </div>
                  <div>
                    <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Expires (5 working days)</label>
                    <input type="date" value={stageGateForm.expires_date||addWorkingDays(new Date(),5).toISOString().slice(0,10)} onChange={e=>setStageGateForm(f=>({...f,expires_date:e.target.value}))}/>
                  </div>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Notes</label>
                  <textarea rows={2} placeholder="Any conditions on the reservation…" value={stageGateForm.notes||""} onChange={e=>setStageGateForm(f=>({...f,notes:e.target.value}))}/>
                </div>
              </>)}

              {/* SPA SIGNED fields */}
              {showStageGate==="SPA Signed"&&(<>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                  <div>
                    <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Final Agreed Price (AED) *</label>
                    <input type="number" placeholder="e.g. 2450000" value={stageGateForm.final_price||opp.offer_price||""} onChange={e=>setStageGateForm(f=>({...f,final_price:e.target.value}))}/>
                  </div>
                  <div>
                    <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>SPA Signing Date *</label>
                    <input type="date" value={stageGateForm.spa_date||new Date().toISOString().slice(0,10)} onChange={e=>setStageGateForm(f=>({...f,spa_date:e.target.value}))}/>
                  </div>
                  <div>
                    <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Down Payment (AED)</label>
                    <input type="number" placeholder="e.g. 245000" value={stageGateForm.down_payment||""} onChange={e=>setStageGateForm(f=>({...f,down_payment:e.target.value}))}/>
                  </div>
                  <div>
                    <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Down Payment Method</label>
                    <select value={stageGateForm.down_payment_method||"Cheque"} onChange={e=>setStageGateForm(f=>({...f,down_payment_method:e.target.value}))}>
                      {["Cheque","Bank Transfer","Cash","Credit Card"].map(m=><option key={m}>{m}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Notes</label>
                  <textarea rows={2} placeholder="Any conditions or notes on the SPA…" value={stageGateForm.notes||""} onChange={e=>setStageGateForm(f=>({...f,notes:e.target.value}))}/>
                </div>
              </>)}

              {/* CLOSED WON fields */}
              {showStageGate==="Closed Won"&&(<>
                <div style={{background:"#E6F4EE",border:"1px solid #A8D5BE",borderRadius:8,padding:"10px 14px",fontSize:12,color:"#1A7F5A",fontWeight:500}}>
                  🎉 Congratulations! Confirm the final details to close this deal.
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                  <div>
                    <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Final Sale Price (AED) *</label>
                    <input type="number" value={stageGateForm.final_price||opp.final_price||opp.offer_price||""} onChange={e=>setStageGateForm(f=>({...f,final_price:e.target.value}))}/>
                  </div>
                  <div>
                    <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Expected Handover Date</label>
                    <input type="date" value={stageGateForm.handover_date||""} onChange={e=>setStageGateForm(f=>({...f,handover_date:e.target.value}))}/>
                  </div>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Notes</label>
                  <textarea rows={2} placeholder="Any final notes…" value={stageGateForm.notes||""} onChange={e=>setStageGateForm(f=>({...f,notes:e.target.value}))}/>
                </div>
              </>)}

              {/* CLOSED LOST fields */}
              {showStageGate==="Closed Lost"&&(<>
                <div style={{background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:8,padding:"10px 14px",fontSize:12,color:"#B83232",fontWeight:500}}>
                  Please record why this deal was lost — this helps improve future performance.
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Lost Reason *</label>
                  <select value={stageGateForm.lost_reason||""} onChange={e=>setStageGateForm(f=>({...f,lost_reason:e.target.value}))}>
                    <option value="">Select reason…</option>
                    {["Price too high","Bought elsewhere","No longer interested","Budget constraints","Project not suitable","No response","Other"].map(r=><option key={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Additional Notes</label>
                  <textarea rows={3} placeholder="Any additional context on why the deal was lost…" value={stageGateForm.notes||""} onChange={e=>setStageGateForm(f=>({...f,notes:e.target.value}))}/>
                </div>
              </>)}

              {/* Action buttons */}
              <div style={{display:"flex",gap:10,justifyContent:"flex-end",paddingTop:8,borderTop:"1px solid #F1F5F9"}}>
                <button onClick={()=>setShowStageGate(null)}
                  style={{padding:"8px 18px",borderRadius:8,border:"1.5px solid #E2E8F0",background:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",color:"#475569"}}>
                  Cancel
                </button>
                <button onClick={async()=>{
                  // Validation
                  // Offer Accepted - no required fields, price comes from inventory
                  if(showStageGate==="Reserved"&&!stageGateForm.reservation_fee){showToast("Reservation fee is required","error");return;}
                  if(showStageGate==="SPA Signed"&&!stageGateForm.final_price){showToast("Final price is required","error");return;}
                  if(showStageGate==="Closed Won"&&!stageGateForm.final_price){showToast("Final sale price is required","error");return;}
                  if(showStageGate==="Closed Lost"&&!stageGateForm.lost_reason){showToast("Please select a lost reason","error");return;}
                  // Build extra data for DB
                  const extraData = {
                    ...(opp.discount_pct?{offer_price:Number(opp.budget*(1-opp.discount_pct/100))}:{offer_price:opp.budget||null}),
                    ...(stageGateForm.final_price?{final_price:Number(stageGateForm.final_price)}:{}),
                    ...(stageGateForm.lost_reason?{lost_reason:stageGateForm.lost_reason}:{}),
                    ...(stageGateForm.notes?{notes:stageGateForm.notes}:{}),
                  };
                  await commitStageMove(showStageGate, extraData);
                }}
                  style={{padding:"8px 20px",borderRadius:8,border:"none",
                    background:showStageGate==="Closed Lost"?"#B83232":showStageGate==="Closed Won"?"#1A7F5A":"#0F2540",
                    color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>
                  {showStageGate==="Closed Lost"?"✗ Confirm Lost":showStageGate==="Closed Won"?"🏆 Close Won":showStageGate==="Reserved"?"🔒 Confirm Reservation":showStageGate==="SPA Signed"?"📄 Confirm SPA Signed":"✅ Confirm"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Discount Request Modal */}
      {showDiscReq&&(
        <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1200,padding:"1rem"}}>
          <div style={{background:"#fff",borderRadius:16,width:520,maxWidth:"100%",maxHeight:"90vh",overflow:"auto",boxShadow:"0 20px 60px rgba(11,31,58,.25)"}}>
            <div style={{padding:"1.25rem 1.5rem",borderBottom:"1px solid #E8EDF4",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontSize:15,fontWeight:700,color:"#0F2540",letterSpacing:"-.3px"}}>💰 Request Discount</div>
                <div style={{fontSize:12,color:"#94A3B8",marginTop:2}}>{opp.title||lead?.name} — requires manager approval</div>
              </div>
              <button onClick={()=>setShowDiscReq(false)} style={{background:"none",border:"none",fontSize:22,color:"#94A3B8",cursor:"pointer"}}>×</button>
            </div>
            <div style={{padding:"1.25rem 1.5rem",display:"flex",flexDirection:"column",gap:14}}>

              {/* Info banner */}
              <div style={{background:"#FDF3DC",border:"1px solid #E8C97A",borderRadius:8,padding:"10px 14px",fontSize:12,color:"#8A6200"}}>
                ℹ Discounts up to <strong>5%</strong> go to your Sales Manager for approval. Above 5% are escalated to Admin.
              </div>

              {/* Discount Type */}
              <div>
                <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Discount Type</label>
                <select value={discReqForm.type} onChange={e=>setDiscReqForm(f=>({...f,type:e.target.value}))}>
                  <option value="sale_price">Sale Price Reduction</option>
                  <option value="payment_plan">Payment Plan Change</option>
                  <option value="agency_fee">Agency Fee Waiver</option>
                </select>
              </div>

              {/* Discount Source — KEY NEW FIELD */}
              <div>
                <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:8,textTransform:"uppercase",letterSpacing:".5px"}}>Discount Source *</label>
                <div style={{display:"flex",gap:8}}>
                  {[["Developer","🏗 Developer","Developer is offering the discount"],["Our Company","🏢 Our Company","We absorb the discount from our margin"]].map(([v,l,desc])=>(
                    <div key={v} onClick={()=>setDiscReqForm(f=>({...f,discount_source:v}))}
                      style={{flex:1,padding:"10px 14px",borderRadius:10,border:`2px solid ${discReqForm.discount_source===v?"#7C3AED":"#E2E8F0"}`,
                        background:discReqForm.discount_source===v?"#EDE9FE":"#fff",cursor:"pointer",transition:"all .15s"}}>
                      <div style={{fontSize:13,fontWeight:700,color:discReqForm.discount_source===v?"#7C3AED":"#0F2540",marginBottom:3}}>{l}</div>
                      <div style={{fontSize:11,color:"#94A3B8"}}>{desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Developer auth ref — only if Developer */}
              {discReqForm.discount_source==="Developer"&&(
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Developer Authorization Reference</label>
                  <input placeholder="e.g. Email ref, approval code, document number…" value={discReqForm.developer_auth_ref||""} onChange={e=>setDiscReqForm(f=>({...f,developer_auth_ref:e.target.value}))}/>
                  <div style={{fontSize:11,color:"#94A3B8",marginTop:4}}>Attach proof of developer authorization (email, letter, etc.)</div>
                </div>
              )}

              {/* Discount % and values */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Original Price (AED)</label>
                  <input type="number" value={discReqForm.original_value||opp.budget||""} readOnly style={{background:"#F7F9FC",color:"#94A3B8"}}/>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Discount % *</label>
                  <input type="number" min="0" max="50" step="0.5" placeholder="e.g. 5" value={discReqForm.discount_pct||""} onChange={e=>setDiscReqForm(f=>({...f,discount_pct:e.target.value,requested_value:Math.round((discReqForm.original_value||opp.budget||0)*(1-Number(e.target.value)/100))}))}/>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Discounted Price</label>
                  <input type="number" value={discReqForm.requested_value||""} onChange={e=>setDiscReqForm(f=>({...f,requested_value:e.target.value,discount_pct:discReqForm.original_value||(opp.budget||0)?Math.round((1-Number(e.target.value)/(discReqForm.original_value||opp.budget||1))*1000)/10:""}))} placeholder="Auto-calculated"/>
                </div>
              </div>

              {/* Reason */}
              <div>
                <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Reason for Discount *</label>
                <textarea rows={3} placeholder="Explain why this discount is needed — client objection, competitor pricing, budget constraint…" value={discReqForm.reason||""} onChange={e=>setDiscReqForm(f=>({...f,reason:e.target.value}))}/>
              </div>

              {/* Approval notice */}
              {discReqForm.discount_pct&&(
                <div style={{padding:"8px 12px",borderRadius:8,fontSize:12,fontWeight:600,
                  background:Number(discReqForm.discount_pct)>5?"#EEE8F9":"#E6EFF9",
                  color:Number(discReqForm.discount_pct)>5?"#5B3FAA":"#1A5FA8",
                  border:`1px solid ${Number(discReqForm.discount_pct)>5?"#C4B5FD":"#BFDBFE"}`}}>
                  {Number(discReqForm.discount_pct)>5?"⚡ This request will be escalated to Admin for approval":"✓ This request will go to your Sales Manager for approval"}
                </div>
              )}

              <div style={{display:"flex",gap:10,justifyContent:"flex-end",paddingTop:8,borderTop:"1px solid #F1F5F9"}}>
                <button onClick={()=>setShowDiscReq(false)} style={{padding:"8px 18px",borderRadius:8,border:"1.5px solid #E2E8F0",background:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",color:"#475569"}}>Cancel</button>
                <button onClick={async()=>{
                  if(!discReqForm.discount_pct){showToast("Discount % is required","error");return;}
                  if(!discReqForm.reason?.trim()){showToast("Please provide a reason","error");return;}
                  const payload = {
                    lead_id: lead?.id||null,
                    lead_name: lead?.name||opp.title||"",
                    unit_id: opp.unit_id||null,
                    opportunity_id: opp.id,
                    company_id: currentUser.company_id||null,
                    type: discReqForm.type,
                    discount_pct: Number(discReqForm.discount_pct),
                    original_value: Number(discReqForm.original_value||opp.budget||0),
                    requested_value: Number(discReqForm.requested_value||0),
                    reason: discReqForm.reason,
                    discount_source: discReqForm.discount_source,
                    developer_auth_ref: discReqForm.developer_auth_ref||null,
                    requested_by: currentUser.id,
                    requested_by_name: currentUser.full_name||currentUser.email,
                    status: "Pending",
                  };
                  const{error}=await supabase.from("discount_requests").insert(payload);
                  if(error){showToast(error.message,"error");return;}
                  showToast("Discount request submitted — pending manager approval","success");
                  setShowDiscReq(false);
                }}>
                  Submit for Approval
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Send Proposal Email Modal */}
      {showEmail&&(
        <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,.65)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1100,padding:"1rem"}}>
          <div style={{background:"#fff",borderRadius:16,width:540,maxWidth:"100%",maxHeight:"92vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 24px 64px rgba(11,31,58,.4)"}}>
            <div style={{background:"#fff",padding:"1rem 1.5rem",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:16,fontWeight:700,color:"#fff"}}>📤 Send Proposal</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,.5)",marginTop:2}}>Stage moves to Proposal Sent after sending</div>
              </div>
              <button onClick={()=>setShowEmail(false)} style={{background:"none",border:"none",fontSize:22,color:"#C9A84C",cursor:"pointer"}}>×</button>
            </div>
            <div style={{overflowY:"auto",padding:"1.25rem 1.5rem",flex:1,display:"flex",flexDirection:"column",gap:12}}>
              <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>To *</label><input value={emailForm.to} onChange={e=>setEmailForm(f=>({...f,to:e.target.value}))}/></div>
              <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Subject</label><input value={emailForm.subject} onChange={e=>setEmailForm(f=>({...f,subject:e.target.value}))}/></div>
              <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Message</label><textarea value={emailForm.body} onChange={e=>setEmailForm(f=>({...f,body:e.target.value}))} rows={8} style={{fontFamily:"inherit",lineHeight:1.6}}/></div>
              <div style={{background:"#E6EFF9",borderRadius:8,padding:"10px 12px",fontSize:12,color:"#1A5FA8"}}>💡 Proposal PDF will download automatically. Attach it to the email.</div>
            </div>
            <div style={{padding:"1rem 1.5rem",borderTop:"1px solid #E2E8F0",display:"flex",gap:10,justifyContent:"flex-end"}}>
              <button onClick={()=>setShowEmail(false)} style={{padding:"9px 18px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancel</button>
              <button onClick={async()=>{
                if(!emailForm.to){showToast("Enter recipient email","error");return;}
                const mailtoUrl=`mailto:${emailForm.to}?subject=${encodeURIComponent(emailForm.subject)}&body=${encodeURIComponent(emailForm.body)}`;
                window.open(mailtoUrl);
                await supabase.from("activities").insert({opportunity_id:opp.id,lead_id:lead.id,type:"Email",note:`Proposal sent to ${emailForm.to}`,user_id:currentUser.id,user_name:currentUser.full_name,lead_name:lead.name,company_id:currentUser.company_id||null});
                const{error}=await supabase.from("opportunities").update({stage:"Proposal Sent",proposal_sent_at:new Date().toISOString(),stage_updated_at:new Date().toISOString(),status:"Active"}).eq("id",opp.id);
                if(!error){onUpdated({...opp,stage:"Proposal Sent",proposal_sent_at:new Date().toISOString()});showToast("Proposal sent — stage updated","success");}
                setShowEmail(false);
              }} style={{padding:"9px 24px",borderRadius:8,border:"none",background:"#1A5FA8",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>📤 Send & Move Stage</button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Payment Modal */}
      {showPayment&&(
        <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:"1rem"}}>
          <div style={{background:"#fff",borderRadius:16,width:500,maxWidth:"100%",maxHeight:"92vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 20px 60px rgba(11,31,58,.35)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"1rem 1.5rem",borderBottom:"1px solid #E8EDF4",background:"#fff"}}>
              <span style={{fontFamily:"'Playfair Display',serif",fontSize:16,fontWeight:700,color:"#fff"}}>💰 {editPayment?"Edit":"Add"} Payment</span>
              <button onClick={()=>{setShowPayment(false);setEditPayment(null);}} style={{background:"none",border:"none",fontSize:22,color:"#C9A84C",cursor:"pointer"}}>×</button>
            </div>
            <div style={{overflowY:"auto",padding:"1.25rem 1.5rem",flex:1}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div style={{gridColumn:"1/-1"}}><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Milestone *</label>
                  <select value={payForm.milestone} onChange={e=>setPayForm(f=>({...f,milestone:e.target.value}))}>
                    {["Booking Deposit","SPA Signing","1st Installment","2nd Installment","3rd Installment","4th Installment","On Handover","Post Handover 1","Post Handover 2","Other"].map(m=><option key={m}>{m}</option>)}
                  </select></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>% of Deal Value</label>
                  <input type="number" value={payForm.percentage} placeholder="e.g. 10" onChange={e=>{
                    const pct=Number(e.target.value)||0;
                    const base=opp.final_price||opp.budget||0;
                    setPayForm(f=>({...f,percentage:e.target.value,amount:pct>0&&base>0?Math.round(base*(pct/100)):f.amount}));
                  }}/>
                  {payForm.percentage>0&&(opp.final_price||opp.budget)&&<div style={{fontSize:11,color:"#1A7F5A",marginTop:3,fontWeight:600}}>= AED {Math.round((opp.final_price||opp.budget)*(Number(payForm.percentage)/100)).toLocaleString()}</div>}
                </div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Amount (AED) *</label>
                  <input type="number" value={payForm.amount} placeholder="e.g. 250000" style={{fontWeight:700}} onChange={e=>{
                    const amt=Number(e.target.value)||0;
                    const base=opp.final_price||opp.budget||0;
                    setPayForm(f=>({...f,amount:e.target.value,percentage:amt>0&&base>0?Math.round(amt/base*1000)/10:f.percentage}));
                  }}/></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Due Date</label><input type="date" value={payForm.due_date} onChange={e=>setPayForm(f=>({...f,due_date:e.target.value}))}/></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Payment Type</label>
                  <select value={payForm.payment_type} onChange={e=>setPayForm(f=>({...f,payment_type:e.target.value}))}>
                    {["Cheque","Cash","Bank Transfer","Credit Card"].map(t=><option key={t}>{t}</option>)}
                  </select></div>
                {payForm.payment_type==="Cheque"&&<>
                  <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Cheque Number</label><input value={payForm.cheque_number} onChange={e=>setPayForm(f=>({...f,cheque_number:e.target.value}))}/></div>
                  <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Cheque Date</label><input type="date" value={payForm.cheque_date} onChange={e=>setPayForm(f=>({...f,cheque_date:e.target.value}))}/></div>
                  <div style={{gridColumn:"1/-1"}}><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Bank Name</label><input value={payForm.bank_name} onChange={e=>setPayForm(f=>({...f,bank_name:e.target.value}))} placeholder="Emirates NBD, ADCB…"/></div>
                  <div style={{gridColumn:"1/-1"}}>
                    <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Cheque Image</label>
                    {payForm.cheque_file_url?(
                      <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",background:"#E6F4EE",borderRadius:8,border:"1px solid #A8D5BE"}}>
                        <span style={{fontSize:12,color:"#1A7F5A",fontWeight:600}}>✓ Uploaded</span>
                        <a href={payForm.cheque_file_url} target="_blank" rel="noreferrer" style={{fontSize:11,color:"#1A5FA8"}}>View →</a>
                        <button onClick={()=>setPayForm(f=>({...f,cheque_file_url:""}))} style={{marginLeft:"auto",fontSize:11,color:"#B83232",background:"none",border:"none",cursor:"pointer"}}>× Remove</button>
                      </div>
                    ):(
                      <label style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",borderRadius:8,border:"1.5px dashed #D1D9E6",cursor:"pointer",background:"#FAFBFC",fontSize:12,color:"#4A5568"}}>
                        <input type="file" accept="image/*,.pdf" style={{display:"none"}} onChange={async e=>{
                          const file=e.target.files[0];if(!file)return;
                          setSaving(true);
                          try{
                            const path=`payments/${opp.id}/${Date.now()}_${file.name}`;
                            await supabase.storage.from("propcrm-files").upload(path,file,{upsert:true});
                            const{data:{publicUrl}}=supabase.storage.from("propcrm-files").getPublicUrl(path);
                            setPayForm(f=>({...f,cheque_file_url:publicUrl}));
                            showToast("Cheque uploaded","success");
                          }catch(err){showToast(err.message,"error");}
                          setSaving(false);
                        }}/>
                        📷 Upload cheque photo or scan
                      </label>
                    )}
                  </div>
                </>}
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Status</label>
                  <select value={payForm.status} onChange={e=>setPayForm(f=>({...f,status:e.target.value}))}>
                    {Object.keys(PAYMENT_STATUS_META).map(s=><option key={s}>{s}</option>)}
                  </select></div>
                <div style={{gridColumn:"1/-1"}}><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Notes</label><textarea value={payForm.notes} onChange={e=>setPayForm(f=>({...f,notes:e.target.value}))} rows={2}/></div>
              </div>
            </div>
            <div style={{display:"flex",gap:10,justifyContent:"flex-end",padding:"1rem 1.5rem",borderTop:"1px solid #E2E8F0"}}>
              <button onClick={()=>{setShowPayment(false);setEditPayment(null);}} style={{padding:"9px 20px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancel</button>
              <button onClick={savePayment} disabled={saving} style={{padding:"9px 24px",borderRadius:8,border:"none",background:saving?"#A0AEC0":"#0F2540",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>{saving?"Saving…":editPayment?"Save Changes":"Add Payment"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════
// LEADS — Contact list with opportunities per lead
// ══════════════════════════════════════════════════════════════════
