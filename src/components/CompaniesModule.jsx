function CompaniesModule({ currentUser, showToast, onSwitchCompany, activeCompanyId }) {
  const [companies,  setCompanies]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [showAdd,    setShowAdd]    = useState(false);
  const [editComp,   setEditComp]   = useState(null);
  const [saving,     setSaving]     = useState(false);

  const blank = {
    name:"", business_type:"both", company_category:"Brokerage",
    primary_contact:"", phone:"", email:"",
    address:"", city:"", country:"UAE", brand_color:"#0F2540",
    brand_accent:"#C9A84C", plan:"professional", is_active:true, logo_url:"",
    rera_number:"", ded_number:"", ai_assistant_name:""
  };
  const [form, setForm] = useState(blank);
  const sf = (k,v) => setForm(f=>({...f,[k]:v}));

  const PLANS = [
    { id:"starter",      label:"Starter",      desc:"Up to 5 users · Sales or Leasing only",     color:"#718096" },
    { id:"professional", label:"Professional",  desc:"Up to 20 users · Sales & Leasing",           color:"#1A5FA8" },
    { id:"enterprise",   label:"Enterprise",    desc:"Unlimited users · Full access + API",         color:"#C9A84C" },
  ];
  const BIZ_TYPES = [
    { id:"sales",   label:"Sales Only",       icon:"🏷", desc:"Leads · Pipeline · Inventory · Off-plan" },
    { id:"leasing", label:"Leasing Only",     icon:"🔑", desc:"Tenants · Leases · PDC · Rent Roll" },
    { id:"both",    label:"Sales & Leasing",  icon:"◆",  desc:"Full suite · Both workflows" },
  ];
  const COMPANY_CATEGORIES = [
    "Brokerage", "Developer", "Real Estate Agent", "Property Management",
    "Off-Plan Specialist", "Leasing Company", "RERA Registered Agency",
    "Investment Company", "Other"
  ];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from("companies").select("*").order("name");
      if(error) throw error;
      setCompanies(data || []);
    } catch(e) {
      console.error("Companies load error:", e.message);
      // If no companies exist yet, show empty state
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!form.name.trim()) { showToast("Company name required", "error"); return; }
    setSaving(true);
    try {
      if (editComp) {
        const { error } = await supabase.from("companies").update({ ...form, updated_at: new Date().toISOString() }).eq("id", editComp.id);
        if (error) throw error;
        showToast("Company updated", "success");
      } else {
        const { error } = await supabase.from("companies").insert({ ...form }).select().single();
        if (error) throw error;
        showToast("Company created", "success");
      }
      setShowAdd(false); setEditComp(null); setForm(blank); load();
    } catch(e) { showToast(e.message, "error"); }
    setSaving(false);
  };

  const toggleActive = async (comp) => {
    await supabase.from("companies").update({ is_active: !comp.is_active }).eq("id", comp.id);
    setCompanies(p => p.map(c => c.id === comp.id ? { ...c, is_active: !c.is_active } : c));
    showToast(comp.is_active ? "Company deactivated" : "Company activated", "info");
  };

  const openEdit = (comp) => {
    setForm({ ...blank, ...comp });
    setEditComp(comp);
    setShowAdd(true);
  };

  const PLAN_META = { starter:{c:"#718096",bg:"#F7F9FC"}, professional:{c:"#1A5FA8",bg:"#E6EFF9"}, enterprise:{c:"#8A6200",bg:"#FDF3DC"} };
  const BIZ_META  = { sales:{c:"#1A5FA8",bg:"#E6EFF9",icon:"🏷"}, leasing:{c:"#5B3FAA",bg:"#EEE8F9",icon:"🔑"}, both:{c:"#1A7F5A",bg:"#E6F4EE",icon:"◆"} };

  if (loading) return <Spinner msg="Loading companies…"/>;

  return (
    <div className="fade-in" style={{display:"flex",flexDirection:"column",height:"100%"}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:8}}>
        <div>
          <div style={{fontSize:13,color:"#718096"}}>{companies.length} compan{companies.length!==1?"ies":"y"} · {companies.filter(c=>c.is_active).length} active</div>
        </div>
        <button onClick={()=>{setForm(blank);setEditComp(null);setShowAdd(true);}}
          style={{padding:"9px 20px",borderRadius:8,border:"none",background:"#0F2540",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>
          + Add Company
        </button>
      </div>

      {/* Company cards */}
      <div style={{flex:1,overflowY:"auto",display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:14,alignContent:"start"}}>
        {companies.map(c => {
          const bm = BIZ_META[c.business_type] || BIZ_META.both;
          const pm = PLAN_META[c.plan] || PLAN_META.professional;
          const isActive = activeCompanyId === c.id;
          return (
            <div key={c.id}
              onClick={()=>{ if(c.is_active&&!isActive){ onSwitchCompany(c.id, c); showToast(`Switched to ${c.name}`,"success"); } }}
              style={{background:"#fff",border:`2px solid ${isActive?"#C9A84C":"#E2E8F0"}`,borderRadius:14,overflow:"hidden",opacity:c.is_active?1:.55,transition:"all .2s",cursor:c.is_active&&!isActive?"pointer":"default",boxShadow:isActive?"0 4px 20px rgba(201,168,76,.2)":"none"}}
              onMouseOver={e=>{ if(c.is_active&&!isActive) e.currentTarget.style.boxShadow="0 4px 16px rgba(0,0,0,.1)"; }}
              onMouseOut={e=>{ e.currentTarget.style.boxShadow=isActive?"0 4px 20px rgba(201,168,76,.2)":"none"; }}>
              {/* Colour bar */}
              <div style={{height:5,background:`linear-gradient(90deg,${c.brand_color||"#0F2540"},${c.brand_accent||"#C9A84C"})`}}/>
              <div style={{padding:"14px 16px"}}>
                {/* Name + badges */}
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:8}}>
                  <div style={{fontFamily:"'Playfair Display',serif",fontSize:16,fontWeight:700,color:"#0F2540"}}>{c.name}</div>
                  <div style={{display:"flex",flexDirection:"column",gap:3,alignItems:"flex-end"}}>
                    {isActive
                      ? <span style={{fontSize:10,fontWeight:700,padding:"2px 9px",borderRadius:20,background:"#C9A84C",color:"#0F2540"}}>✦ Active</span>
                      : <span style={{fontSize:10,fontWeight:600,padding:"2px 9px",borderRadius:20,background:"#E6F4EE",color:"#1A7F5A"}}>Click to switch →</span>
                    }
                  </div>
                </div>
                {c.city&&<div style={{fontSize:11,color:"#A0AEC0",marginBottom:8}}>📍 {c.city}{c.country?`, ${c.country}`:""}</div>}
                <div style={{display:"flex",gap:5,marginBottom:10,flexWrap:"wrap"}}>
                  <span style={{fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:20,background:bm.bg,color:bm.c}}>{bm.icon} {c.business_type==="both"?"Sales & Leasing":c.business_type==="sales"?"Sales Only":"Leasing Only"}</span>
                  <span style={{fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:20,background:pm.bg,color:pm.c}}>{c.plan?.charAt(0).toUpperCase()+c.plan?.slice(1)||"Professional"}</span>
                </div>
                {c.primary_contact&&<div style={{fontSize:11,color:"#4A5568",marginBottom:3}}>👤 {c.primary_contact}</div>}
                {c.phone&&<div style={{fontSize:11,color:"#4A5568",marginBottom:3}}>📞 {c.phone}</div>}
                {c.email&&<div style={{fontSize:11,color:"#4A5568",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginBottom:10}}>✉ {c.email}</div>}
                {/* Edit + Deactivate — stop propagation so card click doesn't trigger */}
                <div style={{display:"flex",gap:6}} onClick={e=>e.stopPropagation()}>
                  <button onClick={()=>openEdit(c)}
                    style={{flex:1,padding:"6px 10px",borderRadius:7,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:11,fontWeight:600,cursor:"pointer"}}>
                    ✏ Edit
                  </button>
                  <button onClick={()=>toggleActive(c)}
                    style={{flex:1,padding:"6px 10px",borderRadius:7,border:`1.5px solid ${c.is_active?"#F0BCBC":"#A8D5BE"}`,background:c.is_active?"#FAEAEA":"#E6F4EE",color:c.is_active?"#B83232":"#1A7F5A",fontSize:11,fontWeight:600,cursor:"pointer"}}>
                    {c.is_active?"Deactivate":"Activate"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Modal */}
      {showAdd&&(
        <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:"1rem"}}>
          <div style={{background:"#fff",borderRadius:16,width:620,maxWidth:"100%",maxHeight:"92vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 20px 60px rgba(11,31,58,.35)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"1.125rem 1.5rem",borderBottom:"1px solid #E2E8F0",flexShrink:0}}>
              <span style={{fontFamily:"'Inter',sans-serif",fontSize:16,fontWeight:700,color:"#0F2540",letterSpacing:"-.4px"}}>{editComp?"Edit Company":"Add New Company"}</span>
              <button onClick={()=>{setShowAdd(false);setEditComp(null);}} style={{background:"none",border:"none",fontSize:22,color:"#A0AEC0",cursor:"pointer"}}>×</button>
            </div>
            <div style={{overflowY:"auto",padding:"1.25rem 1.5rem",flex:1}}>

              {/* Business Type */}
              <div style={{marginBottom:16}}>
                <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:8,textTransform:"uppercase",letterSpacing:".5px"}}>Business Type *</label>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                  {BIZ_TYPES.map(b=>(
                    <button key={b.id} onClick={()=>sf("business_type",b.id)}
                      style={{padding:"10px 12px",borderRadius:10,border:`2px solid ${form.business_type===b.id?"#0F2540":"#E2E8F0"}`,background:form.business_type===b.id?"#0F2540":"#fff",color:form.business_type===b.id?"#fff":"#4A5568",cursor:"pointer",textAlign:"left",transition:".15s"}}>
                      <div style={{fontSize:18,marginBottom:4}}>{b.icon}</div>
                      <div style={{fontSize:13,fontWeight:700}}>{b.label}</div>
                      <div style={{fontSize:11,opacity:.7,marginTop:2}}>{b.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Plan */}
              <div style={{marginBottom:16}}>
                <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:8,textTransform:"uppercase",letterSpacing:".5px"}}>Subscription Plan</label>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                  {PLANS.map(p=>(
                    <button key={p.id} onClick={()=>sf("plan",p.id)}
                      style={{padding:"10px 12px",borderRadius:10,border:`2px solid ${form.plan===p.id?p.color:"#E2E8F0"}`,background:form.plan===p.id?p.color+"18":"#fff",cursor:"pointer",textAlign:"left",transition:".15s"}}>
                      <div style={{fontSize:13,fontWeight:700,color:form.plan===p.id?p.color:"#0F2540"}}>{p.label}</div>
                      <div style={{fontSize:11,color:"#718096",marginTop:2}}>{p.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Core details */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
                <div style={{gridColumn:"1/-1"}}>
                  <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Company Name *</label>
                  <input value={form.name} onChange={e=>{
                    sf("name",e.target.value);
                    // Auto-suggest AI name from first word of company name
                    if(!form.ai_assistant_name||form.ai_assistant_name===form.name.split(" ")[0]+" AI"){
                      sf("ai_assistant_name", (e.target.value.split(" ")[0]||"")+" AI");
                    }
                  }} placeholder="e.g. Al Mansoori Properties"/>
                </div>
                <div style={{gridColumn:"1/-1",background:"#fff",borderRadius:10,padding:"14px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                    <span style={{fontSize:18}}>✦</span>
                    <label style={{fontSize:11,fontWeight:700,color:"#C9A84C",textTransform:"uppercase",letterSpacing:".5px"}}>AI Assistant Name</label>
                  </div>
                  <div style={{fontSize:12,color:"rgba(255,255,255,.6)",marginBottom:10,lineHeight:1.6}}>
                    What should the AI assistant be called for this company? This name will appear on the AI tab and in all AI interactions.
                  </div>
                  <input value={form.ai_assistant_name||""} onChange={e=>sf("ai_assistant_name",e.target.value)}
                    placeholder={form.name?(form.name.split(" ")[0]+" AI"):"e.g. Mansoori AI"}
                    style={{background:"rgba(255,255,255,.1)",border:"1px solid rgba(201,168,76,.4)",borderRadius:8,padding:"8px 12px",color:"#fff",fontSize:13,width:"100%",boxSizing:"border-box"}}/>
                  <div style={{fontSize:11,color:"rgba(201,168,76,.6)",marginTop:6}}>
                    💡 Tip: Use your brand name for ownership — e.g. "Mansoori AI", "Atlas AI", "Emaar AI"
                  </div>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Primary Contact</label>
                  <input value={form.primary_contact} onChange={e=>sf("primary_contact",e.target.value)} placeholder="CEO / Manager name"/>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Phone</label>
                  <input value={form.phone} onChange={e=>sf("phone",e.target.value)} placeholder="+971 4 000 0000"/>
                </div>
                <div style={{gridColumn:"1/-1"}}>
                  <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Email</label>
                  <input type="email" value={form.email} onChange={e=>sf("email",e.target.value)} placeholder="info@company.com"/>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>City</label>
                  <input value={form.city} onChange={e=>sf("city",e.target.value)} placeholder="Dubai"/>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Country</label>
                  <select value={form.country} onChange={e=>sf("country",e.target.value)}>
                    {["UAE","Saudi Arabia","UK","USA","India","Other"].map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{gridColumn:"1/-1"}}>
                  <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Address</label>
                  <input value={form.address} onChange={e=>sf("address",e.target.value)} placeholder="Office 123, Business Bay, Dubai"/>
                </div>
              </div>

              {/* Branding */}
              <div style={{background:"#F7F9FC",border:"1px solid #E2E8F0",borderRadius:10,padding:"14px",marginBottom:12}}>
                <div style={{fontSize:12,fontWeight:700,color:"#0F2540",marginBottom:12}}>🎨 Brand Colours</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                  <div>
                    <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Primary Colour</label>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      <input type="color" value={form.brand_color} onChange={e=>sf("brand_color",e.target.value)} style={{width:44,height:36,padding:2,border:"1.5px solid #D1D9E6",borderRadius:8,cursor:"pointer"}}/>
                      <input value={form.brand_color} onChange={e=>sf("brand_color",e.target.value)} placeholder="#0F2540" style={{flex:1}}/>
                    </div>
                  </div>
                  <div>
                    <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Accent Colour</label>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      <input type="color" value={form.brand_accent} onChange={e=>sf("brand_accent",e.target.value)} style={{width:44,height:36,padding:2,border:"1.5px solid #D1D9E6",borderRadius:8,cursor:"pointer"}}/>
                      <input value={form.brand_accent} onChange={e=>sf("brand_accent",e.target.value)} placeholder="#C9A84C" style={{flex:1}}/>
                    </div>
                  </div>
                </div>
                {/* Preview */}
                <div style={{marginTop:12,borderRadius:8,overflow:"hidden",boxShadow:"0 2px 8px rgba(0,0,0,.1)"}}>
                  <div style={{background:form.brand_color,padding:"10px 16px",display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontFamily:"'Playfair Display',serif",fontSize:14,fontWeight:700,color:form.brand_accent}}>◆ {form.name||"Company Name"}</span>
                  </div>
                  <div style={{background:"#F7F9FC",padding:"8px 16px",display:"flex",gap:6}}>
                    {["Dashboard","Leads","Inventory"].map(t=>(
                      <span key={t} style={{fontSize:11,padding:"3px 10px",borderRadius:6,background:t==="Dashboard"?form.brand_color:"transparent",color:t==="Dashboard"?form.brand_accent:"#718096",fontWeight:t==="Dashboard"?600:400}}>
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Status */}
              <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:13,color:"#4A5568"}}>
                <input type="checkbox" checked={form.is_active} onChange={e=>sf("is_active",e.target.checked)}/>
                Company is active (users can log in)
              </label>
            </div>
            <div style={{display:"flex",gap:10,justifyContent:"flex-end",padding:"1rem 1.5rem",borderTop:"1px solid #E2E8F0",flexShrink:0}}>
              <button onClick={()=>{setShowAdd(false);setEditComp(null);}} style={{padding:"9px 20px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancel</button>
              <button onClick={save} disabled={saving} style={{padding:"9px 24px",borderRadius:8,border:"none",background:saving?"#A0AEC0":"#0F2540",color:"#fff",fontSize:13,fontWeight:600,cursor:saving?"not-allowed":"pointer"}}>
                {saving?"Saving…":editComp?"Save Changes":"Create Company"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



// ══════════════════════════════════════════════════════════════════
// PERMISSION SETS MODULE
// ══════════════════════════════════════════════════════════════════

const PERMISSION_DEFS = [
  {
    group: "Sales",
    color: "#1A5FA8",
    bg:    "#E6EFF9",
    icon:  "🏷",
    perms: [
      { key:"p_view_leads",       label:"View Leads",              desc:"See leads in the pipeline" },
      { key:"p_edit_leads",       label:"Create & Edit Leads",     desc:"Add new leads and update existing" },
      { key:"p_delete_leads",     label:"Delete Leads",            desc:"Permanently remove leads" },
      { key:"p_request_discount", label:"Request Discounts",       desc:"Submit discount requests for approval" },
      { key:"p_approve_discount", label:"Approve Discounts",       desc:"Approve or reject discount requests" },
    ]
  },
  {
    group: "Inventory",
    color: "#8A6200",
    bg:    "#FDF3DC",
    icon:  "🏗",
    perms: [
      { key:"p_view_inventory",   label:"View Inventory",          desc:"Browse projects and units" },
      { key:"p_manage_inventory", label:"Manage Inventory",        desc:"Add, edit and delete projects and units" },
    ]
  },
  {
    group: "Leasing",
    color: "#5B3FAA",
    bg:    "#EEE8F9",
    icon:  "🔑",
    perms: [
      { key:"p_view_leasing",     label:"View Leasing",            desc:"See tenants, leases and payments" },
      { key:"p_manage_leasing",   label:"Manage Leasing",          desc:"Add tenants, create leases, log payments" },
    ]
  },
  {
    group: "General",
    color: "#4A5568",
    bg:    "#F7F9FC",
    icon:  "⊞",
    perms: [
      { key:"p_view_dashboard",   label:"View Dashboard",          desc:"Access the dashboard overview" },
      { key:"p_view_activity",    label:"View Activity Log",       desc:"See all logged activities" },
      { key:"p_use_ai",           label:"Use AI Assistant",        desc:"Access the AI chat assistant" },
      { key:"p_manage_users",     label:"Manage Users",            desc:"Add, edit and deactivate users" },
    ]
  },
];

const ALL_PERM_KEYS = PERMISSION_DEFS.flatMap(g => g.perms.map(p => p.key));

const TEMPLATES = [
  { id:"10000000-0000-0000-0000-000000000001", name:"Company Admin",    color:"#8A6200" },
  { id:"10000000-0000-0000-0000-000000000002", name:"Sales Manager",    color:"#1A5FA8" },
  { id:"10000000-0000-0000-0000-000000000003", name:"Sales Agent",      color:"#1A7F5A" },
  { id:"10000000-0000-0000-0000-000000000004", name:"Leasing Manager",  color:"#5B3FAA" },
  { id:"10000000-0000-0000-0000-000000000005", name:"Leasing Agent",    color:"#0F6E56" },
  { id:"10000000-0000-0000-0000-000000000006", name:"Viewer",           color:"#718096" },
];

const COLORS = ["#1A5FA8","#1A7F5A","#5B3FAA","#0F6E56","#8A6200","#B85C10","#B83232","#718096","#0F2540","#C9A84C"];

