import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from "../../lib/supabase.js";
import { Btn } from "../../modules/shared/Btn.jsx";
import { Badge } from "../../modules/shared/Badge.jsx";
import { Spinner } from "../../modules/shared/Spinner.jsx";
import { StageBadge } from "../../modules/shared/StageBadge.jsx";
import { OPP_STAGES, OPP_STAGE_META } from "../../modules/constants.js";
import { canDo } from "../../lib/permissions.js";
import OpportunityDetail from "../opportunities/OpportunityDetail.jsx";

function Opportunities({onActivityLog, leads, setLeads, opps, setOpps, units, projects, salePricing, activities, setActivities, currentUser, users, showToast, initialFilter=null, CreateOpportunityDialog }) {
  const [view, setView] = useState("list"); // "list" | "opportunity"
  const [selOpp, setSelOpp] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [fStage, setFStage] = useState("All");
  const [fOwner, setFOwner] = useState("All"); // "All" | "Mine" | userId

  // Deep-link: if initialFilter says open a specific opp, do it
  // Fix 12 May 2026: resilient to stale state - fetch from DB if not in local array
  // (handles race condition where new opp navigation fires before global state updates)
  useEffect(()=>{
    if (!initialFilter || initialFilter.type !== "opp" || !initialFilter.oppId) return;
    const opp = (opps||[]).find(o => o.id === initialFilter.oppId);
    if (opp) {
      setSelOpp(opp);
      setView("opportunity");
      return;
    }
    // Not in local state yet - fetch directly from DB
    (async () => {
      try {
        const { data, error } = await supabase
          .from("opportunities")
          .select("*")
          .eq("id", initialFilter.oppId)
          .maybeSingle();
        if (error) {
          console.error("Deep-link DB fallback failed:", error);
          return;
        }
        if (data) {
          setSelOpp(data);
          setView("opportunity");
          // Also push to local state so subsequent operations see it
          if (setOpps) {
            setOpps(prev => prev.some(o => o.id === data.id) ? prev : [data, ...prev]);
          }
        }
      } catch (e) {
        console.error("Deep-link DB fallback exception:", e);
      }
    })();
  }, [initialFilter?.type, initialFilter?.oppId, opps?.length]);

  // Deep-link: if initialFilter says filter by stage, select that stage tab
  useEffect(() => {
    if (initialFilter && initialFilter.type === "stage" && initialFilter.value) {
      setFStage(initialFilter.value);
    }
  }, [initialFilter?.type, initialFilter?.value]);

  // Deep-link: if initialFilter says filter by stage, select that stage tab
  useEffect(() => {
    if (initialFilter && initialFilter.type === "stage" && initialFilter.value) {
      setFStage(initialFilter.value);
    }
  }, [initialFilter?.type, initialFilter?.value]);

  const STAGES = ["New","Contacted","Site Visit","Proposal Sent","Negotiation","Offer Accepted","Reserved","SPA Requirements","SPA Signed","Closed Won","Closed Lost"];
  const STAGE_COLORS = {
    "New":            {c:"#1A5FA8", bg:"#E6EFF8"},
    "Contacted":      {c:"#0F766E", bg:"#CCFBF1"},
    "Site Visit":     {c:"#7C3AED", bg:"#EDE9FE"},
    "Proposal Sent":  {c:"#A06810", bg:"#FDF3DC"},
    "Negotiation":    {c:"#C2410C", bg:"#FFEDD5"},
    "Offer Accepted": {c:"#1A7F5A", bg:"#D1FAE5"},
    "Reserved":       {c:"#7C3AED", bg:"#EDE9FE"},
    "SPA Requirements": {c:"#B45309", bg:"#FEF3C7"},
    "SPA Signed":     {c:"#0F2540", bg:"#E2E8F0"},
    "Closed Won":     {c:"#1A7F5A", bg:"#D1FAE5"},
    "Closed Lost":    {c:"#C53030", bg:"#FEE2E2"},
  };

  // Index lookup helpers
  const leadById = useMemo(()=>Object.fromEntries((leads||[]).map(l=>[l.id,l])), [leads]);
  const userById = useMemo(()=>Object.fromEntries((users||[]).map(u=>[u.id,u])), [users]);
  const canSeeAllOwners = canDo(currentUser, "see_all"); // render-scope: gates the owner dropdown
  const unitById = useMemo(()=>Object.fromEntries((units||[]).map(u=>[u.id,u])), [units]);
  const projectById = useMemo(()=>Object.fromEntries((projects||[]).map(p=>[p.id,p])), [projects]);

  // Apply filters
  const visible = useMemo(()=>{
    let rows = (opps||[]).filter(o => o && o.id);
    // Visibility: users without see_all are HARD-scoped to their own deals
    const canSeeAll = canDo(currentUser, "see_all");
    if (!canSeeAll) rows = rows.filter(o => o.assigned_to === currentUser.id);
    // Stage filter
    if (fStage !== "All") rows = rows.filter(o => o.stage === fStage);
    // Owner filter
    if (fOwner === "Mine") rows = rows.filter(o => o.assigned_to === currentUser.id);
    else if (fOwner !== "All") rows = rows.filter(o => o.assigned_to === fOwner);
    // Search filter
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(o => {
        const lead = leadById[o.lead_id];
        const unit = unitById[o.unit_id];
        const proj = unit ? projectById[unit.project_id] : null;
        const haystack = [
          lead?.name, lead?.phone, lead?.email,
          unit?.unit_ref, proj?.name,
          o.stage,
        ].filter(Boolean).join(" ").toLowerCase();
        return haystack.includes(q);
      });
    }
    // Sort: stage_updated_at desc (most recent activity first)
    return rows.sort((a,b)=>{
      const at = a.stage_updated_at ? new Date(a.stage_updated_at).getTime() : 0;
      const bt = b.stage_updated_at ? new Date(b.stage_updated_at).getTime() : 0;
      return bt - at;
    });
  }, [opps, fStage, fOwner, search, leadById, unitById, projectById, currentUser.id]);

  // Stage counts (for chip badges)
  const stageCounts = useMemo(()=>{
    const c = {};
    (opps||[]).forEach(o => { if(o?.stage) c[o.stage] = (c[o.stage]||0)+1; });
    return c;
  }, [opps]);

  const fmtAed = (n) => n ? `AED ${Number(n).toLocaleString()}` : "—";
  const fmtRelative = (iso) => {
    if (!iso) return "—";
    const days = Math.floor((new Date() - new Date(iso)) / (1000*60*60*24));
    if (days === 0) return "today";
    if (days === 1) return "1 day ago";
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days/7)}w ago`;
    if (days < 365) return `${Math.floor(days/30)}mo ago`;
    return `${Math.floor(days/365)}y ago`;
  };

  // ─── DETAIL VIEW ───────────────────────────────────
  if (view === "opportunity" && selOpp) {
    const lead = leadById[selOpp.lead_id];
    return (
      <OpportunityDetail
        key={selOpp.id}
        opp={selOpp}
        lead={lead}
        opps={opps}
        units={units}
        projects={projects}
        salePricing={salePricing}
        users={users}
        currentUser={currentUser}
        showToast={showToast}
        onBack={()=>{ setSelOpp(null); setView("list"); }}
        onUpdated={(updated)=>{
          setSelOpp(updated);
          if (setOpps) setOpps(prev => prev.map(o => o.id === updated.id ? updated : o));
        }}
        onActivityLog={onActivityLog}
      />
    );
  }

  // ─── LIST VIEW ────────────────────────────────────
  return (
    <div style={{padding:"1.25rem 1.5rem"}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",gap:12,flexWrap:"wrap",marginBottom:14}}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:20}}>🎯</span>
            <span style={{fontFamily:"'Playfair Display',serif",fontSize:24,fontWeight:700,color:"#0F2540",letterSpacing:"-.4px"}}>Opportunities</span>
            <span style={{fontSize:12,color:"#64748B",fontWeight:500}}>{visible.length} of {(opps||[]).length}</span>
            {fStage!=="All" && <span style={{fontSize:16,color:"#1A7F5A",fontWeight:800,background:"#D1FAE5",padding:"3px 14px",borderRadius:14}}>{fStage}: AED {visible.reduce((sum,o)=>sum+(Number(o.final_price)||Number(o.current_agreed_price)||Number(o.budget)||0),0).toLocaleString()}</span>}
          </div>
          <div style={{fontSize:12,color:"#64748B",marginTop:2}}>Your deal pipeline — click any row to open the workspace</div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setShowCreate(true)}
            style={{padding:"9px 18px",borderRadius:8,border:"none",background:"#0F2540",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>
            + New Opportunity
          </button>
        </div>
      </div>

      {/* Create Opportunity dialog */}
      {showCreate && (
        <CreateOpportunityDialog
          leads={leads}
          setLeads={setLeads}
          units={units}
          projects={projects}
          salePricing={salePricing}
          users={users}
          currentUser={currentUser}
          showToast={showToast}
          opps={opps}
          onClose={()=>setShowCreate(false)}
          onCreated={(newOpp, newLead)=>{
            // Append to parent opps list, optionally append new lead
            if (newLead && setLeads) setLeads(prev => prev.find(l=>l.id===newLead.id) ? prev : [newLead, ...prev]);
            if (setOpps) setOpps(prev => [newOpp, ...prev]);
            setShowCreate(false);
            // Drop straight into the new opp's detail page
            setSelOpp(newOpp);
            setView("opportunity");
          }}
        />
      )}

      {/* Filters: search + owner */}
      <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap"}}>
        <div style={{position:"relative",flex:"1 1 280px",minWidth:240}}>
          <input type="text" value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="🔍 Search by lead name, phone, email, unit ref, project…"
            style={{width:"100%",padding:"8px 32px 8px 12px",borderRadius:8,border:"1.5px solid #E2E8F0",fontSize:13,boxSizing:"border-box",outline:"none",background:"#fff"}}/>
          {search && (
            <button onClick={()=>setSearch("")} title="Clear"
              style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",padding:"2px 8px",borderRadius:5,border:"none",background:"#E2E8F0",color:"#64748B",fontSize:10,fontWeight:700,cursor:"pointer"}}>
              ✕
            </button>
          )}
        </div>
        {canSeeAllOwners && (
        <select value={fOwner} onChange={e=>setFOwner(e.target.value)}
          style={{padding:"8px 12px",borderRadius:8,border:"1.5px solid #E2E8F0",fontSize:12,fontWeight:600,color:"#0F2540",background:"#fff",cursor:"pointer",outline:"none"}}>
          <option value="All">👥 All owners</option>
          <option value="Mine">⭐ My opportunities</option>
          {(users||[]).map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
        </select>
        )}
      </div>

      {/* Stage filter chips */}
      <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:14}}>
        <button onClick={()=>setFStage("All")}
          style={{padding:"5px 12px",borderRadius:16,border:`1.5px solid ${fStage==="All"?"#0F2540":"#E2E8F0"}`,background:fStage==="All"?"#0F2540":"#fff",color:fStage==="All"?"#fff":"#475569",fontSize:11,fontWeight:600,cursor:"pointer"}}>
          All <span style={{opacity:.7,marginLeft:4}}>{(opps||[]).length}</span>
        </button>
        {STAGES.map(s => {
          const sel = fStage === s;
          const meta = STAGE_COLORS[s] || {c:"#475569", bg:"#F1F5F9"};
          const count = stageCounts[s] || 0;
          return (
            <button key={s} onClick={()=>setFStage(s)}
              style={{padding:"5px 12px",borderRadius:16,border:`1.5px solid ${sel?meta.c:"#E2E8F0"}`,background:sel?meta.bg:"#fff",color:sel?meta.c:"#475569",fontSize:11,fontWeight:600,cursor:"pointer",opacity:count===0?0.5:1}}>
              {s} <span style={{opacity:.7,marginLeft:4}}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      {visible.length === 0 ? (
        <div style={{padding:"3rem 2rem",textAlign:"center",border:"1px dashed #D1D9E6",borderRadius:12,background:"#F8FAFC"}}>
          <div style={{fontSize:36,marginBottom:8}}>🎯</div>
          <div style={{fontSize:14,fontWeight:700,color:"#0F2540",marginBottom:4}}>
            {(opps||[]).length === 0 ? "No opportunities yet" : "No matches"}
          </div>
          <div style={{fontSize:12,color:"#64748B"}}>
            {(opps||[]).length === 0
              ? "Create one from the Leads tab, or use the new flow once it ships."
              : "Try adjusting filters or search."}
          </div>
        </div>
      ) : (
        <div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:10,overflow:"hidden"}}>
          {/* Table header — 18 May 2026: Added Price + Final columns per founder request */}
          <div style={{display:"grid",gridTemplateColumns:"2fr 0.9fr 1fr 1fr 1fr 0.8fr 0.9fr 1fr 30px",gap:8,padding:"10px 14px",background:"#F8FAFC",borderBottom:"1px solid #E2E8F0",fontSize:10,fontWeight:700,color:"#64748B",textTransform:"uppercase",letterSpacing:".5px"}}>
            <div>Lead / Unit</div>
            <div>Stage</div>
            <div>Budget</div>
            <div>Price</div>
            <div>Final</div>
            <div>Days</div>
            <div>Last activity</div>
            <div>Owner</div>
            <div></div>
          </div>
          {/* Rows */}
          {visible.map(o => {
            const lead = leadById[o.lead_id];
            const unit = unitById[o.unit_id];
            const proj = unit ? projectById[unit.project_id] : null;
            const owner = userById[o.assigned_to];
            const stageMeta = STAGE_COLORS[o.stage] || {c:"#475569", bg:"#F1F5F9"};
            const daysInStage = o.stage_updated_at ? Math.floor((new Date() - new Date(o.stage_updated_at)) / (1000*60*60*24)) : null;
            // 18 May 2026: Get unit price for Price column
            const unitPrice = unit ? (salePricing||[]).find(s => s.unit_id === unit.id)?.asking_price : null;
            return (
              <div key={o.id}
                onClick={()=>{ setSelOpp(o); setView("opportunity"); }}
                style={{display:"grid",gridTemplateColumns:"2fr 0.9fr 1fr 1fr 1fr 0.8fr 0.9fr 1fr 30px",gap:8,padding:"11px 14px",borderBottom:"1px solid #F1F5F9",cursor:"pointer",alignItems:"center",transition:"background .12s"}}
                onMouseOver={e=>e.currentTarget.style.background="#F8FAFC"}
                onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                <div style={{minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:700,color:"#0F2540",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                    {lead?.name || "—"}
                  </div>
                  <div style={{fontSize:11,color:"#64748B",marginTop:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                    {[unit?.unit_ref, proj?.name].filter(Boolean).join(" · ") || (lead?.phone || "no unit")}
                  </div>
                </div>
                <div>
                  <span style={{fontSize:10,fontWeight:700,padding:"3px 9px",borderRadius:10,background:stageMeta.bg,color:stageMeta.c,letterSpacing:".4px"}}>
                    {o.stage}
                  </span>
                </div>
                <div style={{fontSize:11,color:"#64748B"}}>
                  {fmtAed(o.budget)}
                </div>
                <div style={{fontSize:11,color:"#64748B"}}>
                  {fmtAed(unitPrice)}
                </div>
                <div style={{fontSize:12,color:o.current_agreed_price?"#0F2540":"#94A3B8",fontWeight:o.current_agreed_price?700:400}}>
                  {fmtAed(o.current_agreed_price)}
                </div>
                <div style={{fontSize:11,color:daysInStage > 7 ? "#C2410C" : "#475569"}}>
                  {daysInStage === null ? "—" : daysInStage === 0 ? "today" : `${daysInStage}d`}
                </div>
                <div style={{fontSize:11,color:"#64748B"}}>
                  {fmtRelative(o.stage_updated_at)}
                </div>
                <div style={{fontSize:11,color:"#475569",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                  {owner?.full_name || "Unassigned"}
                </div>
                <div style={{fontSize:14,color:"#94A3B8",textAlign:"right"}}>→</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


export default Opportunities;
