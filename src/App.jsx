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
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@300;400;500;600&display=swap');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'DM Sans',sans-serif;background:#F0F2F5;color:#1a2535}
    ::-webkit-scrollbar{width:5px;height:5px}
    ::-webkit-scrollbar-thumb{background:#C9A84C55;border-radius:10px}
    input,select,textarea{font-family:'DM Sans',sans-serif;outline:none;border:1.5px solid #D1D9E6;border-radius:8px;padding:9px 12px;font-size:13px;color:#1a2535;background:#fff;width:100%;transition:border-color 0.2s}
    input:focus,select:focus,textarea:focus{border-color:#C9A84C}
    input.error,select.error{border-color:#B83232!important;background:#FFF8F8}
    textarea{resize:vertical}
    button{cursor:pointer;font-family:'DM Sans',sans-serif}
    .fade-in{animation:fadeIn 0.25s ease}
    @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
    .slide-in{animation:slideIn 0.2s ease}
    @keyframes slideIn{from{opacity:0;transform:translateX(12px)}to{opacity:1;transform:none}}
    .ch{transition:box-shadow 0.18s,transform 0.18s}
    .ch:hover{box-shadow:0 4px 20px #C9A84C22;transform:translateY(-1px)}
    .dcard{transition:box-shadow 0.15s;cursor:grab}
    .dcard:hover{box-shadow:0 3px 14px #0B1F3A22}
    @keyframes spin{to{transform:rotate(360deg)}}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}

    /* ── MOBILE ──────────────────────────────────────────────── */
    html{-webkit-text-size-adjust:100%;touch-action:manipulation}
    body{overflow-x:hidden}
    @media(max-width:768px){
      .tab-bar{overflow-x:auto!important;-webkit-overflow-scrolling:touch;scrollbar-width:none;flex-wrap:nowrap!important;position:relative}
      .tab-bar::-webkit-scrollbar{display:none}
      .tab-bar-wrap{position:relative}
      .tab-bar-wrap::before,.tab-bar-wrap::after{content:"";position:absolute;top:0;bottom:0;width:32px;pointer-events:none;z-index:10}
      .tab-bar-wrap::before{left:0;background:linear-gradient(to right,#0B1F3A,transparent)}
      .tab-bar-wrap::after{right:0;background:linear-gradient(to left,#0B1F3A,transparent)}
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
  sales:   ["dashboard","projects","builder","leads","pipeline","discounts","activity","ai","reports","pay_plans","companies","users","permissions","permsets","group_view"],
  leasing: ["l_dashboard","l_leads","l_pipeline","l_projects","l_inventory","leasing","l_discounts","l_activity","l_ai","l_reports","l_companies","l_users","l_permissions","l_permsets","l_group_view"],
  both:    ["dashboard","projects","builder","leads","pipeline","leasing","discounts","activity","ai","reports","pay_plans","l_reports","companies","users","permissions"],
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
  WhatsApp:{icon:"💬",c:"#1A7F5A",bg:"#E6F4EE"}, Note:{icon:"📝",c:"#718096",bg:"#F0F2F5"},
};
const ROLE_META = {
  super_admin:    {label:"Super Admin",    color:"#B83232",bg:"#FAEAEA",desc:"All companies · Full access"},
  admin:          {label:"Admin",          color:"#8A6200",bg:"#FDF3DC",desc:"Full access — all modules"},
  sales_manager:  {label:"Sales Manager",  color:"#1A5FA8",bg:"#E6EFF9",desc:"All sales leads · approve discounts ≤5%"},
  sales_agent:    {label:"Sales Agent",    color:"#1A7F5A",bg:"#E6F4EE",desc:"Own sales leads · request discounts"},
  leasing_manager:{label:"Leasing Mgr",   color:"#5B3FAA",bg:"#EEE8F9",desc:"All leases · approve rent reductions ≤5%"},
  leasing_agent:  {label:"Leasing Agent", color:"#0F6E56",bg:"#D4F1E8",desc:"Own leases · manage tenants & payments"},
  viewer:         {label:"Viewer",         color:"#718096",bg:"#F0F2F5",desc:"Read-only access"},
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
const Av = ({name,size=36,bg="#0B1F3A",tc="#C9A84C"}) => (
  <div style={{width:size,height:size,borderRadius:"50%",background:bg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:size*0.32,fontWeight:600,color:tc,letterSpacing:"0.5px"}}>{ini(name)}</div>
);
const StageBadge = ({stage}) => {
  const m=STAGE_META[stage]||{c:"#718096",bg:"#F0F2F5"};
  return <span style={{display:"inline-flex",alignItems:"center",gap:4,background:m.bg,color:m.c,fontSize:11,fontWeight:600,padding:"3px 9px",borderRadius:20,whiteSpace:"nowrap"}}><span style={{width:5,height:5,borderRadius:"50%",background:m.c,display:"inline-block"}}/>{stage}</span>;
};
const TypeBadge = ({type}) => {
  const m=TYPE_META[type]||{c:"#718096",bg:"#F0F2F5"};
  return <span style={{fontSize:11,fontWeight:600,padding:"3px 9px",borderRadius:20,background:m.bg,color:m.c}}>{type}</span>;
};
const RoleBadge = ({role}) => {
  const m=ROLE_META[role]||{label:role,color:"#718096",bg:"#F0F2F5"};
  return <span style={{fontSize:11,fontWeight:600,padding:"3px 9px",borderRadius:20,background:m.bg,color:m.color,textTransform:"capitalize"}}>{m.label}</span>;
};
const Btn = ({children,onClick,variant="primary",small=false,full=false,disabled=false,style:st={}}) => {
  const s={primary:{background:"#0B1F3A",color:"#fff",border:"none"},gold:{background:"#C9A84C",color:"#0B1F3A",border:"none"},outline:{background:"#fff",color:"#0B1F3A",border:"1.5px solid #D1D9E6"},danger:{background:"#FAEAEA",color:"#B83232",border:"1.5px solid #F0BCBC"},green:{background:"#E6F4EE",color:"#1A7F5A",border:"1.5px solid #A8D5BE"},wa:{background:"#25D366",color:"#fff",border:"none"}};
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
    <span style={{fontSize:13,color:"#1a2535",fontWeight:500}}>{value||"—"}</span>
  </div>
);
const Modal=({title,onClose,children,width=520})=>(
  <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:"1rem"}}>
    <div className="fade-in" style={{background:"#fff",borderRadius:16,width,maxWidth:"100%",maxHeight:"90vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(11,31,58,0.3)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"1.25rem 1.5rem",borderBottom:"1px solid #E2E8F0",position:"sticky",top:0,background:"#fff",zIndex:1}}>
        <span style={{fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:700,color:"#0B1F3A"}}>{title}</span>
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
const DiscBadge=({status})=>{const C={Pending:{c:"#A06810",bg:"#FDF3DC"},Approved:{c:"#1A7F5A",bg:"#E6F4EE"},Rejected:{c:"#B83232",bg:"#FAEAEA"},Escalated:{c:"#5B3FAA",bg:"#EEE8F9"}};const m=C[status]||{c:"#718096",bg:"#F0F2F5"};return <Badge label={status} c={m.c} bg={m.bg}/>;};
const Toast=({msg,type="success",onDone})=>{
  useEffect(()=>{const t=setTimeout(onDone,3500);return()=>clearTimeout(t)},[]);
  const colors={success:["#E6F4EE","#1A7F5A"],error:["#FAEAEA","#B83232"],info:["#E6EFF9","#1A5FA8"],warning:["#FDF3DC","#A06810"]};
  const[bg,c]=colors[type]||colors.info;
  return <div style={{position:"fixed",bottom:24,right:24,zIndex:9999,background:bg,color:c,border:`1.5px solid ${c}33`,borderRadius:10,padding:"12px 18px",fontSize:13,fontWeight:600,boxShadow:"0 4px 20px rgba(0,0,0,0.12)",maxWidth:360}}>{type==="success"?"✓ ":type==="error"?"✕ ":type==="warning"?"⚠ ":"ℹ "}{msg}</div>;
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
  return <div style={{marginTop:6}}><div style={{height:4,background:"#F0F2F5",borderRadius:4,overflow:"hidden"}}><div style={{width:`${s.pct}%`,height:"100%",background:s.color,borderRadius:4,transition:"width 0.3s"}}/></div><div style={{fontSize:11,color:s.color,fontWeight:600,marginTop:4}}>{s.label} password</div></div>;
};
const AuthWrap=({children})=>(
  <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#0B1F3A 0%,#1A3558 60%,#0B1F3A 100%)",display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem"}}>
    <div className="fade-in" style={{background:"#fff",borderRadius:20,padding:"2.5rem",width:440,maxWidth:"100%",boxShadow:"0 30px 80px rgba(0,0,0,0.4)"}}>{children}</div>
  </div>
);
const AuthLogo=({sub})=>(
  <div style={{textAlign:"center",marginBottom:28}}>
    <div style={{fontFamily:"'Playfair Display',serif",fontSize:32,fontWeight:700,color:"#0B1F3A"}}><span style={{color:"#C9A84C"}}>◆</span> PropCRM</div>
    <div style={{fontSize:13,color:"#A0AEC0",marginTop:6}}>{sub}</div>
  </div>
);
const ErrBox=({msg})=>msg?<div style={{background:"#FAEAEA",color:"#B83232",border:"1.5px solid #F0BCBC",borderRadius:8,padding:"10px 14px",fontSize:13,marginBottom:16,lineHeight:1.5}}>{msg}</div>:null;
const AuthTabs=({mode,setMode})=>(
  <div style={{display:"flex",background:"#F0F2F5",borderRadius:10,padding:4,marginBottom:24}}>
    {[["login","Sign In"],["signup","Create Account"]].map(([m,label])=>(
      <button key={m} onClick={()=>setMode(m)} style={{flex:1,padding:"8px 0",borderRadius:8,border:"none",background:mode===m?"#fff":"transparent",color:mode===m?"#0B1F3A":"#A0AEC0",fontSize:13,fontWeight:mode===m?600:400,cursor:"pointer",transition:"all 0.2s",boxShadow:mode===m?"0 1px 4px rgba(0,0,0,0.08)":"none"}}>{label}</button>
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
        // Profile missing — create it automatically
        const meta = data.user.user_metadata||{};
        const newProf = {
          id:             data.user.id,
          full_name:      meta.full_name || data.user.email?.split("@")[0] || "Admin",
          email:          data.user.email,
          role:           "super_admin",
          is_super_admin: true,
          is_active:      true,
        };
        const ins = await supabase.from("profiles").upsert(newProf, {onConflict:"id"}).select().maybeSingle();
        profile = ins.data || newProf; // fall back to local object if RLS blocks insert
      }

      if(!profile){
        setError("Profile not found. Run the SQL fix in Supabase and try again.");
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
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:700,color:"#0B1F3A",marginBottom:10}}>Check your inbox</div>
        <div style={{fontSize:14,color:"#4A5568",lineHeight:1.8,marginBottom:6}}>We sent a confirmation email to:</div>
        <div style={{fontSize:15,fontWeight:700,color:"#0B1F3A",marginBottom:20}}>{email}</div>
        <div style={{fontSize:13,color:"#718096",lineHeight:1.8,marginBottom:28,padding:"14px",background:"#F7F9FC",borderRadius:10,border:"1px solid #E2E8F0",textAlign:"left"}}>
          <strong>What to do:</strong><br/>1. Open the email from Supabase<br/>2. Click the <strong>"Confirm your email"</strong> link<br/>3. Come back here and sign in<br/><br/><span style={{color:"#A0AEC0"}}>Can't find it? Check Spam/Junk.</span>
        </div>
        <Btn full onClick={()=>{setMode("login");setPw("");setPw2("");reset();}} style={{marginBottom:12}}>→ Go to Sign In</Btn>
        <button onClick={async()=>{setLoading(true);await supabase.auth.resend({type:"signup",email});setLoading(false);alert("Resent!");}} style={{background:"none",border:"none",color:"#A0AEC0",fontSize:12,cursor:"pointer",textDecoration:"underline"}}>{loading?"Sending…":"Resend confirmation email"}</button>
      </div>
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
      <div style={{textAlign:"center",marginTop:18}}><span style={{fontSize:13,color:"#A0AEC0"}}>New to PropCRM? </span><button onClick={()=>{setMode("signup");setError("");setPw("");}} style={{background:"none",border:"none",color:"#C9A84C",fontSize:13,fontWeight:600,cursor:"pointer",textDecoration:"underline"}}>Create an account</button></div>
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

  const STATUS_COLORS={Available:{c:"#1A7F5A",bg:"#E6F4EE"},Reserved:{c:"#A06810",bg:"#FDF3DC"},"Under Offer":{c:"#B85C10",bg:"#FDF0E6"},Sold:{c:"#B83232",bg:"#FAEAEA"},Blocked:{c:"#718096",bg:"#F0F2F5"}};

  const ColHeader=({title,count,onAdd,icon})=>(
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",background:"#0B1F3A",borderRadius:"10px 10px 0 0"}}>
      <div>
        <div style={{fontSize:13,fontWeight:700,color:"#fff"}}>{icon} {title}</div>
        <div style={{fontSize:11,color:"#C9A84C"}}>{count} item{count!==1?"s":""}</div>
      </div>
      {canEdit&&<button onClick={onAdd} style={{background:"#C9A84C",color:"#0B1F3A",border:"none",borderRadius:6,padding:"5px 10px",fontSize:12,fontWeight:700,cursor:"pointer"}}>+ Add</button>}
    </div>
  );

  if(loading)return <Spinner msg="Loading property database…"/>;

  return(
    <div className="fade-in" style={{display:"flex",flexDirection:"column",height:"100%"}}>
      {/* Breadcrumb */}
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:14,fontSize:13,flexWrap:"wrap"}}>
        <span style={{fontWeight:600,color:"#0B1F3A",cursor:"pointer",textDecoration:selProject?"underline":"none"}} onClick={()=>{setSelProject(null);setSelCategory(null);setSelBuilding(null);setSelUnit(null);}}>All Projects</span>
        {selProject&&<><span style={{color:"#A0AEC0"}}>›</span><span style={{fontWeight:600,color:"#0B1F3A",cursor:"pointer",textDecoration:selCategory?"underline":"none"}} onClick={()=>{setSelCategory(null);setSelBuilding(null);setSelUnit(null);}}>{selProject.name}</span></>}
        {selCategory&&<><span style={{color:"#A0AEC0"}}>›</span><span style={{fontWeight:600,color:"#0B1F3A",cursor:"pointer",textDecoration:selBuilding?"underline":"none"}} onClick={()=>{setSelBuilding(null);setSelUnit(null);}}>{selCategory.name}</span></>}
        {selBuilding&&<><span style={{color:"#A0AEC0"}}>›</span><span style={{fontWeight:600,color:"#0B1F3A"}}>{selBuilding.name}</span></>}
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
                style={{padding:"10px 14px",borderBottom:"1px solid #F0F2F5",cursor:"pointer",background:selProject?.id===p.id?"#0B1F3A":"#fff",transition:"background 0.15s"}}>
                <div style={{fontWeight:600,fontSize:13,color:selProject?.id===p.id?"#fff":"#0B1F3A"}}>{p.name}</div>
                <div style={{fontSize:11,color:selProject?.id===p.id?"#C9A84C":"#A0AEC0",marginTop:2}}>{p.developer||"—"} · {p.location||"—"}</div>
                <div style={{display:"flex",gap:6,marginTop:5,alignItems:"center",justifyContent:"space-between"}}>
                  <span style={{fontSize:10,fontWeight:600,padding:"2px 7px",borderRadius:10,background:p.status==="Active"?"#E6F4EE":"#F0F2F5",color:p.status==="Active"?"#1A7F5A":"#718096"}}>{p.status}</span>
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
                style={{padding:"10px 14px",borderBottom:"1px solid #F0F2F5",cursor:"pointer",background:selCategory?.id===c.id?"#0B1F3A":"#fff"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div>
                    <div style={{fontWeight:600,fontSize:13,color:selCategory?.id===c.id?"#fff":"#0B1F3A"}}>{c.name}</div>
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
                style={{padding:"10px 14px",borderBottom:"1px solid #F0F2F5",cursor:"pointer",background:selBuilding?.id===b.id?"#0B1F3A":"#fff"}}>
                <div style={{fontWeight:600,fontSize:13,color:selBuilding?.id===b.id?"#fff":"#0B1F3A"}}>{b.name}</div>
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
              const sc=STATUS_COLORS[u.status]||{c:"#718096",bg:"#F0F2F5"};
              const isSel=selUnit?.id===u.id;
              return(
                <div key={u.id} onClick={()=>setSelUnit(isSel?null:u)}
                  style={{padding:"10px 14px",borderBottom:"1px solid #F0F2F5",cursor:"pointer",background:isSel?"#FDF3DC":"#fff",borderLeft:isSel?"3px solid #C9A84C":"3px solid transparent"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <div style={{fontWeight:700,fontSize:13,color:"#0B1F3A"}}>Unit {u.unit_number}</div>
                    <span style={{fontSize:10,fontWeight:600,padding:"2px 7px",borderRadius:10,background:sc.bg,color:sc.c}}>{u.status}</span>
                  </div>
                  {u.bedrooms&&<div style={{fontSize:11,color:"#718096",marginTop:2}}>{u.bedrooms}BR · {u.view||"No view"} · Floor {u.floor||"—"}</div>}
                  <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
                    <div style={{fontSize:12,fontWeight:700,color:"#0B1F3A",fontFamily:"'Playfair Display',serif"}}>{fmtAED(u.base_price)}</div>
                    {u.price_per_sqft&&<div style={{fontSize:11,color:"#1A7F5A",fontWeight:600}}>AED {u.price_per_sqft.toLocaleString()}/sqft</div>}
                  </div>
                  {isSel&&(
                    <div style={{marginTop:10,padding:"10px",background:"#fff",borderRadius:8,border:"1px solid #E8C97A"}}>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:8}}>
                        {[["Size",`${u.size_sqft||0} sqft`],["Balcony",`${u.balcony_sqft||0} sqft`],["Service Chg",u.service_charge_per_sqft?`AED ${u.service_charge_per_sqft}/sqft`:"—"],["Payment",u.payment_plan||"—"],["Handover",fmtDate(u.handover_date)],["Bathrooms",u.bathrooms||"—"]].map(([l,v])=>(
                          <div key={l}><div style={{fontSize:9,color:"#A0AEC0",textTransform:"uppercase",letterSpacing:"0.5px"}}>{l}</div><div style={{fontSize:12,fontWeight:600,color:"#0B1F3A"}}>{v}</div></div>
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
  Cancelled: { c:"#718096", bg:"#F0F2F5" },
};


// ══════════════════════════════════════════════════════════════════
// OPPORTUNITY DETAIL — full workflow per opportunity
// ══════════════════════════════════════════════════════════════════
const OPP_STAGES = ["New","Contacted","Site Visit","Proposal Sent","Negotiation","Closed Won","Closed Lost"];
const OPP_STAGE_META = {
  "New":           {c:"#718096", bg:"#F0F2F5"},
  "Contacted":     {c:"#1A5FA8", bg:"#E6EFF9"},
  "Site Visit":    {c:"#5B3FAA", bg:"#EEE8F9"},
  "Proposal Sent": {c:"#A06810", bg:"#FDF3DC"},
  "Negotiation":   {c:"#B83232", bg:"#FAEAEA"},
  "Closed Won":    {c:"#1A7F5A", bg:"#E6F4EE"},
  "Closed Lost":   {c:"#718096", bg:"#F0F2F5"},
};

function OpportunityDetail({ opp, lead, units, projects, salePricing, users, currentUser, showToast, onBack, onUpdated }) {
  const [activeTab,  setActiveTab]  = useState("details");
  const [activities, setActivities] = useState([]);
  const [payments,   setPayments]   = useState([]);
  const [contract,   setContract]   = useState(null);
  const [saving,     setSaving]     = useState(false);
  const [showLog,    setShowLog]    = useState(false);
  const [showPayment,setShowPayment]= useState(false);
  const [showEmail,  setShowEmail]  = useState(false);
  const [logForm,    setLogForm]    = useState({type:"Call",note:""});
  const [payForm,    setPayForm]    = useState({milestone:"Booking Deposit",amount:"",percentage:"",due_date:"",payment_type:"Cheque",cheque_number:"",cheque_date:"",bank_name:"",status:"Pending",notes:"",cheque_file_url:""});
  const [emailForm,  setEmailForm]  = useState({to:"",subject:"",body:""});
  const [editPayment,setEditPayment]= useState(null);
  const canEdit  = can(currentUser.role,"write");
  const isWon    = opp.stage==="Closed Won";
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

  const moveStage = async(toStage)=>{
    // Cannot go back from Proposal Sent+
    const curIdx = OPP_STAGES.indexOf(opp.stage);
    const toIdx  = OPP_STAGES.indexOf(toStage);
    if(["Proposal Sent","Negotiation","Closed Won"].includes(opp.stage) && toIdx<curIdx && toStage!=="Closed Lost"){
      showToast(`Cannot go back from ${opp.stage}`,"error"); return;
    }
    if(toStage==="Proposal Sent"){
      showToast("Use 📤 Send Proposal to move to this stage","error"); return;
    }
    const newStatus = toStage==="Closed Won"?"Won":toStage==="Closed Lost"?"Lost":"Active";
    const extra = toStage==="Closed Won"?{won_at:new Date().toISOString()}:toStage==="Closed Lost"?{lost_at:new Date().toISOString()}:{};
    const{error}=await supabase.from("opportunities").update({stage:toStage,status:newStatus,stage_updated_at:new Date().toISOString(),...extra}).eq("id",opp.id);
    if(!error){
      onUpdated({...opp,stage:toStage,status:newStatus,...extra});
      // Mark unit Sold if Won
      if(toStage==="Closed Won"&&opp.unit_id) await supabase.from("project_units").update({status:"Sold"}).eq("id",opp.unit_id);
    }
  };

  const saveLog = async()=>{
    if(!logForm.note.trim()){showToast("Note required","error");return;}
    setSaving(true);
    const{data,error}=await supabase.from("activities").insert({
      opportunity_id:opp.id, lead_id:lead.id,
      type:logForm.type, note:logForm.note,
      user_id:currentUser.id, user_name:currentUser.full_name,
      lead_name:lead.name, company_id:currentUser.company_id||null,
    }).select().single();
    if(!error){setActivities(p=>[data,...p]);showToast("Activity logged","success");setShowLog(false);setLogForm({type:"Call",note:""});}
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
    .hdr{background:#0B1F3A;color:#fff;padding:20px;border-radius:8px 8px 0 0;text-align:center}
    .logo{font-size:20px;font-weight:700;color:#C9A84C}.bdy{border:1px solid #E2E8F0;border-top:none;padding:20px;border-radius:0 0 8px 8px}
    .amt{font-size:30px;font-weight:700;color:#0B1F3A;text-align:center;padding:16px 0;border-bottom:2px solid #0B1F3A;margin-bottom:16px}
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
            <span style={{fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:700,color:"#0B1F3A"}}>{opp.title||`Opportunity — ${lead.name}`}</span>
            <span style={{padding:"3px 10px",borderRadius:20,background:sm.bg,color:sm.c,fontSize:11,fontWeight:700}}>{opp.stage}</span>
            {opp.status==="On Hold"&&<span style={{padding:"3px 10px",borderRadius:20,background:"#F0F2F5",color:"#718096",fontSize:11,fontWeight:600}}>On Hold</span>}
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
          {canEdit&&<button onClick={()=>setShowLog(true)} style={{padding:"6px 14px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>+ Activity</button>}
        </div>
      </div>

      {/* Summary strip */}
      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
        {[
          ["💰 Budget",    opp.budget?`AED ${Number(opp.budget).toLocaleString()}`:"—",    "#0B1F3A","#C9A84C"],
          ["🏠 Unit",      unit?`${unit.unit_ref} — ${unit.sub_type}`:"Not linked",         "#F7F9FC","#4A5568"],
          ["👤 Agent",     agent?.full_name||"Unassigned",                                  "#F7F9FC","#4A5568"],
          ["📊 Payments",  totalDue>0?`${totalPaid/totalDue*100|0}% collected`:"No payments","#F7F9FC","#4A5568"],
          opp.final_price&&["✅ Final",`AED ${Number(opp.final_price).toLocaleString()}`,"#E6F4EE","#1A7F5A"],
        ].filter(Boolean).map(([l,v,bg,col])=>(
          <div key={l} style={{background:bg,borderRadius:8,padding:"8px 14px",flex:1,minWidth:120}}>
            <div style={{fontSize:9,color:bg==="#0B1F3A"?"rgba(255,255,255,.5)":"#A0AEC0",textTransform:"uppercase",letterSpacing:".5px",fontWeight:600,marginBottom:3}}>{l}</div>
            <div style={{fontSize:13,fontWeight:700,color:col,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{v}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:4,marginBottom:14,borderBottom:"1px solid #E2E8F0"}}>
        {[
          {id:"details",  label:"Details",   locked:false},
          {id:"activities",label:`Activities${activities.length>0?` (${activities.length})`:""}`,locked:false},
          {id:"payments", label:`Payments${payments.length>0?` (${payments.length})`:""}`, locked:!isWon, lockMsg:"Unlocks at Closed Won"},
          {id:"contract", label:`Contract${contract?" ✓":""}`,  locked:!isWon, lockMsg:"Unlocks at Closed Won"},
        ].map(({id,label,locked,lockMsg})=>(
          <button key={id} onClick={()=>{if(locked){showToast(`${lockMsg}`,"error");return;}setActiveTab(id);}}
            style={{padding:"8px 16px",borderRadius:"8px 8px 0 0",border:"none",borderBottom:activeTab===id?"2.5px solid #0B1F3A":"2.5px solid transparent",background:"transparent",fontSize:13,fontWeight:activeTab===id?700:400,color:locked?"#CBD5E0":activeTab===id?"#0B1F3A":"#718096",cursor:locked?"not-allowed":"pointer",display:"flex",alignItems:"center",gap:4}}>
            {locked&&"🔒 "}{label}
          </button>
        ))}
      </div>

      <div style={{flex:1,overflowY:"auto"}}>

        {/* ── DETAILS TAB ── */}
        {activeTab==="details"&&(
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            {/* Workflow bar */}
            <div style={{background:"linear-gradient(135deg,#0B1F3A,#1A3558)",borderRadius:12,padding:"14px 16px"}}>
              <div style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,.4)",textTransform:"uppercase",letterSpacing:".6px",marginBottom:10}}>Deal Workflow</div>
              <div style={{display:"flex",alignItems:"center",overflowX:"auto",gap:0}}>
                {OPP_STAGES.filter(s=>s!=="Closed Lost").map((s,i,arr)=>{
                  const curIdx=OPP_STAGES.indexOf(opp.stage);
                  const thisIdx=OPP_STAGES.indexOf(s);
                  const isDone=curIdx>thisIdx;
                  const isCur=opp.stage===s;
                  return (
                    <div key={s} style={{display:"flex",alignItems:"center",flexShrink:0}}>
                      <div onClick={()=>moveStage(s)}
                        style={{padding:"5px 12px",borderRadius:20,background:isCur?"#C9A84C":isDone?"rgba(26,127,90,.3)":"rgba(255,255,255,.08)",color:isCur?"#0B1F3A":isDone?"#4ADE80":"rgba(255,255,255,.4)",fontSize:11,fontWeight:isCur||isDone?700:400,cursor:"pointer",whiteSpace:"nowrap",transition:"all .15s"}}>
                        {isDone?"✓ ":""}{s}
                      </div>
                      {i<arr.length-1&&<div style={{width:16,height:1,background:"rgba(255,255,255,.1)",flexShrink:0}}/>}
                    </div>
                  );
                })}
                <div style={{width:16,height:1,background:"rgba(255,255,255,.1)",flexShrink:0}}/>
                <div onClick={()=>moveStage("Closed Lost")}
                  style={{padding:"5px 12px",borderRadius:20,background:opp.stage==="Closed Lost"?"#B83232":"rgba(255,255,255,.05)",color:opp.stage==="Closed Lost"?"#fff":"rgba(255,255,255,.3)",fontSize:11,fontWeight:opp.stage==="Closed Lost"?700:400,cursor:"pointer",whiteSpace:"nowrap"}}>
                  ✗ Lost
                </div>
              </div>
              {isWon&&<div style={{marginTop:10,padding:"6px 10px",background:"rgba(201,168,76,.15)",borderRadius:6,fontSize:11,color:"#C9A84C",fontWeight:600}}>🎉 Won — Payments and Contract are unlocked</div>}
            </div>

            {/* Unit details */}
            <div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:12,padding:"16px"}}>
              <div style={{fontSize:11,fontWeight:700,color:"#A0AEC0",textTransform:"uppercase",letterSpacing:".6px",marginBottom:12}}>Property</div>
              {unit?(
                <div style={{display:"flex",gap:12,alignItems:"flex-start",flexWrap:"wrap"}}>
                  <div style={{flex:1,minWidth:200}}>
                    <div style={{fontWeight:700,fontSize:15,color:"#0B1F3A",marginBottom:4}}>{unit.unit_ref} — {unit.sub_type}</div>
                    <div style={{fontSize:12,color:"#718096",marginBottom:6}}>{proj?.name||"—"} · Floor {unit.floor_number||"—"} · {unit.view||"—"} · {unit.size_sqft?`${Number(unit.size_sqft).toLocaleString()} sqft`:""}</div>
                    {sp&&<div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,color:"#1A5FA8"}}>AED {Number(sp.asking_price).toLocaleString()}</div>}
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,minWidth:200}}>
                    {[["Beds",unit.bedrooms===0?"Studio":unit.bedrooms||"—"],["Baths",unit.bathrooms||"—"],["Sqft",unit.size_sqft?Number(unit.size_sqft).toLocaleString():"—"],["Status",unit.status]].map(([l,v])=>(
                      <div key={l} style={{background:"#FAFBFC",borderRadius:8,padding:"8px 10px"}}>
                        <div style={{fontSize:9,color:"#A0AEC0",textTransform:"uppercase",letterSpacing:".5px",marginBottom:2}}>{l}</div>
                        <div style={{fontSize:12,fontWeight:600,color:"#0B1F3A"}}>{v}</div>
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
              <div style={{fontSize:11,fontWeight:700,color:"#A0AEC0",textTransform:"uppercase",letterSpacing:".6px",marginBottom:12}}>Financials</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10}}>
                {[["Budget",opp.budget],["Offer Price",opp.offer_price],["Final Price",opp.final_price],["Discount %",opp.discount_pct?opp.discount_pct+"%":null]].filter(([,v])=>v).map(([l,v])=>(
                  <div key={l} style={{background:"#FAFBFC",borderRadius:8,padding:"10px 12px"}}>
                    <div style={{fontSize:9,color:"#A0AEC0",textTransform:"uppercase",letterSpacing:".5px",marginBottom:2}}>{l}</div>
                    <div style={{fontSize:13,fontWeight:700,color:"#0B1F3A"}}>{typeof v==="number"?`AED ${Number(v).toLocaleString()}`:v}</div>
                  </div>
                ))}
              </div>
            </div>

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
            <button onClick={()=>setShowLog(true)} style={{alignSelf:"flex-end",padding:"7px 16px",borderRadius:8,border:"none",background:"#0B1F3A",color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>+ Log Activity</button>
            {activities.length===0&&<div style={{textAlign:"center",padding:"2.5rem",color:"#A0AEC0"}}>No activities yet — log a call, email or meeting</div>}
            {activities.map(a=>{
              const icons={Call:"📞",Email:"✉",Meeting:"🤝",Visit:"🏠",WhatsApp:"💬",Note:"📝"};
              return (
                <div key={a.id} style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:10,padding:"12px 14px",display:"flex",gap:10}}>
                  <div style={{width:32,height:32,borderRadius:"50%",background:"#F0F2F5",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,flexShrink:0}}>{icons[a.type]||"📋"}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                      <span style={{fontSize:12,fontWeight:600,color:"#0B1F3A"}}>{a.type}</span>
                      <span style={{fontSize:11,color:"#A0AEC0"}}>{fmtDT(a.created_at)}</span>
                    </div>
                    <div style={{fontSize:12,color:"#4A5568",lineHeight:1.5,whiteSpace:"pre-wrap"}}>{a.note}</div>
                    <div style={{fontSize:11,color:"#A0AEC0",marginTop:4}}>{a.user_name}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── PAYMENTS TAB ── */}
        {activeTab==="payments"&&(
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {!isWon?(
              <div style={{textAlign:"center",padding:"3rem",color:"#A0AEC0"}}>
                <div style={{fontSize:40,marginBottom:10}}>🔒</div>
                <div style={{fontSize:14,fontWeight:600,color:"#0B1F3A",marginBottom:6}}>Locked until Closed Won</div>
                <div style={{fontSize:12}}>Mark this opportunity as Won to enable payment tracking</div>
              </div>
            ):(
              <>
                {/* Progress bar */}
                {totalDue>0&&(
                  <div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:10,padding:"14px 16px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                      <span style={{fontSize:12,fontWeight:600,color:"#0B1F3A"}}>AED {totalPaid.toLocaleString()} collected</span>
                      <span style={{fontSize:12,color:"#718096"}}>of AED {totalDue.toLocaleString()}</span>
                    </div>
                    <div style={{background:"#F0F2F5",borderRadius:6,height:10,overflow:"hidden"}}>
                      <div style={{width:`${totalDue>0?totalPaid/totalDue*100:0}%`,height:"100%",background:"#1A7F5A",borderRadius:6,transition:"width .4s"}}/>
                    </div>
                  </div>
                )}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontSize:13,fontWeight:600,color:"#0B1F3A"}}>Payment Schedule ({payments.length})</span>
                  <button onClick={()=>{setPayForm({milestone:"Booking Deposit",amount:"",percentage:"",due_date:"",payment_type:"Cheque",cheque_number:"",cheque_date:"",bank_name:"",status:"Pending",notes:"",cheque_file_url:""});setEditPayment(null);setShowPayment(true);}}
                    style={{padding:"6px 14px",borderRadius:8,border:"none",background:"#0B1F3A",color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>+ Add Payment</button>
                </div>
                {payments.map(pay=>{
                  const pm=PAYMENT_STATUS_META[pay.status]||{c:"#718096",bg:"#F0F2F5"};
                  return (
                    <div key={pay.id} style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:10,padding:"12px 14px"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8}}>
                        <div>
                          <div style={{fontWeight:700,fontSize:14,color:"#0B1F3A",marginBottom:2}}>AED {Number(pay.amount).toLocaleString()}</div>
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
                <div style={{fontSize:14,fontWeight:600,color:"#0B1F3A",marginBottom:6}}>Locked until Closed Won</div>
              </div>
            ):contract?(
              <div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:12,padding:"16px"}}>
                <div style={{fontSize:14,fontWeight:700,color:"#0B1F3A",marginBottom:10}}>📄 Sales Contract</div>
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
          <div style={{background:"#fff",borderRadius:16,width:420,maxWidth:"100%",boxShadow:"0 20px 60px rgba(11,31,58,.35)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"1rem 1.5rem",borderBottom:"1px solid #E2E8F0",background:"linear-gradient(135deg,#0B1F3A,#1A3558)"}}>
              <span style={{fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:700,color:"#fff"}}>Log Activity</span>
              <button onClick={()=>setShowLog(false)} style={{background:"none",border:"none",fontSize:20,color:"#C9A84C",cursor:"pointer"}}>×</button>
            </div>
            <div style={{padding:"1.25rem 1.5rem"}}>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
                {["Call","Email","Meeting","Visit","WhatsApp","Note"].map(t=>(
                  <button key={t} onClick={()=>setLogForm(f=>({...f,type:t}))}
                    style={{padding:"5px 12px",borderRadius:20,border:`1.5px solid ${logForm.type===t?"#0B1F3A":"#E2E8F0"}`,background:logForm.type===t?"#0B1F3A":"#fff",color:logForm.type===t?"#fff":"#4A5568",fontSize:11,cursor:"pointer",fontWeight:logForm.type===t?600:400}}>
                    {t}
                  </button>
                ))}
              </div>
              <textarea value={logForm.note} onChange={e=>setLogForm(f=>({...f,note:e.target.value}))} rows={4} placeholder="What happened? Key details…" style={{width:"100%",marginBottom:12}}/>
              <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
                <button onClick={()=>setShowLog(false)} style={{padding:"8px 18px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancel</button>
                <button onClick={saveLog} disabled={saving} style={{padding:"8px 20px",borderRadius:8,border:"none",background:"#0B1F3A",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>{saving?"Saving…":"Save"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Send Proposal Email Modal */}
      {showEmail&&(
        <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,.65)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1100,padding:"1rem"}}>
          <div style={{background:"#fff",borderRadius:16,width:540,maxWidth:"100%",maxHeight:"92vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 24px 64px rgba(11,31,58,.4)"}}>
            <div style={{background:"linear-gradient(135deg,#1A5FA8,#0B1F3A)",padding:"1rem 1.5rem",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
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
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"1rem 1.5rem",borderBottom:"1px solid #E2E8F0",background:"linear-gradient(135deg,#0B1F3A,#1A3558)"}}>
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
              <button onClick={savePayment} disabled={saving} style={{padding:"9px 24px",borderRadius:8,border:"none",background:saving?"#A0AEC0":"#0B1F3A",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>{saving?"Saving…":editPayment?"Save Changes":"Add Payment"}</button>
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
  const [opps,     setOpps]     = useState(globalOppsFromParent); // sync with global
  const [units,    setUnits]    = useState([]);
  const [projects, setProjects] = useState([]);
  const [salePricing,setSalePricing]=useState([]);
  const [showAddOpp, setShowAddOpp]=useState(false);
  const [oppForm,  setOppForm]  = useState({title:"",unit_id:"",budget:"",assigned_to:"",notes:""});
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

  const selLead = leads.find(l=>l.id===selLeadId);
  const leadOpps = selLeadId ? opps.filter(o=>o.lead_id===selLeadId) : [];

  // Filter leads — exclude pure lease leads from Sales CRM
  const visible = (can(currentUser.role,"see_all")?leads:leads.filter(l=>l.assigned_to===currentUser.id))
    .filter(l=>l.property_type!=="Lease");

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
      const payload={...form,company_id:currentUser.company_id||null,created_by:currentUser.id,assigned_to:currentUser.id};
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
        stage:"New",status:"Active",
        created_by:currentUser.id,
      };
      const{data,error}=await supabase.from("opportunities").insert(payload).select().single();
      if(error)throw error;
      setOpps(p=>{const n=[data,...p];setGlobalOpps(n);return n;});
      showToast("Opportunity created","success");
      setShowAddOpp(false);
      setOppForm({title:"",unit_id:"",budget:"",assigned_to:"",notes:""});
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
          {OPP_STAGES.map(s=><option key={s}>{s}</option>)}
        </select>
        <span style={{fontSize:12,color:"#A0AEC0",whiteSpace:"nowrap"}}>{filtered.length}/{visible.length}</span>
        {canEdit&&<button onClick={()=>{setForm(blank);setEditLead(null);setShowAdd(true);}} style={{padding:"8px 18px",borderRadius:8,border:"none",background:"#0B1F3A",color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>+ Add Contact</button>}
      </div>

      {/* Stage summary strip */}
      <div style={{display:"flex",gap:6,marginBottom:12,overflowX:"auto",paddingBottom:4,flexShrink:0}}>
        {["All",...OPP_STAGES.filter(s=>!["Closed Lost"].includes(s))].map(s=>{
          const cnt=s==="All"?filtered.length:filtered.filter(l=>leadBestStage(l.id)===s).length;
          const m=s==="All"?{c:"#0B1F3A",bg:"#F0F2F5"}:OPP_STAGE_META[s]||{c:"#718096",bg:"#F0F2F5"};
          return (
            <button key={s} onClick={()=>setFStage(s)}
              style={{flexShrink:0,padding:"5px 12px",borderRadius:8,border:`1.5px solid ${fStage===s?m.c:"#E2E8F0"}`,background:fStage===s?m.bg:"#fff",color:m.c,fontSize:11,fontWeight:600,cursor:"pointer"}}>
              {s} <span style={{fontWeight:700}}>{cnt}</span>
            </button>
          );
        })}
      </div>

      {/* Lead cards */}
      <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:4}}>
        {filtered.length===0&&<div style={{textAlign:"center",padding:"3rem",color:"#A0AEC0"}}>No contacts found</div>}
        {filtered.map(l=>{
          const lo=opps.filter(o=>o.lead_id===l.id);
          const activeOpps=lo.filter(o=>o.status==="Active");
          const wonOpps=lo.filter(o=>o.status==="Won");
          const bestStage=leadBestStage(l.id);
          const sm2=OPP_STAGE_META[bestStage]||{c:"#718096",bg:"#F0F2F5"};
          const assignedUser=users.find(u=>u.id===l.assigned_to);
          const totalVal=lo.reduce((s,o)=>s+(o.budget||0),0);
          if(fStage!=="All"&&bestStage!==fStage)return null;
          return (
            <div key={l.id} onClick={()=>{setSelLeadId(l.id);setView("lead");}}
              style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:8,padding:"10px 14px",cursor:"pointer",borderLeft:`3px solid ${sm2.c}`,transition:"all .12s"}}
              onMouseOver={e=>{e.currentTarget.style.background="#F7F9FC";e.currentTarget.style.boxShadow="0 2px 8px rgba(0,0,0,.06)";}}
              onMouseOut={e=>{e.currentTarget.style.background="#fff";e.currentTarget.style.boxShadow="none";}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <Av name={l.name} size={32}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                    <span style={{fontWeight:700,fontSize:13,color:"#0B1F3A"}}>{l.name}</span>
                    <span style={{fontSize:10,fontWeight:600,padding:"1px 7px",borderRadius:20,background:sm2.bg,color:sm2.c}}>{bestStage}</span>
                    {wonOpps.length>0&&<span style={{fontSize:10,fontWeight:600,padding:"1px 7px",borderRadius:20,background:"#E6F4EE",color:"#1A7F5A"}}>✓ {wonOpps.length} Won</span>}
                  </div>
                  <div style={{display:"flex",gap:10,fontSize:11,color:"#718096",marginTop:2,flexWrap:"wrap"}}>
                    {l.phone&&<span>{l.phone}</span>}
                    {l.email&&<span>{l.email}</span>}
                    {l.nationality&&<span>🌍 {l.nationality}</span>}
                  </div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontSize:12,fontWeight:700,color:"#0B1F3A"}}>{activeOpps.length} active opp{activeOpps.length!==1?"s":""}</div>
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
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"1rem 1.5rem",borderBottom:"1px solid #E2E8F0",background:"linear-gradient(135deg,#0B1F3A,#1A3558)"}}>
              <span style={{fontFamily:"'Playfair Display',serif",fontSize:16,fontWeight:700,color:"#fff"}}>{editLead?"Edit":"New"} Contact</span>
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
              <button onClick={saveLead} disabled={saving} style={{padding:"9px 24px",borderRadius:8,border:"none",background:saving?"#A0AEC0":"#0B1F3A",color:"#fff",fontSize:13,fontWeight:600,cursor:saving?"not-allowed":"pointer"}}>{saving?"Saving…":editLead?"Save":"Add Contact"}</button>
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
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700,color:"#0B1F3A"}}>{selLead.name}</div>
          <div style={{fontSize:12,color:"#718096"}}>{selLead.phone} {selLead.email?`· ${selLead.email}`:""} {selLead.nationality?`· ${selLead.nationality}`:""}</div>
        </div>
        <div style={{display:"flex",gap:6}}>
          {canEdit&&<button onClick={()=>{setForm({...blank,...selLead});setEditLead(selLead);setShowAdd(true);}} style={{padding:"6px 14px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>✏ Edit</button>}
          {canEdit&&<button onClick={()=>{setOppForm({title:"",unit_id:"",budget:"",assigned_to:currentUser.id,notes:""});setShowAddOpp(true);}} style={{padding:"6px 14px",borderRadius:8,border:"none",background:"#0B1F3A",color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>+ New Opportunity</button>}
        </div>
      </div>

      {/* Contact info strip */}
      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
        {[["📞 Phone",selLead.phone||"—"],["✉ Email",selLead.email||"—"],["🌍 Nationality",selLead.nationality||"—"],["🏷 Source",selLead.source||"—"],["📋 Type",selLead.property_type||"—"]].map(([l,v])=>(
          <div key={l} style={{background:"#F7F9FC",borderRadius:8,padding:"8px 14px",flex:1,minWidth:120}}>
            <div style={{fontSize:9,color:"#A0AEC0",textTransform:"uppercase",letterSpacing:".5px",fontWeight:600,marginBottom:3}}>{l}</div>
            <div style={{fontSize:13,fontWeight:600,color:"#0B1F3A",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v}</div>
          </div>
        ))}
      </div>

      {/* Opportunities */}
      <div style={{fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:700,color:"#0B1F3A",marginBottom:12}}>
        Opportunities ({leadOpps.length})
      </div>
      <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:8}}>
        {leadOpps.length===0&&(
          <div style={{textAlign:"center",padding:"3rem",color:"#A0AEC0"}}>
            <div style={{fontSize:36,marginBottom:10}}>🎯</div>
            <div style={{fontSize:14,fontWeight:600,color:"#0B1F3A",marginBottom:6}}>No opportunities yet</div>
            <div style={{fontSize:12,marginBottom:16}}>Add an opportunity for each property this contact is interested in</div>
            {canEdit&&<button onClick={()=>{setOppForm({title:"",unit_id:"",budget:"",assigned_to:currentUser.id,notes:""});setShowAddOpp(true);}} style={{padding:"10px 24px",borderRadius:8,border:"none",background:"#0B1F3A",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>+ Add First Opportunity</button>}
          </div>
        )}
        {leadOpps.map(opp=>{
          const unit=units.find(u=>u.id===opp.unit_id);
          const proj=unit?projects.find(p=>p.id===unit.project_id):null;
          const sp=unit?salePricing.find(s=>s.unit_id===unit.id):null;
          const sm3=OPP_STAGE_META[opp.stage]||{c:"#718096",bg:"#F0F2F5"};
          const agent=users.find(u=>u.id===opp.assigned_to);
          return (
            <div key={opp.id} onClick={()=>{setSelOpp(opp);setView("opportunity");}}
              style={{background:"#fff",border:"1.5px solid #E2E8F0",borderRadius:12,padding:"14px 16px",cursor:"pointer",borderLeft:`4px solid ${sm3.c}`,transition:"all .12s"}}
              onMouseOver={e=>{e.currentTarget.style.boxShadow="0 4px 16px rgba(0,0,0,.08)";e.currentTarget.style.transform="translateY(-1px)";}}
              onMouseOut={e=>{e.currentTarget.style.boxShadow="none";e.currentTarget.style.transform="none";}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:4}}>
                    <span style={{fontWeight:700,fontSize:14,color:"#0B1F3A"}}>{opp.title||"Opportunity"}</span>
                    <span style={{fontSize:11,fontWeight:600,padding:"2px 9px",borderRadius:20,background:sm3.bg,color:sm3.c}}>{opp.stage}</span>
                    {opp.status==="Won"&&<span style={{fontSize:11,fontWeight:600,padding:"2px 9px",borderRadius:20,background:"#E6F4EE",color:"#1A7F5A"}}>✓ Won</span>}
                    {opp.status==="Lost"&&<span style={{fontSize:11,fontWeight:600,padding:"2px 9px",borderRadius:20,background:"#F0F2F5",color:"#718096"}}>Lost</span>}
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
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"1rem 1.5rem",borderBottom:"1px solid #E2E8F0",background:"linear-gradient(135deg,#0B1F3A,#1A3558)"}}>
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
              <button onClick={saveOpp} disabled={saving} style={{padding:"9px 24px",borderRadius:8,border:"none",background:saving?"#A0AEC0":"#0B1F3A",color:"#fff",fontSize:13,fontWeight:600,cursor:saving?"not-allowed":"pointer"}}>{saving?"Saving…":"Create Opportunity"}</button>
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


function Dashboard({...props}){ return null; }

function Pipeline({...props}){ return null; }

function ActivityLog({...props}){ return null; }

function AIAssistant({...props}){ return null; }

function GroupConsolidatedView({...props}){ return null; }

function ProjectsModule({...props}){ return null; }

function hoursLeft({...props}){ return null; }

function reservationUrgency({...props}){ return null; }

function ReservationBadge({...props}){ return null; }

function ReservationModal({...props}){ return null; }

function ReservationsWidget({...props}){ return null; }

function InventoryModule({...props}){ return null; }

function DiscountApprovals({...props}){ return null; }

function LeasingChequeManager({...props}){ return null; }

function LeasingModule({...props}){ return null; }

function buildContext({...props}){ return null; }

function exportToExcel({...props}){ return null; }

function exportToPDF({...props}){ return null; }

function PaymentPlanTemplates({...props}){ return null; }

function ReportsModule({...props}){ return null; }

function SetupWizard({...props}){ return null; }

function LeasingDashboard({...props}){ return null; }

function UserManagement({...props}){ return null; }

function UsersTab({...props}){ return null; }

function SettingsTab({...props}){ return null; }

function CompaniesModule({...props}){ return null; }

function PermissionSetsModule({...props}){ return null; }

function LeaseOpportunityDetail({...props}){ return null; }

function LeasingLeads({...props}){ return null; }

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
  const[tab,       setTab]       = useState(()=>{
    const lastApp = localStorage.getItem("propccrm_last_app")||"sales";
    return lastApp==="leasing"?"l_dashboard":"dashboard";
  });

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

  useEffect(()=>{
    const restore=async()=>{
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
        setUsers(u.data);
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
          if(activeCo) localStorage.setItem("propccrm_company_cache", JSON.stringify({id:activeCo.id,name:activeCo.name,logo_url:activeCo.logo_url||"",business_type:activeCo.business_type||"",ai_assistant_name:activeCo.ai_assistant_name||""}));
          setCompanies(data);
          const saved=localStorage.getItem("propccrm_company_id");
          const co=saved?data.find(c=>c.id===saved):data[0];
          if(co){setActiveCompanyId(co.id);localStorage.setItem("propccrm_company_id",co.id);}
        }
      });
    }
  };

  const handleLogout=async()=>{await supabase.auth.signOut();setCurrentUser(null);};


  // Global Ctrl+K handler
  useEffect(()=>{
    const handler = e => {
      if((e.ctrlKey||e.metaKey)&&e.key==="k"){ e.preventDefault(); setAiOpen(o=>!o); }
    };
    window.addEventListener("keydown", handler);
    return ()=>window.removeEventListener("keydown", handler);
  },[]);
  const currentApp = activeApp;
  const userRole   = currentUser?.role||"viewer";
  const canSwitch  = ["super_admin","admin","sales_manager","leasing_manager"].includes(userRole);

  if(checking) return(
    <div style={{height:"100dvh",background:"#0B1F3A",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12}}>
      <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:700,color:"#fff"}}><span style={{color:"#C9A84C"}}>◆</span> PropCRM</div>
      <div style={{width:32,height:32,border:"2px solid rgba(255,255,255,.15)",borderTopColor:"#C9A84C",borderRadius:"50%",animation:"spin 1s linear infinite"}}/>
    </div>
  );

  if(!currentUser) return <LoginScreen onLogin={handleLogin}/>;

  const cfg=appConfig||{mode:"both"};
  // Always use currentApp to pick allowed tabs — ignore cfg.mode when app is explicitly selected
  const allowedTabs = currentApp==="leasing" ? MODE_TABS.leasing : (MODE_TABS[cfg.mode]||MODE_TABS.both);
  const visibleTabs=TABS.filter(t=>t.app===currentApp&&t.roles.includes(userRole)&&allowedTabs.includes(t.id));

  return (
    <>
    <GlobalStyle/>
    <div style={{display:"flex",flexDirection:"column",height:"100dvh",background:"#F0F2F5",overflow:"hidden"}}>

      {/* Top bar */}
      <div style={{background:"#0B1F3A",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",padding:"0 1.25rem",height:52,gap:10}}>

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
                  : <div style={{width:36,height:36,borderRadius:8,background:"linear-gradient(135deg,#C9A84C,#E8C97A)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:16,color:"#0B1F3A",flexShrink:0,border:"2px solid rgba(201,168,76,.4)"}}>
                      {co?.name?.charAt(0)||"◆"}
                    </div>
                }
                {/* Company name + type */}
                <div style={{display:"flex",flexDirection:"column",minWidth:0}}>
                  <span style={{fontFamily:"'Playfair Display',serif",fontSize:15,color:"#fff",fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:180,lineHeight:1.2}}>
                    {co?.name||"PropCRM"}
                  </span>
                  {bizLabel&&<span style={{fontSize:9,color:"rgba(201,168,76,.7)",textTransform:"uppercase",letterSpacing:".6px",lineHeight:1.3}}>{bizLabel}</span>}
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
                    {companies.map(c=><option key={c.id} value={c.id} style={{background:"#0B1F3A",color:"#fff"}}>{c.name}</option>)}
                  </select>
                )}
              </div>
            );
          })()}

          {/* CENTRE: CRM Switcher */}
          {canSwitch&&(
            <div style={{display:"flex",background:"rgba(255,255,255,.07)",borderRadius:10,padding:3,gap:3,flexShrink:0}}>
              {[
                {id:"sales",   label:"Sales",   icon:"🏷", accent:"#4A9EE8"},
                {id:"leasing", label:"Leasing", icon:"🔑", accent:"#9B7FD4"},
              ].map(a=>{
                const isActive=currentApp===a.id;
                return (
                  <button key={a.id} onClick={()=>{
                    setActiveApp(a.id);
                    localStorage.setItem("propccrm_last_app",a.id);
                    setTimeout(()=>setTab(a.id==="sales"?"dashboard":"l_dashboard"),50);
                  }} style={{
                    padding:"5px 12px",borderRadius:8,border:"none",
                    background:isActive?"#fff":"transparent",
                    color:isActive?a.accent:"rgba(255,255,255,.5)",
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
              <div style={{fontSize:12,color:"#fff",fontWeight:500,lineHeight:1.2}}>{currentUser.full_name}</div>
              <RoleBadge role={currentUser.role}/>
            </div>
            <Av name={currentUser.full_name||currentUser.email} size={32} bg="#C9A84C" tc="#0B1F3A"/>
            <button onClick={handleLogout} title="Sign out" style={{fontSize:11,color:"rgba(255,255,255,.35)",background:"none",border:"1px solid rgba(255,255,255,.1)",borderRadius:6,padding:"4px 8px",cursor:"pointer",whiteSpace:"nowrap",transition:"color .15s"}}
              onMouseOver={e=>e.currentTarget.style.color="rgba(255,255,255,.8)"}
              onMouseOut={e=>e.currentTarget.style.color="rgba(255,255,255,.35)"}>↩</button>
            {/* PropCRM subtle watermark */}
            <div style={{borderLeft:"1px solid rgba(255,255,255,.1)",paddingLeft:10,display:"flex",alignItems:"center",gap:3}}>
              <span style={{color:"#C9A84C",fontSize:10}}>◆</span>
              <span style={{fontFamily:"'Playfair Display',serif",fontSize:10,color:"rgba(255,255,255,.3)",fontWeight:600,letterSpacing:".5px"}}>PropCRM</span>
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div className="tab-bar-wrap" style={{position:"relative",borderTop:"1px solid rgba(255,255,255,.07)"}}>
        <div className="tab-bar" style={{display:"flex",alignItems:"center",padding:"0 1.25rem",height:38,gap:2,overflowX:"auto"}}>
          {visibleTabs.map(t=>(
            <button key={t.id} onClick={()=>{setTab(t.id);if(t.id==="ai"||t.id==="l_ai")loadAIData();}}
              style={{
                padding:"5px 12px",borderRadius:"6px 6px 0 0",border:"none",
                background:tab===t.id?(currentApp==="sales"?"rgba(74,158,232,.18)":"rgba(155,127,212,.18)"):"transparent",
                color:tab===t.id?"#fff":"rgba(255,255,255,.45)",
                fontSize:12,fontWeight:tab===t.id?600:400,cursor:"pointer",
                whiteSpace:"nowrap",transition:"all .15s",flexShrink:0,
                borderBottom:tab===t.id?`2px solid ${currentApp==="sales"?"#4A9EE8":"#9B7FD4"}`:"2px solid transparent",
              }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Page title */}
      <div style={{padding:"8px 1rem 6px",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
        <div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700,color:"#0B1F3A"}}>{visibleTabs.find(t=>t.id===tab)?.label||""}</div>
          <div style={{fontSize:11,color:"#A0AEC0"}}>{SUBTITLES[tab]||""}</div>
        </div>
      </div>

      {/* Content */}
      <div style={{flex:1,overflowY:"auto",overflowX:"hidden",padding:"0 1rem 1rem",WebkitOverflowScrolling:"touch",minHeight:0}}>
        {(dataLoading&&leads.length===0&&aiUnits.length===0)?<Spinner msg="Loading your data…"/>:(<>

          {/* ── Sales CRM ─────────────────────────────────────── */}
          {tab==="dashboard"   &&<Dashboard leads={leads} opps={opps} properties={properties} activities={activities} currentUser={currentUser} meetings={meetings} followups={followups} crmContext="sales" units={aiUnits} salePricing={aiSalePr} leasePricing={aiLeasePr} onNavigate={setTab}/>}
          {tab==="leads"       &&<Leads leads={leads} setLeads={setLeads} opps={opps} setOpps={setOpps} properties={properties} activities={activities} setActivities={setActivities} discounts={discounts} setDiscounts={setDiscounts} currentUser={currentUser} users={users} showToast={showToast}/>}
          {tab==="projects"    &&<ProjectsModule currentUser={currentUser} showToast={showToast} crmContext="sales" preloadedProjects={aiProjects} preloadedUnits={aiUnits}/>}
          {tab==="builder"     &&<InventoryModule currentUser={currentUser} showToast={showToast} crmContext="sales" preloadedUnits={aiUnits} preloadedProjects={aiProjects} preloadedSalePricing={aiSalePr} preloadedLeasePricing={aiLeasePr} activeCompanyId={activeCompanyId} globalOpps={opps}/>}
          {tab==="pipeline"    &&<Pipeline leads={leads} setLeads={setLeads} opps={opps} setOpps={setOpps} units={aiUnits} projects={aiProjects} users={users} currentUser={currentUser} showToast={showToast}/>}
          {tab==="ai"          &&<AIAssistant leads={leads} units={aiUnits} projects={aiProjects} salePricing={aiSalePr} leasePricing={aiLeasePr} activities={activities} currentUser={currentUser} showToast={showToast}/>}
          {tab==="discounts"   &&<DiscountApprovals discounts={discounts} setDiscounts={setDiscounts} leads={leads} user={currentUser} toast={showToast}/>}
          {tab==="activity"    &&<ActivityLog leads={leads} activities={activities} setActivities={setActivities} currentUser={currentUser} showToast={showToast}/>}
          {tab==="reports"     &&<ReportsModule currentUser={currentUser} showToast={showToast} globalOpps={opps} preloadedUnits={aiUnits} preloadedProjects={aiProjects} preloadedSalePricing={aiSalePr} preloadedLeasePricing={aiLeasePr} preloadedUsers={users}/>}
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
          {tab==="l_dashboard" &&<LeasingDashboard currentUser={currentUser} activities={activities} units={aiUnits} salePricing={aiSalePr} leasePricing={aiLeasePr} leasingData={leasingData} onNavigate={setTab} followupAlerts={followupAlerts} key="l_dash"/>}
          {tab==="l_leads"     &&<LeasingLeads currentUser={currentUser} showToast={showToast} users={users}/>}
          {tab==="l_pipeline"  &&<LeasingLeads currentUser={currentUser} showToast={showToast} users={users} defaultView="pipeline"/>}
          {tab==="l_projects"  &&<ProjectsModule currentUser={currentUser} showToast={showToast} crmContext="leasing" preloadedProjects={aiProjects} preloadedUnits={aiUnits}/>}
          {tab==="l_inventory" &&<InventoryModule currentUser={currentUser} showToast={showToast} crmContext="leasing" preloadedUnits={aiUnits} preloadedProjects={aiProjects} preloadedSalePricing={aiSalePr} preloadedLeasePricing={aiLeasePr} activeCompanyId={activeCompanyId} globalOpps={opps}/>}
          {tab==="leasing"     &&<LeasingModule currentUser={currentUser} showToast={showToast} leasingData={leasingData} setLeasingData={setLeasingData}/>}
          {tab==="l_ai"        &&<AIAssistant leads={leads} units={aiUnits} projects={aiProjects} salePricing={aiSalePr} leasePricing={aiLeasePr} activities={activities} currentUser={currentUser} showToast={showToast}/>}
          {tab==="l_discounts" &&<DiscountApprovals discounts={discounts} setDiscounts={setDiscounts} leads={leads} user={currentUser} toast={showToast}/>}
          {tab==="l_activity"  &&<ActivityLog leads={leads} activities={activities} setActivities={setActivities} currentUser={currentUser} showToast={showToast}/>}
          {tab==="l_reports"   &&<ReportsModule currentUser={currentUser} showToast={showToast} globalOpps={opps} leasingData={leasingData} crmContext="leasing" preloadedUnits={aiUnits} preloadedProjects={aiProjects} preloadedSalePricing={aiSalePr} preloadedLeasePricing={aiLeasePr} preloadedUsers={users}/>}
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
