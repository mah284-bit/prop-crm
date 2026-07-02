// Permission utilities
// Exported from App.jsx and used throughout the app

export const can = (role, action) => {
  const PERMS = {
    super_admin:    ["read","write","delete","manage_users","see_all","delete_leads","approve_all","approve_manager","view_sales","view_leasing","request_discount","manage_companies","manage_inventory","reserve_unit"],
    admin:          ["read","write","delete","manage_users","see_all","delete_leads","approve_all","approve_manager","view_sales","view_leasing","request_discount","manage_inventory","reserve_unit"],
    sales_manager:  ["read","write","delete","see_all","delete_leads","approve_manager","view_sales","request_discount","manage_inventory","reserve_unit"],
    sales_agent:    ["read","write","view_sales","request_discount","reserve_unit"],
    leasing_manager:["read","write","delete","see_all","delete_leads","approve_manager","view_leasing","request_discount","manage_inventory","reserve_unit"],
    leasing_agent:  ["read","write","view_leasing","reserve_unit"],
    viewer:         ["read","view_sales","view_leasing"],
  };
  return (PERMS[role] || []).includes(action);
};

export const canWithPS = (role, action, permSet=null) => {
  if (!permSet) return can(role, action);
  const PS_MAP = {
    "read":             true,
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

export const roleTeam = (role) => ({
  super_admin:"both", admin:"both", sales_manager:"sales", sales_agent:"sales",
  leasing_manager:"leasing", leasing_agent:"leasing", viewer:"both",
}[role]||"both");

// ── canDo: capability-driven permission check (de-hardcoded, reads config) ──
// Replaces can(role,action) incrementally. Reads user.capabilities (loaded from role_capabilities).
// super_admin (platform, is_super_admin flag) auto-passes — the ONLY allowed hard-code (platform key).
// admin + all tenant roles read config. Maps legacy action names → canonical capabilities.
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
