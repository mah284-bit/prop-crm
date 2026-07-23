import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase.js";

export default function DistributionCalculator({ block, currentUser, showToast, onClose, onLocked }) {
  const [lines, setLines] = useState([]);
  const [blockMode, setBlockMode] = useState("pct");
  const [blockValue, setBlockValue] = useState("");
  const [dLatest, setDLatest] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { (async () => {
    const { data: units } = await supabase.from("block_deal_units").select("*").eq("block_deal_id", block.id).neq("status", "dropped").order("created_at");
    const { data: dists } = await supabase.from("block_distributions").select("*").eq("block_deal_id", block.id).order("version", { ascending: false }).limit(1);
    const last = dists && dists[0];
    setDLatest(last || null);
    const allocOf = (uid) => { const a = (last?.allocations || []).find(x => x.unit_id === uid); return a || null; };
    setLines((units || []).map(u => { const a = allocOf(u.unit_id); return {
      unit_id: u.unit_id, unit_ref: u.unit_ref, list_price: Number(u.list_price || 0),
      mode: a ? a.mode : "pct", value: a ? String(a.value) : "",
    }; }));
    setLoading(false);
  })(); }, [block.id]);

  const discOf = (x) => {
    const v = Number(x.value) || 0;
    return x.mode === "pct" ? x.list_price * v / 100 : v;
  };
  const netOf = (x) => x.list_price - discOf(x);
  const totList = lines.reduce((s, x) => s + x.list_price, 0);
  const totDisc = lines.reduce((s, x) => s + discOf(x), 0);
  const totNet = totList - totDisc;
  const effPct = totList > 0 ? (totDisc / totList * 100) : 0;

  const blockTarget = () => {
    const v = Number(blockValue) || 0;
    return blockMode === "pct" ? totList * v / 100 : v;
  };
  const remainder = blockTarget() - totDisc;
  const hasBlockTarget = Number(blockValue) > 0;

  const applyProRata = () => {
    if (!hasBlockTarget) { showToast("Enter the block discount first", "error"); return; }
    if (blockMode === "pct") {
      const v = Number(blockValue) || 0;
      setLines(ls => ls.map(x => ({ ...x, mode: "pct", value: String(v) })));
    } else {
      const target = Number(blockValue) || 0;
      setLines(ls => { const tl = ls.reduce((s,x)=>s+x.list_price,0) || 1; return ls.map(x => ({ ...x, mode: "flat", value: String(Math.round(target * x.list_price / tl)) })); });
    }
  };

  const updLine = (uid, patch) => setLines(ls => ls.map(x => x.unit_id === uid ? { ...x, ...patch } : x));

  const lockDistribution = async () => {
    if (lines.length === 0) { showToast("No lines to distribute", "error"); return; }
    if (lines.some(x => Number(x.value) < 0)) { showToast("Negative discounts not allowed", "error"); return; }
    if (hasBlockTarget && Math.abs(remainder) > 1) { showToast("Remainder must reach zero before locking (AED " + Math.round(remainder).toLocaleString() + " unallocated)", "error"); return; }
    const version = (dLatest?.version || 0) + 1;
    const allocations = lines.map(x => ({ unit_id: x.unit_id, unit_ref: x.unit_ref, list_price: x.list_price, mode: x.mode, value: Number(x.value) || 0, discount: Math.round(discOf(x) * 100) / 100, net_price: Math.round(netOf(x) * 100) / 100 }));
    const { error } = await supabase.from("block_distributions").insert({
      company_id: currentUser.company_id, block_deal_id: block.id, version,
      allocations, block_total: totList, discount_total: Math.round(totDisc * 100) / 100,
      locked_at: new Date().toISOString(), created_by: currentUser.id,
    });
    if (error) { showToast(error.message, "error"); return; }
    const { error: e2 } = await supabase.from("block_deals").update({
      discount_mode: hasBlockTarget ? blockMode : "flat",
      discount_value: hasBlockTarget ? (Number(blockValue) || 0) : Math.round(totDisc * 100) / 100,
      status: "negotiating", updated_at: new Date().toISOString(),
    }).eq("id", block.id);
    if (e2) { showToast(e2.message, "error"); return; }
    showToast("Distribution D" + version + " locked", "success");
    onLocked?.();
    onClose?.();
  };

  const fmt = (n) => "AED " + Math.round(Number(n || 0)).toLocaleString();

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1300,padding:"1rem"}}>
      <div style={{background:"#fff",borderRadius:16,width:980,maxWidth:"97vw",maxHeight:"95vh",overflow:"auto",padding:"1.25rem 1.5rem"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
          <div style={{fontSize:15,fontWeight:700,color:"#0F2540"}}>{String.fromCodePoint(0x1F9EE)} Distribution Calculator {String.fromCharCode(183)} {block.title}</div>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:22,color:"#94A3B8",cursor:"pointer"}}>{String.fromCharCode(215)}</button>
        </div>
        <div style={{fontSize:11,color:"#64748B",marginBottom:12}}>{dLatest ? ("Current: D" + dLatest.version + " locked " + new Date(dLatest.locked_at).toLocaleDateString("en-GB")) : "No distribution yet - this lock creates D1"}{String.fromCharCode(46)} Every lock is a new version - the record shows how each number arrived.</div>
        <div style={{display:"flex",gap:10,alignItems:"flex-end",background:"#F8FAFC",border:"1px solid #E2E8F0",borderRadius:10,padding:"10px 14px",marginBottom:12}}>
          <div>
            <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:4}}>TOP-DOWN: BLOCK DISCOUNT</label>
            <div style={{display:"flex",gap:6}}>
              <select value={blockMode} onChange={e=>setBlockMode(e.target.value)} style={{padding:"7px 8px",border:"1px solid #D1D5DB",borderRadius:7,fontSize:13}}><option value="pct">%</option><option value="flat">AED</option></select>
              <input type="number" value={blockValue} onChange={e=>setBlockValue(e.target.value)} placeholder="0" style={{width:130,padding:"7px 10px",border:"1px solid #D1D5DB",borderRadius:7,fontSize:13}}/>
            </div>
          </div>
          <button onClick={applyProRata} style={{padding:"8px 14px",borderRadius:7,border:"1px solid #0F2540",background:"#fff",color:"#0F2540",fontSize:12,fontWeight:700,cursor:"pointer"}}>Suggest pro-rata {String.fromCharCode(8595)}</button>
          <div style={{flex:1,fontSize:11,color:"#94A3B8",paddingBottom:6}}>...or work bottom-up: edit any line below, block totals recompute live.</div>
        </div>
        {loading ? <div style={{color:"#94A3B8",fontSize:13}}>Loading lines...</div> : (
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,marginBottom:12}}>
          <thead><tr style={{background:"#F8FAFC",color:"#475569"}}>
            <th style={{padding:"7px 8px",textAlign:"left"}}>Unit</th>
            <th style={{padding:"7px 8px",textAlign:"right"}}>List Price</th>
            <th style={{padding:"7px 8px",textAlign:"center"}}>Mode</th>
            <th style={{padding:"7px 8px",textAlign:"right"}}>Value</th>
            <th style={{padding:"7px 8px",textAlign:"right"}}>Discount</th>
            <th style={{padding:"7px 8px",textAlign:"right"}}>Net Price</th>
          </tr></thead>
          <tbody>{lines.map(x => (
            <tr key={x.unit_id} style={{borderBottom:"1px dashed #F1F5F9"}}>
              <td style={{padding:"7px 8px",fontWeight:700,color:"#0F2540"}}>{x.unit_ref}</td>
              <td style={{padding:"7px 8px",textAlign:"right",color:"#475569"}}>{fmt(x.list_price)}</td>
              <td style={{padding:"7px 8px",textAlign:"center"}}><select value={x.mode} onChange={e=>updLine(x.unit_id,{mode:e.target.value})} style={{padding:"4px 6px",border:"1px solid #D1D5DB",borderRadius:6,fontSize:11}}><option value="pct">%</option><option value="flat">AED</option></select></td>
              <td style={{padding:"7px 8px",textAlign:"right"}}><input type="number" value={x.value} onChange={e=>updLine(x.unit_id,{value:e.target.value})} placeholder="0" style={{width:110,padding:"5px 8px",border:"1px solid #D1D5DB",borderRadius:6,fontSize:12,textAlign:"right"}}/></td>
              <td style={{padding:"7px 8px",textAlign:"right",color:"#B45309",fontWeight:600}}>{fmt(discOf(x))}</td>
              <td style={{padding:"7px 8px",textAlign:"right",color:"#166534",fontWeight:700}}>{fmt(netOf(x))}</td>
            </tr>))}</tbody>
        </table>)}
        <div style={{display:"flex",gap:18,alignItems:"center",background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:10,padding:"10px 16px",marginBottom:14,fontSize:12}}>
          <div><span style={{color:"#92400E",fontWeight:600}}>Block list:</span> <strong>{fmt(totList)}</strong></div>
          <div><span style={{color:"#92400E",fontWeight:600}}>Discount:</span> <strong style={{color:"#B45309"}}>{fmt(totDisc)}</strong> ({effPct.toFixed(2)}%)</div>
          <div><span style={{color:"#92400E",fontWeight:600}}>Net:</span> <strong style={{color:"#166534"}}>{fmt(totNet)}</strong></div>
          {hasBlockTarget && <div style={{marginLeft:"auto",fontWeight:700,color:Math.abs(remainder)<=1?"#166534":"#DC2626"}}>{Math.abs(remainder)<=1 ? (String.fromCodePoint(0x2705) + " Reconciled") : ("Remainder: " + fmt(remainder))}</div>}
        </div>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
          <button onClick={onClose} style={{padding:"8px 18px",borderRadius:8,border:"1.5px solid #E2E8F0",background:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",color:"#475569"}}>Cancel</button>
          <button onClick={lockDistribution} style={{padding:"8px 18px",borderRadius:8,border:"none",background:"#0F2540",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>{String.fromCodePoint(0x1F512)} Lock Distribution D{(dLatest?.version || 0) + 1}</button>
        </div>
      </div>
    </div>
  );
}
