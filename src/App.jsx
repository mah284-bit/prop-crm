import { useState, useMemo, useEffect, useCallback, useRef, Fragment } from "react";
import { useLS } from './lib/useLS.js';
import { STAGE_CAPTURE_CONFIGS, PAYMENT_PLAN_PRESETS, DLD_OPTIONS, SERVICE_CHARGE_PRESETS, PROPOSAL_STATUS_META, VALIDITY_PRESETS, OPP_STAGES, OPP_STAGE_META } from './modules/constants.js';
import { useDraggable } from "./lib/useDraggable";
import { rulesFromRows } from './lib/contactValidation.js';
import { supabase } from "./lib/supabase";
import { STAGES, PROP_TYPES, UNIT_TYPES, SOURCES, ACT_TYPES, VIEWS, MEET_TYPES, FOLLOW_TYPES, ROLES, MANAGER_DISCOUNT_LIMIT, CAN_DELETE_LEADS } from './lib/appConstants.js';
import { WA_TEMPLATES } from './lib/salesTemplates.js';
import { getStrength, validateEmail } from './lib/validationHelpers.js';
import { hoursLeft, reservationUrgency } from './lib/reservationUtils.js';
import { TEMPLATES, COLORS } from './lib/rolesConstants.js';
import { fmtM, fmtAED } from './lib/formatters.js';
import { fmtDate, fmtDT, ini, uid } from './lib/utils.js';
import { normalisePhone, addWorkingDays, downloadIcsAndOpenMail } from './lib/appUtils.js';
import { useLeadPersons, ROLE_LABELS } from './lib/useLeadPersons.js';
import SettingsPage from "./components/settings/SettingsPage.jsx";
import LeadQueuePage from "./components/leadqueue/LeadQueuePage.jsx";
import CustomersPage from "./components/customers/CustomersPage.jsx";
import RemindersBell from './components/RemindersBell.jsx';
import LeadPeopleSection from './components/LeadPeopleSection.jsx';
import ActivitiesList from './components/opportunities/ActivitiesList.jsx';
import OpportunityDetail from './components/opportunities/OpportunityDetail.jsx';
import Opportunities from './components/sales/Opportunities.jsx';
import ActivityLog from './components/sales/ActivityLog.jsx';
import PropertyMaster from './components/inventory/PropertyMaster.jsx';
import CommissionOutstanding from './components/CommissionOutstanding.jsx';
import PropertyPackModal from './components/property/PropertyPackModal.jsx';
import LeadCreationFormV2 from './components/LeadCreationFormV2.jsx';
import ReleaseDialog from "./components/leadqueue/ReleaseDialog.jsx";

/* ═══════════════════════════════════════════════════════════════
   PROPCCRM v3.0
   · Property Master DB: Project → Category → Building → Unit
   · Lead stage gates with required fields
   · Stage reversal with reason
   · WhatsApp / Email / Meeting / Follow-up comms
   · Role-based permissions throughout
═══════════════════════════════════════════════════════════════ */
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

// Phase E W2 — Calendar invite helper.
// Generates a minimal .ics (RFC 5545) calendar event and opens the user's
// default mail client with a `mailto:` link pre-filled (subject, body, recipient).
// The agent attaches the downloaded .ics file before sending — works with
// Outlook, Apple Mail, Gmail in browser, no SMTP setup needed.
function buildIcsEvent({uid, summary, description, location, startISO, endISO, organizerName, organizerEmail, attendeeName, attendeeEmail}) {
  const fmtIcsDate = (iso) => {
    const d = new Date(iso);
    const pad = n => String(n).padStart(2,"0");
    return `${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
  };
  const escape = (s) => (s||"").replace(/\\/g,"\\\\").replace(/;/g,"\\;").replace(/,/g,"\\,").replace(/\n/g,"\\n");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PropCRM//Site Visit//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${fmtIcsDate(new Date().toISOString())}`,
    `DTSTART:${fmtIcsDate(startISO)}`,
    `DTEND:${fmtIcsDate(endISO)}`,
    `SUMMARY:${escape(summary)}`,
    description ? `DESCRIPTION:${escape(description)}` : null,
    location ? `LOCATION:${escape(location)}` : null,
    organizerEmail ? `ORGANIZER;CN=${escape(organizerName||"")}:mailto:${organizerEmail}` : null,
    attendeeEmail ? `ATTENDEE;CN=${escape(attendeeName||"")};RSVP=TRUE:mailto:${attendeeEmail}` : null,
    "STATUS:CONFIRMED",
    "BEGIN:VALARM",
    "TRIGGER:-PT60M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escape("Reminder: "+summary)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return lines.join("\r\n");
}


const STAGE_RULES = {
  "Contacted":     ["phone","email"],
  "Site Visit":    ["meeting_scheduled"],
  "Proposal Sent": ["unit_id","budget_confirmed"],
  "Negotiation":   ["proposal_notes"],
  "Closed Won":    ["final_price"],  // payment_plan_agreed removed per broker MOM (broker doesn't track installments)
};
const DISC_TYPES = [
  { key:"sale_price",   label:"Sale Price Reduction", icon:"🏷" },
  { key:"rent",         label:"Rent Reduction",        icon:"🔑" },
  { key:"payment_plan", label:"Payment Plan Change",   icon:"📅" },
  { key:"agency_fee",   label:"Agency Fee Waiver",     icon:"🤝" },
];

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
  sales:   ["dashboard","projects","builder","leads","customers","opportunities","discounts","activity","ai","reports","proppulse","coach_ai","pay_plans","companies","users","permissions","permsets","master_agreements","settings","lead_queue","commission_outstanding","group_view"],
  leasing: ["l_dashboard","l_leads","l_opportunities","l_projects","l_inventory","leasing","l_discounts","l_activity","l_ai","l_reports","l_proppulse","l_companies","l_users","l_permissions","l_permsets","l_group_view"],
  both:    ["dashboard","projects","builder","leads","customers","opportunities","leasing","l_opportunities","discounts","activity","ai","reports","proppulse","coach_ai","pay_plans","l_reports","companies","users","permissions","permsets","master_agreements","settings","lead_queue","commission_outstanding","group_view"],
};
// Which roles each mode makes available
const MODE_ROLES = {
  sales:   ["admin","sales_manager","sales_agent","viewer"],
  leasing: ["admin","leasing_manager","leasing_agent","viewer"],
  both:    ["admin","sales_manager","sales_agent","leasing_manager","leasing_agent","viewer"],
};


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
// Stage gate requirements — what must exist before moving to next stage
const STAGE_GATES = {
  "Contacted":     { required: ["phone","email"],                    label: "Phone and email required",          fields: ["phone","email"] },
  "Site Visit":    { required: ["meeting_scheduled"],                label: "A meeting must be scheduled first", fields: ["meeting_scheduled"] },
  "Proposal Sent": { required: ["unit_id","budget"],                 label: "Link a unit and confirm budget",    fields: ["unit_id","budget"] },
  "Negotiation":   { required: ["proposal_notes"],                   label: "Proposal notes required",           fields: ["proposal_notes"] },
  "Closed Won":    { required: ["final_price"],                      label: "Final price required",                  fields: ["final_price"] },
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
const Modal=({title,onClose,children,width=520})=>{
  /* draggable-shared-modal */
  const { ref, posStyle, handleProps } = useDraggable({ open: true });
  return (
  <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,0.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:"1rem"}}>
    <div ref={ref} className="fade-in" style={{background:"#fff",borderRadius:16,width,maxWidth:"100%",maxHeight:"90vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(11,31,58,0.3)",...posStyle}}>
      <div {...handleProps} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"1.25rem 1.5rem",borderBottom:"1px solid #E2E8F0",position:"sticky",top:0,background:"#fff",zIndex:1,cursor:"move",userSelect:"none"}}>
        <span style={{fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:700,color:"#0F2540"}}>{title}</span>
        <button onClick={onClose} style={{background:"none",border:"none",fontSize:22,color:"#A0AEC0",cursor:"pointer"}}>×</button>
      </div>
      <div style={{padding:"1.25rem 1.5rem"}}>{children}</div>
    </div>
  </div>
  );
};
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

// Phone formats by country/nationality
const NATIONALITIES = [
  "UAE","Saudi Arabia","Kuwait","Qatar","Bahrain","Oman",  // GCC
  "India","Pakistan","Bangladesh","Sri Lanka","Nepal","Philippines",  // South & SE Asia
  "Egypt","Lebanon","Jordan","Syria","Iraq","Palestine","Morocco","Tunisia","Algeria","Yemen","Sudan",  // MENA
  "UK","USA","Canada","Australia","New Zealand","South Africa",  // Western
  "France","Germany","Italy","Spain","Netherlands","Belgium","Switzerland","Sweden","Norway","Denmark","Russia","Ukraine",  // Europe
  "China","Japan","South Korea","Iran","Turkey","Indonesia","Malaysia","Thailand","Vietnam",  // Asia
  "Nigeria","Kenya","Ethiopia","Ghana",  // Africa
  "Other",
];

function CreateOpportunityDialog({ leads, setLeads, units, projects, salePricing, users, currentUser, showToast, onClose, onCreated, prefilledLead = null }) {
  // Step state - if lead is pre-selected (from Leads tab), skip Step 1
  const [step, setStep] = useState(prefilledLead ? 2 : 1);
  const [saving, setSaving] = useState(false);

  // Step 1: lead lookup
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [matches, setMatches] = useState([]);
  const [selectedLead, setSelectedLead] = useState(prefilledLead);
  const [showCreateLeadForm, setShowCreateLeadForm] = useState(false);

  // Phase F W6 ext — AI conflict context for the chosen match (Layer 1)
  const [conflictContext, setConflictContext] = useState(null); // {ownerName, daysSinceContact, stage, unitRefs, recentProposals, aiSummary}
  const [loadingContext, setLoadingContext] = useState(false);

  // V2-style new lead form — split phone into country code + number,
  // structured nationality dropdown, named source list
  const [newLeadForm, setNewLeadForm] = useState({
    name: "",
    countryCode: "+971",
    phone: "",       // local part only (the number AFTER the country code)
    email: "",
    source: "Walk-in",
    nationality: "",
    budget: "",
    notes: "",
  });
  const [serverDupeBlock, setServerDupeBlock] = useState(null); // {kind, existingLead}

  // Step 2: opp form (pre-filled from selectedLead where possible)
  const [oppForm, setOppForm] = useState({
    title: "", unit_id: "", budget: "", assigned_to: currentUser?.id || "",
    notes: "", property_category: "Off-Plan",
    commission_pct: "", master_agreement_id: null,
  });

  // Stage 2 integration: auto-populate commission from master agreement
  const [masterAgreement, setMasterAgreement] = useState(null);
  const [agreementLoading, setAgreementLoading] = useState(false);
  const [commissionUserOverride, setCommissionUserOverride] = useState(false);

  // When unit changes, look up master agreement for that project's developer
  useEffect(() => {
    let cancelled = false;
    async function loadAgreement() {
      if (!oppForm.unit_id) {
        setMasterAgreement(null);
        if (!commissionUserOverride) {
          setOppForm(f => ({ ...f, commission_pct: "", master_agreement_id: null }));
        }
        return;
      }

      const unit = (units || []).find(u => u.id === oppForm.unit_id);
      if (!unit?.project_id) return;
      const project = (projects || []).find(p => p.id === unit.project_id);
      if (!project?.pp_developer_id) {
        setMasterAgreement(null);
        return;
      }

      try {
        setAgreementLoading(true);
        const { data, error } = await supabase
          .from("pp_master_agreements")
          .select("id, agreement_title, default_commission_pct, developer_name")
          .eq("company_id", currentUser.company_id)
          .eq("developer_id", project.pp_developer_id)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1);

        if (cancelled) return;
        if (error) throw error;

        if (data && data.length > 0) {
          const ag = data[0];
          setMasterAgreement(ag);
          if (!commissionUserOverride) {
            setOppForm(f => ({
              ...f,
              commission_pct: String(ag.default_commission_pct ?? ""),
              master_agreement_id: ag.id
            }));
          }
        } else {
          setMasterAgreement(null);
          if (!commissionUserOverride) {
            setOppForm(f => ({ ...f, commission_pct: "", master_agreement_id: null }));
          }
        }
      } catch (err) {
        console.error("Master agreement lookup failed:", err);
        if (!cancelled) setMasterAgreement(null);
      } finally {
        if (!cancelled) setAgreementLoading(false);
      }
    }
    loadAgreement();
    return () => { cancelled = true; };
  }, [oppForm.unit_id, currentUser?.company_id]);

  // Step 2: unit picker state (Phase F W6.2 — searchable)
  const [unitPickerOpen, setUnitPickerOpen] = useState(false);
  const [unitSearch, setUnitSearch] = useState("");
  const [unitProjFilter, setUnitProjFilter] = useState("All"); // project_id or "All"
  const [unitBedFilter, setUnitBedFilter] = useState("All");   // "All" | "Studio" | "1" | "2" | "3" | "4+"
  const [unitShowReserved, setUnitShowReserved] = useState(false);

  // Detect what kind of input the agent typed (email / phone / name)
  const detectKind = (s) => {
    const trimmed = s.trim();
    if (trimmed.includes("@")) return "email";
    if (/^[+\d\s()-]+$/.test(trimmed) && trimmed.replace(/\D/g,"").length >= 4) return "phone";
    return "name";
  };

  // Debounced lead search by phone OR email — Layer 3 dedup detection.
  // Uses normalised phone matching: agent might type "0501234" or "+97150 1234"
  // and we still find the existing "+971 50 1234" lead.
  useEffect(() => {
    if (!query.trim() || query.trim().length < 3) {
      setMatches([]);
      return;
    }
    const handle = setTimeout(async () => {
      setSearching(true);
      try {
        const q = query.trim();
        const kind = detectKind(q);
        let rows = [];

        if (kind === "email") {
          // Email match — very strong dedup signal. Use ILIKE (case-insensitive).
          const { data, error } = await supabase
            .from("leads")
            .select("id, name, phone, email, source, nationality, budget, notes, created_at, assigned_to")
            .ilike("email", `%${q}%`)
            .eq("company_id", currentUser.company_id)
            .limit(8);
          if (error) throw error;
          rows = (data || []).map(r => ({...r, _matchType: "email"}));
        } else if (kind === "phone") {
          // Phone match — pull all leads with phones in this company, then
          // filter by normalised phone in JS. Avoids needing a stored
          // normalised column.
          const queryNorm = normalisePhone(q);
          if (!queryNorm) { setMatches([]); return; }
          const { data, error } = await supabase
            .from("leads")
            .select("id, name, phone, email, source, nationality, budget, notes, created_at, assigned_to")
            .not("phone", "is", null)
            .eq("company_id", currentUser.company_id)
            .limit(200); // generous so we don't miss matches
          if (error) throw error;
          rows = (data || [])
            .filter(r => {
              const rn = normalisePhone(r.phone);
              if (!rn) return false;
              // Match if either contains the other (handles partial typing)
              return rn.includes(queryNorm) || queryNorm.includes(rn);
            })
            .slice(0, 8)
            .map(r => ({...r, _matchType: "phone"}));
        } else {
          // Name fallback — least useful for dedup, but help the agent
          const { data, error } = await supabase
            .from("leads")
            .select("id, name, phone, email, source, nationality, budget, notes, created_at, assigned_to")
            .ilike("name", `%${q}%`)
            .eq("company_id", currentUser.company_id)
            .limit(8);
          if (error) throw error;
          rows = (data || []).map(r => ({...r, _matchType: "name"}));
        }
        setMatches(rows);
      } catch (e) {
        // Defensive: scan in-memory leads if DB query fails
        const ql = query.trim().toLowerCase();
        const qn = normalisePhone(query);
        const fallback = (leads || []).filter(l => {
          if ((l.email || "").toLowerCase().includes(ql)) return true;
          if (l.phone && qn && (normalisePhone(l.phone).includes(qn) || qn.includes(normalisePhone(l.phone)))) return true;
          if ((l.name || "").toLowerCase().includes(ql)) return true;
          return false;
        }).slice(0, 8);
        setMatches(fallback);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [query, currentUser.company_id]);

  // Phase F W6 ext — when a match is HOVERED or selected, fetch its conflict
  // context (current owner, recent activity, in-flight opps). Run once per
  // selected lead, cached locally on conflictContext.
  const loadConflictContext = async (lead) => {
    setLoadingContext(true);
    setConflictContext(null);
    try {
      const owner = (users || []).find(u => u.id === lead.assigned_to);

      // Fetch active opps for this lead
      const { data: leadOpps } = await supabase
        .from("opportunities")
        .select("id, stage, status, budget, unit_id, stage_updated_at, created_at, assigned_to")
        .eq("lead_id", lead.id)
        .neq("stage", "Closed Won")
        .neq("stage", "Closed Lost")
        .limit(10);

      // Fetch recent activities on this lead
      const { data: recentActs } = await supabase
        .from("activities")
        .select("type, note, created_at, user_name")
        .eq("lead_id", lead.id)
        .order("created_at", { ascending: false })
        .limit(5);

      const lastActAt = recentActs?.[0]?.created_at || lead.created_at;
      const daysSinceContact = lastActAt ? Math.round((new Date() - new Date(lastActAt)) / (1000*60*60*24)) : null;

      const oppDetails = (leadOpps || []).map(o => {
        const u = (units || []).find(x => x.id === o.unit_id);
        return {
          stage: o.stage,
          unit_ref: u?.unit_ref || null,
          owner_id: o.assigned_to,
          ownerName: (users || []).find(uu => uu.id === o.assigned_to)?.full_name || null,
        };
      });

      // Quick AI summary of the situation
      let aiSummary = "";
      try {
        const system = `You are a UAE real-estate brokerage advisor. A second agent is about to create a new opportunity for a buyer who already exists in the company's database. Summarise the situation in ONE sentence — what the second agent should know and what the recommended next step is. Be diplomatic, professional, brief. Do not assume bad intent. Output only the sentence, no preamble.`;
        const userPrompt = `Existing lead: ${lead.name || "Unknown"} (owned by ${owner?.full_name || "another agent"}).
Last contact: ${daysSinceContact === 0 ? "today" : daysSinceContact === 1 ? "yesterday" : daysSinceContact != null ? daysSinceContact + " days ago" : "unknown"}.
Active opportunities: ${oppDetails.length} (stages: ${oppDetails.map(o=>o.stage).join(", ") || "none"}).
${oppDetails.length > 0 ? `Units in flight: ${oppDetails.map(o=>o.unit_ref).filter(Boolean).join(", ")}.` : ""}
The agent attempting creation is ${currentUser.full_name || "another agent"}.
What should the second agent know?`;
        aiSummary = await aiInvoke({ system, prompt: userPrompt });
        aiSummary = (aiSummary || "").trim().replace(/^["']|["']$/g, "");
      } catch (e) {
        aiSummary = "";
      }

      setConflictContext({
        owner,
        daysSinceContact,
        opps: oppDetails,
        recentActs: recentActs || [],
        aiSummary,
      });
    } catch (e) {
      setConflictContext({ owner: null, daysSinceContact: null, opps: [], recentActs: [], aiSummary: "" });
    } finally {
      setLoadingContext(false);
    }
  };

  const startCreateLead = () => {
    const kind = detectKind(query);
    if (kind === "email") {
      setNewLeadForm(prev => ({ ...prev, email: query.trim() }));
    } else if (kind === "phone") {
      // Strip the country code from query if present
      let raw = query.trim();
      let cc = "+971";
      const matchCC = COUNTRY_CODES.find(c => raw.startsWith(c.code));
      if (matchCC) {
        cc = matchCC.code;
        raw = raw.slice(matchCC.code.length).trim();
      }
      const localPart = raw.replace(/\D/g, "").replace(/^0/, "");
      setNewLeadForm(prev => ({ ...prev, countryCode: cc, phone: localPart }));
    } else {
      setNewLeadForm(prev => ({ ...prev, name: query.trim() }));
    }
    setShowCreateLeadForm(true);
    setServerDupeBlock(null);
  };

  const useExistingLead = (lead) => {
    setSelectedLead(lead);
    setOppForm(prev => ({
      ...prev,
      title: `Inquiry from ${lead.name || "buyer"}`,
      budget: lead.budget ? String(lead.budget) : "",
    }));
    loadConflictContext(lead);
    // Don't auto-advance to step 2 — let the agent see context first and decide
  };

  // Final Layer 3 check — runs RIGHT BEFORE inserting a new lead. Catches:
  // (1) agent skipped search and typed dup details, (2) race condition where
  // another agent created the same lead between search and save.
  const finalDupeCheck = async (form) => {
    const fullPhone = (form.countryCode || "") + form.phone.replace(/\D/g, "");
    const phoneNorm = normalisePhone(fullPhone);
    const emailLower = (form.email || "").trim().toLowerCase();

    if (!emailLower && !phoneNorm) return null;

    // Check email first (stronger signal)
    if (emailLower) {
      const { data } = await supabase
        .from("leads")
        .select("id, name, phone, email, assigned_to")
        .ilike("email", emailLower)
        .eq("company_id", currentUser.company_id)
        .limit(1);
      if (data && data.length > 0) return { kind: "email", existingLead: data[0] };
    }

    // Then phone (weaker but still meaningful)
    if (phoneNorm && phoneNorm.length >= 5) {
      const { data } = await supabase
        .from("leads")
        .select("id, name, phone, email, assigned_to")
        .not("phone", "is", null)
        .eq("company_id", currentUser.company_id)
        .limit(200);
      if (data) {
        const dupe = data.find(r => {
          const rn = normalisePhone(r.phone);
          return rn && (rn === phoneNorm || rn.includes(phoneNorm) || phoneNorm.includes(rn));
        });
        if (dupe) return { kind: "phone", existingLead: dupe };
      }
    }

    return null;
  };

  const createLeadAndContinue = async () => {
    if (!newLeadForm.name.trim()) {
      showToast("Name is required", "error");
      return;
    }
    if (!newLeadForm.phone.trim() && !newLeadForm.email.trim()) {
      showToast("Phone or email is required", "error");
      return;
    }
    setSaving(true);
    setServerDupeBlock(null);
    try {
      // Layer 3 final check
      const dupe = await finalDupeCheck(newLeadForm);
      if (dupe) {
        setServerDupeBlock(dupe);
        setSaving(false);
        return;
      }

      const fullPhone = newLeadForm.phone
        ? `${newLeadForm.countryCode}${newLeadForm.phone.replace(/\D/g, "")}`
        : null;

      const payload = {
        name: newLeadForm.name.trim(),
        phone: fullPhone,
        email: newLeadForm.email.trim() || null,
        source: newLeadForm.source || null,
        nationality: newLeadForm.nationality || null,
        budget: newLeadForm.budget ? Number(newLeadForm.budget) : null,
        notes: newLeadForm.notes || null,
        company_id: currentUser.company_id || null,
        assigned_to: currentUser.id,
        created_by: currentUser.id,
      };
      // Some installations have a country_code column; include if not null
      if (newLeadForm.countryCode) payload.country_code = newLeadForm.countryCode;

      const { data, error } = await supabase
        .from("leads")
        .insert(payload)
        .select()
        .single();
      if (error) {
        // Defensive: column country_code might not exist — retry without it
        if (error.message && error.message.toLowerCase().includes("country_code")) {
          delete payload.country_code;
          const retry = await supabase.from("leads").insert(payload).select().single();
          if (retry.error) throw retry.error;
          setSelectedLead(retry.data);
          writeBrokerCreatedLog(retry.data, currentUser);
          setOppForm(prev => ({
            ...prev,
            title: `Inquiry from ${retry.data.name}`,
            budget: retry.data.budget ? String(retry.data.budget) : "",
          }));
          setStep(2);
          showToast("Lead created", "success");
          return;
        }
        throw error;
      }
      setSelectedLead(data);
      writeBrokerCreatedLog(data, currentUser);
      setOppForm(prev => ({
        ...prev,
        title: `Inquiry from ${data.name}`,
        budget: data.budget ? String(data.budget) : "",
      }));
      setStep(2);
      showToast("Lead created", "success");
    } catch (e) {
      showToast(`Couldn't create lead: ${e.message}`, "error");
    } finally {
      setSaving(false);
    }
  };

  const saveOpp = async () => {
    if (!selectedLead?.id) {
      showToast("No lead selected", "error");
      return;
    }
    setSaving(true);
    try {
      const unit = units.find(u => u.id === oppForm.unit_id);
      // 14 May 2026 Day 2 Math Flow: set current_* from salePricing at creation
      // (single source of truth, unit price is reality - broker adjusts later stages)
      const unitPrice = (salePricing || []).find(s => s.unit_id === oppForm.unit_id)?.asking_price;
      const isOffPlan = (oppForm.property_category || "Off-Plan") === "Off-Plan";
      const payload = {
        lead_id: selectedLead.id,
        company_id: currentUser.company_id || null,
        title: oppForm.title || (unit ? `${unit.unit_ref} — ${selectedLead.name}` : `Opportunity — ${selectedLead.name}`),
        unit_id: oppForm.unit_id || null,
        budget: oppForm.budget ? Number(oppForm.budget) : null,
        assigned_to: oppForm.assigned_to || currentUser.id,
        notes: oppForm.notes || null,
        property_category: oppForm.property_category || "Off-Plan",
        commission_pct: oppForm.commission_pct ? Number(oppForm.commission_pct) : null,
        master_agreement_id: oppForm.master_agreement_id || null,
        stage: "New",
        status: "Active",
        created_by: currentUser.id,
        // Math flow current_* fields (set at creation)
        current_agreed_price: unitPrice || null,
        current_admin_fee: 580,
        current_trustee_fee: isOffPlan ? 4200 : null,
        current_values_updated_at: new Date().toISOString(),
        current_values_updated_by: currentUser.id,
      };
      const { data, error } = await supabase.from("opportunities").insert(payload).select().single();
      if (error) throw error;
      showToast("Opportunity created", "success");
      const wasNewLead = !(leads || []).find(l => l.id === selectedLead.id);
      onCreated(data, wasNewLead ? selectedLead : null);
    } catch (e) {
      showToast(`Couldn't create opportunity: ${e.message}`, "error");
    } finally {
      setSaving(false);
    }
  };

  // Has the selected lead got an active conflict (i.e. owned by someone other
  // than the current user, or has active opps owned by another agent)?
  const hasConflict = selectedLead && conflictContext && (
    (selectedLead.assigned_to && selectedLead.assigned_to !== currentUser.id) ||
    conflictContext.opps.some(o => o.owner_id && o.owner_id !== currentUser.id)
  );

  // ─── RENDER ────────────────────────────────────────────────
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(15,37,64,.55)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:"2rem"}}>
      <div style={{background:"#fff",borderRadius:14,padding:0,maxWidth:640,width:"100%",maxHeight:"92vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 24px 56px rgba(15,37,64,.18)"}}>

        {/* Header */}
        <div style={{padding:"18px 22px",borderBottom:"1px solid #E2E8F0",background:"#0F2540",color:"#fff",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700,letterSpacing:"-.3px"}}>
              {step === 1 ? "🎯 New Opportunity — Step 1: Find or create buyer" : "🎯 New Opportunity — Step 2: Deal details"}
            </div>
            {selectedLead && step === 2 && (
              <div style={{fontSize:11,color:"rgba(255,255,255,.7)",marginTop:3}}>
                For: <strong>{selectedLead.name}</strong> · {selectedLead.phone || selectedLead.email}
              </div>
            )}
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:"#C9A84C",fontSize:24,cursor:"pointer",lineHeight:1}}>×</button>
        </div>

        {/* Body */}
        <div style={{padding:"20px 22px",overflowY:"auto",flex:1}}>

          {/* ─── STEP 1: lead lookup-or-create ─── */}
          {step === 1 && !showCreateLeadForm && !selectedLead && (
            <div>
              <div style={{fontSize:12,color:"#64748B",marginBottom:10,lineHeight:1.5}}>
                Type the buyer's <strong>email</strong> (most reliable) or <strong>phone</strong>. If they're already in our database, you'll see them — pick to continue. Otherwise, create a new contact.
              </div>

              <div style={{position:"relative",marginBottom:14}}>
                <input type="text" autoFocus
                  value={query}
                  onChange={e=>setQuery(e.target.value)}
                  placeholder="🔍 buyer@email.com or +9715... or name"
                  style={{width:"100%",padding:"11px 14px",borderRadius:8,border:"1.5px solid #D1D9E6",fontSize:13,boxSizing:"border-box",outline:"none"}}/>
                {searching && (
                  <span style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",fontSize:11,color:"#64748B"}}>
                    Searching…
                  </span>
                )}
              </div>

              {query.trim().length >= 3 && !searching && matches.length === 0 && (
                <div style={{padding:"12px 14px",background:"#FFFBEA",border:"1px solid #FCD34D",borderRadius:8,fontSize:12,color:"#7A4F01",marginBottom:10}}>
                  No matching contacts found. <button onClick={startCreateLead} style={{marginLeft:6,padding:"3px 10px",borderRadius:5,border:"1px solid #7A4F01",background:"#fff",color:"#7A4F01",fontSize:11,fontWeight:700,cursor:"pointer"}}>+ Create new contact</button>
                </div>
              )}

              {matches.length > 0 && (
                <div style={{marginBottom:10}}>
                  <div style={{fontSize:10,fontWeight:700,color:"#64748B",textTransform:"uppercase",letterSpacing:".5px",marginBottom:6,display:"flex",alignItems:"center",gap:6}}>
                    {matches.length} matching contact{matches.length===1?"":"s"} found
                    {matches[0]?._matchType === "email" && (
                      <span style={{fontSize:9,padding:"2px 6px",borderRadius:8,background:"#FEE2E2",color:"#C53030",fontWeight:700,letterSpacing:".4px"}}>EMAIL MATCH</span>
                    )}
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:6}}>
                    {matches.map(l => {
                      const owner = users?.find(u => u.id === l.assigned_to);
                      const isMine = l.assigned_to === currentUser.id;
                      const cardBg = l._matchType === "email" ? "#FEF2F2" : "#FFFBEA";
                      const cardBd = l._matchType === "email" ? "#FCA5A5" : "#FCD34D";
                      return (
                        <div key={l.id} style={{padding:"10px 12px",background:cardBg,border:`1px solid ${cardBd}`,borderRadius:8}}>
                          <div style={{fontSize:13,fontWeight:700,color:"#0F2540",marginBottom:3,display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                            📇 {l.name || "Unnamed contact"}
                            {!isMine && owner && (
                              <span style={{fontSize:9,padding:"2px 6px",borderRadius:8,background:"#FEE2E2",color:"#C53030",fontWeight:700,letterSpacing:".4px"}}>
                                OWNED BY {owner.full_name?.toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div style={{fontSize:11,color:"#64748B",marginBottom:7}}>
                            {[l.phone, l.email, l.source && `Source: ${l.source}`, l.nationality].filter(Boolean).join(" · ")}
                          </div>
                          <button onClick={()=>useExistingLead(l)}
                            style={{padding:"5px 12px",borderRadius:6,border:"none",background:"#0F2540",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                            ✓ Use this contact
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{textAlign:"center",marginTop:10}}>
                    <button onClick={startCreateLead}
                      style={{padding:"6px 14px",borderRadius:6,border:"1.5px solid #D1D9E6",background:"#fff",color:"#475569",fontSize:11,fontWeight:600,cursor:"pointer"}}>
                      None of these — create new contact instead
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── STEP 1.5: lead picked, show conflict context (if any) ─── */}
          {step === 1 && !showCreateLeadForm && selectedLead && (
            <div>
              <div style={{padding:"10px 12px",background:"#F0FDFA",border:"1px solid #CCFBF1",borderRadius:8,marginBottom:14}}>
                <div style={{fontSize:13,fontWeight:700,color:"#0F2540",marginBottom:3}}>
                  ✓ Selected: {selectedLead.name}
                </div>
                <div style={{fontSize:11,color:"#64748B"}}>
                  {[selectedLead.phone, selectedLead.email].filter(Boolean).join(" · ")}
                </div>
              </div>

              {loadingContext && (
                <div style={{fontSize:12,color:"#64748B",padding:"10px 0"}}>
                  Loading deal context…
                </div>
              )}

              {!loadingContext && hasConflict && conflictContext && (
                <div style={{padding:"12px 14px",background:"#FEF2F2",border:"1.5px solid #FCA5A5",borderRadius:10,marginBottom:14}}>
                  <div style={{fontSize:11,fontWeight:700,color:"#C53030",textTransform:"uppercase",letterSpacing:".5px",marginBottom:8,display:"flex",alignItems:"center",gap:6}}>
                    ⚠ Heads up — this lead has activity with another agent
                  </div>
                  {conflictContext.aiSummary && (
                    <div style={{fontSize:12,color:"#7B1F1F",marginBottom:10,fontStyle:"italic",lineHeight:1.5,padding:"8px 10px",background:"#fff",borderRadius:6,border:"1px solid #FCA5A5"}}>
                      🤖 {conflictContext.aiSummary}
                    </div>
                  )}
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
                    {conflictContext.owner && (
                      <div style={{background:"#fff",border:"1px solid #FCA5A5",borderRadius:6,padding:"6px 9px"}}>
                        <div style={{fontSize:9,color:"#94A3B8",fontWeight:600,textTransform:"uppercase"}}>Lead owner</div>
                        <div style={{fontSize:12,fontWeight:700,color:"#0F2540"}}>{conflictContext.owner.full_name}</div>
                      </div>
                    )}
                    {conflictContext.daysSinceContact !== null && (
                      <div style={{background:"#fff",border:"1px solid #FCA5A5",borderRadius:6,padding:"6px 9px"}}>
                        <div style={{fontSize:9,color:"#94A3B8",fontWeight:600,textTransform:"uppercase"}}>Last contact</div>
                        <div style={{fontSize:12,fontWeight:700,color:"#0F2540"}}>
                          {conflictContext.daysSinceContact === 0 ? "Today" : conflictContext.daysSinceContact === 1 ? "Yesterday" : conflictContext.daysSinceContact + " days ago"}
                        </div>
                      </div>
                    )}
                  </div>
                  {conflictContext.opps.length > 0 && (
                    <div style={{marginBottom:10}}>
                      <div style={{fontSize:9,color:"#94A3B8",fontWeight:600,textTransform:"uppercase",marginBottom:4}}>
                        Active opportunities ({conflictContext.opps.length})
                      </div>
                      {conflictContext.opps.map((o, idx) => (
                        <div key={idx} style={{fontSize:11,color:"#475569",padding:"3px 0"}}>
                          · {o.unit_ref || "no unit"} — {o.stage}{o.ownerName && ` (${o.ownerName})`}
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{fontSize:11,color:"#64748B",lineHeight:1.5,padding:"6px 8px",background:"#FFF8E1",borderRadius:5,border:"1px solid #FCD34D"}}>
                    💡 Recommended: contact <strong>{conflictContext.owner?.full_name || "the lead owner"}</strong> or your manager before creating a parallel opportunity. Inter-agent coordination prevents customer confusion and team disputes.
                  </div>
                </div>
              )}

              <div style={{display:"flex",gap:8,justifyContent:"space-between",alignItems:"center",flexWrap:"wrap"}}>
                <button onClick={()=>{setSelectedLead(null);setConflictContext(null);}}
                  style={{padding:"6px 14px",borderRadius:6,border:"1.5px solid #D1D9E6",background:"#fff",color:"#475569",fontSize:11,fontWeight:600,cursor:"pointer"}}>
                  ← Pick a different contact
                </button>
                <button onClick={()=>setStep(2)}
                  disabled={loadingContext}
                  style={{padding:"8px 18px",borderRadius:7,border:"none",background:hasConflict?"#A06810":"#0F2540",color:"#fff",fontSize:12,fontWeight:700,cursor:loadingContext?"not-allowed":"pointer"}}>
                  {hasConflict ? "Proceed anyway →" : "Continue to deal details →"}
                </button>
              </div>
            </div>
          )}

          {/* ─── STEP 1: create new lead form (V2-quality) ─── */}
          {step === 1 && showCreateLeadForm && (
            <div>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
                <button onClick={()=>{setShowCreateLeadForm(false);setServerDupeBlock(null);}} style={{background:"none",border:"none",color:"#64748B",fontSize:13,cursor:"pointer"}}>← Back to search</button>
                <span style={{fontSize:12,color:"#64748B"}}>Creating new contact</span>
              </div>

              {serverDupeBlock && (
                <div style={{padding:"12px 14px",background:"#FEF2F2",border:"1.5px solid #FCA5A5",borderRadius:10,marginBottom:14}}>
                  <div style={{fontSize:11,fontWeight:700,color:"#C53030",textTransform:"uppercase",letterSpacing:".5px",marginBottom:6}}>
                    ⚠ Duplicate detected — {serverDupeBlock.kind} match
                  </div>
                  <div style={{fontSize:12,color:"#7B1F1F",marginBottom:10,lineHeight:1.5}}>
                    A contact with this {serverDupeBlock.kind} already exists: <strong>{serverDupeBlock.existingLead.name}</strong>
                    {" "}({serverDupeBlock.existingLead.phone || serverDupeBlock.existingLead.email}).
                    {serverDupeBlock.kind === "email"
                      ? " Email is a strong duplicate signal — please use the existing contact unless this is a confirmed different person."
                      : " Phone numbers can change — please verify whether this is the same person before creating a duplicate."}
                  </div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    <button onClick={()=>{useExistingLead(serverDupeBlock.existingLead); setShowCreateLeadForm(false); setServerDupeBlock(null);}}
                      style={{padding:"6px 12px",borderRadius:6,border:"none",background:"#0F2540",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                      ✓ Use existing contact
                    </button>
                    {serverDupeBlock.kind === "phone" && (
                      <button onClick={()=>setServerDupeBlock(null)}
                        style={{padding:"6px 12px",borderRadius:6,border:"1.5px solid #C53030",background:"#fff",color:"#C53030",fontSize:11,fontWeight:600,cursor:"pointer"}}>
                        Different person — create anyway
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div style={{gridColumn:"1 / -1"}}>
                  <label style={{fontSize:11,fontWeight:700,color:"#0F2540",textTransform:"uppercase",letterSpacing:".4px",display:"block",marginBottom:5}}>Name *</label>
                  <input value={newLeadForm.name} onChange={e=>setNewLeadForm(f=>({...f,name:e.target.value}))} placeholder="Mr. Khan" autoFocus
                    style={{width:"100%",padding:"8px 12px",borderRadius:7,border:"1.5px solid #D1D9E6",fontSize:13,boxSizing:"border-box"}}/>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:700,color:"#0F2540",textTransform:"uppercase",letterSpacing:".4px",display:"block",marginBottom:5}}>Phone</label>
                  <div style={{display:"flex",gap:5}}>
                    <select value={newLeadForm.countryCode} onChange={e=>setNewLeadForm(f=>({...f,countryCode:e.target.value}))}
                      style={{flex:"0 0 auto",minWidth:90,padding:"8px 6px",borderRadius:7,border:"1.5px solid #D1D9E6",fontSize:12,background:"#fff",cursor:"pointer"}}>
                      {COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.code} {c.country}</option>)}
                    </select>
                    <input value={newLeadForm.phone} onChange={e=>setNewLeadForm(f=>({...f,phone:e.target.value.replace(/\D/g,"")}))} placeholder="50 1234 567"
                      style={{flex:1,padding:"8px 12px",borderRadius:7,border:"1.5px solid #D1D9E6",fontSize:13,boxSizing:"border-box",minWidth:0}}/>
                  </div>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:700,color:"#0F2540",textTransform:"uppercase",letterSpacing:".4px",display:"block",marginBottom:5}}>Email</label>
                  <input type="email" value={newLeadForm.email} onChange={e=>setNewLeadForm(f=>({...f,email:e.target.value}))} placeholder="buyer@email.com"
                    style={{width:"100%",padding:"8px 12px",borderRadius:7,border:"1.5px solid #D1D9E6",fontSize:13,boxSizing:"border-box"}}/>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:700,color:"#0F2540",textTransform:"uppercase",letterSpacing:".4px",display:"block",marginBottom:5}}>Source</label>
                  <select value={newLeadForm.source} onChange={e=>setNewLeadForm(f=>({...f,source:e.target.value}))}
                    style={{width:"100%",padding:"8px 12px",borderRadius:7,border:"1.5px solid #D1D9E6",fontSize:13,boxSizing:"border-box",background:"#fff"}}>
                    <option>Walk-in</option>
                    <option>Bayut</option>
                    <option>PropertyFinder</option>
                    <option>Dubizzle</option>
                    <option>Referral</option>
                    <option>Repeat customer</option>
                    <option>Cold call</option>
                    <option>Social media</option>
                    <option>Other</option>
                  </select>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:700,color:"#0F2540",textTransform:"uppercase",letterSpacing:".4px",display:"block",marginBottom:5}}>Nationality</label>
                  <select value={newLeadForm.nationality} onChange={e=>setNewLeadForm(f=>({...f,nationality:e.target.value}))}
                    style={{width:"100%",padding:"8px 12px",borderRadius:7,border:"1.5px solid #D1D9E6",fontSize:13,boxSizing:"border-box",background:"#fff"}}>
                    <option value="">— Select —</option>
                    {NATIONALITIES.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:700,color:"#0F2540",textTransform:"uppercase",letterSpacing:".4px",display:"block",marginBottom:5}}>Stated budget (AED)</label>
                  <input type="number" value={newLeadForm.budget} onChange={e=>setNewLeadForm(f=>({...f,budget:e.target.value}))} placeholder="2000000"
                    style={{width:"100%",padding:"8px 12px",borderRadius:7,border:"1.5px solid #D1D9E6",fontSize:13,boxSizing:"border-box"}}/>
                </div>
                <div style={{gridColumn:"1 / -1"}}>
                  <label style={{fontSize:11,fontWeight:700,color:"#0F2540",textTransform:"uppercase",letterSpacing:".4px",display:"block",marginBottom:5}}>Notes</label>
                  <textarea value={newLeadForm.notes} onChange={e=>setNewLeadForm(f=>({...f,notes:e.target.value}))} rows={2} placeholder="Initial requirements, preferences, anything notable…"
                    style={{width:"100%",padding:"8px 12px",borderRadius:7,border:"1.5px solid #D1D9E6",fontSize:13,boxSizing:"border-box",fontFamily:"inherit",resize:"vertical"}}/>
                </div>
              </div>
            </div>
          )}

          {/* ─── STEP 2: opp details ─── */}
          {step === 2 && selectedLead && (
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div style={{gridColumn:"1 / -1"}}>
                <label style={{fontSize:11,fontWeight:700,color:"#0F2540",textTransform:"uppercase",letterSpacing:".4px",display:"block",marginBottom:5}}>Title</label>
                <input value={oppForm.title} onChange={e=>setOppForm(f=>({...f,title:e.target.value}))} placeholder="auto-generated if blank"
                  style={{width:"100%",padding:"8px 12px",borderRadius:7,border:"1.5px solid #D1D9E6",fontSize:13,boxSizing:"border-box"}}/>
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:"#0F2540",textTransform:"uppercase",letterSpacing:".4px",display:"block",marginBottom:5}}>Property category</label>
                <select value={oppForm.property_category} onChange={e=>setOppForm(f=>({...f,property_category:e.target.value}))}
                  style={{width:"100%",padding:"8px 12px",borderRadius:7,border:"1.5px solid #D1D9E6",fontSize:13,boxSizing:"border-box",background:"#fff"}}>
                  <option>Off-Plan</option>
                  <option>Ready</option>
                  <option>Resale</option>
                </select>
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:"#0F2540",textTransform:"uppercase",letterSpacing:".4px",display:"block",marginBottom:5}}>Budget (AED)</label>
                <input type="number" value={oppForm.budget} onChange={e=>setOppForm(f=>({...f,budget:e.target.value}))} placeholder="2000000"
                  style={{width:"100%",padding:"8px 12px",borderRadius:7,border:"1.5px solid #D1D9E6",fontSize:13,boxSizing:"border-box"}}/>
              </div>
              <div style={{gridColumn:"1 / -1"}}>
                <label style={{fontSize:11,fontWeight:700,color:"#0F2540",textTransform:"uppercase",letterSpacing:".4px",display:"block",marginBottom:5}}>Linked unit (optional)</label>
                {/* Phase F W6.2 — searchable unit picker. Plain <select> doesn't
                    scale: at 84 units it's painful, at 8000+ it's unusable. */}
                {(() => {
                  const selectedUnit = (units||[]).find(u => u.id === oppForm.unit_id);
                  const selectedProj = selectedUnit ? (projects||[]).find(p => p.id === selectedUnit.project_id) : null;

                  // Build filtered list
                  const projectOptions = Array.from(new Set((units||[]).map(u => u.project_id).filter(Boolean)))
                    .map(pid => (projects||[]).find(p => p.id === pid))
                    .filter(Boolean);

                  // 19 May 2026 Issue 1: Filter out zero-value inventory
                  // (Matches UnitPickerRich v2 data integrity behavior)
                  // Prevents creating opportunities for unpriced units
                  const _priceById = {};
                  (salePricing||[]).forEach(sp => {
                    if (sp.unit_id && Number(sp.asking_price) > 0) {
                      _priceById[sp.unit_id] = Number(sp.asking_price);
                    }
                  });
                  let pool = (units||[]).filter(u => _priceById[u.id] > 0);
                  if (!unitShowReserved) pool = pool.filter(u => u.status !== "Reserved" && u.status !== "Sold");
                  if (unitProjFilter !== "All") pool = pool.filter(u => u.project_id === unitProjFilter);
                  if (unitBedFilter !== "All") {
                    if (unitBedFilter === "Studio") pool = pool.filter(u => u.bedrooms === 0);
                    else if (unitBedFilter === "4+") pool = pool.filter(u => u.bedrooms >= 4);
                    else pool = pool.filter(u => String(u.bedrooms) === unitBedFilter);
                  }
                  if (unitSearch.trim()) {
                    const q = unitSearch.trim().toLowerCase();
                    pool = pool.filter(u => {
                      const proj = (projects||[]).find(p => p.id === u.project_id);
                      const haystack = [u.unit_ref, u.sub_type, u.view, proj?.name, u.bedrooms===0?"studio":`${u.bedrooms}br`].filter(Boolean).join(" ").toLowerCase();
                      return haystack.includes(q);
                    });
                  }
                  // Sort by project name then unit_ref
                  pool = pool.sort((a,b)=>{
                    const pa = (projects||[]).find(p=>p.id===a.project_id)?.name || "";
                    const pb = (projects||[]).find(p=>p.id===b.project_id)?.name || "";
                    if (pa !== pb) return pa.localeCompare(pb);
                    return (a.unit_ref||"").localeCompare(b.unit_ref||"");
                  });
                  const visible = pool.slice(0, 200);

                  return (
                    <div style={{position:"relative"}}>
                      {/* Display field — shows selection or placeholder */}
                      <div onClick={()=>setUnitPickerOpen(o=>!o)}
                        style={{padding:"8px 12px",borderRadius:7,border:"1.5px solid #D1D9E6",fontSize:13,background:"#fff",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
                        {selectedUnit ? (
                          <div style={{flex:1,minWidth:0,display:"flex",alignItems:"center",gap:8}}>
                            <span style={{fontWeight:700,color:"#0F2540"}}>{selectedUnit.unit_ref}</span>
                            {/* Phase 2.2b — open Property Pack for this unit */}
                            <button onClick={e=>{e.stopPropagation();openPropertyPack(selectedUnit.id);}} title="View Property Pack" style={{padding:"2px 8px",borderRadius:5,border:"none",background:"#0F2540",color:"#fff",fontSize:10,fontWeight:700,cursor:"pointer"}}>📸 Pack</button>
                            {(() => {
                              // 16 May 2026: Show price for broker's quick budget match
                              const sp = (salePricing||[]).find(s => s.unit_id === selectedUnit.id);
                              const price = sp?.asking_price;
                              return price ? (
                                <span style={{fontWeight:700,color:"#1A5FA8",fontSize:12}}>AED {Number(price).toLocaleString()}</span>
                              ) : null;
                            })()}
                            <span style={{fontSize:11,color:"#64748B",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                              {[
                                selectedUnit.bedrooms===0?"Studio":selectedUnit.bedrooms?`${selectedUnit.bedrooms}BR`:null,
                                selectedUnit.sub_type,
                                selectedProj?.name,
                                selectedUnit.size_sqft && `${selectedUnit.size_sqft} sqft`,
                              ].filter(Boolean).join(" · ")}
                            </span>
                          </div>
                        ) : (
                          <span style={{color:"#94A3B8"}}>— No unit linked yet — click to search 🔍</span>
                        )}
                        <div style={{display:"flex",gap:4,alignItems:"center"}}>
                          {selectedUnit && (
                            <button onClick={e=>{e.stopPropagation();setOppForm(f=>({...f,unit_id:""}));setUnitPickerOpen(false);}}
                              style={{padding:"2px 7px",borderRadius:5,border:"none",background:"#E2E8F0",color:"#64748B",fontSize:10,fontWeight:700,cursor:"pointer"}}>
                              ✕
                            </button>
                          )}
                          <span style={{color:"#94A3B8",fontSize:11}}>{unitPickerOpen ? "▲" : "▼"}</span>
                        </div>
                      </div>

                      {/* Picker panel */}
                      {unitPickerOpen && (
                        <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,right:0,background:"#fff",border:"1.5px solid #D1D9E6",borderRadius:8,boxShadow:"0 14px 32px rgba(15,37,64,.15)",zIndex:50,maxHeight:380,display:"flex",flexDirection:"column",overflow:"hidden"}}>
                          {/* Search box */}
                          <div style={{padding:"10px 12px",borderBottom:"1px solid #E2E8F0"}}>
                            <input type="text" autoFocus value={unitSearch} onChange={e=>setUnitSearch(e.target.value)}
                              placeholder="🔍 Search by ref, project, BR, view (e.g. 'DAM 2BR' or 'villa')"
                              style={{width:"100%",padding:"7px 10px",borderRadius:6,border:"1.5px solid #E2E8F0",fontSize:12,boxSizing:"border-box",outline:"none"}}/>
                            {/* Filter row 1: project pills */}
                            <div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:8,alignItems:"center"}}>
                              <button onClick={()=>setUnitProjFilter("All")}
                                style={{padding:"3px 9px",borderRadius:11,border:`1px solid ${unitProjFilter==="All"?"#0F2540":"#E2E8F0"}`,background:unitProjFilter==="All"?"#0F2540":"#fff",color:unitProjFilter==="All"?"#fff":"#64748B",fontSize:10,fontWeight:600,cursor:"pointer"}}>All projects</button>
                              {projectOptions.map(p => (
                                <button key={p.id} onClick={()=>setUnitProjFilter(p.id)}
                                  style={{padding:"3px 9px",borderRadius:11,border:`1px solid ${unitProjFilter===p.id?"#0F2540":"#E2E8F0"}`,background:unitProjFilter===p.id?"#0F2540":"#fff",color:unitProjFilter===p.id?"#fff":"#64748B",fontSize:10,fontWeight:600,cursor:"pointer"}}>
                                  {p.name}
                                </button>
                              ))}
                            </div>
                            {/* Filter row 2: bedroom pills + show reserved */}
                            <div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:6,alignItems:"center"}}>
                              {["All","Studio","1","2","3","4+"].map(b => {
                                const sel = unitBedFilter === b;
                                const label = b==="All"?"All sizes":b==="Studio"?"Studio":b==="4+"?"4BR+":`${b}BR`;
                                return (
                                  <button key={b} onClick={()=>setUnitBedFilter(b)}
                                    style={{padding:"3px 9px",borderRadius:11,border:`1px solid ${sel?"#0F2540":"#E2E8F0"}`,background:sel?"#0F2540":"#fff",color:sel?"#fff":"#64748B",fontSize:10,fontWeight:600,cursor:"pointer"}}>{label}</button>
                                );
                              })}
                              <label style={{display:"flex",alignItems:"center",gap:4,fontSize:10,color:"#64748B",cursor:"pointer",marginLeft:"auto"}}>
                                <input type="checkbox" checked={unitShowReserved} onChange={e=>setUnitShowReserved(e.target.checked)}/>
                                Show Reserved/Sold
                              </label>
                            </div>
                          </div>

                          {/* Result count */}
                          <div style={{padding:"6px 12px",fontSize:10,color:"#94A3B8",fontWeight:600,letterSpacing:".4px",textTransform:"uppercase",borderBottom:"1px solid #F1F5F9"}}>
                            {pool.length} unit{pool.length===1?"":"s"}{visible.length < pool.length && ` (showing first ${visible.length})`}
                          </div>

                          {/* Results */}
                          <div style={{flex:1,overflowY:"auto",maxHeight:280}}>
                            {visible.length === 0 ? (
                              <div style={{padding:"22px 12px",textAlign:"center",color:"#94A3B8",fontSize:12}}>
                                No units match. Try a different filter or search term.
                              </div>
                            ) : (
                              visible.map(u => {
                                const proj = (projects||[]).find(p => p.id === u.project_id);
                                const bedLabel = u.bedrooms===0?"Studio":(u.bedrooms?`${u.bedrooms}BR`:"");
                                const isReserved = u.status === "Reserved" || u.status === "Sold";
                                return (
                                  <div key={u.id}
                                    onClick={()=>{
                                      // Finding 1 fix (11 May 2026): confirm before selecting Reserved/Sold unit
                                      if (isReserved) {
                                        const ok = window.confirm(
                                          `⚠️ Unit ${u.unit_ref} is currently ${u.status}.\n\n` +
                                          `This unit may conflict with another active deal. ` +
                                          `Selecting it could cause double-booking issues.\n\n` +
                                          `Click OK to proceed anyway, or Cancel to pick a different unit.`
                                        );
                                        if (!ok) return;
                                      }
                                      setOppForm(f=>({...f,unit_id:u.id}));
                                      setUnitPickerOpen(false);
                                      setUnitSearch("");
                                    }}
                                    onMouseOver={e=>e.currentTarget.style.background="#F8FAFC"}
                                    onMouseOut={e=>e.currentTarget.style.background="#fff"}
                                    style={{padding:"8px 12px",borderBottom:"1px solid #F1F5F9",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,opacity:isReserved?0.6:1}}>
                                    <div style={{minWidth:0,flex:1}}>
                                      <div style={{fontSize:12,fontWeight:700,color:"#0F2540",display:"flex",alignItems:"center",gap:6}}>
                                        {u.unit_ref}
                                        {isReserved && <span style={{fontSize:9,padding:"1px 5px",borderRadius:7,background:"#FEE2E2",color:"#C53030",fontWeight:700}}>{u.status?.toUpperCase()}</span>}
                                      </div>
                                      <div style={{fontSize:10,color:"#64748B",marginTop:1}}>
                                        {[bedLabel, u.sub_type, proj?.name, u.size_sqft && `${u.size_sqft} sqft`, u.view].filter(Boolean).join(" · ")}
                                      </div>
                                    </div>
                                    {(() => {
                                      // 16 May 2026: Show price on each unit row for budget match
                                      const sp = (salePricing||[]).find(s => s.unit_id === u.id);
                                      const price = sp?.asking_price;
                                      return price ? (
                                        <div style={{textAlign:"right",whiteSpace:"nowrap"}}>
                                          <div style={{fontSize:12,fontWeight:700,color:"#1A5FA8"}}>AED {Number(price).toLocaleString()}</div>
                                        </div>
                                      ) : (
                                        <div style={{fontSize:10,color:"#94A3B8",fontStyle:"italic"}}>No price</div>
                                      );
                                    })()}
                                  </div>
                                );
                              })
                            )}
                          </div>

                          {/* Footer */}
                          <div style={{padding:"6px 12px",borderTop:"1px solid #E2E8F0",background:"#F8FAFC",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                            <span style={{fontSize:10,color:"#94A3B8"}}>Click a unit to select. Esc or click outside to close.</span>
                            <button onClick={()=>setUnitPickerOpen(false)}
                              style={{padding:"3px 10px",borderRadius:5,border:"1px solid #D1D9E6",background:"#fff",color:"#64748B",fontSize:10,fontWeight:600,cursor:"pointer"}}>Close</button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
                <div style={{fontSize:10,color:"#94A3B8",marginTop:3}}>
                  💡 Don't worry if you don't have a unit yet. AI Match in the proposal builder will help you pick one later.
                </div>
              </div>
              {/* Commission auto-populate from master agreement */}
              <div style={{gridColumn:"1 / -1", padding:"12px 14px", background: masterAgreement ? "#F0F9FF" : "#F9FAFB", border:`1px solid ${masterAgreement ? "#BAE6FD" : "#E5E7EB"}`, borderRadius:8, marginBottom:8}}>
                <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8}}>
                  <div style={{fontSize:12, fontWeight:600, color:"#0F2540", display:"flex", alignItems:"center", gap:6}}>
                    💼 Commission
                    {agreementLoading && <span style={{fontSize:10, color:"#6B7280", fontWeight:500}}>· checking master agreement...</span>}
                  </div>
                  {masterAgreement && (
                    <div style={{fontSize:10, color:"#0369A1", background:"#DBEAFE", padding:"3px 8px", borderRadius:10, fontWeight:600}}>
                      💡 Auto-populated from {masterAgreement.developer_name} master agreement
                    </div>
                  )}
                </div>
                <div style={{display:"flex", alignItems:"center", gap:10}}>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={oppForm.commission_pct}
                    onChange={e => {
                      setCommissionUserOverride(true);
                      setOppForm(f => ({...f, commission_pct: e.target.value}));
                    }}
                    placeholder={masterAgreement ? "Auto-populated" : oppForm.unit_id ? "No active master agreement found" : "Select a unit first"}
                    disabled={!oppForm.unit_id}
                    style={{width:140, padding:"7px 10px", border:"1px solid #D1D5DB", borderRadius:6, fontSize:13, fontFamily:"'Inter', sans-serif", background:"#fff"}}
                  />
                  <span style={{fontSize:13, color:"#374151"}}>%</span>
                  {oppForm.commission_pct && (oppForm.budget || (units||[]).find(u=>u.id===oppForm.unit_id)?.base_price) && (
                    <span style={{fontSize:11, color:"#6B7280", marginLeft:8}}>
                      ≈ AED {Math.round(((Number(oppForm.budget) || (units||[]).find(u=>u.id===oppForm.unit_id)?.base_price || 0) * Number(oppForm.commission_pct) / 100)).toLocaleString()}
                    </span>
                  )}
                  {commissionUserOverride && masterAgreement && (
                    <button
                      type="button"
                      onClick={() => {
                        setCommissionUserOverride(false);
                        setOppForm(f => ({...f, commission_pct: String(masterAgreement.default_commission_pct ?? "")}));
                      }}
                      style={{padding:"5px 10px", background:"#fff", border:"1px solid #BAE6FD", borderRadius:6, fontSize:11, fontWeight:600, color:"#0369A1", cursor:"pointer"}}
                    >Reset to master</button>
                  )}
                </div>
                {oppForm.unit_id && !masterAgreement && !agreementLoading && (
                  <div style={{fontSize:11, color:"#92400E", marginTop:6}}>
                    ⚠️ No active master agreement found for this developer. Add one in Master Agreements menu, or enter rate manually.
                  </div>
                )}
              </div>

              <div>
                <label style={{fontSize:11,fontWeight:700,color:"#0F2540",textTransform:"uppercase",letterSpacing:".4px",display:"block",marginBottom:5}}>Owner</label>
                <select value={oppForm.assigned_to} onChange={e=>setOppForm(f=>({...f,assigned_to:e.target.value}))}
                  style={{width:"100%",padding:"8px 12px",borderRadius:7,border:"1.5px solid #D1D9E6",fontSize:13,boxSizing:"border-box",background:"#fff"}}>
                  {(users||[]).map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                </select>
              </div>
              <div style={{gridColumn:"1 / -1"}}>
                <label style={{fontSize:11,fontWeight:700,color:"#0F2540",textTransform:"uppercase",letterSpacing:".4px",display:"block",marginBottom:5}}>Notes</label>
                <textarea value={oppForm.notes} onChange={e=>setOppForm(f=>({...f,notes:e.target.value}))} rows={2} placeholder="Specific requirements, context for this deal…"
                  style={{width:"100%",padding:"8px 12px",borderRadius:7,border:"1.5px solid #D1D9E6",fontSize:13,boxSizing:"border-box",fontFamily:"inherit",resize:"vertical"}}/>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{padding:"14px 22px",borderTop:"1px solid #E2E8F0",background:"#F8FAFC",display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
          <div style={{fontSize:11,color:"#94A3B8"}}>
            Step {step} of 2
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={onClose} disabled={saving}
              style={{padding:"9px 16px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",color:"#475569",fontSize:12,fontWeight:600,cursor:saving?"not-allowed":"pointer"}}>
              Cancel
            </button>
            {step === 1 && showCreateLeadForm && (
              <button onClick={createLeadAndContinue} disabled={saving}
                style={{padding:"9px 18px",borderRadius:8,border:"none",background:saving?"#94A3B8":"#0F2540",color:"#fff",fontSize:12,fontWeight:700,cursor:saving?"not-allowed":"pointer"}}>
                {saving ? "Creating…" : "Create contact & continue →"}
              </button>
            )}
            {step === 2 && (
              <>
                <button onClick={()=>setStep(1)} disabled={saving}
                  style={{padding:"9px 14px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",color:"#475569",fontSize:12,fontWeight:600,cursor:"pointer"}}>
                  ← Back
                </button>
                <button onClick={saveOpp} disabled={saving}
                  style={{padding:"9px 18px",borderRadius:8,border:"none",background:saving?"#94A3B8":"#0F2540",color:"#fff",fontSize:12,fontWeight:700,cursor:saving?"not-allowed":"pointer"}}>
                  {saving ? "Creating…" : "Create opportunity"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════
   Phase F W5 — Opportunities Tab (real implementation)
   List view: filterable/searchable table of all opps.
   Click a row → opens OpportunityDetail (reuses existing component).
   Future (Commit G): "+ New Opportunity" with lead lookup-or-create.
═══════════════════════════════════════════════════════════════ */
function OpportunitiesPlaceholder({ currentUser, crmContext }) {
  // Used by the LEASING tab only — sales has the full Opportunities component below.
  // Sunday: leasing will get its own mirrored implementation.
  return (
    <div style={{padding:"1.25rem 1.5rem"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
        <span style={{fontSize:18}}>🎯</span>
        <span style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700,color:"#0F2540",letterSpacing:"-.3px"}}>Opportunities</span>
        <span style={{fontSize:11,padding:"3px 9px",borderRadius:10,background:"#FEF3C7",color:"#7A4F01",fontWeight:600}}>Coming next</span>
      </div>
      <div style={{fontSize:12,color:"#64748B"}}>
        Dedicated deal-pipeline workspace ({crmContext}). For now, manage opportunities from the <strong>Leads</strong> tab.
      </div>
    </div>
  );
}

function Leads({leads,setLeads,opps:globalOppsFromParent=[],setOpps:setGlobalOpps=()=>{},properties,activities,setActivities,discounts,setDiscounts,currentUser,users,showToast,initialFilter=null,onNavigateToOpp=null,refCountries=[],refRules={}}){
  const [search,   setSearch]   = useState("");
  const [fStage,   setFStage]   = useState("All");
  const [fType,    setFType]    = useState("All");
  const [view,     setView]     = useState("list");   // list | lead | opportunity
  const [selLeadId,setSelLeadId]= useState(null);
  const [selOpp,   setSelOpp]   = useState(null);
  const [saving,   setSaving]   = useState(false);
  // 23 May 2026: Restore Lead Detail activity logging (lost during April Lead/Opp split rewrite)
  // Full feature parity with Opp Detail saveLog - scheduling, duration, next-step reminders
  // Separate state from opp-side to avoid coupling risk.
  const [showLeadLog,   setShowLeadLog]   = useState(false);
  const [leadLogForm,   setLeadLogForm]   = useState({type:"Call",note:"",scheduled_at:"",duration_mins:"",ns_enabled:false,ns_type:"Call",ns_due:"",ns_note:""});
  // Phase A.3 — Sprint 1 form (side-by-side feature flag)
  const [showAddV2, setShowAddV2] = useState(false);
  const [editLeadForV2, setEditLeadForV2] = useState(null); // Phase 2.2A — V2 dual-mode: null = Add, row = Edit
  const [editFormVersion, setEditFormVersion] = useState(0); // Phase 2.2A — bump on every Edit click to force V2 remount
  const [showReleaseDialog, setShowReleaseDialog] = useState(false); // Phase 2.1 Day 22 — broker release workflow
  const [opps,     setOpps]     = useState(globalOppsFromParent); // sync with global
  const [units,    setUnits]    = useState([]);
  const [projects, setProjects] = useState([]);
  const [salePricing,setSalePricing]=useState([]);
  const [showAddOpp, setShowAddOpp]=useState(false);
  const [oppForm,  setOppForm]  = useState({title:"",unit_id:"",budget:"",assigned_to:"",notes:"",property_category:"Off-Plan"});
  // 16 May 2026: Consolidation - canonical opportunity dialog from Leads tab
  const [showCanonicalOppDialog, setShowCanonicalOppDialog] = useState(false);
  // Phase E dense layout: activities for ALL of this lead's opportunities (used to enrich opp rows)
  const [leadActivities, setLeadActivities] = useState([]);
  const canEdit = can(currentUser.role,"write");
  const canDel  = can(currentUser.role,"delete_leads");


  // ── Browser history sync ────────────────────────────────────────
  // Push state changes into browser history so the browser back button
  // navigates within the app (list ← lead ← opportunity) instead of
  // exiting the app entirely. Uses a ref to distinguish user-driven
  // back navigation from programmatic state changes.
  const skipPushRef = useRef(false);

  useEffect(()=>{
    // On mount: replace current entry with our initial state so popstate has something to roll back to
    window.history.replaceState({view:"list",selLeadId:null,selOppId:null}, "", window.location.pathname);

    const onPopState = (e)=>{
      const s = e.state;
      if(!s){
        // User went back past our entries — keep them on the list view
        skipPushRef.current = true;
        setView("list");
        setSelLeadId(null);
        setSelOpp(null);
        return;
      }
      skipPushRef.current = true;
      setView(s.view||"list");
      setSelLeadId(s.selLeadId||null);
      if(s.selOppId){
        // Find the opp in current state and restore it
        const found = opps.find(o=>o.id===s.selOppId) || globalOppsFromParent.find(o=>o.id===s.selOppId);
        setSelOpp(found||null);
      } else {
        setSelOpp(null);
      }
    };

    window.addEventListener("popstate", onPopState);
    return ()=>window.removeEventListener("popstate", onPopState);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  // Phase E W4 — deep-link handler: legacy code paths might pass opp filter.
  // Phase F W5 cut-over: redirect to Opportunities tab where opps live now.
  // Falls back to in-Leads view only if onNavigateToOpp is not wired.
  useEffect(()=>{
    if(!initialFilter || initialFilter.type !== "opp" || !initialFilter.oppId) return;
    if (onNavigateToOpp) {
      onNavigateToOpp(initialFilter.oppId);
      return;
    }
    // Defensive fallback (should rarely fire now)
    const opp = (opps||[]).find(o => o.id === initialFilter.oppId)
             || (globalOppsFromParent||[]).find(o => o.id === initialFilter.oppId);
    if(!opp) return;
    setSelOpp(opp);
    setSelLeadId(opp.lead_id);
    setView("opportunity");
  }, [initialFilter?.type, initialFilter?.oppId, opps.length, globalOppsFromParent.length, onNavigateToOpp]);

  // Phase F W4 ext — deep-link handler for leads (e.g. AI briefing surfaces a raw lead)
  useEffect(()=>{
    if(!initialFilter || initialFilter.type !== "lead" || !initialFilter.leadId) return;
    const lead = (leads||[]).find(l => l.id === initialFilter.leadId);
    if(!lead) return; // wait for leads to load
    setSelLeadId(lead.id);
    setView("lead");
  }, [initialFilter?.type, initialFilter?.leadId, leads.length]);

  useEffect(()=>{
    // After every view/selection change, push to history — unless the change came from popstate
    if(skipPushRef.current){
      skipPushRef.current = false;
      return;
    }
    const state = {view, selLeadId, selOppId: selOpp?.id || null};
    window.history.pushState(state, "", window.location.pathname);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[view, selLeadId, selOpp?.id]);
  // ────────────────────────────────────────────────────────────────

  // Load data
  useEffect(()=>{
    // Fix 12 May 2026: also propagate fetched opps to global state so Opportunities tab sees same data
    supabase.from("opportunities").select("*").eq("company_id", currentUser.company_id).order("created_at",{ascending:false}).then(({data})=>{
      const arr = data || [];
      setOpps(arr);
      setGlobalOpps(arr);
    });
    // 16 May 2026: Multi-tenant data isolation - filter by company_id
    // Prevents brokers from seeing/selecting units belonging to other companies
    // (Without this filter, opp creation could save cross-company unit_id refs)
    const _coId = currentUser?.company_id || null;
    if (_coId) {
      supabase.from("project_units").select("id,unit_ref,sub_type,project_id,status,purpose,floor_number,view,size_sqft,bedrooms").eq("company_id", _coId).then(({data})=>setUnits(data||[]));
      supabase.from("projects").select("id,name").eq("company_id", _coId).then(({data})=>setProjects(data||[]));
    } else {
      // No company context - load all (fallback for legacy/admin scenarios)
      supabase.from("project_units").select("id,unit_ref,sub_type,project_id,status,purpose,floor_number,view,size_sqft,bedrooms").then(({data})=>setUnits(data||[]));
      supabase.from("projects").select("id,name").then(({data})=>setProjects(data||[]));
    }
    // salePricing doesn't have company_id column directly - left as-is
    // (it joins via unit_id which is already filtered above)
    supabase.from("unit_sale_pricing").select("unit_id,asking_price").eq("company_id", currentUser.company_id).then(({data})=>setSalePricing(data||[]));
  },[]);

  // Phase E dense layout: when a lead is selected, fetch all activities for all its opportunities
  // so the opportunities list rows can show "last activity" preview inline.
  useEffect(()=>{
    if(!selLeadId){ setLeadActivities([]); return; }
    supabase
      .from("activities")
      .select("id,opportunity_id,type,note,created_at,stage_at_event,activity_subtype,structured_data,user_name")
      .eq("lead_id", selLeadId)
      .order("created_at",{ascending:false})
      .then(({data})=>setLeadActivities(data||[]));
  },[selLeadId]);

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


  const saveOpp = async()=>{
    if(!selLeadId){return;}
    setSaving(true);
    try{
      const unit=units.find(u=>u.id===oppForm.unit_id);
      // 14 May 2026 Day 2 Math Flow: set current_* from salePricing at creation
      const unitPriceShowAddOpp = (salePricing || []).find(s => s.unit_id === oppForm.unit_id)?.asking_price;
      const isOffPlanShowAddOpp = (oppForm.property_category || "Off-Plan") === "Off-Plan";
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
        // Math flow current_* fields (set at creation)
        current_agreed_price: unitPriceShowAddOpp || null,
        current_admin_fee: 580,
        current_trustee_fee: isOffPlanShowAddOpp ? 4200 : null,
        current_values_updated_at: new Date().toISOString(),
        current_values_updated_by: currentUser.id,
      };
      const{data,error}=await supabase.from("opportunities").insert(payload).select().single();
      if(error)throw error;
      setOpps(p=>{const n=[data,...p];setGlobalOpps(n);return n;});
      showToast("Opportunity created","success");
      setShowAddOpp(false);
      setOppForm({title:"",unit_id:"",budget:"",assigned_to:"",notes:"",property_category:"Off-Plan"});
      // Phase F W5 cut-over: navigate to Opportunities tab instead of opening
      // OpportunityDetail inside Leads. Falls back to old in-place open if the
      // navigation prop wasn't passed (defensive).
      if (onNavigateToOpp) {
        onNavigateToOpp(data.id);
      } else {
        setSelOpp(data);
        setView("opportunity");
      }
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
          <button onClick={()=>{setEditFormVersion(v=>v+1);setShowAddV2(true);}} style={{padding:"8px 18px",borderRadius:8,border:"none",background:"#0F2540",color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>+ Add Lead</button>
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
                    {(()=>{const IM={investor:{l:"Investor",c:"#1A7F5A",bg:"#E6F4EE"},owner_occupier:{l:"Owner-Occupier",c:"#1A5FA8",bg:"#E6EFF9"},hybrid:{l:"Hybrid",c:"#8A6200",bg:"#FDF3DC"},corporate:{l:"Corporate",c:"#5B21B6",bg:"#EDE9FE"},reseller:{l:"Reseller",c:"#B83232",bg:"#FCE8E8"}};const im=IM[l.buyer_intent];return im?<span style={{fontSize:10,fontWeight:600,padding:"1px 7px",borderRadius:20,background:im.bg,color:im.c}}>{im.l}</span>:null;})()}
                    {(()=>{const SM={customer:{l:"Customer",c:"#1A7F5A",bg:"#E6F4EE"},portfolio_customer:{l:"Portfolio",c:"#5B21B6",bg:"#EDE9FE"}};const sm=SM[l.lifecycle_stage];return sm?<span style={{fontSize:10,fontWeight:700,padding:"1px 7px",borderRadius:20,background:sm.bg,color:sm.c}}>{sm.l}</span>:null;})()}
                  </div>
                  <div style={{display:"flex",gap:10,fontSize:11,color:"#718096",marginTop:2,flexWrap:"wrap"}}>
                    {l.phone&&<span>{l.phone}</span>}
                    {l.email&&<span>{l.email}</span>}
                    {l.nationality&&<span>🌍 {l.nationality}</span>}
                  </div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontSize:12,fontWeight:700,color:"#0F2540"}}>{activeOpps.length} active opp{activeOpps.length!==1?"s":""}</div>
                  {totalVal>0&&<div style={{fontSize:11,color:"#718096"}}>{fmtM(totalVal)}</div>}
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
          key={`${editLeadForV2?.id || "new"}-${editFormVersion}`}
          companyId={currentUser?.company_id}
          countries={refCountries}
          rules={refRules}
          currentUserId={currentUser?.id}
          editLead={editLeadForV2}
          onSubmit={async(payload)=>{
            if(editLeadForV2){
              // EDIT mode: UPDATE the existing lead
              const {data,error}=await supabase.from("leads").update(payload).eq("id",editLeadForV2.id).select().single();
              if(error) throw new Error(error.message||"Failed to update contact");
              return data;
            } else {
              // CREATE mode: INSERT new lead
              const {data,error}=await supabase.from("leads").insert(payload).select().single();
              if(error) throw new Error(error.message||"Failed to create contact");
              return data;
            }
          }}
          onCancel={()=>{setShowAddV2(false);setEditLeadForV2(null);}}
          onCreated={(savedLead)=>{
            setShowAddV2(false);
            if(editLeadForV2){
              // Update existing in state
              setLeads(p=>p.map(l=>l.id===savedLead.id?savedLead:l));
              showToast("Contact updated","success");
            } else {
              // Prepend new to state
              setLeads(p=>[savedLead,...p]);
              writeBrokerCreatedLog(savedLead, currentUser);
              showToast("Contact added","success");
            }
            setEditLeadForV2(null);
          }}
        />
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
            {(()=>{
              // Phase 2.2A — Lifecycle stage badge
              const LC_META = {
                raw:                {c:"#475569", bg:"#F1F5F9", l:"Raw"},
                qualified:          {c:"#1A5FA8", bg:"#E6EFF8", l:"Qualified"},
                active_prospect:    {c:"#8A6200", bg:"#FDF3DC", l:"Active Prospect"},
                customer:           {c:"#1A7F5A", bg:"#E6F4EE", l:"Customer"},
                portfolio_customer: {c:"#5B21B6", bg:"#EDE9FE", l:"Portfolio Customer"},
              };
              const ls = selLead.lifecycle_stage || "raw";
              const m = LC_META[ls] || LC_META.raw;
              return <span style={{fontSize:10,fontWeight:600,padding:"2px 9px",borderRadius:20,background:m.bg,color:m.c}}>{m.l}</span>;
            })()}
            {(()=>{
              // Phase 2.2A — Buyer intent badge (only shown if set)
              const BI_LABEL = {
                investor: "Investor",
                owner_occupier: "Owner-Occupier",
                hybrid: "Hybrid",
                corporate: "Corporate buyer",
                reseller: "Reseller",
              };
              const bi = selLead.buyer_intent;
              return bi ? <span style={{fontSize:10,fontWeight:600,padding:"2px 9px",borderRadius:20,background:"#FFF7E6",color:"#9C6500",border:"1px solid #F5D78F"}}>{BI_LABEL[bi]||bi}</span> : null;
            })()}
            {selLead.pep_flag&&<span style={{fontSize:10,fontWeight:600,padding:"2px 9px",borderRadius:20,background:"#FDF3DC",color:"#8A6200"}}>⚠ PEP</span>}
          </div>
        </div>
        <div style={{display:"flex",gap:6}}>
          {canEdit&&<button onClick={()=>{setEditLeadForV2(selLead);setEditFormVersion(v=>v+1);setShowAddV2(true);}} style={{padding:"6px 14px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>✏ Edit</button>}
          {canEdit&&<button onClick={()=>setShowCanonicalOppDialog(true)} style={{padding:"6px 14px",borderRadius:8,border:"none",background:"#0F2540",color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>+ New Opportunity</button>}
        </div>
      </div>

      {/* ── Phase 2.1 Day 22: Assignment section ─────────────────── */}
      {(()=>{
        const assignedUser = users.find(u => u.id === selLead.assigned_to);
        const isOwner = selLead.assigned_to === currentUser?.id;
        const assignedDate = selLead.last_assigned_at ? new Date(selLead.last_assigned_at) : null;
        const lastActivity = selLead.last_broker_activity_at ? new Date(selLead.last_broker_activity_at) : null;
        const daysSince = (d) => {
          if (!d) return null;
          const days = Math.floor((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000));
          if (days === 0) return "today";
          if (days === 1) return "1 day ago";
          return `${days} days ago`;
        };
        const STATUS_META = {
          assigned:      { c: "#1A7F5A", bg: "#E6F4EE", l: "Assigned" },
          unassigned:    { c: "#B45309", bg: "#FEF3C7", l: "Unassigned" },
          released:      { c: "#C53030", bg: "#FED7D7", l: "Released" },
          stale_flagged: { c: "#8A6200", bg: "#FDF3DC", l: "Stale" },
        };
        const sm = STATUS_META[selLead.assignment_status] || STATUS_META.assigned;
        return (
          <div style={{
            marginBottom: 14,
            padding: "12px 16px",
            background: "#fff",
            border: "1px solid #E5E9EF",
            borderRadius: 12,
            display: "flex",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: "rgba(15, 37, 64, 0.06)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, flexShrink: 0,
            }}>
              👤
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#6B7785", letterSpacing: "0.4px", textTransform: "uppercase" }}>
                  Assigned to
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#0F2540" }}>
                  {assignedUser?.full_name || "Unassigned"}
                </span>
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 4,
                  background: sm.bg, color: sm.c, textTransform: "uppercase", letterSpacing: "0.4px",
                }}>
                  {sm.l}
                </span>
                {selLead.origin === "pool_sourced" && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 4,
                    background: "#E6EFF8", color: "#1A5FA8", textTransform: "uppercase", letterSpacing: "0.4px",
                  }}>
                    Pool-sourced
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: "#6B7785" }}>
                {assignedDate && <>Assigned {daysSince(assignedDate)} · </>}
                {lastActivity ? <>Last activity {daysSince(lastActivity)}</> : <>No activity recorded</>}
              </div>
            </div>
            {isOwner && selLead.assigned_to && (
              <button
                onClick={() => setShowReleaseDialog(true)}
                style={{
                  padding: "7px 14px",
                  background: "#fff",
                  color: "#B42318",
                  border: "1.5px solid #FECDCA",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                Release Lead
              </button>
            )}
          </div>
        );
      })()}

      {/* Release Dialog (Phase 2.1 Day 22) */}
      {showReleaseDialog && (
        <ReleaseDialog
          lead={selLead}
          currentUser={currentUser}
          users={users}
          onClose={() => setShowReleaseDialog(false)}
          onReleased={(result) => {
            setShowReleaseDialog(false);
            // Refresh lead state from DB
            // selLead is derived from leads.find(); updating leads triggers re-derivation
            supabase.from("leads").select("*").eq("id", selLead.id).single().then(({data}) => {
              if (data) setLeads(p => p.map(l => l.id === data.id ? data : l));
            });
          }}
          showToast={showToast}
        />
      )}


      {/* Identity + Notes — dense single-card layout */}
      {(()=>{
        const iso2ToFlag = (iso2)=>{ if(!iso2||iso2.length!==2)return ""; const c=iso2.toUpperCase(); return String.fromCodePoint(0x1F1E6+(c.charCodeAt(0)-65))+String.fromCodePoint(0x1F1E6+(c.charCodeAt(1)-65)); };
        const SOF_LABEL = {salary:"Salary",business:"Business income",investments:"Investments",inheritance:"Inheritance",sale_of_property:"Sale of property",savings:"Savings",gift:"Gift",other:"Other"};
        const items = [];
        if(selLead.phone_e164||selLead.phone) {
          const ph = selLead.phone_e164||selLead.phone;
          items.push({icon:"📞", label:"Phone", val:<a href={`tel:${ph}`} style={{color:"#1A5FA8",textDecoration:"none",fontWeight:600}}>{ph}</a>});
        }
        if(selLead.email) items.push({icon:"✉️", label:"Email", val:<a href={`mailto:${selLead.email}`} style={{color:"#1A5FA8",textDecoration:"none",fontWeight:600}}>{selLead.email}</a>});
        if(selLead.nationality_iso2) items.push({icon:"🌍", label:"Nationality", val:`${iso2ToFlag(selLead.nationality_iso2)} ${refCountries.find(c=>c.iso2===selLead.nationality_iso2)?.name_en || selLead.nationality_iso2}`});
        else if(selLead.nationality) items.push({icon:"🌍", label:"Nationality", val:selLead.nationality});
        if(selLead.residence_iso2) items.push({icon:"🏠", label:"Residence", val:`${iso2ToFlag(selLead.residence_iso2)} ${refCountries.find(c=>c.iso2===selLead.residence_iso2)?.name_en || selLead.residence_iso2}`});
        if(selLead.tax_residency_iso2 && selLead.tax_residency_iso2!==selLead.residence_iso2) items.push({icon:"💼", label:"Tax residency", val:`${iso2ToFlag(selLead.tax_residency_iso2)} ${refCountries.find(c=>c.iso2===selLead.tax_residency_iso2)?.name_en || selLead.tax_residency_iso2}`});
        if(selLead.source_of_funds) items.push({icon:"💰", label:"Source of funds", val:SOF_LABEL[selLead.source_of_funds]||selLead.source_of_funds});
        if(selLead.source) items.push({icon:"📍", label:"Lead source", val:selLead.source});
        if(selLead.property_type) items.push({icon:"🔍", label:"Looking for", val:selLead.property_type});
        if(selLead.budget&&Number(selLead.budget)>0) items.push({icon:"💵", label:"Budget", val:`AED ${Number(selLead.budget).toLocaleString()}`});
        if(selLead.legal_name_en && selLead.legal_name_en!==selLead.name) items.push({icon:"📛", label:"Legal name", val:selLead.legal_name_en});
        if(selLead.legal_name_ar) items.push({icon:"📛", label:"Legal (Arabic)", val:<span style={{direction:"rtl",unicodeBidi:"bidi-override",fontFamily:"'Noto Sans Arabic','Inter',sans-serif"}}>{selLead.legal_name_ar}</span>});
        if(items.length===0 && !selLead.notes) return null;
        return (
          <div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:12,padding:"12px 16px",marginBottom:14}}>
            {items.length>0 && (
              <div style={{display:"flex",flexWrap:"wrap",gap:"8px 22px",alignItems:"center"}}>
                {items.map((it,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:7,fontSize:12,minWidth:0}}>
                    <span style={{fontSize:13,opacity:.85}}>{it.icon}</span>
                    <span style={{color:"#94A3B8",fontWeight:500}}>{it.label}:</span>
                    <span style={{color:"#0F2540",fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:240}}>{it.val}</span>
                  </div>
                ))}
              </div>
            )}
            {selLead.notes && (
              <div style={{marginTop:items.length>0?10:0,paddingTop:items.length>0?10:0,borderTop:items.length>0?"1px dashed #EEF2F7":"none",display:"flex",gap:10,alignItems:"flex-start"}}>
                <span style={{fontSize:10,color:"#8A6200",textTransform:"uppercase",letterSpacing:".5px",fontWeight:700,minWidth:50,paddingTop:1}}>Notes</span>
                <div style={{fontSize:12,color:"#3A3A2E",whiteSpace:"pre-wrap",lineHeight:1.5,flex:1}}>{selLead.notes}</div>
              </div>
            )}
          </div>
        );
      })()}
      {/* Phase 2.2B — People section (Contacts Subsystem, read-only) */}
      <LeadPeopleSection leadId={selLead.id} companyId={currentUser?.company_id} currentUserId={currentUser?.id} countries={refCountries} />

      {/* 23 May 2026: Lead-stage Activities section (restored from April original design) */}
      {(()=>{
        const leadActs = activities.filter(a=>a.lead_id===selLead.id);
        const upcomingCount = leadActs.filter(a=>a.status==="upcoming"||(a.scheduled_at&&new Date(a.scheduled_at)>new Date()&&a.status!=="completed"&&a.status!=="no_show"&&a.status!=="cancelled")).length;
        return (
          <div style={{marginBottom:14}}>
            {/* Log Activity action row */}
            <div style={{background:"#F8FAFC",border:"1px solid #E8EDF4",borderRadius:10,padding:"10px 14px",marginBottom:10}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
                <div style={{fontSize:10,fontWeight:700,color:"#94A3B8",textTransform:"uppercase",letterSpacing:".6px"}}>Log activity</div>
                {leadActs.length>0&&(
                  <div style={{fontSize:10,color:"#64748B"}}>
                    {leadActs.length} total{upcomingCount>0?(" · "+upcomingCount+" upcoming"):""}
                  </div>
                )}
              </div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                <button onClick={()=>{setLeadLogForm({type:"Call",note:"",scheduled_at:"",duration_mins:"",ns_enabled:false,ns_type:"Call",ns_due:"",ns_note:""});setShowLeadLog(true);}}
                  style={{padding:"6px 12px",borderRadius:7,border:"1.5px solid #E2E8F0",background:"#fff",fontSize:11,fontWeight:600,cursor:"pointer",color:"#0F2540"}}>
                  📞 Log Call
                </button>
                <button onClick={()=>{setLeadLogForm({type:"WhatsApp",note:"",scheduled_at:"",duration_mins:"",ns_enabled:false,ns_type:"WhatsApp",ns_due:"",ns_note:""});setShowLeadLog(true);}}
                  style={{padding:"6px 12px",borderRadius:7,border:"1.5px solid #E2E8F0",background:"#fff",fontSize:11,fontWeight:600,cursor:"pointer",color:"#0F2540"}}>
                  💬 WhatsApp
                </button>
                <button onClick={()=>{setLeadLogForm({type:"Meeting",note:"",scheduled_at:"",duration_mins:"",ns_enabled:false,ns_type:"Call",ns_due:"",ns_note:""});setShowLeadLog(true);}}
                  style={{padding:"6px 12px",borderRadius:7,border:"1.5px solid #E2E8F0",background:"#fff",fontSize:11,fontWeight:600,cursor:"pointer",color:"#0F2540"}}>
                  🤝 Meeting
                </button>
                <button onClick={()=>{setLeadLogForm({type:"Email",note:"",scheduled_at:"",duration_mins:"",ns_enabled:false,ns_type:"Email",ns_due:"",ns_note:""});setShowLeadLog(true);}}
                  style={{padding:"6px 12px",borderRadius:7,border:"1.5px solid #E2E8F0",background:"#fff",fontSize:11,fontWeight:600,cursor:"pointer",color:"#0F2540"}}>
                  ✉️ Email
                </button>
                <button onClick={()=>{setLeadLogForm({type:"Note",note:"",scheduled_at:"",duration_mins:"",ns_enabled:false,ns_type:"Call",ns_due:"",ns_note:""});setShowLeadLog(true);}}
                  style={{padding:"6px 12px",borderRadius:7,border:"1.5px solid #E2E8F0",background:"#fff",fontSize:11,fontWeight:600,cursor:"pointer",color:"#0F2540"}}>
                  📝 Add Note
                </button>
              </div>
            </div>
            {/* ActivitiesList - render full lifecycle (upcoming/past, outcomes, etc.) for this lead */}
            {leadActs.length>0&&(
              <ActivitiesList activities={leadActs} setActivities={setActivities} opp={null} canEdit={canEdit} showToast={showToast} currentStage={null} units={units}/>
            )}
          </div>
        );
      })()}
      {/* Opportunities — dense table layout */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:700,color:"#0F2540"}}>
          Opportunities ({leadOpps.length})
        </div>
        {leadOpps.length>0&&(
          <div style={{fontSize:11,color:"#94A3B8"}}>
            Click any row to open the opportunity
          </div>
        )}
      </div>
      <div style={{flex:1,overflowY:"auto"}}>
        {leadOpps.length===0&&(
          <div style={{textAlign:"center",padding:"3rem",color:"#A0AEC0",background:"#fff",border:"1px dashed #E2E8F0",borderRadius:12}}>
            <div style={{fontSize:36,marginBottom:10}}>🎯</div>
            <div style={{fontSize:14,fontWeight:600,color:"#0F2540",marginBottom:6}}>No opportunities yet</div>
            <div style={{fontSize:12,marginBottom:16}}>Add an opportunity for each property this contact is interested in</div>
            {canEdit&&<button onClick={()=>setShowCanonicalOppDialog(true)} style={{padding:"10px 24px",borderRadius:8,border:"none",background:"#0F2540",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>+ Add First Opportunity</button>}
          </div>
        )}
        {/* 23 May 2026: Lead-stage Activity Log Dialog - full feature parity with Opp Detail */}
        {showLeadLog && (
          <LogActivityModal
            lead={selLead}
            opp={null}
            currentUser={currentUser}
            showToast={showToast}
            defaultType={leadLogForm.type||"Call"}
            onClose={()=>setShowLeadLog(false)}
            onSaved={async(data, nextStepIntent)=>{
              setActivities(p=>[data,...p]);
              if(nextStepIntent && nextStepIntent.due){
                const triggerAt = new Date(nextStepIntent.due);
                triggerAt.setHours(9,0,0,0);
                const{error:remErr}=await supabase.from("reminders").insert({
                  company_id: currentUser.company_id || null,
                  user_id: currentUser.id,
                  related_lead_id: selLead.id,
                  related_activity_id: data.id,
                  trigger_at: triggerAt.toISOString(),
                  title: `${nextStepIntent.type} — ${selLead.name}`,
                  body: nextStepIntent.note || "",
                  reason: "lead_followup",
                  status: "pending",
                });
                if(remErr) console.warn("Reminder create failed:", remErr.message);
              }
              setShowLeadLog(false);
            }}
          />
        )}

        {leadOpps.length>0&&(
          <div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:12,overflow:"hidden"}}>
            {/* Header row */}
            <div style={{
              display:"grid",
              gridTemplateColumns:"110px minmax(220px,1.7fr) 130px 110px minmax(180px,1.4fr) 70px 28px",
              gap:12,padding:"9px 14px",
              background:"#F8FAFC",borderBottom:"1px solid #E2E8F0",
              fontSize:10,fontWeight:700,color:"#64748B",textTransform:"uppercase",letterSpacing:".5px",
            }}>
              <div>Stage</div>
              <div>Title · Unit</div>
              <div style={{textAlign:"right"}}>Value</div>
              <div>In stage</div>
              <div>Last activity</div>
              <div>Owner</div>
              <div></div>
            </div>

            {/* Data rows */}
            {leadOpps.map((opp,idx)=>{
              const unit=units.find(u=>u.id===opp.unit_id);
              const proj=unit?projects.find(p=>p.id===unit.project_id):null;
              const sp=unit?salePricing.find(s=>s.unit_id===unit.id):null;
              const sm3=OPP_STAGE_META[opp.stage]||{c:"#718096",bg:"#F7F9FC"};
              const agent=users.find(u=>u.id===opp.assigned_to);
              const oppActivities = leadActivities.filter(a=>a.opportunity_id===opp.id);
              const lastAct = oppActivities[0];
              const fmtRelative = (d)=>{
                const diff = (new Date() - new Date(d)) / 1000;
                if(diff<60) return "just now";
                if(diff<3600) return `${Math.floor(diff/60)}m ago`;
                if(diff<86400) return `${Math.floor(diff/3600)}h ago`;
                const days = Math.floor(diff/86400);
                return days===1?"1d ago":`${days}d ago`;
              };
              const actIcons = {Call:"📞",Email:"✉️",Meeting:"🤝",Visit:"🏠","Site Visit":"🏠",WhatsApp:"💬",Note:"📝","Stage Change":"🎯",Proposal:"📄"};
              const lastActText = lastAct ? (lastAct.structured_data?.discussion || lastAct.structured_data?.feedback || lastAct.note || "") : "";
              const lastActPreview = lastActText.slice(0,55) + (lastActText.length>55?"…":"");
              const stageAge = opp.stage_updated_at?Math.floor((new Date()-new Date(opp.stage_updated_at))/864e5):null;
              const isStale = stageAge!==null && stageAge>=7 && opp.status==="Active";
              const stageAgeLabel = stageAge===null?"—":stageAge===0?"today":stageAge===1?"1 day":`${stageAge} days`;
              const initials = (agent?.full_name||"?").split(" ").map(w=>w[0]).filter(Boolean).slice(0,2).join("").toUpperCase();
              const value = sp?.asking_price || opp.budget || null;

              return (
                <div key={opp.id}
                  onClick={()=>{
                    // Phase F W5 cut-over — navigate to Opportunities tab.
                    // Falls back to in-Leads view if prop wasn't passed.
                    if (onNavigateToOpp) onNavigateToOpp(opp.id);
                    else { setSelOpp(opp); setView("opportunity"); }
                  }}
                  onMouseOver={e=>{e.currentTarget.style.background="#F8FAFC";}}
                  onMouseOut={e=>{e.currentTarget.style.background="#fff";}}
                  style={{
                    display:"grid",
                    gridTemplateColumns:"110px minmax(220px,1.7fr) 130px 110px minmax(180px,1.4fr) 70px 28px",
                    gap:12,padding:"11px 14px",
                    borderTop: idx===0?"none":"1px solid #EEF2F7",
                    borderLeft:`3px solid ${sm3.c}`,
                    cursor:"pointer",transition:"background .12s",
                    alignItems:"center",
                    background:"#fff",
                  }}>

                  {/* Stage */}
                  <div style={{minWidth:0}}>
                    <span style={{
                      display:"inline-block",fontSize:10,fontWeight:700,padding:"3px 9px",borderRadius:20,
                      background:sm3.bg,color:sm3.c,whiteSpace:"nowrap",
                    }}>{opp.stage}</span>
                    {opp.status==="Won"&&<div style={{fontSize:9,fontWeight:700,color:"#1A7F5A",marginTop:3}}>✓ WON</div>}
                    {opp.status==="Lost"&&<div style={{fontSize:9,fontWeight:700,color:"#718096",marginTop:3}}>LOST</div>}
                    {opp.status==="On Hold"&&<div style={{fontSize:9,fontWeight:700,color:"#8A6200",marginTop:3}}>ON HOLD</div>}
                  </div>

                  {/* Title + Unit/Project */}
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:700,color:"#0F2540",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {opp.title||"Opportunity"}
                    </div>
                    <div style={{fontSize:11,color:"#64748B",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginTop:2}}>
                      {unit ? `🏠 ${unit.unit_ref}${unit.sub_type?` · ${unit.sub_type}`:""}${proj?` · ${proj.name}`:""}` : <span style={{color:"#94A3B8",fontStyle:"italic"}}>No unit linked</span>}
                    </div>
                  </div>

                  {/* Value */}
                  <div style={{textAlign:"right",minWidth:0}}>
                    {value ? (
                      <>
                        <div style={{fontSize:13,fontWeight:700,color:"#1A5FA8"}}>AED {Number(value).toLocaleString()}</div>
                        {sp ? null : <div style={{fontSize:9,color:"#94A3B8",fontWeight:600,marginTop:1}}>budget</div>}
                      </>
                    ) : (
                      <span style={{fontSize:11,color:"#CBD5E1"}}>—</span>
                    )}
                  </div>

                  {/* In stage */}
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:12,color:isStale?"#C53030":"#475569",fontWeight:isStale?700:500}}>
                      {stageAgeLabel}
                    </div>
                    {isStale&&<div style={{fontSize:9,fontWeight:700,color:"#C53030",marginTop:1}}>⚠ STALE</div>}
                    {opp.proposal_sent_at&&<div style={{fontSize:9,color:"#A06810",marginTop:1}}>📤 sent {fmtDate(opp.proposal_sent_at)}</div>}
                  </div>

                  {/* Last activity */}
                  <div style={{minWidth:0,fontSize:11,color:"#475569",overflow:"hidden"}}>
                    {lastAct ? (
                      <>
                        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:1}}>
                          <span style={{fontSize:12}}>{actIcons[lastAct.type]||"📋"}</span>
                          <span style={{color:"#94A3B8",fontWeight:600,fontSize:10}}>{fmtRelative(lastAct.created_at)}</span>
                          {lastAct.stage_at_event&&<span style={{fontSize:9,fontWeight:700,padding:"1px 5px",borderRadius:6,background:"#F1F5F9",color:"#64748B"}}>{lastAct.stage_at_event}</span>}
                        </div>
                        {lastActPreview&&<div style={{fontSize:11,color:"#64748B",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontStyle:"italic"}}>"{lastActPreview}"</div>}
                      </>
                    ) : (
                      <span style={{fontSize:11,color:"#94A3B8",fontStyle:"italic"}}>No activity yet</span>
                    )}
                  </div>

                  {/* Owner */}
                  <div style={{minWidth:0}} title={agent?.full_name||"Unassigned"}>
                    {agent ? (
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <div style={{width:24,height:24,borderRadius:"50%",background:"#0F2540",color:"#C9A84C",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,flexShrink:0}}>
                          {initials}
                        </div>
                      </div>
                    ) : (
                      <span style={{fontSize:11,color:"#CBD5E1"}}>—</span>
                    )}
                  </div>

                  {/* Chevron */}
                  <div style={{textAlign:"right",color:"#CBD5E1",fontSize:14}}>›</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Opportunity Modal */}
      {/* 16 May 2026: Canonical opportunity dialog (consolidation) */}
      {showCanonicalOppDialog && (
        <CreateOpportunityDialog
          leads={leads}
          setLeads={setLeads}
          units={units}
          projects={projects}
          salePricing={salePricing}
          users={users}
          currentUser={currentUser}
          showToast={showToast}
          prefilledLead={selLead}
          onClose={() => setShowCanonicalOppDialog(false)}
          onCreated={(newOpp, newLead) => {
            // Update LOCAL opps (what leadOpps filters on) so the new opp appears
            // on this lead's Opportunities list immediately — broker stays in
            // context and can add more for the same buyer. Also sync global list.
            setOpps(prev => prev.find(o=>o.id===newOpp.id) ? prev : [newOpp, ...prev]);
            if (setGlobalOpps) setGlobalOpps(prev => prev.find(o=>o.id===newOpp.id) ? prev : [newOpp, ...prev]);
            setShowCanonicalOppDialog(false);
          }}
        />
      )}
      {showAddOpp&&(
        <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,.65)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1100,padding:"1rem"}}>
          <div style={{background:"#fff",borderRadius:16,width:500,maxWidth:"100%",maxHeight:"90vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 24px 64px rgba(11,31,58,.4)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"1rem 1.5rem",borderBottom:"1px solid #E8EDF4",background:"#fff"}}>
              <div>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:16,fontWeight:700,color:"#0F2540"}}>🎯 New Opportunity</div>
                <div style={{fontSize:11,color:"#64748B",marginTop:2}}>for {selLead.name}</div>
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
                  {/* 13 May 2026: Replaced plain <select> with rich UnitPickerRich for demo consistency */}
                  {/* Preserves: title auto-fill on selection. Filters: Available + Sale/Both purpose. */}
                  <UnitPickerRich
                    value={oppForm.unit_id}
                    onSelect={(unitId) => {
                      const u = units.find(x => x.id === unitId);
                      setOppForm(f => ({
                        ...f,
                        unit_id: unitId,
                        title: u && !f.title ? `${u.unit_ref} — ${selLead?.name || ""}` : f.title
                      }));
                    }}
                    units={units.filter(u => u.status === "Available" && (u.purpose === "Sale" || u.purpose === "Both"))}
                    projects={projects}
                    salePricing={salePricing}
                  />
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
      {/* Phase 2.1 — Floating Action Button for activity logging */}
      <button
        onClick={()=>{
          setLeadLogForm({type:"Call",note:"",scheduled_at:"",duration_mins:"",ns_enabled:false,ns_type:"Call",ns_due:"",ns_note:""});
          setShowLeadLog(true);
        }}
        title="Log activity"
        style={{
          position:"fixed",
          bottom:24,
          right:24,
          width:56,
          height:56,
          borderRadius:"50%",
          border:"none",
          background:"#0F2540",
          color:"#fff",
          fontSize:24,
          fontWeight:700,
          cursor:"pointer",
          boxShadow:"0 6px 20px rgba(11,31,58,.35)",
          zIndex:900,
          display:"flex",
          alignItems:"center",
          justifyContent:"center"
        }}
      >+</button>
      {/* Phase 2.2A — V2 dual-mode form for Edit Contact from Lead Detail */}
      {showAddV2&&(
        <LeadCreationFormV2
          key={`${editLeadForV2?.id || "new"}-${editFormVersion}`}
          companyId={currentUser?.company_id}
          countries={refCountries}
          rules={refRules}
          currentUserId={currentUser?.id}
          editLead={editLeadForV2}
          onSubmit={async(payload)=>{
            if(editLeadForV2){
              const {data,error}=await supabase.from("leads").update(payload).eq("id",editLeadForV2.id).select().single();
              if(error) throw new Error(error.message||"Failed to update contact");
              return data;
            } else {
              const {data,error}=await supabase.from("leads").insert(payload).select().single();
              if(error) throw new Error(error.message||"Failed to create contact");
              return data;
            }
          }}
          onCancel={()=>{setShowAddV2(false);setEditLeadForV2(null);}}
          onCreated={(savedLead)=>{
            setShowAddV2(false);
            if(editLeadForV2){
              setLeads(p=>p.map(l=>l.id===savedLead.id?savedLead:l));
              showToast("Contact updated","success");
            } else {
              setLeads(p=>[savedLead,...p]);
              writeBrokerCreatedLog(savedLead, currentUser);
              showToast("Contact added","success");
            }
            setEditLeadForV2(null);
          }}
        />
      )}
    </div>
  );

  // ── OPPORTUNITY DETAIL VIEW ────────────────────────────────────
  if(view==="opportunity"&&selOpp) return (
    <OpportunityDetail
      key={selOpp.id}
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
      onActivityLog={(type)=>{setShowActivityModal({lead: selLead || leads.find(l=>l.id===selOpp.lead_id) || {}}); }}
    />
  );

  return null;
}


function CoachPage({ opps, leads, activities, users, currentUser, showToast, onNavigateToOpp }) {
  const role = currentUser?.role || "sales_agent";
  const isManager = ["super_admin", "admin", "sales_manager"].includes(role);
  const SCOPES = [
    { id: "mine",      label: "My Pipeline",  icon: "👤", managerOnly: false },
    { id: "all_opps",  label: "All Opportunities", icon: "🎯", managerOnly: false },
    { id: "attention", label: "Needs Attention",   icon: "🚨", managerOnly: false },
    { id: "stage",     label: "By Stage",     icon: "📊", managerOnly: false },
    { id: "segment",   label: "By Segment",   icon: "🎯", managerOnly: false },
    { id: "portfolio", label: "Portfolio",    icon: "🏛", managerOnly: true  },
  ].filter(s => isManager || !s.managerOnly);
  const [scope, setScope] = useState("mine");
  const [stageFilter, setStageFilter] = useState("Negotiation");
  const [segmentFilter, setSegmentFilter] = useState("investor");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const SEGMENTS = [
    { id: "investor", label: "Investor" },
    { id: "owner_occupier", label: "Owner-Occupier" },
    { id: "hybrid", label: "Hybrid" },
    { id: "corporate", label: "Corporate" },
    { id: "reseller", label: "Reseller" },
  ];
  const AI_PURPLE = "#6D28D9";
  const AI_TEAL = "#0E7490";
  const gradient = `linear-gradient(135deg, ${AI_PURPLE} 0%, ${AI_TEAL} 100%)`;

  // ── Gather the deals for the selected scope (Phase 2) ──
  const activeOpps = (opps || []).filter(o =>
    o.stage !== "Closed Won" && o.stage !== "Closed Lost" && o.status !== "On Hold" && o.status !== "Cancelled"
  );
  const scopedOpps = (() => {
    if (scope === "mine") return activeOpps.filter(o => o.assigned_to === currentUser?.id);
    if (scope === "all_opps") return isManager ? activeOpps : activeOpps.filter(o => o.assigned_to === currentUser?.id);
    if (scope === "attention") {
      const base = isManager ? activeOpps : activeOpps.filter(o => o.assigned_to === currentUser?.id);
      return base.filter(o => {
        const acts = (activities || []).filter(a => a.opportunity_id === o.id).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        const lastAt = acts[0]?.created_at || o.stage_updated_at || o.created_at;
        const daysSince = lastAt ? Math.floor((Date.now() - new Date(lastAt).getTime()) / 86400000) : 999;
        const daysStage = o.stage_updated_at ? Math.floor((Date.now() - new Date(o.stage_updated_at).getTime()) / 86400000) : 0;
        return daysSince >= 7 || daysStage >= 14;
      });
    }
    if (scope === "stage") {
      const base = isManager ? activeOpps : activeOpps.filter(o => o.assigned_to === currentUser?.id);
      return base.filter(o => o.stage === stageFilter);
    }
    if (scope === "segment") {
      const base = isManager ? activeOpps : activeOpps.filter(o => o.assigned_to === currentUser?.id);
      return base.filter(o => {
        const ld = (leads || []).find(l => l.id === o.lead_id);
        return ld?.buyer_intent === segmentFilter;
      });
    }
    if (scope === "portfolio") return isManager ? activeOpps : [];
    return [];
  })();
  // Enrich each opp with the context the AI needs
  const enrichedDeals = scopedOpps.map(o => {
    const ld = (leads || []).find(l => l.id === o.lead_id);
    const oppActs = (activities || []).filter(a => a.opportunity_id === o.id)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const lastActAt = oppActs[0]?.created_at || o.stage_updated_at || o.created_at;
    const daysInStage = o.stage_updated_at ? Math.floor((Date.now() - new Date(o.stage_updated_at).getTime()) / 86400000) : null;
    const daysSinceActivity = lastActAt ? Math.floor((Date.now() - new Date(lastActAt).getTime()) / 86400000) : null;
    const agent = (users || []).find(u => u.id === o.assigned_to);
    return {
      id: o.id,
      title: o.title || "(untitled)",
      lead_name: ld?.name || "Unknown",
      buyer_intent: ld?.buyer_intent || null,
      stage: o.stage,
      value: o.budget || null,
      days_in_stage: daysInStage,
      days_since_activity: daysSinceActivity,
      activity_count: oppActs.length,
      agent_name: agent?.full_name || "Unassigned",
    };
  }).sort((a, b) => (b.days_since_activity || 0) - (a.days_since_activity || 0));

  const dealCount = enrichedDeals.length;
  const totalValue = enrichedDeals.reduce((s, d) => s + (d.value || 0), 0);

  // ── Phase 3: AI analysis of the selected cross-section ──
  const scopeLabel = SCOPES.find(s => s.id === scope)?.label || scope;
  const scopeDescription = (() => {
    if (scope === "stage") return `deals in the "${stageFilter}" stage`;
    if (scope === "segment") return `${SEGMENTS.find(s => s.id === segmentFilter)?.label || segmentFilter} buyers`;
    if (scope === "attention") return "deals that are stalling (no recent activity or stuck in stage)";
    if (scope === "portfolio") return "the entire company's active pipeline";
    if (scope === "all_opps") return "all active opportunities";
    return "your active pipeline";
  })();

  const runBroadCoach = async () => {
    if (dealCount === 0) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      // Keep payload lean — cap at 40 deals to control tokens
      const dealsForAI = enrichedDeals.slice(0, 40).map(d => ({
        id: d.id,
        deal: d.title,
        buyer: d.lead_name,
        intent: d.buyer_intent,
        stage: d.stage,
        value_aed: d.value,
        days_in_stage: d.days_in_stage,
        days_since_activity: d.days_since_activity,
        activities_logged: d.activity_count,
        agent: d.agent_name,
      }));
      const system = `You are PropPulse Coach, an expert UAE real-estate sales advisor reviewing a CROSS-SECTION of a brokerage's pipeline (not a single deal). Your job: read the set of deals and surface the MOST IMPORTANT things the user should act on now. Be specific — name actual deals, cite their stage/value/staleness. Respect UAE norms (DLD 4%, off-plan vs ready, payment plans 10/90, 20/80, 50/50, 40/60). Prioritise deals at risk (stale, stuck) and high-value opportunities. Always respond with valid JSON only — no prose, no markdown fences. Confidence is one of "high", "medium", "low".`;
      const userPrompt = `Analyse this cross-section of the pipeline: ${scopeDescription}.
SCOPE: ${scopeLabel}
DEAL COUNT: ${dealCount}
TOTAL VALUE: AED ${(totalValue/1e6).toFixed(2)}M

DEALS (sorted by staleness, most stale first):
${JSON.stringify(dealsForAI, null, 2)}

TASK: Give a portfolio-level read, then rank the specific deals that need attention most. Reference actual deals by name.
RESPOND WITH VALID JSON ONLY in this exact shape:
{
  "summary": "<2-3 sentence read of this cross-section — health, risks, where to focus>",
  "deals": [
    {
      "deal_id": "<the id field from the deal>",
      "deal_name": "<deal name>",
      "priority": "high" | "medium" | "low",
      "issue": "<what's wrong or the opportunity — cite specifics>",
      "recommended_move": "<the single next action for this deal>"
    }
  ]
}
Rank up to 6 deals, highest priority first. If a deal is healthy, you may omit it.`;
      const reply = await aiInvoke({ system, prompt: userPrompt, max_tokens: 3000 });
      const cleaned = reply.replace(/```json\s*/g, "").replace(/```\s*$/g, "").trim();
      // Robust JSON parse — LLMs sometimes emit trailing commas, smart quotes, or partial trailing junk
      const tryParse = (s) => {
        try { return JSON.parse(s); } catch { return null; }
      };
      const normalize = (s) => s
        .replace(/[\u201C\u201D]/g, '"')   // smart double quotes → "
        .replace(/[\u2018\u2019]/g, "'")   // smart single quotes → '
        .replace(/,(\s*[\}\]])/g, "$1");   // strip trailing commas
      let parsed = tryParse(cleaned) || tryParse(normalize(cleaned));
      if (!parsed) {
        const m = cleaned.match(/\{[\s\S]*\}/);
        if (m) parsed = tryParse(m[0]) || tryParse(normalize(m[0]));
      }
      if (!parsed) throw new Error("AI response was not valid JSON");
      setResult({
        summary: parsed.summary || "",
        deals: Array.isArray(parsed.deals) ? parsed.deals.slice(0, 6) : [],
        scope: scopeLabel,
        analysed_at: new Date().toISOString(),
      });
    } catch (e) {
      console.error("Broad Coach failed:", e);
      setError(`Couldn't analyse: ${e.message || "unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <span style={{ fontSize: 26 }}>✨</span>
          <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, fontWeight: 800, color: "#0F2540", margin: 0, letterSpacing: "-.5px" }}>AI Coach</h1>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", background: gradient, padding: "3px 9px", borderRadius: 20, letterSpacing: ".5px" }}>BETA</span>
        </div>
        <p style={{ fontSize: 13, color: "#64748B", margin: 0, lineHeight: 1.5 }}>
          Honest, AI-powered review of your deals. Point it at any slice of your book — your pipeline, a stage, a buyer segment{isManager ? ", or the whole portfolio" : ""} — and get the moves that matter most.
        </p>
      </div>
      <div style={{ background: "#fff", border: "1px solid #E8EDF4", borderRadius: 14, padding: "16px 18px", marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 10 }}>What should I analyse?</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          {SCOPES.map(s => {
            const active = scope === s.id;
            return (
              <button key={s.id} onClick={() => { setScope(s.id); setResult(null); setError(""); }}
                style={{ padding: "9px 16px", borderRadius: 10, cursor: "pointer",
                  border: active ? `1.5px solid ${AI_PURPLE}` : "1.5px solid #E2E8F0",
                  background: active ? "linear-gradient(135deg, #EDE9FE 0%, #CCFBF1 100%)" : "#F8FAFC",
                  color: active ? "#0F2540" : "#64748B", fontWeight: active ? 700 : 600, fontSize: 13,
                  display: "flex", alignItems: "center", gap: 7,
                  boxShadow: active ? "0 0 0 3px rgba(109,40,217,.08)" : "none", transition: "all .15s" }}>
                <span style={{ fontSize: 15 }}>{s.icon}</span><span>{s.label}</span>
              </button>
            );
          })}
        </div>
        {scope === "stage" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>Stage:</span>
            {STAGES.map(st => (
              <button key={st} onClick={() => setStageFilter(st)}
                style={{ padding: "5px 11px", borderRadius: 8, fontSize: 11, cursor: "pointer", fontWeight: stageFilter === st ? 700 : 500,
                  border: stageFilter === st ? `1.5px solid ${AI_TEAL}` : "1.5px solid #E2E8F0",
                  background: stageFilter === st ? "#CCFBF1" : "#fff", color: stageFilter === st ? "#0F2540" : "#64748B" }}>{st}</button>
            ))}
          </div>
        )}
        {scope === "segment" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>Segment:</span>
            {SEGMENTS.map(sg => (
              <button key={sg.id} onClick={() => setSegmentFilter(sg.id)}
                style={{ padding: "5px 11px", borderRadius: 8, fontSize: 11, cursor: "pointer", fontWeight: segmentFilter === sg.id ? 700 : 500,
                  border: segmentFilter === sg.id ? `1.5px solid ${AI_TEAL}` : "1.5px solid #E2E8F0",
                  background: segmentFilter === sg.id ? "#CCFBF1" : "#fff", color: segmentFilter === sg.id ? "#0F2540" : "#64748B" }}>{sg.label}</button>
            ))}
          </div>
        )}
        {scope === "portfolio" && isManager && (
          <div style={{ fontSize: 12, color: "#64748B", fontStyle: "italic" }}>Analysing every active deal across the company.</div>
        )}
        {scope === "mine" && (
          <div style={{ fontSize: 12, color: "#64748B", fontStyle: "italic" }}>Analysing all of your active deals.</div>
        )}
        {scope === "all_opps" && (
          <div style={{ fontSize: 12, color: "#64748B", fontStyle: "italic" }}>Analysing {isManager ? "every active deal" : "all your active deals"} as one book.</div>
        )}
        {scope === "attention" && (
          <div style={{ fontSize: 12, color: "#B45309", fontStyle: "italic" }}>🚨 Deals stalling — no activity 7+ days or stuck in stage 14+ days.</div>
        )}
      </div>
      <div style={{ background: "#fff", border: "1px solid #E8EDF4", borderRadius: 14, padding: "28px 20px", textAlign: "center" }}>
        <div style={{ fontSize: 13, color: "#64748B", marginBottom: 14 }}>
          {dealCount > 0 ? (
            <>Found <strong style={{ color: "#0F2540", fontSize: 18 }}>{dealCount}</strong> active {dealCount === 1 ? "deal" : "deals"}
              {totalValue > 0 ? <> · <strong style={{ color: "#0F2540" }}>AED {(totalValue / 1e6).toFixed(2)}M</strong> total value</> : null}</>
          ) : (
            <span style={{ color: "#94A3B8" }}>No active deals match this scope.</span>
          )}
        </div>
        <button onClick={runBroadCoach} disabled={dealCount === 0 || loading}
          style={{ padding: "11px 28px", borderRadius: 10, border: "none",
            background: (dealCount === 0 || loading) ? "#CBD5E1" : "linear-gradient(135deg, #6D28D9 0%, #0E7490 100%)",
            color: "#fff", fontSize: 14, fontWeight: 700, cursor: (dealCount === 0 || loading) ? "not-allowed" : "pointer",
            boxShadow: (dealCount === 0 || loading) ? "none" : "0 2px 10px rgba(109,40,217,.25)" }}>
          {loading ? "✨ Analysing…" : `✨ Analyse ${dealCount > 0 ? `${dealCount} ${dealCount === 1 ? "deal" : "deals"}` : ""}`}
        </button>

        {error && (
          <div style={{ marginTop: 16, padding: "12px 16px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, color: "#B91C1C", fontSize: 13 }}>
            {error}
          </div>
        )}

        {result && !loading && (
          <div style={{ marginTop: 22, textAlign: "left" }}>
            {/* Summary */}
            <div style={{ padding: "16px 18px", borderRadius: 12, background: "linear-gradient(135deg, #F5F3FF 0%, #ECFEFF 100%)", border: "1px solid #DDD6FE", marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#6D28D9", textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 6 }}>
                ✨ Coach read · {result.scope}
              </div>
              <div style={{ fontSize: 14, color: "#0F2540", lineHeight: 1.6, fontWeight: 500 }}>{result.summary}</div>
            </div>
            {/* Ranked deals */}
            {result.deals.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {result.deals.map((d, i) => {
                  const pc = d.priority === "high" ? { c: "#DC2626", bg: "#FEE2E2", l: "HIGH" }
                    : d.priority === "medium" ? { c: "#D97706", bg: "#FEF3C7", l: "MEDIUM" }
                    : { c: "#0891B2", bg: "#CFFAFE", l: "LOW" };
                  return (
                    <div key={i} onClick={() => d.deal_id && onNavigateToOpp && onNavigateToOpp(d.deal_id)}
                      style={{ padding: "14px 16px", borderRadius: 12, background: "#fff", border: "1px solid #E8EDF4", cursor: d.deal_id ? "pointer" : "default", transition: "all .15s" }}
                      onMouseEnter={e => { if (d.deal_id) { e.currentTarget.style.borderColor = "#A5B4FC"; e.currentTarget.style.boxShadow = "0 2px 12px rgba(109,40,217,.08)"; } }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = "#E8EDF4"; e.currentTarget.style.boxShadow = "none"; }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: pc.c, background: pc.bg, padding: "2px 8px", borderRadius: 20 }}>{pc.l}</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "#0F2540" }}>{d.deal_name}</span>
                        {d.deal_id && onNavigateToOpp && <span style={{ fontSize: 11, color: "#94A3B8", marginLeft: "auto" }}>Open →</span>}
                      </div>
                      <div style={{ fontSize: 12.5, color: "#64748B", lineHeight: 1.55, marginBottom: 6 }}>{d.issue}</div>
                      <div style={{ fontSize: 12.5, color: "#0F2540", lineHeight: 1.55 }}>
                        <strong style={{ color: "#6D28D9" }}>Next:</strong> {d.recommended_move}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div style={{ marginTop: 14, textAlign: "center" }}>
              <button onClick={runBroadCoach} style={{ background: "none", border: "none", color: "#6D28D9", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>↻ Re-analyse</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
function LogActivityModal({lead, opp, currentUser, showToast, onClose, onSaved, defaultType="Call"}) {
  // Canonical activity-logging modal (Day 18 consolidation).
  // Used by BOTH Opportunity Detail and Lead Detail. Handles the universal
  // parts: type, status, duration, person-tagging, notes, next-step inputs,
  // note-text composition, and the activities INSERT (with person_id +
  // stage_at_event when an opp is present).
  //
  // Reminder creation is NOT done here — the modal returns the next-step
  // intent to the parent via onSaved(activity, nextStepIntent). Each parent
  // owns its reminders state, so it creates the reminder + updates its panel.
  const [form, setForm] = useState({
    type: defaultType, note:"", scheduled_at:"", duration_mins:"", status:"completed",
    person_id:"", ns_enabled:false, ns_type:"Call", ns_due:"", ns_note:"",
  });
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);  // Day 18: synchronous double-click guard (ref flips instantly, before re-render)
  const { persons: actPersons } = useLeadPersons(lead?.id);
  const sf = k => e => setForm(f=>({...f,[k]:e.target.value}));

  const save = async() => {
    if(!lead){showToast("No lead found","error");return;}
    const hasNextStep = form.ns_enabled && form.ns_due;
    if(!(form.note||"").trim() && !hasNextStep){showToast("Please add discussion notes or set a next step","error");return;}
    if(savingRef.current) return;  // Day 18: block double-click — a save already in flight
    savingRef.current = true;
    setSaving(true);
    try{
      const isScheduled = form.scheduled_at && new Date(form.scheduled_at) > new Date();
      const nsLine = hasNextStep ? `\n\n✅ Next: ${form.ns_type} on ${new Date(form.ns_due).toLocaleDateString("en-AE",{day:"numeric",month:"short",year:"numeric"})}${form.ns_note?(" — "+form.ns_note):""}` : "";
      const noteText = [
        form.note,
        nsLine,
        form.scheduled_at?("\n📅 Scheduled: "+new Date(form.scheduled_at).toLocaleString("en-AE",{dateStyle:"medium",timeStyle:"short"})):"",
        form.duration_mins?("\n⏱ Duration: "+form.duration_mins+" mins"):"",
      ].filter(Boolean).join("");
      const payload = {
        lead_id: lead.id,
        lead_name: lead.name,
        company_id: (opp?.company_id) || currentUser.company_id || null,
        type: form.type,
        note: noteText || null,
        scheduled_at: form.scheduled_at || new Date().toISOString(),
        duration_mins: form.duration_mins?Number(form.duration_mins):null,
        status: isScheduled?"upcoming":"completed",
        user_id: currentUser.id,
        user_name: currentUser.full_name,
        opportunity_id: opp?.id||null,
        person_id: form.person_id||null,
        stage_at_event: opp?.stage || null,
        activity_subtype: "free_note",
      };
      const{data,error}=await supabase.from("activities").insert(payload).select().single();
      if(error)throw error;
      const nextStepIntent = hasNextStep ? {type:form.ns_type, due:form.ns_due, note:form.ns_note} : null;
      onSaved(data, nextStepIntent);
    }catch(e){showToast(e.message,"error"); setSaving(false); savingRef.current=false;}
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

          {actPersons && actPersons.length > 0 && (
            <div style={{marginBottom:12}}>
              <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:".5px"}}>Who did you talk to?</label>
              <select value={form.person_id} onChange={sf("person_id")} style={{width:"100%"}}>
                <option value="">— Not specified —</option>
                {actPersons.map(p=>(
                  <option key={p.id} value={p.id}>
                    {p.name}{p.is_primary_buyer?" 👑":""} · {ROLE_LABELS[p.role]||p.role}
                  </option>
                ))}
              </select>
            </div>
          )}

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

          <div style={{padding:"10px 12px",background:"#F8FAFC",border:"1px solid #E8EDF4",borderRadius:8,marginBottom:16}}>
            <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:12,fontWeight:600,color:"#0F2540"}}>
              <input type="checkbox" checked={form.ns_enabled} onChange={e=>setForm(f=>({...f,ns_enabled:e.target.checked}))}/>
              📅 Schedule a next step
            </label>
            {form.ns_enabled&&(
              <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid #E2E8F0",display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div>
                  <label style={{fontSize:10,fontWeight:600,color:"#64748B",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:".4px"}}>Type</label>
                  <select value={form.ns_type} onChange={sf("ns_type")} style={{width:"100%"}}>
                    {["Call","Email","Meeting","Visit","WhatsApp","Task"].map(t=><option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{fontSize:10,fontWeight:600,color:"#64748B",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:".4px"}}>Due Date</label>
                  <input type="date" value={form.ns_due} onChange={sf("ns_due")} style={{width:"100%"}}/>
                </div>
                <div style={{gridColumn:"span 2"}}>
                  <label style={{fontSize:10,fontWeight:600,color:"#64748B",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:".4px"}}>Note (optional)</label>
                  <input type="text" value={form.ns_note} onChange={sf("ns_note")} placeholder="e.g. Follow up on budget question" style={{width:"100%"}}/>
                </div>
              </div>
            )}
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

    // ISSUE D guard duplication — block from list-view advance too
    if (toStage !== "Closed Lost" && toStage !== "On Hold" && opp.unit_id) {
      try {
        const { data: conflictOpps } = await supabase
          .from("opportunities")
          .select("id, title, stage, stage_updated_at")
          .eq("unit_id", opp.unit_id)
          .neq("id", opp.id)
          .in("stage", ["Reserved", "SPA Signed", "Closed Won"]);
        if (conflictOpps && conflictOpps.length > 0) {
          const c = conflictOpps[0];
          const days = c.stage_updated_at
            ? Math.floor((Date.now() - new Date(c.stage_updated_at).getTime()) / 86400000)
            : null;
          const ageStr = days !== null ? ` (${days} day${days === 1 ? "" : "s"} ago)` : "";
          showToast(
            `⛔ Unit reserved by "${c.title}" at ${c.stage}${ageStr}. Pick a different unit or wait.`,
            "error"
          );
          return;
        }
      } catch (e) {
        console.error("list-view moveStage guard exception:", e);
      }
    }

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
    "Site Visit":     [{label:"📋 Log outcome",    act:"log"   },{label:"📞 Follow up",     act:"call"   },{label:"📝 Log note",      act:"log"     }],
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
          <StagePill stage="Site Visit"     count={myOpps.filter(o=>o.stage==="Site Visit").length}     value={myOpps.filter(o=>o.stage==="Site Visit").reduce((s,o)=>s+(o.budget||0),0)}     color="#5B3FAA" bg="#EEE8F9" border="#5EEAD4"/>
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
  {id:"opportunities",label:"Opportunities",icon:"🎯", app:"sales",  roles:["super_admin","admin","sales_manager","sales_agent"]},
  {id:"projects",   label:"Projects",     icon:"🏗️", app:"sales",   roles:["super_admin","admin","sales_manager"]},
  {id:"builder",    label:"Inventory",    icon:"🏠", app:"sales",   roles:["super_admin","admin","sales_manager","sales_agent"]},
  // 21 May 2026: Hide Discounts menu for Phase 1 (broker-only) demo
  // Re-enable in Phase 2 when developer persona ships (approval workflow for developer-side users)
  // {id:"discounts",  label:"Discounts",    icon:"⚡", app:"sales",   roles:["super_admin","admin","sales_manager"]},
  // 21 May 2026: Hide Activity Log menu for Phase 1 demo
  // Will be replaced by role-aware Dashboard in Phase 2 (Manager view)
  // See: docs/Phase_2_Role_Based_Dashboard_Vision.md
  // {id:"activity",   label:"Activity Log", icon:"📝", app:"sales",   roles:["super_admin","admin","sales_manager"]},
  {id:"reports",    label:"Reports",      icon:"📊", app:"sales",   roles:["super_admin","admin","sales_manager"]},
  //{id:"ai",       label:"AI Assistant", icon:"✦",  app:"sales" -- removed, using AI bubble insteadles_manager","sales_agent"]},
  {id:"proppulse",  label:"PropPulse",   icon:"⚡", app:"sales",   roles:["super_admin","admin","sales_manager","sales_agent"]},
  {id:"coach_ai",   label:"AI Coach",    icon:"✨", app:"sales",   roles:["super_admin","admin","sales_manager","sales_agent"]},
  {id:"companies",  label:"Companies",    icon:"🏢", app:"sales",   roles:["super_admin"]},
  {id:"users",      label:"Users",        icon:"👥", app:"sales",   roles:["admin","super_admin"]},
  // 21 May 2026: Hide Permissions menu for Phase 1 demo (admin config, not broker workflow)
  // Re-enable in Phase 2 with unified Settings module
  // {id:"permissions",label:"Permissions",  icon:"🔒", app:"sales",   roles:["super_admin"]},
  // 21 May 2026: Hide duplicate empty Permissions screen
  // {id:"permsets",   label:"Permissions",  icon:"🔐", app:"sales",   roles:["super_admin","admin"]},
  {id:"master_agreements",label:"Master Agreements", icon:"📄", app:"sales", roles:["super_admin","admin"]},
  {id:"settings",label:"Settings", icon:"⚙️", app:"sales", roles:["super_admin","admin","sales_manager"]},
  {id:"lead_queue",label:"Lead Queue", icon:"📋", app:"sales", roles:["super_admin","admin","sales_manager"]},
  {id:"customers",label:"Customers", icon:"🤝", app:"sales", roles:["super_admin","admin","sales_manager","sales_agent"]},
  {id:"commission_outstanding",label:"Commission Outstanding", icon:"💰", app:"sales", roles:["super_admin","admin","sales_manager","sales_agent"]},
  // 21 May 2026: Hide Group View for Phase 1 demo (placeholder "Planned for MVP Phase")
  // Re-enable in Phase 2 when parent-subsidiary aggregation is built
  // {id:"group_view", label:"Group View",    icon:"🏛", app:"sales",   roles:["super_admin"]},
  // ── Leasing CRM ────────────────────────────────────────────────
  {id:"l_dashboard",label:"Dashboard",    icon:"⊞",  app:"leasing", roles:["super_admin","admin","leasing_manager","leasing_agent","viewer"]},
  {id:"l_leads",    label:"Leads",        icon:"👤", app:"leasing", roles:["super_admin","admin","leasing_manager","leasing_agent"]},
  {id:"l_opportunities",label:"Opportunities",icon:"🎯", app:"leasing", roles:["super_admin","admin","leasing_manager","leasing_agent"]},
  {id:"l_projects",  label:"Projects",     icon:"🏗️", app:"leasing", roles:["super_admin","admin","leasing_manager"]},
  {id:"l_inventory",label:"Inventory",    icon:"📋", app:"leasing", roles:["super_admin","admin","leasing_manager","leasing_agent"]},
  {id:"leasing",    label:"Prop. Mgmt",  icon:"🏘️", app:"leasing", roles:["super_admin","admin","leasing_manager","leasing_agent"]},
  // 21 May 2026: Hide Leasing Discounts menu for Phase 1 demo (same reason as sales)
  // {id:"l_discounts",label:"Discounts",    icon:"⚡", app:"leasing", roles:["super_admin","admin","leasing_manager"]},
  {id:"l_activity", label:"Activity Log", icon:"📝", app:"leasing", roles:["super_admin","admin","leasing_manager"]},
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
              <span style={{fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:700,color:"#0F2540"}}>📤 Upload Projects from Excel</span>
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
              <span style={{fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:700,color:"#0F2540"}}>{editProj?"Edit Project":"New Project"}</span>
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
            <div style={{fontSize:11,color:"#64748B",marginTop:2}}>{unit?.unit_ref} · {unit?.sub_type}</div>
          </div>
          {!isNew && reservation.status === "Active" && (
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:22,fontWeight:700,color:urg==="ok"?"#4ADE80":urg==="warning"?"#FBBF24":"#F87171"}}>{hrs}h</div>
              <div style={{fontSize:10,color:"#64748B"}}>remaining</div>
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
                    background:d.discount_source==="Developer"?"#CCFBF1":"#E6EFF9",
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
if (typeof window !== "undefined") {
  window.exportToExcel = exportToExcel;
  globalThis.exportToExcel = exportToExcel;
}
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

if (typeof window !== "undefined") {
  window.exportToPDF = exportToPDF;
  globalThis.exportToPDF = exportToPDF;
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
                <div style={{fontSize:11,color:"#64748B",marginTop:2}}>Define milestone installments — must total 100%</div>
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
                <span style={{fontSize:10,color:"#64748B"}}>
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
                  const{data,error}=await supabase.from("leads").insert({
                    name:suggestion.name,phone:suggestion.phone||null,email:suggestion.email||null,
                    budget:suggestion.budget||0,source:"AI Import",stage:"New Lead",
                    notes:suggestion.notes||null,assigned_to:currentUser.id,
                    company_id:currentUser.company_id||null,
                    stage_updated_at:new Date().toISOString(),created_by:currentUser.id
                  }).select().single();
                  if(error)throw error;
                  writeBrokerCreatedLog(data, currentUser);
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
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:"#0F2540",fontWeight:700}}>Good {new Date().getHours()<12?"morning":new Date().getHours()<17?"afternoon":"evening"}, {currentUser.full_name?.split(" ")[0]} {new Date().getHours()<12?"☀️":new Date().getHours()<17?"🌤️":"🌙"}</div>
          <div style={{color:"#C9A84C",fontSize:13,marginTop:4}}>{new Date().toLocaleDateString("en-AE",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</div>
          <div style={{display:"flex",gap:8,marginTop:6,alignItems:"center"}}>
            <RoleBadge role={currentUser.role}/>
            <span style={{fontSize:10,fontWeight:700,padding:"2px 10px",borderRadius:20,background:"rgba(155,127,212,.25)",color:"#C4ACEC"}}>🔑 Leasing CRM</span>
          </div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{color:"#64748B",fontSize:11,textTransform:"uppercase",letterSpacing:".6px"}}>Annual Rent Roll</div>
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
              <span style={{fontSize:12,color:"#64748B"}}>{l}</span>
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
              <span style={{fontSize:12,color:"#64748B"}}>{l}</span>
              <span style={{fontSize:13,fontWeight:700,color:v>0?"#F87171":"#fff"}}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Reservations Widget */}
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
        const{data:authUser,error:authError}=await supabase.auth.signUp({email:form.email,password:tempPw});
        if(authError){showToast(authError.message,"error");setSaving(false);return;}
        const result={user:authUser.user};

        // Update profile with role, company, active status
        await new Promise(r=>setTimeout(r,1000));
        const{error:pErr}=await supabase.from("profiles").upsert({
          id:result.user.id,
          email:form.email,
          full_name:form.full_name,
          role:form.role,
          is_active:true,
          company_id:activeCompanyId,
        });
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
              <span style={{fontFamily:"'Playfair Display',serif",fontSize:16,fontWeight:700,color:"#0F2540"}}>{editUser?"Edit User":"Add New User"}</span>
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

function SettingsTab({appConfig, onConfigChange, currentUser, showToast}) {
  // 21 May 2026: Handle null appConfig (destructure default {} only applies when undefined, not null)
  const cfg = appConfig || {};
  const [form, setForm] = useState({
    mode:     cfg.mode||"both",
    company:  cfg.company||"PropCRM",
    currency: cfg.currency||"AED",
    country:  cfg.country||"UAE",
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
      const { data: allCos, error } = await supabase.from("companies").select("*").order("name"); const data = currentUser?.role === "super_admin" ? allCos : (allCos || []).filter(c => c.id === currentUser.company_id);
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
                  <div style={{fontSize:12,color:"#718096",marginBottom:10,lineHeight:1.6}}>
                    What should the AI assistant be called for this company? This name will appear on the AI tab and in all AI interactions.
                  </div>
                  <input value={form.ai_assistant_name||""} onChange={e=>sf("ai_assistant_name",e.target.value)}
                    placeholder={form.name?(form.name.split(" ")[0]+" AI"):"e.g. Mansoori AI"}
                    style={{background:"#fff",border:"1px solid #CBD5E1",borderRadius:8,padding:"8px 12px",color:"#0F2540",fontSize:13,width:"100%",boxSizing:"border-box"}}/>
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
    const safe = q => q.then(r=>r).catch(()=>({data:[]}));
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
  const [showActivityModal, setShowActivityModal] = useState(null); // {lead, type}
  const[checking,  setChecking]  = useState(true);
  const[currentUser,setCurrentUser]=useState(null);
  const[leads,     setLeads]     = useState([]);
  const[userCapabilities,setUserCapabilities]=useState({});
  const[properties,setProperties]= useState([]);
  const[activities,setActivities]= useState([]);
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
  const[refCountries,setRefCountries]=useState([]);
  const[refRules,setRefRules]=useState({});
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
      if(event==="SIGNED_OUT"){setCurrentUser(null);setLeads([]);setProperties([]);setActivities([]);setMeetings([]);setFollowups([]);setOpps([]);setCompanies([]);localStorage.removeItem("propccrm_company_cache");}
      if(event==="PASSWORD_RECOVERY"){setPwRecovery(true);}
      if(event==="TOKEN_REFRESHED"&&session?.user){const{data:p}=await supabase.from("profiles").select("*").eq("id",session.user.id).single();if(p)setCurrentUser(u=>({...u,...p}));}
    });
    return()=>subscription.unsubscribe();
  },[]);
  useEffect(()=>{
    if(!currentUser)return;
    const loadCompanies=async()=>{
      try{
        const query = supabase.from("companies").select("*").order("name");
        const{data}=await query;
        if(data){
          const cid=localStorage.getItem("propccrm_company_id")||currentUser.company_id;
          const activeCo=data.find(c=>c.id===cid)||data[0];
          if(activeCo)localStorage.setItem("propccrm_company_cache",JSON.stringify({id:activeCo.id,name:activeCo.name,logo_url:activeCo.logo_url||"",business_type:activeCo.business_type||"",company_category:activeCo.company_category||"Brokerage",ai_assistant_name:activeCo.ai_assistant_name||""}));
          setCompanies(data);
          setActiveCompanyId(activeCo.id);
        }
      }catch(e){console.warn("Companies fetch error:",e);}
    };
    loadCompanies();
  },[currentUser]);


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
            : supabase.from("leads").select("*").eq("company_id", currentUser.company_id).order("created_at",{ascending:false})),
          safe(supabase.from("properties").select("*").eq("company_id", currentUser.company_id).order("created_at",{ascending:false})),
          safe(supabase.from("activities").select("*").eq("company_id", currentUser.company_id).order("created_at",{ascending:false})),
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
        const oppRes = await safe(supabase.from("opportunities").select("*").eq("company_id", currentUser.company_id).order("created_at",{ascending:false}));
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

        // ── Phase 2.2A — Load reference data (countries + buyer-type rules) ──
        // Public reference data; no company_id filter. Loaded once per session
        // and passed to LeadCreationFormV2 + future Edit form via props.
        const [refC, refB] = await Promise.all([
          safe(supabase.from("reference_countries").select("*").order("priority", {ascending:false}).order("name_en")),
          safe(supabase.from("reference_buyer_type_rules").select("*")),
        ]);
        setRefCountries(refC.data || []);
        setRefRules(rulesFromRows(refB.data || []));
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
      .on("postgres_changes",{event:"*",schema:"public",table:"leads"},p=>{if(p.eventType==="INSERT")setLeads(x=>x.some(r=>r.id===p.new.id)?x:[p.new,...x]);if(p.eventType==="UPDATE")setLeads(x=>x.map(l=>l.id===p.new.id?p.new:l));if(p.eventType==="DELETE")setLeads(x=>x.filter(l=>l.id!==p.old.id));})
      .on("postgres_changes",{event:"*",schema:"public",table:"activities"},p=>{if(p.eventType==="INSERT")setActivities(x=>x.some(r=>r.id===p.new.id)?x:[p.new,...x]);if(p.eventType==="UPDATE")setActivities(x=>x.map(a=>a.id===p.new.id?p.new:a));if(p.eventType==="DELETE")setActivities(x=>x.filter(a=>a.id!==p.old.id));})
      .on("postgres_changes",{event:"*",schema:"public",table:"opportunities"},p=>{if(p.eventType==="INSERT")setOpps(x=>x.some(r=>r.id===p.new.id)?x:[p.new,...x]);if(p.eventType==="UPDATE")setOpps(x=>x.map(o=>o.id===p.new.id?p.new:o));if(p.eventType==="DELETE")setOpps(x=>x.filter(o=>o.id!==p.old.id));})
      .subscribe();
    return()=>supabase.removeChannel(ch);
  },[currentUser, activeCompanyId]);

  const handleLogin=user=>{
    setCurrentUser(user);
    loadUserCapabilities(user);
    const validCid = user.company_id; localStorage.setItem("propccrm_company_id", validCid);
    setActiveApp(app);
    setActiveApp(app); localStorage.setItem("propccrm_last_app", app);
    localStorage.setItem("propccrm_last_app", app);
    // Load companies for all admin/manager roles to show in header
    if(["super_admin","admin","sales_manager","leasing_manager"].includes(user.role)){
      const query = isSuperAdmin ? supabase.from("companies").select("*").order("name") : supabase.from("companies").select("*").eq("company_id", currentUser.company_id).order("name");
      query.then(({data})=>{
        const cid = localStorage.getItem("propccrm_company_id") || user.company_id;
        const activeCo = data.find(c=>c.id===cid) || data[0];
        if(activeCo) localStorage.setItem("propccrm_company_cache", JSON.stringify({id:activeCo.id,name:activeCo.name,logo_url:activeCo.logo_url||"",business_type:activeCo.business_type||"",company_category:activeCo.company_category||"Brokerage",ai_assistant_name:activeCo.ai_assistant_name||""}));
        setCompanies(data);
        const saved=localStorage.getItem("propccrm_company_id");
        const co=saved?data.find(c=>c.id===saved):data[0];
        if(co){setActiveCompanyId(co.id);localStorage.setItem("propccrm_company_id",co.id);}
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

  const loadUserCapabilities = async (user) => {
    if (!user || !user.company_id) return;
    try {
      const { data, error } = await supabase.from("role_capabilities").select("capability, enabled").eq("company_id", user.company_id).eq("role", user.role);
      if (error) throw error;
      const capMap = {};
      (data || []).forEach(row => { capMap[row.capability] = row.enabled; });
      setUserCapabilities(capMap);
    } catch (e) {
      console.warn("Capabilities load error:", e);
      setUserCapabilities({});
    }
  };

  const hasCapability = (capability) => {
    if (["admin", "super_admin"].includes(currentUser?.role)) return true;
    return userCapabilities[capability] === true;
  };
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
                  <select value={storedId||""} onChange={e=>{ if(e.target.value && e.target.value!==storedId) switchCompany(e.target.value); }} style={{
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
            {/* Phase E W4 — Reminders bell (cross-opp follow-up tracker) */}
            <RemindersBell
              currentUser={currentUser}
              showToast={showToast}
              onNavigateToOpp={(oppId)=>{
                // Sales: route to new Opportunities tab. Leasing: still routes to
                // l_leads until leasing gets its own Opportunities component (Sunday).
                const targetTab = currentApp === "leasing" ? "l_leads" : "opportunities";
                navigateToTab(targetTab, {type:"opp", oppId});
              }}
              onNavigateToLead={(leadId)=>{
                // Lead-only highlights still go to Leads tab (no-opp leads belong there).
                const targetTab = currentApp === "leasing" ? "l_leads" : "leads";
                navigateToTab(targetTab, {type:"lead", leadId});
              }}
            />
            {/* User */}
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:12,color:"#0F2540",fontWeight:600,lineHeight:1.2,letterSpacing:"-.2px"}}>{currentUser.full_name}</div>
              <RoleBadge role={currentUser.role}/>
            </div>
            <Av name={currentUser.full_name||currentUser.email} size={32} bg="#C9A84C" tc="#0F2540"/>
            {showPwModal&&(<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:99998,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setShowPwModal(false)}><div style={{background:"#fff",borderRadius:16,padding:"2rem",width:400,maxWidth:"90vw",boxShadow:"0 20px 60px rgba(0,0,0,.3)"}} onClick={e=>e.stopPropagation()}><div style={{textAlign:"center",marginBottom:20}}><div style={{fontSize:36,marginBottom:6}}>🔑</div><div style={{fontFamily:"'Inter',sans-serif",fontSize:16,fontWeight:700,color:"#0F2540",letterSpacing:"-.4px",marginBottom:4}}>Change Password</div></div><PwRecoveryForm onDone={()=>{setShowPwModal(false);showToast("Password changed","success");supabase.auth.signOut();}}/></div></div>)}
            <button onClick={()=>window.dispatchEvent(new CustomEvent("propcrm_ai_open"))} title="Open AI Concierge · Ctrl+K"
              style={{width:34,height:34,borderRadius:"50%",border:"none",cursor:"pointer",
                background:"linear-gradient(135deg,#0B1F3A 0%,#1A3558 100%)",boxShadow:"0 0 0 1.5px #C9A84C",
                display:"inline-flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:0,flexShrink:0}}
              onMouseOver={e=>{e.currentTarget.style.transform="scale(1.08)";}}
              onMouseOut={e=>{e.currentTarget.style.transform="scale(1)";}}>
              <span style={{fontFamily:"'Playfair Display',serif",fontSize:13,fontWeight:700,color:"#C9A84C",lineHeight:1}}>✦</span>
            </button>
            <button onClick={()=>setShowPwModal(true)} title="Change my password" style={{fontSize:16,color:"#C9A84C",background:"none",border:"none",cursor:"pointer",padding:"0 4px"}}>🔑</button>
            <button onClick={handleLogout} title="Sign out"
              style={{fontSize:11,color:"#64748B",background:"#fff",border:"1px solid #E2E8F0",borderRadius:6,padding:"5px 10px",cursor:"pointer",whiteSpace:"nowrap",transition:"all .15s",fontWeight:600,display:"inline-flex",alignItems:"center",gap:5}}
              onMouseOver={e=>{e.currentTarget.style.background="#FEE2E2"; e.currentTarget.style.borderColor="#FCA5A5"; e.currentTarget.style.color="#C53030";}}
              onMouseOut={e=>{e.currentTarget.style.background="#fff"; e.currentTarget.style.borderColor="#E2E8F0"; e.currentTarget.style.color="#64748B";}}>
              ⏏ Sign out
            </button>
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
          {tab==="dashboard"   &&null /*Dashboard deferred - will extract properly in Phase 2*/}
          {tab==="leads"       &&<Leads leads={leads} setLeads={setLeads} opps={opps} setOpps={setOpps} properties={properties} activities={activities} setActivities={setActivities} discounts={discounts} setDiscounts={setDiscounts} currentUser={currentUser} users={users} showToast={showToast} initialFilter={navFilter} onNavigateToOpp={(oppId)=>navigateToTab("opportunities",{type:"opp",oppId})} refCountries={refCountries} refRules={refRules}/>}
          {tab==="opportunities" &&<Opportunities leads={leads} setLeads={setLeads} opps={opps} setOpps={setOpps} units={aiUnits} projects={aiProjects} salePricing={aiSalePr} activities={activities} setActivities={setActivities} currentUser={currentUser} users={users} showToast={showToast} initialFilter={navFilter} CreateOpportunityDialog={CreateOpportunityDialog} onActivityLog={(type, lead)=>{console.log("onActivityLog called:", type, lead); setShowActivityModal({lead:lead});}}/>}
          {tab==="projects"    &&<ProjectsModule currentUser={currentUser} showToast={showToast} crmContext="sales" preloadedProjects={aiProjects} preloadedUnits={aiUnits}/>}
          {tab==="builder"     &&null /*STUB: InventoryModule builder - Phase 2*/}
          {tab==="discounts"   &&<DiscountApprovals discounts={discounts} setDiscounts={setDiscounts} leads={leads} user={currentUser} toast={showToast}/>}
          {tab==="activity"    &&<ActivityLog leads={leads} activities={activities} setActivities={setActivities} currentUser={currentUser} showToast={showToast} initialFilter={navFilter}/>}
          {tab==="ai"          &&<AIAssistant leads={leads} units={aiUnits} projects={aiProjects} salePricing={aiSalePr} leasePricing={aiLeasePr} activities={activities} currentUser={currentUser} showToast={showToast}/>}
        {/* STUB: ReportsModule - extracted in Phase 2 */}
        {/* STUB: MasterAgreements - extracted in Phase 2 */}
          {tab==="settings" && <SettingsPage currentUser={currentUser} users={users} showToast={showToast}/>}
          {tab==="lead_queue" && <LeadQueuePage currentUser={currentUser} users={users} showToast={showToast} onNavigateToLead={(leadId)=>{const l=leads.find(x=>x.id===leadId); if(l){setSelLead(l);setView("lead");setTab("leads");}}}/>}
          {tab==="customers" && <CustomersPage leads={leads} currentUser={currentUser} showToast={showToast} onNavigateToLead={(leadId)=>{const l=leads.find(x=>x.id===leadId); if(l){setSelLead(l);setView("lead");setTab("leads");}}}/>}
          {tab==="commission_outstanding" && (hasCapability("see_brokerage_commission") ? <CommissionOutstanding currentUser={currentUser} showToast={showToast} developers={[]}/>: <div style={{padding:"20px"}}><p>⚠️ You do not have permission to view commission data.</p></div>)}
          {/* STUB: PropPulse - Phase 2 */}
          {tab==="coach_ai" && <CoachPage opps={opps} leads={leads} activities={activities} users={users} currentUser={currentUser} showToast={showToast} onNavigateToOpp={(oppId)=>navigateToTab("opportunities",{type:"opp",oppId})}/>}
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
          {tab==="l_opportunities" &&<OpportunitiesPlaceholder currentUser={currentUser} crmContext="leasing"/>}
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
    {/* Phase 2.2b — global Property Pack viewer (opens from anywhere via openPropertyPack) */}
    <PropertyPackModal />
    </>
  );
}

// ══════════════════════════════════════════════════════════════════
// ⚡ PROPPULSE — Property Intelligence Layer
// ══════════════════════════════════════════════════════════════════