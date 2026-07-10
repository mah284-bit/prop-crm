import React from "react";

export default function AuthLogo({ sub }) {
  return (
    <div style={{textAlign:"center",marginBottom:"2rem"}}>
      <div style={{fontSize:32,fontWeight:700,color:"#C9A84C",letterSpacing:"1px",marginBottom:6}}>◆</div>
      <div style={{fontSize:20,fontWeight:700,color:"#fff",letterSpacing:"−0.5px"}}>PropCRM</div>
      {sub && <div style={{fontSize:12,color:"rgba(255,255,255,0.65)",marginTop:8}}>{sub}</div>}
    </div>
  );
}
