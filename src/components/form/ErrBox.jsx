import React from "react";

export default function ErrBox({ msg }) {
  return msg ? (
    <div style={{background:"#FAEAEA",color:"#B83232",border:"1.5px solid #F0BCBC",borderRadius:8,padding:"10px 14px",fontSize:13,marginBottom:16,lineHeight:1.5}}>
      {msg}
    </div>
  ) : null;
}
