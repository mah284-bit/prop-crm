// Day 102: extracted from App.jsx. The App.jsx split (2131570) moved LeasingLeads into its own file
// and left these behind, so the screen threw "LEASE_STAGES is not defined" the moment anyone opened
// it. Nobody did, for five months. One source now, imported by App.jsx and the leasing screens
// alike - so the next extraction cannot break it the same way.
export const LEASE_STAGES = ["New Enquiry","Contacted","Viewing","Offer Made","Reserved","Lease Signed","Lost"];

export const LEASE_STAGE_META = {
  "New Enquiry":   {c:"#1A5FA8", bg:"#E6EFF9"},
  "Contacted":     {c:"#5B3FAA", bg:"#EEE8F9"},
  "Viewing":       {c:"#A06810", bg:"#FDF3DC"},
  "Offer Made":    {c:"#B83232", bg:"#FAEAEA"},
  "Reserved":      {c:"#1A7F5A", bg:"#E6F4EE"},
  "Lease Signed":  {c:"#0F2540", bg:"#E2E8F0"},
  "Lost":          {c:"#718096", bg:"#F7F9FC"},
};
