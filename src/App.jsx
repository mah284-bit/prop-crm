import { useState, useMemo, useEffect, useCallback, useRef, Fragment } from "react";
import { STAGE_CAPTURE_CONFIGS, PAYMENT_PLAN_PRESETS, DLD_OPTIONS, SERVICE_CHARGE_PRESETS, PROPOSAL_STATUS_META, VALIDITY_PRESETS, OPP_STAGES, OPP_STAGE_META } from './modules/constants.js';
import { useDraggable } from "./lib/useDraggable";
import { rulesFromRows } from './lib/contactValidation.js';
import { supabase } from "./lib/supabase";
import { canDo } from "./lib/permissions.js";
import { normalisePhone, addWorkingDays, downloadIcsAndOpenMail } from './lib/appUtils.js';
import { useLeadPersons, ROLE_LABELS } from './lib/useLeadPersons.js';
import SettingsPage from "./components/settings/SettingsPage.jsx";
import LeadQueuePage from "./components/leadqueue/LeadQueuePage.jsx";
import CustomersPage from "./components/customers/CustomersPage.jsx";
import AIAssistant from "./components/ai/AIAssistant.jsx";
import PaymentPlanTemplates from "./components/payments/PaymentPlanTemplates.jsx";
import RemindersBell from './components/RemindersBell.jsx';
import LeadPeopleSection from './components/LeadPeopleSection.jsx';
import LeadCreationFormV2 from "./components/LeadCreationFormV2.jsx";
import ActivitiesList from './components/opportunities/ActivitiesList.jsx';
import OpportunityDetail from './components/opportunities/OpportunityDetail.jsx';
import Opportunities from './components/sales/Opportunities.jsx';
import ActivityLog from './components/sales/ActivityLog.jsx';
import PropertyMaster from './components/inventory/PropertyMaster.jsx';
import CommissionOutstanding from './components/CommissionOutstanding.jsx';
import PropertyPackModal from './components/property/PropertyPackModal.jsx';
import CompaniesModule from './components/CompaniesModule.jsx';
import PermissionSetsModule from './components/PermissionSetsModule.jsx';
import GroupConsolidatedView from './components/GroupConsolidatedView.jsx';
import OrgChartPage from './components/orgchart/OrgChartPage.jsx';
import PwRecoveryForm from './components/PwRecoveryForm.jsx';
import UsersTab from './components/UsersTab.jsx';
import SettingsTab from './components/SettingsTab.jsx';
import LogActivityModal from './components/LogActivityModal.jsx';
import { aiInvoke } from './lib/aiInvoke.js';
import CoachPage from './components/CoachPage.jsx';
import ProjectsModule from './components/ProjectsModule.jsx';
import ReservationModal from './components/ReservationModal.jsx';
import CreateOpportunityDialog from './components/CreateOpportunityDialog.jsx';
import Dashboard from './components/Dashboard.jsx';
import { openPropertyPack } from './components/property/propertyPackBus';
import ReleaseDialog from "./components/leadqueue/ReleaseDialog.jsx";
import InventoryModule from "./components/InventoryModule.jsx";
import LeadDetail from "./components/sales/LeadDetail.jsx";
import ReportsModule from "./components/ReportsModule.jsx";
import PropPulse from "./components/PropPulse.jsx";
import MasterAgreements from "./components/MasterAgreements.jsx";
import CompanyConfigPage from "./components/admin/CompanyConfigPage.jsx";

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
  "Closed Won":    ["final_price"],  // payment_plan_agreed removed per broker MOM (broker doesn't track installments)
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
  sales:   ["dashboard","projects","builder","leads","customers","opportunities","discounts","activity","ai","reports","proppulse","coach_ai","pay_plans","companies","users","permissions","permsets","master_agreements","settings","lead_queue","commission_outstanding","group_view","org_chart"],
  leasing: ["l_dashboard","l_leads","l_opportunities","l_projects","l_inventory","leasing","l_discounts","l_activity","l_ai","l_reports","l_proppulse","l_companies","l_users","l_permissions","l_permsets","l_group_view"],
  both:    ["dashboard","projects","builder","leads","customers","opportunities","leasing","l_opportunities","discounts","activity","ai","reports","proppulse","coach_ai","pay_plans","l_reports","companies","users","permissions","permsets","master_agreements","settings","lead_queue","commission_outstanding","group_view","org_chart"],
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
const fmtM    = n  => n ? `AED ${(n/1e6).toFixed(2)}M` : "—";
const fmtAED  = n  => n ? `AED ${Number(n).toLocaleString("en-AE")}` : "—";
const fmtDate = d  => d ? new Date(d).toLocaleDateString("en-AE",{day:"numeric",month:"short",year:"numeric"}) : "—";
const fmtDT   = d  => d ? new Date(d).toLocaleString("en-AE",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}) : "—";
const ini     = n  => (n||"?").split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase();
const uid     = () => Date.now()+Math.floor(Math.random()*9999);
// Permission model is capability-driven via canDo() (lib/permissions.js, reads role_capabilities).
// Legacy hard-coded can()/roleTeam/canWithPS retired Day 45 — all call sites migrated to canDo.

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
      const{error:e}=await supabase.auth.signUp({email,password:pw,options:{data:{full_name:name.trim(),role:"sales_agent"}}});
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
// Expose globally so external component files (ReportsModule, InventoryModule etc.)
// that reference OPP_STAGES as a bare identifier can find it. Hot-fix for runtime
// ReferenceError; long-term these external files should import the constant
// explicitly from a shared lib/ module.
if (typeof window !== "undefined") {
  window.OPP_STAGES = OPP_STAGES;
  globalThis.OPP_STAGES = OPP_STAGES;
}


function OpenItemsGuard({ opp, lead, activities, units, projects, currentUser, onAllClosed, onCancel, onCaptureVisit, showToast, refreshActivities }) {
  const [cancelDialog, setCancelDialog] = useState(null); // {activity, reason}

  // Compute open items each render
  const openItems = activities.filter(a =>
    a.status === "upcoming" && (
      (a.activity_subtype === "stage_advance" && a.to_stage === "Site Visit")
      || a.activity_subtype === "handover_meeting"
    )
  );

  // Auto-close the guard when no open items remain
  useEffect(() => {
    if (openItems.length === 0) {
      onAllClosed();
    }
    // eslint-disable-next-line
  }, [openItems.length]);

  if (openItems.length === 0) return null;

  const cancelItem = async () => {
    if (!cancelDialog || !(cancelDialog.reason||"").trim()) {
      showToast("Please give a reason for cancelling","error");
      return;
    }
    const a = cancelDialog.activity;
    const company_id = opp.company_id || currentUser.company_id || null;
    // Mark activity cancelled — DON'T delete it, audit trail required
    const{error: updErr}=await supabase.from("activities").update({
      status:"cancelled",
      outcome:`Cancelled (open-items guard): ${cancelDialog.reason.trim()}`,
    }).eq("id", a.id);
    if(updErr){
      showToast(`Failed: ${updErr.message}`,"error");
      return;
    }
    // Cancel any pending visit-imminent reminders for this activity
    await supabase.from("reminders")
      .update({status:"cancelled"})
      .eq("related_activity_id", a.id)
      .eq("status","pending");
    // Drop a permanent timeline note
    const itemName = a.activity_subtype === "handover_meeting" ? "Handover Meeting" : "Site Visit";
    await supabase.from("activities").insert({
      opportunity_id: opp.id, lead_id: lead.id, company_id,
      type:"Note",
      note:`✕ ${itemName} cancelled before proposal — Reason: ${cancelDialog.reason.trim()}`,
      status:"completed",
      user_id: currentUser.id, user_name: currentUser.full_name, lead_name: lead.name,
      stage_at_event: opp.stage,
      activity_subtype:"item_cancelled_pre_proposal",
    });
    setCancelDialog(null);
    refreshActivities();
    showToast("Item cancelled with reason logged","success");
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,.65)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1100,padding:"1rem"}}>
      <div style={{background:"#fff",borderRadius:16,width:580,maxWidth:"100%",maxHeight:"90vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 24px 64px rgba(11,31,58,.4)"}}>
        <div style={{padding:"1.1rem 1.4rem",borderBottom:"1px solid #E8EDF4",background:"#0F2540"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
            <div>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:700,color:"#fff"}}>🛑 Close open items first</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,.65)",marginTop:3}}>
                A proposal is the first official document sent to the buyer.<br/>Resolve these items before sending so nothing is left dangling on the record.
              </div>
            </div>
            <button onClick={onCancel} style={{background:"none",border:"none",fontSize:22,color:"#C9A84C",cursor:"pointer",lineHeight:1}}>×</button>
          </div>
        </div>

        <div style={{padding:"1.1rem 1.4rem",flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:10}}>
          {openItems.map(a => {
            const sd = a.structured_data || {};
            const isHandover = a.activity_subtype === "handover_meeting";
            const isSiteVisit = a.activity_subtype === "stage_advance" && a.to_stage === "Site Visit";
            const dt = sd.visit_at || sd.meeting_at || a.scheduled_at;
            const itemName = isHandover ? "Handover Meeting" : "Site Visit";
            const icon = isHandover ? "📅" : "🏠";
            const unitsList = (() => {
              const ids = sd.units_to_show || sd.units_viewed || [];
              return ids.map(uid => {
                const u = (units||[]).find(x => x.id === uid);
                return u?.unit_ref;
              }).filter(Boolean).join(", ");
            })();

            return (
              <div key={a.id} style={{background:"#FFFBEA",border:"1.5px solid #FCD34D",borderRadius:10,padding:"12px 14px"}}>
                <div style={{display:"flex",alignItems:"flex-start",gap:9}}>
                  <span style={{fontSize:20,flexShrink:0}}>{icon}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:4}}>
                      <span style={{fontSize:13,fontWeight:700,color:"#0F2540"}}>{itemName}</span>
                      <span style={{fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:10,background:"#FEE2E2",color:"#C53030",letterSpacing:".4px"}}>OUTCOME PENDING</span>
                    </div>
                    {dt && (
                      <div style={{fontSize:11,color:"#7A4F01",marginBottom:3}}>
                        Scheduled for {new Date(dt).toLocaleString("en-AE",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}
                      </div>
                    )}
                    {(sd.expected_attendees || sd.attendees) && (
                      <div style={{fontSize:11,color:"#64748B",marginBottom:3}}>
                        👥 {sd.expected_attendees || sd.attendees}
                      </div>
                    )}
                    {unitsList && (
                      <div style={{fontSize:11,color:"#64748B",marginBottom:3}}>
                        🏢 {unitsList}
                      </div>
                    )}

                    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:8}}>
                      {isSiteVisit && (
                        <button onClick={()=>onCaptureVisit(a)}
                          style={{padding:"6px 12px",borderRadius:6,border:"none",background:"#1A7F5A",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                          📋 Capture Outcome
                        </button>
                      )}
                      <button onClick={()=>setCancelDialog({activity:a, reason:""})}
                        style={{padding:"6px 12px",borderRadius:6,border:"1.5px solid #C53030",background:"#fff",color:"#C53030",fontSize:11,fontWeight:600,cursor:"pointer"}}>
                        ✕ Cancel with reason
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          <div style={{fontSize:11,color:"#94A3B8",fontStyle:"italic",padding:"6px 4px",marginTop:4}}>
            💡 Open negotiation rounds are not blocking — sending a new proposal supersedes any pending counter.
          </div>
        </div>

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"1rem 1.4rem",borderTop:"1px solid #E8EDF4",background:"#F8FAFC"}}>
          <span style={{fontSize:11,color:"#64748B"}}>{openItems.length} item{openItems.length===1?"":"s"} to resolve</span>
          <button onClick={onCancel}
            style={{padding:"9px 18px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>
            Back to opportunity
          </button>
        </div>

        {/* Inline cancel-with-reason mini dialog */}
        {cancelDialog && (
          <div style={{position:"absolute",inset:0,background:"rgba(11,31,58,.5)",display:"flex",alignItems:"center",justifyContent:"center",borderRadius:16,padding:"1.5rem"}}>
            <div style={{background:"#fff",borderRadius:12,width:440,maxWidth:"100%",boxShadow:"0 12px 32px rgba(11,31,58,.25)",overflow:"hidden"}}>
              <div style={{padding:"12px 16px",background:"#0F2540",color:"#fff"}}>
                <div style={{fontSize:14,fontWeight:700}}>Cancel with reason</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,.7)",marginTop:2}}>This is recorded permanently in the activity timeline.</div>
              </div>
              <div style={{padding:"14px 16px"}}>
                <label style={{fontSize:11,fontWeight:700,color:"#0F2540",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:".4px"}}>Why are you cancelling? *</label>
                <textarea value={cancelDialog.reason} onChange={e=>setCancelDialog(d=>({...d,reason:e.target.value}))} rows={3}
                  placeholder="e.g. Buyer asked for proposal directly, didn't visit; or Visit happened informally and feedback already known"
                  style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1.5px solid #D1D9E6",fontSize:13,fontFamily:"inherit",resize:"vertical",boxSizing:"border-box"}}/>
                <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:12}}>
                  <button onClick={()=>setCancelDialog(null)}
                    style={{padding:"7px 14px",borderRadius:7,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>
                    Back
                  </button>
                  <button onClick={cancelItem}
                    style={{padding:"7px 18px",borderRadius:7,border:"none",background:"#C53030",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                    Cancel item
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Phase E W3 — Proposal Viewer Dialog (read-only)
   Opens an existing proposal in presentation mode so the broker can
   see exactly what was sent, with a "Copy email body" action for
   re-sharing.
═══════════════════════════════════════════════════════════════ */

// Common UAE country code list — used by the inline form
import { COUNTRY_CODES, NATIONALITIES } from "./lib/refData.js";

// UAE-relevant nationality list (most common)



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



function Pipeline({leads, opps, setOpps, users, currentUser, showToast, activities=[]}) {
  const canEdit = canDo(currentUser, "write");
  const canReserve = canDo(currentUser, "reserve_unit");
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
  const myOpps = canDo(currentUser,"see_all") ? allOpps : allOpps.filter(o=>o.assigned_to===currentUser.id);
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
  {id:"companies",  label:"Companies",    icon:"🏢", app:"sales",   roles:["super_admin"], platformOnly:true},
  {id:"users",      label:"Users",        icon:"👥", app:"sales",   roles:["admin","super_admin"]},
  // 21 May 2026: Hide Permissions menu for Phase 1 demo (admin config, not broker workflow)
  // Re-enable in Phase 2 with unified Settings module
  // {id:"permissions",label:"Permissions",  icon:"🔒", app:"sales",   roles:["super_admin"]},
  // 21 May 2026: Hide duplicate empty Permissions screen
  // {id:"permsets",   label:"Permissions",  icon:"🔐", app:"sales",   roles:["super_admin","admin"]},
  {id:"master_agreements",label:"Master Agreements", icon:"📄", app:"sales", roles:["super_admin","admin"]},
  {id:"settings",label:"Settings", icon:"⚙️", app:"sales", roles:["super_admin","admin","sales_manager"]},
  {id:"lead_queue",label:"Lead Assignment", icon:"📋", app:"sales", roles:["super_admin","admin","sales_manager"]},
  {id:"company_config", label:"Company Config", icon:"🌍", app:"sales", roles:["super_admin"]}, // ← NEW
  {id:"customers",label:"Customers", icon:"🤝", app:"sales", roles:["super_admin","admin","sales_manager","sales_agent"]},
  {id:"commission_outstanding",label:"Commission Outstanding", icon:"💰", app:"sales", roles:["super_admin","admin","sales_manager","sales_agent"]},
  // 21 May 2026: Hide Group View for Phase 1 demo (placeholder "Planned for MVP Phase")
  // Re-enable in Phase 2 when parent-subsidiary aggregation is built
  {id:"group_view", label:"Group View",    icon:"🏛", app:"sales",   roles:["super_admin"], platformOnly:true},
  {id:"org_chart", label:"Org Chart", icon:"🗂", app:"sales", roles:["super_admin","admin"]},
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
  {id:"l_companies",label:"Companies",    icon:"🏢", app:"leasing", roles:["super_admin"], platformOnly:true},
  {id:"l_users",    label:"Users",        icon:"👥", app:"leasing", roles:["admin","super_admin"]},
  {id:"l_permsets", label:"Permissions",  icon:"🔐", app:"leasing", roles:["super_admin","admin"]},
  {id:"l_group_view",label:"Group View",  icon:"🏛", app:"leasing", roles:["super_admin"], platformOnly:true},
];

// Nav visibility = capability-driven (Day 46 de-hardcode). Tabs NOT listed here are visible to all in
// their app-mode (in-screen actions are already capability-gated). platformOnly tabs stay is_super_admin.
const TAB_CAPABILITY = {
  users:"manage_users", l_users:"manage_users",
  settings:"manage_settings", l_permsets:"manage_settings",
  master_agreements:"view_master_agreements",
  commission_outstanding:"see_brokerage_commission",
};

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



// ══════════════════════════════════════════════════════════════════
// RESERVATION SYSTEM
// - ReservationModal: create / view / manage a reservation
// - ReservationBadge: shows on inventory rows
// - ReservationsDashboard: dashboard widget
// ══════════════════════════════════════════════════════════════════

import { MAX_RESERVATION_FEE, RES_COLORS } from "./lib/refData.js";

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

// ── Reservations Dashboard Widget ──────────────────────────────
function DiscountApprovals({discounts,setDiscounts,leads,user,toast}) {
  const [filter, setFilter] = useState("Pending");
  const [saving, setSaving] = useState(false);
  const [responseNote, setResponseNote] = useState("");
  const [actingOn, setActingOn] = useState(null);
  const [action, setAction] = useState(null); // "approve"|"reject"|"escalate"

  const canApproveManager = canDo(user,"approve_manager");
  const canApproveAdmin   = canDo(user,"approve_all");

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



// ══════════════════════════════════════════════════════════════════
// SETUP WIZARD — shown once to admin on first launch
// ══════════════════════════════════════════════════════════════════



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

      {/* Reservations Widget — removed: component lost in refactor (undefined ref crashed LeasingDashboard). Rebuild = Phase 2. */}
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
  const loadUserCapabilities = async (user) => {
    if (!user || !user.company_id) return;
    try {
      const { data, error } = await supabase.from("role_capabilities").select("capability, enabled").eq("company_id", user.company_id).eq("role", user.role);
      if (error) throw error;
      const capMap = {};
      (data || []).forEach(row => { capMap[row.capability] = row.enabled; });
      setUserCapabilities(capMap);
      setCurrentUser(u => u ? { ...u, capabilities: capMap } : u);  // attach for canDo() everywhere
    } catch (e) {
      console.warn("Capabilities load error:", e);
      setUserCapabilities({});
    }
  };

    const restore=async()=>{
      const hp=new URLSearchParams(window.location.hash.replace("#","?").slice(1));
      if(hp.get("type")==="recovery"){setPwRecovery(true);return;}
      try{
        const{data:{session}}=await supabase.auth.getSession();
        if(session?.user){
          const{data:profile}=await supabase.from("profiles").select("*").eq("id",session.user.id).single();
          if(profile&&profile.is_active){const ru={...session.user,...profile};setCurrentUser(ru);loadUserCapabilities(ru);}
          else await supabase.auth.signOut();
        }
      }catch(e){console.error("Session restore error:",e);}
      finally{setChecking(false);}
    };
    restore();
    const{data:{subscription}}=supabase.auth.onAuthStateChange(async(event,session)=>{
      if(event==="SIGNED_OUT"){setCurrentUser(null);setLeads([]);setProperties([]);setActivities([]);setOpps([]);setCompanies([]);localStorage.removeItem("propccrm_company_cache");}
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
          safe(supabase.from("properties").select("*").order("created_at",{ascending:false})),
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
    setActiveApp(activeApp); localStorage.setItem("propccrm_last_app", activeApp);
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
  // Nav visibility: platformOnly -> is_super_admin; else capability-gated (TAB_CAPABILITY) via canDo; else visible to all in app-mode.
  const tabVisible = (t) => {
    if (t.platformOnly) return currentUser?.is_super_admin === true;
    const cap = TAB_CAPABILITY[t.id];
    return cap ? canDo(currentUser, cap) : true;
  };
  const visibleTabs=TABS.filter(t=>t.app===currentApp&&allowedTabs.includes(t.id)&&tabVisible(t));


  const hasCapability = (capability) => {
    if (currentUser?.is_super_admin === true) return true;   // platform owner only (flag, not role string)
    return userCapabilities[capability] === true;             // admin + all tenant roles read config (de-hardcoded)
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
            const isSA = currentUser?.is_super_admin===true;
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
          {tab==="dashboard"   &&<Dashboard leads={leads} opps={opps} properties={properties} activities={activities} currentUser={currentUser} crmContext="sales" units={aiUnits} salePricing={aiSalePr} leasePricing={aiLeasePr} onNavigate={(t,filter)=>navigateToTab(t,filter)}/>}
          {tab==="leads"       &&<LeadDetail Av={Av} Badge={Badge} Empty={Empty} Modal={Modal} Spinner={Spinner} CreateOpportunityDialog={CreateOpportunityDialog} LogActivityModal={LogActivityModal} leads={leads} setLeads={setLeads} opps={opps} setOpps={setOpps} properties={properties} activities={activities} setActivities={setActivities} discounts={discounts} setDiscounts={setDiscounts} currentUser={currentUser} users={users} showToast={showToast} initialFilter={navFilter} onNavigateToOpp={(oppId)=>navigateToTab("opportunities",{type:"opp",oppId})} refCountries={refCountries} refRules={refRules}/>}
          {tab==="opportunities" &&<Opportunities leads={leads} setLeads={setLeads} opps={opps} setOpps={setOpps} units={aiUnits} projects={aiProjects} salePricing={aiSalePr} activities={activities} setActivities={setActivities} currentUser={currentUser} users={users} showToast={showToast} initialFilter={navFilter} onActivityLog={(type, lead)=>{console.log("onActivityLog called:", type, lead); setShowActivityModal({lead:lead});}} CreateOpportunityDialog={CreateOpportunityDialog}/>}
          {tab==="projects"    &&<ProjectsModule currentUser={currentUser} showToast={showToast} crmContext="sales" preloadedProjects={aiProjects} preloadedUnits={aiUnits}/>}
          {tab==="builder"     &&<InventoryModule currentUser={currentUser} showToast={showToast} crmContext="sales" preloadedUnits={aiUnits} preloadedProjects={aiProjects} preloadedSalePricing={aiSalePr} preloadedLeasePricing={aiLeasePr} activeCompanyId={activeCompanyId} globalOpps={opps} initialFilter={navFilter}/>}
          {tab==="discounts"   &&<DiscountApprovals discounts={discounts} setDiscounts={setDiscounts} leads={leads} user={currentUser} toast={showToast}/>}
          {tab==="activity"    &&<ActivityLog leads={leads} activities={activities} setActivities={setActivities} currentUser={currentUser} showToast={showToast} initialFilter={navFilter}/>}
          {tab==="ai"          &&<AIAssistant leads={leads} units={aiUnits} projects={aiProjects} salePricing={aiSalePr} leasePricing={aiLeasePr} activities={activities} currentUser={currentUser} showToast={showToast}/>}
          {tab==="reports" && <ReportsModule currentUser={currentUser} showToast={showToast} globalOpps={opps} leads={leads} activities={activities} leasingData={{}} crmContext="sales" preloadedUnits={aiUnits} preloadedProjects={aiProjects} preloadedSalePricing={aiSalePr} preloadedLeasePricing={aiLeasePr} preloadedUsers={users}/>}
          {tab==="master_agreements" && <MasterAgreements currentUser={currentUser} showToast={showToast}/>}
          {tab==="settings" && <SettingsPage currentUser={currentUser} users={users} showToast={showToast}/>}
          {tab==="company_config" && <CompanyConfigPage appConfig={appConfig} onConfigChange={setAppConfig} showToast={showToast}/>}
          {tab==="lead_queue" && <LeadQueuePage currentUser={currentUser} users={users} showToast={showToast} onNavigateToLead={(leadId)=>{const l=leads.find(x=>x.id===leadId); if(l){setSelLead(l);setView("lead");setTab("leads");}}}/>}
          {tab==="customers" && <CustomersPage leads={leads} currentUser={currentUser} showToast={showToast} onNavigateToLead={(leadId)=>{const l=leads.find(x=>x.id===leadId); if(l){setSelLead(l);setView("lead");setTab("leads");}}}/>}
          {tab==="commission_outstanding" && (hasCapability("see_brokerage_commission") ? <CommissionOutstanding currentUser={currentUser} showToast={showToast} developers={[]}/>: <div style={{padding:"20px"}}><p>⚠️ You do not have permission to view commission data.</p></div>)}
          {tab==="proppulse" && <PropPulse currentUser={currentUser} showToast={showToast}/>}
          {tab==="coach_ai" && <CoachPage opps={opps} leads={leads} activities={activities} users={users} currentUser={currentUser} showToast={showToast} onNavigateToOpp={(oppId)=>navigateToTab("opportunities",{type:"opp",oppId})}/>}
          {tab==="pay_plans"   &&<PaymentPlanTemplates currentUser={currentUser} showToast={showToast} projects={aiProjects}/>}
          {tab==="companies"   &&<CompaniesModule currentUser={currentUser} showToast={showToast} onSwitchCompany={(id, coObj)=>{
  const co = coObj || companies.find(c=>c.id===id);
  if(co) localStorage.setItem("propccrm_company_cache",JSON.stringify({id:co.id,name:co.name,logo_url:co.logo_url||"",business_type:co.business_type||"",ai_assistant_name:co.ai_assistant_name||""}));
  setActiveCompanyId(id);
  localStorage.setItem("propccrm_company_id",id);
  setTab("dashboard");
}} activeCompanyId={activeCompanyId}/>}
          {tab==="users"       &&canDo(currentUser,"manage_users")&&<UserManagement currentUser={currentUser} leads={leads} activities={activities} showToast={showToast} appConfig={appConfig} onConfigChange={cfg=>{saveAppConfig(cfg);setAppConfig(cfg);}}/>}
          {tab==="permissions" &&<PermissionSetsModule currentUser={currentUser} showToast={showToast}/>}
          {tab==="group_view"  &&<GroupConsolidatedView currentUser={currentUser}/>}
          {tab==="org_chart" && <OrgChartPage currentUser={currentUser} showToast={showToast}/>}

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
          {tab==="l_users"     &&canDo(currentUser,"manage_users")&&<UserManagement currentUser={currentUser} leads={leads} activities={activities} showToast={showToast} appConfig={appConfig} onConfigChange={cfg=>{saveAppConfig(cfg);setAppConfig(cfg);}}/>}
          {tab==="l_permissions"&&<PermissionSetsModule currentUser={currentUser} showToast={showToast}/>}

          {tab==="l_group_view" &&<GroupConsolidatedView currentUser={currentUser}/>}
        </>)}
      </div>
    </div>
    {toast&&<Toast msg={toast.msg} type={toast.type} onDone={()=>setToast(null)}/>}
    {showActivityModal&&(
      <LogActivityModal
        lead={showActivityModal.lead}
        opp={showActivityModal.opp}
        currentUser={currentUser}
        showToast={showToast}
        defaultType={showActivityModal.type||"Call"}
        onClose={()=>setShowActivityModal(null)}
        onSaved={(act)=>{
          showToast("Activity logged","success");
          setShowActivityModal(null);
        }}
      />
    )}
    {/* Phase 2.2b — global Property Pack viewer (opens from anywhere via openPropertyPack) */}
    <PropertyPackModal />
    </>
  );
}

// ══════════════════════════════════════════════════════════════════
// ⚡ PROPPULSE — Property Intelligence Layer
// ══════════════════════════════════════════════════════════════════