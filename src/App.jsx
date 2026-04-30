import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* ═══════════════════════════════════════════════════════════════
   PROPCCRM v3.0
   · Property Master DB: Project → Category → Building → Unit
   · Lead stage gates with required fields
   · Stage reversal with reason
   · WhatsApp / Email / Meeting / Follow-up comms
   · Role-based permissions throughout
═══════════════════════════════════════════════════════════════ */
const SUPABASE_URL  = "https://ysceukgpimzfqixtnbnp.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzY2V1a2dwaW16ZnFpeHRuYm5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNDI5OTQsImV4cCI6MjA4OTkxODk5NH0.WZSyGeOEbiRo1wt13syheTOyiAToMWXInxIaBgaqq8k";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

// ─── STYLES ───────────────────────────────────────────────────
const GlobalStyle = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Inter:wght@300;400;500;600;700&display=swap');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Inter',sans-serif;background:#F7F9FC;color:#0F2540;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
    ::-webkit-scrollbar{width:5px;height:5px}
    ::-webkit-scrollbar-thumb{background:#C9A84C55;border-radius:10px}
    input,select,textarea{font-family:'Inter',sans-serif;outline:none;border:1px solid #E2E8F0;border-radius:8px;padding:9px 12px;font-size:13px;color:#0F2540;background:#fff;width:100%;transition:border-color 0.2s;letter-spacing:-.1px}
    input:focus,select:focus,textarea:focus{border-color:#C9A84C;box-shadow:0 0 0 3px rgba(201,168,76,.1)}
    input.error,select.error{border-color:#E53E3E!important;background:#FFF8F8}
    textarea{resize:vertical}
    button{cursor:pointer;font-family:'Inter',sans-serif;letter-spacing:-.1px}
    .fade-in{animation:fadeIn 0.25s ease}
    @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
    .slide-in{animation:slideIn 0.2s ease}
    @keyframes slideIn{from{opacity:0;transform:translateX(12px)}to{opacity:1;transform:none}}
    .ch{transition:box-shadow 0.18s,transform 0.18s}
    .ch:hover{box-shadow:0 4px 16px rgba(15,37,64,.08);transform:translateY(-1px)}
    .dcard{transition:box-shadow 0.15s;cursor:grab}
    .dcard:hover{box-shadow:0 3px 14px rgba(15,37,64,.1)}
    @keyframes spin{to{transform:rotate(360deg)}}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}

    /* ── MOBILE ──────────────────────────────────────────────── */
    html{-webkit-text-size-adjust:100%;touch-action:manipulation}
    body{overflow-x:hidden}
    @media(max-width:768px){
      .tab-bar{overflow-x:auto!important;-webkit-overflow-scrolling:touch;scrollbar-width:none;flex-wrap:nowrap!important}
      .tab-bar::-webkit-scrollbar{display:none}
      .filter-sidebar{display:none!important}
      .filter-sidebar.open{display:flex!important}
      .table-wrap{overflow-x:auto!important;-webkit-overflow-scrolling:touch}
      .pipeline-board{overflow-x:auto!important;flex-wrap:nowrap!important}
      .mob-stack{grid-template-columns:1fr!important}
      .hide-mobile{display:none!important}
      button{min-height:38px}
    }
    @media(max-width:480px){
      .stat-grid{grid-template-columns:1fr 1fr!important}
    }
  `}</style>
);

// ─── CONSTANTS ────────────────────────────────────────────────
const STAGES      = ["New Lead","Contacted","Site Visit","Proposal Sent","Negotiation","Closed Won","Closed Lost"];
const PROP_TYPES  = ["Residential","Commercial","Luxury","Off-plan","Villa","Flat","Building"];
const UNIT_TYPES  = ["Villa","Flat","Penthouse","Townhouse","Duplex","Studio","Office","Warehouse","Plot","Commercial Unit"];
const SOURCES     = ["Referral","Website","Portal","Cold Call","Event","Social Media","WhatsApp","Walk-in"];
const ACT_TYPES   = ["Call","Email","Meeting","Visit","WhatsApp","Note"];
const MANAGER_DISCOUNT_LIMIT = 5;
const CAN_DELETE_LEADS = ["admin","manager"];
const STAGE_RULES = {
  "Contacted":     ["phone","email"],
  "Site Visit":    ["meeting_scheduled"],
  "Proposal Sent": ["unit_id","budget_confirmed"],
  "Negotiation":   ["proposal_notes"],
  "Closed Won":    ["final_price","payment_plan_agreed"],
};
const DISC_TYPES = [
  { key:"sale_price",   label:"Sale Price Reduction", icon:"🏷" },
  { key:"rent",         label:"Rent Reduction",        icon:"🔑" },
  { key:"payment_plan", label:"Payment Plan Change",   icon:"📅" },
  { key:"agency_fee",   label:"Agency Fee Waiver",     icon:"🤝" },
];
const ROLES = ["super_admin","admin","sales_manager","sales_agent","leasing_manager","leasing_agent","viewer"];

// ─── APP CONFIG ────────────────────────────────────────────────────
// Stored in localStorage. Set once by admin. Controls which modules are visible.
const getAppConfig = () => {
  try { return JSON.parse(localStorage.getItem("propccrm_config")||"null"); } catch { return null; }
};
const saveAppConfig = (cfg) => {
  localStorage.setItem("propccrm_config", JSON.stringify(cfg));
};
// Which tabs each mode shows (enforced on top of role-based visibility)
const MODE_TABS = {
  sales:   ["dashboard","projects","builder","leads","discounts","activity","ai","reports","proppulse","pay_plans","companies","users","permissions","permsets","group_view"],
  leasing: ["l_dashboard","l_leads","l_projects","l_inventory","leasing","l_discounts","l_activity","l_ai","l_reports","l_proppulse","l_companies","l_users","l_permissions","l_permsets","l_group_view"],
  both:    ["dashboard","projects","builder","leads","leasing","discounts","activity","ai","reports","proppulse","pay_plans","l_reports","companies","users","permissions"],
};
// Which roles each mode makes available
const MODE_ROLES = {
  sales:   ["admin","sales_manager","sales_agent","viewer"],
  leasing: ["admin","leasing_manager","leasing_agent","viewer"],
  both:    ["admin","sales_manager","sales_agent","leasing_manager","leasing_agent","viewer"],
};
const VIEWS       = ["Sea View","Pool View","Garden View","City View","Golf View","Park View","Community View","Burj View","Creek View","No View"];
const MEET_TYPES  = ["Call","Meeting","Site Visit","Video Call","Presentation"];
const FOLLOW_TYPES= ["Call","WhatsApp","Email","Meeting"];


// ─── MASTER DATA LISTS ─────────────────────────────────────────
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

const WA_TEMPLATES= [
  { id:"intro",    label:"Introduction",      text:"Hello {name}, I'm {agent} from PropCRM. I wanted to reach out regarding your interest in {type} properties in Dubai. Could we schedule a brief call to discuss your requirements?" },
  { id:"followup", label:"Follow-up",         text:"Hello {name}, I hope you're well. I wanted to follow up on our previous conversation about the properties we discussed. Do you have any questions or would you like to arrange a viewing?" },
  { id:"sitevisit",label:"Site Visit Invite", text:"Hello {name}, I'd love to invite you for a site visit to {project}. It's a great opportunity to see the development in person. Would {date} work for you?" },
  { id:"proposal", label:"Proposal Ready",    text:"Hello {name}, your personalised property proposal is ready. I'll be sending the details shortly. Please let me know if you'd like to discuss anything." },
  { id:"noresponse",label:"No Response",      text:"Hello {name}, I've tried reaching you a couple of times. I understand you may be busy — whenever you're ready to discuss your property needs, I'm here to help." },
  { id:"closing",  label:"Closing",           text:"Hello {name}, I wanted to touch base regarding {property}. We have a few serious buyers interested. I wouldn't want you to miss out. Shall we finalise the details?" },
];

// Stage gate requirements — what must exist before moving to next stage
const STAGE_GATES = {
  "Contacted":     { required: ["phone","email"],                    label: "Phone and email required",          fields: ["phone","email"] },
  "Site Visit":    { required: ["meeting_scheduled"],                label: "A meeting must be scheduled first", fields: ["meeting_scheduled"] },
  "Proposal Sent": { required: ["unit_id","budget"],                 label: "Link a unit and confirm budget",    fields: ["unit_id","budget"] },
  "Negotiation":   { required: ["proposal_notes"],                   label: "Proposal notes required",           fields: ["proposal_notes"] },
  "Closed Won":    { required: ["final_price","payment_plan"],       label: "Final price and payment plan required", fields: ["final_price","payment_plan"] },
  "Closed Lost":   { required: ["notes"],                            label: "Reason for loss required (notes)",  fields: ["notes"] },
};

const STAGE_META = {
  "New Lead":      { c:"#1A5FA8", bg:"#E6EFF9", order:0 },
  "Contacted":     { c:"#5B3FAA", bg:"#EEE8F9", order:1 },
  "Site Visit":    { c:"#A06810", bg:"#FDF3DC", order:2 },
  "Proposal Sent": { c:"#7A3FAA", bg:"#F3E8F9", order:3 },
  "Negotiation":   { c:"#B85C10", bg:"#FDF0E6", order:4 },
  "Closed Won":    { c:"#1A7F5A", bg:"#E6F4EE", order:5 },
  "Closed Lost":   { c:"#B83232", bg:"#FAEAEA", order:6 },
};
const TYPE_META = {
  Residential:{c:"#1A7F5A",bg:"#E6F4EE"}, Commercial:{c:"#1A5FA8",bg:"#E6EFF9"},
  Luxury:{c:"#8A6200",bg:"#FDF3DC"},      "Off-plan":{c:"#5B3FAA",bg:"#EEE8F9"},
  Villa:{c:"#0F6E56",bg:"#D4F1E8"},       Flat:{c:"#1D6FA8",bg:"#D4EAF7"},
  Building:{c:"#5A3D8A",bg:"#E8DFFA"},
};
const ACT_META = {
  Call:{icon:"📞",c:"#1A5FA8",bg:"#E6EFF9"}, Email:{icon:"✉",c:"#5B3FAA",bg:"#EEE8F9"},
  Meeting:{icon:"🤝",c:"#1A7F5A",bg:"#E6F4EE"}, Visit:{icon:"🏠",c:"#A06810",bg:"#FDF3DC"},
  WhatsApp:{icon:"💬",c:"#1A7F5A",bg:"#E6F4EE"}, Note:{icon:"📝",c:"#718096",bg:"#F7F9FC"},
};
const ROLE_META = {
  super_admin:    {label:"Super Admin",    color:"#B83232",bg:"#FAEAEA",desc:"All companies · Full access"},
  admin:          {label:"Admin",          color:"#8A6200",bg:"#FDF3DC",desc:"Full access — all modules"},
  sales_manager:  {label:"Sales Manager",  color:"#1A5FA8",bg:"#E6EFF9",desc:"All sales leads · approve discounts ≤5%"},
  sales_agent:    {label:"Sales Agent",    color:"#1A7F5A",bg:"#E6F4EE",desc:"Own sales leads · request discounts"},
  leasing_manager:{label:"Leasing Mgr",   color:"#5B3FAA",bg:"#EEE8F9",desc:"All leases · approve rent reductions ≤5%"},
  leasing_agent:  {label:"Leasing Agent", color:"#0F6E56",bg:"#D4F1E8",desc:"Own leases · manage tenants & payments"},
  viewer:         {label:"Viewer",         color:"#718096",bg:"#F7F9FC",desc:"Read-only access"},
};

// ─── UTILS ────────────────────────────────────────────────────
const fmtM    = n  => n ? `AED ${(n/1e6).toFixed(2)}M` : "—";
const fmtAED  = n  => n ? `AED ${Number(n).toLocaleString("en-AE")}` : "—";
const fmtDate = d  => d ? new Date(d).toLocaleDateString("en-AE",{day:"numeric",month:"short",year:"numeric"}) : "—";
const fmtDT   = d  => d ? new Date(d).toLocaleString("en-AE",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}) : "—";
const ini     = n  => (n||"?").split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase();
const uid     = () => Date.now()+Math.floor(Math.random()*9999);
const can = (role, action) => ({
  super_admin:    ["read","write","delete","manage_users","see_all","delete_leads","approve_all","approve_manager","view_sales","view_leasing","request_discount","manage_companies","manage_inventory","reserve_unit"],
  admin:          ["read","write","delete","manage_users","see_all","delete_leads","approve_all","approve_manager","view_sales","view_leasing","request_discount","manage_inventory","reserve_unit"],
  sales_manager:  ["read","write","delete","see_all","delete_leads","approve_manager","view_sales","request_discount","manage_inventory","reserve_unit"],
  sales_agent:    ["read","write","view_sales","request_discount","reserve_unit"],
  leasing_manager:["read","write","delete","see_all","delete_leads","approve_manager","view_leasing","request_discount","manage_inventory","reserve_unit"],
  leasing_agent:  ["read","write","view_leasing","reserve_unit"],
  viewer:         ["read","view_sales","view_leasing"],
}[role]||[]).includes(action);

// Helper: which department does this role belong to?
const roleTeam = role => ({
  super_admin:"both", admin:"both", sales_manager:"sales", sales_agent:"sales",
  leasing_manager:"leasing", leasing_agent:"leasing", viewer:"both",
}[role]||"both");

// Permission set aware check — if user has a permission_set, use it; else fall back to role
const canWithPS = (role, action, permSet=null) => {
  if (!permSet) return can(role, action);
  const PS_MAP = {
    "read":             true,  // always readable
    "write":            permSet.p_edit_leads||permSet.p_manage_inventory||permSet.p_manage_leasing,
    "delete":           permSet.p_delete_leads,
    "manage_users":     permSet.p_manage_users,
    "see_all":          permSet.p_view_leads||permSet.p_view_leasing,
    "delete_leads":     permSet.p_delete_leads,
    "approve_all":      permSet.p_approve_discount,
    "approve_manager":  permSet.p_approve_discount,
    "view_sales":       permSet.p_view_leads,
    "view_leasing":     permSet.p_view_leasing,
    "request_discount": permSet.p_request_discount,
    "manage_companies": false,
  };
  return PS_MAP[action] || false;
};

// PermSetSelector — dropdown that loads permission sets for a company
function PermSetSelector({ companyId, value, onChange }) {
  const [sets, setSets] = useState([]);
  const [templates, setTemplates] = useState([]);

  useEffect(()=>{
    if(!companyId) return;
    Promise.all([
      safe(supabase.from("permission_sets").select("id,name,color").eq("company_id",companyId).order("name")),
      safe(supabase.from("permission_sets").select("id,name,color").is("company_id",null).order("name")),
    ]).then(([s,t])=>{ setSets(s.data||[]); setTemplates(t.data||[]); });
  },[companyId]);

  return (
    <select value={value} onChange={e=>onChange(e.target.value)}>
      <option value="">Use default role permissions</option>
      {templates.length>0&&<optgroup label="─── Built-in Templates ───">
        {templates.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
      </optgroup>}
      {sets.length>0&&<optgroup label="─── Custom Sets ───">
        {sets.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
      </optgroup>}
    </select>
  );
}

function useLS(key,seed){
  const[v,setV]=useState(()=>{ try{const s=localStorage.getItem(key);return s?JSON.parse(s):seed;}catch{return seed;}});
  const set=x=>{setV(x);try{localStorage.setItem(key,JSON.stringify(x));}catch{}};
  return[v,set];
}

// Check stage gate — returns array of missing fields
const checkGate = (targetStage, lead) => {
  const gate = STAGE_GATES[targetStage];
  if (!gate) return [];
  const missing = [];
  gate.required.forEach(f => {
    if (f === "meeting_scheduled" && !lead.meeting_scheduled) missing.push("A meeting must be scheduled before Site Visit");
    else if (f === "unit_id" && !lead.unit_id) missing.push("Link a unit to this lead");
    else if (f === "budget" && !lead.budget) missing.push("Confirm client budget");
    else if (f === "proposal_notes" && !lead.proposal_notes?.trim()) missing.push("Add proposal notes");
    else if (f === "final_price" && !lead.final_price) missing.push("Enter final agreed price");
    else if (f === "payment_plan" && !lead.payment_plan?.trim()) missing.push("Specify payment plan");
    else if (f === "phone" && !lead.phone?.trim()) missing.push("Phone number required");
    else if (f === "email" && !lead.email?.trim()) missing.push("Email address required");
    else if (f === "notes" && !lead.notes?.trim()) missing.push("Add reason for loss in notes");
  });
  return missing;
};

// ─── ATOMS ────────────────────────────────────────────────────
const Av = ({name,size=36,bg="#0F2540",tc="#C9A84C"}) => (
  <div style={{width:size,height:size,borderRadius:"50%",background:bg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:size*0.32,fontWeight:600,color:tc,letterSpacing:"0.5px"}}>{ini(name)}</div>
);
const StageBadge = ({stage}) => {
  const m=STAGE_META[stage]||{c:"#718096",bg:"#F7F9FC"};
  return <span style={{display:"inline-flex",alignItems:"center",gap:4,background:m.bg,color:m.c,fontSize:11,fontWeight:600,padding:"3px 9px",borderRadius:20,whiteSpace:"nowrap"}}><span style={{width:5,height:5,borderRadius:"50%",background:m.c,display:"inline-block"}}/>{stage}</span>;
};
const TypeBadge = ({type}) => {
  const m=TYPE_META[type]||{c:"#718096",bg:"#F7F9FC"};
  return <span style={{fontSize:11,fontWeight:600,padding:"3px 9px",borderRadius:20,background:m.bg,color:m.c}}>{type}</span>;
};
const RoleBadge = ({role}) => {
  const m=ROLE_META[role]||{label:role,color:"#718096",bg:"#F7F9FC"};
  return <span style={{fontSize:11,fontWeight:600,padding:"3px 9px",borderRadius:20,background:m.bg,color:m.color,textTransform:"capitalize"}}>{m.label}</span>;
};
const Btn = ({children,onClick,variant="primary",small=false,full=false,disabled=false,style:st={}}) => {
  const s={primary:{background:"#0F2540",color:"#fff",border:"none"},gold:{background:"#C9A84C",color:"#0F2540",border:"none"},outline:{background:"#fff",color:"#0F2540",border:"1.5px solid #D1D9E6"},danger:{background:"#FAEAEA",color:"#B83232",border:"1.5px solid #F0BCBC"},green:{background:"#E6F4EE",color:"#1A7F5A",border:"1.5px solid #A8D5BE"},wa:{background:"#25D366",color:"#fff",border:"none"}};
  return <button onClick={onClick} disabled={disabled} style={{...s[variant],padding:small?"6px 14px":"9px 18px",borderRadius:8,fontSize:small?12:13,fontWeight:600,display:"inline-flex",alignItems:"center",gap:6,transition:"opacity 0.15s",width:full?"100%":"auto",justifyContent:"center",opacity:disabled?0.45:1,...st}} onMouseOver={e=>{if(!disabled)e.currentTarget.style.opacity="0.82"}} onMouseOut={e=>e.currentTarget.style.opacity=disabled?"0.45":"1"}>{children}</button>;
};
const Spinner=({msg="Loading…"})=>(
  <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",gap:16,color:"#A0AEC0"}}>
    <div style={{width:36,height:36,border:"3px solid #E2E8F0",borderTop:"3px solid #C9A84C",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
    {msg&&<div style={{fontSize:14}}>{msg}</div>}
  </div>
);
const Empty=({icon,msg})=>(
  <div style={{textAlign:"center",padding:"3rem 1rem",color:"#A0AEC0"}}>
    <div style={{fontSize:36,marginBottom:10}}>{icon}</div>
    <div style={{fontSize:14}}>{msg}</div>
  </div>
);
const FR=({label,value})=>(
  <div style={{display:"flex",flexDirection:"column",gap:2}}>
    <span style={{fontSize:10,color:"#A0AEC0",textTransform:"uppercase",letterSpacing:"0.6px",fontWeight:600}}>{label}</span>
    <span style={{fontSize:13,color:"#0F2540",fontWeight:500}}>{value||"—"}</span>
  </div>
);
const Modal=({title,onClose,children,width=520})=>(
  <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:"1rem"}}>
    <div className="fade-in" style={{background:"#fff",borderRadius:16,width,maxWidth:"100%",maxHeight:"90vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(11,31,58,0.3)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"1.25rem 1.5rem",borderBottom:"1px solid #E2E8F0",position:"sticky",top:0,background:"#fff",zIndex:1}}>
        <span style={{fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:700,color:"#0F2540"}}>{title}</span>
        <button onClick={onClose} style={{background:"none",border:"none",fontSize:22,color:"#A0AEC0",cursor:"pointer"}}>×</button>
      </div>
      <div style={{padding:"1.25rem 1.5rem"}}>{children}</div>
    </div>
  </div>
);
const FF=({label,children,required=false,error=""})=>(
  <div style={{marginBottom:14}}>
    <label style={{display:"block",fontSize:11,fontWeight:600,color:error?"#B83232":"#4A5568",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.5px"}}>{label}{required&&<span style={{color:"#B83232"}}> *</span>}</label>
    {children}
    {error&&<div style={{fontSize:11,color:"#B83232",marginTop:4,fontWeight:500}}>⚠ {error}</div>}
  </div>
);
const G2=({children})=><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>{children}</div>;
const G3=({children})=><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>{children}</div>;
const Badge=({label,c,bg})=>(
  <span style={{display:"inline-flex",alignItems:"center",gap:4,background:bg,color:c,fontSize:11,fontWeight:600,padding:"3px 9px",borderRadius:20,whiteSpace:"nowrap"}}>
    <span style={{width:5,height:5,borderRadius:"50%",background:c,display:"inline-block"}}/>
    {label}
  </span>
);
const DiscBadge=({status})=>{const C={Pending:{c:"#A06810",bg:"#FDF3DC"},Approved:{c:"#1A7F5A",bg:"#E6F4EE"},Rejected:{c:"#B83232",bg:"#FAEAEA"},Escalated:{c:"#5B3FAA",bg:"#EEE8F9"}};const m=C[status]||{c:"#718096",bg:"#F7F9FC"};return <Badge label={status} c={m.c} bg={m.bg}/>;};
const Toast=({msg,type="success",onDone})=>{
  useEffect(()=>{const t=setTimeout(onDone,3500);return()=>clearTimeout(t)},[]);
  const colors={success:["#E6F4EE","#1A7F5A"],error:["#FAEAEA","#B83232"],info:["#E6EFF9","#1A5FA8"],warning:["#FDF3DC","#A06810"]};
  const[bg,c]=colors[type]||colors.info;
  return <div style={{position:"fixed",bottom:90,right:24,zIndex:99999,background:bg,color:c,border:`1.5px solid ${c}33`,borderRadius:10,padding:"12px 18px",fontSize:13,fontWeight:600,boxShadow:"0 4px 20px rgba(0,0,0,0.15)",maxWidth:420,wordBreak:"break-word"}}>{type==="success"?"✓ ":type==="error"?"✕ ":type==="warning"?"⚠ ":"ℹ "}{msg}</div>;
};

// ─── AUTH (same as v2) ────────────────────────────────────────
const EyeIcon=({open})=>(
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {open?<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>:<><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>}
  </svg>
);
const getStrength=pw=>{
  if(!pw)return{score:0,label:"",color:"#E2E8F0",pct:0};
  let s=0;
  if(pw.length>=8)s++;if(pw.length>=12)s++;if(/[A-Z]/.test(pw))s++;if(/[0-9]/.test(pw))s++;if(/[^A-Za-z0-9]/.test(pw))s++;
  if(s<=1)return{score:s,label:"Weak",color:"#B83232",pct:20};
  if(s<=2)return{score:s,label:"Fair",color:"#A06810",pct:45};
  if(s<=3)return{score:s,label:"Good",color:"#1A5FA8",pct:70};
  return{score:s,label:"Strong",color:"#1A7F5A",pct:100};
};
const PwInput=({value,onChange,placeholder="••••••••",onKeyDown})=>{
  const[show,setShow]=useState(false);
  return <div style={{position:"relative"}}><input type={show?"text":"password"} value={value} onChange={onChange} placeholder={placeholder} onKeyDown={onKeyDown} style={{paddingRight:42}}/><button type="button" onClick={()=>setShow(s=>!s)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"#A0AEC0",padding:0,display:"flex",alignItems:"center",cursor:"pointer"}}><EyeIcon open={show}/></button></div>;
};
const StrengthBar=({password})=>{
  const s=getStrength(password);
  if(!password)return null;
  return <div style={{marginTop:6}}><div style={{height:4,background:"#F7F9FC",borderRadius:4,overflow:"hidden"}}><div style={{width:`${s.pct}%`,height:"100%",background:s.color,borderRadius:4,transition:"width 0.3s"}}/></div><div style={{fontSize:11,color:s.color,fontWeight:600,marginTop:4}}>{s.label} password</div></div>;
};
const AuthWrap=({children})=>(
  <div style={{minHeight:"100vh",background:"#fff",display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem"}}>
    <div className="fade-in" style={{background:"#fff",borderRadius:20,padding:"2.5rem",width:440,maxWidth:"100%",boxShadow:"0 30px 80px rgba(0,0,0,0.4)"}}>{children}</div>
  </div>
);
const AuthLogo=({sub})=>(
  <div style={{textAlign:"center",marginBottom:28}}>
    <div style={{fontFamily:"'Playfair Display',serif",fontSize:32,fontWeight:700,color:"#0F2540"}}><span style={{color:"#C9A84C"}}>◆</span> PropCRM</div>
    <div style={{fontSize:13,color:"#A0AEC0",marginTop:6}}>{sub}</div>
  </div>
);
const ErrBox=({msg})=>msg?<div style={{background:"#FAEAEA",color:"#B83232",border:"1.5px solid #F0BCBC",borderRadius:8,padding:"10px 14px",fontSize:13,marginBottom:16,lineHeight:1.5}}>{msg}</div>:null;
const AuthTabs=({mode,setMode})=>(
  <div style={{display:"flex",background:"#F7F9FC",borderRadius:10,padding:4,marginBottom:24}}>
    {[["login","Sign In"]].map(([m,label])=>(
      <button key={m} onClick={()=>setMode(m)} style={{flex:1,padding:"8px 0",borderRadius:8,border:"none",background:mode===m?"#fff":"transparent",color:mode===m?"#0F2540":"#A0AEC0",fontSize:13,fontWeight:mode===m?600:400,cursor:"pointer",transition:"all 0.2s",boxShadow:mode===m?"0 1px 4px rgba(0,0,0,0.08)":"none"}}>{label}</button>
    ))}
  </div>
);

// ─── FIELD VALIDATORS ────────────────────────────────────────────

// Email validation
const validateEmail = (email) => {
  if (!email) return null; // optional field — only validate if filled
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!re.test(email.trim())) return "Invalid email — use format: name@domain.com";
  const banned = ["@test.","@example.","@fake.","@dummy."];
  if (banned.some(b => email.includes(b))) return "Please use a real email address";
  return null;
};

// Phone formats by country/nationality
const PHONE_FORMATS = {
  "UAE":          { prefix:"+971", pattern:/^\+971[0-9]{8,9}$/, example:"+971 50 123 4567", clean:/[\s\-\(\)]/g },
  "Saudi Arabia": { prefix:"+966", pattern:/^\+966[0-9]{9}$/,   example:"+966 50 123 4567", clean:/[\s\-\(\)]/g },
  "India":        { prefix:"+91",  pattern:/^\+91[6-9][0-9]{9}$/,example:"+91 98765 43210",  clean:/[\s\-\(\)]/g },
  "UK":           { prefix:"+44",  pattern:/^\+44[0-9]{10}$/,    example:"+44 7700 900000",  clean:/[\s\-\(\)]/g },
  "Pakistan":     { prefix:"+92",  pattern:/^\+92[0-9]{10}$/,    example:"+92 300 1234567",  clean:/[\s\-\(\)]/g },
  "Egypt":        { prefix:"+20",  pattern:/^\+20[0-9]{10}$/,    example:"+20 10 1234 5678",  clean:/[\s\-\(\)]/g },
  "Jordan":       { prefix:"+962", pattern:/^\+962[0-9]{8,9}$/,  example:"+962 7 9012 3456",  clean:/[\s\-\(\)]/g },
  "USA":          { prefix:"+1",   pattern:/^\+1[2-9][0-9]{9}$/,  example:"+1 212 555 0100",  clean:/[\s\-\(\)]/g },
  "Russia":       { prefix:"+7",   pattern:/^\+7[0-9]{10}$/,      example:"+7 912 345 6789",  clean:/[\s\-\(\)]/g },
  "China":        { prefix:"+86",  pattern:/^\+86[0-9]{11}$/,     example:"+86 138 0013 8000", clean:/[\s\-\(\)]/g },
};

const validatePhone = (phone, nationality = "") => {
  if (!phone) return null; // optional field
  const cleaned = phone.replace(/[\s\-\(\)]/g, "");

  // Must start with +
  if (!cleaned.startsWith("+")) {
    const fmt = PHONE_FORMATS[nationality];
    return `Phone must start with country code. ${fmt ? `For ${nationality}: ${fmt.example}` : "e.g. +971 50 123 4567"}`;
  }

  // Country-specific validation
  const fmt = PHONE_FORMATS[nationality];
  if (fmt) {
    if (!fmt.pattern.test(cleaned)) {
      return `Invalid ${nationality} number — should be: ${fmt.example}`;
    }
    return null;
  }

  // Generic: just check it has 7-15 digits after +
  const digits = cleaned.slice(1).replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) {
    return "Phone number must have 7-15 digits after the country code";
  }
  return null;
};

// Format phone as you type — add spaces based on country
const formatPhoneDisplay = (raw, nationality = "") => {
  const cleaned = raw.replace(/[\s\-\(\)]/g, "");
  if (!cleaned.startsWith("+")) return raw;
  const fmt = PHONE_FORMATS[nationality];
  if (!fmt) return raw;
  // Let user type freely — just ensure prefix if nationality known
  if (cleaned.length <= fmt.prefix.length && fmt.prefix.startsWith(cleaned)) {
    return cleaned;
  }
  return raw; // don't auto-format mid-typing
};

// Emirates ID validation — 784-YYYY-XXXXXXX-X format
const validateEmiratesID = (id) => {
  if (!id) return null;
  const cleaned = id.replace(/[\s\-]/g, "");
  if (!/^784[0-9]{13}$/.test(cleaned)) {
    return "Emirates ID must be 15 digits starting with 784 — e.g. 784-1990-1234567-1";
  }
  return null;
};

// Passport validation — basic alphanumeric 6-9 chars
const validatePassport = (passport) => {
  if (!passport) return null;
  if (!/^[A-Z0-9]{6,9}$/i.test(passport.trim())) {
    return "Passport number should be 6-9 alphanumeric characters";
  }
  return null;
};

// Inline error display component
const FieldError = ({ error }) => {
  if (!error) return null;
  return (
    <div style={{
      fontSize: 11, color: "#B83232", marginTop: 4,
      display: "flex", alignItems: "center", gap: 4, fontWeight: 500,
    }}>
      <span>⚠</span> {error}
    </div>
  );
};

// Validated input component — shows error inline
const VInput = ({ value, onChange, onValidate, validate, placeholder, type="text", style:st={}, ...props }) => {
  const [touched, setTouched] = useState(false);
  const [err, setErr] = useState(null);
  const check = (val) => {
    const e = validate ? validate(val) : null;
    setErr(e);
    if (onValidate) onValidate(e);
    return e;
  };
  return (
    <div>
      <input
        {...props}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={e => { onChange(e); if (touched) check(e.target.value); }}
        onBlur={e => { setTouched(true); check(e.target.value); }}
        style={{
          ...st,
          borderColor: touched && err ? "#B83232" : undefined,
          background: touched && err ? "#FFF8F8" : undefined,
        }}
      />
      {touched && <FieldError error={err}/>}
    </div>
  );
};

// Phone hint banner — shown when nationality is selected
const PhoneHint = ({ nationality }) => {
  const fmt = PHONE_FORMATS[nationality];
  if (!fmt || !nationality) return null;
  return (
    <div style={{
      fontSize: 11, color: "#1A5FA8", background: "#E6EFF9",
      border: "1px solid #B5D4F4", borderRadius: 6,
      padding: "4px 8px", marginTop: 4, display:"flex", gap:6, alignItems:"center"
    }}>
      <span>📱</span>
      <span>{nationality} format: <strong>{fmt.example}</strong> (country code {fmt.prefix})</span>
    </div>
  );
};


function LoginScreen({onLogin}){
  const[mode,setMode]=useState("login");
  const[email,setEmail]=useState("");const[pw,setPw]=useState("");const[pw2,setPw2]=useState("");const[name,setName]=useState("");
  const[loading,setLoading]=useState(false);const[error,setError]=useState("");
  const reset=()=>setError("");

  const doLogin=async()=>{
    if(!email||!pw){setError("Please enter your email and password.");return;}
    setLoading(true);reset();
    try{
      const{data,error:e}=await supabase.auth.signInWithPassword({email,password:pw});
      if(e)throw e;
      // Try to get profile — use maybeSingle so no error if missing
      const profRes = await supabase.from("profiles").select("*").eq("id",data.user.id).maybeSingle();
      let profile = profRes.data;

      if(!profile){
        // SECURITY: Do NOT auto-create profiles. An authenticated user without
        // a profile is one of: (a) someone provisioned by an admin who forgot
        // to create the profiles row, (b) an unauthorized signup if Supabase
        // Auth signups are enabled, (c) a stale/leaked session. In all cases,
        // the safe response is to refuse access and require admin provisioning.
        // (Sprint 0.5 / Block 8 — fixes auto-super_admin escalation bug.)
        console.warn("[Auth] Authenticated user has no profile row:", data.user.id, data.user.email);
        await supabase.auth.signOut();
        setError("Your account has not been provisioned. Please contact your administrator.");
        setLoading(false);
        return;
      }

      if(!profile){
        // Defensive — should be unreachable after the explicit check above,
        // but kept as a belt-and-braces safety net.
        await supabase.auth.signOut();
        setError("Your account has not been provisioned. Please contact your administrator.");
        setLoading(false);
        return;
      }
      if(profile.is_active === false){
        throw new Error("Your account has been deactivated. Contact your admin.");
      }
      onLogin({...data.user,...profile});
    }catch(e){
      const msg=e.message||"";
      if(msg.includes("Email not confirmed"))setError("Please verify your email first. Check your inbox.");
      else if(msg.includes("Invalid login"))setError("Incorrect email or password.");
      else if(msg.includes("Failed to fetch")||msg.includes("fetch"))setError("Cannot connect to server. If you see this, the database may be paused — go to supabase.com/dashboard and restore your project.");
      else setError(msg||"Login failed.");
    }finally{setLoading(false);}
  };

  const doSignup=async()=>{
    if(!name.trim()){setError("Please enter your full name.");return;}
    if(!email){setError("Please enter your email.");return;}
    if(pw.length<8){setError("Password must be at least 8 characters.");return;}
    if(pw!==pw2){setError("Passwords do not match.");return;}
    if(getStrength(pw).score<2){setError("Password too weak. Add numbers and symbols.");return;}
    setLoading(true);reset();
    try{
      const{error:e}=await supabase.auth.signUp({email,password:pw,options:{data:{full_name:name.trim(),role:"agent"}}});
      if(e)throw e;
      setMode("verify");
    }catch(e){
      if(e.message?.includes("already registered"))setError("Account exists. Please sign in.");
      else setError(e.message||"Sign up failed.");
    }finally{setLoading(false);}
  };

  if(mode==="verify")return(
    <AuthWrap>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:56,marginBottom:16}}>📬</div>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:700,color:"#0F2540",marginBottom:10}}>Check your inbox</div>
        <div style={{fontSize:14,color:"#4A5568",lineHeight:1.8,marginBottom:6}}>We sent a confirmation email to:</div>
        <div style={{fontSize:15,fontWeight:700,color:"#0F2540",marginBottom:20}}>{email}</div>
        <div style={{fontSize:13,color:"#718096",lineHeight:1.8,marginBottom:28,padding:"14px",background:"#F7F9FC",borderRadius:10,border:"1px solid #E2E8F0",textAlign:"left"}}>
          <strong>What to do:</strong><br/>1. Open the email from Supabase<br/>2. Click the <strong>"Confirm your email"</strong> link<br/>3. Come back here and sign in<br/><br/><span style={{color:"#A0AEC0"}}>Can't find it? Check Spam/Junk.</span>
        </div>
        <Btn full onClick={()=>{setMode("login");setPw("");setPw2("");reset();}} style={{marginBottom:12}}>→ Go to Sign In</Btn>
        <button onClick={async()=>{setLoading(true);await supabase.auth.resend({type:"signup",email});setLoading(false);alert("Resent!");}} style={{background:"none",border:"none",color:"#A0AEC0",fontSize:12,cursor:"pointer",textDecoration:"underline"}}>{loading?"Sending…":"Resend confirmation email"}</button>
      </div>
    </AuthWrap>
  );

  if(mode==="forgot")return(
    <AuthWrap>
      <AuthLogo sub="Reset your password"/>
      <ErrBox msg={error}/>
      {pw==="sent"?(
        <div style={{textAlign:"center",padding:"20px 0"}}>
          <div style={{fontSize:48,marginBottom:12}}>📬</div>
          <div style={{fontFamily:"'Inter',sans-serif",fontSize:16,fontWeight:700,color:"#0F2540",letterSpacing:"-.4px",marginBottom:8}}>Check your inbox</div>
          <div style={{fontSize:13,color:"#718096",lineHeight:1.8}}>Reset link sent to:<br/><strong>{email}</strong></div>
        </div>
      ):(
        <FF label="Email Address" required><input type="email" value={email} onChange={e=>{setEmail(e.target.value);reset();}} placeholder="you@company.com" style={{width:"100%",padding:"10px 14px",border:"1.5px solid #E2E8F0",borderRadius:10,fontSize:14,outline:"none",boxSizing:"border-box"}}/></FF>
      )}
      {pw!=="sent"&&<Btn onClick={async()=>{if(!email.trim()){setError("Please enter your email");return;}setLoading(true);const{error:e}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin});setLoading(false);if(e)setError(e.message);else setPw("sent");}} disabled={loading} full style={{marginTop:8,padding:"12px"}}>{loading?"Sending…":"Send Reset Link →"}</Btn>}
      <div style={{textAlign:"center",marginTop:16}}><button onClick={()=>{setMode("login");setPw("");reset();}} style={{background:"none",border:"none",color:"#A0AEC0",fontSize:13,cursor:"pointer"}}>← Back to Sign In</button></div>
    </AuthWrap>
  );

  if(mode==="login")return(
    <AuthWrap>
      <AuthLogo sub="Sign in to your account"/>
      <AuthTabs mode={mode} setMode={m=>{setMode(m);setError("");setPw("");setPw2("");}}/>
      <ErrBox msg={error}/>
      <FF label="Email Address" required><input type="email" value={email} onChange={e=>{setEmail(e.target.value);reset();}} placeholder="you@company.com" onKeyDown={e=>e.key==="Enter"&&doLogin()}/></FF>
      <FF label="Password" required><PwInput value={pw} onChange={e=>{setPw(e.target.value);reset();}} onKeyDown={e=>e.key==="Enter"&&doLogin()}/></FF>
      <Btn onClick={doLogin} disabled={loading} full style={{marginTop:8,padding:"12px"}}>{loading?"Signing in…":"Sign In →"}</Btn>
      <div style={{textAlign:"center",marginTop:16}}><button onClick={()=>setMode("forgot")} style={{background:"none",border:"none",color:"#A0AEC0",fontSize:13,cursor:"pointer",textDecoration:"underline"}}>Forgot password?</button></div>
    </AuthWrap>
  );

  return(
    <AuthWrap>
      <AuthLogo sub="Create your PropCRM account"/>
      <AuthTabs mode={mode} setMode={m=>{setMode(m);setError("");setPw("");setPw2("");}}/>
      <ErrBox msg={error}/>
      <FF label="Full Name" required><input value={name} onChange={e=>{setName(e.target.value);reset();}} placeholder="Ahmed Al Mansoori" onKeyDown={e=>e.key==="Enter"&&doSignup()}/></FF>
      <FF label="Email Address" required><input type="email" value={email} onChange={e=>{setEmail(e.target.value);reset();}} placeholder="you@company.com" onKeyDown={e=>e.key==="Enter"&&doSignup()}/></FF>
      <FF label="Password" required><PwInput value={pw} onChange={e=>{setPw(e.target.value);reset();}} placeholder="Min 8 characters"/><StrengthBar password={pw}/></FF>
      <FF label="Confirm Password" required><PwInput value={pw2} onChange={e=>{setPw2(e.target.value);reset();}} placeholder="Re-enter password" onKeyDown={e=>e.key==="Enter"&&doSignup()}/>{pw2&&pw!==pw2&&<div style={{fontSize:11,color:"#B83232",marginTop:4,fontWeight:600}}>✕ Passwords do not match</div>}{pw2&&pw===pw2&&pw.length>=8&&<div style={{fontSize:11,color:"#1A7F5A",marginTop:4,fontWeight:600}}>✓ Passwords match</div>}</FF>
      <div style={{background:"#F7F9FC",border:"1px solid #E2E8F0",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:12,color:"#718096",lineHeight:1.7}}>New accounts are assigned <strong>Agent</strong> role. Your admin can upgrade access after login.</div>
      <Btn onClick={doSignup} disabled={loading} full style={{padding:"12px"}}>{loading?"Creating…":"Create Account →"}</Btn>
      <div style={{textAlign:"center",marginTop:18}}><span style={{fontSize:13,color:"#A0AEC0"}}>Already have an account? </span><button onClick={()=>{setMode("login");setError("");setPw("");setPw2("");}} style={{background:"none",border:"none",color:"#C9A84C",fontSize:13,fontWeight:600,cursor:"pointer",textDecoration:"underline"}}>Sign in</button></div>
    </AuthWrap>
  );
}

// ══════════════════════════════════════════════════════
// PROPERTY MASTER DATABASE
// ══════════════════════════════════════════════════════
function PropertyMaster({currentUser,showToast}){
  const[projects,setProjects]=useState([]);
  const[categories,setCategories]=useState([]);
  const[buildings,setBuildings]=useState([]);
  const[units,setUnits]=useState([]);
  const[loading,setLoading]=useState(true);
  const[selProject,setSelProject]=useState(null);
  const[selCategory,setSelCategory]=useState(null);
  const[selBuilding,setSelBuilding]=useState(null);
  const[selUnit,setSelUnit]=useState(null);
  const[modal,setModal]=useState(null); // "project"|"category"|"building"|"unit"
  const[form,setForm]=useState({});
  const canEdit=can(currentUser.role,"write");

  const load=useCallback(async()=>{
    setLoading(true);
    const[p,c,b,u]=await Promise.all([
      safe(supabase.from("projects").select("*").order("name")),
      safe(supabase.from("project_categories").select("*").order("name")),
      safe(supabase.from("project_buildings").select("*").order("name")),
      safe(supabase.from("units").select("*").order("unit_number")),
    ]);
    setProjects(p.data||[]);setCategories(c.data||[]);setBuildings(b.data||[]);setUnits(u.data||[]);
    setLoading(false);
  },[]);
  useEffect(()=>{load();},[load]);

  const sf=(k,v)=>setForm(f=>({...f,[k]:v}));

  const saveProject=async()=>{
    if(!form.name?.trim()){showToast("Project name required","error");return;}
    const payload={name:form.name,developer:form.developer||null,location:form.location||null,description:form.description||null,launch_date:form.launch_date||null,handover_date:form.handover_date||null,status:form.status||"Active",created_by:currentUser.id};
    const{data,error}=form.id
      ?await supabase.from("projects").update(payload).eq("id",form.id).select().single()
      :await supabase.from("projects").insert(payload).select().single();
    if(error){showToast(error.message,"error");return;}
    setProjects(p=>form.id?p.map(x=>x.id===data.id?data:x):[data,...p]);
    showToast(`Project ${form.id?"updated":"created"}.`,"success");setModal(null);setForm({});
  };

  const saveCategory=async()=>{
    if(!form.name?.trim()||!selProject){showToast("Name and project required","error");return;}
    const payload={name:form.name,type:form.type||"Flat",description:form.description||null,project_id:selProject.id};
    const{data,error}=form.id
      ?await supabase.from("project_categories").update(payload).eq("id",form.id).select().single()
      :await supabase.from("project_categories").insert(payload).select().single();
    if(error){showToast(error.message,"error");return;}
    setCategories(p=>form.id?p.map(x=>x.id===data.id?data:x):[data,...p]);
    showToast(`Category ${form.id?"updated":"created"}.`,"success");setModal(null);setForm({});
  };

  const saveBuilding=async()=>{
    if(!form.name?.trim()||!selCategory){showToast("Name and category required","error");return;}
    const payload={name:form.name,floors:Number(form.floors)||null,total_units:Number(form.total_units)||null,description:form.description||null,category_id:selCategory.id,project_id:selProject.id};
    const{data,error}=form.id
      ?await supabase.from("project_buildings").update(payload).eq("id",form.id).select().single()
      :await supabase.from("project_buildings").insert(payload).select().single();
    if(error){showToast(error.message,"error");return;}
    setBuildings(p=>form.id?p.map(x=>x.id===data.id?data:x):[data,...p]);
    showToast(`Building ${form.id?"updated":"created"}.`,"success");setModal(null);setForm({});
  };

  const saveUnit=async()=>{
    if(!form.unit_number?.trim()||!selBuilding){showToast("Unit number and building required","error");return;}
    const sqft=Number(form.size_sqft)||0;
    const basePx=Number(form.base_price)||0;
    const ppsf=sqft&&basePx?Math.round(basePx/sqft):Number(form.price_per_sqft)||0;
    const payload={unit_number:form.unit_number,floor:Number(form.floor)||null,view:form.view||null,bedrooms:Number(form.bedrooms)||null,bathrooms:Number(form.bathrooms)||null,size_sqft:sqft||null,balcony_sqft:Number(form.balcony_sqft)||null,total_sqft:Number(form.total_sqft)||sqft||null,base_price:basePx||null,price_per_sqft:ppsf||null,service_charge_per_sqft:Number(form.service_charge_per_sqft)||null,status:form.status||"Available",payment_plan:form.payment_plan||null,handover_date:form.handover_date||null,notes:form.notes||null,building_id:selBuilding.id,category_id:selCategory.id,project_id:selProject.id};
    const{data,error}=form.id
      ?await supabase.from("units").update(payload).eq("id",form.id).select().single()
      :await supabase.from("units").insert(payload).select().single();
    if(error){showToast(error.message,"error");return;}
    setUnits(p=>form.id?p.map(x=>x.id===data.id?data:x):[data,...p]);
    showToast(`Unit ${form.id?"updated":"created"}.`,"success");setModal(null);setForm({});
  };

  const deleteItem=async(table,id,setter)=>{
    if(!window.confirm("Delete this record? This cannot be undone."))return;
    const{error}=await supabase.from(table).delete().eq("id",id);
    if(!error){setter(p=>p.filter(x=>x.id!==id));showToast("Deleted.","info");}
    else showToast(error.message,"error");
  };

  const projCats   = selProject  ? categories.filter(c=>c.project_id===selProject.id)  : [];
  const catBuilds  = selCategory ? buildings.filter(b=>b.category_id===selCategory.id) : [];
  const buildUnits = selBuilding ? units.filter(u=>u.building_id===selBuilding.id)      : [];

  const STATUS_COLORS={Available:{c:"#1A7F5A",bg:"#E6F4EE"},Reserved:{c:"#A06810",bg:"#FDF3DC"},"Under Offer":{c:"#B85C10",bg:"#FDF0E6"},Sold:{c:"#B83232",bg:"#FAEAEA"},Blocked:{c:"#718096",bg:"#F7F9FC"}};

  const ColHeader=({title,count,onAdd,icon})=>(
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",background:"#1E3A5F",borderRadius:"10px 10px 0 0"}}>
      <div>
        <div style={{fontSize:13,fontWeight:700,color:"#fff"}}>{icon} {title}</div>
        <div style={{fontSize:11,color:"#C9A84C"}}>{count} item{count!==1?"s":""}</div>
      </div>
      {canEdit&&<button onClick={onAdd} style={{background:"#C9A84C",color:"#0F2540",border:"none",borderRadius:6,padding:"5px 10px",fontSize:12,fontWeight:700,cursor:"pointer"}}>+ Add</button>}
    </div>
  );

  if(loading)return <Spinner msg="Loading property database…"/>;

  return(
    <div className="fade-in" style={{display:"flex",flexDirection:"column",height:"100%"}}>
      {/* Breadcrumb */}
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:14,fontSize:13,flexWrap:"wrap"}}>
        <span style={{fontWeight:600,color:"#0F2540",cursor:"pointer",textDecoration:selProject?"underline":"none"}} onClick={()=>{setSelProject(null);setSelCategory(null);setSelBuilding(null);setSelUnit(null);}}>All Projects</span>
        {selProject&&<><span style={{color:"#A0AEC0"}}>›</span><span style={{fontWeight:600,color:"#0F2540",cursor:"pointer",textDecoration:selCategory?"underline":"none"}} onClick={()=>{setSelCategory(null);setSelBuilding(null);setSelUnit(null);}}>{selProject.name}</span></>}
        {selCategory&&<><span style={{color:"#A0AEC0"}}>›</span><span style={{fontWeight:600,color:"#0F2540",cursor:"pointer",textDecoration:selBuilding?"underline":"none"}} onClick={()=>{setSelBuilding(null);setSelUnit(null);}}>{selCategory.name}</span></>}
        {selBuilding&&<><span style={{color:"#A0AEC0"}}>›</span><span style={{fontWeight:600,color:"#0F2540"}}>{selBuilding.name}</span></>}
      </div>

      {/* 4-column master layout */}
      <div style={{flex:1,overflow:"hidden",display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1.4fr",gap:12}}>

        {/* ── PROJECTS ── */}
        <div style={{display:"flex",flexDirection:"column",background:"#fff",border:"1px solid #E2E8F0",borderRadius:10,overflow:"hidden"}}>
          <ColHeader title="Projects" count={projects.length} icon="🏙" onAdd={()=>{setForm({status:"Active"});setModal("project");}}/>
          <div style={{flex:1,overflowY:"auto"}}>
            {projects.length===0&&<Empty icon="🏙" msg="No projects yet"/>}
            {projects.map(p=>(
              <div key={p.id} onClick={()=>{setSelProject(p);setSelCategory(null);setSelBuilding(null);setSelUnit(null);}}
                style={{padding:"10px 14px",borderBottom:"1px solid #F0F2F5",cursor:"pointer",background:selProject?.id===p.id?"#0F2540":"#fff",transition:"background 0.15s"}}>
                <div style={{fontWeight:600,fontSize:13,color:selProject?.id===p.id?"#fff":"#0F2540"}}>{p.name}</div>
                <div style={{fontSize:11,color:selProject?.id===p.id?"#C9A84C":"#A0AEC0",marginTop:2}}>{p.developer||"—"} · {p.location||"—"}</div>
                <div style={{display:"flex",gap:6,marginTop:5,alignItems:"center",justifyContent:"space-between"}}>
                  <span style={{fontSize:10,fontWeight:600,padding:"2px 7px",borderRadius:10,background:p.status==="Active"?"#E6F4EE":"#F7F9FC",color:p.status==="Active"?"#1A7F5A":"#718096"}}>{p.status}</span>
                  {canEdit&&<button onClick={e=>{e.stopPropagation();setForm({...p});setModal("project");}} style={{background:"none",border:"none",color:"#A0AEC0",fontSize:11,cursor:"pointer"}}>Edit</button>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── CATEGORIES ── */}
        <div style={{display:"flex",flexDirection:"column",background:"#fff",border:"1px solid #E2E8F0",borderRadius:10,overflow:"hidden"}}>
          <ColHeader title="Categories" count={projCats.length} icon="📂" onAdd={()=>{if(!selProject){showToast("Select a project first","info");return;}setForm({type:"Flat"});setModal("category");}}/>
          <div style={{flex:1,overflowY:"auto"}}>
            {!selProject&&<Empty icon="👆" msg="Select a project"/>}
            {selProject&&projCats.length===0&&<Empty icon="📂" msg="No categories yet"/>}
            {projCats.map(c=>(
              <div key={c.id} onClick={()=>{setSelCategory(c);setSelBuilding(null);setSelUnit(null);}}
                style={{padding:"10px 14px",borderBottom:"1px solid #F0F2F5",cursor:"pointer",background:selCategory?.id===c.id?"#0F2540":"#fff"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div>
                    <div style={{fontWeight:600,fontSize:13,color:selCategory?.id===c.id?"#fff":"#0F2540"}}>{c.name}</div>
                    <TypeBadge type={c.type}/>
                  </div>
                  {canEdit&&<button onClick={e=>{e.stopPropagation();setForm({...c});setModal("category");}} style={{background:"none",border:"none",color:"#A0AEC0",fontSize:11,cursor:"pointer"}}>Edit</button>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── BUILDINGS ── */}
        <div style={{display:"flex",flexDirection:"column",background:"#fff",border:"1px solid #E2E8F0",borderRadius:10,overflow:"hidden"}}>
          <ColHeader title="Buildings / Blocks" count={catBuilds.length} icon="🏢" onAdd={()=>{if(!selCategory){showToast("Select a category first","info");return;}setForm({});setModal("building");}}/>
          <div style={{flex:1,overflowY:"auto"}}>
            {!selCategory&&<Empty icon="👆" msg="Select a category"/>}
            {selCategory&&catBuilds.length===0&&<Empty icon="🏢" msg="No buildings yet"/>}
            {catBuilds.map(b=>(
              <div key={b.id} onClick={()=>{setSelBuilding(b);setSelUnit(null);}}
                style={{padding:"10px 14px",borderBottom:"1px solid #F0F2F5",cursor:"pointer",background:selBuilding?.id===b.id?"#0F2540":"#fff"}}>
                <div style={{fontWeight:600,fontSize:13,color:selBuilding?.id===b.id?"#fff":"#0F2540"}}>{b.name}</div>
                <div style={{fontSize:11,color:selBuilding?.id===b.id?"#C9A84C":"#A0AEC0",marginTop:2}}>
                  {b.floors?`${b.floors} floors · `:""}{b.total_units?`${b.total_units} units`:""}
                </div>
                {canEdit&&<button onClick={e=>{e.stopPropagation();setForm({...b});setModal("building");}} style={{background:"none",border:"none",color:"#A0AEC0",fontSize:11,cursor:"pointer",marginTop:4}}>Edit</button>}
              </div>
            ))}
          </div>
        </div>

        {/* ── UNITS ── */}
        <div style={{display:"flex",flexDirection:"column",background:"#fff",border:"1px solid #E2E8F0",borderRadius:10,overflow:"hidden"}}>
          <ColHeader title="Units" count={buildUnits.length} icon="🔑" onAdd={()=>{if(!selBuilding){showToast("Select a building first","info");return;}setForm({status:"Available"});setModal("unit");}}/>
          <div style={{flex:1,overflowY:"auto"}}>
            {!selBuilding&&<Empty icon="👆" msg="Select a building"/>}
            {selBuilding&&buildUnits.length===0&&<Empty icon="🔑" msg="No units yet"/>}
            {buildUnits.map(u=>{
              const sc=STATUS_COLORS[u.status]||{c:"#718096",bg:"#F7F9FC"};
              const isSel=selUnit?.id===u.id;
              return(
                <div key={u.id} onClick={()=>setSelUnit(isSel?null:u)}
                  style={{padding:"10px 14px",borderBottom:"1px solid #F0F2F5",cursor:"pointer",background:isSel?"#FDF3DC":"#fff",borderLeft:isSel?"3px solid #C9A84C":"3px solid transparent"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <div style={{fontWeight:700,fontSize:13,color:"#0F2540"}}>Unit {u.unit_number}</div>
                    <span style={{fontSize:10,fontWeight:600,padding:"2px 7px",borderRadius:10,background:sc.bg,color:sc.c}}>{u.status}</span>
                  </div>
                  {u.bedrooms&&<div style={{fontSize:11,color:"#718096",marginTop:2}}>{u.bedrooms}BR · {u.view||"No view"} · Floor {u.floor||"—"}</div>}
                  <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
                    <div style={{fontSize:12,fontWeight:700,color:"#0F2540",fontFamily:"'Playfair Display',serif"}}>{fmtAED(u.base_price)}</div>
                    {u.price_per_sqft&&<div style={{fontSize:11,color:"#1A7F5A",fontWeight:600}}>AED {u.price_per_sqft.toLocaleString()}/sqft</div>}
                  </div>
                  {isSel&&(
                    <div style={{marginTop:10,padding:"10px",background:"#fff",borderRadius:8,border:"1px solid #E8C97A"}}>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:8}}>
                        {[["Size",`${u.size_sqft||0} sqft`],["Balcony",`${u.balcony_sqft||0} sqft`],["Service Chg",u.service_charge_per_sqft?`AED ${u.service_charge_per_sqft}/sqft`:"—"],["Payment",u.payment_plan||"—"],["Handover",fmtDate(u.handover_date)],["Bathrooms",u.bathrooms||"—"]].map(([l,v])=>(
                          <div key={l}><div style={{fontSize:9,color:"#A0AEC0",textTransform:"uppercase",letterSpacing:"0.5px"}}>{l}</div><div style={{fontSize:12,fontWeight:600,color:"#0F2540"}}>{v}</div></div>
                        ))}
                      </div>
                      {u.notes&&<div style={{fontSize:11,color:"#718096",marginBottom:8}}>{u.notes}</div>}
                      {canEdit&&(
                        <div style={{display:"flex",gap:6}}>
                          <Btn small variant="outline" onClick={e=>{e.stopPropagation();setForm({...u});setModal("unit");}}>Edit</Btn>
                          <Btn small variant="danger" onClick={e=>{e.stopPropagation();deleteItem("units",u.id,setUnits);}}>Delete</Btn>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── PROJECT MODAL ── */}
      {modal==="project"&&(
        <Modal title={form.id?"Edit Project":"Add Project"} onClose={()=>{setModal(null);setForm({});}}>
          <G2><FF label="Project Name" required><input value={form.name||""} onChange={e=>sf("name",e.target.value)} placeholder="Emaar Beachfront"/></FF>
          <FF label="Developer"><input value={form.developer||""} onChange={e=>sf("developer",e.target.value)} placeholder="Emaar Properties"/></FF></G2>
          <FF label="Location"><input value={form.location||""} onChange={e=>sf("location",e.target.value)} placeholder="Dubai Harbour, Dubai"/></FF>
          <G2><FF label="Launch Date"><input type="date" value={form.launch_date||""} onChange={e=>sf("launch_date",e.target.value)}/></FF>
          <FF label="Handover Date"><input type="date" value={form.handover_date||""} onChange={e=>sf("handover_date",e.target.value)}/></FF></G2>
          <FF label="Status"><select value={form.status||"Active"} onChange={e=>sf("status",e.target.value)}>{["Active","Completed","On Hold","Cancelled"].map(s=><option key={s}>{s}</option>)}</select></FF>
          <FF label="Description"><textarea value={form.description||""} onChange={e=>sf("description",e.target.value)} rows={3}/></FF>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            {form.id&&<Btn variant="danger" onClick={()=>deleteItem("projects",form.id,setProjects)}>Delete</Btn>}
            <Btn variant="outline" onClick={()=>{setModal(null);setForm({});}}>Cancel</Btn>
            <Btn onClick={saveProject}>{form.id?"Save Changes":"Create Project"}</Btn>
          </div>
        </Modal>
      )}

      {/* ── CATEGORY MODAL ── */}
      {modal==="category"&&(
        <Modal title={form.id?"Edit Category":"Add Category"} onClose={()=>{setModal(null);setForm({});}}>
          <G2><FF label="Category Name" required><input value={form.name||""} onChange={e=>sf("name",e.target.value)} placeholder="Waterfront Villas"/></FF>
          <FF label="Unit Type" required><select value={form.type||"Flat"} onChange={e=>sf("type",e.target.value)}>{UNIT_TYPES.map(t=><option key={t}>{t}</option>)}</select></FF></G2>
          <FF label="Description"><textarea value={form.description||""} onChange={e=>sf("description",e.target.value)} rows={2}/></FF>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            {form.id&&<Btn variant="danger" onClick={()=>deleteItem("project_categories",form.id,setCategories)}>Delete</Btn>}
            <Btn variant="outline" onClick={()=>{setModal(null);setForm({});}}>Cancel</Btn>
            <Btn onClick={saveCategory}>{form.id?"Save Changes":"Create Category"}</Btn>
          </div>
        </Modal>
      )}

      {/* ── BUILDING MODAL ── */}
      {modal==="building"&&(
        <Modal title={form.id?"Edit Building":"Add Building"} onClose={()=>{setModal(null);setForm({});}}>
          <FF label="Building / Block Name" required><input value={form.name||""} onChange={e=>sf("name",e.target.value)} placeholder="Tower A / Block 3 / Villa Cluster B"/></FF>
          <G2><FF label="Number of Floors"><input type="number" value={form.floors||""} onChange={e=>sf("floors",e.target.value)}/></FF>
          <FF label="Total Units"><input type="number" value={form.total_units||""} onChange={e=>sf("total_units",e.target.value)}/></FF></G2>
          <FF label="Description"><textarea value={form.description||""} onChange={e=>sf("description",e.target.value)} rows={2}/></FF>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            {form.id&&<Btn variant="danger" onClick={()=>deleteItem("project_buildings",form.id,setBuildings)}>Delete</Btn>}
            <Btn variant="outline" onClick={()=>{setModal(null);setForm({});}}>Cancel</Btn>
            <Btn onClick={saveBuilding}>{form.id?"Save Changes":"Create Building"}</Btn>
          </div>
        </Modal>
      )}

      {/* ── UNIT MODAL ── */}
      {modal==="unit"&&(
        <Modal title={form.id?"Edit Unit":"Add Unit"} onClose={()=>{setModal(null);setForm({});}} width={600}>
          <G3>
            <FF label="Unit Number" required><input value={form.unit_number||""} onChange={e=>sf("unit_number",e.target.value)} placeholder="101"/></FF>
            <FF label="Floor"><input type="number" value={form.floor||""} onChange={e=>sf("floor",e.target.value)} placeholder="1"/></FF>
            <FF label="Status"><select value={form.status||"Available"} onChange={e=>sf("status",e.target.value)}>{["Available","Reserved","Under Offer","Sold","Blocked"].map(s=><option key={s}>{s}</option>)}</select></FF>
          </G3>
          <G2>
            <FF label="Bedrooms"><input type="number" value={form.bedrooms||""} onChange={e=>sf("bedrooms",e.target.value)} placeholder="2"/></FF>
            <FF label="Bathrooms"><input type="number" value={form.bathrooms||""} onChange={e=>sf("bathrooms",e.target.value)} placeholder="3"/></FF>
          </G2>
          <FF label="View"><select value={form.view||""} onChange={e=>sf("view",e.target.value)}><option value="">Select view…</option>{MASTER.view.map(v=><option key={v}>{v}</option>)}</select></FF>
          <G3>
            <FF label="Size (sqft)"><input type="number" value={form.size_sqft||""} onChange={e=>sf("size_sqft",e.target.value)} placeholder="1250"/></FF>
            <FF label="Balcony (sqft)"><input type="number" value={form.balcony_sqft||""} onChange={e=>sf("balcony_sqft",e.target.value)} placeholder="200"/></FF>
            <FF label="Total (sqft)"><input type="number" value={form.total_sqft||""} onChange={e=>sf("total_sqft",e.target.value)} placeholder="1450"/></FF>
          </G3>
          <G3>
            <FF label="Base Price (AED)"><input type="number" value={form.base_price||""} onChange={e=>sf("base_price",e.target.value)} placeholder="1500000"/></FF>
            <FF label="Price / sqft"><input type="number" value={form.price_per_sqft||""} onChange={e=>sf("price_per_sqft",e.target.value)} placeholder="1200"/></FF>
            <FF label="Service Charge / sqft"><input type="number" value={form.service_charge_per_sqft||""} onChange={e=>sf("service_charge_per_sqft",e.target.value)} placeholder="18"/></FF>
          </G3>
          <G2>
            <FF label="Payment Plan"><input value={form.payment_plan||""} onChange={e=>sf("payment_plan",e.target.value)} placeholder="40/60 · 10/90 · 5yr post-handover"/></FF>
            <FF label="Handover Date"><input type="date" value={form.handover_date||""} onChange={e=>sf("handover_date",e.target.value)}/></FF>
          </G2>
          <FF label="Notes"><textarea value={form.notes||""} onChange={e=>sf("notes",e.target.value)} rows={2} placeholder="Special features, floor plan notes…"/></FF>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            {form.id&&<Btn variant="danger" onClick={()=>deleteItem("units",form.id,setUnits)}>Delete</Btn>}
            <Btn variant="outline" onClick={()=>{setModal(null);setForm({});}}>Cancel</Btn>
            <Btn onClick={saveUnit}>{form.id?"Save Changes":"Create Unit"}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// LEADS (v3 — stage gates, comms, meetings, followups)
// ══════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════
// LEADS — Full-page redesign with proposal, payments & contracts
// ══════════════════════════════════════════════════════════════════


// ══════════════════════════════════════════════════════════════════
// LEADS — Full-page redesign with proposal, payments & contracts
// ══════════════════════════════════════════════════════════════════

// Status colour helpers
const PAYMENT_STATUS_META = {
  Pending:   { c:"#8A6200", bg:"#FDF3DC" },
  Received:  { c:"#1A5FA8", bg:"#E6EFF9" },
  Deposited: { c:"#5B3FAA", bg:"#EEE8F9" },
  Cleared:   { c:"#1A7F5A", bg:"#E6F4EE" },
  Bounced:   { c:"#B83232", bg:"#FAEAEA" },
  Cancelled: { c:"#718096", bg:"#F7F9FC" },
};


// ══════════════════════════════════════════════════════════════════
// OPPORTUNITY DETAIL — full workflow per opportunity
// ══════════════════════════════════════════════════════════════════
const OPP_STAGES = ["New","Contacted","Site Visit","Proposal Sent","Negotiation","Offer Accepted","Reserved","SPA Signed","Closed Won","Closed Lost"];
const OPP_STAGE_META = {
  "New":            {c:"#718096", bg:"#F7F9FC"},
  "Contacted":      {c:"#1A5FA8", bg:"#E6EFF9"},
  "Site Visit":     {c:"#5B3FAA", bg:"#EEE8F9"},
  "Proposal Sent":  {c:"#A06810", bg:"#FDF3DC"},
  "Negotiation":    {c:"#B83232", bg:"#FAEAEA"},
  "Offer Accepted": {c:"#0F766E", bg:"#CCFBF1"},
  "Reserved":       {c:"#7C3AED", bg:"#EDE9FE"},
  "SPA Signed":     {c:"#1D4ED8", bg:"#DBEAFE"},
  "Closed Won":     {c:"#1A7F5A", bg:"#E6F4EE"},
  "Closed Lost":    {c:"#718096", bg:"#F7F9FC"},
};

function OutcomeModal({activity, onClose, onSave}){
  const [outcome, setOutcome] = useState(activity._pendingOutcome||"completed");
  const [notes, setNotes] = useState("");
  const [reschedDt, setReschedDt] = useState("");
  const titles = {completed:"✅ Mark as Completed",no_show:"📵 No Show / No Answer",rescheduled:"🔄 Reschedule",cancelled:"❌ Cancel Activity"};
  const placeholders = {
    completed:"What was discussed? What was the outcome?",
    no_show:"Any notes? e.g. Left voicemail, will try again tomorrow",
    rescheduled:"Why is it being rescheduled?",
    cancelled:"Reason for cancellation"
  };
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2000,padding:"1rem"}}>
      <div style={{background:"#fff",borderRadius:16,width:440,maxWidth:"100%",boxShadow:"0 20px 60px rgba(11,31,58,.35)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"1rem 1.5rem",borderBottom:"1px solid #E8EDF4",background:"#fff"}}>
          <span style={{fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:700,color:"#fff"}}>{titles[outcome]}</span>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:20,color:"#C9A84C",cursor:"pointer"}}>×</button>
        </div>
        <div style={{padding:"1.25rem 1.5rem"}}>
          {outcome==="rescheduled"&&(
            <div style={{marginBottom:12}}>
              <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:".5px"}}>📅 New Date & Time *</label>
              <input type="datetime-local" value={reschedDt} onChange={e=>setReschedDt(e.target.value)} style={{width:"100%",padding:"8px 10px",border:"1.5px solid #E2E8F0",borderRadius:8,fontSize:13,outline:"none",boxSizing:"border-box"}}/>
            </div>
          )}
          <div style={{marginBottom:16}}>
            <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:".5px"}}>
              {outcome==="completed"?"💬 Outcome Notes":"📝 Notes"}{outcome==="cancelled"?" *":""}
            </label>
            <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3}
              placeholder={placeholders[outcome]}
              style={{width:"100%",padding:"8px 10px",border:"1.5px solid #E2E8F0",borderRadius:8,fontSize:13,resize:"vertical",outline:"none",boxSizing:"border-box"}}/>
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <button onClick={onClose} style={{padding:"8px 18px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancel</button>
            <button onClick={()=>{
              if(outcome==="rescheduled"&&!reschedDt){alert("Please select a new date");return;}
              if(outcome==="cancelled"&&!notes.trim()){alert("Please provide a reason");return;}
              onSave(outcome,notes,reschedDt);
            }} style={{padding:"8px 20px",borderRadius:8,border:"none",background:"#0F2540",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>
              Save Outcome
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActivitiesList({activities, setActivities, opp, canEdit, showToast, isLeasing=false}){
  const [outcomeModal, setOutcomeModal] = useState(null); // {activity, pendingOutcome}
  const upcoming = activities.filter(a=>a.status==="upcoming"||(a.scheduled_at&&new Date(a.scheduled_at)>new Date()&&a.status!=="completed"&&a.status!=="no_show"&&a.status!=="cancelled"));
  const past = activities.filter(a=>!upcoming.find(u=>u.id===a.id));
  const icons = {Call:"📞",Email:"✉️",Meeting:"🤝",Visit:"🏠",WhatsApp:"💬",Note:"📝"};
  const statusColors = {completed:"#1A7F5A",upcoming:"#C9A84C",no_show:"#E53E3E",rescheduled:"#1A5FA8",cancelled:"#718096"};
  const statusLabels = {completed:"✅ Completed",upcoming:"⏰ Upcoming",no_show:"📵 No Show",rescheduled:"🔄 Rescheduled",cancelled:"❌ Cancelled"};

  const markOutcome = async(a, outcome, notes, reschedDt)=>{
    await supabase.from("activities").update({status:outcome, outcome:notes||null, rescheduled_to:reschedDt||null}).eq("id",a.id);
    if(reschedDt){
      await supabase.from("activities").insert({
        opportunity_id:isLeasing?null:a.opportunity_id,
        lease_opportunity_id:isLeasing?opp.id:null,
        lead_id:isLeasing?null:a.lead_id,
        type:a.type, note:"Rescheduled: "+(notes||""),
        scheduled_at:reschedDt, status:"upcoming",
        user_id:a.user_id, user_name:a.user_name,
        lead_name:a.lead_name, company_id:a.company_id,
      });
    }
    const col=isLeasing?"lease_opportunity_id":"opportunity_id";
    const{data}=await supabase.from("activities").select("*").eq(col,opp.id).order("created_at",{ascending:false});
    if(data) setActivities(data);
    setOutcomeModal(null);
    showToast("Task updated","success");
  };

  const ActCard = ({a})=>{
    const st = a.status||(a.scheduled_at&&new Date(a.scheduled_at)>new Date()?"upcoming":"completed");
    const isUpcoming = st==="upcoming";
    return(
      <div style={{background:"#fff",border:"1px solid "+(isUpcoming?"#C9A84C":"#E2E8F0"),borderRadius:10,padding:"12px 14px",display:"flex",gap:10}}>
        <div style={{width:34,height:34,borderRadius:"50%",background:isUpcoming?"rgba(201,168,76,.12)":"#F7F9FC",border:isUpcoming?"1.5px solid #C9A84C":"none",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>
          {icons[a.type]||"📋"}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4,flexWrap:"wrap",gap:6}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:13,fontWeight:700,color:"#0F2540"}}>{a.type}</span>
              <span style={{fontSize:10,fontWeight:700,color:statusColors[st]||"#718096",background:"rgba(0,0,0,.05)",padding:"2px 8px",borderRadius:10}}>
                {statusLabels[st]||st}
              </span>
            </div>
            <span style={{fontSize:11,color:"#A0AEC0"}}>{new Date(a.created_at).toLocaleDateString("en-AE",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</span>
          </div>
          {a.note&&<div style={{fontSize:12,color:"#4A5568",lineHeight:1.6,whiteSpace:"pre-wrap",marginBottom:4}}>{a.note}</div>}
          {a.outcome&&<div style={{fontSize:11,color:"#718096",fontStyle:"italic",marginBottom:4}}>Note: {a.outcome}</div>}
          <div style={{fontSize:11,color:"#A0AEC0"}}>{a.user_name}</div>
          {isUpcoming&&canEdit&&(
            <div style={{marginTop:10,paddingTop:10,borderTop:"1px dashed #E2E8F0"}}>
              <div style={{fontSize:11,fontWeight:600,color:"#718096",marginBottom:6}}>Mark outcome:</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {[["completed","✅ Completed","#1A7F5A"],["no_show","📵 No Show","#E53E3E"],["rescheduled","🔄 Reschedule","#1A5FA8"],["cancelled","❌ Cancel","#718096"]].map(([o,label,col])=>(
                  <button key={o} onClick={()=>setOutcomeModal({activity:a,pendingOutcome:o})}
                    style={{padding:"4px 12px",borderRadius:16,border:"1px solid "+col,background:"transparent",color:col,fontSize:11,cursor:"pointer",fontWeight:500}}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      {outcomeModal&&<OutcomeModal activity={{...outcomeModal.activity,_pendingOutcome:outcomeModal.pendingOutcome}} onClose={()=>setOutcomeModal(null)} onSave={(o,n,r)=>markOutcome(outcomeModal.activity,o,n,r)}/>}
      {upcoming.length>0&&(
        <div style={{marginBottom:4}}>
          <div style={{fontSize:11,fontWeight:700,color:"#C9A84C",textTransform:"uppercase",letterSpacing:"1px",marginBottom:8,display:"flex",alignItems:"center",gap:6}}>
            ⏰ Upcoming ({upcoming.length})
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {upcoming.map(a=><ActCard key={a.id} a={a}/>)}
          </div>
        </div>
      )}
      {past.length>0&&(
        <div>
          {upcoming.length>0&&(
            <div style={{fontSize:11,fontWeight:700,color:"#718096",textTransform:"uppercase",letterSpacing:"1px",marginBottom:8,marginTop:8,display:"flex",alignItems:"center",gap:6}}>
              📋 History ({past.length})
            </div>
          )}
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {past.map(a=><ActCard key={a.id} a={a}/>)}
          </div>
        </div>
      )}
    </div>
  );
}

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
  // Phase A.3 — Sprint 1 form (side-by-side feature flag)
  const [useNewForm, setUseNewForm] = useState(false);
  const [showAddV2, setShowAddV2] = useState(false);
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
        {canEdit&&(
          <button onClick={()=>setShowAddV2(true)} style={{padding:"8px 18px",borderRadius:8,border:"none",background:"#0F2540",color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>+ Add Lead</button>
        )}
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
      {/* Phase A.3 — new buyer-type-aware lead form (side-by-side with existing modal) */}
      {showAddV2&&(
        <LeadCreationFormV2
          companyId={currentUser?.company_id}
          currentUserId={currentUser?.id}
          onSubmit={async(payload)=>{
            const {data,error}=await supabase.from("leads").insert(payload).select().single();
            if(error) throw new Error(error.message||"Failed to create lead");
            return data;
          }}
          onCancel={()=>setShowAddV2(false)}
          onCreated={(newLead)=>{
            setShowAddV2(false);
            setLeads(p=>[newLead,...p]);
            showToast("Contact added (new form)","success");
          }}
        />
      )}

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
      {/* ── Helpers (inline, used only in this view) ── */}
      {(()=>{ /* no-op IIFE just to scope helpers via closures below */ })()}
      {/* Header — redesigned */}
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16,flexWrap:"wrap"}}>
        <button onClick={()=>setView("list")} style={{padding:"6px 14px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>← Leads</button>
        <Av name={selLead.name} size={40}/>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontFamily:"'Inter',sans-serif",fontSize:16,fontWeight:700,color:"#0F2540",letterSpacing:"-.4px"}}>{selLead.name}</div>
          <div style={{display:"flex",gap:6,marginTop:4,flexWrap:"wrap"}}>
            {(()=>{
              const BT_LABEL = {local_national:"Local national",gcc_resident_expat:"GCC resident expat",international_non_resident:"International (non-resident)",corporate:"Corporate"};
              const bt = selLead.buyer_type;
              return bt ? <span style={{fontSize:10,fontWeight:600,padding:"2px 9px",borderRadius:20,background:"#E8EDF4",color:"#0F2540"}}>{BT_LABEL[bt]||bt}</span> : null;
            })()}
            {(()=>{
              const KYC_META = {not_started:{c:"#8A6200",bg:"#FDF3DC",l:"KYC: Not started"},in_progress:{c:"#1A5FA8",bg:"#E6EFF8",l:"KYC: In progress"},verified:{c:"#1A7F5A",bg:"#E6F4EE",l:"KYC: Verified"},expired:{c:"#C53030",bg:"#FED7D7",l:"KYC: Expired"}};
              const k = selLead.kyc_status||"not_started";
              const m = KYC_META[k]||KYC_META.not_started;
              return <span style={{fontSize:10,fontWeight:600,padding:"2px 9px",borderRadius:20,background:m.bg,color:m.c}}>{m.l}</span>;
            })()}
            {selLead.pep_flag&&<span style={{fontSize:10,fontWeight:600,padding:"2px 9px",borderRadius:20,background:"#FDF3DC",color:"#8A6200"}}>⚠ PEP</span>}
          </div>
        </div>
        <div style={{display:"flex",gap:6}}>
          {canEdit&&<button onClick={()=>{setForm({...blank,...selLead});setEditLead(selLead);setShowAdd(true);}} style={{padding:"6px 14px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>✏ Edit</button>}
          {canEdit&&<button onClick={()=>{setOppForm({title:"",unit_id:"",budget:"",assigned_to:currentUser.id,notes:"",property_category:"Off-Plan"});setShowAddOpp(true);}} style={{padding:"6px 14px",borderRadius:8,border:"none",background:"#0F2540",color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>+ New Opportunity</button>}
        </div>
      </div>

      {/* Identity panel — only fields with data are shown */}
      {(()=>{
        const iso2ToFlag = (iso2)=>{ if(!iso2||iso2.length!==2)return ""; const c=iso2.toUpperCase(); return String.fromCodePoint(0x1F1E6+(c.charCodeAt(0)-65))+String.fromCodePoint(0x1F1E6+(c.charCodeAt(1)-65)); };
          const SOF_LABEL = {salary:"Salary",business:"Business income",investments:"Investments",inheritance:"Inheritance",sale_of_property:"Sale of property",savings:"Savings",gift:"Gift",other:"Other"};
        const rows = [];
        if(selLead.legal_name_en) rows.push(["Legal name (English)", selLead.legal_name_en]);
        if(selLead.legal_name_ar) rows.push(["Legal name (Arabic)", <span style={{direction:"rtl",unicodeBidi:"bidi-override",fontFamily:"'Noto Sans Arabic','Inter',sans-serif"}}>{selLead.legal_name_ar}</span>]);
        if(selLead.nationality_iso2) rows.push(["Nationality", `${iso2ToFlag(selLead.nationality_iso2)} ${selLead.nationality_iso2}`]);
        else if(selLead.nationality) rows.push(["Nationality", selLead.nationality]);
        if(selLead.residence_iso2) rows.push(["Residence", `${iso2ToFlag(selLead.residence_iso2)} ${selLead.residence_iso2}`]);
        if(selLead.tax_residency_iso2 && selLead.tax_residency_iso2!==selLead.residence_iso2) rows.push(["Tax residency", `${iso2ToFlag(selLead.tax_residency_iso2)} ${selLead.tax_residency_iso2}`]);
        if(selLead.phone_e164||selLead.phone) {
          const ph = selLead.phone_e164||selLead.phone;
          rows.push(["Phone", <a href={`tel:${ph}`} style={{color:"#1A5FA8",textDecoration:"none",fontWeight:600}}>{ph}</a>]);
        }
        if(selLead.email) rows.push(["Email", <a href={`mailto:${selLead.email}`} style={{color:"#1A5FA8",textDecoration:"none",fontWeight:600}}>{selLead.email}</a>]);
        if(selLead.source_of_funds) rows.push(["Source of funds", SOF_LABEL[selLead.source_of_funds]||selLead.source_of_funds]);
        if(selLead.source) rows.push(["Lead source", selLead.source]);
        if(selLead.property_type) rows.push(["Looking for", selLead.property_type]);
        if(selLead.budget&&Number(selLead.budget)>0) rows.push(["Budget", `AED ${Number(selLead.budget).toLocaleString()}`]);
        if(rows.length===0) return null;
        return (
          <div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:12,padding:"14px 18px",marginBottom:14}}>
            <div style={{fontSize:10,color:"#A0AEC0",textTransform:"uppercase",letterSpacing:".6px",fontWeight:700,marginBottom:10}}>Identity</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:"6px 24px"}}>
              {rows.map(([label,val],i)=>(
                <div key={i} style={{display:"flex",alignItems:"baseline",gap:10,padding:"3px 0",borderBottom:i<rows.length-1?"1px dashed #EEF2F7":"none"}}>
                  <div style={{fontSize:11,color:"#718096",minWidth:130}}>{label}</div>
                  <div style={{fontSize:13,fontWeight:600,color:"#0F2540",flex:1,overflow:"hidden",textOverflow:"ellipsis"}}>{val}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Notes panel — separate from Identity for readability */}
      {selLead.notes&&(
        <div style={{background:"#FFFEF7",border:"1px solid #F0E5C8",borderRadius:12,padding:"12px 16px",marginBottom:14}}>
          <div style={{fontSize:10,color:"#8A6200",textTransform:"uppercase",letterSpacing:".6px",fontWeight:700,marginBottom:6}}>Notes</div>
          <div style={{fontSize:13,color:"#3A3A2E",whiteSpace:"pre-wrap",lineHeight:1.5}}>{selLead.notes}</div>
        </div>
      )}

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
function LogActivityModal({lead, opp, currentUser, showToast, onClose, onSaved, defaultType="Call"}) {
  const [form, setForm] = useState({type:defaultType,note:"",scheduled_at:"",next_steps:"",duration_mins:"",status:"completed"});
  const [saving, setSaving] = useState(false);
  const sf = k => e => setForm(f=>({...f,[k]:e.target.value}));

  const save = async() => {
    if(!lead){showToast("No lead found","error");return;}
    setSaving(true);
    try{
      const payload = {
        lead_id: lead.id,
        lead_name: lead.name,
        company_id: currentUser.company_id||null,
        type: form.type,
        note: form.note||null,
        next_steps: form.next_steps||null,
        scheduled_at: form.scheduled_at||new Date().toISOString(),
        duration_mins: form.duration_mins?Number(form.duration_mins):null,
        status: form.status||"completed",
        created_by: currentUser.id,
        opportunity_id: opp?.id||null,
      };
      const{data,error}=await supabase.from("activities").insert(payload).select().single();
      if(error)throw error;
      onSaved(data);
    }catch(e){showToast(e.message,"error");}
    setSaving(false);
  };

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1100,padding:"1rem"}}>
      <div style={{background:"#fff",borderRadius:16,width:500,maxWidth:"100%",maxHeight:"92vh",overflow:"auto",boxShadow:"0 20px 60px rgba(11,31,58,.25)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"1rem 1.5rem",borderBottom:"1px solid #E8EDF4"}}>
          <div>
            <div style={{fontSize:15,fontWeight:700,color:"#0F2540",letterSpacing:"-.3px"}}>Log Activity</div>
            <div style={{fontSize:12,color:"#94A3B8",marginTop:2}}>{lead?.name}{opp?" · "+opp.title:""}</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:22,color:"#94A3B8",cursor:"pointer"}}>×</button>
        </div>
        <div style={{padding:"1.25rem 1.5rem"}}>
          <div style={{marginBottom:14}}>
            <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:".5px"}}>Activity Type</label>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {[["Call","📞"],["Email","✉️"],["Meeting","🤝"],["Site Visit","🏠"],["WhatsApp","💬"],["Note","📝"],["Proposal","📄"]].map(([t,icon])=>(
                <button key={t} onClick={()=>setForm(f=>({...f,type:t}))}
                  style={{padding:"6px 12px",borderRadius:20,border:`1.5px solid ${form.type===t?"#0F2540":"#E2E8F0"}`,background:form.type===t?"#0F2540":"#fff",color:form.type===t?"#fff":"#475569",fontSize:12,cursor:"pointer",fontWeight:form.type===t?600:400,display:"flex",alignItems:"center",gap:4}}>
                  <span style={{fontSize:13}}>{icon}</span>{t}
                </button>
              ))}
            </div>
          </div>

          <div style={{marginBottom:12}}>
            <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:".5px"}}>Status</label>
            <div style={{display:"flex",gap:6}}>
              {[["completed","✅ Completed"],["upcoming","⏰ Scheduled"]].map(([v,l])=>(
                <button key={v} onClick={()=>setForm(f=>({...f,status:v}))}
                  style={{padding:"5px 12px",borderRadius:7,border:`1.5px solid ${form.status===v?"#0F2540":"#E2E8F0"}`,background:form.status===v?"#0F2540":"#fff",color:form.status===v?"#fff":"#475569",fontSize:12,cursor:"pointer",fontWeight:form.status===v?600:400}}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {["Call","Meeting","Site Visit"].includes(form.type)&&(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
              <div>
                <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:".5px"}}>Date & Time</label>
                <input type="datetime-local" value={form.scheduled_at} onChange={sf("scheduled_at")}/>
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:".5px"}}>Duration</label>
                <select value={form.duration_mins} onChange={sf("duration_mins")}>
                  <option value="">Select…</option>
                  {["15","30","45","60","90","120"].map(m=><option key={m} value={m}>{m} mins</option>)}
                </select>
              </div>
            </div>
          )}

          <div style={{marginBottom:12}}>
            <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:".5px"}}>Discussion / Notes</label>
            <textarea value={form.note} onChange={sf("note")} rows={3} placeholder="What was discussed? Key points, client feedback, objections…"/>
          </div>
          <div style={{marginBottom:16}}>
            <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:".5px"}}>Next Steps</label>
            <textarea value={form.next_steps} onChange={sf("next_steps")} rows={2} placeholder="Follow-up action, who's responsible, by when?"/>
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <button onClick={onClose} style={{padding:"8px 18px",borderRadius:8,border:"1.5px solid #E2E8F0",background:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",color:"#475569"}}>Cancel</button>
            <button onClick={save} disabled={saving} style={{padding:"8px 20px",borderRadius:8,border:"none",background:"#0F2540",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>{saving?"Saving…":"Save Activity"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Pipeline({leads, opps, setOpps, users, currentUser, showToast, activities=[]}) {
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
    "Site Visit":     [{label:"📋 Log outcome",    act:"log"   },{label:"📄 Send proposal", act:"proposal"},{label:"📞 Follow up",     act:"call"    }],
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
          <StagePill stage="Site Visit"     count={myOpps.filter(o=>o.stage==="Site Visit").length}     value={myOpps.filter(o=>o.stage==="Site Visit").reduce((s,o)=>s+(o.budget||0),0)}     color="#5B3FAA" bg="#EEE8F9" border="#C4B5FD"/>
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


function GroupConsolidatedView() {
  return (
    <div className="fade-in" style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",gap:16,padding:"2rem",textAlign:"center"}}>
      <div style={{fontSize:56}}>🏛</div>
      <div style={{fontFamily:"'Playfair Display',serif",fontSize:24,fontWeight:700,color:"#0F2540"}}>Group Consolidated View</div>
      <div style={{fontSize:14,color:"#718096",maxWidth:500,lineHeight:1.8}}>
        This will provide consolidated reporting across all your legal entities — combined pipeline, rent roll, inventory and agent performance in one board-level view.
      </div>
      <div style={{background:"#FFF9EC",border:"1.5px solid #E8C97A",borderRadius:12,padding:"16px 24px",maxWidth:480,width:"100%",textAlign:"left"}}>
        <div style={{fontSize:12,fontWeight:700,color:"#8A6200",marginBottom:10,textTransform:"uppercase",letterSpacing:".5px"}}>📋 Planned for MVP Phase</div>
        {["Consolidated KPIs across all companies","Cross-entity pipeline & rent roll totals","Per-entity breakdown with drill-down","Group-level agent performance ranking","Consolidated PDF/Excel report export","Parent company / subsidiary structure"].map((f,i)=>(
          <div key={i} style={{display:"flex",gap:8,marginBottom:6,fontSize:13,color:"#4A5568"}}>
            <span style={{color:"#C9A84C",fontWeight:700}}>○</span>{f}
          </div>
        ))}
      </div>
      <div style={{fontSize:11,color:"#A0AEC0"}}>Requires <code style={{background:"#F7F9FC",padding:"1px 5px",borderRadius:4}}>group_id</code> column on companies table · Scheduled for MVP</div>
    </div>
  );
}

// ══════════════════════════════════════════════════════
// ROOT APP
// ══════════════════════════════════════════════════════
// app = "sales" | "leasing"   (which CRM context this tab belongs to)
const TABS=[
  // ── Sales CRM ──────────────────────────────────────────────────
  {id:"dashboard",  label:"Dashboard",    icon:"⊞",  app:"sales",   roles:["super_admin","admin","sales_manager","sales_agent","viewer"]},
  {id:"leads",      label:"Leads",        icon:"👤", app:"sales",   roles:["super_admin","admin","sales_manager","sales_agent"]},
  {id:"projects",   label:"Projects",     icon:"🏗️", app:"sales",   roles:["super_admin","admin","sales_manager"]},
  {id:"builder",    label:"Inventory",    icon:"🏠", app:"sales",   roles:["super_admin","admin","sales_manager","sales_agent"]},
  {id:"discounts",  label:"Discounts",    icon:"⚡", app:"sales",   roles:["super_admin","admin","sales_manager"]},
  {id:"activity",   label:"Activity Log", icon:"📝", app:"sales",   roles:["super_admin","admin","sales_manager","sales_agent"]},
  {id:"reports",    label:"Reports",      icon:"📊", app:"sales",   roles:["super_admin","admin","sales_manager"]},
  //{id:"ai",       label:"AI Assistant", icon:"✦",  app:"sales" -- removed, using AI bubble insteadles_manager","sales_agent"]},
  {id:"proppulse",  label:"PropPulse",   icon:"⚡", app:"sales",   roles:["super_admin","admin","sales_manager","sales_agent"]},
  {id:"companies",  label:"Companies",    icon:"🏢", app:"sales",   roles:["super_admin"]},
  {id:"users",      label:"Users",        icon:"👥", app:"sales",   roles:["admin","super_admin"]},
  {id:"permissions",label:"Permissions",  icon:"🔒", app:"sales",   roles:["super_admin"]},
  {id:"permsets",   label:"Permissions",  icon:"🔐", app:"sales",   roles:["super_admin","admin"]},
  {id:"group_view", label:"Group View",    icon:"🏛", app:"sales",   roles:["super_admin"]},
  // ── Leasing CRM ────────────────────────────────────────────────
  {id:"l_dashboard",label:"Dashboard",    icon:"⊞",  app:"leasing", roles:["super_admin","admin","leasing_manager","leasing_agent","viewer"]},
  {id:"l_leads",    label:"Leads",        icon:"👤", app:"leasing", roles:["super_admin","admin","leasing_manager","leasing_agent"]},
  {id:"l_projects",  label:"Projects",     icon:"🏗️", app:"leasing", roles:["super_admin","admin","leasing_manager"]},
  {id:"l_inventory",label:"Inventory",    icon:"📋", app:"leasing", roles:["super_admin","admin","leasing_manager","leasing_agent"]},
  {id:"leasing",    label:"Prop. Mgmt",  icon:"🏘️", app:"leasing", roles:["super_admin","admin","leasing_manager","leasing_agent"]},
  {id:"l_discounts",label:"Discounts",    icon:"⚡", app:"leasing", roles:["super_admin","admin","leasing_manager"]},
  {id:"l_activity", label:"Activity Log", icon:"📝", app:"leasing", roles:["super_admin","admin","leasing_manager","leasing_agent"]},
  {id:"l_reports",  label:"Reports",      icon:"📊", app:"leasing", roles:["super_admin","admin","leasing_manager"]},
  {id:"l_proppulse",label:"PropPulse",   icon:"⚡", app:"leasing", roles:["super_admin","admin","leasing_manager","leasing_agent"]},
  {id:"l_companies",label:"Companies",    icon:"🏢", app:"leasing", roles:["super_admin"]},
  {id:"l_users",    label:"Users",        icon:"👥", app:"leasing", roles:["admin","super_admin"]},
  {id:"l_permsets", label:"Permissions",  icon:"🔐", app:"leasing", roles:["super_admin","admin"]},
  {id:"l_group_view",label:"Group View",  icon:"🏛", app:"leasing", roles:["super_admin"]},
];

// Who can see the app switcher
const CAN_SWITCH_APP = ["super_admin","admin","sales_manager","leasing_manager"];

// Default app per role
const DEFAULT_APP = {
  super_admin:     "sales",
  admin:           "sales",
  sales_manager:   "sales",
  sales_agent:     "sales",
  leasing_manager: "leasing",
  leasing_agent:   "leasing",
  viewer:          "sales",
};
const SUBTITLES={
  dashboard:"Your sales overview at a glance",
  leads:"Manage leads with stage gates and full communications",
  builder:"Manage your property inventory — projects, units, pricing and availability",
  pipeline:"Drag deals across stages",
  discounts:"Discount approval hierarchy — Agent → Manager → Admin",
  activity:"Every call, email, meeting and note — all logged",
  ai:"Ask questions, draft messages, get insights — powered by Claude AI",
  users:"Manage team access and roles",
  l_dashboard:"Your leasing overview at a glance",
  l_pipeline: "Manage lease deals through stages",
  l_reports:  "Leasing analytics and performance",
  l_leads:"Tenant enquiries — track prospects looking to rent or lease",
  projects:"Create and manage property projects and developments",
  l_projects:"Create and manage leasing property projects",
  reports:    "Generate and export reports — pipeline, payments, rent roll, inventory",
  pay_plans:  "Manage payment plan templates per project — standard and custom plans",
  l_reports:  "Generate and export leasing reports — rent roll, PDC schedule, performance",
  l_inventory:"Lease inventory — units available for rent and lease",
  leasing:"Tenants · Contracts · Payments · Renewals · Maintenance",
  l_discounts:"Rent reduction approvals — Agent → Manager → Admin",
  l_activity:"Every tenant interaction and maintenance update logged",
  l_ai:"Ask questions about leases, tenants and payments — powered by Claude AI",
  l_users:"Manage leasing team access and roles",
  permsets:"Define custom permission sets and assign them to users",
  l_permsets:"Define custom permission sets and assign them to users",
};

// ══════════════════════════════════════════════════════
// PROPERTY BUILDER
// ══════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════
// PROJECTS MODULE — Standalone project management
// ══════════════════════════════════════════════════════════════════
function ProjectsModule({ currentUser, showToast, crmContext="sales", preloadedProjects=null, preloadedUnits=null }) {
  const [projects,  setProjects]  = useState(preloadedProjects||[]);
  const [units,     setUnits]     = useState(preloadedUnits||[]);
  const [loading,   setLoading]   = useState(!preloadedProjects);
  const [search,    setSearch]    = useState("");
  const [showAdd,   setShowAdd]   = useState(false);
  const [editProj,  setEditProj]  = useState(null);
  const [expanded,  setExpanded]  = useState(null);
  const [saving,    setSaving]    = useState(false);
  const [uploadingBrochure, setUploadingBrochure] = useState(false);
  const [drillProject, setDrillProject] = useState(null);
  const [showExcelUpload, setShowExcelUpload] = useState(false);

  const pBlank = {
    name:"", developer:"", location:"", community:"", city:"Dubai",
    country:"UAE", status:"Active", completion_date:"", launch_date:"",
    description:"", brochure_url:"", brochure_file_url:"",
    master_plan_url:"", website_url:""
  };
  const [form, setForm] = useState(pBlank);
  const sf = k => e => setForm(f=>({...f,[k]:e.target.value}));

  const load = useCallback(async(force=false)=>{
    if(!force && preloadedProjects && preloadedProjects.length >= 0) {
      setProjects(preloadedProjects);
      setUnits(preloadedUnits||[]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [p,u] = await Promise.all([
        safe(supabase.from("projects").select("*").order("name")),
        safe(supabase.from("project_units").select("id,project_id,unit_ref,unit_type,sub_type,status,purpose,floor_number,view,size_sqft,bedrooms,bathrooms,block_or_tower")),
      ]);
      setProjects(p.data||[]);
      setUnits(u.data||[]);
    } catch(e) { console.error("Projects load:", e); }
    setLoading(false);
  },[preloadedProjects, preloadedUnits]);

  useEffect(()=>{ load(); },[load]);

  const saveProject = async()=>{
    if(!form.name.trim()){ showToast("Project name required","error"); return; }
    setSaving(true);
    try {
      const cid = currentUser.company_id || localStorage.getItem("propccrm_company_id") || null;
      const payload = {
        name:form.name.trim(), developer:form.developer||null, location:form.location||null,
        community:form.community||null, city:form.city||"Dubai", country:form.country||"UAE",
        status:form.status||"Active", completion_date:form.completion_date||null,
        launch_date:form.launch_date||null, description:form.description||null,
        brochure_url:form.brochure_url||null, master_plan_url:form.master_plan_url||null,
        website_url:form.website_url||null, company_id:cid, created_by:currentUser.id
      };
      if(editProj) {
        const{error}=await supabase.from("projects").update(payload).eq("id",editProj.id);
        if(error) throw error;
        showToast("Project updated","success");
      } else {
        const{data,error}=await supabase.from("projects").insert(payload).select().single();
        if(error) throw error;
        showToast("Project created successfully","success");
      }
      setShowAdd(false); setEditProj(null); setForm(pBlank); load(true);
    } catch(e){ showToast(e.message||"Failed to save project","error"); console.error(e); }
    setSaving(false);
  };

  const uploadBrochure = async(file, projId)=>{
    if(!file) return;
    setUploadingBrochure(true);
    try {
      const path = `projects/${projId}/brochure_${Date.now()}_${file.name}`;
      // Try "propcrm-files" bucket first, fallback to "documents"
      const{error:ue} = await supabase.storage.from("propcrm-files").upload(path, file, {upsert:true});
      if(ue) throw ue;
      const{data:{publicUrl}} = supabase.storage.from("propcrm-files").getPublicUrl(path);
      await supabase.from("projects").update({brochure_file_url:publicUrl}).eq("id",projId);
      setProjects(p=>p.map(x=>x.id===projId?{...x,brochure_file_url:publicUrl}:x));
      showToast("Brochure uploaded","success");
    } catch(e){ showToast(e.message,"error"); }
    setUploadingBrochure(false);
  };

  const openEdit = (proj)=>{ setForm({...pBlank,...proj}); setEditProj(proj); setShowAdd(true); };

  const filtered = projects.filter(p=>!search||p.name.toLowerCase().includes(search.toLowerCase())||p.developer?.toLowerCase().includes(search.toLowerCase())||p.location?.toLowerCase().includes(search.toLowerCase()));

  const projStats = (pid)=>({
    total:     units.filter(u=>u.project_id===pid).length,
    available: units.filter(u=>u.project_id===pid&&u.status==="Available").length,
    sold:      units.filter(u=>u.project_id===pid&&(u.status==="Sold"||u.status==="Leased")).length,
    reserved:  units.filter(u=>u.project_id===pid&&u.status==="Reserved").length,
  });
  const canManage = ["super_admin","admin","sales_manager","leasing_manager"].includes(currentUser.role);

  if(loading) return <Spinner msg="Loading projects…"/>;

  // Drill-down view: show all units for a project
  if(drillProject){
    const projUnits = units.filter(u=>u.project_id===drillProject.id);
    // Note: preloaded units may have limited fields - show what's available
    const sc = s=>({Available:{bg:"#E6F4EE",c:"#1A7F5A"},Reserved:{bg:"#FDF3DC",c:"#A06810"},Sold:{bg:"#E6EFF9",c:"#1A5FA8"},Leased:{bg:"#EEE8F9",c:"#5B3FAA"}}[s]||{bg:"#F7F9FC",c:"#718096"});
    const avail=projUnits.filter(u=>u.status==="Available").length;
    const res=projUnits.filter(u=>u.status==="Reserved").length;
    const sold=projUnits.filter(u=>["Sold","Leased"].includes(u.status)).length;
    return (
      <div className="fade-in" style={{display:"flex",flexDirection:"column",height:"100%"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,flexWrap:"wrap"}}>
          <button onClick={()=>setDrillProject(null)} style={{padding:"7px 14px",borderRadius:8,border:"1.5px solid #E2E8F0",background:"#fff",fontSize:13,cursor:"pointer"}}>← Projects</button>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:16,fontWeight:700,color:"#0F2540"}}>{drillProject.name}</div>
          {drillProject.developer&&<span style={{fontSize:12,color:"#718096"}}>· {drillProject.developer}</span>}
          <div style={{display:"flex",gap:8,marginLeft:"auto"}}>
            <span style={{fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:20,background:"#E6F4EE",color:"#1A7F5A"}}>{avail} Available</span>
            {res>0&&<span style={{fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:20,background:"#FDF3DC",color:"#A06810"}}>{res} Reserved</span>}
            {sold>0&&<span style={{fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:20,background:"#E6EFF9",color:"#1A5FA8"}}>{sold} Sold/Leased</span>}
          </div>
        </div>
        {projUnits.length===0
          ?<div style={{textAlign:"center",padding:"3rem",color:"#A0AEC0"}}><div style={{fontSize:40,marginBottom:8}}>🏠</div><div>No units in this project yet</div></div>
          :<div style={{flex:1,overflowY:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead style={{position:"sticky",top:0,zIndex:1}}>
                <tr style={{background:"#0F2540"}}>
                  {["Unit Ref","Type","Floor","Beds","Size","View","Status"].map(h=>(
                    <th key={h} style={{padding:"10px 12px",textAlign:"left",fontSize:10,fontWeight:600,color:"#C9A84C",textTransform:"uppercase",letterSpacing:".5px"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {projUnits.map((u,i)=>(
                  <tr key={u.id} style={{background:i%2===0?"#fff":"#FAFBFC",borderBottom:"1px solid #F0F2F5"}}>
                    <td style={{padding:"10px 12px",fontWeight:700,fontSize:13,color:"#0F2540"}}>
                      {u.unit_ref||"—"}
                      {u.block_or_tower&&<div style={{fontSize:10,color:"#A0AEC0"}}>{u.block_or_tower}</div>}
                    </td>
                    <td style={{padding:"10px 12px",fontSize:12,color:"#4A5568"}}>{u.sub_type||u.unit_type||"—"}</td>
                    <td style={{padding:"10px 12px",fontSize:12,color:"#4A5568"}}>{u.floor_number||"—"}</td>
                    <td style={{padding:"10px 12px",fontSize:12,color:"#4A5568"}}>{u.bedrooms!=null?u.bedrooms+" bed":"—"}</td>
                    <td style={{padding:"10px 12px",fontSize:12,color:"#4A5568"}}>{u.size_sqft?Number(u.size_sqft).toLocaleString()+" sqft":"—"}</td>
                    <td style={{padding:"10px 12px",fontSize:12,color:"#4A5568"}}>{u.view||"—"}</td>
                    <td style={{padding:"10px 12px"}}><span style={{fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:20,background:sc(u.status).bg,color:sc(u.status).c}}>{u.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        }
      </div>
    );
  }

  return (
    <div className="fade-in" style={{display:"flex",flexDirection:"column",height:"100%"}}>
      {/* Top bar */}
      <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search projects…" style={{flex:1,minWidth:200}}/>
        <span style={{fontSize:12,color:"#A0AEC0"}}>{filtered.length} project{filtered.length!==1?"s":""}</span>
        <button onClick={()=>{setForm(pBlank);setEditProj(null);setShowAdd(true);}}
          style={{padding:"9px 20px",borderRadius:8,border:"none",background:"#0F2540",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>
          + New Project
        </button>
      </div>

      {/* Projects table */}
      <div style={{flex:1,overflowY:"auto"}}>
        {filtered.length===0&&<div style={{textAlign:"center",padding:"3rem",color:"#A0AEC0"}}><div style={{fontSize:40,marginBottom:8}}>🏢</div><div>No projects yet — click + New Project</div></div>}
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead style={{position:"sticky",top:0,zIndex:1}}>
            <tr style={{background:"#0F2540"}}>
              {["Project","Developer","Location","Units","Available","Sold","Status",""].map(h=>(
                <th key={h} style={{padding:"10px 12px",textAlign:"left",fontSize:10,fontWeight:600,color:"#C9A84C",textTransform:"uppercase",letterSpacing:".5px",whiteSpace:"nowrap"}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((proj,i)=>{
              const st = projStats(proj.id);
              const isExp = expanded===proj.id;
              const projUnits = units.filter(u=>u.project_id===proj.id);
              return [
                  <tr key={proj.id+"_main"}
                    style={{background:i%2===0?"#fff":"#FAFBFC",borderBottom:"1px solid #F0F2F5",cursor:"pointer",transition:"background .1s"}}
                    onMouseOver={e=>e.currentTarget.style.background="#F0F7FF"}
                    onMouseOut={e=>e.currentTarget.style.background=i%2===0?"#fff":"#FAFBFC"}>
                    <td style={{padding:"10px 12px"}} onClick={()=>setExpanded(isExp?null:proj.id)}>
                      <div style={{fontWeight:700,fontSize:13,color:"#0F2540"}}>{proj.name}</div>
                      {proj.completion_date&&<div style={{fontSize:11,color:"#A0AEC0"}}>Completion: {new Date(proj.completion_date).toLocaleDateString("en-AE",{month:"short",year:"numeric"})}</div>}
                    </td>
                    <td style={{padding:"10px 12px",fontSize:12,color:"#4A5568"}} onClick={()=>setExpanded(isExp?null:proj.id)}>{proj.developer||"—"}</td>
                    <td style={{padding:"10px 12px",fontSize:12,color:"#4A5568"}} onClick={()=>setExpanded(isExp?null:proj.id)}>{proj.location||proj.community||"—"}</td>
                    <td style={{padding:"10px 12px",fontSize:13,fontWeight:700,color:"#0F2540",textAlign:"center"}} onClick={()=>setExpanded(isExp?null:proj.id)}>{st.total}</td>
                    <td style={{padding:"10px 12px",textAlign:"center"}} onClick={()=>setExpanded(isExp?null:proj.id)}><span style={{fontSize:12,fontWeight:600,color:"#1A7F5A"}}>{st.available}</span></td>
                    <td style={{padding:"10px 12px",textAlign:"center"}} onClick={()=>setExpanded(isExp?null:proj.id)}><span style={{fontSize:12,fontWeight:600,color:"#1A5FA8"}}>{st.sold}</span></td>
                    <td style={{padding:"10px 12px"}} onClick={()=>setExpanded(isExp?null:proj.id)}>
                      <span style={{fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:20,background:proj.status==="Active"?"#E6F4EE":"#F7F9FC",color:proj.status==="Active"?"#1A7F5A":"#718096"}}>{proj.status}</span>
                    </td>
                    <td style={{padding:"10px 8px"}}>
                      <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                        <button onClick={()=>setDrillProject(proj)}
                          style={{fontSize:11,padding:"5px 12px",borderRadius:6,border:"none",background:"#0F2540",color:"#C9A84C",fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>
                          View Units →
                        </button>
                        {canManage&&<button onClick={()=>openEdit(proj)} style={{fontSize:11,padding:"5px 10px",borderRadius:6,border:"1.5px solid #E2E8F0",background:"#fff",cursor:"pointer",color:"#4A5568"}}>Edit</button>}
                      </div>
                    </td>
                  </tr>


              ];
            })}
          </tbody>
        </table>
      </div>


      {/* Excel Upload Modal */}
      {showExcelUpload&&(
        <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:"1rem"}}>
          <div style={{background:"#fff",borderRadius:16,width:500,maxWidth:"100%",boxShadow:"0 20px 60px rgba(11,31,58,.35)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"1rem 1.5rem",borderBottom:"1px solid #E8EDF4",background:"#fff"}}>
              <span style={{fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:700,color:"#fff"}}>📤 Upload Projects from Excel</span>
              <button onClick={()=>setShowExcelUpload(false)} style={{background:"none",border:"none",fontSize:22,color:"#C9A84C",cursor:"pointer"}}>×</button>
            </div>
            <div style={{padding:"1.5rem"}}>
              <div style={{background:"#F7F9FC",borderRadius:10,padding:"1rem",marginBottom:16,border:"1px solid #E2E8F0"}}>
                <div style={{fontSize:13,fontWeight:600,color:"#0F2540",marginBottom:8}}>Required Excel columns:</div>
                <div style={{fontSize:12,color:"#4A5568",lineHeight:1.8}}>
                  <strong>name</strong> (required) • developer • location • community • city • country • status • completion_date (YYYY-MM-DD) • launch_date • website_url • description
                </div>
              </div>
              <a href="data:text/csv;charset=utf-8,name,developer,location,community,city,country,status,completion_date,launch_date,website_url,description%0AProject Alpha,Emaar,Dubai Marina,Marina,Dubai,UAE,Active,2026-12-31,2026-01-01,https://example.com,Sample off-plan project%0AProject Beta,Nakheel,Palm Jumeirah,Palm,Dubai,UAE,Active,2027-06-30,2026-03-01,,Luxury villa community"
                download="propcrm_projects_template.csv"
                style={{display:"inline-block",padding:"8px 16px",borderRadius:8,background:"#E6EFF9",color:"#1A5FA8",fontSize:12,fontWeight:600,textDecoration:"none",marginBottom:16}}>
                ⬇ Download Template CSV (2 sample rows)
              </a>
              <div style={{border:"2px dashed #D1D9E6",borderRadius:10,padding:"2rem",textAlign:"center",background:"#FAFBFC"}}>
                <div style={{fontSize:32,marginBottom:8}}>📊</div>
                <div style={{fontSize:13,color:"#4A5568",marginBottom:12}}>Select your Excel or CSV file</div>
                <label style={{padding:"9px 20px",borderRadius:8,border:"none",background:"#0F2540",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>
                  <input type="file" accept=".csv,.xlsx,.xls" style={{display:"none"}} onChange={async(e)=>{
                    const file = e.target.files[0];
                    if(!file){ return; }
                    const text = await file.text();
                    const rows = text.trim().split("\n");
                    const headers = rows[0].split(",").map(h=>h.trim().replace(/"/g,""));
                    const records = rows.slice(1).filter(r=>r.trim()).map(row=>{
                      const vals = row.split(",").map(v=>v.trim().replace(/"/g,""));
                      const rec = {}; headers.forEach((h,i)=>{ rec[h]=vals[i]||null; });
                      return rec;
                    });
                    if(!records.length){ showToast("No data rows found","error"); return; }
                    const cid = currentUser.company_id || localStorage.getItem("propccrm_company_id") || null;
                    const payload = records.map(r=>({...r, company_id:cid, created_by:currentUser.id, status:r.status||"Active"}));
                    const{error}=await supabase.from("projects").insert(payload);
                    if(error){ showToast(error.message,"error"); return; }
                    showToast(`${records.length} project(s) uploaded successfully`,"success");
                    setShowExcelUpload(false); load(true);
                  }}/>
                  Choose File
                </label>
              </div>
              <div style={{fontSize:11,color:"#A0AEC0",marginTop:12}}>Tip: Export from Excel as CSV (comma-delimited) for best results</div>
            </div>
          </div>
        </div>
      )}

            {/* Add/Edit Modal */}
      {showAdd&&(
        <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:"1rem"}}>
          <div style={{background:"#fff",borderRadius:16,width:600,maxWidth:"100%",maxHeight:"92vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 20px 60px rgba(11,31,58,.35)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"1rem 1.5rem",borderBottom:"1px solid #E8EDF4",background:"#fff"}}>
              <span style={{fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:700,color:"#fff"}}>{editProj?"Edit Project":"New Project"}</span>
              <button onClick={()=>{setShowAdd(false);setEditProj(null);}} style={{background:"none",border:"none",fontSize:22,color:"#C9A84C",cursor:"pointer"}}>×</button>
            </div>
            <div style={{overflowY:"auto",padding:"1.25rem 1.5rem"}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div style={{gridColumn:"1/-1"}}><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Project Name *</label><input value={form.name} onChange={sf("name")} placeholder="e.g. Emaar Beachfront"/></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Developer</label><input value={form.developer||""} onChange={sf("developer")} placeholder="Emaar, Nakheel…"/></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Status</label><select value={form.status||"Active"} onChange={sf("status")}>{["Active","Sold Out","On Hold","Cancelled"].map(s=><option key={s}>{s}</option>)}</select></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Location</label><input value={form.location||""} onChange={sf("location")} placeholder="Dubai Marina, Downtown…"/></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Community</label><input value={form.community||""} onChange={sf("community")}/></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Launch Date</label><input type="date" value={form.launch_date||""} onChange={sf("launch_date")}/></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Completion Date</label><input type="date" value={form.completion_date||""} onChange={sf("completion_date")}/></div>
                <div style={{gridColumn:"1/-1"}}><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Website URL</label><input value={form.website_url||""} onChange={sf("website_url")} placeholder="https://…"/></div>
                <div style={{gridColumn:"1/-1"}}><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Description</label><textarea value={form.description||""} onChange={sf("description")} rows={3} placeholder="Project overview, key highlights…"/></div>
              </div>
            </div>
            <div style={{display:"flex",gap:10,justifyContent:"flex-end",padding:"1rem 1.5rem",borderTop:"1px solid #E2E8F0"}}>
              <button onClick={()=>{setShowAdd(false);setEditProj(null);}} style={{padding:"9px 20px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancel</button>
              <button onClick={saveProject} disabled={saving} style={{padding:"9px 24px",borderRadius:8,border:"none",background:saving?"#A0AEC0":"#0F2540",color:"#fff",fontSize:13,fontWeight:600,cursor:saving?"not-allowed":"pointer"}}>
                {saving?"Saving…":editProj?"Save Changes":"Create Project"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



// ══════════════════════════════════════════════════════════════════
// RESERVATION SYSTEM
// - ReservationModal: create / view / manage a reservation
// - ReservationBadge: shows on inventory rows
// - ReservationsDashboard: dashboard widget
// ══════════════════════════════════════════════════════════════════

const MAX_RESERVATION_FEE = 5000;

function hoursLeft(expiresAt, extendedUntil) {
  const exp = extendedUntil ? new Date(extendedUntil) : new Date(expiresAt);
  return Math.max(0, Math.round((exp - new Date()) / 36e5));
}

function reservationUrgency(res) {
  const hrs = hoursLeft(res.expires_at, res.extended_until);
  if (res.status !== "Active") return "inactive";
  if (hrs <= 0)   return "expired";
  if (hrs <= 12)  return "critical";
  if (hrs <= 24)  return "warning";
  return "ok";
}

const RES_COLORS = {
  ok:       { c:"#1A7F5A", bg:"#E6F4EE", border:"#A8D5BE" },
  warning:  { c:"#A06810", bg:"#FDF3DC", border:"#E8C97A" },
  critical: { c:"#B83232", bg:"#FAEAEA", border:"#F0BCBC" },
  expired:  { c:"#718096", bg:"#F7F9FC", border:"#CBD5E0" },
  inactive: { c:"#718096", bg:"#F7F9FC", border:"#CBD5E0" },
};

// ── Small badge shown on inventory row ─────────────────────────
function ReservationBadge({ reservation }) {
  if (!reservation) return null;
  const urg = reservationUrgency(reservation);
  const col = RES_COLORS[urg];
  const hrs = hoursLeft(reservation.expires_at, reservation.extended_until);
  if (reservation.status === "Confirmed") return (
    <span style={{fontSize:9,fontWeight:700,padding:"2px 6px",borderRadius:20,background:"#E6F4EE",color:"#1A7F5A",border:"1px solid #A8D5BE"}}>✓ Confirmed</span>
  );
  if (reservation.status !== "Active" && reservation.status !== "Extended") return null;
  return (
    <span style={{fontSize:9,fontWeight:700,padding:"2px 6px",borderRadius:20,background:col.bg,color:col.c,border:`1px solid ${col.border}`}}>
      {urg === "expired" ? "⚠ Expired" : `🔒 ${hrs}h left`}
    </span>
  );
}

// ── Create / Manage Reservation Modal ──────────────────────────
function ReservationModal({ unit, reservation, currentUser, leads=[], tenants=[], opportunities=[], showToast, onClose, onSaved, unitHasPrice=true, unitLaunchDate=null }) {
  const isNew = !reservation;
  const isSale = unit?.purpose === "Sale" || unit?.purpose === "Both";
  const isLease = unit?.purpose === "Lease" || unit?.purpose === "Both";

  const [form, setForm] = useState({
    reservation_type: isSale ? "Sale" : "Lease",
    client_name: "",
    client_phone: "",
    client_email: "",
    client_nationality: "",
    lead_id: "",
    tenant_id: "",
    opportunity_id: "",
    reservation_fee: 5000,
    fee_payment_method: "Cash",
    fee_received_date: new Date().toISOString().split("T")[0],
    notes: "",
    ...(reservation || {}),
  });
  const [saving, setSaving] = useState(false);
  const sf = k => e => setForm(f => ({...f, [k]: e.target?.value ?? e}));

  // Auto-fill from lead
  const onLeadChange = e => {
    const lead = leads.find(l => l.id === e.target.value);
    setForm(f => ({...f, lead_id: e.target.value,
      client_name:        lead?.name        || f.client_name,
      client_phone:       lead?.phone       || f.client_phone,
      client_email:       lead?.email       || f.client_email,
      client_nationality: lead?.nationality || f.client_nationality,
      opportunity_id: "", // reset opportunity when lead changes
    }));
  };

  // Auto-fill from tenant
  const onTenantChange = e => {
    const t = tenants.find(x => x.id === e.target.value);
    setForm(f => ({...f, tenant_id: e.target.value,
      client_name:  t?.full_name || f.client_name,
      client_phone: t?.phone     || f.client_phone,
      client_email: t?.email     || f.client_email,
    }));
  };

  // Opportunities for selected lead
  const leadOpps = opportunities.filter(o=>o.lead_id===form.lead_id);

  // Pre-flight validation checks for banner
  const isSaleType = form.reservation_type==="Sale";
  const missingLead = isSaleType && !form.lead_id;
  const missingTenant = !isSaleType && !form.tenant_id;
  const missingPrice = !unitHasPrice;
  const beforeLaunch = unitLaunchDate && new Date() < new Date(unitLaunchDate);
  const hasBlockers = missingLead||missingTenant||missingPrice||beforeLaunch;

  // Fee validation: max AED 5000 or 5% of unit value
  const validateFee = fee => {
    return fee <= MAX_RESERVATION_FEE;
  };

  const save = async () => {
    if (!form.client_name.trim()) { showToast("Client name required", "error"); return; }
    if (!validateFee(Number(form.reservation_fee))) {
      showToast(`Reservation fee cannot exceed AED ${MAX_RESERVATION_FEE.toLocaleString()}`, "error"); return;
    }
    setSaving(true);
    try {
      const payload = {
        unit_id:            unit.id,
        lead_id:            form.lead_id   || null,
        tenant_id:          form.tenant_id || null,
        company_id:         currentUser.company_id || null,
        reservation_type:   form.reservation_type,
        client_name:        form.client_name.trim(),
        client_phone:       form.client_phone   || null,
        client_email:       form.client_email   || null,
        client_nationality: form.client_nationality || null,
        reservation_fee:    Number(form.reservation_fee) || 5000,
        fee_payment_method: form.fee_payment_method,
        fee_received_date:  form.fee_received_date || null,
        notes:              form.notes || null,
        status:             "Active",
        reserved_at:        new Date().toISOString(),
        expires_at:         addWorkingDays(new Date(), 5).toISOString(),
        created_by:         currentUser.id,
      };
      const { data, error } = await supabase.from("reservations").insert(payload).select().single();
      if (error) throw error;
      // Mark unit as Reserved
      await supabase.from("project_units").update({ status: "Reserved" }).eq("id", unit.id);
      showToast("Unit reserved — 5 working day clock started", "success");
      onSaved(data);
    } catch(e) { showToast(e.message, "error"); }
    setSaving(false);
  };

  const confirm = async () => {
    setSaving(true);
    try {
      await supabase.from("reservations").update({ status:"Confirmed", confirmed_at:new Date().toISOString() }).eq("id", reservation.id);
      await supabase.from("project_units").update({ status: form.reservation_type==="Sale"?"Sold":"Leased" }).eq("id", unit.id);
      showToast("Reservation confirmed — unit marked " + (form.reservation_type==="Sale"?"Sold":"Leased"), "success");
      onSaved({ ...reservation, status:"Confirmed" });
    } catch(e) { showToast(e.message, "error"); }
    setSaving(false);
  };

  const release = async () => {
    // Only the agent who created the reservation OR admin/manager can release
    const isOwner = reservation.created_by === currentUser.id;
    const isAdmin = ["super_admin","admin","sales_manager","leasing_manager"].includes(currentUser.role);
    if(!isOwner && !isAdmin) {
      showToast("Only the agent who made this reservation or a manager can release it.", "error"); return;
    }
    const reason = prompt("Release reason (required for audit trail):");
    if(reason === null) return; // user cancelled
    if(!reason.trim()) { showToast("Please provide a release reason.", "error"); return; }
    setSaving(true);
    try {
      await supabase.from("reservations").update({
        status:"Released", released_at:new Date().toISOString(),
        release_reason:reason.trim(), released_by:currentUser.id
      }).eq("id", reservation.id);
      await supabase.from("project_units").update({ status:"Available" }).eq("id", unit.id);
      showToast("Reservation released — unit back to Available", "success");
      onSaved({ ...reservation, status:"Released" });
    } catch(e) { showToast(e.message, "error"); }
    setSaving(false);
  };

  const extend48 = async () => {
    const newExp = new Date((reservation.extended_until||reservation.expires_at));
    const extDate = addWorkingDays(newExp, 2); newExp.setTime(extDate.getTime());
    setSaving(true);
    try {
      await supabase.from("reservations").update({ status:"Extended", extended_until:newExp.toISOString() }).eq("id", reservation.id);
      showToast("Reservation extended by 2 working days", "success");
      onSaved({ ...reservation, status:"Extended", extended_until:newExp.toISOString() });
    } catch(e) { showToast(e.message, "error"); }
    setSaving(false);
  };

  const urg = reservation ? reservationUrgency(reservation) : "ok";
  const col = RES_COLORS[urg];
  const hrs = reservation ? hoursLeft(reservation.expires_at, reservation.extended_until) : 120;

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,.65)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1100,padding:"1rem"}}>
      <div style={{background:"#fff",borderRadius:16,width:520,maxWidth:"100%",maxHeight:"92vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 24px 64px rgba(11,31,58,.4)"}}>
        {/* Header */}
        <div style={{background:"#fff",padding:"1.125rem 1.5rem",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:700,color:"#fff"}}>
              {isNew ? "🔒 Reserve Unit" : "📋 Reservation Details"}
            </div>
            <div style={{fontSize:11,color:"rgba(255,255,255,.5)",marginTop:2}}>{unit?.unit_ref} · {unit?.sub_type}</div>
          </div>
          {!isNew && reservation.status === "Active" && (
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:22,fontWeight:700,color:urg==="ok"?"#4ADE80":urg==="warning"?"#FBBF24":"#F87171"}}>{hrs}h</div>
              <div style={{fontSize:10,color:"rgba(255,255,255,.5)"}}>remaining</div>
            </div>
          )}
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:22,color:"#C9A84C",cursor:"pointer",marginLeft:12}}>×</button>
        </div>

        {/* Expiry warning bar */}
        {!isNew && reservation.status === "Active" && (
          <div style={{background:col.bg,borderBottom:`2px solid ${col.border}`,padding:"8px 16px",fontSize:12,color:col.c,fontWeight:600,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span>{urg==="expired"?"⚠ Reservation has expired":urg==="critical"?`🔴 Expires in ${hrs} hours — action required`:urg==="warning"?`⚠ Expires in ${hrs} hours`:`✓ Active — expires ${new Date(reservation.extended_until||reservation.expires_at).toLocaleDateString("en-AE",{weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}`}</span>
            {(urg==="warning"||urg==="critical"||urg==="expired")&&<button onClick={extend48} style={{fontSize:11,padding:"3px 10px",borderRadius:6,border:"none",background:col.c,color:"#fff",cursor:"pointer"}}>+48h</button>}
          </div>
        )}

        {/* Status badge for non-active */}
        {!isNew && reservation.status !== "Active" && reservation.status !== "Extended" && (
          <div style={{background:reservation.status==="Confirmed"?"#E6F4EE":"#F7F9FC",padding:"8px 16px",fontSize:12,fontWeight:600,color:reservation.status==="Confirmed"?"#1A7F5A":"#718096"}}>
            {reservation.status==="Confirmed"?"✓ Confirmed — unit has been sold/leased":reservation.status==="Released"?"↩ Released — unit back to available":"Reservation "+reservation.status}
          </div>
        )}

        <div style={{overflowY:"auto",padding:"1.25rem 1.5rem",flex:1}}>
          {isNew ? (
            // ── New Reservation Form ──
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {/* Type */}
              {isSale && isLease && (
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:".5px"}}>Reservation Type</label>
                  <div style={{display:"flex",gap:8}}>
                    {["Sale","Lease"].map(t=>(
                      <button key={t} onClick={()=>setForm(f=>({...f,reservation_type:t}))}
                        style={{flex:1,padding:"8px",borderRadius:8,border:`1.5px solid ${form.reservation_type===t?"#0F2540":"#E2E8F0"}`,background:form.reservation_type===t?"#0F2540":"#fff",color:form.reservation_type===t?"#fff":"#4A5568",fontSize:13,fontWeight:600,cursor:"pointer"}}>
                        {t==="Sale"?"🏷 For Sale":"🔑 For Lease"}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {/* Link to lead/tenant */}
              {form.reservation_type==="Sale"&&leads.length>0&&(
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Link to Lead (optional)</label>
                  <select value={form.lead_id} onChange={onLeadChange}>
                    <option value="">— Select lead to auto-fill —</option>
                    {leads.filter(l=>!["Closed Won","Closed Lost"].includes(l.stage)).map(l=><option key={l.id} value={l.id}>{l.name} · {l.stage}</option>)}
                  </select>
                </div>
              )}
              {form.reservation_type==="Lease"&&tenants.length>0&&(
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Link to Tenant (optional)</label>
                  <select value={form.tenant_id} onChange={onTenantChange}>
                    <option value="">— Select tenant to auto-fill —</option>
                    {tenants.map(t=><option key={t.id} value={t.id}>{t.full_name}</option>)}
                  </select>
                </div>
              )}
              {form.reservation_type==="Lease"&&(
                <div style={{padding:"8px 12px",background:"#E6EFF9",borderRadius:8,fontSize:12,color:"#1A5FA8",fontWeight:600}}>
                  🔑 Leasing reservations are first-come-first-served. 48-hour hold applies.
                </div>
              )}
              {/* Client details */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div style={{gridColumn:"1/-1"}}><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Client Name *</label><input value={form.client_name} onChange={sf("client_name")} placeholder="Full name"/></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Phone</label><input value={form.client_phone} onChange={sf("client_phone")} placeholder="+971 50 000 0000"/></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Email</label><input value={form.client_email} onChange={sf("client_email")}/></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Nationality</label><input value={form.client_nationality} onChange={sf("client_nationality")} placeholder="UAE, India…"/></div>
              </div>
              {/* Fee */}
              <div style={{background:"#FDF3DC",border:"1px solid #E8C97A",borderRadius:10,padding:"12px 14px"}}>
                <div style={{fontSize:12,fontWeight:700,color:"#8A6200",marginBottom:10}}>💰 Reservation Fee</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  <div>
                    <label style={{fontSize:11,fontWeight:600,color:"#8A6200",display:"block",marginBottom:5}}>Amount (AED) — Max {MAX_RESERVATION_FEE.toLocaleString()}</label>
                    <input type="number" value={form.reservation_fee} onChange={sf("reservation_fee")} max={MAX_RESERVATION_FEE} min={0}
                      style={{border:`1.5px solid ${Number(form.reservation_fee)>MAX_RESERVATION_FEE?"#B83232":"#E8C97A"}`}}/>
                    {Number(form.reservation_fee)>MAX_RESERVATION_FEE&&<div style={{fontSize:10,color:"#B83232",marginTop:3}}>⚠ Cannot exceed AED {MAX_RESERVATION_FEE.toLocaleString()}</div>}
                  </div>
                  <div>
                    <label style={{fontSize:11,fontWeight:600,color:"#8A6200",display:"block",marginBottom:5}}>Payment Method</label>
                    <select value={form.fee_payment_method} onChange={sf("fee_payment_method")} style={{border:"1.5px solid #E8C97A"}}>
                      <option>Cash</option>
                      <option>Credit Card</option>
                      <option>Bank Transfer</option>
                    </select>
                  </div>
                  <div><label style={{fontSize:11,fontWeight:600,color:"#8A6200",display:"block",marginBottom:5}}>Fee Received Date</label><input type="date" value={form.fee_received_date} onChange={sf("fee_received_date")} style={{border:"1.5px solid #E8C97A"}}/></div>
                </div>
              </div>
              <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Notes</label><textarea value={form.notes} onChange={sf("notes")} rows={2} placeholder="Any additional notes…"/></div>
            </div>
          ) : (
            // ── View Existing Reservation ──
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {[
                  ["Client",       reservation.client_name],
                  ["Phone",        reservation.client_phone||"—"],
                  ["Email",        reservation.client_email||"—"],
                  ["Nationality",  reservation.client_nationality||"—"],
                  ["Type",         reservation.reservation_type],
                  ["Fee",          `AED ${Number(reservation.reservation_fee).toLocaleString()}`],
                  ["Payment",      reservation.fee_payment_method],
                  ["Reserved",     new Date(reservation.reserved_at).toLocaleDateString("en-AE",{day:"numeric",month:"short",year:"numeric"})],
                  ["Expires",      new Date(reservation.extended_until||reservation.expires_at).toLocaleDateString("en-AE",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})],
                  reservation.release_reason&&["Release Reason", reservation.release_reason],
                ].filter(Boolean).map(([l,v])=>(
                  <div key={l} style={{background:"#FAFBFC",borderRadius:8,padding:"9px 11px"}}>
                    <div style={{fontSize:9,color:"#A0AEC0",textTransform:"uppercase",letterSpacing:".5px",marginBottom:2}}>{l}</div>
                    <div style={{fontSize:12,fontWeight:600,color:"#0F2540",wordBreak:"break-all"}}>{v}</div>
                  </div>
                ))}
              </div>
              {reservation.notes&&<div style={{background:"#F7F9FC",borderRadius:8,padding:"10px 12px",fontSize:12,color:"#4A5568"}}>{reservation.notes}</div>}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div style={{padding:"1rem 1.5rem",borderTop:"1px solid #E2E8F0",display:"flex",gap:8,flexWrap:"wrap",justifyContent:"flex-end"}}>
          {isNew && <>
            <button onClick={onClose} style={{padding:"9px 18px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancel</button>
            <button onClick={save} disabled={saving||Number(form.reservation_fee)>MAX_RESERVATION_FEE}
              style={{padding:"9px 24px",borderRadius:8,border:"none",background:saving?"#A0AEC0":"#C9A84C",color:"#0F2540",fontSize:13,fontWeight:700,cursor:saving?"not-allowed":"pointer"}}>
              {saving?"Saving…":"🔒 Reserve Unit"}
            </button>
          </>}
          {!isNew && (reservation.status==="Active"||reservation.status==="Extended") && <>
            <button onClick={onClose} style={{padding:"9px 18px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>Close</button>
            <button onClick={release} disabled={saving}
              style={{padding:"9px 18px",borderRadius:8,border:"1.5px solid #F0BCBC",background:"#FAEAEA",color:"#B83232",fontSize:13,fontWeight:600,cursor:"pointer"}}>
              ↩ Release
            </button>
            <button onClick={confirm} disabled={saving}
              style={{padding:"9px 24px",borderRadius:8,border:"none",background:saving?"#A0AEC0":"#1A7F5A",color:"#fff",fontSize:13,fontWeight:700,cursor:saving?"not-allowed":"pointer"}}>
              ✓ Confirm {reservation.reservation_type==="Sale"?"Sale":"Lease"}
            </button>
          </>}
          {!isNew && !["Active","Extended"].includes(reservation.status) && (
            <button onClick={onClose} style={{padding:"9px 18px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>Close</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Reservations Dashboard Widget ──────────────────────────────
function ReservationsWidget({ currentUser, units=[], onManage }) {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data } = await supabase.from("reservations")
        .select("*").in("status", ["Active","Extended"]).order("expires_at");
      setReservations(data || []);
    } catch(e) { setReservations([]); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const t = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [load]);

  const expiredCount  = reservations.filter(r => hoursLeft(r.expires_at, r.extended_until) <= 0).length;
  const criticalCount = reservations.filter(r => { const h=hoursLeft(r.expires_at,r.extended_until); return h>0&&h<=12; }).length;
  const activeCount   = reservations.filter(r => hoursLeft(r.expires_at, r.extended_until) > 12).length;

  if (loading) return null;
  if (reservations.length === 0) return (
    <div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:12,padding:"16px"}}>
      <div style={{fontSize:11,fontWeight:700,color:"#A0AEC0",textTransform:"uppercase",letterSpacing:".6px",marginBottom:8}}>🔒 Active Reservations</div>
      <div style={{textAlign:"center",padding:"12px",color:"#A0AEC0",fontSize:12}}>No active reservations</div>
    </div>
  );

  return (
    <div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:12,overflow:"hidden"}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",borderBottom:"1px solid #F0F2F5"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:13,fontWeight:700,color:"#0F2540"}}>🔒 Active Reservations</span>
          <span style={{fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:20,background:"#E6F4EE",color:"#1A7F5A"}}>{reservations.length}</span>
        </div>
        <div style={{display:"flex",gap:6}}>
          {expiredCount>0&&<span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:20,background:"#FAEAEA",color:"#B83232"}}>⚠ {expiredCount} expired</span>}
          {criticalCount>0&&<span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:20,background:"#FDF3DC",color:"#A06810"}}>🔴 {criticalCount} critical</span>}
        </div>
      </div>
      {/* List */}
      {reservations.map(res => {
        const unit = units.find(u => u.id === res.unit_id);
        const urg  = reservationUrgency(res);
        const col  = RES_COLORS[urg];
        const hrs  = hoursLeft(res.expires_at, res.extended_until);
        return (
          <div key={res.id}
            onClick={() => onManage && onManage(res, unit)}
            style={{display:"flex",alignItems:"center",gap:12,padding:"10px 16px",borderBottom:"1px solid #F7F9FC",cursor:"pointer",borderLeft:`3px solid ${col.c}`,transition:"background .1s"}}
            onMouseOver={e=>e.currentTarget.style.background="#F7F9FC"}
            onMouseOut={e=>e.currentTarget.style.background="#fff"}>
            {/* Timer */}
            <div style={{textAlign:"center",flexShrink:0,width:44}}>
              <div style={{fontSize:18,fontWeight:700,color:col.c,lineHeight:1}}>{hrs <= 0 ? "!" : hrs < 100 ? hrs : "48+"}</div>
              <div style={{fontSize:8,color:col.c,fontWeight:600,textTransform:"uppercase"}}>{hrs<=0?"EXPIRED":"HRS"}</div>
            </div>
            {/* Info */}
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:700,fontSize:12,color:"#0F2540",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{res.client_name}</div>
              <div style={{fontSize:11,color:"#718096"}}>{unit?.unit_ref||"Unit"} · {res.reservation_type} · AED {Number(res.reservation_fee).toLocaleString()}</div>
            </div>
            {/* Payment method */}
            <div style={{flexShrink:0,textAlign:"right"}}>
              <div style={{fontSize:10,fontWeight:600,padding:"2px 7px",borderRadius:20,background:col.bg,color:col.c}}>{res.fee_payment_method}</div>
              <div style={{fontSize:10,color:"#A0AEC0",marginTop:2}}>{new Date(res.extended_until||res.expires_at).toLocaleDateString("en-AE",{day:"numeric",month:"short"})}</div>
            </div>
          </div>
        );
      })}
      {/* Footer */}
      <div style={{padding:"8px 16px",background:"#FAFBFC",fontSize:11,color:"#A0AEC0",textAlign:"center"}}>
        Click any reservation to confirm or release
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════
// INVENTORY MODULE — Flat unit list with top filters
// No left panel. Compact rows. Full unit detail modal.
// ══════════════════════════════════════════════════════════════════

const UNIT_STATUS_COLORS = {
  Available:  {c:"#1A7F5A", bg:"#E6F4EE"},
  Reserved:   {c:"#A06810", bg:"#FDF3DC"},
  "Under Offer":{c:"#5B3FAA",bg:"#EEE8F9"},
  Sold:       {c:"#1A5FA8", bg:"#E6EFF9"},
  Leased:     {c:"#1A5FA8", bg:"#E6EFF9"},
  Cancelled:  {c:"#718096", bg:"#F7F9FC"},
};


// ── SPLIT COMPONENTS ──────────────────────────────────────────
import InventoryModule from "./components/InventoryModule.jsx";
import LeasingModule from "./components/LeasingModule.jsx";
import ReportsModule from "./components/ReportsModule.jsx";
import LeaseOpportunityDetail from "./components/LeaseOpportunityDetail.jsx";
import LeasingLeads from "./components/LeasingLeads.jsx";
import PropPulse from "./components/PropPulse.jsx";
import LeadCreationFormV2 from "./components/LeadCreationFormV2.jsx";  // Phase A.3 — new buyer-type-aware form (side-by-side with old form)
// ──────────────────────────────────────────────────────────────


function DiscountApprovals({discounts,setDiscounts,leads,user,toast}) {
  const [filter, setFilter] = useState("Pending");
  const [saving, setSaving] = useState(false);
  const [responseNote, setResponseNote] = useState("");
  const [actingOn, setActingOn] = useState(null);
  const [action, setAction] = useState(null); // "approve"|"reject"|"escalate"

  const canApproveManager = can(user.role,"approve_manager");
  const canApproveAdmin   = can(user.role,"approve_all");

  const visible = discounts.filter(d=>{
    if(filter==="All") return true;
    return d.status===filter;
  });

  const doAction = async()=>{
    if(!actingOn) return;
    setSaving(true);
    try{
      let newStatus = action==="approve"?"Approved":action==="reject"?"Rejected":"Escalated";
      const {data,error}=await supabase.from("discount_requests").update({status:newStatus,response_note:responseNote,response_by:user.id,response_by_name:user.full_name,responded_at:new Date().toISOString()}).eq("id",actingOn.id).select().single();
      if(error)throw error;
      setDiscounts(p=>p.map(d=>d.id===actingOn.id?data:d));
      toast(`Discount request ${newStatus.toLowerCase()}`,action==="approve"?"success":action==="reject"?"info":"warning");
      setActingOn(null); setAction(null); setResponseNote("");
    }catch(e){toast(e.message,"error");}
    setSaving(false);
  };

  const DISC_TYPES_MAP = {sale_price:{label:"Sale Price Reduction",icon:"🏷"},rent:{label:"Rent Reduction",icon:"🔑"},payment_plan:{label:"Payment Plan Change",icon:"📅"},agency_fee:{label:"Agency Fee Waiver",icon:"🤝"}};

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      {/* Stats bar */}
      <div style={{display:"flex",gap:12,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
        {[["All","All",discounts.length],["Pending","Pending",discounts.filter(d=>d.status==="Pending").length],["Escalated","Escalated",discounts.filter(d=>d.status==="Escalated").length],["Approved","Approved",discounts.filter(d=>d.status==="Approved").length],["Rejected","Rejected",discounts.filter(d=>d.status==="Rejected").length]].map(([f,l,cnt])=>(
          <button key={f} onClick={()=>setFilter(f)} style={{padding:"6px 16px",borderRadius:8,border:`1.5px solid ${filter===f?"#0F2540":"#E2E8F0"}`,background:filter===f?"#0F2540":"#fff",color:filter===f?"#fff":"#4A5568",fontSize:12,fontWeight:filter===f?600:400,cursor:"pointer"}}>{l} ({cnt})</button>
        ))}
      </div>

      {/* Info banner for agents */}
      {user.role==="agent"&&(
        <div style={{background:"#E6EFF9",border:"1px solid #B5D4F4",borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:13,color:"#1A5FA8",lineHeight:1.6}}>
          ℹ Discount requests up to <strong>5%</strong> go to your Manager. Above 5% are escalated directly to Admin.
          Request discounts from inside a Lead's detail panel.
        </div>
      )}

      <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:10}}>
        {visible.length===0&&<div style={{textAlign:"center",padding:"3rem",color:"#A0AEC0"}}><div style={{fontSize:36,marginBottom:8}}>⚡</div><div>No {filter.toLowerCase()} discount requests</div></div>}
        {visible.map(d=>{
          const t=DISC_TYPES_MAP[d.type]||{label:d.type,icon:"💰"};
          const sc={Pending:{c:"#A06810",bg:"#FDF3DC"},Approved:{c:"#1A7F5A",bg:"#E6F4EE"},Rejected:{c:"#B83232",bg:"#FAEAEA"},Escalated:{c:"#5B3FAA",bg:"#EEE8F9"}}[d.status]||{c:"#718096",bg:"#F7F9FC"};
          const canAct = (d.status==="Pending"&&canApproveManager)||(d.status==="Escalated"&&canApproveAdmin);
          return (
            <div key={d.id} style={{background:"#fff",border:`1px solid ${d.status==="Escalated"?"#C9A84C":d.status==="Pending"?"#E8C97A":"#E2E8F0"}`,borderRadius:12,padding:"14px 16px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                <div>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                    <span style={{fontSize:18}}>{t.icon}</span>
                    <span style={{fontSize:14,fontWeight:700,color:"#0F2540"}}>{t.label}</span>
                    <span style={{fontSize:12,fontWeight:600,padding:"3px 10px",borderRadius:20,background:sc.bg,color:sc.c}}>{d.status}</span>
                    {d.status==="Escalated"&&<span style={{fontSize:11,color:"#5B3FAA",fontWeight:700}}>⚡ Requires Admin</span>}
                  </div>
                  <div style={{fontSize:13,color:"#4A5568"}}>Lead: <strong>{d.lead_name}</strong> · Requested by: {d.requested_by_name}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:700,color:d.discount_pct>5?"#B83232":"#A06810"}}>{d.discount_pct}%</div>
                  <div style={{fontSize:11,color:"#A0AEC0"}}>discount requested</div>
                </div>
              </div>

              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,background:"#FAFBFC",borderRadius:8,padding:"10px",marginBottom:10}}>
                <div><div style={{fontSize:9,color:"#A0AEC0",textTransform:"uppercase",letterSpacing:".6px"}}>Original Value</div><div style={{fontSize:13,fontWeight:600,color:"#0F2540"}}>{d.original_value?`AED ${Number(d.original_value).toLocaleString()}`:"—"}</div></div>
                <div><div style={{fontSize:9,color:"#A0AEC0",textTransform:"uppercase",letterSpacing:".6px"}}>Requested Value</div><div style={{fontSize:13,fontWeight:600,color:"#1A7F5A"}}>{d.requested_value?`AED ${Number(d.requested_value).toLocaleString()}`:"—"}</div></div>
                <div><div style={{fontSize:9,color:"#A0AEC0",textTransform:"uppercase",letterSpacing:".6px"}}>Saving</div><div style={{fontSize:13,fontWeight:600,color:"#B83232"}}>{d.original_value&&d.requested_value?`AED ${Number(d.original_value-d.requested_value).toLocaleString()}`:"—"}</div></div>
                <div><div style={{fontSize:9,color:"#A0AEC0",textTransform:"uppercase",letterSpacing:".6px"}}>Discount Source</div>
                  <div style={{fontSize:12,fontWeight:700,padding:"2px 8px",borderRadius:20,display:"inline-block",
                    background:d.discount_source==="Developer"?"#EDE9FE":"#E6EFF9",
                    color:d.discount_source==="Developer"?"#7C3AED":"#1A5FA8"}}>
                    {d.discount_source==="Developer"?"🏗 Developer":"🏢 Our Company"}
                  </div>
                  {d.developer_auth_ref&&<div style={{fontSize:10,color:"#94A3B8",marginTop:2}}>Ref: {d.developer_auth_ref}</div>}
                </div>
              </div>

              <div style={{background:"#F7F9FC",borderRadius:8,padding:"8px 12px",marginBottom:10,fontSize:13,color:"#4A5568",lineHeight:1.6}}>
                <strong>Reason:</strong> {d.reason}
              </div>

              {d.response_note&&(
                <div style={{background:d.status==="Approved"?"#E6F4EE":"#FAEAEA",borderRadius:8,padding:"8px 12px",marginBottom:10,fontSize:13,color:d.status==="Approved"?"#1A7F5A":"#B83232"}}>
                  <strong>{d.response_by_name}:</strong> {d.response_note}
                </div>
              )}

              <div style={{fontSize:11,color:"#A0AEC0"}}>Requested {new Date(d.created_at).toLocaleDateString("en-AE",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})}</div>

              {canAct&&(
                <div style={{display:"flex",gap:8,marginTop:12,flexWrap:"wrap"}}>
                  <button onClick={()=>{setActingOn(d);setAction("approve");setResponseNote("");}} style={{padding:"8px 18px",borderRadius:8,border:"none",background:"#E6F4EE",color:"#1A7F5A",fontSize:13,fontWeight:600,cursor:"pointer"}}>✓ Approve</button>
                  {d.status==="Pending"&&canApproveManager&&!canApproveAdmin&&(
                    <button onClick={()=>{setActingOn(d);setAction("escalate");setResponseNote("");}} style={{padding:"8px 18px",borderRadius:8,border:"1.5px solid #C9A84C",background:"#FDF3DC",color:"#8A6200",fontSize:13,fontWeight:600,cursor:"pointer"}}>⚡ Escalate to Admin</button>
                  )}
                  <button onClick={()=>{setActingOn(d);setAction("reject");setResponseNote("");}} style={{padding:"8px 18px",borderRadius:8,border:"1.5px solid #F0BCBC",background:"#FAEAEA",color:"#B83232",fontSize:13,fontWeight:600,cursor:"pointer"}}>✕ Reject</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Action modal */}
      {actingOn&&action&&(
        <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:"1rem"}}>
          <div style={{background:"#fff",borderRadius:16,width:440,padding:"1.5rem",boxShadow:"0 20px 60px rgba(0,0,0,.3)"}}>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:700,color:"#0F2540",marginBottom:14}}>
              {action==="approve"?"✓ Approve Discount":action==="reject"?"✕ Reject Discount":"⚡ Escalate to Admin"}
            </div>
            <div style={{background:"#FAFBFC",borderRadius:8,padding:"10px 12px",marginBottom:14,fontSize:13,color:"#4A5568"}}>
              <strong>{DISC_TYPES_MAP[actingOn.type]?.label}</strong> — {actingOn.discount_pct}% — Lead: {actingOn.lead_name}
            </div>
            <div style={{marginBottom:14}}>
              <label style={{fontSize:11,fontWeight:600,color:"#4A5568",textTransform:"uppercase",letterSpacing:".5px",display:"block",marginBottom:5}}>Response Note {action!=="escalate"?"(optional)":"(reason for escalation)"}</label>
              <textarea value={responseNote} onChange={e=>setResponseNote(e.target.value)} rows={3} placeholder={action==="approve"?"e.g. Approved as client is committing to full payment…":action==="reject"?"e.g. Cannot go below asking price at this stage…":"e.g. This exceeds my approval limit — escalating to Admin…"}/>
            </div>
            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              <button onClick={()=>{setActingOn(null);setAction(null);}} style={{padding:"9px 18px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancel</button>
              <button onClick={doAction} disabled={saving} style={{padding:"9px 18px",borderRadius:8,border:"none",background:action==="approve"?"#1A7F5A":action==="reject"?"#B83232":"#5B3FAA",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>
                {saving?"Processing…":action==="approve"?"Confirm Approval":action==="reject"?"Confirm Rejection":"Escalate to Admin"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// LEASING MODULE
// ══════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════
// LEASING PDC — Post-Dated Cheque Manager (sub-component)
// Used inside LeasingModule → Leases tab
// ══════════════════════════════════════════════════════════════════
function LeasingChequeManager({ lease, tenantName, unitLabel, currentUser, showToast }) {
  const [cheques,   setCheques]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showAdd,   setShowAdd]   = useState(false);
  const [editCheq,  setEditCheq]  = useState(null);
  const [saving,    setSaving]    = useState(false);

  const blank = {
    cheque_number:"", cheque_date:"", amount: lease.annual_rent
      ? Math.round(lease.annual_rent / (lease.number_of_cheques||4))
      : "",
    bank_name:"", period_from:"", period_to:"",
    cheque_sequence:1, total_cheques: lease.number_of_cheques||4,
    status:"Pending", notes:""
  };
  const [form, setForm] = useState(blank);
  const sf = k => e => setForm(f=>({...f,[k]:e.target?.value??e}));

  const load = useCallback(async()=>{
    setLoading(true);
    const {data} = await supabase.from("lease_cheques")
      .select("*").eq("lease_id", lease.id).order("cheque_date");
    setCheques(data||[]);
    setLoading(false);
  },[lease.id]);

  useEffect(()=>{ load(); },[load]);

  const save = async()=>{
    if(!form.amount||!form.cheque_date){showToast("Amount and cheque date required","error");return;}
    setSaving(true);
    try{
      const payload = {
        lease_id:   lease.id,
        unit_id:    lease.unit_id||null,
        tenant_id:  lease.tenant_id||null,
        company_id: currentUser.company_id||null,
        cheque_number:   form.cheque_number||null,
        cheque_date:     form.cheque_date,
        amount:          Number(form.amount),
        bank_name:       form.bank_name||null,
        period_from:     form.period_from||null,
        period_to:       form.period_to||null,
        cheque_sequence: Number(form.cheque_sequence)||1,
        total_cheques:   Number(form.total_cheques)||4,
        status:          form.status,
        notes:           form.notes||null,
        created_by:      currentUser.id,
      };
      let data, error;
      if(editCheq){
        ({data,error}=await supabase.from("lease_cheques").update(payload).eq("id",editCheq.id).select().single());
        setCheques(p=>p.map(c=>c.id===editCheq.id?data:c));
      } else {
        ({data,error}=await supabase.from("lease_cheques").insert(payload).select().single());
        setCheques(p=>[...p,data].sort((a,b)=>new Date(a.cheque_date)-new Date(b.cheque_date)));
      }
      if(error)throw error;
      showToast(editCheq?"Cheque updated":"Cheque added","success");
      setShowAdd(false);setEditCheq(null);setForm(blank);
    }catch(e){showToast(e.message,"error");}
    setSaving(false);
  };

  const updateStatus = async(id,status)=>{
    const extra={};
    if(status==="Deposited") extra.deposit_date=new Date().toISOString().split("T")[0];
    if(status==="Cleared")   extra.cleared_date=new Date().toISOString().split("T")[0];
    await supabase.from("lease_cheques").update({status,...extra}).eq("id",id);
    setCheques(p=>p.map(c=>c.id===id?{...c,status,...extra}:c));
    showToast(`Cheque marked ${status}`,"success");
  };

  // Auto-generate full PDC schedule from lease
  const autoGenerate = async()=>{
    const n     = Number(lease.number_of_cheques)||4;
    const total = Number(lease.annual_rent)||0;
    const amt   = Math.round(total/n);
    const start = new Date(lease.start_date||new Date());
    const inserts = [];
    for(let i=0;i<n;i++){
      const d = new Date(start);
      d.setMonth(d.getMonth() + Math.round(i*(12/n)));
      inserts.push({
        lease_id:   lease.id, unit_id:lease.unit_id||null, tenant_id:lease.tenant_id||null,
        company_id: currentUser.company_id||null,
        cheque_date:    d.toISOString().split("T")[0],
        amount:         amt,
        cheque_sequence:i+1,
        total_cheques:  n,
        status:         "Pending",
        created_by:     currentUser.id,
      });
    }
    const {data,error} = await supabase.from("lease_cheques").insert(inserts).select();
    if(error){showToast(error.message,"error");return;}
    setCheques(data||[]);
    showToast(`${n} PDC cheques generated`,"success");
  };

  const CHEQ_COLORS = {
    Pending:   {c:"#8A6200",bg:"#FDF3DC"},
    Deposited: {c:"#1A5FA8",bg:"#E6EFF9"},
    Cleared:   {c:"#1A7F5A",bg:"#E6F4EE"},
    Bounced:   {c:"#B83232",bg:"#FAEAEA"},
    Replaced:  {c:"#5B3FAA",bg:"#EEE8F9"},
    Cancelled: {c:"#718096",bg:"#F7F9FC"},
  };

  const cleared   = cheques.filter(c=>c.status==="Cleared").reduce((s,c)=>s+(c.amount||0),0);
  const pending   = cheques.filter(c=>c.status==="Pending"||c.status==="Deposited").reduce((s,c)=>s+(c.amount||0),0);
  const bounced   = cheques.filter(c=>c.status==="Bounced").length;

  if(loading) return <div style={{padding:12,color:"#A0AEC0",fontSize:12}}>Loading cheques…</div>;

  return (
    <div style={{borderTop:"1px solid #F0F2F5",paddingTop:12,marginTop:8}}>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div style={{fontSize:12,fontWeight:700,color:"#0F2540"}}>PDC Cheques ({cheques.length})</div>
        <div style={{display:"flex",gap:6}}>
          {cheques.length===0&&(
            <button onClick={autoGenerate}
              style={{fontSize:11,padding:"4px 10px",borderRadius:6,border:"none",background:"#5B3FAA",color:"#fff",cursor:"pointer",fontWeight:600}}>
              ✦ Auto-Generate {lease.number_of_cheques||4} Cheques
            </button>
          )}
          <button onClick={()=>{setForm({...blank,cheque_sequence:cheques.length+1});setEditCheq(null);setShowAdd(true);}}
            style={{fontSize:11,padding:"4px 10px",borderRadius:6,border:"none",background:"#0F2540",color:"#fff",cursor:"pointer"}}>
            + Add Cheque
          </button>
        </div>
      </div>

      {/* Summary bar */}
      {cheques.length>0&&(
        <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap"}}>
          <span style={{fontSize:11,padding:"3px 9px",borderRadius:20,background:"#E6F4EE",color:"#1A7F5A",fontWeight:600}}>✓ AED {cleared.toLocaleString()} cleared</span>
          <span style={{fontSize:11,padding:"3px 9px",borderRadius:20,background:"#FDF3DC",color:"#8A6200",fontWeight:600}}>⏳ AED {pending.toLocaleString()} pending</span>
          {bounced>0&&<span style={{fontSize:11,padding:"3px 9px",borderRadius:20,background:"#FAEAEA",color:"#B83232",fontWeight:600}}>⚠ {bounced} bounced</span>}
        </div>
      )}

      {/* Cheques list */}
      {cheques.length===0&&<div style={{textAlign:"center",padding:"1rem",color:"#A0AEC0",fontSize:12}}>No cheques yet — click Auto-Generate or Add Cheque</div>}
      {cheques.map((c,i)=>{
        const cm=CHEQ_COLORS[c.status]||CHEQ_COLORS.Pending;
        const isOverdue=c.status==="Pending"&&new Date(c.cheque_date)<new Date();
        return (
          <div key={c.id} style={{background:isOverdue?"#FFF5F5":"#FAFBFC",border:`1px solid ${isOverdue?"#F0BCBC":"#E2E8F0"}`,borderRadius:8,padding:"9px 11px",marginBottom:6}}>
            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
              <div style={{fontSize:11,fontWeight:700,color:"#A0AEC0",width:24}}>{c.cheque_sequence}/{c.total_cheques}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                  <span style={{fontWeight:700,fontSize:13,color:"#0F2540"}}>AED {Number(c.amount).toLocaleString()}</span>
                  <span style={{fontSize:10,fontWeight:600,padding:"2px 7px",borderRadius:20,background:cm.bg,color:cm.c}}>{c.status}</span>
                  {isOverdue&&<span style={{fontSize:10,fontWeight:600,color:"#B83232"}}>⚠ Overdue</span>}
                </div>
                <div style={{fontSize:11,color:"#718096",marginTop:2}}>
                  {new Date(c.cheque_date).toLocaleDateString("en-AE",{day:"numeric",month:"short",year:"numeric"})}
                  {c.cheque_number&&` · #${c.cheque_number}`}
                  {c.bank_name&&` · ${c.bank_name}`}
                </div>
              </div>
              <div style={{display:"flex",gap:4}}>
                <select value={c.status} onChange={e=>updateStatus(c.id,e.target.value)}
                  style={{fontSize:10,padding:"3px 6px",borderRadius:5,border:"1px solid #E2E8F0",background:"#fff"}}>
                  {Object.keys(CHEQ_COLORS).map(s=><option key={s}>{s}</option>)}
                </select>
                <button onClick={()=>{setForm({...blank,...c});setEditCheq(c);setShowAdd(true);}}
                  style={{fontSize:10,padding:"3px 7px",borderRadius:5,border:"1px solid #E2E8F0",background:"#fff",cursor:"pointer"}}>✏</button>
              </div>
            </div>
          </div>
        );
      })}

      {/* Add/Edit modal */}
      {showAdd&&(
        <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1100,padding:"1rem"}}>
          <div style={{background:"#fff",borderRadius:14,width:440,maxWidth:"100%",maxHeight:"90vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 20px 60px rgba(11,31,58,.35)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"1rem 1.25rem",borderBottom:"1px solid #E2E8F0"}}>
              <span style={{fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:700,color:"#0F2540"}}>{editCheq?"Edit Cheque":"Add PDC Cheque"}</span>
              <button onClick={()=>{setShowAdd(false);setEditCheq(null);}} style={{background:"none",border:"none",fontSize:20,color:"#A0AEC0",cursor:"pointer"}}>×</button>
            </div>
            <div style={{overflowY:"auto",padding:"1.125rem 1.25rem"}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div><label style={{fontSize:10,fontWeight:600,color:"#4A5568",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:".5px"}}>Amount (AED) *</label><input type="number" value={form.amount} onChange={sf("amount")} placeholder="30000"/></div>
                <div><label style={{fontSize:10,fontWeight:600,color:"#4A5568",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:".5px"}}>Cheque Date *</label><input type="date" value={form.cheque_date} onChange={sf("cheque_date")}/></div>
                <div><label style={{fontSize:10,fontWeight:600,color:"#4A5568",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:".5px"}}>Cheque Number</label><input value={form.cheque_number} onChange={sf("cheque_number")} placeholder="CHQ-001234"/></div>
                <div><label style={{fontSize:10,fontWeight:600,color:"#4A5568",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:".5px"}}>Bank Name</label><input value={form.bank_name} onChange={sf("bank_name")} placeholder="Emirates NBD"/></div>
                <div><label style={{fontSize:10,fontWeight:600,color:"#4A5568",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:".5px"}}>Sequence</label><input type="number" value={form.cheque_sequence} onChange={sf("cheque_sequence")}/></div>
                <div><label style={{fontSize:10,fontWeight:600,color:"#4A5568",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:".5px"}}>Total Cheques</label><input type="number" value={form.total_cheques} onChange={sf("total_cheques")}/></div>
                <div><label style={{fontSize:10,fontWeight:600,color:"#4A5568",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:".5px"}}>Period From</label><input type="date" value={form.period_from} onChange={sf("period_from")}/></div>
                <div><label style={{fontSize:10,fontWeight:600,color:"#4A5568",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:".5px"}}>Period To</label><input type="date" value={form.period_to} onChange={sf("period_to")}/></div>
                <div><label style={{fontSize:10,fontWeight:600,color:"#4A5568",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:".5px"}}>Status</label>
                  <select value={form.status} onChange={sf("status")}>
                    {Object.keys(CHEQ_COLORS).map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
                <div style={{gridColumn:"1/-1"}}><label style={{fontSize:10,fontWeight:600,color:"#4A5568",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:".5px"}}>Notes</label><textarea value={form.notes} onChange={sf("notes")} rows={2}/></div>
              </div>
            </div>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end",padding:"0.875rem 1.25rem",borderTop:"1px solid #E2E8F0"}}>
              <button onClick={()=>{setShowAdd(false);setEditCheq(null);}} style={{padding:"8px 16px",borderRadius:7,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>Cancel</button>
              <button onClick={save} disabled={saving} style={{padding:"8px 20px",borderRadius:7,border:"none",background:saving?"#A0AEC0":"#0F2540",color:"#fff",fontSize:12,fontWeight:600,cursor:saving?"not-allowed":"pointer"}}>{saving?"Saving…":editCheq?"Save Changes":"Add Cheque"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function buildContext(leads,units,projects,salePricing,leasePricing,activities,currentUser){
  const now=new Date();
  const active=leads.filter(l=>!["Closed Won","Closed Lost"].includes(l.stage));
  const pipeline={};
  active.forEach(l=>{pipeline[l.stage]=(pipeline[l.stage]||0)+1;});
  const avail=units.filter(u=>u.status==="Available");

  return `You are an AI assistant for PropCRM, a real estate CRM based in Dubai, UAE.
Logged-in user: ${currentUser.full_name} (role: ${currentUser.role})
Today: ${now.toLocaleDateString("en-AE",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}

=== LIVE DATA ===
LEADS: ${leads.length} total · ${active.length} active · Pipeline: ${Object.entries(pipeline).map(([s,c])=>`${s}:${c}`).join(", ")}
WON: ${leads.filter(l=>l.stage==="Closed Won").length} · LOST: ${leads.filter(l=>l.stage==="Closed Lost").length}

RECENT LEADS (last 10):
${leads.slice(0,10).map(l=>`• ${l.name} | ${l.stage} | AED ${Number(l.budget||0).toLocaleString()} | ${l.nationality||"—"} | ${l.source||"—"} | ${l.phone||"—"} | ${l.email||"—"}`).join("\n")}

PROPERTIES: ${units.length} units across ${projects.length} projects · ${avail.length} available
PROJECTS: ${projects.map(p=>`${p.name} (${p.developer||"—"}, ${p.status})`).join(" · ")}

AVAILABLE UNITS (first 20):
${avail.slice(0,20).map(u=>{
  const p=projects.find(x=>x.id===u.project_id);
  const sp=salePricing.find(s=>s.unit_id===u.id);
  const lp=leasePricing.find(l=>l.unit_id===u.id);
  const price=sp?.asking_price?`AED ${Number(sp.asking_price).toLocaleString()}`:lp?.annual_rent?`AED ${Number(lp.annual_rent).toLocaleString()}/yr`:"TBD";
  return `• #${u.unit_ref} | ${u.sub_type} | ${u.bedrooms===0?"Studio":(u.unit_type==="Residential"?u.bedrooms+"BR":"")} | ${u.size_sqft?Number(u.size_sqft).toLocaleString()+"sqft":""} | ${u.view||""} | ${price} | ${p?.name||"—"}`;
}).join("\n")}

RECENT ACTIVITY: ${activities.slice(0,5).map(a=>`${a.type} with ${a.lead_name} by ${a.user_name}`).join(" · ")}

=== YOUR JOB ===
1. Answer questions about properties, leads, pipeline using the live data above
2. Draft WhatsApp/email messages (professional Dubai real estate tone, WhatsApp <150 words)
3. Analyse pipeline and suggest next actions
4. Qualify leads — check stage gates: Contacted needs phone+email; Site Visit needs meeting; Proposal needs unit+budget confirmed; Negotiation needs proposal notes; Closed Won needs final price+payment plan
5. Auto-extract lead details from descriptions — when asked to "auto-fill" a lead, extract: name, phone, email, budget, nationality, notes

Respond concisely. Use bullet points for lists. Match the user's language.`;
}

// ── AI Assistant component ────────────────────────────────────────

// ══════════════════════════════════════════════════════════════════
// REPORTS MODULE — 6 reports, Excel + PDF export
// ══════════════════════════════════════════════════════════════════

// ── Excel export helper (no external library needed) ─────────────
function exportToExcel(rows, headers, filename) {
  const escape = v => {
    if(v === null || v === undefined) return "";
    const s = String(v);
    return s.includes(",") || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g,'""')}"` : s;
  };
  const csv = [headers.map(escape).join(","), ...rows.map(r=>r.map(escape).join(","))].join("\n");
  const blob = new Blob(["\uFEFF"+csv], {type:"text/csv;charset=utf-8"});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href=url; a.download=filename+".csv"; a.click();
  URL.revokeObjectURL(url);
}

// ── PDF export helper ─────────────────────────────────────────────
function exportToPDF(title, subtitle, headers, rows, filename) {
  const colW = Math.floor(90/headers.length);
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;color:#1a2535;font-size:11px}
    .header{background:#1E3A5F;color:#fff;padding:20px 24px;margin-bottom:0}
    .title{font-size:20px;font-weight:700;color:#C9A84C;margin-bottom:4px}
    .subtitle{font-size:12px;color:rgba(255,255,255,.6)}
    .meta{font-size:11px;color:rgba(255,255,255,.4);margin-top:4px}
    table{width:100%;border-collapse:collapse;margin:0}
    th{background:#1E3A5F;color:#C9A84C;padding:7px 8px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:.4px}
    td{padding:6px 8px;border-bottom:1px solid #F0F2F5;font-size:10px;vertical-align:top}
    tr:nth-child(even) td{background:#FAFBFC}
    .footer{margin-top:16px;text-align:center;font-size:9px;color:#A0AEC0}
    @media print{@page{margin:12mm}}
  </style></head><body>
  <div class="header">
    <div class="title">◆ PropCRM — ${title}</div>
    <div class="subtitle">${subtitle}</div>
    <div class="meta">Generated: ${new Date().toLocaleString("en-AE",{day:"numeric",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"})}</div>
  </div>
  <table>
    <thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead>
    <tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c===null||c===undefined?"—":c}</td>`).join("")}</tr>`).join("")}</tbody>
  </table>
  <div class="footer">PropCRM · Confidential · ${rows.length} records</div>
  </body></html>`;
  const blob = new Blob([html], {type:"text/html"});
  const url  = URL.createObjectURL(blob);
  const w    = window.open(url,"_blank");
  if(w) { w.onload = () => { w.print(); URL.revokeObjectURL(url); }; }
  else { const a=document.createElement("a"); a.href=url; a.download=filename+".html"; a.click(); URL.revokeObjectURL(url); }
}

// ── Main Reports Module ───────────────────────────────────────────

// ══════════════════════════════════════════════════════════════════
// PAYMENT PLAN TEMPLATES — per project, full flexibility
// ══════════════════════════════════════════════════════════════════

function PaymentPlanTemplates({ currentUser, showToast, projects=[], onSelectPlan }) {
  const [templates,  setTemplates]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [showAdd,    setShowAdd]    = useState(false);
  const [editTpl,    setEditTpl]    = useState(null);
  const [saving,     setSaving]     = useState(false);
  const [selProject, setSelProject] = useState("all");
  const canEdit = can(currentUser.role,"write");

  const blankTpl = {
    name:"",project_id:"",description:"",requires_approval:false,
    milestones:[
      {label:"Booking Deposit",   pct:10, days_from_signing:0},
      {label:"On Construction",   pct:40, days_from_signing:90},
      {label:"On Handover",       pct:50, days_from_signing:365},
    ]
  };
  const [form, setForm] = useState(blankTpl);

  const load = useCallback(async()=>{
    setLoading(true);
    let data=[];
    try{const r=await supabase.from("payment_plan_templates").select("*").order("project_id").order("name");data=r.data||[];}catch(e){}
    setTemplates(data);
    setLoading(false);
  },[]);
  useEffect(()=>{load();},[load]);

  const totalPct = form.milestones.reduce((s,m)=>s+(Number(m.pct)||0),0);

  const addMilestone = ()=>setForm(f=>({...f,milestones:[...f.milestones,{label:"",pct:0,days_from_signing:0}]}));
  const removeMilestone = i=>setForm(f=>({...f,milestones:f.milestones.filter((_,j)=>j!==i)}));
  const updateMilestone = (i,k,v)=>setForm(f=>({...f,milestones:f.milestones.map((m,j)=>j===i?{...m,[k]:v}:m)}));

  const save = async()=>{
    if(!form.name.trim()){showToast("Template name required","error");return;}
    if(Math.abs(totalPct-100)>0.1){showToast(`Total must be 100% — currently ${totalPct}%`,"error");return;}
    if(form.milestones.some(m=>!m.label.trim())){showToast("All milestones need a label","error");return;}
    setSaving(true);
    try{
      const payload={
        name:form.name,project_id:form.project_id||null,description:form.description||null,
        requires_approval:form.requires_approval,
        milestones:form.milestones.map((m,i)=>({...m,pct:Number(m.pct),order:i+1})),
        company_id:currentUser.company_id||null,created_by:currentUser.id,
      };
      let data,error;
      if(editTpl){
        ({data,error}=await supabase.from("payment_plan_templates").update(payload).eq("id",editTpl.id).select().single());
        setTemplates(p=>p.map(t=>t.id===editTpl.id?data:t));
      }else{
        ({data,error}=await supabase.from("payment_plan_templates").insert(payload).select().single());
        setTemplates(p=>[...p,data]);
      }
      if(error)throw error;
      showToast(editTpl?"Template updated":"Template created","success");
      setShowAdd(false);setEditTpl(null);setForm(blankTpl);
    }catch(e){showToast(e.message,"error");}
    setSaving(false);
  };

  const filtered = selProject==="all" ? templates : templates.filter(t=>t.project_id===selProject||(!t.project_id&&selProject==="global"));

  if(loading) return <Spinner msg="Loading payment plans…"/>;

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <select value={selProject} onChange={e=>setSelProject(e.target.value)} style={{fontSize:12,padding:"6px 10px"}}>
            <option value="all">All Projects</option>
            <option value="global">Global Templates</option>
            {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <span style={{fontSize:12,color:"#A0AEC0"}}>{filtered.length} templates</span>
        </div>
        {canEdit&&<button onClick={()=>{setForm(blankTpl);setEditTpl(null);setShowAdd(true);}}
          style={{padding:"8px 18px",borderRadius:8,border:"none",background:"#0F2540",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>
          + New Template
        </button>}
      </div>

      {/* Templates list */}
      <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:10}}>
        {filtered.length===0&&<div style={{textAlign:"center",padding:"3rem",color:"#A0AEC0"}}>No payment plan templates yet — click + New Template to create one</div>}
        {filtered.map(tpl=>{
          const proj=projects.find(p=>p.id===tpl.project_id);
          const ms=tpl.milestones||[];
          return (
            <div key={tpl.id} style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:12,padding:"16px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                <div>
                  <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:4}}>
                    <span style={{fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:700,color:"#0F2540"}}>{tpl.name}</span>
                    {tpl.requires_approval&&<span style={{fontSize:10,padding:"2px 7px",borderRadius:20,background:"#FDF3DC",color:"#8A6200",fontWeight:600}}>⚠ Requires Approval</span>}
                    {proj?<span style={{fontSize:10,padding:"2px 7px",borderRadius:20,background:"#E6EFF9",color:"#1A5FA8",fontWeight:600}}>{proj.name}</span>
                         :<span style={{fontSize:10,padding:"2px 7px",borderRadius:20,background:"#F7F9FC",color:"#718096",fontWeight:600}}>Global</span>}
                  </div>
                  {tpl.description&&<div style={{fontSize:12,color:"#718096"}}>{tpl.description}</div>}
                </div>
                <div style={{display:"flex",gap:6}}>
                  {onSelectPlan&&<button onClick={()=>onSelectPlan(tpl)}
                    style={{padding:"6px 14px",borderRadius:7,border:"none",background:"#1A7F5A",color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>
                    Use Plan
                  </button>}
                  {canEdit&&<button onClick={()=>{setForm({...blankTpl,...tpl,milestones:tpl.milestones||blankTpl.milestones});setEditTpl(tpl);setShowAdd(true);}}
                    style={{padding:"6px 12px",borderRadius:7,border:"1.5px solid #E2E8F0",background:"#fff",fontSize:12,cursor:"pointer"}}>
                    Edit
                  </button>}
                </div>
              </div>
              {/* Milestone bars */}
              <div style={{display:"flex",gap:3,height:28,borderRadius:8,overflow:"hidden",marginBottom:8}}>
                {ms.map((m,i)=>{
                  const colors=["#0F2540","#1A5FA8","#1A7F5A","#5B3FAA","#A06810","#B83232","#718096"];
                  return (
                    <div key={i} title={`${m.label}: ${m.pct}%`}
                      style={{flex:m.pct,background:colors[i%colors.length],display:"flex",alignItems:"center",justifyContent:"center",minWidth:30}}>
                      <span style={{fontSize:9,fontWeight:700,color:"#fff"}}>{m.pct}%</span>
                    </div>
                  );
                })}
              </div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {ms.map((m,i)=>{
                  const colors=["#0F2540","#1A5FA8","#1A7F5A","#5B3FAA","#A06810","#B83232","#718096"];
                  return (
                    <div key={i} style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:"#4A5568"}}>
                      <div style={{width:8,height:8,borderRadius:2,background:colors[i%colors.length],flexShrink:0}}/>
                      {m.label} ({m.pct}%)
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add/Edit Modal */}
      {showAdd&&(
        <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,.65)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1100,padding:"1rem"}}>
          <div style={{background:"#fff",borderRadius:16,width:580,maxWidth:"100%",maxHeight:"92vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 24px 64px rgba(11,31,58,.4)"}}>
            <div style={{background:"#fff",padding:"1rem 1.5rem",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:16,fontWeight:700,color:"#fff"}}>{editTpl?"Edit":"New"} Payment Plan Template</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,.5)",marginTop:2}}>Define milestone installments — must total 100%</div>
              </div>
              <button onClick={()=>{setShowAdd(false);setEditTpl(null);}} style={{background:"none",border:"none",fontSize:22,color:"#C9A84C",cursor:"pointer"}}>×</button>
            </div>
            <div style={{overflowY:"auto",padding:"1.25rem 1.5rem",flex:1}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
                <div style={{gridColumn:"1/-1"}}>
                  <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Template Name *</label>
                  <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. 40/60 Off-Plan, 20/80 Post-Handover"/>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Project (optional)</label>
                  <select value={form.project_id||""} onChange={e=>setForm(f=>({...f,project_id:e.target.value}))}>
                    <option value="">Global (all projects)</option>
                    {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8,paddingTop:22}}>
                  <input type="checkbox" id="req_approval" checked={form.requires_approval} onChange={e=>setForm(f=>({...f,requires_approval:e.target.checked}))} style={{width:16,height:16}}/>
                  <label htmlFor="req_approval" style={{fontSize:12,fontWeight:600,color:"#4A5568",cursor:"pointer"}}>Requires management approval when used</label>
                </div>
                <div style={{gridColumn:"1/-1"}}>
                  <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Description</label>
                  <input value={form.description||""} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Brief description of when to use this plan"/>
                </div>
              </div>

              {/* Milestones */}
              <div style={{marginBottom:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <label style={{fontSize:11,fontWeight:600,color:"#4A5568",textTransform:"uppercase",letterSpacing:".5px"}}>Milestones *</label>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:12,fontWeight:700,color:Math.abs(totalPct-100)<0.1?"#1A7F5A":"#B83232"}}>
                    Total: {totalPct}% {Math.abs(totalPct-100)<0.1?"✓":"(must be 100%)"}
                  </span>
                  <button onClick={addMilestone} style={{fontSize:11,padding:"4px 10px",borderRadius:6,border:"none",background:"#0F2540",color:"#fff",cursor:"pointer"}}>+ Add Row</button>
                </div>
              </div>
              {/* Progress bar preview */}
              {form.milestones.length>0&&(
                <div style={{display:"flex",gap:2,height:20,borderRadius:6,overflow:"hidden",marginBottom:12}}>
                  {form.milestones.map((m,i)=>{
                    const colors=["#0F2540","#1A5FA8","#1A7F5A","#5B3FAA","#A06810","#B83232","#718096"];
                    return <div key={i} style={{flex:Math.max(Number(m.pct)||0,0.5),background:colors[i%colors.length],transition:"flex .2s"}}/>;
                  })}
                </div>
              )}
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {form.milestones.map((m,i)=>(
                  <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 80px 100px 32px",gap:6,alignItems:"center"}}>
                    <input value={m.label} onChange={e=>updateMilestone(i,"label",e.target.value)} placeholder={`Milestone ${i+1} label`} style={{fontSize:12}}/>
                    <div style={{position:"relative"}}>
                      <input type="number" value={m.pct} onChange={e=>updateMilestone(i,"pct",e.target.value)} style={{paddingRight:18,fontSize:12}} min={0} max={100}/>
                      <span style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",fontSize:11,color:"#A0AEC0"}}>%</span>
                    </div>
                    <input type="number" value={m.days_from_signing} onChange={e=>updateMilestone(i,"days_from_signing",e.target.value)} placeholder="Days" style={{fontSize:12}} min={0}/>
                    <button onClick={()=>removeMilestone(i)} style={{width:28,height:28,borderRadius:6,border:"1px solid #F0BCBC",background:"#FAEAEA",color:"#B83232",cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
                  </div>
                ))}
                <div style={{fontSize:10,color:"#A0AEC0",marginTop:4}}>Label · % · Days from signing date</div>
              </div>
            </div>
            <div style={{display:"flex",gap:10,justifyContent:"flex-end",padding:"1rem 1.5rem",borderTop:"1px solid #E2E8F0"}}>
              <button onClick={()=>{setShowAdd(false);setEditTpl(null);}} style={{padding:"9px 20px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancel</button>
              <button onClick={save} disabled={saving||Math.abs(totalPct-100)>0.1}
                style={{padding:"9px 24px",borderRadius:8,border:"none",background:saving||Math.abs(totalPct-100)>0.1?"#A0AEC0":"#0F2540",color:"#fff",fontSize:13,fontWeight:600,cursor:saving?"not-allowed":"pointer"}}>
                {saving?"Saving…":editTpl?"Save Changes":"Create Template"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AIAssistant({leads,units,projects,salePricing,leasePricing,activities,currentUser,showToast}){
  const [messages,    setMessages]    = useState([]);
  const [input,       setInput]       = useState("");
  const [loading,     setLoading]     = useState(false);
  const [showSetup,   setShowSetup]   = useState(false);
  const [keys,        setKeys]        = useState(()=>{ try{ return JSON.parse(localStorage.getItem("ai_keys")||"{}"); }catch{ return {}; } });
  const [suggestion,  setSuggestion]  = useState(null);
  const [usedProvider,setUsedProvider]= useState(null);
  const [isTyping,    setIsTyping]    = useState(false);
  const bottomRef = useRef(null);

  // Derive AI name from company — use custom ai_assistant_name if set
  const cacheStr = localStorage.getItem("propccrm_company_cache");
  const coCache  = cacheStr ? JSON.parse(cacheStr) : null;
  const coName   = coCache?.name || "PropCRM";
  const aiFullName = coCache?.ai_assistant_name || (coName.split(" ")[0] + " AI");

  const QUICK = [
    {icon:"📊", label:"Pipeline Summary",    msg:"Give me a full pipeline summary — total value, deals by stage, and top 3 actions for this week.", category:"analytics"},
    {icon:"🏠", label:"Available Units",      msg:"Show all available units with pricing. Highlight the best value options.", category:"inventory"},
    {icon:"👤", label:"Hot Leads",            msg:"Which leads are most likely to close this month? Rank them and explain why.", category:"leads"},
    {icon:"⏱",  label:"Stale Deals",         msg:"Which leads have been stuck the longest? Who needs immediate attention today?", category:"leads"},
    {icon:"✍",  label:"Draft WhatsApp",       msg:"Draft a luxury, professional WhatsApp message to re-engage a high-value client who viewed a property but went quiet for 2 weeks.", category:"communication"},
    {icon:"🔑", label:"Leasing Overview",     msg:"Summarise our leasing portfolio — active leases, expiring soon, overdue payments and available units.", category:"leasing"},
    {icon:"💰", label:"Revenue Forecast",     msg:"Based on current pipeline and historical conversion, what revenue should we forecast for the next 90 days?", category:"analytics"},
    {icon:"📝", label:"Add Lead by Voice",    msg:"Auto-fill: Ahmed Al Mansouri, +971501234567, UAE national, looking for a luxury villa in Palm Jumeirah, budget AED 8M, met at Cityscape.", category:"action"},
  ];

  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:"smooth"}); },[messages,loading]);

  useEffect(()=>{
    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
    const firstName = currentUser.full_name.split(" ")[0];
    setMessages([{role:"assistant", content:
      `${greeting}, ${firstName}. I'm **${aiFullName}** — your dedicated real estate intelligence concierge.

`+
      `I have live access to **${leads.length} contacts**, **${units.filter(u=>u.status==="Available").length} available units** across **${projects.length} projects**`+
      (leads.filter(l=>!["Closed Won","Closed Lost"].includes(l.stage)).length > 0 ? `, and a pipeline of **${leads.filter(l=>!["Closed Won","Closed Lost"].includes(l.stage)).length} active opportunities**` : "")+`.

`+
      `How may I assist you today? Select a quick action below or type your question in natural language.`
    }]);
  },[]);

  const saveKeys = (k) => { setKeys(k); localStorage.setItem("ai_keys", JSON.stringify(k)); };

  const callAI = async (systemPrompt, msgs) => {
    // Platform-hosted Claude via /api/ai (ANTHROPIC_API_KEY lives in Vercel env, never in browser)
    const messages = (msgs || [])
      .filter(m => m && m.content && (m.role === "user" || m.role === "assistant"))
      .map(m => ({ role: m.role, content: m.content }));
    const body = { messages };
    if (systemPrompt) body.system = systemPrompt;

    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `AI request failed (${res.status})`);

    setUsedProvider({ id: "claude", name: "Claude" });
    return data.text || "";
  };

  const send = async (text) => {
    const msg = text||input.trim();
    if(!msg) return;
    setInput(""); setLoading(true); setIsTyping(true);
    const newMsgs = [...messages,{role:"user",content:msg}];
    setMessages(newMsgs);
    setTimeout(()=>setIsTyping(false), 800);
    try{
      const ctx = buildContext(leads,units,projects,salePricing,leasePricing,activities,currentUser);
      const reply = await callAI(ctx, newMsgs.slice(-12));
      setMessages(p=>[...p,{role:"assistant",content:reply}]);
      if(msg.toLowerCase().includes("auto-fill")||msg.toLowerCase().includes("add lead")){
        const name   = reply.match(/name[:\s*]*([A-Z][a-zA-Z\s]{2,30})(?:\n|,|\||\*)/i)?.[1]?.trim();
        const phone  = reply.match(/(\+971\d{8,9}|\+\d{10,14})/)?.[0];
        const email  = reply.match(/[\w.-]+@[\w.-]+\.\w{2,}/)?.[0];
        const budget = reply.match(/(?:budget|AED)[:\s*]*([0-9,]+(?:\.[0-9]+)?(?:M|m)?)/i)?.[1];
        if(name||phone){
          let b=0;
          if(budget){const r=budget.replace(/,/g,"");b=r.toLowerCase().includes("m")?parseFloat(r)*1e6:parseFloat(r);}
          setSuggestion({name:name||"",phone:phone||"",email:email||"",budget:b,notes:""});
        }
      }
    }catch(e){
      const noKey = e.message.includes("No API key");
      setMessages(p=>[...p,{role:"assistant",content: noKey
        ? `To activate ${aiFullName}, please click **Configure ${aiFullName}** above and add a free API key.`
        : `I encountered an issue: ${e.message}. Please try again.`}]);
      if(noKey) setShowSetup(true);
    }
    setLoading(false);
  };

  const fmt = (text) => {
    const lines = text.split("\n");
    return lines.map((line,i)=>{
      if(!line.trim()) return <div key={i} style={{height:6}}/>;
      if(/^#{1,3}\s/.test(line)) return <div key={i} style={{fontWeight:800,fontSize:14,color:"#0F2540",marginTop:10,marginBottom:4}}>{line.replace(/^#+\s/,"")}</div>;
      if(/^\*\*(.+)\*\*$/.test(line)) return <div key={i} style={{fontWeight:700,color:"#0F2540",marginTop:6,marginBottom:2}}>{line.replace(/\*\*/g,"")}</div>;
      if(line.startsWith("•")||line.startsWith("-")||line.startsWith("*  ")){
        const txt = line.replace(/^[•\-\*]\s*/,"");
        const parts = txt.split(/\*\*(.+?)\*\*/g);
        return <div key={i} style={{display:"flex",gap:8,alignItems:"flex-start",marginBottom:3,paddingLeft:4}}>
          <span style={{color:"#C9A84C",fontWeight:700,flexShrink:0,marginTop:2}}>◆</span>
          <span>{parts.map((p,j)=>j%2===1?<strong key={j} style={{color:"#0F2540"}}>{p}</strong>:p)}</span>
        </div>;
      }
      const parts = line.split(/\*\*(.+?)\*\*/g);
      return <div key={i} style={{marginBottom:3,lineHeight:1.7}}>{parts.map((p,j)=>j%2===1?<strong key={j} style={{color:"#0F2540"}}>{p}</strong>:p)}</div>;
    });
  };

  const hasAnyKey = true; // Platform-hosted Claude via /api/ai — key managed in Vercel env
  const catColors = {analytics:"#1A5FA8",inventory:"#1A7F5A",leads:"#5B3FAA",leasing:"#9B7FD4",communication:"#A06810",action:"#B83232"};

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%",background:"#F7F8FC"}}>

      {/* ── Premium Header ── */}
      <div style={{background:"#fff",padding:"18px 24px 14px",flexShrink:0,position:"relative",overflow:"hidden"}}>
        {/* Decorative elements */}
        <div style={{position:"absolute",top:-20,right:-20,width:120,height:120,borderRadius:"50%",background:"rgba(201,168,76,.08)"}}/>
        <div style={{position:"absolute",bottom:-30,right:60,width:80,height:80,borderRadius:"50%",background:"rgba(201,168,76,.05)"}}/>

        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",position:"relative"}}>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            {/* AI Avatar */}
            <div style={{width:46,height:46,borderRadius:14,background:"linear-gradient(135deg,#C9A84C,#E8C97A)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:800,color:"#0F2540",boxShadow:"0 4px 16px rgba(201,168,76,.4)",flexShrink:0}}>
              ✦
            </div>
            <div>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,color:"#fff",lineHeight:1.1}}>
                {aiFullName}
              </div>
              <div style={{fontSize:11,color:"rgba(201,168,76,.8)",marginTop:2,letterSpacing:".5px",textTransform:"uppercase"}}>
                Real Estate Intelligence Concierge
              </div>
              <div style={{display:"flex",gap:6,marginTop:6,alignItems:"center"}}>
                <div style={{width:6,height:6,borderRadius:"50%",background:"#1A7F5A",boxShadow:"0 0 6px #1A7F5A"}}/>
                <span style={{fontSize:10,color:"rgba(255,255,255,.5)"}}>
                  {leads.length} contacts · {units.filter(u=>u.status==="Available").length} available units · {projects.length} projects
                </span>
              </div>
            </div>
          </div>

          {/* Configure button removed — platform-hosted Claude, no user setup needed */}
        </div>

        {/* Powered by Claude badge */}
        <div style={{display:"flex",gap:5,marginTop:12,flexWrap:"wrap"}}>
          <div style={{
            padding:"4px 10px",borderRadius:20,fontSize:10,fontWeight:600,
            border:"1px solid rgba(201,168,76,.3)",
            background:"rgba(201,168,76,.15)",
            color:"#C9A84C",
            display:"flex",alignItems:"center",gap:4
          }}>
            <span style={{width:5,height:5,borderRadius:"50%",background:"#1A7F5A",display:"inline-block"}}/>
            Powered by Claude
          </div>
        </div>
      </div>

      {/* Setup Panel removed — platform-hosted Claude, no user setup needed */}

      {/* ── Quick Action Buttons ── */}
      <div style={{padding:"12px 24px 0",flexShrink:0}}>
        <div style={{fontSize:10,fontWeight:700,color:"#A0AEC0",textTransform:"uppercase",letterSpacing:".5px",marginBottom:8}}>Quick Actions</div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {QUICK.map(q=>(
            <button key={q.label} onClick={()=>send(q.msg)} disabled={loading||!hasAnyKey} style={{
              padding:"6px 12px",borderRadius:20,fontSize:11,fontWeight:600,cursor:!hasAnyKey?"not-allowed":"pointer",
              border:`1px solid ${catColors[q.category]||"#E2E8F0"}22`,
              background:`${catColors[q.category]||"#718096"}11`,
              color:!hasAnyKey?"#C0C0C0":(catColors[q.category]||"#718096"),
              display:"flex",alignItems:"center",gap:5,transition:"all .15s",whiteSpace:"nowrap",
            }}
            onMouseOver={e=>{if(hasAnyKey){e.currentTarget.style.background=`${catColors[q.category]}22`;e.currentTarget.style.transform="translateY(-1px)";}}}
            onMouseOut={e=>{e.currentTarget.style.background=`${catColors[q.category]}11`;e.currentTarget.style.transform="none";}}>
              {q.icon} {q.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Chat Window ── */}
      <div style={{flex:1,overflowY:"auto",padding:"16px 24px",display:"flex",flexDirection:"column",gap:14}}>
        {messages.map((m,i)=>(
          <div key={i} style={{display:"flex",gap:12,alignItems:"flex-start",flexDirection:m.role==="user"?"row-reverse":"row"}}>
            {/* Avatar */}
            <div style={{
              width:36,height:36,borderRadius:10,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:14,
              background:m.role==="user"?"#0F2540":"linear-gradient(135deg,#C9A84C,#E8C97A)",
              color:m.role==="user"?"#C9A84C":"#0F2540",
              boxShadow:m.role==="assistant"?"0 2px 8px rgba(201,168,76,.3)":"none"
            }}>
              {m.role==="user"?(currentUser.full_name||"U").charAt(0).toUpperCase():"✦"}
            </div>
            {/* Bubble */}
            <div style={{
              maxWidth:"72%",
              background:m.role==="user"?"#1E3A5F":"#fff",
              color:m.role==="user"?"#fff":"#2D3748",
              borderRadius:m.role==="user"?"16px 16px 4px 16px":"16px 16px 16px 4px",
              padding:"12px 16px",fontSize:13,lineHeight:1.7,
              border:m.role==="assistant"?"1px solid #E8EDF3":"none",
              boxShadow:m.role==="assistant"?"0 2px 12px rgba(0,0,0,.06)":"0 2px 8px rgba(11,31,58,.2)",
            }}>
              {m.role==="assistant"?fmt(m.content):m.content}
              {m.role==="assistant"&&i===messages.length-1&&usedProvider&&(
                <div style={{marginTop:8,paddingTop:8,borderTop:"1px solid #F0F2F5",fontSize:10,color:"#A0AEC0",display:"flex",alignItems:"center",gap:4}}>
                  <span style={{width:4,height:4,borderRadius:"50%",background:"#1A7F5A",display:"inline-block"}}/>
                  {aiFullName} · Powered by {usedProvider.name}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {loading&&(
          <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
            <div style={{width:36,height:36,borderRadius:10,background:"linear-gradient(135deg,#C9A84C,#E8C97A)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:800,color:"#0F2540",boxShadow:"0 2px 8px rgba(201,168,76,.3)"}}>✦</div>
            <div style={{background:"#fff",border:"1px solid #E8EDF3",borderRadius:"16px 16px 16px 4px",padding:"14px 18px",boxShadow:"0 2px 12px rgba(0,0,0,.06)",display:"flex",gap:5,alignItems:"center"}}>
              {[0,.15,.3].map((d,i)=>(
                <div key={i} style={{width:7,height:7,borderRadius:"50%",background:"#C9A84C",animationName:"aipulse",animationDuration:"1.2s",animationDelay:`${d}s`,animationIterationCount:"infinite",animationTimingFunction:"ease-in-out"}}/>
              ))}
              <style>{`@keyframes aipulse{0%,100%{opacity:.3;transform:translateY(0)}50%{opacity:1;transform:translateY(-3px)}}`}</style>
              <span style={{fontSize:11,color:"#A0AEC0",marginLeft:6}}>{aiFullName} is thinking…</span>
            </div>
          </div>
        )}

        {/* Lead detection card */}
        {suggestion&&(
          <div style={{background:"#fff",border:"1px solid rgba(201,168,76,.3)",borderRadius:14,padding:"16px 18px",boxShadow:"0 4px 20px rgba(11,31,58,.2)"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
              <span style={{fontSize:18}}>✦</span>
              <span style={{fontFamily:"'Playfair Display',serif",fontSize:14,fontWeight:700,color:"#C9A84C"}}>{aiFullName} detected a lead — add to CRM?</span>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
              {[["Name",suggestion.name],["Phone",suggestion.phone],["Email",suggestion.email||"—"],["Budget",suggestion.budget?`AED ${Number(suggestion.budget).toLocaleString()}`:"—"]].map(([l,v])=>(
                <div key={l} style={{background:"rgba(255,255,255,.07)",borderRadius:8,padding:"8px 10px"}}>
                  <div style={{fontSize:9,color:"rgba(201,168,76,.7)",textTransform:"uppercase",letterSpacing:".5px",marginBottom:2}}>{l}</div>
                  <div style={{fontSize:13,fontWeight:600,color:"#fff"}}>{v||"—"}</div>
                </div>
              ))}
            </div>
            <textarea placeholder="Add notes…" rows={2} value={suggestion.notes}
              onChange={e=>setSuggestion(s=>({...s,notes:e.target.value}))}
              style={{width:"100%",padding:"8px 10px",border:"1px solid rgba(255,255,255,.15)",borderRadius:8,fontSize:12,resize:"none",background:"rgba(255,255,255,.08)",color:"#fff",boxSizing:"border-box",marginBottom:10}}/>
            <div style={{display:"flex",gap:8}}>
              <button onClick={async()=>{
                try{
                  const{error}=await supabase.from("leads").insert({
                    name:suggestion.name,phone:suggestion.phone||null,email:suggestion.email||null,
                    budget:suggestion.budget||0,source:"AI Import",stage:"New Lead",
                    notes:suggestion.notes||null,assigned_to:currentUser.id,
                    company_id:currentUser.company_id||null,
                    stage_updated_at:new Date().toISOString(),created_by:currentUser.id
                  });
                  if(error)throw error;
                  showToast(`${suggestion.name} added successfully`,"success");
                  setSuggestion(null);
                }catch(e){showToast(e.message,"error");}
              }} style={{flex:1,padding:"10px",borderRadius:8,border:"none",background:"#C9A84C",color:"#0F2540",fontSize:13,fontWeight:700,cursor:"pointer"}}>
                + Add to CRM
              </button>
              <button onClick={()=>setSuggestion(null)} style={{padding:"10px 16px",borderRadius:8,border:"1px solid rgba(255,255,255,.2)",background:"transparent",color:"rgba(255,255,255,.6)",fontSize:13,cursor:"pointer"}}>
                Dismiss
              </button>
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {/* ── Input Bar ── */}
      <div style={{padding:"0 24px 20px",flexShrink:0}}>
        <div style={{
          display:"flex",gap:8,background:"#fff",
          border:"1.5px solid #E2E8F0",borderRadius:16,
          padding:"10px 10px 10px 16px",
          boxShadow:"0 4px 20px rgba(0,0,0,.08)",
          transition:"border-color .2s",
        }}
        onFocus={e=>e.currentTarget.style.borderColor="#C9A84C"}
        onBlur={e=>e.currentTarget.style.borderColor="#E2E8F0"}>
          <textarea value={input} onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}
            placeholder={`Ask ${aiFullName} anything… "Show units under AED 3M" · "Draft a proposal for Ahmed" · "Which leads need attention?"`}
            rows={1}
            style={{flex:1,border:"none",outline:"none",resize:"none",fontSize:13,lineHeight:1.6,
              minHeight:40,maxHeight:120,fontFamily:"inherit",
              background:"transparent",color:hasAnyKey?"#0F2540":"#A0AEC0"}}
          />
          <button onClick={()=>send()} disabled={loading||!input.trim()||!hasAnyKey} style={{
            padding:"10px 20px",borderRadius:12,border:"none",
            background:loading||!input.trim()||!hasAnyKey
              ?"#E2E8F0"
              :"#1E3A5F",
            color:loading||!input.trim()||!hasAnyKey?"#A0AEC0":"#C9A84C",
            fontSize:13,fontWeight:700,cursor:loading||!input.trim()||!hasAnyKey?"not-allowed":"pointer",
            transition:"all .2s",alignSelf:"flex-end",
            boxShadow:!loading&&input.trim()&&hasAnyKey?"0 2px 8px rgba(11,31,58,.3)":"none",
          }}>
            {loading?"…":"Send ↑"}
          </button>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:6,fontSize:10,color:"#A0AEC0",padding:"0 4px"}}>
          <span>Enter to send · Shift+Enter for new line</span>
          <span>{aiFullName} · Powered by Claude</span>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// SETUP WIZARD — shown once to admin on first launch
// ══════════════════════════════════════════════════════════════════
function SetupWizard({ onComplete }) {
  const [step,    setStep]    = useState(1);
  const [mode,    setMode]    = useState(null);
  const [company, setCompany] = useState("");
  const [currency,setCurrency]= useState("AED");
  const [country, setCountry] = useState("UAE");
  const [saving,  setSaving]  = useState(false);

  const MODES = [
    {
      id:"sales",
      icon:"🏷",
      title:"Sales Only",
      desc:"Lead management, property listings, pipeline tracking, discount approvals.",
      tabs:["Leads","Inventory","Pipeline","Discounts","AI Assistant"],
      roles:["Admin","Sales Manager","Sales Agent","Viewer"],
      color:"#1A5FA8", bg:"#E6EFF9",
    },
    {
      id:"leasing",
      icon:"🔑",
      title:"Leasing Only",
      desc:"Tenant management, lease contracts, rent payments, maintenance tracking.",
      tabs:["Leasing","Discounts","Activity Log","AI Assistant"],
      roles:["Admin","Leasing Manager","Leasing Agent","Viewer"],
      color:"#5B3FAA", bg:"#EEE8F9",
    },
    {
      id:"both",
      icon:"◆",
      title:"Sales & Leasing",
      desc:"Full suite — both teams with complete role segregation. Each team only sees their own modules.",
      tabs:["All modules","Sales team sees sales","Leasing team sees leasing"],
      roles:["Admin","Sales Manager","Sales Agent","Leasing Manager","Leasing Agent","Viewer"],
      color:"#C9A84C", bg:"#FDF3DC",
      recommended:true,
    },
  ];

  const complete = () => {
    if(!mode){return;}
    setSaving(true);
    const cfg = { mode, company:company.trim()||"PropCRM", currency, country, setupAt: new Date().toISOString() };
    saveAppConfig(cfg);
    setTimeout(()=>{ setSaving(false); onComplete(cfg); }, 600);
  };

  const sel = MODES.find(m=>m.id===mode);

  return (
    <div style={{minHeight:"100vh",background:"#fff",display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem"}}>
      <div className="fa" style={{background:"#fff",borderRadius:20,width:680,maxWidth:"100%",boxShadow:"0 30px 80px rgba(0,0,0,.4)",overflow:"hidden"}}>

        {/* Header */}
        <div style={{background:"#0F2540",padding:"1.75rem 2rem"}}>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:28,fontWeight:700,color:"#C9A84C"}}>◆ PropCRM</div>
          <div style={{fontSize:14,color:"rgba(255,255,255,.6)",marginTop:4}}>Welcome! Set up your workspace — takes 2 minutes</div>
          <div style={{fontSize:12,color:"rgba(201,168,76,.6)",marginTop:3}}>You can change any of these settings later in Users → Settings</div>
          {/* Progress */}
          <div style={{display:"flex",gap:6,marginTop:16}}>
            {[1,2,3].map(s=>(
              <div key={s} style={{flex:1,height:3,borderRadius:3,background:step>=s?"#C9A84C":"rgba(255,255,255,.2)",transition:"background .3s"}}/>
            ))}
          </div>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:6}}>
            {["Choose mode","Company details","Confirm"].map((l,i)=>(
              <div key={i} style={{fontSize:11,color:step>=i+1?"#C9A84C":"rgba(255,255,255,.35)",fontWeight:step===i+1?600:400}}>{l}</div>
            ))}
          </div>
        </div>

        <div style={{padding:"2rem"}}>

          {/* ── STEP 1: Mode ── */}
          {step===1&&(
            <div className="fa">
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,color:"#0F2540",marginBottom:6}}>How will you use PropCRM?</div>
              <div style={{fontSize:13,color:"#718096",marginBottom:22}}>This controls which modules are visible and which roles are available. You can change this later in Settings.</div>

              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                {MODES.map(m=>(
                  <div key={m.id} onClick={()=>setMode(m.id)}
                    style={{border:`2px solid ${mode===m.id?m.color:"#E2E8F0"}`,borderRadius:14,padding:"1.25rem 1.5rem",cursor:"pointer",background:mode===m.id?m.bg:"#fff",transition:"all .2s",position:"relative"}}>
                    {m.recommended&&<div style={{position:"absolute",top:-1,right:16,background:"#C9A84C",color:"#0F2540",fontSize:10,fontWeight:700,padding:"2px 10px",borderRadius:"0 0 8px 8px"}}>RECOMMENDED</div>}
                    <div style={{display:"flex",alignItems:"flex-start",gap:14}}>
                      <div style={{fontSize:28,flexShrink:0}}>{m.icon}</div>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                          <span style={{fontWeight:700,fontSize:16,color:"#0F2540"}}>{m.title}</span>
                          {mode===m.id&&<span style={{fontSize:11,fontWeight:700,color:m.color}}>✓ Selected</span>}
                        </div>
                        <div style={{fontSize:13,color:"#4A5568",lineHeight:1.6,marginBottom:10}}>{m.desc}</div>
                        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                          <div style={{flex:1}}>
                            <div style={{fontSize:10,fontWeight:700,color:"#A0AEC0",textTransform:"uppercase",letterSpacing:".5px",marginBottom:5}}>Modules</div>
                            <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                              {m.tabs.map(t=><span key={t} style={{fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:20,background:mode===m.id?"rgba(255,255,255,.7)":"#F7F9FC",color:"#4A5568"}}>{t}</span>)}
                            </div>
                          </div>
                          <div>
                            <div style={{fontSize:10,fontWeight:700,color:"#A0AEC0",textTransform:"uppercase",letterSpacing:".5px",marginBottom:5}}>Roles</div>
                            <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                              {m.roles.map(r=><span key={r} style={{fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:20,background:mode===m.id?"rgba(255,255,255,.7)":"#F7F9FC",color:"#4A5568"}}>{r}</span>)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{display:"flex",justifyContent:"flex-end",marginTop:22}}>
                <button onClick={()=>{if(mode)setStep(2);}} disabled={!mode}
                  style={{padding:"11px 28px",borderRadius:10,border:"none",background:mode?"#0F2540":"#E2E8F0",color:mode?"#fff":"#A0AEC0",fontSize:14,fontWeight:600,cursor:mode?"pointer":"not-allowed",transition:".2s"}}>
                  Next → Company Details
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 2: Company ── */}
          {step===2&&(
            <div className="fa">
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,color:"#0F2540",marginBottom:6}}>Your company details</div>
              <div style={{fontSize:13,color:"#718096",marginBottom:22}}>Used throughout the app and in the AI assistant's context.</div>

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
                <div style={{gridColumn:"1/-1"}}>
                  <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:".5px"}}>Company Name *</label>
                  <input value={company} onChange={e=>setCompany(e.target.value)} placeholder="e.g. Al Mansoori Real Estate"
                    style={{width:"100%",padding:"11px 14px",border:"1.5px solid #D1D9E6",borderRadius:10,fontSize:14}}/>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:".5px"}}>Currency</label>
                  <select value={currency} onChange={e=>setCurrency(e.target.value)}
                    style={{width:"100%",padding:"11px 14px",border:"1.5px solid #D1D9E6",borderRadius:10,fontSize:13}}>
                    {[["AED","AED — UAE Dirham"],["SAR","SAR — Saudi Riyal"],["USD","USD — US Dollar"],["GBP","GBP — British Pound"],["EUR","EUR — Euro"]].map(([v,l])=>(
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:".5px"}}>Country / Market</label>
                  <select value={country} onChange={e=>setCountry(e.target.value)}
                    style={{width:"100%",padding:"11px 14px",border:"1.5px solid #D1D9E6",borderRadius:10,fontSize:13}}>
                    {["UAE","Saudi Arabia","UK","USA","India","Other"].map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* Summary card */}
              <div style={{background:"#F7F9FC",border:"1px solid #E2E8F0",borderRadius:12,padding:"14px 16px",marginBottom:22}}>
                <div style={{fontSize:11,fontWeight:700,color:"#A0AEC0",textTransform:"uppercase",letterSpacing:".5px",marginBottom:10}}>Your Setup Summary</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,fontSize:13}}>
                  <div><span style={{color:"#A0AEC0"}}>Mode: </span><strong style={{color:sel?.color}}>{sel?.icon} {sel?.title}</strong></div>
                  <div><span style={{color:"#A0AEC0"}}>Company: </span><strong>{company||"Not set"}</strong></div>
                  <div><span style={{color:"#A0AEC0"}}>Currency: </span><strong>{currency}</strong></div>
                  <div><span style={{color:"#A0AEC0"}}>Market: </span><strong>{country}</strong></div>
                </div>
              </div>

              <div style={{display:"flex",justifyContent:"space-between"}}>
                <button onClick={()=>setStep(1)}
                  style={{padding:"11px 22px",borderRadius:10,border:"1.5px solid #D1D9E6",background:"#fff",color:"#4A5568",fontSize:14,fontWeight:600,cursor:"pointer"}}>
                  ← Back
                </button>
                <button onClick={()=>setStep(3)}
                  style={{padding:"11px 28px",borderRadius:10,border:"none",background:"#0F2540",color:"#fff",fontSize:14,fontWeight:600,cursor:"pointer"}}>
                  Next → Confirm
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Confirm ── */}
          {step===3&&(
            <div className="fa">
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,color:"#0F2540",marginBottom:6}}>Ready to launch</div>
              <div style={{fontSize:13,color:"#718096",marginBottom:22}}>Review your configuration below. You can always change this later in Users → Settings.</div>

              <div style={{border:`2px solid ${sel?.color}`,borderRadius:14,padding:"1.5rem",marginBottom:18,background:sel?.bg}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
                  <span style={{fontSize:32}}>{sel?.icon}</span>
                  <div>
                    <div style={{fontWeight:700,fontSize:18,color:"#0F2540"}}>{sel?.title} Mode</div>
                    <div style={{fontSize:13,color:"#4A5568"}}>{company}</div>
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                  <div style={{background:"rgba(255,255,255,.7)",borderRadius:8,padding:"10px 12px"}}>
                    <div style={{fontSize:10,fontWeight:700,color:"#A0AEC0",textTransform:"uppercase",marginBottom:6}}>Visible Modules</div>
                    {sel?.tabs.map(t=><div key={t} style={{fontSize:12,color:"#4A5568",padding:"2px 0"}}>✓ {t}</div>)}
                  </div>
                  <div style={{background:"rgba(255,255,255,.7)",borderRadius:8,padding:"10px 12px"}}>
                    <div style={{fontSize:10,fontWeight:700,color:"#A0AEC0",textTransform:"uppercase",marginBottom:6}}>Available Roles</div>
                    {sel?.roles.map(r=><div key={r} style={{fontSize:12,color:"#4A5568",padding:"2px 0"}}>✓ {r}</div>)}
                  </div>
                </div>
              </div>

              {mode==="both"&&(
                <div style={{background:"#E6EFF9",border:"1px solid #B5D4F4",borderRadius:10,padding:"12px 14px",marginBottom:18,fontSize:13,color:"#1A5FA8",lineHeight:1.7}}>
                  <strong>Sales & Leasing segregation:</strong><br/>
                  • Sales staff (Sales Manager, Sales Agent) see only: Leads, Inventory, Pipeline<br/>
                  • Leasing staff (Leasing Manager, Leasing Agent) see only: Leasing module<br/>
                  • Admins see everything<br/>
                  • Neither team can see the other's data
                </div>
              )}

              <div style={{display:"flex",justifyContent:"space-between"}}>
                <button onClick={()=>setStep(2)}
                  style={{padding:"11px 22px",borderRadius:10,border:"1.5px solid #D1D9E6",background:"#fff",color:"#4A5568",fontSize:14,fontWeight:600,cursor:"pointer"}}>
                  ← Back
                </button>
                <button onClick={complete} disabled={saving}
                  style={{padding:"11px 28px",borderRadius:10,border:"none",background:saving?"#A0AEC0":"#C9A84C",color:"#0F2540",fontSize:14,fontWeight:700,cursor:saving?"not-allowed":"pointer",transition:".2s"}}>
                  {saving?"Setting up…":"🚀 Launch PropCRM"}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}



// ══════════════════════════════════════════════════════════════════
// LEASING DASHBOARD
// ══════════════════════════════════════════════════════════════════
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
function UserManagement({currentUser, leads=[], activities=[], showToast, appConfig={}, onConfigChange=()=>{}}) {
  const [subTab, setSubTab] = useState("users");
  return (
    <div className="fade-in" style={{display:"flex",flexDirection:"column",height:"100%"}}>
      <div style={{display:"flex",gap:4,marginBottom:14}}>
        {[["users","👥 Users"],["settings","⚙ Settings"]].map(([id,l])=>(
          <button key={id} onClick={()=>setSubTab(id)}
            style={{padding:"7px 16px",borderRadius:8,border:`1.5px solid ${subTab===id?"#0F2540":"#E2E8F0"}`,background:subTab===id?"#0F2540":"#fff",color:subTab===id?"#fff":"#4A5568",fontSize:13,fontWeight:subTab===id?600:400,cursor:"pointer"}}>
            {l}
          </button>
        ))}
      </div>
      {subTab==="users"  && <UsersTab currentUser={currentUser} showToast={showToast}/>}
      {subTab==="settings" && <SettingsTab appConfig={appConfig} onConfigChange={onConfigChange} currentUser={currentUser} showToast={showToast}/>}
    </div>
  );
}

function UsersTab({currentUser, showToast}) {
  const [users,     setUsers]     = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showAdd,   setShowAdd]   = useState(false);
  const [editUser,  setEditUser]  = useState(null);
  const [saving,    setSaving]    = useState(false);
  const isSuperAdmin = currentUser.is_super_admin || currentUser.role === "super_admin";
  const blank = {full_name:"",email:"",role:"sales_agent",is_active:true,company_id:currentUser.company_id||"",password:""};
  const [form, setForm] = useState(blank);
  const sf = k => e => setForm(f=>({...f,[k]:e.target?.value??e}));

  const loadUsers = useCallback(async()=>{
    setLoading(true);
    const cid = currentUser.company_id || localStorage.getItem("propccrm_company_id") || null;
    // Super admin sees all users (can filter by company via selector)
    // All other roles only see users from their own company
    const userQuery = isSuperAdmin
      ? supabase.from("profiles").select("*").order("created_at",{ascending:false})
      : supabase.from("profiles").select("*").eq("company_id", cid).order("created_at",{ascending:false});
    const queries = [userQuery];
    if(isSuperAdmin) queries.push(supabase.from("companies").select("id,name,business_type").order("name"));
    const [u, co] = await Promise.all(queries);
    setUsers(u.data||[]);
    if(co) setCompanies(co.data||[]);
    setLoading(false);
  },[isSuperAdmin]);
  useEffect(()=>{loadUsers();},[loadUsers]);

  const saveUser=async()=>{
    if(!form.full_name.trim()||!form.email.trim()){showToast("Name and email required","error");return;}
    if(!form.company_id&&!currentUser.company_id){showToast("Please select a company","error");return;}
    setSaving(true);
    try{
      if(editUser){
        const{error}=await supabase.from("profiles").update({
          full_name:form.full_name,role:form.role,is_active:form.is_active,
          company_id:form.company_id||currentUser.company_id||null,
        }).eq("id",editUser.id);
        if(error)throw error;
        showToast("User updated","success");
      } else {
        // Secure user creation via serverless API route
        const tempPw = form.password || Math.random().toString(36).slice(-8)+"A1!";
        const activeCompanyId = form.company_id || currentUser.company_id || localStorage.getItem("propccrm_company_id") || null;
        const res = await fetch('/api/create-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: form.email,
            password: tempPw,
            full_name: form.full_name,
            role: form.role,
            company_id: activeCompanyId,
          })
        });
        const result = await res.json();
        if(!res.ok){ showToast(result.error||"Failed to create user","error"); setSaving(false); return; }

        // Update profile with role, company, active status
        await new Promise(r=>setTimeout(r,1000));
        const{error:pErr}=await supabase.from("profiles").update({
          full_name:form.full_name,
          role:form.role,
          is_active:true,
          company_id:activeCompanyId,
        }).eq("id",result.user.id);
        if(pErr) showToast("User created but profile update failed: "+pErr.message,"error");
        else {
          showToast(`✓ User created: ${form.email}  |  Temp password: ${tempPw}  |  Share this with them securely`,"success");
          navigator.clipboard?.writeText(`Email: ${form.email}\nTemp Password: ${tempPw}`).catch(()=>{});
        }
      }
      setShowAdd(false);setEditUser(null);setForm(blank);loadUsers();
    }catch(e){showToast(e.message,"error");}
    setSaving(false);
  };

  const toggleActive=async(user)=>{
    await supabase.from("profiles").update({is_active:!user.is_active}).eq("id",user.id);
    setUsers(p=>p.map(u=>u.id===user.id?{...u,is_active:!u.is_active}:u));
    showToast(user.is_active?"User deactivated":"User activated","success");
  };

  const resetPassword=async(user)=>{
    const newPw=prompt("Set new password for "+user.full_name+"\n(minimum 8 characters):");
    if(!newPw||newPw.length<8){if(newPw!==null)showToast("Password must be at least 8 characters","error");return;}
    try{
      const res=await fetch("/api/reset-password",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({user_id:user.id,password:newPw})});
      if(!res.ok){const e=await res.json();showToast(e.message||"Failed","error");return;}
      showToast("✓ Password reset for "+user.full_name,"success");
      navigator.clipboard?.writeText("Email: "+user.email+"\nPassword: "+newPw).catch(()=>{});
    }catch(e){showToast(e.message,"error");}
  };

  if(loading)return <Spinner msg="Loading users…"/>;

  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <span style={{fontSize:13,color:"#718096"}}>{users.length} users · {users.filter(u=>u.is_active).length} active</span>
        <button onClick={()=>{setForm(blank);setEditUser(null);setShowAdd(true);}}
          style={{padding:"8px 18px",borderRadius:8,border:"none",background:"#0F2540",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>
          + Add User
        </button>
      </div>
      <div style={{flex:1,overflowY:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead style={{position:"sticky",top:0}}>
            <tr style={{background:"#0F2540"}}>
              {["Name","Email","Role","Company","Status","Actions"].map(h=>(
                <th key={h} style={{padding:"9px 12px",textAlign:"left",fontSize:10,fontWeight:600,color:"#C9A84C",textTransform:"uppercase",letterSpacing:".5px"}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u,i)=>(
              <tr key={u.id} style={{background:i%2===0?"#fff":"#FAFBFC",borderBottom:"1px solid #F0F2F5"}}>
                <td style={{padding:"9px 12px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <Av name={u.full_name||u.email} size={28}/>
                    <div>
                      <div style={{fontSize:13,fontWeight:600,color:"#0F2540"}}>{u.full_name||"—"}</div>
                      {u.is_super_admin&&<span style={{fontSize:9,fontWeight:700,padding:"1px 6px",borderRadius:20,background:"#FDF3DC",color:"#8A6200"}}>Super Admin</span>}
                    </div>
                  </div>
                </td>
                <td style={{padding:"9px 12px",fontSize:12,color:"#4A5568"}}>{u.email}</td>
                <td style={{padding:"9px 12px"}}><RoleBadge role={u.role}/></td>
                <td style={{padding:"9px 12px",fontSize:12,color:"#4A5568",maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                  {companies.find(c=>c.id===u.company_id)?.name||<span style={{color:"#A0AEC0"}}>—</span>}
                </td>
                <td style={{padding:"9px 12px"}}>
                  <span style={{fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:20,background:u.is_active?"#E6F4EE":"#F7F9FC",color:u.is_active?"#1A7F5A":"#718096"}}>
                    {u.is_active?"Active":"Inactive"}
                  </span>
                </td>
                <td style={{padding:"9px 12px"}}>
                  <div style={{display:"flex",gap:6}}>
                    <button onClick={()=>{setForm({...blank,...u});setEditUser(u);setShowAdd(true);}}
                      style={{fontSize:11,padding:"4px 10px",borderRadius:6,border:"1.5px solid #E2E8F0",background:"#fff",cursor:"pointer"}}>Edit</button>
                    {!u.is_super_admin&&u.id!==currentUser.id&&(
                      <button onClick={()=>toggleActive(u)}
                        style={{fontSize:11,padding:"4px 10px",borderRadius:6,border:`1.5px solid ${u.is_active?"#F0BCBC":"#A8D5BE"}`,background:u.is_active?"#FAEAEA":"#E6F4EE",color:u.is_active?"#B83232":"#1A7F5A",cursor:"pointer"}}>
                        {u.is_active?"Deactivate":"Activate"}
                      </button>
                    )}
                    {(currentUser.role==="super_admin"||currentUser.role==="admin")&&!u.is_super_admin&&(
                      <button onClick={()=>resetPassword(u)}
                        style={{fontSize:11,padding:"4px 10px",borderRadius:6,border:"1.5px solid rgba(201,168,76,.5)",background:"rgba(201,168,76,.08)",color:"#8A6200",cursor:"pointer"}}>
                        🔑 Reset PW
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showAdd&&(
        <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:"1rem"}}>
          <div style={{background:"#fff",borderRadius:16,width:480,maxWidth:"100%",maxHeight:"90vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 20px 60px rgba(11,31,58,.35)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"1rem 1.5rem",borderBottom:"1px solid #E8EDF4",background:"#fff"}}>
              <span style={{fontFamily:"'Playfair Display',serif",fontSize:16,fontWeight:700,color:"#fff"}}>{editUser?"Edit User":"Add New User"}</span>
              <button onClick={()=>{setShowAdd(false);setEditUser(null);}} style={{background:"none",border:"none",fontSize:22,color:"#C9A84C",cursor:"pointer"}}>×</button>
            </div>
            <div style={{overflowY:"auto",padding:"1.25rem 1.5rem"}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div style={{gridColumn:"1/-1"}}><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Full Name *</label><input value={form.full_name} onChange={sf("full_name")}/></div>
                <div style={{gridColumn:"1/-1"}}><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Email *</label><input type="email" value={form.email} onChange={sf("email")} disabled={!!editUser}/></div>
                {!editUser&&<div style={{gridColumn:"1/-1"}}><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Temporary Password</label><input type="password" value={form.password} onChange={sf("password")} placeholder="Leave blank to auto-generate"/></div>}
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Role</label>
                  <select value={form.role} onChange={sf("role")}>
                    {["super_admin","admin","sales_manager","sales_agent","leasing_manager","leasing_agent","viewer"].map(r=><option key={r} value={r}>{r.replace(/_/g," ")}</option>)}
                  </select>
                </div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Status</label>
                  <select value={form.is_active?"active":"inactive"} onChange={e=>setForm(f=>({...f,is_active:e.target.value==="active"}))}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                {/* Company selector — super admin sees all companies, others see their own */}
                <div style={{gridColumn:"1/-1"}}>
                  <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Company *</label>
                  {isSuperAdmin && companies.length > 0 ? (
                    <select value={form.company_id} onChange={sf("company_id")} style={{border: !form.company_id?"1.5px solid #B83232":undefined}}>
                      <option value="">— Select Company —</option>
                      {companies.map(c=><option key={c.id} value={c.id}>{c.name} ({c.business_type})</option>)}
                    </select>
                  ) : (
                    <input value={companies.find(c=>c.id===currentUser.company_id)?.name || currentUser.company_id || "Your Company"} disabled style={{background:"#F7F9FC",color:"#718096"}}/>
                  )}
                  {!form.company_id && <div style={{fontSize:10,color:"#B83232",marginTop:3}}>⚠ Company is required</div>}
                </div>
              </div>
            </div>
            <div style={{display:"flex",gap:10,justifyContent:"flex-end",padding:"1rem 1.5rem",borderTop:"1px solid #E2E8F0"}}>
              <button onClick={()=>{setShowAdd(false);setEditUser(null);}} style={{padding:"9px 20px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancel</button>
              <button onClick={saveUser} disabled={saving} style={{padding:"9px 24px",borderRadius:8,border:"none",background:saving?"#A0AEC0":"#0F2540",color:"#fff",fontSize:13,fontWeight:600,cursor:saving?"not-allowed":"pointer"}}>{saving?"Saving…":editUser?"Save Changes":"Add User"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsTab({appConfig={}, onConfigChange, currentUser, showToast}) {
  const [form, setForm] = useState({
    mode:     appConfig.mode||"both",
    company:  appConfig.company||"PropCRM",
    currency: appConfig.currency||"AED",
    country:  appConfig.country||"UAE",
  });
  const save=()=>{
    const cfg={...appConfig,...form,updatedAt:new Date().toISOString()};
    onConfigChange(cfg);
    showToast("Settings saved","success");
  };
  return(
    <div style={{maxWidth:480}}>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:".5px"}}>CRM Mode</label>
          <select value={form.mode} onChange={e=>setForm(f=>({...f,mode:e.target.value}))}>
            <option value="sales">Sales Only</option>
            <option value="leasing">Leasing Only</option>
            <option value="both">Sales & Leasing</option>
          </select>
        </div>
        <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:".5px"}}>Company Name</label><input value={form.company} onChange={e=>setForm(f=>({...f,company:e.target.value}))}/></div>
        <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:".5px"}}>Currency</label>
          <select value={form.currency} onChange={e=>setForm(f=>({...f,currency:e.target.value}))}>
            {["AED","USD","GBP","EUR","SAR","QAR","KWD"].map(c=><option key={c}>{c}</option>)}
          </select>
        </div>
        <button onClick={save} style={{padding:"10px 24px",borderRadius:8,border:"none",background:"#0F2540",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",alignSelf:"flex-start"}}>Save Settings</button>
      </div>
    </div>
  );
}

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

function PermissionSetsModule({ currentUser, showToast }) {
  const [sets,      setSets]      = useState([]);
  const [templates, setTemplates] = useState([]);
  const [users,     setUsers]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [view,      setView]      = useState("list"); // list | edit
  const [editing,   setEditing]   = useState(null);
  const [saving,    setSaving]    = useState(false);

  const emptySet = {
    name:"", description:"", based_on:"", color:"#1A5FA8",
    ...Object.fromEntries(ALL_PERM_KEYS.map(k=>[k,false])),
    p_view_dashboard: true,
  };
  const [form, setForm] = useState(emptySet);

  const load = useCallback(async () => {
    setLoading(true);
    const safe = q => q.catch(()=>({data:[]}));
    const [s, t, u] = await Promise.all([
      safe(supabase.from("permission_sets").select("*").eq("company_id", currentUser.company_id||"").order("name")),
      safe(supabase.from("permission_sets").select("*").is("company_id", null).order("name")),
      safe(supabase.from("profiles").select("id,full_name,permission_set_id").eq("company_id", currentUser.company_id||"")),
    ]);
    setSets(s.data||[]);
    setTemplates(t.data||[]);
    setUsers(u.data||[]);
    setLoading(false);
  }, [currentUser.company_id]);

  useEffect(() => { load(); }, [load]);

  const countUsers = (setId) => users.filter(u => u.permission_set_id === setId).length;

  const openNew = (templateId=null) => {
    if (templateId) {
      const tmpl = templates.find(t => t.id === templateId);
      if (tmpl) {
        setForm({ ...emptySet, ...tmpl, id:undefined, company_id:undefined, is_template:false, name:`${tmpl.name} (Custom)`, based_on:tmpl.name });
      }
    } else {
      setForm(emptySet);
    }
    setEditing(null);
    setView("edit");
  };

  const openEdit = (set) => {
    setForm({ ...emptySet, ...set });
    setEditing(set);
    setView("edit");
  };

  const cloneSet = (set) => {
    setForm({ ...emptySet, ...set, id:undefined, name:`${set.name} (Copy)`, based_on:set.name, is_template:false });
    setEditing(null);
    setView("edit");
  };

  const save = async () => {
    if (!form.name.trim()) { showToast("Name required","error"); return; }
    setSaving(true);
    try {
      const payload = { ...form, company_id:currentUser.company_id, is_template:false, updated_at:new Date().toISOString() };
      delete payload.id;
      if (editing) {
        const { error } = await supabase.from("permission_sets").update(payload).eq("id", editing.id);
        if (error) throw error;
        showToast("Permission set updated","success");
      } else {
        const { error } = await supabase.from("permission_sets").insert(payload);
        if (error) throw error;
        showToast("Permission set created","success");
      }
      setView("list"); load();
    } catch(e) { showToast(e.message,"error"); }
    setSaving(false);
  };

  const deleteSet = async (set) => {
    if (countUsers(set.id) > 0) { showToast(`Cannot delete — ${countUsers(set.id)} user(s) assigned to this set`,"error"); return; }
    if (!window.confirm(`Delete "${set.name}"?`)) return;
    await supabase.from("permission_sets").delete().eq("id", set.id);
    showToast("Deleted","info"); load();
  };

  const togglePerm = (key) => setForm(f => ({ ...f, [key]: !f[key] }));

  const setAllInGroup = (group, value) => {
    const keys = PERMISSION_DEFS.find(g=>g.group===group)?.perms.map(p=>p.key)||[];
    setForm(f => ({ ...f, ...Object.fromEntries(keys.map(k=>[k,value])) }));
  };

  if (loading) return <Spinner msg="Loading permission sets…"/>;

  // ── LIST VIEW ─────────────────────────────────────────────────
  if (view === "list") return (
    <div className="fade-in" style={{display:"flex",flexDirection:"column",height:"100%"}}>

      {/* Instructions banner */}
      <div style={{background:"#E6EFF9",border:"1px solid #B5D4F4",borderRadius:10,padding:"12px 16px",marginBottom:16,fontSize:13,color:"#1A5FA8",lineHeight:1.7}}>
        <strong>How permission sets work:</strong> Create named sets of permissions, then assign them to users.
        Each user gets exactly one permission set. Start from a built-in template or create from scratch.
        Built-in templates cannot be deleted — clone them to customise.
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,flex:1,overflow:"hidden"}}>

        {/* Left: Built-in templates */}
        <div style={{display:"flex",flexDirection:"column",overflow:"hidden"}}>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:700,color:"#0F2540",marginBottom:10}}>
            Built-in Templates
            <span style={{fontSize:11,fontWeight:400,color:"#A0AEC0",marginLeft:8}}>Clone to customise</span>
          </div>
          <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:8}}>
            {templates.map(t => (
              <div key={t.id} style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:10,padding:"12px 14px",display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:10,height:10,borderRadius:"50%",background:t.color,flexShrink:0}}/>
                <div style={{flex:1}}>
                  <div style={{fontWeight:600,fontSize:13,color:"#0F2540"}}>{t.name}</div>
                  <div style={{fontSize:11,color:"#A0AEC0"}}>{t.description}</div>
                  <div style={{display:"flex",gap:4,marginTop:6,flexWrap:"wrap"}}>
                    {PERMISSION_DEFS.flatMap(g=>g.perms).filter(p=>t[p.key]).map(p=>(
                      <span key={p.key} style={{fontSize:9,fontWeight:600,padding:"1px 6px",borderRadius:20,background:"#F7F9FC",color:"#4A5568"}}>{p.label}</span>
                    ))}
                  </div>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:5}}>
                  <button onClick={()=>openNew(t.id)}
                    style={{padding:"5px 12px",borderRadius:7,border:"1.5px solid #C9A84C",background:"#FDF3DC",color:"#8A6200",fontSize:11,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>
                    Clone & Edit
                  </button>
                  <button onClick={()=>{ setForm({...emptySet,...t}); setEditing({...t,_readOnly:true}); setView("edit"); }}
                    style={{padding:"5px 12px",borderRadius:7,border:"1.5px solid #E2E8F0",background:"#fff",color:"#4A5568",fontSize:11,cursor:"pointer"}}>
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Custom sets */}
        <div style={{display:"flex",flexDirection:"column",overflow:"hidden"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:700,color:"#0F2540"}}>
              Custom Sets
              <span style={{fontSize:11,fontWeight:400,color:"#A0AEC0",marginLeft:8}}>{sets.length} created</span>
            </div>
            <button onClick={()=>openNew()}
              style={{padding:"7px 16px",borderRadius:8,border:"none",background:"#0F2540",color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>
              + New Set
            </button>
          </div>
          <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:8}}>
            {sets.length===0&&(
              <div style={{textAlign:"center",padding:"3rem 1rem",color:"#A0AEC0"}}>
                <div style={{fontSize:36,marginBottom:8}}>🔐</div>
                <div style={{fontSize:13,marginBottom:4}}>No custom permission sets yet</div>
                <div style={{fontSize:12}}>Clone a template or create from scratch</div>
              </div>
            )}
            {sets.map(s => {
              const uc = countUsers(s.id);
              const enabledCount = ALL_PERM_KEYS.filter(k=>s[k]).length;
              return (
                <div key={s.id} style={{background:"#fff",border:"1.5px solid #E2E8F0",borderRadius:10,padding:"12px 14px"}}>
                  <div style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:8}}>
                    <div style={{width:12,height:12,borderRadius:"50%",background:s.color,flexShrink:0,marginTop:2}}/>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700,fontSize:13,color:"#0F2540"}}>{s.name}</div>
                      {s.description&&<div style={{fontSize:11,color:"#A0AEC0"}}>{s.description}</div>}
                      {s.based_on&&<div style={{fontSize:11,color:"#C9A84C"}}>Based on: {s.based_on}</div>}
                    </div>
                    <div style={{display:"flex",gap:5,alignItems:"center"}}>
                      <span style={{fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:20,background:"#E6EFF9",color:"#1A5FA8"}}>{uc} user{uc!==1?"s":""}</span>
                      <span style={{fontSize:11,color:"#A0AEC0"}}>{enabledCount}/13</span>
                    </div>
                  </div>
                  {/* Permission pills */}
                  <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:10}}>
                    {PERMISSION_DEFS.flatMap(g=>g.perms).filter(p=>s[p.key]).map(p=>(
                      <span key={p.key} style={{fontSize:9,fontWeight:600,padding:"2px 7px",borderRadius:20,background:"#F7F9FC",color:"#4A5568"}}>{p.label}</span>
                    ))}
                    {enabledCount===0&&<span style={{fontSize:11,color:"#A0AEC0",fontStyle:"italic"}}>No permissions enabled</span>}
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    <button onClick={()=>openEdit(s)}
                      style={{flex:1,padding:"6px",borderRadius:7,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>Edit</button>
                    <button onClick={()=>cloneSet(s)}
                      style={{padding:"6px 12px",borderRadius:7,border:"1.5px solid #C9A84C",background:"#FDF3DC",color:"#8A6200",fontSize:12,fontWeight:600,cursor:"pointer"}}>Clone</button>
                    <button onClick={()=>deleteSet(s)}
                      style={{padding:"6px 12px",borderRadius:7,border:"1.5px solid #F0BCBC",background:"#FAEAEA",color:"#B83232",fontSize:12,fontWeight:600,cursor:"pointer"}}>Delete</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );

  // ── EDIT VIEW ─────────────────────────────────────────────────
  const isReadOnly = editing?._readOnly;
  return (
    <div className="fade-in" style={{display:"flex",flexDirection:"column",height:"100%"}}>
      {/* Edit header */}
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
        <button onClick={()=>setView("list")}
          style={{padding:"7px 14px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>
          ← Back
        </button>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:700,color:"#0F2540"}}>
          {isReadOnly?"View Template":editing?"Edit Permission Set":"New Permission Set"}
        </div>
        {isReadOnly&&(
          <button onClick={()=>cloneSet(editing)}
            style={{marginLeft:"auto",padding:"7px 16px",borderRadius:8,border:"1.5px solid #C9A84C",background:"#FDF3DC",color:"#8A6200",fontSize:13,fontWeight:600,cursor:"pointer"}}>
            Clone & Customise →
          </button>
        )}
      </div>

      <div style={{flex:1,overflowY:"auto",display:"grid",gridTemplateColumns:"300px 1fr",gap:16}}>

        {/* Left: Name + colour */}
        <div>
          <div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:12,padding:"16px",marginBottom:12}}>
            <div style={{fontSize:12,fontWeight:700,color:"#0F2540",marginBottom:12,textTransform:"uppercase",letterSpacing:".5px"}}>Set Details</div>
            <div style={{marginBottom:12}}>
              <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Name *</label>
              <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Senior Sales Agent" disabled={isReadOnly}/>
            </div>
            <div style={{marginBottom:12}}>
              <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Description</label>
              <textarea value={form.description||""} onChange={e=>setForm(f=>({...f,description:e.target.value}))} rows={2} placeholder="What does this role do?" disabled={isReadOnly}/>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:8,textTransform:"uppercase",letterSpacing:".5px"}}>Colour</label>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {COLORS.map(c=>(
                  <button key={c} onClick={()=>!isReadOnly&&setForm(f=>({...f,color:c}))}
                    style={{width:28,height:28,borderRadius:"50%",background:c,border:`3px solid ${form.color===c?"#0F2540":"transparent"}`,cursor:isReadOnly?"default":"pointer",transition:".15s"}}/>
                ))}
              </div>
            </div>
          </div>

          {/* Summary */}
          <div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:12,padding:"16px"}}>
            <div style={{fontSize:12,fontWeight:700,color:"#0F2540",marginBottom:12,textTransform:"uppercase",letterSpacing:".5px"}}>Summary</div>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
              <div style={{width:40,height:40,borderRadius:10,background:form.color,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:700,fontSize:16}}>
                {form.name?form.name[0].toUpperCase():"?"}
              </div>
              <div>
                <div style={{fontWeight:700,fontSize:14,color:"#0F2540"}}>{form.name||"Unnamed"}</div>
                <div style={{fontSize:12,color:"#A0AEC0"}}>{ALL_PERM_KEYS.filter(k=>form[k]).length} of 13 permissions</div>
              </div>
            </div>
            {PERMISSION_DEFS.map(g=>{
              const enabled = g.perms.filter(p=>form[p.key]);
              if (!enabled.length) return null;
              return (
                <div key={g.group} style={{marginBottom:8}}>
                  <div style={{fontSize:10,fontWeight:700,color:g.color,textTransform:"uppercase",letterSpacing:".5px",marginBottom:3}}>{g.icon} {g.group}</div>
                  {enabled.map(p=><div key={p.key} style={{fontSize:11,color:"#4A5568",paddingLeft:8}}>✓ {p.label}</div>)}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Permission toggles */}
        <div>
          {PERMISSION_DEFS.map(g=>(
            <div key={g.group} style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:12,padding:"16px",marginBottom:12}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:18}}>{g.icon}</span>
                  <span style={{fontWeight:700,fontSize:14,color:"#0F2540"}}>{g.group}</span>
                  <span style={{fontSize:11,color:"#A0AEC0"}}>{g.perms.filter(p=>form[p.key]).length}/{g.perms.length} enabled</span>
                </div>
                {!isReadOnly&&(
                  <div style={{display:"flex",gap:6}}>
                    <button onClick={()=>setAllInGroup(g.group,true)}
                      style={{padding:"3px 10px",borderRadius:6,border:"1.5px solid #A8D5BE",background:"#E6F4EE",color:"#1A7F5A",fontSize:11,fontWeight:600,cursor:"pointer"}}>All on</button>
                    <button onClick={()=>setAllInGroup(g.group,false)}
                      style={{padding:"3px 10px",borderRadius:6,border:"1.5px solid #F0BCBC",background:"#FAEAEA",color:"#B83232",fontSize:11,fontWeight:600,cursor:"pointer"}}>All off</button>
                  </div>
                )}
              </div>
              {g.perms.map(p=>(
                <div key={p.key} onClick={()=>!isReadOnly&&togglePerm(p.key)}
                  style={{display:"flex",alignItems:"center",gap:12,padding:"10px 12px",borderRadius:8,marginBottom:6,background:form[p.key]?g.bg:"#FAFBFC",border:`1.5px solid ${form[p.key]?g.color+"33":"#E2E8F0"}`,cursor:isReadOnly?"default":"pointer",transition:"all .15s"}}>
                  {/* Toggle */}
                  <div style={{width:40,height:22,borderRadius:11,background:form[p.key]?g.color:"#E2E8F0",position:"relative",flexShrink:0,transition:"background .2s"}}>
                    <div style={{position:"absolute",top:3,left:form[p.key]?20:3,width:16,height:16,borderRadius:"50%",background:"#fff",transition:"left .2s",boxShadow:"0 1px 3px rgba(0,0,0,.2)"}}/>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:600,color:form[p.key]?g.color:"#4A5568"}}>{p.label}</div>
                    <div style={{fontSize:11,color:"#A0AEC0"}}>{p.desc}</div>
                  </div>
                  {form[p.key]&&<span style={{fontSize:11,fontWeight:700,color:g.color}}>✓</span>}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Save bar */}
      {!isReadOnly&&(
        <div style={{display:"flex",gap:10,justifyContent:"flex-end",paddingTop:14,marginTop:8,borderTop:"1px solid #E2E8F0"}}>
          <button onClick={()=>setView("list")}
            style={{padding:"9px 22px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>
            Cancel
          </button>
          <button onClick={save} disabled={saving}
            style={{padding:"9px 28px",borderRadius:8,border:"none",background:saving?"#A0AEC0":"#0F2540",color:"#fff",fontSize:13,fontWeight:600,cursor:saving?"not-allowed":"pointer"}}>
            {saving?"Saving…":editing?"Save Changes":"Create Permission Set"}
          </button>
        </div>
      )}
    </div>
  );
}



// ══════════════════════════════════════════════════════════════════
// LEASING ENQUIRIES — Tenant lead tracking for Leasing CRM
// Uses same leads table, filtered by property_type = "Lease"
// Stages: New Enquiry → Contacted → Viewing Scheduled → Offer Made → Lease Signed → Lost
// ══════════════════════════════════════════════════════════════════


// ══════════════════════════════════════════════════════════════════
// LEASING ENQUIRIES — Tenant contacts + Lease Opportunities
// Same architecture as Sales Leads + Opportunities
// ══════════════════════════════════════════════════════════════════

const LEASE_STAGES = ["New Enquiry","Contacted","Viewing","Offer Made","Reserved","Lease Signed","Lost"];
const LEASE_STAGE_META = {
  "New Enquiry":   {c:"#1A5FA8", bg:"#E6EFF9"},
  "Contacted":     {c:"#5B3FAA", bg:"#EEE8F9"},
  "Viewing":       {c:"#A06810", bg:"#FDF3DC"},
  "Offer Made":    {c:"#B83232", bg:"#FAEAEA"},
  "Reserved":      {c:"#1A7F5A", bg:"#E6F4EE"},
  "Lease Signed":  {c:"#0F2540", bg:"#E2E8F0"},
  "Lost":          {c:"#718096", bg:"#F7F9FC"},
};

// ── Lease Opportunity Detail ──────────────────────────────────────
function PwRecoveryForm({onDone}){
  const[pw,setPw]=useState("");const[pw2,setPw2]=useState("");
  const[loading,setLoading]=useState(false);const[done,setDone]=useState(false);const[err,setErr]=useState("");
  const submit=async()=>{
    if(pw.length<8){setErr("Password must be at least 8 characters");return;}
    if(pw!==pw2){setErr("Passwords do not match");return;}
    setLoading(true);setErr("");
    const{error}=await supabase.auth.updateUser({password:pw});
    setLoading(false);
    if(error)setErr(error.message);
    else{setDone(true);setTimeout(onDone,2000);}
  };
  if(done)return(<div style={{textAlign:"center",padding:"20px 0"}}><div style={{fontSize:40,marginBottom:8}}>✅</div><div style={{color:"#1A7F5A",fontWeight:600,fontSize:16}}>Password changed!</div><div style={{fontSize:13,color:"#718096",marginTop:6}}>Signing you out — please log in again.</div></div>);
  const isSessionError = err.includes("session")||err.includes("Session")||err.includes("token")||err.includes("expired");
  return(
    <div>
      {err&&(
        <div style={{background:"#FEE2E2",color:"#C53030",padding:"10px 14px",borderRadius:8,marginBottom:12,fontSize:13}}>
          {err}
          {isSessionError&&<div style={{marginTop:8,fontSize:12,color:"#C53030"}}>Your reset link has expired. Please go back to login and request a new one.</div>}
        </div>
      )}
      <div style={{marginBottom:12}}><label style={{display:"block",fontSize:12,fontWeight:600,color:"#4A5568",textTransform:"uppercase",letterSpacing:".5px",marginBottom:4}}>New Password *</label><PwInput value={pw} onChange={e=>setPw(e.target.value)} placeholder="Min 8 characters" style={{width:"100%",padding:"10px 14px",border:"1.5px solid #E2E8F0",borderRadius:10,fontSize:14,outline:"none",boxSizing:"border-box"}}/></div>
      <div style={{marginBottom:16}}><label style={{display:"block",fontSize:12,fontWeight:600,color:"#4A5568",textTransform:"uppercase",letterSpacing:".5px",marginBottom:4}}>Confirm Password *</label><PwInput value={pw2} onChange={e=>setPw2(e.target.value)} placeholder="Repeat new password" style={{width:"100%",padding:"10px 14px",border:"1.5px solid #E2E8F0",borderRadius:10,fontSize:14,outline:"none",boxSizing:"border-box"}}/></div>
      <button onClick={submit} disabled={loading} style={{width:"100%",padding:"12px",borderRadius:10,border:"none",background:"#0F2540",color:"#fff",fontSize:14,fontWeight:600,cursor:"pointer"}}>{loading?"Saving…":"Set New Password →"}</button>
    </div>
  );
}

export default function App(){
  const[checking,  setChecking]  = useState(true);
  const[currentUser,setCurrentUser]=useState(null);
  const[leads,     setLeads]     = useState([]);
  const[properties,setProperties]= useState([]);
  const[activities,setActivities]= useState([]);
  const[meetings,  setMeetings]  = useState([]);
  const[followups, setFollowups] = useState([]);
  const[discounts, setDiscounts] = useState([]);
  const[users,     setUsers]     = useState([]);
  const[aiProjects,setAiProjects]= useState([]);
  const[aiUnits,   setAiUnits]   = useState([]);
  const[aiSalePr,  setAiSalePr]  = useState([]);
  const[aiLeasePr, setAiLeasePr] = useState([]);
  const[navFilter, setNavFilter]  = useState(null); // {type, value} passed from dashboard
  const[tab,       setTab]       = useState(()=>{
    const lastApp = localStorage.getItem("propccrm_last_app")||"sales";
    return lastApp==="leasing"?"l_dashboard":"dashboard";
  });

  // Browser back/forward button support
  const navigateToTab = useCallback((newTab, filter=null) => {
    const prev = tab;
    setTab(newTab);
    setNavFilter(filter||null);
    // Push state so browser back button works
    window.history.pushState({tab: newTab, filter}, "", window.location.pathname);
  }, [tab]);

  useEffect(() => {
    const lastApp = localStorage.getItem("propccrm_last_app")||"sales";
    const dashboard = lastApp==="leasing"?"l_dashboard":"dashboard";

    // Push two states: a sentinel at -1 and current at 0
    // This means back button hits sentinel, we catch it and push forward again
    window.history.replaceState({tab:"_sentinel"}, "", window.location.pathname);
    window.history.pushState({tab: dashboard, filter: null}, "", window.location.pathname);

    const handlePop = (e) => {
      if(!e.state||e.state.tab==="_sentinel") {
        // User hit back past our app — push back in
        window.history.pushState({tab: dashboard, filter: null}, "", window.location.pathname);
        setTab(dashboard);
        setNavFilter(null);
      } else if(e.state?.tab) {
        setTab(e.state.tab);
        setNavFilter(e.state.filter||null);
      }
    };
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, []);
  const[activeApp, setActiveApp] = useState(()=>localStorage.getItem("propccrm_last_app")||"sales");
  const[appConfig, setAppConfig] = useState(()=>getAppConfig());
  const[dataLoading,setDataLoading]=useState(false);
  const[companies, setCompanies] = useState([]);
  const[activeCompanyId,setActiveCompanyId]=useState(()=>localStorage.getItem("propccrm_company_id")||null);
  // Reload inventory when company changes
  const switchCompany = async (id) => {
    // Update profile company_id in Supabase so RLS works correctly
    await supabase.from("profiles").update({company_id:id}).eq("id",currentUser.id);
    setActiveCompanyId(id);
    localStorage.setItem("propccrm_company_id",id);
    // Update companies list display then reload
    window.location.reload();
  };
  const[leasingData,setLeasingData]=useState({tenants:[],leases:[],payments:[],maintenance:[],loaded:false});
  const[followupAlerts,setFollowupAlerts]=useState({staleLeads:[],overduePayments:[],expiringLeases:[]});
  const[opps,setOpps]=useState([]);
  const[toast,setToast]=useState(null);
  const[pwRecovery,setPwRecovery]=useState(false);
  const[showPwModal,setShowPwModal]=useState(false);
  const showToast=(msg,type="success")=>setToast({msg,type});

  const loadAIData=useCallback(async()=>{
    if(aiProjects.length>0)return;
    try{
      const[p,u,sp,lp]=await Promise.all([
        safe(supabase.from("projects").select("*")),
        safe(supabase.from("project_units").select("*")),
        safe(supabase.from("unit_sale_pricing").select("*")),
        safe(supabase.from("unit_lease_pricing").select("*")),
      ]);
      setAiProjects(p.data||[]);setAiUnits(u.data||[]);setAiSalePr(sp.data||[]);setAiLeasePr(lp.data||[]);
    }catch(e){console.log(e);}
  },[aiProjects.length]);

  useEffect(()=>{ window.__propcrm_units=aiUnits; },[aiUnits]);
  useEffect(()=>{ window.__propcrm_projects=aiProjects; },[aiProjects]);
  useEffect(()=>{ window.__propcrm_leads=leads; },[leads]);
  useEffect(()=>{ window.__propcrm_user=currentUser; },[currentUser]);
  useEffect(()=>{
    const h=()=>{ window.__propcrm_leads=leads; window.__propcrm_units=aiUnits; window.__propcrm_projects=aiProjects; window.__propcrm_user=currentUser; };
    window.addEventListener('propcrm_ai_data_request',h);
    return()=>window.removeEventListener('propcrm_ai_data_request',h);
  },[leads,aiUnits,aiProjects,currentUser]);

  useEffect(()=>{
    const restore=async()=>{
      const hp=new URLSearchParams(window.location.hash.replace("#","?").slice(1));
      if(hp.get("type")==="recovery"){setPwRecovery(true);return;}
      try{
        const{data:{session}}=await supabase.auth.getSession();
        if(session?.user){
          const{data:profile}=await supabase.from("profiles").select("*").eq("id",session.user.id).single();
          if(profile&&profile.is_active)setCurrentUser({...session.user,...profile});
          else await supabase.auth.signOut();
        }
      }catch(e){console.error("Session restore error:",e);}
      finally{setChecking(false);}
    };
    restore();
    const{data:{subscription}}=supabase.auth.onAuthStateChange(async(event,session)=>{
      if(event==="SIGNED_OUT"){setCurrentUser(null);setLeads([]);setProperties([]);setActivities([]);setMeetings([]);setFollowups([]);setOpps([]);}
      if(event==="PASSWORD_RECOVERY"){setPwRecovery(true);}
      if(event==="TOKEN_REFRESHED"&&session?.user){const{data:p}=await supabase.from("profiles").select("*").eq("id",session.user.id).single();if(p)setCurrentUser(u=>({...u,...p}));}
    });
    return()=>subscription.unsubscribe();
  },[]);

  useEffect(()=>{
    if(!currentUser)return;
    const safe=async(q)=>{ try{const r=await q;return{data:(r.data||[])};}catch(e){console.warn("Query error:",e);return{data:[]};} };
    const cid = activeCompanyId || currentUser.company_id || null;
    const load=async()=>{
      setDataLoading(true);
      try{
        const[l,pr,a,u,d]=await Promise.all([
          safe(cid
            ? supabase.from("leads").select("*").eq("company_id",cid).order("created_at",{ascending:false})
            : supabase.from("leads").select("*").order("created_at",{ascending:false})),
          safe(supabase.from("properties").select("*").order("created_at",{ascending:false})),
          safe(supabase.from("activities").select("*").order("created_at",{ascending:false})),
          safe(cid ? supabase.from("profiles").select("*").eq("company_id",cid).order("full_name") : supabase.from("profiles").select("*").order("full_name")),
          safe(cid
            ? supabase.from("discount_requests").select("*").eq("company_id",cid).order("created_at",{ascending:false})
            : supabase.from("discount_requests").select("*").order("created_at",{ascending:false})),
        ]);
        // SECURITY: filter all data by active company client-side
        const filterByCo = (arr) => cid ? arr.filter(x=>x.company_id===cid) : arr;
        setLeads(filterByCo(l.data));
        setProperties(pr.data);
        setActivities(filterByCo(a.data));
        setUsers(filterByCo(u.data||[]));
        setDiscounts(filterByCo(d.data));
        // Load opportunities globally
        const oppRes = await safe(supabase.from("opportunities").select("*").order("created_at",{ascending:false}));
        setOpps(filterByCo(oppRes.data||[]));
        // Load inventory + leasing data eagerly
        const[proj,units2,sp2,lp2,lt,ll,lp_,lm]=await Promise.all([
          safe(cid ? supabase.from("projects").select("*").eq("company_id",cid).order("name") : supabase.from("projects").select("*").order("name")),
          safe(cid ? supabase.from("project_units").select("*").eq("company_id",cid) : supabase.from("project_units").select("*")),
          safe(cid ? supabase.from("unit_sale_pricing").select("*").eq("company_id",cid) : supabase.from("unit_sale_pricing").select("*")),
          safe(cid ? supabase.from("unit_lease_pricing").select("*").eq("company_id",cid) : supabase.from("unit_lease_pricing").select("*")),
          safe(cid ? supabase.from("tenants").select("*").eq("company_id",cid).order("full_name") : supabase.from("tenants").select("*").order("full_name")),
          safe(cid ? supabase.from("leases").select("*").eq("company_id",cid).order("end_date") : supabase.from("leases").select("*").order("end_date")),
          safe(cid ? supabase.from("rent_payments").select("*").order("due_date") : supabase.from("rent_payments").select("*").order("due_date")),
          safe(cid ? supabase.from("maintenance").select("*").eq("company_id",cid).order("created_at",{ascending:false}) : supabase.from("maintenance").select("*").order("created_at",{ascending:false})),
        ]);
        setAiProjects(filterByCo(proj.data));
        setAiUnits(filterByCo(units2.data));
        setAiSalePr(filterByCo(sp2.data));
        setAiLeasePr(filterByCo(lp2.data));
        const coTenants = filterByCo(lt.data);
        const coTenantIds = coTenants.map(t=>t.id);
        const coLeases = (ll.data||[]).filter(l=>
          (l.company_id&&l.company_id===cid) ||
          coTenantIds.includes(l.tenant_id)
        );
        const coLeaseIds = coLeases.map(l=>l.id);
        setLeasingData({
          tenants: coTenants,
          leases:  coLeases,
          payments:(lp_.data||[]).filter(p=>coLeaseIds.includes(p.lease_id)||coTenantIds.includes(p.tenant_id)),
          maintenance:(lm.data||[]).filter(m=>!m.company_id||m.company_id===cid),
          loaded:true
        });
        const today2=new Date();
        const stale=(l.data||[]).filter(lead=>!["Closed Won","Closed Lost"].includes(lead.stage)&&lead.stage_updated_at&&Math.floor((today2-new Date(lead.stage_updated_at))/(864e5))>=7);
        const overdueRent=(lp_.data||[]).filter(p=>p.status==="Pending"&&p.due_date&&new Date(p.due_date)<today2);
        const expiringLeases30=(ll.data||[]).filter(l2=>l2.status==="Active"&&l2.end_date&&Math.ceil((new Date(l2.end_date)-today2)/864e5)<=30&&Math.ceil((new Date(l2.end_date)-today2)/864e5)>0);
        setFollowupAlerts({staleLeads:stale,overduePayments:overdueRent,expiringLeases:expiringLeases30});
      }catch(e){console.error("Load error:",e);}
      setDataLoading(false);
    };
    load();
    const ch=supabase.channel("v3-changes-"+cid)
      .on("postgres_changes",{event:"*",schema:"public",table:"leads"},p=>{if(p.eventType==="INSERT")setLeads(x=>[p.new,...x]);if(p.eventType==="UPDATE")setLeads(x=>x.map(l=>l.id===p.new.id?p.new:l));if(p.eventType==="DELETE")setLeads(x=>x.filter(l=>l.id!==p.old.id));})
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"activities"},p=>setActivities(x=>[p.new,...x]))
      .on("postgres_changes",{event:"*",schema:"public",table:"opportunities"},p=>{if(p.eventType==="INSERT")setOpps(x=>[p.new,...x]);if(p.eventType==="UPDATE")setOpps(x=>x.map(o=>o.id===p.new.id?p.new:o));if(p.eventType==="DELETE")setOpps(x=>x.filter(o=>o.id!==p.old.id));})
      .subscribe();
    return()=>supabase.removeChannel(ch);
  },[currentUser, activeCompanyId]);

  const handleLogin=user=>{
    setCurrentUser(user);
    localStorage.setItem("propccrm_role", user.role||"viewer");
    const app = DEFAULT_APP[user.role]||"sales";
    setActiveApp(app);
    setActiveApp(app); localStorage.setItem("propccrm_last_app", app);
    localStorage.setItem("propccrm_last_app", app);
    // Load companies for all admin/manager roles to show in header
    if(["super_admin","admin","sales_manager","leasing_manager"].includes(user.role)){
      supabase.from("companies").select("*").order("name").then(({data})=>{
        if(data){
          // Cache the active company for instant display on next load
          const cid = localStorage.getItem("propccrm_company_id") || user.company_id;
          const activeCo = data.find(c=>c.id===cid) || data[0];
          if(activeCo) localStorage.setItem("propccrm_company_cache", JSON.stringify({id:activeCo.id,name:activeCo.name,logo_url:activeCo.logo_url||"",business_type:activeCo.business_type||"",company_category:activeCo.company_category||"Brokerage",ai_assistant_name:activeCo.ai_assistant_name||""}));
          setCompanies(data);
          const saved=localStorage.getItem("propccrm_company_id");
          const co=saved?data.find(c=>c.id===saved):data[0];
          if(co){setActiveCompanyId(co.id);localStorage.setItem("propccrm_company_id",co.id);}
        }
      });
    }
  };

  const handleLogout=async()=>{await supabase.auth.signOut();setCurrentUser(null);};
  const currentApp = activeApp;
  const userRole   = currentUser?.role||"viewer";
  const canSwitch  = ["super_admin","admin","sales_manager","leasing_manager"].includes(userRole);

  if(pwRecovery)return(
    <div style={{minHeight:"100vh",background:"#fff",display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem"}}>
      <div style={{background:"#fff",borderRadius:20,padding:"2.5rem",width:440,maxWidth:"100%",boxShadow:"0 30px 80px rgba(0,0,0,0.4)"}}>
        <div style={{textAlign:"center",marginBottom:24}}><div style={{fontSize:48,marginBottom:8}}>🔑</div><div style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:700,color:"#0F2540",marginBottom:6}}>Set New Password</div><div style={{fontSize:13,color:"#718096"}}>Enter your new password below</div></div>
        <PwRecoveryForm onDone={()=>{setPwRecovery(false);supabase.auth.signOut();}}/>
        <div style={{textAlign:"center",marginTop:16}}><button onClick={()=>{setPwRecovery(false);supabase.auth.signOut();}} style={{background:"none",border:"none",color:"#A0AEC0",fontSize:13,cursor:"pointer"}}>← Back to Login</button></div>
      </div>
    </div>
  );

  if(checking) return(
    <div style={{height:"100dvh",background:"#0F2540",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12}}>
      <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:700,color:"#fff"}}><span style={{color:"#C9A84C"}}>◆</span> PropCRM</div>
      <div style={{width:32,height:32,border:"2px solid rgba(255,255,255,.15)",borderTopColor:"#C9A84C",borderRadius:"50%",animation:"spin 1s linear infinite"}}/>
    </div>
  );

  if(!currentUser) return <LoginScreen onLogin={handleLogin}/>;

  const cfg=(appConfig&&typeof appConfig==="object")?appConfig:{mode:"both"};
  // Always use currentApp to pick allowed tabs — ignore cfg.mode when app is explicitly selected
  const allowedTabs = currentApp==="leasing" ? MODE_TABS.leasing : (MODE_TABS[cfg.mode]||MODE_TABS.both);
  const visibleTabs=TABS.filter(t=>t.app===currentApp&&t.roles.includes(userRole)&&allowedTabs.includes(t.id));

  return (
    <>
    <GlobalStyle/>
    <div style={{display:"flex",flexDirection:"column",height:"100dvh",background:"#F7F9FC",overflow:"hidden"}}>

      {/* Top bar */}
      <div style={{background:"#fff",flexShrink:0,borderBottom:"1px solid #E8EDF4"}}>
        <div style={{display:"flex",alignItems:"center",padding:"0 1.25rem",height:54,gap:10}}>

          {/* LEFT: Company Logo + Name — hero position */}
          {(()=>{
            const storedId = activeCompanyId || localStorage.getItem("propccrm_company_id") || currentUser?.company_id;
            const cachedCo = (()=>{ try{ return JSON.parse(localStorage.getItem("propccrm_company_cache")||"null"); }catch{return null;} })();
            const co = companies.find(c=>c.id===storedId) || companies.find(c=>c.id===currentUser?.company_id) || companies[0] || cachedCo || null;
            const isSA = currentUser?.role==="super_admin";
            const bizLabel = co?.business_type==="both"?"Sales & Leasing":co?.business_type==="sales"?"Sales Only":co?.business_type==="leasing"?"Leasing Only":co?.business_type||"";

            return (
              <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0,minWidth:0}}>
                {/* Logo */}
                {co?.logo_url
                  ? <img src={co.logo_url} alt={co?.name} style={{width:36,height:36,borderRadius:8,objectFit:"cover",border:"2px solid rgba(201,168,76,.5)",flexShrink:0}}/>
                  : <div style={{width:36,height:36,borderRadius:8,background:"linear-gradient(135deg,#C9A84C,#E8C97A)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:16,color:"#0F2540",flexShrink:0,border:"2px solid rgba(201,168,76,.4)"}}>
                      {co?.name?.charAt(0)||"◆"}
                    </div>
                }
                {/* Company name + type */}
                <div style={{display:"flex",flexDirection:"column",minWidth:0}}>
                  <span style={{fontFamily:"'Inter',sans-serif",fontSize:14,color:"#0F2540",fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:180,lineHeight:1.2,letterSpacing:"-.3px"}}>
                    {co?.name||"PropCRM"}
                  </span>
                  {bizLabel&&<span style={{fontSize:9,color:"#94A3B8",textTransform:"uppercase",letterSpacing:".6px",lineHeight:1.3}}>{bizLabel}</span>}
                </div>
                {/* Super admin company switcher */}
                {isSA&&companies.length>1&&(
                  <select value={storedId||""} onChange={e=>{
                    setActiveCompanyId(e.target.value);
                    localStorage.setItem("propccrm_company_id",e.target.value);
                    window.location.reload();
                  }} style={{
                    background:"rgba(255,255,255,.1)",border:"1px solid rgba(201,168,76,.35)",
                    borderRadius:6,padding:"3px 6px",color:"#C9A84C",fontSize:11,fontWeight:600,
                    cursor:"pointer",maxWidth:130
                  }}>
                    {companies.map(c=><option key={c.id} value={c.id} style={{background:"#0F2540",color:"#fff"}}>{c.name}</option>)}
                  </select>
                )}
              </div>
            );
          })()}

          {/* CENTRE: CRM Switcher */}
          {canSwitch&&(
            <div style={{display:"flex",background:"#F1F5F9",borderRadius:10,padding:3,gap:3,flexShrink:0}}>
              {[
                {id:"sales",   label:"Sales",   icon:"🏷", accent:"#4A9EE8"},
                {id:"leasing", label:"Leasing", icon:"🔑", accent:"#9B7FD4"},
              ].map(a=>{
                const isActive=currentApp===a.id;
                return (
                  <button key={a.id} onClick={()=>{
                    setActiveApp(a.id);
                    localStorage.setItem("propccrm_last_app",a.id);
                    setTimeout(()=>navigateToTab(a.id==="sales"?"dashboard":"l_dashboard"),50);
                  }} style={{
                    padding:"5px 12px",borderRadius:8,border:"none",
                    background:isActive?"#fff":"transparent",
                    color:isActive?a.accent:"#64748B",
                    fontSize:12,fontWeight:isActive?700:400,cursor:"pointer",
                    display:"flex",alignItems:"center",gap:4,
                    transition:"all .2s",whiteSpace:"nowrap",
                    boxShadow:isActive?"0 1px 6px rgba(0,0,0,.15)":"none",
                  }}>
                    {a.icon} {a.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* RIGHT: User info + PropCRM watermark */}
          <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
            {/* User */}
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:12,color:"#0F2540",fontWeight:600,lineHeight:1.2,letterSpacing:"-.2px"}}>{currentUser.full_name}</div>
              <RoleBadge role={currentUser.role}/>
            </div>
            <Av name={currentUser.full_name||currentUser.email} size={32} bg="#C9A84C" tc="#0F2540"/>
            {showPwModal&&(<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:99998,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setShowPwModal(false)}><div style={{background:"#fff",borderRadius:16,padding:"2rem",width:400,maxWidth:"90vw",boxShadow:"0 20px 60px rgba(0,0,0,.3)"}} onClick={e=>e.stopPropagation()}><div style={{textAlign:"center",marginBottom:20}}><div style={{fontSize:36,marginBottom:6}}>🔑</div><div style={{fontFamily:"'Inter',sans-serif",fontSize:16,fontWeight:700,color:"#0F2540",letterSpacing:"-.4px",marginBottom:4}}>Change Password</div></div><PwRecoveryForm onDone={()=>{setShowPwModal(false);showToast("Password changed","success");supabase.auth.signOut();}}/></div></div>)}
            <button onClick={()=>setShowPwModal(true)} title="Change my password" style={{fontSize:16,color:"#C9A84C",background:"none",border:"none",cursor:"pointer",padding:"0 4px"}}>🔑</button>
            <button onClick={handleLogout} title="Sign out" style={{fontSize:11,color:"#94A3B8",background:"none",border:"1px solid #E2E8F0",borderRadius:6,padding:"4px 8px",cursor:"pointer",whiteSpace:"nowrap",transition:"color .15s"}}
              onMouseOver={e=>e.currentTarget.style.color="rgba(255,255,255,.8)"}
              onMouseOut={e=>e.currentTarget.style.color="rgba(255,255,255,.35)"}>↩</button>
            {/* PropCRM subtle watermark */}
            <div style={{borderLeft:"1px solid #E8EDF4",paddingLeft:10,display:"flex",alignItems:"center",gap:3}}>
              <span style={{color:"#C9A84C",fontSize:10}}>◆</span>
              <span style={{fontFamily:"'Inter',sans-serif",fontSize:10,color:"#94A3B8",fontWeight:600,letterSpacing:".5px"}}>PropCRM</span>
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div className="tab-bar" style={{display:"flex",alignItems:"center",padding:"0 1.25rem",height:40,gap:2,borderTop:"1px solid #F1F5F9",overflowX:"auto",background:"#FAFBFE",scrollbarWidth:"none"}}>
          {visibleTabs.map(t=>(
            <button key={t.id} onClick={()=>{navigateToTab(t.id);if(t.id==="ai"||t.id==="l_ai")loadAIData();}}
              style={{
                padding:"5px 12px",borderRadius:"6px 6px 0 0",border:"none",
                background:tab===t.id?(currentApp==="sales"?"#EFF6FF":"#F5F0FF"):(t.id==="proppulse"||t.id==="l_proppulse"?"rgba(201,168,76,.08)":"transparent"),
                color:tab===t.id?"#0F2540":(t.id==="proppulse"||t.id==="l_proppulse"?"#8A6200":"#64748B"),
                fontSize:12,fontWeight:(tab===t.id||(t.id==="proppulse"||t.id==="l_proppulse"))?600:400,cursor:"pointer",
                whiteSpace:"nowrap",transition:"all .15s",flexShrink:0,
                borderBottom:tab===t.id?`2px solid ${currentApp==="sales"?"#4A9EE8":"#9B7FD4"}`:(t.id==="proppulse"||t.id==="l_proppulse"?"2px solid #C9A84C":"2px solid transparent"),
              }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Page title */}
      <div style={{padding:"8px 1rem 6px",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
        <div>
          <div style={{fontFamily:"'Inter',sans-serif",fontSize:16,fontWeight:700,color:"#0F2540",letterSpacing:"-.4px"}}>{visibleTabs.find(t=>t.id===tab)?.label||""}</div>
          <div style={{fontSize:11,color:"#A0AEC0"}}>{SUBTITLES[tab]||""}</div>
        </div>
      </div>

      {/* Content */}
      <div style={{flex:1,overflowY:"auto",overflowX:"hidden",padding:"0 1rem 1rem",WebkitOverflowScrolling:"touch",minHeight:0}}>
        {(dataLoading&&leads.length===0&&aiUnits.length===0)?<Spinner msg="Loading your data…"/>:(<>

          {/* ── Sales CRM ─────────────────────────────────────── */}
          {tab==="dashboard"   &&<Dashboard leads={leads} opps={opps} properties={properties} activities={activities} currentUser={currentUser} meetings={meetings} followups={followups} crmContext="sales" units={aiUnits} salePricing={aiSalePr} leasePricing={aiLeasePr} onNavigate={(t,filter)=>navigateToTab(t,filter)}/>}
          {tab==="leads"       &&<Leads leads={leads} setLeads={setLeads} opps={opps} setOpps={setOpps} properties={properties} activities={activities} setActivities={setActivities} discounts={discounts} setDiscounts={setDiscounts} currentUser={currentUser} users={users} showToast={showToast}/>}
          {tab==="projects"    &&<ProjectsModule currentUser={currentUser} showToast={showToast} crmContext="sales" preloadedProjects={aiProjects} preloadedUnits={aiUnits}/>}
          {tab==="builder"     &&<InventoryModule currentUser={currentUser} showToast={showToast} crmContext="sales" initialFilter={navFilter} preloadedUnits={aiUnits} preloadedProjects={aiProjects} preloadedSalePricing={aiSalePr} preloadedLeasePricing={aiLeasePr} activeCompanyId={activeCompanyId} globalOpps={opps}/>}
          {tab==="discounts"   &&<DiscountApprovals discounts={discounts} setDiscounts={setDiscounts} leads={leads} user={currentUser} toast={showToast}/>}
          {tab==="activity"    &&<ActivityLog leads={leads} activities={activities} setActivities={setActivities} currentUser={currentUser} showToast={showToast} initialFilter={navFilter}/>}
          {tab==="ai"          &&<AIAssistant leads={leads} units={aiUnits} projects={aiProjects} salePricing={aiSalePr} leasePricing={aiLeasePr} activities={activities} currentUser={currentUser} showToast={showToast}/>}
          {tab==="reports"     &&<ReportsModule currentUser={currentUser} showToast={showToast} globalOpps={opps} leads={leads} activities={activities} initialFilter={navFilter} preloadedUnits={aiUnits} preloadedProjects={aiProjects} preloadedSalePricing={aiSalePr} preloadedLeasePricing={aiLeasePr} preloadedUsers={users}/>}
          {(tab==="proppulse"||tab==="l_proppulse")&&<PropPulse currentUser={currentUser} showToast={showToast}/>}
          {tab==="pay_plans"   &&<PaymentPlanTemplates currentUser={currentUser} showToast={showToast} projects={aiProjects}/>}
          {tab==="companies"   &&<CompaniesModule currentUser={currentUser} showToast={showToast} onSwitchCompany={(id, coObj)=>{
  const co = coObj || companies.find(c=>c.id===id);
  if(co) localStorage.setItem("propccrm_company_cache",JSON.stringify({id:co.id,name:co.name,logo_url:co.logo_url||"",business_type:co.business_type||"",ai_assistant_name:co.ai_assistant_name||""}));
  setActiveCompanyId(id);
  localStorage.setItem("propccrm_company_id",id);
  setTab("dashboard");
}} activeCompanyId={activeCompanyId}/>}
          {tab==="users"       &&can(userRole,"manage_users")&&<UserManagement currentUser={currentUser} leads={leads} activities={activities} showToast={showToast} appConfig={appConfig} onConfigChange={cfg=>{saveAppConfig(cfg);setAppConfig(cfg);}}/>}
          {tab==="permissions" &&<PermissionSetsModule currentUser={currentUser} showToast={showToast}/>}
          {tab==="group_view"  &&<GroupConsolidatedView/>}

          {/* ── Leasing CRM ───────────────────────────────────── */}
          {tab==="l_dashboard" &&<LeasingDashboard currentUser={currentUser} activities={activities} units={aiUnits} salePricing={aiSalePr} leasePricing={aiLeasePr} leasingData={leasingData} onNavigate={(t,filter)=>navigateToTab(t,filter)} followupAlerts={followupAlerts} key="l_dash"/>}
          {tab==="l_leads"     &&<LeasingLeads currentUser={currentUser} showToast={showToast} users={users}/>}
          {tab==="l_projects"  &&<ProjectsModule currentUser={currentUser} showToast={showToast} crmContext="leasing" preloadedProjects={aiProjects} preloadedUnits={aiUnits}/>}
          {tab==="l_inventory" &&<InventoryModule currentUser={currentUser} showToast={showToast} crmContext="leasing" preloadedUnits={aiUnits} preloadedProjects={aiProjects} preloadedSalePricing={aiSalePr} preloadedLeasePricing={aiLeasePr} activeCompanyId={activeCompanyId} globalOpps={opps}/>}
          {tab==="leasing"     &&<LeasingModule currentUser={currentUser} showToast={showToast} leasingData={leasingData} setLeasingData={setLeasingData} initialFilter={navFilter}/>}
          {tab==="l_discounts" &&<DiscountApprovals discounts={discounts} setDiscounts={setDiscounts} leads={leads} user={currentUser} toast={showToast}/>}
          {tab==="l_activity"  &&<ActivityLog leads={leads} activities={activities} setActivities={setActivities} currentUser={currentUser} showToast={showToast}/>}
          {tab==="l_ai"        &&<AIAssistant leads={leads} units={aiUnits} projects={aiProjects} salePricing={aiSalePr} leasePricing={aiLeasePr} activities={activities} currentUser={currentUser} showToast={showToast}/>}
          {tab==="l_reports"   &&<ReportsModule currentUser={currentUser} showToast={showToast} globalOpps={opps} leads={leads} activities={activities} leasingData={leasingData} crmContext="leasing" preloadedUnits={aiUnits} preloadedProjects={aiProjects} preloadedSalePricing={aiSalePr} preloadedLeasePricing={aiLeasePr} preloadedUsers={users}/>}
          {tab==="l_companies" &&<CompaniesModule currentUser={currentUser} showToast={showToast} onSwitchCompany={(id, coObj)=>{
  const co = coObj || companies.find(c=>c.id===id);
  if(co) localStorage.setItem("propccrm_company_cache",JSON.stringify({id:co.id,name:co.name,logo_url:co.logo_url||"",business_type:co.business_type||"",ai_assistant_name:co.ai_assistant_name||""}));
  setActiveCompanyId(id);
  localStorage.setItem("propccrm_company_id",id);
  setTab("l_dashboard");
}} activeCompanyId={activeCompanyId}/>}
          {tab==="l_users"     &&can(userRole,"manage_users")&&<UserManagement currentUser={currentUser} leads={leads} activities={activities} showToast={showToast} appConfig={appConfig} onConfigChange={cfg=>{saveAppConfig(cfg);setAppConfig(cfg);}}/>}
          {tab==="l_permissions"&&<PermissionSetsModule currentUser={currentUser} showToast={showToast}/>}

          {tab==="l_group_view" &&<GroupConsolidatedView/>}
        </>)}
      </div>
    </div>
    {toast&&<Toast msg={toast.msg} type={toast.type} onDone={()=>setToast(null)}/>}
    </>
  );
}

// ══════════════════════════════════════════════════════════════════
// ⚡ PROPPULSE — Property Intelligence Layer
// ══════════════════════════════════════════════════════════════════