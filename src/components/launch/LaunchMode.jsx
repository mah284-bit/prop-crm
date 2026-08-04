import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

export default function LaunchMode({ currentUser, showToast }) {
  const [events, setEvents] = useState([]);
  const [records, setRecords] = useState([]);
  const [activeEvent, setActiveEvent] = useState(null);
  const [showNewEvent, setShowNewEvent] = useState(false);
  const [evForm, setEvForm] = useState({ name: "", event_date: new Date().toISOString().slice(0,10) });
  const [recForm, setRecForm] = useState({ buyer_name: "", buyer_phone: "", unit_ref_text: "", quoted_price: "", allocation_status: "allocated", note: "" });
  const [saving, setSaving] = useState(false);
  const loadEvents = async () => {
    const { data } = await supabase.from("launch_events").select("*").eq("company_id", currentUser.company_id).order("created_at", { ascending: false });
    setEvents(data || []);
  };
  const loadRecords = async (eventId) => {
    const { data } = await supabase.from("launch_records").select("*").eq("event_id", eventId).order("created_at", { ascending: false });
    setRecords(data || []);
  };
  useEffect(() => { loadEvents(); }, []);
  useEffect(() => { if (activeEvent) loadRecords(activeEvent.id); }, [activeEvent]);
  const createEvent = async () => {
    if (!evForm.name.trim()) { showToast("Event name required", "error"); return; }
    const { data, error } = await supabase.from("launch_events").insert({ company_id: currentUser.company_id, name: evForm.name.trim(), event_date: evForm.event_date, created_by: currentUser.id }).select().single();
    if (error) { showToast(error.message, "error"); return; }
    setShowNewEvent(false); setEvForm({ name: "", event_date: new Date().toISOString().slice(0,10) });
    await loadEvents(); setActiveEvent(data);
    showToast("Launch event ready", "success");
  };
  const addRecord = async () => {
    if (!recForm.buyer_name.trim()) { showToast("Buyer name required", "error"); return; }
    setSaving(true);
    const { error } = await supabase.from("launch_records").insert({ event_id: activeEvent.id, company_id: currentUser.company_id, buyer_name: recForm.buyer_name.trim(), buyer_phone: recForm.buyer_phone.trim() || null, unit_ref_text: recForm.unit_ref_text.trim() || null, quoted_price: recForm.quoted_price ? Number(recForm.quoted_price) : null, allocation_status: recForm.allocation_status, note: recForm.note.trim() || null, captured_by: currentUser.id });
    setSaving(false);
    if (error) { showToast(error.message, "error"); return; }
    setRecForm({ buyer_name: "", buyer_phone: "", unit_ref_text: "", quoted_price: "", allocation_status: "allocated", note: "" });
    loadRecords(activeEvent.id);
  };
  const convertRecord = async (r) => {
    if (r.converted_opportunity_id) { showToast("Already converted", "info"); return; }
    if (!window.confirm("Convert " + r.buyer_name + " to a deal? Opportunity is born at Reserved (launch allocation = money moment) and lands in Terms Pending until a proposal is sent.")) return;
    let leadId = null;
    if (r.buyer_phone) {
      const { data: ex } = await supabase.from("leads").select("id").eq("company_id", currentUser.company_id).eq("phone", r.buyer_phone).maybeSingle();
      if (ex) leadId = ex.id;
    }
    if (!leadId) {
      const { data: nl, error: le } = await supabase.from("leads").insert({ name: r.buyer_name, phone: r.buyer_phone || null, company_id: currentUser.company_id, source: "Launch Event", assigned_to: currentUser.id }).select().single();
      if (le) { showToast("Lead create failed: " + le.message, "error"); return; }
      leadId = nl.id;
    }
    let unitId = null;
    if (r.unit_ref_text) {
      const { data: um } = await supabase.from("project_units").select("id,status").eq("unit_ref", r.unit_ref_text.trim().toUpperCase()).maybeSingle();
      if (um && um.status === "Available") unitId = um.id;
    }
    // Day 84: the agreed COMMISSION RATE. Launch mode creates deals at RESERVED directly - real
    // money deals - and an agent cannot read pp_master_agreements (RLS), so they were born with no
    // rate and the invoice later fell to the company default: 4% where Aldar agreed 4.5%.
    let _launchPct = null;
    try {
      const { data: _pu } = await supabase.from("project_units").select("project_id").eq("id", unitId).maybeSingle();
      if (_pu?.project_id) {
        const { data: _r } = await supabase.rpc("get_commission_rate", { p_project_id: _pu.project_id, p_company_id: currentUser.company_id });
        if (_r != null) _launchPct = Number(_r);
      }
    } catch (e) { console.warn("Launch commission rate lookup failed:", e); }
    const { data: opp, error: oe } = await supabase.from("opportunities").insert({ commission_pct: _launchPct, company_id: currentUser.company_id, lead_id: leadId, title: (r.unit_ref_text || "Launch") + " — " + r.buyer_name, stage: "Reserved", status: "Active", unit_id: unitId, budget: r.quoted_price || null, assigned_to: currentUser.id, notes: "Born from launch event (" + (activeEvent?.name || "") + "). " + (r.note || ""), stage_updated_at: new Date().toISOString() }).select().single();
    if (oe) { showToast("Opp create failed: " + oe.message, "error"); return; }
    if (unitId) await supabase.from("project_units").update({ status: "Reserved" }).eq("id", unitId);
    await supabase.from("activities").insert({ opportunity_id: opp.id, lead_id: leadId, company_id: currentUser.company_id, type: "Note", status: "completed", user_id: currentUser.id, user_name: currentUser.full_name || null, lead_name: r.buyer_name, stage_at_event: "Reserved", activity_subtype: "launch_conversion", note: "LAUNCH CONVERSION: captured at " + (activeEvent?.name || "launch") + (r.unit_ref_text ? " · unit " + r.unit_ref_text + (unitId ? " (matched inventory)" : " (NO inventory match - assign unit manually)") : "") + (r.quoted_price ? " · quoted AED " + Number(r.quoted_price).toLocaleString() : "") });
    await supabase.from("launch_records").update({ converted_opportunity_id: opp.id }).eq("id", r.id);
    loadRecords(activeEvent.id);
    showToast(unitId ? "Deal born at Reserved - unit claimed - Terms Pending" : "Deal born at Reserved - ASSIGN UNIT manually (no inventory match)", "success");
  };

  const S = { card: { background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: 16 }, inp: { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1.5px solid #E2E8F0", fontSize: 14 } };
  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div>
          <h2 style={{ margin: 0, color: "#0F2540" }}>{"⚡ Launch Mode"}</h2>
          <div style={{ fontSize: 12, color: "#94A3B8" }}>Rapid capture during developer launches</div>
        </div>
        <button onClick={() => setShowNewEvent(true)} style={{ padding: "9px 16px", borderRadius: 8, border: "none", background: "#0F2540", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>+ New Event</button>
      </div>
      {showNewEvent && (
        <div style={{ ...S.card, marginBottom: 14, background: "#FFFBEB", borderColor: "#FCD34D" }}>
          <input style={S.inp} placeholder="Event name" value={evForm.name} onChange={e => setEvForm(f => ({ ...f, name: e.target.value }))} autoFocus />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <input type="date" style={{ ...S.inp, flex: 1 }} value={evForm.event_date} onChange={e => setEvForm(f => ({ ...f, event_date: e.target.value }))} />
            <button onClick={createEvent} style={{ padding: "10px 18px", borderRadius: 8, border: "none", background: "#1A7F5A", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Create</button>
            <button onClick={() => setShowNewEvent(false)} style={{ padding: "10px 14px", borderRadius: 8, border: "1.5px solid #E2E8F0", background: "#fff", cursor: "pointer" }}>{"✕"}</button>
          </div>
        </div>
      )}
      {!activeEvent && (
        <div style={S.card}>
          {events.length === 0 && <div style={{ color: "#94A3B8", fontSize: 13 }}>No launch events yet.</div>}
          {events.map(ev => (
            <div key={ev.id} onClick={() => setActiveEvent(ev)} style={{ padding: "10px 12px", borderBottom: "1px solid #F0F2F5", cursor: "pointer", display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 700, color: "#0F2540" }}>{ev.name}</span>
              <span style={{ fontSize: 12, color: "#94A3B8" }}>{ev.event_date} {"·"} {ev.status}</span>
            </div>
          ))}
        </div>
      )}
      {activeEvent && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <button onClick={() => setActiveEvent(null)} style={{ border: "none", background: "none", color: "#1A5FA8", cursor: "pointer", fontSize: 13 }}>{"← Events"}</button>
            <strong style={{ color: "#0F2540" }}>{activeEvent.name}</strong>
            <span style={{ fontSize: 12, color: "#94A3B8" }}>{records.length} captured</span>
          </div>
          <div style={{ ...S.card, background: "#F0FDF4", borderColor: "#86EFAC", marginBottom: 12 }}>
            <input style={S.inp} placeholder="Buyer name *" value={recForm.buyer_name} onChange={e => setRecForm(f => ({ ...f, buyer_name: e.target.value }))} />
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <input style={{ ...S.inp, flex: 1 }} placeholder="Phone" value={recForm.buyer_phone} onChange={e => setRecForm(f => ({ ...f, buyer_phone: e.target.value }))} />
              <input style={{ ...S.inp, flex: 1 }} placeholder="Unit ref (free text)" value={recForm.unit_ref_text} onChange={e => setRecForm(f => ({ ...f, unit_ref_text: e.target.value }))} />
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <input type="number" style={{ ...S.inp, flex: 1 }} placeholder="Quoted price" value={recForm.quoted_price} onChange={e => setRecForm(f => ({ ...f, quoted_price: e.target.value }))} />
              <select style={{ ...S.inp, flex: 1 }} value={recForm.allocation_status} onChange={e => setRecForm(f => ({ ...f, allocation_status: e.target.value }))}>
                <option value="allocated">Allocated</option>
                <option value="waitlist">Waitlist</option>
                <option value="lost">Lost</option>
              </select>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <input style={{ ...S.inp, flex: 1 }} placeholder="Note" value={recForm.note} onChange={e => setRecForm(f => ({ ...f, note: e.target.value }))} />
              <button onClick={addRecord} disabled={saving} style={{ padding: "10px 22px", borderRadius: 8, border: "none", background: saving ? "#A0AEC0" : "#1A7F5A", color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>{saving ? "..." : "⚡ Capture"}</button>
            </div>
          </div>
          <div style={S.card}>
            {records.map(r => (
              <div key={r.id} style={{ padding: "8px 10px", borderBottom: "1px solid #F0F2F5", display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr auto auto", gap: 8, fontSize: 12, alignItems: "center" }}>
                <span style={{ fontWeight: 700, color: "#0F2540" }}>{r.buyer_name}<span style={{ color: "#94A3B8", fontWeight: 400 }}> {r.buyer_phone || ""}</span></span>
                <span style={{ color: "#475569" }}>{r.unit_ref_text || "—"}</span>
                <span style={{ color: "#475569" }}>{r.quoted_price ? "AED " + Number(r.quoted_price).toLocaleString() : "—"}</span>
                <span>{r.allocation_status === "allocated" ? "✅" : r.allocation_status === "waitlist" ? "⏳" : "❌"}</span>
                <span>{r.converted_opportunity_id ? <span style={{fontSize:10,color:"#16A34A",fontWeight:700}}>{"✓ deal"}</span> : <button onClick={() => convertRecord(r)} style={{padding:"3px 10px",borderRadius:6,border:"none",background:"#0F2540",color:"#fff",fontSize:10,fontWeight:700,cursor:"pointer"}}>{"→ Convert"}</button>}</span>
              </div>
            ))}
            {records.length === 0 && <div style={{ color: "#94A3B8", fontSize: 13 }}>Nothing captured yet.</div>}
          </div>
        </>
      )}
    </div>
  );
}
