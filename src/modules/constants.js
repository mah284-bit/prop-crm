// Stages and metadata
export const STAGES = ["New Lead","Contacted","Site Visit","Proposal Sent","Negotiation","Closed Won","Closed Lost"];

export const OPP_STAGES = ["New","Contacted","Site Visit","Proposal Sent","Negotiation","Offer Accepted","Reserved","SPA Signed","Closed Won","Closed Lost"];

export const ROLE_META = {
  super_admin:    {label:"Super Admin",    color:"#B83232",bg:"#FAEAEA",desc:"All companies · Full access"},
  admin:          {label:"Admin",          color:"#8A6200",bg:"#FDF3DC",desc:"Full access — all modules"},
  sales_manager:  {label:"Sales Manager",  color:"#1A5FA8",bg:"#E6EFF9",desc:"All sales leads · approve discounts ≤5%"},
  sales_agent:    {label:"Sales Agent",    color:"#1A7F5A",bg:"#E6F4EE",desc:"Own sales leads · request discounts"},
  leasing_manager:{label:"Leasing Mgr",   color:"#5B3FAA",bg:"#EEE8F9",desc:"All leases · approve rent reductions ≤5%"},
  leasing_agent:  {label:"Leasing Agent", color:"#0F6E56",bg:"#D4F1E8",desc:"Own leases · manage tenants & payments"},
  viewer:         {label:"Viewer",         color:"#718096",bg:"#F7F9FC",desc:"Read-only access"},
};

export const STAGE_BADGES = {
  "New Lead": {c:"#666",bg:"#F5F5F5",order:0},
  "Contacted": {c:"#1A5FA8",bg:"#DBEAFE",order:1},
  "Site Visit": {c:"#C9A84C",bg:"#FFF8E6",order:2},
  "Proposal Sent": {c:"#8B5CF6",bg:"#F3E8FF",order:3},
  "Negotiation": {c:"#D97706",bg:"#FEF3C7",order:4},
  "Closed Won": {c:"#1A7F5A",bg:"#E6F4EE",order:5},
  "Closed Lost": {c:"#B83232",bg:"#FAEAEA",order:6},
};

export const COLORS = {
  navy: "#0F2540",
  gold: "#C9A84C",
};

export const PROP_TYPES = ["Residential","Commercial","Luxury","Off-plan","Villa","Flat","Building"];
export const UNIT_TYPES = ["Villa","Flat","Penthouse","Townhouse","Duplex","Studio","Office","Warehouse","Plot","Commercial Unit"];
export const SOURCES = ["Referral","Website","Portal","Cold Call","Event","Social Media","WhatsApp","Walk-in"];
export const ACT_TYPES = ["Call","Email","Meeting","Visit","WhatsApp","Note"];
export const ROLES = ["super_admin","admin","sales_manager","sales_agent","leasing_manager","leasing_agent","viewer"];
export const VIEWS = ["Sea View","Pool View","Garden View","City View","Golf View","Park View","Community View","Burj View","Creek View","No View"];
export const MEET_TYPES = ["Call","Meeting","Site Visit","Video Call","Presentation"];