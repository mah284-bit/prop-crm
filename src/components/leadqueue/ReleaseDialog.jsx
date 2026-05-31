import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "../../lib/supabase.js";

/* ═══════════════════════════════════════════════════════════════
   ReleaseDialog — Phase 2.1 Day 22
   Broker formal release workflow per design doc governance rules.
   
   Two release modes:
     1. release_to_queue  — lead returns to Lead Queue (unassigned)
     2. transfer_to_broker — direct handoff to specific broker
   
   Both require mandatory reason (prevents silent abandonment).
   Both write a lead_assignment_log row + update leads.assignment_status.
   
   Usage:
     <ReleaseDialog
       lead={lead}
       currentUser={currentUser}
       users={users}
       onClose={() => setShowRelease(false)}
       onReleased={(result) => { ... }}
       showToast={showToast}
     />
═══════════════════════════════════════════════════════════════ */

export default function ReleaseDialog({
  lead,
  currentUser,
  users = [],
  onClose,
  onReleased,
  showToast,
}) {
  const [mode, setMode] = useState("release_to_queue"); // or "transfer_to_broker"
  const [recipientId, setRecipientId] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  // Eligible transfer recipients: active users in same company, NOT the current owner
  const eligibleRecipients = useMemo(() => 
    users.filter(u => 
      u.is_active && 
      u.company_id === currentUser?.company_id &&
      u.id !== lead?.assigned_to && // can't transfer to self/current owner
      ["super_admin", "admin", "sales_manager", "sales_agent"].includes(u.role)
    ),
    [users, currentUser, lead]
  );

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && !saving) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  const canSubmit = useMemo(() => {
    if (!reason.trim()) return false;
    if (mode === "transfer_to_broker" && !recipientId) return false;
    return !saving;
  }, [reason, mode, recipientId, saving]);

  const handleSubmit = async () => {
    if (!lead?.id || !currentUser?.id) {
      showToast?.("Missing context", "error");
      return;
    }
    if (!reason.trim()) {
      showToast?.("Reason is required", "error");
      return;
    }
    if (mode === "transfer_to_broker" && !recipientId) {
      showToast?.("Select a recipient broker", "error");
      return;
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const isRelease = mode === "release_to_queue";

      // Step 1: Update the lead
      const leadUpdate = isRelease
        ? {
            assigned_to: null,
            assignment_status: "released",
            last_assigned_at: now,
          }
        : {
            assigned_to: recipientId,
            assignment_status: "assigned",
            last_assigned_at: now,
            last_broker_activity_at: now,
          };

      const { error: lErr } = await supabase
        .from("leads")
        .update(leadUpdate)
        .eq("id", lead.id);
      if (lErr) throw lErr;

      // Step 2: Write audit log
      const logRow = {
        lead_id: lead.id,
        company_id: lead.company_id,
        action: isRelease ? "broker_released" : "broker_transferred",
        from_user_id: lead.assigned_to,
        to_user_id: isRelease ? null : recipientId,
        pool_id: null,
        method: isRelease ? "release" : "transfer",
        reason: reason.trim(),
        triggered_by: currentUser.id,
      };
      const { error: logErr } = await supabase
        .from("lead_assignment_log")
        .insert(logRow);
      if (logErr) {
        // Non-fatal: lead is already updated. Log warning but don't fail.
        console.warn("[ReleaseDialog] audit log insert failed:", logErr);
      }

      const recipientName = isRelease 
        ? "Lead Queue" 
        : (eligibleRecipients.find(u => u.id === recipientId)?.full_name || "the recipient");
      showToast?.(
        isRelease 
          ? `Lead released back to ${recipientName}` 
          : `Lead transferred to ${recipientName}`,
        "success"
      );

      onReleased?.({
        success: true,
        mode,
        recipientId: isRelease ? null : recipientId,
        leadId: lead.id,
      });
    } catch (e) {
      console.error("[ReleaseDialog] error:", e);
      showToast?.(`Couldn't release: ${e.message}`, "error");
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
          maxWidth: 520,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 50px rgba(15,37,64,0.25)",
        }}
      >
        {/* Header */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #F0F2F5" }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0F2540", margin: 0, marginBottom: 4 }}>
            Release Lead
          </h2>
          <div style={{ fontSize: 12, color: "#6B7785" }}>
            {lead?.name && <>Lead: <strong>{lead.name}</strong> · </>}
            Drop ownership formally — choose how the lead should be handled.
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px", flex: 1, overflowY: "auto" }}>
          {/* Mode selector */}
          <Label>Release mode</Label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
            <ModeOption
              selected={mode === "release_to_queue"}
              onClick={() => setMode("release_to_queue")}
              icon="📥"
              title="Release to Lead Queue"
              description="Return the lead to the admin Lead Queue. It re-enters the round-robin pool for re-assignment."
            />
            <ModeOption
              selected={mode === "transfer_to_broker"}
              onClick={() => setMode("transfer_to_broker")}
              icon="🤝"
              title="Transfer to Specific Broker"
              description="Hand the lead directly to a named colleague. Audit log captures who, why, and when."
            />
          </div>

          {/* Recipient (if transfer mode) */}
          {mode === "transfer_to_broker" && (
            <div style={{ marginBottom: 18 }}>
              <Label>Recipient broker <Required /></Label>
              <select
                value={recipientId}
                onChange={(e) => setRecipientId(e.target.value)}
                style={selectStyle}
              >
                <option value="">— Select a broker —</option>
                {eligibleRecipients.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.role.replace(/_/g, " ")})
                  </option>
                ))}
              </select>
              {eligibleRecipients.length === 0 && (
                <div style={{
                  fontSize: 12,
                  color: "#B45309",
                  marginTop: 6,
                  padding: "6px 10px",
                  background: "#FEF3C7",
                  borderRadius: 6,
                }}>
                  No eligible brokers found in your company.
                </div>
              )}
            </div>
          )}

          {/* Reason (always mandatory) */}
          <div style={{ marginBottom: 8 }}>
            <Label>Reason <Required /></Label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={mode === "release_to_queue" 
                ? "e.g., Buyer's needs are outside my specialization. Returning to queue for re-assignment."
                : "e.g., Buyer prefers villa specialist. Transferring to Rajesh who handles this segment."}
              rows={3}
              style={{ ...inputStyle, width: "100%", resize: "vertical", minHeight: 70 }}
            />
            <div style={{ fontSize: 11, color: "#6B7785", marginTop: 4 }}>
              Required. Written to audit log permanently.
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
            style={cancelBtnStyle(saving)}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={submitBtnStyle(!canSubmit)}
          >
            {saving 
              ? "Releasing..." 
              : (mode === "release_to_queue" ? "Release to Queue" : "Transfer Lead")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────

function ModeOption({ selected, onClick, icon, title, description }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "12px 14px",
        border: `1.5px solid ${selected ? "#C9A84C" : "#E5E9EF"}`,
        borderRadius: 10,
        background: selected ? "rgba(201, 168, 76, 0.08)" : "#fff",
        cursor: "pointer",
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
        marginTop: 2,
      }}>
        {selected && <div style={{ width: 9, height: 9, borderRadius: "50%", background: "#C9A84C" }} />}
      </div>
      <div style={{ fontSize: 16, lineHeight: 1, marginTop: 1 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#0F2540", marginBottom: 3 }}>
          {title}
        </div>
        <div style={{ fontSize: 12, color: "#6B7785", lineHeight: 1.4 }}>
          {description}
        </div>
      </div>
    </div>
  );
}

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

const inputStyle = {
  padding: "10px 12px",
  border: "1.5px solid #D1D9E6",
  borderRadius: 8,
  fontSize: 13,
  color: "#0F2540",
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

const selectStyle = {
  ...inputStyle,
  width: "100%",
  background: "#fff",
  cursor: "pointer",
};

const cancelBtnStyle = (saving) => ({
  padding: "10px 18px",
  background: "#fff",
  color: "#0F2540",
  border: "1.5px solid #D1D9E6",
  borderRadius: 10,
  fontSize: 13,
  fontWeight: 600,
  cursor: saving ? "not-allowed" : "pointer",
  opacity: saving ? 0.6 : 1,
});

const submitBtnStyle = (disabled) => ({
  padding: "10px 22px",
  background: disabled ? "#9CA3AF" : "#B42318",
  color: "#fff",
  border: "none",
  borderRadius: 10,
  fontSize: 13,
  fontWeight: 700,
  cursor: disabled ? "not-allowed" : "pointer",
});
