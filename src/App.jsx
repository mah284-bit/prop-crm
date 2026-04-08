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
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:24,fontWeight:700,color:"#0B1F3A",lineHeight:1}}>{value}</div>
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
      <div style={{background:"linear-gradient(135deg,#0B1F3A 0%,#1A3558 100%)",borderRadius:14,padding:"1.25rem 1.5rem",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
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
        <SC label="Active Opps"      value={active.length}         sub={`${won.length} won this period`}   accent="#0B1F3A"  icon="🎯"  onClick={()=>onNavigate("leads")}/>
        <SC label="Won Value"        value={fmtM(wonVal)}          sub={`${won.length} deals closed`}      accent="#1A7F5A"  icon="🏆"  onClick={()=>onNavigate("leads")}/>
        <SC label="Available Units"  value={availUnits.length}     sub={`${ctxUnits.length} total`}        accent="#C9A84C"  icon="🏠"  onClick={()=>onNavigate("builder")}/>
        <SC label="Reserved"         value={reservedUnits.length}  sub="Pending confirmation"              accent="#A06810"  icon="🔒"  onClick={()=>onNavigate("builder")} badge={reservedUnits.length>0?reservedUnits.length:null}/>
      </div>

      {/* ── Stage Pipeline ──────────────────────────────────── */}
      <div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:12,padding:"16px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:14,fontWeight:700,color:"#0B1F3A"}}>Opportunities by Stage</div>
          <button onClick={()=>onNavigate("pipeline")} style={{fontSize:12,color:"#1A5FA8",background:"none",border:"none",cursor:"pointer",fontWeight:600}}>Kanban Board →</button>
        </div>
        {OPP_STAGES.filter(s=>!["Closed Won","Closed Lost"].includes(s)).map(s=>{
          const cnt=visibleOpps.filter(o=>o.stage===s&&o.status==="Active").length;
          const val=visibleOpps.filter(o=>o.stage===s&&o.status==="Active").reduce((a,o)=>a+(o.budget||0),0);
          const m=OPP_STAGE_META[s]||{c:"#718096",bg:"#F0F2F5"};
          const maxCnt=Math.max(...OPP_STAGES.map(st=>visibleOpps.filter(o=>o.stage===st).length),1);
          return (
            <div key={s} onClick={()=>onNavigate("leads")} style={{marginBottom:10,cursor:"pointer"}}
              onMouseOver={e=>e.currentTarget.style.opacity=".85"} onMouseOut={e=>e.currentTarget.style.opacity="1"}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:11,fontWeight:600,padding:"1px 8px",borderRadius:20,background:m.bg,color:m.c}}>{s}</span>
                  <span style={{fontSize:12,fontWeight:700,color:"#0B1F3A"}}>{cnt}</span>
                </div>
                {val>0&&<span style={{fontSize:11,color:"#718096"}}>AED {fmtM(val)}</span>}
              </div>
              <div style={{background:"#F0F2F5",borderRadius:6,height:8,overflow:"hidden"}}>
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
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:14,fontWeight:700,color:"#0B1F3A"}}>Recent Activity</div>
            <button onClick={()=>onNavigate("activity")} style={{fontSize:12,color:"#1A5FA8",background:"none",border:"none",cursor:"pointer",fontWeight:600}}>View All →</button>
          </div>
          {recent.length===0&&<div style={{textAlign:"center",padding:"1.5rem",color:"#A0AEC0",fontSize:12}}>No activity yet</div>}
          {recent.map(a=>{
            const icons={Call:"📞",Email:"✉",Meeting:"🤝",Visit:"🏠",WhatsApp:"💬",Note:"📝"};
            return (
              <div key={a.id} style={{display:"flex",gap:10,padding:"8px 0",borderBottom:"1px solid #F7F9FC",cursor:"pointer"}}
                onClick={()=>onNavigate("leads")}
                onMouseOver={e=>e.currentTarget.style.background="#F7F9FC"} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                <div style={{width:28,height:28,borderRadius:"50%",background:"#F0F2F5",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0}}>{icons[a.type]||"📋"}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:600,color:"#0B1F3A",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.type} — {a.lead_name||"Lead"}</div>
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
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:13,fontWeight:700,color:"#0B1F3A",marginBottom:10}}>Quick Actions</div>
            {[
              {icon:"👤",label:"Add New Lead",       tab:"leads",    bg:"#0B1F3A",col:"#C9A84C"},
              {icon:"🏠",label:"View Inventory",     tab:"builder",  bg:"#1A5FA8",col:"#fff"},
              {icon:"📋",label:"Pipeline Board",     tab:"pipeline", bg:"#5B3FAA",col:"#fff"},
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
          <div style={{background:"#0B1F3A",borderRadius:12,padding:"14px"}}>
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

function Pipeline({leads,setLeads,currentUser,showToast}){
  const canEdit = can(currentUser.role,"write");
  const visible = can(currentUser.role,"see_all")?leads:leads.filter(l=>l.assigned_to===currentUser.id);
  const [selCard, setSelCard] = useState(null);
  const [fStageP, setFStageP] = useState("All");
  const [searchP,  setSearchP]  = useState("");

  const moveStage = async(lead, toStage)=>{
    if(!canEdit){ showToast("You don't have permission to move leads","error"); return; }
    const{error}=await supabase.from("leads").update({stage:toStage,stage_updated_at:new Date().toISOString()}).eq("id",lead.id);
    if(error){showToast(error.message,"error");return;}
    setLeads(p=>p.map(l=>l.id===lead.id?{...l,stage:toStage}:l));
    if(selCard?.id===lead.id) setSelCard(s=>({...s,stage:toStage}));
    showToast(`Moved to ${toStage}`,"success");
  };

  const stageOrder = STAGES.filter(s=>s!=="Closed Lost");
  const active = visible.filter(l=>!["Closed Won","Closed Lost"].includes(l.stage));
  const filtered = active.filter(l=>{
    const q=searchP.toLowerCase();
    return (!q||l.name?.toLowerCase().includes(q)||l.phone?.includes(q))
      &&(fStageP==="All"||l.stage===fStageP);
  });

  return(
    <div className="fade-in" style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden"}}>

      {/* Top bar */}
      <div style={{display:"flex",gap:8,marginBottom:10,alignItems:"center",flexShrink:0,flexWrap:"wrap"}}>
        <input value={searchP} onChange={e=>setSearchP(e.target.value)} placeholder="🔍 Search leads…" style={{flex:1,minWidth:140,fontSize:12}}/>
        <select value={fStageP} onChange={e=>setFStageP(e.target.value)} style={{width:"auto",fontSize:12}}>
          <option value="All">All Stages</option>
          {STAGES.map(s=><option key={s}>{s}</option>)}
        </select>
        <span style={{fontSize:11,color:"#A0AEC0",whiteSpace:"nowrap"}}>{filtered.length} leads</span>
      </div>

      {/* Stage count strip */}
      <div style={{display:"flex",gap:5,marginBottom:10,overflowX:"auto",paddingBottom:4,flexShrink:0}}>
        {stageOrder.map(s=>{
          const cnt=visible.filter(l=>l.stage===s).length;
          const val=visible.filter(l=>l.stage===s).reduce((a,l)=>a+(l.budget||0),0);
          const m=STAGE_META[s]||{c:"#718096",bg:"#F0F2F5"};
          return(
            <button key={s} onClick={()=>setFStageP(fStageP===s?"All":s)}
              style={{flexShrink:0,padding:"6px 12px",borderRadius:8,background:fStageP===s?m.c:m.bg,
                border:`2px solid ${fStageP===s?m.c:m.c+"33"}`,textAlign:"center",minWidth:90,cursor:"pointer",transition:"all .15s"}}>
              <div style={{fontWeight:700,fontSize:17,color:fStageP===s?"#fff":m.c,lineHeight:1}}>{cnt}</div>
              <div style={{fontSize:8,color:fStageP===s?"rgba(255,255,255,.9)":m.c,fontWeight:700,textTransform:"uppercase",letterSpacing:".5px",marginTop:2}}>{s}</div>
              {val>0&&<div style={{fontSize:9,color:fStageP===s?"rgba(255,255,255,.7)":m.c,opacity:.8}}>{fmtM(val)}</div>}
            </button>
          );
        })}
      </div>

      {/* Main content — cards + detail panel */}
      <div style={{flex:1,overflow:"hidden",display:"flex",gap:12}}>

        {/* Card list */}
        <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:8}}>
          {filtered.length===0&&(
            <div style={{textAlign:"center",padding:"3rem",color:"#A0AEC0"}}>
              <div style={{fontSize:36,marginBottom:8}}>📋</div>
              <div>No leads in pipeline{fStageP!=="All"?` at ${fStageP}`:""}</div>
            </div>
          )}
          {filtered.sort((a,b)=>STAGES.indexOf(a.stage)-STAGES.indexOf(b.stage)).map(lead=>{
            const m=STAGE_META[lead.stage]||{c:"#718096",bg:"#F0F2F5"};
            const days=lead.stage_updated_at?Math.floor((new Date()-new Date(lead.stage_updated_at))/(864e5)):0;
            const isSelected=selCard?.id===lead.id;
            return(
              <div key={lead.id} onClick={()=>setSelCard(isSelected?null:lead)}
                style={{background:"#fff",border:`2px solid ${isSelected?m.c:"#E2E8F0"}`,borderRadius:10,
                  padding:"10px 14px",cursor:"pointer",transition:"all .15s",
                  boxShadow:isSelected?`0 2px 12px ${m.c}33`:"0 1px 3px rgba(0,0,0,.04)",
                  borderLeft:`4px solid ${m.c}`}}
                onMouseOver={e=>{if(!isSelected)e.currentTarget.style.borderColor=m.c+"66";}}
                onMouseOut={e=>{if(!isSelected)e.currentTarget.style.borderColor="#E2E8F0";}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <Av name={lead.name} size={34}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                      <span style={{fontWeight:700,fontSize:13,color:"#0B1F3A"}}>{lead.name}</span>
                      <span style={{fontSize:10,fontWeight:600,padding:"1px 7px",borderRadius:20,background:m.bg,color:m.c}}>{lead.stage}</span>
                      {days>7&&<span style={{fontSize:10,fontWeight:700,color:days>14?"#B83232":"#A06810"}}>⏱ {days}d</span>}
                    </div>
                    <div style={{fontSize:11,color:"#718096",marginTop:2}}>
                      {lead.property_type&&<span style={{marginRight:8}}>{lead.property_type}</span>}
                      {lead.budget&&<span style={{fontWeight:600,color:"#0B1F3A"}}>{fmtM(lead.budget)}</span>}
                      {lead.phone&&<span style={{marginLeft:8,color:"#A0AEC0"}}>{lead.phone}</span>}
                    </div>
                  </div>
                  <div style={{display:"flex",gap:4,flexShrink:0}}>
                    {canEdit&&stageOrder.indexOf(lead.stage)>0&&(
                      <button onClick={e=>{e.stopPropagation();moveStage(lead,stageOrder[stageOrder.indexOf(lead.stage)-1]);}}
                        title="Move back"
                        style={{fontSize:14,width:28,height:28,borderRadius:6,border:"1.5px solid #E2E8F0",background:"#fff",cursor:"pointer",color:"#718096",display:"flex",alignItems:"center",justifyContent:"center"}}>
                        ←
                      </button>
                    )}
                    {canEdit&&stageOrder.indexOf(lead.stage)<stageOrder.length-1&&(
                      <button onClick={e=>{e.stopPropagation();moveStage(lead,stageOrder[stageOrder.indexOf(lead.stage)+1]);}}
                        title={`Move to ${stageOrder[stageOrder.indexOf(lead.stage)+1]}`}
                        style={{fontSize:14,width:28,height:28,borderRadius:6,border:"none",background:m.c,cursor:"pointer",color:"#fff",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>
                        →
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Detail panel — shown when card selected */}
        {selCard&&(()=>{
          const lead=leads.find(l=>l.id===selCard.id)||selCard;
          const m=STAGE_META[lead.stage]||{c:"#718096",bg:"#F0F2F5"};
          const days=lead.stage_updated_at?Math.floor((new Date()-new Date(lead.stage_updated_at))/(864e5)):0;
          const curIdx=stageOrder.indexOf(lead.stage);
          return(
            <div style={{width:260,flexShrink:0,background:"#fff",border:"1.5px solid #E2E8F0",borderRadius:12,overflowY:"auto",boxShadow:"0 4px 20px rgba(11,31,58,.08)"}}>
              {/* Header */}
              <div style={{background:`linear-gradient(135deg,${m.c},${m.c}CC)`,padding:"14px 16px",borderRadius:"10px 10px 0 0"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div>
                    <div style={{fontWeight:700,fontSize:15,color:"#fff"}}>{lead.name}</div>
                    <div style={{fontSize:11,color:"rgba(255,255,255,.75)",marginTop:2}}>{lead.stage}</div>
                  </div>
                  <button onClick={()=>setSelCard(null)} style={{background:"rgba(255,255,255,.2)",border:"none",borderRadius:6,width:24,height:24,cursor:"pointer",color:"#fff",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
                </div>
                {lead.budget&&<div style={{fontSize:18,fontWeight:700,color:"#fff",marginTop:8}}>{fmtM(lead.budget)}</div>}
              </div>

              {/* Details */}
              <div style={{padding:"14px 16px",display:"flex",flexDirection:"column",gap:10}}>
                {[
                  ["Phone",lead.phone],["Email",lead.email],
                  ["Nationality",lead.nationality],["Source",lead.source],
                  ["Type",lead.property_type],["Days in stage",`${days}d`],
                ].filter(([,v])=>v).map(([l,v])=>(
                  <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"4px 0",borderBottom:"1px solid #F7F9FC"}}>
                    <span style={{color:"#A0AEC0"}}>{l}</span>
                    <span style={{fontWeight:600,color:"#0B1F3A",maxWidth:140,textAlign:"right",wordBreak:"break-word"}}>{v}</span>
                  </div>
                ))}

                {/* Move stage buttons */}
                {canEdit&&(
                  <div style={{marginTop:4}}>
                    <div style={{fontSize:11,fontWeight:700,color:"#A0AEC0",textTransform:"uppercase",letterSpacing:".5px",marginBottom:8}}>Move Stage</div>
                    <div style={{display:"flex",flexDirection:"column",gap:6}}>
                      {stageOrder.map((s,i)=>(
                        <button key={s} onClick={()=>moveStage(lead,s)}
                          disabled={s===lead.stage}
                          style={{padding:"7px 10px",borderRadius:7,border:`1.5px solid ${s===lead.stage?m.c:"#E2E8F0"}`,
                            background:s===lead.stage?m.bg:"#fff",color:s===lead.stage?m.c:"#4A5568",
                            fontSize:11,fontWeight:s===lead.stage?700:400,cursor:s===lead.stage?"default":"pointer",
                            textAlign:"left",display:"flex",alignItems:"center",gap:6}}>
                          <span style={{fontSize:9,color:s===lead.stage?m.c:"#A0AEC0"}}>{i+1}.</span>
                          {s} {s===lead.stage?"← current":""}
                        </button>
                      ))}
                      <button onClick={()=>moveStage(lead,"Closed Lost")}
                        style={{padding:"7px 10px",borderRadius:7,border:"1.5px solid #FAEAEA",background:"#FAEAEA",color:"#B83232",fontSize:11,fontWeight:600,cursor:"pointer",textAlign:"left",marginTop:4}}>
                        ✗ Close as Lost
                      </button>
                      <button onClick={()=>moveStage(lead,"Closed Won")}
                        style={{padding:"7px 10px",borderRadius:7,border:"none",background:"#1A7F5A",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",textAlign:"left"}}>
                        ✓ Close as Won
                      </button>
                    </div>
                  </div>
                )}
                {lead.notes&&(
                  <div style={{fontSize:11,color:"#718096",lineHeight:1.6,padding:"8px",background:"#F7F9FC",borderRadius:7}}>{lead.notes}</div>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Closed summary footer */}
      {(visible.filter(l=>l.stage==="Closed Won").length>0||visible.filter(l=>l.stage==="Closed Lost").length>0)&&(
        <div style={{flexShrink:0,display:"flex",gap:10,padding:"8px 0 0",borderTop:"1px solid #E2E8F0",marginTop:6}}>
          <div style={{flex:1,padding:"7px 12px",borderRadius:8,background:"#E6F4EE",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:12,fontWeight:700,color:"#1A7F5A"}}>✓ {visible.filter(l=>l.stage==="Closed Won").length} Won</span>
            <span style={{fontSize:12,fontWeight:700,color:"#1A7F5A"}}>{fmtM(visible.filter(l=>l.stage==="Closed Won").reduce((s,l)=>s+(l.budget||0),0))}</span>
          </div>
          <div style={{flex:1,padding:"7px 12px",borderRadius:8,background:"#FAEAEA",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:12,fontWeight:700,color:"#B83232"}}>✗ {visible.filter(l=>l.stage==="Closed Lost").length} Lost</span>
          </div>
        </div>
      )}
    </div>
  );
}


function ActivityLog({leads,activities,setActivities,currentUser,showToast}){
  const[fType,setFType]=useState("All");const[fLead,setFLead]=useState("All");const[showAdd,setShowAdd]=useState(false);const[saving,setSaving]=useState(false);
  const[form,setForm]=useState({lead_id:"",type:"Call",note:""});
  const filtered=useMemo(()=>[...activities].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).filter(a=>(fType==="All"||a.type===fType)&&(fLead==="All"||a.lead_id===fLead)),[activities,fType,fLead]);
  const save=async()=>{
    if(!form.note.trim()||!form.lead_id){showToast("Select a lead and enter a note.","error");return;}
    setSaving(true);
    try{const lead=leads.find(l=>l.id===form.lead_id);const{data,error}=await supabase.from("activities").insert({lead_id:form.lead_id,type:form.type,note:form.note,user_id:currentUser.id,user_name:currentUser.full_name,lead_name:lead?.name||""}).select().single();if(error)throw error;setActivities(p=>[data,...p]);showToast("Activity logged.","success");setShowAdd(false);setForm({lead_id:"",type:"Call",note:""});}catch(e){showToast(e.message,"error");}finally{setSaving(false);}
  };
  const del=async id=>{if(!can(currentUser.role,"delete"))return;const{error}=await supabase.from("activities").delete().eq("id",id);if(!error)setActivities(p=>p.filter(a=>a.id!==id));};
  return(
    <div className="fade-in" style={{display:"flex",flexDirection:"column",height:"100%"}}>
      <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap"}}>
        <select value={fType} onChange={e=>setFType(e.target.value)} style={{width:"auto"}}><option value="All">All types</option>{ACT_TYPES.map(t=><option key={t}>{t}</option>)}</select>
        <select value={fLead} onChange={e=>setFLead(e.target.value)} style={{width:"auto"}}><option value="All">All leads</option>{leads.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select>
        <div style={{marginLeft:"auto"}}><Btn variant="gold" onClick={()=>setShowAdd(true)}>+ Log Activity</Btn></div>
      </div>
      <div style={{fontSize:12,color:"#A0AEC0",marginBottom:10}}>{filtered.length} activit{filtered.length!==1?"ies":"y"}</div>
      <div style={{flex:1,overflowY:"auto"}}>
        {filtered.length===0&&<Empty icon="📋" msg="No activities yet"/>}
        {filtered.map((act,idx)=>{
          const m=ACT_META[act.type]||ACT_META.Note;const prev=filtered[idx-1];
          const showDate=!prev||new Date(prev.created_at).toDateString()!==new Date(act.created_at).toDateString();
          return(<div key={act.id}>
            {showDate&&<div style={{display:"flex",alignItems:"center",gap:10,margin:"14px 0 8px"}}><div style={{height:1,flex:1,background:"#E2E8F0"}}/><span style={{fontSize:11,fontWeight:600,color:"#A0AEC0"}}>{fmtDate(act.created_at)}</span><div style={{height:1,flex:1,background:"#E2E8F0"}}/></div>}
            <div style={{display:"flex",gap:12,marginBottom:8,padding:"12px 14px",background:"#fff",border:"1px solid #E2E8F0",borderRadius:10}}>
              <div style={{width:38,height:38,borderRadius:10,background:m.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{m.icon}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}>
                  <span style={{fontSize:13,fontWeight:700,color:m.c}}>{act.type}</span>
                  <span style={{fontSize:12,color:"#718096"}}>with</span>
                  <span style={{fontSize:13,fontWeight:600,color:"#0B1F3A"}}>{act.lead_name||"Unknown"}</span>
                </div>
                <div style={{fontSize:13,color:"#4A5568",lineHeight:1.6,marginBottom:4}}>{act.note}</div>
                <div style={{fontSize:11,color:"#A0AEC0"}}>Logged by {act.user_name} · {fmtDate(act.created_at)}</div>
              </div>
              {can(currentUser.role,"delete")&&<button onClick={()=>del(act.id)} style={{background:"none",border:"none",color:"#E2E8F0",fontSize:16,alignSelf:"flex-start",padding:0,transition:"color 0.15s"}} onMouseOver={e=>e.currentTarget.style.color="#B83232"} onMouseOut={e=>e.currentTarget.style.color="#E2E8F0"}>×</button>}
            </div>
          </div>);
        })}
      </div>
      {showAdd&&(
        <Modal title="Log New Activity" onClose={()=>setShowAdd(false)} width={460}>
          <FF label="Lead" required><select value={form.lead_id} onChange={e=>setForm(f=>({...f,lead_id:e.target.value}))}><option value="">Select a lead…</option>{leads.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></FF>
          <FF label="Activity Type"><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{ACT_TYPES.map(t=><button key={t} onClick={()=>setForm(f=>({...f,type:t}))} style={{padding:"6px 14px",borderRadius:20,border:`1.5px solid ${form.type===t?"#0B1F3A":"#E2E8F0"}`,background:form.type===t?"#0B1F3A":"#fff",color:form.type===t?"#fff":"#4A5568",fontSize:13,cursor:"pointer",fontWeight:form.type===t?600:400}}>{ACT_META[t]?.icon} {t}</button>)}</div></FF>
          <FF label="Note / Summary" required><textarea value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))} rows={4} placeholder="What happened?"/></FF>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <Btn variant="outline" onClick={()=>setShowAdd(false)}>Cancel</Btn>
            <Btn variant="gold" onClick={save} disabled={saving}>{saving?"Saving…":"Save Activity"}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}



// ══════════════════════════════════════════════════════════════════
// AI ASSISTANT — Premium Concierge
// ══════════════════════════════════════════════════════════════════
function AIAssistant({leads,units,projects,salePricing,leasePricing,activities,currentUser,showToast}){
  return <div style={{padding:20}}>AI Assistant - Coming Soon</div>;
}


function GroupConsolidatedView() {
  return (
    <div className="fade-in" style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",gap:16,padding:"2rem",textAlign:"center"}}>
      <div style={{fontSize:56}}>🏛</div>
      <div style={{fontFamily:"'Playfair Display',serif",fontSize:24,fontWeight:700,color:"#0B1F3A"}}>Group Consolidated View</div>
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
      <div style={{fontSize:11,color:"#A0AEC0"}}>Requires <code style={{background:"#F0F2F5",padding:"1px 5px",borderRadius:4}}>group_id</code> column on companies table · Scheduled for MVP</div>
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
  {id:"pipeline",   label:"Pipeline",     icon:"🔀", app:"sales",   roles:["super_admin","admin","sales_manager","sales_agent"]},
  {id:"projects",   label:"Projects",     icon:"🏗️", app:"sales",   roles:["super_admin","admin","sales_manager"]},
  {id:"builder",    label:"Inventory",    icon:"🏠", app:"sales",   roles:["super_admin","admin","sales_manager","sales_agent"]},
  {id:"discounts",  label:"Discounts",    icon:"⚡", app:"sales",   roles:["super_admin","admin","sales_manager"]},
  {id:"activity",   label:"Activity Log", icon:"📝", app:"sales",   roles:["super_admin","admin","sales_manager","sales_agent"]},
  {id:"reports",    label:"Reports",      icon:"📊", app:"sales",   roles:["super_admin","admin","sales_manager"]},
  {id:"ai",         label:"AI Assistant", icon:"✦",  app:"sales",   roles:["super_admin","admin","sales_manager","sales_agent"]},
  {id:"companies",  label:"Companies",    icon:"🏢", app:"sales",   roles:["super_admin"]},
  {id:"users",      label:"Users",        icon:"👥", app:"sales",   roles:["admin","super_admin"]},
  {id:"permissions",label:"Permissions",  icon:"🔒", app:"sales",   roles:["super_admin"]},
  {id:"permsets",   label:"Permissions",  icon:"🔐", app:"sales",   roles:["super_admin","admin"]},
  {id:"group_view", label:"Group View",    icon:"🏛", app:"sales",   roles:["super_admin"]},
  // ── Leasing CRM ────────────────────────────────────────────────
  {id:"l_dashboard",label:"Dashboard",    icon:"⊞",  app:"leasing", roles:["super_admin","admin","leasing_manager","leasing_agent","viewer"]},
  {id:"l_leads",    label:"Enquiries",    icon:"👤", app:"leasing", roles:["super_admin","admin","leasing_manager","leasing_agent"]},
  {id:"l_pipeline", label:"Pipeline",     icon:"🔀", app:"leasing", roles:["super_admin","admin","leasing_manager","leasing_agent"]},
  {id:"l_projects",  label:"Projects",     icon:"🏗️", app:"leasing", roles:["super_admin","admin","leasing_manager"]},
  {id:"l_inventory",label:"Inventory",    icon:"📋", app:"leasing", roles:["super_admin","admin","leasing_manager","leasing_agent"]},
  {id:"leasing",    label:"Leasing",      icon:"🔑", app:"leasing", roles:["super_admin","admin","leasing_manager","leasing_agent"]},
  {id:"l_discounts",label:"Discounts",    icon:"⚡", app:"leasing", roles:["super_admin","admin","leasing_manager"]},
  {id:"l_activity", label:"Activity Log", icon:"📝", app:"leasing", roles:["super_admin","admin","leasing_manager","leasing_agent"]},
  {id:"l_ai",       label:"AI Assistant", icon:"✦",  app:"leasing", roles:["super_admin","admin","leasing_manager","leasing_agent"]},
  {id:"l_reports",  label:"Reports",      icon:"📊", app:"leasing", roles:["super_admin","admin","leasing_manager"]},
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
  l_pipeline: "Manage lease enquiries through stages",
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
    const sc = s=>({Available:{bg:"#E6F4EE",c:"#1A7F5A"},Reserved:{bg:"#FDF3DC",c:"#A06810"},Sold:{bg:"#E6EFF9",c:"#1A5FA8"},Leased:{bg:"#EEE8F9",c:"#5B3FAA"}}[s]||{bg:"#F0F2F5",c:"#718096"});
    const avail=projUnits.filter(u=>u.status==="Available").length;
    const res=projUnits.filter(u=>u.status==="Reserved").length;
    const sold=projUnits.filter(u=>["Sold","Leased"].includes(u.status)).length;
    return (
      <div className="fade-in" style={{display:"flex",flexDirection:"column",height:"100%"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,flexWrap:"wrap"}}>
          <button onClick={()=>setDrillProject(null)} style={{padding:"7px 14px",borderRadius:8,border:"1.5px solid #E2E8F0",background:"#fff",fontSize:13,cursor:"pointer"}}>← Projects</button>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:16,fontWeight:700,color:"#0B1F3A"}}>{drillProject.name}</div>
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
                <tr style={{background:"#0B1F3A"}}>
                  {["Unit Ref","Type","Floor","Beds","Size","View","Status"].map(h=>(
                    <th key={h} style={{padding:"10px 12px",textAlign:"left",fontSize:10,fontWeight:600,color:"#C9A84C",textTransform:"uppercase",letterSpacing:".5px"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {projUnits.map((u,i)=>(
                  <tr key={u.id} style={{background:i%2===0?"#fff":"#FAFBFC",borderBottom:"1px solid #F0F2F5"}}>
                    <td style={{padding:"10px 12px",fontWeight:700,fontSize:13,color:"#0B1F3A"}}>
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
          style={{padding:"9px 20px",borderRadius:8,border:"none",background:"#0B1F3A",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>
          + New Project
        </button>
      </div>

      {/* Projects table */}
      <div style={{flex:1,overflowY:"auto"}}>
        {filtered.length===0&&<div style={{textAlign:"center",padding:"3rem",color:"#A0AEC0"}}><div style={{fontSize:40,marginBottom:8}}>🏢</div><div>No projects yet — click + New Project</div></div>}
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead style={{position:"sticky",top:0,zIndex:1}}>
            <tr style={{background:"#0B1F3A"}}>
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
                      <div style={{fontWeight:700,fontSize:13,color:"#0B1F3A"}}>{proj.name}</div>
                      {proj.completion_date&&<div style={{fontSize:11,color:"#A0AEC0"}}>Completion: {new Date(proj.completion_date).toLocaleDateString("en-AE",{month:"short",year:"numeric"})}</div>}
                    </td>
                    <td style={{padding:"10px 12px",fontSize:12,color:"#4A5568"}} onClick={()=>setExpanded(isExp?null:proj.id)}>{proj.developer||"—"}</td>
                    <td style={{padding:"10px 12px",fontSize:12,color:"#4A5568"}} onClick={()=>setExpanded(isExp?null:proj.id)}>{proj.location||proj.community||"—"}</td>
                    <td style={{padding:"10px 12px",fontSize:13,fontWeight:700,color:"#0B1F3A",textAlign:"center"}} onClick={()=>setExpanded(isExp?null:proj.id)}>{st.total}</td>
                    <td style={{padding:"10px 12px",textAlign:"center"}} onClick={()=>setExpanded(isExp?null:proj.id)}><span style={{fontSize:12,fontWeight:600,color:"#1A7F5A"}}>{st.available}</span></td>
                    <td style={{padding:"10px 12px",textAlign:"center"}} onClick={()=>setExpanded(isExp?null:proj.id)}><span style={{fontSize:12,fontWeight:600,color:"#1A5FA8"}}>{st.sold}</span></td>
                    <td style={{padding:"10px 12px"}} onClick={()=>setExpanded(isExp?null:proj.id)}>
                      <span style={{fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:20,background:proj.status==="Active"?"#E6F4EE":"#F0F2F5",color:proj.status==="Active"?"#1A7F5A":"#718096"}}>{proj.status}</span>
                    </td>
                    <td style={{padding:"10px 8px"}}>
                      <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                        <button onClick={()=>setDrillProject(proj)}
                          style={{fontSize:11,padding:"5px 12px",borderRadius:6,border:"none",background:"#0B1F3A",color:"#C9A84C",fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>
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
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"1rem 1.5rem",borderBottom:"1px solid #E2E8F0",background:"linear-gradient(135deg,#0B1F3A,#1A3558)"}}>
              <span style={{fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:700,color:"#fff"}}>📤 Upload Projects from Excel</span>
              <button onClick={()=>setShowExcelUpload(false)} style={{background:"none",border:"none",fontSize:22,color:"#C9A84C",cursor:"pointer"}}>×</button>
            </div>
            <div style={{padding:"1.5rem"}}>
              <div style={{background:"#F7F9FC",borderRadius:10,padding:"1rem",marginBottom:16,border:"1px solid #E2E8F0"}}>
                <div style={{fontSize:13,fontWeight:600,color:"#0B1F3A",marginBottom:8}}>Required Excel columns:</div>
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
                <label style={{padding:"9px 20px",borderRadius:8,border:"none",background:"#0B1F3A",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>
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
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"1rem 1.5rem",borderBottom:"1px solid #E2E8F0",background:"linear-gradient(135deg,#0B1F3A,#1A3558)"}}>
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
              <button onClick={saveProject} disabled={saving} style={{padding:"9px 24px",borderRadius:8,border:"none",background:saving?"#A0AEC0":"#0B1F3A",color:"#fff",fontSize:13,fontWeight:600,cursor:saving?"not-allowed":"pointer"}}>
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
  expired:  { c:"#718096", bg:"#F0F2F5", border:"#CBD5E0" },
  inactive: { c:"#718096", bg:"#F0F2F5", border:"#CBD5E0" },
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
        expires_at:         new Date(Date.now() + 2*24*60*60*1000).toISOString(),
        created_by:         currentUser.id,
      };
      const { data, error } = await supabase.from("reservations").insert(payload).select().single();
      if (error) throw error;
      // Mark unit as Reserved
      await supabase.from("project_units").update({ status: "Reserved" }).eq("id", unit.id);
      showToast("Unit reserved — 48 hour clock started", "success");
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
    newExp.setTime(newExp.getTime() + 2*24*60*60*1000);
    setSaving(true);
    try {
      await supabase.from("reservations").update({ status:"Extended", extended_until:newExp.toISOString() }).eq("id", reservation.id);
      showToast("Reservation extended by 48 hours", "success");
      onSaved({ ...reservation, status:"Extended", extended_until:newExp.toISOString() });
    } catch(e) { showToast(e.message, "error"); }
    setSaving(false);
  };

  const urg = reservation ? reservationUrgency(reservation) : "ok";
  const col = RES_COLORS[urg];
  const hrs = reservation ? hoursLeft(reservation.expires_at, reservation.extended_until) : 48;

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,.65)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1100,padding:"1rem"}}>
      <div style={{background:"#fff",borderRadius:16,width:520,maxWidth:"100%",maxHeight:"92vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 24px 64px rgba(11,31,58,.4)"}}>
        {/* Header */}
        <div style={{background:"linear-gradient(135deg,#0B1F3A,#1A3558)",padding:"1.125rem 1.5rem",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
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
          <div style={{background:reservation.status==="Confirmed"?"#E6F4EE":"#F0F2F5",padding:"8px 16px",fontSize:12,fontWeight:600,color:reservation.status==="Confirmed"?"#1A7F5A":"#718096"}}>
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
                        style={{flex:1,padding:"8px",borderRadius:8,border:`1.5px solid ${form.reservation_type===t?"#0B1F3A":"#E2E8F0"}`,background:form.reservation_type===t?"#0B1F3A":"#fff",color:form.reservation_type===t?"#fff":"#4A5568",fontSize:13,fontWeight:600,cursor:"pointer"}}>
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
                    <div style={{fontSize:12,fontWeight:600,color:"#0B1F3A",wordBreak:"break-all"}}>{v}</div>
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
              style={{padding:"9px 24px",borderRadius:8,border:"none",background:saving?"#A0AEC0":"#C9A84C",color:"#0B1F3A",fontSize:13,fontWeight:700,cursor:saving?"not-allowed":"pointer"}}>
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
          <span style={{fontSize:13,fontWeight:700,color:"#0B1F3A"}}>🔒 Active Reservations</span>
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
              <div style={{fontWeight:700,fontSize:12,color:"#0B1F3A",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{res.client_name}</div>
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
  Cancelled:  {c:"#718096", bg:"#F0F2F5"},
};

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
