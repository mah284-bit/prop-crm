import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* ═══════════════════════════════════════════════════════════════
   PROPCCRM v3.0
   · Property Master DB: Project → Category → Building → Unit
   · Lead stage gates with required fields
   · Stage reversal with reason
   · WhatsApp / Email / Meeting / Follow-up comms
   · Role-based permissions throughout
═══════════════════════════════════════════════════════════════ */
const SUPABASE_URL  = "https://ysceukgpimzfqixtnbnp.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzY2V1a2dwaW16ZnFpeHRuYm5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNDI5OTQsImV4cCI6MjA4OTkxODk5NH0.WZSyGeOEbiRo1wt13syheTOyiAToMWXInxIaBgaqq8k";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

// ─── STYLES ───────────────────────────────────────────────────
const GlobalStyle = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@300;400;500;600&display=swap');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'DM Sans',sans-serif;background:#F0F2F5;color:#1a2535}
    ::-webkit-scrollbar{width:5px;height:5px}
    ::-webkit-scrollbar-thumb{background:#C9A84C55;border-radius:10px}
    input,select,textarea{font-family:'DM Sans',sans-serif;outline:none;border:1.5px solid #D1D9E6;border-radius:8px;padding:9px 12px;font-size:13px;color:#1a2535;background:#fff;width:100%;transition:border-color 0.2s}
    input:focus,select:focus,textarea:focus{border-color:#C9A84C}
    input.error,select.error{border-color:#B83232!important;background:#FFF8F8}
    textarea{resize:vertical}
    button{cursor:pointer;font-family:'DM Sans',sans-serif}
    .fade-in{animation:fadeIn 0.25s ease}
    @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
    .slide-in{animation:slideIn 0.2s ease}
    @keyframes slideIn{from{opacity:0;transform:translateX(12px)}to{opacity:1;transform:none}}
    .ch{transition:box-shadow 0.18s,transform 0.18s}
    .ch:hover{box-shadow:0 4px 20px #C9A84C22;transform:translateY(-1px)}
    .dcard{transition:box-shadow 0.15s;cursor:grab}
    .dcard:hover{box-shadow:0 3px 14px #0B1F3A22}
    @keyframes spin{to{transform:rotate(360deg)}}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
  `}</style>
);

// ─── CONSTANTS ────────────────────────────────────────────────
const STAGES      = ["New Lead","Contacted","Site Visit","Proposal Sent","Negotiation","Closed Won","Closed Lost"];
const PROP_TYPES  = ["Residential","Commercial","Luxury","Off-plan","Villa","Flat","Building"];
const UNIT_TYPES  = ["Villa","Flat","Penthouse","Townhouse","Duplex","Studio","Office","Warehouse","Plot","Commercial Unit"];
const SOURCES     = ["Referral","Website","Portal","Cold Call","Event","Social Media","WhatsApp","Walk-in"];
const ACT_TYPES   = ["Call","Email","Meeting","Visit","WhatsApp","Note"];
const MANAGER_DISCOUNT_LIMIT = 5;
const CAN_DELETE_LEADS = ["admin","manager"];
const STAGE_RULES = {
  "Contacted":     ["phone","email"],
  "Site Visit":    ["meeting_scheduled"],
  "Proposal Sent": ["unit_id","budget_confirmed"],
  "Negotiation":   ["proposal_notes"],
  "Closed Won":    ["final_price","payment_plan_agreed"],
};
const DISC_TYPES = [
  { key:"sale_price",   label:"Sale Price Reduction", icon:"🏷" },
  { key:"rent",         label:"Rent Reduction",        icon:"🔑" },
  { key:"payment_plan", label:"Payment Plan Change",   icon:"📅" },
  { key:"agency_fee",   label:"Agency Fee Waiver",     icon:"🤝" },
];
const ROLES       = ["admin","manager","agent","viewer"];
const VIEWS       = ["Sea View","Pool View","Garden View","City View","Golf View","Park View","Community View","Burj View","Creek View","No View"];
const MEET_TYPES  = ["Call","Meeting","Site Visit","Video Call","Presentation"];
const FOLLOW_TYPES= ["Call","WhatsApp","Email","Meeting"];
const WA_TEMPLATES= [
  { id:"intro",    label:"Introduction",      text:"Hello {name}, I'm {agent} from PropCRM. I wanted to reach out regarding your interest in {type} properties in Dubai. Could we schedule a brief call to discuss your requirements?" },
  { id:"followup", label:"Follow-up",         text:"Hello {name}, I hope you're well. I wanted to follow up on our previous conversation about the properties we discussed. Do you have any questions or would you like to arrange a viewing?" },
  { id:"sitevisit",label:"Site Visit Invite", text:"Hello {name}, I'd love to invite you for a site visit to {project}. It's a great opportunity to see the development in person. Would {date} work for you?" },
  { id:"proposal", label:"Proposal Ready",    text:"Hello {name}, your personalised property proposal is ready. I'll be sending the details shortly. Please let me know if you'd like to discuss anything." },
  { id:"noresponse",label:"No Response",      text:"Hello {name}, I've tried reaching you a couple of times. I understand you may be busy — whenever you're ready to discuss your property needs, I'm here to help." },
  { id:"closing",  label:"Closing",           text:"Hello {name}, I wanted to touch base regarding {property}. We have a few serious buyers interested. I wouldn't want you to miss out. Shall we finalise the details?" },
];

// Stage gate requirements — what must exist before moving to next stage
const STAGE_GATES = {
  "Contacted":     { required: ["phone","email"],                    label: "Phone and email required",          fields: ["phone","email"] },
  "Site Visit":    { required: ["meeting_scheduled"],                label: "A meeting must be scheduled first", fields: ["meeting_scheduled"] },
  "Proposal Sent": { required: ["unit_id","budget"],                 label: "Link a unit and confirm budget",    fields: ["unit_id","budget"] },
  "Negotiation":   { required: ["proposal_notes"],                   label: "Proposal notes required",           fields: ["proposal_notes"] },
  "Closed Won":    { required: ["final_price","payment_plan"],       label: "Final price and payment plan required", fields: ["final_price","payment_plan"] },
  "Closed Lost":   { required: ["notes"],                            label: "Reason for loss required (notes)",  fields: ["notes"] },
};

const STAGE_META = {
  "New Lead":      { c:"#1A5FA8", bg:"#E6EFF9", order:0 },
  "Contacted":     { c:"#5B3FAA", bg:"#EEE8F9", order:1 },
  "Site Visit":    { c:"#A06810", bg:"#FDF3DC", order:2 },
  "Proposal Sent": { c:"#7A3FAA", bg:"#F3E8F9", order:3 },
  "Negotiation":   { c:"#B85C10", bg:"#FDF0E6", order:4 },
  "Closed Won":    { c:"#1A7F5A", bg:"#E6F4EE", order:5 },
  "Closed Lost":   { c:"#B83232", bg:"#FAEAEA", order:6 },
};
const TYPE_META = {
  Residential:{c:"#1A7F5A",bg:"#E6F4EE"}, Commercial:{c:"#1A5FA8",bg:"#E6EFF9"},
  Luxury:{c:"#8A6200",bg:"#FDF3DC"},      "Off-plan":{c:"#5B3FAA",bg:"#EEE8F9"},
  Villa:{c:"#0F6E56",bg:"#D4F1E8"},       Flat:{c:"#1D6FA8",bg:"#D4EAF7"},
  Building:{c:"#5A3D8A",bg:"#E8DFFA"},
};
const ACT_META = {
  Call:{icon:"📞",c:"#1A5FA8",bg:"#E6EFF9"}, Email:{icon:"✉",c:"#5B3FAA",bg:"#EEE8F9"},
  Meeting:{icon:"🤝",c:"#1A7F5A",bg:"#E6F4EE"}, Visit:{icon:"🏠",c:"#A06810",bg:"#FDF3DC"},
  WhatsApp:{icon:"💬",c:"#1A7F5A",bg:"#E6F4EE"}, Note:{icon:"📝",c:"#718096",bg:"#F0F2F5"},
};
const ROLE_META = {
  admin:{label:"Admin",color:"#8A6200",bg:"#FDF3DC",desc:"Full access"},
  manager:{label:"Manager",color:"#1A5FA8",bg:"#E6EFF9",desc:"All leads"},
  agent:{label:"Agent",color:"#1A7F5A",bg:"#E6F4EE",desc:"Own leads"},
  viewer:{label:"Viewer",color:"#718096",bg:"#F0F2F5",desc:"Read only"},
};

// ─── UTILS ────────────────────────────────────────────────────
const fmtM    = n  => n ? `AED ${(n/1e6).toFixed(2)}M` : "—";
const fmtAED  = n  => n ? `AED ${Number(n).toLocaleString("en-AE")}` : "—";
const fmtDate = d  => d ? new Date(d).toLocaleDateString("en-AE",{day:"numeric",month:"short",year:"numeric"}) : "—";
const fmtDT   = d  => d ? new Date(d).toLocaleString("en-AE",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}) : "—";
const ini     = n  => (n||"?").split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase();
const uid     = () => Date.now()+Math.floor(Math.random()*9999);
const can     = (role,action) => ({
  admin:["read","write","delete","manage_users","see_all","delete_leads"],
  manager:["read","write","delete","see_all","delete_leads"],
  agent:["read","write"],
  viewer:["read"],
}[role]||[]).includes(action);

function useLS(key,seed){
  const[v,setV]=useState(()=>{ try{const s=localStorage.getItem(key);return s?JSON.parse(s):seed;}catch{return seed;}});
  const set=x=>{setV(x);try{localStorage.setItem(key,JSON.stringify(x));}catch{}};
  return[v,set];
}

// Check stage gate — returns array of missing fields
const checkGate = (targetStage, lead) => {
  const gate = STAGE_GATES[targetStage];
  if (!gate) return [];
  const missing = [];
  gate.required.forEach(f => {
    if (f === "meeting_scheduled" && !lead.meeting_scheduled) missing.push("A meeting must be scheduled before Site Visit");
    else if (f === "unit_id" && !lead.unit_id) missing.push("Link a unit to this lead");
    else if (f === "budget" && !lead.budget) missing.push("Confirm client budget");
    else if (f === "proposal_notes" && !lead.proposal_notes?.trim()) missing.push("Add proposal notes");
    else if (f === "final_price" && !lead.final_price) missing.push("Enter final agreed price");
    else if (f === "payment_plan" && !lead.payment_plan?.trim()) missing.push("Specify payment plan");
    else if (f === "phone" && !lead.phone?.trim()) missing.push("Phone number required");
    else if (f === "email" && !lead.email?.trim()) missing.push("Email address required");
    else if (f === "notes" && !lead.notes?.trim()) missing.push("Add reason for loss in notes");
  });
  return missing;
};

// ─── ATOMS ────────────────────────────────────────────────────
const Av = ({name,size=36,bg="#0B1F3A",tc="#C9A84C"}) => (
  <div style={{width:size,height:size,borderRadius:"50%",background:bg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:size*0.32,fontWeight:600,color:tc,letterSpacing:"0.5px"}}>{ini(name)}</div>
);
const StageBadge = ({stage}) => {
  const m=STAGE_META[stage]||{c:"#718096",bg:"#F0F2F5"};
  return <span style={{display:"inline-flex",alignItems:"center",gap:4,background:m.bg,color:m.c,fontSize:11,fontWeight:600,padding:"3px 9px",borderRadius:20,whiteSpace:"nowrap"}}><span style={{width:5,height:5,borderRadius:"50%",background:m.c,display:"inline-block"}}/>{stage}</span>;
};
const TypeBadge = ({type}) => {
  const m=TYPE_META[type]||{c:"#718096",bg:"#F0F2F5"};
  return <span style={{fontSize:11,fontWeight:600,padding:"3px 9px",borderRadius:20,background:m.bg,color:m.c}}>{type}</span>;
};
const RoleBadge = ({role}) => {
  const m=ROLE_META[role]||{label:role,color:"#718096",bg:"#F0F2F5"};
  return <span style={{fontSize:11,fontWeight:600,padding:"3px 9px",borderRadius:20,background:m.bg,color:m.color,textTransform:"capitalize"}}>{m.label}</span>;
};
const Btn = ({children,onClick,variant="primary",small=false,full=false,disabled=false,style:st={}}) => {
  const s={primary:{background:"#0B1F3A",color:"#fff",border:"none"},gold:{background:"#C9A84C",color:"#0B1F3A",border:"none"},outline:{background:"#fff",color:"#0B1F3A",border:"1.5px solid #D1D9E6"},danger:{background:"#FAEAEA",color:"#B83232",border:"1.5px solid #F0BCBC"},green:{background:"#E6F4EE",color:"#1A7F5A",border:"1.5px solid #A8D5BE"},wa:{background:"#25D366",color:"#fff",border:"none"}};
  return <button onClick={onClick} disabled={disabled} style={{...s[variant],padding:small?"6px 14px":"9px 18px",borderRadius:8,fontSize:small?12:13,fontWeight:600,display:"inline-flex",alignItems:"center",gap:6,transition:"opacity 0.15s",width:full?"100%":"auto",justifyContent:"center",opacity:disabled?0.45:1,...st}} onMouseOver={e=>{if(!disabled)e.currentTarget.style.opacity="0.82"}} onMouseOut={e=>e.currentTarget.style.opacity=disabled?"0.45":"1"}>{children}</button>;
};
const Spinner=({msg="Loading…"})=>(
  <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",gap:16,color:"#A0AEC0"}}>
    <div style={{width:36,height:36,border:"3px solid #E2E8F0",borderTop:"3px solid #C9A84C",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
    {msg&&<div style={{fontSize:14}}>{msg}</div>}
  </div>
);
const Empty=({icon,msg})=>(
  <div style={{textAlign:"center",padding:"3rem 1rem",color:"#A0AEC0"}}>
    <div style={{fontSize:36,marginBottom:10}}>{icon}</div>
    <div style={{fontSize:14}}>{msg}</div>
  </div>
);
const FR=({label,value})=>(
  <div style={{display:"flex",flexDirection:"column",gap:2}}>
    <span style={{fontSize:10,color:"#A0AEC0",textTransform:"uppercase",letterSpacing:"0.6px",fontWeight:600}}>{label}</span>
    <span style={{fontSize:13,color:"#1a2535",fontWeight:500}}>{value||"—"}</span>
  </div>
);
const Modal=({title,onClose,children,width=520})=>(
  <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:"1rem"}}>
    <div className="fade-in" style={{background:"#fff",borderRadius:16,width,maxWidth:"100%",maxHeight:"90vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(11,31,58,0.3)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"1.25rem 1.5rem",borderBottom:"1px solid #E2E8F0",position:"sticky",top:0,background:"#fff",zIndex:1}}>
        <span style={{fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:700,color:"#0B1F3A"}}>{title}</span>
        <button onClick={onClose} style={{background:"none",border:"none",fontSize:22,color:"#A0AEC0",cursor:"pointer"}}>×</button>
      </div>
      <div style={{padding:"1.25rem 1.5rem"}}>{children}</div>
    </div>
  </div>
);
const FF=({label,children,required=false,error=""})=>(
  <div style={{marginBottom:14}}>
    <label style={{display:"block",fontSize:11,fontWeight:600,color:error?"#B83232":"#4A5568",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.5px"}}>{label}{required&&<span style={{color:"#B83232"}}> *</span>}</label>
    {children}
    {error&&<div style={{fontSize:11,color:"#B83232",marginTop:4,fontWeight:500}}>⚠ {error}</div>}
  </div>
);
const G2=({children})=><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>{children}</div>;
const G3=({children})=><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>{children}</div>;
const Badge=({label,c,bg})=>(
  <span style={{display:"inline-flex",alignItems:"center",gap:4,background:bg,color:c,fontSize:11,fontWeight:600,padding:"3px 9px",borderRadius:20,whiteSpace:"nowrap"}}>
    <span style={{width:5,height:5,borderRadius:"50%",background:c,display:"inline-block"}}/>
    {label}
  </span>
);
const DiscBadge=({status})=>{const C={Pending:{c:"#A06810",bg:"#FDF3DC"},Approved:{c:"#1A7F5A",bg:"#E6F4EE"},Rejected:{c:"#B83232",bg:"#FAEAEA"},Escalated:{c:"#5B3FAA",bg:"#EEE8F9"}};const m=C[status]||{c:"#718096",bg:"#F0F2F5"};return <Badge label={status} c={m.c} bg={m.bg}/>;};
const Toast=({msg,type="success",onDone})=>{
  useEffect(()=>{const t=setTimeout(onDone,3500);return()=>clearTimeout(t)},[]);
  const colors={success:["#E6F4EE","#1A7F5A"],error:["#FAEAEA","#B83232"],info:["#E6EFF9","#1A5FA8"],warning:["#FDF3DC","#A06810"]};
  const[bg,c]=colors[type]||colors.info;
  return <div style={{position:"fixed",bottom:24,right:24,zIndex:9999,background:bg,color:c,border:`1.5px solid ${c}33`,borderRadius:10,padding:"12px 18px",fontSize:13,fontWeight:600,boxShadow:"0 4px 20px rgba(0,0,0,0.12)",maxWidth:360}}>{type==="success"?"✓ ":type==="error"?"✕ ":type==="warning"?"⚠ ":"ℹ "}{msg}</div>;
};

// ─── AUTH (same as v2) ────────────────────────────────────────
const EyeIcon=({open})=>(
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {open?<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>:<><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>}
  </svg>
);
const getStrength=pw=>{
  if(!pw)return{score:0,label:"",color:"#E2E8F0",pct:0};
  let s=0;
  if(pw.length>=8)s++;if(pw.length>=12)s++;if(/[A-Z]/.test(pw))s++;if(/[0-9]/.test(pw))s++;if(/[^A-Za-z0-9]/.test(pw))s++;
  if(s<=1)return{score:s,label:"Weak",color:"#B83232",pct:20};
  if(s<=2)return{score:s,label:"Fair",color:"#A06810",pct:45};
  if(s<=3)return{score:s,label:"Good",color:"#1A5FA8",pct:70};
  return{score:s,label:"Strong",color:"#1A7F5A",pct:100};
};
const PwInput=({value,onChange,placeholder="••••••••",onKeyDown})=>{
  const[show,setShow]=useState(false);
  return <div style={{position:"relative"}}><input type={show?"text":"password"} value={value} onChange={onChange} placeholder={placeholder} onKeyDown={onKeyDown} style={{paddingRight:42}}/><button type="button" onClick={()=>setShow(s=>!s)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"#A0AEC0",padding:0,display:"flex",alignItems:"center",cursor:"pointer"}}><EyeIcon open={show}/></button></div>;
};
const StrengthBar=({password})=>{
  const s=getStrength(password);
  if(!password)return null;
  return <div style={{marginTop:6}}><div style={{height:4,background:"#F0F2F5",borderRadius:4,overflow:"hidden"}}><div style={{width:`${s.pct}%`,height:"100%",background:s.color,borderRadius:4,transition:"width 0.3s"}}/></div><div style={{fontSize:11,color:s.color,fontWeight:600,marginTop:4}}>{s.label} password</div></div>;
};
const AuthWrap=({children})=>(
  <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#0B1F3A 0%,#1A3558 60%,#0B1F3A 100%)",display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem"}}>
    <div className="fade-in" style={{background:"#fff",borderRadius:20,padding:"2.5rem",width:440,maxWidth:"100%",boxShadow:"0 30px 80px rgba(0,0,0,0.4)"}}>{children}</div>
  </div>
);
const AuthLogo=({sub})=>(
  <div style={{textAlign:"center",marginBottom:28}}>
    <div style={{fontFamily:"'Playfair Display',serif",fontSize:32,fontWeight:700,color:"#0B1F3A"}}><span style={{color:"#C9A84C"}}>◆</span> PropCRM</div>
    <div style={{fontSize:13,color:"#A0AEC0",marginTop:6}}>{sub}</div>
  </div>
);
const ErrBox=({msg})=>msg?<div style={{background:"#FAEAEA",color:"#B83232",border:"1.5px solid #F0BCBC",borderRadius:8,padding:"10px 14px",fontSize:13,marginBottom:16,lineHeight:1.5}}>{msg}</div>:null;
const AuthTabs=({mode,setMode})=>(
  <div style={{display:"flex",background:"#F0F2F5",borderRadius:10,padding:4,marginBottom:24}}>
    {[["login","Sign In"],["signup","Create Account"]].map(([m,label])=>(
      <button key={m} onClick={()=>setMode(m)} style={{flex:1,padding:"8px 0",borderRadius:8,border:"none",background:mode===m?"#fff":"transparent",color:mode===m?"#0B1F3A":"#A0AEC0",fontSize:13,fontWeight:mode===m?600:400,cursor:"pointer",transition:"all 0.2s",boxShadow:mode===m?"0 1px 4px rgba(0,0,0,0.08)":"none"}}>{label}</button>
    ))}
  </div>
);

function LoginScreen({onLogin}){
  const[mode,setMode]=useState("login");
  const[email,setEmail]=useState("");const[pw,setPw]=useState("");const[pw2,setPw2]=useState("");const[name,setName]=useState("");
  const[loading,setLoading]=useState(false);const[error,setError]=useState("");
  const reset=()=>setError("");

  const doLogin=async()=>{
    if(!email||!pw){setError("Please enter your email and password.");return;}
    setLoading(true);reset();
    try{
      const{data,error:e}=await supabase.auth.signInWithPassword({email,password:pw});
      if(e)throw e;
      const{data:profile}=await supabase.from("profiles").select("*").eq("id",data.user.id).single();
      if(!profile)throw new Error("Profile not found. Please sign up first.");
      if(!profile.is_active)throw new Error("Your account has been deactivated. Contact your admin.");
      onLogin({...data.user,...profile});
    }catch(e){
      const msg=e.message||"";
      if(msg.includes("Email not confirmed"))setError("Please verify your email first. Check your inbox.");
      else if(msg.includes("Invalid login"))setError("Incorrect email or password.");
      else setError(msg||"Login failed.");
    }finally{setLoading(false);}
  };

  const doSignup=async()=>{
    if(!name.trim()){setError("Please enter your full name.");return;}
    if(!email){setError("Please enter your email.");return;}
    if(pw.length<8){setError("Password must be at least 8 characters.");return;}
    if(pw!==pw2){setError("Passwords do not match.");return;}
    if(getStrength(pw).score<2){setError("Password too weak. Add numbers and symbols.");return;}
    setLoading(true);reset();
    try{
      const{error:e}=await supabase.auth.signUp({email,password:pw,options:{data:{full_name:name.trim(),role:"agent"}}});
      if(e)throw e;
      setMode("verify");
    }catch(e){
      if(e.message?.includes("already registered"))setError("Account exists. Please sign in.");
      else setError(e.message||"Sign up failed.");
    }finally{setLoading(false);}
  };

  if(mode==="verify")return(
    <AuthWrap>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:56,marginBottom:16}}>📬</div>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:700,color:"#0B1F3A",marginBottom:10}}>Check your inbox</div>
        <div style={{fontSize:14,color:"#4A5568",lineHeight:1.8,marginBottom:6}}>We sent a confirmation email to:</div>
        <div style={{fontSize:15,fontWeight:700,color:"#0B1F3A",marginBottom:20}}>{email}</div>
        <div style={{fontSize:13,color:"#718096",lineHeight:1.8,marginBottom:28,padding:"14px",background:"#F7F9FC",borderRadius:10,border:"1px solid #E2E8F0",textAlign:"left"}}>
          <strong>What to do:</strong><br/>1. Open the email from Supabase<br/>2. Click the <strong>"Confirm your email"</strong> link<br/>3. Come back here and sign in<br/><br/><span style={{color:"#A0AEC0"}}>Can't find it? Check Spam/Junk.</span>
        </div>
        <Btn full onClick={()=>{setMode("login");setPw("");setPw2("");reset();}} style={{marginBottom:12}}>→ Go to Sign In</Btn>
        <button onClick={async()=>{setLoading(true);await supabase.auth.resend({type:"signup",email});setLoading(false);alert("Resent!");}} style={{background:"none",border:"none",color:"#A0AEC0",fontSize:12,cursor:"pointer",textDecoration:"underline"}}>{loading?"Sending…":"Resend confirmation email"}</button>
      </div>
    </AuthWrap>
  );

  if(mode==="login")return(
    <AuthWrap>
      <AuthLogo sub="Sign in to your account"/>
      <AuthTabs mode={mode} setMode={m=>{setMode(m);setError("");setPw("");setPw2("");}}/>
      <ErrBox msg={error}/>
      <FF label="Email Address" required><input type="email" value={email} onChange={e=>{setEmail(e.target.value);reset();}} placeholder="you@company.com" onKeyDown={e=>e.key==="Enter"&&doLogin()}/></FF>
      <FF label="Password" required><PwInput value={pw} onChange={e=>{setPw(e.target.value);reset();}} onKeyDown={e=>e.key==="Enter"&&doLogin()}/></FF>
      <Btn onClick={doLogin} disabled={loading} full style={{marginTop:8,padding:"12px"}}>{loading?"Signing in…":"Sign In →"}</Btn>
      <div style={{textAlign:"center",marginTop:18}}><span style={{fontSize:13,color:"#A0AEC0"}}>New to PropCRM? </span><button onClick={()=>{setMode("signup");setError("");setPw("");}} style={{background:"none",border:"none",color:"#C9A84C",fontSize:13,fontWeight:600,cursor:"pointer",textDecoration:"underline"}}>Create an account</button></div>
    </AuthWrap>
  );

  return(
    <AuthWrap>
      <AuthLogo sub="Create your PropCRM account"/>
      <AuthTabs mode={mode} setMode={m=>{setMode(m);setError("");setPw("");setPw2("");}}/>
      <ErrBox msg={error}/>
      <FF label="Full Name" required><input value={name} onChange={e=>{setName(e.target.value);reset();}} placeholder="Ahmed Al Mansoori" onKeyDown={e=>e.key==="Enter"&&doSignup()}/></FF>
      <FF label="Email Address" required><input type="email" value={email} onChange={e=>{setEmail(e.target.value);reset();}} placeholder="you@company.com" onKeyDown={e=>e.key==="Enter"&&doSignup()}/></FF>
      <FF label="Password" required><PwInput value={pw} onChange={e=>{setPw(e.target.value);reset();}} placeholder="Min 8 characters"/><StrengthBar password={pw}/></FF>
      <FF label="Confirm Password" required><PwInput value={pw2} onChange={e=>{setPw2(e.target.value);reset();}} placeholder="Re-enter password" onKeyDown={e=>e.key==="Enter"&&doSignup()}/>{pw2&&pw!==pw2&&<div style={{fontSize:11,color:"#B83232",marginTop:4,fontWeight:600}}>✕ Passwords do not match</div>}{pw2&&pw===pw2&&pw.length>=8&&<div style={{fontSize:11,color:"#1A7F5A",marginTop:4,fontWeight:600}}>✓ Passwords match</div>}</FF>
      <div style={{background:"#F7F9FC",border:"1px solid #E2E8F0",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:12,color:"#718096",lineHeight:1.7}}>New accounts are assigned <strong>Agent</strong> role. Your admin can upgrade access after login.</div>
      <Btn onClick={doSignup} disabled={loading} full style={{padding:"12px"}}>{loading?"Creating…":"Create Account →"}</Btn>
      <div style={{textAlign:"center",marginTop:18}}><span style={{fontSize:13,color:"#A0AEC0"}}>Already have an account? </span><button onClick={()=>{setMode("login");setError("");setPw("");setPw2("");}} style={{background:"none",border:"none",color:"#C9A84C",fontSize:13,fontWeight:600,cursor:"pointer",textDecoration:"underline"}}>Sign in</button></div>
    </AuthWrap>
  );
}

// ══════════════════════════════════════════════════════
// PROPERTY MASTER DATABASE
// ══════════════════════════════════════════════════════
function PropertyMaster({currentUser,showToast}){
  const[projects,setProjects]=useState([]);
  const[categories,setCategories]=useState([]);
  const[buildings,setBuildings]=useState([]);
  const[units,setUnits]=useState([]);
  const[loading,setLoading]=useState(true);
  const[selProject,setSelProject]=useState(null);
  const[selCategory,setSelCategory]=useState(null);
  const[selBuilding,setSelBuilding]=useState(null);
  const[selUnit,setSelUnit]=useState(null);
  const[modal,setModal]=useState(null); // "project"|"category"|"building"|"unit"
  const[form,setForm]=useState({});
  const canEdit=can(currentUser.role,"write");

  const load=useCallback(async()=>{
    setLoading(true);
    const[p,c,b,u]=await Promise.all([
      supabase.from("projects").select("*").order("name"),
      supabase.from("project_categories").select("*").order("name"),
      supabase.from("project_buildings").select("*").order("name"),
      supabase.from("units").select("*").order("unit_number"),
    ]);
    setProjects(p.data||[]);setCategories(c.data||[]);setBuildings(b.data||[]);setUnits(u.data||[]);
    setLoading(false);
  },[]);
  useEffect(()=>{load();},[load]);

  const sf=(k,v)=>setForm(f=>({...f,[k]:v}));

  const saveProject=async()=>{
    if(!form.name?.trim()){showToast("Project name required","error");return;}
    const payload={name:form.name,developer:form.developer||null,location:form.location||null,description:form.description||null,launch_date:form.launch_date||null,handover_date:form.handover_date||null,status:form.status||"Active",created_by:currentUser.id};
    const{data,error}=form.id
      ?await supabase.from("projects").update(payload).eq("id",form.id).select().single()
      :await supabase.from("projects").insert(payload).select().single();
    if(error){showToast(error.message,"error");return;}
    setProjects(p=>form.id?p.map(x=>x.id===data.id?data:x):[data,...p]);
    showToast(`Project ${form.id?"updated":"created"}.`,"success");setModal(null);setForm({});
  };

  const saveCategory=async()=>{
    if(!form.name?.trim()||!selProject){showToast("Name and project required","error");return;}
    const payload={name:form.name,type:form.type||"Flat",description:form.description||null,project_id:selProject.id};
    const{data,error}=form.id
      ?await supabase.from("project_categories").update(payload).eq("id",form.id).select().single()
      :await supabase.from("project_categories").insert(payload).select().single();
    if(error){showToast(error.message,"error");return;}
    setCategories(p=>form.id?p.map(x=>x.id===data.id?data:x):[data,...p]);
    showToast(`Category ${form.id?"updated":"created"}.`,"success");setModal(null);setForm({});
  };

  const saveBuilding=async()=>{
    if(!form.name?.trim()||!selCategory){showToast("Name and category required","error");return;}
    const payload={name:form.name,floors:Number(form.floors)||null,total_units:Number(form.total_units)||null,description:form.description||null,category_id:selCategory.id,project_id:selProject.id};
    const{data,error}=form.id
      ?await supabase.from("project_buildings").update(payload).eq("id",form.id).select().single()
      :await supabase.from("project_buildings").insert(payload).select().single();
    if(error){showToast(error.message,"error");return;}
    setBuildings(p=>form.id?p.map(x=>x.id===data.id?data:x):[data,...p]);
    showToast(`Building ${form.id?"updated":"created"}.`,"success");setModal(null);setForm({});
  };

  const saveUnit=async()=>{
    if(!form.unit_number?.trim()||!selBuilding){showToast("Unit number and building required","error");return;}
    const sqft=Number(form.size_sqft)||0;
    const basePx=Number(form.base_price)||0;
    const ppsf=sqft&&basePx?Math.round(basePx/sqft):Number(form.price_per_sqft)||0;
    const payload={unit_number:form.unit_number,floor:Number(form.floor)||null,view:form.view||null,bedrooms:Number(form.bedrooms)||null,bathrooms:Number(form.bathrooms)||null,size_sqft:sqft||null,balcony_sqft:Number(form.balcony_sqft)||null,total_sqft:Number(form.total_sqft)||sqft||null,base_price:basePx||null,price_per_sqft:ppsf||null,service_charge_per_sqft:Number(form.service_charge_per_sqft)||null,status:form.status||"Available",payment_plan:form.payment_plan||null,handover_date:form.handover_date||null,notes:form.notes||null,building_id:selBuilding.id,category_id:selCategory.id,project_id:selProject.id};
    const{data,error}=form.id
      ?await supabase.from("units").update(payload).eq("id",form.id).select().single()
      :await supabase.from("units").insert(payload).select().single();
    if(error){showToast(error.message,"error");return;}
    setUnits(p=>form.id?p.map(x=>x.id===data.id?data:x):[data,...p]);
    showToast(`Unit ${form.id?"updated":"created"}.`,"success");setModal(null);setForm({});
  };

  const deleteItem=async(table,id,setter)=>{
    if(!window.confirm("Delete this record? This cannot be undone."))return;
    const{error}=await supabase.from(table).delete().eq("id",id);
    if(!error){setter(p=>p.filter(x=>x.id!==id));showToast("Deleted.","info");}
    else showToast(error.message,"error");
  };

  const projCats   = selProject  ? categories.filter(c=>c.project_id===selProject.id)  : [];
  const catBuilds  = selCategory ? buildings.filter(b=>b.category_id===selCategory.id) : [];
  const buildUnits = selBuilding ? units.filter(u=>u.building_id===selBuilding.id)      : [];

  const STATUS_COLORS={Available:{c:"#1A7F5A",bg:"#E6F4EE"},Reserved:{c:"#A06810",bg:"#FDF3DC"},"Under Offer":{c:"#B85C10",bg:"#FDF0E6"},Sold:{c:"#B83232",bg:"#FAEAEA"},Blocked:{c:"#718096",bg:"#F0F2F5"}};

  const ColHeader=({title,count,onAdd,icon})=>(
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",background:"#0B1F3A",borderRadius:"10px 10px 0 0"}}>
      <div>
        <div style={{fontSize:13,fontWeight:700,color:"#fff"}}>{icon} {title}</div>
        <div style={{fontSize:11,color:"#C9A84C"}}>{count} item{count!==1?"s":""}</div>
      </div>
      {canEdit&&<button onClick={onAdd} style={{background:"#C9A84C",color:"#0B1F3A",border:"none",borderRadius:6,padding:"5px 10px",fontSize:12,fontWeight:700,cursor:"pointer"}}>+ Add</button>}
    </div>
  );

  if(loading)return <Spinner msg="Loading property database…"/>;

  return(
    <div className="fade-in" style={{display:"flex",flexDirection:"column",height:"100%"}}>
      {/* Breadcrumb */}
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:14,fontSize:13,flexWrap:"wrap"}}>
        <span style={{fontWeight:600,color:"#0B1F3A",cursor:"pointer",textDecoration:selProject?"underline":"none"}} onClick={()=>{setSelProject(null);setSelCategory(null);setSelBuilding(null);setSelUnit(null);}}>All Projects</span>
        {selProject&&<><span style={{color:"#A0AEC0"}}>›</span><span style={{fontWeight:600,color:"#0B1F3A",cursor:"pointer",textDecoration:selCategory?"underline":"none"}} onClick={()=>{setSelCategory(null);setSelBuilding(null);setSelUnit(null);}}>{selProject.name}</span></>}
        {selCategory&&<><span style={{color:"#A0AEC0"}}>›</span><span style={{fontWeight:600,color:"#0B1F3A",cursor:"pointer",textDecoration:selBuilding?"underline":"none"}} onClick={()=>{setSelBuilding(null);setSelUnit(null);}}>{selCategory.name}</span></>}
        {selBuilding&&<><span style={{color:"#A0AEC0"}}>›</span><span style={{fontWeight:600,color:"#0B1F3A"}}>{selBuilding.name}</span></>}
      </div>

      {/* 4-column master layout */}
      <div style={{flex:1,overflow:"hidden",display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1.4fr",gap:12}}>

        {/* ── PROJECTS ── */}
        <div style={{display:"flex",flexDirection:"column",background:"#fff",border:"1px solid #E2E8F0",borderRadius:10,overflow:"hidden"}}>
          <ColHeader title="Projects" count={projects.length} icon="🏙" onAdd={()=>{setForm({status:"Active"});setModal("project");}}/>
          <div style={{flex:1,overflowY:"auto"}}>
            {projects.length===0&&<Empty icon="🏙" msg="No projects yet"/>}
            {projects.map(p=>(
              <div key={p.id} onClick={()=>{setSelProject(p);setSelCategory(null);setSelBuilding(null);setSelUnit(null);}}
                style={{padding:"10px 14px",borderBottom:"1px solid #F0F2F5",cursor:"pointer",background:selProject?.id===p.id?"#0B1F3A":"#fff",transition:"background 0.15s"}}>
                <div style={{fontWeight:600,fontSize:13,color:selProject?.id===p.id?"#fff":"#0B1F3A"}}>{p.name}</div>
                <div style={{fontSize:11,color:selProject?.id===p.id?"#C9A84C":"#A0AEC0",marginTop:2}}>{p.developer||"—"} · {p.location||"—"}</div>
                <div style={{display:"flex",gap:6,marginTop:5,alignItems:"center",justifyContent:"space-between"}}>
                  <span style={{fontSize:10,fontWeight:600,padding:"2px 7px",borderRadius:10,background:p.status==="Active"?"#E6F4EE":"#F0F2F5",color:p.status==="Active"?"#1A7F5A":"#718096"}}>{p.status}</span>
                  {canEdit&&<button onClick={e=>{e.stopPropagation();setForm({...p});setModal("project");}} style={{background:"none",border:"none",color:"#A0AEC0",fontSize:11,cursor:"pointer"}}>Edit</button>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── CATEGORIES ── */}
        <div style={{display:"flex",flexDirection:"column",background:"#fff",border:"1px solid #E2E8F0",borderRadius:10,overflow:"hidden"}}>
          <ColHeader title="Categories" count={projCats.length} icon="📂" onAdd={()=>{if(!selProject){showToast("Select a project first","info");return;}setForm({type:"Flat"});setModal("category");}}/>
          <div style={{flex:1,overflowY:"auto"}}>
            {!selProject&&<Empty icon="👆" msg="Select a project"/>}
            {selProject&&projCats.length===0&&<Empty icon="📂" msg="No categories yet"/>}
            {projCats.map(c=>(
              <div key={c.id} onClick={()=>{setSelCategory(c);setSelBuilding(null);setSelUnit(null);}}
                style={{padding:"10px 14px",borderBottom:"1px solid #F0F2F5",cursor:"pointer",background:selCategory?.id===c.id?"#0B1F3A":"#fff"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div>
                    <div style={{fontWeight:600,fontSize:13,color:selCategory?.id===c.id?"#fff":"#0B1F3A"}}>{c.name}</div>
                    <TypeBadge type={c.type}/>
                  </div>
                  {canEdit&&<button onClick={e=>{e.stopPropagation();setForm({...c});setModal("category");}} style={{background:"none",border:"none",color:"#A0AEC0",fontSize:11,cursor:"pointer"}}>Edit</button>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── BUILDINGS ── */}
        <div style={{display:"flex",flexDirection:"column",background:"#fff",border:"1px solid #E2E8F0",borderRadius:10,overflow:"hidden"}}>
          <ColHeader title="Buildings / Blocks" count={catBuilds.length} icon="🏢" onAdd={()=>{if(!selCategory){showToast("Select a category first","info");return;}setForm({});setModal("building");}}/>
          <div style={{flex:1,overflowY:"auto"}}>
            {!selCategory&&<Empty icon="👆" msg="Select a category"/>}
            {selCategory&&catBuilds.length===0&&<Empty icon="🏢" msg="No buildings yet"/>}
            {catBuilds.map(b=>(
              <div key={b.id} onClick={()=>{setSelBuilding(b);setSelUnit(null);}}
                style={{padding:"10px 14px",borderBottom:"1px solid #F0F2F5",cursor:"pointer",background:selBuilding?.id===b.id?"#0B1F3A":"#fff"}}>
                <div style={{fontWeight:600,fontSize:13,color:selBuilding?.id===b.id?"#fff":"#0B1F3A"}}>{b.name}</div>
                <div style={{fontSize:11,color:selBuilding?.id===b.id?"#C9A84C":"#A0AEC0",marginTop:2}}>
                  {b.floors?`${b.floors} floors · `:""}{b.total_units?`${b.total_units} units`:""}
                </div>
                {canEdit&&<button onClick={e=>{e.stopPropagation();setForm({...b});setModal("building");}} style={{background:"none",border:"none",color:"#A0AEC0",fontSize:11,cursor:"pointer",marginTop:4}}>Edit</button>}
              </div>
            ))}
          </div>
        </div>

        {/* ── UNITS ── */}
        <div style={{display:"flex",flexDirection:"column",background:"#fff",border:"1px solid #E2E8F0",borderRadius:10,overflow:"hidden"}}>
          <ColHeader title="Units" count={buildUnits.length} icon="🔑" onAdd={()=>{if(!selBuilding){showToast("Select a building first","info");return;}setForm({status:"Available"});setModal("unit");}}/>
          <div style={{flex:1,overflowY:"auto"}}>
            {!selBuilding&&<Empty icon="👆" msg="Select a building"/>}
            {selBuilding&&buildUnits.length===0&&<Empty icon="🔑" msg="No units yet"/>}
            {buildUnits.map(u=>{
              const sc=STATUS_COLORS[u.status]||{c:"#718096",bg:"#F0F2F5"};
              const isSel=selUnit?.id===u.id;
              return(
                <div key={u.id} onClick={()=>setSelUnit(isSel?null:u)}
                  style={{padding:"10px 14px",borderBottom:"1px solid #F0F2F5",cursor:"pointer",background:isSel?"#FDF3DC":"#fff",borderLeft:isSel?"3px solid #C9A84C":"3px solid transparent"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <div style={{fontWeight:700,fontSize:13,color:"#0B1F3A"}}>Unit {u.unit_number}</div>
                    <span style={{fontSize:10,fontWeight:600,padding:"2px 7px",borderRadius:10,background:sc.bg,color:sc.c}}>{u.status}</span>
                  </div>
                  {u.bedrooms&&<div style={{fontSize:11,color:"#718096",marginTop:2}}>{u.bedrooms}BR · {u.view||"No view"} · Floor {u.floor||"—"}</div>}
                  <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
                    <div style={{fontSize:12,fontWeight:700,color:"#0B1F3A",fontFamily:"'Playfair Display',serif"}}>{fmtAED(u.base_price)}</div>
                    {u.price_per_sqft&&<div style={{fontSize:11,color:"#1A7F5A",fontWeight:600}}>AED {u.price_per_sqft.toLocaleString()}/sqft</div>}
                  </div>
                  {isSel&&(
                    <div style={{marginTop:10,padding:"10px",background:"#fff",borderRadius:8,border:"1px solid #E8C97A"}}>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:8}}>
                        {[["Size",`${u.size_sqft||0} sqft`],["Balcony",`${u.balcony_sqft||0} sqft`],["Service Chg",u.service_charge_per_sqft?`AED ${u.service_charge_per_sqft}/sqft`:"—"],["Payment",u.payment_plan||"—"],["Handover",fmtDate(u.handover_date)],["Bathrooms",u.bathrooms||"—"]].map(([l,v])=>(
                          <div key={l}><div style={{fontSize:9,color:"#A0AEC0",textTransform:"uppercase",letterSpacing:"0.5px"}}>{l}</div><div style={{fontSize:12,fontWeight:600,color:"#0B1F3A"}}>{v}</div></div>
                        ))}
                      </div>
                      {u.notes&&<div style={{fontSize:11,color:"#718096",marginBottom:8}}>{u.notes}</div>}
                      {canEdit&&(
                        <div style={{display:"flex",gap:6}}>
                          <Btn small variant="outline" onClick={e=>{e.stopPropagation();setForm({...u});setModal("unit");}}>Edit</Btn>
                          <Btn small variant="danger" onClick={e=>{e.stopPropagation();deleteItem("units",u.id,setUnits);}}>Delete</Btn>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── PROJECT MODAL ── */}
      {modal==="project"&&(
        <Modal title={form.id?"Edit Project":"Add Project"} onClose={()=>{setModal(null);setForm({});}}>
          <G2><FF label="Project Name" required><input value={form.name||""} onChange={e=>sf("name",e.target.value)} placeholder="Emaar Beachfront"/></FF>
          <FF label="Developer"><input value={form.developer||""} onChange={e=>sf("developer",e.target.value)} placeholder="Emaar Properties"/></FF></G2>
          <FF label="Location"><input value={form.location||""} onChange={e=>sf("location",e.target.value)} placeholder="Dubai Harbour, Dubai"/></FF>
          <G2><FF label="Launch Date"><input type="date" value={form.launch_date||""} onChange={e=>sf("launch_date",e.target.value)}/></FF>
          <FF label="Handover Date"><input type="date" value={form.handover_date||""} onChange={e=>sf("handover_date",e.target.value)}/></FF></G2>
          <FF label="Status"><select value={form.status||"Active"} onChange={e=>sf("status",e.target.value)}>{["Active","Completed","On Hold","Cancelled"].map(s=><option key={s}>{s}</option>)}</select></FF>
          <FF label="Description"><textarea value={form.description||""} onChange={e=>sf("description",e.target.value)} rows={3}/></FF>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            {form.id&&<Btn variant="danger" onClick={()=>deleteItem("projects",form.id,setProjects)}>Delete</Btn>}
            <Btn variant="outline" onClick={()=>{setModal(null);setForm({});}}>Cancel</Btn>
            <Btn onClick={saveProject}>{form.id?"Save Changes":"Create Project"}</Btn>
          </div>
        </Modal>
      )}

      {/* ── CATEGORY MODAL ── */}
      {modal==="category"&&(
        <Modal title={form.id?"Edit Category":"Add Category"} onClose={()=>{setModal(null);setForm({});}}>
          <G2><FF label="Category Name" required><input value={form.name||""} onChange={e=>sf("name",e.target.value)} placeholder="Waterfront Villas"/></FF>
          <FF label="Unit Type" required><select value={form.type||"Flat"} onChange={e=>sf("type",e.target.value)}>{UNIT_TYPES.map(t=><option key={t}>{t}</option>)}</select></FF></G2>
          <FF label="Description"><textarea value={form.description||""} onChange={e=>sf("description",e.target.value)} rows={2}/></FF>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            {form.id&&<Btn variant="danger" onClick={()=>deleteItem("project_categories",form.id,setCategories)}>Delete</Btn>}
            <Btn variant="outline" onClick={()=>{setModal(null);setForm({});}}>Cancel</Btn>
            <Btn onClick={saveCategory}>{form.id?"Save Changes":"Create Category"}</Btn>
          </div>
        </Modal>
      )}

      {/* ── BUILDING MODAL ── */}
      {modal==="building"&&(
        <Modal title={form.id?"Edit Building":"Add Building"} onClose={()=>{setModal(null);setForm({});}}>
          <FF label="Building / Block Name" required><input value={form.name||""} onChange={e=>sf("name",e.target.value)} placeholder="Tower A / Block 3 / Villa Cluster B"/></FF>
          <G2><FF label="Number of Floors"><input type="number" value={form.floors||""} onChange={e=>sf("floors",e.target.value)}/></FF>
          <FF label="Total Units"><input type="number" value={form.total_units||""} onChange={e=>sf("total_units",e.target.value)}/></FF></G2>
          <FF label="Description"><textarea value={form.description||""} onChange={e=>sf("description",e.target.value)} rows={2}/></FF>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            {form.id&&<Btn variant="danger" onClick={()=>deleteItem("project_buildings",form.id,setBuildings)}>Delete</Btn>}
            <Btn variant="outline" onClick={()=>{setModal(null);setForm({});}}>Cancel</Btn>
            <Btn onClick={saveBuilding}>{form.id?"Save Changes":"Create Building"}</Btn>
          </div>
        </Modal>
      )}

      {/* ── UNIT MODAL ── */}
      {modal==="unit"&&(
        <Modal title={form.id?"Edit Unit":"Add Unit"} onClose={()=>{setModal(null);setForm({});}} width={600}>
          <G3>
            <FF label="Unit Number" required><input value={form.unit_number||""} onChange={e=>sf("unit_number",e.target.value)} placeholder="101"/></FF>
            <FF label="Floor"><input type="number" value={form.floor||""} onChange={e=>sf("floor",e.target.value)} placeholder="1"/></FF>
            <FF label="Status"><select value={form.status||"Available"} onChange={e=>sf("status",e.target.value)}>{["Available","Reserved","Under Offer","Sold","Blocked"].map(s=><option key={s}>{s}</option>)}</select></FF>
          </G3>
          <G2>
            <FF label="Bedrooms"><input type="number" value={form.bedrooms||""} onChange={e=>sf("bedrooms",e.target.value)} placeholder="2"/></FF>
            <FF label="Bathrooms"><input type="number" value={form.bathrooms||""} onChange={e=>sf("bathrooms",e.target.value)} placeholder="3"/></FF>
          </G2>
          <FF label="View"><select value={form.view||""} onChange={e=>sf("view",e.target.value)}><option value="">Select view…</option>{VIEWS.map(v=><option key={v}>{v}</option>)}</select></FF>
          <G3>
            <FF label="Size (sqft)"><input type="number" value={form.size_sqft||""} onChange={e=>sf("size_sqft",e.target.value)} placeholder="1250"/></FF>
            <FF label="Balcony (sqft)"><input type="number" value={form.balcony_sqft||""} onChange={e=>sf("balcony_sqft",e.target.value)} placeholder="200"/></FF>
            <FF label="Total (sqft)"><input type="number" value={form.total_sqft||""} onChange={e=>sf("total_sqft",e.target.value)} placeholder="1450"/></FF>
          </G3>
          <G3>
            <FF label="Base Price (AED)"><input type="number" value={form.base_price||""} onChange={e=>sf("base_price",e.target.value)} placeholder="1500000"/></FF>
            <FF label="Price / sqft"><input type="number" value={form.price_per_sqft||""} onChange={e=>sf("price_per_sqft",e.target.value)} placeholder="1200"/></FF>
            <FF label="Service Charge / sqft"><input type="number" value={form.service_charge_per_sqft||""} onChange={e=>sf("service_charge_per_sqft",e.target.value)} placeholder="18"/></FF>
          </G3>
          <G2>
            <FF label="Payment Plan"><input value={form.payment_plan||""} onChange={e=>sf("payment_plan",e.target.value)} placeholder="40/60 · 10/90 · 5yr post-handover"/></FF>
            <FF label="Handover Date"><input type="date" value={form.handover_date||""} onChange={e=>sf("handover_date",e.target.value)}/></FF>
          </G2>
          <FF label="Notes"><textarea value={form.notes||""} onChange={e=>sf("notes",e.target.value)} rows={2} placeholder="Special features, floor plan notes…"/></FF>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            {form.id&&<Btn variant="danger" onClick={()=>deleteItem("units",form.id,setUnits)}>Delete</Btn>}
            <Btn variant="outline" onClick={()=>{setModal(null);setForm({});}}>Cancel</Btn>
            <Btn onClick={saveUnit}>{form.id?"Save Changes":"Create Unit"}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// LEADS (v3 — stage gates, comms, meetings, followups)
// ══════════════════════════════════════════════════════
function Leads({leads,setLeads,properties,activities,setActivities,discounts,setDiscounts,currentUser,users,showToast}){
  const[search,setSearch]=useState("");
  const[fStage,setFStage]=useState("All");
  const[fType,setFType]=useState("All");
  const[sel,setSel]=useState(null);
  const[activeTab,setActiveTab]=useState("details"); // details|comms|meetings|followups
  const[showAdd,setShowAdd]=useState(false);
  const[showComm,setShowComm]=useState(null); // "whatsapp"|"email"|"call"|"note"
  const[showMeeting,setShowMeeting]=useState(false);
  const[showFollowup,setShowFollowup]=useState(false);
  const[showStageChange,setShowStageChange]=useState(null); // target stage
  const[showReversal,setShowReversal]=useState(false);
  const[reversalReason,setReversalReason]=useState("");
  const[reversalStage,setReversalStage]=useState("");
  const[meetings,setMeetings]=useState([]);
  const[followups,setFollowups]=useState([]);
  const[units,setUnits]=useState([]);
  const[projects,setProjects]=useState([]);
  const[saving,setSaving]=useState(false);
  const[showDisc,setShowDisc]=useState(false);
  const[discForm,setDiscForm]=useState({type:"sale_price",discount_pct:"",original_value:"",requested_value:"",reason:""});
  const[gateErrors,setGateErrors]=useState([]);
  const blank={name:"",email:"",phone:"",whatsapp:"",nationality:"",source:"Referral",stage:"New Lead",property_type:"Residential",budget:"",notes:"",assigned_to:currentUser.id,property_id:"",unit_id:"",project_id:"",proposal_notes:"",final_price:"",payment_plan:""};
  const[form,setForm]=useState(blank);
  const[commForm,setCommForm]=useState({type:"Call",note:"",template:"",subject:""});
  const[meetForm,setMeetForm]=useState({title:"",type:"Meeting",scheduled_at:"",duration_min:60,location:"",notes:""});
  const[followForm,setFollowForm]=useState({type:"Call",due_at:"",note:""});

  const visible=can(currentUser.role,"see_all")?leads:leads.filter(l=>l.assigned_to===currentUser.id);
  const filtered=useMemo(()=>visible.filter(l=>{
    const q=search.toLowerCase();
    return(l.name.toLowerCase().includes(q)||l.email?.toLowerCase().includes(q))
      &&(fStage==="All"||l.stage===fStage)&&(fType==="All"||l.property_type===fType);
  }),[visible,search,fStage,fType]);

  const selLead=sel?leads.find(l=>l.id===sel):null;
  const selMeetings=meetings.filter(m=>m.lead_id===sel).sort((a,b)=>new Date(a.scheduled_at)-new Date(b.scheduled_at));
  const selFollowups=followups.filter(f=>f.lead_id===sel).sort((a,b)=>new Date(a.due_at)-new Date(b.due_at));
  const selActivities=activities.filter(a=>a.lead_id===sel).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  const canEdit=can(currentUser.role,"write");
  const canDelete=can(currentUser.role,"delete_leads");

  // Load meetings, followups, units, projects on mount
  useEffect(()=>{
    const loadExtra=async()=>{ /* disabled */ };
    loadExtra();
  },[]);

  const sf=(k,v)=>setForm(f=>({...f,[k]:v}));

  // ── SAVE LEAD ─────────────────────────────────────────
  const saveLead=async()=>{
    if(!form.name.trim()){showToast("Name is required.","error");return;}
    setSaving(true);
    try{
      const payload={name:form.name,email:form.email,phone:form.phone,whatsapp:form.whatsapp||null,nationality:form.nationality||null,source:form.source,stage:form.stage,property_type:form.property_type,budget:Number(form.budget)||0,notes:form.notes,assigned_to:form.assigned_to||currentUser.id,property_id:form.property_id||null,unit_id:form.unit_id||null,project_id:form.project_id||null,proposal_notes:form.proposal_notes||null,final_price:Number(form.final_price)||null,payment_plan:form.payment_plan||null,created_by:currentUser.id,stage_history:JSON.stringify([{stage:form.stage,at:new Date().toISOString(),by:currentUser.full_name}])};
      const{data,error}=await supabase.from("leads").insert(payload).select().single();
      if(error)throw error;
      setLeads(p=>[data,...p]);showToast("Lead added.","success");setShowAdd(false);setForm(blank);
    }catch(e){showToast(e.message,"error");}
    finally{setSaving(false);}
  };

  // ── STAGE CHANGE with GATE ─────────────────────────────
  const requestStageChange=async(targetStage)=>{
    if(!selLead||!canEdit)return;
    const currentOrder=STAGE_META[selLead.stage]?.order??0;
    const targetOrder=STAGE_META[targetStage]?.order??0;
    // Reversal
    if(targetOrder<currentOrder){
      setReversalStage(targetStage);setReversalReason("");setShowReversal(true);return;
    }
    // Gate check
    const errors=checkGate(targetStage,selLead);
    if(errors.length>0){setGateErrors(errors);setShowStageChange(targetStage);return;}
    // All good — apply
    await applyStageChange(targetStage,"");
  };

  const applyStageChange=async(targetStage,reason)=>{
    const history=JSON.parse(selLead.stage_history||"[]");
    history.push({stage:targetStage,from:selLead.stage,at:new Date().toISOString(),by:currentUser.full_name,reason:reason||undefined});
    const{error}=await supabase.from("leads").update({stage:targetStage,stage_history:JSON.stringify(history)}).eq("id",sel);
    if(!error){
      setLeads(p=>p.map(l=>l.id===sel?{...l,stage:targetStage,stage_history:JSON.stringify(history)}:l));
      // Log activity
      await supabase.from("activities").insert({lead_id:sel,type:"Note",note:`Stage changed: ${selLead.stage} → ${targetStage}${reason?` (Reason: ${reason})`:""}`,user_id:currentUser.id,user_name:currentUser.full_name,lead_name:selLead.name});
      setActivities(p=>[{id:uid(),lead_id:sel,type:"Note",note:`Stage changed: ${selLead.stage} → ${targetStage}${reason?` (Reason: ${reason})`:""}`,user_name:currentUser.full_name,created_at:new Date().toISOString()},...p]);
      showToast(`Stage updated to ${targetStage}`,"success");
    }else showToast(error.message,"error");
    setShowStageChange(null);setShowReversal(false);setGateErrors([]);
  };

  // ── UPDATE LEAD FIELD ──────────────────────────────────
  const updateLeadField=async(field,value)=>{
    const{error}=await supabase.from("leads").update({[field]:value}).eq("id",sel);
    if(!error)setLeads(p=>p.map(l=>l.id===sel?{...l,[field]:value}:l));
    else showToast(error.message,"error");
  };

  // ── LOG ACTIVITY / COMMS ──────────────────────────────
  const saveComm=async()=>{
    if(!commForm.note.trim()||!selLead)return;
    setSaving(true);
    try{
      const{data,error}=await supabase.from("activities").insert({lead_id:sel,type:commForm.type,note:commForm.note,user_id:currentUser.id,user_name:currentUser.full_name,lead_name:selLead.name}).select().single();
      if(error)throw error;
      setActivities(p=>[data,...p]);showToast(`${commForm.type} logged.`,"success");setShowComm(null);setCommForm({type:"Call",note:"",template:"",subject:""});
    }catch(e){showToast(e.message,"error");}
    finally{setSaving(false);}
  };

  // ── SCHEDULE MEETING ──────────────────────────────────
  const saveMeeting=async()=>{
    if(!meetForm.title.trim()||!meetForm.scheduled_at){showToast("Title and date/time required","error");return;}
    setSaving(true);
    try{
      const{data,error}=await supabase.from("meetings").insert({lead_id:sel,title:meetForm.title,type:meetForm.type,scheduled_at:meetForm.scheduled_at,duration_min:Number(meetForm.duration_min)||60,location:meetForm.location||null,notes:meetForm.notes||null,status:"Scheduled",assigned_to:currentUser.id,user_name:currentUser.full_name,lead_name:selLead.name}).select().single();
      if(error)throw error;
      setMeetings(p=>[data,...p]);
      // Mark meeting_scheduled on lead
      await updateLeadField("meeting_scheduled",true);
      // Log activity
      await supabase.from("activities").insert({lead_id:sel,type:"Meeting",note:`Meeting scheduled: ${meetForm.title} on ${fmtDT(meetForm.scheduled_at)}`,user_id:currentUser.id,user_name:currentUser.full_name,lead_name:selLead.name});
      showToast("Meeting scheduled.","success");setShowMeeting(false);setMeetForm({title:"",type:"Meeting",scheduled_at:"",duration_min:60,location:"",notes:""});
    }catch(e){showToast(e.message,"error");}
    finally{setSaving(false);}
  };

  // ── FOLLOWUP ──────────────────────────────────────────
  const saveFollowup=async()=>{
    if(!followForm.due_at){showToast("Due date required","error");return;}
    setSaving(true);
    try{
      const{data,error}=await supabase.from("followups").insert({lead_id:sel,type:followForm.type,due_at:followForm.due_at,note:followForm.note||null,status:"Pending",assigned_to:currentUser.id,user_name:currentUser.full_name,lead_name:selLead.name}).select().single();
      if(error)throw error;
      setFollowups(p=>[data,...p]);showToast("Follow-up set.","success");setShowFollowup(false);setFollowForm({type:"Call",due_at:"",note:""});
    }catch(e){showToast(e.message,"error");}
    finally{setSaving(false);}
  };

  const markFollowupDone=async(id)=>{
    const{error}=await supabase.from("followups").update({status:"Done"}).eq("id",id);
    if(!error)setFollowups(p=>p.map(f=>f.id===id?{...f,status:"Done"}:f));
  };

  const deleteLead=async()=>{
    if(!canDelete){showToast("You don't have permission to delete leads.","error");return;}
    if(!window.confirm("Delete this lead permanently?"))return;
    const{error}=await supabase.from("leads").delete().eq("id",sel);
    if(!error){setLeads(p=>p.filter(l=>l.id!==sel));setSel(null);showToast("Lead deleted.","info");}
    else showToast(error.message,"error");
  };

  // WhatsApp template fill
  const fillTemplate=(tpl)=>{
    const lead=selLead;
    let text=tpl.text
      .replace("{name}",lead?.name||"")
      .replace("{agent}",currentUser.full_name||"")
      .replace("{type}",lead?.property_type||"property")
      .replace("{project}",projects.find(p=>p.id===lead?.project_id)?.name||"the project")
      .replace("{date}","");
    setCommForm(f=>({...f,note:text,template:tpl.id}));
  };

  const MEET_STATUS_COLOR={Scheduled:{c:"#1A5FA8",bg:"#E6EFF9"},Completed:{c:"#1A7F5A",bg:"#E6F4EE"},Cancelled:{c:"#B83232",bg:"#FAEAEA"},"No Show":{c:"#A06810",bg:"#FDF3DC"},Rescheduled:{c:"#5B3FAA",bg:"#EEE8F9"}};
  const FOLLOW_STATUS_COLOR={Pending:{c:"#A06810",bg:"#FDF3DC"},Done:{c:"#1A7F5A",bg:"#E6F4EE"},Overdue:{c:"#B83232",bg:"#FAEAEA"}};
  const overdueFollowups=followups.filter(f=>f.status==="Pending"&&new Date(f.due_at)<new Date());

  return(
    <div className="fade-in" style={{display:"flex",gap:14,height:"100%"}}>
      {/* ── LEAD LIST ── */}
      <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0}}>
        {/* Overdue followup banner */}
        {overdueFollowups.length>0&&(
          <div style={{background:"#FDF3DC",border:"1px solid #E8C97A",borderRadius:8,padding:"8px 14px",marginBottom:10,display:"flex",alignItems:"center",gap:10,fontSize:12}}>
            <span style={{fontSize:16}}>⏰</span>
            <span style={{fontWeight:600,color:"#A06810"}}>{overdueFollowups.length} overdue follow-up{overdueFollowups.length>1?"s":""}</span>
            <span style={{color:"#718096"}}>— check the Follow-ups tab on each lead</span>
          </div>
        )}
        {/* Toolbar */}
        <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap"}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍  Search name or email…" style={{flex:1,minWidth:160}}/>
          <select value={fStage} onChange={e=>setFStage(e.target.value)} style={{width:"auto"}}>
            <option value="All">All stages</option>{STAGES.map(s=><option key={s}>{s}</option>)}
          </select>
          <select value={fType} onChange={e=>setFType(e.target.value)} style={{width:"auto"}}>
            <option value="All">All types</option>{PROP_TYPES.map(t=><option key={t}>{t}</option>)}
          </select>
          {canEdit&&<Btn onClick={()=>{setForm(blank);setShowAdd(true);}}>+ Add Lead</Btn>}
        </div>
        <div style={{fontSize:12,color:"#A0AEC0",marginBottom:8}}>{filtered.length} lead{filtered.length!==1?"s":""}</div>
        <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:7}}>
          {filtered.length===0&&<Empty icon="👤" msg="No leads match your filters"/>}
          {filtered.map(l=>{
            const overdue=followups.filter(f=>f.lead_id===l.id&&f.status==="Pending"&&new Date(f.due_at)<new Date()).length;
            return(
              <div key={l.id} onClick={()=>{setSel(sel===l.id?null:l.id);setActiveTab("details");}} className="ch"
                style={{background:sel===l.id?"#0B1F3A":"#fff",border:`1px solid ${sel===l.id?"#C9A84C":"#E2E8F0"}`,borderRadius:10,padding:"11px 14px",cursor:"pointer"}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <Av name={l.name} size={38} bg={sel===l.id?"#C9A84C":"#0B1F3A"} tc={sel===l.id?"#0B1F3A":"#C9A84C"}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:600,fontSize:14,color:sel===l.id?"#fff":"#0B1F3A",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{l.name}</div>
                    <div style={{fontSize:12,color:sel===l.id?"#C9A84C88":"#A0AEC0"}}>{l.email}</div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <StageBadge stage={l.stage}/>
                    <div style={{fontSize:11,color:sel===l.id?"#C9A84C":"#1A7F5A",fontWeight:600,marginTop:4}}>{fmtM(l.budget)}</div>
                    {overdue>0&&<div style={{fontSize:10,background:"#FAEAEA",color:"#B83232",padding:"1px 6px",borderRadius:10,fontWeight:600,marginTop:3}}>⏰ {overdue} overdue</div>}
                  </div>
                </div>
                <div style={{display:"flex",gap:6,marginTop:7,alignItems:"center",flexWrap:"wrap"}}>
                  <TypeBadge type={l.property_type}/>
                  <span style={{fontSize:11,color:sel===l.id?"#C9A84C55":"#A0AEC0"}}>👤 {users.find(u=>u.id===l.assigned_to)?.full_name||"Unassigned"}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── LEAD DETAIL PANEL ── */}
      {selLead&&(
        <div className="slide-in" style={{width:400,background:"#fff",border:"1px solid #E2E8F0",borderRadius:12,display:"flex",flexDirection:"column",flexShrink:0,overflow:"hidden"}}>
          {/* Header */}
          <div style={{background:"#0B1F3A",padding:"1.25rem",position:"relative"}}>
            <button onClick={()=>setSel(null)} style={{position:"absolute",top:10,right:12,background:"none",border:"none",color:"#C9A84C",fontSize:20,cursor:"pointer"}}>×</button>
            <Av name={selLead.name} size={44} bg="#C9A84C" tc="#0B1F3A"/>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:17,color:"#fff",fontWeight:700,marginTop:8}}>{selLead.name}</div>
            <div style={{fontSize:12,color:"#C9A84C",marginTop:1}}>{selLead.email} {selLead.phone&&`· ${selLead.phone}`}</div>
            {selLead.nationality&&<div style={{fontSize:11,color:"#C9A84C88"}}>🌍 {selLead.nationality}</div>}
            <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>
              <StageBadge stage={selLead.stage}/><TypeBadge type={selLead.property_type}/>
            </div>
          </div>

          {/* Action bar */}
          {canEdit&&(
            <div style={{display:"flex",gap:6,padding:"10px 14px",borderBottom:"1px solid #F0F2F5",flexWrap:"wrap"}}>
              <Btn small variant="wa" onClick={()=>{setCommForm({type:"WhatsApp",note:"",template:"",subject:""});setShowComm("whatsapp");}}>💬 WhatsApp</Btn>
              <Btn small variant="outline" onClick={()=>{setCommForm({type:"Email",note:"",template:"",subject:""});setShowComm("email");}}>✉ Email</Btn>
              <Btn small variant="outline" onClick={()=>{setCommForm({type:"Call",note:"",template:"",subject:""});setShowComm("call");}}>📞 Call</Btn>
              <Btn small variant="gold" onClick={()=>setShowMeeting(true)}>🗓 Meeting</Btn>
              <Btn small variant="outline" onClick={()=>setShowFollowup(true)}>⏰ Follow-up</Btn>
            </div>
          )}

          {/* Sub-tabs */}
          <div style={{display:"flex",borderBottom:"1px solid #F0F2F5",padding:"0 14px"}}>
            {[["details","Details"],["comms","Comms"],["meetings","Meetings"],["followups","Follow-ups"]].map(([id,label])=>{
              const cnt=id==="comms"?selActivities.length:id==="meetings"?selMeetings.length:id==="followups"?selFollowups.length:0;
              return(
                <button key={id} onClick={()=>setActiveTab(id)} style={{padding:"10px 10px 8px",border:"none",borderBottom:`2px solid ${activeTab===id?"#C9A84C":"transparent"}`,background:"none",fontSize:12,fontWeight:activeTab===id?600:400,color:activeTab===id?"#0B1F3A":"#A0AEC0",cursor:"pointer",whiteSpace:"nowrap"}}>
                  {label}{cnt>0&&<span style={{marginLeft:5,background:"#F0F2F5",color:"#718096",fontSize:10,padding:"1px 5px",borderRadius:10}}>{cnt}</span>}
                </button>
              );
            })}
          </div>

          <div style={{flex:1,overflowY:"auto",padding:"1rem"}}>

            {/* ── DETAILS TAB ── */}
            {activeTab==="details"&&(
              <>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,background:"#FAFBFC",borderRadius:10,padding:"12px",marginBottom:12}}>
                  <FR label="Budget"      value={fmtM(selLead.budget)}/>
                  <FR label="Source"      value={selLead.source}/>
                  <FR label="WhatsApp"    value={selLead.whatsapp||selLead.phone}/>
                  <FR label="Assigned To" value={users.find(u=>u.id===selLead.assigned_to)?.full_name||"—"}/>
                  <FR label="Created"     value={fmtDate(selLead.created_at)}/>
                  <FR label="Nationality" value={selLead.nationality||"—"}/>
                </div>

                {/* Linked unit */}
                {selLead.unit_id&&(()=>{
                  const u=units.find(x=>x.id===selLead.unit_id);
                  const proj=projects.find(p=>p.id===selLead.project_id);
                  return u?(
                    <div style={{border:"1.5px solid #C9A84C",borderRadius:10,padding:"10px 12px",marginBottom:12,background:"#FDF8EE"}}>
                      <div style={{fontSize:10,color:"#A06810",textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:5,fontWeight:700}}>🔑 Linked Unit</div>
                      <div style={{fontWeight:700,fontSize:13,color:"#0B1F3A"}}>{proj?.name} — Unit {u.unit_number}</div>
                      <div style={{fontSize:12,color:"#718096"}}>{u.bedrooms}BR · {u.view||"—"} · Floor {u.floor||"—"}</div>
                      <div style={{fontSize:13,fontWeight:700,color:"#C9A84C",fontFamily:"'Playfair Display',serif",marginTop:4}}>{fmtAED(u.base_price)}</div>
                      {u.price_per_sqft&&<div style={{fontSize:11,color:"#1A7F5A"}}>AED {u.price_per_sqft.toLocaleString()}/sqft · {u.payment_plan||"—"}</div>}
                    </div>
                  ):null;
                })()}

                {/* Proposal notes */}
                {selLead.proposal_notes&&(
                  <div style={{borderLeft:"3px solid #5B3FAA",padding:"8px 10px 8px 12px",marginBottom:12,background:"#F3E8F9",borderRadius:"0 8px 8px 0"}}>
                    <div style={{fontSize:10,color:"#5B3FAA",textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:3,fontWeight:600}}>Proposal Notes</div>
                    <div style={{fontSize:13,color:"#4A5568",lineHeight:1.6}}>{selLead.proposal_notes}</div>
                  </div>
                )}

                {/* Final price / payment */}
                {(selLead.final_price||selLead.payment_plan)&&(
                  <div style={{background:"#E6F4EE",border:"1px solid #A8D5BE",borderRadius:10,padding:"10px 12px",marginBottom:12}}>
                    <div style={{fontSize:10,color:"#1A7F5A",textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:5,fontWeight:700}}>💰 Deal Terms</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                      <FR label="Final Price" value={fmtAED(selLead.final_price)}/>
                      <FR label="Payment Plan" value={selLead.payment_plan}/>
                    </div>
                  </div>
                )}

                {/* Notes */}
                {selLead.notes&&(
                  <div style={{borderLeft:"3px solid #C9A84C",padding:"10px 10px 10px 12px",marginBottom:12,background:"#FDFBF4",borderRadius:"0 8px 8px 0"}}>
                    <div style={{fontSize:10,color:"#A0AEC0",textTransform:"uppercase",letterSpacing:"0.6px",marginBottom:4}}>Notes</div>
                    <div style={{fontSize:13,color:"#4A5568",lineHeight:1.6}}>{selLead.notes}</div>
                  </div>
                )}

                {/* Stage history */}
                {selLead.stage_history&&(()=>{
                  let hist=[];try{hist=JSON.parse(selLead.stage_history);}catch{}
                  return hist.length>0?(
                    <div style={{marginBottom:12}}>
                      <div style={{fontSize:10,color:"#A0AEC0",textTransform:"uppercase",letterSpacing:"0.6px",marginBottom:8,fontWeight:600}}>Stage History</div>
                      {hist.slice(-4).reverse().map((h,i)=>(
                        <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0",borderBottom:"1px solid #F0F2F5"}}>
                          <StageBadge stage={h.stage}/>
                          <span style={{fontSize:11,color:"#A0AEC0"}}>{fmtDate(h.at)} · {h.by}</span>
                          {h.reason&&<span style={{fontSize:11,color:"#B83232"}}>↩ {h.reason}</span>}
                        </div>
                      ))}
                    </div>
                  ):null;
                })()}

                {/* Stage mover */}
                {canEdit&&(
                  <div style={{marginBottom:12}}>
                    <div style={{fontSize:10,color:"#A0AEC0",textTransform:"uppercase",letterSpacing:"0.6px",marginBottom:8,fontWeight:600}}>Move Stage</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                      {STAGES.map(s=>{
                        const isCurrent=selLead.stage===s;
                        const targetOrder=STAGE_META[s]?.order??0;
                        const currentOrder=STAGE_META[selLead.stage]?.order??0;
                        const isReversal=targetOrder<currentOrder;
                        return(
                          <button key={s} onClick={()=>requestStageChange(s)}
                            style={{fontSize:10,padding:"4px 9px",borderRadius:20,border:`1.5px solid ${isCurrent?"#0B1F3A":isReversal?"#F0BCBC":"#E2E8F0"}`,background:isCurrent?"#0B1F3A":isReversal?"#FAEAEA":"#fff",color:isCurrent?"#fff":isReversal?"#B83232":"#4A5568",cursor:isCurrent?"default":"pointer",fontWeight:isCurrent?700:400}}>
                            {isReversal&&"↩ "}{s}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Quick edit fields */}
                {canEdit&&(
                  <div style={{marginBottom:12}}>
                    <div style={{fontSize:10,color:"#A0AEC0",textTransform:"uppercase",letterSpacing:"0.6px",marginBottom:8,fontWeight:600}}>Quick Update</div>
                    <G2>
                      <div>
                        <label style={{fontSize:10,color:"#A0AEC0",display:"block",marginBottom:3}}>FINAL PRICE</label>
                        <input type="number" defaultValue={selLead.final_price||""} onBlur={e=>updateLeadField("final_price",Number(e.target.value)||null)} placeholder="AED" style={{fontSize:12,padding:"6px 8px"}}/>
                      </div>
                      <div>
                        <label style={{fontSize:10,color:"#A0AEC0",display:"block",marginBottom:3}}>PAYMENT PLAN</label>
                        <input defaultValue={selLead.payment_plan||""} onBlur={e=>updateLeadField("payment_plan",e.target.value||null)} placeholder="40/60…" style={{fontSize:12,padding:"6px 8px"}}/>
                      </div>
                    </G2>
                    <div style={{marginTop:8}}>
                      <label style={{fontSize:10,color:"#A0AEC0",display:"block",marginBottom:3}}>PROPOSAL NOTES</label>
                      <textarea defaultValue={selLead.proposal_notes||""} onBlur={e=>updateLeadField("proposal_notes",e.target.value||null)} rows={2} placeholder="Proposal details…" style={{fontSize:12,padding:"6px 8px"}}/>
                    </div>
                  </div>
                )}

                <div style={{display:"flex",gap:8}}>
                  {canDelete&&<Btn variant="danger" small full onClick={deleteLead}>Delete Lead</Btn>}
                </div>
              </>
            )}

            {/* ── COMMS TAB ── */}
            {activeTab==="comms"&&(
              <div>
                {selActivities.length===0&&<Empty icon="💬" msg="No communications logged yet"/>}
                {selActivities.map(act=>{
                  const m=ACT_META[act.type]||ACT_META.Note;
                  return(
                    <div key={act.id} style={{display:"flex",gap:10,padding:"10px",background:"#FAFBFC",borderRadius:10,border:"1px solid #F0F2F5",marginBottom:8}}>
                      <div style={{width:32,height:32,borderRadius:8,background:m.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,flexShrink:0}}>{m.icon}</div>
                      <div style={{minWidth:0,flex:1}}>
                        <div style={{fontSize:12,fontWeight:600,color:m.c}}>{act.type}</div>
                        <div style={{fontSize:12,color:"#4A5568",lineHeight:1.5,marginTop:2}}>{act.note}</div>
                        <div style={{fontSize:10,color:"#A0AEC0",marginTop:3}}>{act.user_name} · {fmtDate(act.created_at)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── MEETINGS TAB ── */}
            {activeTab==="meetings"&&(
              <div>
                {selMeetings.length===0&&<Empty icon="🗓" msg="No meetings scheduled yet"/>}
                {selMeetings.map(m=>{
                  const sc=MEET_STATUS_COLOR[m.status]||{c:"#718096",bg:"#F0F2F5"};
                  return(
                    <div key={m.id} style={{padding:"12px",background:"#FAFBFC",borderRadius:10,border:"1px solid #F0F2F5",marginBottom:8}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                        <div style={{fontWeight:600,fontSize:13,color:"#0B1F3A"}}>{m.title}</div>
                        <span style={{fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:10,background:sc.bg,color:sc.c}}>{m.status}</span>
                      </div>
                      <div style={{fontSize:12,color:"#718096"}}>📅 {fmtDT(m.scheduled_at)} · {m.duration_min}min</div>
                      {m.location&&<div style={{fontSize:12,color:"#718096"}}>📍 {m.location}</div>}
                      {m.notes&&<div style={{fontSize:12,color:"#4A5568",marginTop:4}}>{m.notes}</div>}
                      {canEdit&&(
                        <div style={{display:"flex",gap:6,marginTop:8}}>
                          {m.status==="Scheduled"&&<Btn small variant="green" onClick={async()=>{const{error}=await supabase.from("meetings").update({status:"Completed"}).eq("id",m.id);if(!error)setMeetings(p=>p.map(x=>x.id===m.id?{...x,status:"Completed"}:x));}}>✓ Completed</Btn>}
                          {m.status==="Scheduled"&&<Btn small variant="danger" onClick={async()=>{const{error}=await supabase.from("meetings").update({status:"No Show"}).eq("id",m.id);if(!error)setMeetings(p=>p.map(x=>x.id===m.id?{...x,status:"No Show"}:x));}}>No Show</Btn>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── FOLLOWUPS TAB ── */}
            {activeTab==="followups"&&(
              <div>
                {selFollowups.length===0&&<Empty icon="⏰" msg="No follow-ups set"/>}
                {selFollowups.map(f=>{
                  const isOverdue=f.status==="Pending"&&new Date(f.due_at)<new Date();
                  const sc=isOverdue?{c:"#B83232",bg:"#FAEAEA"}:FOLLOW_STATUS_COLOR[f.status]||{c:"#718096",bg:"#F0F2F5"};
                  return(
                    <div key={f.id} style={{padding:"12px",background:isOverdue?"#FFF8F8":"#FAFBFC",borderRadius:10,border:`1px solid ${isOverdue?"#F0BCBC":"#F0F2F5"}`,marginBottom:8}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <span style={{fontSize:14}}>{ACT_META[f.type]?.icon||"📋"}</span>
                          <span style={{fontWeight:600,fontSize:13,color:"#0B1F3A"}}>{f.type}</span>
                          {isOverdue&&<span style={{fontSize:10,fontWeight:700,color:"#B83232"}}>OVERDUE</span>}
                        </div>
                        <span style={{fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:10,background:sc.bg,color:sc.c}}>{isOverdue?"Overdue":f.status}</span>
                      </div>
                      <div style={{fontSize:12,color:"#718096"}}>📅 Due: {fmtDT(f.due_at)}</div>
                      {f.note&&<div style={{fontSize:12,color:"#4A5568",marginTop:4}}>{f.note}</div>}
                      {f.status==="Pending"&&canEdit&&(
                        <Btn small variant="green" style={{marginTop:8}} onClick={()=>markFollowupDone(f.id)}>✓ Mark Done</Btn>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ADD LEAD MODAL ── */}
      {showAdd&&(
        <Modal title="Add New Lead" onClose={()=>setShowAdd(false)} width={580}>
          <G2>
            <FF label="Full Name" required><input value={form.name} onChange={e=>sf("name",e.target.value)} placeholder="Ahmed Al Mansoori"/></FF>
            <FF label="Nationality"><input value={form.nationality} onChange={e=>sf("nationality",e.target.value)} placeholder="Emirati / British…"/></FF>
          </G2>
          <G2>
            <FF label="Phone" required><input value={form.phone} onChange={e=>sf("phone",e.target.value)} placeholder="+971 50 000 0000"/></FF>
            <FF label="WhatsApp Number"><input value={form.whatsapp} onChange={e=>sf("whatsapp",e.target.value)} placeholder="Same as phone or different"/></FF>
          </G2>
          <FF label="Email" required><input value={form.email} onChange={e=>sf("email",e.target.value)} placeholder="email@example.com"/></FF>
          <G2>
            <FF label="Budget (AED)"><input type="number" value={form.budget} onChange={e=>sf("budget",e.target.value)} placeholder="2000000"/></FF>
            <FF label="Assign To"><select value={form.assigned_to} onChange={e=>sf("assigned_to",e.target.value)}>{users.filter(u=>u.is_active).map(u=><option key={u.id} value={u.id}>{u.full_name} ({ROLE_META[u.role]?.label})</option>)}</select></FF>
          </G2>
          <G2>
            <FF label="Lead Source"><select value={form.source} onChange={e=>sf("source",e.target.value)}>{SOURCES.map(s=><option key={s}>{s}</option>)}</select></FF>
            <FF label="Property Type"><select value={form.property_type} onChange={e=>sf("property_type",e.target.value)}>{PROP_TYPES.map(t=><option key={t}>{t}</option>)}</select></FF>
          </G2>
          <G2>
            <FF label="Pipeline Stage"><select value={form.stage} onChange={e=>sf("stage",e.target.value)}>{STAGES.map(s=><option key={s}>{s}</option>)}</select></FF>
            <FF label="Link Project"><select value={form.project_id} onChange={e=>sf("project_id",e.target.value)}><option value="">None</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></FF>
          </G2>
          <FF label="Notes"><textarea value={form.notes} onChange={e=>sf("notes",e.target.value)} rows={3} placeholder="Requirements, interests, key notes…"/></FF>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:6}}>
            <Btn variant="outline" onClick={()=>setShowAdd(false)}>Cancel</Btn>
            <Btn onClick={saveLead} disabled={saving}>{saving?"Saving…":"Save Lead"}</Btn>
          </div>
        </Modal>
      )}

      {/* ── STAGE GATE MODAL ── */}
      {showStageChange&&(
        <Modal title={`Move to "${showStageChange}"`} onClose={()=>{setShowStageChange(null);setGateErrors([]);}}>
          <div style={{background:"#FAEAEA",border:"1.5px solid #F0BCBC",borderRadius:8,padding:"12px 14px",marginBottom:16}}>
            <div style={{fontWeight:600,color:"#B83232",marginBottom:8,fontSize:13}}>⚠ Cannot move to this stage yet</div>
            {gateErrors.map((e,i)=><div key={i} style={{fontSize:13,color:"#B83232",marginBottom:4}}>• {e}</div>)}
          </div>
          <p style={{fontSize:13,color:"#4A5568",lineHeight:1.7}}>Please complete the required fields on the <strong>Details</strong> tab first, then try moving the stage again.</p>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:16}}>
            <Btn onClick={()=>{setShowStageChange(null);setGateErrors([]);}}>OK, I'll update the record</Btn>
          </div>
        </Modal>
      )}

      {/* ── STAGE REVERSAL MODAL ── */}
      {showReversal&&(
        <Modal title="Reverse Stage" onClose={()=>setShowReversal(false)} width={440}>
          <div style={{background:"#FDF3DC",border:"1px solid #E8C97A",borderRadius:8,padding:"12px",marginBottom:16,fontSize:13,color:"#A06810"}}>
            ⚠ You are moving this lead <strong>backwards</strong> from <strong>{selLead?.stage}</strong> to <strong>{reversalStage}</strong>. A reason is required and will be logged.
          </div>
          <FF label="Reason for reversal" required>
            <textarea value={reversalReason} onChange={e=>setReversalReason(e.target.value)} rows={3} placeholder="e.g. Client changed requirements, proposal rejected, revisiting options…"/>
          </FF>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <Btn variant="outline" onClick={()=>setShowReversal(false)}>Cancel</Btn>
            <Btn variant="danger" disabled={!reversalReason.trim()} onClick={()=>applyStageChange(reversalStage,reversalReason)}>Confirm Reversal</Btn>
          </div>
        </Modal>
      )}

      {/* ── WHATSAPP MODAL ── */}
      {showComm==="whatsapp"&&selLead&&(
        <Modal title={`WhatsApp — ${selLead.name}`} onClose={()=>setShowComm(null)} width={500}>
          <div style={{marginBottom:12}}>
            <div style={{fontSize:11,color:"#A0AEC0",textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:8,fontWeight:600}}>Message Templates</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {WA_TEMPLATES.map(t=>(
                <button key={t.id} onClick={()=>fillTemplate(t)} style={{padding:"5px 12px",borderRadius:20,border:`1.5px solid ${commForm.template===t.id?"#25D366":"#E2E8F0"}`,background:commForm.template===t.id?"#E6F9ED":"#fff",color:commForm.template===t.id?"#1A7F5A":"#4A5568",fontSize:12,cursor:"pointer",fontWeight:commForm.template===t.id?600:400}}>{t.label}</button>
              ))}
            </div>
          </div>
          <FF label="Message" required>
            <textarea value={commForm.note} onChange={e=>setCommForm(f=>({...f,note:e.target.value}))} rows={6} placeholder="Type your WhatsApp message…"/>
          </FF>
          <div style={{background:"#E6F9ED",borderRadius:8,padding:"10px 12px",marginBottom:14,fontSize:12,color:"#1A7F5A"}}>
            💬 <strong>WhatsApp number:</strong> {selLead.whatsapp||selLead.phone||"Not set"}<br/>
            <a href={`https://wa.me/${(selLead.whatsapp||selLead.phone||"").replace(/\D/g,"")}`} target="_blank" rel="noreferrer" style={{color:"#1A7F5A",fontWeight:600}}>Open in WhatsApp →</a>
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <Btn variant="outline" onClick={()=>setShowComm(null)}>Cancel</Btn>
            <Btn variant="wa" onClick={saveComm} disabled={saving}>{saving?"Saving…":"Log & Send"}</Btn>
          </div>
        </Modal>
      )}

      {/* ── EMAIL MODAL ── */}
      {showComm==="email"&&selLead&&(
        <Modal title={`Email — ${selLead.name}`} onClose={()=>setShowComm(null)} width={500}>
          <FF label="To"><input value={selLead.email} readOnly style={{background:"#F7F9FC"}}/></FF>
          <FF label="Subject" required><input value={commForm.subject} onChange={e=>setCommForm(f=>({...f,subject:e.target.value}))} placeholder="Property proposal — Palm Jumeirah Villa"/></FF>
          <FF label="Message / Notes" required><textarea value={commForm.note} onChange={e=>setCommForm(f=>({...f,note:e.target.value}))} rows={5} placeholder="Email body or notes about the email sent…"/></FF>
          {selLead.email&&(
            <div style={{background:"#E6EFF9",borderRadius:8,padding:"10px 12px",marginBottom:14,fontSize:12,color:"#1A5FA8"}}>
              ✉ <a href={`mailto:${selLead.email}?subject=${encodeURIComponent(commForm.subject||"")}${commForm.note?`&body=${encodeURIComponent(commForm.note)}`:""}` } style={{color:"#1A5FA8",fontWeight:600}}>Open in Email App →</a>
            </div>
          )}
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <Btn variant="outline" onClick={()=>setShowComm(null)}>Cancel</Btn>
            <Btn onClick={saveComm} disabled={saving}>{saving?"Saving…":"Log Email"}</Btn>
          </div>
        </Modal>
      )}

      {/* ── CALL LOG MODAL ── */}
      {showComm==="call"&&selLead&&(
        <Modal title={`Log Call — ${selLead.name}`} onClose={()=>setShowComm(null)} width={420}>
          <FF label="Activity Type">
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {["Call","Visit","Note"].map(t=>(
                <button key={t} onClick={()=>setCommForm(f=>({...f,type:t}))} style={{padding:"6px 14px",borderRadius:20,border:`1.5px solid ${commForm.type===t?"#0B1F3A":"#E2E8F0"}`,background:commForm.type===t?"#0B1F3A":"#fff",color:commForm.type===t?"#fff":"#4A5568",fontSize:13,cursor:"pointer",fontWeight:commForm.type===t?600:400}}>{ACT_META[t]?.icon} {t}</button>
              ))}
            </div>
          </FF>
          <FF label="Notes / Summary" required><textarea value={commForm.note} onChange={e=>setCommForm(f=>({...f,note:e.target.value}))} rows={4} placeholder="What was discussed?"/></FF>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <Btn variant="outline" onClick={()=>setShowComm(null)}>Cancel</Btn>
            <Btn variant="gold" onClick={saveComm} disabled={saving}>{saving?"Saving…":"Log Activity"}</Btn>
          </div>
        </Modal>
      )}

      {/* ── MEETING MODAL ── */}
      {showMeeting&&selLead&&(
        <Modal title={`Schedule Meeting — ${selLead.name}`} onClose={()=>setShowMeeting(false)} width={480}>
          <FF label="Meeting Title" required><input value={meetForm.title} onChange={e=>setMeetForm(f=>({...f,title:e.target.value}))} placeholder="Site visit — Emaar Beachfront Tower A"/></FF>
          <G2>
            <FF label="Type"><select value={meetForm.type} onChange={e=>setMeetForm(f=>({...f,type:e.target.value}))}>{MEET_TYPES.map(t=><option key={t}>{t}</option>)}</select></FF>
            <FF label="Duration (mins)"><input type="number" value={meetForm.duration_min} onChange={e=>setMeetForm(f=>({...f,duration_min:e.target.value}))} placeholder="60"/></FF>
          </G2>
          <FF label="Date & Time" required><input type="datetime-local" value={meetForm.scheduled_at} onChange={e=>setMeetForm(f=>({...f,scheduled_at:e.target.value}))}/></FF>
          <FF label="Location"><input value={meetForm.location} onChange={e=>setMeetForm(f=>({...f,location:e.target.value}))} placeholder="Office / Site address / Zoom link"/></FF>
          <FF label="Notes"><textarea value={meetForm.notes} onChange={e=>setMeetForm(f=>({...f,notes:e.target.value}))} rows={2} placeholder="Pre-meeting notes or agenda…"/></FF>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <Btn variant="outline" onClick={()=>setShowMeeting(false)}>Cancel</Btn>
            <Btn variant="gold" onClick={saveMeeting} disabled={saving}>{saving?"Saving…":"Schedule Meeting"}</Btn>
          </div>
        </Modal>
      )}

      {/* ── FOLLOWUP MODAL ── */}
      {showFollowup&&selLead&&(
        <Modal title={`Set Follow-up — ${selLead.name}`} onClose={()=>setShowFollowup(false)} width={420}>
          <FF label="Follow-up Type">
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {FOLLOW_TYPES.map(t=>(
                <button key={t} onClick={()=>setFollowForm(f=>({...f,type:t}))} style={{padding:"6px 14px",borderRadius:20,border:`1.5px solid ${followForm.type===t?"#0B1F3A":"#E2E8F0"}`,background:followForm.type===t?"#0B1F3A":"#fff",color:followForm.type===t?"#fff":"#4A5568",fontSize:13,cursor:"pointer",fontWeight:followForm.type===t?600:400}}>{ACT_META[t]?.icon} {t}</button>
              ))}
            </div>
          </FF>
          <FF label="Due Date & Time" required><input type="datetime-local" value={followForm.due_at} onChange={e=>setFollowForm(f=>({...f,due_at:e.target.value}))}/></FF>
          <FF label="Note"><textarea value={followForm.note} onChange={e=>setFollowForm(f=>({...f,note:e.target.value}))} rows={3} placeholder="What to discuss or do in this follow-up…"/></FF>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <Btn variant="outline" onClick={()=>setShowFollowup(false)}>Cancel</Btn>
            <Btn onClick={saveFollowup} disabled={saving}>{saving?"Saving…":"Set Follow-up"}</Btn>
          </div>
        </Modal>
      )}
    {showDisc&&selLead&&(
    <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:"1rem"}}>
      <div style={{background:"#fff",borderRadius:16,width:480,maxWidth:"100%",maxHeight:"90vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 20px 60px rgba(11,31,58,.35)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"1.125rem 1.5rem",borderBottom:"1px solid #E2E8F0"}}>
          <span style={{fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:700,color:"#0B1F3A"}}>Request Discount — {selLead.name}</span>
          <button onClick={()=>setShowDisc(false)} style={{background:"none",border:"none",fontSize:22,color:"#A0AEC0",cursor:"pointer"}}>×</button>
        </div>
        <div style={{overflowY:"auto",padding:"1.125rem 1.5rem"}}>
          <div style={{background:"#E6EFF9",borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:13,color:"#1A5FA8",lineHeight:1.6}}>
            ℹ Requests up to <strong>5%</strong> go to Manager. Above 5% auto-escalate to Admin.
          </div>
          <div style={{marginBottom:13}}>
            <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Discount Type</label>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {DISC_TYPES.map(t=>(
                <button key={t.key} onClick={()=>setDiscForm(f=>({...f,type:t.key}))} style={{padding:"10px 12px",borderRadius:8,border:`1.5px solid ${discForm.type===t.key?"#0B1F3A":"#E2E8F0"}`,background:discForm.type===t.key?"#0B1F3A":"#fff",color:discForm.type===t.key?"#fff":"#4A5568",cursor:"pointer",textAlign:"left",fontSize:13,fontWeight:discForm.type===t.key?600:400}}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:13}}>
            <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Original Value (AED)</label><input type="number" value={discForm.original_value} onChange={e=>setDiscForm(f=>({...f,original_value:e.target.value}))} placeholder="e.g. 2500000"/></div>
            <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Requested Value (AED)</label><input type="number" value={discForm.requested_value} onChange={e=>setDiscForm(f=>({...f,requested_value:e.target.value}))} placeholder="e.g. 2350000"/></div>
          </div>
          <div style={{marginBottom:13}}>
            <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Discount % *</label>
            <input type="number" value={discForm.discount_pct} onChange={e=>setDiscForm(f=>({...f,discount_pct:e.target.value}))} placeholder="e.g. 6" step="0.5" min="0" max="50"/>
            {discForm.discount_pct&&<div style={{marginTop:5,fontSize:12,fontWeight:600,color:Number(discForm.discount_pct)>MANAGER_DISCOUNT_LIMIT?"#5B3FAA":"#A06810"}}>{Number(discForm.discount_pct)>MANAGER_DISCOUNT_LIMIT?`⚡ Exceeds manager limit — will escalate to Admin`:`✓ Manager can approve this`}</div>}
          </div>
          <div style={{marginBottom:13}}>
            <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Reason *</label>
            <textarea value={discForm.reason} onChange={e=>setDiscForm(f=>({...f,reason:e.target.value}))} rows={3} placeholder="Why is the client requesting this discount?"/>
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <button onClick={()=>setShowDisc(false)} style={{padding:"9px 18px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancel</button>
            <button onClick={requestDiscount} disabled={saving} style={{padding:"9px 18px",borderRadius:8,border:"none",background:saving?"#A0AEC0":"#0B1F3A",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>{saving?"Submitting…":"Submit Request"}</button>
          </div>
        </div>
      </div>
    </div>
  )}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// DASHBOARD (v3 — adds meetings + followups)
// ══════════════════════════════════════════════════════
function Dashboard({leads,properties,activities,currentUser,meetings=[],followups=[]}){
  const visible=can(currentUser.role,"see_all")?leads:leads.filter(l=>l.assigned_to===currentUser.id);
  const active=visible.filter(l=>!["Closed Won","Closed Lost"].includes(l.stage));
  const won=visible.filter(l=>l.stage==="Closed Won");
  const lost=visible.filter(l=>l.stage==="Closed Lost");
  const pipeVal=active.reduce((s,l)=>s+(l.budget||0),0);
  const wonVal=won.reduce((s,l)=>s+(l.budget||0),0);
  const avail=properties.filter(p=>p.status==="Available").length;
  const maxCount=Math.max(...STAGES.map(s=>visible.filter(l=>l.stage===s).length),1);
  const recent=[...activities].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,4);
  const upcomingMeetings=[...meetings].filter(m=>m.status==="Scheduled"&&new Date(m.scheduled_at)>new Date()).sort((a,b)=>new Date(a.scheduled_at)-new Date(b.scheduled_at)).slice(0,4);
  const overdueFollowups=[...followups].filter(f=>f.status==="Pending"&&new Date(f.due_at)<new Date());

  const SC=({label,value,sub,accent,icon})=>(
    <div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:12,padding:"1rem 1.25rem",borderTop:`3px solid ${accent}`,display:"flex",alignItems:"flex-start",gap:10}}>
      <div style={{fontSize:22}}>{icon}</div>
      <div>
        <div style={{fontSize:10,color:"#A0AEC0",textTransform:"uppercase",letterSpacing:"0.7px",fontWeight:600,marginBottom:4}}>{label}</div>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:24,fontWeight:700,color:"#0B1F3A",lineHeight:1}}>{value}</div>
        {sub&&<div style={{fontSize:12,color:"#718096",marginTop:4}}>{sub}</div>}
      </div>
    </div>
  );

  return(
    <div className="fade-in" style={{display:"flex",flexDirection:"column",gap:16}}>
      {/* Overdue alert */}
      {overdueFollowups.length>0&&(
        <div style={{background:"#FAEAEA",border:"1.5px solid #F0BCBC",borderRadius:10,padding:"12px 16px",display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontSize:20}}>⏰</span>
          <div>
            <div style={{fontWeight:700,color:"#B83232",fontSize:13}}>{overdueFollowups.length} overdue follow-up{overdueFollowups.length>1?"s":""}</div>
            <div style={{fontSize:12,color:"#718096"}}>{overdueFollowups.map(f=>f.lead_name).join(", ")}</div>
          </div>
        </div>
      )}

      {/* Hero */}
      <div style={{background:"linear-gradient(135deg,#0B1F3A 0%,#1A3558 100%)",borderRadius:14,padding:"1.5rem 2rem",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,color:"#fff",fontWeight:700}}>Good morning, {currentUser.full_name?.split(" ")[0]} ☀️</div>
          <div style={{color:"#C9A84C",fontSize:13,marginTop:4}}>{new Date().toLocaleDateString("en-AE",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</div>
          <RoleBadge role={currentUser.role}/>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{color:"rgba(255,255,255,0.5)",fontSize:11,textTransform:"uppercase",letterSpacing:"0.6px"}}>Total Pipeline</div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:30,color:"#C9A84C",fontWeight:700,marginTop:2}}>{fmtM(pipeVal)}</div>
        </div>
      </div>

      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
        <SC label="Active Leads"     value={active.length}           sub={`of ${visible.length} total`} accent="#0B1F3A" icon="👤"/>
        <SC label="Deals Won"        value={won.length}              sub={fmtM(wonVal)+" closed"}        accent="#1A7F5A" icon="🏆"/>
        <SC label="Upcoming Meetings" value={upcomingMeetings.length} sub="next 30 days"                 accent="#C9A84C" icon="🗓"/>
        <SC label="Properties Avail" value={avail}                   sub={`of ${properties.length}`}    accent="#1A5FA8" icon="🏢"/>
      </div>

      {/* Pipeline + Upcoming meetings */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 320px",gap:14}}>
        <div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:12,padding:"1.125rem"}}>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:700,color:"#0B1F3A",marginBottom:16}}>Pipeline by Stage</div>
          {STAGES.map(s=>{
            const cnt=visible.filter(l=>l.stage===s).length;
            const m=STAGE_META[s];
            return(
              <div key={s} style={{display:"flex",alignItems:"center",gap:10,marginBottom:9}}>
                <div style={{width:116,fontSize:12,color:"#4A5568",fontWeight:500,flexShrink:0}}>{s}</div>
                <div style={{flex:1,background:"#F0F2F5",borderRadius:6,height:9,overflow:"hidden"}}>
                  <div style={{width:`${cnt?Math.round(cnt/maxCount*100):0}%`,height:"100%",background:m.c,borderRadius:6,transition:"width 0.5s"}}/>
                </div>
                <div style={{width:22,fontSize:13,fontWeight:700,color:m.c,textAlign:"right"}}>{cnt}</div>
              </div>
            );
          })}
        </div>

        <div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:12,padding:"1.125rem"}}>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:700,color:"#0B1F3A",marginBottom:14}}>🗓 Upcoming Meetings</div>
          {upcomingMeetings.length===0&&<Empty icon="🗓" msg="No upcoming meetings"/>}
          {upcomingMeetings.map(m=>(
            <div key={m.id} style={{padding:"8px 10px",background:"#F7F9FC",borderRadius:8,border:"1px solid #F0F2F5",marginBottom:7}}>
              <div style={{fontSize:12,fontWeight:600,color:"#0B1F3A"}}>{m.title}</div>
              <div style={{fontSize:11,color:"#718096"}}>{m.lead_name} · {fmtDT(m.scheduled_at)}</div>
              {m.location&&<div style={{fontSize:11,color:"#A0AEC0"}}>📍 {m.location}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Recent activity */}
      <div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:12,padding:"1.125rem"}}>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:700,color:"#0B1F3A",marginBottom:14}}>Recent Activity</div>
        {recent.length===0&&<Empty icon="📋" msg="No activity yet"/>}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {recent.map(act=>{
            const m=ACT_META[act.type]||ACT_META.Note;
            return(
              <div key={act.id} style={{display:"flex",gap:10,padding:"10px",background:"#FAFBFC",borderRadius:10,border:"1px solid #F0F2F5"}}>
                <div style={{width:32,height:32,borderRadius:8,background:m.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,flexShrink:0}}>{m.icon}</div>
                <div style={{minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:600,color:"#0B1F3A"}}>{act.type} — {act.lead_name||"Unknown"}</div>
                  <div style={{fontSize:11,color:"#718096",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{act.note}</div>
                  <div style={{fontSize:10,color:"#A0AEC0",marginTop:2}}>{act.user_name} · {fmtDate(act.created_at)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════
// USER MANAGEMENT (same as v2 — abbreviated for space)
// ══════════════════════════════════════════════════════
function UserManagement({currentUser,leads,activities,showToast}){
  const[users,setUsers]=useState([]);const[loading,setLoading]=useState(true);const[subTab,setSubTab]=useState("users");
  const[search,setSearch]=useState("");const[fRole,setFRole]=useState("All");const[fStatus,setFStatus]=useState("All");
  const[showAdd,setShowAdd]=useState(false);const[editUser,setEditUser]=useState(null);const[viewUser,setViewUser]=useState(null);const[delConfirm,setDelConfirm]=useState(null);
  const blank={full_name:"",email:"",password:"",role:"agent",is_active:true,end_date:"",department:"",phone:""};
  const[form,setForm]=useState(blank);
  const loadUsers=useCallback(async()=>{setLoading(true);const{data}=await supabase.from("profiles").select("*").order("created_at",{ascending:false});setUsers(data||[]);setLoading(false);},[]);
  useEffect(()=>{loadUsers();},[loadUsers]);
  const isExpired=u=>u.end_date&&new Date(u.end_date)<new Date();
  const getStatusLabel=u=>{if(!u.is_active)return{label:"Inactive",c:"#A0AEC0",bg:"#F0F2F5"};if(isExpired(u))return{label:"Expired",c:"#B83232",bg:"#FAEAEA"};if(u.end_date){const d=Math.ceil((new Date(u.end_date)-new Date())/(1000*60*60*24));if(d<=7)return{label:`Expires ${d}d`,c:"#A06810",bg:"#FDF3DC"};}return{label:"Active",c:"#1A7F5A",bg:"#E6F4EE"};};
  const userLeads=uid=>leads.filter(l=>l.assigned_to===uid);
  const userWon=uid=>leads.filter(l=>l.assigned_to===uid&&l.stage==="Closed Won");
  const sf=k=>e=>setForm(f=>({...f,[k]:e.target.value}));
  const createUser=async()=>{
    if(!form.full_name||!form.email||!form.password){showToast("Name, email and password required.","error");return;}
    if(form.password.length<8){showToast("Password min 8 chars.","error");return;}
    try{const{data:a,error:ae}=await supabase.auth.signUp({email:form.email,password:form.password,options:{data:{full_name:form.full_name,role:form.role}}});if(ae)throw ae;const{error:pe}=await supabase.from("profiles").upsert({id:a.user.id,full_name:form.full_name,email:form.email,role:form.role,is_active:form.is_active,end_date:form.end_date||null,department:form.department||null,phone:form.phone||null});if(pe)throw pe;showToast(`${form.full_name} created.`,"success");setShowAdd(false);setForm(blank);loadUsers();}catch(e){showToast(e.message,"error");}
  };
  const saveEdit=async()=>{if(!editUser||!form.full_name)return;try{const{error}=await supabase.from("profiles").update({full_name:form.full_name,role:form.role,is_active:form.is_active,end_date:form.end_date||null,department:form.department||null,phone:form.phone||null}).eq("id",editUser.id);if(error)throw error;showToast("Updated.","success");setEditUser(null);setViewUser(null);setForm(blank);loadUsers();}catch(e){showToast(e.message,"error");}};
  const toggleActive=async u=>{if(u.id===currentUser.id){showToast("Cannot deactivate yourself.","error");return;}const{error}=await supabase.from("profiles").update({is_active:!u.is_active}).eq("id",u.id);if(!error){showToast(`${u.full_name} ${u.is_active?"deactivated":"reactivated"}.`,"success");loadUsers();}};
  const deleteUser=async u=>{if(u.id===currentUser.id){showToast("Cannot delete yourself.","error");return;}try{const{error}=await supabase.from("profiles").delete().eq("id",u.id);if(error)throw error;showToast(`${u.full_name} deleted.`,"info");setDelConfirm(null);setViewUser(null);loadUsers();}catch(e){showToast(e.message,"error");}};
  const openEdit=u=>{setEditUser(u);setForm({full_name:u.full_name||"",email:u.email||"",password:"",role:u.role||"agent",is_active:u.is_active,end_date:u.end_date?u.end_date.slice(0,10):"",department:u.department||"",phone:u.phone||""});};
  const filtered=users.filter(u=>{const q=search.toLowerCase();const mQ=!q||u.full_name?.toLowerCase().includes(q)||u.email?.toLowerCase().includes(q);const mR=fRole==="All"||u.role===fRole;const st=getStatusLabel(u).label;const mS=fStatus==="All"||(fStatus==="Active"&&st==="Active")||(fStatus==="Inactive"&&(st==="Inactive"||st==="Expired"))||(fStatus==="Expiring"&&st.startsWith("Expires"));return mQ&&mR&&mS;});
  const analytics={total:users.length,active:users.filter(u=>u.is_active&&!isExpired(u)).length,inactive:users.filter(u=>!u.is_active||isExpired(u)).length,expiring:users.filter(u=>{if(!u.end_date||!u.is_active)return false;const d=Math.ceil((new Date(u.end_date)-new Date())/(1000*60*60*24));return d>=0&&d<=30;}).length,byRole:ROLES.map(r=>({role:r,count:users.filter(u=>u.role===r).length})),topAgents:[...users].map(u=>({...u,won:userWon(u.id).length,active:userLeads(u.id).filter(l=>!["Closed Won","Closed Lost"].includes(l.stage)).length})).sort((a,b)=>b.won-a.won).slice(0,5)};
  const SubTabs=()=>(
    <div style={{display:"flex",gap:6,marginBottom:18}}>
      {[["overview","⊞ Overview"],["users","👥 All Users"],["analytics","📊 Analytics"]].map(([id,label])=>(
        <button key={id} onClick={()=>setSubTab(id)} style={{padding:"7px 16px",borderRadius:8,border:`1.5px solid ${subTab===id?"#0B1F3A":"#E2E8F0"}`,background:subTab===id?"#0B1F3A":"#fff",color:subTab===id?"#fff":"#4A5568",fontSize:13,fontWeight:subTab===id?600:400,cursor:"pointer"}}>{label}</button>
      ))}
    </div>
  );
  const SC=({l,v,accent,icon})=>(<div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:12,padding:"1rem 1.25rem",borderTop:`3px solid ${accent}`,display:"flex",alignItems:"flex-start",gap:10}}><div style={{fontSize:22}}>{icon}</div><div><div style={{fontSize:10,color:"#A0AEC0",textTransform:"uppercase",letterSpacing:"0.7px",fontWeight:600,marginBottom:4}}>{l}</div><div style={{fontFamily:"'Playfair Display',serif",fontSize:24,fontWeight:700,color:"#0B1F3A",lineHeight:1}}>{v}</div></div></div>);

  return(
    <div className="fade-in" style={{display:"flex",flexDirection:"column",height:"100%"}}>
      <SubTabs/>
      {subTab==="overview"&&(
        <div style={{flex:1,overflowY:"auto"}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:16}}>
            <SC l="Total Users" v={analytics.total} accent="#0B1F3A" icon="👥"/>
            <SC l="Active"      v={analytics.active} accent="#1A7F5A" icon="✅"/>
            <SC l="Inactive"    v={analytics.inactive} accent="#B83232" icon="🚫"/>
            <SC l="Expiring"    v={analytics.expiring} accent="#A06810" icon="⏳"/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
            <div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:12,padding:"1.125rem"}}>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:14,fontWeight:700,color:"#0B1F3A",marginBottom:14}}>Users by Role</div>
              {analytics.byRole.map(({role,count})=>{const m=ROLE_META[role];const pct=analytics.total?Math.round(count/analytics.total*100):0;return(<div key={role} style={{marginBottom:12}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><RoleBadge role={role}/><span style={{fontSize:12,color:"#4A5568"}}>{count} · {pct}%</span></div><div style={{height:6,background:"#F0F2F5",borderRadius:4,overflow:"hidden"}}><div style={{width:`${pct}%`,height:"100%",background:m.color,borderRadius:4}}/></div></div>);})}
            </div>
            <div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:12,padding:"1.125rem"}}>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:14,fontWeight:700,color:"#0B1F3A",marginBottom:14}}>🏆 Top Performers</div>
              {analytics.topAgents.map((a,i)=>(<div key={a.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid #F0F2F5"}}><div style={{width:22,height:22,borderRadius:"50%",background:i===0?"#C9A84C":i===1?"#A0AEC0":"#CD7F32",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#fff",flexShrink:0}}>{i+1}</div><Av name={a.full_name} size={30}/><div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:"#0B1F3A"}}>{a.full_name}</div><div style={{fontSize:11,color:"#A0AEC0"}}>{a.active} active · {a.won} won</div></div><div style={{fontSize:14,fontWeight:700,color:"#1A7F5A"}}>{a.won}✓</div></div>))}
            </div>
          </div>
        </div>
      )}
      {subTab==="users"&&(
        <div style={{flex:1,display:"flex",flexDirection:"column"}}>
          <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search…" style={{flex:1,minWidth:160}}/>
            <select value={fRole} onChange={e=>setFRole(e.target.value)} style={{width:"auto"}}><option value="All">All roles</option>{ROLES.map(r=><option key={r} value={r}>{ROLE_META[r].label}</option>)}</select>
            <select value={fStatus} onChange={e=>setFStatus(e.target.value)} style={{width:"auto"}}><option value="All">All statuses</option><option value="Active">Active</option><option value="Inactive">Inactive</option><option value="Expiring">Expiring</option></select>
            <Btn onClick={()=>{setForm(blank);setShowAdd(true);}}>+ Add User</Btn>
          </div>
          {loading?<Spinner/>:(
            <div style={{flex:1,overflowY:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead style={{position:"sticky",top:0}}>
                  <tr style={{background:"#0B1F3A"}}>{["User","Role","Status","Department","End Date","Leads","Actions"].map(h=><th key={h} style={{padding:"10px 14px",textAlign:"left",fontSize:11,fontWeight:600,color:"#C9A84C",textTransform:"uppercase",letterSpacing:"0.5px",whiteSpace:"nowrap"}}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {filtered.map((u,i)=>{const st=getStatusLabel(u);const ul=userLeads(u.id).length;const uw=userWon(u.id).length;return(
                    <tr key={u.id} style={{background:i%2===0?"#fff":"#FAFBFC",borderBottom:"1px solid #F0F2F5",cursor:"pointer"}} onClick={()=>setViewUser(viewUser?.id===u.id?null:u)}>
                      <td style={{padding:"12px 14px"}}><div style={{display:"flex",alignItems:"center",gap:10}}><Av name={u.full_name||u.email} size={32} bg={u.is_active&&!isExpired(u)?"#0B1F3A":"#A0AEC0"}/><div><div style={{fontSize:13,fontWeight:600,color:"#0B1F3A"}}>{u.full_name||"—"}</div><div style={{fontSize:11,color:"#A0AEC0"}}>{u.email}</div>{u.id===currentUser.id&&<div style={{fontSize:10,color:"#C9A84C",fontWeight:700}}>YOU</div>}</div></div></td>
                      <td style={{padding:"12px 14px"}}><RoleBadge role={u.role}/></td>
                      <td style={{padding:"12px 14px"}}><span style={{fontSize:11,fontWeight:600,padding:"3px 9px",borderRadius:20,background:st.bg,color:st.c,whiteSpace:"nowrap"}}>{st.label}</span></td>
                      <td style={{padding:"12px 14px",fontSize:13,color:"#4A5568"}}>{u.department||"—"}</td>
                      <td style={{padding:"12px 14px",fontSize:12,color:isExpired(u)?"#B83232":u.end_date?"#A06810":"#A0AEC0",fontWeight:u.end_date?600:400}}>{u.end_date?fmtDate(u.end_date):"None"}</td>
                      <td style={{padding:"12px 14px"}}><div style={{fontSize:12,color:"#0B1F3A",fontWeight:600}}>{ul} leads</div><div style={{fontSize:11,color:"#1A7F5A"}}>{uw} won</div></td>
                      <td style={{padding:"12px 14px"}} onClick={e=>e.stopPropagation()}><div style={{display:"flex",gap:5}}><Btn small variant="outline" onClick={()=>openEdit(u)}>Edit</Btn>{u.id!==currentUser.id&&<Btn small variant={u.is_active&&!isExpired(u)?"danger":"green"} onClick={()=>toggleActive(u)}>{u.is_active&&!isExpired(u)?"Deactivate":"Activate"}</Btn>}{u.id!==currentUser.id&&<Btn small variant="danger" onClick={()=>setDelConfirm(u)}>Delete</Btn>}</div></td>
                    </tr>
                  );})}
                </tbody>
              </table>
              {filtered.length===0&&<Empty icon="👥" msg="No users match filters"/>}
            </div>
          )}
        </div>
      )}
      {subTab==="analytics"&&(
        <div style={{flex:1,overflowY:"auto"}}>
          <div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:12,padding:"1.25rem",marginBottom:14}}>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:700,color:"#0B1F3A",marginBottom:16}}>🏆 Top Performers</div>
            {analytics.topAgents.map((a,i)=>(
              <div key={a.id} style={{display:"flex",alignItems:"center",gap:12,marginBottom:12,padding:"10px 12px",background:i===0?"#FDF3DC":"#FAFBFC",borderRadius:10,border:`1px solid ${i===0?"#E8C97A":"#F0F2F5"}`}}>
                <div style={{width:28,height:28,borderRadius:"50%",background:i===0?"#C9A84C":i===1?"#A0AEC0":"#CD7F32",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:"#fff",flexShrink:0}}>{i+1}</div>
                <Av name={a.full_name} size={36}/><div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:"#0B1F3A"}}>{a.full_name}</div><RoleBadge role={a.role}/></div>
                <div style={{textAlign:"right"}}><div style={{fontSize:20,fontWeight:700,color:"#1A7F5A",fontFamily:"'Playfair Display',serif"}}>{a.won}</div><div style={{fontSize:11,color:"#A0AEC0"}}>deals won</div></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add User */}
      {showAdd&&(<Modal title="Add New User" onClose={()=>setShowAdd(false)} width={560}>
        <div style={{background:"#E6EFF9",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:13,color:"#1A5FA8"}}>ℹ Confirmation email will be sent. User must verify before logging in.</div>
        <G2><FF label="Full Name" required><input value={form.full_name} onChange={sf("full_name")} placeholder="Sara Khalid"/></FF><FF label="Department"><input value={form.department} onChange={sf("department")} placeholder="Sales / Admin…"/></FF></G2>
        <FF label="Email" required><input type="email" value={form.email} onChange={sf("email")} placeholder="sara@company.com"/></FF>
        <G2><FF label="Temporary Password" required><PwInput value={form.password} onChange={sf("password")} placeholder="Min 8 characters"/></FF><FF label="Phone"><input value={form.phone} onChange={sf("phone")} placeholder="+971 50 000 0000"/></FF></G2>
        <G2><FF label="Role" required><select value={form.role} onChange={sf("role")}>{ROLES.map(r=><option key={r} value={r}>{ROLE_META[r].label} — {ROLE_META[r].desc}</option>)}</select></FF><FF label="Status"><select value={form.is_active} onChange={e=>setForm(f=>({...f,is_active:e.target.value==="true"}))}><option value="true">Active</option><option value="false">Inactive</option></select></FF></G2>
        <FF label="Access End Date (optional)"><input type="date" value={form.end_date} onChange={sf("end_date")}/><div style={{fontSize:11,color:"#A0AEC0",marginTop:4}}>Leave blank for permanent access.</div></FF>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}><Btn variant="outline" onClick={()=>setShowAdd(false)}>Cancel</Btn><Btn onClick={createUser}>Create User</Btn></div>
      </Modal>)}
      {/* Edit User */}
      {editUser&&(<Modal title={`Edit — ${editUser.full_name}`} onClose={()=>setEditUser(null)} width={480}>
        <G2><FF label="Full Name" required><input value={form.full_name} onChange={sf("full_name")}/></FF><FF label="Department"><input value={form.department} onChange={sf("department")}/></FF></G2>
        <FF label="Phone"><input value={form.phone} onChange={sf("phone")}/></FF>
        <G2><FF label="Role"><select value={form.role} onChange={sf("role")}>{ROLES.map(r=><option key={r} value={r}>{ROLE_META[r].label}</option>)}</select></FF><FF label="Status"><select value={form.is_active} onChange={e=>setForm(f=>({...f,is_active:e.target.value==="true"}))}><option value="true">Active</option><option value="false">Inactive</option></select></FF></G2>
        <FF label="Access End Date"><input type="date" value={form.end_date} onChange={sf("end_date")}/></FF>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}><Btn variant="outline" onClick={()=>setEditUser(null)}>Cancel</Btn><Btn onClick={saveEdit}>Save Changes</Btn></div>
      </Modal>)}
      {/* Delete confirm */}
      {delConfirm&&(<Modal title="Delete User" onClose={()=>setDelConfirm(null)} width={400}>
        <div style={{textAlign:"center",padding:"1rem 0"}}>
          <div style={{fontSize:48,marginBottom:12}}>⚠️</div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700,color:"#0B1F3A",marginBottom:10}}>Delete {delConfirm.full_name}?</div>
          <div style={{fontSize:13,color:"#4A5568",lineHeight:1.7,marginBottom:20}}>This permanently removes the account. Their leads remain but show as unassigned. <strong>Cannot be undone.</strong></div>
          <div style={{display:"flex",gap:10,justifyContent:"center"}}><Btn variant="outline" onClick={()=>setDelConfirm(null)}>Cancel</Btn><Btn variant="danger" onClick={()=>deleteUser(delConfirm)}>Delete Permanently</Btn></div>
        </div>
      </Modal>)}
      {/* View User Panel */}
      {viewUser&&(()=>{const u=viewUser;const st=getStatusLabel(u);return(
        <div style={{position:"fixed",right:0,top:54,bottom:0,width:300,background:"#fff",border:"1px solid #E2E8F0",borderLeft:"1px solid #E2E8F0",boxShadow:"-4px 0 20px rgba(0,0,0,0.08)",zIndex:200,display:"flex",flexDirection:"column",overflow:"hidden"}} className="slide-in">
          <div style={{background:"#0B1F3A",padding:"1.25rem",position:"relative"}}>
            <button onClick={()=>setViewUser(null)} style={{position:"absolute",top:10,right:12,background:"none",border:"none",color:"#C9A84C",fontSize:20,cursor:"pointer"}}>×</button>
            <Av name={u.full_name||u.email} size={44} bg="#C9A84C" tc="#0B1F3A"/>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:16,color:"#fff",fontWeight:700,marginTop:8}}>{u.full_name}</div>
            <div style={{fontSize:12,color:"#C9A84C",marginTop:2}}>{u.email}</div>
          </div>
          <div style={{flex:1,overflowY:"auto",padding:"1rem"}}>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}><RoleBadge role={u.role}/><span style={{fontSize:11,fontWeight:600,padding:"3px 9px",borderRadius:20,background:st.bg,color:st.c}}>{st.label}</span></div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,background:"#FAFBFC",borderRadius:10,padding:"12px",marginBottom:14}}>
              {[["Department",u.department||"—"],["Phone",u.phone||"—"],["Joined",fmtDate(u.created_at)],["End Date",u.end_date?fmtDate(u.end_date):"None"]].map(([l,v])=>(<div key={l}><div style={{fontSize:10,color:"#A0AEC0",textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:2}}>{l}</div><div style={{fontSize:12,fontWeight:600,color:"#0B1F3A"}}>{v}</div></div>))}
            </div>
            <div style={{background:"#F7F9FC",borderRadius:10,padding:"10px 12px",marginBottom:14}}>
              {[["Leads",userLeads(u.id).length,"#0B1F3A"],["Won",userWon(u.id).length,"#1A7F5A"],["Active",userLeads(u.id).filter(l=>!["Closed Won","Closed Lost"].includes(l.stage)).length,"#1A5FA8"]].map(([l,v,c])=>(<div key={l} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid #F0F2F5"}}><span style={{fontSize:12,color:"#4A5568"}}>{l}</span><span style={{fontSize:13,fontWeight:700,color:c}}>{v}</span></div>))}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:7}}>
              <Btn full onClick={()=>openEdit(u)}>Edit User</Btn>
              {u.id!==currentUser.id&&<Btn full variant={u.is_active?"danger":"green"} onClick={()=>toggleActive(u)}>{u.is_active?"Deactivate":"Reactivate"}</Btn>}
              {u.id!==currentUser.id&&<Btn full variant="danger" onClick={()=>setDelConfirm(u)}>Delete User</Btn>}
            </div>
          </div>
        </div>
      );})()}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// PIPELINE (same as v2)
// ══════════════════════════════════════════════════════
function Pipeline({leads,setLeads,currentUser,showToast}){
  const[dragging,setDragging]=useState(null);const[dropTarget,setDropTarget]=useState(null);
  const canEdit=can(currentUser.role,"write");
  const visible=can(currentUser.role,"see_all")?leads:leads.filter(l=>l.assigned_to===currentUser.id);
  const byStage=STAGES.reduce((a,s)=>({...a,[s]:visible.filter(l=>l.stage===s)}),{});
  const onDrop=async stage=>{
    if(!dragging||!canEdit)return;
    const errors=checkGate(stage,dragging);
    if(errors.length>0){showToast(`Cannot move: ${errors[0]}`,"error");setDragging(null);setDropTarget(null);return;}
    const{error}=await supabase.from("leads").update({stage}).eq("id",dragging.id);
    if(!error){setLeads(p=>p.map(l=>l.id===dragging.id?{...l,stage}:l));}
    else showToast(error.message,"error");
    setDragging(null);setDropTarget(null);
  };
  return(
    <div className="fade-in" style={{height:"100%",overflowX:"auto"}}>
      <div style={{display:"flex",gap:10,height:"100%",minWidth:STAGES.length*188}}>
        {STAGES.map(stage=>{
          const m=STAGE_META[stage];const items=byStage[stage]||[];const total=items.reduce((s,l)=>s+(l.budget||0),0);const isDrop=dropTarget===stage;
          return(
            <div key={stage} onDragOver={e=>{e.preventDefault();setDropTarget(stage);}} onDragLeave={()=>setDropTarget(null)} onDrop={()=>onDrop(stage)}
              style={{flex:1,minWidth:182,display:"flex",flexDirection:"column",background:isDrop?"#FDF8EE":"#F7F9FC",border:`1.5px ${isDrop?"dashed":"solid"} ${isDrop?"#C9A84C":"#E2E8F0"}`,borderRadius:12,overflow:"hidden",transition:"all 0.15s"}}>
              <div style={{padding:"10px 12px",background:"#fff",borderBottom:"1px solid #F0F2F5"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:2}}>
                  <span style={{fontSize:10,fontWeight:700,color:m.c,textTransform:"uppercase",letterSpacing:"0.7px"}}>{stage}</span>
                  <span style={{fontSize:12,fontWeight:700,background:m.bg,color:m.c,width:22,height:22,borderRadius:"50%",display:"inline-flex",alignItems:"center",justifyContent:"center"}}>{items.length}</span>
                </div>
                <div style={{fontSize:11,color:"#A0AEC0"}}>{total>0?fmtM(total):"No value"}</div>
              </div>
              <div style={{flex:1,overflowY:"auto",padding:"8px"}}>
                {items.length===0&&<div style={{textAlign:"center",padding:"1.5rem 0.5rem",color:"#D1D9E6",fontSize:12}}>Drop here</div>}
                {items.map(lead=>(
                  <div key={lead.id} draggable={canEdit} className="dcard" onDragStart={()=>setDragging(lead)} onDragEnd={()=>{setDragging(null);setDropTarget(null);}}
                    style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:10,padding:"10px 11px",marginBottom:8,userSelect:"none",opacity:dragging?.id===lead.id?0.45:1,borderLeft:`3px solid ${m.c}`}}>
                    <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:6}}><Av name={lead.name} size={26}/><div style={{fontWeight:600,fontSize:12,color:"#0B1F3A",flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{lead.name}</div></div>
                    <TypeBadge type={lead.property_type}/>
                    <div style={{fontFamily:"'Playfair Display',serif",fontSize:13,fontWeight:700,color:"#0B1F3A",marginTop:7}}>{fmtM(lead.budget)}</div>
                    <div style={{fontSize:10,color:"#A0AEC0",marginTop:3}}>{fmtDate(lead.updated_at||lead.created_at)}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════
// ACTIVITY LOG
// ══════════════════════════════════════════════════════
function ActivityLog({leads,activities,setActivities,currentUser,showToast}){
  const[fType,setFType]=useState("All");const[fLead,setFLead]=useState("All");const[showAdd,setShowAdd]=useState(false);const[saving,setSaving]=useState(false);
  const[form,setForm]=useState({lead_id:"",type:"Call",note:""});
  const filtered=useMemo(()=>[...activities].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).filter(a=>(fType==="All"||a.type===fType)&&(fLead==="All"||a.lead_id===fLead)),[activities,fType,fLead]);
  const save=async()=>{
    if(!form.note.trim()||!form.lead_id){showToast("Select a lead and enter a note.","error");return;}
    setSaving(true);
    try{const lead=leads.find(l=>l.id===form.lead_id);const{data,error}=await supabase.from("activities").insert({lead_id:form.lead_id,type:form.type,note:form.note,user_id:currentUser.id,user_name:currentUser.full_name,lead_name:lead?.name||""}).select().single();if(error)throw error;setActivities(p=>[data,...p]);showToast("Activity logged.","success");setShowAdd(false);setForm({lead_id:"",type:"Call",note:""});}catch(e){showToast(e.message,"error");}finally{setSaving(false);}
  };
  const del=async id=>{if(!can(currentUser.role,"delete"))return;const{error}=await supabase.from("activities").delete().eq("id",id);if(!error)setActivities(p=>p.filter(a=>a.id!==id));};
  return(
    <div className="fade-in" style={{display:"flex",flexDirection:"column",height:"100%"}}>
      <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap"}}>
        <select value={fType} onChange={e=>setFType(e.target.value)} style={{width:"auto"}}><option value="All">All types</option>{ACT_TYPES.map(t=><option key={t}>{t}</option>)}</select>
        <select value={fLead} onChange={e=>setFLead(e.target.value)} style={{width:"auto"}}><option value="All">All leads</option>{leads.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select>
        <div style={{marginLeft:"auto"}}><Btn variant="gold" onClick={()=>setShowAdd(true)}>+ Log Activity</Btn></div>
      </div>
      <div style={{fontSize:12,color:"#A0AEC0",marginBottom:10}}>{filtered.length} activit{filtered.length!==1?"ies":"y"}</div>
      <div style={{flex:1,overflowY:"auto"}}>
        {filtered.length===0&&<Empty icon="📋" msg="No activities yet"/>}
        {filtered.map((act,idx)=>{
          const m=ACT_META[act.type]||ACT_META.Note;const prev=filtered[idx-1];
          const showDate=!prev||new Date(prev.created_at).toDateString()!==new Date(act.created_at).toDateString();
          return(<div key={act.id}>
            {showDate&&<div style={{display:"flex",alignItems:"center",gap:10,margin:"14px 0 8px"}}><div style={{height:1,flex:1,background:"#E2E8F0"}}/><span style={{fontSize:11,fontWeight:600,color:"#A0AEC0"}}>{fmtDate(act.created_at)}</span><div style={{height:1,flex:1,background:"#E2E8F0"}}/></div>}
            <div style={{display:"flex",gap:12,marginBottom:8,padding:"12px 14px",background:"#fff",border:"1px solid #E2E8F0",borderRadius:10}}>
              <div style={{width:38,height:38,borderRadius:10,background:m.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{m.icon}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}>
                  <span style={{fontSize:13,fontWeight:700,color:m.c}}>{act.type}</span>
                  <span style={{fontSize:12,color:"#718096"}}>with</span>
                  <span style={{fontSize:13,fontWeight:600,color:"#0B1F3A"}}>{act.lead_name||"Unknown"}</span>
                </div>
                <div style={{fontSize:13,color:"#4A5568",lineHeight:1.6,marginBottom:4}}>{act.note}</div>
                <div style={{fontSize:11,color:"#A0AEC0"}}>Logged by {act.user_name} · {fmtDate(act.created_at)}</div>
              </div>
              {can(currentUser.role,"delete")&&<button onClick={()=>del(act.id)} style={{background:"none",border:"none",color:"#E2E8F0",fontSize:16,alignSelf:"flex-start",padding:0,transition:"color 0.15s"}} onMouseOver={e=>e.currentTarget.style.color="#B83232"} onMouseOut={e=>e.currentTarget.style.color="#E2E8F0"}>×</button>}
            </div>
          </div>);
        })}
      </div>
      {showAdd&&(
        <Modal title="Log New Activity" onClose={()=>setShowAdd(false)} width={460}>
          <FF label="Lead" required><select value={form.lead_id} onChange={e=>setForm(f=>({...f,lead_id:e.target.value}))}><option value="">Select a lead…</option>{leads.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></FF>
          <FF label="Activity Type"><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{ACT_TYPES.map(t=><button key={t} onClick={()=>setForm(f=>({...f,type:t}))} style={{padding:"6px 14px",borderRadius:20,border:`1.5px solid ${form.type===t?"#0B1F3A":"#E2E8F0"}`,background:form.type===t?"#0B1F3A":"#fff",color:form.type===t?"#fff":"#4A5568",fontSize:13,cursor:"pointer",fontWeight:form.type===t?600:400}}>{ACT_META[t]?.icon} {t}</button>)}</div></FF>
          <FF label="Note / Summary" required><textarea value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))} rows={4} placeholder="What happened?"/></FF>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <Btn variant="outline" onClick={()=>setShowAdd(false)}>Cancel</Btn>
            <Btn variant="gold" onClick={save} disabled={saving}>{saving?"Saving…":"Save Activity"}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// ROOT APP
// ══════════════════════════════════════════════════════
const TABS=[
  {id:"dashboard",  label:"Dashboard",        icon:"⊞", roles:["admin","manager","agent","viewer"]},
  {id:"leads",      label:"Leads",            icon:"👤", roles:["admin","manager","agent","viewer"]},
  {id:"builder",    label:"Property Builder", icon:"🏗", roles:["admin","manager","agent","viewer"]},
  {id:"leasing",    label:"Leasing",          icon:"🔑", roles:["admin","manager","agent","viewer"]},
  {id:"discounts",  label:"Discounts",        icon:"⚡", roles:["admin","manager","agent","viewer"]},
  {id:"pipeline",   label:"Pipeline",         icon:"⬡", roles:["admin","manager","agent","viewer"]},
  {id:"activity",   label:"Activity Log",     icon:"📋", roles:["admin","manager","agent","viewer"]},
  {id:"users",      label:"Users",            icon:"👥", roles:["admin"]},
];
const SUBTITLES={
  dashboard:"Your sales overview at a glance",
  leads:"Manage leads with stage gates and full communications",
  builder:"Project → Units (Residential & Commercial) → Sale & Lease pricing",
  leasing:"Tenants · Contracts · Payments · Renewals · Maintenance",
  discounts:"Discount approval hierarchy — Agent → Manager → Admin",
  pipeline:"Drag deals across stages",
  activity:"Every call, email, meeting and note — all logged",
  users:"Manage team access and roles",
};

// ══════════════════════════════════════════════════════
// PROPERTY BUILDER
// ══════════════════════════════════════════════════════
function PropertyBuilder({currentUser,showToast}) {
  const [projects,  setProjects]  = useState([]);
  const [units,     setUnits]     = useState([]);
  const [salePr,    setSalePr]    = useState([]);
  const [leasePr,   setLeasePr]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [selProj,   setSelProj]   = useState(null);
  const [selUnit,   setSelUnit]   = useState(null);
  const [view,      setView]      = useState("builder");
  const [uTypeTab,  setUTypeTab]  = useState("Residential");
  const [modal,     setModal]     = useState(null);
  const [saving,    setSaving]    = useState(false);
  const [fSearch,   setFSearch]   = useState("");
  const [fStatus,   setFStatus]   = useState("All");
  const [fPurpose,  setFPurpose]  = useState("All");

  const canEdit = can(currentUser.role,"write");
  const canDel  = can(currentUser.role,"delete");

  const RES_CATS  = ["Studio","1 Bed","2 Bed","3 Bed","4 Bed","5 Bed+","Villa","Townhouse","Penthouse","Duplex","Plot","Loft"];
  const COM_CATS  = ["Office","Retail / Shop","Warehouse","Labour Camp","Showroom","Restaurant","Medical","Mixed Use"];
  const VIEWS_L   = ["Sea View","Burj View","Pool View","Garden View","Park View","City View","Golf View","Canal View","Internal"];
  const UNIT_ST   = ["Available","Reserved","Under Offer","Sold","Leased","Blocked"];
  const UNIT_C_PB = {Available:{c:"#1A7F5A",bg:"#E6F4EE"},Reserved:{c:"#A06810",bg:"#FDF3DC"},"Under Offer":{c:"#B85C10",bg:"#FDF0E6"},Sold:{c:"#B83232",bg:"#FAEAEA"},Leased:{c:"#1A5FA8",bg:"#E6EFF9"},Blocked:{c:"#718096",bg:"#F0F2F5"}};

  const pBlank = {name:"",developer:"",location:"",community:"",status:"Active",launch_date:"",completion_date:"",website:"",description:""};
  const uBlank = {unit_ref:"",unit_type:"Residential",sub_type:"1 Bed",purpose:"Sale",floor_number:"",block_or_tower:"",view:"",facing:"",size_sqft:"",built_up_sqft:"",plot_sqft:"",balcony_sqft:"",bedrooms:"1",bathrooms:"1",parking_spaces:"0",maid_room:false,maid_bathroom:false,driver_room:false,store_room:false,laundry_room:false,study_room:false,garage:false,private_pool:false,private_garden:false,roof_terrace:false,furnishing:"Unfurnished",condition:"Off-plan",handover_date:"",status:"Available",is_featured:false,fit_out:"",notes:"",asking_price:"",price_per_sqft:"",service_charge_sqft:"",gross_yield:"",dld_fee_pct:"4",agency_fee_pct:"2",expected_rent:"",booking_pct:"10",during_construction_pct:"40",on_handover_pct:"50",post_handover_pct:"0",post_handover_years:"0",payment_plan_notes:"",annual_rent:"",rent_per_sqft:"",security_deposit:"",cheques_allowed:"4",chiller_included:false,municipality_tax_pct:"5"};
  const [pForm,setPForm] = useState(pBlank);
  const [uForm,setUForm] = useState(uBlank);

  const load = useCallback(async()=>{
    setLoading(true);
    const [p,u,sp,lp] = await Promise.all([
      supabase.from("projects").select("*").order("created_at",{ascending:false}),
      supabase.from("project_units").select("*").order("unit_ref"),
      supabase.from("unit_sale_pricing").select("*"),
      supabase.from("unit_lease_pricing").select("*"),
    ]);
    setProjects(p.data||[]); setUnits(u.data||[]); setSalePr(sp.data||[]); setLeasePr(lp.data||[]);
    setLoading(false);
  },[]);
  useEffect(()=>{load();},[load]);

  const getSP = id => salePr.find(s=>s.unit_id===id);
  const getLP = id => leasePr.find(l=>l.unit_id===id);
  const projUnits = selProj ? units.filter(u=>u.project_id===selProj.id&&u.unit_type===uTypeTab) : [];
  const n0 = v=>(v===""||v===null||v===undefined)?null:Number(v);

  const setU = (k,v)=>setUForm(f=>{
    const n={...f,[k]:v};
    if((k==="asking_price"||k==="size_sqft")&&n.asking_price&&n.size_sqft) n.price_per_sqft=Math.round(n.asking_price/n.size_sqft);
    if((k==="annual_rent"||k==="size_sqft")&&n.annual_rent&&n.size_sqft) n.rent_per_sqft=Math.round(n.annual_rent/n.size_sqft);
    if(k==="unit_type") n.sub_type=v==="Residential"?"1 Bed":"Office";
    return n;
  });

  const saveProject = async()=>{
    if(!pForm.name.trim()){showToast("Project name required","error");return;}
    setSaving(true);
    try{
      const {data,error}=await supabase.from("projects").insert({...pForm,launch_date:pForm.launch_date||null,completion_date:pForm.completion_date||null,created_by:currentUser.id}).select().single();
      if(error)throw error;
      setProjects(p=>[data,...p]); showToast("Project created","success"); setModal(null); setPForm(pBlank);
    }catch(e){showToast(e.message,"error");}
    setSaving(false);
  };

  const saveUnit = async(isEdit=false)=>{
    if(!uForm.unit_ref.trim()){showToast("Unit reference required","error");return;}
    if(!selProj&&!isEdit){showToast("Select a project first","error");return;}
    setSaving(true);
    try{
      const base={project_id:isEdit?selUnit.project_id:selProj.id,unit_ref:uForm.unit_ref.trim(),unit_type:uForm.unit_type,sub_type:uForm.sub_type,purpose:uForm.purpose,floor_number:n0(uForm.floor_number),block_or_tower:uForm.block_or_tower||null,view:uForm.view||null,facing:uForm.facing||null,size_sqft:n0(uForm.size_sqft),built_up_sqft:n0(uForm.built_up_sqft),plot_sqft:n0(uForm.plot_sqft),balcony_sqft:n0(uForm.balcony_sqft),bedrooms:n0(uForm.bedrooms)??1,bathrooms:n0(uForm.bathrooms)??1,parking_spaces:n0(uForm.parking_spaces)??0,maid_room:uForm.maid_room,maid_bathroom:uForm.maid_bathroom,driver_room:uForm.driver_room,store_room:uForm.store_room,laundry_room:uForm.laundry_room,study_room:uForm.study_room,garage:uForm.garage,private_pool:uForm.private_pool,private_garden:uForm.private_garden,roof_terrace:uForm.roof_terrace,furnishing:uForm.furnishing,condition:uForm.condition,handover_date:uForm.handover_date||null,status:uForm.status,is_featured:uForm.is_featured,fit_out:uForm.fit_out||null,notes:uForm.notes||null,created_by:currentUser.id};
      let uid;
      if(isEdit){
        const {data,error}=await supabase.from("project_units").update(base).eq("id",selUnit.id).select().single();
        if(error)throw error; setUnits(p=>p.map(u=>u.id===selUnit.id?data:u)); setSelUnit(data); uid=selUnit.id;
      }else{
        const {data,error}=await supabase.from("project_units").insert(base).select().single();
        if(error)throw error; setUnits(p=>[...p,data]); uid=data.id;
      }
      const pid=isEdit?selUnit.project_id:selProj.id;
      if(uForm.purpose==="Sale"||uForm.purpose==="Both"){
        const sp={unit_id:uid,project_id:pid,asking_price:n0(uForm.asking_price),price_per_sqft:n0(uForm.price_per_sqft),service_charge_sqft:n0(uForm.service_charge_sqft),gross_yield:n0(uForm.gross_yield),dld_fee_pct:n0(uForm.dld_fee_pct)??4,agency_fee_pct:n0(uForm.agency_fee_pct)??2,expected_rent:n0(uForm.expected_rent),booking_pct:n0(uForm.booking_pct)??10,during_construction_pct:n0(uForm.during_construction_pct)??40,on_handover_pct:n0(uForm.on_handover_pct)??50,post_handover_pct:n0(uForm.post_handover_pct)??0,post_handover_years:n0(uForm.post_handover_years)??0,payment_plan_notes:uForm.payment_plan_notes||null};
        const ex=getSP(uid);
        if(ex){const {data}=await supabase.from("unit_sale_pricing").update(sp).eq("id",ex.id).select().single();if(data)setSalePr(p=>p.map(x=>x.id===ex.id?data:x));}
        else{const {data}=await supabase.from("unit_sale_pricing").insert(sp).select().single();if(data)setSalePr(p=>[...p,data]);}
      }
      if(uForm.purpose==="Lease"||uForm.purpose==="Both"){
        const lp={unit_id:uid,project_id:pid,annual_rent:n0(uForm.annual_rent),rent_per_sqft:n0(uForm.rent_per_sqft),security_deposit:n0(uForm.security_deposit),cheques_allowed:n0(uForm.cheques_allowed)??4,chiller_included:uForm.chiller_included,municipality_tax_pct:n0(uForm.municipality_tax_pct)??5};
        const ex=getLP(uid);
        if(ex){const {data}=await supabase.from("unit_lease_pricing").update(lp).eq("id",ex.id).select().single();if(data)setLeasePr(p=>p.map(x=>x.id===ex.id?data:x));}
        else{const {data}=await supabase.from("unit_lease_pricing").insert(lp).select().single();if(data)setLeasePr(p=>[...p,data]);}
      }
      showToast(isEdit?"Unit updated":"Unit added","success"); setModal(null); setUForm(uBlank);
    }catch(e){showToast("Save failed: "+e.message,"error");}
    setSaving(false);
  };

  const openEdit=u=>{
    const sp=getSP(u.id)||{}; const lp=getLP(u.id)||{};
    setUForm({...uBlank,...u,floor_number:u.floor_number??"",size_sqft:u.size_sqft??"",built_up_sqft:u.built_up_sqft??"",plot_sqft:u.plot_sqft??"",balcony_sqft:u.balcony_sqft??"",bedrooms:u.bedrooms??1,bathrooms:u.bathrooms??1,parking_spaces:u.parking_spaces??0,handover_date:u.handover_date??"",asking_price:sp.asking_price??"",price_per_sqft:sp.price_per_sqft??"",service_charge_sqft:sp.service_charge_sqft??"",gross_yield:sp.gross_yield??"",dld_fee_pct:sp.dld_fee_pct??4,agency_fee_pct:sp.agency_fee_pct??2,expected_rent:sp.expected_rent??"",booking_pct:sp.booking_pct??10,during_construction_pct:sp.during_construction_pct??40,on_handover_pct:sp.on_handover_pct??50,post_handover_pct:sp.post_handover_pct??0,post_handover_years:sp.post_handover_years??0,payment_plan_notes:sp.payment_plan_notes??"",annual_rent:lp.annual_rent??"",rent_per_sqft:lp.rent_per_sqft??"",security_deposit:lp.security_deposit??"",cheques_allowed:lp.cheques_allowed??4,chiller_included:lp.chiller_included??false,municipality_tax_pct:lp.municipality_tax_pct??5,fit_out:u.fit_out??""});
    setSelUnit(u); setModal("editunit");
  };

  const allFiltered = units.filter(u=>{
    const p=projects.find(x=>x.id===u.project_id); const q=fSearch.toLowerCase();
    return (!q||u.unit_ref?.toLowerCase().includes(q)||p?.name?.toLowerCase().includes(q)||u.sub_type?.toLowerCase().includes(q))&&(fStatus==="All"||u.status===fStatus)&&(fPurpose==="All"||u.purpose===fPurpose||u.purpose==="Both");
  });

  if(loading) return <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",color:"#A0AEC0",fontSize:14}}>Loading Property Builder…</div>;

  const renderUnitModal=(isEdit)=>(
    <Modal title={isEdit?`Edit — ${selUnit?.unit_ref}`:`Add Unit — ${selProj?.name}`} onClose={()=>{setModal(null);setUForm(uBlank);}} width={660}>
      <div style={{maxHeight:"72vh",overflowY:"auto",paddingRight:4}}>
        {/* Purpose */}
        <div style={{display:"flex",gap:8,marginBottom:16}}>
          {[["Sale","🏷 For Sale"],["Lease","🔑 For Lease"],["Both","♻ Sale & Lease"]].map(([v,l])=>(
            <button key={v} onClick={()=>setU("purpose",v)} style={{flex:1,padding:"10px",borderRadius:8,border:`2px solid ${uForm.purpose===v?"#0B1F3A":"#E2E8F0"}`,background:uForm.purpose===v?"#0B1F3A":"#fff",color:uForm.purpose===v?"#fff":"#4A5568",cursor:"pointer",fontWeight:uForm.purpose===v?600:400,fontSize:13}}>{l}</button>
          ))}
        </div>
        {/* Type & Category */}
        <div style={{background:"#F7F9FC",border:"1px solid #E2E8F0",borderRadius:10,padding:"14px",marginBottom:14}}>
          <div style={{fontSize:12,fontWeight:700,color:"#0B1F3A",marginBottom:10}}>Property Type & Category</div>
          <div style={{display:"flex",gap:8,marginBottom:10}}>
            {[["Residential","🏘 Residential","Apartment · Villa · Studio"],["Commercial","🏢 Commercial","Office · Shop · Warehouse"]].map(([v,l,d])=>(
              <button key={v} onClick={()=>setU("unit_type",v)} style={{flex:1,padding:"10px",borderRadius:8,border:`2px solid ${uForm.unit_type===v?"#0B1F3A":"#E2E8F0"}`,background:uForm.unit_type===v?"#0B1F3A":"#fff",color:uForm.unit_type===v?"#fff":"#4A5568",cursor:"pointer",textAlign:"left"}}>
                <div style={{fontSize:13,fontWeight:700}}>{l}</div>
                <div style={{fontSize:11,opacity:.65,marginTop:2}}>{d}</div>
              </button>
            ))}
          </div>
          <div style={{marginBottom:6}}>
            <label style={{fontSize:11,fontWeight:600,color:"#4A5568",textTransform:"uppercase",letterSpacing:".5px",display:"block",marginBottom:5}}>Category</label>
            <select value={uForm.sub_type} onChange={e=>setU("sub_type",e.target.value)} style={{width:"100%",fontSize:14}}>
              {(uForm.unit_type==="Residential"?RES_CATS:COM_CATS).map(s=><option key={s}>{s}</option>)}
            </select>
            <div style={{fontSize:11,color:"#A0AEC0",marginTop:4}}>{uForm.unit_type==="Residential"?"Studio=no bedroom · 1/2/3 Bed=apartment · Villa=standalone house · Townhouse=multi-floor home":"Office=workspace · Retail=shop · Warehouse=storage · Labour Camp=worker housing"}</div>
          </div>
        </div>
        {/* Reference */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
          <div>
            <label style={{fontSize:11,fontWeight:600,color:"#4A5568",textTransform:"uppercase",letterSpacing:".5px",display:"block",marginBottom:5}}>Unit Reference *</label>
            <input value={uForm.unit_ref} onChange={e=>setU("unit_ref",e.target.value)} placeholder="A-101 / Villa-12 / Shop-G04"/>
          </div>
          <div>
            <label style={{fontSize:11,fontWeight:600,color:"#4A5568",textTransform:"uppercase",letterSpacing:".5px",display:"block",marginBottom:5}}>Block / Tower</label>
            <input value={uForm.block_or_tower} onChange={e=>setU("block_or_tower",e.target.value)} placeholder="Tower A / Block 3"/>
          </div>
        </div>
        {/* Beds & Baths — Residential only / Rooms — Commercial */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:12}}>
          {uForm.unit_type==="Residential"&&(
            <>
              <div>
                <label style={{fontSize:11,fontWeight:600,color:"#4A5568",textTransform:"uppercase",letterSpacing:".5px",display:"block",marginBottom:5}}>Bedrooms</label>
                <select value={uForm.bedrooms} onChange={e=>setU("bedrooms",e.target.value)}>{[0,1,2,3,4,5,6,7].map(n=><option key={n} value={n}>{n===0?"Studio":n}</option>)}</select>
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:600,color:"#4A5568",textTransform:"uppercase",letterSpacing:".5px",display:"block",marginBottom:5}}>Bathrooms</label>
                <select value={uForm.bathrooms} onChange={e=>setU("bathrooms",e.target.value)}>{[1,1.5,2,2.5,3,3.5,4,5].map(n=><option key={n} value={n}>{n}</option>)}</select>
              </div>
            </>
          )}
          <div>
            <label style={{fontSize:11,fontWeight:600,color:"#4A5568",textTransform:"uppercase",letterSpacing:".5px",display:"block",marginBottom:5}}>Parking Spaces</label>
            <input type="number" value={uForm.parking_spaces} onChange={e=>setU("parking_spaces",e.target.value)} min="0"/>
          </div>
          <div>
            <label style={{fontSize:11,fontWeight:600,color:"#4A5568",textTransform:"uppercase",letterSpacing:".5px",display:"block",marginBottom:5}}>Floor</label>
            <input type="number" value={uForm.floor_number} onChange={e=>setU("floor_number",e.target.value)}/>
          </div>
        </div>
        {/* Sizes */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:12}}>
          <div>
            <label style={{fontSize:11,fontWeight:600,color:"#4A5568",textTransform:"uppercase",letterSpacing:".5px",display:"block",marginBottom:5}}>Size (sqft)</label>
            <input type="number" value={uForm.size_sqft} onChange={e=>setU("size_sqft",e.target.value)} placeholder="Total area"/>
          </div>
          <div>
            <label style={{fontSize:11,fontWeight:600,color:"#4A5568",textTransform:"uppercase",letterSpacing:".5px",display:"block",marginBottom:5}}>Built-up (sqft)</label>
            <input type="number" value={uForm.built_up_sqft} onChange={e=>setU("built_up_sqft",e.target.value)}/>
          </div>
          {uForm.unit_type==="Residential"&&(
            <div>
              <label style={{fontSize:11,fontWeight:600,color:"#4A5568",textTransform:"uppercase",letterSpacing:".5px",display:"block",marginBottom:5}}>Plot (sqft)</label>
              <input type="number" value={uForm.plot_sqft} onChange={e=>setU("plot_sqft",e.target.value)} placeholder="Villas / plots"/>
            </div>
          )}
          {uForm.unit_type==="Residential"&&(
            <div>
              <label style={{fontSize:11,fontWeight:600,color:"#4A5568",textTransform:"uppercase",letterSpacing:".5px",display:"block",marginBottom:5}}>Balcony (sqft)</label>
              <input type="number" value={uForm.balcony_sqft} onChange={e=>setU("balcony_sqft",e.target.value)}/>
            </div>
          )}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
          <div>
            <label style={{fontSize:11,fontWeight:600,color:"#4A5568",textTransform:"uppercase",letterSpacing:".5px",display:"block",marginBottom:5}}>View</label>
            <select value={uForm.view} onChange={e=>setU("view",e.target.value)}><option value="">Select…</option>{VIEWS_L.map(v=><option key={v}>{v}</option>)}</select>
          </div>
          <div>
            <label style={{fontSize:11,fontWeight:600,color:"#4A5568",textTransform:"uppercase",letterSpacing:".5px",display:"block",marginBottom:5}}>Status</label>
            <select value={uForm.status} onChange={e=>setU("status",e.target.value)}>{UNIT_ST.map(s=><option key={s}>{s}</option>)}</select>
          </div>
        </div>
        {/* Facilities */}
        <div style={{background:"#FAFBFC",border:"1px solid #E2E8F0",borderRadius:10,padding:"12px",marginBottom:14}}>
          <div style={{fontSize:11,fontWeight:700,color:"#0B1F3A",textTransform:"uppercase",letterSpacing:".5px",marginBottom:10}}>
            {uForm.unit_type==="Residential"?"🏘 Residential Facilities":"🏢 Commercial Facilities"}
          </div>
          {uForm.unit_type==="Residential"?(
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
              {[["maid_room","🧹 Maid Room"],["maid_bathroom","🚿 Maid Bathroom"],["driver_room","🚗 Driver Room"],["store_room","📦 Store Room"],["laundry_room","👕 Laundry Room"],["study_room","📚 Study Room"],["private_pool","🏊 Private Pool"],["private_garden","🌿 Private Garden"],["roof_terrace","🏠 Roof Terrace"],["garage","🚙 Garage"]].map(([k,l])=>(
                <label key={k} style={{display:"flex",alignItems:"center",gap:7,fontSize:13,color:"#4A5568",cursor:"pointer"}}>
                  <input type="checkbox" checked={uForm[k]||false} onChange={e=>setU(k,e.target.checked)}/>{l}
                </label>
              ))}
            </div>
          ):(
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
              {[["store_room","📦 Storage Room"],["garage","🚙 Parking / Garage"],["roof_terrace","🏠 Roof Access"]].map(([k,l])=>(
                <label key={k} style={{display:"flex",alignItems:"center",gap:7,fontSize:13,color:"#4A5568",cursor:"pointer"}}>
                  <input type="checkbox" checked={uForm[k]||false} onChange={e=>setU(k,e.target.checked)}/>{l}
                </label>
              ))}
            </div>
          )}
        </div>
        {/* Condition */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:14}}>
          {uForm.unit_type==="Residential"&&(
            <div>
              <label style={{fontSize:11,fontWeight:600,color:"#4A5568",textTransform:"uppercase",letterSpacing:".5px",display:"block",marginBottom:5}}>Furnishing</label>
              <select value={uForm.furnishing} onChange={e=>setU("furnishing",e.target.value)}>{["Unfurnished","Semi-Furnished","Furnished"].map(o=><option key={o}>{o}</option>)}</select>
            </div>
          )}
          {uForm.unit_type==="Commercial"&&(
            <div>
              <label style={{fontSize:11,fontWeight:600,color:"#4A5568",textTransform:"uppercase",letterSpacing:".5px",display:"block",marginBottom:5}}>Fit-out</label>
              <select value={uForm.fit_out||""} onChange={e=>setU("fit_out",e.target.value)}>
                <option value="">Select…</option>
                {["Shell & Core","Category A","Category B","Fully Fitted","Partly Fitted"].map(o=><option key={o}>{o}</option>)}
              </select>
            </div>
          )}
          <div>
            <label style={{fontSize:11,fontWeight:600,color:"#4A5568",textTransform:"uppercase",letterSpacing:".5px",display:"block",marginBottom:5}}>Condition</label>
            <select value={uForm.condition} onChange={e=>setU("condition",e.target.value)}>{["Off-plan","Ready","Resale","Renovated"].map(o=><option key={o}>{o}</option>)}</select>
          </div>
          <div>
            <label style={{fontSize:11,fontWeight:600,color:"#4A5568",textTransform:"uppercase",letterSpacing:".5px",display:"block",marginBottom:5}}>Handover Date</label>
            <input type="date" value={uForm.handover_date} onChange={e=>setU("handover_date",e.target.value)}/>
          </div>
        </div>
        {/* Sale Pricing */}
        {(uForm.purpose==="Sale"||uForm.purpose==="Both")&&(
          <div style={{background:"#FDF8EC",border:"1px solid #E8C97A",borderRadius:10,padding:"12px",marginBottom:12}}>
            <div style={{fontSize:12,fontWeight:700,color:"#8A6200",marginBottom:10}}>🏷 SALE PRICING</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
              {[["Asking Price (AED)","asking_price","2,500,000"],["Price / sqft (AED)","price_per_sqft","Auto-calc"],["Service Charge/sqft/yr","service_charge_sqft",""],["Gross Yield (%)","gross_yield","7.5"],["DLD Fee (%)","dld_fee_pct","4"],["Agency Fee (%)","agency_fee_pct","2"]].map(([l,k,ph])=>(
                <div key={k}>
                  <label style={{fontSize:11,fontWeight:600,color:"#8A6200",textTransform:"uppercase",letterSpacing:".4px",display:"block",marginBottom:4}}>{l}</label>
                  <input type="number" value={uForm[k]} onChange={e=>setU(k,e.target.value)} placeholder={ph}/>
                </div>
              ))}
            </div>
            {uForm.asking_price&&uForm.size_sqft&&(
              <div style={{background:"#fff",border:"1px solid #E8C97A",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#8A6200",marginBottom:10}}>
                💡 {Math.round(Number(uForm.asking_price)/Number(uForm.size_sqft)).toLocaleString()} AED/sqft · DLD: AED {Math.round(Number(uForm.asking_price)*Number(uForm.dld_fee_pct||4)/100).toLocaleString()} · Total ≈ AED {Math.round(Number(uForm.asking_price)*(1+(Number(uForm.dld_fee_pct||4)+Number(uForm.agency_fee_pct||2))/100)).toLocaleString()}
              </div>
            )}
            <div style={{fontSize:11,fontWeight:700,color:"#8A6200",marginBottom:8}}>PAYMENT PLAN (%)</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:8}}>
              {[["Booking","booking_pct"],["Construction","during_construction_pct"],["Handover","on_handover_pct"],["Post-Handover","post_handover_pct"]].map(([l,k])=>(
                <div key={k}>
                  <label style={{fontSize:10,color:"#8A6200",display:"block",marginBottom:4}}>{l}</label>
                  <input type="number" value={uForm[k]} onChange={e=>setU(k,e.target.value)}/>
                </div>
              ))}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div>
                <label style={{fontSize:10,color:"#8A6200",display:"block",marginBottom:4}}>Post-Handover Years</label>
                <input type="number" value={uForm.post_handover_years} onChange={e=>setU("post_handover_years",e.target.value)}/>
              </div>
              <div>
                <label style={{fontSize:10,color:"#8A6200",display:"block",marginBottom:4}}>Notes</label>
                <input value={uForm.payment_plan_notes} onChange={e=>setU("payment_plan_notes",e.target.value)} placeholder="e.g. 40/60 over 3 years"/>
              </div>
            </div>
          </div>
        )}
        {/* Lease Pricing */}
        {(uForm.purpose==="Lease"||uForm.purpose==="Both")&&(
          <div style={{background:"#E6EFF9",border:"1px solid #B5D4F4",borderRadius:10,padding:"12px",marginBottom:12}}>
            <div style={{fontSize:12,fontWeight:700,color:"#1A5FA8",marginBottom:10}}>🔑 LEASE PRICING</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:8}}>
              {[["Annual Rent (AED)","annual_rent","120,000"],["Rent / sqft (AED)","rent_per_sqft","Auto"],["Security Deposit","security_deposit","5% of rent"],["Municipality Tax (%)","municipality_tax_pct","5"]].map(([l,k,ph])=>(
                <div key={k}>
                  <label style={{fontSize:11,fontWeight:600,color:"#1A5FA8",textTransform:"uppercase",letterSpacing:".4px",display:"block",marginBottom:4}}>{l}</label>
                  <input type="number" value={uForm[k]} onChange={e=>setU(k,e.target.value)} placeholder={ph}/>
                </div>
              ))}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div>
                <label style={{fontSize:11,fontWeight:600,color:"#1A5FA8",textTransform:"uppercase",letterSpacing:".4px",display:"block",marginBottom:4}}>Cheques Allowed</label>
                <select value={uForm.cheques_allowed} onChange={e=>setU("cheques_allowed",e.target.value)}>{[["1","Annual (1)"],["2","Bi-Annual (2)"],["4","Quarterly (4)"],["12","Monthly (12)"]].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8,marginTop:24}}>
                <input type="checkbox" checked={uForm.chiller_included} onChange={e=>setU("chiller_included",e.target.checked)}/>
                <span style={{fontSize:13,color:"#4A5568"}}>Chiller included in rent</span>
              </div>
            </div>
            {uForm.annual_rent&&(
              <div style={{background:"#fff",border:"1px solid #B5D4F4",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#1A5FA8",marginTop:8}}>
                💡 Monthly: AED {Math.round(Number(uForm.annual_rent)/12).toLocaleString()}{uForm.size_sqft?` · AED ${Math.round(Number(uForm.annual_rent)/Number(uForm.size_sqft))}/sqft`:""}
              </div>
            )}
          </div>
        )}
        <div>
          <label style={{fontSize:11,fontWeight:600,color:"#4A5568",textTransform:"uppercase",letterSpacing:".5px",display:"block",marginBottom:5}}>Notes</label>
          <textarea value={uForm.notes} onChange={e=>setU("notes",e.target.value)} rows={2}/>
        </div>
      </div>
      <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:14,paddingTop:14,borderTop:"1px solid #E2E8F0"}}>
        <button onClick={()=>{setModal(null);setUForm(uBlank);}} style={{padding:"9px 18px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",color:"#0B1F3A",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancel</button>
        <button onClick={()=>saveUnit(isEdit)} disabled={saving} style={{padding:"9px 18px",borderRadius:8,border:"none",background:saving?"#A0AEC0":"#0B1F3A",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>{saving?"Saving…":isEdit?"Save Changes":"Add Unit"}</button>
      </div>
    </Modal>
  );

  const fmtAED2 = n=>n?`AED ${Number(n).toLocaleString("en-AE")}`:"—";

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      {/* Top bar */}
      <div style={{display:"flex",gap:8,marginBottom:14,alignItems:"center",flexWrap:"wrap"}}>
        <div style={{display:"flex",gap:4}}>
          {[["builder","🏗 Builder"],["all","📋 All Units"]].map(([id,l])=>(
            <button key={id} onClick={()=>setView(id)} style={{padding:"7px 16px",borderRadius:8,border:`1.5px solid ${view===id?"#0B1F3A":"#E2E8F0"}`,background:view===id?"#0B1F3A":"#fff",color:view===id?"#fff":"#4A5568",fontSize:13,fontWeight:view===id?600:400,cursor:"pointer"}}>{l}</button>
          ))}
        </div>
        <span style={{fontSize:12,color:"#A0AEC0",marginLeft:8}}>{projects.length} projects · {units.length} units · {units.filter(u=>u.status==="Available").length} available</span>
        <div style={{marginLeft:"auto"}}>{canEdit&&<button onClick={()=>{setPForm(pBlank);setModal("proj");}} style={{padding:"9px 18px",borderRadius:8,border:"none",background:"#0B1F3A",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>+ New Project</button>}</div>
      </div>

      {/* Builder view */}
      {view==="builder"&&(
        <div style={{display:"flex",gap:12,flex:1,overflow:"hidden"}}>
          {/* Projects */}
          <div style={{width:200,flexShrink:0,overflowY:"auto"}}>
            <div style={{fontSize:10,fontWeight:700,color:"#A0AEC0",textTransform:"uppercase",letterSpacing:".6px",marginBottom:8}}>Projects ({projects.length})</div>
            {projects.length===0&&<div style={{textAlign:"center",padding:"2rem 1rem",color:"#A0AEC0"}}><div style={{fontSize:32,marginBottom:8}}>📁</div><div style={{fontSize:13}}>No projects yet<br/>Click + New Project</div></div>}
            {projects.map(p=>{
              const isSel=selProj?.id===p.id;
              return (
                <div key={p.id} onClick={()=>{setSelProj(p);setSelUnit(null);}} style={{padding:"10px 12px",borderRadius:10,border:`1.5px solid ${isSel?"#C9A84C":"#E2E8F0"}`,background:isSel?"#0B1F3A":"#fff",cursor:"pointer",marginBottom:6,transition:"all .15s"}}>
                  <div style={{fontSize:13,fontWeight:700,color:isSel?"#fff":"#0B1F3A",marginBottom:2}}>{p.name}</div>
                  <div style={{fontSize:11,color:isSel?"#C9A84C88":"#A0AEC0"}}>{p.developer||"—"}</div>
                  <div style={{fontSize:11,color:isSel?"#C9A84C88":"#A0AEC0"}}>📍 {p.location||"—"}</div>
                  <div style={{display:"flex",gap:5,marginTop:5}}>
                    <span style={{fontSize:10,fontWeight:600,padding:"1px 7px",borderRadius:20,background:isSel?"rgba(201,168,76,.2)":"#E6F4EE",color:isSel?"#C9A84C":"#1A7F5A"}}>{p.status}</span>
                    <span style={{fontSize:10,color:isSel?"#C9A84C44":"#A0AEC0"}}>{units.filter(u=>u.project_id===p.id).length} units</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Units */}
          {selProj&&(
            <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0}}>
              <div style={{background:"#0B1F3A",borderRadius:10,padding:"12px 16px",marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontFamily:"'Playfair Display',serif",fontSize:16,color:"#fff",fontWeight:700}}>{selProj.name}</div>
                  <div style={{fontSize:12,color:"#C9A84C",marginTop:2}}>{selProj.developer}{selProj.location?` · 📍 ${selProj.location}`:""}</div>
                </div>
                <div style={{display:"flex",gap:8}}>
                  {canDel&&<button onClick={async()=>{if(!window.confirm("Delete project and all units?"))return;await supabase.from("projects").delete().eq("id",selProj.id);setProjects(p=>p.filter(x=>x.id!==selProj.id));setSelProj(null);setSelUnit(null);showToast("Deleted","info");}} style={{padding:"6px 14px",borderRadius:8,border:"1.5px solid #F0BCBC",background:"#FAEAEA",color:"#B83232",fontSize:12,fontWeight:600,cursor:"pointer"}}>Delete Project</button>}
                  {canEdit&&<button onClick={()=>{setUForm(uBlank);setModal("unit");}} style={{padding:"6px 14px",borderRadius:8,border:"none",background:"#C9A84C",color:"#0B1F3A",fontSize:12,fontWeight:600,cursor:"pointer"}}>+ Add Unit</button>}
                </div>
              </div>
              <div style={{display:"flex",gap:6,marginBottom:10}}>
                {["Residential","Commercial"].map(t=>{
                  const cnt=units.filter(u=>u.project_id===selProj.id&&u.unit_type===t).length;
                  return <button key={t} onClick={()=>{setUTypeTab(t);setSelUnit(null);}} style={{padding:"5px 16px",borderRadius:8,border:`1.5px solid ${uTypeTab===t?"#0B1F3A":"#E2E8F0"}`,background:uTypeTab===t?"#0B1F3A":"#fff",color:uTypeTab===t?"#fff":"#4A5568",fontSize:12,fontWeight:uTypeTab===t?600:400,cursor:"pointer"}}>{t==="Residential"?"🏘":"🏢"} {t} ({cnt})</button>;
                })}
              </div>
              {projUnits.length===0&&<div style={{textAlign:"center",padding:"3rem 1rem",color:"#A0AEC0"}}><div style={{fontSize:40,marginBottom:10}}>{uTypeTab==="Residential"?"🏘":"🏢"}</div><div style={{fontSize:14}}>No {uTypeTab.toLowerCase()} units yet<br/>Click + Add Unit above</div></div>}
              <div style={{flex:1,overflowY:"auto",display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(210px,1fr))",gap:10,alignContent:"start"}}>
                {projUnits.map(u=>{
                  const sp=getSP(u.id); const lp=getLP(u.id);
                  const sc=UNIT_C_PB[u.status]||{c:"#718096",bg:"#F0F2F5"};
                  const isSel=selUnit?.id===u.id;
                  return (
                    <div key={u.id} onClick={()=>setSelUnit(isSel?null:u)} style={{background:isSel?"#0B1F3A":"#fff",border:`1.5px solid ${isSel?"#C9A84C":"#E2E8F0"}`,borderRadius:12,padding:"12px 14px",cursor:"pointer",transition:"all .15s"}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                        <div style={{fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:700,color:isSel?"#C9A84C":"#0B1F3A"}}>{u.unit_ref}</div>
                        <span style={{fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:20,background:sc.bg,color:sc.c}}>{u.status}</span>
                      </div>
                      <div style={{display:"flex",gap:4,marginBottom:6,flexWrap:"wrap"}}>
                        <span style={{fontSize:10,fontWeight:600,padding:"2px 7px",borderRadius:20,background:isSel?"rgba(255,255,255,.1)":"#F0F2F5",color:isSel?"#C9A84C":"#4A5568"}}>{u.sub_type}</span>
                        <span style={{fontSize:10,fontWeight:600,padding:"2px 7px",borderRadius:20,background:u.purpose==="Sale"?"#E6F4EE":u.purpose==="Lease"?"#E6EFF9":"#FDF3DC",color:u.purpose==="Sale"?"#1A7F5A":u.purpose==="Lease"?"#1A5FA8":"#A06810"}}>{u.purpose}</span>
                      </div>
                      <div style={{fontSize:11,color:isSel?"#C9A84C88":"#A0AEC0",marginBottom:6}}>
                        {u.bedrooms===0?"Studio":`${u.bedrooms} Bed`}{u.bathrooms?` · ${u.bathrooms} Bath`:""}{u.size_sqft?` · ${Number(u.size_sqft).toLocaleString()} sqft`:""}
                      </div>
                      <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:6}}>
                        {u.maid_room&&<span style={{fontSize:9,padding:"1px 6px",borderRadius:20,background:"#EEE8F9",color:"#5B3FAA"}}>Maid</span>}
                        {u.private_pool&&<span style={{fontSize:9,padding:"1px 6px",borderRadius:20,background:"#E6EFF9",color:"#1A5FA8"}}>Pool</span>}
                        {u.private_garden&&<span style={{fontSize:9,padding:"1px 6px",borderRadius:20,background:"#E6F4EE",color:"#1A7F5A"}}>Garden</span>}
                        {u.parking_spaces>0&&<span style={{fontSize:9,padding:"1px 6px",borderRadius:20,background:"#F0F2F5",color:"#4A5568"}}>P:{u.parking_spaces}</span>}
                      </div>
                      {sp?.asking_price&&<div style={{fontFamily:"'Playfair Display',serif",fontSize:14,fontWeight:700,color:isSel?"#C9A84C":"#0B1F3A"}}>{fmtAED2(sp.asking_price)}{sp.price_per_sqft&&<span style={{fontSize:10,fontWeight:400,color:isSel?"#C9A84C88":"#A0AEC0"}}> · AED {Number(sp.price_per_sqft).toLocaleString()}/sqft</span>}</div>}
                      {lp?.annual_rent&&<div style={{fontSize:12,fontWeight:600,color:isSel?"#C9A84C":"#1A5FA8"}}>🔑 {fmtAED2(lp.annual_rent)}/yr</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Unit detail */}
          {selUnit&&(()=>{
            const sp=getSP(selUnit.id); const lp=getLP(selUnit.id);
            const sc=UNIT_C_PB[selUnit.status]||{c:"#718096",bg:"#F0F2F5"};
            return (
              <div style={{width:300,flexShrink:0,background:"#fff",border:"1px solid #E2E8F0",borderRadius:12,overflow:"hidden",display:"flex",flexDirection:"column"}}>
                <div style={{background:"#0B1F3A",padding:"1.25rem",position:"relative"}}>
                  <button onClick={()=>setSelUnit(null)} style={{position:"absolute",top:10,right:12,background:"none",border:"none",color:"#C9A84C",fontSize:20,cursor:"pointer"}}>×</button>
                  <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,color:"#C9A84C",fontWeight:700}}>{selUnit.unit_ref}</div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,.6)",marginTop:4}}>{selProj?.name} · {selUnit.sub_type}</div>
                  <div style={{display:"flex",gap:5,marginTop:8}}>
                    <span style={{fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:20,background:sc.bg,color:sc.c}}>{selUnit.status}</span>
                    <span style={{fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:20,background:selUnit.purpose==="Sale"?"#E6F4EE":selUnit.purpose==="Lease"?"#E6EFF9":"#FDF3DC",color:selUnit.purpose==="Sale"?"#1A7F5A":selUnit.purpose==="Lease"?"#1A5FA8":"#A06810"}}>{selUnit.purpose}</span>
                  </div>
                </div>
                <div style={{flex:1,overflowY:"auto",padding:"1rem"}}>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,background:"#FAFBFC",borderRadius:10,padding:10,marginBottom:12}}>
                    {[["Bedrooms",selUnit.bedrooms===0?"Studio":selUnit.bedrooms],["Bathrooms",selUnit.bathrooms],["Size",selUnit.size_sqft?`${Number(selUnit.size_sqft).toLocaleString()} sqft`:"—"],["Floor",selUnit.floor_number||"—"],["Parking",selUnit.parking_spaces||0],["View",selUnit.view||"—"],["Condition",selUnit.condition],["Furnishing",selUnit.furnishing]].map(([l,v])=>(
                      <div key={l}><div style={{fontSize:9,color:"#A0AEC0",textTransform:"uppercase",letterSpacing:".5px"}}>{l}</div><div style={{fontSize:12,fontWeight:600,color:"#0B1F3A"}}>{v}</div></div>
                    ))}
                  </div>
                  {[selUnit.maid_room&&"Maid Room",selUnit.private_pool&&"Private Pool",selUnit.private_garden&&"Garden",selUnit.roof_terrace&&"Roof Terrace",selUnit.garage&&"Garage",selUnit.store_room&&"Store Room"].filter(Boolean).length>0&&(
                    <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:12}}>
                      {[selUnit.maid_room&&"Maid Room",selUnit.private_pool&&"Private Pool",selUnit.private_garden&&"Garden",selUnit.roof_terrace&&"Roof Terrace",selUnit.garage&&"Garage",selUnit.store_room&&"Store Room"].filter(Boolean).map(f=>(
                        <span key={f} style={{fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:20,background:"#EEE8F9",color:"#5B3FAA"}}>{f}</span>
                      ))}
                    </div>
                  )}
                  {sp&&(selUnit.purpose==="Sale"||selUnit.purpose==="Both")&&(
                    <div style={{background:"#FDF8EC",border:"1px solid #E8C97A",borderRadius:10,padding:"10px 12px",marginBottom:10}}>
                      <div style={{fontSize:10,fontWeight:700,color:"#8A6200",marginBottom:8}}>🏷 SALE PRICING</div>
                      <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700,color:"#0B1F3A",marginBottom:6}}>{fmtAED2(sp.asking_price)}</div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                        {sp.price_per_sqft&&<div><div style={{fontSize:9,color:"#A0AEC0"}}>PER SQFT</div><div style={{fontSize:12,fontWeight:600}}>AED {Number(sp.price_per_sqft).toLocaleString()}</div></div>}
                        {sp.gross_yield&&<div><div style={{fontSize:9,color:"#A0AEC0"}}>GROSS YIELD</div><div style={{fontSize:12,fontWeight:600,color:"#1A7F5A"}}>{sp.gross_yield}%</div></div>}
                        <div><div style={{fontSize:9,color:"#A0AEC0"}}>DLD FEE</div><div style={{fontSize:12,fontWeight:600}}>{sp.dld_fee_pct||4}%</div></div>
                      </div>
                      {(sp.booking_pct||sp.during_construction_pct)&&(
                        <div style={{marginTop:8}}>
                          <div style={{fontSize:9,color:"#A0AEC0",marginBottom:5}}>PAYMENT PLAN</div>
                          <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                            {[["Booking",sp.booking_pct],["Build",sp.during_construction_pct],["Handover",sp.on_handover_pct],["Post",sp.post_handover_pct]].filter(([,v])=>v>0).map(([l,v])=>(
                              <div key={l} style={{background:"#fff",border:"1px solid #E8C97A",borderRadius:6,padding:"3px 7px",textAlign:"center"}}>
                                <div style={{fontSize:9,color:"#A06810"}}>{l}</div>
                                <div style={{fontSize:12,fontWeight:700}}>{v}%</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {lp&&(selUnit.purpose==="Lease"||selUnit.purpose==="Both")&&(
                    <div style={{background:"#E6EFF9",border:"1px solid #B5D4F4",borderRadius:10,padding:"10px 12px",marginBottom:10}}>
                      <div style={{fontSize:10,fontWeight:700,color:"#1A5FA8",marginBottom:8}}>🔑 LEASE PRICING</div>
                      <div style={{fontFamily:"'Playfair Display',serif",fontSize:16,fontWeight:700,color:"#0B1F3A",marginBottom:6}}>{fmtAED2(lp.annual_rent)}<span style={{fontSize:11,fontWeight:400,color:"#A0AEC0"}}>/year</span></div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                        <div><div style={{fontSize:9,color:"#A0AEC0"}}>MONTHLY</div><div style={{fontSize:12,fontWeight:600}}>AED {Math.round(Number(lp.annual_rent)/12).toLocaleString()}</div></div>
                        {lp.security_deposit&&<div><div style={{fontSize:9,color:"#A0AEC0"}}>DEPOSIT</div><div style={{fontSize:12,fontWeight:600}}>{fmtAED2(lp.security_deposit)}</div></div>}
                        <div><div style={{fontSize:9,color:"#A0AEC0"}}>CHEQUES</div><div style={{fontSize:12,fontWeight:600}}>{lp.cheques_allowed}</div></div>
                        {lp.chiller_included&&<div><div style={{fontSize:9,color:"#A0AEC0"}}>CHILLER</div><div style={{fontSize:12,fontWeight:600,color:"#1A7F5A"}}>Included</div></div>}
                      </div>
                    </div>
                  )}
                  {canEdit&&(
                    <div style={{display:"flex",gap:8,marginTop:8}}>
                      <button onClick={()=>openEdit(selUnit)} style={{flex:1,padding:"8px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>Edit</button>
                      {canDel&&<button onClick={async()=>{if(!window.confirm("Delete?"))return;await supabase.from("project_units").delete().eq("id",selUnit.id);setUnits(p=>p.filter(u=>u.id!==selUnit.id));setSelUnit(null);showToast("Deleted","info");}} style={{padding:"8px 14px",borderRadius:8,border:"1.5px solid #F0BCBC",background:"#FAEAEA",color:"#B83232",fontSize:13,fontWeight:600,cursor:"pointer"}}>Del</button>}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* All Units table */}
      {view==="all"&&(
        <div style={{display:"flex",flexDirection:"column",flex:1,overflow:"hidden"}}>
          <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap"}}>
            <input value={fSearch} onChange={e=>setFSearch(e.target.value)} placeholder="🔍 Search unit, project…" style={{flex:1,minWidth:160}}/>
            <select value={fStatus} onChange={e=>setFStatus(e.target.value)} style={{width:"auto"}}><option value="All">All Statuses</option>{UNIT_ST.map(s=><option key={s}>{s}</option>)}</select>
            <select value={fPurpose} onChange={e=>setFPurpose(e.target.value)} style={{width:"auto"}}><option value="All">Sale + Lease</option><option>Sale</option><option>Lease</option></select>
            <span style={{fontSize:12,color:"#A0AEC0",alignSelf:"center"}}>{allFiltered.length} units</span>
          </div>
          <div style={{flex:1,overflowY:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead style={{position:"sticky",top:0,zIndex:1}}>
                <tr style={{background:"#0B1F3A"}}>
                  {["Unit","Project","Type","Category","Purpose","Beds","Sqft","Floor","View","Sale Price","AED/sqft","Annual Rent","Status"].map(h=>(
                    <th key={h} style={{padding:"9px 12px",textAlign:"left",fontSize:10,fontWeight:600,color:"#C9A84C",textTransform:"uppercase",letterSpacing:".4px",whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allFiltered.map((u,i)=>{
                  const sp=getSP(u.id); const lp=getLP(u.id);
                  const proj=projects.find(p=>p.id===u.project_id);
                  const sc=UNIT_C_PB[u.status]||{c:"#718096",bg:"#F0F2F5"};
                  return (
                    <tr key={u.id} style={{background:i%2===0?"#fff":"#FAFBFC",borderBottom:"1px solid #F0F2F5",cursor:"pointer"}} onClick={()=>{setSelProj(proj);setUTypeTab(u.unit_type);setSelUnit(u);setView("builder");}}>
                      <td style={{padding:"9px 12px",fontWeight:700,color:"#0B1F3A",fontSize:13}}>{u.unit_ref}</td>
                      <td style={{padding:"9px 12px",fontSize:12,color:"#4A5568",maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{proj?.name||"—"}</td>
                      <td style={{padding:"9px 12px"}}><span style={{fontSize:10,fontWeight:600,padding:"2px 7px",borderRadius:20,background:u.unit_type==="Residential"?"#E6F4EE":"#E6EFF9",color:u.unit_type==="Residential"?"#1A7F5A":"#1A5FA8"}}>{u.unit_type}</span></td>
                      <td style={{padding:"9px 12px",fontSize:12,color:"#4A5568"}}>{u.sub_type}</td>
                      <td style={{padding:"9px 12px"}}><span style={{fontSize:10,fontWeight:600,padding:"2px 7px",borderRadius:20,background:u.purpose==="Sale"?"#E6F4EE":u.purpose==="Lease"?"#E6EFF9":"#FDF3DC",color:u.purpose==="Sale"?"#1A7F5A":u.purpose==="Lease"?"#1A5FA8":"#A06810"}}>{u.purpose}</span></td>
                      <td style={{padding:"9px 12px",fontSize:12,color:"#4A5568"}}>{u.bedrooms===0?"Studio":u.bedrooms||"—"}</td>
                      <td style={{padding:"9px 12px",fontSize:12,color:"#4A5568"}}>{u.size_sqft?Number(u.size_sqft).toLocaleString():"—"}</td>
                      <td style={{padding:"9px 12px",fontSize:12,color:"#4A5568"}}>{u.floor_number||"—"}</td>
                      <td style={{padding:"9px 12px",fontSize:11,color:"#718096"}}>{u.view||"—"}</td>
                      <td style={{padding:"9px 12px",fontSize:13,fontWeight:700,color:"#0B1F3A",whiteSpace:"nowrap"}}>{sp?.asking_price?fmtAED2(sp.asking_price):"—"}</td>
                      <td style={{padding:"9px 12px",fontSize:12,color:"#4A5568"}}>{sp?.price_per_sqft?`AED ${Number(sp.price_per_sqft).toLocaleString()}`:"—"}</td>
                      <td style={{padding:"9px 12px",fontSize:12,fontWeight:600,color:"#1A5FA8",whiteSpace:"nowrap"}}>{lp?.annual_rent?fmtAED2(lp.annual_rent):"—"}</td>
                      <td style={{padding:"9px 12px"}}><span style={{fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:20,background:sc.bg,color:sc.c}}>{u.status}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {allFiltered.length===0&&<div style={{textAlign:"center",padding:"3rem",color:"#A0AEC0"}}><div style={{fontSize:36,marginBottom:8}}>🏠</div><div>No units match filters</div></div>}
          </div>
        </div>
      )}

      {/* Modals */}
      {modal==="proj"&&(
        <Modal title="New Project" onClose={()=>setModal(null)} width={520}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",textTransform:"uppercase",letterSpacing:".5px",display:"block",marginBottom:5}}>Project Name *</label><input value={pForm.name} onChange={e=>setPForm(f=>({...f,name:e.target.value}))} placeholder="Emaar Beachfront"/></div>
            <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",textTransform:"uppercase",letterSpacing:".5px",display:"block",marginBottom:5}}>Developer</label><input value={pForm.developer} onChange={e=>setPForm(f=>({...f,developer:e.target.value}))} placeholder="Emaar Properties"/></div>
            <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",textTransform:"uppercase",letterSpacing:".5px",display:"block",marginBottom:5}}>Location</label><input value={pForm.location} onChange={e=>setPForm(f=>({...f,location:e.target.value}))} placeholder="Dubai Harbour"/></div>
            <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",textTransform:"uppercase",letterSpacing:".5px",display:"block",marginBottom:5}}>Community / Area</label><input value={pForm.community} onChange={e=>setPForm(f=>({...f,community:e.target.value}))} placeholder="JVC, Downtown…"/></div>
            <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",textTransform:"uppercase",letterSpacing:".5px",display:"block",marginBottom:5}}>Status</label><select value={pForm.status} onChange={e=>setPForm(f=>({...f,status:e.target.value}))}>{["Active","Upcoming","Completed","On Hold"].map(s=><option key={s}>{s}</option>)}</select></div>
            <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",textTransform:"uppercase",letterSpacing:".5px",display:"block",marginBottom:5}}>Website</label><input value={pForm.website} onChange={e=>setPForm(f=>({...f,website:e.target.value}))} placeholder="https://…"/></div>
            <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",textTransform:"uppercase",letterSpacing:".5px",display:"block",marginBottom:5}}>Launch Date</label><input type="date" value={pForm.launch_date} onChange={e=>setPForm(f=>({...f,launch_date:e.target.value}))}/></div>
            <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",textTransform:"uppercase",letterSpacing:".5px",display:"block",marginBottom:5}}>Completion Date</label><input type="date" value={pForm.completion_date} onChange={e=>setPForm(f=>({...f,completion_date:e.target.value}))}/></div>
          </div>
          <div style={{marginTop:12}}><label style={{fontSize:11,fontWeight:600,color:"#4A5568",textTransform:"uppercase",letterSpacing:".5px",display:"block",marginBottom:5}}>Description</label><textarea value={pForm.description} onChange={e=>setPForm(f=>({...f,description:e.target.value}))} rows={2} placeholder="Key highlights…"/></div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:14}}>
            <button onClick={()=>setModal(null)} style={{padding:"9px 18px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancel</button>
            <button onClick={saveProject} disabled={saving} style={{padding:"9px 18px",borderRadius:8,border:"none",background:"#0B1F3A",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>{saving?"Saving…":"Create Project"}</button>
          </div>
        </Modal>
      )}
      {(modal==="unit"&&selProj)||( modal==="editunit"&&selUnit) ? renderUnitModal(modal==="editunit") : null}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// DISCOUNT APPROVALS
// ══════════════════════════════════════════════════════
function DiscountApprovals({discounts,setDiscounts,leads,user,toast}) {
  const [filter, setFilter] = useState("Pending");
  const [saving, setSaving] = useState(false);
  const [responseNote, setResponseNote] = useState("");
  const [actingOn, setActingOn] = useState(null);
  const [action, setAction] = useState(null); // "approve"|"reject"|"escalate"

  const canApproveManager = can(user.role,"approve_manager");
  const canApproveAdmin   = can(user.role,"approve_all");

  const visible = discounts.filter(d=>{
    if(filter==="All") return true;
    return d.status===filter;
  });

  const doAction = async()=>{
    if(!actingOn) return;
    setSaving(true);
    try{
      let newStatus = action==="approve"?"Approved":action==="reject"?"Rejected":"Escalated";
      const {data,error}=await supabase.from("discount_requests").update({status:newStatus,response_note:responseNote,response_by:user.id,response_by_name:user.full_name,responded_at:new Date().toISOString()}).eq("id",actingOn.id).select().single();
      if(error)throw error;
      setDiscounts(p=>p.map(d=>d.id===actingOn.id?data:d));
      toast(`Discount request ${newStatus.toLowerCase()}`,action==="approve"?"success":action==="reject"?"info":"warning");
      setActingOn(null); setAction(null); setResponseNote("");
    }catch(e){toast(e.message,"error");}
    setSaving(false);
  };

  const DISC_TYPES_MAP = {sale_price:{label:"Sale Price Reduction",icon:"🏷"},rent:{label:"Rent Reduction",icon:"🔑"},payment_plan:{label:"Payment Plan Change",icon:"📅"},agency_fee:{label:"Agency Fee Waiver",icon:"🤝"}};

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      {/* Stats bar */}
      <div style={{display:"flex",gap:12,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
        {[["All","All",discounts.length],["Pending","Pending",discounts.filter(d=>d.status==="Pending").length],["Escalated","Escalated",discounts.filter(d=>d.status==="Escalated").length],["Approved","Approved",discounts.filter(d=>d.status==="Approved").length],["Rejected","Rejected",discounts.filter(d=>d.status==="Rejected").length]].map(([f,l,cnt])=>(
          <button key={f} onClick={()=>setFilter(f)} style={{padding:"6px 16px",borderRadius:8,border:`1.5px solid ${filter===f?"#0B1F3A":"#E2E8F0"}`,background:filter===f?"#0B1F3A":"#fff",color:filter===f?"#fff":"#4A5568",fontSize:12,fontWeight:filter===f?600:400,cursor:"pointer"}}>{l} ({cnt})</button>
        ))}
      </div>

      {/* Info banner for agents */}
      {user.role==="agent"&&(
        <div style={{background:"#E6EFF9",border:"1px solid #B5D4F4",borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:13,color:"#1A5FA8",lineHeight:1.6}}>
          ℹ Discount requests up to <strong>5%</strong> go to your Manager. Above 5% are escalated directly to Admin.
          Request discounts from inside a Lead's detail panel.
        </div>
      )}

      <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:10}}>
        {visible.length===0&&<div style={{textAlign:"center",padding:"3rem",color:"#A0AEC0"}}><div style={{fontSize:36,marginBottom:8}}>⚡</div><div>No {filter.toLowerCase()} discount requests</div></div>}
        {visible.map(d=>{
          const t=DISC_TYPES_MAP[d.type]||{label:d.type,icon:"💰"};
          const sc={Pending:{c:"#A06810",bg:"#FDF3DC"},Approved:{c:"#1A7F5A",bg:"#E6F4EE"},Rejected:{c:"#B83232",bg:"#FAEAEA"},Escalated:{c:"#5B3FAA",bg:"#EEE8F9"}}[d.status]||{c:"#718096",bg:"#F0F2F5"};
          const canAct = (d.status==="Pending"&&canApproveManager)||(d.status==="Escalated"&&canApproveAdmin);
          return (
            <div key={d.id} style={{background:"#fff",border:`1px solid ${d.status==="Escalated"?"#C9A84C":d.status==="Pending"?"#E8C97A":"#E2E8F0"}`,borderRadius:12,padding:"14px 16px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                <div>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                    <span style={{fontSize:18}}>{t.icon}</span>
                    <span style={{fontSize:14,fontWeight:700,color:"#0B1F3A"}}>{t.label}</span>
                    <span style={{fontSize:12,fontWeight:600,padding:"3px 10px",borderRadius:20,background:sc.bg,color:sc.c}}>{d.status}</span>
                    {d.status==="Escalated"&&<span style={{fontSize:11,color:"#5B3FAA",fontWeight:700}}>⚡ Requires Admin</span>}
                  </div>
                  <div style={{fontSize:13,color:"#4A5568"}}>Lead: <strong>{d.lead_name}</strong> · Requested by: {d.requested_by_name}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:700,color:d.discount_pct>5?"#B83232":"#A06810"}}>{d.discount_pct}%</div>
                  <div style={{fontSize:11,color:"#A0AEC0"}}>discount requested</div>
                </div>
              </div>

              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,background:"#FAFBFC",borderRadius:8,padding:"10px",marginBottom:10}}>
                <div><div style={{fontSize:9,color:"#A0AEC0",textTransform:"uppercase",letterSpacing:".6px"}}>Original Value</div><div style={{fontSize:13,fontWeight:600,color:"#0B1F3A"}}>{d.original_value?`AED ${Number(d.original_value).toLocaleString()}`:"—"}</div></div>
                <div><div style={{fontSize:9,color:"#A0AEC0",textTransform:"uppercase",letterSpacing:".6px"}}>Requested Value</div><div style={{fontSize:13,fontWeight:600,color:"#1A7F5A"}}>{d.requested_value?`AED ${Number(d.requested_value).toLocaleString()}`:"—"}</div></div>
                <div><div style={{fontSize:9,color:"#A0AEC0",textTransform:"uppercase",letterSpacing:".6px"}}>Saving</div><div style={{fontSize:13,fontWeight:600,color:"#B83232"}}>{d.original_value&&d.requested_value?`AED ${Number(d.original_value-d.requested_value).toLocaleString()}`:"—"}</div></div>
              </div>

              <div style={{background:"#F7F9FC",borderRadius:8,padding:"8px 12px",marginBottom:10,fontSize:13,color:"#4A5568",lineHeight:1.6}}>
                <strong>Reason:</strong> {d.reason}
              </div>

              {d.response_note&&(
                <div style={{background:d.status==="Approved"?"#E6F4EE":"#FAEAEA",borderRadius:8,padding:"8px 12px",marginBottom:10,fontSize:13,color:d.status==="Approved"?"#1A7F5A":"#B83232"}}>
                  <strong>{d.response_by_name}:</strong> {d.response_note}
                </div>
              )}

              <div style={{fontSize:11,color:"#A0AEC0"}}>Requested {new Date(d.created_at).toLocaleDateString("en-AE",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})}</div>

              {canAct&&(
                <div style={{display:"flex",gap:8,marginTop:12,flexWrap:"wrap"}}>
                  <button onClick={()=>{setActingOn(d);setAction("approve");setResponseNote("");}} style={{padding:"8px 18px",borderRadius:8,border:"none",background:"#E6F4EE",color:"#1A7F5A",fontSize:13,fontWeight:600,cursor:"pointer"}}>✓ Approve</button>
                  {d.status==="Pending"&&canApproveManager&&!canApproveAdmin&&(
                    <button onClick={()=>{setActingOn(d);setAction("escalate");setResponseNote("");}} style={{padding:"8px 18px",borderRadius:8,border:"1.5px solid #C9A84C",background:"#FDF3DC",color:"#8A6200",fontSize:13,fontWeight:600,cursor:"pointer"}}>⚡ Escalate to Admin</button>
                  )}
                  <button onClick={()=>{setActingOn(d);setAction("reject");setResponseNote("");}} style={{padding:"8px 18px",borderRadius:8,border:"1.5px solid #F0BCBC",background:"#FAEAEA",color:"#B83232",fontSize:13,fontWeight:600,cursor:"pointer"}}>✕ Reject</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Action modal */}
      {actingOn&&action&&(
        <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:"1rem"}}>
          <div style={{background:"#fff",borderRadius:16,width:440,padding:"1.5rem",boxShadow:"0 20px 60px rgba(0,0,0,.3)"}}>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:700,color:"#0B1F3A",marginBottom:14}}>
              {action==="approve"?"✓ Approve Discount":action==="reject"?"✕ Reject Discount":"⚡ Escalate to Admin"}
            </div>
            <div style={{background:"#FAFBFC",borderRadius:8,padding:"10px 12px",marginBottom:14,fontSize:13,color:"#4A5568"}}>
              <strong>{DISC_TYPES_MAP[actingOn.type]?.label}</strong> — {actingOn.discount_pct}% — Lead: {actingOn.lead_name}
            </div>
            <div style={{marginBottom:14}}>
              <label style={{fontSize:11,fontWeight:600,color:"#4A5568",textTransform:"uppercase",letterSpacing:".5px",display:"block",marginBottom:5}}>Response Note {action!=="escalate"?"(optional)":"(reason for escalation)"}</label>
              <textarea value={responseNote} onChange={e=>setResponseNote(e.target.value)} rows={3} placeholder={action==="approve"?"e.g. Approved as client is committing to full payment…":action==="reject"?"e.g. Cannot go below asking price at this stage…":"e.g. This exceeds my approval limit — escalating to Admin…"}/>
            </div>
            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              <button onClick={()=>{setActingOn(null);setAction(null);}} style={{padding:"9px 18px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancel</button>
              <button onClick={doAction} disabled={saving} style={{padding:"9px 18px",borderRadius:8,border:"none",background:action==="approve"?"#1A7F5A":action==="reject"?"#B83232":"#5B3FAA",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>
                {saving?"Processing…":action==="approve"?"Confirm Approval":action==="reject"?"Confirm Rejection":"Escalate to Admin"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// LEASING MODULE
// ══════════════════════════════════════════════════════
function LeasingModule({currentUser,showToast}) {
  const [tab,setTab]               = useState("dashboard");
  const [tenants,setTenants]       = useState([]);
  const [leases,setLeases]         = useState([]);
  const [payments,setPayments]     = useState([]);
  const [maintenance,setMaintenance]=useState([]);
  const [units,setUnits]           = useState([]);
  const [loading,setLoading]       = useState(true);
  const canEdit = can(currentUser.role,"write");
  const canDel  = can(currentUser.role,"delete");
  const [showAddTenant,setShowAddTenant]=useState(false);
  const [showAddLease,setShowAddLease]  =useState(false);
  const [showAddPmt,setShowAddPmt]      =useState(false);
  const [showAddMaint,setShowAddMaint]  =useState(false);
  const [saving,setSaving]=useState(false);

  const tBlank={full_name:"",nationality:"",id_type:"Emirates ID",id_number:"",id_expiry:"",passport_number:"",passport_expiry:"",email:"",phone:"",whatsapp:"",tenant_type:"Individual",company_name:"",trade_license:"",notes:""};
  const lBlank={unit_id:"",tenant_id:"",start_date:"",end_date:"",annual_rent:"",security_deposit:"",agency_fee:"",payment_frequency:"Annual",number_of_cheques:"1",ejari_number:"",contract_number:"",status:"Active",notes:""};
  const pBlank={lease_id:"",amount:"",due_date:"",payment_method:"Cheque",cheque_number:"",status:"Pending",payment_type:"Rent",notes:""};
  const mBlank={unit_id:"",title:"",category:"General",priority:"Normal",description:"",assigned_to:"",cost_estimate:"",status:"Open",charged_to:"Landlord",notes:""};
  const [tForm,setTForm]=useState(tBlank);
  const [lForm,setLForm]=useState(lBlank);
  const [pForm,setPForm]=useState(pBlank);
  const [mForm,setMForm]=useState(mBlank);

  const load=useCallback(async()=>{
    setLoading(true);
    const [t,l,p,m,u]=await Promise.all([
      supabase.from("tenants").select("*").order("full_name"),
      supabase.from("leases").select("*").order("end_date"),
      supabase.from("rent_payments").select("*").order("due_date"),
      supabase.from("maintenance").select("*").order("created_at",{ascending:false}),
      supabase.from("project_units").select("id,unit_ref,sub_type"),
    ]);
    setTenants(t.data||[]);setLeases(l.data||[]);setPayments(p.data||[]);setMaintenance(m.data||[]);setUnits(u.data||[]);
    setLoading(false);
  },[]);
  useEffect(()=>{load();},[load]);

  const today=new Date();
  const activeLeases=leases.filter(l=>l.status==="Active");
  const expiring30=activeLeases.filter(l=>{const d=new Date(l.end_date);return d>=today&&(d-today)/(1000*60*60*24)<=30;});
  const overduePmts=payments.filter(p=>p.status==="Pending"&&new Date(p.due_date)<today);
  const openMaint=maintenance.filter(m=>m.status==="Open"||m.status==="In Progress");
  const totalRent=activeLeases.reduce((s,l)=>s+(l.annual_rent||0),0);

  const tenantName=id=>tenants.find(t=>t.id===id)?.full_name||"—";
  const unitLabel=id=>units.find(u=>u.id===id)?.unit_ref||"—";

  const saveTenant=async()=>{
    if(!tForm.full_name.trim()){showToast("Name required","error");return;}
    setSaving(true);
    try{
      const {data,error}=await supabase.from("tenants").insert({...tForm,id_expiry:tForm.id_expiry||null,passport_expiry:tForm.passport_expiry||null,created_by:currentUser.id}).select().single();
      if(error)throw error;
      setTenants(p=>[data,...p]);showToast("Tenant added","success");setShowAddTenant(false);setTForm(tBlank);
    }catch(e){showToast(e.message,"error");}
    setSaving(false);
  };

  const saveLease=async()=>{
    if(!lForm.unit_id||!lForm.tenant_id||!lForm.annual_rent){showToast("Unit, tenant and rent required","error");return;}
    setSaving(true);
    try{
      const ar=Number(lForm.annual_rent);
      const {data,error}=await supabase.from("leases").insert({...lForm,annual_rent:ar,monthly_rent:Math.round(ar/12),security_deposit:lForm.security_deposit?Number(lForm.security_deposit):null,agency_fee:lForm.agency_fee?Number(lForm.agency_fee):null,number_of_cheques:Number(lForm.number_of_cheques)||1,created_by:currentUser.id}).select().single();
      if(error)throw error;
      setLeases(p=>[data,...p]);
      await supabase.from("project_units").update({status:"Leased"}).eq("id",lForm.unit_id);
      showToast("Lease created","success");setShowAddLease(false);setLForm(lBlank);
    }catch(e){showToast(e.message,"error");}
    setSaving(false);
  };

  const savePmt=async()=>{
    if(!pForm.lease_id||!pForm.amount||!pForm.due_date){showToast("Lease, amount and due date required","error");return;}
    setSaving(true);
    try{
      const lease=leases.find(l=>l.id===pForm.lease_id);
      const {data,error}=await supabase.from("rent_payments").insert({...pForm,amount:Number(pForm.amount),unit_id:lease?.unit_id||null,tenant_id:lease?.tenant_id||null,created_by:currentUser.id}).select().single();
      if(error)throw error;
      setPayments(p=>[data,...p]);showToast("Payment logged","success");setShowAddPmt(false);setPForm(pBlank);
    }catch(e){showToast(e.message,"error");}
    setSaving(false);
  };

  const saveMaint=async()=>{
    if(!mForm.unit_id||!mForm.title.trim()){showToast("Unit and title required","error");return;}
    setSaving(true);
    try{
      const {data,error}=await supabase.from("maintenance").insert({...mForm,cost_estimate:mForm.cost_estimate?Number(mForm.cost_estimate):null,reported_date:today.toISOString().slice(0,10),created_by:currentUser.id}).select().single();
      if(error)throw error;
      setMaintenance(p=>[data,...p]);showToast("Request logged","success");setShowAddMaint(false);setMForm(mBlank);
    }catch(e){showToast(e.message,"error");}
    setSaving(false);
  };

  const markPaid=async(id)=>{
    await supabase.from("rent_payments").update({status:"Paid",paid_date:today.toISOString().slice(0,10)}).eq("id",id);
    setPayments(p=>p.map(x=>x.id===id?{...x,status:"Paid"}:x));showToast("Marked paid","success");
  };

  const renewLease=async(lease)=>{
    const newEnd=new Date(lease.end_date);newEnd.setFullYear(newEnd.getFullYear()+1);
    await supabase.from("leases").update({status:"Renewed",end_date:newEnd.toISOString().slice(0,10)}).eq("id",lease.id);
    setLeases(p=>p.map(l=>l.id===lease.id?{...l,status:"Renewed",end_date:newEnd.toISOString().slice(0,10)}:l));
    showToast("Lease renewed +1 year","success");
  };

  if(loading) return <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",color:"#A0AEC0",fontSize:14}}>Loading Leasing…</div>;

  const TABS_L=[["dashboard","📊 Dashboard"],["tenants",`👤 Tenants (${tenants.length})`],["leases",`📄 Leases (${activeLeases.length})`],["payments",`💰 Payments (${overduePmts.length} overdue)`],["maintenance",`🔧 Maintenance (${openMaint.length})`]];

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      <div style={{display:"flex",gap:5,marginBottom:14,flexWrap:"wrap"}}>
        {TABS_L.map(([id,l])=>(
          <button key={id} onClick={()=>setTab(id)} style={{padding:"6px 14px",borderRadius:8,border:`1.5px solid ${tab===id?"#0B1F3A":"#E2E8F0"}`,background:tab===id?"#0B1F3A":"#fff",color:tab===id?"#fff":"#4A5568",fontSize:12,fontWeight:tab===id?600:400,cursor:"pointer"}}>{l}</button>
        ))}
      </div>

      {/* Dashboard */}
      {tab==="dashboard"&&(
        <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:14}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
            {[["Active Leases",activeLeases.length,"#0B1F3A","📄"],["Annual Rent",`AED ${(totalRent/1e6).toFixed(1)}M`,"#1A7F5A","💰"],["Overdue Payments",overduePmts.length,"#B83232","⚠"],["Open Maintenance",openMaint.length,"#5B3FAA","🔧"]].map(([l,v,c,icon])=>(
              <div key={l} style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:12,padding:"1rem 1.25rem",borderTop:`3px solid ${c}`}}>
                <div style={{fontSize:10,color:"#A0AEC0",textTransform:"uppercase",letterSpacing:".7px",fontWeight:600,marginBottom:6}}>{icon} {l}</div>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:24,fontWeight:700,color:"#0B1F3A"}}>{v}</div>
              </div>
            ))}
          </div>
          {expiring30.length>0&&(
            <div style={{background:"#FDF3DC",border:"1.5px solid #E8C97A",borderRadius:12,padding:"1rem 1.25rem"}}>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:700,color:"#8A6200",marginBottom:10}}>⏰ Leases Expiring in 30 Days ({expiring30.length})</div>
              {expiring30.map(l=>{
                const days=Math.ceil((new Date(l.end_date)-today)/(1000*60*60*24));
                return (
                  <div key={l.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid #F0E8C8"}}>
                    <div><div style={{fontSize:13,fontWeight:600,color:"#0B1F3A"}}>{tenantName(l.tenant_id)}</div><div style={{fontSize:11,color:"#A0AEC0"}}>Unit {unitLabel(l.unit_id)} · Expires {new Date(l.end_date).toLocaleDateString("en-AE",{day:"numeric",month:"short",year:"numeric"})}</div></div>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}><span style={{fontSize:12,fontWeight:700,color:"#B83232"}}>{days}d left</span>{canEdit&&<button onClick={()=>renewLease(l)} style={{padding:"5px 12px",borderRadius:8,border:"none",background:"#1A7F5A",color:"#fff",fontSize:11,fontWeight:600,cursor:"pointer"}}>Renew</button>}</div>
                  </div>
                );
              })}
            </div>
          )}
          {overduePmts.length>0&&(
            <div style={{background:"#FAEAEA",border:"1.5px solid #F0BCBC",borderRadius:12,padding:"1rem 1.25rem"}}>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:700,color:"#B83232",marginBottom:10}}>💳 Overdue Payments ({overduePmts.length})</div>
              {overduePmts.slice(0,5).map(p=>{
                const lease=leases.find(l=>l.id===p.lease_id);
                return (
                  <div key={p.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid rgba(184,50,50,.1)"}}>
                    <div><div style={{fontSize:13,fontWeight:600,color:"#0B1F3A"}}>{tenantName(lease?.tenant_id)}</div><div style={{fontSize:11,color:"#B83232"}}>Due {new Date(p.due_date).toLocaleDateString("en-AE",{day:"numeric",month:"short"})} · AED {Number(p.amount).toLocaleString()}</div></div>
                    {canEdit&&<button onClick={()=>markPaid(p.id)} style={{padding:"5px 12px",borderRadius:8,border:"none",background:"#1A7F5A",color:"#fff",fontSize:11,fontWeight:600,cursor:"pointer"}}>Mark Paid</button>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tenants */}
      {tab==="tenants"&&(
        <div style={{flex:1,display:"flex",flexDirection:"column"}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
            <span style={{fontSize:12,color:"#A0AEC0"}}>{tenants.length} tenants</span>
            {canEdit&&<button onClick={()=>{setTForm(tBlank);setShowAddTenant(true);}} style={{padding:"7px 16px",borderRadius:8,border:"none",background:"#0B1F3A",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>+ Add Tenant</button>}
          </div>
          <div style={{flex:1,overflowY:"auto"}}>
            {tenants.length===0&&<div style={{textAlign:"center",padding:"3rem",color:"#A0AEC0"}}><div style={{fontSize:36,marginBottom:8}}>👤</div><div>No tenants yet</div></div>}
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead style={{position:"sticky",top:0}}><tr style={{background:"#0B1F3A"}}>{["Name","Type","Nationality","Phone","Email","ID Number","ID Expiry"].map(h=><th key={h} style={{padding:"9px 12px",textAlign:"left",fontSize:10,fontWeight:600,color:"#C9A84C",textTransform:"uppercase",letterSpacing:".4px",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
              <tbody>
                {tenants.map((t,i)=>(
                  <tr key={t.id} style={{background:i%2===0?"#fff":"#FAFBFC",borderBottom:"1px solid #F0F2F5"}}>
                    <td style={{padding:"10px 12px",fontWeight:600,fontSize:13,color:"#0B1F3A"}}>{t.full_name}</td>
                    <td style={{padding:"10px 12px"}}><span style={{fontSize:11,fontWeight:600,padding:"2px 7px",borderRadius:20,background:t.tenant_type==="Company"?"#E6EFF9":"#E6F4EE",color:t.tenant_type==="Company"?"#1A5FA8":"#1A7F5A"}}>{t.tenant_type}</span></td>
                    <td style={{padding:"10px 12px",fontSize:12,color:"#4A5568"}}>{t.nationality||"—"}</td>
                    <td style={{padding:"10px 12px",fontSize:12,color:"#4A5568"}}>{t.phone||"—"}</td>
                    <td style={{padding:"10px 12px",fontSize:12,color:"#4A5568"}}>{t.email||"—"}</td>
                    <td style={{padding:"10px 12px",fontSize:12,color:"#4A5568"}}>{t.id_number||"—"}</td>
                    <td style={{padding:"10px 12px",fontSize:12,color:t.id_expiry&&new Date(t.id_expiry)<today?"#B83232":"#4A5568",fontWeight:t.id_expiry&&new Date(t.id_expiry)<today?700:400}}>{t.id_expiry?new Date(t.id_expiry).toLocaleDateString("en-AE",{day:"numeric",month:"short",year:"numeric"}):"—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {showAddTenant&&(
            <Modal title="Add Tenant" onClose={()=>setShowAddTenant(false)} width={520}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>FULL NAME *</label><input value={tForm.full_name} onChange={e=>setTForm(f=>({...f,full_name:e.target.value}))}/></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>TYPE</label><select value={tForm.tenant_type} onChange={e=>setTForm(f=>({...f,tenant_type:e.target.value}))}><option>Individual</option><option>Company</option></select></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>NATIONALITY</label><select value={tForm.nationality} onChange={e=>setTForm(f=>({...f,nationality:e.target.value}))}><option value="">Select…</option>{["UAE","Saudi Arabia","India","UK","Pakistan","Egypt","Jordan","USA","Russia","China","Other"].map(n=><option key={n}>{n}</option>)}</select></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>PHONE</label><input value={tForm.phone} onChange={e=>setTForm(f=>({...f,phone:e.target.value}))} placeholder="+971 50 000 0000"/></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>EMAIL</label><input value={tForm.email} onChange={e=>setTForm(f=>({...f,email:e.target.value}))}/></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>WHATSAPP</label><input value={tForm.whatsapp} onChange={e=>setTForm(f=>({...f,whatsapp:e.target.value}))}/></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>ID TYPE</label><select value={tForm.id_type} onChange={e=>setTForm(f=>({...f,id_type:e.target.value}))}><option>Emirates ID</option><option>Passport</option><option>Residency Visa</option></select></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>ID NUMBER</label><input value={tForm.id_number} onChange={e=>setTForm(f=>({...f,id_number:e.target.value}))}/></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>ID EXPIRY</label><input type="date" value={tForm.id_expiry} onChange={e=>setTForm(f=>({...f,id_expiry:e.target.value}))}/></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>PASSPORT NO.</label><input value={tForm.passport_number} onChange={e=>setTForm(f=>({...f,passport_number:e.target.value}))}/></div>
              </div>
              {tForm.tenant_type==="Company"&&<div style={{marginTop:12,display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>COMPANY NAME</label><input value={tForm.company_name} onChange={e=>setTForm(f=>({...f,company_name:e.target.value}))}/></div><div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>TRADE LICENSE</label><input value={tForm.trade_license} onChange={e=>setTForm(f=>({...f,trade_license:e.target.value}))}/></div></div>}
              <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:14}}>
                <button onClick={()=>setShowAddTenant(false)} style={{padding:"9px 18px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancel</button>
                <button onClick={saveTenant} disabled={saving} style={{padding:"9px 18px",borderRadius:8,border:"none",background:"#0B1F3A",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>{saving?"Saving…":"Add Tenant"}</button>
              </div>
            </Modal>
          )}
        </div>
      )}

      {/* Leases */}
      {tab==="leases"&&(
        <div style={{flex:1,display:"flex",flexDirection:"column"}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
            <span style={{fontSize:12,color:"#A0AEC0"}}>{leases.length} leases</span>
            {canEdit&&<button onClick={()=>{setLForm(lBlank);setShowAddLease(true);}} style={{padding:"7px 16px",borderRadius:8,border:"none",background:"#0B1F3A",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>+ New Lease</button>}
          </div>
          <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:8}}>
            {leases.length===0&&<div style={{textAlign:"center",padding:"3rem",color:"#A0AEC0"}}><div style={{fontSize:36,marginBottom:8}}>📄</div><div>No leases yet</div></div>}
            {leases.map(l=>{
              const daysLeft=Math.ceil((new Date(l.end_date)-today)/(1000*60*60*24));
              const isExpiring=daysLeft<=30&&daysLeft>=0&&l.status==="Active";
              const SC_L={Active:{c:"#1A7F5A",bg:"#E6F4EE"},Expired:{c:"#B83232",bg:"#FAEAEA"},Terminated:{c:"#718096",bg:"#F0F2F5"},Pending:{c:"#A06810",bg:"#FDF3DC"},Renewed:{c:"#1A5FA8",bg:"#E6EFF9"}};
              const sc=SC_L[l.status]||{c:"#718096",bg:"#F0F2F5"};
              return (
                <div key={l.id} style={{background:"#fff",border:`1px solid ${isExpiring?"#E8C97A":"#E2E8F0"}`,borderRadius:10,padding:"12px 14px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                    <div>
                      <div style={{fontSize:14,fontWeight:700,color:"#0B1F3A",marginBottom:2}}>{tenantName(l.tenant_id)}</div>
                      <div style={{fontSize:12,color:"#A0AEC0"}}>Unit {unitLabel(l.unit_id)}{l.ejari_number?` · Ejari: ${l.ejari_number}`:""}</div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <span style={{fontSize:11,fontWeight:600,padding:"3px 9px",borderRadius:20,background:sc.bg,color:sc.c}}>{l.status}</span>
                      {isExpiring&&<div style={{fontSize:11,color:"#B83232",fontWeight:700,marginTop:3}}>⏰ {daysLeft}d left</div>}
                    </div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,background:"#FAFBFC",borderRadius:8,padding:"8px 10px",marginBottom:8}}>
                    {[["Start",new Date(l.start_date).toLocaleDateString("en-AE",{day:"numeric",month:"short",year:"numeric"})],["End",new Date(l.end_date).toLocaleDateString("en-AE",{day:"numeric",month:"short",year:"numeric"})],["Annual Rent",`AED ${Number(l.annual_rent).toLocaleString()}`],["Cheques",l.number_of_cheques]].map(([k,v])=>(
                      <div key={k}><div style={{fontSize:9,color:"#A0AEC0",textTransform:"uppercase",letterSpacing:".5px"}}>{k}</div><div style={{fontSize:12,fontWeight:600,color:"#0B1F3A"}}>{v}</div></div>
                    ))}
                  </div>
                  {canEdit&&(
                    <div style={{display:"flex",gap:6}}>
                      <button onClick={()=>{setPForm({...pBlank,lease_id:l.id});setShowAddPmt(true);}} style={{padding:"5px 12px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:11,fontWeight:600,cursor:"pointer"}}>Log Payment</button>
                      {l.status==="Active"&&<button onClick={()=>renewLease(l)} style={{padding:"5px 12px",borderRadius:8,border:"none",background:"#E6F4EE",color:"#1A7F5A",fontSize:11,fontWeight:600,cursor:"pointer"}}>Renew</button>}
                      {l.status==="Active"&&<button onClick={async()=>{if(!window.confirm("Terminate?"))return;await supabase.from("leases").update({status:"Terminated",termination_date:today.toISOString().slice(0,10)}).eq("id",l.id);setLeases(p=>p.map(x=>x.id===l.id?{...x,status:"Terminated"}:x));showToast("Terminated","info");}} style={{padding:"5px 12px",borderRadius:8,border:"1.5px solid #F0BCBC",background:"#FAEAEA",color:"#B83232",fontSize:11,fontWeight:600,cursor:"pointer"}}>Terminate</button>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {showAddLease&&(
            <Modal title="New Lease Contract" onClose={()=>setShowAddLease(false)} width={520}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>UNIT *</label><select value={lForm.unit_id} onChange={e=>setLForm(f=>({...f,unit_id:e.target.value}))}><option value="">Select…</option>{units.map(u=><option key={u.id} value={u.id}>#{u.unit_ref} — {u.sub_type}</option>)}</select></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>TENANT *</label><select value={lForm.tenant_id} onChange={e=>setLForm(f=>({...f,tenant_id:e.target.value}))}><option value="">Select…</option>{tenants.map(t=><option key={t.id} value={t.id}>{t.full_name}</option>)}</select></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>START DATE *</label><input type="date" value={lForm.start_date} onChange={e=>setLForm(f=>({...f,start_date:e.target.value}))}/></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>END DATE *</label><input type="date" value={lForm.end_date} onChange={e=>setLForm(f=>({...f,end_date:e.target.value}))}/></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>ANNUAL RENT (AED) *</label><input type="number" value={lForm.annual_rent} onChange={e=>setLForm(f=>({...f,annual_rent:e.target.value}))}/></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>SECURITY DEPOSIT</label><input type="number" value={lForm.security_deposit} onChange={e=>setLForm(f=>({...f,security_deposit:e.target.value}))}/></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>PAYMENT FREQUENCY</label><select value={lForm.payment_frequency} onChange={e=>setLForm(f=>({...f,payment_frequency:e.target.value}))}>{["Monthly","Quarterly","Bi-Annual","Annual"].map(x=><option key={x}>{x}</option>)}</select></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>CHEQUES</label><input type="number" value={lForm.number_of_cheques} onChange={e=>setLForm(f=>({...f,number_of_cheques:e.target.value}))}/></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>EJARI NO.</label><input value={lForm.ejari_number} onChange={e=>setLForm(f=>({...f,ejari_number:e.target.value}))}/></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>CONTRACT NO.</label><input value={lForm.contract_number} onChange={e=>setLForm(f=>({...f,contract_number:e.target.value}))}/></div>
              </div>
              <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:14}}>
                <button onClick={()=>setShowAddLease(false)} style={{padding:"9px 18px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancel</button>
                <button onClick={saveLease} disabled={saving} style={{padding:"9px 18px",borderRadius:8,border:"none",background:"#0B1F3A",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>{saving?"Saving…":"Create Lease"}</button>
              </div>
            </Modal>
          )}
        </div>
      )}

      {/* Payments */}
      {tab==="payments"&&(
        <div style={{flex:1,display:"flex",flexDirection:"column"}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
            <div style={{display:"flex",gap:12}}><span style={{fontSize:12,color:"#B83232",fontWeight:600}}>Overdue: {overduePmts.length}</span><span style={{fontSize:12,color:"#A0AEC0"}}>Total: {payments.length}</span></div>
            {canEdit&&<button onClick={()=>{setPForm(pBlank);setShowAddPmt(true);}} style={{padding:"7px 16px",borderRadius:8,border:"none",background:"#0B1F3A",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>+ Log Payment</button>}
          </div>
          <div style={{flex:1,overflowY:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead style={{position:"sticky",top:0}}><tr style={{background:"#0B1F3A"}}>{["Tenant","Unit","Type","Amount","Due Date","Paid","Method","Status",""].map(h=><th key={h} style={{padding:"9px 12px",textAlign:"left",fontSize:10,fontWeight:600,color:"#C9A84C",textTransform:"uppercase",letterSpacing:".4px",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
              <tbody>
                {payments.sort((a,b)=>new Date(a.due_date)-new Date(b.due_date)).map((p,i)=>{
                  const lease=leases.find(l=>l.id===p.lease_id);
                  const isOD=p.status==="Pending"&&new Date(p.due_date)<today;
                  const SC_P={Paid:{c:"#1A7F5A",bg:"#E6F4EE"},Pending:{c:"#A06810",bg:"#FDF3DC"},Bounced:{c:"#B83232",bg:"#FAEAEA"}};
                  const sc=SC_P[p.status]||{c:"#718096",bg:"#F0F2F5"};
                  return (
                    <tr key={p.id} style={{background:isOD?"#FFF5F5":i%2===0?"#fff":"#FAFBFC",borderBottom:"1px solid #F0F2F5"}}>
                      <td style={{padding:"9px 12px",fontSize:13,fontWeight:600,color:"#0B1F3A"}}>{tenantName(lease?.tenant_id)}</td>
                      <td style={{padding:"9px 12px",fontSize:12,color:"#4A5568"}}>{unitLabel(p.unit_id||lease?.unit_id)}</td>
                      <td style={{padding:"9px 12px",fontSize:11,color:"#4A5568"}}>{p.payment_type}</td>
                      <td style={{padding:"9px 12px",fontSize:13,fontWeight:700,color:"#0B1F3A",whiteSpace:"nowrap"}}>AED {Number(p.amount).toLocaleString()}</td>
                      <td style={{padding:"9px 12px",fontSize:12,color:isOD?"#B83232":"#4A5568",fontWeight:isOD?700:400}}>{new Date(p.due_date).toLocaleDateString("en-AE",{day:"numeric",month:"short",year:"numeric"})}</td>
                      <td style={{padding:"9px 12px",fontSize:12,color:"#1A7F5A"}}>{p.paid_date?new Date(p.paid_date).toLocaleDateString("en-AE",{day:"numeric",month:"short"}):"—"}</td>
                      <td style={{padding:"9px 12px",fontSize:12,color:"#4A5568"}}>{p.payment_method}</td>
                      <td style={{padding:"9px 12px"}}><span style={{fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:20,background:sc.bg,color:sc.c}}>{p.status}</span></td>
                      <td style={{padding:"9px 12px"}}>{p.status==="Pending"&&canEdit&&<button onClick={()=>markPaid(p.id)} style={{padding:"4px 10px",borderRadius:8,border:"none",background:"#E6F4EE",color:"#1A7F5A",fontSize:11,fontWeight:600,cursor:"pointer"}}>Paid</button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {payments.length===0&&<div style={{textAlign:"center",padding:"3rem",color:"#A0AEC0"}}><div style={{fontSize:36,marginBottom:8}}>💰</div><div>No payments logged</div></div>}
          </div>
          {showAddPmt&&(
            <Modal title="Log Payment" onClose={()=>setShowAddPmt(false)} width={440}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div style={{gridColumn:"1/-1"}}><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>LEASE *</label><select value={pForm.lease_id} onChange={e=>setPForm(f=>({...f,lease_id:e.target.value}))}><option value="">Select…</option>{leases.filter(l=>l.status==="Active").map(l=><option key={l.id} value={l.id}>{tenantName(l.tenant_id)} · Unit {unitLabel(l.unit_id)}</option>)}</select></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>TYPE</label><select value={pForm.payment_type} onChange={e=>setPForm(f=>({...f,payment_type:e.target.value}))}>{["Rent","Security Deposit","Agency Fee","Maintenance","Other"].map(t=><option key={t}>{t}</option>)}</select></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>AMOUNT (AED) *</label><input type="number" value={pForm.amount} onChange={e=>setPForm(f=>({...f,amount:e.target.value}))}/></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>DUE DATE *</label><input type="date" value={pForm.due_date} onChange={e=>setPForm(f=>({...f,due_date:e.target.value}))}/></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>METHOD</label><select value={pForm.payment_method} onChange={e=>setPForm(f=>({...f,payment_method:e.target.value}))}>{["Cheque","Bank Transfer","Cash","Online"].map(t=><option key={t}>{t}</option>)}</select></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>STATUS</label><select value={pForm.status} onChange={e=>setPForm(f=>({...f,status:e.target.value}))}>{["Pending","Paid","Bounced","Waived"].map(s=><option key={s}>{s}</option>)}</select></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>CHEQUE/REF</label><input value={pForm.cheque_number} onChange={e=>setPForm(f=>({...f,cheque_number:e.target.value}))}/></div>
              </div>
              <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:14}}>
                <button onClick={()=>setShowAddPmt(false)} style={{padding:"9px 18px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancel</button>
                <button onClick={savePmt} disabled={saving} style={{padding:"9px 18px",borderRadius:8,border:"none",background:"#0B1F3A",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>{saving?"Saving…":"Log Payment"}</button>
              </div>
            </Modal>
          )}
        </div>
      )}

      {/* Maintenance */}
      {tab==="maintenance"&&(
        <div style={{flex:1,display:"flex",flexDirection:"column"}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
            <span style={{fontSize:12,color:"#A0AEC0"}}>{openMaint.length} open · {maintenance.length} total</span>
            {canEdit&&<button onClick={()=>{setMForm(mBlank);setShowAddMaint(true);}} style={{padding:"7px 16px",borderRadius:8,border:"none",background:"#0B1F3A",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>+ Log Request</button>}
          </div>
          <div style={{flex:1,overflowY:"auto",display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:10,alignContent:"start"}}>
            {maintenance.map(m=>{
              const PC={Urgent:{c:"#B83232",bg:"#FAEAEA"},High:{c:"#B85C10",bg:"#FDF0E6"},Normal:{c:"#1A5FA8",bg:"#E6EFF9"},Low:{c:"#718096",bg:"#F0F2F5"}};
              const SC_M={Open:{c:"#B83232",bg:"#FAEAEA"},"In Progress":{c:"#A06810",bg:"#FDF3DC"},Completed:{c:"#1A7F5A",bg:"#E6F4EE"}};
              const pc=PC[m.priority]||{c:"#718096",bg:"#F0F2F5"};
              const sc=SC_M[m.status]||{c:"#718096",bg:"#F0F2F5"};
              return (
                <div key={m.id} style={{background:"#fff",border:`1px solid ${m.priority==="Urgent"?"#F0BCBC":"#E2E8F0"}`,borderRadius:10,padding:"12px 14px"}}>
                  <div style={{display:"flex",gap:6,marginBottom:8}}>
                    <span style={{fontSize:10,fontWeight:600,padding:"2px 7px",borderRadius:20,background:pc.bg,color:pc.c}}>{m.priority}</span>
                    <span style={{fontSize:10,fontWeight:600,padding:"2px 7px",borderRadius:20,background:sc.bg,color:sc.c}}>{m.status}</span>
                    <span style={{fontSize:10,color:"#A0AEC0",marginLeft:"auto"}}>{m.category}</span>
                  </div>
                  <div style={{fontWeight:700,fontSize:13,color:"#0B1F3A",marginBottom:4}}>{m.title}</div>
                  <div style={{fontSize:11,color:"#A0AEC0",marginBottom:6}}>Unit {unitLabel(m.unit_id)} · {m.charged_to} responsibility</div>
                  {m.description&&<div style={{fontSize:12,color:"#4A5568",lineHeight:1.5,marginBottom:6}}>{m.description}</div>}
                  {m.assigned_to&&<div style={{fontSize:11,color:"#4A5568"}}>👷 {m.assigned_to}</div>}
                  {m.cost_estimate&&<div style={{fontSize:11,color:"#A06810"}}>Est: AED {Number(m.cost_estimate).toLocaleString()}</div>}
                  {canEdit&&m.status!=="Completed"&&(
                    <button onClick={async()=>{await supabase.from("maintenance").update({status:"Completed",completed_date:today.toISOString().slice(0,10)}).eq("id",m.id);setMaintenance(p=>p.map(x=>x.id===m.id?{...x,status:"Completed"}:x));showToast("Marked complete","success");}} style={{marginTop:8,padding:"5px 12px",borderRadius:8,border:"none",background:"#E6F4EE",color:"#1A7F5A",fontSize:11,fontWeight:600,cursor:"pointer"}}>Mark Complete</button>
                  )}
                </div>
              );
            })}
            {maintenance.length===0&&<div style={{textAlign:"center",padding:"3rem",color:"#A0AEC0"}}><div style={{fontSize:36,marginBottom:8}}>🔧</div><div>No maintenance requests</div></div>}
          </div>
          {showAddMaint&&(
            <Modal title="Log Maintenance Request" onClose={()=>setShowAddMaint(false)} width={480}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>UNIT *</label><select value={mForm.unit_id} onChange={e=>setMForm(f=>({...f,unit_id:e.target.value}))}><option value="">Select…</option>{units.map(u=><option key={u.id} value={u.id}>#{u.unit_ref}</option>)}</select></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>PRIORITY</label><select value={mForm.priority} onChange={e=>setMForm(f=>({...f,priority:e.target.value}))}>{["Urgent","High","Normal","Low"].map(p=><option key={p}>{p}</option>)}</select></div>
                <div style={{gridColumn:"1/-1"}}><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>TITLE *</label><input value={mForm.title} onChange={e=>setMForm(f=>({...f,title:e.target.value}))} placeholder="e.g. AC not working"/></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>CATEGORY</label><select value={mForm.category} onChange={e=>setMForm(f=>({...f,category:e.target.value}))}>{["Plumbing","Electrical","AC/HVAC","Painting","Carpentry","Appliances","Pest Control","Cleaning","General","Other"].map(c=><option key={c}>{c}</option>)}</select></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>CHARGED TO</label><select value={mForm.charged_to} onChange={e=>setMForm(f=>({...f,charged_to:e.target.value}))}>{["Landlord","Tenant","Shared"].map(c=><option key={c}>{c}</option>)}</select></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>ASSIGNED TO</label><input value={mForm.assigned_to} onChange={e=>setMForm(f=>({...f,assigned_to:e.target.value}))} placeholder="Contractor name"/></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>COST ESTIMATE (AED)</label><input type="number" value={mForm.cost_estimate} onChange={e=>setMForm(f=>({...f,cost_estimate:e.target.value}))}/></div>
                <div style={{gridColumn:"1/-1"}}><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>DESCRIPTION</label><textarea value={mForm.description} onChange={e=>setMForm(f=>({...f,description:e.target.value}))} rows={2}/></div>
              </div>
              <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:14}}>
                <button onClick={()=>setShowAddMaint(false)} style={{padding:"9px 18px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancel</button>
                <button onClick={saveMaint} disabled={saving} style={{padding:"9px 18px",borderRadius:8,border:"none",background:"#0B1F3A",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>{saving?"Saving…":"Log Request"}</button>
              </div>
            </Modal>
          )}
        </div>
      )}
    </div>
  );
}


export default function App(){
  const[currentUser,setCurrentUser]=useState(null);const[checking,setChecking]=useState(true);
  const[leads,setLeads]=useState([]);const[properties,setProperties]=useState([]);
  const[activities,setActivities]=useState([]);const[users,setUsers]=useState([]);
  const[meetings,setMeetings]=useState([]);const[followups,setFollowups]=useState([]);const[discounts,setDiscounts]=useState([]);
  const[tab,setTab]=useState("dashboard");const[dataLoading,setDataLoading]=useState(false);
  const[toast,setToast]=useState(null);
  const showToast=(msg,type="success")=>setToast({msg,type});

  useEffect(()=>{
    const restore=async()=>{
      const{data:{session}}=await supabase.auth.getSession();
      if(session?.user){const{data:profile}=await supabase.from("profiles").select("*").eq("id",session.user.id).single();if(profile&&profile.is_active)setCurrentUser({...session.user,...profile});else await supabase.auth.signOut();}
      setChecking(false);
    };
    restore();
    const{data:{subscription}}=supabase.auth.onAuthStateChange(async(event,session)=>{
      if(event==="SIGNED_OUT"){setCurrentUser(null);setLeads([]);setProperties([]);setActivities([]);setMeetings([]);setFollowups([]);}
      if(event==="TOKEN_REFRESHED"&&session?.user){const{data:p}=await supabase.from("profiles").select("*").eq("id",session.user.id).single();if(p)setCurrentUser(u=>({...u,...p}));}
    });
    return()=>subscription.unsubscribe();
  },[]);

  useEffect(()=>{
    if(!currentUser)return;
    const safe=async(q)=>{
      try{ const r=await q; return {data:(r.data||[])}; }
      catch(e){ return {data:[]}; }
    };
    const load=async()=>{
      setDataLoading(true);
      try{
        const[l,pr,a,u,d]=await Promise.all([
          safe(supabase.from("leads").select("*").order("created_at",{ascending:false})),
          safe(supabase.from("properties").select("*").order("created_at",{ascending:false})),
          safe(supabase.from("activities").select("*").order("created_at",{ascending:false})),
          safe(supabase.from("profiles").select("*").order("full_name")),
          safe(supabase.from("discount_requests").select("*").order("created_at",{ascending:false})),
        ]);
        setLeads(l.data);setProperties(pr.data);setActivities(a.data);setUsers(u.data);setDiscounts(d.data);
      }catch(e){console.error("Load error:",e);}
      setDataLoading(false);
    };
    load();
    const ch=supabase.channel("v3-changes")
      .on("postgres_changes",{event:"*",schema:"public",table:"leads"},p=>{if(p.eventType==="INSERT")setLeads(x=>[p.new,...x]);if(p.eventType==="UPDATE")setLeads(x=>x.map(l=>l.id===p.new.id?p.new:l));if(p.eventType==="DELETE")setLeads(x=>x.filter(l=>l.id!==p.old.id));})
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"activities"},p=>setActivities(x=>[p.new,...x]))
      .on("postgres_changes",{event:"*",schema:"public",table:"meetings"},p=>{if(p.eventType==="INSERT")setMeetings(x=>[p.new,...x]);if(p.eventType==="UPDATE")setMeetings(x=>x.map(m=>m.id===p.new.id?p.new:m));})
      .on("postgres_changes",{event:"*",schema:"public",table:"followups"},p=>{if(p.eventType==="INSERT")setFollowups(x=>[p.new,...x]);if(p.eventType==="UPDATE")setFollowups(x=>x.map(f=>f.id===p.new.id?p.new:f));})
      .subscribe();
    return()=>supabase.removeChannel(ch);
  },[currentUser]);

  const handleLogin=user=>{setCurrentUser(user);setTab("dashboard");};
  const handleLogout=async()=>{await supabase.auth.signOut();setCurrentUser(null);};
  const userRole=currentUser?.role||"viewer";
  const visibleTabs=TABS.filter(t=>t.roles.includes(userRole));

  if(checking)return(<><GlobalStyle/><div style={{minHeight:"100vh",background:"#0B1F3A",display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{textAlign:"center"}}><div style={{fontFamily:"'Playfair Display',serif",fontSize:32,color:"#fff",marginBottom:20}}><span style={{color:"#C9A84C"}}>◆</span> PropCRM</div><Spinner msg=""/></div></div></>);
  if(!currentUser)return <><GlobalStyle/><LoginScreen onLogin={handleLogin}/></>;

  return(
    <><GlobalStyle/>
    <div style={{display:"flex",flexDirection:"column",height:"100vh",background:"#F0F2F5",overflow:"hidden"}}>
      {/* Nav */}
      <div style={{background:"#0B1F3A",display:"flex",alignItems:"center",padding:"0 1.5rem",height:54,flexShrink:0,gap:2,boxShadow:"0 2px 16px rgba(11,31,58,0.5)"}}>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:"#fff",fontWeight:700,marginRight:24,whiteSpace:"nowrap"}}><span style={{color:"#C9A84C"}}>◆</span> PropCRM</div>
        {visibleTabs.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"6px 13px",borderRadius:8,border:"none",background:tab===t.id?"rgba(201,168,76,0.12)":"transparent",color:tab===t.id?"#C9A84C":"rgba(255,255,255,0.55)",fontSize:13,fontWeight:tab===t.id?600:400,cursor:"pointer",display:"flex",alignItems:"center",gap:6,transition:"all 0.15s",borderBottom:tab===t.id?"2px solid #C9A84C":"2px solid transparent"}}>
            <span style={{fontSize:14}}>{t.icon}</span>{t.label}
            {t.id==="leads"&&followups.filter(f=>f.status==="Pending"&&new Date(f.due_at)<new Date()).length>0&&<span style={{background:"#B83232",color:"#fff",fontSize:9,fontWeight:700,padding:"1px 5px",borderRadius:10}}>{followups.filter(f=>f.status==="Pending"&&new Date(f.due_at)<new Date()).length}</span>}
          </button>
        ))}
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:12}}>
          <div style={{textAlign:"right",display:"flex",flexDirection:"column",gap:1}}>
            <span style={{fontSize:12,color:"#fff",fontWeight:500}}>{currentUser.full_name}</span>
            <RoleBadge role={currentUser.role}/>
          </div>
          <Av name={currentUser.full_name||currentUser.email} size={32} bg="#C9A84C" tc="#0B1F3A"/>
          <button onClick={handleLogout} style={{fontSize:11,color:"rgba(255,255,255,0.4)",background:"none",border:"1px solid rgba(255,255,255,0.1)",borderRadius:6,padding:"4px 10px",cursor:"pointer"}}>Sign Out</button>
        </div>
      </div>

      {/* Page title */}
      <div style={{padding:"16px 1.5rem 10px",flexShrink:0}}>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:21,fontWeight:700,color:"#0B1F3A"}}>{TABS.find(t=>t.id===tab)?.label}</div>
        <div style={{fontSize:12,color:"#A0AEC0",marginTop:2}}>{SUBTITLES[tab]}</div>
      </div>

      {/* Content */}
      <div style={{flex:1,overflow:"hidden",padding:"0 1.5rem 1.5rem"}}>
        {dataLoading?<Spinner msg="Loading your data…"/>:(<>
          {tab==="dashboard"  &&<div style={{height:"100%",overflowY:"auto",paddingRight:4}}><Dashboard leads={leads} properties={properties} activities={activities} currentUser={currentUser} meetings={meetings} followups={followups}/></div>}
          {tab==="leads"      &&<Leads leads={leads} setLeads={setLeads} properties={properties} activities={activities} setActivities={setActivities} discounts={discounts} setDiscounts={setDiscounts} currentUser={currentUser} users={users} showToast={showToast}/>}
          {tab==="builder"    &&<PropertyBuilder currentUser={currentUser} showToast={showToast}/>}
          {tab==="leasing"    &&<LeasingModule currentUser={currentUser} showToast={showToast}/>}
          {tab==="discounts"  &&<DiscountApprovals discounts={discounts} setDiscounts={setDiscounts} leads={leads} user={currentUser} toast={showToast}/>}
          {tab==="pipeline"   &&<Pipeline leads={leads} setLeads={setLeads} currentUser={currentUser} showToast={showToast}/>}
          {tab==="activity"   &&<ActivityLog leads={leads} activities={activities} setActivities={setActivities} currentUser={currentUser} showToast={showToast}/>}
          {tab==="users"      &&can(userRole,"manage_users")&&<UserManagement currentUser={currentUser} leads={leads} activities={activities} showToast={showToast}/>}
        </>)}
      </div>
    </div>
    {toast&&<Toast msg={toast.msg} type={toast.type} onDone={()=>setToast(null)}/>}
    </>
  );
}
