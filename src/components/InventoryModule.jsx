import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
// Role-based permission check.
// Mirrors the can() defined in App.jsx — kept in sync here because
// App.jsx's version is not exported. If you change roles/permissions
// in App.jsx, update the table below too.
const can = (role, action) => ({
  super_admin:    ["read","write","delete","manage_users","see_all","delete_leads","approve_all","approve_manager","view_sales","view_leasing","request_discount","manage_companies","manage_inventory","reserve_unit"],
  admin:          ["read","write","delete","manage_users","see_all","delete_leads","approve_all","approve_manager","view_sales","view_leasing","request_discount","manage_inventory","reserve_unit"],
  sales_manager:  ["read","write","delete","see_all","delete_leads","approve_manager","view_sales","request_discount","manage_inventory","reserve_unit"],
  sales_agent:    ["read","write","view_sales","request_discount","reserve_unit"],
  leasing_manager:["read","write","delete","see_all","delete_leads","approve_manager","view_leasing","request_discount","manage_inventory","reserve_unit"],
  leasing_agent:  ["read","write","view_leasing","reserve_unit"],
  viewer:         ["read","view_sales","view_leasing"],
}[role]||[]).includes(action);

// Master dropdown lists. Mirrors the MASTER object in App.jsx — not exported there.
const MASTER = {
  unit_type:    ["Residential","Commercial"],
  sub_type_res: ["Studio","1 Bed","2 Bed","3 Bed","4 Bed","5 Bed","6 Bed+","Penthouse","Duplex","Triplex","Villa","Townhouse","Loft"],
  sub_type_com: ["Office","Retail / Shop","Restaurant","Warehouse","Labour Camp","Hotel Apartment","Showroom","Medical Centre"],
  sub_type_all: ["Studio","1 Bed","2 Bed","3 Bed","4 Bed","5 Bed","6 Bed+","Penthouse","Duplex","Triplex","Villa","Townhouse","Loft","Office","Retail / Shop","Restaurant","Warehouse","Labour Camp","Hotel Apartment","Showroom"],
  purpose:      ["Sale","Lease","Both"],
  status:       ["Available","Reserved","Under Offer","Sold","Leased","Blocked","Cancelled"],
  view:         ["Sea View","Pool View","Garden View","City View","Golf View","Park View","Community View","Burj View","Creek View","Lake View","Boulevard View","No View"],
  furnishing:   ["Unfurnished","Semi-Furnished","Fully Furnished","Serviced"],
  condition:    ["Off-plan","Shell & Core","Ready","Renovated","Brand New"],
  facing:       ["North","South","East","West","North-East","North-West","South-East","South-West"],
  nationality:  ["Emirati","Saudi","Egyptian","Indian","Pakistani","British","Russian","Chinese","American","European","Other"],
  id_type:      ["Emirates ID","Passport","GCC ID","Residence Visa"],
  tenant_type:  ["Individual","Corporate"],
  cheques:      ["1","2","4","6","12"],
  payment_method: ["Cash","Cheque","Bank Transfer","Card","Crypto"],
  lead_source:  ["Referral","Website","Property Finder","Bayut","Dubizzle","Cold Call","Event","Social Media","WhatsApp","Walk-in","Agency","Developer","Other"],
  company_type: ["Brokerage","Developer","Real Estate Agent","Property Management","Off-Plan Specialist","Leasing Company","RERA Registered Agency","Investment Company","Other"],
};

// Colour tokens for unit status badges. Mirrors App.jsx.
const UNIT_STATUS_COLORS = {
  Available:     {c:"#1A7F5A", bg:"#E6F4EE"},
  Reserved:      {c:"#A06810", bg:"#FDF3DC"},
  "Under Offer": {c:"#5B3FAA", bg:"#EEE8F9"},
  Sold:          {c:"#1A5FA8", bg:"#E6EFF9"},
  Leased:        {c:"#1A5FA8", bg:"#E6EFF9"},
  Cancelled:     {c:"#718096", bg:"#F7F9FC"},
};

function InventoryModule({ currentUser, showToast, crmContext="sales", preloadedUnits=null, preloadedProjects=null, preloadedSalePricing=null, preloadedLeasePricing=null, activeCompanyId=null, globalOpps=[], initialFilter=null }) {
  // Company ID for all security filtering
  const activeCid = activeCompanyId || currentUser.company_id || localStorage.getItem("propccrm_company_id") || null;
  const [units,       setUnits]       = useState(preloadedUnits||[]);
  const [projects,    setProjects]    = useState(preloadedProjects||[]);
  const [salePricing, setSalePricing] = useState(preloadedSalePricing||[]);
  const [leasePricing,setLeasePricing]= useState(preloadedLeasePricing||[]);
  const [loading,     setLoading]     = useState(!preloadedUnits);
  const [selUnit,     setSelUnit]     = useState(null);
  const [activeTab,   setActiveTab]   = useState("details");
  // Filters
  const [fSearch,  setFSearch]  = useState("");
  const [fProject, setFProject] = useState("All");
  const [fType,    setFType]    = useState("All");
  const [fCat,     setFCat]     = useState("All");
  const [fStatus,  setFStatus]  = useState(initialFilter?.type==="status"?initialFilter.value:"All");
  const [fBeds,    setFBeds]    = useState("All");
  const [fPurpose, setFPurpose] = useState(crmContext==="leasing"?"Lease":crmContext==="sales"?"Sale":"All");
  const [fCategory, setFCategory] = useState("All"); // All | Residential | Commercial
  const [fPriceMin,setFPriceMin]= useState("");
  const [fPriceMax,setFPriceMax]= useState("");
  // Unit form
  const [showUnitForm, setShowUnitForm] = useState(false);
  const [editUnit,     setEditUnit]     = useState(null);
  const [saving,       setSaving]       = useState(false);
  const [uploading,    setUploading]    = useState(false);
  const [scanResult,   setScanResult]   = useState(null);
  const [scanning,     setScanning]     = useState(false);
  const [showReserve,  setShowReserve]  = useState(false);
  const [reserveUnit,  setReserveUnit]  = useState(null);
  const [reservations, setReservations] = useState([]);
  const [tenants,      setTenants]      = useState([]);
  const [leads,        setLeads]        = useState([]);

  const canEdit    = ["super_admin","admin","sales_manager","leasing_manager"].includes(currentUser.role);
  const canReserve = can(currentUser.role,"reserve_unit");
  const canManageInv = ["super_admin","admin","sales_manager","leasing_manager"].includes(currentUser.role);
  const [showInvExcel, setShowInvExcel] = useState(false);
  const [invProjId, setInvProjId] = useState("");

  const uBlank = {
    unit_ref:"",unit_type:"Residential",sub_type:"1 Bed",
    purpose:crmContext==="leasing"?"Lease":"Sale",
    floor_number:"",block_or_tower:"",view:"",facing:"",
    size_sqft:"",bedrooms:"1",bathrooms:"1",parking_spaces:"0",
    maid_room:false,private_pool:false,private_garden:false,
    furnishing:"Unfurnished",condition:"Off-plan",handover_date:"",
    status:"Available",notes:"",fit_out:"",
    // Sale pricing
    asking_price:"",price_per_sqft:"",dld_fee_pct:"4",agency_fee_pct:"2",
    booking_pct:"10",during_construction_pct:"40",on_handover_pct:"50",
    post_handover_pct:"0",
    // Lease pricing
    annual_rent:"",security_deposit:"",cheques_allowed:"4",chiller_included:false,
    municipality_tax_pct:"5",
    // Documents
    floor_plan_url:"",brochure_url:"",render_url:"",
    project_id:"",
  };
  const [uForm, setUForm] = useState(uBlank);
  const uf = k => e => setUForm(f=>({...f,[k]:typeof e==="boolean"?e:e.target?.value??e}));

  const load = useCallback(async(force=false)=>{
    // Use pre-loaded central data — render instantly, fetch small tables in background
    if(!force && preloadedUnits && preloadedProjects) {
      setUnits(preloadedUnits);
      setProjects(preloadedProjects);
      setSalePricing(preloadedSalePricing||[]);
      setLeasePricing(preloadedLeasePricing||[]);
      setLoading(false); // Show immediately
      // Load small tables in background (non-blocking)
      Promise.all([
        supabase.from("reservations").select("*").in("status",["Active","Extended","Confirmed"]).then(r=>r).catch(()=>({data:[]})),
        supabase.from("leads").select("id,name,phone,email,nationality,stage").then(r=>r).catch(()=>({data:[]})),
        supabase.from("tenants").select("id,full_name,phone,email").then(r=>r).catch(()=>({data:[]})),
      ]).then(([res,lds,tns])=>{
        setReservations(res.data||[]);
        setLeads(lds.data||[]);
        setTenants(tns.data||[]);
      });
      return;
    }
    // Fallback: fetch everything
    setLoading(true);
    try {
      const safe = q => q.catch(()=>({data:[]}));
      const [u,p,sp,lp,res,lds,tns] = await Promise.all([
        safe(supabase.from("project_units").select("*").order("unit_ref")),
        safe(supabase.from("projects").select("*").order("name")),
        safe(supabase.from("unit_sale_pricing").select("*")),
        safe(supabase.from("unit_lease_pricing").select("*")),
        safe(supabase.from("reservations").select("*").in("status",["Active","Extended","Confirmed"])),
        safe(supabase.from("leads").select("id,name,phone,email,nationality,stage")),
        safe(supabase.from("tenants").select("id,full_name,phone,email")),
      ]);
      setUnits(u.data||[]);
      setProjects(p.data||[]);
      setSalePricing(sp.data||[]);
      setLeasePricing(lp.data||[]);
      setReservations(res.data||[]);
      setLeads(lds.data||[]);
      setTenants(tns.data||[]);
    } catch(e) {
      console.error("Inventory load error:", e);
    }
    setLoading(false);
  },[preloadedUnits, preloadedProjects, preloadedSalePricing, preloadedLeasePricing]);

  useEffect(()=>{ load(); },[load]);

  // Security: only show projects belonging to active company.
  // Strictly company-scoped — raw PropPulse catalog rows (company_id=null)
  // stay in the PropPulse tab. They enter this view only after being
  // imported (which stamps the tenant's company_id on the clone).
  const companyProjects = activeCid
    ? projects.filter(p=>p.company_id===activeCid)
    : projects;

  // Filtered units
  const allFiltered = units.filter(u=>{
    if(crmContext==="sales"   && u.purpose==="Lease") return false;
    if(crmContext==="leasing" && u.purpose==="Sale")  return false;
    const q=fSearch.toLowerCase().trim();
    const proj=projects.find(p=>p.id===u.project_id);
    const sp=salePricing.find(s=>s.unit_id===u.id);
    const lp=leasePricing.find(l=>l.unit_id===u.id);
    const price=sp?.asking_price||lp?.annual_rent||0;
    // Universal search — searches across all key fields
    if(q&&![
      u.unit_ref, proj?.name, proj?.developer, proj?.location, proj?.community,
      u.view, u.sub_type, u.unit_type, u.floor_number?.toString(),
      u.block_or_tower, u.status, u.bedrooms?.toString(), u.notes,
      u.furnishing, u.condition, sp?.asking_price?.toString(), lp?.annual_rent?.toString()
    ].some(f=>f?.toLowerCase().includes(q))) return false;
    if(fProject!=="All"&&u.project_id!==fProject) return false;
    if(fType!=="All"&&u.unit_type!==fType) return false;
    if(fCategory==="Residential"&&!["Residential","Villa","Flat","Penthouse","Townhouse","Duplex","Studio"].includes(u.unit_type)) return false;
    if(fCategory==="Commercial"&&!["Office","Warehouse","Plot","Commercial Unit","Retail"].includes(u.unit_type)) return false;
    if(fCat!=="All"&&u.sub_type!==fCat) return false;
    if(fStatus!=="All"&&u.status!==fStatus) return false;
    if(fBeds!=="All"){if(fBeds==="Studio"&&u.bedrooms!==0)return false;if(fBeds!=="Studio"&&String(u.bedrooms)!==fBeds)return false;}
    if(fPurpose!=="All"&&u.purpose!==fPurpose&&u.purpose!=="Both") return false;
    if(fPriceMin&&price<Number(fPriceMin)) return false;
    if(fPriceMax&&price>Number(fPriceMax)) return false;
    return true;
  });

  const allSubTypes=[...new Set(units.map(u=>u.sub_type).filter(Boolean))].sort();
  const allViews=[...new Set(units.map(u=>u.view).filter(Boolean))].sort();
  const getSP=id=>salePricing.find(s=>s.unit_id===id);
  const getLP=id=>leasePricing.find(l=>l.unit_id===id);

  const resetFilters=()=>{setFSearch("");setFProject("All");setFType("All");setFCat("All");setFStatus("All");setFBeds("All");setFCategory("All");setFPurpose(crmContext==="leasing"?"Lease":crmContext==="sales"?"Sale":"All");setFPriceMin("");setFPriceMax("");}

  const openUnit=(unit)=>{setSelUnit(unit);setActiveTab("details");}
  const openAdd=(projId="")=>{setUForm({...uBlank,project_id:projId||projects[0]?.id||""});setEditUnit(null);setShowUnitForm(true);setActiveTab("details");}
  const openEdit=(unit)=>{
    const sp=getSP(unit.id); const lp=getLP(unit.id);
    setUForm({...uBlank,...unit,
      asking_price:sp?.asking_price||"",price_per_sqft:sp?.price_per_sqft||"",
      dld_fee_pct:sp?.dld_fee_pct||4,agency_fee_pct:sp?.agency_fee_pct||2,
      booking_pct:sp?.booking_pct||10,during_construction_pct:sp?.during_construction_pct||40,
      on_handover_pct:sp?.on_handover_pct||50,post_handover_pct:sp?.post_handover_pct||0,
      annual_rent:lp?.annual_rent||"",security_deposit:lp?.security_deposit||"",
      cheques_allowed:lp?.cheques_allowed||4,chiller_included:lp?.chiller_included||false,
      municipality_tax_pct:lp?.municipality_tax_pct||5,
    });
    setEditUnit(unit);setShowUnitForm(true);setActiveTab("details");
  };

  // Save unit
  const saveUnit=async()=>{
    if(!uForm.project_id){showToast("Select a project","error");return;}
    if(!uForm.unit_ref.trim()){showToast("Unit reference required","error");return;}
    setSaving(true);
    try{
      const unitPayload={
        project_id:uForm.project_id,company_id:currentUser.company_id||null,
        unit_ref:uForm.unit_ref.trim(),unit_type:uForm.unit_type,sub_type:uForm.sub_type,
        purpose:uForm.purpose,floor_number:uForm.floor_number||null,
        block_or_tower:uForm.block_or_tower||null,view:uForm.view||null,
        facing:uForm.facing||null,size_sqft:uForm.size_sqft?Number(uForm.size_sqft):null,
        bedrooms:uForm.unit_type==="Residential"?Number(uForm.bedrooms):null,
        bathrooms:uForm.bathrooms?Number(uForm.bathrooms):null,
        parking_spaces:uForm.parking_spaces?Number(uForm.parking_spaces):0,
        maid_room:!!uForm.maid_room,private_pool:!!uForm.private_pool,private_garden:!!uForm.private_garden,
        furnishing:uForm.furnishing,condition:uForm.condition,
        handover_date:uForm.handover_date||null,
        status:uForm.status,notes:uForm.notes||null,fit_out:uForm.fit_out||null,
        floor_plan_url:uForm.floor_plan_url||null,
        brochure_url:uForm.brochure_url||null,
        render_url:uForm.render_url||null,
      };
      let uid=editUnit?.id;
      if(editUnit){
        const{error}=await supabase.from("project_units").update(unitPayload).eq("id",editUnit.id);
        if(error)throw error;
      } else {
        const{data,error}=await supabase.from("project_units").insert(unitPayload).select().single();
        if(error)throw error;
        uid=data.id;
      }
      // Save sale pricing
      if((uForm.purpose==="Sale"||uForm.purpose==="Both")&&uForm.asking_price){
        const sp={unit_id:uid,project_id:uForm.project_id,company_id:currentUser.company_id||null,
          asking_price:Number(uForm.asking_price),
          price_per_sqft:uForm.size_sqft&&uForm.asking_price?Math.round(Number(uForm.asking_price)/Number(uForm.size_sqft)):null,
          dld_fee_pct:Number(uForm.dld_fee_pct)||4,agency_fee_pct:Number(uForm.agency_fee_pct)||2,
          booking_pct:Number(uForm.booking_pct)||10,during_construction_pct:Number(uForm.during_construction_pct)||40,
          on_handover_pct:Number(uForm.on_handover_pct)||50,post_handover_pct:Number(uForm.post_handover_pct)||0,
        };
        await supabase.from("unit_sale_pricing").upsert(sp,{onConflict:"unit_id"});
      }
      // Save lease pricing
      if((uForm.purpose==="Lease"||uForm.purpose==="Both")&&uForm.annual_rent){
        const lp={unit_id:uid,project_id:uForm.project_id,company_id:currentUser.company_id||null,
          annual_rent:Number(uForm.annual_rent),
          security_deposit:uForm.security_deposit?Number(uForm.security_deposit):Math.round(Number(uForm.annual_rent)*0.05),
          cheques_allowed:Number(uForm.cheques_allowed)||4,
          chiller_included:!!uForm.chiller_included,
          municipality_tax_pct:Number(uForm.municipality_tax_pct)||5,
        };
        await supabase.from("unit_lease_pricing").upsert(lp,{onConflict:"unit_id"});
      }
      showToast(editUnit?"Unit updated":"Unit added","success");
      setShowUnitForm(false);setEditUnit(null);setSelUnit(null);load();
    }catch(e){showToast(e.message,"error");}
    setSaving(false);
  };

  // Upload document to Supabase Storage
  const uploadDoc=async(file,field,unitId)=>{
    if(!file)return;
    setUploading(true);
    try{
      const path=`units/${unitId||"new"}/${field}_${Date.now()}_${file.name}`;
      const{error:ue}=await supabase.storage.from("propcrm-files").upload(path,file,{upsert:true});
      if(ue)throw ue;
      const{data:{publicUrl}}=supabase.storage.from("propcrm-files").getPublicUrl(path);
      setUForm(f=>({...f,[field+"_url"]:publicUrl}));
      if(unitId){
        await supabase.from("project_units").update({[field+"_url"]:publicUrl}).eq("id",unitId);
      }
      showToast("File uploaded","success");
    }catch(e){showToast(e.message,"error");}
    setUploading(false);
  };

  // AI Brochure Scanner
  const scanBrochure=async(file)=>{
    if(!file)return;
    const apiKey=localStorage.getItem("claude_api_key")||localStorage.getItem("ai_keys")?JSON.parse(localStorage.getItem("ai_keys")||"{}").claude:"";
    if(!apiKey){showToast("Add Claude API key in AI Assistant tab first","error");return;}
    setScanning(true);setScanResult(null);
    try{
      // Convert file to base64
      const reader=new FileReader();
      const b64=await new Promise(res=>{reader.onload=e=>res(e.target.result.split(",")[1]);reader.readAsDataURL(file);});
      const isImage=file.type.startsWith("image/");
      const response=await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json","x-api-key":apiKey,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
        body:JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:1500,
          messages:[{role:"user",content:[
            ...(isImage?[{type:"image",source:{type:"base64",media_type:file.type,data:b64}}]:[{type:"document",source:{type:"base64",media_type:"application/pdf",data:b64}}]),
            {type:"text",text:`Extract property/unit details from this builder brochure. Return ONLY a JSON object with these fields (use null for unknown):
{
  "unit_ref": "unit reference/number",
  "sub_type": "Studio/1 Bed/2 Bed/3 Bed/4 Bed/Villa/Penthouse/Townhouse/Office/Retail",
  "size_sqft": number,
  "bedrooms": number (0 for studio),
  "bathrooms": number,
  "floor_number": "floor number or range",
  "view": "sea view/city view/pool view/garden view etc",
  "asking_price": number in AED,
  "annual_rent": number in AED,
  "booking_pct": number (booking deposit %),
  "during_construction_pct": number,
  "on_handover_pct": number,
  "developer": "developer name",
  "project_name": "project/building name",
  "handover_date": "YYYY-MM-DD or year",
  "furnishing": "Furnished/Unfurnished/Semi-Furnished",
  "notes": "any other relevant details"
}
Return ONLY the JSON, no explanation.`}
          ]}]
        })
      });
      if(!response.ok)throw new Error("AI scan failed");
      const data=await response.json();
      const text=data.content[0]?.text||"{}";
      const clean=text.replace(/```json|```/g,"").trim();
      const parsed=JSON.parse(clean);
      setScanResult(parsed);
      showToast("Brochure scanned — review and apply","success");
    }catch(e){showToast(`Scan error: ${e.message}`,"error");}
    setScanning(false);
  };

  const applyScanResult=()=>{
    if(!scanResult)return;
    setUForm(f=>({...f,
      unit_ref:       scanResult.unit_ref||f.unit_ref,
      sub_type:       scanResult.sub_type||f.sub_type,
      size_sqft:      scanResult.size_sqft||f.size_sqft,
      bedrooms:       scanResult.bedrooms!=null?scanResult.bedrooms:f.bedrooms,
      bathrooms:      scanResult.bathrooms||f.bathrooms,
      floor_number:   scanResult.floor_number||f.floor_number,
      view:           scanResult.view||f.view,
      asking_price:   scanResult.asking_price||f.asking_price,
      annual_rent:    scanResult.annual_rent||f.annual_rent,
      booking_pct:    scanResult.booking_pct||f.booking_pct,
      during_construction_pct:scanResult.during_construction_pct||f.during_construction_pct,
      on_handover_pct:scanResult.on_handover_pct||f.on_handover_pct,
      handover_date:  scanResult.handover_date||f.handover_date,
      furnishing:     scanResult.furnishing||f.furnishing,
      notes:          scanResult.notes||f.notes,
    }));
    setScanResult(null);
    showToast("Fields pre-filled — review before saving","success");
    setActiveTab("details");
  };

  const updateUnitStatus=async(uid,status)=>{
    await supabase.from("project_units").update({status}).eq("id",uid);
    setUnits(p=>p.map(u=>u.id===uid?{...u,status}:u));
    if(selUnit?.id===uid)setSelUnit(s=>({...s,status}));
    showToast(`Marked ${status}`,"success");
  };

  if(loading)return <Spinner msg="Loading inventory…"/>;

  const UNIT_ST=["Available","Reserved","Under Offer","Sold","Leased","Cancelled"];
  const PurposeBadge=({p})=>{const c={Sale:{c:"#1A7F5A",bg:"#E6F4EE"},Lease:{c:"#1A5FA8",bg:"#E6EFF9"},Both:{c:"#8A6200",bg:"#FDF3DC"}}[p]||{c:"#718096",bg:"#F7F9FC"};return <span style={{fontSize:10,fontWeight:600,padding:"2px 6px",borderRadius:20,background:c.bg,color:c.c}}>{p}</span>;};

  return (
    <div className="fade-in" style={{display:"flex",flexDirection:"column",height:"100%"}}>
      {/* Top filter bar */}
      <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap",alignItems:"center"}}>
        <input value={fSearch} onChange={e=>setFSearch(e.target.value)} placeholder="🔍 Universal search — unit ref, project, floor, view, price, status…" style={{flex:1,minWidth:150}}/>
        <select value={fProject} onChange={e=>setFProject(e.target.value)} style={{width:"auto",fontSize:12}}>
          <option value="All">All Projects</option>
          {companyProjects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={fType} onChange={e=>{setFType(e.target.value);setFCat("All");}} style={{width:"auto",fontSize:12}}>
          <option value="All">All Types</option>
          {MASTER.unit_type.map(t=><option key={t}>{t}</option>)}
        </select>
        <select value={fCat} onChange={e=>setFCat(e.target.value)} style={{width:"auto",fontSize:12}}>
          <option value="All">All Categories</option>
          <optgroup label="Residential">
            {MASTER.sub_type_res.map(s=><option key={s}>{s}</option>)}
          </optgroup>
          <optgroup label="Commercial">
            {MASTER.sub_type_com.map(s=><option key={s}>{s}</option>)}
          </optgroup>
        </select>
        <select value={fStatus} onChange={e=>setFStatus(e.target.value)} style={{width:"auto",fontSize:12}}>
          <option value="All">All Status</option>
          {MASTER.status.map(s=><option key={s}>{s}</option>)}
        </select>
        {crmContext==="both"&&<select value={fPurpose} onChange={e=>setFPurpose(e.target.value)} style={{width:"auto",fontSize:12}}>
          <option value="All">All</option>
          <option value="Sale">For Sale</option>
          <option value="Lease">For Lease</option>
        </select>}
        <input type="number" value={fPriceMin} onChange={e=>setFPriceMin(e.target.value)} placeholder="Min AED" style={{width:90,fontSize:12}}/>
        <input type="number" value={fPriceMax} onChange={e=>setFPriceMax(e.target.value)} placeholder="Max AED" style={{width:90,fontSize:12}}/>
        <button onClick={resetFilters} style={{padding:"6px 12px",borderRadius:6,border:"1.5px solid #E2E8F0",background:"#F7F9FC",color:"#4A5568",fontSize:12,cursor:"pointer",whiteSpace:"nowrap"}}>✕ Reset</button>
        <span style={{fontSize:11,color:"#A0AEC0",whiteSpace:"nowrap"}}>{allFiltered.length}/{units.length}</span>
      </div>
      {/* Action bar */}
      <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginBottom:8,marginTop:-4,flexWrap:"wrap"}}>
        {/* Export current inventory */}
        {canManageInv&&<button onClick={()=>setShowInvExcel(true)}
          style={{padding:"7px 18px",borderRadius:8,border:"1.5px solid #C9A84C",background:"#FFF9EC",color:"#8A6200",fontSize:12,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>
          📋 Download Template / Upload Data
        </button>}
        {canEdit&&<button onClick={()=>openAdd()}
          style={{padding:"7px 16px",borderRadius:8,border:"none",background:"#0F2540",color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>
          + Add Unit
        </button>}
      </div>



      <div style={{display:"flex",gap:0,flex:1,overflow:"hidden"}}>
        {/* Unit table */}
        <div style={{flex:1,overflowY:"auto",overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,tableLayout:"fixed"}}>
            <colgroup>
              <col style={{width:90}}/>{/* Ref */}
              <col style={{width:140}}/>{/* Project */}
              <col style={{width:50}}/>{/* Type */}
              <col style={{width:100}}/>{/* Category */}
              <col style={{width:60}}/>{/* Purpose */}
              <col style={{width:36}}/>{/* Beds */}
              <col style={{width:70}}/>{/* Sqft */}
              <col style={{width:46}}/>{/* Floor */}
              <col style={{width:90}}/>{/* View */}
              <col style={{width:90}}/>{/* Sale Price */}
              <col style={{width:80}}/>{/* Rent/yr */}
              <col style={{width:70}}/>{/* Handover */}
              <col style={{width:80}}/>{/* Status */}
              <col style={{width:40}}/>{/* Edit */}
            </colgroup>
            <thead style={{position:"sticky",top:0,zIndex:1}}>
              <tr style={{background:"#0F2540"}}>
                {["Ref","Project","T","Category","For","Bd","Sqft","Fl","View","Sale","Rent/yr","Handover","Status",""].map(h=>(
                  <th key={h} style={{padding:"7px 8px",textAlign:"left",fontSize:10,fontWeight:600,color:"#C9A84C",textTransform:"uppercase",letterSpacing:".3px",whiteSpace:"nowrap",overflow:"hidden"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allFiltered.length===0&&(
                <tr><td colSpan={14} style={{textAlign:"center",padding:"2rem",color:"#A0AEC0"}}>No units match filters</td></tr>
              )}
              {allFiltered.map((u,i)=>{
                const sp=getSP(u.id); const lp=getLP(u.id);
                const proj=projects.find(p=>p.id===u.project_id);
                const sc=UNIT_STATUS_COLORS[u.status]||{c:"#718096",bg:"#F7F9FC"};
                const isSel=selUnit?.id===u.id;
                // Use unit handover_date first, then project completion_date
                const hdDate = u.handover_date||proj?.completion_date;
                const hdStr  = hdDate?new Date(hdDate).toLocaleDateString("en-AE",{month:"short",year:"2-digit"}):"";
                return (
                  <tr key={u.id}
                    onClick={()=>openUnit(u)}
                    style={{background:isSel?"#EEF2FF":i%2===0?"#fff":"#FAFBFC",borderBottom:"1px solid #F0F2F5",cursor:"pointer",transition:"background .1s"}}
                    onMouseOver={e=>{if(!isSel)e.currentTarget.style.background="#F0F7FF";}}
                    onMouseOut={e=>{if(!isSel)e.currentTarget.style.background=i%2===0?"#fff":"#FAFBFC";}}>
                    <td style={{padding:"5px 8px",fontWeight:700,color:"#0F2540",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.unit_ref}</td>
                    <td style={{padding:"5px 8px",color:"#4A5568",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{proj?.name||"—"}</td>
                    <td style={{padding:"5px 8px"}}><span style={{fontSize:9,fontWeight:700,padding:"1px 5px",borderRadius:20,background:u.unit_type==="Residential"?"#E6F4EE":"#E6EFF9",color:u.unit_type==="Residential"?"#1A7F5A":"#1A5FA8"}}>{u.unit_type==="Residential"?"R":"C"}</span></td>
                    <td style={{padding:"5px 8px",color:"#4A5568",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.sub_type}</td>
                    <td style={{padding:"5px 8px"}}><PurposeBadge p={u.purpose}/></td>
                    <td style={{padding:"5px 8px",color:"#4A5568",textAlign:"center",fontWeight:600}}>{u.bedrooms===0?"S":u.bedrooms||"—"}</td>
                    <td style={{padding:"5px 8px",color:"#4A5568",whiteSpace:"nowrap"}}>{u.size_sqft?Number(u.size_sqft).toLocaleString():""}</td>
                    <td style={{padding:"5px 8px",color:"#4A5568",textAlign:"center"}}>{u.floor_number??""}</td>
                    <td style={{padding:"5px 8px",color:"#718096",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.view||""}</td>
                    <td style={{padding:"5px 8px",fontWeight:700,color:"#0F2540",whiteSpace:"nowrap"}}>{sp?.asking_price?`${Math.round(sp.asking_price/1000)}K`:""}</td>
                    <td style={{padding:"5px 8px",fontWeight:600,color:"#1A5FA8",whiteSpace:"nowrap"}}>{lp?.annual_rent?`${Math.round(lp.annual_rent/1000)}K`:""}</td>
                    <td style={{padding:"5px 8px",color:"#718096",whiteSpace:"nowrap",fontSize:11}}>{hdStr}</td>
                    <td style={{padding:"5px 8px"}}>
                      <div style={{display:"flex",flexDirection:"column",gap:2}}>
                        <span style={{fontSize:9,fontWeight:600,padding:"2px 6px",borderRadius:20,background:sc.bg,color:sc.c,whiteSpace:"nowrap"}}>{u.status}</span>
                        {(()=>{const r=reservations.find(x=>x.unit_id===u.id&&["Active","Extended"].includes(x.status));return r?<ReservationBadge reservation={r}/>:null;})()}
                      </div>
                    </td>
                    <td style={{padding:"5px 4px"}} onClick={e=>e.stopPropagation()}>
                      {canEdit&&<button onClick={()=>openEdit(u)} style={{fontSize:10,padding:"2px 7px",borderRadius:5,border:"1px solid #E2E8F0",background:"#fff",cursor:"pointer"}}>✏</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Unit detail side panel */}
        {selUnit&&(()=>{
          const sp=getSP(selUnit.id); const lp=getLP(selUnit.id);
          const proj=projects.find(p=>p.id===selUnit.project_id);
          const sc=UNIT_STATUS_COLORS[selUnit.status]||{c:"#718096",bg:"#F7F9FC"};
          return (
            <div className="slide-in" style={{width:340,flexShrink:0,background:"#fff",borderLeft:"1px solid #E2E8F0",display:"flex",flexDirection:"column",overflow:"hidden"}}>
              {/* Panel header */}
              <div style={{background:"#fff",padding:"14px 16px",position:"relative"}}>
                <button onClick={()=>setSelUnit(null)} style={{position:"absolute",top:10,right:12,background:"none",border:"none",color:"#C9A84C",fontSize:20,cursor:"pointer"}}>×</button>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:"#fff",fontWeight:700}}>{selUnit.unit_ref}</div>
                <div style={{fontSize:12,color:"rgba(255,255,255,.6)",marginTop:2}}>{proj?.name} · {selUnit.sub_type}</div>
                <span style={{fontSize:10,fontWeight:600,padding:"3px 10px",borderRadius:20,background:sc.bg,color:sc.c,marginTop:6,display:"inline-block"}}>{selUnit.status}</span>
              </div>
              {/* Tabs */}
              <div style={{display:"flex",borderBottom:"1px solid #E2E8F0"}}>
                {["Details","Pricing","Documents"].map(t=>(
                  <button key={t} onClick={()=>setActiveTab(t.toLowerCase())}
                    style={{flex:1,padding:"8px 4px",border:"none",borderBottom:activeTab===t.toLowerCase()?"2.5px solid #1E3A5F":"2.5px solid transparent",background:"transparent",fontSize:12,fontWeight:activeTab===t.toLowerCase()?700:400,color:activeTab===t.toLowerCase()?"#0F2540":"#718096",cursor:"pointer"}}>
                    {t}
                  </button>
                ))}
              </div>
              <div style={{flex:1,overflowY:"auto",padding:"12px"}}>
                {/* Details tab */}
                {activeTab==="details"&&(
                  <div style={{display:"flex",flexDirection:"column",gap:10}}>
                    {/* Key specs */}
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                      {[
                        ["Type",    selUnit.unit_type],
                        ["Category",selUnit.sub_type],
                        ["Bedrooms",selUnit.bedrooms===0?"Studio":(selUnit.bedrooms||"—")],
                        ["Bathrooms",selUnit.bathrooms||"—"],
                        ["Size",    selUnit.size_sqft?`${Number(selUnit.size_sqft).toLocaleString()} sqft`:"—"],
                        ["Floor",   selUnit.floor_number||"—"],
                        ["View",    selUnit.view||"—"],
                        ["Facing",  selUnit.facing||"—"],
                        ["Parking", selUnit.parking_spaces||"0"],
                        ["Handover",selUnit.handover_date?new Date(selUnit.handover_date).toLocaleDateString("en-AE",{month:"short",year:"numeric"}):"—"],
                      ].map(([l,v])=>(
                        <div key={l} style={{background:"#FAFBFC",borderRadius:7,padding:"8px 10px"}}>
                          <div style={{fontSize:9,color:"#A0AEC0",textTransform:"uppercase",letterSpacing:".5px",marginBottom:2}}>{l}</div>
                          <div style={{fontSize:12,fontWeight:600,color:"#0F2540"}}>{v}</div>
                        </div>
                      ))}
                    </div>
                    {/* Features */}
                    <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                      {selUnit.maid_room&&<span style={{fontSize:10,padding:"2px 7px",borderRadius:20,background:"#F7F9FC",color:"#4A5568"}}>Maid Room</span>}
                      {selUnit.private_pool&&<span style={{fontSize:10,padding:"2px 7px",borderRadius:20,background:"#E6EFF9",color:"#1A5FA8"}}>Private Pool</span>}
                      {selUnit.private_garden&&<span style={{fontSize:10,padding:"2px 7px",borderRadius:20,background:"#E6F4EE",color:"#1A7F5A"}}>Private Garden</span>}
                    </div>
                    {/* Status changer */}
                    {canEdit&&(
                      <div>
                        <div style={{fontSize:10,color:"#A0AEC0",textTransform:"uppercase",letterSpacing:".5px",marginBottom:6}}>Update Status</div>
                        <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                          {UNIT_ST.map(s=>{
                            const sc2=UNIT_STATUS_COLORS[s]||{c:"#718096",bg:"#F7F9FC"};
                            return <button key={s} onClick={()=>updateUnitStatus(selUnit.id,s)}
                              style={{fontSize:10,padding:"4px 9px",borderRadius:20,border:`1.5px solid ${selUnit.status===s?sc2.c:"#E2E8F0"}`,background:selUnit.status===s?sc2.bg:"#fff",color:selUnit.status===s?sc2.c:"#4A5568",cursor:"pointer",fontWeight:selUnit.status===s?700:400}}>
                              {s}
                            </button>;
                          })}
                        </div>
                      </div>
                    )}
                    {selUnit.notes&&<div style={{fontSize:12,color:"#4A5568",padding:"8px 10px",background:"#F7F9FC",borderRadius:8,lineHeight:1.6}}>{selUnit.notes}</div>}
                    {canEdit&&<button onClick={()=>openEdit(selUnit)} style={{padding:"8px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>✏ Edit Unit</button>}
                    {canReserve&&selUnit.status==="Available"&&(()=>{
                      const hp2=!!(salePricing.find(s=>s.unit_id===selUnit.id)||leasePricing.find(l=>l.unit_id===selUnit.id));
                      const pr2=projects.find(p=>p.id===selUnit.project_id);
                      const ok2=hp2&&(!pr2?.launch_date||new Date()>=new Date(pr2.launch_date));
                      return (
                        <button onClick={()=>{
                          if(!hp2){showToast("Add pricing to this unit before reserving","error");return;}
                          if(!ok2){showToast(`Project launches ${new Date(pr2.launch_date).toLocaleDateString("en-AE",{day:"numeric",month:"short",year:"numeric"})} — not open yet`,"error");return;}
                          setReserveUnit(selUnit);setShowReserve(true);
                        }} style={{padding:"8px",borderRadius:8,border:"none",background:ok2?"#C9A84C":"#E2E8F0",color:ok2?"#0F2540":"#A0AEC0",fontSize:12,fontWeight:700,cursor:ok2?"pointer":"not-allowed"}}>
                          {!hp2?"⚠️ No Pricing":!ok2?"🔒 Not Released":"🔒 Reserve Unit"}
                        </button>
                      );
                    })()}
                    {canReserve&&(()=>{const r=reservations.find(x=>x.unit_id===selUnit.id&&["Active","Extended"].includes(x.status));return r?(<button onClick={()=>{setReserveUnit(selUnit);setShowReserve(true);}} style={{padding:"8px",borderRadius:8,border:"1.5px solid #E8C97A",background:"#FDF3DC",color:"#8A6200",fontSize:12,fontWeight:700,cursor:"pointer"}}>⏱ View Reservation ({hoursLeft(r.expires_at,r.extended_until)}h)</button>):null;})()}
                  </div>
                )}
                {/* Pricing tab */}
                {activeTab==="pricing"&&(
                  <div style={{display:"flex",flexDirection:"column",gap:10}}>
                    {sp&&(
                      <div>
                        <div style={{fontSize:11,fontWeight:700,color:"#1A7F5A",textTransform:"uppercase",letterSpacing:".5px",marginBottom:8}}>🏷 Sale Pricing</div>
                        <div style={{background:"#0F2540",borderRadius:10,padding:"12px",marginBottom:8,textAlign:"center"}}>
                          <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:700,color:"#C9A84C"}}>AED {Number(sp.asking_price).toLocaleString()}</div>
                          {sp.price_per_sqft&&<div style={{fontSize:11,color:"rgba(255,255,255,.5)",marginTop:2}}>AED {Number(sp.price_per_sqft).toLocaleString()}/sqft</div>}
                        </div>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                          {[["DLD Fee",`${sp.dld_fee_pct}%`],["Agency Fee",`${sp.agency_fee_pct}%`],["Booking",`${sp.booking_pct}%`],["Construction",`${sp.during_construction_pct}%`],["Handover",`${sp.on_handover_pct}%`],sp.post_handover_pct>0&&["Post Handover",`${sp.post_handover_pct}%`]].filter(Boolean).map(([l,v])=>(
                            <div key={l} style={{background:"#FAFBFC",borderRadius:7,padding:"7px 9px"}}>
                              <div style={{fontSize:9,color:"#A0AEC0",textTransform:"uppercase",letterSpacing:".5px",marginBottom:1}}>{l}</div>
                              <div style={{fontSize:12,fontWeight:700,color:"#0F2540"}}>{v}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {lp&&(
                      <div>
                        <div style={{fontSize:11,fontWeight:700,color:"#1A5FA8",textTransform:"uppercase",letterSpacing:".5px",marginBottom:8}}>🔑 Lease Pricing</div>
                        <div style={{background:"#1A0B3A",borderRadius:10,padding:"12px",marginBottom:8,textAlign:"center"}}>
                          <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:700,color:"#C9A84C"}}>AED {Number(lp.annual_rent).toLocaleString()}/yr</div>
                          <div style={{fontSize:11,color:"rgba(255,255,255,.5)",marginTop:2}}>AED {Math.round(lp.annual_rent/12).toLocaleString()}/month</div>
                        </div>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                          {[["Deposit",`AED ${Number(lp.security_deposit||0).toLocaleString()}`],["Cheques",lp.cheques_allowed],["Municipality",`${lp.municipality_tax_pct}%`],["Chiller",lp.chiller_included?"Included":"Excluded"]].map(([l,v])=>(
                            <div key={l} style={{background:"#FAFBFC",borderRadius:7,padding:"7px 9px"}}>
                              <div style={{fontSize:9,color:"#A0AEC0",textTransform:"uppercase",letterSpacing:".5px",marginBottom:1}}>{l}</div>
                              <div style={{fontSize:12,fontWeight:700,color:"#0F2540"}}>{v}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {!sp&&!lp&&<div style={{textAlign:"center",padding:"1.5rem",color:"#A0AEC0"}}>No pricing set — edit unit to add pricing</div>}
                  </div>
                )}
                {/* Documents tab */}
                {activeTab==="documents"&&(
                  <div style={{display:"flex",flexDirection:"column",gap:10}}>
                    {[
                      {label:"Floor Plan",     field:"floor_plan",     icon:"📐", accept:".pdf,.jpg,.jpeg,.png"},
                      {label:"Unit Brochure",  field:"brochure",       icon:"📄", accept:".pdf,.jpg,.jpeg,.png"},
                      {label:"3D Render",      field:"render",         icon:"🖼", accept:".jpg,.jpeg,.png"},
                    ].map(({label,field,icon,accept})=>{
                      const url=selUnit[field+"_url"];
                      return (
                        <div key={field} style={{background:"#FAFBFC",border:"1px solid #E2E8F0",borderRadius:10,padding:"12px"}}>
                          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                            <span style={{fontSize:13,fontWeight:600,color:"#0F2540"}}>{icon} {label}</span>
                            {url&&<a href={url} target="_blank" rel="noreferrer" style={{fontSize:11,color:"#1A5FA8",fontWeight:600}}>View →</a>}
                          </div>
                          {url?(
                            <div style={{fontSize:11,color:"#1A7F5A"}}>✓ File uploaded</div>
                          ):(
                            <div style={{fontSize:11,color:"#A0AEC0"}}>No file uploaded</div>
                          )}
                          {canEdit&&(
                            <label style={{display:"flex",alignItems:"center",gap:6,marginTop:8,padding:"6px 10px",borderRadius:7,border:"1.5px dashed #D1D9E6",cursor:"pointer",fontSize:11,color:"#4A5568",background:"#fff"}}>
                              <input type="file" accept={accept} style={{display:"none"}} onChange={e=>{if(e.target.files[0])uploadDoc(e.target.files[0],field,selUnit.id);}}/>
                              {uploading?"⏳ Uploading…":"⬆ Upload"}
                            </label>
                          )}
                        </div>
                      );
                    })}
                    {/* AI Scanner */}
                    <div style={{background:"#E6EFF9",border:"1px solid #B5D4F4",borderRadius:10,padding:"12px"}}>
                      <div style={{fontSize:13,fontWeight:700,color:"#0F2540",marginBottom:6}}>✦ AI Brochure Scanner</div>
                      <div style={{fontSize:11,color:"#4A5568",marginBottom:8,lineHeight:1.5}}>Upload a builder brochure (PDF or image) and AI will extract all unit details automatically.</div>
                      <label style={{display:"flex",alignItems:"center",gap:6,padding:"8px 12px",borderRadius:7,border:"1.5px dashed #B5D4F4",cursor:"pointer",fontSize:12,color:"#1A5FA8",background:"#fff",fontWeight:600}}>
                        <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{display:"none"}} onChange={e=>{if(e.target.files[0]){openEdit(selUnit);scanBrochure(e.target.files[0]);}}}/>
                        {scanning?"⏳ Scanning brochure…":"📤 Scan Builder Brochure"}
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Reservation Modal */}
      {/* Inventory Excel Upload Modal */}
      {showInvExcel&&(()=>{
        const cid = currentUser.company_id || localStorage.getItem("propccrm_company_id") || null;
        return (
        <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:"1rem"}}>
          <div style={{background:"#fff",borderRadius:16,width:580,maxWidth:"100%",maxHeight:"92vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(11,31,58,.35)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"1rem 1.5rem",borderBottom:"1px solid #E8EDF4",background:"#fff"}}>
              <span style={{fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:700,color:"#fff"}}>📤 Upload Inventory from Excel</span>
              <button onClick={()=>{setShowInvExcel(false);setInvProjId("");}} style={{background:"none",border:"none",fontSize:22,color:"#C9A84C",cursor:"pointer"}}>×</button>
            </div>
            <div style={{padding:"1.5rem"}}>

              {/* Step 1: Select Project */}
              <div style={{background:"#F0F7FF",borderRadius:10,padding:"14px 16px",marginBottom:16,border:"1px solid #D1E4F7"}}>
                <div style={{fontSize:12,fontWeight:700,color:"#0F2540",marginBottom:8,textTransform:"uppercase",letterSpacing:".5px"}}>Step 1 — Select Project</div>
                <select data-inv-proj defaultValue="" onChange={e=>{setInvProjId(e.target.value);}} style={{width:"100%",borderColor:"#1A5FA8"}}>
                  <option value="">— Select the project for this upload —</option>
                  {companyProjects.map(p=><option key={p.id} value={p.id}>{p.name}{p.developer?` · ${p.developer}`:""}</option>)}
                </select>
                <div style={{fontSize:11,color:"#718096",marginTop:6}}>All units in the uploaded file will be assigned to this project. The project_id column in the template will be ignored.</div>
              </div>

              {/* Step 2: Column guide */}
              <div style={{background:"#F7F9FC",borderRadius:10,padding:"12px 14px",marginBottom:14,border:"1px solid #E2E8F0"}}>
                <div style={{fontSize:12,fontWeight:700,color:"#0F2540",marginBottom:8,textTransform:"uppercase",letterSpacing:".5px"}}>Step 2 — Prepare Your File</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,fontSize:12}}>
                  {[
                    ["unit_ref","Unit number e.g. A-101 (required)"],
                    ["unit_type","Residential / Commercial"],
                    ["sub_type","1 Bed, 2 Bed, Office…"],
                    ["purpose","Sale or Lease"],
                    ["floor_number","Floor number"],
                    ["size_sqft","Size in sq ft"],
                    ["bedrooms","Number of bedrooms"],
                    ["bathrooms","Number of bathrooms"],
                    ["status","Available / Reserved / Sold"],
                    ["view","Sea View, City View…"],
                    ["asking_price","Sale price in AED"],
                    ["annual_rent","Annual rent in AED"],
                  ].map(([col,desc])=>(
                    <div key={col} style={{display:"flex",gap:6,alignItems:"flex-start"}}>
                      <span style={{fontSize:11,fontWeight:700,color:"#0F2540",background:"#E6EFF9",padding:"1px 6px",borderRadius:4,whiteSpace:"nowrap"}}>{col}</span>
                      <span style={{color:"#718096",fontSize:11}}>{desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Download template */}
              {/* Dynamic template with real project IDs */}
              <button onClick={()=>{
                const projRows = companyProjects.slice(0,3).map((p,i)=>[
                  p.id, p.name,
                  `UNIT-${String(i+1).padStart(3,"0")}`,
                  "Residential","2 Bed","Sale",
                  i+1, 1200, 2, 2, "Available", "Sea View", 2500000, ""
                ].map(v=>`"${String(v).replace(/"/g,'""')}"`).join(","));
                // Add sample rows if no projects
                if(projRows.length===0) projRows.push('"","Your Project Name","A-101","Residential","2 Bed","Sale","5","1250","2","2","Available","Sea View","2500000",""');
                const headers = "project_id,project_name,unit_ref,unit_type,sub_type,purpose,floor_number,size_sqft,bedrooms,bathrooms,status,view,asking_price,annual_rent";
                const csv = [headers,...projRows].join("\n");
                const a = document.createElement("a");
                a.href = "data:text/csv;charset=utf-8,"+encodeURIComponent(csv);
                a.download = "propcrm_inventory_template.csv";
                a.click();
              }} style={{display:"inline-block",padding:"8px 16px",borderRadius:8,background:"#E6EFF9",color:"#1A5FA8",fontSize:12,fontWeight:600,textDecoration:"none",marginBottom:14,border:"none",cursor:"pointer"}}>
                ⬇ Download Template (with your project IDs)
              </button>

              {/* Step 3: Upload */}
              <div style={{fontSize:12,fontWeight:700,color:"#0F2540",marginBottom:8,textTransform:"uppercase",letterSpacing:".5px"}}>Step 3 — Upload Your Completed File</div>
              <div style={{background:"#FFF9EC",border:"1px solid #E8C97A",borderRadius:8,padding:"10px 14px",marginBottom:12,fontSize:12,color:"#8A6200"}}>
                💡 <strong>How to use:</strong> Download the template above → fill in your units in Excel/Google Sheets → save as CSV → upload here
              </div>
              <div style={{border:"2px dashed #C9A84C",borderRadius:10,padding:"2rem",textAlign:"center",background:"#FFFBF0"}}>
                <div style={{fontSize:36,marginBottom:8}}>📂</div>
                <div style={{fontSize:14,fontWeight:600,color:"#0F2540",marginBottom:4}}>Click to select your CSV file</div>
              </div>{/* end grid */}

              <div style={{fontSize:11,color:"#A0AEC0",marginTop:12,textAlign:"center"}}>
                🔒 Units are locked to your company. Other companies cannot see this data.
              </div>
            </div>
          </div>
        </div>
        );
      })()}
            {showReserve&&reserveUnit&&(
        <ReservationModal
          unit={reserveUnit}
          reservation={reservations.find(r=>r.unit_id===reserveUnit.id&&["Active","Extended"].includes(r.status))||null}
          opportunities={[...globalOpps]}
          unitHasPrice={!!(salePricing.find(s=>s.unit_id===reserveUnit.id)||leasePricing.find(l=>l.unit_id===reserveUnit.id))}
          unitLaunchDate={(()=>{const proj=projects.find(p=>p.id===reserveUnit.project_id);return proj?.launch_date||null;})()}
          currentUser={currentUser}
          leads={leads}
          tenants={tenants}
          showToast={showToast}
          onClose={()=>{setShowReserve(false);setReserveUnit(null);}}
          onSaved={(saved)=>{
            setReservations(p=>{const ex=p.find(r=>r.id===saved.id);return ex?p.map(r=>r.id===saved.id?saved:r):[...p,saved];});
            if(saved.status==="Confirmed"||saved.status==="Released"){
              const newStatus=saved.status==="Confirmed"?(saved.reservation_type==="Sale"?"Sold":"Leased"):"Available";
              setUnits(p=>p.map(u=>u.id===reserveUnit.id?{...u,status:newStatus}:u));
              if(selUnit?.id===reserveUnit.id)setSelUnit(s=>({...s,status:newStatus}));
            }
            setShowReserve(false);setReserveUnit(null);
          }}
        />
      )}
      {/* Add/Edit Unit Modal */}
      {showUnitForm&&(
        <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:"1rem"}}>
          <div style={{background:"#fff",borderRadius:16,width:640,maxWidth:"100%",maxHeight:"94vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 20px 60px rgba(11,31,58,.35)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"1rem 1.5rem",borderBottom:"1px solid #E8EDF4",background:"#fff"}}>
              <span style={{fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:700,color:"#fff"}}>{editUnit?"Edit Unit":"Add New Unit"}</span>
              <div style={{display:"flex",gap:8}}>
                {["Details","Pricing","Documents","AI Scanner"].map(t=>(
                  <button key={t} onClick={()=>setActiveTab(t.toLowerCase().replace(" ","_"))}
                    style={{padding:"5px 12px",borderRadius:6,border:"none",background:activeTab===t.toLowerCase().replace(" ","_")?"rgba(201,168,76,.3)":"transparent",color:activeTab===t.toLowerCase().replace(" ","_")?"#C9A84C":"rgba(255,255,255,.5)",fontSize:11,fontWeight:600,cursor:"pointer"}}>
                    {t}
                  </button>
                ))}
                <button onClick={()=>{setShowUnitForm(false);setEditUnit(null);setScanResult(null);}} style={{background:"none",border:"none",fontSize:22,color:"#C9A84C",cursor:"pointer",marginLeft:8}}>×</button>
              </div>
            </div>
            <div style={{overflowY:"auto",padding:"1.25rem 1.5rem",flex:1}}>

              {/* DETAILS */}
              {activeTab==="details"&&(
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                  <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>Project *</label><select value={uForm.project_id} onChange={uf("project_id")}><option value="">Select…</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                  <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>Unit Ref *</label><input value={uForm.unit_ref} onChange={uf("unit_ref")} placeholder="e.g. A-101"/></div>
                  <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>Type</label><select value={uForm.unit_type} onChange={uf("unit_type")}><option>Residential</option><option>Commercial</option></select></div>
                  <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>Category</label>
                    <select value={uForm.sub_type} onChange={uf("sub_type")}>
                      {uForm.unit_type==="Residential"?["Studio","1 Bed","2 Bed","3 Bed","4 Bed","5 Bed","6 Bed","Villa","Townhouse","Penthouse","Duplex"].map(s=><option key={s}>{s}</option>):["Office","Retail / Shop","Warehouse","Restaurant","Hotel Apartment","Labour Camp"].map(s=><option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>Purpose</label><select value={uForm.purpose} onChange={uf("purpose")}><option>Sale</option><option>Lease</option><option>Both</option></select></div>
                  <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>Status</label><select value={uForm.status} onChange={uf("status")}>{MASTER.status.map(s=><option key={s}>{s}</option>)}</select></div>
                  {uForm.unit_type==="Residential"&&<div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>Bedrooms</label><select value={uForm.bedrooms} onChange={uf("bedrooms")}><option value="0">Studio</option>{[1,2,3,4,5,6,7].map(n=><option key={n} value={n}>{n}</option>)}</select></div>}
                  <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>Bathrooms</label><input type="number" value={uForm.bathrooms} onChange={uf("bathrooms")}/></div>
                  <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>Size (sqft)</label><input type="number" value={uForm.size_sqft} onChange={uf("size_sqft")}/></div>
                  <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>Floor</label><input value={uForm.floor_number} onChange={uf("floor_number")} placeholder="e.g. 12"/></div>
                  <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>View</label><input value={uForm.view} onChange={uf("view")} placeholder="Sea View, City View…"/></div>
                  <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>Parking</label><input type="number" value={uForm.parking_spaces} onChange={uf("parking_spaces")}/></div>
                  <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>Furnishing</label><select value={uForm.furnishing} onChange={uf("furnishing")}>{["Unfurnished","Furnished","Semi-Furnished"].map(s=><option key={s}>{s}</option>)}</select></div>
                  <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>Condition</label><select value={uForm.condition} onChange={uf("condition")}>{["Off-plan","Ready","Under Construction","Renovation"].map(s=><option key={s}>{s}</option>)}</select></div>
                  <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>Handover Date</label><input type="date" value={uForm.handover_date} onChange={uf("handover_date")}/></div>
                  <div style={{gridColumn:"1/-1",display:"flex",gap:16,flexWrap:"wrap"}}>
                    {[["Maid Room","maid_room"],["Private Pool","private_pool"],["Private Garden","private_garden"]].map(([l,f])=>(
                      <label key={f} style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:13}}>
                        <input type="checkbox" checked={!!uForm[f]} onChange={e=>setUForm(x=>({...x,[f]:e.target.checked}))} style={{width:15,height:15,accentColor:"#1A7F5A"}}/>
                        {l}
                      </label>
                    ))}
                  </div>
                  <div style={{gridColumn:"1/-1"}}><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>Notes</label><textarea value={uForm.notes} onChange={uf("notes")} rows={2}/></div>
                </div>
              )}

              {/* PRICING */}
              {activeTab==="pricing"&&(
                <div style={{display:"flex",flexDirection:"column",gap:16}}>
                  {(uForm.purpose==="Sale"||uForm.purpose==="Both")&&(
                    <div>
                      <div style={{fontSize:12,fontWeight:700,color:"#1A7F5A",marginBottom:12,padding:"8px 12px",background:"#E6F4EE",borderRadius:8}}>🏷 Sale Pricing</div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                        <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>Asking Price (AED)</label><input type="number" value={uForm.asking_price} onChange={uf("asking_price")} placeholder="2500000"/></div>
                        <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>DLD Fee %</label><input type="number" value={uForm.dld_fee_pct} onChange={uf("dld_fee_pct")}/></div>
                        <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>Agency Fee %</label><input type="number" value={uForm.agency_fee_pct} onChange={uf("agency_fee_pct")}/></div>
                        <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>Booking %</label><input type="number" value={uForm.booking_pct} onChange={uf("booking_pct")}/></div>
                        <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>During Construction %</label><input type="number" value={uForm.during_construction_pct} onChange={uf("during_construction_pct")}/></div>
                        <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>On Handover %</label><input type="number" value={uForm.on_handover_pct} onChange={uf("on_handover_pct")}/></div>
                        <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>Post Handover %</label><input type="number" value={uForm.post_handover_pct} onChange={uf("post_handover_pct")}/></div>
                      </div>
                    </div>
                  )}
                  {(uForm.purpose==="Lease"||uForm.purpose==="Both")&&(
                    <div>
                      <div style={{fontSize:12,fontWeight:700,color:"#1A5FA8",marginBottom:12,padding:"8px 12px",background:"#E6EFF9",borderRadius:8}}>🔑 Lease Pricing</div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                        <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>Annual Rent (AED)</label><input type="number" value={uForm.annual_rent} onChange={uf("annual_rent")} placeholder="120000"/></div>
                        <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>Security Deposit (AED)</label><input type="number" value={uForm.security_deposit} onChange={uf("security_deposit")}/></div>
                        <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>Cheques Allowed</label><select value={uForm.cheques_allowed} onChange={uf("cheques_allowed")}>{[1,2,3,4,6,12].map(n=><option key={n} value={n}>{n}</option>)}</select></div>
                        <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>Municipality Tax %</label><input type="number" value={uForm.municipality_tax_pct} onChange={uf("municipality_tax_pct")}/></div>
                        <div style={{gridColumn:"1/-1"}}>
                          <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:13}}>
                            <input type="checkbox" checked={!!uForm.chiller_included} onChange={e=>setUForm(f=>({...f,chiller_included:e.target.checked}))} style={{width:15,height:15,accentColor:"#1A5FA8"}}/>
                            Chiller (District Cooling) Included
                          </label>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* DOCUMENTS */}
              {activeTab==="documents"&&(
                <div style={{display:"flex",flexDirection:"column",gap:12}}>
                  {[{label:"Floor Plan",field:"floor_plan",icon:"📐"},{label:"Unit Brochure",field:"brochure",icon:"📄"},{label:"3D Render / Photo",field:"render",icon:"🖼"}].map(({label,field,icon})=>(
                    <div key={field} style={{background:"#FAFBFC",border:"1px solid #E2E8F0",borderRadius:10,padding:"12px"}}>
                      <div style={{fontSize:13,fontWeight:600,color:"#0F2540",marginBottom:8}}>{icon} {label}</div>
                      {uForm[field+"_url"]?(
                        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                          <span style={{fontSize:12,color:"#1A7F5A"}}>✓ File ready</span>
                          <a href={uForm[field+"_url"]} target="_blank" rel="noreferrer" style={{fontSize:11,color:"#1A5FA8"}}>Preview →</a>
                          <button onClick={()=>setUForm(f=>({...f,[field+"_url"]:""}))} style={{fontSize:11,color:"#B83232",background:"none",border:"none",cursor:"pointer"}}>× Remove</button>
                        </div>
                      ):(
                        <div style={{fontSize:12,color:"#A0AEC0",marginBottom:8}}>No file uploaded</div>
                      )}
                      <label style={{display:"flex",alignItems:"center",gap:6,padding:"7px 12px",borderRadius:7,border:"1.5px dashed #D1D9E6",cursor:"pointer",fontSize:12,color:"#4A5568",background:"#fff"}}>
                        <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{display:"none"}} onChange={e=>{if(e.target.files[0])uploadDoc(e.target.files[0],field,editUnit?.id);}}/>
                        {uploading?"⏳ Uploading…":"⬆ Upload "+label}
                      </label>
                    </div>
                  ))}
                </div>
              )}

              {/* AI SCANNER */}
              {activeTab==="ai_scanner"&&(
                <div style={{display:"flex",flexDirection:"column",gap:14}}>
                  <div style={{background:"#E6EFF9",borderRadius:10,padding:"14px"}}>
                    <div style={{fontSize:14,fontWeight:700,color:"#0F2540",marginBottom:6}}>✦ AI Brochure Scanner</div>
                    <div style={{fontSize:13,color:"#4A5568",lineHeight:1.7,marginBottom:12}}>
                      Upload a builder brochure, floor plan PDF, or any document. Claude AI will read it and automatically extract all property details — size, beds, views, pricing, payment plan — ready for you to review and save.
                    </div>
                    <label style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:"16px",borderRadius:10,border:"2px dashed #B5D4F4",cursor:"pointer",fontSize:13,color:"#1A5FA8",fontWeight:600,background:"#fff"}}>
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{display:"none"}} onChange={e=>{if(e.target.files[0])scanBrochure(e.target.files[0]);}}/>
                      {scanning?"⏳ Scanning…":"📤 Upload PDF or Image to Scan"}
                    </label>
                    <div style={{fontSize:11,color:"#718096",marginTop:8,textAlign:"center"}}>Supports: PDF · JPG · PNG · Up to 5MB · Requires Claude API key in AI Assistant settings</div>
                  </div>

                  {scanResult&&(
                    <div style={{background:"#E6F4EE",border:"1.5px solid #A8D5BE",borderRadius:10,padding:"14px"}}>
                      <div style={{fontWeight:700,fontSize:13,color:"#1A7F5A",marginBottom:10}}>✓ Extracted from brochure — review and apply</div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
                        {Object.entries(scanResult).filter(([k,v])=>v!=null&&v!=="").map(([k,v])=>(
                          <div key={k} style={{background:"#fff",borderRadius:7,padding:"8px 10px"}}>
                            <div style={{fontSize:9,color:"#A0AEC0",textTransform:"uppercase",letterSpacing:".5px",marginBottom:2}}>{k.replace(/_/g," ")}</div>
                            <div style={{fontSize:12,fontWeight:600,color:"#0F2540"}}>{String(v)}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{display:"flex",gap:8}}>
                        <button onClick={applyScanResult} style={{flex:1,padding:"9px",borderRadius:8,border:"none",background:"#1A7F5A",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>
                          ✓ Apply to Form
                        </button>
                        <button onClick={()=>setScanResult(null)} style={{padding:"9px 14px",borderRadius:8,border:"1.5px solid #A8D5BE",background:"#fff",fontSize:13,cursor:"pointer"}}>
                          Discard
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div style={{display:"flex",gap:10,justifyContent:"flex-end",padding:"1rem 1.5rem",borderTop:"1px solid #E2E8F0"}}>
              <button onClick={()=>{setShowUnitForm(false);setEditUnit(null);setScanResult(null);}} style={{padding:"9px 20px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancel</button>
              <button onClick={saveUnit} disabled={saving} style={{padding:"9px 24px",borderRadius:8,border:"none",background:saving?"#A0AEC0":"#0F2540",color:"#fff",fontSize:13,fontWeight:600,cursor:saving?"not-allowed":"pointer"}}>
                {saving?"Saving…":editUnit?"Save Changes":"Add Unit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



export default InventoryModule;
