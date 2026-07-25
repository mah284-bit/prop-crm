import { useState } from "react";

const PARTICULARS = ["Reservation", "Booking", "DLD Fee", "SPA Fee", "Instalment", "Other"];
const MODES = ["Wire", "Cheque", "Cash", "Card"];

export default function BlockPaymentDialog({ block, childRows, currentUser, showToast, onClose, onLock, payment, priorAllocs }) {
  const isAmend = !!payment;
  const members = (childRows || []).filter(r => r.child && r.line.status !== "dropped");

  const [milestone, setMilestone] = useState(isAmend ? payment.milestone : "Reservation");
  const [amount, setAmount] = useState(isAmend ? String(payment.amount || "") : "");
  const [mode, setMode] = useState(isAmend ? (payment.payment_type || "Wire") : "Wire");
  const [reference, setReference] = useState(isAmend ? (payment.reference || "") : "");
  const [rdate, setRdate] = useState(isAmend ? (payment.received_date || new Date().toISOString().slice(0,10)) : new Date().toISOString().slice(0,10));
  const [vreason, setVreason] = useState(isAmend ? (payment.variance_reason || "") : "");
  const [amendReason, setAmendReason] = useState("");
  const [override, setOverride] = useState(() => {
    const seed = {};
    (priorAllocs || []).forEach(x => { seed[x.opportunity_id] = Number(x.amount) || 0; });
    return seed;
  });
  const [uneven, setUneven] = useState(isAmend && (priorAllocs || []).length > 0);

  const fmt = (n) => "AED " + Math.round(Number(n || 0)).toLocaleString();
  const landed = Number(amount) || 0;
  const n = members.length;

  // THE RULE: money arriving is split EQUALLY across live members.
  const equalShare = n ? Math.floor(landed / n) : 0;
  const equalOf = (i) => n ? (i === n - 1 ? landed - equalShare * (n - 1) : equalShare) : 0;
  const shareOf = (id, i) => uneven ? (Number(override[id]) || 0) : equalOf(i);

  const allocated = members.reduce((s, r, i) => s + shareOf(r.child.id, i), 0);
  const remainder = landed - allocated;
  const balanced = Math.abs(remainder) < 0.5;

  const collectedSoFar = members.reduce((t, r) => t + Number(r.child.reservation_amount || 0), 0);
  const due = Number(block.reservation_expected || 0);
  const outstandingNow = due > 0 ? due - collectedSoFar : 0;
  const outstandingAfter = due > 0 ? due - collectedSoFar - landed : 0;
  const canSave = landed > 0 && balanced && (!uneven || vreason.trim().length > 0) && (!isAmend || amendReason.trim().length > 0);

  const bank = { milestone, amount: landed, expected_total: null, variance_reason: uneven ? (vreason.trim() || null) : null, payment_type: mode, reference, received_date: rdate };
  const rows = () => members.map((r, i) => ({ opportunity_id: r.child.id, amount: shareOf(r.child.id, i) })).filter(x => x.amount > 0);

  const lab = { fontSize:10, fontWeight:700, color:"#475569", textTransform:"uppercase", letterSpacing:".4px", display:"block", marginBottom:3 };
  const inp = { width:"100%", padding:"7px 9px", border:"1px solid #CBD5E1", borderRadius:7, fontSize:12, boxSizing:"border-box" };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1300,padding:"1rem"}}>
      <div style={{background:"#fff",borderRadius:16,width:820,maxWidth:"97vw",maxHeight:"95vh",overflow:"auto"}}>

        <div style={{padding:"1.1rem 1.4rem",borderBottom:"1px solid #E8EDF4",display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            <div style={{fontSize:16,fontWeight:700,color:isAmend?"#B45309":"#0F2540"}}>{isAmend ? "Amend a recorded payment" : "Money received for this block"}</div>
            <div style={{fontSize:11,color:"#64748B",marginTop:3}}>{block.title} {String.fromCharCode(183)} {n} units</div>
            {isAmend && <div style={{fontSize:11,color:"#B45309",marginTop:3,fontWeight:600}}>Correcting {payment.milestone} {String.fromCharCode(183)} {fmt(payment.amount)} {String.fromCharCode(183)} {payment.received_date || "-"}</div>}
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:22,color:"#94A3B8",cursor:"pointer"}}>{String.fromCharCode(215)}</button>
        </div>

        <div style={{padding:"1.1rem 1.4rem"}}>

          {due > 0 ? (
            <div style={{background:outstandingAfter<=0?"#E6F4EE":"#FFFBEB",border:"1px solid "+(outstandingAfter<=0?"#A7D8C3":"#FCD34D"),borderRadius:10,padding:"11px 14px",marginBottom:12,display:"flex",gap:26,alignItems:"center"}}>
              <div><div style={{fontSize:10,fontWeight:700,color:"#64748B",textTransform:"uppercase",letterSpacing:".4px"}}>Reservation due</div><div style={{fontSize:15,fontWeight:800,color:"#0F2540"}}>{fmt(due)}</div></div>
              <div><div style={{fontSize:10,fontWeight:700,color:"#64748B",textTransform:"uppercase",letterSpacing:".4px"}}>Received so far</div><div style={{fontSize:15,fontWeight:800,color:"#16A34A"}}>{fmt(collectedSoFar)}</div></div>
              <div><div style={{fontSize:10,fontWeight:700,color:"#64748B",textTransform:"uppercase",letterSpacing:".4px"}}>{landed>0?"Outstanding after this":"Outstanding"}</div><div style={{fontSize:15,fontWeight:800,color:(landed>0?outstandingAfter:outstandingNow)<=0?"#16A34A":"#B91C1C"}}>{(landed>0?outstandingAfter:outstandingNow)<=0 ? "Nil " + String.fromCodePoint(0x2713) : fmt(landed>0?outstandingAfter:outstandingNow)}</div></div>
              {landed>0 && outstandingAfter>0 && <div style={{marginLeft:"auto",fontSize:11,color:"#B45309",maxWidth:230,textAlign:"right",fontWeight:600}}>Part payment - units stay on hold until the reservation is fully collected.</div>}
              {landed>0 && outstandingAfter<=0 && <div style={{marginLeft:"auto",fontSize:11,color:"#14603F",maxWidth:230,textAlign:"right",fontWeight:600}}>This payment completes the reservation - all {n} units will move to Reserved.</div>}
            </div>
          ) : (
            <div style={{background:"#FEF2F2",border:"1px solid #FCA5A5",borderRadius:10,padding:"10px 14px",marginBottom:12,fontSize:12,color:"#B91C1C",fontWeight:600}}>
              No reservation amount set for this block - the system cannot tell what is still owed. Set Expected to reserve on the block.
            </div>
          )}
          <div style={{background:"#F8FAFC",border:"1px solid #E2E8F0",borderRadius:10,padding:"12px 14px",marginBottom:14}}>
            <div style={{display:"flex",gap:10,flexWrap:"nowrap"}}>
              <div style={{width:125,flexShrink:0}}>
                <label style={lab}>Towards</label>
                <select value={milestone} onChange={e=>setMilestone(e.target.value)} style={inp}>
                  {PARTICULARS.map(x => <option key={x} value={x}>{x}</option>)}
                </select>
              </div>
              <div style={{width:135,flexShrink:0}}>
                <label style={lab}>Amount received</label>
                <input type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0" style={{...inp,fontWeight:700}} />
              </div>
              <div style={{width:105,flexShrink:0}}>
                <label style={lab}>Mode</label>
                <select value={mode} onChange={e=>setMode(e.target.value)} style={inp}>
                  {MODES.map(x => <option key={x} value={x}>{x}</option>)}
                </select>
              </div>
              <div style={{flex:1,minWidth:0}}>
                <label style={lab}>Reference</label>
                <input value={reference} onChange={e=>setReference(e.target.value)} placeholder="TT / cheque no" style={inp} />
              </div>
              <div style={{width:135,flexShrink:0}}>
                <label style={lab}>Received on</label>
                <input type="date" value={rdate} onChange={e=>setRdate(e.target.value)} style={inp} />
              </div>
            </div>
          </div>

          {landed > 0 && !uneven && (
            <div style={{background:"#E6F4EE",border:"1px solid #A7D8C3",borderRadius:10,padding:"11px 14px",marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:"#14603F"}}>Split equally {String.fromCharCode(183)} {fmt(equalShare)} to each of {n} units</div>
                <div style={{fontSize:11,color:"#4B7A63",marginTop:2}}>Every unit receives the same share of this payment.</div>
              </div>
              <button onClick={()=>{ const seed={}; members.forEach((r,i)=>{seed[r.child.id]=equalOf(i);}); setOverride(seed); setUneven(true); }} style={{padding:"6px 12px",borderRadius:8,border:"1px solid #14603F",background:"#fff",color:"#14603F",fontSize:11,fontWeight:600,cursor:"pointer"}}>Split differently</button>
            </div>
          )}

          {uneven && (
            <div style={{background:"#FFFBEB",border:"1px solid #FCD34D",borderRadius:10,padding:"11px 14px",marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:7}}>
                <div style={{fontSize:13,fontWeight:700,color:"#B45309"}}>Uneven split {String.fromCharCode(183)} reason required</div>
                <button onClick={()=>{setUneven(false);setVreason("");}} style={{padding:"5px 11px",borderRadius:8,border:"1px solid #B45309",background:"#fff",color:"#B45309",fontSize:11,fontWeight:600,cursor:"pointer"}}>Back to equal</button>
              </div>
              <input value={vreason} onChange={e=>setVreason(e.target.value)} placeholder="Why is this not split equally? (required)" style={{width:"100%",padding:"7px 9px",border:"1px solid #FCD34D",borderRadius:7,fontSize:12,boxSizing:"border-box"}} />
            </div>
          )}

          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead><tr style={{background:"#F8FAFC",color:"#475569",textAlign:"left"}}>
              <th style={{padding:"8px 10px"}}>Unit</th>
              <th style={{padding:"8px 10px"}}>Deal stage</th>
              <th style={{padding:"8px 10px",textAlign:"right"}}>Received before</th>
              <th style={{padding:"8px 10px",textAlign:"right",width:150}}>This payment</th>
              <th style={{padding:"8px 10px",textAlign:"right"}}>Total after</th>
            </tr></thead>
            <tbody>{members.map(({line, child}, i) => {
              const before = Number(child.reservation_amount || 0);
              const share = shareOf(child.id, i);
              return (
              <tr key={child.id} style={{borderBottom:"1px solid #F1F5F9"}}>
                <td style={{padding:"9px 10px",fontWeight:700,color:"#0F2540"}}>{line.unit_ref}</td>
                <td style={{padding:"9px 10px",color:"#64748B"}}>{child.stage}</td>
                <td style={{padding:"9px 10px",textAlign:"right",color:"#64748B"}}>{before ? fmt(before) : "-"}</td>
                <td style={{padding:"9px 10px",textAlign:"right"}}>
                  {uneven
                    ? <input type="number" value={override[child.id] !== undefined ? override[child.id] : ""} onChange={e=>setOverride(x=>({...x,[child.id]:e.target.value}))} placeholder="0" style={{width:125,padding:"5px 8px",border:"1px solid #FCD34D",borderRadius:6,fontSize:12,textAlign:"right",fontWeight:700}} />
                    : <span style={{fontWeight:700,color:"#16A34A",fontSize:13}}>{share ? fmt(share) : "-"}</span>}
                </td>
                <td style={{padding:"9px 10px",textAlign:"right",fontWeight:700,color:"#0F2540"}}>{fmt(before + share)}</td>
              </tr>); })}</tbody>
          </table>
          {n === 0 && <div style={{color:"#94A3B8",fontSize:12,padding:"10px 0"}}>No live deals in this block yet.</div>}

          {uneven && landed > 0 && (
            <div style={{marginTop:11,padding:"10px 13px",borderRadius:9,background:balanced?"#E6F4EE":"#FEF2F2",border:"1px solid "+(balanced?"#A7D8C3":"#FCA5A5"),display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:12,color:"#475569"}}>Received {fmt(landed)} {String.fromCharCode(183)} distributed {fmt(allocated)}</div>
              <div style={{fontSize:14,fontWeight:800,color:balanced?"#16A34A":"#B91C1C"}}>{balanced ? "Balanced " + String.fromCodePoint(0x2713) : "Unassigned " + fmt(remainder)}</div>
            </div>
          )}

          {isAmend && (
            <div style={{marginTop:11,padding:"10px 13px",borderRadius:9,background:"#FEF3C7",border:"1px solid #FCD34D"}}>
              <div style={{fontSize:12,fontWeight:700,color:"#B45309",marginBottom:5}}>Correcting a recorded payment</div>
              <div style={{fontSize:11,color:"#78716C",marginBottom:6}}>The record is corrected in place - no second payment row. Stages already earned are not pulled back.</div>
              <input value={amendReason} onChange={e=>setAmendReason(e.target.value)} placeholder="Why is this being corrected? (required)" style={{width:"100%",padding:"7px 9px",border:"1px solid #FCD34D",borderRadius:7,fontSize:12,boxSizing:"border-box"}} />
            </div>
          )}

          <div style={{display:"flex",justifyContent:"flex-end",gap:9,marginTop:16}}>
            <button onClick={onClose} style={{padding:"9px 17px",borderRadius:9,border:"1px solid #CBD5E1",background:"#fff",color:"#475569",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancel</button>
            <button disabled={!canSave} onClick={()=>onLock && onLock(bank, amendReason, rows())} style={{padding:"9px 19px",borderRadius:9,border:"none",background:canSave?(isAmend?"#B45309":"#16A34A"):"#CBD5E1",color:"#fff",fontSize:13,fontWeight:700,cursor:canSave?"pointer":"not-allowed"}}>{isAmend ? "Save correction" : "Record payment"}</button>
          </div>

        </div>
      </div>
    </div>
  );
}
