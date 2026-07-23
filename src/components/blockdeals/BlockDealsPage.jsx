import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase.js";

export default function BlockDealsPage({ currentUser, showToast, onOpenOpp }) {
  const [blocks, setBlocks] = useState([]);
  const [leads, setLeads] = useState([]);
  const [units, setUnits] = useState([]);
  const [pricing, setPricing] = useState([]);
  const [developers, setDevelopers] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ lead_id: "", title: "", developer_name: "", discount_mode: "pct", discount_value: "" });
  const [lines, setLines] = useState([]);
  const [unitPick, setUnitPick] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const cid = currentUser.company_id;
    const [b, l, u, sp, dv] = await Promise.all([
      supabase.from("block_deals").select("*, block_deal_units(*)").eq("company_id", cid).order("created_at", { ascending: false }),
      supabase.from("leads").select("id, name, phone").eq("company_id", cid).order("name"),
      supabase.from("project_units").select("id, unit_ref, project_id, status").eq("status", "Available").order("unit_ref"),
      supabase.from("unit_sale_pricing").select("*"),
      supabase.from("pp_developers").select("id, name").order("name"),
    ]);
    setBlocks(b.data || []); setLeads(l.data || []); setUnits(u.data || []); setPricing(sp.data || []); setDevelopers(dv.data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const listPriceOf = (u) => { const sp = pricing.find(s => s.unit_id === u?.id); return Number(sp?.asking_price ?? sp?.list_price ?? sp?.price ?? 0); };

  const addLine = () => {
    setUnitPick(current => {
      const u = units.find(x => x.id === current);
      if (!u) { showToast("Pick a unit first", "error"); return current; }
      setLines(ls => ls.some(x => x.unit_id === u.id) ? ls : [...ls, { unit_id: u.id, unit_ref: u.unit_ref, list_price: listPriceOf(u) }]);
      return "";
    });
  };

  const removeLine = (uid) => setLines(ls => ls.filter(x => x.unit_id !== uid));

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
            <div key={b.id} style={{border:"1px solid #E2E8F0",borderRadius:10,padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",background:"#fff"}}>
              <div>
                <div style={{fontWeight:700,fontSize:14,color:"#0F2540"}}>{b.title}</div>
                <div style={{fontSize:12,color:"#64748B",marginTop:2}}>{buyer?.name || "-"} {String.fromCharCode(183)} {ls.length} units {String.fromCharCode(183)} {fmt(tot)} {String.fromCharCode(183)} {Number(b.discount_value) > 0 ? (b.discount_mode==="pct" ? (b.discount_value+"% off") : (fmt(b.discount_value)+" off")) : "terms pending"}</div>
              </div>
              <span style={{fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:12,background:(statusColors[b.status]||"#94A3B8")+"22",color:statusColors[b.status]||"#94A3B8",textTransform:"uppercase",letterSpacing:".5px"}}>{b.status}</span>
            </div>); })}
        </div>
      )}
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
                <select value={unitPick} onChange={e=>{console.log("PICK fired:", e.target.value); setUnitPick(e.target.value);}} style={{flex:1,padding:"8px 10px",border:"1px solid #D1D5DB",borderRadius:7,fontSize:13}}><option value="">Pick a unit...</option>{units.filter(u=>!lines.some(x=>x.unit_id===u.id)).map(u=><option key={u.id} value={u.id}>{u.unit_ref} - {fmt(listPriceOf(u))}</option>)}</select>
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
