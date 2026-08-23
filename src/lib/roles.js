// Day 97: ONE LIST OF ROLES.
//
// There were four: the capability grid's ROLES array, two inline arrays in the user form (one for
// a platform owner, one for everyone else), and profiles_role_check in the database. `group_gm`
// had drifted into the grid and out of the constraint, so a company could grant it capabilities
// and never assign anyone to it - the insert was rejected. Nobody noticed because nothing failed
// until someone tried.
//
// ACCOUNTANT was added because a viewer with write capabilities is a contradiction: the founder
// wants someone who records receipts and chases payment WITHOUT being an admin, since admin means
// setup - users, permissions, standards. "When it is money, bit of a concern."
export const ROLES = [
  "sales_agent",
  "leasing_agent",
  "sales_manager",
  "leasing_manager",
  "accountant",
  "admin",
  "group_gm",
  "viewer",
];

// What a person is called on screen. The raw strings read badly - "sales_agent" in a dropdown - and
// a firm's own vocabulary differs from ours.
export const ROLE_LABELS = {
  super_admin: "Super Admin",
  admin: "Admin",
  group_gm: "Group GM",
  sales_manager: "Sales Manager",
  sales_agent: "Sales Agent",
  leasing_manager: "Leasing Manager",
  leasing_agent: "Leasing Agent",
  accountant: "Accountant",
  viewer: "Viewer",
};

export const roleLabel = (r) => ROLE_LABELS[r] || String(r || "").replace(/_/g, " ");

// Assignable by a platform owner, and by everyone else. super_admin is never offered in a tenant's
// own list - the constraint requires the platform flag alongside it.
export const ASSIGNABLE_ROLES = ["admin", "sales_manager", "sales_agent", "leasing_manager", "leasing_agent", "accountant", "viewer"];
export const PLATFORM_ASSIGNABLE_ROLES = ["super_admin", ...ASSIGNABLE_ROLES, "group_gm"];
