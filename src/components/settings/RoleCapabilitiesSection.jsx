import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase.js";

const ROLES = ["sales_agent","leasing_agent","sales_manager","leasing_manager","admin","group_gm","viewer"];
const CAP_GROUPS = [
  { group: "Data Visibility", caps: ["see_own_data","see_branch_data","see_group_data"] },
  { group: "Commission", caps: ["see_own_commission","see_brokerage_commission"] },
  { group: "Master Agreements", caps: ["view_master_agreements","manage_master_agreements"] },
  { group: "Administrative", caps: ["manage_users","manage_settings","manage_inventory","assign_leads","manage_commissions"] },
  { group: "Operations", caps: ["create_leads","edit_records","delete_records","delete_leads","reserve_units","request_discounts","approve_discounts"] },
];

export default function RoleCapabilitiesSection({ currentUser, showToast }) {
  const [matrix, setMatrix] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await supabase.from("role_capabilities").select("*").eq("company_id", currentUser.company_id);
        const m = {};
        (data || []).forEach(row => {
          m[row.role + ":" + row.capability] = row;
        });
        setMatrix(m);
      } catch (e) {
        console.error("Load failed:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [currentUser.company_id]);

  const toggle = async (role, capability) => {
    const k = role + ":" + capability;
    try {
      if (matrix[k]) {
        await supabase.from("role_capabilities").delete().eq("id", matrix[k].id);
        const newM = { ...matrix };
        delete newM[k];
        setMatrix(newM);
      } else {
        const { data } = await supabase.from("role_capabilities").insert({
          company_id: currentUser.company_id, role, capability, created_at: new Date().toISOString(),
        }).select().single();
        setMatrix(m => ({ ...m, [k]: data }));
      }
    } catch (e) {
      showToast("Error: " + e.message, "error");
    }
  };

  if (loading) return <div style={{padding: 20, textAlign: "center"}}>Loading...</div>;

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
      <thead>
        <tr>
          <th style={{ padding: 8, textAlign: "left", fontWeight: 600, borderBottom: "1.5px solid #0F2540" }}>Capability</th>
          {ROLES.map(r => (
            <th key={r} style={{ padding: 8, textAlign: "center", fontWeight: 600, borderBottom: "1.5px solid #0F2540" }}>
              {r}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {CAP_GROUPS.map(g => (
          <React.Fragment key={g.group}>
            <tr>
              <td colSpan={ROLES.length + 1} style={{ padding: "12px 10px", fontSize: 10, fontWeight: 700, color: "#C9A84C", textTransform: "uppercase" }}>
                {g.group}
              </td>
            </tr>
            {g.caps.map(cap => (
              <tr key={cap}>
                <td style={{ padding: 8, fontWeight: 500 }}>{cap}</td>
                {ROLES.map(role => {
                  const k = role + ":" + cap;
                  const on = !!matrix[k];
                  return (
                    <td key={k} style={{ padding: 8, textAlign: "center" }}>
                      <button onClick={() => toggle(role, cap)} style={{ width: 34, height: 20, borderRadius: 20, border: "none", cursor: "pointer", background: on ? "#2E7D5B" : "#D1D9E6", position: "relative" }}>
                        <span style={{ position: "absolute", top: 2, left: on ? 16 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff" }} />
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </React.Fragment>
        ))}
      </tbody>
    </table>
  );
}
