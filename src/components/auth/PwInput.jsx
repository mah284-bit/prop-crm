import React, { useState } from "react";
import EyeIcon from "./EyeIcon.jsx";

export default function PwInput({ value, onChange, placeholder = "••••••••", onKeyDown }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{position:"relative"}}>
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        style={{width:"100%",padding:"9px 14px 9px 14px",border:"1.5px solid #D1D9E6",borderRadius:8,fontSize:13,outline:"none",transition:"border-color 0.2s"}}
        onFocus={(e)=>e.currentTarget.style.borderColor="#4A9EE8"}
        onBlur={(e)=>e.currentTarget.style.borderColor="#D1D9E6"}
      />
      <button
        type="button"
        onClick={()=>setShow(!show)}
        style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"#64748B",display:"flex",alignItems:"center"}}
      >
        <EyeIcon open={show}/>
      </button>
    </div>
  );
}
