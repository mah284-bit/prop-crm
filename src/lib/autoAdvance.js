// Evidence-based auto-advance (Design Capture #3, v1 slice: activity -> Contacted)
// + lead lifecycle wiring (Design Capture #2: first completed activity -> Qualified)
export async function autoAdvanceOnActivity({ opp, lead, savedActivity, supabase, showToast, onStageChanged }) {
  try {
    // Lead lifecycle: raw -> qualified on first completed activity
    if (lead?.id && ((lead.lifecycle_stage || "raw").toLowerCase() === "raw") && savedActivity?.status === "completed") {
      await supabase.from("leads").update({ lifecycle_stage: "qualified" }).eq("id", lead.id);
    }
    // Stage: New -> Contacted on completed activity (the activity IS the contact evidence)
    if (opp?.id && opp.stage === "New" && savedActivity?.status === "completed") {
      const { error } = await supabase.from("opportunities")
        .update({ stage: "Contacted", stage_updated_at: new Date().toISOString() })
        .eq("id", opp.id);
      if (!error) {
        await supabase.from("activities").insert({
          opportunity_id: opp.id, lead_id: lead?.id || opp.lead_id,
          company_id: opp.company_id || null,
          type: "Note", status: "completed",
          note: "Stage auto-advanced to Contacted - inferred from " + (savedActivity.type || "activity") + " logged",
          user_id: savedActivity.user_id || null, user_name: savedActivity.user_name || null,
          lead_name: lead?.name || null, stage_at_event: "Contacted",
          activity_subtype: "auto_stage_advance",
        });
        showToast && showToast("Deal advanced to Contacted - first contact logged", "success");
        onStageChanged && onStageChanged("Contacted");
      }
    }
  } catch (e) { console.warn("autoAdvance skipped:", e); }
}
