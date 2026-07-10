import React from "react";

export default function AuthTabs({ mode, setMode }) {
  return (
    <div style={{display:"flex",gap:8,marginBottom:"1.5rem",borderBottom:"1px solid rgba(255,255,255,0.15)",paddingBottom:"1rem"}}>
      {["login","signup"].map(m=>(
        <button
          key={m}
          onClick={()=>setMode(m)}
          style={{padding:"6px 0",border:"none",background:"none",color:mode===m?"#C9A84C":"rgba(255,255,255,0.5)",fontSize:13,fontWeight:mode===m?700:400,cursor:"pointer",transition:"all 0.2s",borderBottom:mode===m?"2px solid #C9A84C":"none",paddingBottom:mode===m?"0":"2px"}}
        >
          {m==="login"?"Sign In":"Sign Up"}
        </button>
      ))}
    </div>
  );
}
