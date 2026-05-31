import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabase.js";

/* ═══════════════════════════════════════════════════════════════
   AssignPoolDropdown — Phase 2.1 Day 22
   Compact dropdown for assigning a lead to a pool.
   
   Usage:
     <AssignPoolDropdown 
       leadId={lead.id}
       companyId={currentUser.company_id}
       triggeredBy={currentUser.id}
       onAssigned={(result) => { ... }}  // result = RPC return jsonb
       showToast={showToast}
       compact={false}                    // true = small inline mode
     />
   
   Behavior:
   - Loads active pools for the company
   - Click → shows pool list popover
   - Click pool → calls assign_lead_via_pool RPC
   - Returns RPC result to parent for optimistic UI update
═══════════════════════════════════════════════════════════════ */

export default function AssignPoolDropdown({ 
  leadId, 
  companyId, 
  triggeredBy, 
  onAssigned, 
  showToast,
  compact = false,
  buttonLabel = "Assign to Pool",
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [pools, setPools] = useState([]);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(null); // pool_id being assigned to
  const containerRef = useRef(null);

  // Load active pools when dropdown opens
  useEffect(() => {
    if (!open || !companyId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("agent_pools")
          .select("id, name, description")
          .eq("company_id", companyId)
          .eq("is_active", true)
          .order("name");
        if (cancelled) return;
        if (error) throw error;
        // For each pool, also fetch member count so user knows pool isn't empty
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
        console.error("[AssignPoolDropdown] load pools error:", e);
        showToast?.(`Couldn't load pools: ${e.message}`, "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, companyId, showToast]);

  // Close on click-outside
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const handleAssign = async (pool) => {
    if (!leadId || !triggeredBy) {
      showToast?.("Missing lead or user context", "error");
      return;
    }
    if (pool.memberCount === 0) {
      showToast?.(`Pool "${pool.name}" has no members — add members in Settings → Agent Pools first.`, "error");
      return;
    }
    setAssigning(pool.id);
    try {
      const { data, error } = await supabase.rpc("assign_lead_via_pool", {
        p_lead_id: leadId,
        p_pool_id: pool.id,
        p_triggered_by: triggeredBy,
        p_reason: `Manual assign via Lead Queue → ${pool.name}`,
      });
      if (error) throw error;
      // RPC returns jsonb structured result
      if (!data?.success) {
        const msg = data?.message || data?.error || "Assignment failed";
        showToast?.(msg, "error");
        return;
      }
      // Success
      showToast?.(`Lead assigned to ${data.assigned_to_name}`, "success");
      onAssigned?.(data);
      setOpen(false);
    } catch (e) {
      console.error("[AssignPoolDropdown] RPC error:", e);
      showToast?.(`Couldn't assign: ${e.message}`, "error");
    } finally {
      setAssigning(null);
    }
  };

  const buttonStyle = compact
    ? {
        padding: "5px 10px",
        background: "#0F2540",
        color: "#fff",
        border: "none",
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        whiteSpace: "nowrap",
      }
    : {
        padding: "8px 14px",
        background: "#0F2540",
        color: "#fff",
        border: "none",
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        whiteSpace: "nowrap",
      };

  return (
    <div ref={containerRef} style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
        style={buttonStyle}
      >
        {buttonLabel} <span style={{ marginLeft: 4, fontSize: compact ? 9 : 10 }}>▾</span>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            right: 0,
            minWidth: 240,
            maxWidth: 320,
            background: "#fff",
            border: "1px solid #E5E9EF",
            borderRadius: 10,
            boxShadow: "0 8px 20px rgba(15,37,64,0.15)",
            zIndex: 100,
            overflow: "hidden",
          }}
        >
          <div style={{
            padding: "8px 12px",
            fontSize: 10,
            fontWeight: 700,
            color: "#6B7785",
            letterSpacing: "0.5px",
            textTransform: "uppercase",
            background: "#FAFBFC",
            borderBottom: "1px solid #F0F2F5",
          }}>
            Round-Robin Assign To
          </div>
          
          {loading ? (
            <div style={{ padding: 16, textAlign: "center", color: "#6B7785", fontSize: 12 }}>
              Loading pools...
            </div>
          ) : pools.length === 0 ? (
            <div style={{ padding: 16, textAlign: "center", color: "#6B7785", fontSize: 12 }}>
              No active pools. <br />
              <span style={{ fontSize: 11 }}>Create one in Settings → Agent Pools.</span>
            </div>
          ) : (
            <div style={{ maxHeight: 280, overflowY: "auto" }}>
              {pools.map(pool => (
                <button
                  key={pool.id}
                  onClick={() => handleAssign(pool)}
                  disabled={assigning === pool.id}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    background: assigning === pool.id ? "#FAFBFC" : "transparent",
                    border: "none",
                    borderBottom: "1px solid #F5F7FA",
                    cursor: assigning === pool.id ? "wait" : "pointer",
                    textAlign: "left",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={e => { if (assigning !== pool.id) e.currentTarget.style.background = "#FAFBFC"; }}
                  onMouseLeave={e => { if (assigning !== pool.id) e.currentTarget.style.background = "transparent"; }}
                >
                  <div style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    background: "rgba(201, 168, 76, 0.12)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 14,
                    flexShrink: 0,
                  }}>
                    👥
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#0F2540",
                      marginBottom: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}>
                      {pool.name}
                    </div>
                    <div style={{
                      fontSize: 10,
                      color: "#6B7785",
                      display: "flex",
                      gap: 6,
                      alignItems: "center",
                    }}>
                      <span>{pool.memberCount} {pool.memberCount === 1 ? "member" : "members"}</span>
                      {pool.memberCount === 0 && (
                        <span style={{ color: "#B45309", fontWeight: 600 }}>⚠ empty</span>
                      )}
                    </div>
                  </div>
                  {assigning === pool.id && (
                    <span style={{ fontSize: 10, color: "#6B7785" }}>...</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
