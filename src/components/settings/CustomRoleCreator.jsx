import React, { useState } from "react";
import { supabase } from "../../lib/supabase.js";

export function CustomRoleCreator({ companyId, onRoleCreated, showToast }) {
  const [showCreate, setShowCreate] = useState(false);
  const [roleName, setRoleName] = useState("");
  const [roleDesc, setRoleDesc] = useState("");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!roleName.trim()) { showToast("Role name required", "warning"); return; }
    
    try {
      setSaving(true);
      const roleId = "custom_" + Date.now();
      
      // Insert custom role
      const { error } = await supabase.from("roles").insert({
        id: roleId,
        company_id: companyId,
        name: roleName,
        description: roleDesc,
        is_custom: true,
        created_at: new Date().toISOString(),
      });
      
      if (error) throw error;
      
      showToast("Custom role created: " + roleName, "success");
      onRoleCreated(roleId);
      setRoleName("");
      setRoleDesc("");
      setShowCreate(false);
    } catch (e) {
      showToast("Failed to create role: " + e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {!showCreate ? (
        <button onClick={() => setShowCreate(true)} style={{
          padding: "10px 16px",
          borderRadius: 8,
          border: "1.5px dashed #0F2540",
          background: "#fff",
          color: "#0F2540",
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer"
        }}>
          + Create Custom Role
        </button>
      ) : (
        <div style={{
          padding: 16,
          background: "#F8FAFC",
          borderRadius: 8,
          border: "1px solid #E2E8F0",
          gap: 12,
          display: "flex",
          flexDirection: "column"
        }}>
          <input
            type="text"
            placeholder="Role name (e.g., Junior Agent)"
            value={roleName}
            onChange={(e) => setRoleName(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: 6,
              border: "1px solid #E2E8F0",
              fontSize: 12
            }}
          />
          <textarea
            placeholder="Description (optional)"
            value={roleDesc}
            onChange={(e) => setRoleDesc(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: 6,
              border: "1px solid #E2E8F0",
              fontSize: 12,
              minHeight: 60,
              fontFamily: "inherit"
            }}
          />
          <div style={{display: "flex", gap: 8}}>
            <button onClick={handleCreate} disabled={saving} style={{
              flex: 1,
              padding: "8px 12px",
              borderRadius: 6,
              border: "none",
              background: "#0F2540",
              color: "#fff",
              fontSize: 12,
              fontWeight: 600,
              cursor: saving ? "not-allowed" : "pointer"
            }}>
              {saving ? "Creating..." : "Create Role"}
            </button>
            <button onClick={() => setShowCreate(false)} style={{
              flex: 1,
              padding: "8px 12px",
              borderRadius: 6,
              border: "1px solid #E2E8F0",
              background: "#fff",
              color: "#475569",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer"
            }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
