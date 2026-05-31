import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "../../lib/supabase.js";

/* ═══════════════════════════════════════════════════════════════
   ReassignDialog — Phase 2.1 Day 22 PM
   Admin reassign-with-reason workflow.
   
   Difference vs AssignPoolDropdown:
     - AssignPoolDropdown: lightweight, used for initial assignment of
       unassigned leads. No reason needed (RPC default behavior).
     - ReassignDialog: heavy, used when overriding an existing assignment
       (stale lead reassignment by admin, etc). Reason MANDATORY.
       Calls RPC with p_force=true, p_reason=<text>.
   
   Audit log differentiator:
     - AssignPoolDropdown writes action='initial_assignment', method='round_robin'
     - ReassignDialog writes action='manual_override', method='manual'
   
   Usage:
     <ReassignDialog
       lead={lead}
       currentUser={currentUser}
       onClose={() => setShowReassign(false)}
       onReassigned={(result) => { ... }}
       showToast={showToast}
     />
═══════════════════════════════════════════════════════════════ */

export default function ReassignDialog({
  lead,
  currentUser,
  onClose,
  onReassigned,
  showToast,
}) {
  const [pools, setPools] = useState([]);
  const [selectedPoolId, setSelectedPoolId] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load active pools for this company
  useEffect(() => {
    if (!currentUser?.company_id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("agent_pools")
          .select("id, name, description")
          .eq("company_id", currentUser.company_id)
          .eq("is_active", true)
          .order("name");
        if (cancelled) return;
        if (error) throw error;
        // Enrich with member counts
        const poolIds = (data || []).map(p => p.id);
        let countsByPool = {};
        if (poolIds.length > 0) {
          const { data: m } = await supabase
            .from("agent_pool_members")
            .select("pool_id")
            .in("pool_id", poolIds);
          countsByPool = (m || []).reduce((acc, row) => {
            acc[row.pool_id] = (acc[row.pool_id] || 0) + 1;
            return acc;
          }, {});
        }
        const enriched = (data || []).map(p => ({ ...p, memberCount: countsByPool[p.id] || 0 }));
        setPools(enriched);
      } catch (e) {
        console.error("[ReassignDialog] load pools:", e);
        showToast?.(`Couldn't load pools: ${e.message}`, "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [currentUser?.company_id, showToast]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && !saving) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  const canSubmit = useMemo(() => {
    if (!selectedPoolId) return false;
    if (!reason.trim()) return false;
    return !saving;
  }, [selectedPoolId, reason, saving]);

  const selectedPool = pools.find(p => p.id === selectedPoolId);

  const handleSubmit = async () => {
    if (!lead?.id || !currentUser?.id) {
      showToast?.("Missing context", "error");
      return;
    }
    if (!selectedPoolId) {
      showToast?.("Select a pool", "error");
      return;
    }
    if (!reason.trim()) {
      showToast?.("Reason is required", "error");
      return;
    }
    if (selectedPool?.memberCount === 0) {
      showToast?.(`Pool "${selectedPool.name}" has no active members.`, "error");
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.rpc("assign_lead_via_pool", {
        p_lead_id: lead.id,
        p_pool_id: selectedPoolId,
        p_triggered_by: currentUser.id,
        p_reason: reason.trim(),
        p_force: true,
      });
      if (error) throw error;
      if (!data?.success) {
        const msg = data?.message || data?.error || "Reassignment failed";
        showToast?.(msg, "error");
        return;
      }
      showToast?.(`Lead reassigned to ${data.assigned_to_name}`, "success");
      onReassigned?.(data);
    } catch (e) {
      console.error("[ReassignDialog] RPC error:", e);
      showToast?.(`Couldn't reassign: ${e.message}`, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 37, 64, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 16,
          width: "100%",
          maxWidth: 560,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 50px rgba(15,37,64,0.25)",
        }}
      >
        {/* Header */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #F0F2F5" }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F2540", margin: 0, marginBottom: 4 }}>
            Reassign Lead
          </h2>
          <div style={{ fontSize: 12, color: "#6B7785" }}>
            {lead?.name && <>Lead: <strong>{lead.name}</strong> · </>}
            Override current assignment. Round-robin runs within selected pool.
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px", flex: 1, overflowY: "auto" }}>
          {/* Pool picker */}
          <Label>Reassign to pool <Required /></Label>
          {loading ? (
            <div style={{ padding: 16, textAlign: "center", color: "#6B7785", fontSize: 12 }}>
              Loading pools...
            </div>
          ) : pools.length === 0 ? (
            <div style={{
              padding: 12,
              background: "#FEF3C7",
              border: "1px solid #FCD34D",
              borderRadius: 8,
              fontSize: 12,
              color: "#8A6200",
            }}>
              No active pools. Create one in Settings → Agent Pools first.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
              {pools.map(pool => {
                const selected = selectedPoolId === pool.id;
                const empty = pool.memberCount === 0;
                return (
                  <div
                    key={pool.id}
                    onClick={() => !empty && setSelectedPoolId(pool.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px 14px",
                      border: `1.5px solid ${selected ? "#C9A84C" : "#E5E9EF"}`,
                      borderRadius: 10,
                      background: selected ? "rgba(201, 168, 76, 0.08)" : (empty ? "#FAFBFC" : "#fff"),
                      cursor: empty ? "not-allowed" : "pointer",
                      opacity: empty ? 0.6 : 1,
                      transition: "all 0.15s",
                    }}
                  >
                    <div style={{
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      border: `2px solid ${selected ? "#C9A84C" : "#D1D9E6"}`,
                      background: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}>
                      {selected && <div style={{ width: 9, height: 9, borderRadius: "50%", background: "#C9A84C" }} />}
                    </div>
                    <div style={{
                      width: 28, height: 28, borderRadius: 6,
                      background: "rgba(201, 168, 76, 0.12)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 14, flexShrink: 0,
                    }}>
                      👥
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#0F2540", marginBottom: 2 }}>
                        {pool.name}
                      </div>
                      <div style={{ fontSize: 11, color: empty ? "#B45309" : "#6B7785" }}>
                        {pool.memberCount} {pool.memberCount === 1 ? "member" : "members"}
                        {empty && " · ⚠ no active members"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Reason */}
          <div style={{ marginBottom: 8 }}>
            <Label>Reason <Required /></Label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Original agent inactive for 31 days. Reassigning to keep lead warm."
              rows={3}
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1.5px solid #D1D9E6",
                borderRadius: 8,
                fontSize: 13,
                color: "#0F2540",
                outline: "none",
                boxSizing: "border-box",
                fontFamily: "inherit",
                resize: "vertical",
                minHeight: 70,
              }}
            />
            <div style={{ fontSize: 11, color: "#6B7785", marginTop: 4 }}>
              Required. Written to audit log permanently. Visible in History tab.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: "16px 24px",
          borderTop: "1px solid #F0F2F5",
          display: "flex",
          gap: 10,
          justifyContent: "flex-end",
        }}>
          <button
            onClick={onClose}
            disabled={saving}
            style={{
              padding: "10px 18px",
              background: "#fff",
              color: "#0F2540",
              border: "1.5px solid #D1D9E6",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.6 : 1,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              padding: "10px 22px",
              background: !canSubmit ? "#9CA3AF" : "#0F2540",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
              cursor: !canSubmit ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Reassigning..." : "Reassign Lead"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────

function Label({ children }) {
  return (
    <div style={{
      fontSize: 12,
      fontWeight: 700,
      color: "#0F2540",
      marginBottom: 6,
      letterSpacing: "0.3px",
    }}>
      {children}
    </div>
  );
}

function Required() {
  return <span style={{ color: "#B42318", marginLeft: 4 }}>*</span>;
}
