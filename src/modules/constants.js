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
export const FOLLOW_TYPES = ["Call","WhatsApp","Email","Meeting"];
export const CAN_DELETE_LEADS = ["admin","manager"];

export const DISC_TYPES = [
  { key:"sale_price",   label:"Sale Price Reduction", icon:"🏷" },
  { key:"rent",         label:"Rent Reduction",        icon:"🔑" },
  { key:"payment_plan", label:"Payment Plan Change",   icon:"📅" },
  { key:"agency_fee",   label:"Agency Fee Waiver",     icon:"🤝" },
];
export const STAGE_META = {
  "New Lead":      { c:"#1A5FA8", bg:"#E6EFF9", order:0 },
  "Contacted":     { c:"#5B3FAA", bg:"#EEE8F9", order:1 },
  "Site Visit":    { c:"#A06810", bg:"#FDF3DC", order:2 },
  "Proposal Sent": { c:"#7A3FAA", bg:"#F3E8F9", order:3 },
  "Negotiation":   { c:"#B85C10", bg:"#FDF0E6", order:4 },
  "Closed Won":    { c:"#1A7F5A", bg:"#E6F4EE", order:5 },
  "Closed Lost":   { c:"#B83232", bg:"#FAEAEA", order:6 },
};

export const TYPE_META = {
  Residential:{c:"#1A7F5A",bg:"#E6F4EE"}, Commercial:{c:"#1A5FA8",bg:"#E6EFF9"},
  Luxury:{c:"#B85C10",bg:"#FDF0E6"}, "Off-plan":{c:"#7A3FAA",bg:"#F3E8F9"},
  Villa:{c:"#1A7F5A",bg:"#E6F4EE"}, Flat:{c:"#1A5FA8",bg:"#E6EFF9"},
  Building:{c:"#B85C10",bg:"#FDF0E6"},
};

export const ACT_META = {
  Call: {icon:"☎️"}, Email: {icon:"📧"}, Meeting: {icon:"🤝"}, Visit: {icon:"📍"}, WhatsApp: {icon:"💬"}, Note: {icon:"📝"},
};


export const OPP_STAGE_META = {
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


export const STAGE_CAPTURE_CONFIGS = {
  "Contacted": {
    title: "Capture Contact",
    subtitle: "Record what happened in your first contact with this lead",
    fields: [
      {
        key: "channel", label: "How did you reach them?", kind: "radio", required: true,
        options: ["Call","WhatsApp","Email","In-person","Other"]
      },
      {
        key: "discussion", label: "What did you discuss?", kind: "textarea", required: true,
        minLength: 20, placeholder: "e.g. Customer is looking for a 2-bed apartment in Sobha Hartland, budget around 2M, ready to view this weekend...",
        rows: 4
      },
      {
        key: "interest_level", label: "Customer interest level", kind: "radio", required: true,
        options: [
          {value:"Hot",       color:"#DC2626", bg:"#FEE2E2"},
          {value:"Warm",      color:"#D97706", bg:"#FEF3C7"},
          {value:"Cold",      color:"#0891B2", bg:"#CFFAFE"},
          {value:"Not interested", color:"#6B7280", bg:"#F3F4F6"},
        ]
      },
      {
        key: "next_step", label: "Next step agreed with customer", kind: "select", required: true,
        options: ["Site visit","Send info","Follow up call","Lost interest"]
      },
      {
        key: "follow_up_date", label: "Schedule next follow-up", kind: "date", required: true,
        defaultOffsetDays: 2
      },
    ],
    reminderTitle: (lead) => `Follow up with ${lead.name}`,
    reminderBody:  (data) => `Next step: ${data.next_step}. Discussed: ${data.discussion?.slice(0,80)}${data.discussion?.length>80?"…":""}`,
    reminderReason: "auto_follow_up_after_contacted",
    onLostInterestSuggest: true, // if next_step == "Lost interest", suggest Closed Lost instead
  },

  "Site Visit": {
    title: "Schedule Site Visit",
    subtitle: "Set up the visit. Outcome and feedback come after the visit happens.",
    fields: [
      {
        key: "visit_at", label: "Visit date & time", kind: "datetime", required: true,
        defaultOffsetHours: 24, // default to ~tomorrow
      },
      {
        key: "units_to_show", label: "Units to show", kind: "multi_select", required: true,
        source: "units",
        emptyHint: "No units in inventory yet — link a project to this opportunity, or add units in the Inventory module.",
      },
      {
        key: "expected_attendees", label: "Who's expected to attend?", kind: "text", required: true,
        placeholder: "e.g. Mr. Khan + spouse, possibly his son",
      },
      {
        key: "prep_notes", label: "Prep notes (internal)", kind: "textarea", required: false,
        rows: 3,
        placeholder: "Anything to remember? Customer's preferences, pain points from the call, who's the decision-maker, what to highlight…",
      },
      {
        key: "send_invite", label: "Send calendar invite to customer (opens email)", kind: "checkbox", required: false,
      },
    ],
    // Reminder = 1 hour before visit (a "don't miss it" prompt)
    reminderTitle: (lead) => `Site visit with ${lead.name} in 1 hour`,
    reminderBody:  (data) => `Attendees: ${data.expected_attendees||""}`,
    reminderReason: "auto_visit_imminent",
    // Hook: after inserting the activity row, mark it upcoming with the visit time
    activityScheduledAtKey: "visit_at",
    activityType: "Site Visit",
    // Custom reminder timing — 60 min before the visit, not at 9am of follow-up date
    reminderTriggerKey: "visit_at",
    reminderTriggerOffsetMinutes: -60,
  },

  "Negotiation": {
    title: "Open Negotiation",
    subtitle: "Capture the buyer's initial asks. You'll relay these to the developer next.",
    fields: [
      {
        key: "round_at", label: "When was this discussed?", kind: "datetime", required: true,
        defaultOffsetHours: 0, // pre-fills with now
      },
      {
        key: "asks", label: "What is the buyer asking for?", kind: "asks_grid", required: true,
      },
      {
        key: "buyer_position", label: "Buyer's overall stance", kind: "radio", required: true,
        options: [
          {value:"Firm — won't budge",        color:"#DC2626", bg:"#FEE2E2"},
          {value:"Open to discussion",        color:"#D97706", bg:"#FEF3C7"},
          {value:"Just exploring",            color:"#0891B2", bg:"#CFFAFE"},
        ],
      },
      {
        key: "broker_notes", label: "Your read on this", kind: "textarea", required: true,
        minLength: 15, rows: 3,
        placeholder: "e.g. Buyer is comparing 2 other options. Developer rep mentioned flexibility on DLD if booking happens this month. Likely to close if we get 5% off + DLD split.",
      },
      {
        key: "next_action", label: "What happens next?", kind: "select", required: true,
        options: ["Take asks to developer","Wait for buyer to confirm","Schedule handover meeting","Buyer needs more time","Lost interest"],
      },
      {
        key: "follow_up_date", label: "Follow up by", kind: "date", required: true,
        defaultOffsetDays: 2,
      },
    ],
    reminderTitle: (lead) => `Negotiation follow-up — ${lead.name}`,
    reminderBody:  (data) => {
      const askCount = Object.keys(data.asks||{}).filter(k => (data.asks||{})[k]?.enabled).length;
      return `Next: ${data.next_action}. ${askCount} ask${askCount===1?"":"s"} on the table.`;
    },
    reminderReason: "auto_follow_up_after_negotiation_opened",
    onLostInterestSuggest: true,
  },
};

