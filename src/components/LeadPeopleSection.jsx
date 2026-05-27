// Phase 2.2B — Contacts Subsystem (Lead Detail "People" section)
// Read-only display of all persons attached to a lead, with their primary
// phone + email. Primary buyer gets a crown badge. Non-buyer roles show
// their role label.
//
// Future (Day 18): inline "+ Add Person" button + edit. For now read-only.

import React from "react";
import { useLeadPersons, getPrimaryContact, ROLE_LABELS } from "../lib/useLeadPersons";

const roleColors = {
  buyer:          { bg: "#FEF3C7", c: "#92400E", border: "#FCD34D" }, // amber (primary)
  spouse:         { bg: "#FCE7F3", c: "#9D174D", border: "#F9A8D4" }, // pink
  representative: { bg: "#DBEAFE", c: "#1E3A8A", border: "#93C5FD" }, // blue
  secretary:      { bg: "#E0E7FF", c: "#3730A3", border: "#A5B4FC" }, // indigo
  accounts:       { bg: "#D1FAE5", c: "#065F46", border: "#6EE7B7" }, // emerald
  manager:        { bg: "#FEE2E2", c: "#991B1B", border: "#FCA5A5" }, // red
  local_contact:  { bg: "#F3E8FF", c: "#6B21A8", border: "#D8B4FE" }, // purple
  family:         { bg: "#FED7AA", c: "#9A3412", border: "#FDBA74" }, // orange
  other:          { bg: "#F1F5F9", c: "#475569", border: "#CBD5E1" }, // slate
};

export default function LeadPeopleSection({ leadId }) {
  const { persons, loading, error } = useLeadPersons(leadId);

  if (loading) {
    return (
      <div style={{ marginBottom: 14, padding: 10, fontSize: 11, color: "#94A3B8" }}>
        Loading people…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ marginBottom: 14, padding: 10, fontSize: 11, color: "#C53030" }}>
        Could not load people: {error}
      </div>
    );
  }

  if (!persons || persons.length === 0) {
    return null; // No persons → render nothing (defensive; backfill should prevent this)
  }

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 6,
        padding: "0 2px",
      }}>
        <div style={{
          fontSize: 10,
          fontWeight: 700,
          color: "#94A3B8",
          textTransform: "uppercase",
          letterSpacing: ".6px",
        }}>
          People ({persons.length})
        </div>
      </div>

      <div style={{
        background: "#fff",
        border: "1px solid #E8EDF4",
        borderRadius: 10,
        overflow: "hidden",
      }}>
        {persons.map((p, idx) => {
          const rc = roleColors[p.role] || roleColors.other;
          const phone = getPrimaryContact(p, "phone");
          const email = getPrimaryContact(p, "email");
          const whatsapp = getPrimaryContact(p, "whatsapp");
          const isLast = idx === persons.length - 1;
          return (
            <div key={p.id} style={{
              padding: "10px 14px",
              borderBottom: isLast ? "none" : "1px solid #F1F5F9",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}>
              {/* Name + role badge */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {p.is_primary_buyer && (
                  <span title="Primary Buyer" style={{ fontSize: 14 }}>👑</span>
                )}
                <span style={{ fontSize: 13, fontWeight: 600, color: "#0F2540" }}>
                  {p.name}
                </span>
                <span style={{
                  fontSize: 10,
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: 12,
                  background: rc.bg,
                  color: rc.c,
                  border: `1px solid ${rc.border}`,
                }}>
                  {ROLE_LABELS[p.role] || p.role}
                </span>
              </div>

              {/* Contacts row */}
              {(phone || email || whatsapp) && (
                <div style={{
                  display: "flex",
                  gap: 14,
                  flexWrap: "wrap",
                  fontSize: 11,
                  color: "#475569",
                  marginLeft: p.is_primary_buyer ? 22 : 0,
                }}>
                  {phone && (
                    <span>
                      📞 <a href={`tel:${phone}`} style={{ color: "#1A5FA8", textDecoration: "none", fontWeight: 600 }}>{phone}</a>
                    </span>
                  )}
                  {whatsapp && (
                    <span>
                      💬 <a href={`https://wa.me/${whatsapp.replace(/[^\d]/g, "")}`} target="_blank" rel="noopener" style={{ color: "#1A5FA8", textDecoration: "none", fontWeight: 600 }}>{whatsapp}</a>
                    </span>
                  )}
                  {email && (
                    <span>
                      ✉️ <a href={`mailto:${email}`} style={{ color: "#1A5FA8", textDecoration: "none", fontWeight: 600 }}>{email}</a>
                    </span>
                  )}
                </div>
              )}

              {/* Optional relationship notes */}
              {p.relationship_notes && (
                <div style={{
                  fontSize: 11,
                  fontStyle: "italic",
                  color: "#64748B",
                  marginLeft: p.is_primary_buyer ? 22 : 0,
                }}>
                  {p.relationship_notes}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
