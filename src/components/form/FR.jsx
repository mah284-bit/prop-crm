import React from "react";

export default function FR({ label, value }) {
  return (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid #E8EDF4"}}>
      <div style={{fontSize:12,color:"#64748B"}}>{label}</div>
      <div style={{fontSize:13,fontWeight:600,color:"#0F2540"}}>{value}</div>
    </div>
  );
}
