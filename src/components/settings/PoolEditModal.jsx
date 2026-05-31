import React, { useState, useMemo, useEffect } from "react";
import { supabase } from "../../lib/supabase.js";

/* ═══════════════════════════════════════════════════════════════
   PoolEditModal — Phase 2.1 Day 21
   Create or edit an agent_pool, including its member list.
   
   Modern member picker: search bar + chips + checkbox list.
   - Type to filter the agent list (handles 50+ agents gracefully)
   - Chips above show currently selected (× to quick-remove)
   - Checkbox list below shows all/filtered agents
   - Row-level click toggles (whole row clickable, not just checkbox)
   
   Save behavior:
   - Create: INSERT pool row, then INSERT all members
   - Edit: UPDATE pool row, DELETE all existing members, INSERT new member set
     (simpler than diff-based reconciliation, audit log untouched)
═══════════════════════════════════════════════════════════════ */

export default function PoolEditModal({
  pool,        // null for create mode, pool row for edit mode
  companyId,
  currentUser,
  users = [],
  existingMembers = [],  // [{pool_id, user_id, last_assigned_at}]
  onClose,
  onSaved,
  showToast,
}) {
  const isEdit = !!pool;

  const [name, setName] = useState(pool?.name || "");
  const [description, setDescription] = useState(pool?.description || "");
  const [selectedUserIds, setSelectedUserIds] = useState(
    new Set(existingMembers.map(m => m.user_id))
  );
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  // Filter only active users (the pool should not include deactivated profiles)
  const activeUsers = useMemo(() => 
    users.filter(u => u.is_active && u.company_id === companyId),
    [users, companyId]
  );

  // Filter by search (case-insensitive name or email)
  const filteredUsers = useMemo(() => {
    if (!search.trim()) return activeUsers;
    const q = search.trim().toLowerCase();
    return activeUsers.filter(u => 
      (u.full_name || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q)
    );
  }, [activeUsers, search]);

  // Selected user objects (for chips)
  const selectedUsers = useMemo(() => 
    activeUsers.filter(u => selectedUserIds.has(u.id)),
    [activeUsers, selectedUserIds]
  );

  const toggleUser = (userId) => {
    setSelectedUserIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleSave = async () => {
    if (!name.trim()) {
      showToast?.("Pool name is required", "error");
      return;
    }
    if (selectedUserIds.size === 0) {
      const proceed = window.confirm("This pool has no members. Round-robin won't work until members are added. Save anyway?");
      if (!proceed) return;
    }
    setSaving(true);
    try {
      let savedPool;
      if (isEdit) {
        // UPDATE existing pool
        const { data, error } = await supabase
          .from("agent_pools")
          .update({
            name: name.trim(),
            description: description.trim() || null,
          })
          .eq("id", pool.id)
          .select()
          .single();
        if (error) throw error;
        savedPool = data;

        // Replace member set: DELETE all, INSERT new set
        const { error: delErr } = await supabase
          .from("agent_pool_members")
          .delete()
          .eq("pool_id", pool.id);
        if (delErr) throw delErr;
      } else {
        // CREATE new pool
        const { data, error } = await supabase
          .from("agent_pools")
          .insert({
            company_id: companyId,
            name: name.trim(),
            description: description.trim() || null,
            created_by: currentUser?.id || null,
            is_active: true,
          })
          .select()
          .single();
        if (error) throw error;
        savedPool = data;
      }

      // INSERT members
      let savedMembers = [];
      if (selectedUserIds.size > 0) {
        const memberRows = Array.from(selectedUserIds).map(uid => ({
          pool_id: savedPool.id,
          user_id: uid,
          // Preserve last_assigned_at for users who were already in the pool
          last_assigned_at: existingMembers.find(m => m.user_id === uid)?.last_assigned_at || null,
        }));
        const { data: m, error: mErr } = await supabase
          .from("agent_pool_members")
          .insert(memberRows)
          .select();
        if (mErr) throw mErr;
        savedMembers = m || [];
      }

      onSaved(savedPool, savedMembers);
    } catch (e) {
      console.error("[PoolEditModal] save error:", e);
      showToast?.(`Couldn't save pool: ${e.message}`, "error");
      setSaving(false);
    }
  };

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && !saving) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

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
            {isEdit ? "Edit Pool" : "Create Agent Pool"}
          </h2>
          <div style={{ fontSize: 12, color: "#6B7785" }}>
            {isEdit ? "Update pool details and members." : "Group agents for round-robin lead distribution."}
          </div>
        </div>

        {/* Body (scrollable) */}
        <div style={{ padding: "20px 24px", flex: 1, overflowY: "auto" }}>
          {/* Name */}
          <Field label="Pool name" required>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='e.g. "Downtown Specialists"'
              autoFocus
              style={inputStyle}
            />
          </Field>

          {/* Description */}
          <Field label="Description" optional>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this pool handle?"
              style={inputStyle}
            />
          </Field>

          {/* Members section */}
          <Field
            label={`Pool members${selectedUserIds.size > 0 ? ` (${selectedUserIds.size})` : ""}`}
            optional
          >
            {/* Chips (currently selected) */}
            {selectedUsers.length > 0 && (
              <div style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                marginBottom: 10,
                padding: "10px 12px",
                background: "#FAFBFC",
                borderRadius: 8,
                border: "1px solid #F0F2F5",
              }}>
                {selectedUsers.map(u => (
                  <Chip key={u.id} name={u.full_name} onRemove={() => toggleUser(u.id)} />
                ))}
              </div>
            )}

            {/* Search */}
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`🔍 Search agents${activeUsers.length > 0 ? ` (${activeUsers.length} available)` : ""}...`}
              style={{ ...inputStyle, marginBottom: 8 }}
            />

            {/* Agent list */}
            <div style={{
              maxHeight: 240,
              overflowY: "auto",
              border: "1px solid #E5E9EF",
              borderRadius: 8,
            }}>
              {filteredUsers.length === 0 ? (
                <div style={{ padding: 20, textAlign: "center", color: "#6B7785", fontSize: 13 }}>
                  {search.trim() ? `No agents matching "${search}"` : "No active agents available"}
                </div>
              ) : (
                filteredUsers.map((u, idx) => {
                  const checked = selectedUserIds.has(u.id);
                  return (
                    <div
                      key={u.id}
                      onClick={() => toggleUser(u.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 12px",
                        cursor: "pointer",
                        background: checked ? "rgba(201, 168, 76, 0.06)" : "transparent",
                        borderBottom: idx === filteredUsers.length - 1 ? "none" : "1px solid #F5F7FA",
                        transition: "background 0.1s",
                      }}
                      onMouseEnter={e => { if (!checked) e.currentTarget.style.background = "#FAFBFC"; }}
                      onMouseLeave={e => { if (!checked) e.currentTarget.style.background = "transparent"; }}
                    >
                      <div style={{
                        width: 18,
                        height: 18,
                        borderRadius: 4,
                        border: `1.5px solid ${checked ? "#C9A84C" : "#D1D9E6"}`,
                        background: checked ? "#C9A84C" : "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}>
                        {checked && (
                          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                            <path d="M1.5 5.5L4 8L9.5 2.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#0F2540" }}>{u.full_name}</div>
                        <div style={{ fontSize: 11, color: "#6B7785" }}>{u.email}</div>
                      </div>
                      {u.role && (
                        <div style={{
                          fontSize: 10,
                          fontWeight: 600,
                          color: "#6B7785",
                          background: "#F0F2F5",
                          padding: "2px 8px",
                          borderRadius: 4,
                          textTransform: "capitalize",
                        }}>
                          {u.role.replace(/_/g, " ")}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </Field>
        </div>

        {/* Footer actions */}
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
            onClick={handleSave}
            disabled={saving || !name.trim()}
            style={{
              padding: "10px 22px",
              background: "#0F2540",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
              cursor: (saving || !name.trim()) ? "not-allowed" : "pointer",
              opacity: (saving || !name.trim()) ? 0.6 : 1,
            }}
          >
            {saving ? "Saving..." : (isEdit ? "Save Changes" : "Create Pool")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components & styles ────────────────────────────────────

function Field({ label, required, optional, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{
        display: "block",
        fontSize: 12,
        fontWeight: 700,
        color: "#0F2540",
        marginBottom: 6,
        letterSpacing: "0.3px",
      }}>
        {label}
        {required && <span style={{ color: "#B42318", marginLeft: 4 }}>*</span>}
        {optional && <span style={{ color: "#9CA3AF", marginLeft: 6, fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>(optional)</span>}
      </label>
      {children}
    </div>
  );
}

function Chip({ name, onRemove }) {
  return (
    <div style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "5px 6px 5px 10px",
      background: "#0F2540",
      color: "#fff",
      borderRadius: 6,
      fontSize: 12,
      fontWeight: 600,
    }}>
      {name}
      <button
        onClick={onRemove}
        style={{
          background: "rgba(255,255,255,0.2)",
          border: "none",
          color: "#fff",
          width: 16,
          height: 16,
          borderRadius: 4,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          lineHeight: 1,
          padding: 0,
        }}
        aria-label={`Remove ${name}`}
      >
        ×
      </button>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  border: "1.5px solid #D1D9E6",
  borderRadius: 8,
  fontSize: 13,
  color: "#0F2540",
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
};
