import React, { useState } from "react";
import OpportunityForm from "./OpportunityForm.jsx";

/**
 * OpportunityFormAdapter — Wraps OpportunityForm + adds save/lifecycle logic
 * Used by: LeadDetail, CreateOpportunityDialog, OpportunityDetail
 */
export default function OpportunityFormAdapter({
  lead,
  units,
  projects,
  salePricing,
  users,
  opps,
  currentUser,
  supabase,
  showToast,
  onSaved,
  onCancelled,
}) {
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (formData) => {
    setSaving(true);
    try {
      const unit = units.find(u => u.id === formData.unit_id);
      const unitPrice = (salePricing || []).find(s => s.unit_id === formData.unit_id)?.asking_price;
      const isOffPlan = (formData.property_category || "Off-Plan") === "Off-Plan";

      const payload = {
        lead_id: lead.id,
        company_id: currentUser.company_id || null,
        title: formData.title || (unit ? `${unit.unit_ref} — ${lead.name}` : `Opportunity — ${lead.name}`),
        unit_id: formData.unit_id || null,
        budget: formData.budget ? Number(formData.budget) : null,
        assigned_to: formData.assigned_to || currentUser.id,
        notes: formData.notes || null,
        property_category: formData.property_category || "Off-Plan",
        stage: "New",
        status: "Active",
        created_by: currentUser.id,
        current_agreed_price: unitPrice || null,
        current_admin_fee: 580,
        current_trustee_fee: isOffPlan ? 4200 : null,
        current_values_updated_at: new Date().toISOString(),
        current_values_updated_by: currentUser.id,
      };

      const { data, error } = await supabase.from("opportunities").insert(payload).select().single();
      if (error) throw error;

      // Phase 2.4: Auto-transition lifecycle
      if (lead && (lead.lifecycle_stage === "raw" || lead.lifecycle_stage === "qualified")) {
        supabase.from("leads").update({ lifecycle_stage: "active_prospect" }).eq("id", lead.id).catch(e => console.warn("Lifecycle update:", e));
      }

      showToast("Opportunity created", "success");
      if (onSaved) onSaved(data);
    } catch (e) {
      showToast("Error: " + e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ opacity: saving ? 0.6 : 1, pointerEvents: saving ? "none" : "auto" }}>
      <OpportunityForm
        mode="create-from-lead"
        lead={lead}
        units={units}
        projects={projects}
        salePricing={salePricing}
        users={users}
        opps={opps}
        currentUser={currentUser}
        onSubmit={handleSubmit}
        onCancel={onCancelled}
      />
      {saving && <div style={{ fontSize: 11, color: "#64748B", marginTop: 8, textAlign: "center" }}>Saving…</div>}
    </div>
  );
}
