/* =====================================================================
 * Phase 2.6 (demo slice) — Role-aware Manager Dashboard
 * Adds a "Team Performance" panel to the existing Dashboard, visible ONLY
 * to managers/admins (can(role,"see_all")). Agents' dashboard unchanged.
 *   - per-agent rows: active deals, pipeline value, won, conversion
 *   - "Analyse Team" button -> navigates to existing Coach page (coach_ai)
 * Safe: .bak backup, idempotent, aborts if an anchor is missing.
 * Run from repo root:  node patch_manager_dashboard.cjs
 * ===================================================================== */
const fs = require("fs");
const path = "src/App.jsx";
if (!fs.existsSync(path)) { console.error("ERROR: run from repo root."); process.exit(1); }
let src = fs.readFileSync(path, "utf8");
const nl = src.includes("\r\n") ? "\r\n" : "\n";

if (src.includes("/* team-performance-panel */")) {
  console.log("Already patched (Team Performance panel present) — no changes made.");
  process.exit(0);
}

// --- Edit 1: add users=[] to the Dashboard signature ---
const sigOld = 'function Dashboard({leads,opps=[],properties,activities,currentUser,meetings=[],followups=[],crmContext="sales",units=[],salePricing=[],leasePricing=[],leases=[],onNavigate=()=>{}}){';
const sigNew = 'function Dashboard({leads,opps=[],properties,activities,currentUser,meetings=[],followups=[],crmContext="sales",units=[],salePricing=[],leasePricing=[],leases=[],users=[],onNavigate=()=>{}}){';
if (!src.includes(sigOld)) { console.error("ERROR: Dashboard signature anchor not found. Aborting."); process.exit(1); }
src = src.replace(sigOld, sigNew);

// --- Edit 2: pass users into the Dashboard render ---
const renderOld = '{tab==="dashboard"   &&<Dashboard leads={leads} opps={opps} properties={properties} activities={activities} currentUser={currentUser} meetings={meetings} followups={followups} crmContext="sales" units={aiUnits} salePricing={aiSalePr} leasePricing={aiLeasePr} onNavigate={(t,filter)=>navigateToTab(t,filter)}/>}';
const renderNew = '{tab==="dashboard"   &&<Dashboard leads={leads} opps={opps} properties={properties} activities={activities} currentUser={currentUser} meetings={meetings} followups={followups} crmContext="sales" units={aiUnits} salePricing={aiSalePr} leasePricing={aiLeasePr} users={users} onNavigate={(t,filter)=>navigateToTab(t,filter)}/>}';
if (!src.includes(renderOld)) { console.error("ERROR: Dashboard render anchor not found. Aborting."); process.exit(1); }
src = src.replace(renderOld, renderNew);

// --- Edit 3: inject Team Performance panel after the Stage Pipeline block ---
// Anchor: the closing of the Stage Pipeline card (Won/Lost summary) right before
// the "Two column" comment. We match that comment and prepend the panel.
const anchor = '      {/* ── Two column: Recent Activity + Quick Actions ─────── */}';
if (!src.includes(anchor)) { console.error("ERROR: 'Two column' anchor not found. Aborting."); process.exit(1); }

const panel = [
'      {/* team-performance-panel — managers/admins only (agents never see this) */}',
'      {can(currentUser.role,"see_all") && (()=>{',
'        const teamUsers = (users||[]).filter(u=>u && u.id);',
'        const rows = teamUsers.map(u=>{',
'          const uo = opps.filter(o=>o.assigned_to===u.id);',
'          const act = uo.filter(o=>!["Closed Won","Closed Lost","Won","Lost"].includes(o.stage)&&o.status==="Active");',
'          const w   = uo.filter(o=>o.stage==="Closed Won"||o.status==="Won");',
'          const pv  = act.reduce((s,o)=>s+(o.budget||0),0);',
'          const cr  = uo.length>0?Math.round(w.length/uo.length*100):0;',
'          return { id:u.id, name:u.full_name||u.name||u.email||"Agent", active:act.length, pipe:pv, won:w.length, conv:cr };',
'        }).filter(r=>r.active>0||r.won>0).sort((a,b)=>b.pipe-a.pipe);',
'        if (rows.length===0) return null;',
'        return (',
'          <div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:12,padding:"16px"}}>',
'            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>',
'              <div style={{fontFamily:"\'Playfair Display\',serif",fontSize:14,fontWeight:700,color:"#0F2540"}}>Team Performance</div>',
'              <button onClick={()=>onNavigate("coach_ai")} style={{fontSize:12,color:"#fff",background:"linear-gradient(135deg,#5B3FAA,#0F766E)",border:"none",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontWeight:700}}>✨ Analyse Team →</button>',
'            </div>',
'            <div style={{display:"grid",gridTemplateColumns:"1.6fr 1fr 1fr 1fr 1fr",gap:8,padding:"0 6px 8px",borderBottom:"1px solid #F0F2F5",fontSize:10,fontWeight:700,color:"#94A3B8",textTransform:"uppercase",letterSpacing:".5px"}}>',
'              <div>Agent</div><div style={{textAlign:"right"}}>Active</div><div style={{textAlign:"right"}}>Pipeline</div><div style={{textAlign:"right"}}>Won</div><div style={{textAlign:"right"}}>Conv.</div>',
'            </div>',
'            {rows.map(r=>(',
'              <div key={r.id} onClick={()=>onNavigate("leads")} style={{display:"grid",gridTemplateColumns:"1.6fr 1fr 1fr 1fr 1fr",gap:8,padding:"9px 6px",borderBottom:"1px solid #F7F9FC",cursor:"pointer",alignItems:"center"}}',
'                onMouseOver={e=>e.currentTarget.style.background="#F7F9FC"} onMouseOut={e=>e.currentTarget.style.background="transparent"}>',
'                <div style={{fontSize:13,fontWeight:700,color:"#0F2540",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.name}</div>',
'                <div style={{textAlign:"right",fontSize:13,fontWeight:600,color:"#0F2540"}}>{r.active}</div>',
'                <div style={{textAlign:"right",fontSize:13,fontWeight:700,color:"#1A5FA8"}}>{fmtM(r.pipe)}</div>',
'                <div style={{textAlign:"right",fontSize:13,fontWeight:600,color:"#1A7F5A"}}>{r.won}</div>',
'                <div style={{textAlign:"right",fontSize:13,fontWeight:600,color:"#64748B"}}>{r.conv}%</div>',
'              </div>',
'            ))}',
'          </div>',
'        );',
'      })()}',
'',
].join(nl);

src = src.replace(anchor, panel + anchor);

fs.writeFileSync(path + ".bak", fs.readFileSync(path, "utf8"));
fs.writeFileSync(path, src);
console.log("OK: Manager Dashboard Team Performance panel added (3 edits).");
console.log("    Backup: src/App.jsx.bak");
console.log("    Next: npm run build");
