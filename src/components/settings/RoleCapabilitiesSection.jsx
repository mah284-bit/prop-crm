import React, { useState, useEffect, useCallback, useMemo } from "react";
import { CustomRoleCreator } from "./CustomRoleCreator.jsx";
import { supabase } from "../../lib/supabase.js";

/*
  RoleCapabilitiesSection — Stage F: tenant-configurable role→capability matrix.
  Reads/writes role_capabilities for the admin's own company_id. Safe to expose because
  enforcement (RLS) is proven (Stages B–E); this UI only toggles the config layer.

  HONESTY GUARDRAIL: crown-jewel capabilities are structurally floored in RLS for agents/viewer
  (master agreements + brokerage commission — A5 hard rule). Toggling them ON for those roles would
  be a lie (the DB floor still refuses). Those cells are LOCKED here so config never contradicts RLS.
*/

const ROLES = ["sales_agent","leasing_agent","sales_manager","leasing_manager","admin","group_gm","viewer"];

const CAP_GROUPS = [
  { group: "Data Visibility", caps: ["see_own_data","see_branch_data","see_group_data"] },
  { group: "Commission", caps: ["see_own_commission","see_brokerage_commission"] },
  { group: "Master Agreements", caps: ["view_master_agreements","manage_master_agreements"] },
  { group: "Administrative", caps: ["manage_users","manage_settings","manage_inventory","assign_leads","manage_commissions"] },
  { group: "Operations", caps: ["create_leads","edit_records","delete_records","delete_leads","reserve_units","request_discounts","approve_discounts","approve_discounts_admin"] },
];

const CAP_LABEL = {
  see_own_data:"Own data", see_branch_data:"Branch data", see_group_data:"Group data",
  see_own_commission:"Own commission", see_brokerage_commission:"Brokerage commission",
  view_master_agreements:"View agreements", manage_master_agreements:"Manage agreements",
  manage_users:"Manage users", manage_settings:"Manage settings", manage_inventory:"Manage inventory",
  assign_leads:"Assign leads", manage_commissions:"Manage commissions",
  create_leads:"Create leads", edit_records:"Edit records", delete_records:"Delete records", delete_leads:"Delete leads",
  reserve_units:"Reserve units", request_discounts:"Request discounts",
  approve_discounts:"Approve discounts (mgr)", approve_discounts_admin:"Approve discounts (admin/escalation)",
};

const ROLE_LABEL = {
  sales_agent:"Sales Agent", leasing_agent:"Leasing Agent", sales_manager:"Sales Manager",
  leasing_manager:"Leasing Manager", admin:"Admin", group_gm:"Group GM", viewer:"Viewer",
};

// Crown-jewel cells locked for these roles (RLS structural floor overrides config — A5 hard rule).
const AGENT_TIER = ["sales_agent","leasing_agent","viewer"];
const FLOORED_CAPS = ["view_master_agreements","manage_master_agreements","see_brokerage_commission","manage_commissions"];
function isLocked(role, cap) {
  return AGENT_TIER.includes(role) && FLOORED_CAPS.includes(cap);
}

export default function RoleCapabilitiesSection({ currentUser, showToast }) {
  const companyId = currentUser?.company_id;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [matrix, setMatrix] = useState({});      // key `${role}:${cap}` -> bool
  const [original, setOriginal] = useState({});

  const load = useCallback(async () => {
    if (!companyId) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("role_capabilities")
        .select("role, capability, enabled")
        .eq("company_id", companyId);
      if (error) throw error;
      const m = {};
      (data || []).forEach(r => { m[`${r.role}:${r.capability}`] = !!r.enabled; });
      setMatrix(m);
      setOriginal(m);
    } catch (e) {
      console.error("[RoleCapabilitiesSection] load error:", e);
      showToast?.("Couldn't load role capabilities: " + e.message, "error");
    } finally {
      setLoading(false);
    }
  }, [companyId, showToast]);

  useEffect(() => { load(); }, [load]);

  const dirtyKeys = useMemo(() =>
    Object.keys(matrix).filter(k => matrix[k] !== original[k]), [matrix, original]);
  const isDirty = dirtyKeys.length > 0;

  const toggle = (role, cap) => {
    if (isLocked(role, cap)) return;
    const k = `${role}:${cap}`;
    setMatrix(m => ({ ...m, [k]: !m[k] }));
  };

  const handleSave = async () => {
    if (!companyId || !isDirty) return;
    setSaving(true);
    try {
      const rows = dirtyKeys.map(k => {
        const [role, capability] = k.split(":");
        return { company_id: companyId, role, capability, enabled: matrix[k] };
      });
      const { error } = await supabase
        .from("role_capabilities")
        .upsert(rows, { onConflict: "company_id,role,capability" });
      if (error) throw error;
      setOriginal({ ...matrix });
      showToast?.("Role capabilities saved", "success");
    } catch (e) {
      console.error("[RoleCapabilitiesSection] save error:", e);
      showToast?.("Save failed: " + e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: 24, color: "#6B7785" }}>Loading role capabilities…</div>;

  return (
    <div style={{display:"flex", flexDirection:"column", gap:16}}>
      <CustomRoleCreator companyId={currentUser.company_id} onRoleCreated={(roleId)=>{setMatrix(m=>({...m,[roleId]:{}}))} } showToast={showToast}/>
      
      <div>
    <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 2px 8px rgba(15,37,64,0.06)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, fontWeight: 700, color: "#0F2540" }}>
          Role Capabilities
        </div>
        <button onClick={handleSave} disabled={!isDirty || saving}
          style={{ padding: "9px 20px", borderRadius: 8, border: "none",
            background: (!isDirty || saving) ? "#A0AEC0" : "#0F2540", color: "#fff",
            fontSize: 13, fontWeight: 600, cursor: (!isDirty || saving) ? "not-allowed" : "pointer" }}>
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
      <div style={{ fontSize: 12, color: "#6B7785", marginBottom: 18, lineHeight: 1.5 }}>
        Configure what each role can see and do in your brokerage. 🔒 Locked cells are enforced by the
        security floor and cannot be granted to agents (company-confidential data).
      </div>

      <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "68vh" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
          <thead style={{ position: "sticky", top: 0, zIndex: 3, background: "#fff" }}>
            <tr>
              <th style={{ textAlign: "left", padding: "8px 10px", position: "sticky", left: 0, top: 0, zIndex: 4, background: "#fff", color: "#6B7785", fontWeight: 700 }}>Capability</th>
              {ROLES.map(r => (
                <th key={r} style={{ padding: "8px 6px", color: "#0F2540", fontWeight: 700, fontSize: 11, textAlign: "center", minWidth: 74 }}>
                  {ROLE_LABEL[r]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CAP_GROUPS.map(g => (
              <React.Fragment key={g.group}>
                <tr>
                  <td colSpan={ROLES.length + 1} style={{ padding: "12px 10px 4px", fontSize: 10, fontWeight: 700, color: "#C9A84C", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    {g.group}
                  </td>
                </tr>
                {g.caps.map(cap => (
                  <tr key={cap} style={{ borderTop: "1px solid #F0F2F5" }}>
                    <td style={{ padding: "8px 10px", color: "#0F2540", position: "sticky", left: 0, background: "#fff" }}>{CAP_LABEL[cap]}</td>
                    {ROLES.map(role => {
                      const k = `${role}:${cap}`;
                      const on = !!matrix[k];
                      const locked = isLocked(role, cap);
                      return (
                        <td key={role} style={{ textAlign: "center", padding: "6px" }}>
                          {locked ? (
                            <span title="Enforced by security floor — cannot be granted to this role" style={{ color: "#CBD5E0", fontSize: 14 }}>🔒</span>
                          ) : (
                            <button onClick={() => toggle(role, cap)}
                              style={{ width: 34, height: 20, borderRadius: 20, border: "none", cursor: "pointer",
                                background: on ? "#2E7D5B" : "#D1D9E6", position: "relative", transition: "background 0.15s" }}>
                              <span style={{ position: "absolute", top: 2, left: on ? 16 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.15s" }} />
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      </div>
    </div>
  );
}
