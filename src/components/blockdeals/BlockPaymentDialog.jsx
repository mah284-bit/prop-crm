import { useState } from "react";

const PARTICULARS = ["Reservation", "Booking", "DLD Fee", "SPA Fee", "Instalment", "Other"];
const MODES = ["Wire", "Cheque", "Cash", "Card"];

export default function BlockPaymentDialog({ block, childRows, currentUser, showToast, onClose, onLock, payment, priorAllocs }) {
  console.log("[BPD] payment prop:", payment, "priorAllocs:", priorAllocs);
  const members = (childRows || []).filter(r => r.child && r.line.status !== "dropped");
  const [milestone, setMilestone] = useState(payment ? payment.milestone : "Reservation");
  const [amount, setAmount] = useState(payment ? String(payment.amount || "") : "");
  const [expTotal, setExpTotal] = useState(payment ? String(payment.expected_total != null ? payment.expected_total : payment.amount || "") : "");
  const [vreason, setVreason] = useState(payment ? (payment.variance_reason || "") : "");
  const [mode, setMode] = useState(payment ? (payment.payment_type || "Wire") : "Wire");
  const [reference, setReference] = useState(payment ? (payment.reference || "") : "");
  const [rdate, setRdate] = useState(payment ? (payment.received_date || new Date().toISOString().slice(0, 10)) : new Date().toISOString().slice(0, 10));
  const [amendReason, setAmendReason] = useState("");
  const [expected, setExpected] = useState({});
  const [alloc, setAlloc] = useState(() => {
    const seed = {};
    (priorAllocs || []).forEach(x => { seed[x.opportunity_id] = Number(x.amount) || 0; });
    return seed;
  });

  const fmt = (n) => "AED " + Math.round(Number(n || 0)).toLocaleString();
  const wire = Number(expTotal) || 0;
  const landed = amount === "" ? wire : (Number(amount) || 0);
  const variance = landed - wire;
  const evenShare = members.length ? Math.round(wire / members.length) : 0;
  const expOf = (id) => expected[id] !== undefined ? (Number(expected[id]) || 0) : evenShare;
  const recOf = (r) => milestone === "Reservation" ? Number(r.child.reservation_amount || 0) : 0;
  const owedOf = (r) => Math.max(expOf(r.child.id) - recOf(r), 0);
  const allocOf = (id) => Number(alloc[id]) || 0;
  const allocated = members.reduce((s, r) => s + allocOf(r.child.id), 0);
  const remainder = landed - allocated;
  const canLock = landed > 0 && Math.abs(remainder) < 0.5 && allocated > 0 && (variance === 0 || vreason.trim().length > 0) && (!payment || amendReason.trim().length > 0);

  const owedTotal = members.reduce((s, r) => s + owedOf(r), 0);
  const suggest = () => {
    const next = {};
    if (owedTotal <= 0) {
      const each = members.length ? Math.round(landed / members.length) : 0;
      members.forEach((r, i) => { next[r.child.id] = i === members.length - 1 ? landed - each * (members.length - 1) : each; });
    } else {
      let left = landed;
      members.forEach(r => { const want = Math.max(Math.min(owedOf(r), left), 0); next[r.child.id] = want; left -= want; });
    }
    setAlloc(next);
  };

  const bank = { milestone, amount: landed, expected_total: wire, variance_reason: variance !== 0 ? (vreason || null) : null, payment_type: mode, reference, received_date: rdate };

  const lab = { fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: ".4px", display: "block", marginBottom: 3 };
  const inp = { width: "100%", padding: "7px 9px", border: "1px solid #CBD5E1", borderRadius: 7, fontSize: 12, boxSizing: "border-box" };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1300,padding:"1rem"}}>
      <div style={{background:"#fff",borderRadius:16,width:860,maxWidth:"97vw",maxHeight:"95vh",overflow:"auto"}}>

        <div style={{padding:"1.1rem 1.4rem",borderBottom:"1px solid #E8EDF4",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:16,fontWeight:700,color:"#0F2540"}}>Record block payment</div>
            <div style={{fontSize:11,color:"#64748B",marginTop:2}}>{block.title} {String.fromCharCode(183)} {members.length} deals in this block</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:22,color:"#94A3B8",cursor:"pointer"}}>{String.fromCharCode(215)}</button>
        </div>

        <div style={{padding:"1.1rem 1.4rem"}}>

          <div style={{background:"#F8FAFC",border:"1px solid #E2E8F0",borderRadius:10,padding:"12px 14px",marginBottom:16}}>
            <div style={{fontSize:11,fontWeight:700,color:"#0F2540",textTransform:"uppercase",letterSpacing:".4px",marginBottom:9}}>The bank line</div>
            <div style={{display:"flex",gap:10,flexWrap:"nowrap"}}>
              <div style={{width:130,flexShrink:0}}>
                <label style={lab}>Particular</label>
                <select value={milestone} onChange={e=>{setMilestone(e.target.value);setAlloc({});}} style={inp}>
                  {PARTICULARS.map(x => <option key={x} value={x}>{x}</option>)}
                </select>
              </div>
              <div style={{width:120,flexShrink:0}}>
                <label style={lab}>Expected</label>
                <input type="number" value={expTotal} onChange={e=>{setExpTotal(e.target.value);setAlloc({});}} placeholder="0" style={inp} />
              </div>
              <div style={{width:120,flexShrink:0}}>
                <label style={lab}>Actually landed</label>
                <input type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="same" style={inp} />
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
              <div style={{width:130,flexShrink:0}}>
                <label style={lab}>Received on</label>
                <input type="date" value={rdate} onChange={e=>setRdate(e.target.value)} style={inp} />
              </div>
            </div>
          </div>

          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={{fontSize:13,fontWeight:700,color:"#0F2540"}}>Distribute to members</div>
            <button onClick={suggest} disabled={!wire} style={{padding:"6px 13px",borderRadius:8,border:"1px solid #0F2540",background:wire?"#fff":"#F1F5F9",color:wire?"#0F2540":"#94A3B8",fontSize:12,fontWeight:600,cursor:wire?"pointer":"not-allowed"}}>Suggest split</button>
          </div>

          {wire > 0 && owedTotal <= 0 && (
            <div style={{fontSize:11,color:"#B45309",background:"#FFFBEB",border:"1px solid #FCD34D",borderRadius:8,padding:"7px 11px",marginBottom:9}}>
              Every member has already satisfied {milestone}. Suggest split will divide this evenly as a top-up - or raise Expected per member first.
            </div>
          )}
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead><tr style={{background:"#F8FAFC",color:"#475569",textAlign:"left"}}>
              <th style={{padding:"8px 10px"}}>Unit</th>
              <th style={{padding:"8px 10px"}}>Stage</th>
              <th style={{padding:"8px 10px",textAlign:"right"}}>Expected</th>
              <th style={{padding:"8px 10px",textAlign:"right"}}>Already received</th>
              <th style={{padding:"8px 10px",textAlign:"right"}}>Still owed</th>
              <th style={{padding:"8px 10px",textAlign:"right",width:130}}>Allocate</th>
            </tr></thead>
            <tbody>{members.map(({line, child}) => {
              const owed = owedOf({line, child});
              const done = owed <= 0 && recOf({line, child}) > 0;
              return (
              <tr key={child.id} style={{borderBottom:"1px solid #F1F5F9",opacity:done?0.55:1}}>
                <td style={{padding:"8px 10px",fontWeight:700,color:"#0F2540"}}>{line.unit_ref}</td>
                <td style={{padding:"8px 10px",color:"#64748B"}}>{child.stage}</td>
                <td style={{padding:"8px 10px",textAlign:"right"}}>
                  <input type="number" value={expected[child.id] !== undefined ? expected[child.id] : evenShare} onChange={e=>setExpected(x=>({...x,[child.id]:e.target.value}))} style={{width:100,padding:"4px 7px",border:"1px solid #E2E8F0",borderRadius:6,fontSize:12,textAlign:"right"}} />
                </td>
                <td style={{padding:"8px 10px",textAlign:"right",color:"#16A34A",fontWeight:600}}>{recOf({line, child}) ? fmt(recOf({line, child})) : "-"}</td>
                <td style={{padding:"8px 10px",textAlign:"right",fontWeight:700,color:expOf(child.id)<=0&&!done?"#94A3B8":(owed>0?"#B91C1C":"#16A34A")}}>{done ? "satisfied" : (expOf(child.id) <= 0 ? "-" : fmt(owed))}</td>
                <td style={{padding:"8px 10px",textAlign:"right"}}>
                  <input type="number" value={alloc[child.id] !== undefined ? alloc[child.id] : ""} onChange={e=>setAlloc(x=>({...x,[child.id]:e.target.value}))} placeholder="0" style={{width:110,padding:"5px 8px",border:"1px solid #CBD5E1",borderRadius:6,fontSize:12,textAlign:"right",fontWeight:700}} />
                </td>
              </tr>); })}</tbody>
          </table>
          {members.length===0 && <div style={{color:"#94A3B8",fontSize:12,padding:"10px 0"}}>No live deals in this block yet.</div>}

          <div style={{marginTop:14,padding:"11px 14px",borderRadius:10,background:canLock?"#E6F4EE":"#FEF2F2",border:"1px solid "+(canLock?"#A7D8C3":"#FCA5A5"),display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{fontSize:12,color:"#475569"}}>Received {fmt(landed)} {String.fromCharCode(183)} allocated {fmt(allocated)}{variance !== 0 ? " " + String.fromCharCode(183) + " expected " + fmt(wire) : ""}</div>
            <div style={{fontSize:14,fontWeight:800,color:canLock?"#16A34A":"#B91C1C"}}>{canLock ? "Remainder 0 " + String.fromCodePoint(0x2713) : "Remainder " + fmt(remainder)}</div>
          </div>

          {variance !== 0 && wire > 0 && (
            <div style={{marginTop:9,padding:"10px 13px",borderRadius:9,background:"#FFFBEB",border:"1px solid #FCD34D"}}>
              <div style={{fontSize:12,fontWeight:700,color:"#B45309",marginBottom:5}}>{variance < 0 ? "Short by " + fmt(Math.abs(variance)) : "Over by " + fmt(variance)} {String.fromCharCode(183)} bank charges or transfer difference</div>
              <div style={{fontSize:11,color:"#78716C",marginBottom:6}}>Only what actually arrived is distributed. Record why it differs - approval of the difference stays a human decision.</div>
              <input value={vreason} onChange={e=>setVreason(e.target.value)} placeholder="Reason for the difference (e.g. bank charges)" style={{width:"100%",padding:"7px 9px",border:"1px solid #FCD34D",borderRadius:7,fontSize:12,boxSizing:"border-box"}} />
            </div>
          )}
          {payment && (
            <div style={{marginTop:9,padding:"10px 13px",borderRadius:9,background:"#FEF3C7",border:"1px solid #FCD34D"}}>
              <div style={{fontSize:12,fontWeight:700,color:"#B45309",marginBottom:5}}>Amending a recorded payment</div>
              <div style={{fontSize:11,color:"#78716C",marginBottom:6}}>The record is corrected in place - no second payment row. Stages already earned are not pulled back.</div>
              <input value={amendReason} onChange={e=>setAmendReason(e.target.value)} placeholder="Why is this being amended? (required)" style={{width:"100%",padding:"7px 9px",border:"1px solid #FCD34D",borderRadius:7,fontSize:12,boxSizing:"border-box"}} />
            </div>
          )}
          <div style={{display:"flex",justifyContent:"flex-end",gap:9,marginTop:16}}>
            <button onClick={onClose} style={{padding:"9px 17px",borderRadius:9,border:"1px solid #CBD5E1",background:"#fff",color:"#475569",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancel</button>
            <button disabled={!canLock} onClick={()=>onLock && onLock(bank, amendReason, members.map(r=>({opportunity_id:r.child.id,amount:allocOf(r.child.id)})).filter(a=>a.amount>0))} style={{padding:"9px 19px",borderRadius:9,border:"none",background:canLock?(payment?"#B45309":"#16A34A"):"#CBD5E1",color:"#fff",fontSize:13,fontWeight:700,cursor:canLock?"pointer":"not-allowed"}}>{payment ? "Amend allocation" : "Lock allocation"}</button>
          </div>

        </div>
      </div>
    </div>
  );
}
