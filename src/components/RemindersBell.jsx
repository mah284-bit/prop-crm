import React, { useState, useEffect, useRef } from 'react';
import { supabase } from "../lib/supabase.js";
import { Spinner } from "../modules/shared/Spinner.jsx";
import { Toast } from "../modules/shared/Toast.jsx";
import { Btn } from "../modules/shared/Btn.jsx";
import { Badge } from "../modules/shared/Badge.jsx";
import { fmtDT } from "../modules/utils.js";

function RemindersBell({ currentUser, onNavigateToOpp, onNavigateToLead, showToast }) {
  const [open, setOpen] = useState(false);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef(null);

  // Phase F W4 — AI morning briefing state
  const [briefing, setBriefing] = useState(null); // {summary, highlights:[{title,body,opp_id,priority}], generated_at}
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [briefingError, setBriefingError] = useState("");

  const fetchReminders = async () => {
    if (!currentUser?.id) return;
    // Window: pending reminders triggered up to +14 days from now
    // (overdue is included automatically — overdue = trigger_at < now)
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + 14);
    const { data, error } = await supabase
      .from("reminders")
      .select("id, title, body, trigger_at, reason, related_opportunity_id, related_lead_id, status")
      .eq("user_id", currentUser.id)
      .eq("status", "pending")
      .lte("trigger_at", horizon.toISOString())
      .order("trigger_at", { ascending: true });
    if (error) {
      console.warn("Bell fetch failed:", error);
      setLoading(false);
      return;
    }
    setReminders(data || []);
    setLoading(false);
  };

  // Initial load + 60s polling
  useEffect(() => {
    fetchReminders();
    const interval = setInterval(fetchReminders, 60_000);
    // Refresh when tab becomes visible again
    const onVis = () => { if (document.visibilityState === "visible") fetchReminders(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVis);
    };
    // eslint-disable-next-line
  }, [currentUser?.id]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  // Phase F W4 — AI Morning Briefing
  // Reads the user's active book of business and surfaces the day's priorities.
  // Manual trigger (button); cached for 1 hour after generation.
  const runBriefing = async () => {
    if (!currentUser?.id || !currentUser?.company_id) {
      setBriefingError("User context missing — please reload.");
      return;
    }
    setBriefingLoading(true);
    setBriefingError("");
    try {
      // Fetch active opps owned by this user (last 30 days of activity)
      const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate()-30);
      const { data: opps, error: oppErr } = await supabase
        .from("opportunities")
        .select("id, lead_id, stage, status, budget, unit_id, created_at, stage_updated_at, proposal_sent_at")
        .eq("assigned_to", currentUser.id)
        .neq("stage", "Closed Won")
        .neq("stage", "Closed Lost")
        .gte("stage_updated_at", thirtyDaysAgo.toISOString())
        .limit(40);
      if (oppErr) throw new Error(`Couldn't load opportunities: ${oppErr.message}`);

      // Phase F W4 ext — also fetch ALL active leads owned by this user (not just those with opps)
      // so the AI can flag raw leads not yet worked, leads gone cold, and so on.
      const { data: allLeads, error: leadsErr } = await supabase
        .from("leads")
        .select("id, name, nationality, source, budget, notes, created_at, assigned_to")
        .eq("assigned_to", currentUser.id)
        .order("created_at", { ascending: false })
        .limit(60);
      if (leadsErr) throw new Error(`Couldn't load leads: ${leadsErr.message}`);

      // Need at least SOMETHING to brief on
      if ((!opps || opps.length === 0) && (!allLeads || allLeads.length === 0)) {
        setBriefingError("Once you have a few leads or active deals, AI will summarise your day here.");
        return;
      }

      // Fetch supporting data: lead profiles, activities (per opp + per lead), reminders, proposals
      const oppIds = (opps || []).map(o => o.id);
      const allLeadIds = (allLeads || []).map(l => l.id);
      const oppLeadIds = (opps || []).map(o => o.lead_id).filter(Boolean);
      const fetchableLeadIds = [...new Set([...oppLeadIds, ...allLeadIds])];

      const [actsRes, leadActsRes, remRes, propsRes] = await Promise.all([
        oppIds.length > 0
          ? supabase.from("activities").select("opportunity_id, type, status, note, created_at, activity_subtype").in("opportunity_id", oppIds).order("created_at", {ascending:false}).limit(120)
          : Promise.resolve({data:[]}),
        // Lead-scoped activities (calls/whatsapp on the lead, even if no opp yet)
        fetchableLeadIds.length > 0
          ? supabase.from("activities").select("lead_id, type, status, note, created_at").in("lead_id", fetchableLeadIds).order("created_at", {ascending:false}).limit(150)
          : Promise.resolve({data:[]}),
        oppIds.length > 0
          ? supabase.from("reminders").select("related_opportunity_id, title, trigger_at, status").eq("user_id", currentUser.id).eq("status","pending").in("related_opportunity_id", oppIds)
          : Promise.resolve({data:[]}),
        oppIds.length > 0
          ? supabase.from("proposals").select("opportunity_id, status, expiry_date, total_value, created_at").in("opportunity_id", oppIds).order("created_at", {ascending:false}).limit(60)
          : Promise.resolve({data:[]}),
      ]);

      // Build lookup tables
      const actsByOpp = {};
      (actsRes.data||[]).forEach(a => {
        if (!actsByOpp[a.opportunity_id]) actsByOpp[a.opportunity_id] = [];
        actsByOpp[a.opportunity_id].push(a);
      });
      const actsByLead = {};
      (leadActsRes.data||[]).forEach(a => {
        if (!actsByLead[a.lead_id]) actsByLead[a.lead_id] = [];
        actsByLead[a.lead_id].push(a);
      });
      const remsByOpp = {};
      (remRes.data||[]).forEach(r => {
        if (!remsByOpp[r.related_opportunity_id]) remsByOpp[r.related_opportunity_id] = [];
        remsByOpp[r.related_opportunity_id].push(r);
      });
      const propsByOpp = {};
      (propsRes.data||[]).forEach(p => {
        if (!propsByOpp[p.opportunity_id]) propsByOpp[p.opportunity_id] = [];
        propsByOpp[p.opportunity_id].push(p);
      });

      // Lead lookup (combine all leads)
      const leadsById = Object.fromEntries((allLeads||[]).map(l => [l.id, l]));

      // OPP BOOK SNAPSHOT — same shape as before
      const book = (opps||[]).map(o => {
        const lead = leadsById[o.lead_id];
        const acts = (actsByOpp[o.id] || []).slice(0, 3);
        const rems = (remsByOpp[o.id] || []);
        const props = (propsByOpp[o.id] || []);
        const lastActivityAt = acts[0]?.created_at || o.stage_updated_at;
        const daysSinceActivity = lastActivityAt ? Math.round((new Date() - new Date(lastActivityAt)) / (1000*60*60*24)) : null;
        return {
          opp_id: o.id,
          stage: o.stage,
          lead_name: lead?.name || "Unknown",
          budget_aed: o.budget,
          days_since_activity: daysSinceActivity,
          last_activity: acts[0]?.note?.slice(0, 100) || null,
          pending_reminders: rems.length,
          overdue_reminders: rems.filter(r => new Date(r.trigger_at) < new Date()).length,
          proposals_sent: props.filter(p => p.status === "sent").length,
          latest_proposal_expires: props[0]?.expiry_date || null,
        };
      });

      // LEAD BOOK SNAPSHOT — leads with NO active opp OR leads where the AI should
      // notice neglect. Distinguish: "raw leads not yet converted to opp" vs
      // "leads with opps already in the book above".
      const oppLeadIdSet = new Set(oppLeadIds);
      const leadBook = (allLeads||[]).map(l => {
        const acts = (actsByLead[l.id] || []);
        const lastTouchAt = acts[0]?.created_at || l.created_at;
        const daysSinceContact = lastTouchAt ? Math.round((new Date() - new Date(lastTouchAt)) / (1000*60*60*24)) : null;
        const has_active_opp = oppLeadIdSet.has(l.id);
        return {
          lead_id: l.id,
          lead_name: l.name || "Unknown",
          source: l.source || null,
          stated_budget: l.budget || null,
          days_since_contact: daysSinceContact,
          last_contact_type: acts[0]?.type || null,
          contact_count: acts.length,
          has_active_opp,
        };
      });

      const system = `You are PropPulse AI, briefing a UAE real-estate broker on their day. Read their full book — both ACTIVE OPPORTUNITIES (deals in progress) and LEADS (contacts, some with opps, some still raw). Surface the 3-5 most important things they should focus on TODAY across both.

Examples of priorities to surface (in order of importance):
- Hot opps: deals where buyer engaged recently, decisions imminent, proposals expiring
- Stale opps: deals stalling (no activity 7+ days) — reignite or mark lost
- Raw leads not yet worked: leads with no contact in 3+ days, especially from paid sources (Bayut, PropertyFinder) which go cold fast
- Cold leads: leads with no contact in 14+ days that should be re-engaged or archived
- Overdue reminders pointing to neglected items
- Proposals expiring within 3 days

Speak as a senior advisor — concise, specific, actionable. Reference SPECIFIC names. When the highlight is about a lead with no opp yet, set opp_id=null and use lead_id instead. Always respond with valid JSON only — no prose, no markdown fences.`;

      const userPrompt = `BROKER: ${currentUser.full_name || "Agent"}
DATE: ${new Date().toLocaleDateString("en-AE",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}

ACTIVE OPPORTUNITIES (${book.length}):
${JSON.stringify(book, null, 2)}

ALL LEADS (${leadBook.length}):
${JSON.stringify(leadBook, null, 2)}

TASK: Generate a morning briefing covering BOTH opps and leads. 1-sentence overview, then 3-5 prioritised highlights. Mix opp-focused and lead-focused highlights as appropriate. If there's a clear pattern (e.g. multiple raw leads not contacted), surface that as a single highlight.

PRIORITY values: "high" | "medium" | "low"

RESPOND WITH VALID JSON ONLY in this exact shape:
{
  "summary": "<1-sentence 'state of your day' overview>",
  "highlights": [
    {
      "title": "<short imperative — 'Call Aisha — proposal expires today'>",
      "body": "<1-2 sentences with specifics>",
      "opp_id": "<opp_id from active opps list, or null if lead-only or cross-cutting>",
      "lead_id": "<lead_id from leads list if it's about a specific lead with no opp, else null>",
      "priority": "high" | "medium" | "low"
    }
  ]
}`;

      const reply = await aiInvoke({ system, prompt: userPrompt, max_tokens: 3000 });
      const cleaned = reply.replace(/```json\s*/g,"").replace(/```\s*$/g,"").trim();
      let parsed;
      try { parsed = JSON.parse(cleaned); }
      catch (e) {
        const m = cleaned.match(/\{[\s\S]*\}/);
        if (!m) throw new Error("AI response was not valid JSON");
        parsed = JSON.parse(m[0]);
      }
      if (!parsed.highlights || !Array.isArray(parsed.highlights) || parsed.highlights.length === 0) {
        throw new Error("AI returned no highlights");
      }
      // Defensive: filter to opp_ids and lead_ids that actually exist
      const validOppIds = new Set((opps||[]).map(o=>o.id));
      const validLeadIds = new Set((allLeads||[]).map(l=>l.id));
      const cleanHighlights = parsed.highlights.map(h => ({
        ...h,
        opp_id: validOppIds.has(h.opp_id) ? h.opp_id : null,
        lead_id: validLeadIds.has(h.lead_id) ? h.lead_id : null,
      })).slice(0, 5);
      setBriefing({
        summary: parsed.summary || "",
        highlights: cleanHighlights,
        generated_at: new Date().toISOString(),
      });
    } catch (e) {
      console.error("AI Briefing failed:", e);
      setBriefingError(`Couldn't generate briefing: ${e.message || "unknown error"}`);
    } finally {
      setBriefingLoading(false);
    }
  };

  // Briefing is "fresh" if generated less than 1 hour ago — used to gate auto-rerun
  const briefingIsFresh = briefing && briefing.generated_at && (new Date() - new Date(briefing.generated_at)) < 60*60*1000;

  // Group reminders by time bucket
  const now = new Date();
  const startOfToday = new Date(now); startOfToday.setHours(0,0,0,0);
  const endOfToday = new Date(startOfToday); endOfToday.setDate(endOfToday.getDate()+1);
  const endOfTomorrow = new Date(endOfToday); endOfTomorrow.setDate(endOfTomorrow.getDate()+1);
  const endOfWeek = new Date(startOfToday); endOfWeek.setDate(endOfWeek.getDate()+7);
  const groups = { overdue: [], today: [], tomorrow: [], thisWeek: [], later: [] };
  reminders.forEach(r => {
    const t = new Date(r.trigger_at);
    if (t < now) groups.overdue.push(r);
    else if (t < endOfToday) groups.today.push(r);
    else if (t < endOfTomorrow) groups.tomorrow.push(r);
    else if (t < endOfWeek) groups.thisWeek.push(r);
    else groups.later.push(r);
  });

  const overdueCount = groups.overdue.length;
  const totalCount = reminders.length;

  // Type icons by reminder.reason / title prefix
  const guessIcon = (r) => {
    const reason = r.reason || "";
    if (reason.includes("site_visit") || reason === "auto_visit_imminent") return "🏠";
    if (reason.includes("handover")) return "📅";
    if (reason.includes("negotiation")) return "🤝";
    if (reason === "auto_follow_up_after_contacted") return "📞";
    // Title-based fallback
    const titleStart = (r.title||"").split(" ")[0].toLowerCase();
    if (titleStart === "call") return "📞";
    if (titleStart === "whatsapp") return "💬";
    if (titleStart === "email") return "✉️";
    if (titleStart === "meeting") return "🤝";
    if (titleStart.includes("site")) return "🏠";
    if (titleStart === "send") return "📄"; // "Send proposal/brochure"
    return "⏰";
  };

  const fmtDue = (iso) => {
    const t = new Date(iso);
    const diffMs = t - now;
    const diffDays = Math.floor(diffMs / 86400000);
    const dateStr = t.toLocaleDateString("en-AE", { day:"numeric", month:"short" });
    const timeStr = t.toLocaleTimeString("en-AE", { hour:"2-digit", minute:"2-digit" });
    if (diffMs < 0) {
      const overdueDays = Math.ceil(-diffMs / 86400000);
      const overdueHours = Math.ceil(-diffMs / 3600000);
      const label = overdueHours < 24 ? `${overdueHours}h overdue` : (overdueDays === 1 ? "1 day overdue" : `${overdueDays} days overdue`);
      return { label, color: "#C53030", bg: "#FEE2E2", date: `${dateStr} ${timeStr}` };
    }
    const minsAway = Math.floor(diffMs / 60000);
    if (minsAway < 60) return { label: `in ${Math.max(1, minsAway)} min`, color: "#A06810", bg: "#FDF3DC", date: timeStr };
    if (diffDays === 0) return { label: timeStr, color: "#A06810", bg: "#FDF3DC", date: dateStr };
    if (diffDays === 1) return { label: `tomorrow ${timeStr}`, color: "#1A5FA8", bg: "#E6EFF8", date: "" };
    return { label: dateStr, color: "#64748B", bg: "#F1F5F9", date: timeStr };
  };

  const handleClickReminder = (r) => {
    setOpen(false);
    if (r.related_opportunity_id) {
      onNavigateToOpp(r.related_opportunity_id);
    }
  };

  const ReminderRow = ({r}) => {
    const due = fmtDue(r.trigger_at);
    return (
      <button onClick={() => handleClickReminder(r)}
        style={{
          display:"flex", gap:9, padding:"9px 12px", width:"100%",
          background:"transparent", border:"none", borderBottom:"1px solid #F1F5F9",
          cursor:"pointer", textAlign:"left", transition:"background .12s",
        }}
        onMouseOver={e=>{e.currentTarget.style.background="#F8FAFC";}}
        onMouseOut={e=>{e.currentTarget.style.background="transparent";}}>
        <span style={{fontSize:16, flexShrink:0, paddingTop:1}}>{guessIcon(r)}</span>
        <div style={{flex:1, minWidth:0}}>
          <div style={{display:"flex", alignItems:"center", gap:6, flexWrap:"wrap", marginBottom:2}}>
            <span style={{fontSize:12, fontWeight:700, color:"#0F2540"}}>{r.title}</span>
            <span style={{fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:10, background:due.bg, color:due.color, whiteSpace:"nowrap"}}>{due.label}</span>
          </div>
          {r.body && <div style={{fontSize:11, color:"#64748B", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", fontStyle:"italic"}}>{r.body}</div>}
          {due.date && <div style={{fontSize:10, color:"#94A3B8", marginTop:1}}>{due.date}</div>}
        </div>
        <span style={{color:"#CBD5E1", fontSize:14, alignSelf:"center"}}>›</span>
      </button>
    );
  };

  const SectionHeader = ({label, count, color}) => (
    <div style={{display:"flex", alignItems:"center", gap:6, padding:"8px 12px", background:"#F8FAFC", borderTop:"1px solid #E2E8F0", borderBottom:"1px solid #E2E8F0"}}>
      <span style={{fontSize:9, fontWeight:700, color, textTransform:"uppercase", letterSpacing:".5px"}}>{label}</span>
      <span style={{fontSize:9, fontWeight:700, padding:"1px 6px", borderRadius:8, background:"#fff", color, border:`1px solid ${color}33`}}>{count}</span>
    </div>
  );

  return (
    <div ref={dropdownRef} style={{position:"relative"}}>
      <button onClick={()=>setOpen(o=>!o)}
        title={totalCount === 0 ? "No pending reminders" : `${totalCount} pending reminder${totalCount===1?"":"s"}${overdueCount?` · ${overdueCount} overdue`:""}`}
        style={{
          background:"#F1F5F9", border:"1px solid #E2E8F0", cursor:"pointer", position:"relative",
          padding:"6px 9px", borderRadius:"50%", fontSize:16, lineHeight:1,
          transition:"all .15s",
          width:36, height:36, display:"inline-flex", alignItems:"center", justifyContent:"center",
        }}
        onMouseOver={e=>{e.currentTarget.style.background="#E2E8F0"; e.currentTarget.style.borderColor="#CBD5E1";}}
        onMouseOut={e=>{e.currentTarget.style.background="#F1F5F9"; e.currentTarget.style.borderColor="#E2E8F0";}}>
        🔔
        {totalCount > 0 && (
          <span style={{
            position:"absolute", top:2, right:2,
            minWidth:16, height:16, padding:"0 4px",
            borderRadius:8, fontSize:9, fontWeight:700,
            background: overdueCount > 0 ? "#DC2626" : "#1A5FA8",
            color:"#fff",
            display:"flex", alignItems:"center", justifyContent:"center",
            border:"1.5px solid #fff",
            lineHeight:1,
          }}>{totalCount > 99 ? "99+" : totalCount}</span>
        )}
      </button>

      {open && (
        <div style={{
          position:"absolute", top:"calc(100% + 6px)", right:0,
          width:380, maxHeight:520, overflowY:"auto",
          background:"#fff", borderRadius:12,
          border:"1px solid #E2E8F0",
          boxShadow:"0 12px 32px rgba(11,31,58,.15)",
          zIndex:9999,
        }}>
          <div style={{padding:"12px 14px", borderBottom:"1px solid #E2E8F0", background:"#0F2540"}}>
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
              <div>
                <div style={{fontSize:13, fontWeight:700, color:"#fff"}}>⏰ Your follow-ups</div>
                <div style={{fontSize:11, color:"rgba(255,255,255,.65)", marginTop:2}}>
                  {loading ? "Loading…" : totalCount === 0 ? "All caught up" : `${totalCount} pending${overdueCount?` · ${overdueCount} overdue`:""}`}
                </div>
              </div>
              <button onClick={fetchReminders} title="Refresh"
                style={{background:"none", border:"none", color:"#C9A84C", cursor:"pointer", fontSize:14}}>↻</button>
            </div>
          </div>

          {/* Phase F W4 — AI Morning Briefing block */}
          <div style={{padding:"10px 12px", borderBottom:"1px solid #F1F5F9", background:"#F0FDFA"}}>
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom: briefing||briefingLoading||briefingError ? 8 : 0}}>
              <div style={{fontSize:11, fontWeight:700, color:"#0F766E", textTransform:"uppercase", letterSpacing:".5px", display:"flex", alignItems:"center", gap:6}}>
                🤖 Today's AI Briefing
                <span style={{fontSize:9, padding:"2px 6px", borderRadius:8, background:"#ECFEFF", color:"#0E7490", fontWeight:600, border:"1px solid #CCFBF1"}}>BETA</span>
              </div>
              {!briefing && !briefingLoading && (
                <button onClick={runBriefing}
                  style={{padding:"4px 10px", borderRadius:6, border:"1px solid #5EEAD4", background:"#ECFEFF", color:"#0F766E", fontSize:10, fontWeight:700, cursor:"pointer"}}>
                  ✨ Get my briefing
                </button>
              )}
              {briefing && !briefingLoading && (
                <button onClick={runBriefing} title={briefingIsFresh ? "Refresh — last generated less than 1 hour ago" : "Refresh briefing"}
                  style={{padding:"3px 8px", borderRadius:5, border:"1px solid #CCFBF1", background:"#fff", color:"#0E7490", fontSize:10, fontWeight:600, cursor:"pointer"}}>
                  🔄
                </button>
              )}
            </div>

            {briefingLoading && (
              <div style={{fontSize:11, color:"#0F766E", display:"flex", alignItems:"center", gap:6, padding:"4px 0"}}>
                <span style={{animation:"spin 1.2s linear infinite"}}>⚙️</span>
                Reading your book of business…
              </div>
            )}

            {briefingError && !briefingLoading && (
              <div style={{padding:"7px 9px", background:"#FFFBEA", border:"1px solid #FCD34D", borderRadius:5, fontSize:10, color:"#7A4F01"}}>
                {briefingError}
              </div>
            )}

            {briefing && !briefingLoading && (
              <div>
                {briefing.summary && (
                  <div style={{fontSize:11, color:"#0F766E", marginBottom:8, fontStyle:"italic", lineHeight:1.5}}>
                    📊 {briefing.summary}
                  </div>
                )}
                <div style={{display:"flex", flexDirection:"column", gap:6}}>
                  {briefing.highlights.map((h, idx) => {
                    const pri = h.priority || "medium";
                    const priColor = pri==="high"?"#C53030":pri==="medium"?"#A06810":"#64748B";
                    const priBg = pri==="high"?"#FEE2E2":pri==="medium"?"#FEF3C7":"#F1F5F9";
                    return (
                      <div key={idx}
                        onClick={()=>{
                          if (h.opp_id && onNavigateToOpp) { onNavigateToOpp(h.opp_id); setOpen(false); }
                          else if (h.lead_id && onNavigateToLead) { onNavigateToLead(h.lead_id); setOpen(false); }
                        }}
                        style={{background:"#fff", border:"1px solid #CCFBF1", borderRadius:6, padding:"7px 9px", cursor: (h.opp_id||h.lead_id)?"pointer":"default"}}>
                        <div style={{display:"flex", alignItems:"flex-start", gap:6, marginBottom:3, flexWrap:"wrap"}}>
                          <span style={{fontSize:8, fontWeight:700, padding:"1px 5px", borderRadius:8, background:priBg, color:priColor, letterSpacing:".4px", textTransform:"uppercase"}}>
                            {pri}
                          </span>
                          <span style={{fontSize:11, fontWeight:700, color:"#0F2540", flex:1}}>{h.title}</span>
                          {(h.opp_id || h.lead_id) && <span style={{fontSize:9, color:"#0E7490"}}>→</span>}
                        </div>
                        {h.body && (
                          <div style={{fontSize:10, color:"#475569", lineHeight:1.4}}>
                            {h.body}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {briefingIsFresh && (
                  <div style={{fontSize:9, color:"#94A3B8", marginTop:6, textAlign:"right"}}>
                    Cached · Click 🔄 to refresh
                  </div>
                )}
              </div>
            )}
          </div>

          {loading ? (
            <div style={{padding:"2rem", textAlign:"center", color:"#94A3B8", fontSize:12}}>Loading reminders…</div>
          ) : totalCount === 0 ? (
            <div style={{padding:"2.5rem 1.5rem", textAlign:"center"}}>
              <div style={{fontSize:36, marginBottom:8}}>🎉</div>
              <div style={{fontSize:13, fontWeight:700, color:"#0F2540", marginBottom:4}}>You're all caught up</div>
              <div style={{fontSize:11, color:"#94A3B8"}}>No pending follow-ups in the next 2 weeks</div>
            </div>
          ) : (
            <div>
              {groups.overdue.length > 0 && (<>
                <SectionHeader label="Overdue" count={groups.overdue.length} color="#C53030"/>
                {groups.overdue.map(r => <ReminderRow key={r.id} r={r}/>)}
              </>)}
              {groups.today.length > 0 && (<>
                <SectionHeader label="Today" count={groups.today.length} color="#A06810"/>
                {groups.today.map(r => <ReminderRow key={r.id} r={r}/>)}
              </>)}
              {groups.tomorrow.length > 0 && (<>
                <SectionHeader label="Tomorrow" count={groups.tomorrow.length} color="#1A5FA8"/>
                {groups.tomorrow.map(r => <ReminderRow key={r.id} r={r}/>)}
              </>)}
              {groups.thisWeek.length > 0 && (<>
                <SectionHeader label="This week" count={groups.thisWeek.length} color="#64748B"/>
                {groups.thisWeek.map(r => <ReminderRow key={r.id} r={r}/>)}
              </>)}
              {groups.later.length > 0 && (<>
                <SectionHeader label="Later" count={groups.later.length} color="#94A3B8"/>
                {groups.later.map(r => <ReminderRow key={r.id} r={r}/>)}
              </>)}
            </div>
          )}

          <div style={{padding:"8px 12px", borderTop:"1px solid #E2E8F0", background:"#F8FAFC", textAlign:"center"}}>
            <span style={{fontSize:10, color:"#94A3B8"}}>Click a reminder to open the opportunity · Auto-refreshes every minute</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Phase E W3 — Proposal Builder Dialog
   Builds and "sends" a proposal: multiple units, discount/discounted price,
   payment plan, DLD handling, service charge waiver, validity, cover notes.
   Writes to proposals table + creates auto-reminders for follow-up + expiry.
   "Send" generates a structured email body via mailto: with .txt summary.
═══════════════════════════════════════════════════════════════ */

// 20 May 2026 Phase 2b: Hoist PROPOSAL_STATUS_META to module level
// so both ProposalBuilderDialog AND OpportunityDetail (Proposals section + dashboard panel) can use it.
// Originally duplicated in 2 places, now single source of truth.
const PROPOSAL_STATUS_META = {
  sent:     {label:"SENT",       c:"#1A5FA8", bg:"#E6EFF8"},
  viewed:   {label:"VIEWED",     c:"#A06810", bg:"#FDF3DC"},
  accepted: {label:"ACCEPTED",   c:"#1A7F5A", bg:"#E6F4EE"},
  rejected: {label:"REJECTED",   c:"#C53030", bg:"#FEE2E2"},
  expired:  {label:"EXPIRED",    c:"#6B7280", bg:"#F3F4F6"},
  superseded:{label:"SUPERSEDED",c:"#6B7280", bg:"#F3F4F6"},
};


const VALIDITY_PRESETS = [7, 10, 14, 21]; // days

/* ═══════════════════════════════════════════════════════════════
   Phase E W3 — Open Items Guard
   A proposal is the first official document sent to the buyer.
   Before it can be sent, all earlier-stage open items must be closed:
     - Upcoming Site Visits → outcome captured OR cancelled with reason
     - Upcoming Handover Meetings → completed OR cancelled
   Open negotiation rounds are NOT blocking (proposal supersedes them).
═══════════════════════════════════════════════════════════════ */

export default RemindersBell;
