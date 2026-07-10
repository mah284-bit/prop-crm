import React from "react";

export default function FF({ label, children, required = false, error = "" }) {
  return (
    <div style={{marginBottom:"1rem"}}>
      {label && <label style={{display:"block",fontSize:12,fontWeight:600,color:"#0F2540",marginBottom:6}}>
        {label}
        {required && <span style={{color:"#E63946",marginLeft:2}}>*</span>}
      </label>}
      {children}
      {error && <div style={{fontSize:11,color:"#E63946",marginTop:4}}>{error}</div>}
    </div>
  );
}
