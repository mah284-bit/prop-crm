import { useState, useEffect } from "react";
import { useFreshData } from "../../lib/useFreshData.js";
import { supabase } from "../../lib/supabase.js";
import BlockPaymentDialog from "./BlockPaymentDialog.jsx";
import { lockBlockPayment, amendBlockPayment, acceptShortCollection } from "../../lib/lockBlockPayment.js";
import { canDo } from "../../lib/permissions.js";

export default function BlockWorkspace({ block, leads, currentUser, showToast, onClose, onOpenCalculator, onRecordApproval, onConfirm, onReload }) {
  const [dLatest, setDLatest] = useState(null);
  const [childRows, setChildRows] = useState([]);
  const [wsTab, setWsTab] = useState("children");
  const [dHistory, setDHistory] = useState([]);
  const [blockActivity, setBlockActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPay, setShowPay] = useState(false);
  const [payTick, setPayTick] = useState(0);
  const [locking, setLocking] = useState(false);
  const [payments, setPayments] = useState([]);
  const [payAllocs, setPayAllocs] = useState([]);
  const [editPay, setEditPay] = useState(null);
  const [expEdit, setExpEdit] = useState(false);
  const [expVal, setExpVal] = useState(block.reservation_expected != null ? String(block.reservation_expected) : "");
  const [expSaving, setExpSaving] = useState(false);
  const [showAccept, setShowAccept] = useState(false);
  const [acceptReason, setAcceptReason] = useState("");
  const [accepting, setAccepting] = useState(false);
  const doAccept = async () => {
    if (accepting) return;
    setAccepting(true);
    const live = childRows.filter(r => r.child && r.line.status !== "dropped");
    const res = await acceptShortCollection({ block, members: live, currentUser, reason: acceptReason, due: dueAmt, collected });
    setAccepting(false);
    if (res.ok) {
      showToast("Collection closed - " + res.moved + " units moved to Reserved", "success");
      setShowAccept(false); setAcceptReason(""); setPayTick(t => t + 1); onReload && onReload();
    } else { showToast(res.error || (res.failed || []).join("; "), "error"); }
  };
  const collected = childRows.reduce((t, r) => t + Number(r.child?.reservation_amount || 0), 0);
  const dueAmt = Number(block.reservation_expected || 0);
  const outstanding = dueAmt - collected;
  const collectionClosed = ["satisfied","accepted_short"].includes(block.collection_status);
  const saveExpected = async () => {
    setExpSaving(true);
    const v = expVal === "" ? null : Number(expVal);
    const { error } = await supabase.from("block_deals").update({ reservation_expected: v }).eq("id", block.id);
    setExpSaving(false);
    if (error) { showToast(error.message, "error"); return; }
    block.reservation_expected = v;
    setExpEdit(false);
    showToast("Reservation amount set", "success");
    setPayTick(t => t + 1);
    onReload && onReload();
  };

  useFreshData(() => { (async () => {
    const { data } = await supabase.from("block_distributions").select("*").eq("block_deal_id", block.id).order("version", { ascending: false }).limit(1);
    setDLatest(data && data[0] ? data[0] : null);
    const { data: lines } = await supabase.from("block_deal_units").select("*").eq("block_deal_id", block.id).order("created_at");
    const childIds = (lines || []).map(x => x.child_opportunity_id).filter(Boolean);
    let opps = [];
    if (childIds.length) { const { data: od } = await supabase.from("opportunities").select("id, stage, status, current_agreed_price, budget, reservation_amount, reservation_date, lead_id, unit_id, current_payment_plan_preset, current_dld_payer, current_dld_split_pct").in("id", childIds); opps = od || []; }
    setChildRows((lines || []).map(ln => ({ line: ln, child: opps.find(o => o.id === ln.child_opportunity_id) || null })));
    const { data: allD } = await supabase.from("block_distributions").select("*").eq("block_deal_id", block.id).order("version", { ascending: false });
    setDHistory(allD || []);
    if (childIds.length) {
      const { data: acts } = await supabase.from("activities").select("*").in("opportunity_id", childIds).in("activity_subtype", ["block_adoption","block_reprice","block_conversion"]).order("created_at", { ascending: false });
      setBlockActivity(acts || []);
    }
    const { data: pays } = await supabase.from("block_payments").select("*").eq("block_deal_id", block.id).order("created_at", { ascending: false });
    setPayments(pays || []);
    const payIds = (pays || []).map(x => x.id);
    if (payIds.length) { const { data: pa } = await supabase.from("block_payment_allocations").select("*").in("block_payment_id", payIds); setPayAllocs(pa || []); } else { setPayAllocs([]); }
    setLoading(false);
  })(); }, [block.id, payTick], { hold: showPay || showAccept || locking });

  const buyer = leads.find(l => l.id === block.lead_id);
  const fmt = (n) => "AED " + Math.round(Number(n || 0)).toLocaleString();
  const statusColors = { draft:"#94A3B8", negotiating:"#D97706", approved:"#7C3AED", confirmed:"#16A34A", partially_dropped:"#DC2626", completed:"#0F2540", cancelled:"#64748B" };
  const sc = statusColors[block.status] || "#94A3B8";

  return (
    <>
    <style>{"@keyframes blkPulse{0%,100%{opacity:1}50%{opacity:.45}}"}</style>
    <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1250,padding:"1rem"}}>
      <div style={{background:"#fff",borderRadius:16,width:1020,maxWidth:"97vw",maxHeight:"95vh",overflow:"auto"}}>
        <div style={{padding:"1.25rem 1.5rem",borderBottom:"1px solid #E8EDF4"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
                <span style={{fontSize:17,fontWeight:700,color:"#0F2540"}}>{String.fromCodePoint(0x1F9F1)} {block.title}</span>
                <span style={{fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:12,background:sc+"22",color:sc,textTransform:"uppercase",letterSpacing:".5px"}}>{block.status}</span>
              </div>
              <div style={{fontSize:12,color:"#475569",display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                <strong style={{color:"#0F2540"}}>{buyer?.name || "-"}</strong>
                {block.developer_name && <span>{String.fromCharCode(183)} {block.developer_name}</span>}
              </div>
              {dLatest && (
                <div style={{fontSize:12,color:"#475569",marginTop:4,display:"flex",gap:14,flexWrap:"wrap"}}>
                  <span>List <strong style={{color:"#0F2540"}}>{fmt(dLatest.block_total)}</strong></span>
                  <span>Discount <strong style={{color:"#B45309"}}>{fmt(dLatest.discount_total)}</strong>{dLatest.block_total ? " (" + (Number(dLatest.discount_total)/Number(dLatest.block_total)*100).toFixed(2) + "%)" : ""}</span>
                  <span>Deal value <strong style={{color:"#166534"}}>{fmt(Number(dLatest.block_total) - Number(dLatest.discount_total))}</strong></span>
                  <span style={{color:"#94A3B8"}}>D{dLatest.version}</span>
                </div>
              )}
              {dueAmt > 0 && (
                <div style={{fontSize:12,marginTop:5,display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                  <span style={{fontWeight:700,color:outstanding>0.5?"#B91C1C":"#166534"}}>
                    Reservation Received {fmt(collected)} of {fmt(dueAmt)}
                  </span>
                  {outstanding > 0.5
                    ? <span style={{fontSize:11,fontWeight:700,padding:"2px 9px",borderRadius:10,background:"#FEF2F2",color:"#B91C1C",border:"1px solid #FCA5A5",animation:"blkPulse 2.4s ease-in-out infinite"}}>Outstanding {fmt(outstanding)} {String.fromCharCode(183)} RESERVATION of units held until collected fully</span>
                    : <span style={{fontSize:11,fontWeight:700,padding:"2px 9px",borderRadius:10,background:"#E6F4EE",color:"#166534",border:"1px solid #A7D8C3"}}>Collected in full {String.fromCodePoint(0x2713)}</span>}
                </div>
              )}
              {block.developer_approved_at && <div style={{fontSize:11,color:"#7C3AED",marginTop:4}}>{String.fromCodePoint(0x2713)} Developer approved {String.fromCharCode(183)} ref {block.developer_approval_ref}{block.approved_by_name ? (" \u00b7 " + block.approved_by_name) : ""}</div>}
            </div>
            <div style={{display:"flex",gap:12,alignItems:"center"}}>
              {dueAmt > 0 && outstanding > 0.5 && canDo(currentUser, "amend_payment") && (
                <button onClick={()=>setShowAccept(true)} style={{fontSize:12,fontWeight:700,padding:"7px 14px",borderRadius:8,border:"1px solid #B45309",background:"#fff",color:"#B45309",cursor:"pointer"}}>Accept shortfall {String.fromCharCode(38)} close</button>
              )}
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:9,fontWeight:700,color:"#64748B",textTransform:"uppercase",letterSpacing:".4px"}}>Reservation Amt Expected</div>
                {expEdit ? (
                  <div style={{display:"flex",gap:5,alignItems:"center",marginTop:2}}>
                    <input type="number" autoFocus value={expVal} onChange={e=>setExpVal(e.target.value)} placeholder="e.g. 75000" style={{width:110,padding:"4px 7px",border:"1px solid #CBD5E1",borderRadius:6,fontSize:12,textAlign:"right"}} />
                    <button disabled={expSaving} onClick={saveExpected} style={{padding:"4px 9px",borderRadius:6,border:"none",background:"#16A34A",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer"}}>Save</button>
                    <button onClick={()=>{setExpEdit(false);setExpVal(block.reservation_expected!=null?String(block.reservation_expected):"");}} style={{padding:"4px 7px",borderRadius:6,border:"1px solid #CBD5E1",background:"#fff",color:"#64748B",fontSize:11,cursor:"pointer"}}>Cancel</button>
                  </div>
                ) : (
                  <div onClick={()=>setExpEdit(true)} style={{cursor:"pointer",fontSize:14,fontWeight:800,color:block.reservation_expected?"#0F2540":"#B91C1C",marginTop:1}}>
                    {block.reservation_expected ? fmt(block.reservation_expected) : "Not set - click to set"}
                  </div>
                )}
              </div>
              {block.status==="negotiating" && <button onClick={()=>onRecordApproval && onRecordApproval(block)} style={{fontSize:12,fontWeight:700,padding:"7px 14px",borderRadius:8,border:"1px solid #B45309",background:"#fff",color:"#B45309",cursor:"pointer"}}>Record developer approval</button>}
              {block.status==="approved" && <button onClick={()=>onConfirm && onConfirm(block)} style={{fontSize:12,fontWeight:700,padding:"7px 14px",borderRadius:8,border:"none",background:"#16A34A",color:"#fff",cursor:"pointer"}}>Confirm block</button>}
              {["confirmed","partially_dropped","completed"].includes(block.status) && (collectionClosed
                ? <span style={{fontSize:12,fontWeight:700,padding:"7px 14px",borderRadius:8,background:"#E6F4EE",color:"#166534",border:"1px solid #A7D8C3"}}>Reservation settled {String.fromCodePoint(0x2713)}{block.collection_status==="accepted_short" ? " (shortfall accepted)" : ""}</span>
                : <button onClick={()=>setShowPay(true)} style={{fontSize:12,fontWeight:700,padding:"7px 14px",borderRadius:8,border:"none",background:"#0F2540",color:"#fff",cursor:"pointer"}}>Record payment</button>)}
              <button onClick={onClose} style={{background:"none",border:"none",fontSize:22,color:"#94A3B8",cursor:"pointer"}}>{String.fromCharCode(215)}</button>
            </div>
          </div>
        </div>
        <div style={{padding:"1.25rem 1.5rem"}}>
          {loading ? <div style={{color:"#94A3B8",fontSize:13}}>Loading...</div> : (
            <div>
              <div style={{display:"flex",gap:4,marginBottom:14,borderBottom:"1px solid #E8EDF4"}}>
                {[["children","Deals"],["payments","Payments (" + payments.length + ")"],["terms","Terms history"],["activity","Activity"]].map(([id,label]) => (
                  <button key={id} onClick={()=>setWsTab(id)} style={{padding:"7px 14px",border:"none",borderBottom:wsTab===id?"2px solid #0F2540":"2px solid transparent",background:"none",color:wsTab===id?"#0F2540":"#94A3B8",fontSize:12,fontWeight:700,cursor:"pointer"}}>{label}</button>
                ))}
              </div>
              {wsTab==="children" && (<>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div style={{fontSize:13,fontWeight:700,color:"#0F2540"}}>Deals in this block ({childRows.length})</div>
                {["draft","negotiating","approved","confirmed","partially_dropped"].includes(block.status) &&
                  <button onClick={()=>{ if (collectionClosed) { showToast("Reservation settled and locked. Price changes after money is collected need a manager ceremony (arrives with the ledger phase).", "error"); return; } onClose(); onOpenCalculator(block); }} style={{padding:"7px 14px",borderRadius:8,border:"1px solid #0F2540",background:"#fff",color:"#0F2540",fontSize:12,fontWeight:600,cursor:"pointer"}}>{String.fromCodePoint(0x1F9EE)} Open Calculator</button>}
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
              {wsTab==="payments" && (
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:"#0F2540",marginBottom:10}}>Block payments received ({payments.length})</div>
                  {payments.length===0 ? <div style={{color:"#94A3B8",fontSize:12}}>No block payment recorded yet.</div> :
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                    <thead><tr style={{background:"#F8FAFC",color:"#475569",textAlign:"left"}}>
                      <th style={{padding:"8px 10px"}}>Particular</th><th style={{padding:"8px 10px"}}>Received on</th>
                      <th style={{padding:"8px 10px"}}>Mode / ref</th>
                      <th style={{padding:"8px 10px",textAlign:"right"}}>Received</th>
                      <th style={{padding:"8px 10px",textAlign:"right"}}>Variance</th>
                      <th style={{padding:"8px 10px",textAlign:"right"}}>Members</th>
                      <th style={{padding:"8px 10px"}}></th>
                    </tr></thead>
                    <tbody>{payments.map(pm => { const va = pm.expected_total != null ? (Number(pm.amount)||0) - (Number(pm.expected_total)||0) : 0; const n = payAllocs.filter(x=>x.block_payment_id===pm.id).length; return (
                      <tr key={pm.id} style={{borderBottom:"1px solid #F1F5F9"}}>
                        <td style={{padding:"8px 10px",fontWeight:700,color:"#0F2540"}}>{pm.milestone}{pm.status==="amended" && <span style={{marginLeft:6,fontSize:9,fontWeight:700,padding:"1px 6px",borderRadius:8,background:"#FEF3C7",color:"#B45309"}}>AMENDED</span>}</td>
                        <td style={{padding:"8px 10px",color:"#64748B"}}>{pm.received_date || "-"}</td>
                        <td style={{padding:"8px 10px",color:"#64748B"}}>{(pm.payment_type||"-")}{pm.reference ? " " + String.fromCharCode(183) + " " + pm.reference : ""}</td>
                        <td style={{padding:"8px 10px",textAlign:"right",fontWeight:700,color:"#166534"}}>{fmt(pm.amount)}</td>
                        <td style={{padding:"8px 10px",textAlign:"right",fontWeight:700,color:va===0?"#94A3B8":"#B45309"}}>{va===0 ? "-" : fmt(va)}</td>
                        <td style={{padding:"8px 10px",textAlign:"right",color:"#64748B"}}>{n}</td>
                        <td style={{padding:"8px 10px",textAlign:"right"}}>{collectionClosed && pm.milestone==="Reservation" ? <span title={"accepted by manager"} style={{fontSize:10,fontWeight:700,color:"#166534"}}>settled {String.fromCodePoint(0x2713)}</span> : (canDo(currentUser, "amend_payment") ? <button onClick={()=>{setEditPay(pm);setShowPay(true);}} style={{padding:"5px 11px",borderRadius:7,border:"1px solid #B45309",background:"#fff",color:"#B45309",fontSize:11,fontWeight:600,cursor:"pointer"}}>Amend</button> : <span style={{fontSize:10,color:"#94A3B8"}}>manager only</span>)}</td>
                      </tr>); })}</tbody>
                  </table>}
                  {payments.some(p=>p.notes) && <div style={{fontSize:11,color:"#94A3B8",marginTop:9}}>Amendment reasons are stored on each payment and logged on every affected deal.</div>}
                </div>
              )}
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
      {showAccept && (
        <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1350,padding:"1rem"}}>
          <div style={{background:"#fff",borderRadius:14,width:520,maxWidth:"95vw",padding:"1.2rem 1.4rem"}}>
            <div style={{fontSize:15,fontWeight:700,color:"#B45309",marginBottom:4}}>Accept the shortfall and close collection</div>
            <div style={{fontSize:12,color:"#64748B",marginBottom:12}}>{block.title}</div>
            <div style={{display:"flex",gap:22,padding:"11px 13px",background:"#FFFBEB",border:"1px solid #FCD34D",borderRadius:9,marginBottom:12}}>
              <div><div style={{fontSize:9,fontWeight:700,color:"#64748B",textTransform:"uppercase"}}>Due</div><div style={{fontSize:14,fontWeight:800,color:"#0F2540"}}>{fmt(dueAmt)}</div></div>
              <div><div style={{fontSize:9,fontWeight:700,color:"#64748B",textTransform:"uppercase"}}>Collected</div><div style={{fontSize:14,fontWeight:800,color:"#16A34A"}}>{fmt(collected)}</div></div>
              <div><div style={{fontSize:9,fontWeight:700,color:"#64748B",textTransform:"uppercase"}}>Shortfall</div><div style={{fontSize:14,fontWeight:800,color:"#B91C1C"}}>{fmt(outstanding)}</div></div>
            </div>
            <div style={{fontSize:11,color:"#78716C",marginBottom:8}}>The shortfall is NOT recorded as received - the block keeps an honest record of what actually arrived. Accepting releases all units to Reserved on your authority.</div>
            <input value={acceptReason} onChange={e=>setAcceptReason(e.target.value)} placeholder="Why is this shortfall accepted? (required)" style={{width:"100%",padding:"8px 10px",border:"1px solid #FCD34D",borderRadius:7,fontSize:12,boxSizing:"border-box",marginBottom:12}} />
            <div style={{display:"flex",justifyContent:"flex-end",gap:9}}>
              <button onClick={()=>{setShowAccept(false);setAcceptReason("");}} style={{padding:"8px 16px",borderRadius:8,border:"1px solid #CBD5E1",background:"#fff",color:"#475569",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancel</button>
              <button disabled={!acceptReason.trim()||accepting} onClick={doAccept} style={{padding:"8px 18px",borderRadius:8,border:"none",background:acceptReason.trim()?"#B45309":"#CBD5E1",color:"#fff",fontSize:13,fontWeight:700,cursor:acceptReason.trim()?"pointer":"not-allowed"}}>Accept and close</button>
            </div>
          </div>
        </div>
      )}
      {showPay && <BlockPaymentDialog key={editPay ? editPay.id : "new"} payment={editPay} priorAllocs={editPay ? payAllocs.filter(x=>x.block_payment_id===editPay.id) : []} block={block} childRows={childRows} currentUser={currentUser} showToast={showToast} onClose={()=>{setShowPay(false);setEditPay(null);}} onLock={async (bank, amendReason, allocs)=>{ if (locking) return; setLocking(true); const live = childRows.filter(r=>r.child && r.line.status!=="dropped"); const res = editPay ? await amendBlockPayment({ block, payment: editPay, bank, allocations: allocs, members: live, priorAllocs: payAllocs.filter(x=>x.block_payment_id===editPay.id), currentUser, reason: amendReason }) : await lockBlockPayment({ block, bank, allocations: allocs, members: live, currentUser }); setLocking(false); if (res.ok) { showToast(bank.milestone + " AED " + Math.round(Number(bank.amount)||0).toLocaleString() + " distributed to " + res.served + " deals", "success"); setShowPay(false); setEditPay(null); setPayTick(t=>t+1); onReload && onReload(); } else { showToast("Partial: " + res.served + " served. " + (res.failed||[]).join("; "), "error"); setPayTick(t=>t+1); } }} />}
    </div>
    </>
  );
}
