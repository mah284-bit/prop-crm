import { useState } from "react";

const PARTICULARS = ["Reservation", "Booking", "DLD Fee", "SPA Fee", "Instalment", "Other"];
// Day 80: the dialog's own labels mapped to dealBill's keys, so the proportional split knows
// WHICH outstanding to divide by. One map, here, rather than a second vocabulary.
const BILL_KEY = { "Instalment": "initial_advance", "SPA Fee": "spa_fee", "DLD Fee": "dld_fee", "Booking": "booking_fee", "Other": "other_fees" };
const MODES = ["Wire", "Cheque", "Cash", "Card"];

export default function BlockPaymentDialog({ block, childRows, currentUser, showToast, onClose, onLock, payment, priorAllocs, blockBill, priorPayments, priorAllocsAll }) {
  // Day 80: which particular each prior payment was against, so per-unit "received before"
  // counts only allocations from payments of the SAME particular.
  const allocMilestone = {};
  (priorPayments || []).forEach(x => { allocMilestone[x.id] = x.milestone; });
  const isAmend = !!payment;
  const members = (childRows || []).filter(r => r.child && r.line.status !== "dropped");

  const [milestone, setMilestone] = useState(isAmend ? payment.milestone : "Reservation");
  const [amount, setAmount] = useState(isAmend ? String(payment.amount || "") : "");
  const [mode, setMode] = useState(isAmend ? (payment.payment_type || "Wire") : "Wire");
  const [payNotes, setPayNotes] = useState(isAmend ? (payment.notes || "") : "");
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
  // ───────────────────────────────────────────────────────────────────────────
  // Day 80 (BL-2): THE SPLIT BASIS DEPENDS ON THE PARTICULAR.
  // RESERVATION is a FIXED FEE per unit, so it splits EQUALLY - unchanged, certified Day 74.
  // POST-RESERVATION particulars are not equal: a first instalment is a PERCENTAGE of each
  // unit's own price, and DLD is a percentage too. Splitting those equally would over-credit
  // small units and under-credit large ones, and each unit's ledger would be wrong at SPA even
  // though the block total looked right.
  // So they split PROPORTIONALLY TO WHAT EACH UNIT STILL OWES on that particular - the founder's
  // own Cut-7 rule ("allocation basis = outstanding per child"), applied beyond the reservation.
  // The broker still enters ONE number; the app does the arithmetic and shows it before saving.
  // "Split differently" remains available with a mandatory reason, as ever.
  const isReservation = milestone === "Reservation";
  // Each child's OUTSTANDING on the chosen particular, derived from the block bill the Workspace
  // already computes. Keyed by child id so the proportional split can divide by it.
  const perUnitBill = (() => {
    const key = BILL_KEY[milestone];
    if (!key || !blockBill) return {};
    const map = {};
    (blockBill.per || []).forEach(u => {
      const row = u.bill && u.bill[key];
      if (u.child_id) map[u.child_id] = row ? (row.waived ? 0 : Number(row.expected || 0)) : 0;
    });
    return map;
  })();
  const owedOf = (r) => {
    if (isReservation) return 0;
    const b = (perUnitBill || {})[r.child.id];
    return b ? Math.max(0, Number(b) || 0) : 0;
  };
  const owedTotal = members.reduce((t, r) => t + owedOf(r), 0);
  const propOf = (r, i) => {
    if (!owedTotal) return equalOf(i);
    if (i === n - 1) return landed - members.slice(0, n - 1).reduce((t, x) => t + Math.floor(landed * owedOf(x) / owedTotal), 0);
    return Math.floor(landed * owedOf(r) / owedTotal);
  };
  const autoOf = (r, i) => isReservation ? equalOf(i) : propOf(r, i);
  const shareOf = (id, i) => uneven ? (Number(override[id]) || 0) : autoOf(members[i], i);

  const allocated = members.reduce((s, r, i) => s + shareOf(r.child.id, i), 0);
  const remainder = landed - allocated;
  const balanced = Math.abs(remainder) < 0.5;

  // Day 80: THE STRIP MUST FOLLOW THE PARTICULAR. It previously showed the RESERVATION's bill and
  // collections whatever was being recorded - so an instalment payment read "Bill (instalment)
  // 75,000, collected 75,000, nil to collect" while the instalment bill was 1,041,575 and nothing
  // had been collected. The label changed; the numbers did not. A broker could not tell what was
  // expected or received for the thing in front of him.
  const BILL_TOT = { "Instalment": "initial", "SPA Fee": "spa", "DLD Fee": "dld", "Oqood Fee": "oqood" };
  const priorFor = (ms) => (priorPayments || []).filter(x => x.milestone === ms && (!payment || x.id !== payment.id))
    .reduce((t, x) => t + (Number(x.amount) || 0), 0);
  const isRes0 = milestone === "Reservation";
  const collectedSoFar = isRes0
    ? members.reduce((t, r) => t + Number(r.child.reservation_amount || 0), 0)
    : priorFor(milestone);
  const due = isRes0
    ? Number(block.reservation_expected || 0)
    : Number((blockBill && blockBill.tot && blockBill.tot[BILL_TOT[milestone]]) || 0);
  const outstandingNow = due > 0 ? due - collectedSoFar : 0;
  const outstandingAfter = due > 0 ? due - collectedSoFar - landed : 0;
  const canSave = landed > 0 && balanced && (!uneven || vreason.trim().length > 0) && (!isAmend || amendReason.trim().length > 0);

  const bank = { milestone, amount: landed, expected_total: null, variance_reason: uneven ? (vreason.trim() || null) : null, payment_type: mode, reference, received_date: rdate, notes: payNotes.trim() || null };
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
              <div><div style={{fontSize:10,fontWeight:700,color:"#64748B",textTransform:"uppercase",letterSpacing:".4px"}}>{isReservation ? "Bill (reservation)" : "Bill (" + milestone.toLowerCase() + ")"}</div><div style={{fontSize:15,fontWeight:800,color:"#0F2540"}}>{fmt(due)}</div></div>
              <div><div style={{fontSize:10,fontWeight:700,color:"#64748B",textTransform:"uppercase",letterSpacing:".4px"}}>Collected</div><div style={{fontSize:15,fontWeight:800,color:"#16A34A"}}>{fmt(collectedSoFar)}</div></div>
              <div><div style={{fontSize:10,fontWeight:700,color:"#64748B",textTransform:"uppercase",letterSpacing:".4px"}}>{landed>0?"To collect after this":"To collect"}</div><div style={{fontSize:15,fontWeight:800,color:(landed>0?outstandingAfter:outstandingNow)<=0?"#16A34A":"#B91C1C"}}>{(landed>0?outstandingAfter:outstandingNow)<=0 ? "Nil " + String.fromCodePoint(0x2713) : fmt(landed>0?outstandingAfter:outstandingNow)}</div></div>
              {landed>0 && outstandingAfter>0 && <div style={{marginLeft:"auto",fontSize:11,color:"#B45309",maxWidth:230,textAlign:"right",fontWeight:600}}>{isReservation ? "Part payment - units stay on hold until the reservation is fully collected." : "Part payment - the balance on this particular stays outstanding."}</div>}
              {isReservation && landed>0 && outstandingAfter<=0 && <div style={{marginLeft:"auto",fontSize:11,color:"#14603F",maxWidth:230,textAlign:"right",fontWeight:600}}>This payment completes the reservation - all {n} units will move to Reserved.</div>}
            </div>
          ) : (
            <div style={{background:"#FEF2F2",border:"1px solid #FCA5A5",borderRadius:10,padding:"10px 14px",marginBottom:12,fontSize:12,color:"#B91C1C",fontWeight:600}}>
              No reservation amount set for this block - the system cannot tell what is still owed. Set Expected to reserve on the block.
            </div>
          )}
          <div style={{background:"#F8FAFC",border:"1px solid #E2E8F0",borderRadius:10,padding:"12px 14px",marginBottom:14}}>
            <div style={{display:"flex",gap:10,flexWrap:"nowrap"}}>
              <div style={{width:125,flexShrink:0}}>
                <label style={lab}>Particulars</label>
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

          <div style={{marginBottom:12}}>
            <label style={lab}>Notes</label>
            <input value={payNotes} onChange={e=>setPayNotes(e.target.value)} placeholder="Any conditions on this payment..." style={inp} />
          </div>
          {landed > 0 && !uneven && (
            <div style={{background:"#E6F4EE",border:"1px solid #A7D8C3",borderRadius:10,padding:"11px 14px",marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:"#14603F"}}>{isReservation ? ("Split equally " + String.fromCharCode(183) + " " + fmt(equalShare) + " to each of " + n + " units") : ("Split by what each unit still owes " + String.fromCharCode(183) + " " + milestone.toLowerCase())}</div>
                <div style={{fontSize:11,color:"#4B7A63",marginTop:2}}>{isReservation ? "Every unit receives the same share of this payment." : "The reservation is a fixed fee, so it splits equally. This is not - each unit owes a share of its own price, so the payment follows what each still owes."}</div>
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
              {!isReservation && <th style={{padding:"8px 10px",textAlign:"right"}}>Owes</th>}
              <th style={{padding:"8px 10px",textAlign:"right"}}>Received before</th>
              <th style={{padding:"8px 10px",textAlign:"right",width:150}}>This payment</th>
              <th style={{padding:"8px 10px",textAlign:"right"}}>{isReservation ? "Total after" : "Still owes"}</th>
            </tr></thead>
            <tbody>{members.map(({line, child}, i) => {
              // Day 80: "received before" must mean RECEIVED ON THIS PARTICULAR. It used to read
              // reservation_amount whatever was being recorded, so an instalment row showed the
              // reservation as already received and added the two together into a "total after"
              // that meant nothing. Reservation keeps its own column set; everything else shows
              // what the unit OWES on this particular and what it STILL owes after this payment.
              const before = isReservation
                ? Number(child.reservation_amount || 0)
                : (priorAllocsAll || []).filter(x => x.opportunity_id === child.id && (allocMilestone[x.block_payment_id] === milestone))
                    .reduce((t, x) => t + (Number(x.amount) || 0), 0);
              const owes = isReservation ? 0 : Number((perUnitBill || {})[child.id] || 0);
              const share = shareOf(child.id, i);
              return (
              <tr key={child.id} style={{borderBottom:"1px solid #F1F5F9"}}>
                <td style={{padding:"9px 10px",fontWeight:700,color:"#0F2540"}}>{line.unit_ref}</td>
                <td style={{padding:"9px 10px",color:"#64748B"}}>{child.stage}</td>
                {!isReservation && <td style={{padding:"9px 10px",textAlign:"right",color:"#64748B"}}>{owes ? fmt(owes) : "-"}</td>}
                <td style={{padding:"9px 10px",textAlign:"right",color:"#64748B"}}>{before ? fmt(before) : "-"}</td>
                <td style={{padding:"9px 10px",textAlign:"right"}}>
                  {uneven
                    ? <input type="number" value={override[child.id] !== undefined ? override[child.id] : ""} onChange={e=>setOverride(x=>({...x,[child.id]:e.target.value}))} placeholder="0" style={{width:125,padding:"5px 8px",border:"1px solid #FCD34D",borderRadius:6,fontSize:12,textAlign:"right",fontWeight:700}} />
                    : <span style={{fontWeight:700,color:"#16A34A",fontSize:13}}>{share ? fmt(share) : "-"}</span>}
                </td>
                <td style={{padding:"9px 10px",textAlign:"right",fontWeight:700,color:isReservation ? "#0F2540" : ((owes - before - share) > 0.5 ? "#B91C1C" : "#16A34A")}}>{isReservation ? fmt(before + share) : ((owes - before - share) > 0.5 ? fmt(owes - before - share) : "Nil " + String.fromCodePoint(0x2713))}</td>
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
