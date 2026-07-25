import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase.js";

export default function BlockWorkspace({ block, leads, currentUser, showToast, onClose, onOpenCalculator, onReload }) {
  const [dLatest, setDLatest] = useState(null);
  const [childRows, setChildRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { (async () => {
    const { data } = await supabase.from("block_distributions").select("*").eq("block_deal_id", block.id).order("version", { ascending: false }).limit(1);
    setDLatest(data && data[0] ? data[0] : null);
    const { data: lines } = await supabase.from("block_deal_units").select("*").eq("block_deal_id", block.id).order("created_at");
    const childIds = (lines || []).map(x => x.child_opportunity_id).filter(Boolean);
    let opps = [];
    if (childIds.length) { const { data: od } = await supabase.from("opportunities").select("id, stage, status, current_agreed_price, budget").in("id", childIds); opps = od || []; }
    setChildRows((lines || []).map(ln => ({ line: ln, child: opps.find(o => o.id === ln.child_opportunity_id) || null })));
    setLoading(false);
  })(); }, [block.id]);

  const buyer = leads.find(l => l.id === block.lead_id);
  const fmt = (n) => "AED " + Math.round(Number(n || 0)).toLocaleString();
  const statusColors = { draft:"#94A3B8", negotiating:"#D97706", approved:"#7C3AED", confirmed:"#16A34A", partially_dropped:"#DC2626", completed:"#0F2540", cancelled:"#64748B" };
  const sc = statusColors[block.status] || "#94A3B8";

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1250,padding:"1rem"}}>
      <div style={{background:"#fff",borderRadius:16,width:1020,maxWidth:"97vw",maxHeight:"95vh",overflow:"auto"}}>
        <div style={{padding:"1.25rem 1.5rem",borderBottom:"1px solid #E8EDF4"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
                <span style={{fontSize:17,fontWeight:700,color:"#0F2540"}}>{String.fromCodePoint(0x1F9F1)} {block.title}</span>
                <span style={{fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:12,background:sc+"22",color:sc,textTransform:"uppercase",letterSpacing:".5px"}}>{block.status}</span>
              </div>
              <div style={{fontSize:12,color:"#475569",display:"flex",gap:10,flexWrap:"wrap"}}>
                <span><strong style={{color:"#0F2540"}}>{buyer?.name || "-"}</strong></span>
                {block.developer_name && <span>{String.fromCharCode(183)} {block.developer_name}</span>}
                {dLatest && <span>{String.fromCharCode(183)} D{dLatest.version} {String.fromCharCode(183)} {fmt(dLatest.discount_total)} off</span>}
              </div>
              {block.developer_approved_at && <div style={{fontSize:11,color:"#7C3AED",marginTop:4}}>{String.fromCodePoint(0x2713)} Developer approved {String.fromCharCode(183)} ref {block.developer_approval_ref}{block.approved_by_name ? (" \u00b7 " + block.approved_by_name) : ""}</div>}
            </div>
            <button onClick={onClose} style={{background:"none",border:"none",fontSize:22,color:"#94A3B8",cursor:"pointer"}}>{String.fromCharCode(215)}</button>
          </div>
        </div>
        <div style={{padding:"1.25rem 1.5rem"}}>
          {loading ? <div style={{color:"#94A3B8",fontSize:13}}>Loading...</div> : (
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div style={{fontSize:13,fontWeight:700,color:"#0F2540"}}>Deals in this block ({childRows.length})</div>
                {["draft","negotiating","approved"].includes(block.status) &&
                  <button onClick={()=>{ onClose(); onOpenCalculator(block); }} style={{padding:"7px 14px",borderRadius:8,border:"1px solid #0F2540",background:"#fff",color:"#0F2540",fontSize:12,fontWeight:600,cursor:"pointer"}}>{String.fromCodePoint(0x1F9EE)} Open Calculator</button>}
              </div>
              {(() => { const lsc = { proposed:"#94A3B8", confirmed:"#16A34A", dropped:"#DC2626", re_allocated:"#7C3AED" }; const stc = (s) => s==="Closed Won"?"#0F2540":s==="Closed Lost"?"#DC2626":s==="Reserved"||s==="SPA Requirements"||s==="SPA Signed"?"#16A34A":"#D97706"; return (
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                <thead><tr style={{background:"#F8FAFC",color:"#475569",textAlign:"left"}}>
                  <th style={{padding:"8px 10px"}}>Unit</th>
                  <th style={{padding:"8px 10px"}}>Line</th>
                  <th style={{padding:"8px 10px"}}>Deal stage</th>
                  <th style={{padding:"8px 10px",textAlign:"right"}}>List</th>
                  <th style={{padding:"8px 10px",textAlign:"right"}}>Net (deal price)</th>
                </tr></thead>
                <tbody>{childRows.map(({line, child}) => (
                  <tr key={line.id} style={{borderBottom:"1px solid #F1F5F9",opacity:line.status==="dropped"?0.5:1}}>
                    <td style={{padding:"8px 10px",fontWeight:700,color:"#0F2540"}}>{line.unit_ref}</td>
                    <td style={{padding:"8px 10px"}}><span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:10,background:lsc[line.status]+"22",color:lsc[line.status]}}>{line.status}</span></td>
                    <td style={{padding:"8px 10px"}}>{child ? <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:10,background:stc(child.stage)+"22",color:stc(child.stage)}}>{child.stage}</span> : <span style={{color:"#94A3B8",fontSize:11}}>not born yet</span>}</td>
                    <td style={{padding:"8px 10px",textAlign:"right",color:"#64748B"}}>{fmt(line.list_price)}</td>
                    <td style={{padding:"8px 10px",textAlign:"right",fontWeight:700,color:"#166534"}}>{child ? fmt(child.current_agreed_price || child.budget) : "-"}</td>
                  </tr>))}</tbody>
              </table>); })()}
              <div style={{fontSize:11,color:"#94A3B8",marginTop:10}}>Add/remove units and terms history arrive next. Deals walk their own ladder in Opportunities.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
