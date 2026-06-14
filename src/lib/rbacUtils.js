// RBAC utilities — role-based access control and permission checks
export const getAppConfig = () => {
  try {
    return JSON.parse(localStorage.getItem("propccrm_config") || "null");
  } catch {
    return null;
  }
};

export const saveAppConfig = (cfg) => {
  localStorage.setItem("propccrm_config", JSON.stringify(cfg));
};

export const can = (role, action) => ({
  super_admin:     ["read","write","delete","manage_users","see_all","delete_leads","approve_all","approve_manager","view_sales","view_leasing","request_discount","manage_companies","manage_inventory","reserve_unit"],
  admin:           ["read","write","delete","manage_users","see_all","delete_leads","approve_all","approve_manager","view_sales","view_leasing","request_discount","manage_inventory","reserve_unit"],
  sales_manager:   ["read","write","delete","see_all","delete_leads","approve_manager","view_sales","request_discount","manage_inventory","reserve_unit"],
  sales_agent:     ["read","write","view_sales","request_discount","reserve_unit"],
  leasing_manager: ["read","write","delete","see_all","delete_leads","approve_manager","view_leasing","request_discount","manage_inventory","reserve_unit"],
  leasing_agent:   ["read","write","view_leasing","reserve_unit"],
  viewer:          ["read","view_sales","view_leasing"],
}[role] || []).includes(action);

export const roleTeam = role => ({
  super_admin: "both",
  admin: "both",
  sales_manager: "sales",
  sales_agent: "sales",
  leasing_manager: "leasing",
  leasing_agent: "leasing",
  viewer: "both",
}[role] || "both");

export const canWithPS = (role, action, permSet = null) => {
  if (!permSet) return can(role, action);
  const PS_MAP = {
    "read":             true,
    "write":            permSet.p_edit_leads || permSet.p_manage_inventory || permSet.p_manage_leasing,
    "delete":           permSet.p_delete_leads,
    "manage_users":     permSet.p_manage_users,
    "see_all":          permSet.p_view_leads || permSet.p_view_leasing,
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
