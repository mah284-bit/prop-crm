import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL  = "https://ysceukgpimzfqixtnbnp.supabase.co";
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzY2V1a2dwaW16ZnFpeHRuYm5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNDI5OTQsImV4cCI6MjA4OTkxODk5NH0.WZSyGeOEbiRo1wt13syheTOyiAToMWXInxIaBgaqq8k";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

function LeasingLeads({ currentUser, showToast, users=[] }) {
  const [tenants,    setTenants]    = useState([]);
  const [lOpps,      setLOpps]      = useState([]);
  const [units,      setUnits]      = useState([]);
  const [projects,   setProjects]   = useState([]);
  const [leasePricing,setLeasePricing]=useState([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState("");
  const [fStage,     setFStage]     = useState("All");
  const [view,       setView]       = useState("list");  // list | tenant | opportunity
  const [selTenantId,setSelTenantId]= useState(null);
  const [selOpp,     setSelOpp]     = useState(null);
  const [showAddTenant,setShowAddTenant]=useState(false);
  const [showAddOpp,setShowAddOpp]  = useState(false);
  const [editTenant, setEditTenant] = useState(null);
  const [saving,     setSaving]     = useState(false);
  const [oppForm,    setOppForm]    = useState({title:"",unit_id:"",budget:"",assigned_to:"",notes:""});
  const [showTenantUpload, setShowTenantUpload] = useState(false);
  const canEdit = can(currentUser.role,"write");
  const canManageTenants = ["super_admin","admin","leasing_manager"].includes(currentUser.role);
  const tBlank = {full_name:"",phone:"",email:"",nationality:"",id_type:"Emirates ID",id_number:"",id_expiry:"",passport_number:"",tenant_type:"Individual",notes:""};
  const [tForm, setTForm] = useState(tBlank);
  const tf = k => e => setTForm(f=>({...f,[k]:e.target?.value??e}));

  useEffect(()=>{
    const q = x => x.then(r=>r).catch(()=>({data:[]}));
    Promise.all([
      q(supabase.from("tenants").select("*").order("full_name")),
      q(supabase.from("lease_opportunities").select("*").order("created_at",{ascending:false})),
      q(supabase.from("project_units").select("id,unit_ref,unit_type,sub_type,project_id,status,purpose,floor_number,view,size_sqft,bedrooms,bathrooms,block_or_tower")),
      q(supabase.from("projects").select("id,name")),
      q(supabase.from("unit_lease_pricing").select("*")),
    ]).then(([t,lo,u,p,lp])=>{
      setTenants(t.data||[]);
      setLOpps(lo.data||[]);
      setUnits(u.data||[]);
      setProjects(p.data||[]);
      setLeasePricing(lp.data||[]);
      setLoading(false);
    }).catch(()=>setLoading(false));
  },[]);

  const selTenant   = tenants.find(t=>t.id===selTenantId);
  const tenantOpps  = selTenantId ? lOpps.filter(o=>o.tenant_id===selTenantId) : [];

  const tenantBestStage = tid => {
    const lo = lOpps.filter(o=>o.tenant_id===tid&&o.status==="Active");
    if(!lo.length) return lOpps.find(o=>o.tenant_id===tid)?.stage||"New Enquiry";
    const order = ["Reserved","Lease Signed","Offer Made","Viewing","Contacted","New Enquiry"];
    for(const s of order){ if(lo.find(o=>o.stage===s)) return s; }
    return lo[0]?.stage||"New Enquiry";
  };

  const saveTenant = async()=>{
    if(!tForm.full_name.trim()){showToast("Name required","error");return;}
    setSaving(true);
    try{
      const payload={...tForm,company_id:currentUser.company_id||null,created_by:currentUser.id};
      let data,error;
      if(editTenant){
        ({data,error}=await supabase.from("tenants").update(tForm).eq("id",editTenant.id).select().single());
        setTenants(p=>p.map(t=>t.id===editTenant.id?data:t));
      }else{
        ({data,error}=await supabase.from("tenants").insert(payload).select().single());
        setTenants(p=>[...p,data].sort((a,b)=>a.full_name.localeCompare(b.full_name)));
      }
      if(error)throw error;
      showToast(editTenant?"Tenant updated":"Tenant added","success");
      setShowAddTenant(false);setEditTenant(null);setTForm(tBlank);
    }catch(e){showToast(e.message,"error");}
    setSaving(false);
  };

  const saveOpp = async()=>{
    if(!selTenantId)return;
    setSaving(true);
    try{
      const unit=units.find(u=>u.id===oppForm.unit_id);
      const payload={
        tenant_id:selTenantId,
        company_id:currentUser.company_id||null,
        title:oppForm.title||(unit?`${unit.unit_ref} — ${selTenant?.full_name}`:`Enquiry — ${selTenant?.full_name}`),
        unit_id:oppForm.unit_id||null,
        budget:oppForm.budget?Number(oppForm.budget):null,
        assigned_to:oppForm.assigned_to||currentUser.id,
        notes:oppForm.notes||null,
        property_category:oppForm.property_category||"Off-Plan",
        stage:"New Enquiry",status:"Active",
        created_by:currentUser.id,
      };
      const{data,error}=await supabase.from("lease_opportunities").insert(payload).select().single();
      if(error)throw error;
      setLOpps(p=>[data,...p]);
      showToast("Lease enquiry created","success");
      setShowAddOpp(false);
      setOppForm({title:"",unit_id:"",budget:"",assigned_to:"",notes:"",property_category:"Off-Plan"});
      setSelOpp(data);setView("opportunity");
    }catch(e){showToast(e.message,"error");}
    setSaving(false);
  };

  const visible = (can(currentUser.role,"see_all")?tenants:tenants.filter(t=>{
    const myOpps=lOpps.filter(o=>o.tenant_id===t.id&&o.assigned_to===currentUser.id);
    return myOpps.length>0;
  }));
  const filtered = visible.filter(t=>{
    const q=search.toLowerCase();
    return(!q||t.full_name?.toLowerCase().includes(q)||t.phone?.includes(q)||t.email?.toLowerCase().includes(q));
  });

  if(loading) return <Spinner msg="Loading leasing enquiries…"/>;

  // ── LIST VIEW ─────────────────────────────────────────────────
  if(view==="list") return (
    <div className="fade-in" style={{display:"flex",flexDirection:"column",height:"100%"}}>
      {/* Toolbar */}
      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
        <div style={{position:"relative",flex:1,minWidth:160}}>
          <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",fontSize:14}}>🔍</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, phone, email…" style={{paddingLeft:32,width:"100%"}}/>
        </div>
        <span style={{fontSize:12,color:"#A0AEC0",whiteSpace:"nowrap"}}>{filtered.length}/{visible.length}</span>
        {canEdit&&<button onClick={()=>setShowTenantUpload(true)}
          style={{padding:"8px 16px",borderRadius:8,border:"1.5px solid #5B3FAA",background:"#F5F0FF",color:"#5B3FAA",fontSize:12,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>
          📋 Download Template / Upload Data
        </button>}
        {canEdit&&<button onClick={()=>{setTForm(tBlank);setEditTenant(null);setShowAddTenant(true);}} style={{padding:"8px 18px",borderRadius:8,border:"none",background:"#5B3FAA",color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>+ Add Tenant</button>}
      </div>

      {/* Stage filter strip */}
      <div style={{display:"flex",gap:6,marginBottom:12,overflowX:"auto",paddingBottom:4,flexShrink:0}}>
        {["All",...LEASE_STAGES].map(s=>{
          const cnt=s==="All"?filtered.length:filtered.filter(t=>tenantBestStage(t.id)===s).length;
          const m=s==="All"?{c:"#5B3FAA",bg:"#EEE8F9"}:LEASE_STAGE_META[s]||{c:"#718096",bg:"#F7F9FC"};
          return (
            <button key={s} onClick={()=>setFStage(s)}
              style={{flexShrink:0,padding:"5px 12px",borderRadius:8,border:`1.5px solid ${fStage===s?m.c:"#E2E8F0"}`,background:fStage===s?m.bg:"#fff",color:m.c,fontSize:11,fontWeight:600,cursor:"pointer"}}>
              {s} <span style={{fontWeight:700}}>{cnt}</span>
            </button>
          );
        })}
      </div>

      {/* Tenants table */}
      <div style={{flex:1,overflowY:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead style={{position:"sticky",top:0,zIndex:1}}>
            <tr style={{background:"#1A0B3A"}}>
              {["Tenant","Phone","Email","Nationality","Enquiries","Best Stage","Action"].map(h=>(
                <th key={h} style={{padding:"8px 10px",textAlign:"left",fontSize:10,fontWeight:600,color:"#C9A84C",textTransform:"uppercase",letterSpacing:".4px",whiteSpace:"nowrap"}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length===0&&<tr><td colSpan={7} style={{textAlign:"center",padding:"3rem",color:"#A0AEC0"}}>No tenants found</td></tr>}
            {filtered.map((t,i)=>{
              const lo=lOpps.filter(o=>o.tenant_id===t.id);
              const activeOpps=lo.filter(o=>o.status==="Active");
              const bestStage=tenantBestStage(t.id);
              const sm2=LEASE_STAGE_META[bestStage]||{c:"#718096",bg:"#F7F9FC"};
              if(fStage!=="All"&&bestStage!==fStage)return null;
              return (
                <tr key={t.id}
                  style={{background:i%2===0?"#fff":"#FAFBFC",borderBottom:"1px solid #F0F2F5",cursor:"pointer",transition:"background .1s"}}
                  onMouseOver={e=>e.currentTarget.style.background="#F5F0FF"}
                  onMouseOut={e=>e.currentTarget.style.background=i%2===0?"#fff":"#FAFBFC"}>
                  <td style={{padding:"8px 10px"}} onClick={()=>{setSelTenantId(t.id);setView("tenant");}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <Av name={t.full_name} size={28} bg="#5B3FAA"/>
                      <div>
                        <div style={{fontWeight:600,fontSize:13,color:"#0F2540"}}>{t.full_name}</div>
                        {t.tenant_type&&<div style={{fontSize:10,color:"#A0AEC0"}}>{t.tenant_type}</div>}
                      </div>
                    </div>
                  </td>
                  <td style={{padding:"8px 10px",color:"#4A5568"}} onClick={()=>{setSelTenantId(t.id);setView("tenant");}}>{t.phone||"—"}</td>
                  <td style={{padding:"8px 10px",color:"#4A5568",maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} onClick={()=>{setSelTenantId(t.id);setView("tenant");}}>{t.email||"—"}</td>
                  <td style={{padding:"8px 10px",color:"#4A5568"}} onClick={()=>{setSelTenantId(t.id);setView("tenant");}}>{t.nationality||"—"}</td>
                  <td style={{padding:"8px 10px",textAlign:"center"}} onClick={()=>{setSelTenantId(t.id);setView("tenant");}}>
                    <span style={{fontWeight:700,color:"#5B3FAA"}}>{activeOpps.length}</span>
                    {lo.filter(o=>o.status==="Won").length>0&&<span style={{fontSize:10,color:"#1A7F5A",marginLeft:4}}>+{lo.filter(o=>o.status==="Won").length}✓</span>}
                  </td>
                  <td style={{padding:"8px 10px"}} onClick={()=>{setSelTenantId(t.id);setView("tenant");}}>
                    <span style={{fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:20,background:sm2.bg,color:sm2.c}}>{bestStage}</span>
                  </td>
                  <td style={{padding:"8px 10px"}} onClick={e=>e.stopPropagation()}>
                    <button onClick={()=>{setTForm({...tBlank,...t});setEditTenant(t);setShowAddTenant(true);}} style={{fontSize:11,padding:"3px 8px",borderRadius:6,border:"1px solid #E2E8F0",background:"#fff",cursor:"pointer"}}>✏</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Tenant Upload Modal */}
      {showTenantUpload&&(()=>{
        const cid = currentUser.company_id || localStorage.getItem("propccrm_company_id") || null;
        return (
        <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:"1rem"}}>
          <div style={{background:"#fff",borderRadius:16,width:580,maxWidth:"100%",maxHeight:"92vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(11,31,58,.35)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"1rem 1.5rem",borderBottom:"1px solid #E2E8F0",background:"linear-gradient(135deg,#1A0B3A,#2D1558)"}}>
              <span style={{fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:700,color:"#fff"}}>📋 Tenants — Download Template / Upload Data</span>
              <button onClick={()=>setShowTenantUpload(false)} style={{background:"none",border:"none",fontSize:22,color:"#C9A84C",cursor:"pointer"}}>×</button>
            </div>
            <div style={{padding:"1.5rem"}}>
              {/* Export current */}
              {tenants.length>0&&(
                <div style={{background:"#F7F9FC",borderRadius:10,padding:"12px 14px",marginBottom:14,border:"1px solid #E2E8F0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontSize:12,fontWeight:700,color:"#0F2540"}}>Export Current Tenants</div>
                    <div style={{fontSize:11,color:"#718096"}}>{tenants.length} tenant records</div>
                  </div>
                  <button onClick={()=>{
                    const headers = "full_name,phone,email,nationality,id_type,id_number,id_expiry,tenant_type,notes";
                    const rows = tenants.map(t=>[
                      t.full_name,t.phone||"",t.email||"",t.nationality||"",t.id_type||"",t.id_number||"",t.id_expiry||"",t.tenant_type||"",t.notes||""
                    ].map(v=>`"${String(v).replace(/"/g,'""')}"`).join(","));
                    const csv=[headers,...rows].join("\n");
                    const a=document.createElement("a");
                    a.href="data:text/csv;charset=utf-8,"+encodeURIComponent(csv);
                    a.download=`tenants_export_${new Date().toISOString().split("T")[0]}.csv`;
                    a.click();
                    showToast(`Exported ${tenants.length} tenants`,"success");
                  }} style={{padding:"8px 16px",borderRadius:8,border:"none",background:"#1A7F5A",color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>
                    ⬇ Export Current
                  </button>
                </div>
              )}

              {/* Two column layout */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
                {/* Download Template */}
                <div style={{background:"#F7F9FC",borderRadius:10,padding:"16px",border:"1px solid #E2E8F0",display:"flex",flexDirection:"column",gap:10}}>
                  <div style={{fontSize:13,fontWeight:700,color:"#0F2540"}}>📥 Step 1 — Download Template</div>
                  <div style={{fontSize:12,color:"#4A5568",lineHeight:1.7}}>Fill in your tenants in Excel, then save as CSV and upload.</div>
                  <div style={{fontSize:11,color:"#1A5FA8",lineHeight:1.7}}>
                    <strong>Columns:</strong> full_name · phone · email · nationality · id_type · id_number · id_expiry · tenant_type · notes<br/>
                    <strong>nationality:</strong> {MASTER.nationality.join(" | ")}<br/>
                    <strong>id_type:</strong> {MASTER.id_type.join(" | ")}<br/>
                    <strong>tenant_type:</strong> {MASTER.tenant_type.join(" | ")}
                  </div>
                  <button onClick={()=>{
                    const headers = "full_name,phone,email,nationality,id_type,id_number,id_expiry,tenant_type,notes";
                    const samples = [
                      '"Ahmed Al Mansouri","+971501234567","ahmed@email.com","Emirati","Emirates ID","784-1990-1234567-1","2028-12-31","Individual","VIP client"',
                      '"Raj Kumar","+971507654321","raj@company.com","Indian","Passport","A1234567","2027-06-30","Corporate","Company lease"',
                    ].join("\n");
                    const allowedNote = "\n\nALLOWED VALUES\nnationality: "+MASTER.nationality.join(" | ")+"\nid_type: "+MASTER.id_type.join(" | ")+"\ntenant_type: "+MASTER.tenant_type.join(" | ");
                    const csv = headers+"\n"+samples+allowedNote;
                    const a=document.createElement("a");
                    a.href="data:text/csv;charset=utf-8,"+encodeURIComponent(csv);
                    a.download="propcrm_tenants_template.csv";
                    a.click();
                  }} style={{padding:"10px 0",borderRadius:8,border:"none",background:"#1A0B3A",color:"#C9A84C",fontSize:13,fontWeight:700,cursor:"pointer",textAlign:"center"}}>
                    ⬇ Download Template
                  </button>
                </div>

                {/* Upload */}
                <div style={{background:"#F5F0FF",borderRadius:10,padding:"16px",border:"2px dashed #5B3FAA",display:"flex",flexDirection:"column",gap:10,alignItems:"center",justifyContent:"center"}}>
                  <div style={{fontSize:13,fontWeight:700,color:"#1A0B3A"}}>📤 Step 2 — Upload Your File</div>
                  <div style={{fontSize:12,color:"#4A5568",textAlign:"center",lineHeight:1.6}}>Fill the template, save as CSV, upload here.</div>
                  <div style={{fontSize:28}}>📂</div>
                  <label style={{padding:"12px 24px",borderRadius:8,border:"none",background:"#5B3FAA",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",textAlign:"center",width:"100%",boxSizing:"border-box"}}>
                    📤 Select CSV & Upload
                    <input type="file" accept=".csv" style={{display:"none"}} onChange={async(e)=>{
                      const file=e.target.files[0]; if(!file) return;
                      const text=await file.text();
                      const rows=text.trim().split("\n");
                      const headers=rows[0].split(",").map(h=>h.trim().replace(/"/g,"").toLowerCase());
                      const records=rows.slice(1).filter(r=>r.trim()).map(row=>{
                        const vals=row.split(",").map(v=>v.trim().replace(/"/g,""));
                        const rec={}; headers.forEach((h,i)=>{rec[h]=vals[i]||null;}); return rec;
                      });
                      if(!records.length){showToast("No data rows found","error");return;}
                      if(!records[0].full_name){showToast("full_name column is required","error");return;}
                      const payload=records.map(r=>({
                        full_name:r.full_name, phone:r.phone||null, email:r.email||null,
                        nationality:r.nationality||null, id_type:r.id_type||"Emirates ID",
                        id_number:r.id_number||null, id_expiry:r.id_expiry||null,
                        tenant_type:r.tenant_type||"Individual", notes:r.notes||null,
                        company_id:cid, created_by:currentUser.id
                      }));
                      const{data:newT,error}=await supabase.from("tenants").insert(payload).select();
                      if(error){showToast(error.message,"error");return;}
                      setTenants(p=>[...p,...(newT||[])].sort((a,b)=>a.full_name.localeCompare(b.full_name)));
                      showToast(`✓ ${newT?.length||0} tenants uploaded`,"success");
                      setShowTenantUpload(false);
                    }}/>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Add/Edit Tenant Modal */}      {showAddTenant&&(
        <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:"1rem"}}>
          <div style={{background:"#fff",borderRadius:16,width:520,maxWidth:"100%",maxHeight:"90vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 20px 60px rgba(11,31,58,.35)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"1rem 1.5rem",borderBottom:"1px solid #E2E8F0",background:"linear-gradient(135deg,#1A0B3A,#2D1558)"}}>
              <span style={{fontFamily:"'Playfair Display',serif",fontSize:16,fontWeight:700,color:"#fff"}}>{editTenant?"Edit":"New"} Tenant</span>
              <button onClick={()=>{setShowAddTenant(false);setEditTenant(null);}} style={{background:"none",border:"none",fontSize:22,color:"#C9A84C",cursor:"pointer"}}>×</button>
            </div>
            <div style={{overflowY:"auto",padding:"1.25rem 1.5rem"}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div style={{gridColumn:"1/-1"}}><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Full Name *</label><input value={tForm.full_name} onChange={tf("full_name")}/></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Phone</label><input value={tForm.phone} onChange={tf("phone")}/></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Email</label><input type="email" value={tForm.email} onChange={tf("email")}/></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Nationality</label><input value={tForm.nationality} onChange={tf("nationality")}/></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Tenant Type</label>
                  <select value={tForm.tenant_type} onChange={tf("tenant_type")}><option>Individual</option><option>Company</option></select></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>ID Type</label>
                  <select value={tForm.id_type} onChange={tf("id_type")}><option>Emirates ID</option><option>Passport</option><option>Trade License</option></select></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>ID Number</label><input value={tForm.id_number} onChange={tf("id_number")}/></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>ID Expiry</label><input type="date" value={tForm.id_expiry} onChange={tf("id_expiry")}/></div>
                <div style={{gridColumn:"1/-1"}}><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Notes</label><textarea value={tForm.notes} onChange={tf("notes")} rows={2}/></div>
              </div>
            </div>
            <div style={{display:"flex",gap:10,justifyContent:"flex-end",padding:"1rem 1.5rem",borderTop:"1px solid #E2E8F0"}}>
              <button onClick={()=>{setShowAddTenant(false);setEditTenant(null);}} style={{padding:"9px 18px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancel</button>
              <button onClick={saveTenant} disabled={saving} style={{padding:"9px 24px",borderRadius:8,border:"none",background:saving?"#A0AEC0":"#5B3FAA",color:"#fff",fontSize:13,fontWeight:600,cursor:saving?"not-allowed":"pointer"}}>{saving?"Saving…":editTenant?"Save":"Add Tenant"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ── TENANT DETAIL VIEW ────────────────────────────────────────
  if(view==="tenant"&&selTenant) return (
    <div className="fade-in" style={{display:"flex",flexDirection:"column",height:"100%"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16,flexWrap:"wrap"}}>
        <button onClick={()=>setView("list")} style={{padding:"6px 14px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>← Tenants</button>
        <Av name={selTenant.full_name} size={40} bg="#5B3FAA"/>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontFamily:"'Inter',sans-serif",fontSize:16,fontWeight:700,color:"#0F2540",letterSpacing:"-.4px"}}>{selTenant.full_name}</div>
          <div style={{fontSize:12,color:"#718096"}}>{selTenant.phone} {selTenant.email?`· ${selTenant.email}`:""} {selTenant.nationality?`· ${selTenant.nationality}`:""}</div>
        </div>
        <div style={{display:"flex",gap:6}}>
          {canEdit&&<button onClick={()=>{setTForm({...tBlank,...selTenant});setEditTenant(selTenant);setShowAddTenant(true);}} style={{padding:"6px 14px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>✏ Edit</button>}
          {canEdit&&<button onClick={()=>{setOppForm({title:"",unit_id:"",budget:"",assigned_to:currentUser.id,notes:"",property_category:"Off-Plan"});setShowAddOpp(true);}} style={{padding:"6px 14px",borderRadius:8,border:"none",background:"#5B3FAA",color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>+ New Enquiry</button>}
        </div>
      </div>

      {/* Tenant info strip */}
      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
        {[["📞",selTenant.phone||"—"],["✉",selTenant.email||"—"],["🌍",selTenant.nationality||"—"],["🪪",selTenant.id_type||"—"],["🏢",selTenant.tenant_type||"—"]].map(([l,v])=>(
          <div key={l} style={{background:"#F7F9FC",borderRadius:8,padding:"8px 14px",flex:1,minWidth:100}}>
            <div style={{fontSize:9,color:"#A0AEC0",textTransform:"uppercase",letterSpacing:".5px",fontWeight:600,marginBottom:3}}>{l}</div>
            <div style={{fontSize:13,fontWeight:600,color:"#0F2540",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:700,color:"#0F2540",marginBottom:12}}>Lease Enquiries ({tenantOpps.length})</div>

      <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:8}}>
        {tenantOpps.length===0&&(
          <div style={{textAlign:"center",padding:"3rem",color:"#A0AEC0"}}>
            <div style={{fontSize:36,marginBottom:10}}>🔑</div>
            <div style={{fontSize:14,fontWeight:600,color:"#0F2540",marginBottom:6}}>No enquiries yet</div>
            <div style={{fontSize:12,marginBottom:16}}>Add an enquiry for each unit this tenant is interested in</div>
            {canEdit&&<button onClick={()=>{setOppForm({title:"",unit_id:"",budget:"",assigned_to:currentUser.id,notes:"",property_category:"Off-Plan"});setShowAddOpp(true);}} style={{padding:"10px 24px",borderRadius:8,border:"none",background:"#5B3FAA",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>+ Add First Enquiry</button>}
          </div>
        )}
        {tenantOpps.map(opp=>{
          const unit=units.find(u=>u.id===opp.unit_id);
          const proj=unit?projects.find(p=>p.id===unit.project_id):null;
          const lp=unit?leasePricing.find(l=>l.unit_id===unit.id):null;
          const sm3=LEASE_STAGE_META[opp.stage]||{c:"#718096",bg:"#F7F9FC"};
          const agent=users.find(u=>u.id===opp.assigned_to);
          return (
            <div key={opp.id} onClick={()=>{setSelOpp(opp);setView("opportunity");}}
              style={{background:"#fff",border:"1.5px solid #E2E8F0",borderRadius:12,padding:"14px 16px",cursor:"pointer",borderLeft:`4px solid ${sm3.c}`,transition:"all .12s"}}
              onMouseOver={e=>{e.currentTarget.style.boxShadow="0 4px 16px rgba(0,0,0,.08)";e.currentTarget.style.transform="translateY(-1px)";}}
              onMouseOut={e=>{e.currentTarget.style.boxShadow="none";e.currentTarget.style.transform="none";}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:4}}>
                    <span style={{fontWeight:700,fontSize:14,color:"#0F2540"}}>{opp.title||"Lease Enquiry"}</span>
                    <span style={{fontSize:11,fontWeight:600,padding:"2px 9px",borderRadius:20,background:sm3.bg,color:sm3.c}}>{opp.stage}</span>
                    {opp.status==="Won"&&<span style={{fontSize:11,fontWeight:600,padding:"2px 9px",borderRadius:20,background:"#E6F4EE",color:"#1A7F5A"}}>✓ Signed</span>}
                  </div>
                  {unit&&<div style={{fontSize:12,color:"#4A5568",marginBottom:2}}>🏠 {unit.unit_ref} — {unit.sub_type}{proj?` · ${proj.name}`:""}</div>}
                  {lp&&<div style={{fontSize:13,fontWeight:700,color:"#5B3FAA"}}>AED {Number(lp.annual_rent).toLocaleString()} / yr</div>}
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontSize:11,color:"#A0AEC0"}}>{agent?.full_name||"Unassigned"}</div>
                  <div style={{fontSize:11,color:"#A0AEC0",marginTop:2}}>{opp.stage_updated_at?Math.floor((new Date()-new Date(opp.stage_updated_at))/864e5)+"d in stage":""}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Enquiry Modal */}
      {showAddOpp&&(
        <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,.65)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1100,padding:"1rem"}}>
          <div style={{background:"#fff",borderRadius:16,width:500,maxWidth:"100%",maxHeight:"90vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 24px 64px rgba(11,31,58,.4)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"1rem 1.5rem",borderBottom:"1px solid #E2E8F0",background:"linear-gradient(135deg,#1A0B3A,#2D1558)"}}>
              <div>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:16,fontWeight:700,color:"#fff"}}>🔑 New Lease Enquiry</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,.5)",marginTop:2}}>for {selTenant.full_name}</div>
              </div>
              <button onClick={()=>setShowAddOpp(false)} style={{background:"none",border:"none",fontSize:22,color:"#C9A84C",cursor:"pointer"}}>×</button>
            </div>
            <div style={{overflowY:"auto",padding:"1.25rem 1.5rem",flex:1}}>
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Title</label><input value={oppForm.title} onChange={e=>setOppForm(f=>({...f,title:e.target.value}))} placeholder="Auto-filled from unit"/></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Unit *</label>
                  <select value={oppForm.unit_id} onChange={e=>{
                    const u=units.find(x=>x.id===e.target.value);
                    setOppForm(f=>({...f,unit_id:e.target.value,title:u&&!f.title?`${u.unit_ref} — ${selTenant?.full_name||""}`:f.title}));
                  }}>
                    <option value="">— Select unit —</option>
                    {units.filter(u=>u.status==="Available"&&(u.purpose==="Lease"||u.purpose==="Both")).map(u=>{
                      const lp2=leasePricing.find(l=>l.unit_id===u.id);
                      const pr=projects.find(p=>p.id===u.project_id);
                      return <option key={u.id} value={u.id}>{u.unit_ref} · {u.sub_type} · {pr?.name||"—"}{lp2?` · AED ${Math.round(lp2.annual_rent/1000)}K/yr`:""}</option>;
                    })}
                  </select>
                </div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Budget (AED/yr)</label><input type="number" value={oppForm.budget} onChange={e=>setOppForm(f=>({...f,budget:e.target.value}))} placeholder="Annual budget"/></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Assign To</label>
                  <select value={oppForm.assigned_to} onChange={e=>setOppForm(f=>({...f,assigned_to:e.target.value}))}>
                    {users.filter(u=>u.is_active).map(u=><option key={u.id} value={u.id}>{u.full_name}</option>)}
                  </select></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Notes</label><textarea value={oppForm.notes} onChange={e=>setOppForm(f=>({...f,notes:e.target.value}))} rows={3}/></div>
              </div>
            </div>
            <div style={{display:"flex",gap:10,justifyContent:"flex-end",padding:"1rem 1.5rem",borderTop:"1px solid #E2E8F0"}}>
              <button onClick={()=>setShowAddOpp(false)} style={{padding:"9px 18px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancel</button>
              <button onClick={saveOpp} disabled={saving} style={{padding:"9px 24px",borderRadius:8,border:"none",background:saving?"#A0AEC0":"#5B3FAA",color:"#fff",fontSize:13,fontWeight:600,cursor:saving?"not-allowed":"pointer"}}>{saving?"Saving…":"Create Enquiry"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ── OPPORTUNITY DETAIL ────────────────────────────────────────
  if(view==="opportunity"&&selOpp) return (
    <LeaseOpportunityDetail
      opp={selOpp}
      tenant={selTenant||tenants.find(t=>t.id===selOpp.tenant_id)||{full_name:"Tenant"}}
      units={units}
      projects={projects}
      leasePricing={leasePricing}
      users={users}
      currentUser={currentUser}
      showToast={showToast}
      onBack={()=>{setView("tenant");setSelOpp(null);}}
      onUpdated={(updated)=>{
        setSelOpp(updated);
        setLOpps(p=>p.map(o=>o.id===updated.id?updated:o));
      }}
    />
  );

  return null;
}



// ══════════════════════════════════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════════════════════════════════


export default LeasingLeads;
