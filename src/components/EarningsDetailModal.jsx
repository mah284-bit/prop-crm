import React from "react";
export default function EarningsDetailModal({ earnings, opps = [], onClose }) {
  const rows = earnings?.rows || [];
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(15,37,64,.45)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={onClose}>
      <div style={{background:"#fff",borderRadius:12,padding:22,width:"94%",maxWidth:640,maxHeight:"80vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
        <div style={{fontSize:16,fontWeight:700,color:"#0F2540",marginBottom:2}}>{"\ud83d\udcb0 My Earnings"}</div>
        <div style={{fontSize:12,color:"#64748B",marginBottom:14}}>Your commission per deal</div>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12.5}}>
          <thead><tr style={{textAlign:"left",color:"#94A3B8",fontSize:10.5,textTransform:"uppercase"}}>
            <th style={{padding:"6px 8px"}}>Deal</th><th style={{padding:"6px 8px",textAlign:"right"}}>Sale Price</th><th style={{padding:"6px 8px",textAlign:"right"}}>My Cut</th><th style={{padding:"6px 8px"}}>Status</th><th style={{padding:"6px 8px"}}>Date</th>
          </tr></thead>
          <tbody>
            {rows.map(r => {
              const o = opps.find(x => x.id === r.opportunity_id);
              return (
                <tr key={r.id} style={{borderTop:"1px solid #F1F5F9"}}>
                  <td style={{padding:"7px 8px",fontWeight:600,color:"#0F2540"}}>{o?.title || "(deal)"}</td>
                  <td style={{padding:"7px 8px",textAlign:"right"}}>{r.sale_price ? "AED " + Number(r.sale_price).toLocaleString() : "-"}</td>
                  <td style={{padding:"7px 8px",textAlign:"right",fontWeight:700,color:"#1A7F5A"}}>{r.agent_commission ? "AED " + Number(r.agent_commission).toLocaleString() : "-"}</td>
                  <td style={{padding:"7px 8px"}}><span style={{fontSize:10,fontWeight:700,padding:"1px 8px",borderRadius:20,background: r.invoice_status==="paid" ? "#E6F4EE" : "#FDF3DC", color: r.invoice_status==="paid" ? "#1A7F5A" : "#8A6200"}}>{r.invoice_status}</span></td>
                  <td style={{padding:"7px 8px",color:"#64748B"}}>{new Date(r.created_at).toLocaleDateString("en-AE",{day:"numeric",month:"short"})}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{borderTop:"2px solid #E8EDF4",marginTop:8,paddingTop:10,display:"flex",justifyContent:"space-between",fontSize:13,fontWeight:700,color:"#0F2540"}}>
          <span>Total</span><span>{"AED " + Math.round(earnings?.total || 0).toLocaleString()}</span>
        </div>
        <div style={{textAlign:"right",marginTop:14}}><button onClick={onClose} style={{padding:"8px 18px",borderRadius:8,border:"1.5px solid #E2E8F0",background:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",color:"#475569"}}>Close</button></div>
      </div>
    </div>
  );
}
