// Business metadata and configuration constants
export const STAGE_META = {
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

// Additional constants from App.jsx
export const ACT_TYPES = ["Call","Email","Meeting","Visit","WhatsApp","Note"];
export const MANAGER_DISCOUNT_LIMIT = 5;
export const CAN_DELETE_LEADS = ["admin","manager"];
export const ROLES = ["super_admin","admin","sales_manager","sales_agent","leasing_manager","leasing_agent","viewer"];
export const FOLLOW_TYPES = ["Call","WhatsApp","Email","Meeting"];
