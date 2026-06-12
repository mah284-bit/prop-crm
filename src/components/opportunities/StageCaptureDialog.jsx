import React, { useState, useEffect } from 'react';
import { supabase } from "../../lib/supabase.js";
import { Modal } from "../../modules/shared/Modal.jsx";
import { Btn } from "../../modules/shared/Btn.jsx";
import { FF } from "../../modules/shared/FormComponents.jsx";
import { STAGE_CAPTURE_CONFIGS } from "../../modules/constants.js";

function StageCaptureDialog({ open, opp, lead, fromStage, toStage, currentUser, onSave, onCancel, showToast, units = [], projects = [], salePricing = [] }) {
  const config = STAGE_CAPTURE_CONFIGS[toStage];
  const [data, setData] = useState({});
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [unitSearch, setUnitSearch] = useState({}); // per-field-key search query for unit pickers

  // Initialize default values when dialog opens
  useEffect(() => {
    if (!open || !config) return;
    const init = {};
    config.fields.forEach(f => {
      if (f.kind === "date" && f.defaultOffsetDays) {
        const d = new Date();
        d.setDate(d.getDate() + f.defaultOffsetDays);
        init[f.key] = d.toISOString().split("T")[0];
      } else if (f.kind === "datetime" && f.defaultOffsetHours != null) {
        const d = new Date();
        d.setHours(d.getHours() + f.defaultOffsetHours, 0, 0, 0);
        // Format as yyyy-MM-ddTHH:mm for <input type="datetime-local">
        const pad = n => String(n).padStart(2,"0");
        init[f.key] = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      } else if (f.kind === "multi_select") {
        // Phase E: when this multi-select pulls from `units` and the opp has a linked unit,
        // pre-select it — that unit is almost always the primary subject of a site visit.
        if (f.source === "units" && opp?.unit_id) {
          init[f.key] = [opp.unit_id];
        } else {
          init[f.key] = [];
        }
      } else if (f.kind === "asks_grid") {
        init[f.key] = {};
      } else if (f.kind === "checkbox") {
        init[f.key] = false;
      } else {
        init[f.key] = "";
      }
    });
    setData(init);
    setErrors({});
  }, [open, toStage]);

  if (!open || !config) return null;

  const setField = (k,v) => setData(d => ({...d, [k]: v}));

  const validate = () => {
    const errs = {};
    for (const f of config.fields) {
      const v = data[f.key];
      if (f.required) {
        if (f.kind === "multi_select") {
          if (!Array.isArray(v) || v.length === 0) errs[f.key] = "Pick at least one";
        } else if (f.kind === "asks_grid") {
          const enabled = v && typeof v === "object" ? Object.keys(v).filter(k => v[k]?.enabled) : [];
          if (enabled.length === 0) errs[f.key] = "Tick at least one ask";
          // Require detail value for any enabled ask that has a detail field
          for (const k of enabled) {
            const def = ASKS_GRID_OPTIONS.find(o => o.key === k);
            if (def?.detail && !((v[k]?.value||"").toString().trim())) {
              errs[f.key] = `Add details for ${def.label}`;
              break;
            }
          }
        } else if (f.kind === "checkbox") {
          // checkboxes are inherently optional — required just means "must be true"
          if (!v) errs[f.key] = "Required";
        } else if (!v || (typeof v === "string" && v.trim() === "")) {
          errs[f.key] = "Required";
        }
      }
      if (f.minLength && typeof v === "string" && v.trim().length < f.minLength) {
        errs[f.key] = `Please write at least ${f.minLength} characters`;
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      showToast("Please complete the required fields","error");
      return;
    }
    // 16 May 2026: Idempotency check - prevent duplicate stage advances
    // (Bug: 2 identical activities created when user clicks Save twice
    //  after first save succeeded but UI didn't refresh fast enough)
    if (opp.stage === toStage) {
      showToast(`Already at ${toStage} stage`, "info");
      return;
    }
    // Also check for recent identical activity (within 60 seconds)
    // - protects against split-second double submits
    try {
      const sixtySecondsAgo = new Date(Date.now() - 60000).toISOString();
      const { data: recentActs } = await supabase
        .from("activities")
        .select("id")
        .eq("opportunity_id", opp.id)
        .eq("activity_subtype", "stage_advance")
        .eq("from_stage", fromStage)
        .eq("to_stage", toStage)
        .gte("created_at", sixtySecondsAgo)
        .limit(1);
      if (recentActs && recentActs.length > 0) {
        showToast(`Already saved ${toStage} just now`, "info");
        return;
      }
    } catch (e) {
      // Fail-open: if check fails, proceed (don't block user)
      console.warn("Idempotency check failed (non-blocking):", e);
    }
    // 16 May 2026: Idempotency check - prevent duplicate stage advances
    // (Bug: 2 identical activities created when user clicks Save twice
    //  after first save succeeded but UI didn't refresh fast enough)
    if (opp.stage === toStage) {
      showToast(`Already at ${toStage} stage`, "info");
      return;
    }
    // Also check for recent identical activity (within 60 seconds)
    // - protects against split-second double submits
    try {
      const sixtySecondsAgo = new Date(Date.now() - 60000).toISOString();
      const { data: recentActs } = await supabase
        .from("activities")
        .select("id")
        .eq("opportunity_id", opp.id)
        .eq("activity_subtype", "stage_advance")
        .eq("from_stage", fromStage)
        .eq("to_stage", toStage)
        .gte("created_at", sixtySecondsAgo)
        .limit(1);
      if (recentActs && recentActs.length > 0) {
        showToast(`Already saved ${toStage} just now`, "info");
        return;
      }
    } catch (e) {
      // Fail-open: if check fails, proceed (don't block user)
      console.warn("Idempotency check failed (non-blocking):", e);
    }

    // Edge case: if "Lost interest" selected, ask user to confirm — they may want Closed Lost instead
    if (config.onLostInterestSuggest && data.next_step === "Lost interest") {
      const goLost = window.confirm(
        `You selected "Lost interest" as the next step.\n\n` +
        `Would you like to mark this opportunity as Closed Lost instead of Contacted?\n\n` +
        `Click OK to mark as Closed Lost.\nClick Cancel to keep advancing to Contacted.`
      );
      if (goLost) {
        // Caller will detect this and route to Lost flow
        onCancel();
        // Caller is responsible for opening the Closed Lost dialog
        // We pass a sentinel via showToast for now — clean up later
        showToast("Switching to Closed Lost flow…", "info");
        return; // The OpportunityDetail will need to handle this via prop
      }
    }

    setSaving(true);
    try {
      // Get company_id from the opp (denormalized) — fall back to currentUser
      const company_id = opp.company_id || currentUser.company_id;
      if (!company_id) {
        showToast("Missing company_id — cannot save","error");
        setSaving(false);
        return;
      }

      // 1. Insert activity row with stage context + structured data
      // Phase E W2 refactor: Site Visit is a SCHEDULED visit (status="upcoming"),
      // other stages are completed events. Config drives this via activityScheduledAtKey.
      const scheduledAtKey = config.activityScheduledAtKey;
      const scheduledAt = scheduledAtKey && data[scheduledAtKey] ? new Date(data[scheduledAtKey]).toISOString() : null;
      const isScheduledFuture = scheduledAt && new Date(scheduledAt) > new Date();
      const activityType = config.activityType || "Stage Change";
      // Note text — for scheduled visits we summarise the scheduling, otherwise use captured discussion
      const activityNote = isScheduledFuture
        ? `[${toStage} scheduled] ${data.expected_attendees?`with ${data.expected_attendees}`:""}${data.prep_notes?` — ${data.prep_notes}`:""}`.slice(0,1000)
        : `[${toStage}] ${data.discussion||data.broker_notes||""}`.slice(0, 1000);
      const { data: actRow, error: actErr } = await supabase
        .from("activities")
        .insert({
          opportunity_id: opp.id,
          lead_id: lead?.id || opp.lead_id,
          company_id,
          type: activityType,
          note: activityNote,
          status: isScheduledFuture ? "upcoming" : "completed",
          scheduled_at: scheduledAt,
          // Match existing activities schema (used by other inserts in App.jsx)
          user_id: currentUser.id,
          user_name: currentUser.full_name,
          lead_name: lead?.name || "",
          // Phase E W1 — new columns added by migration 005
          stage_at_event: toStage,
          from_stage: fromStage,
          to_stage: toStage,
          triggered_stage_change: true,
          activity_subtype: "stage_advance",
          structured_data: data,
        })
        .select()
        .single();

      if (actErr) {
        console.error("Activity insert failed:", actErr);
        showToast(`Failed to log activity: ${actErr.message}`,"error");
        setSaving(false);
        return;
      }

      // 2. Update opportunity stage
      const { error: oppErr } = await supabase
        .from("opportunities")
        .update({
          stage: toStage,
          stage_updated_at: new Date().toISOString(),
        })
        .eq("id", opp.id);

      if (oppErr) {
        console.error("Stage update failed:", oppErr);
        // Best-effort cleanup of the activity row
        await supabase.from("activities").delete().eq("id", actRow.id);
        showToast(`Failed to advance stage: ${oppErr.message}`,"error");
        setSaving(false);
        return;
      }

      // 3. Create reminder (best-effort — failure here doesn't undo the stage change)
      // Two timing modes:
      //   - reminderTriggerKey: trigger relative to a date field (e.g. visit_at - 60 min)
      //   - follow_up_date:    trigger at 9am on a chosen follow-up day (legacy)
      let triggerAt = null;
      if (config.reminderTriggerKey && data[config.reminderTriggerKey]) {
        const base = new Date(data[config.reminderTriggerKey]);
        base.setMinutes(base.getMinutes() + (config.reminderTriggerOffsetMinutes || 0));
        triggerAt = base;
      } else if (data.follow_up_date) {
        triggerAt = new Date(data.follow_up_date);
        triggerAt.setHours(9, 0, 0, 0);
      }
      if (triggerAt && triggerAt > new Date() && config.reminderReason) {
        const { error: remErr } = await supabase
          .from("reminders")
          .insert({
            company_id,
            user_id: currentUser.id,
            related_opportunity_id: opp.id,
            related_lead_id: lead?.id || opp.lead_id,
            related_activity_id: actRow.id,
            trigger_at: triggerAt.toISOString(),
            title: config.reminderTitle ? config.reminderTitle(lead||{}) : `Follow up — ${toStage}`,
            body:  config.reminderBody  ? config.reminderBody(data)        : "",
            reason: config.reminderReason,
            status: "pending",
            created_by: currentUser.id,
          });
        if (remErr) {
          console.warn("Reminder creation failed (non-fatal):", remErr);
          // Don't block — stage already advanced
        }
      }

      // 4. Phase E W2 — if "send_invite" was checked, generate .ics + open mailto
      if (data.send_invite && data.visit_at) {
        try {
          const visitStart = new Date(data.visit_at);
          const visitEnd   = new Date(visitStart.getTime() + 60*60*1000); // default 1-hour duration
          // Build a human-readable units list for the invite body
          const shownIds = Array.isArray(data.units_to_show) ? data.units_to_show : [];
          const unitsList = shownIds.map(uid => {
            const u = (units||[]).find(x => x.id === uid);
            if (!u) return null;
            const proj = (projects||[]).find(p => p.id === u.project_id);
            return `${u.unit_ref}${proj?.name?` (${proj.name})`:""}`;
          }).filter(Boolean).join(", ");
          const summary  = `Property Site Visit — ${lead?.name||"Buyer"}`;
          const body = [
            `Dear ${lead?.name||"Sir/Madam"},`,
            ``,
            `This is a confirmation of your property visit scheduled with ${currentUser.full_name||"our team"}.`,
            ``,
            `Date & time: ${visitStart.toLocaleString("en-AE",{dateStyle:"full", timeStyle:"short"})}`,
            unitsList ? `Units to view: ${unitsList}` : null,
            `Attendees: ${data.expected_attendees||"—"}`,
            ``,
            `Please find the calendar invite attached. Looking forward to meeting you.`,
            ``,
            `Best regards,`,
            currentUser.full_name||"PropCRM",
          ].filter(Boolean).join("\n");
          const ics = buildIcsEvent({
            uid: `visit-${actRow.id}@propcrm`,
            summary,
            description: body,
            location: unitsList || "Property location to be confirmed",
            startISO: visitStart.toISOString(),
            endISO:   visitEnd.toISOString(),
            organizerName: currentUser.full_name || "",
            organizerEmail: currentUser.email || "",
            attendeeName: lead?.name || "",
            attendeeEmail: lead?.email || "",
          });
          downloadIcsAndOpenMail({
            to: lead?.email || "",
            subject: summary,
            body,
            ics,
            filename: `site-visit-${(lead?.name||"buyer").replace(/\s+/g,"_")}.ics`,
          });
        } catch(invErr) {
          console.warn("Calendar invite generation failed (non-fatal):", invErr);
          showToast("Visit saved, but calendar invite couldn't be generated","error");
        }
      }

      showToast(`✓ Advanced to ${toStage}`,"success");
      onSave({stage: toStage, activity: actRow, structured_data: data});
    } catch (e) {
      console.error("StageCaptureDialog save error:", e);
      showToast(`Save failed: ${e.message}`,"error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,.65)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1100,padding:"1rem"}}>
      <div style={{background:"#fff",borderRadius:16,width:560,maxWidth:"100%",maxHeight:"90vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 24px 64px rgba(11,31,58,.4)"}}>
        {/* Header */}
        <div style={{padding:"1.1rem 1.4rem",borderBottom:"1px solid #E8EDF4",background:"#0F2540"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
            <div>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:700,color:"#fff"}}>{config.title}</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,.65)",marginTop:3}}>{config.subtitle}</div>
              <div style={{fontSize:11,color:"#C9A84C",marginTop:6,fontWeight:600}}>
                {fromStage} → <strong>{toStage}</strong>
              </div>
            </div>
            <button onClick={onCancel} style={{background:"none",border:"none",fontSize:22,color:"#C9A84C",cursor:"pointer",lineHeight:1}}>×</button>
          </div>
        </div>

        {/* Body */}
        <div style={{overflowY:"auto",padding:"1.25rem 1.4rem",flex:1}}>
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            {config.fields.map(f => {
              const err = errors[f.key];
              const labelEl = (
                <label style={{fontSize:12,fontWeight:700,color:"#0F2540",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:".4px"}}>
                  {f.label}{f.required&&<span style={{color:"#C53030"}}> *</span>}
                </label>
              );

              if (f.kind === "radio") {
                const opts = f.options.map(o => typeof o === "string" ? {value:o} : o);
                return (
                  <div key={f.key}>
                    {labelEl}
                    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                      {opts.map(o => {
                        const sel = data[f.key] === o.value;
                        return (
                          <button key={o.value} onClick={()=>setField(f.key, o.value)}
                            style={{
                              padding:"7px 14px",borderRadius:20,
                              border: `1.5px solid ${sel ? (o.color||"#0F2540") : "#D1D9E6"}`,
                              background: sel ? (o.bg||"#0F2540") : "#fff",
                              color: sel ? (o.color||"#fff") : "#4A5568",
                              fontSize:12, fontWeight:600, cursor:"pointer", transition:"all .12s",
                            }}>
                            {o.value}
                          </button>
                        );
                      })}
                    </div>
                    {err&&<div style={{fontSize:11,color:"#C53030",marginTop:4}}>{err}</div>}
                  </div>
                );
              }

              if (f.kind === "select") {
                return (
                  <div key={f.key}>
                    {labelEl}
                    <select value={data[f.key]||""} onChange={e=>setField(f.key, e.target.value)}
                      style={{width:"100%",padding:"9px 12px",borderRadius:8,border:`1.5px solid ${err?"#C53030":"#D1D9E6"}`,fontSize:13,fontFamily:"inherit",background:"#fff",cursor:"pointer"}}>
                      <option value="">— Select —</option>
                      {f.options.map(o=><option key={o} value={o}>{o}</option>)}
                    </select>
                    {err&&<div style={{fontSize:11,color:"#C53030",marginTop:4}}>{err}</div>}
                  </div>
                );
              }

              if (f.kind === "textarea") {
                return (
                  <div key={f.key}>
                    {labelEl}
                    <textarea value={data[f.key]||""} onChange={e=>setField(f.key, e.target.value)}
                      placeholder={f.placeholder||""} rows={f.rows||3}
                      style={{width:"100%",padding:"9px 12px",borderRadius:8,border:`1.5px solid ${err?"#C53030":"#D1D9E6"}`,fontSize:13,fontFamily:"inherit",resize:"vertical"}}/>
                    {f.minLength&&(
                      <div style={{fontSize:10,color:"#94A3B8",marginTop:3}}>
                        {(data[f.key]||"").length} / {f.minLength} characters minimum
                      </div>
                    )}
                    {err&&<div style={{fontSize:11,color:"#C53030",marginTop:4}}>{err}</div>}
                  </div>
                );
              }

              if (f.kind === "date") {
                return (
                  <div key={f.key}>
                    {labelEl}
                    <input type="date" value={data[f.key]||""} onChange={e=>setField(f.key, e.target.value)}
                      style={{padding:"9px 12px",borderRadius:8,border:`1.5px solid ${err?"#C53030":"#D1D9E6"}`,fontSize:13,fontFamily:"inherit",background:"#fff"}}/>
                    {err&&<div style={{fontSize:11,color:"#C53030",marginTop:4}}>{err}</div>}
                  </div>
                );
              }

              if (f.kind === "datetime") {
                return (
                  <div key={f.key}>
                    {labelEl}
                    <input type="datetime-local" value={data[f.key]||""} onChange={e=>setField(f.key, e.target.value)}
                      style={{padding:"9px 12px",borderRadius:8,border:`1.5px solid ${err?"#C53030":"#D1D9E6"}`,fontSize:13,fontFamily:"inherit",background:"#fff"}}/>
                    {err&&<div style={{fontSize:11,color:"#C53030",marginTop:4}}>{err}</div>}
                  </div>
                );
              }

              if (f.kind === "text") {
                return (
                  <div key={f.key}>
                    {labelEl}
                    <input type="text" value={data[f.key]||""} onChange={e=>setField(f.key, e.target.value)}
                      placeholder={f.placeholder||""}
                      style={{width:"100%",padding:"9px 12px",borderRadius:8,border:`1.5px solid ${err?"#C53030":"#D1D9E6"}`,fontSize:13,fontFamily:"inherit",background:"#fff"}}/>
                    {err&&<div style={{fontSize:11,color:"#C53030",marginTop:4}}>{err}</div>}
                  </div>
                );
              }

              if (f.kind === "checkbox") {
                const checked = !!data[f.key];
                return (
                  <div key={f.key} style={{background:checked?"#FFFBEA":"#F8FAFC",border:`1px solid ${checked?"#FCD34D":"#E2E8F0"}`,borderRadius:8,padding:"10px 12px",transition:"all .15s"}}>
                    <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:12,fontWeight:600,color:"#0F2540"}}>
                      <input type="checkbox" checked={checked} onChange={e=>setField(f.key,e.target.checked)}
                        style={{width:14,height:14,cursor:"pointer",accentColor:"#0F2540"}}/>
                      {f.label}
                    </label>
                    {f.helpText && <div style={{fontSize:10,color:"#94A3B8",marginTop:4,marginLeft:22}}>{f.helpText}</div>}
                    {err&&<div style={{fontSize:11,color:"#C53030",marginTop:4}}>{err}</div>}
                  </div>
                );
              }

              if (f.kind === "asks_grid") {
                // Renders the standard set of UAE primary-market asks as toggleable rows.
                // When a row is ticked, a conditional detail input appears (% or text).
                const asks = (data[f.key] && typeof data[f.key]==="object") ? data[f.key] : {};
                const setAsk = (key, patch) => {
                  setField(f.key, {...asks, [key]: {...(asks[key]||{}), ...patch}});
                };
                return (
                  <div key={f.key}>
                    {labelEl}
                    <div style={{display:"flex",flexDirection:"column",gap:5,border:`1.5px solid ${err?"#C53030":"#D1D9E6"}`,borderRadius:8,padding:6,background:"#fff"}}>
                      {ASKS_GRID_OPTIONS.map(opt => {
                        const sel = !!asks[opt.key]?.enabled;
                        return (
                          <div key={opt.key} style={{
                            background: sel ? "#FFFBEA" : "transparent",
                            border: sel ? "1px solid #FCD34D" : "1px solid transparent",
                            borderRadius:6, padding: sel ? "8px 10px" : "6px 10px", transition:"all .12s",
                          }}>
                            <button onClick={()=>setAsk(opt.key,{enabled:!sel})}
                              style={{
                                display:"flex",alignItems:"center",gap:9,width:"100%",
                                background:"transparent",border:"none",cursor:"pointer",textAlign:"left",padding:0,
                              }}>
                              <span style={{
                                display:"inline-flex",alignItems:"center",justifyContent:"center",
                                width:16,height:16,borderRadius:4,
                                border:`1.5px solid ${sel?"#0F2540":"#CBD5E1"}`,
                                background: sel?"#0F2540":"#fff",
                                color:"#fff",fontSize:11,lineHeight:1,flexShrink:0,
                              }}>{sel?"✓":""}</span>
                              <span style={{fontSize:14,flexShrink:0}}>{opt.icon}</span>
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{fontSize:12,fontWeight:sel?700:600,color:"#0F2540"}}>{opt.label}</div>
                                {!sel && opt.hint && <div style={{fontSize:10,color:"#94A3B8",marginTop:1}}>{opt.hint}</div>}
                              </div>
                            </button>
                            {sel && opt.detail && (
                              <div style={{marginTop:7,marginLeft:25,display:"flex",alignItems:"center",gap:6}}>
                                {opt.detail.kind === "percent" ? (
                                  <>
                                    <input type="number" min="0" max="100" step="0.1"
                                      value={asks[opt.key]?.value||""}
                                      onChange={e=>setAsk(opt.key,{value:e.target.value})}
                                      placeholder={opt.detail.placeholder||""}
                                      style={{width:80,padding:"6px 9px",borderRadius:6,border:"1.5px solid #D1D9E6",fontSize:12,fontFamily:"inherit",background:"#fff"}}/>
                                    <span style={{fontSize:12,color:"#64748B",fontWeight:600}}>%</span>
                                  </>
                                ) : (
                                  <input type="text"
                                    value={asks[opt.key]?.value||""}
                                    onChange={e=>setAsk(opt.key,{value:e.target.value})}
                                    placeholder={opt.detail.placeholder||""}
                                    style={{flex:1,padding:"6px 9px",borderRadius:6,border:"1.5px solid #D1D9E6",fontSize:12,fontFamily:"inherit",background:"#fff"}}/>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {err&&<div style={{fontSize:11,color:"#C53030",marginTop:4}}>{err}</div>}
                  </div>
                );
              }

              if (f.kind === "multi_select") {
                // Source options: either explicit `f.options` array, or pulled from `units` prop via f.source.
                // For `f.source === "units"`, each option carries enough fields to render a rich two-line row:
                // line 1: ref · BR · sqft · view ;  line 2: project · floor · price
                let opts = [];
                if (f.source === "units") {
                  const projectFilter = opp?.project_id;
                  // Don't filter to project alone — agents often show neighbouring/alternative units too.
                  // We sort smartly instead of filtering hard.
                  const fmtAed = (n) => n ? `AED ${Number(n).toLocaleString()}` : null;
                  const allOpts = (units||[]).map(u => {
                    const proj = (projects||[]).find(p => p.id === u.project_id);
                    const sp = (salePricing||[]).find(s => s.unit_id === u.id);
                    const bedLabel = u.bedrooms === 0 ? "Studio" : (u.bedrooms ? `${u.bedrooms}BR` : "");
                    const sqft = u.size_sqft ? `${Number(u.size_sqft).toLocaleString()} sqft` : null;
                    return {
                      value: u.id,
                      // Rich row data for the renderer (instead of a flat label string)
                      isUnit: true,
                      isPinned: u.id === opp?.unit_id, // the opp's linked unit
                      sameProject: !!projectFilter && u.project_id === projectFilter,
                      lineA: [u.unit_ref || u.id, bedLabel, sqft, u.view].filter(Boolean).join(" · "),
                      lineB: [proj?.name, u.floor_number ? `Floor ${u.floor_number}` : null, fmtAed(sp?.asking_price)].filter(Boolean).join(" · "),
                    };
                  });
                  // Sort: pinned first, then same-project, then alphabetical by unit_ref-equivalent (lineA)
                  opts = allOpts.sort((a,b) => {
                    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
                    if (a.sameProject !== b.sameProject) return a.sameProject ? -1 : 1;
                    return (a.lineA||"").localeCompare(b.lineA||"");
                  });
                } else if (Array.isArray(f.options)) {
                  opts = f.options.map(o => typeof o === "string" ? {value:o, label:o} : o);
                }
                const selected = Array.isArray(data[f.key]) ? data[f.key] : [];
                const toggle = (v) => {
                  const next = selected.includes(v) ? selected.filter(x=>x!==v) : [...selected, v];
                  setField(f.key, next);
                };
                // For unit pickers, filter opts by per-field search query.
                // Search matches: lineA (ref/BR/sqft/view) + lineB (project/floor/price)
                const isUnitPicker = f.source === "units" && opts.length > 0 && opts[0]?.isUnit;
                const queryRaw = (unitSearch[f.key] || "");
                const query = queryRaw.trim().toLowerCase();
                const filteredOpts = (isUnitPicker && query)
                  ? opts.filter(o => `${o.lineA||""} ${o.lineB||""}`.toLowerCase().includes(query))
                  : opts;
                return (
                  <div key={f.key}>
                    {labelEl}
                    {opts.length === 0 ? (
                      <div style={{fontSize:12,color:"#94A3B8",fontStyle:"italic",padding:"8px 12px",background:"#F8FAFC",borderRadius:8,border:"1px dashed #D1D9E6"}}>
                        {f.emptyHint || "No options available"}
                      </div>
                    ) : (
                      <div>
                        {/* Search bar — only for unit pickers (where lists can be long) */}
                        {isUnitPicker && (
                          <div style={{position:"relative",marginBottom:6}}>
                            <input type="text"
                              value={queryRaw}
                              onChange={e=>setUnitSearch(s=>({...s, [f.key]: e.target.value}))}
                              placeholder="🔍 Search units — e.g. AGR, Sobha, 2BR, sea view…"
                              style={{width:"100%",padding:"7px 28px 7px 10px",borderRadius:6,border:"1.5px solid #D1D9E6",fontSize:12,boxSizing:"border-box",outline:"none"}}/>
                            {queryRaw && (
                              <button onClick={()=>setUnitSearch(s=>({...s, [f.key]: ""}))}
                                title="Clear" type="button"
                                style={{position:"absolute",right:6,top:"50%",transform:"translateY(-50%)",padding:"2px 7px",borderRadius:5,border:"none",background:"#E2E8F0",color:"#64748B",fontSize:10,fontWeight:700,cursor:"pointer"}}>
                                ✕
                              </button>
                            )}
                          </div>
                        )}
                        {filteredOpts.length === 0 ? (
                          <div style={{fontSize:11,color:"#94A3B8",fontStyle:"italic",padding:"10px",background:"#F8FAFC",borderRadius:8,border:"1px dashed #D1D9E6",textAlign:"center"}}>
                            No units match "{queryRaw}"
                          </div>
                        ) : (
                          <div style={{display:"flex",flexDirection:"column",gap:3,maxHeight:260,overflowY:"auto",border:`1.5px solid ${err?"#C53030":"#D1D9E6"}`,borderRadius:8,padding:5,background:"#fff"}}>
                            {filteredOpts.map(o => {
                              const sel = selected.includes(o.value);
                              // Rich row for unit options; flat row for everything else
                              if (o.isUnit) {
                                const pinBg   = o.isPinned ? "#FFFBEA" : null;          // soft yellow tint
                                const pinSelBg= o.isPinned ? "#FEF3C7" : "#E6EFF9";
                                return (
                                  <button key={o.value} onClick={()=>toggle(o.value)}
                                    style={{
                                      display:"flex",alignItems:"flex-start",gap:9,padding:"8px 10px",borderRadius:6,
                                      border: o.isPinned ? "1px solid #FCD34D" : "1px solid transparent",
                                      background: sel ? pinSelBg : (pinBg || "transparent"),
                                      color:"#0F2540",
                                      cursor:"pointer", textAlign:"left", transition:"all .1s",
                                    }}>
                                    <span style={{
                                      display:"inline-flex",alignItems:"center",justifyContent:"center",
                                      width:16,height:16,borderRadius:4,marginTop:2,
                                      border:`1.5px solid ${sel?"#0F2540":"#CBD5E1"}`,
                                      background: sel?"#0F2540":"#fff",
                                      color:"#fff",fontSize:11,lineHeight:1,flexShrink:0,
                                    }}>{sel?"✓":""}</span>
                                <div style={{flex:1,minWidth:0}}>
                                  <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                                    <span style={{fontSize:12,fontWeight:700,color:"#0F2540"}}>{o.lineA}</span>
                                    {o.isPinned && (
                                      <span style={{fontSize:9,fontWeight:700,padding:"1px 6px",borderRadius:8,background:"#FCD34D",color:"#7A4F01",letterSpacing:".3px"}}>
                                        📍 THIS OPP
                                      </span>
                                    )}
                                  </div>
                                  {o.lineB && (
                                    <div style={{fontSize:11,color:"#64748B",marginTop:2,fontWeight:500}}>{o.lineB}</div>
                                  )}
                                </div>
                              </button>
                            );
                          }
                          // Flat fallback for non-unit multi-selects
                          return (
                            <button key={o.value} onClick={()=>toggle(o.value)}
                              style={{
                                display:"flex",alignItems:"center",gap:8,padding:"7px 9px",borderRadius:6,
                                border:"none",
                                background: sel ? "#E6EFF9" : "transparent",
                                color: sel ? "#0F2540" : "#4A5568",
                                fontSize:12, fontWeight: sel?600:500, cursor:"pointer", textAlign:"left", transition:"all .1s",
                              }}>
                              <span style={{
                                display:"inline-flex",alignItems:"center",justifyContent:"center",
                                width:16,height:16,borderRadius:4,
                                border:`1.5px solid ${sel?"#0F2540":"#CBD5E1"}`,
                                background: sel?"#0F2540":"#fff",
                                color:"#fff",fontSize:11,lineHeight:1,flexShrink:0,
                              }}>{sel?"✓":""}</span>
                              <span style={{flex:1}}>{o.label}</span>
                            </button>
                          );
                        })}
                      </div>
                        )}
                      </div>
                    )}
                    {selected.length>0&&<div style={{fontSize:10,color:"#64748B",marginTop:4}}>{selected.length} selected</div>}
                    {err&&<div style={{fontSize:11,color:"#C53030",marginTop:4}}>{err}</div>}
                  </div>
                );
              }

              return null;
            })}
          </div>
        </div>

        {/* Footer */}
        <div style={{display:"flex",gap:10,justifyContent:"flex-end",padding:"1rem 1.4rem",borderTop:"1px solid #E8EDF4",background:"#F8FAFC"}}>
          <button onClick={onCancel} disabled={saving}
            style={{padding:"9px 18px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:13,fontWeight:600,cursor:saving?"not-allowed":"pointer"}}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            style={{padding:"9px 24px",borderRadius:8,border:"none",background:saving?"#94A3B8":"#0F2540",color:"#fff",fontSize:13,fontWeight:700,cursor:saving?"not-allowed":"pointer"}}>
            {saving ? "Saving…" : `✓ Save & Advance to ${toStage}`}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Phase E W2 — Negotiation Round Dialog
   Captures a single round in the buyer/developer/broker thread.
═══════════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════════
   Phase E W4 — Reminders Bell
   Header bell that aggregates pending reminders across ALL of the
   user's opportunities. Polls every 60 seconds, refreshes on focus.
   Click → dropdown grouped by Overdue / Today / Tomorrow / This week.
   Click a reminder → deep-links into that opportunity.
═══════════════════════════════════════════════════════════════ */

export default StageCaptureDialog;
