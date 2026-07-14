// Permission utilities — capability-driven (Day 45).
// Legacy hard-coded can()/canWithPS/roleTeam PERMS arrays retired; canDo() is the single check.

const ACTION_TO_CAPABILITY = {
  write:            "edit_records",
  delete:           "delete_records",
  delete_leads:     "delete_leads",
  manage_users:     "manage_users",
  manage_inventory: "manage_inventory",
  reserve_unit:     "reserve_units",
  request_discount: "request_discounts",
  approve_all:      "approve_discounts_admin",   // admin/escalation tier
  approve_manager:  "approve_discounts",         // manager tier
  see_all:          "see_branch_data",
  create_lead:      "create_leads",
  see_brokerage_commission: "see_brokerage_commission",
  assign_leads: "assign_leads",
  use_proppulse: "use_proppulse",
};
export const canDo = (user, action) => {
  if (!user) return false;
  if (user.is_super_admin === true) return true;          // platform owner only (the one allowed hard-code)
  if (action === "read") return true;                      // everyone reads
  if (action === "view_sales" || action === "view_leasing") return true; // team-scoped, handled elsewhere
  if (action === "manage_companies") return false;         // platform-only, non-super_admin never
  const cap = ACTION_TO_CAPABILITY[action];
  if (!cap) return false;                                  // unknown action = deny (safe default)
  return user.capabilities?.[cap] === true;                // read config
};
