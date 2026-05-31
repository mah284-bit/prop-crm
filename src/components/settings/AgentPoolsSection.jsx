import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase.js";
import PoolEditModal from "./PoolEditModal.jsx";

/* ═══════════════════════════════════════════════════════════════
   AgentPoolsSection — Phase 2.1 Day 21
   Lists agent pools for the current company.
   Actions: Create, Edit (name/description/members), Toggle active state.
   
   Pool deletion: NOT hard-delete. Soft-deactivate via is_active=false.
   Preserves audit history in lead_assignment_log.
═══════════════════════════════════════════════════════════════ */

export default function AgentPoolsSection({ currentUser, users = [], showToast }) {
  const [pools, setPools] = useState([]);
  const [poolMembers, setPoolMembers] = useState([]); // all agent_pool_members rows for this company's pools
  const [loading, setLoading] = useState(true);
  const [editPool, setEditPool] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const companyId = currentUser?.company_id;

  // Fetch pools + their members
  const load = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data: poolsData, error: pErr } = await supabase
        .from("agent_pools")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      if (pErr) throw pErr;

      const poolIds = (poolsData || []).map(p => p.id);
      let membersData = [];
      if (poolIds.length > 0) {
        const { data: m, error: mErr } = await supabase
          .from("agent_pool_members")
          .select("*")
          .in("pool_id", poolIds);
        if (mErr) throw mErr;
        membersData = m || [];
      }

      setPools(poolsData || []);
      setPoolMembers(membersData);
    } catch (e) {
      console.error("[AgentPoolsSection] load error:", e);
      showToast?.(`Couldn't load pools: ${e.message}`, "error");
    } finally {
      setLoading(false);
    }
  }, [companyId, showToast]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = () => {
    setEditPool(null);
    setShowModal(true);
  };

  const handleEdit = (pool) => {
    setEditPool(pool);
    setShowModal(true);
  };

  const handleToggleActive = async (pool) => {
    try {
      const { error } = await supabase
        .from("agent_pools")
        .update({ is_active: !pool.is_active })
        .eq("id", pool.id);
      if (error) throw error;
      setPools(p => p.map(x => x.id === pool.id ? { ...x, is_active: !x.is_active } : x));
      showToast?.(
        pool.is_active ? `Pool "${pool.name}" deactivated` : `Pool "${pool.name}" activated`,
        "success"
      );
    } catch (e) {
      showToast?.(`Couldn't update pool: ${e.message}`, "error");
    }
  };

  const handleSaved = (savedPool, savedMembers) => {
    if (editPool) {
      setPools(p => p.map(x => x.id === savedPool.id ? savedPool : x));
    } else {
      setPools(p => [savedPool, ...p]);
    }
    // Update local member state for this pool
    setPoolMembers(prev => [
      ...prev.filter(m => m.pool_id !== savedPool.id),
      ...savedMembers,
    ]);
    setShowModal(false);
    setEditPool(null);
    showToast?.(editPool ? "Pool updated" : "Pool created", "success");
  };

  const memberCountFor = (poolId) => poolMembers.filter(m => m.pool_id === poolId).length;

  // ── RENDER ─────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20, display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0F2540", margin: 0, marginBottom: 6 }}>
            Agent Pools
          </h2>
          <div style={{ fontSize: 13, color: "#6B7785" }}>
            Group agents for round-robin lead distribution. Pool-sourced leads route through these pools.
          </div>
        </div>
        <button
          onClick={handleCreate}
          style={{
            padding: "10px 18px",
            background: "#0F2540",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 2px 6px rgba(15,37,64,0.15)",
          }}
        >
          + Create Pool
        </button>
      </div>

      {/* Content card */}
      <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 2px 8px rgba(15,37,64,0.06)", overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: "center", color: "#6B7785" }}>Loading pools...</div>
        ) : pools.length === 0 ? (
          <EmptyState onCreate={handleCreate} />
        ) : (
          <div>
            {pools.map((pool, idx) => (
              <PoolRow
                key={pool.id}
                pool={pool}
                memberCount={memberCountFor(pool.id)}
                isLast={idx === pools.length - 1}
                onEdit={() => handleEdit(pool)}
                onToggleActive={() => handleToggleActive(pool)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Edit/Create Modal */}
      {showModal && (
        <PoolEditModal
          pool={editPool}
          companyId={companyId}
          currentUser={currentUser}
          users={users}
          existingMembers={editPool ? poolMembers.filter(m => m.pool_id === editPool.id) : []}
          onClose={() => { setShowModal(false); setEditPool(null); }}
          onSaved={handleSaved}
          showToast={showToast}
        />
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────

function EmptyState({ onCreate }) {
  return (
    <div style={{ padding: 60, textAlign: "center" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>👥</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: "#0F2540", marginBottom: 8 }}>
        No agent pools yet
      </div>
      <div style={{ fontSize: 13, color: "#6B7785", marginBottom: 24, maxWidth: 380, margin: "0 auto 24px" }}>
        Create your first pool to enable round-robin lead distribution. Group agents by specialty, territory, or any other rule that fits your brokerage.
      </div>
      <button
        onClick={onCreate}
        style={{
          padding: "10px 20px",
          background: "#0F2540",
          color: "#fff",
          border: "none",
          borderRadius: 10,
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        + Create First Pool
      </button>
    </div>
  );
}

function PoolRow({ pool, memberCount, isLast, onEdit, onToggleActive }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "16px 20px",
        borderBottom: isLast ? "none" : "1px solid #F0F2F5",
        transition: "background 0.15s",
        cursor: "default",
      }}
      onMouseEnter={e => { e.currentTarget.style.background = "#FAFBFC"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
    >
      {/* Icon */}
      <div style={{
        width: 44,
        height: 44,
        borderRadius: 12,
        background: pool.is_active ? "rgba(201, 168, 76, 0.15)" : "#F0F2F5",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 20,
        flexShrink: 0,
      }}>
        👥
      </div>

      {/* Main info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: pool.is_active ? "#0F2540" : "#9CA3AF" }}>
            {pool.name}
          </span>
          {!pool.is_active && (
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              color: "#9CA3AF",
              background: "#F3F4F6",
              padding: "2px 8px",
              borderRadius: 4,
              letterSpacing: "0.4px",
              textTransform: "uppercase",
            }}>
              Inactive
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: "#6B7785", lineHeight: 1.5 }}>
          {pool.description || <span style={{ fontStyle: "italic" }}>No description</span>}
        </div>
      </div>

      {/* Member count */}
      <div style={{
        textAlign: "center",
        padding: "0 20px",
        borderLeft: "1px solid #F0F2F5",
        borderRight: "1px solid #F0F2F5",
      }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#0F2540", lineHeight: 1 }}>
          {memberCount}
        </div>
        <div style={{ fontSize: 10, color: "#6B7785", letterSpacing: "0.4px", textTransform: "uppercase", marginTop: 4 }}>
          {memberCount === 1 ? "Member" : "Members"}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={onEdit}
          style={{
            padding: "8px 14px",
            background: "#fff",
            color: "#0F2540",
            border: "1.5px solid #D1D9E6",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          ✏️ Edit
        </button>
        <button
          onClick={onToggleActive}
          style={{
            padding: "8px 14px",
            background: pool.is_active ? "#FEF3F2" : "#F0FDF4",
            color: pool.is_active ? "#B42318" : "#067647",
            border: `1.5px solid ${pool.is_active ? "#FECDCA" : "#ABEFC6"}`,
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {pool.is_active ? "Deactivate" : "Activate"}
        </button>
      </div>
    </div>
  );
}
