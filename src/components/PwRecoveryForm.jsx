// PwRecoveryForm — extracted from App.jsx (MAP A11)
import { useState } from "react";
import { supabase } from "../lib/supabase";
import { PwInput } from "../modules/auth/PwInput.jsx";

export default function PwRecoveryForm({onDone}){
  const[pw,setPw]=useState("");const[pw2,setPw2]=useState("");
  const[loading,setLoading]=useState(false);const[done,setDone]=useState(false);const[err,setErr]=useState("");
  const submit=async()=>{
    if(pw.length<8){setErr("Password must be at least 8 characters");return;}
    if(pw!==pw2){setErr("Passwords do not match");return;}
    setLoading(true);setErr("");
    const{error}=await supabase.auth.updateUser({password:pw});
    setLoading(false);
    if(error)setErr(error.message);
    else{setDone(true);setTimeout(onDone,2000);}
  };
  if(done)return(<div style={{textAlign:"center",padding:"20px 0"}}><div style={{fontSize:40,marginBottom:8}}>✅</div><div style={{color:"#1A7F5A",fontWeight:600,fontSize:16}}>Password changed!</div><div style={{fontSize:13,color:"#718096",marginTop:6}}>Signing you out — please log in again.</div></div>);
  const isSessionError = err.includes("session")||err.includes("Session")||err.includes("token")||err.includes("expired");
  return(
    <div>
      {err&&(
        <div style={{background:"#FEE2E2",color:"#C53030",padding:"10px 14px",borderRadius:8,marginBottom:12,fontSize:13}}>
          {err}
          {isSessionError&&<div style={{marginTop:8,fontSize:12,color:"#C53030"}}>Your reset link has expired. Please go back to login and request a new one.</div>}
        </div>
      )}
      <div style={{marginBottom:12}}><label style={{display:"block",fontSize:12,fontWeight:600,color:"#4A5568",textTransform:"uppercase",letterSpacing:".5px",marginBottom:4}}>New Password *</label><PwInput value={pw} onChange={e=>setPw(e.target.value)} placeholder="Min 8 characters" style={{width:"100%",padding:"10px 14px",border:"1.5px solid #E2E8F0",borderRadius:10,fontSize:14,outline:"none",boxSizing:"border-box"}}/></div>
      <div style={{marginBottom:16}}><label style={{display:"block",fontSize:12,fontWeight:600,color:"#4A5568",textTransform:"uppercase",letterSpacing:".5px",marginBottom:4}}>Confirm Password *</label><PwInput value={pw2} onChange={e=>setPw2(e.target.value)} placeholder="Repeat new password" style={{width:"100%",padding:"10px 14px",border:"1.5px solid #E2E8F0",borderRadius:10,fontSize:14,outline:"none",boxSizing:"border-box"}}/></div>
      <button onClick={submit} disabled={loading} style={{width:"100%",padding:"12px",borderRadius:10,border:"none",background:"#0F2540",color:"#fff",fontSize:14,fontWeight:600,cursor:"pointer"}}>{loading?"Saving…":"Set New Password →"}</button>
    </div>
  );
}
