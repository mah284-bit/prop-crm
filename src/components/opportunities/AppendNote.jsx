import React, { useState } from "react";
import { supabase } from "../../lib/supabase.js";

export default function AppendNote({ a, canEdit, setActivities, showToast, currentUser }) {
  const [open, setOpen] = useState(false);
  const [txt, setTxt] = useState("");
  const [saving, setSaving] = useState(false);
  if (!canEdit) return null;
  const save = async () => {
    const clean = txt.trim();
    if (!clean) return;
    setSaving(true);
    const who = currentUser?.full_name || currentUser?.name || currentUser?.email || "User";
    const stamp = new Date().toLocaleString("en-AE", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
    const newNote = (a.note || "") + "\n\u21B3 [" + stamp + " \u00B7 " + who + "] " + clean;
    const { error } = await supabase.from("activities").update({ note: newNote }).eq("id", a.id);
    if (error) { showToast && showToast("Could not add note: " + error.message, "error"); setSaving(false); return; }
    try {
      const { data } = await supabase.from("activities").select("*").eq("opportunity_id", a.opportunity_id).order("created_at", { ascending: false });
      if (data) setActivities(data);
    } catch (e) {}
    setTxt(""); setOpen(false); setSaving(false);
    showToast && showToast("Note added", "success");
  };
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{ marginTop: 4, padding: "2px 8px", borderRadius: 6, border: "1px dashed #C9A84C", background: "transparent", color: "#8A6D1F", fontSize: 10, fontWeight: 600, cursor: "pointer" }}>+ Add note</button>
    );
  }
  return (
    <div style={{ marginTop: 6, display: "flex", gap: 6, alignItems: "flex-start" }}>
      <input value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="Add a follow-up note (original preserved)" autoFocus
        style={{ flex: 1, padding: "5px 8px", border: "1px solid #D1D5DB", borderRadius: 6, fontSize: 11 }}
        onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setOpen(false); setTxt(""); } }} />
      <button onClick={save} disabled={saving} style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: "#0F2540", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>{saving ? "..." : "Save"}</button>
      <button onClick={() => { setOpen(false); setTxt(""); }} disabled={saving} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid #D1D9E6", background: "#fff", fontSize: 11, cursor: "pointer" }}>Cancel</button>
    </div>
  );
}
