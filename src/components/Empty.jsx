import React from "react";

export default function Empty({ msg = "No data available" }) {
  return (
    <div style={{textAlign:"center",padding:"2rem",color:"#94A3B8"}}>
      <div style={{fontSize:40,marginBottom:"0.5rem"}}>—</div>
      <div style={{fontSize:13}}>{msg}</div>
    </div>
  );
}
