// Phase 2.2B — Contacts Subsystem (Lead Detail "People" section)
// Display all persons attached to a lead, with their primary phone + email.
// Primary buyer gets a crown badge and is read-only (use V2 form to edit
// buyer-level fields). Additional persons can be added, edited, removed.
//
// Day 17 Step 18B: Adds + Add Person button, edit icons, modal wiring.

import React, { useState } from "react";
import { useLeadPersons, getPrimaryContact, ROLE_LABELS } from "../lib/useLeadPersons";
import LeadPersonEditModal from "./LeadPersonEditModal.jsx";

const roleColors = {
  buyer:          { bg: "#FEF3C7", c: "#92400E", border: "#FCD34D" },
  spouse:         { bg: "#FCE7F3", c: "#9D174D", border: "#F9A8D4" },
  representative: { bg: "#DBEAFE", c: "#1E3A8A", border: "#93C5FD" },
  secretary:      { bg: "#E0E7FF", c: "#3730A3", border: "#A5B4FC" },
  accounts:       { bg: "#D1FAE5", c: "#065F46", border: "#6EE7B7" },
  manager:        { bg: "#FEE2E2", c: "#991B1B", border: "#FCA5A5" },
  local_contact:  { bg: "#F3E8FF", c: "#6B21A8", border: "#D8B4FE" },
  family:         { bg: "#FED7AA", c: "#9A3412", border: "#FDBA74" },
  other:          { bg: "#F1F5F9", c: "#475569", border: "#CBD5E1" },
};

export default function LeadPeopleSection({
  leadId,
  companyId,
  currentUserId,
  countries = [],
}) {
  const { persons, loading, error, refetch } = useLeadPersons(leadId);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState(null); // null = Add, row = Edit

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

  const openAdd = () => {
    setEditingPerson(null);
    setModalOpen(true);
  };

  const openEdit = (p) => {
    setEditingPerson(p);
    setModalOpen(true);
  };

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
          People ({persons?.length || 0})
        </div>
        <button
          onClick={openAdd}
          style={{
            padding: "4px 10px",
            borderRadius: 6,
            border: "1.5px solid #D1D9E6",
            background: "#fff",
            fontSize: 11,
            fontWeight: 600,
            color: "#0F2540",
            cursor: "pointer",
          }}
        >
          + Add Person
        </button>
      </div>

      {(!persons || persons.length === 0) ? (
        <div style={{
          padding: 14,
          fontSize: 12,
          color: "#94A3B8",
          fontStyle: "italic",
          background: "#fff",
          border: "1px dashed #E8EDF4",
          borderRadius: 10,
          textAlign: "center",
        }}>
          No people on file yet.
        </div>
      ) : (
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
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
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
                  {!p.is_primary_buyer && (
                    <button
                      onClick={() => openEdit(p)}
                      title="Edit person"
                      style={{
                        padding: "2px 8px",
                        borderRadius: 6,
                        border: "1px solid #E2E8F0",
                        background: "#fff",
                        fontSize: 11,
                        color: "#475569",
                        cursor: "pointer",
                      }}
                    >
                      Edit
                    </button>
                  )}
                </div>

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
      )}

      {modalOpen && (
        <LeadPersonEditModal
          leadId={leadId}
          companyId={companyId}
          currentUserId={currentUserId}
          person={editingPerson}
          countries={countries}
          onClose={() => setModalOpen(false)}
          onSaved={() => refetch()}
        />
      )}
    </div>
  );
}
