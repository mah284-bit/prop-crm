import React from "react";
import { getStrength } from "../../lib/validation.js";

export default function StrengthBar({ password }) {
  const s = getStrength(password);
  const levels = ["#E63946","#F77F00","#FCBF49","#06A77D","#2E8B57"];
  return (
    <div style={{display:"flex",gap:4,marginTop:8}}>
      {[0,1,2,3,4].map(i=>(
        <div key={i} style={{flex:1,height:4,background:i<s?levels[s-1]:"#E2E8F0",borderRadius:2,transition:"all 0.3s"}}/>
      ))}
    </div>
  );
}
