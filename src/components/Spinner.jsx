import React from "react";

export default function Spinner({ msg = "Loading..." }) {
  return (
    <div style={{textAlign:"center",padding:"2rem"}}>
      <div style={{display:"inline-block",width:20,height:20,border:"3px solid #E2E8F0",borderTop:"3px solid #0F2540",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
      <div style={{marginTop:"0.5rem",color:"#64748B",fontSize:12}}>{msg}</div>
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
