import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase.js";

/* ═══════════════════════════════════════════════════════════════
   GroupBranchesSection — Phase 2 Stage 2 (Day 29)
   Read-only view of the current Group and its Branch(es) + visibility.
   Reads groups + companies (Stage 1 schema). NO writes this stage —
   surfaces the new hierarchy structure in the UI. Edit comes later.
═══════════════════════════════════════════════════════════════ */
const VIS_LABELS = {
  isolated: "Isolated — branches never see each other",
  group_admin_only: "Group admin only — group-level admin sees across; branch staff stay local",
  shared: "Shared — staff can be granted multi-branch access",
};

export default function GroupBranchesSection({ currentUser, showToast }) {
  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState(null);
  const [branches, setBranches] = useState([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // 1. find the current user's company (branch)
        const cid = currentUser?.company_id || localStorage.getItem("propccrm_company_id");
        if (!cid) { if (!cancelled) { setErr("No active company found."); setLoading(false); } return; }

        // 2. the branch row (its group_id)
        const { data: myco, error: e1 } = await supabase
          .from("companies").select("id, name, group_id, business_type").eq("id", cid).single();
        if (e1) throw e1;

        if (!myco?.group_id) {
          if (!cancelled) { setErr("This branch is not linked to a group yet."); setLoading(false); }
          return;
        }

        // 3. the group + all branches under it
        const { data: g, error: e2 } = await supabase
          .from("groups").select("id, name, branch_visibility, created_at").eq("id", myco.group_id).single();
        if (e2) throw e2;

        const { data: sibs, error: e3 } = await supabase
          .from("companies").select("id, name, business_type").eq("group_id", myco.group_id).order("name");
        if (e3) throw e3;

        if (!cancelled) { setGroup(g); setBranches(sibs || []); setLoading(false); }
      } catch (e) {
        if (!cancelled) { setErr(e.message || "Failed to load group/branches"); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [currentUser]);

  const card = { background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 2px 8px rgba(15,37,64,0.06)" };

  return (
    <div style={card}>
      <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, fontWeight: 700, color: "#0F2540", marginBottom: 4 }}>
        Group &amp; Branches
      </div>
      <div style={{ fontSize: 12, color: "#6B7785", marginBottom: 20, lineHeight: 1.5 }}>
        Your organisation structure. A <strong>Group</strong> is the umbrella; each <strong>Branch</strong> is a
        Trade License with its own data. Editing comes in a later update — this is a read-only view for now.
      </div>

      {loading && <div style={{ fontSize: 13, color: "#6B7785" }}>Loading…</div>}
      {err && !loading && (
        <div style={{ fontSize: 13, color: "#B83232", background: "#FEE2E2", border: "1px solid #FCA5A5", borderRadius: 8, padding: "10px 14px" }}>
          {err}
        </div>
      )}

      {!loading && !err && group && (
        <>
          {/* Group card */}
          <div style={{ border: "1px solid #E2E8F0", borderRadius: 12, padding: "16px 18px", marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 20 }}>🏛️</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: "#0F2540" }}>{group.name}</span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 8, background: "#ECFDF5", color: "#065F46", textTransform: "uppercase", letterSpacing: ".4px" }}>Group</span>
            </div>
            <div style={{ fontSize: 12, color: "#475569" }}>
              <strong style={{ color: "#0F2540" }}>Branch visibility:</strong>{" "}
              {VIS_LABELS[group.branch_visibility] || group.branch_visibility}
            </div>
          </div>

          {/* Branches */}
          <div style={{ fontSize: 11, fontWeight: 700, color: "#6B7785", letterSpacing: ".6px", textTransform: "uppercase", marginBottom: 10 }}>
            Branches ({branches.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {branches.map(b => {
              const biz = b.business_type === "both" ? "Sales & Leasing"
                : b.business_type === "sales" ? "Sales Only"
                : b.business_type === "leasing" ? "Leasing Only" : (b.business_type || "");
              return (
                <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 12, border: "1px solid #E2E8F0", borderRadius: 10, padding: "12px 16px" }}>
                  <span style={{ fontSize: 16 }}>🏢</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#0F2540" }}>{b.name}</div>
                    {biz && <div style={{ fontSize: 11, color: "#6B7785" }}>{biz}</div>}
                  </div>
                  {b.id === (currentUser?.company_id || localStorage.getItem("propccrm_company_id")) && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 8, background: "rgba(201,168,76,.15)", color: "#A06810" }}>Current</span>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
