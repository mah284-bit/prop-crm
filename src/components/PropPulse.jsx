import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
function PropPulse({ currentUser, showToast }) {
  const [activeTab, setActiveTab] = useState("projects");
  const [developers, setDevelopers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [commissions, setCommissions] = useState([]);
  const [launches, setLaunches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [fDev, setFDev] = useState("All");
  const [fStatus, setFStatus] = useState("All");
  const [fEmirate, setFEmirate] = useState("All");
  const [fType, setFType] = useState("All");
  const [selProject, setSelProject] = useState(null);
  const [showAddProject, setShowAddProject] = useState(false);
  const [showAddDev, setShowAddDev] = useState(false);
  const [saving, setSaving] = useState(false);
  const [agentRunning, setAgentRunning] = useState(false);
  const [agentProgress, setAgentProgress] = useState(null); // { current, total, developer }
  const [unverifiedProjects, setUnverifiedProjects] = useState([]); // catalog-scoped, is_pp_verified = false
  const [showVerifyQueue, setShowVerifyQueue] = useState(false);
  const [verifyingId, setVerifyingId] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importedSourceIds, setImportedSourceIds] = useState(new Set());
  const [devForm, setDevForm] = useState({ name:"", website:"", city:"Dubai", country:"UAE", rera_developer_no:"", description:"" });
  const [projForm, setProjForm] = useState({ name:"", pp_developer_id:"", emirate:"Dubai", community:"", project_type:"Residential", project_status:"Under Construction", announcement_date:"", handover_date:"", starting_price:"", total_units:"", description:"", latitude:"", longitude:"", google_maps_url:"" });

  const isAdmin = ["super_admin","admin"].includes(currentUser.role);
  // Sales Manager + Admin + Super Admin can import projects into their tenant inventory
  const canImport = ["super_admin","admin","sales_manager","leasing_manager"].includes(currentUser.role);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [d, p, c, l] = await Promise.all([
        supabase.from("pp_developers").select("*").order("name"),
        // PropPulse catalog = verified projects only (shared across all tenants)
        supabase.from("projects").select("*, pp_developers(name,logo_url)").eq("is_pp_verified", true).order("name"),
        supabase.from("pp_commissions").select("*, pp_developers(name), projects(name)").eq("is_active", true),
        supabase.from("pp_launch_events").select("*, projects(name), pp_developers(name)").gte("event_date", new Date().toISOString().slice(0,10)).order("event_date"),
      ]);
      setDevelopers(d.data || []);
      setProjects(p.data || []);
      setCommissions(c.data || []);
      setLaunches(l.data || []);

      // Load which of these catalog projects are effectively in the current user's
      // company inventory — either imported via PropPulse (matched by pp_source_id)
      // OR already present by name (e.g. added manually before PropPulse existed).
      // Both cases should show the "In My Inventory" badge and disable re-import.
      if (currentUser.company_id && (p.data||[]).length) {
        const catalogIds   = (p.data||[]).map(x=>x.id);
        const catalogNames = (p.data||[]).map(x=>x.name).filter(Boolean);
        // Query 1: rows in my company that were imported from this catalog
        const r1 = supabase
          .from("projects")
          .select("pp_source_id, name")
          .eq("company_id", currentUser.company_id)
          .in("pp_source_id", catalogIds);
        // Query 2: rows in my company whose name matches a catalog entry
        const r2 = supabase
          .from("projects")
          .select("pp_source_id, name")
          .eq("company_id", currentUser.company_id)
          .in("name", catalogNames);
        const [a, b] = await Promise.all([r1, r2]);
        const bySource = new Set(((a.data)||[]).map(x=>x.pp_source_id).filter(Boolean));
        const byName   = new Set([...((a.data)||[]), ...((b.data)||[])].map(x=>x.name).filter(Boolean));
        const resolved = new Set();
        (p.data||[]).forEach(catalogProj => {
          if (bySource.has(catalogProj.id) || byName.has(catalogProj.name)) {
            resolved.add(catalogProj.id);
          }
        });
        setImportedSourceIds(resolved);
      } else {
        setImportedSourceIds(new Set());
      }

      // Admins see a Verification Queue — catalog-scoped projects with is_pp_verified = false
      if (isAdmin) {
        const { data: unverified } = await supabase
          .from("projects")
          .select("*, pp_developers(name)")
          .is("company_id", null)
          .eq("is_pp_verified", false)
          .order("pp_last_updated", { ascending: false })
          .limit(100);
        setUnverifiedProjects(unverified || []);
      }
    } catch(e) { showToast("Failed to load PropPulse data", "error"); }
    setLoading(false);
  };

  // Admin action: approve an unverified project → flips is_pp_verified = true,
  // making it visible to all brokerages in the PropPulse catalog.
  const verifyProject = async (proj) => {
    setVerifyingId(proj.id);
    try {
      const { error } = await supabase
        .from("projects")
        .update({ is_pp_verified: true, pp_last_updated: new Date().toISOString() })
        .eq("id", proj.id);
      if (error) throw error;
      showToast(`✓ "${proj.name}" verified and published to catalog`, "success");
      loadAll();
    } catch(e) { showToast(e.message, "error"); }
    setVerifyingId(null);
  };

  // Admin action: reject an unverified project → hard delete. Data can always
  // be re-discovered by the agent later if it's legitimate.
  const rejectProject = async (proj) => {
    if (!window.confirm(`Reject and delete "${proj.name}"? This can't be undone.`)) return;
    setVerifyingId(proj.id);
    try {
      const { error } = await supabase.from("projects").delete().eq("id", proj.id);
      if (error) throw error;
      showToast(`"${proj.name}" rejected and removed`, "info");
      loadAll();
    } catch(e) { showToast(e.message, "error"); }
    setVerifyingId(null);
  };

  const runAgent = async () => {
    if (!developers.length) {
      showToast("No developers configured. Add a developer first.", "error");
      return;
    }
    setAgentRunning(true);
    let totalAdded = 0;
    let totalUpdated = 0;
    let totalQueued = 0;
    let totalErrors = 0;

    for (let i = 0; i < developers.length; i++) {
      const dev = developers[i];
      setAgentProgress({ current: i + 1, total: developers.length, developer: dev.name });
      try {
        const res = await fetch("/api/collect-projects-v2", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            developer_id: dev.id,
            developer_name: dev.name,
            developer_website: dev.website,
          }),
        });
        const result = await res.json();
        if (!res.ok) {
          totalErrors++;
          console.warn(`Agent error for ${dev.name}:`, result.error);
        } else {
          totalAdded   += result.added   || 0;
          totalUpdated += result.updated || 0;
          totalQueued  += result.queued_for_review || 0;
        }
      } catch(e) {
        totalErrors++;
        console.warn(`Agent exception for ${dev.name}:`, e.message);
      }
    }

    setAgentProgress(null);
    setAgentRunning(false);
    const summary =
      `✅ Agent run complete — ${totalAdded} new, ${totalUpdated} updated, ` +
      `${totalQueued} awaiting review` + (totalErrors ? `, ${totalErrors} developer(s) failed` : "");
    showToast(summary, "success");
    loadAll();
  };

  const saveDeveloper = async () => {
    if (!devForm.name.trim()) { showToast("Developer name required", "error"); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("pp_developers").insert({ ...devForm, data_source:"manual" });
      if (error) throw error;
      showToast("Developer added to PropPulse", "success");
      setShowAddDev(false);
      setDevForm({ name:"", website:"", city:"Dubai", country:"UAE", rera_developer_no:"", description:"" });
      loadAll();
    } catch(e) { showToast(e.message, "error"); }
    setSaving(false);
  };

  const saveProject = async () => {
    if (!projForm.name.trim()) { showToast("Project name required", "error"); return; }
    setSaving(true);
    try {
      // Admin-added projects in PropPulse go straight into the catalog (verified).
      // They are NOT stamped with the admin's own company_id — PropPulse is the
      // shared catalog, not any one tenant's inventory.
      const { error } = await supabase.from("projects").insert({
        ...projForm,
        starting_price: projForm.starting_price ? Number(projForm.starting_price) : null,
        total_units: projForm.total_units ? Number(projForm.total_units) : null,
        latitude: projForm.latitude ? Number(projForm.latitude) : null,
        longitude: projForm.longitude ? Number(projForm.longitude) : null,
        is_pp_verified: true,
        pp_data_source: "manual",
        pp_last_updated: new Date().toISOString(),
        company_id: null,
        created_by: currentUser.id,
      });
      if (error) throw error;
      showToast("Project added to PropPulse catalog ⚡", "success");
      setShowAddProject(false);
      setProjForm({ name:"", pp_developer_id:"", emirate:"Dubai", community:"", project_type:"Residential", project_status:"Under Construction", announcement_date:"", handover_date:"", starting_price:"", total_units:"", description:"", latitude:"", longitude:"", google_maps_url:"" });
      loadAll();
    } catch(e) { showToast(e.message, "error"); }
    setSaving(false);
  };

  // ═══════════════════════════════════════════════════════════════════════
  // IMPORT FLOW
  // Clones a PropPulse catalog project (and all its units) into the current
  // user's company inventory. Uses pp_source_id / pp_source_unit_id to track
  // provenance and prevent duplicate imports.
  // ═══════════════════════════════════════════════════════════════════════
  const importProject = async (sourceProject) => {
    if (!currentUser.company_id) {
      showToast("Your user isn't linked to a company — can't import", "error");
      return;
    }
    if (importedSourceIds.has(sourceProject.id)) {
      showToast("This project is already in your inventory", "info");
      return;
    }
    setImporting(true);
    try {
      // 1a. Dedup guard: has this PropPulse catalog entry already been imported by this tenant?
      const { data: existingBySource } = await supabase
        .from("projects")
        .select("id")
        .eq("company_id", currentUser.company_id)
        .eq("pp_source_id", sourceProject.id)
        .maybeSingle();
      if (existingBySource) {
        showToast("Already in your inventory", "info");
        setImportedSourceIds(prev => new Set(prev).add(sourceProject.id));
        setImporting(false);
        return;
      }

      // 1b. Name-based dedup: a project with this name already exists in the tenant's
      // inventory (likely added manually, not through PropPulse). We can't create another
      // because projects_name_company_unique would block it. Tell the user clearly.
      const { data: existingByName } = await supabase
        .from("projects")
        .select("id, pp_source_id")
        .eq("company_id", currentUser.company_id)
        .eq("name", sourceProject.name)
        .maybeSingle();
      if (existingByName) {
        // Mark as "in inventory" so the UI stops offering to import
        setImportedSourceIds(prev => new Set(prev).add(sourceProject.id));
        showToast(
          `"${sourceProject.name}" already exists in your inventory (added separately). Not re-imported.`,
          "info"
        );
        setImporting(false);
        return;
      }

      // 2. Clone the project row.
      // Strip id/timestamps (DB regenerates), company_id (we swap it),
      // and the joined relation (not a real column).
      const { id: _id, created_at: _ca, updated_at: _ua, company_id: _ocid, pp_developers: _ppd, ...cloneable } = sourceProject;
      const { data: newProject, error: pErr } = await supabase
        .from("projects")
        .insert({
          ...cloneable,
          company_id: currentUser.company_id,
          pp_source_id: sourceProject.id,
          is_pp_verified: false, // the tenant copy is inventory, not the catalog entry
          created_by: currentUser.id,
        })
        .select()
        .single();
      if (pErr) throw pErr;

      // 3. Clone any units attached to the source catalog project.
      const { data: sourceUnits, error: uFetchErr } = await supabase
        .from("project_units")
        .select("*")
        .eq("project_id", sourceProject.id);
      if (uFetchErr) throw uFetchErr;

      if (sourceUnits && sourceUnits.length) {
        const unitClones = sourceUnits.map(u => {
          const { id: _uid, created_at: _uca, updated_at: _uua, company_id: _uocid, project_id: _opid, ...rest } = u;
          return {
            ...rest,
            project_id: newProject.id,
            company_id: currentUser.company_id,
            pp_source_unit_id: u.id,
            is_pp_listed: false,
            created_by: currentUser.id,
          };
        });
        const { error: uErr } = await supabase.from("project_units").insert(unitClones);
        if (uErr) {
          // Project inserted but units failed — roll back the project insert so
          // we don't leave an orphaned shell in the tenant's inventory.
          await supabase.from("projects").delete().eq("id", newProject.id);
          throw new Error("Unit import failed — project rolled back: " + uErr.message);
        }
        showToast(`✅ Imported "${sourceProject.name}" + ${sourceUnits.length} unit${sourceUnits.length===1?"":"s"} to your inventory`, "success");
      } else {
        showToast(`✅ Imported "${sourceProject.name}" to your inventory`, "success");
      }

      setImportedSourceIds(prev => new Set(prev).add(sourceProject.id));
    } catch(e) {
      showToast(e.message || "Import failed", "error");
    }
    setImporting(false);
  };

  const filteredProjects = projects.filter(p => {
    const q = search.toLowerCase();
    const matchQ = !q || p.name?.toLowerCase().includes(q) || p.community?.toLowerCase().includes(q) || p.pp_developers?.name?.toLowerCase().includes(q);
    const matchDev = fDev === "All" || p.pp_developer_id === fDev;
    const matchStatus = fStatus === "All" || p.project_status === fStatus;
    const matchEmirate = fEmirate === "All" || p.emirate === fEmirate;
    const matchType = fType === "All" || p.project_type === fType;
    return matchQ && matchDev && matchStatus && matchEmirate && matchType;
  });

  const STATUS_COLORS = {
    "Announced": { bg:"#EEE8F9", c:"#5B3FAA" },
    "Approved": { bg:"#E6EFF9", c:"#1A5FA8" },
    "Under Construction": { bg:"#FDF3DC", c:"#A06810" },
    "Ready": { bg:"#E6F4EE", c:"#1A7F5A" },
    "Completed": { bg:"#F0FDF4", c:"#166534" },
    "On Hold": { bg:"#FEF2F2", c:"#B83232" },
  };

  if (loading) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",flexDirection:"column",gap:16}}>
      <div style={{fontSize:48}}>⚡</div>
      <div style={{fontSize:14,color:"#64748B",fontWeight:600}}>Loading PropPulse…</div>
    </div>
  );

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%",gap:0}}>

      {/* Header */}
      <div style={{background:"linear-gradient(135deg,#0F2540 0%,#1A3A5C 100%)",padding:"20px 24px",borderRadius:12,marginBottom:16,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:28}}>⚡</span>
            <span style={{fontSize:22,fontWeight:800,color:"#fff",letterSpacing:"-.5px"}}>PropPulse</span>
            <span style={{fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:20,background:"rgba(201,168,76,.2)",color:"#C9A84C",border:"1px solid rgba(201,168,76,.3)"}}>LIVE</span>
          </div>
          <div style={{fontSize:12,color:"rgba(255,255,255,.6)",marginTop:4}}>Every UAE project. Every developer. Always live.</div>
        </div>
        <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
          {[
            [projects.length, "Projects"],
            [developers.length, "Developers"],
            [projects.filter(p=>p.project_status==="Announced").length, "New Announced"],
            [launches.length, "Upcoming Launches"],
          ].map(([v,l]) => (
            <div key={l} style={{textAlign:"center"}}>
              <div style={{fontSize:22,fontWeight:800,color:"#C9A84C"}}>{v}</div>
              <div style={{fontSize:10,color:"rgba(255,255,255,.5)",textTransform:"uppercase",letterSpacing:".5px"}}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:4,marginBottom:16,flexWrap:"wrap"}}>
        {[
          ["projects","🏗️ Projects"],
          ["developers","🏢 Developers"],
          ["launches","🚀 Launches"],
          ["commissions","💰 Commissions"],
        ].map(([id,label]) => (
          <button key={id} onClick={()=>setActiveTab(id)}
            style={{padding:"8px 18px",borderRadius:8,border:`1.5px solid ${activeTab===id?"#0F2540":"#E2E8F0"}`,
              background:activeTab===id?"#0F2540":"#fff",color:activeTab===id?"#fff":"#4A5568",
              fontSize:13,fontWeight:activeTab===id?700:400,cursor:"pointer"}}>
            {label}
          </button>
        ))}
        {isAdmin && (
          <div style={{marginLeft:"auto",display:"flex",gap:8,alignItems:"center"}}>
            {agentProgress && (
              <span style={{fontSize:11,color:"#5B3FAA",fontWeight:600,padding:"0 8px"}}>
                Checking {agentProgress.current}/{agentProgress.total}: {agentProgress.developer}…
              </span>
            )}
            <button onClick={runAgent} disabled={agentRunning}
              style={{padding:"8px 16px",borderRadius:8,border:"1.5px solid #5B3FAA",background:agentRunning?"#EEE8F9":"#5B3FAA",color:"#fff",fontSize:12,fontWeight:600,cursor:agentRunning?"not-allowed":"pointer"}}>
              {agentRunning?"⚡ Running…":"🤖 Run AI Agent"}
            </button>
            {unverifiedProjects.length > 0 && (
              <button onClick={()=>setShowVerifyQueue(true)}
                style={{padding:"8px 16px",borderRadius:8,border:"1.5px solid #B85C10",background:"#FDF0E6",color:"#8A4200",fontSize:12,fontWeight:700,cursor:"pointer",position:"relative"}}>
                🔍 Verify Queue
                <span style={{marginLeft:6,background:"#B85C10",color:"#fff",borderRadius:10,padding:"1px 7px",fontSize:10,fontWeight:700}}>
                  {unverifiedProjects.length}
                </span>
              </button>
            )}
            <button onClick={()=>setShowAddDev(true)}
              style={{padding:"8px 16px",borderRadius:8,border:"1.5px solid #C9A84C",background:"#FDF3DC",color:"#8A6200",fontSize:12,fontWeight:600,cursor:"pointer"}}>
              + Developer
            </button>
            <button onClick={()=>setShowAddProject(true)}
              style={{padding:"8px 16px",borderRadius:8,border:"none",background:"#0F2540",color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>
              ⚡ + Project
            </button>
          </div>
        )}
      </div>

      {/* ── PROJECTS TAB ── */}
      {activeTab==="projects"&&(
        <div style={{flex:1,overflowY:"auto"}}>
          {/* Filters */}
          <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
            <input placeholder="🔍 Search projects, communities, developers…" value={search} onChange={e=>setSearch(e.target.value)}
              style={{flex:2,minWidth:200,padding:"8px 12px",borderRadius:8,border:"1.5px solid #E2E8F0",fontSize:13}}/>
            <select value={fDev} onChange={e=>setFDev(e.target.value)} style={{flex:1,minWidth:140,fontSize:13,padding:"8px 10px",borderRadius:8,border:"1.5px solid #E2E8F0"}}>
              <option value="All">All Developers</option>
              {developers.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <select value={fStatus} onChange={e=>setFStatus(e.target.value)} style={{fontSize:13,padding:"8px 10px",borderRadius:8,border:"1.5px solid #E2E8F0"}}>
              <option value="All">All Status</option>
              {["Announced","Approved","Under Construction","Ready","Completed","On Hold"].map(s=><option key={s}>{s}</option>)}
            </select>
            <select value={fEmirate} onChange={e=>setFEmirate(e.target.value)} style={{fontSize:13,padding:"8px 10px",borderRadius:8,border:"1.5px solid #E2E8F0"}}>
              <option value="All">All Emirates</option>
              {["Dubai","Abu Dhabi","Sharjah","Ajman","RAK","Fujairah","UAQ"].map(s=><option key={s}>{s}</option>)}
            </select>
            <select value={fType} onChange={e=>setFType(e.target.value)} style={{fontSize:13,padding:"8px 10px",borderRadius:8,border:"1.5px solid #E2E8F0"}}>
              <option value="All">All Types</option>
              {["Residential","Commercial","Mixed Use","Villa","Townhouse","Hotel Apartments"].map(s=><option key={s}>{s}</option>)}
            </select>
            <div style={{fontSize:12,color:"#94A3B8",alignSelf:"center",whiteSpace:"nowrap"}}>{filteredProjects.length} projects</div>
          </div>

          {/* Project Table */}
          {filteredProjects.length===0?(
            <div style={{textAlign:"center",padding:"4rem",color:"#A0AEC0"}}>
              <div style={{fontSize:48,marginBottom:12}}>⚡</div>
              <div style={{fontSize:15,fontWeight:600,color:"#0F2540",marginBottom:6}}>No projects found</div>
              <div style={{fontSize:13}}>Add projects or adjust your filters</div>
            </div>
          ):(
            <>
              <div style={{display:"grid",gridTemplateColumns:"2.5fr 1.5fr 1fr 1fr 1fr 1fr 1fr",gap:0,background:"#0F2540",borderRadius:"10px 10px 0 0",padding:"8px 14px"}}>
                {["Project","Community","Type","Units","Starting Price","Handover",""].map(h=>(
                  <div key={h} style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,.7)",textTransform:"uppercase",letterSpacing:".5px"}}>{h}</div>
                ))}
              </div>
              <div style={{border:"1px solid #E8EDF4",borderTop:"none",borderRadius:"0 0 10px 10px",overflow:"hidden"}}>
                {filteredProjects.map((proj,ri)=>{
                  const sc = STATUS_COLORS[proj.project_status]||{bg:"#F7F9FC",c:"#718096"};
                  const alreadyImported = importedSourceIds.has(proj.id);
                  return (
                    <div key={proj.id} onClick={()=>setSelProject(proj)}
                      style={{display:"grid",gridTemplateColumns:"2.5fr 1.5fr 1fr 1fr 1fr 1fr 1fr",gap:0,padding:"10px 14px",alignItems:"center",background:ri%2===0?"#fff":"#F7F9FC",borderBottom:"1px solid #F1F5F9",cursor:"pointer",transition:"background .1s"}}
                      onMouseOver={e=>e.currentTarget.style.background="#EFF6FF"}
                      onMouseOut={e=>e.currentTarget.style.background=ri%2===0?"#fff":"#F7F9FC"}>
                      <div>
                        <div style={{fontSize:13,fontWeight:700,color:"#0F2540"}}>{proj.name}</div>
                        <div style={{fontSize:11,color:"#94A3B8"}}>{proj.pp_developers?.name||proj.developer||"—"}</div>
                        <div style={{display:"flex",gap:4,marginTop:3,flexWrap:"wrap"}}>
                          <span style={{fontSize:9,fontWeight:600,padding:"1px 6px",borderRadius:20,background:sc.bg,color:sc.c}}>{proj.project_status||"—"}</span>
                          {proj.is_pp_verified&&<span style={{fontSize:9,fontWeight:600,padding:"1px 6px",borderRadius:20,background:"#E6F4EE",color:"#1A7F5A"}}>✓ Verified</span>}
                          {alreadyImported&&<span style={{fontSize:9,fontWeight:600,padding:"1px 6px",borderRadius:20,background:"#E6EFF9",color:"#1A5FA8"}}>📥 In My Inventory</span>}
                        </div>
                      </div>
                      <div style={{fontSize:12,color:"#4A5568"}}>{proj.community||proj.location||"—"}<br/><span style={{fontSize:11,color:"#94A3B8"}}>{proj.emirate||"Dubai"}</span></div>
                      <div style={{fontSize:12,color:"#64748B"}}>{proj.project_type||"—"}</div>
                      <div style={{fontSize:12,color:"#0F2540",fontWeight:600}}>{proj.total_units?.toLocaleString()||"—"}</div>
                      <div style={{fontSize:12,color:"#1A7F5A",fontWeight:600}}>{proj.starting_price?`AED ${(proj.starting_price/1e6).toFixed(1)}M`:"—"}</div>
                      <div style={{fontSize:12,color:"#64748B"}}>{proj.handover_date?new Date(proj.handover_date).toLocaleDateString("en-AE",{month:"short",year:"numeric"}):"—"}</div>
                      <div style={{display:"flex",gap:6}}>
                        {proj.google_maps_url&&<a href={proj.google_maps_url} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{fontSize:11,color:"#1A5FA8",fontWeight:600,textDecoration:"none"}}>📍</a>}
                        {(proj.brochure_url||proj.brochure_file_url)&&<a href={proj.brochure_url||proj.brochure_file_url} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{fontSize:11,color:"#8A6200",fontWeight:600,textDecoration:"none"}}>📄</a>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── DEVELOPERS TAB ── */}
      {activeTab==="developers"&&(
        <div style={{flex:1,overflowY:"auto"}}>
          {/* Table header */}
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 1fr",gap:0,background:"#0F2540",borderRadius:"10px 10px 0 0",padding:"8px 14px"}}>
            {["Developer","City","Projects","Active Builds","RERA No.",""].map(h=>(
              <div key={h} style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,.7)",textTransform:"uppercase",letterSpacing:".5px"}}>{h}</div>
            ))}
          </div>
          {/* Table rows */}
          <div style={{border:"1px solid #E8EDF4",borderTop:"none",borderRadius:"0 0 10px 10px",overflow:"hidden"}}>
            {developers.map((dev,ri)=>{
              const devProjects = projects.filter(p=>p.pp_developer_id===dev.id);
              const activeBuilds = devProjects.filter(p=>p.project_status==="Under Construction").length;
              return (
                <div key={dev.id} style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 1fr",gap:0,padding:"10px 14px",alignItems:"center",background:ri%2===0?"#fff":"#F7F9FC",borderBottom:"1px solid #F1F5F9"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <div style={{width:30,height:30,borderRadius:8,background:"#0F2540",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:"#C9A84C",flexShrink:0}}>
                      {dev.name.charAt(0)}
                    </div>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:"#0F2540"}}>{dev.name}</div>
                      {dev.is_verified&&<span style={{fontSize:9,fontWeight:600,color:"#1A7F5A"}}>✓ Verified</span>}
                    </div>
                  </div>
                  <div style={{fontSize:12,color:"#64748B"}}>{dev.city||"—"}</div>
                  <div style={{fontSize:13,fontWeight:700,color:"#0F2540"}}>{devProjects.length}</div>
                  <div style={{fontSize:13,fontWeight:700,color:activeBuilds>0?"#1A7F5A":"#94A3B8"}}>{activeBuilds}</div>
                  <div style={{fontSize:11,color:"#94A3B8"}}>{dev.rera_developer_no||"—"}</div>
                  <div>
                    {dev.website&&<a href={dev.website} target="_blank" rel="noreferrer" style={{fontSize:11,color:"#1A5FA8",fontWeight:600,textDecoration:"none"}}>🌐 Website</a>}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{fontSize:12,color:"#94A3B8",padding:"8px 4px"}}>{developers.length} developers</div>
        </div>
      )}

      {/* ── LAUNCHES TAB ── */}
      {activeTab==="launches"&&(
        <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:10}}>
          {launches.length===0?(
            <div style={{textAlign:"center",padding:"4rem",color:"#A0AEC0"}}>
              <div style={{fontSize:48,marginBottom:12}}>🚀</div>
              <div style={{fontSize:15,fontWeight:600,color:"#0F2540",marginBottom:6}}>No upcoming launches</div>
              <div style={{fontSize:13}}>Add launch events to track project roadshows and open days</div>
              {isAdmin&&<button onClick={()=>{}} style={{marginTop:16,padding:"8px 20px",borderRadius:8,border:"none",background:"#0F2540",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>+ Add Launch Event</button>}
            </div>
          ):launches.map(ev=>(
            <div key={ev.id} style={{background:"#fff",border:"1px solid #E8EDF4",borderRadius:12,padding:"14px 16px",display:"flex",gap:14,alignItems:"flex-start"}}>
              <div style={{background:"#0F2540",borderRadius:10,padding:"10px 14px",textAlign:"center",flexShrink:0,minWidth:52}}>
                <div style={{fontSize:18,fontWeight:800,color:"#C9A84C"}}>{ev.event_date?new Date(ev.event_date).getDate():"—"}</div>
                <div style={{fontSize:10,color:"rgba(255,255,255,.6)",textTransform:"uppercase"}}>{ev.event_date?new Date(ev.event_date).toLocaleDateString("en-AE",{month:"short"}):"—"}</div>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:700,color:"#0F2540",marginBottom:3}}>{ev.title}</div>
                <div style={{fontSize:12,color:"#64748B",marginBottom:4}}>{ev.projects?.name||"—"} · {ev.pp_developers?.name||"—"}</div>
                {ev.venue_name&&<div style={{fontSize:12,color:"#94A3B8"}}>📍 {ev.venue_name}{ev.city?`, ${ev.city}`:""}</div>}
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:6,alignItems:"flex-end"}}>
                <span style={{fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:20,background:"#EEE8F9",color:"#5B3FAA"}}>{ev.event_type}</span>
                {ev.google_maps_url&&<a href={ev.google_maps_url} target="_blank" rel="noreferrer" style={{fontSize:11,color:"#1A5FA8",fontWeight:600,textDecoration:"none"}}>📍 Map</a>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── COMMISSIONS TAB ── */}
      {activeTab==="commissions"&&(
        <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:10}}>
          {commissions.length===0?(
            <div style={{textAlign:"center",padding:"4rem",color:"#A0AEC0"}}>
              <div style={{fontSize:48,marginBottom:12}}>💰</div>
              <div style={{fontSize:15,fontWeight:600,color:"#0F2540",marginBottom:6}}>No commission data yet</div>
              <div style={{fontSize:13}}>Commission structures will appear here as developers publish their rates</div>
            </div>
          ):commissions.map(c=>(
            <div key={c.id} style={{background:"#fff",border:`1px solid ${c.commission_type==="Special Offer"?"#E8C97A":"#E8EDF4"}`,borderRadius:12,padding:"14px 16px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                <div>
                  <div style={{fontSize:14,fontWeight:700,color:"#0F2540"}}>{c.pp_developers?.name||"—"}</div>
                  <div style={{fontSize:12,color:"#64748B"}}>{c.projects?.name||"All Projects"}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:24,fontWeight:800,color:"#1A7F5A"}}>{c.rate_pct}%</div>
                  {c.bonus_pct&&<div style={{fontSize:12,color:"#C9A84C",fontWeight:600}}>+{c.bonus_pct}% bonus</div>}
                </div>
              </div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                <span style={{fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:20,
                  background:c.commission_type==="Special Offer"?"#FDF3DC":"#E6EFF9",
                  color:c.commission_type==="Special Offer"?"#8A6200":"#1A5FA8"}}>
                  {c.commission_type}
                </span>
                {c.valid_until&&<span style={{fontSize:11,color:"#94A3B8"}}>Valid until {new Date(c.valid_until).toLocaleDateString("en-AE",{day:"numeric",month:"short",year:"numeric"})}</span>}
                {c.is_verified&&<span style={{fontSize:11,fontWeight:600,color:"#1A7F5A"}}>✓ Verified</span>}
              </div>
              {c.conditions&&<div style={{fontSize:12,color:"#64748B",marginTop:8,background:"#F7F9FC",borderRadius:6,padding:"6px 10px"}}>{c.conditions}</div>}
            </div>
          ))}
        </div>
      )}

      {/* ── PROJECT DETAIL MODAL ── */}
      {selProject&&(
        <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1200,padding:"1rem"}}>
          <div style={{background:"#fff",borderRadius:16,width:680,maxWidth:"100%",maxHeight:"90vh",overflow:"auto",boxShadow:"0 20px 60px rgba(11,31,58,.25)"}}>
            <div style={{padding:"1.25rem 1.5rem",borderBottom:"1px solid #E8EDF4",display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div>
                <div style={{fontSize:16,fontWeight:800,color:"#0F2540"}}>{selProject.name}</div>
                <div style={{fontSize:12,color:"#64748B",marginTop:2}}>{selProject.pp_developers?.name||selProject.developer||"—"} · {selProject.emirate||"Dubai"}</div>
              </div>
              <button onClick={()=>setSelProject(null)} style={{background:"none",border:"none",fontSize:22,color:"#94A3B8",cursor:"pointer"}}>×</button>
            </div>
            <div style={{padding:"1.25rem 1.5rem",display:"flex",flexDirection:"column",gap:16}}>
              {/* Status row */}
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {[selProject.project_status,selProject.project_type,selProject.emirate].filter(Boolean).map(tag=>{
                  const sc=STATUS_COLORS[tag]||{bg:"#F1F5F9",c:"#64748B"};
                  return <span key={tag} style={{fontSize:12,fontWeight:600,padding:"4px 12px",borderRadius:20,background:sc.bg,color:sc.c}}>{tag}</span>;
                })}
                {selProject.is_pp_verified&&<span style={{fontSize:12,fontWeight:600,padding:"4px 12px",borderRadius:20,background:"#E6F4EE",color:"#1A7F5A"}}>✓ PropPulse Verified</span>}
                {importedSourceIds.has(selProject.id)&&<span style={{fontSize:12,fontWeight:600,padding:"4px 12px",borderRadius:20,background:"#E6EFF9",color:"#1A5FA8"}}>📥 In Your Inventory</span>}
              </div>
              {/* Key stats */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
                {[
                  ["Starting Price",selProject.starting_price?`AED ${(selProject.starting_price/1e6).toFixed(2)}M`:"—"],
                  ["Total Units",selProject.total_units||"—"],
                  ["Handover",selProject.handover_date?new Date(selProject.handover_date).toLocaleDateString("en-AE",{month:"short",year:"numeric"}):"—"],
                  ["Community",selProject.community||"—"],
                  ["Announced",selProject.announcement_date?new Date(selProject.announcement_date).toLocaleDateString("en-AE",{day:"numeric",month:"short",year:"numeric"}):"—"],
                  ["Service Charge",selProject.service_charge_psf?`AED ${selProject.service_charge_psf}/sqft/yr`:"—"],
                ].map(([l,v])=>(
                  <div key={l} style={{background:"#F7F9FC",borderRadius:10,padding:"10px 12px"}}>
                    <div style={{fontSize:10,color:"#94A3B8",textTransform:"uppercase",letterSpacing:".5px",marginBottom:4}}>{l}</div>
                    <div style={{fontSize:13,fontWeight:700,color:"#0F2540"}}>{v}</div>
                  </div>
                ))}
              </div>
              {selProject.description&&<p style={{fontSize:13,color:"#4A5568",lineHeight:1.6,margin:0}}>{selProject.description}</p>}
              {/* Links + IMPORT */}
              <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
                {selProject.google_maps_url&&<a href={selProject.google_maps_url} target="_blank" rel="noreferrer" style={{padding:"8px 16px",borderRadius:8,background:"#E6EFF9",color:"#1A5FA8",fontSize:12,fontWeight:600,textDecoration:"none"}}>📍 View on Maps</a>}
                {(selProject.brochure_url||selProject.brochure_file_url)&&<a href={selProject.brochure_url||selProject.brochure_file_url} target="_blank" rel="noreferrer" style={{padding:"8px 16px",borderRadius:8,background:"#FDF3DC",color:"#8A6200",fontSize:12,fontWeight:600,textDecoration:"none"}}>📄 Download Brochure</a>}
                {canImport && (
                  importedSourceIds.has(selProject.id) ? (
                    <button disabled
                      style={{padding:"8px 18px",borderRadius:8,border:"1.5px solid #CBD5E1",background:"#F1F5F9",color:"#64748B",fontSize:12,fontWeight:600,cursor:"not-allowed",marginLeft:"auto"}}>
                      ✓ Already in Your Inventory
                    </button>
                  ) : (
                    <button onClick={()=>importProject(selProject)} disabled={importing}
                      style={{padding:"8px 18px",borderRadius:8,border:"none",background:importing?"#5B7FAA":"#0F2540",color:"#fff",fontSize:12,fontWeight:700,cursor:importing?"not-allowed":"pointer",marginLeft:"auto",boxShadow:"0 2px 8px rgba(15,37,64,.25)"}}>
                      {importing?"⏳ Importing…":"📥 Import to My Inventory"}
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── VERIFICATION QUEUE MODAL (admin only) ── */}
      {showVerifyQueue && (
        <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1200,padding:"1rem"}}>
          <div style={{background:"#fff",borderRadius:16,width:920,maxWidth:"100%",maxHeight:"90vh",overflow:"auto",boxShadow:"0 20px 60px rgba(11,31,58,.25)"}}>
            <div style={{padding:"1.25rem 1.5rem",borderBottom:"1px solid #E8EDF4",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,background:"#fff",zIndex:1}}>
              <div>
                <div style={{fontSize:15,fontWeight:700,color:"#0F2540"}}>🔍 Verification Queue</div>
                <div style={{fontSize:12,color:"#64748B",marginTop:2}}>Review AI-discovered projects before publishing to the PropPulse catalog</div>
              </div>
              <button onClick={()=>setShowVerifyQueue(false)} style={{background:"none",border:"none",fontSize:22,color:"#94A3B8",cursor:"pointer"}}>×</button>
            </div>
            {unverifiedProjects.length === 0 ? (
              <div style={{padding:"3rem",textAlign:"center",color:"#64748B"}}>
                <div style={{fontSize:40,marginBottom:10}}>✨</div>
                <div style={{fontSize:14,fontWeight:600,color:"#0F2540"}}>Queue is empty</div>
                <div style={{fontSize:12,marginTop:4}}>Run the AI Agent to discover new UAE projects.</div>
              </div>
            ) : (
              <div style={{padding:"1rem 1.5rem"}}>
                {unverifiedProjects.map(proj => {
                  const conf = proj.pp_confidence_score ?? 0;
                  const confColor = conf >= 80 ? "#1A7F5A" : conf >= 60 ? "#A06810" : "#B83232";
                  const confBg    = conf >= 80 ? "#E6F4EE" : conf >= 60 ? "#FDF3DC" : "#FAEAEA";
                  return (
                    <div key={proj.id} style={{border:"1px solid #E8EDF4",borderRadius:12,padding:"14px 16px",marginBottom:10,display:"flex",gap:14,alignItems:"flex-start"}}>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}>
                          <span style={{fontSize:14,fontWeight:700,color:"#0F2540"}}>{proj.name}</span>
                          <span style={{fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:20,background:confBg,color:confColor}}>
                            {conf}% confidence
                          </span>
                          {proj.project_status && (
                            <span style={{fontSize:10,fontWeight:600,padding:"2px 7px",borderRadius:20,background:"#F1F5F9",color:"#475569"}}>{proj.project_status}</span>
                          )}
                        </div>
                        <div style={{fontSize:12,color:"#64748B",marginBottom:6}}>
                          {proj.pp_developers?.name || proj.developer || "—"} · {proj.community || "—"} · {proj.emirate || "—"}
                        </div>
                        {proj.description && (
                          <div style={{fontSize:12,color:"#4A5568",lineHeight:1.5,marginBottom:6}}>{proj.description}</div>
                        )}
                        <div style={{display:"flex",gap:14,fontSize:11,color:"#94A3B8",flexWrap:"wrap"}}>
                          {proj.starting_price && <span>💰 AED {(proj.starting_price/1e6).toFixed(2)}M</span>}
                          {proj.total_units && <span>🏠 {proj.total_units.toLocaleString()} units</span>}
                          {proj.handover_date && <span>📅 {new Date(proj.handover_date).toLocaleDateString("en-AE",{month:"short",year:"numeric"})}</span>}
                          {proj.pp_data_source && <span>🤖 {proj.pp_data_source}</span>}
                        </div>
                      </div>
                      <div style={{display:"flex",flexDirection:"column",gap:6,flexShrink:0}}>
                        <button onClick={()=>verifyProject(proj)} disabled={verifyingId===proj.id}
                          style={{padding:"6px 14px",borderRadius:8,border:"none",background:"#1A7F5A",color:"#fff",fontSize:12,fontWeight:700,cursor:verifyingId===proj.id?"not-allowed":"pointer"}}>
                          {verifyingId===proj.id?"…":"✓ Verify"}
                        </button>
                        <button onClick={()=>rejectProject(proj)} disabled={verifyingId===proj.id}
                          style={{padding:"6px 14px",borderRadius:8,border:"1.5px solid #B83232",background:"#fff",color:"#B83232",fontSize:12,fontWeight:600,cursor:verifyingId===proj.id?"not-allowed":"pointer"}}>
                          ✗ Reject
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ADD DEVELOPER MODAL ── */}
      {showAddDev&&(
        <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1200,padding:"1rem"}}>
          <div style={{background:"#fff",borderRadius:16,width:500,maxWidth:"100%",boxShadow:"0 20px 60px rgba(11,31,58,.25)"}}>
            <div style={{padding:"1.25rem 1.5rem",borderBottom:"1px solid #E8EDF4",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:15,fontWeight:700,color:"#0F2540"}}>🏢 Add Developer</div>
              <button onClick={()=>setShowAddDev(false)} style={{background:"none",border:"none",fontSize:22,color:"#94A3B8",cursor:"pointer"}}>×</button>
            </div>
            <div style={{padding:"1.25rem 1.5rem",display:"flex",flexDirection:"column",gap:12}}>
              {[["Developer Name *","name","text"],["Website","website","text"],["RERA Developer No.","rera_developer_no","text"],["City","city","text"]].map(([label,field,type])=>(
                <div key={field}>
                  <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>{label}</label>
                  <input type={type} value={devForm[field]||""} onChange={e=>setDevForm(f=>({...f,[field]:e.target.value}))} style={{width:"100%",padding:"8px 12px",borderRadius:8,border:"1.5px solid #E2E8F0",fontSize:13,boxSizing:"border-box"}}/>
                </div>
              ))}
              <div style={{display:"flex",gap:10,justifyContent:"flex-end",paddingTop:8,borderTop:"1px solid #F1F5F9"}}>
                <button onClick={()=>setShowAddDev(false)} style={{padding:"8px 18px",borderRadius:8,border:"1.5px solid #E2E8F0",background:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",color:"#475569"}}>Cancel</button>
                <button onClick={saveDeveloper} disabled={saving} style={{padding:"8px 20px",borderRadius:8,border:"none",background:"#0F2540",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>{saving?"Saving…":"Add Developer"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD PROJECT MODAL ── */}
      {showAddProject&&(
        <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1200,padding:"1rem"}}>
          <div style={{background:"#fff",borderRadius:16,width:600,maxWidth:"100%",maxHeight:"90vh",overflow:"auto",boxShadow:"0 20px 60px rgba(11,31,58,.25)"}}>
            <div style={{padding:"1.25rem 1.5rem",borderBottom:"1px solid #E8EDF4",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:15,fontWeight:700,color:"#0F2540"}}>⚡ Add Project to PropPulse</div>
              <button onClick={()=>setShowAddProject(false)} style={{background:"none",border:"none",fontSize:22,color:"#94A3B8",cursor:"pointer"}}>×</button>
            </div>
            <div style={{padding:"1.25rem 1.5rem",display:"flex",flexDirection:"column",gap:12}}>
              <div>
                <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Project Name *</label>
                <input value={projForm.name} onChange={e=>setProjForm(f=>({...f,name:e.target.value}))} style={{width:"100%",padding:"8px 12px",borderRadius:8,border:"1.5px solid #E2E8F0",fontSize:13,boxSizing:"border-box"}} placeholder="e.g. Emaar Creek Harbour"/>
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Developer</label>
                <select value={projForm.pp_developer_id} onChange={e=>setProjForm(f=>({...f,pp_developer_id:e.target.value}))} style={{width:"100%",padding:"8px 12px",borderRadius:8,border:"1.5px solid #E2E8F0",fontSize:13,boxSizing:"border-box"}}>
                  <option value="">Select developer…</option>
                  {developers.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Emirate</label>
                  <select value={projForm.emirate} onChange={e=>setProjForm(f=>({...f,emirate:e.target.value}))} style={{width:"100%",padding:"8px 12px",borderRadius:8,border:"1.5px solid #E2E8F0",fontSize:13,boxSizing:"border-box"}}>
                    {["Dubai","Abu Dhabi","Sharjah","Ajman","RAK","Fujairah","UAQ"].map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Community</label>
                  <input value={projForm.community} onChange={e=>setProjForm(f=>({...f,community:e.target.value}))} style={{width:"100%",padding:"8px 12px",borderRadius:8,border:"1.5px solid #E2E8F0",fontSize:13,boxSizing:"border-box"}} placeholder="e.g. Dubai Hills Estate"/>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Project Type</label>
                  <select value={projForm.project_type} onChange={e=>setProjForm(f=>({...f,project_type:e.target.value}))} style={{width:"100%",padding:"8px 12px",borderRadius:8,border:"1.5px solid #E2E8F0",fontSize:13,boxSizing:"border-box"}}>
                    {["Residential","Commercial","Mixed Use","Villa","Townhouse","Hotel Apartments"].map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Status</label>
                  <select value={projForm.project_status} onChange={e=>setProjForm(f=>({...f,project_status:e.target.value}))} style={{width:"100%",padding:"8px 12px",borderRadius:8,border:"1.5px solid #E2E8F0",fontSize:13,boxSizing:"border-box"}}>
                    {["Announced","Approved","Under Construction","Ready","Completed","On Hold"].map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Announcement Date</label>
                  <input type="date" value={projForm.announcement_date} onChange={e=>setProjForm(f=>({...f,announcement_date:e.target.value}))} style={{width:"100%",padding:"8px 12px",borderRadius:8,border:"1.5px solid #E2E8F0",fontSize:13,boxSizing:"border-box"}}/>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Handover Date</label>
                  <input type="date" value={projForm.handover_date} onChange={e=>setProjForm(f=>({...f,handover_date:e.target.value}))} style={{width:"100%",padding:"8px 12px",borderRadius:8,border:"1.5px solid #E2E8F0",fontSize:13,boxSizing:"border-box"}}/>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Starting Price (AED)</label>
                  <input type="number" value={projForm.starting_price} onChange={e=>setProjForm(f=>({...f,starting_price:e.target.value}))} style={{width:"100%",padding:"8px 12px",borderRadius:8,border:"1.5px solid #E2E8F0",fontSize:13,boxSizing:"border-box"}} placeholder="e.g. 800000"/>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Total Units</label>
                  <input type="number" value={projForm.total_units} onChange={e=>setProjForm(f=>({...f,total_units:e.target.value}))} style={{width:"100%",padding:"8px 12px",borderRadius:8,border:"1.5px solid #E2E8F0",fontSize:13,boxSizing:"border-box"}} placeholder="e.g. 450"/>
                </div>
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Google Maps URL</label>
                <input value={projForm.google_maps_url} onChange={e=>setProjForm(f=>({...f,google_maps_url:e.target.value}))} style={{width:"100%",padding:"8px 12px",borderRadius:8,border:"1.5px solid #E2E8F0",fontSize:13,boxSizing:"border-box"}} placeholder="https://maps.google.com/…"/>
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Description</label>
                <textarea rows={3} value={projForm.description} onChange={e=>setProjForm(f=>({...f,description:e.target.value}))} style={{width:"100%",padding:"8px 12px",borderRadius:8,border:"1.5px solid #E2E8F0",fontSize:13,boxSizing:"border-box",resize:"vertical"}} placeholder="Project overview, key highlights…"/>
              </div>
              <div style={{display:"flex",gap:10,justifyContent:"flex-end",paddingTop:8,borderTop:"1px solid #F1F5F9"}}>
                <button onClick={()=>setShowAddProject(false)} style={{padding:"8px 18px",borderRadius:8,border:"1.5px solid #E2E8F0",background:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",color:"#475569"}}>Cancel</button>
                <button onClick={saveProject} disabled={saving} style={{padding:"8px 20px",borderRadius:8,border:"none",background:"#0F2540",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>{saving?"Saving…":"⚡ Add to PropPulse"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PropPulse;
