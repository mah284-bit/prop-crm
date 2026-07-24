import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase.js";
import DistributionCalculator from "./DistributionCalculator.jsx";

export default function BlockDealsPage({ currentUser, showToast, onOpenOpp }) {
  const [blocks, setBlocks] = useState([]);
  const [leads, setLeads] = useState([]);
  const [units, setUnits] = useState([]);
  const [pricing, setPricing] = useState([]);
  const [developers, setDevelopers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [claimedUnitIds, setClaimedUnitIds] = useState(new Set());
  const [softClaims, setSoftClaims] = useState({});
  const [showCreate, setShowCreate] = useState(false);
  const [calcBlock, setCalcBlock] = useState(null);
  const [form, setForm] = useState({ lead_id: "", title: "", developer_name: "", discount_mode: "pct", discount_value: "" });
  const [lines, setLines] = useState([]);
  const [unitPick, setUnitPick] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const cid = currentUser.company_id;
    const [b, l, u, sp, dv, pj, bl, ao] = await Promise.all([
      supabase.from("block_deals").select("*, block_deal_units(*)").eq("company_id", cid).order("created_at", { ascending: false }),
      supabase.from("leads").select("id, name, phone").eq("company_id", cid).order("name"),
      supabase.from("project_units").select("id, unit_ref, project_id, status").eq("status", "Available").order("unit_ref"),
      supabase.from("unit_sale_pricing").select("*"),
      supabase.from("pp_developers").select("id, name").order("name"),
      supabase.from("projects").select("id, developer"),
      supabase.from("block_deal_units").select("unit_id, status, block_deal_id").neq("status", "dropped"),
      supabase.from("opportunities").select("unit_id, stage, status").eq("status", "Active").not("unit_id", "is", null),
    ]);
    setBlocks(b.data || []); setLeads(l.data || []); setUnits(u.data || []); setPricing(sp.data || []); setDevelopers(dv.data || []); setProjects(pj.data || []);
    const blockById = {}; (b.data || []).forEach(x => { blockById[x.id] = x; });
    const hard = new Set((ao.data || []).map(x => x.unit_id).filter(Boolean));
    const soft = {};
    (bl.data || []).forEach(x => {
      const parent = blockById[x.block_deal_id];
      if (parent && x.unit_id) {
        if (parent.status === "confirmed" || parent.status === "completed") hard.add(x.unit_id);
        else if (parent.status !== "cancelled") soft[x.unit_id] = parent.title;
      }
    });
    setClaimedUnitIds(hard); setSoftClaims(soft);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const listPriceOf = (u) => { const sp = pricing.find(s => s.unit_id === u?.id); return Number(sp?.asking_price ?? sp?.list_price ?? sp?.price ?? 0); };

  const addLine = () => {
    setUnitPick(current => {
      const u = units.find(x => x.id === current);
      if (!u) { showToast("Pick a unit first", "error"); return current; }
      if (claimedUnitIds.has(u.id)) { showToast(u.unit_ref + " is committed - active deal or confirmed block", "error"); return current; }
      if (softClaims[u.id]) {
        const other = blocks.find(x => x.title === softClaims[u.id]);
        if (other && other.lead_id === form.lead_id) { showToast(u.unit_ref + " is already in this buyer" + String.fromCharCode(39) + "s block " + softClaims[u.id], "error"); return current; }
        showToast("Note: " + u.unit_ref + " is also being negotiated in " + softClaims[u.id] + " - first to commit wins", "info");
      }
      setLines(ls => ls.some(x => x.unit_id === u.id) ? ls : [...ls, { unit_id: u.id, unit_ref: u.unit_ref, list_price: listPriceOf(u) }]);
      return "";
    });
  };

  const removeLine = (uid) => setLines(ls => ls.filter(x => x.unit_id !== uid));

  const confirmBlock = async (b) => {
    const { data: dists } = await supabase.from("block_distributions").select("*").eq("block_deal_id", b.id).order("version", { ascending: false }).limit(1);
    const dl = dists && dists[0];
    if (!dl) { showToast("Lock a distribution first - confirmation births deals at D_latest prices", "error"); return; }
    const buyer = leads.find(x => x.id === b.lead_id);
    if (!buyer) { showToast("Buyer lead not found", "error"); return; }
    const activeLines = (b.block_deal_units || []).filter(x => x.status === "proposed");
    if (activeLines.length === 0) { showToast("No proposed lines to confirm", "error"); return; }
    if (!window.confirm("Confirm block " + b.title + "? This births " + activeLines.length + " deals at D" + dl.version + " prices and claims the units. This is the commitment moment.")) return;
    let born = 0;
    for (const ln of activeLines) {
      const alloc = (dl.allocations || []).find(x => x.unit_id === ln.unit_id);
      const net = alloc ? alloc.net_price : Number(ln.list_price || 0);
      const { data: opp, error: oe } = await supabase.from("opportunities").insert({
        company_id: currentUser.company_id, lead_id: b.lead_id,
        title: ln.unit_ref + " \u2014 " + buyer.name + " (block)",
        stage: "Offer Accepted", status: "Active", unit_id: ln.unit_id,
        budget: net, current_agreed_price: net,
        block_deal_id: b.id, assigned_to: currentUser.id,
        notes: "Born from block deal " + b.title + " at D" + dl.version + (alloc ? " (" + (alloc.mode === "pct" ? alloc.value + "% off" : "AED " + Number(alloc.discount).toLocaleString() + " off") + ")" : ""),
        stage_updated_at: new Date().toISOString(),
      }).select().single();
      if (oe) { showToast(ln.unit_ref + " birth failed: " + oe.message, "error"); continue; }
      await supabase.from("project_units").update({ status: "Booked" }).eq("id", ln.unit_id);
      await supabase.from("activities").insert({ opportunity_id: opp.id, lead_id: b.lead_id, company_id: currentUser.company_id, type: "Note", status: "completed", user_id: currentUser.id, user_name: currentUser.full_name || null, lead_name: buyer.name, stage_at_event: "Offer Accepted", activity_subtype: "block_conversion", note: "BLOCK CONVERSION: " + b.title + " confirmed at D" + dl.version + " \u00b7 " + ln.unit_ref + " \u00b7 net AED " + Number(net).toLocaleString() });
      await supabase.from("block_deal_units").update({ status: "confirmed", child_opportunity_id: opp.id, updated_at: new Date().toISOString() }).eq("id", ln.id);
      born++;
    }
    if (born === 0) { showToast("No deals were born - block NOT confirmed. Check the errors above.", "error"); load(); return; }
    await supabase.from("block_deals").update({ status: "confirmed", updated_at: new Date().toISOString() }).eq("id", b.id);
    showToast(born + " deals born at Offer Accepted from " + b.title + " - Terms Pending, units claimed", "success");
    load();
  };

  const saveBlock = async () => {
    if (!form.lead_id) { showToast("Pick the buyer", "error"); return; }
    if (!form.title.trim()) { showToast("Title is required", "error"); return; }
    if (lines.length < 2) { showToast("A block needs at least 2 units", "error"); return; }
    const cid = currentUser.company_id;
    const { data: bd, error } = await supabase.from("block_deals").insert({
      company_id: cid, lead_id: form.lead_id, title: form.title.trim(),
      developer_name: form.developer_name || null,
      
      status: "draft", created_by: currentUser.id,
    }).select().single();
    if (error) { showToast(error.message, "error"); return; }
    const rows = lines.map(x => ({ company_id: cid, block_deal_id: bd.id, unit_id: x.unit_id, unit_ref: x.unit_ref, list_price: x.list_price, status: "proposed" }));
    const { error: e2 } = await supabase.from("block_deal_units").insert(rows);
    if (e2) { showToast(e2.message, "error"); return; }
    showToast("Block deal created (draft)", "success");
    setShowCreate(false); setForm({ lead_id: "", title: "", developer_name: "", discount_mode: "pct", discount_value: "" }); setLines([]);
    load();
  };

  /* BLOCK DEALS RENDER */
  const fmt = (n) => "AED " + Number(n || 0).toLocaleString();
  const linesTotal = lines.reduce((s, x) => s + Number(x.list_price || 0), 0);
  const statusColors = { draft:"#94A3B8", negotiating:"#D97706", confirmed:"#16A34A", partially_dropped:"#DC2626", completed:"#0F2540", cancelled:"#64748B" };

  return (
    <div style={{padding:"1.5rem"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div>
          <h2 style={{margin:0,fontSize:20,fontWeight:700,color:"#0F2540"}}>{String.fromCodePoint(0x1F9F1)} Block Deals</h2>
          <div style={{fontSize:12,color:"#64748B"}}>One buyer, many units, master terms - per-unit truth below</div>
        </div>
        <button onClick={()=>setShowCreate(true)} style={{padding:"9px 18px",borderRadius:8,border:"none",background:"#0F2540",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>+ New Block</button>
      </div>
      {loading ? <div style={{color:"#94A3B8",fontSize:13}}>Loading...</div> : blocks.length === 0 ? (
        <div style={{padding:"3rem",textAlign:"center",color:"#94A3B8",border:"2px dashed #E2E8F0",borderRadius:12,fontSize:13}}>No block deals yet. A block = one buyer taking 2+ units on master terms.</div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {blocks.map(b => { const ls = b.block_deal_units || []; const tot = ls.reduce((s,x)=>s+Number(x.list_price||0),0); const buyer = leads.find(l=>l.id===b.lead_id); return (
            <div key={b.id} onClick={()=>{ if(b.status==="draft"||b.status==="negotiating") setCalcBlock(b); }} style={{border:"1px solid #E2E8F0",borderRadius:10,padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",background:"#fff",cursor:(b.status==="draft"||b.status==="negotiating")?"pointer":"default"}}>
              <div>
                <div style={{fontWeight:700,fontSize:14,color:"#0F2540"}}>{b.title}</div>
                <div style={{fontSize:12,color:"#64748B",marginTop:2}}>{buyer?.name || "-"} {String.fromCharCode(183)} {ls.length} units {String.fromCharCode(183)} {fmt(tot)} {String.fromCharCode(183)} {Number(b.discount_value) > 0 ? (b.discount_mode==="pct" ? (b.discount_value+"% off") : (fmt(b.discount_value)+" off")) : "terms pending"}</div>
              </div>
              <span style={{display:"inline-flex",gap:8,alignItems:"center"}}>{b.status==="negotiating" && <button onClick={(e)=>{ e.stopPropagation(); confirmBlock(b); }} style={{fontSize:11,fontWeight:700,padding:"5px 12px",borderRadius:7,border:"none",background:"#16A34A",color:"#fff",cursor:"pointer"}}>Confirm block</button>}<span style={{fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:12,background:(statusColors[b.status]||"#94A3B8")+"22",color:statusColors[b.status]||"#94A3B8",textTransform:"uppercase",letterSpacing:".5px"}}>{b.status}</span></span>
            </div>); })}
        </div>
      )}
      {calcBlock && <DistributionCalculator block={calcBlock} currentUser={currentUser} showToast={showToast} onClose={()=>setCalcBlock(null)} onLocked={load}/>}
      {showCreate && (
        <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1200,padding:"1rem"}}>
          <div style={{background:"#fff",borderRadius:16,width:760,maxWidth:"96vw",maxHeight:"94vh",overflow:"auto",padding:"1.25rem 1.5rem"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div style={{fontSize:15,fontWeight:700,color:"#0F2540"}}>{String.fromCodePoint(0x1F9F1)} New Block Deal</div>
              <button onClick={()=>setShowCreate(false)} style={{background:"none",border:"none",fontSize:22,color:"#94A3B8",cursor:"pointer"}}>{String.fromCharCode(215)}</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
              <div><label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:4}}>BUYER *</label>
                <select value={form.lead_id} onChange={e=>setForm(f=>({...f,lead_id:e.target.value}))} style={{width:"100%",padding:"8px 10px",border:"1px solid #D1D5DB",borderRadius:7,fontSize:13}}><option value="">Select buyer...</option>{leads.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></div>
              <div><label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:4}}>TITLE *</label>
                <input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="e.g. Khalid - Grove floor 9 block" style={{width:"100%",padding:"8px 10px",border:"1px solid #D1D5DB",borderRadius:7,fontSize:13}}/></div>
              <div><label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:4}}>DEVELOPER</label>
                <select value={form.developer_name} onChange={e=>setForm(f=>({...f,developer_name:e.target.value}))} style={{width:"100%",padding:"8px 10px",border:"1px solid #D1D5DB",borderRadius:7,fontSize:13}}><option value="">Select developer...</option>{developers.map(d=><option key={d.id} value={d.name}>{d.name}</option>)}</select></div>
              <div style={{fontSize:11,color:"#94A3B8",display:"flex",alignItems:"center"}}>Discount is set later in the distribution calculator - per unit, where it belongs.</div>
            </div>
            <div style={{border:"1px solid #E8EDF4",borderRadius:10,padding:"10px 14px",marginBottom:12}}>
              <div style={{fontSize:12,fontWeight:700,color:"#0F2540",marginBottom:8}}>UNIT LINES ({lines.length}) {String.fromCharCode(183)} {fmt(linesTotal)}</div>
              <div style={{display:"flex",gap:8,marginBottom:10}}>
                <select value={unitPick} onChange={e=>{console.log("PICK fired:", e.target.value); setUnitPick(e.target.value);}} style={{flex:1,padding:"8px 10px",border:"1px solid #D1D5DB",borderRadius:7,fontSize:13}}><option value="">Pick a unit...</option>{units.filter(u=>!claimedUnitIds.has(u.id)).filter(u=>!lines.some(x=>x.unit_id===u.id)).filter(u=>{ if(!form.developer_name) return true; const pr = projects.find(x=>x.id===u.project_id); const norm = s => String(s||"").toLowerCase().split(" ")[0]; return pr && norm(pr.developer) === norm(form.developer_name); }).map(u=><option key={u.id} value={u.id}>{u.unit_ref} - {fmt(listPriceOf(u))}{softClaims[u.id] ? (" (in block: " + softClaims[u.id] + ")") : ""}</option>)}</select>
                <button onClick={addLine} style={{padding:"8px 16px",borderRadius:7,border:"1px solid #0F2540",background:"#fff",color:"#0F2540",fontSize:13,fontWeight:600,cursor:"pointer"}}>+ Add</button>
              </div>
              {lines.map(x => (
                <div key={x.unit_id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 4px",borderBottom:"1px dashed #F1F5F9",fontSize:13}}>
                  <span style={{fontWeight:600,color:"#0F2540"}}>{x.unit_ref}</span>
                  <span style={{color:"#475569"}}>{fmt(x.list_price)}</span>
                  <button onClick={()=>removeLine(x.unit_id)} style={{background:"none",border:"none",color:"#DC2626",cursor:"pointer",fontSize:12}}>remove</button>
                </div>))}
            </div>
            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              <button onClick={()=>setShowCreate(false)} style={{padding:"8px 18px",borderRadius:8,border:"1.5px solid #E2E8F0",background:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",color:"#475569"}}>Cancel</button>
              <button onClick={saveBlock} style={{padding:"8px 18px",borderRadius:8,border:"none",background:"#0F2540",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>Create Block (draft)</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
