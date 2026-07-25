import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase.js";

export default function BlockWorkspace({ block, leads, currentUser, showToast, onClose, onOpenCalculator, onRecordApproval, onConfirm, onReload }) {
  const [dLatest, setDLatest] = useState(null);
  const [childRows, setChildRows] = useState([]);
  const [wsTab, setWsTab] = useState("children");
  const [dHistory, setDHistory] = useState([]);
  const [blockActivity, setBlockActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { (async () => {
    const { data } = await supabase.from("block_distributions").select("*").eq("block_deal_id", block.id).order("version", { ascending: false }).limit(1);
    setDLatest(data && data[0] ? data[0] : null);
    const { data: lines } = await supabase.from("block_deal_units").select("*").eq("block_deal_id", block.id).order("created_at");
    const childIds = (lines || []).map(x => x.child_opportunity_id).filter(Boolean);
    let opps = [];
    if (childIds.length) { const { data: od } = await supabase.from("opportunities").select("id, stage, status, current_agreed_price, budget").in("id", childIds); opps = od || []; }
    setChildRows((lines || []).map(ln => ({ line: ln, child: opps.find(o => o.id === ln.child_opportunity_id) || null })));
    const { data: allD } = await supabase.from("block_distributions").select("*").eq("block_deal_id", block.id).order("version", { ascending: false });
    setDHistory(allD || []);
    if (childIds.length) {
      const { data: acts } = await supabase.from("activities").select("*").in("opportunity_id", childIds).in("activity_subtype", ["block_adoption","block_reprice","block_conversion"]).order("created_at", { ascending: false });
      setBlockActivity(acts || []);
    }
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
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              {block.status==="negotiating" && <button onClick={()=>onRecordApproval && onRecordApproval(block)} style={{fontSize:12,fontWeight:700,padding:"7px 14px",borderRadius:8,border:"1px solid #B45309",background:"#fff",color:"#B45309",cursor:"pointer"}}>Record developer approval</button>}
              {block.status==="approved" && <button onClick={()=>onConfirm && onConfirm(block)} style={{fontSize:12,fontWeight:700,padding:"7px 14px",borderRadius:8,border:"none",background:"#16A34A",color:"#fff",cursor:"pointer"}}>Confirm block</button>}
              <button onClick={onClose} style={{background:"none",border:"none",fontSize:22,color:"#94A3B8",cursor:"pointer"}}>{String.fromCharCode(215)}</button>
            </div>
          </div>
        </div>
        <div style={{padding:"1.25rem 1.5rem"}}>
          {loading ? <div style={{color:"#94A3B8",fontSize:13}}>Loading...</div> : (
            <div>
              <div style={{display:"flex",gap:4,marginBottom:14,borderBottom:"1px solid #E8EDF4"}}>
                {[["children","Deals"],["terms","Terms history"],["activity","Activity"]].map(([id,label]) => (
                  <button key={id} onClick={()=>setWsTab(id)} style={{padding:"7px 14px",border:"none",borderBottom:wsTab===id?"2px solid #0F2540":"2px solid transparent",background:"none",color:wsTab===id?"#0F2540":"#94A3B8",fontSize:12,fontWeight:700,cursor:"pointer"}}>{label}</button>
                ))}
              </div>
              {wsTab==="children" && (<>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div style={{fontSize:13,fontWeight:700,color:"#0F2540"}}>Deals in this block ({childRows.length})</div>
                {["draft","negotiating","approved","confirmed","partially_dropped"].includes(block.status) &&
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
              <div style={{fontSize:11,color:"#94A3B8",marginTop:10}}>Deals walk their own ladder in Opportunities. Add/remove arrives with drop-out flows.</div>
              </>)}
              {wsTab==="terms" && (
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:"#0F2540",marginBottom:10}}>Distribution versions ({dHistory.length})</div>
                  {dHistory.length===0 ? <div style={{color:"#94A3B8",fontSize:12}}>No distribution locked yet.</div> :
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                    <thead><tr style={{background:"#F8FAFC",color:"#475569",textAlign:"left"}}>
                      <th style={{padding:"8px 10px"}}>Version</th><th style={{padding:"8px 10px"}}>Locked</th>
                      <th style={{padding:"8px 10px",textAlign:"right"}}>Block list</th><th style={{padding:"8px 10px",textAlign:"right"}}>Discount</th>
                    </tr></thead>
                    <tbody>{dHistory.map((d,i) => (
                      <tr key={d.id} style={{borderBottom:"1px solid #F1F5F9"}}>
                        <td style={{padding:"8px 10px",fontWeight:700,color:"#0F2540"}}>D{d.version}{i===0 && <span style={{marginLeft:6,fontSize:9,fontWeight:700,padding:"1px 6px",borderRadius:8,background:"#E6F4EE",color:"#1A7F5A"}}>LATEST</span>}</td>
                        <td style={{padding:"8px 10px",color:"#64748B"}}>{d.locked_at ? new Date(d.locked_at).toLocaleString("en-GB") : "-"}</td>
                        <td style={{padding:"8px 10px",textAlign:"right",color:"#64748B"}}>{fmt(d.block_total)}</td>
                        <td style={{padding:"8px 10px",textAlign:"right",fontWeight:700,color:"#B45309"}}>{fmt(d.discount_total)}</td>
                      </tr>))}</tbody>
                  </table>}
                </div>
              )}
              {wsTab==="activity" && (
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:"#0F2540",marginBottom:10}}>Block events ({blockActivity.length})</div>
                  {blockActivity.length===0 ? <div style={{color:"#94A3B8",fontSize:12}}>No block-level events yet.</div> :
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>{blockActivity.map(a => (
                    <div key={a.id} style={{borderLeft:"3px solid #7C3AED",padding:"6px 12px",background:"#FAFAFC",borderRadius:"0 8px 8px 0"}}>
                      <div style={{fontSize:12,color:"#0F2540"}}>{a.note}</div>
                      <div style={{fontSize:10,color:"#94A3B8",marginTop:2}}>{a.created_at ? new Date(a.created_at).toLocaleString("en-GB") : ""}</div>
                    </div>))}</div>}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
