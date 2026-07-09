import React from "react";

export default function StageBadge({ stage, STAGE_META }) {
  const m = STAGE_META[stage] || { c: "#718096", bg: "#F7F9FC" };
  return (
    <span style={{display:"inline-flex",alignItems:"center",gap:4,background:m.bg,color:m.c,fontSize:11,fontWeight:600,padding:"3px 9px",borderRadius:20,whiteSpace:"nowrap"}}>
      <span style={{width:5,height:5,borderRadius:"50%",background:m.c,display:"inline-block"}}/>
      {stage}
    </span>
  );
}
