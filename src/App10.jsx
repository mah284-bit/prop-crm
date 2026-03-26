import { useState, useMemo, useEffect, useCallback } from "react";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* ═══════════════════════════════════════════════════════════════
   PROPCCRM v2.0  —  Multi-user · Role-based · Supabase backend
   Roles: admin · manager · agent · viewer
   ─────────────────────────────────────────────────────────────
   SETUP: Replace the two lines below with your Supabase project
   URL and anon key (see setup guide).
═══════════════════════════════════════════════════════════════ */
const SUPABASE_URL  = "https://ysceukgpimzfqixtnbnp.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzY2V1a2dwaW16ZnFpeHRuYm5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNDI5OTQsImV4cCI6MjA4OTkxODk5NH0.WZSyGeOEbiRo1wt13syheTOyiAToMWXInxIaBgaqq8k";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

// ─── GLOBAL STYLES ────────────────────────────────────────────────
const GlobalStyle = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@300;400;500;600&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'DM Sans', sans-serif; background: #F0F2F5; color: #1a2535; }
    ::-webkit-scrollbar { width: 5px; height: 5px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #C9A84C55; border-radius: 10px; }
    input, select, textarea {
      font-family: 'DM Sans', sans-serif; outline: none;
      border: 1.5px solid #D1D9E6; border-radius: 8px; padding: 9px 12px;
      font-size: 13px; color: #1a2535; background: #fff; width: 100%;
      transition: border-color 0.2s;
    }
    input:focus, select:focus, textarea:focus { border-color: #C9A84C; }
    textarea { resize: vertical; }
    button { cursor: pointer; font-family: 'DM Sans', sans-serif; }
    .fade-in { animation: fadeIn 0.25s ease; }
    @keyframes fadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:none; } }
    .slide-in { animation: slideIn 0.2s ease; }
    @keyframes slideIn { from { opacity:0; transform:translateX(12px); } to { opacity:1; transform:none; } }
    .ch { transition: box-shadow 0.18s, transform 0.18s; }
    .ch:hover { box-shadow: 0 4px 20px #C9A84C22; transform: translateY(-1px); }
    .dcard { transition: box-shadow 0.15s; cursor: grab; }
    .dcard:hover { box-shadow: 0 3px 14px #0B1F3A22; }
  `}</style>
);

// ─── CONSTANTS ────────────────────────────────────────────────────
const STAGES      = ["New Lead","Contacted","Site Visit","Proposal Sent","Negotiation","Closed Won","Closed Lost"];
const PROP_TYPES  = ["Residential","Commercial","Luxury","Off-plan","Villa","Flat","Building"];
const UNIT_CLASS  = ["Villa","Flat","Penthouse","Studio","Duplex","Townhouse","Office","Warehouse","Plot","Building"];
const CAT_TYPES   = ["Villas","Flats","Commercial","Mixed Use","Plots"];
const VIEWS       = ["Sea View","Burj View","Garden View","Pool View","City View","Golf View","Internal","Canal View"];
const FURNISHING  = ["Unfurnished","Semi-Furnished","Furnished"];
const UNIT_STATUS = ["Available","Reserved","Under Offer","Sold","Blocked"];
const PROJ_STATUS = ["Active","Upcoming","Completed","On Hold"];
const SOURCES     = ["Referral","Website","Portal","Cold Call","Event","Social Media"];
const ACT_TYPES   = ["Call","Email","Meeting","Visit","Note"];
const COMM_TYPES  = ["WhatsApp","Email","Call","Meeting","SMS"];
const FU_TYPES    = ["Call","Email","WhatsApp","Meeting","Site Visit","Task"];
const ROLES       = ["admin","manager","agent","viewer"];
const NATIONALITIES = ["UAE","Saudi Arabia","India","UK","Pakistan","Egypt","Jordan","USA","Russia","China","Other"];

// Stage transition rules — what is required before moving to next stage
const STAGE_RULES = {
  "Contacted":     { requires: ["phone","email"],                    label: "Phone & email required" },
  "Site Visit":    { requires: ["meeting_scheduled"],                 label: "Meeting must be scheduled" },
  "Proposal Sent": { requires: ["unit_id","budget_confirmed"],        label: "Unit linked & budget confirmed" },
  "Negotiation":   { requires: ["proposal_notes"],                    label: "Proposal notes required" },
  "Closed Won":    { requires: ["final_price","payment_plan_agreed"], label: "Final price & payment plan required" },
};

// Roles that can delete leads
const CAN_DELETE_LEADS = ["admin","manager"];

// WhatsApp message templates
const WA_TEMPLATES = [
  { key:"intro",    label:"Introduction",     body:"Hello {name}, I am {agent} from PropCRM. I wanted to reach out regarding your property enquiry. Would you be available for a quick call?" },
  { key:"followup", label:"Follow-up",        body:"Hi {name}, following up on our previous conversation regarding {property}. Do you have any questions I can help with?" },
  { key:"visit",    label:"Site Visit",       body:"Hi {name}, confirming your site visit on {date}. Please let me know if you need to reschedule. Looking forward to meeting you!" },
  { key:"proposal", label:"Proposal Sent",    body:"Hi {name}, I have just sent across the proposal for {property}. Please review and let me know your thoughts." },
  { key:"noresponse",label:"No Response",     body:"Hi {name}, hope you are well. I tried reaching you a few times. Please let me know a good time to connect regarding your property search." },
  { key:"closing",  label:"Closing",          body:"Hi {name}, great news — we are ready to proceed with the unit. Could we schedule a call to finalise the paperwork?" },
];

const ROLE_META = {
  admin:   { label:"Admin",   color:"#8A6200", bg:"#FDF3DC", desc:"Full access + user management" },
  manager: { label:"Manager", color:"#1A5FA8", bg:"#E6EFF9", desc:"All leads, no settings" },
  agent:   { label:"Agent",   color:"#1A7F5A", bg:"#E6F4EE", desc:"Own leads only" },
  viewer:  { label:"Viewer",  color:"#718096", bg:"#F0F2F5", desc:"Read-only access" },
};
const STAGE_META = {
  "New Lead":      { c:"#1A5FA8", bg:"#E6EFF9" },
  "Contacted":     { c:"#5B3FAA", bg:"#EEE8F9" },
  "Site Visit":    { c:"#A06810", bg:"#FDF3DC" },
  "Proposal Sent": { c:"#7A3FAA", bg:"#F3E8F9" },
  "Negotiation":   { c:"#B85C10", bg:"#FDF0E6" },
  "Closed Won":    { c:"#1A7F5A", bg:"#E6F4EE" },
  "Closed Lost":   { c:"#B83232", bg:"#FAEAEA" },
};
const TYPE_META = {
  Residential: { c:"#1A7F5A", bg:"#E6F4EE" },
  Commercial:  { c:"#1A5FA8", bg:"#E6EFF9" },
  Luxury:      { c:"#8A6200", bg:"#FDF3DC" },
  "Off-plan":  { c:"#5B3FAA", bg:"#EEE8F9" },
};
const ACT_META = {
  Call:    { icon:"📞", c:"#1A5FA8", bg:"#E6EFF9" },
  Email:   { icon:"✉",  c:"#5B3FAA", bg:"#EEE8F9" },
  Meeting: { icon:"🤝", c:"#1A7F5A", bg:"#E6F4EE" },
  Visit:   { icon:"🏠", c:"#A06810", bg:"#FDF3DC" },
  Note:    { icon:"📝", c:"#718096", bg:"#F0F2F5" },
};
const COMM_META = {
  WhatsApp: { icon:"💬", c:"#1A7F5A", bg:"#E6F4EE" },
  Email:    { icon:"✉",  c:"#5B3FAA", bg:"#EEE8F9" },
  Call:     { icon:"📞", c:"#1A5FA8", bg:"#E6EFF9" },
  Meeting:  { icon:"🤝", c:"#A06810", bg:"#FDF3DC" },
  SMS:      { icon:"💬", c:"#718096", bg:"#F0F2F5" },
};
const FU_META = {
  Call:        { icon:"📞", c:"#1A5FA8" },
  Email:       { icon:"✉",  c:"#5B3FAA" },
  WhatsApp:    { icon:"💬", c:"#1A7F5A" },
  Meeting:     { icon:"🤝", c:"#A06810" },
  "Site Visit":{ icon:"🏠", c:"#B85C10" },
  Task:        { icon:"✓",  c:"#718096" },
};

// ─── UTILS ────────────────────────────────────────────────────────
const fmtM    = n => `AED ${(n/1e6).toFixed(1)}M`;
const fmtFull = n => `AED ${Number(n).toLocaleString("en-AE")}`;
const fmtDate = d => d ? new Date(d).toLocaleDateString("en-AE",{day:"numeric",month:"short",year:"numeric"}) : "—";
const ini     = n => (n||"?").split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase();

// Permission helper
const can = (role, action) => {
  const perms = {
    admin:   ["read","write","delete","manage_users","see_all"],
    manager: ["read","write","delete","see_all"],
    agent:   ["read","write"],
    viewer:  ["read"],
  };
  return (perms[role]||[]).includes(action);
};

// ─── ATOMS ────────────────────────────────────────────────────────
const Av = ({ name, size=36, bg="#0B1F3A", tc="#C9A84C" }) => (
  <div style={{ width:size, height:size, borderRadius:"50%", background:bg, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:size*0.32, fontWeight:600, color:tc, letterSpacing:"0.5px" }}>{ini(name)}</div>
);

const StageBadge = ({ stage }) => {
  const m = STAGE_META[stage]||{c:"#718096",bg:"#F0F2F5"};
  return <span style={{ display:"inline-flex", alignItems:"center", gap:4, background:m.bg, color:m.c, fontSize:11, fontWeight:600, padding:"3px 9px", borderRadius:20, whiteSpace:"nowrap" }}><span style={{ width:5, height:5, borderRadius:"50%", background:m.c, display:"inline-block" }}/>{stage}</span>;
};
const TypeBadge = ({ type }) => {
  const m = TYPE_META[type]||{c:"#718096",bg:"#F0F2F5"};
  return <span style={{ fontSize:11, fontWeight:600, padding:"3px 9px", borderRadius:20, background:m.bg, color:m.c }}>{type}</span>;
};
const RoleBadge = ({ role }) => {
  const m = ROLE_META[role]||{label:role,color:"#718096",bg:"#F0F2F5"};
  return <span style={{ fontSize:11, fontWeight:600, padding:"3px 9px", borderRadius:20, background:m.bg, color:m.color, textTransform:"capitalize" }}>{m.label}</span>;
};

const Btn = ({ children, onClick, variant="primary", small=false, full=false, disabled=false, style:st={} }) => {
  const s = {
    primary: { background:"#0B1F3A", color:"#fff",     border:"none" },
    gold:    { background:"#C9A84C", color:"#0B1F3A",  border:"none" },
    outline: { background:"#fff",    color:"#0B1F3A",  border:"1.5px solid #D1D9E6" },
    danger:  { background:"#FAEAEA", color:"#B83232",  border:"1.5px solid #F0BCBC" },
    green:   { background:"#E6F4EE", color:"#1A7F5A",  border:"1.5px solid #A8D5BE" },
  };
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ ...s[variant], padding:small?"6px 14px":"9px 18px", borderRadius:8, fontSize:small?12:13, fontWeight:600, display:"inline-flex", alignItems:"center", gap:6, transition:"opacity 0.15s", width:full?"100%":"auto", justifyContent:"center", opacity:disabled?0.45:1, ...st }}
      onMouseOver={e=>{ if(!disabled) e.currentTarget.style.opacity="0.82"; }}
      onMouseOut={e=>e.currentTarget.style.opacity=disabled?"0.45":"1"}>
      {children}
    </button>
  );
};

const Card = ({ children, style:st={}, onClick, cls="" }) => (
  <div onClick={onClick} className={`ch ${cls}`} style={{ background:"#fff", border:"1px solid #E2E8F0", borderRadius:12, padding:"1rem 1.125rem", ...st }}>{children}</div>
);

const Empty = ({ icon, msg }) => (
  <div style={{ textAlign:"center", padding:"3rem 1rem", color:"#A0AEC0" }}>
    <div style={{ fontSize:36, marginBottom:10 }}>{icon}</div>
    <div style={{ fontSize:14 }}>{msg}</div>
  </div>
);

const FR = ({ label, value }) => (
  <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
    <span style={{ fontSize:10, color:"#A0AEC0", textTransform:"uppercase", letterSpacing:"0.6px", fontWeight:600 }}>{label}</span>
    <span style={{ fontSize:13, color:"#1a2535", fontWeight:500 }}>{value||"—"}</span>
  </div>
);

const Spinner = ({ msg="Loading…" }) => (
  <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", gap:16, color:"#A0AEC0" }}>
    <div style={{ width:36, height:36, border:"3px solid #E2E8F0", borderTop:"3px solid #C9A84C", borderRadius:"50%", animation:"spin 0.8s linear infinite" }}/>
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    <div style={{ fontSize:14 }}>{msg}</div>
  </div>
);

const Modal = ({ title, onClose, children, width=520 }) => (
  <div style={{ position:"fixed", inset:0, background:"rgba(11,31,58,0.6)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:"1rem" }}>
    <div className="fade-in" style={{ background:"#fff", borderRadius:16, width, maxWidth:"100%", maxHeight:"90vh", overflowY:"auto", boxShadow:"0 20px 60px rgba(11,31,58,0.3)" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"1.25rem 1.5rem", borderBottom:"1px solid #E2E8F0", position:"sticky", top:0, background:"#fff", zIndex:1 }}>
        <span style={{ fontFamily:"'Playfair Display',serif", fontSize:17, fontWeight:700, color:"#0B1F3A" }}>{title}</span>
        <button onClick={onClose} style={{ background:"none", border:"none", fontSize:22, color:"#A0AEC0", cursor:"pointer" }}>×</button>
      </div>
      <div style={{ padding:"1.25rem 1.5rem" }}>{children}</div>
    </div>
  </div>
);

const FF = ({ label, children, required=false }) => (
  <div style={{ marginBottom:14 }}>
    <label style={{ display:"block", fontSize:11, fontWeight:600, color:"#4A5568", marginBottom:5, textTransform:"uppercase", letterSpacing:"0.5px" }}>{label}{required && <span style={{ color:"#B83232" }}> *</span>}</label>
    {children}
  </div>
);
const G2 = ({ children }) => <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>{children}</div>;

const Toast = ({ msg, type="success", onDone }) => {
  useEffect(() => { const t = setTimeout(onDone, 3000); return ()=>clearTimeout(t); }, []);
  const colors = { success:["#E6F4EE","#1A7F5A"], error:["#FAEAEA","#B83232"], info:["#E6EFF9","#1A5FA8"] };
  const [bg, c] = colors[type]||colors.info;
  return (
    <div style={{ position:"fixed", bottom:24, right:24, zIndex:9999, background:bg, color:c, border:`1.5px solid ${c}33`, borderRadius:10, padding:"12px 18px", fontSize:13, fontWeight:600, boxShadow:"0 4px 20px rgba(0,0,0,0.12)", maxWidth:320 }}>
      {type==="success"?"✓ ":type==="error"?"✕ ":"ℹ "}{msg}
    </div>
  );
};

// ═══════════════════════════════════════════════════════
// AUTH SCREEN  (Login · Sign Up · Verify Email)
// ═══════════════════════════════════════════════════════

// Eye icon for password visibility
const EyeIcon = ({ open }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {open
      ? <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
      : <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>
    }
  </svg>
);

// Password strength calculator
const getStrength = (pw) => {
  if (!pw) return { score:0, label:"", color:"#E2E8F0" };
  let s = 0;
  if (pw.length >= 8)  s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  if (s <= 1) return { score:s, label:"Weak",   color:"#B83232", pct:20 };
  if (s <= 2) return { score:s, label:"Fair",   color:"#A06810", pct:45 };
  if (s <= 3) return { score:s, label:"Good",   color:"#1A5FA8", pct:70 };
  return              { score:s, label:"Strong", color:"#1A7F5A", pct:100 };
};

// Shared password input with visibility toggle
const PwInput = ({ value, onChange, placeholder="••••••••", onKeyDown }) => {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position:"relative" }}>
      <input
        type={show?"text":"password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        onKeyDown={onKeyDown}
        style={{ paddingRight:42 }}
      />
      <button
        type="button"
        onClick={()=>setShow(s=>!s)}
        style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:"#A0AEC0", padding:0, display:"flex", alignItems:"center", cursor:"pointer" }}>
        <EyeIcon open={show}/>
      </button>
    </div>
  );
};

// Strength bar shown below password field
const StrengthBar = ({ password }) => {
  const s = getStrength(password);
  if (!password) return null;
  return (
    <div style={{ marginTop:6 }}>
      <div style={{ height:4, background:"#F0F2F5", borderRadius:4, overflow:"hidden" }}>
        <div style={{ width:`${s.pct}%`, height:"100%", background:s.color, borderRadius:4, transition:"width 0.3s, background 0.3s" }}/>
      </div>
      <div style={{ fontSize:11, color:s.color, fontWeight:600, marginTop:4 }}>{s.label} password</div>
    </div>
  );
};

// Auth background wrapper
const AuthWrap = ({ children }) => (
  <div style={{ minHeight:"100vh", background:"linear-gradient(135deg,#0B1F3A 0%,#1A3558 60%,#0B1F3A 100%)", display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem" }}>
    <div className="fade-in" style={{ background:"#fff", borderRadius:20, padding:"2.5rem", width:440, maxWidth:"100%", boxShadow:"0 30px 80px rgba(0,0,0,0.4)" }}>
      {children}
    </div>
  </div>
);

// Logo header
const AuthLogo = ({ sub }) => (
  <div style={{ textAlign:"center", marginBottom:28 }}>
    <div style={{ fontFamily:"'Playfair Display',serif", fontSize:32, fontWeight:700, color:"#0B1F3A" }}>
      <span style={{ color:"#C9A84C" }}>◆</span> PropCRM
    </div>
    <div style={{ fontSize:13, color:"#A0AEC0", marginTop:6 }}>{sub}</div>
  </div>
);

// Error box
const ErrBox = ({ msg }) => msg ? (
  <div style={{ background:"#FAEAEA", color:"#B83232", border:"1.5px solid #F0BCBC", borderRadius:8, padding:"10px 14px", fontSize:13, marginBottom:16, lineHeight:1.5 }}>
    {msg}
  </div>
) : null;

// Tab switcher Login / Sign Up
const AuthTabs = ({ mode, setMode }) => (
  <div style={{ display:"flex", background:"#F0F2F5", borderRadius:10, padding:4, marginBottom:24 }}>
    {[["login","Sign In"],["signup","Create Account"]].map(([m,label])=>(
      <button key={m} onClick={()=>setMode(m)}
        style={{ flex:1, padding:"8px 0", borderRadius:8, border:"none", background:mode===m?"#fff":"transparent", color:mode===m?"#0B1F3A":"#A0AEC0", fontSize:13, fontWeight:mode===m?600:400, cursor:"pointer", transition:"all 0.2s", boxShadow:mode===m?"0 1px 4px rgba(0,0,0,0.08)":"none" }}>
        {label}
      </button>
    ))}
  </div>
);

function LoginScreen({ onLogin }) {
  const [mode,   setMode]   = useState("login"); // "login" | "signup" | "verify"
  const [email,  setEmail]  = useState("");
  const [pw,     setPw]     = useState("");
  const [pw2,    setPw2]    = useState("");
  const [name,   setName]   = useState("");
  const [loading,setLoading]= useState(false);
  const [error,  setError]  = useState("");

  const resetErr = () => setError("");

  // ── LOGIN ─────────────────────────────────────────────
  const doLogin = async () => {
    if (!email||!pw) { setError("Please enter your email and password."); return; }
    setLoading(true); resetErr();
    try {
      const { data, error: e } = await supabase.auth.signInWithPassword({ email, password:pw });
      if (e) throw e;
      const { data: profile } = await supabase.from("profiles").select("*").eq("id", data.user.id).single();
      if (!profile) throw new Error("Profile not found. Please sign up first or contact your admin.");
      if (!profile.is_active) throw new Error("Your account has been deactivated. Contact your admin.");
      onLogin({ ...data.user, ...profile });
    } catch(e) {
      const msg = e.message||"";
      if (msg.includes("Email not confirmed"))
        setError("Please verify your email first. Check your inbox for the confirmation link.");
      else if (msg.includes("Invalid login"))
        setError("Incorrect email or password. Please try again.");
      else setError(msg||"Login failed.");
    } finally { setLoading(false); }
  };

  // ── SIGN UP ───────────────────────────────────────────
  const doSignup = async () => {
    if (!name.trim())             { setError("Please enter your full name."); return; }
    if (!email)                   { setError("Please enter your email address."); return; }
    if (pw.length < 8)            { setError("Password must be at least 8 characters."); return; }
    if (pw !== pw2)               { setError("Passwords do not match. Please check and try again."); return; }
    const strength = getStrength(pw);
    if (strength.score < 2)       { setError("Password is too weak. Use a mix of letters, numbers, and symbols."); return; }
    setLoading(true); resetErr();
    try {
      const { error: e } = await supabase.auth.signUp({
        email, password: pw,
        options: { data: { full_name: name.trim(), role: "agent" } }
      });
      if (e) throw e;
      setMode("verify");
    } catch(e) {
      const msg = e.message||"";
      if (msg.includes("already registered"))
        setError("An account with this email already exists. Please sign in instead.");
      else setError(msg||"Sign up failed. Please try again.");
    } finally { setLoading(false); }
  };

  // ── VERIFY EMAIL SCREEN ───────────────────────────────
  if (mode === "verify") {
    return (
      <AuthWrap>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:56, marginBottom:16 }}>📬</div>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:22, fontWeight:700, color:"#0B1F3A", marginBottom:10 }}>Check your inbox</div>
          <div style={{ fontSize:14, color:"#4A5568", lineHeight:1.8, marginBottom:6 }}>
            We sent a confirmation email to:
          </div>
          <div style={{ fontSize:15, fontWeight:700, color:"#0B1F3A", marginBottom:20 }}>{email}</div>
          <div style={{ fontSize:13, color:"#718096", lineHeight:1.8, marginBottom:28, padding:"14px", background:"#F7F9FC", borderRadius:10, border:"1px solid #E2E8F0", textAlign:"left" }}>
            <strong>What to do:</strong><br/>
            1. Open the email from Supabase<br/>
            2. Click the <strong>"Confirm your email"</strong> link<br/>
            3. Come back here and sign in<br/><br/>
            <span style={{ color:"#A0AEC0" }}>Can't find it? Check your Spam or Junk folder.</span>
          </div>
          <Btn full onClick={()=>{ setMode("login"); setPw(""); setPw2(""); resetErr(); }} style={{ marginBottom:12 }}>
            → Go to Sign In
          </Btn>
          <button onClick={async()=>{
            setLoading(true);
            await supabase.auth.resend({ type:"signup", email });
            setLoading(false);
            setError("");
            alert("Confirmation email resent! Check your inbox.");
          }} style={{ background:"none", border:"none", color:"#A0AEC0", fontSize:12, cursor:"pointer", textDecoration:"underline" }}>
            {loading ? "Sending…" : "Resend confirmation email"}
          </button>
        </div>
      </AuthWrap>
    );
  }

  // ── LOGIN FORM ────────────────────────────────────────
  if (mode === "login") {
    return (
      <AuthWrap>
        <AuthLogo sub="Sign in to your account"/>
        <AuthTabs mode={mode} setMode={m=>{ setMode(m); setError(""); setPw(""); setPw2(""); }}/>
        <ErrBox msg={error}/>
        <FF label="Email Address" required>
          <input type="email" value={email} onChange={e=>{ setEmail(e.target.value); resetErr(); }} placeholder="you@company.com" onKeyDown={e=>e.key==="Enter"&&doLogin()}/>
        </FF>
        <FF label="Password" required>
          <PwInput value={pw} onChange={e=>{ setPw(e.target.value); resetErr(); }} onKeyDown={e=>e.key==="Enter"&&doLogin()}/>
        </FF>
        <Btn onClick={doLogin} disabled={loading} full style={{ marginTop:8, padding:"12px" }}>
          {loading ? "Signing in…" : "Sign In →"}
        </Btn>
        <div style={{ textAlign:"center", marginTop:18 }}>
          <span style={{ fontSize:13, color:"#A0AEC0" }}>New to PropCRM? </span>
          <button onClick={()=>{ setMode("signup"); setError(""); setPw(""); }} style={{ background:"none", border:"none", color:"#C9A84C", fontSize:13, fontWeight:600, cursor:"pointer", textDecoration:"underline" }}>Create an account</button>
        </div>
      </AuthWrap>
    );
  }

  // ── SIGN UP FORM ──────────────────────────────────────
  return (
    <AuthWrap>
      <AuthLogo sub="Create your PropCRM account"/>
      <AuthTabs mode={mode} setMode={m=>{ setMode(m); setError(""); setPw(""); setPw2(""); }}/>
      <ErrBox msg={error}/>
      <FF label="Full Name" required>
        <input value={name} onChange={e=>{ setName(e.target.value); resetErr(); }} placeholder="Ahmed Al Mansoori" onKeyDown={e=>e.key==="Enter"&&doSignup()}/>
      </FF>
      <FF label="Email Address" required>
        <input type="email" value={email} onChange={e=>{ setEmail(e.target.value); resetErr(); }} placeholder="you@company.com" onKeyDown={e=>e.key==="Enter"&&doSignup()}/>
      </FF>
      <FF label="Password" required>
        <PwInput value={pw} onChange={e=>{ setPw(e.target.value); resetErr(); }} placeholder="Min 8 characters"/>
        <StrengthBar password={pw}/>
      </FF>
      <FF label="Confirm Password" required>
        <PwInput value={pw2} onChange={e=>{ setPw2(e.target.value); resetErr(); }} placeholder="Re-enter your password" onKeyDown={e=>e.key==="Enter"&&doSignup()}/>
        {pw2 && pw !== pw2 && <div style={{ fontSize:11, color:"#B83232", marginTop:4, fontWeight:600 }}>✕ Passwords do not match</div>}
        {pw2 && pw === pw2 && pw.length>=8 && <div style={{ fontSize:11, color:"#1A7F5A", marginTop:4, fontWeight:600 }}>✓ Passwords match</div>}
      </FF>
      <div style={{ background:"#F7F9FC", border:"1px solid #E2E8F0", borderRadius:8, padding:"10px 14px", marginBottom:16, fontSize:12, color:"#718096", lineHeight:1.7 }}>
        By signing up you will be assigned the <strong>Agent</strong> role. Your admin can upgrade your access after you log in.
      </div>
      <Btn onClick={doSignup} disabled={loading} full style={{ padding:"12px" }}>
        {loading ? "Creating account…" : "Create Account →"}
      </Btn>
      <div style={{ textAlign:"center", marginTop:18 }}>
        <span style={{ fontSize:13, color:"#A0AEC0" }}>Already have an account? </span>
        <button onClick={()=>{ setMode("login"); setError(""); setPw(""); setPw2(""); }} style={{ background:"none", border:"none", color:"#C9A84C", fontSize:13, fontWeight:600, cursor:"pointer", textDecoration:"underline" }}>Sign in</button>
      </div>
    </AuthWrap>
  );
}

// ═══════════════════════════════════════════════════════
// USER MANAGEMENT — Full Admin Panel
// Sub-tabs: Overview · All Users · Analytics
// Features: Create · Edit · Delete · End Date · Role · Status
// ═══════════════════════════════════════════════════════
function UserManagement({ currentUser, leads, activities, showToast }) {
  const [users,    setUsers]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [subTab,   setSubTab]   = useState("users"); // "overview" | "users" | "analytics"
  const [search,   setSearch]   = useState("");
  const [fRole,    setFRole]    = useState("All");
  const [fStatus,  setFStatus]  = useState("All");
  const [showAdd,  setShowAdd]  = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [viewUser, setViewUser] = useState(null);
  const [delConfirm, setDelConfirm] = useState(null);

  const blank = { full_name:"", email:"", password:"", role:"agent", is_active:true, end_date:"", department:"", phone:"" };
  const [form, setForm] = useState(blank);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("profiles").select("*").order("created_at",{ascending:false});
    setUsers(data||[]);
    setLoading(false);
  }, []);

  useEffect(()=>{ loadUsers(); },[loadUsers]);

  // ── helpers ─────────────────────────────────────────
  const userLeads      = (uid) => leads.filter(l=>l.assigned_to===uid);
  const userWon        = (uid) => leads.filter(l=>l.assigned_to===uid&&l.stage==="Closed Won");
  const userActivities = (uid) => activities.filter(a=>a.user_id===uid);
  const isExpired      = (u)   => u.end_date && new Date(u.end_date) < new Date();

  const getStatusLabel = (u) => {
    if (!u.is_active)   return { label:"Inactive",  c:"#A0AEC0", bg:"#F0F2F5" };
    if (isExpired(u))   return { label:"Expired",   c:"#B83232", bg:"#FAEAEA" };
    if (u.end_date) {
      const days = Math.ceil((new Date(u.end_date)-new Date())/(1000*60*60*24));
      if (days<=7) return { label:`Expires in ${days}d`, c:"#A06810", bg:"#FDF3DC" };
    }
    return { label:"Active", c:"#1A7F5A", bg:"#E6F4EE" };
  };

  // ── CRUD ────────────────────────────────────────────
  const createUser = async () => {
    if (!form.full_name||!form.email||!form.password) { showToast("Name, email and password are required.","error"); return; }
    if (form.password.length<8) { showToast("Password must be at least 8 characters.","error"); return; }
    try {
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: form.email, password: form.password,
        options: { data: { full_name: form.full_name, role: form.role } }
      });
      if (authErr) throw authErr;
      const { error: profErr } = await supabase.from("profiles").upsert({
        id: authData.user.id, full_name: form.full_name, email: form.email,
        role: form.role, is_active: form.is_active,
        end_date: form.end_date||null, department: form.department||null, phone: form.phone||null
      });
      if (profErr) throw profErr;
      showToast(`${form.full_name} created — confirmation email sent.`,"success");
      setShowAdd(false); setForm(blank); loadUsers();
    } catch(e) { showToast(e.message,"error"); }
  };

  const saveEdit = async () => {
    if (!editUser||!form.full_name) return;
    try {
      const { error } = await supabase.from("profiles").update({
        full_name: form.full_name, role: form.role,
        is_active: form.is_active, end_date: form.end_date||null,
        department: form.department||null, phone: form.phone||null
      }).eq("id", editUser.id);
      if (error) throw error;
      showToast("User updated.","success");
      setEditUser(null); setViewUser(null); setForm(blank); loadUsers();
    } catch(e) { showToast(e.message,"error"); }
  };

  const deleteUser = async (u) => {
    if (u.id===currentUser.id) { showToast("You cannot delete yourself.","error"); return; }
    try {
      const { error } = await supabase.from("profiles").delete().eq("id",u.id);
      if (error) throw error;
      showToast(`${u.full_name} deleted.`,"info");
      setDelConfirm(null); setViewUser(null); loadUsers();
    } catch(e) { showToast(e.message,"error"); }
  };

  const toggleActive = async (u) => {
    if (u.id===currentUser.id) { showToast("You cannot deactivate yourself.","error"); return; }
    const { error } = await supabase.from("profiles").update({ is_active:!u.is_active }).eq("id",u.id);
    if (!error) { showToast(`${u.full_name} ${u.is_active?"deactivated":"reactivated"}.`,"success"); loadUsers(); }
  };

  const openEdit = (u) => {
    setEditUser(u);
    setForm({ full_name:u.full_name||"", email:u.email||"", password:"", role:u.role||"agent",
      is_active:u.is_active, end_date:u.end_date?u.end_date.slice(0,10):"",
      department:u.department||"", phone:u.phone||"" });
  };

  // ── FILTERED LIST ───────────────────────────────────
  const filtered = users.filter(u=>{
    const q = search.toLowerCase();
    const matchQ = !q || u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.department?.toLowerCase().includes(q);
    const matchR = fRole==="All"||u.role===fRole;
    const st = getStatusLabel(u).label;
    const matchS = fStatus==="All"||(fStatus==="Active"&&st==="Active")||(fStatus==="Inactive"&&(st==="Inactive"||st==="Expired"))||(fStatus==="Expiring"&&st.startsWith("Expires"));
    return matchQ&&matchR&&matchS;
  });

  // ── ANALYTICS DATA ──────────────────────────────────
  const analytics = {
    total:     users.length,
    active:    users.filter(u=>u.is_active&&!isExpired(u)).length,
    inactive:  users.filter(u=>!u.is_active||isExpired(u)).length,
    expiring:  users.filter(u=>{ if(!u.end_date||!u.is_active) return false; const d=Math.ceil((new Date(u.end_date)-new Date())/(1000*60*60*24)); return d>=0&&d<=30; }).length,
    byRole:    ROLES.map(r=>({ role:r, count:users.filter(u=>u.role===r).length })),
    topAgents: [...users].map(u=>({ ...u, won:userWon(u.id).length, acts:userActivities(u.id).length, active:userLeads(u.id).filter(l=>!["Closed Won","Closed Lost"].includes(l.stage)).length }))
                .sort((a,b)=>b.won-a.won).slice(0,5),
    recentJoins: [...users].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,5),
  };

  // ── STAT CARD ────────────────────────────────────────
  const SC = ({label,value,sub,accent,icon}) => (
    <div style={{ background:"#fff", border:"1px solid #E2E8F0", borderRadius:12, padding:"1rem 1.25rem", borderTop:`3px solid ${accent}`, display:"flex", alignItems:"flex-start", gap:12 }}>
      <div style={{ fontSize:24 }}>{icon}</div>
      <div>
        <div style={{ fontSize:10, color:"#A0AEC0", textTransform:"uppercase", letterSpacing:"0.7px", fontWeight:600, marginBottom:4 }}>{label}</div>
        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:26, fontWeight:700, color:"#0B1F3A", lineHeight:1 }}>{value}</div>
        {sub&&<div style={{ fontSize:12, color:"#718096", marginTop:4 }}>{sub}</div>}
      </div>
    </div>
  );

  // ── SUB-TAB PILLS ────────────────────────────────────
  const SubTabs = () => (
    <div style={{ display:"flex", gap:6, marginBottom:18 }}>
      {[["overview","⊞ Overview"],["users","👥 All Users"],["analytics","📊 Analytics"]].map(([id,label])=>(
        <button key={id} onClick={()=>setSubTab(id)}
          style={{ padding:"7px 16px", borderRadius:8, border:`1.5px solid ${subTab===id?"#0B1F3A":"#E2E8F0"}`, background:subTab===id?"#0B1F3A":"#fff", color:subTab===id?"#fff":"#4A5568", fontSize:13, fontWeight:subTab===id?600:400, cursor:"pointer", transition:"all 0.15s" }}>
          {label}
        </button>
      ))}
    </div>
  );

  // ════════════════════════════════════════════════════
  // OVERVIEW TAB
  // ════════════════════════════════════════════════════
  const OverviewTab = () => (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
        <SC label="Total Users"   value={analytics.total}    sub="all registered"          accent="#0B1F3A" icon="👥"/>
        <SC label="Active Users"  value={analytics.active}   sub="can log in now"           accent="#1A7F5A" icon="✅"/>
        <SC label="Inactive"      value={analytics.inactive} sub="deactivated or expired"   accent="#B83232" icon="🚫"/>
        <SC label="Expiring Soon" value={analytics.expiring} sub="within 30 days"           accent="#A06810" icon="⏳"/>
      </div>

      {/* Role breakdown */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
        <div style={{ background:"#fff", border:"1px solid #E2E8F0", borderRadius:12, padding:"1.125rem" }}>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:15, fontWeight:700, color:"#0B1F3A", marginBottom:14 }}>Users by Role</div>
          {analytics.byRole.map(({role,count})=>{
            const m=ROLE_META[role]; const pct=analytics.total?Math.round(count/analytics.total*100):0;
            return (
              <div key={role} style={{ marginBottom:12 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <RoleBadge role={role}/>
                    <span style={{ fontSize:12, color:"#4A5568" }}>{m.desc}</span>
                  </div>
                  <span style={{ fontSize:13, fontWeight:700, color:"#0B1F3A" }}>{count}</span>
                </div>
                <div style={{ height:6, background:"#F0F2F5", borderRadius:4, overflow:"hidden" }}>
                  <div style={{ width:`${pct}%`, height:"100%", background:m.color, borderRadius:4, transition:"width 0.5s" }}/>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ background:"#fff", border:"1px solid #E2E8F0", borderRadius:12, padding:"1.125rem" }}>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:15, fontWeight:700, color:"#0B1F3A", marginBottom:14 }}>Recently Joined</div>
          {analytics.recentJoins.map((u,i)=>{
            const st=getStatusLabel(u);
            return (
              <div key={u.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderBottom:i<analytics.recentJoins.length-1?"1px solid #F0F2F5":"none" }}>
                <Av name={u.full_name||u.email} size={32} bg={u.is_active?"#0B1F3A":"#A0AEC0"}/>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:"#0B1F3A", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{u.full_name}</div>
                  <div style={{ fontSize:11, color:"#A0AEC0" }}>{fmtDate(u.created_at)}</div>
                </div>
                <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                  <RoleBadge role={u.role}/>
                  <span style={{ fontSize:11, fontWeight:600, padding:"3px 8px", borderRadius:20, background:st.bg, color:st.c }}>{st.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Expiring accounts */}
      {analytics.expiring>0 && (
        <div style={{ background:"#FDF3DC", border:"1.5px solid #E8C97A", borderRadius:12, padding:"1rem 1.25rem" }}>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:14, fontWeight:700, color:"#8A6200", marginBottom:10 }}>⏳ Accounts Expiring Within 30 Days</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
            {users.filter(u=>{ if(!u.end_date||!u.is_active) return false; const d=Math.ceil((new Date(u.end_date)-new Date())/(1000*60*60*24)); return d>=0&&d<=30; }).map(u=>(
              <div key={u.id} style={{ background:"#fff", border:"1px solid #E8C97A", borderRadius:8, padding:"8px 12px", display:"flex", alignItems:"center", gap:8 }}>
                <Av name={u.full_name} size={26}/>
                <div>
                  <div style={{ fontSize:12, fontWeight:600, color:"#0B1F3A" }}>{u.full_name}</div>
                  <div style={{ fontSize:11, color:"#A06810" }}>Expires {fmtDate(u.end_date)}</div>
                </div>
                <Btn small variant="outline" onClick={()=>{ openEdit(u); setEditUser(u); }}>Extend</Btn>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // ════════════════════════════════════════════════════
  // ALL USERS TAB
  // ════════════════════════════════════════════════════
  const UsersTab = () => (
    <div style={{ display:"flex", gap:14, height:"100%" }}>
      {/* Table */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0 }}>
        {/* Toolbar */}
        <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap" }}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍  Search name, email, department…" style={{ flex:1, minWidth:180 }}/>
          <select value={fRole} onChange={e=>setFRole(e.target.value)} style={{ width:"auto" }}>
            <option value="All">All roles</option>{ROLES.map(r=><option key={r} value={r}>{ROLE_META[r].label}</option>)}
          </select>
          <select value={fStatus} onChange={e=>setFStatus(e.target.value)} style={{ width:"auto" }}>
            <option value="All">All statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive / Expired</option>
            <option value="Expiring">Expiring Soon</option>
          </select>
          <Btn onClick={()=>{ setForm(blank); setShowAdd(true); }}>+ Add User</Btn>
        </div>
        <div style={{ fontSize:12, color:"#A0AEC0", marginBottom:10 }}>{filtered.length} user{filtered.length!==1?"s":""}</div>

        {loading ? <Spinner/> : (
          <div style={{ flex:1, overflowY:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead style={{ position:"sticky", top:0, zIndex:2 }}>
                <tr style={{ background:"#0B1F3A" }}>
                  {["User","Role","Status","Department","End Date","Leads","Actions"].map(h=>(
                    <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontSize:11, fontWeight:600, color:"#C9A84C", textTransform:"uppercase", letterSpacing:"0.5px", whiteSpace:"nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((u,i)=>{
                  const st=getStatusLabel(u);
                  const ul=userLeads(u.id).length;
                  const uw=userWon(u.id).length;
                  return (
                    <tr key={u.id} style={{ background:i%2===0?"#fff":"#FAFBFC", borderBottom:"1px solid #F0F2F5", cursor:"pointer" }}
                      onClick={()=>setViewUser(viewUser?.id===u.id?null:u)}>
                      <td style={{ padding:"12px 14px" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                          <Av name={u.full_name||u.email} size={34} bg={u.is_active&&!isExpired(u)?"#0B1F3A":"#A0AEC0"}/>
                          <div>
                            <div style={{ fontSize:13, fontWeight:600, color:"#0B1F3A" }}>{u.full_name||"—"}</div>
                            <div style={{ fontSize:11, color:"#A0AEC0" }}>{u.email}</div>
                            {u.id===currentUser.id&&<div style={{ fontSize:10, color:"#C9A84C", fontWeight:700 }}>YOU</div>}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding:"12px 14px" }}><RoleBadge role={u.role}/></td>
                      <td style={{ padding:"12px 14px" }}>
                        <span style={{ fontSize:11, fontWeight:600, padding:"3px 9px", borderRadius:20, background:st.bg, color:st.c, whiteSpace:"nowrap" }}>{st.label}</span>
                      </td>
                      <td style={{ padding:"12px 14px", fontSize:13, color:"#4A5568" }}>{u.department||"—"}</td>
                      <td style={{ padding:"12px 14px", fontSize:12, color: isExpired(u)?"#B83232":u.end_date?"#A06810":"#A0AEC0", fontWeight:u.end_date?600:400 }}>
                        {u.end_date ? fmtDate(u.end_date) : "No end date"}
                      </td>
                      <td style={{ padding:"12px 14px" }}>
                        <div style={{ fontSize:12, color:"#0B1F3A", fontWeight:600 }}>{ul} leads</div>
                        <div style={{ fontSize:11, color:"#1A7F5A" }}>{uw} won</div>
                      </td>
                      <td style={{ padding:"12px 14px" }} onClick={e=>e.stopPropagation()}>
                        <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                          <Btn small variant="outline" onClick={()=>{ openEdit(u); }}>Edit</Btn>
                          {u.id!==currentUser.id&&(
                            <Btn small variant={u.is_active&&!isExpired(u)?"danger":"green"} onClick={()=>toggleActive(u)}>
                              {u.is_active&&!isExpired(u)?"Deactivate":"Activate"}
                            </Btn>
                          )}
                          {u.id!==currentUser.id&&(
                            <Btn small variant="danger" onClick={()=>setDelConfirm(u)}>Delete</Btn>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length===0&&<Empty icon="👥" msg="No users match your filters"/>}
          </div>
        )}
      </div>

      {/* User detail side panel */}
      {viewUser && (()=>{
        const u=viewUser; const st=getStatusLabel(u);
        const ul=userLeads(u.id); const uw=userWon(u.id); const ua=userActivities(u.id);
        return (
          <div className="slide-in" style={{ width:280, background:"#fff", border:"1px solid #E2E8F0", borderRadius:12, flexShrink:0, overflow:"hidden", display:"flex", flexDirection:"column" }}>
            <div style={{ background:"#0B1F3A", padding:"1.25rem", position:"relative" }}>
              <button onClick={()=>setViewUser(null)} style={{ position:"absolute", top:10, right:12, background:"none", border:"none", color:"#C9A84C", fontSize:20, cursor:"pointer" }}>×</button>
              <Av name={u.full_name||u.email} size={48} bg="#C9A84C" tc="#0B1F3A"/>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:16, color:"#fff", fontWeight:700, marginTop:10 }}>{u.full_name}</div>
              <div style={{ fontSize:12, color:"#C9A84C", marginTop:2 }}>{u.email}</div>
              {u.phone&&<div style={{ fontSize:12, color:"#C9A84C88", marginTop:1 }}>{u.phone}</div>}
            </div>
            <div style={{ flex:1, overflowY:"auto", padding:"1rem" }}>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:14 }}>
                <RoleBadge role={u.role}/>
                <span style={{ fontSize:11, fontWeight:600, padding:"3px 9px", borderRadius:20, background:st.bg, color:st.c }}>{st.label}</span>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, background:"#FAFBFC", borderRadius:10, padding:"10px", marginBottom:12 }}>
                {[["Department",u.department||"—"],["Joined",fmtDate(u.created_at)],["End Date",u.end_date?fmtDate(u.end_date):"None"],["Last Login",fmtDate(u.last_sign_in_at)]].map(([l,v])=>(
                  <div key={l}><div style={{ fontSize:10, color:"#A0AEC0", textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:2 }}>{l}</div><div style={{ fontSize:12, fontWeight:600, color:"#0B1F3A" }}>{v}</div></div>
                ))}
              </div>
              {/* Performance */}
              <div style={{ background:"#F7F9FC", borderRadius:10, padding:"10px 12px", marginBottom:12 }}>
                <div style={{ fontSize:10, color:"#A0AEC0", textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:10, fontWeight:600 }}>Performance</div>
                {[["Total Leads Assigned",ul.length,"#0B1F3A"],["Deals Won",uw.length,"#1A7F5A"],["Activities Logged",ua.length,"#1A5FA8"],["Active Pipeline",ul.filter(l=>!["Closed Won","Closed Lost"].includes(l.stage)).length,"#A06810"]].map(([l,v,c])=>(
                  <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"5px 0", borderBottom:"1px solid #F0F2F5" }}>
                    <span style={{ fontSize:12, color:"#4A5568" }}>{l}</span>
                    <span style={{ fontSize:13, fontWeight:700, color:c }}>{v}</span>
                  </div>
                ))}
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
                <Btn full onClick={()=>openEdit(u)}>Edit User</Btn>
                {u.id!==currentUser.id&&<Btn full variant={u.is_active?"danger":"green"} onClick={()=>toggleActive(u)}>{u.is_active?"Deactivate":"Reactivate"}</Btn>}
                {u.id!==currentUser.id&&<Btn full variant="danger" onClick={()=>setDelConfirm(u)}>Delete User</Btn>}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );

  // ════════════════════════════════════════════════════
  // ANALYTICS TAB
  // ════════════════════════════════════════════════════
  const AnalyticsTab = () => {
    const maxWon = Math.max(...analytics.topAgents.map(a=>a.won),1);
    const roleColors = { admin:"#8A6200", manager:"#1A5FA8", agent:"#1A7F5A", viewer:"#718096" };
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:16, overflowY:"auto", paddingRight:4 }}>
        {/* Top performers */}
        <div style={{ background:"#fff", border:"1px solid #E2E8F0", borderRadius:12, padding:"1.25rem" }}>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:15, fontWeight:700, color:"#0B1F3A", marginBottom:16 }}>🏆 Top Performers by Deals Won</div>
          {analytics.topAgents.length===0&&<Empty icon="📊" msg="No data yet — assign leads to agents"/>}
          {analytics.topAgents.map((a,i)=>(
            <div key={a.id} style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12, padding:"10px 12px", background:i===0?"#FDF3DC":"#FAFBFC", borderRadius:10, border:`1px solid ${i===0?"#E8C97A":"#F0F2F5"}` }}>
              <div style={{ width:28, height:28, borderRadius:"50%", background:i===0?"#C9A84C":i===1?"#A0AEC0":"#CD7F32", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, color:"#fff", flexShrink:0 }}>{i+1}</div>
              <Av name={a.full_name} size={36}/>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:600, color:"#0B1F3A" }}>{a.full_name}</div>
                <div style={{ display:"flex", gap:6, marginTop:4 }}><RoleBadge role={a.role}/><span style={{ fontSize:11, color:"#A0AEC0" }}>{a.acts} activities</span></div>
              </div>
              <div style={{ textAlign:"right", flexShrink:0 }}>
                <div style={{ fontSize:20, fontWeight:700, color:"#1A7F5A", fontFamily:"'Playfair Display',serif" }}>{a.won}</div>
                <div style={{ fontSize:11, color:"#A0AEC0" }}>deals won</div>
              </div>
              <div style={{ width:100 }}>
                <div style={{ height:6, background:"#F0F2F5", borderRadius:4, overflow:"hidden" }}>
                  <div style={{ width:`${Math.round(a.won/maxWon*100)}%`, height:"100%", background:"#1A7F5A", borderRadius:4 }}/>
                </div>
                <div style={{ fontSize:10, color:"#A0AEC0", marginTop:3 }}>{a.active} active leads</div>
              </div>
            </div>
          ))}
        </div>

        {/* Role distribution */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
          <div style={{ background:"#fff", border:"1px solid #E2E8F0", borderRadius:12, padding:"1.25rem" }}>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:14, fontWeight:700, color:"#0B1F3A", marginBottom:14 }}>Role Distribution</div>
            {analytics.byRole.map(({role,count})=>{
              const pct = analytics.total ? Math.round(count/analytics.total*100) : 0;
              const m = ROLE_META[role];
              return (
                <div key={role} style={{ marginBottom:12 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}><RoleBadge role={role}/></div>
                    <span style={{ fontSize:12, color:"#4A5568" }}>{count} user{count!==1?"s":""} · {pct}%</span>
                  </div>
                  <div style={{ height:8, background:"#F0F2F5", borderRadius:4, overflow:"hidden" }}>
                    <div style={{ width:`${pct}%`, height:"100%", background:m.color, borderRadius:4, transition:"width 0.5s" }}/>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ background:"#fff", border:"1px solid #E2E8F0", borderRadius:12, padding:"1.25rem" }}>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:14, fontWeight:700, color:"#0B1F3A", marginBottom:14 }}>Account Health</div>
            {[
              ["Active accounts",     analytics.active,                    "#1A7F5A","#E6F4EE"],
              ["Inactive / Expired",  analytics.inactive,                  "#B83232","#FAEAEA"],
              ["Expiring within 30d", analytics.expiring,                  "#A06810","#FDF3DC"],
              ["No end date set",     users.filter(u=>!u.end_date).length, "#1A5FA8","#E6EFF9"],
            ].map(([l,v,c,bg])=>(
              <div key={l} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 12px", background:bg, borderRadius:8, marginBottom:8 }}>
                <span style={{ fontSize:13, color:"#4A5568" }}>{l}</span>
                <span style={{ fontSize:18, fontWeight:700, color:c, fontFamily:"'Playfair Display',serif" }}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Full user activity table */}
        <div style={{ background:"#fff", border:"1px solid #E2E8F0", borderRadius:12, padding:"1.25rem" }}>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:14, fontWeight:700, color:"#0B1F3A", marginBottom:14 }}>All Users — Activity Summary</div>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ background:"#0B1F3A" }}>
                {["User","Role","Leads","Won","Lost","Activities","Status"].map(h=>(
                  <th key={h} style={{ padding:"8px 12px", textAlign:"left", fontSize:11, fontWeight:600, color:"#C9A84C", textTransform:"uppercase", letterSpacing:"0.5px" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...users].sort((a,b)=>userWon(b.id).length-userWon(a.id).length).map((u,i)=>{
                const ul2=userLeads(u.id); const st=getStatusLabel(u);
                return (
                  <tr key={u.id} style={{ background:i%2===0?"#fff":"#FAFBFC", borderBottom:"1px solid #F0F2F5" }}>
                    <td style={{ padding:"10px 12px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <Av name={u.full_name||u.email} size={28} bg={u.is_active?"#0B1F3A":"#A0AEC0"}/>
                        <div>
                          <div style={{ fontSize:12, fontWeight:600, color:"#0B1F3A" }}>{u.full_name}</div>
                          <div style={{ fontSize:11, color:"#A0AEC0" }}>{u.department||u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding:"10px 12px" }}><RoleBadge role={u.role}/></td>
                    <td style={{ padding:"10px 12px", fontSize:13, fontWeight:600, color:"#0B1F3A" }}>{ul2.length}</td>
                    <td style={{ padding:"10px 12px", fontSize:13, fontWeight:700, color:"#1A7F5A" }}>{userWon(u.id).length}</td>
                    <td style={{ padding:"10px 12px", fontSize:13, color:"#B83232" }}>{ul2.filter(l=>l.stage==="Closed Lost").length}</td>
                    <td style={{ padding:"10px 12px", fontSize:13, color:"#1A5FA8" }}>{userActivities(u.id).length}</td>
                    <td style={{ padding:"10px 12px" }}><span style={{ fontSize:11, fontWeight:600, padding:"3px 8px", borderRadius:20, background:st.bg, color:st.c }}>{st.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="fade-in" style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      <SubTabs/>
      {subTab==="overview"  && <div style={{ flex:1, overflowY:"auto", paddingRight:4 }}><OverviewTab/></div>}
      {subTab==="users"     && <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column" }}><UsersTab/></div>}
      {subTab==="analytics" && <div style={{ flex:1, overflow:"hidden" }}><AnalyticsTab/></div>}

      {/* ADD USER MODAL */}
      {showAdd && (
        <Modal title="Add New User" onClose={()=>setShowAdd(false)} width={560}>
          <div style={{ background:"#E6EFF9", borderRadius:8, padding:"10px 14px", marginBottom:16, fontSize:13, color:"#1A5FA8" }}>
            ℹ A confirmation email will be sent. The user must verify their email before logging in.
          </div>
          <G2>
            <FF label="Full Name" required><input value={form.full_name} onChange={e=>setForm(f=>({...f,full_name:e.target.value}))} placeholder="Sara Khalid"/></FF>
            <FF label="Department"><input value={form.department} onChange={e=>setForm(f=>({...f,department:e.target.value}))} placeholder="Sales / Leasing / Admin"/></FF>
          </G2>
          <FF label="Email Address" required><input type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="sara@company.com"/></FF>
          <G2>
            <FF label="Temporary Password" required>
              <PwInput value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} placeholder="Min 8 characters"/>
            </FF>
            <FF label="Phone"><input value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} placeholder="+971 50 000 0000"/></FF>
          </G2>
          <G2>
            <FF label="Role" required>
              <select value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}>
                {ROLES.map(r=><option key={r} value={r}>{ROLE_META[r].label} — {ROLE_META[r].desc}</option>)}
              </select>
            </FF>
            <FF label="Account Status">
              <select value={form.is_active} onChange={e=>setForm(f=>({...f,is_active:e.target.value==="true"}))}>
                <option value="true">Active — can log in immediately</option>
                <option value="false">Inactive — cannot log in yet</option>
              </select>
            </FF>
          </G2>
          <FF label="Access End Date (optional)">
            <input type="date" value={form.end_date} onChange={e=>setForm(f=>({...f,end_date:e.target.value}))}/>
            <div style={{ fontSize:11, color:"#A0AEC0", marginTop:4 }}>Leave blank for permanent access. Set a date for contract/temporary staff.</div>
          </FF>
          <div style={{ background:"#F7F9FC", border:"1px solid #E2E8F0", borderRadius:8, padding:"10px 14px", marginBottom:14, fontSize:12, color:"#4A5568", lineHeight:1.7 }}>
            <strong>Admin</strong> — full access + user management &nbsp;|&nbsp;
            <strong>Manager</strong> — all leads, no user settings &nbsp;|&nbsp;
            <strong>Agent</strong> — own leads only &nbsp;|&nbsp;
            <strong>Viewer</strong> — read only
          </div>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
            <Btn variant="outline" onClick={()=>setShowAdd(false)}>Cancel</Btn>
            <Btn onClick={createUser}>Create User</Btn>
          </div>
        </Modal>
      )}

      {/* EDIT USER MODAL */}
      {editUser && (
        <Modal title={`Edit User — ${editUser.full_name}`} onClose={()=>setEditUser(null)} width={540}>
          <G2>
            <FF label="Full Name" required><input value={form.full_name} onChange={e=>setForm(f=>({...f,full_name:e.target.value}))} placeholder="Full name"/></FF>
            <FF label="Department"><input value={form.department} onChange={e=>setForm(f=>({...f,department:e.target.value}))} placeholder="Sales / Admin…"/></FF>
          </G2>
          <FF label="Phone"><input value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} placeholder="+971 50 000 0000"/></FF>
          <G2>
            <FF label="Role">
              <select value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}>
                {ROLES.map(r=><option key={r} value={r}>{ROLE_META[r].label}</option>)}
              </select>
            </FF>
            <FF label="Account Status">
              <select value={form.is_active} onChange={e=>setForm(f=>({...f,is_active:e.target.value==="true"}))}>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </FF>
          </G2>
          <FF label="Access End Date">
            <input type="date" value={form.end_date} onChange={e=>setForm(f=>({...f,end_date:e.target.value}))}/>
            <div style={{ fontSize:11, color:"#A0AEC0", marginTop:4 }}>Clear the date to give permanent access.</div>
          </FF>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
            <Btn variant="outline" onClick={()=>setEditUser(null)}>Cancel</Btn>
            <Btn onClick={saveEdit}>Save Changes</Btn>
          </div>
        </Modal>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {delConfirm && (
        <Modal title="Delete User" onClose={()=>setDelConfirm(null)} width={420}>
          <div style={{ textAlign:"center", padding:"1rem 0" }}>
            <div style={{ fontSize:48, marginBottom:12 }}>⚠️</div>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:18, fontWeight:700, color:"#0B1F3A", marginBottom:10 }}>Delete {delConfirm.full_name}?</div>
            <div style={{ fontSize:13, color:"#4A5568", lineHeight:1.7, marginBottom:20 }}>
              This will permanently remove the user account. Their leads and activities will remain but will show as "Unassigned". This action <strong>cannot be undone</strong>.
            </div>
            <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
              <Btn variant="outline" onClick={()=>setDelConfirm(null)}>Cancel — Keep User</Btn>
              <Btn variant="danger" onClick={()=>deleteUser(delConfirm)}>Yes, Delete Permanently</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════
// STAGE VALIDATION HELPER
// ═══════════════════════════════════════════════════════
const validateStageMove = (lead, toStage) => {
  const rules = STAGE_RULES[toStage];
  if (!rules) return { ok:true, errors:[] };
  const errors = [];
  rules.requires.forEach(field => {
    if (field==="phone"         && !lead.phone)            errors.push("Phone number is required");
    if (field==="email"         && !lead.email)            errors.push("Email address is required");
    if (field==="meeting_scheduled" && !lead.meeting_scheduled) errors.push("A meeting must be scheduled before Site Visit");
    if (field==="unit_id"       && !lead.unit_id)          errors.push("A specific unit must be linked");
    if (field==="budget_confirmed" && !lead.budget_confirmed)   errors.push("Budget must be confirmed");
    if (field==="proposal_notes" && !lead.proposal_notes)  errors.push("Proposal notes are required");
    if (field==="final_price"   && !lead.final_price)      errors.push("Final agreed price is required");
    if (field==="payment_plan_agreed" && !lead.payment_plan_agreed) errors.push("Payment plan must be agreed and noted");
  });
  return { ok: errors.length===0, errors };
};

// ═══════════════════════════════════════════════════════
// PROPERTY MASTER DATABASE
// Projects → Categories → Buildings → Units
// ═══════════════════════════════════════════════════════
function PropertyMaster({ currentUser, showToast }) {
  const [projects,   setProjects]   = useState([]);
  const [categories, setCategories] = useState([]);
  const [buildings,  setBuildings]  = useState([]);
  const [units,      setUnits]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [selProject, setSelProject] = useState(null);
  const [selCat,     setSelCat]     = useState(null);
  const [selBuilding,setSelBuilding]= useState(null);
  const [selUnit,    setSelUnit]    = useState(null);
  const [view,       setView]       = useState("projects"); // projects|units
  const [showAddProject,  setShowAddProject]  = useState(false);
  const [showAddCat,      setShowAddCat]      = useState(false);
  const [showAddBuilding, setShowAddBuilding] = useState(false);
  const [showAddUnit,     setShowAddUnit]     = useState(false);
  const [editUnit,        setEditUnit]        = useState(null);
  const canEdit = can(currentUser.role,"write");
  const canDel  = can(currentUser.role,"delete");

  const pBlank  = { name:"",developer:"",location:"",description:"",status:"Active",launch_date:"",completion_date:"",website:"" };
  const cBlank  = { name:"",type:"Flats",description:"" };
  const bBlank  = { name:"",floors:"",total_units:"",amenities:"" };
  const uBlank  = { unit_number:"",floor_number:"",view:"",classification:"Flat",size_sqft:"",size_sqm:"",bedrooms:"",bathrooms:"",parking_spaces:"0",base_price:"",price_per_sqft:"",service_charge_sqft:"",gross_yield:"",net_yield:"",booking_pct:"10",construction_pct:"40",handover_pct:"50",post_handover_pct:"0",post_handover_years:"0",payment_plan_notes:"",status:"Available",handover_date:"",furnishing:"Unfurnished",condition:"Off-plan",notes:"" };
  const [pForm, setPForm] = useState(pBlank);
  const [cForm, setCForm] = useState(cBlank);
  const [bForm, setBForm] = useState(bBlank);
  const [uForm, setUForm] = useState(uBlank);

  const load = useCallback(async () => {
    setLoading(true);
    const [p,c,b,u] = await Promise.all([
      supabase.from("projects").select("*").order("created_at",{ascending:false}),
      supabase.from("categories").select("*"),
      supabase.from("buildings").select("*"),
      supabase.from("units").select("*").order("unit_number"),
    ]);
    setProjects(p.data||[]); setCategories(c.data||[]);
    setBuildings(b.data||[]); setUnits(u.data||[]);
    setLoading(false);
  },[]);
  useEffect(()=>{ load(); },[load]);

  const saveProject = async () => {
    if (!pForm.name.trim()) { showToast("Project name required","error"); return; }
    const { data, error } = await supabase.from("projects").insert({ ...pForm, created_by:currentUser.id, launch_date:pForm.launch_date||null, completion_date:pForm.completion_date||null }).select().single();
    if (error) { showToast(error.message,"error"); return; }
    setProjects(p=>[data,...p]); showToast("Project created","success"); setShowAddProject(false); setPForm(pBlank);
  };
  const saveCat = async () => {
    if (!cForm.name.trim()||!selProject) return;
    const { data, error } = await supabase.from("categories").insert({ ...cForm, project_id:selProject.id }).select().single();
    if (error) { showToast(error.message,"error"); return; }
    setCategories(p=>[data,...p]); showToast("Category created","success"); setShowAddCat(false); setCForm(cBlank);
  };
  const saveBuilding = async () => {
    if (!bForm.name.trim()||!selCat) return;
    const { data, error } = await supabase.from("buildings").insert({ ...bForm, category_id:selCat.id, project_id:selProject.id, floors:Number(bForm.floors)||null, total_units:Number(bForm.total_units)||null }).select().single();
    if (error) { showToast(error.message,"error"); return; }
    setBuildings(p=>[data,...p]); showToast("Building created","success"); setShowAddBuilding(false); setBForm(bBlank);
  };
  const saveUnit = async (editing=false) => {
    if (!uForm.unit_number.trim()||!selBuilding) { showToast("Unit number required","error"); return; }
    const payload = { ...uForm, building_id:selBuilding.id, category_id:selCat.id, project_id:selProject.id,
      floor_number:Number(uForm.floor_number)||null, size_sqft:Number(uForm.size_sqft)||null, size_sqm:Number(uForm.size_sqm)||null,
      bedrooms:Number(uForm.bedrooms)||null, bathrooms:Number(uForm.bathrooms)||null, parking_spaces:Number(uForm.parking_spaces)||0,
      base_price:Number(uForm.base_price)||null, price_per_sqft:Number(uForm.price_per_sqft)||null,
      service_charge_sqft:Number(uForm.service_charge_sqft)||null, gross_yield:Number(uForm.gross_yield)||null,
      net_yield:Number(uForm.net_yield)||null, booking_pct:Number(uForm.booking_pct)||10,
      construction_pct:Number(uForm.construction_pct)||40, handover_pct:Number(uForm.handover_pct)||50,
      post_handover_pct:Number(uForm.post_handover_pct)||0, post_handover_years:Number(uForm.post_handover_years)||0,
      handover_date:uForm.handover_date||null, created_by:currentUser.id };
    if (editing) {
      const { data, error } = await supabase.from("units").update(payload).eq("id",editUnit.id).select().single();
      if (error) { showToast(error.message,"error"); return; }
      setUnits(p=>p.map(u=>u.id===editUnit.id?data:u)); showToast("Unit updated","success"); setEditUnit(null);
    } else {
      const { data, error } = await supabase.from("units").insert(payload).select().single();
      if (error) { showToast(error.message,"error"); return; }
      setUnits(p=>[data,...p]); showToast("Unit added","success"); setShowAddUnit(false); setUForm(uBlank);
    }
  };
  const delUnit = async (id) => {
    if (!canDel||!window.confirm("Delete this unit?")) return;
    await supabase.from("units").delete().eq("id",id);
    setUnits(p=>p.filter(u=>u.id!==id)); setSelUnit(null); showToast("Unit deleted","info");
  };
  const delProject = async (id) => {
    if (!canDel||!window.confirm("Delete this project and ALL categories, buildings and units within it? This cannot be undone.")) return;
    await supabase.from("projects").delete().eq("id",id);
    setProjects(p=>p.filter(x=>x.id!==id)); setSelProject(null); showToast("Project deleted","info"); load();
  };

  const projCats  = selProject ? categories.filter(c=>c.project_id===selProject.id) : [];
  const catBuilds = selCat ? buildings.filter(b=>b.category_id===selCat.id) : [];
  const buildUnits= selBuilding ? units.filter(u=>u.building_id===selBuilding.id) : [];

  const UNIT_STATUS_COLOR = { Available:{c:"#1A7F5A",bg:"#E6F4EE"}, Reserved:{c:"#A06810",bg:"#FDF3DC"}, "Under Offer":{c:"#B85C10",bg:"#FDF0E6"}, Sold:{c:"#B83232",bg:"#FAEAEA"}, Blocked:{c:"#718096",bg:"#F0F2F5"} };

  if (loading) return <Spinner msg="Loading property database…"/>;

  return (
    <div className="fade-in" style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      {/* Sub-nav */}
      <div style={{ display:"flex", gap:6, marginBottom:14, alignItems:"center" }}>
        <div style={{ display:"flex", gap:4 }}>
          {[["projects","📁 Projects"],["units","🏠 Units"]].map(([id,label])=>(
            <button key={id} onClick={()=>setView(id)}
              style={{ padding:"7px 16px", borderRadius:8, border:`1.5px solid ${view===id?"#0B1F3A":"#E2E8F0"}`, background:view===id?"#0B1F3A":"#fff", color:view===id?"#fff":"#4A5568", fontSize:13, fontWeight:view===id?600:400, cursor:"pointer" }}>
              {label}
            </button>
          ))}
        </div>
        <div style={{ marginLeft:"auto", display:"flex", gap:8 }}>
          <span style={{ fontSize:12, color:"#A0AEC0" }}>{projects.length} projects · {units.length} units</span>
          {canEdit && <Btn onClick={()=>setShowAddProject(true)}>+ New Project</Btn>}
        </div>
      </div>

      {/* ── PROJECTS VIEW ─────────────────────────────── */}
      {view==="projects" && (
        <div style={{ display:"flex", gap:14, flex:1, overflow:"hidden" }}>
          {/* Project list */}
          <div style={{ width:220, flexShrink:0, display:"flex", flexDirection:"column", gap:6, overflowY:"auto" }}>
            <div style={{ fontSize:10, fontWeight:700, color:"#A0AEC0", textTransform:"uppercase", letterSpacing:"0.6px", marginBottom:4 }}>Projects</div>
            {projects.length===0 && <Empty icon="📁" msg="No projects yet"/>}
            {projects.map(p=>(
              <div key={p.id} onClick={()=>{ setSelProject(p); setSelCat(null); setSelBuilding(null); setSelUnit(null); }}
                style={{ padding:"10px 12px", borderRadius:10, border:`1.5px solid ${selProject?.id===p.id?"#C9A84C":"#E2E8F0"}`, background:selProject?.id===p.id?"#0B1F3A":"#fff", cursor:"pointer" }}>
                <div style={{ fontSize:13, fontWeight:600, color:selProject?.id===p.id?"#fff":"#0B1F3A", marginBottom:3 }}>{p.name}</div>
                <div style={{ fontSize:11, color:selProject?.id===p.id?"#C9A84C88":"#A0AEC0" }}>{p.developer||"—"} · {p.location||"—"}</div>
                <div style={{ marginTop:5, display:"flex", gap:4 }}>
                  <span style={{ fontSize:10, fontWeight:600, padding:"2px 7px", borderRadius:20, background:p.status==="Active"?"#E6F4EE":p.status==="Completed"?"#E6EFF9":"#FDF3DC", color:p.status==="Active"?"#1A7F5A":p.status==="Completed"?"#1A5FA8":"#A06810" }}>{p.status}</span>
                  <span style={{ fontSize:10, color:selProject?.id===p.id?"#C9A84C55":"#A0AEC0" }}>{categories.filter(c=>c.project_id===p.id).length} cats</span>
                </div>
              </div>
            ))}
          </div>

          {/* Categories */}
          {selProject && (
            <div style={{ width:190, flexShrink:0, display:"flex", flexDirection:"column", gap:0, overflowY:"auto" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                <div style={{ fontSize:10, fontWeight:700, color:"#A0AEC0", textTransform:"uppercase", letterSpacing:"0.6px" }}>Categories</div>
                {canEdit && <button onClick={()=>setShowAddCat(true)} style={{ fontSize:11, background:"none", border:"none", color:"#C9A84C", fontWeight:600, cursor:"pointer" }}>+ Add</button>}
              </div>
              {projCats.length===0 && <div style={{ fontSize:12, color:"#A0AEC0", textAlign:"center", padding:"1rem" }}>No categories</div>}
              {projCats.map(c=>(
                <div key={c.id} onClick={()=>{ setSelCat(c); setSelBuilding(null); setSelUnit(null); }}
                  style={{ padding:"9px 12px", borderRadius:8, border:`1px solid ${selCat?.id===c.id?"#C9A84C":"#E2E8F0"}`, background:selCat?.id===c.id?"#FDF8EC":"#fff", cursor:"pointer", marginBottom:5 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:"#0B1F3A" }}>{c.name}</div>
                  <div style={{ fontSize:11, color:"#A0AEC0" }}>{c.type} · {buildings.filter(b=>b.category_id===c.id).length} buildings</div>
                </div>
              ))}
            </div>
          )}

          {/* Buildings */}
          {selCat && (
            <div style={{ width:190, flexShrink:0, display:"flex", flexDirection:"column", overflowY:"auto" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                <div style={{ fontSize:10, fontWeight:700, color:"#A0AEC0", textTransform:"uppercase", letterSpacing:"0.6px" }}>Buildings</div>
                {canEdit && <button onClick={()=>setShowAddBuilding(true)} style={{ fontSize:11, background:"none", border:"none", color:"#C9A84C", fontWeight:600, cursor:"pointer" }}>+ Add</button>}
              </div>
              {catBuilds.length===0 && <div style={{ fontSize:12, color:"#A0AEC0", textAlign:"center", padding:"1rem" }}>No buildings</div>}
              {catBuilds.map(b=>(
                <div key={b.id} onClick={()=>{ setSelBuilding(b); setSelUnit(null); }}
                  style={{ padding:"9px 12px", borderRadius:8, border:`1px solid ${selBuilding?.id===b.id?"#C9A84C":"#E2E8F0"}`, background:selBuilding?.id===b.id?"#FDF8EC":"#fff", cursor:"pointer", marginBottom:5 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:"#0B1F3A" }}>{b.name}</div>
                  <div style={{ fontSize:11, color:"#A0AEC0" }}>{b.floors||"?"} floors · {units.filter(u=>u.building_id===b.id).length} units</div>
                </div>
              ))}
            </div>
          )}

          {/* Units */}
          {selBuilding && (
            <div style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                <div style={{ fontSize:10, fontWeight:700, color:"#A0AEC0", textTransform:"uppercase", letterSpacing:"0.6px" }}>{buildUnits.length} Units in {selBuilding.name}</div>
                <div style={{ display:"flex", gap:8 }}>
                  {canDel && <Btn small variant="danger" onClick={()=>delProject(selProject.id)}>Delete Project</Btn>}
                  {canEdit && <Btn small onClick={()=>{ setUForm(uBlank); setShowAddUnit(true); }}>+ Add Unit</Btn>}
                </div>
              </div>
              <div style={{ flex:1, overflowY:"auto", display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))", gap:10, alignContent:"start" }}>
                {buildUnits.length===0 && <Empty icon="🏠" msg="No units — add the first one"/>}
                {buildUnits.map(u=>{
                  const sc = UNIT_STATUS_COLOR[u.status]||{c:"#718096",bg:"#F0F2F5"};
                  return (
                    <div key={u.id} onClick={()=>setSelUnit(selUnit?.id===u.id?null:u)} className="ch"
                      style={{ background:selUnit?.id===u.id?"#0B1F3A":"#fff", border:`1.5px solid ${selUnit?.id===u.id?"#C9A84C":"#E2E8F0"}`, borderRadius:10, padding:"12px 14px", cursor:"pointer" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:16, fontWeight:700, color:selUnit?.id===u.id?"#C9A84C":"#0B1F3A" }}>#{u.unit_number}</div>
                        <span style={{ fontSize:10, fontWeight:600, padding:"2px 8px", borderRadius:20, background:selUnit?.id===u.id?"rgba(255,255,255,0.1)":sc.bg, color:sc.c }}>{u.status}</span>
                      </div>
                      <div style={{ fontSize:12, color:selUnit?.id===u.id?"#C9A84C88":"#A0AEC0", marginBottom:6 }}>{u.classification}{u.bedrooms?` · ${u.bedrooms}BR`:""}{u.floor_number?` · Floor ${u.floor_number}`:""}</div>
                      {u.view && <div style={{ fontSize:11, color:selUnit?.id===u.id?"#C9A84C55":"#718096", marginBottom:6 }}>👁 {u.view}</div>}
                      <div style={{ fontFamily:"'Playfair Display',serif", fontSize:14, fontWeight:700, color:selUnit?.id===u.id?"#C9A84C":"#0B1F3A" }}>{u.base_price?fmtFull(u.base_price):"TBD"}</div>
                      {u.price_per_sqft && <div style={{ fontSize:11, color:selUnit?.id===u.id?"#C9A84C55":"#A0AEC0" }}>{fmtFull(u.price_per_sqft)}/sqft · {u.size_sqft?.toLocaleString()} sqft</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Unit detail panel */}
          {selUnit && (
            <div className="slide-in" style={{ width:300, background:"#fff", border:"1px solid #E2E8F0", borderRadius:12, flexShrink:0, overflow:"hidden", display:"flex", flexDirection:"column" }}>
              <div style={{ background:"#0B1F3A", padding:"1.25rem", position:"relative" }}>
                <button onClick={()=>setSelUnit(null)} style={{ position:"absolute", top:10, right:12, background:"none", border:"none", color:"#C9A84C", fontSize:20, cursor:"pointer" }}>×</button>
                <div style={{ fontFamily:"'Playfair Display',serif", fontSize:22, color:"#C9A84C", fontWeight:700 }}>Unit #{selUnit.unit_number}</div>
                <div style={{ fontSize:12, color:"rgba(255,255,255,0.7)", marginTop:4 }}>{selProject?.name} → {selCat?.name} → {selBuilding?.name}</div>
              </div>
              <div style={{ flex:1, overflowY:"auto", padding:"1rem" }}>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, background:"#FAFBFC", borderRadius:10, padding:"12px", marginBottom:12 }}>
                  <FR label="Classification" value={selUnit.classification}/>
                  <FR label="Floor"          value={selUnit.floor_number||"—"}/>
                  <FR label="View"           value={selUnit.view||"—"}/>
                  <FR label="Status"         value={selUnit.status}/>
                  <FR label="Bedrooms"       value={selUnit.bedrooms||"—"}/>
                  <FR label="Bathrooms"      value={selUnit.bathrooms||"—"}/>
                  <FR label="Size"           value={selUnit.size_sqft?`${selUnit.size_sqft?.toLocaleString()} sqft`:"—"}/>
                  <FR label="Parking"        value={selUnit.parking_spaces||0}/>
                  <FR label="Furnishing"     value={selUnit.furnishing}/>
                  <FR label="Condition"      value={selUnit.condition}/>
                </div>
                {/* Pricing */}
                <div style={{ background:"#FDF8EC", border:"1px solid #E8C97A", borderRadius:10, padding:"12px", marginBottom:12 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:"#A06810", textTransform:"uppercase", letterSpacing:"0.6px", marginBottom:10 }}>Pricing</div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                    <div><div style={{ fontSize:10, color:"#A0AEC0", textTransform:"uppercase", letterSpacing:"0.5px" }}>Base Price</div><div style={{ fontSize:14, fontWeight:700, color:"#0B1F3A", fontFamily:"'Playfair Display',serif" }}>{selUnit.base_price?fmtFull(selUnit.base_price):"TBD"}</div></div>
                    <div><div style={{ fontSize:10, color:"#A0AEC0", textTransform:"uppercase", letterSpacing:"0.5px" }}>Per Sqft</div><div style={{ fontSize:13, fontWeight:600, color:"#0B1F3A" }}>{selUnit.price_per_sqft?fmtFull(selUnit.price_per_sqft):"—"}</div></div>
                    <div><div style={{ fontSize:10, color:"#A0AEC0", textTransform:"uppercase", letterSpacing:"0.5px" }}>Gross Yield</div><div style={{ fontSize:13, fontWeight:600, color:"#1A7F5A" }}>{selUnit.gross_yield?`${selUnit.gross_yield}%`:"—"}</div></div>
                    <div><div style={{ fontSize:10, color:"#A0AEC0", textTransform:"uppercase", letterSpacing:"0.5px" }}>Svc Charge/sqft</div><div style={{ fontSize:13, fontWeight:600, color:"#0B1F3A" }}>{selUnit.service_charge_sqft?fmtFull(selUnit.service_charge_sqft):"—"}</div></div>
                  </div>
                </div>
                {/* Payment plan */}
                <div style={{ background:"#E6EFF9", border:"1px solid #B5D4F4", borderRadius:10, padding:"12px", marginBottom:12 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:"#1A5FA8", textTransform:"uppercase", letterSpacing:"0.6px", marginBottom:10 }}>Payment Plan</div>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                    {[["Booking",selUnit.booking_pct],["Construction",selUnit.construction_pct],["Handover",selUnit.handover_pct],["Post-Handover",selUnit.post_handover_pct]].map(([l,v])=>(
                      v>0 ? <div key={l} style={{ background:"#fff", border:"1px solid #B5D4F4", borderRadius:8, padding:"6px 10px", textAlign:"center" }}><div style={{ fontSize:10, color:"#1A5FA8" }}>{l}</div><div style={{ fontSize:14, fontWeight:700, color:"#0B1F3A" }}>{v}%</div></div> : null
                    ))}
                  </div>
                  {selUnit.post_handover_years>0 && <div style={{ fontSize:11, color:"#1A5FA8", marginTop:6 }}>Post-handover over {selUnit.post_handover_years} year{selUnit.post_handover_years!==1?"s":""}</div>}
                  {selUnit.payment_plan_notes && <div style={{ fontSize:12, color:"#4A5568", marginTop:6, lineHeight:1.5 }}>{selUnit.payment_plan_notes}</div>}
                </div>
                {selUnit.notes && <div style={{ fontSize:13, color:"#4A5568", lineHeight:1.6, marginBottom:12, padding:"10px", background:"#FAFBFC", borderRadius:8 }}>{selUnit.notes}</div>}
                {canEdit && (
                  <div style={{ display:"flex", gap:8 }}>
                    <Btn full onClick={()=>{ setEditUnit(selUnit); setUForm({...uBlank,...selUnit,floor_number:selUnit.floor_number||"",size_sqft:selUnit.size_sqft||"",size_sqm:selUnit.size_sqm||"",bedrooms:selUnit.bedrooms||"",bathrooms:selUnit.bathrooms||"",base_price:selUnit.base_price||"",price_per_sqft:selUnit.price_per_sqft||"",service_charge_sqft:selUnit.service_charge_sqft||"",gross_yield:selUnit.gross_yield||"",net_yield:selUnit.net_yield||"",handover_date:selUnit.handover_date||""}); }}>Edit Unit</Btn>
                    {canDel && <Btn variant="danger" small onClick={()=>delUnit(selUnit.id)}>Delete</Btn>}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── UNITS VIEW (flat table) ────────────────────── */}
      {view==="units" && (
        <div style={{ flex:1, overflowY:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead style={{ position:"sticky", top:0 }}>
              <tr style={{ background:"#0B1F3A" }}>
                {["Unit","Project","Category","Building","Type","Floor","View","Size","Base Price","Price/sqft","Yield","Status"].map(h=>(
                  <th key={h} style={{ padding:"9px 12px", textAlign:"left", fontSize:11, fontWeight:600, color:"#C9A84C", textTransform:"uppercase", letterSpacing:"0.5px", whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {units.map((u,i)=>{
                const proj = projects.find(p=>p.id===u.project_id);
                const cat  = categories.find(c=>c.id===u.category_id);
                const bld  = buildings.find(b=>b.id===u.building_id);
                const sc   = UNIT_STATUS_COLOR[u.status]||{c:"#718096",bg:"#F0F2F5"};
                return (
                  <tr key={u.id} style={{ background:i%2===0?"#fff":"#FAFBFC", borderBottom:"1px solid #F0F2F5" }}>
                    <td style={{ padding:"10px 12px", fontWeight:700, color:"#0B1F3A", fontSize:13 }}>#{u.unit_number}</td>
                    <td style={{ padding:"10px 12px", fontSize:12, color:"#4A5568" }}>{proj?.name||"—"}</td>
                    <td style={{ padding:"10px 12px", fontSize:12, color:"#4A5568" }}>{cat?.name||"—"}</td>
                    <td style={{ padding:"10px 12px", fontSize:12, color:"#4A5568" }}>{bld?.name||"—"}</td>
                    <td style={{ padding:"10px 12px" }}><span style={{ fontSize:11, fontWeight:600, padding:"2px 8px", borderRadius:20, background:"#F0F2F5", color:"#4A5568" }}>{u.classification}</span></td>
                    <td style={{ padding:"10px 12px", fontSize:12, color:"#4A5568" }}>{u.floor_number||"—"}</td>
                    <td style={{ padding:"10px 12px", fontSize:12, color:"#4A5568" }}>{u.view||"—"}</td>
                    <td style={{ padding:"10px 12px", fontSize:12, color:"#4A5568" }}>{u.size_sqft?`${u.size_sqft?.toLocaleString()} sqft`:"—"}</td>
                    <td style={{ padding:"10px 12px", fontSize:13, fontWeight:700, color:"#0B1F3A", fontFamily:"'Playfair Display',serif" }}>{u.base_price?fmtFull(u.base_price):"TBD"}</td>
                    <td style={{ padding:"10px 12px", fontSize:12, color:"#4A5568" }}>{u.price_per_sqft?`AED ${u.price_per_sqft?.toLocaleString()}`:"—"}</td>
                    <td style={{ padding:"10px 12px", fontSize:12, fontWeight:600, color:"#1A7F5A" }}>{u.gross_yield?`${u.gross_yield}%`:"—"}</td>
                    <td style={{ padding:"10px 12px" }}><span style={{ fontSize:11, fontWeight:600, padding:"2px 8px", borderRadius:20, background:sc.bg, color:sc.c }}>{u.status}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {units.length===0 && <Empty icon="🏠" msg="No units — add a project first"/>}
        </div>
      )}

      {/* ── MODALS ────────────────────────────────────── */}
      {showAddProject && (
        <Modal title="New Project" onClose={()=>setShowAddProject(false)} width={560}>
          <G2><FF label="Project Name" required><input value={pForm.name} onChange={e=>setPForm(f=>({...f,name:e.target.value}))} placeholder="Emaar Beachfront"/></FF>
          <FF label="Developer"><input value={pForm.developer} onChange={e=>setPForm(f=>({...f,developer:e.target.value}))} placeholder="Emaar Properties"/></FF></G2>
          <G2><FF label="Location"><input value={pForm.location} onChange={e=>setPForm(f=>({...f,location:e.target.value}))} placeholder="Dubai Harbour"/></FF>
          <FF label="Status"><select value={pForm.status} onChange={e=>setPForm(f=>({...f,status:e.target.value}))}>{PROJ_STATUS.map(s=><option key={s}>{s}</option>)}</select></FF></G2>
          <G2><FF label="Launch Date"><input type="date" value={pForm.launch_date} onChange={e=>setPForm(f=>({...f,launch_date:e.target.value}))}/></FF>
          <FF label="Completion Date"><input type="date" value={pForm.completion_date} onChange={e=>setPForm(f=>({...f,completion_date:e.target.value}))}/></FF></G2>
          <FF label="Website"><input value={pForm.website} onChange={e=>setPForm(f=>({...f,website:e.target.value}))} placeholder="https://…"/></FF>
          <FF label="Description"><textarea value={pForm.description} onChange={e=>setPForm(f=>({...f,description:e.target.value}))} rows={2} placeholder="Key features…"/></FF>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}><Btn variant="outline" onClick={()=>setShowAddProject(false)}>Cancel</Btn><Btn onClick={saveProject}>Save Project</Btn></div>
        </Modal>
      )}
      {showAddCat && selProject && (
        <Modal title={`Add Category to ${selProject.name}`} onClose={()=>setShowAddCat(false)} width={420}>
          <G2><FF label="Category Name" required><input value={cForm.name} onChange={e=>setCForm(f=>({...f,name:e.target.value}))} placeholder="Villas / Flats…"/></FF>
          <FF label="Type"><select value={cForm.type} onChange={e=>setCForm(f=>({...f,type:e.target.value}))}>{CAT_TYPES.map(t=><option key={t}>{t}</option>)}</select></FF></G2>
          <FF label="Description"><textarea value={cForm.description} onChange={e=>setCForm(f=>({...f,description:e.target.value}))} rows={2}/></FF>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}><Btn variant="outline" onClick={()=>setShowAddCat(false)}>Cancel</Btn><Btn onClick={saveCat}>Save Category</Btn></div>
        </Modal>
      )}
      {showAddBuilding && selCat && (
        <Modal title={`Add Building to ${selCat.name}`} onClose={()=>setShowAddBuilding(false)} width={420}>
          <FF label="Building Name" required><input value={bForm.name} onChange={e=>setBForm(f=>({...f,name:e.target.value}))} placeholder="Tower A / Block 1 / Villa Cluster B"/></FF>
          <G2><FF label="Floors"><input type="number" value={bForm.floors} onChange={e=>setBForm(f=>({...f,floors:e.target.value}))}/></FF>
          <FF label="Total Units"><input type="number" value={bForm.total_units} onChange={e=>setBForm(f=>({...f,total_units:e.target.value}))}/></FF></G2>
          <FF label="Amenities"><textarea value={bForm.amenities} onChange={e=>setBForm(f=>({...f,amenities:e.target.value}))} rows={2} placeholder="Pool, Gym, Concierge…"/></FF>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}><Btn variant="outline" onClick={()=>setShowAddBuilding(false)}>Cancel</Btn><Btn onClick={saveBuilding}>Save Building</Btn></div>
        </Modal>
      )}
      {(showAddUnit||editUnit) && selBuilding && (
        <Modal title={editUnit?"Edit Unit":`Add Unit to ${selBuilding.name}`} onClose={()=>{ setShowAddUnit(false); setEditUnit(null); }} width={620}>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:13, color:"#A0AEC0", marginBottom:14 }}>{selProject?.name} → {selCat?.name} → {selBuilding?.name}</div>
          <G2><FF label="Unit Number" required><input value={uForm.unit_number} onChange={e=>setUForm(f=>({...f,unit_number:e.target.value}))} placeholder="A-101 / Villa 12"/></FF>
          <FF label="Classification"><select value={uForm.classification} onChange={e=>setUForm(f=>({...f,classification:e.target.value}))}>{UNIT_CLASS.map(c=><option key={c}>{c}</option>)}</select></FF></G2>
          <G2><FF label="Floor"><input type="number" value={uForm.floor_number} onChange={e=>setUForm(f=>({...f,floor_number:e.target.value}))}/></FF>
          <FF label="View"><select value={uForm.view} onChange={e=>setUForm(f=>({...f,view:e.target.value}))}><option value="">Select…</option>{VIEWS.map(v=><option key={v}>{v}</option>)}</select></FF></G2>
          <G2><FF label="Bedrooms"><input type="number" value={uForm.bedrooms} onChange={e=>setUForm(f=>({...f,bedrooms:e.target.value}))}/></FF>
          <FF label="Bathrooms"><input type="number" value={uForm.bathrooms} onChange={e=>setUForm(f=>({...f,bathrooms:e.target.value}))}/></FF></G2>
          <G2><FF label="Size (sqft)"><input type="number" value={uForm.size_sqft} onChange={e=>{ const s=Number(e.target.value); setUForm(f=>({...f,size_sqft:s,size_sqm:(s*0.0929).toFixed(1),price_per_sqft:f.base_price&&s?Math.round(f.base_price/s):""})); }}/></FF>
          <FF label="Size (sqm)"><input type="number" value={uForm.size_sqm} onChange={e=>setUForm(f=>({...f,size_sqm:e.target.value}))}/></FF></G2>
          <div style={{ background:"#FDF8EC", border:"1px solid #E8C97A", borderRadius:10, padding:"12px", marginBottom:14 }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#A06810", marginBottom:10, textTransform:"uppercase", letterSpacing:"0.5px" }}>Pricing</div>
            <G2><FF label="Base Price (AED)"><input type="number" value={uForm.base_price} onChange={e=>{ const p=Number(e.target.value); setUForm(f=>({...f,base_price:p,price_per_sqft:f.size_sqft&&p?Math.round(p/f.size_sqft):""})); }} placeholder="2500000"/></FF>
            <FF label="Price per Sqft (AED)"><input type="number" value={uForm.price_per_sqft} onChange={e=>setUForm(f=>({...f,price_per_sqft:e.target.value}))} placeholder="Auto-calculated"/></FF></G2>
            <G2><FF label="Service Charge/sqft (AED/yr)"><input type="number" value={uForm.service_charge_sqft} onChange={e=>setUForm(f=>({...f,service_charge_sqft:e.target.value}))}/></FF>
            <FF label="Gross Yield (%)"><input type="number" value={uForm.gross_yield} onChange={e=>setUForm(f=>({...f,gross_yield:e.target.value}))} placeholder="7.5"/></FF></G2>
          </div>
          <div style={{ background:"#E6EFF9", border:"1px solid #B5D4F4", borderRadius:10, padding:"12px", marginBottom:14 }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#1A5FA8", marginBottom:10, textTransform:"uppercase", letterSpacing:"0.5px" }}>Payment Plan (%)</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:10 }}>
              {[["Booking","booking_pct"],["Construction","construction_pct"],["Handover","handover_pct"],["Post-Handover","post_handover_pct"]].map(([l,k])=>(
                <FF key={k} label={l}><input type="number" value={uForm[k]} onChange={e=>setUForm(f=>({...f,[k]:e.target.value}))}/></FF>
              ))}
            </div>
            <G2><FF label="Post-Handover Years"><input type="number" value={uForm.post_handover_years} onChange={e=>setUForm(f=>({...f,post_handover_years:e.target.value}))}/></FF>
            <FF label="Status"><select value={uForm.status} onChange={e=>setUForm(f=>({...f,status:e.target.value}))}>{UNIT_STATUS.map(s=><option key={s}>{s}</option>)}</select></FF></G2>
          </div>
          <G2><FF label="Furnishing"><select value={uForm.furnishing} onChange={e=>setUForm(f=>({...f,furnishing:e.target.value}))}>{FURNISHING.map(x=><option key={x}>{x}</option>)}</select></FF>
          <FF label="Condition"><select value={uForm.condition} onChange={e=>setUForm(f=>({...f,condition:e.target.value}))}>{["Off-plan","Ready","Resale"].map(x=><option key={x}>{x}</option>)}</select></FF></G2>
          <FF label="Handover Date"><input type="date" value={uForm.handover_date} onChange={e=>setUForm(f=>({...f,handover_date:e.target.value}))}/></FF>
          <FF label="Notes"><textarea value={uForm.notes} onChange={e=>setUForm(f=>({...f,notes:e.target.value}))} rows={2}/></FF>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
            <Btn variant="outline" onClick={()=>{ setShowAddUnit(false); setEditUnit(null); }}>Cancel</Btn>
            <Btn onClick={()=>saveUnit(!!editUnit)}>{editUnit?"Save Changes":"Add Unit"}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// COMMUNICATIONS & FOLLOW-UPS MODULE
// ═══════════════════════════════════════════════════════
function Communications({ lead, currentUser, showToast, onUpdate }) {
  const [comms,    setComms]    = useState([]);
  const [followups,setFollowups]= useState([]);
  const [tab,      setTab]      = useState("timeline");
  const [showComm, setShowComm] = useState(false);
  const [showFU,   setShowFU]   = useState(false);
  const [showWA,   setShowWA]   = useState(false);
  const [commForm, setCommForm] = useState({ channel:"WhatsApp", direction:"Outbound", subject:"", body:"", status:"Sent" });
  const [fuForm,   setFuForm]   = useState({ type:"Call", subject:"", notes:"", scheduled_at:"", assigned_to:currentUser.id, assigned_name:currentUser.full_name });
  const [selTemplate, setSelTemplate] = useState(WA_TEMPLATES[0]);

  useEffect(()=>{
    if (!lead) return;
    Promise.all([
      supabase.from("communications").select("*").eq("lead_id",lead.id).order("created_at",{ascending:false}),
      supabase.from("followups").select("*").eq("lead_id",lead.id).order("scheduled_at",{ascending:true}),
    ]).then(([c,f])=>{ setComms(c.data||[]); setFollowups(f.data||[]); });
  },[lead]);

  const logComm = async () => {
    if (!commForm.body.trim()) { showToast("Message body required","error"); return; }
    const { data, error } = await supabase.from("communications").insert({ ...commForm, lead_id:lead.id, sent_by:currentUser.id, sent_by_name:currentUser.full_name, lead_name:lead.name }).select().single();
    if (error) { showToast(error.message,"error"); return; }
    setComms(p=>[data,...p]);
    // update no_response_count if outbound
    if (commForm.direction==="Outbound") {
      await supabase.from("leads").update({ last_comm_at:new Date().toISOString(), no_response_count:(lead.no_response_count||0)+1 }).eq("id",lead.id);
      onUpdate && onUpdate({ last_comm_at:new Date().toISOString(), no_response_count:(lead.no_response_count||0)+1 });
    }
    showToast("Communication logged","success"); setShowComm(false); setCommForm({ channel:"WhatsApp", direction:"Outbound", subject:"", body:"", status:"Sent" });
  };

  const sendWA = async () => {
    const body = selTemplate.body.replace("{name}",lead.name).replace("{agent}",currentUser.full_name).replace("{property}","the property").replace("{date}","the scheduled date");
    const waNumber = (lead.whatsapp||lead.phone||"").replace(/[^0-9]/g,"");
    if (waNumber) window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(body)}`,"_blank");
    const { data } = await supabase.from("communications").insert({ channel:"WhatsApp", direction:"Outbound", subject:selTemplate.label, body, template_used:selTemplate.key, lead_id:lead.id, sent_by:currentUser.id, sent_by_name:currentUser.full_name, lead_name:lead.name, status:"Sent" }).select().single();
    if (data) setComms(p=>[data,...p]);
    showToast("WhatsApp message logged","success"); setShowWA(false);
  };

  const scheduleFollowup = async () => {
    if (!fuForm.subject||!fuForm.scheduled_at) { showToast("Subject and date required","error"); return; }
    const { data, error } = await supabase.from("followups").insert({ ...fuForm, lead_id:lead.id, lead_name:lead.name, created_by:currentUser.id }).select().single();
    if (error) { showToast(error.message,"error"); return; }
    setFollowups(p=>[...p,data].sort((a,b)=>new Date(a.scheduled_at)-new Date(b.scheduled_at)));
    showToast("Follow-up scheduled","success"); setShowFU(false); setFuForm({ type:"Call", subject:"", notes:"", scheduled_at:"", assigned_to:currentUser.id, assigned_name:currentUser.full_name });
  };

  const completeFollowup = async (id) => {
    const { error } = await supabase.from("followups").update({ is_completed:true, completed_at:new Date().toISOString() }).eq("id",id);
    if (!error) { setFollowups(p=>p.map(f=>f.id===id?{...f,is_completed:true}:f)); showToast("Marked complete","success"); }
  };

  const markResponse = async (id) => {
    const { error } = await supabase.from("communications").update({ response_received:true, response_at:new Date().toISOString(), status:"Read" }).eq("id",id);
    if (!error) {
      setComms(p=>p.map(c=>c.id===id?{...c,response_received:true,status:"Read"}:c));
      await supabase.from("leads").update({ no_response_count:0 }).eq("id",lead.id);
      onUpdate && onUpdate({ no_response_count:0 });
      showToast("Response recorded","success");
    }
  };

  const pending   = followups.filter(f=>!f.is_completed);
  const overdue   = pending.filter(f=>new Date(f.scheduled_at)<new Date());
  const upcoming  = pending.filter(f=>new Date(f.scheduled_at)>=new Date());

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      {/* Header actions */}
      <div style={{ display:"flex", gap:6, marginBottom:12, flexWrap:"wrap" }}>
        <div style={{ display:"flex", gap:4 }}>
          {[["timeline","Timeline"],["followups",`Follow-ups${pending.length?" ("+pending.length+")":""}`]].map(([id,label])=>(
            <button key={id} onClick={()=>setTab(id)} style={{ padding:"5px 12px", borderRadius:8, border:`1.5px solid ${tab===id?"#0B1F3A":"#E2E8F0"}`, background:tab===id?"#0B1F3A":"#fff", color:tab===id?"#fff":"#4A5568", fontSize:12, fontWeight:tab===id?600:400, cursor:"pointer" }}>{label}</button>
          ))}
        </div>
        <div style={{ marginLeft:"auto", display:"flex", gap:6 }}>
          <Btn small variant="green" onClick={()=>setShowWA(true)}>💬 WhatsApp</Btn>
          <Btn small variant="outline" onClick={()=>setShowComm(true)}>+ Log Comm</Btn>
          <Btn small onClick={()=>setShowFU(true)}>+ Follow-up</Btn>
        </div>
      </div>

      {/* No-response warning */}
      {(lead.no_response_count||0)>=2 && (
        <div style={{ background:"#FDF3DC", border:"1.5px solid #E8C97A", borderRadius:8, padding:"8px 12px", marginBottom:10, fontSize:12, color:"#8A6200", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span>⚠️ No response after {lead.no_response_count} outbound message{lead.no_response_count!==1?"s":""}. Consider a different channel or template.</span>
          <Btn small variant="gold" onClick={()=>setShowWA(true)}>Resend</Btn>
        </div>
      )}

      {/* Timeline tab */}
      {tab==="timeline" && (
        <div style={{ flex:1, overflowY:"auto" }}>
          {comms.length===0 && <Empty icon="💬" msg="No communications logged yet"/>}
          {comms.map(c=>{
            const m = COMM_META[c.channel]||{icon:"💬",c:"#718096",bg:"#F0F2F5"};
            return (
              <div key={c.id} style={{ display:"flex", gap:10, padding:"10px 12px", background:"#fff", border:"1px solid #E2E8F0", borderRadius:10, marginBottom:7 }}>
                <div style={{ width:34, height:34, borderRadius:8, background:m.bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>{m.icon}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:3, flexWrap:"wrap" }}>
                    <span style={{ fontSize:12, fontWeight:700, color:m.c }}>{c.channel}</span>
                    <span style={{ fontSize:11, color:"#A0AEC0" }}>{c.direction==="Outbound"?"↑ Sent":"↓ Received"}</span>
                    {c.subject && <span style={{ fontSize:11, color:"#4A5568" }}>{c.subject}</span>}
                    <span style={{ fontSize:10, fontWeight:600, padding:"1px 7px", borderRadius:20, background:c.response_received?"#E6F4EE":"#FDF3DC", color:c.response_received?"#1A7F5A":"#A06810" }}>{c.response_received?"Responded":c.status}</span>
                  </div>
                  <div style={{ fontSize:12, color:"#4A5568", lineHeight:1.6, marginBottom:4 }}>{c.body}</div>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span style={{ fontSize:10, color:"#A0AEC0" }}>{c.sent_by_name} · {fmtDate(c.created_at)}</span>
                    {!c.response_received && c.direction==="Outbound" && (
                      <button onClick={()=>markResponse(c.id)} style={{ fontSize:11, color:"#1A7F5A", background:"#E6F4EE", border:"none", borderRadius:6, padding:"3px 9px", cursor:"pointer", fontWeight:600 }}>✓ Got Response</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Follow-ups tab */}
      {tab==="followups" && (
        <div style={{ flex:1, overflowY:"auto" }}>
          {overdue.length>0 && (
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:11, fontWeight:700, color:"#B83232", textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:6 }}>⚠ Overdue ({overdue.length})</div>
              {overdue.map(f=>{ const m=FU_META[f.type]||{icon:"✓"}; return (
                <div key={f.id} style={{ display:"flex", gap:10, padding:"10px 12px", background:"#FAEAEA", border:"1px solid #F0BCBC", borderRadius:10, marginBottom:6 }}>
                  <span style={{ fontSize:18 }}>{m.icon}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:"#0B1F3A" }}>{f.subject}</div>
                    <div style={{ fontSize:11, color:"#B83232" }}>Was due: {fmtDate(f.scheduled_at)} · {f.type}</div>
                    {f.notes && <div style={{ fontSize:12, color:"#4A5568" }}>{f.notes}</div>}
                  </div>
                  <Btn small variant="green" onClick={()=>completeFollowup(f.id)}>Done</Btn>
                </div>
              );})}
            </div>
          )}
          {upcoming.length>0 && (
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:11, fontWeight:700, color:"#1A5FA8", textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:6 }}>Upcoming ({upcoming.length})</div>
              {upcoming.map(f=>{ const m=FU_META[f.type]||{icon:"✓"}; return (
                <div key={f.id} style={{ display:"flex", gap:10, padding:"10px 12px", background:"#E6EFF9", border:"1px solid #B5D4F4", borderRadius:10, marginBottom:6 }}>
                  <span style={{ fontSize:18 }}>{m.icon}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:"#0B1F3A" }}>{f.subject}</div>
                    <div style={{ fontSize:11, color:"#1A5FA8" }}>{fmtDate(f.scheduled_at)} · {f.type} · {f.assigned_name}</div>
                    {f.notes && <div style={{ fontSize:12, color:"#4A5568" }}>{f.notes}</div>}
                  </div>
                  <Btn small variant="green" onClick={()=>completeFollowup(f.id)}>Done</Btn>
                </div>
              );})}
            </div>
          )}
          {followups.filter(f=>f.is_completed).length>0 && (
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:"#A0AEC0", textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:6 }}>Completed</div>
              {followups.filter(f=>f.is_completed).map(f=>(
                <div key={f.id} style={{ display:"flex", gap:10, padding:"8px 12px", background:"#FAFBFC", border:"1px solid #F0F2F5", borderRadius:10, marginBottom:5, opacity:0.7 }}>
                  <span style={{ fontSize:16 }}>✓</span>
                  <div><div style={{ fontSize:12, fontWeight:500, color:"#4A5568" }}>{f.subject}</div><div style={{ fontSize:11, color:"#A0AEC0" }}>{fmtDate(f.completed_at)} · {f.type}</div></div>
                </div>
              ))}
            </div>
          )}
          {followups.length===0 && <Empty icon="📅" msg="No follow-ups scheduled"/>}
        </div>
      )}

      {/* Log Communication Modal */}
      {showComm && (
        <Modal title="Log Communication" onClose={()=>setShowComm(false)} width={460}>
          <G2><FF label="Channel"><select value={commForm.channel} onChange={e=>setCommForm(f=>({...f,channel:e.target.value}))}>{COMM_TYPES.map(t=><option key={t}>{t}</option>)}</select></FF>
          <FF label="Direction"><select value={commForm.direction} onChange={e=>setCommForm(f=>({...f,direction:e.target.value}))}><option>Outbound</option><option>Inbound</option></select></FF></G2>
          <FF label="Subject"><input value={commForm.subject} onChange={e=>setCommForm(f=>({...f,subject:e.target.value}))} placeholder="e.g. Follow-up call, Proposal discussion"/></FF>
          <FF label="Message / Notes" required><textarea value={commForm.body} onChange={e=>setCommForm(f=>({...f,body:e.target.value}))} rows={4} placeholder="What was said or discussed?"/></FF>
          <FF label="Status"><select value={commForm.status} onChange={e=>setCommForm(f=>({...f,status:e.target.value}))}>{["Sent","Delivered","Read","No Response","Failed"].map(s=><option key={s}>{s}</option>)}</select></FF>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}><Btn variant="outline" onClick={()=>setShowComm(false)}>Cancel</Btn><Btn onClick={logComm}>Log</Btn></div>
        </Modal>
      )}

      {/* WhatsApp Template Modal */}
      {showWA && (
        <Modal title={`Send WhatsApp — ${lead.name}`} onClose={()=>setShowWA(false)} width={480}>
          {!(lead.whatsapp||lead.phone) && <div style={{ background:"#FAEAEA", color:"#B83232", border:"1px solid #F0BCBC", borderRadius:8, padding:"10px", marginBottom:12, fontSize:13 }}>⚠ No WhatsApp/phone number on this lead. Add one first.</div>}
          <FF label="Select Template">
            <select value={selTemplate.key} onChange={e=>setSelTemplate(WA_TEMPLATES.find(t=>t.key===e.target.value)||WA_TEMPLATES[0])}>
              {WA_TEMPLATES.map(t=><option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </FF>
          <div style={{ background:"#E6F4EE", border:"1px solid #A8D5BE", borderRadius:10, padding:"12px", marginBottom:14, fontSize:13, color:"#1A7F5A", lineHeight:1.7 }}>
            {selTemplate.body.replace("{name}",lead.name).replace("{agent}",currentUser.full_name).replace("{property}","the property").replace("{date}","the scheduled date")}
          </div>
          <div style={{ fontSize:11, color:"#A0AEC0", marginBottom:14 }}>This will open WhatsApp with the pre-filled message and log it automatically.</div>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}><Btn variant="outline" onClick={()=>setShowWA(false)}>Cancel</Btn><Btn variant="green" onClick={sendWA}>Open WhatsApp & Log</Btn></div>
        </Modal>
      )}

      {/* Schedule Follow-up Modal */}
      {showFU && (
        <Modal title="Schedule Follow-up" onClose={()=>setShowFU(false)} width={440}>
          <G2><FF label="Type"><select value={fuForm.type} onChange={e=>setFuForm(f=>({...f,type:e.target.value}))}>{FU_TYPES.map(t=><option key={t}>{t}</option>)}</select></FF>
          <FF label="Date & Time" required><input type="datetime-local" value={fuForm.scheduled_at} onChange={e=>setFuForm(f=>({...f,scheduled_at:e.target.value}))}/></FF></G2>
          <FF label="Subject" required><input value={fuForm.subject} onChange={e=>setFuForm(f=>({...f,subject:e.target.value}))} placeholder="e.g. Callback after proposal, Site visit confirmation"/></FF>
          <FF label="Notes"><textarea value={fuForm.notes} onChange={e=>setFuForm(f=>({...f,notes:e.target.value}))} rows={2} placeholder="What needs to be covered?"/></FF>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}><Btn variant="outline" onClick={()=>setShowFU(false)}>Cancel</Btn><Btn onClick={scheduleFollowup}>Schedule</Btn></div>
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════
function Dashboard({ leads, properties, activities, currentUser }) {
  const visible  = can(currentUser.role,"see_all") ? leads : leads.filter(l=>l.assigned_to===currentUser.id);
  const active   = visible.filter(l=>!["Closed Won","Closed Lost"].includes(l.stage));
  const won      = visible.filter(l=>l.stage==="Closed Won");
  const lost     = visible.filter(l=>l.stage==="Closed Lost");
  const pipeVal  = active.reduce((s,l)=>s+(l.budget||0),0);
  const wonVal   = won.reduce((s,l)=>s+(l.budget||0),0);
  const avail    = properties.filter(p=>p.status==="Available").length;
  const maxCount = Math.max(...STAGES.map(s=>visible.filter(l=>l.stage===s).length),1);
  const recent   = [...activities].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,6);

  const SC = ({ label, value, sub, accent }) => (
    <div style={{ background:"#fff", border:"1px solid #E2E8F0", borderRadius:12, padding:"1.125rem 1.25rem", borderTop:`3px solid ${accent}` }}>
      <div style={{ fontSize:10, color:"#A0AEC0", textTransform:"uppercase", letterSpacing:"0.7px", fontWeight:600, marginBottom:6 }}>{label}</div>
      <div style={{ fontFamily:"'Playfair Display',serif", fontSize:26, fontWeight:700, color:"#0B1F3A", lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:12, color:"#718096", marginTop:5 }}>{sub}</div>}
    </div>
  );

  return (
    <div className="fade-in" style={{ display:"flex", flexDirection:"column", gap:18 }}>
      <div style={{ background:"linear-gradient(135deg,#0B1F3A 0%,#1A3558 100%)", borderRadius:14, padding:"1.5rem 2rem", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:22, color:"#fff", fontWeight:700 }}>Good morning, {currentUser.full_name?.split(" ")[0]} ☀️</div>
          <div style={{ color:"#C9A84C", fontSize:13, marginTop:4 }}>{new Date().toLocaleDateString("en-AE",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</div>
          <div style={{ marginTop:6 }}><RoleBadge role={currentUser.role}/></div>
        </div>
        <div style={{ textAlign:"right" }}>
          <div style={{ color:"rgba(255,255,255,0.5)", fontSize:11, textTransform:"uppercase", letterSpacing:"0.6px" }}>
            {can(currentUser.role,"see_all") ? "Total Pipeline" : "Your Pipeline"}
          </div>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:30, color:"#C9A84C", fontWeight:700, marginTop:2 }}>{fmtM(pipeVal)}</div>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
        <SC label={can(currentUser.role,"see_all")?"Active Leads":"Your Active Leads"} value={active.length} sub={`of ${visible.length} total`} accent="#0B1F3A"/>
        <SC label="Deals Won"        value={won.length}   sub={fmtM(wonVal)+" closed"}      accent="#1A7F5A"/>
        <SC label="Deals Lost"       value={lost.length}  sub="Review & re-engage"          accent="#B83232"/>
        <SC label="Properties Avail" value={avail}        sub={`of ${properties.length} listed`} accent="#C9A84C"/>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 300px", gap:14 }}>
        <Card>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:15, fontWeight:700, color:"#0B1F3A", marginBottom:16 }}>Pipeline by Stage</div>
          {STAGES.map(s=>{
            const cnt = visible.filter(l=>l.stage===s).length;
            const m = STAGE_META[s];
            return (
              <div key={s} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:9 }}>
                <div style={{ width:116, fontSize:12, color:"#4A5568", fontWeight:500, flexShrink:0 }}>{s}</div>
                <div style={{ flex:1, background:"#F0F2F5", borderRadius:6, height:9, overflow:"hidden" }}>
                  <div style={{ width:`${cnt?Math.round(cnt/maxCount*100):0}%`, height:"100%", background:m.c, borderRadius:6, transition:"width 0.5s" }}/>
                </div>
                <div style={{ width:22, fontSize:13, fontWeight:700, color:m.c, textAlign:"right" }}>{cnt}</div>
              </div>
            );
          })}
        </Card>
        <Card>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:15, fontWeight:700, color:"#0B1F3A", marginBottom:14 }}>Recent Activity</div>
          {recent.length===0 && <Empty icon="📋" msg="No activity yet"/>}
          {recent.slice(0,5).map(act=>{
            const m = ACT_META[act.type];
            return (
              <div key={act.id} style={{ display:"flex", gap:8, padding:"8px 0", borderBottom:"1px solid #F0F2F5" }}>
                <div style={{ width:28, height:28, borderRadius:6, background:m.bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, flexShrink:0 }}>{m.icon}</div>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:"#0B1F3A", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{act.type} · {act.lead_name||"Unknown"}</div>
                  <div style={{ fontSize:11, color:"#A0AEC0" }}>{act.user_name} · {fmtDate(act.created_at)}</div>
                </div>
              </div>
            );
          })}
        </Card>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// LEADS
// ═══════════════════════════════════════════════════════
function Leads({ leads, setLeads, properties, activities, setActivities, currentUser, users, showToast }) {
  const [search, setSearch]   = useState("");
  const [fStage, setFStage]   = useState("All");
  const [fType,  setFType]    = useState("All");
  const [sel,    setSel]      = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [saving, setSaving]   = useState(false);
  const blank = { name:"",email:"",phone:"",whatsapp:"",nationality:"",source:"Referral",stage:"New Lead",property_type:"Residential",budget:"",budget_confirmed:false,notes:"",assigned_to:currentUser.id,property_id:"",unit_id:"",preferred_contact:"WhatsApp",proposal_notes:"",final_price:"",payment_plan_agreed:"",meeting_scheduled:false,meeting_date:"" };
  const [form, setForm]       = useState(blank);
  const [logForm, setLogForm] = useState({ type:"Call", note:"" });

  // Agents see only their own leads; managers/admins see all
  const visible = can(currentUser.role,"see_all")
    ? leads
    : leads.filter(l=>l.assigned_to===currentUser.id);

  const filtered = useMemo(()=>visible.filter(l=>{
    const q=search.toLowerCase();
    return (l.name.toLowerCase().includes(q)||l.email?.toLowerCase().includes(q))
      &&(fStage==="All"||l.stage===fStage)
      &&(fType==="All"||l.property_type===fType);
  }),[visible,search,fStage,fType]);

  const selLead = sel ? leads.find(l=>l.id===sel) : null;
  const selProp = selLead?.property_id ? properties.find(p=>p.id===selLead.property_id) : null;
  const selActivities = activities.filter(a=>a.lead_id===sel).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  const assignedUserName = selLead ? (users.find(u=>u.id===selLead.assigned_to)?.full_name||"Unknown") : "";
  const canEdit = can(currentUser.role,"write");
  const canDel  = can(currentUser.role,"delete");

  const saveLead = async () => {
    if (!form.name.trim()) { showToast("Name is required.","error"); return; }
    setSaving(true);
    try {
      const payload = { name:form.name, email:form.email, phone:form.phone, whatsapp:form.whatsapp||null, nationality:form.nationality||null, source:form.source, stage:form.stage, property_type:form.property_type, budget:Number(form.budget)||0, budget_confirmed:form.budget_confirmed||false, notes:form.notes, assigned_to:form.assigned_to||currentUser.id, property_id:form.property_id||null, unit_id:form.unit_id||null, preferred_contact:form.preferred_contact||"WhatsApp", created_by:currentUser.id, stage_updated_at:new Date().toISOString() };
      const { data, error } = await supabase.from("leads").insert(payload).select().single();
      if (error) throw error;
      setLeads(p=>[data,...p]);
      showToast("Lead added.","success"); setShowAdd(false); setForm(blank);
    } catch(e) { showToast(e.message,"error"); }
    finally { setSaving(false); }
  };

  const saveLog = async () => {
    if (!logForm.note.trim()||!selLead) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.from("activities").insert({ lead_id:selLead.id, type:logForm.type, note:logForm.note, user_id:currentUser.id, user_name:currentUser.full_name, lead_name:selLead.name }).select().single();
      if (error) throw error;
      setActivities(p=>[data,...p]);
      showToast("Activity logged.","success"); setShowLog(false); setLogForm({ type:"Call", note:"" });
    } catch(e) { showToast(e.message,"error"); }
    finally { setSaving(false); }
  };

  const [showReversal, setShowReversal] = useState(false);
  const [reversalReason, setReversalReason] = useState("");
  const [pendingStage, setPendingStage] = useState(null);
  const [stageErrors, setStageErrors] = useState([]);
  const [showComms, setShowComms] = useState(false);

  const STAGE_ORDER = ["New Lead","Contacted","Site Visit","Proposal Sent","Negotiation","Closed Won","Closed Lost"];

  const setStage = async (stage) => {
    if (!canEdit) return;
    if (!selLead) return;
    const fromIdx = STAGE_ORDER.indexOf(selLead.stage);
    const toIdx   = STAGE_ORDER.indexOf(stage);
    const isReversal = toIdx < fromIdx && stage !== "Closed Lost";

    // validate forward moves
    if (!isReversal) {
      const v = validateStageMove(selLead, stage);
      if (!v.ok) { setStageErrors(v.errors); return; }
    }
    setStageErrors([]);

    if (isReversal) {
      setPendingStage(stage); setShowReversal(true); return;
    }

    await doStageMove(stage, false, "");
  };

  const doStageMove = async (stage, isReversal, reason) => {
    const { error } = await supabase.from("leads").update({ stage, stage_updated_at:new Date().toISOString() }).eq("id",sel);
    if (error) { showToast(error.message,"error"); return; }
    // log stage history
    await supabase.from("stage_history").insert({ lead_id:sel, from_stage:selLead.stage, to_stage:stage, changed_by:currentUser.id, changed_by_name:currentUser.full_name, reason, is_reversal:isReversal });
    setLeads(p=>p.map(l=>l.id===sel?{...l,stage,stage_updated_at:new Date().toISOString()}:l));
    showToast(`Stage ${isReversal?"reversed":"updated"} to ${stage}.`,isReversal?"info":"success");
    setShowReversal(false); setReversalReason(""); setPendingStage(null);
  };

  const delLead = async () => {
    // Only admin and manager can delete leads
    if (!CAN_DELETE_LEADS.includes(currentUser.role)) {
      showToast("Only Admins and Managers can delete leads.","error"); return;
    }
    if (!window.confirm("Delete this lead? All activities and communications will also be deleted. This cannot be undone.")) return;
    const { error } = await supabase.from("leads").delete().eq("id",sel);
    if (!error) { setLeads(p=>p.filter(l=>l.id!==sel)); setSel(null); showToast("Lead deleted.","info"); }
  };

  return (
    <div className="fade-in" style={{ display:"flex", gap:14, height:"100%" }}>
      <div style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0 }}>
        <div style={{ display:"flex", gap:8, marginBottom:10, flexWrap:"wrap" }}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍  Search name or email…" style={{ flex:1, minWidth:160 }}/>
          <select value={fStage} onChange={e=>setFStage(e.target.value)} style={{ width:"auto" }}>
            <option value="All">All stages</option>{STAGES.map(s=><option key={s}>{s}</option>)}
          </select>
          <select value={fType} onChange={e=>setFType(e.target.value)} style={{ width:"auto" }}>
            <option value="All">All types</option>{PROP_TYPES.map(t=><option key={t}>{t}</option>)}
          </select>
          {canEdit && <Btn onClick={()=>{ setForm(blank); setShowAdd(true); }}>+ Add Lead</Btn>}
        </div>
        <div style={{ fontSize:12, color:"#A0AEC0", marginBottom:8 }}>{filtered.length} lead{filtered.length!==1?"s":""}{!can(currentUser.role,"see_all")?" (yours)":""}</div>
        <div style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column", gap:7 }}>
          {filtered.length===0 && <Empty icon="👤" msg="No leads match your filters"/>}
          {filtered.map(l=>(
            <div key={l.id} onClick={()=>setSel(sel===l.id?null:l.id)} className="ch"
              style={{ background:sel===l.id?"#0B1F3A":"#fff", border:`1px solid ${sel===l.id?"#C9A84C":"#E2E8F0"}`, borderRadius:10, padding:"11px 14px", cursor:"pointer" }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <Av name={l.name} size={38} bg={sel===l.id?"#C9A84C":"#0B1F3A"} tc={sel===l.id?"#0B1F3A":"#C9A84C"}/>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:600, fontSize:14, color:sel===l.id?"#fff":"#0B1F3A", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{l.name}</div>
                  <div style={{ fontSize:12, color:sel===l.id?"#C9A84C88":"#A0AEC0" }}>{l.email}</div>
                </div>
                <div style={{ textAlign:"right", flexShrink:0 }}>
                  <StageBadge stage={l.stage}/><div style={{ fontSize:11, color:sel===l.id?"#C9A84C":"#1A7F5A", fontWeight:600, marginTop:4 }}>{fmtM(l.budget)}</div>
                </div>
              </div>
              <div style={{ display:"flex", gap:6, marginTop:7, alignItems:"center", flexWrap:"wrap" }}>
                <TypeBadge type={l.property_type}/>
                <span style={{ fontSize:11, color:sel===l.id?"#C9A84C55":"#A0AEC0" }}>
                  👤 {users.find(u=>u.id===l.assigned_to)?.full_name||"Unassigned"} · {fmtDate(l.updated_at||l.created_at)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {selLead && (
        <div className="slide-in" style={{ width:340, background:"#fff", border:"1px solid #E2E8F0", borderRadius:12, display:"flex", flexDirection:"column", flexShrink:0, overflow:"hidden" }}>
          <div style={{ background:"#0B1F3A", padding:"1.25rem", position:"relative" }}>
            <button onClick={()=>setSel(null)} style={{ position:"absolute", top:10, right:12, background:"none", border:"none", color:"#C9A84C", fontSize:20, cursor:"pointer" }}>×</button>
            <Av name={selLead.name} size={48} bg="#C9A84C" tc="#0B1F3A"/>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:17, color:"#fff", fontWeight:700, marginTop:10 }}>{selLead.name}</div>
            <div style={{ fontSize:12, color:"#C9A84C", marginTop:2 }}>{selLead.email}</div>
            <div style={{ fontSize:12, color:"#C9A84C88", marginTop:1 }}>{selLead.phone}</div>
          </div>
          <div style={{ flex:1, overflowY:"auto", padding:"1rem" }}>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:14 }}>
              <StageBadge stage={selLead.stage}/><TypeBadge type={selLead.property_type}/>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, background:"#FAFBFC", borderRadius:10, padding:"12px", marginBottom:12 }}>
              <FR label="Budget"          value={fmtM(selLead.budget)}/>
              <FR label="Source"          value={selLead.source}/>
              <FR label="Assigned To"     value={assignedUserName}/>
              <FR label="Nationality"     value={selLead.nationality||"—"}/>
              <FR label="Phone"           value={selLead.phone||"—"}/>
              <FR label="WhatsApp"        value={selLead.whatsapp||selLead.phone||"—"}/>
              <FR label="Pref. Contact"   value={selLead.preferred_contact||"—"}/>
              <FR label="Created"         value={fmtDate(selLead.created_at)}/>
              {selLead.budget_confirmed && <FR label="Budget Confirmed" value="✓ Yes"/>}
              {selLead.meeting_scheduled && <FR label="Meeting" value={selLead.meeting_date?fmtDate(selLead.meeting_date):"Scheduled"}/>}
              {selLead.no_response_count>0 && <FR label="No Response" value={`${selLead.no_response_count}x outbound`}/>}
            </div>
            {/* Stage-specific fields */}
            {selLead.proposal_notes && (
              <div style={{ borderLeft:"3px solid #7A3FAA", padding:"8px 10px 8px 12px", marginBottom:10, background:"#F3E8F9", borderRadius:"0 8px 8px 0" }}>
                <div style={{ fontSize:10, color:"#7A3FAA", textTransform:"uppercase", letterSpacing:"0.6px", marginBottom:3 }}>Proposal Notes</div>
                <div style={{ fontSize:13, color:"#4A5568" }}>{selLead.proposal_notes}</div>
              </div>
            )}
            {selLead.final_price && (
              <div style={{ borderLeft:"3px solid #1A7F5A", padding:"8px 10px 8px 12px", marginBottom:10, background:"#E6F4EE", borderRadius:"0 8px 8px 0" }}>
                <div style={{ fontSize:10, color:"#1A7F5A", textTransform:"uppercase", letterSpacing:"0.6px", marginBottom:3 }}>Agreed Price</div>
                <div style={{ fontSize:15, fontWeight:700, color:"#0B1F3A", fontFamily:"'Playfair Display',serif" }}>{fmtFull(selLead.final_price)}</div>
                {selLead.payment_plan_agreed && <div style={{ fontSize:12, color:"#4A5568", marginTop:3 }}>{selLead.payment_plan_agreed}</div>}
              </div>
            )}
            {selLead.notes && (
              <div style={{ borderLeft:"3px solid #C9A84C", padding:"10px 10px 10px 12px", marginBottom:12, background:"#FDFBF4", borderRadius:"0 8px 8px 0" }}>
                <div style={{ fontSize:10, color:"#A0AEC0", textTransform:"uppercase", letterSpacing:"0.6px", marginBottom:4 }}>Notes</div>
                <div style={{ fontSize:13, color:"#4A5568", lineHeight:1.6 }}>{selLead.notes}</div>
              </div>
            )}
            {selProp && (
              <div style={{ border:"1px solid #E2E8F0", borderRadius:10, padding:"10px 12px", marginBottom:12 }}>
                <div style={{ fontSize:10, color:"#A0AEC0", textTransform:"uppercase", letterSpacing:"0.6px", marginBottom:5 }}>Linked Property</div>
                <div style={{ fontWeight:600, fontSize:13, color:"#0B1F3A" }}>{selProp.name}</div>
                <div style={{ fontSize:12, color:"#718096" }}>{selProp.location} · {fmtM(selProp.price)} · {selProp.roi}% ROI</div>
              </div>
            )}
            {canEdit && (
              <div style={{ marginBottom:12 }}>
                <div style={{ fontSize:10, color:"#A0AEC0", textTransform:"uppercase", letterSpacing:"0.6px", marginBottom:8, fontWeight:600 }}>Move to Stage</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:8 }}>
                  {STAGES.map(s=>{
                    const isCur = selLead.stage===s;
                    const rules = STAGE_RULES[s];
                    return (
                      <button key={s} onClick={()=>{ setStageErrors([]); setStage(s); }}
                        style={{ fontSize:10, padding:"4px 9px", borderRadius:20, border:`1.5px solid ${isCur?"#0B1F3A":"#E2E8F0"}`, background:isCur?"#0B1F3A":"#fff", color:isCur?"#fff":"#4A5568", cursor:"pointer", fontWeight:isCur?700:400, position:"relative" }}
                        title={rules?`Requires: ${rules.label}`:""}>
                        {s}{rules&&!isCur?" *":""}
                      </button>
                    );
                  })}
                </div>
                <div style={{ fontSize:10, color:"#A0AEC0" }}>* Stage has required fields</div>

                {/* Inline stage-required fields for current next stage */}
                {(()=>{
                  const STAGE_ORDER2 = ["New Lead","Contacted","Site Visit","Proposal Sent","Negotiation","Closed Won","Closed Lost"];
                  const nextIdx = STAGE_ORDER2.indexOf(selLead.stage)+1;
                  const nextStage = STAGE_ORDER2[nextIdx];
                  if (!nextStage || !STAGE_RULES[nextStage]) return null;
                  return (
                    <div style={{ background:"#F7F9FC", border:"1px solid #E2E8F0", borderRadius:8, padding:"10px 12px", marginTop:8 }}>
                      <div style={{ fontSize:11, fontWeight:600, color:"#0B1F3A", marginBottom:8 }}>Required to move to "{nextStage}":</div>
                      {nextStage==="Contacted" && (
                        <G2>
                          <FF label="Phone *"><input value={selLead.phone||""} onChange={async e=>{ const v=e.target.value; await supabase.from("leads").update({phone:v}).eq("id",sel); setLeads(p=>p.map(l=>l.id===sel?{...l,phone:v}:l)); }} placeholder="+971 50 000 0000"/></FF>
                          <FF label="Email *"><input value={selLead.email||""} onChange={async e=>{ const v=e.target.value; await supabase.from("leads").update({email:v}).eq("id",sel); setLeads(p=>p.map(l=>l.id===sel?{...l,email:v}:l)); }} placeholder="email@example.com"/></FF>
                        </G2>
                      )}
                      {nextStage==="Site Visit" && (
                        <G2>
                          <FF label="Meeting Date *"><input type="datetime-local" value={selLead.meeting_date?selLead.meeting_date.slice(0,16):""} onChange={async e=>{ const v=e.target.value; await supabase.from("leads").update({meeting_date:v,meeting_scheduled:true}).eq("id",sel); setLeads(p=>p.map(l=>l.id===sel?{...l,meeting_date:v,meeting_scheduled:true}:l)); }}/></FF>
                          <FF label=""><div style={{ paddingTop:20 }}><span style={{ fontSize:12, color:selLead.meeting_scheduled?"#1A7F5A":"#A0AEC0", fontWeight:600 }}>{selLead.meeting_scheduled?"✓ Meeting scheduled":"Not yet scheduled"}</span></div></FF>
                        </G2>
                      )}
                      {nextStage==="Proposal Sent" && (
                        <div>
                          <FF label="Confirm Budget">
                            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                              <input type="checkbox" checked={selLead.budget_confirmed||false} onChange={async e=>{ const v=e.target.checked; await supabase.from("leads").update({budget_confirmed:v}).eq("id",sel); setLeads(p=>p.map(l=>l.id===sel?{...l,budget_confirmed:v}:l)); }}/>
                              <span style={{ fontSize:12, color:"#4A5568" }}>Budget confirmed at {fmtM(selLead.budget)}</span>
                            </div>
                          </FF>
                        </div>
                      )}
                      {nextStage==="Negotiation" && (
                        <FF label="Proposal Notes *"><textarea value={selLead.proposal_notes||""} rows={2} onChange={async e=>{ const v=e.target.value; await supabase.from("leads").update({proposal_notes:v}).eq("id",sel); setLeads(p=>p.map(l=>l.id===sel?{...l,proposal_notes:v}:l)); }} placeholder="Details of proposal sent to client…"/></FF>
                      )}
                      {nextStage==="Closed Won" && (
                        <G2>
                          <FF label="Final Agreed Price (AED) *"><input type="number" value={selLead.final_price||""} onChange={async e=>{ const v=e.target.value; await supabase.from("leads").update({final_price:v}).eq("id",sel); setLeads(p=>p.map(l=>l.id===sel?{...l,final_price:v}:l)); }} placeholder="e.g. 2450000"/></FF>
                          <FF label="Payment Plan Agreed *"><input value={selLead.payment_plan_agreed||""} onChange={async e=>{ const v=e.target.value; await supabase.from("leads").update({payment_plan_agreed:v}).eq("id",sel); setLeads(p=>p.map(l=>l.id===sel?{...l,payment_plan_agreed:v}:l)); }} placeholder="e.g. 20/80, cash, mortgage"/></FF>
                        </G2>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Activity history */}
            {selActivities.length>0 && (
              <div style={{ marginBottom:12 }}>
                <div style={{ fontSize:10, color:"#A0AEC0", textTransform:"uppercase", letterSpacing:"0.6px", marginBottom:8, fontWeight:600 }}>Activity History</div>
                <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                  {selActivities.slice(0,4).map(a=>{
                    const m = ACT_META[a.type];
                    return (
                      <div key={a.id} style={{ display:"flex", gap:8, padding:"8px 10px", background:"#FAFBFC", borderRadius:8, border:"1px solid #F0F2F5" }}>
                        <div style={{ fontSize:14 }}>{m.icon}</div>
                        <div style={{ minWidth:0 }}>
                          <div style={{ fontSize:12, fontWeight:600, color:m.c }}>{a.type}</div>
                          <div style={{ fontSize:11, color:"#718096", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{a.note}</div>
                          <div style={{ fontSize:10, color:"#A0AEC0" }}>{a.user_name} · {fmtDate(a.created_at)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Stage error messages */}
            {stageErrors.length>0 && (
              <div style={{ background:"#FAEAEA", border:"1.5px solid #F0BCBC", borderRadius:8, padding:"10px 12px", marginBottom:12 }}>
                <div style={{ fontSize:11, fontWeight:700, color:"#B83232", marginBottom:6 }}>⚠ Required before moving to this stage:</div>
                {stageErrors.map((e,i)=><div key={i} style={{ fontSize:12, color:"#B83232" }}>• {e}</div>)}
              </div>
            )}

            {/* Communications button */}
            <div style={{ marginBottom:12 }}>
              <button onClick={()=>setShowComms(s=>!s)} style={{ width:"100%", padding:"9px", borderRadius:8, border:"1.5px solid #E2E8F0", background:showComms?"#0B1F3A":"#fff", color:showComms?"#C9A84C":"#4A5568", fontSize:13, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                💬 {showComms?"Hide":"Show"} Communications & Follow-ups
              </button>
            </div>

            <div style={{ display:"flex", gap:8 }}>
              {canEdit && <Btn variant="gold" small onClick={()=>setShowLog(true)} style={{ flex:1 }}>+ Log Activity</Btn>}
              {CAN_DELETE_LEADS.includes(currentUser.role) && <Btn variant="danger" small onClick={delLead}>Delete</Btn>}
            </div>
          </div>
        </div>
      )}

      {/* Expanded communications panel */}
      {selLead && showComms && (
        <div className="slide-in" style={{ width:420, background:"#fff", border:"1px solid #E2E8F0", borderRadius:12, flexShrink:0, overflow:"hidden", display:"flex", flexDirection:"column", padding:"1rem" }}>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:14, fontWeight:700, color:"#0B1F3A", marginBottom:12 }}>💬 {selLead.name} — Comms</div>
          <Communications lead={selLead} currentUser={currentUser} showToast={showToast}
            onUpdate={(updates)=>setLeads(p=>p.map(l=>l.id===selLead.id?{...l,...updates}:l))}/>
        </div>
      )}

      {/* Stage reversal modal */}
      {showReversal && (
        <Modal title="Reverse Stage — Reason Required" onClose={()=>{ setShowReversal(false); setReversalReason(""); setPendingStage(null); }} width={420}>
          <div style={{ background:"#FDF3DC", border:"1px solid #E8C97A", borderRadius:8, padding:"10px 12px", marginBottom:14, fontSize:13, color:"#8A6200" }}>
            ⚠ You are moving this lead <strong>backwards</strong> from <strong>{selLead?.stage}</strong> to <strong>{pendingStage}</strong>. A reason is required and will be logged.
          </div>
          <FF label="Reason for reversal" required>
            <textarea value={reversalReason} onChange={e=>setReversalReason(e.target.value)} rows={3} placeholder="e.g. Client requested to revisit proposal, budget constraints, needs more time…"/>
          </FF>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
            <Btn variant="outline" onClick={()=>{ setShowReversal(false); setReversalReason(""); setPendingStage(null); }}>Cancel</Btn>
            <Btn variant="danger" disabled={!reversalReason.trim()} onClick={()=>doStageMove(pendingStage,true,reversalReason)}>Confirm Reversal</Btn>
          </div>
        </Modal>
      )}

      {showAdd && (
        <Modal title="Add New Lead" onClose={()=>setShowAdd(false)} width={580}>
          {/* Contact info */}
          <div style={{ fontSize:11, fontWeight:700, color:"#A0AEC0", textTransform:"uppercase", letterSpacing:"0.6px", marginBottom:10 }}>Contact Information</div>
          <G2>
            <FF label="Full Name" required><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Ahmed Al Mansoori"/></FF>
            <FF label="Nationality"><select value={form.nationality} onChange={e=>setForm(f=>({...f,nationality:e.target.value}))}><option value="">Select…</option>{NATIONALITIES.map(n=><option key={n}>{n}</option>)}</select></FF>
          </G2>
          <G2>
            <FF label="Phone" required><input value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} placeholder="+971 50 000 0000"/></FF>
            <FF label="WhatsApp (if different)"><input value={form.whatsapp} onChange={e=>setForm(f=>({...f,whatsapp:e.target.value}))} placeholder="+971 50 000 0000"/></FF>
          </G2>
          <G2>
            <FF label="Email" required><input value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="email@example.com"/></FF>
            <FF label="Preferred Contact"><select value={form.preferred_contact} onChange={e=>setForm(f=>({...f,preferred_contact:e.target.value}))}>{["WhatsApp","Email","Call","SMS"].map(c=><option key={c}>{c}</option>)}</select></FF>
          </G2>
          {/* Lead details */}
          <div style={{ fontSize:11, fontWeight:700, color:"#A0AEC0", textTransform:"uppercase", letterSpacing:"0.6px", margin:"14px 0 10px" }}>Lead Details</div>
          <G2>
            <FF label="Budget (AED)" required><input type="number" value={form.budget} onChange={e=>setForm(f=>({...f,budget:e.target.value}))} placeholder="2000000"/></FF>
            <FF label="Assign To"><select value={form.assigned_to} onChange={e=>setForm(f=>({...f,assigned_to:e.target.value}))}>{users.filter(u=>u.is_active).map(u=><option key={u.id} value={u.id}>{u.full_name} ({ROLE_META[u.role]?.label})</option>)}</select></FF>
          </G2>
          <G2>
            <FF label="Lead Source"><select value={form.source} onChange={e=>setForm(f=>({...f,source:e.target.value}))}>{SOURCES.map(s=><option key={s}>{s}</option>)}</select></FF>
            <FF label="Property Type"><select value={form.property_type} onChange={e=>setForm(f=>({...f,property_type:e.target.value}))}>{PROP_TYPES.map(t=><option key={t}>{t}</option>)}</select></FF>
          </G2>
          <FF label="Pipeline Stage"><select value={form.stage} onChange={e=>setForm(f=>({...f,stage:e.target.value}))}>{STAGES.map(s=><option key={s}>{s}</option>)}</select></FF>
          <FF label="Notes"><textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} rows={2} placeholder="Interest details, requirements, preferred areas…"/></FF>
          {/* Stage hint */}
          {STAGE_RULES[form.stage] && (
            <div style={{ background:"#E6EFF9", border:"1px solid #B5D4F4", borderRadius:8, padding:"8px 12px", marginBottom:10, fontSize:12, color:"#1A5FA8" }}>
              ℹ To move to <strong>{form.stage}</strong>: {STAGE_RULES[form.stage].label}
            </div>
          )}
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:6 }}>
            <Btn variant="outline" onClick={()=>setShowAdd(false)}>Cancel</Btn>
            <Btn onClick={saveLead} disabled={saving}>{saving?"Saving…":"Save Lead"}</Btn>
          </div>
        </Modal>
      )}

      {showLog && selLead && (
        <Modal title={`Log Activity — ${selLead.name}`} onClose={()=>setShowLog(false)} width={420}>
          <FF label="Activity Type">
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {ACT_TYPES.map(t=>(
                <button key={t} onClick={()=>setLogForm(f=>({...f,type:t}))} style={{ padding:"6px 14px", borderRadius:20, border:`1.5px solid ${logForm.type===t?"#0B1F3A":"#E2E8F0"}`, background:logForm.type===t?"#0B1F3A":"#fff", color:logForm.type===t?"#fff":"#4A5568", fontSize:13, cursor:"pointer", fontWeight:logForm.type===t?600:400 }}>
                  {ACT_META[t].icon} {t}
                </button>
              ))}
            </div>
          </FF>
          <FF label="Note / Summary" required><textarea value={logForm.note} onChange={e=>setLogForm(f=>({...f,note:e.target.value}))} rows={4} placeholder="What was discussed or agreed?"/></FF>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
            <Btn variant="outline" onClick={()=>setShowLog(false)}>Cancel</Btn>
            <Btn variant="gold" onClick={saveLog} disabled={saving}>{saving?"Saving…":"Save Activity"}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// PROPERTIES (unchanged from v1 but now using Supabase)
// ═══════════════════════════════════════════════════════
function Properties({ properties, setProperties, currentUser, showToast }) {
  const [fType, setFType]     = useState("All");
  const [fStatus, setFStatus] = useState("All");
  const [sel, setSel]         = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving]   = useState(false);
  const blank = { name:"",type:"Residential",classification:"",project_name:"",location:"",price:"",size:"",bedrooms:"",status:"Available",developer:"",completion:"Ready",roi:"",description:"" };
  const [form, setForm]       = useState(blank);
  const canEdit = can(currentUser.role,"write");
  const canDel  = can(currentUser.role,"delete");

  const filtered = properties.filter(p=>(fType==="All"||p.type===fType)&&(fStatus==="All"||p.status===fStatus));
  const selP     = sel ? properties.find(p=>p.id===sel) : null;
  const SM = { Available:{c:"#1A7F5A",bg:"#E6F4EE"}, "Under Offer":{c:"#A06810",bg:"#FDF3DC"}, Sold:{c:"#B83232",bg:"#FAEAEA"} };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = { ...form, price:Number(form.price)||0, size:Number(form.size)||0, bedrooms:form.bedrooms?Number(form.bedrooms):null, roi:Number(form.roi)||0, project_name:form.project_name||null, classification:form.classification||null };
      const { data, error } = await supabase.from("properties").insert(payload).select().single();
      if (error) throw error;
      setProperties(p=>[data,...p]);
      showToast("Property added.","success"); setShowAdd(false); setForm(blank);
    } catch(e) { showToast(e.message,"error"); }
    finally { setSaving(false); }
  };

  const setStatus = async (status) => {
    if (!canEdit) return;
    const { error } = await supabase.from("properties").update({ status }).eq("id",sel);
    if (!error) { setProperties(p=>p.map(x=>x.id===sel?{...x,status}:x)); showToast("Status updated.","success"); }
  };

  const delProp = async () => {
    if (!canDel) return;
    if (!window.confirm("Delete this property?")) return;
    const { error } = await supabase.from("properties").delete().eq("id",sel);
    if (!error) { setProperties(p=>p.filter(x=>x.id!==sel)); setSel(null); showToast("Property deleted.","info"); }
  };

  return (
    <div className="fade-in" style={{ display:"flex", gap:14, height:"100%" }}>
      <div style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0 }}>
        <div style={{ display:"flex", gap:8, marginBottom:10, flexWrap:"wrap" }}>
          <select value={fType} onChange={e=>setFType(e.target.value)} style={{ width:"auto" }}>
            <option value="All">All types</option>{PROP_TYPES.map(t=><option key={t}>{t}</option>)}
          </select>
          <select value={fStatus} onChange={e=>setFStatus(e.target.value)} style={{ width:"auto" }}>
            <option value="All">All statuses</option>{["Available","Under Offer","Sold"].map(s=><option key={s}>{s}</option>)}
          </select>
          {canEdit && <div style={{ marginLeft:"auto" }}><Btn onClick={()=>setShowAdd(true)}>+ Add Property</Btn></div>}
        </div>
        <div style={{ fontSize:12, color:"#A0AEC0", marginBottom:8 }}>{filtered.length} propert{filtered.length!==1?"ies":"y"}</div>
        <div style={{ flex:1, overflowY:"auto", display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(255px,1fr))", gap:12, alignContent:"start" }}>
          {filtered.length===0 && <Empty icon="🏢" msg="No properties match filters"/>}
          {filtered.map(p=>{
            const sm=SM[p.status]||{}; const isSel=sel===p.id;
            return (
              <div key={p.id} onClick={()=>setSel(isSel?null:p.id)} className="ch"
                style={{ background:isSel?"#0B1F3A":"#fff", border:`1.5px solid ${isSel?"#C9A84C":"#E2E8F0"}`, borderRadius:12, padding:"14px 16px", cursor:"pointer" }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                  <TypeBadge type={p.type}/>
                  <span style={{ fontSize:11, fontWeight:600, padding:"3px 9px", borderRadius:20, background:isSel?"rgba(255,255,255,0.1)":sm.bg, color:sm.c }}>{p.status}</span>
                </div>
                <div style={{ fontWeight:700, fontSize:14, color:isSel?"#fff":"#0B1F3A", lineHeight:1.4, marginBottom:2 }}>{p.name}</div>
                {p.project_name && <div style={{ fontSize:11, color:isSel?"#C9A84C":"#718096", fontWeight:500, marginBottom:3 }}>🏗 {p.project_name}</div>}
                <div style={{ display:"flex", gap:5, marginBottom:8, flexWrap:"wrap" }}>
                  {p.classification && <span style={{ fontSize:10, fontWeight:600, padding:"2px 7px", borderRadius:20, background:isSel?"rgba(255,255,255,0.15)":"#F0F2F5", color:isSel?"#C9A84C":"#4A5568" }}>{p.classification}</span>}
                </div>
                <div style={{ fontSize:12, color:isSel?"#C9A84C88":"#A0AEC0", marginBottom:10 }}>📍 {p.location}</div>
                <div style={{ display:"flex", justifyContent:"space-between" }}>
                  <div style={{ fontFamily:"'Playfair Display',serif", fontWeight:700, fontSize:15, color:isSel?"#C9A84C":"#0B1F3A" }}>{fmtM(p.price)}</div>
                  <div style={{ fontSize:12, fontWeight:600, color:isSel?"#C9A84C":"#1A7F5A" }}>{p.roi}% ROI</div>
                </div>
                <div style={{ fontSize:11, color:isSel?"#C9A84C44":"#A0AEC0", marginTop:5 }}>
                  {(p.size||0).toLocaleString()} sq ft{p.bedrooms?` · ${p.bedrooms} BR`:""} · {p.completion}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selP && (
        <div className="slide-in" style={{ width:295, background:"#fff", border:"1px solid #E2E8F0", borderRadius:12, display:"flex", flexDirection:"column", flexShrink:0, overflow:"hidden" }}>
          <div style={{ background:"#0B1F3A", padding:"1.25rem", position:"relative" }}>
            <button onClick={()=>setSel(null)} style={{ position:"absolute", top:10, right:12, background:"none", border:"none", color:"#C9A84C", fontSize:20, cursor:"pointer" }}>×</button>
            <div style={{ fontSize:34 }}>{selP.type==="Luxury"?"🏰":selP.type==="Commercial"?"🏢":selP.type==="Off-plan"?"🏗":"🏠"}</div>
            <div style={{ marginTop:6 }}><TypeBadge type={selP.type}/></div>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:16, color:"#fff", fontWeight:700, marginTop:8, lineHeight:1.3 }}>{selP.name}</div>
            <div style={{ fontSize:12, color:"#C9A84C", marginTop:3 }}>📍 {selP.location}</div>
          </div>
          <div style={{ flex:1, overflowY:"auto", padding:"1rem" }}>
            {selP.project_name && (
              <div style={{ background:"#FDF3DC", border:"1px solid #E8C97A", borderRadius:8, padding:"8px 12px", marginBottom:10, display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:12 }}>🏗</span>
                <div>
                  <div style={{ fontSize:10, color:"#A06810", textTransform:"uppercase", letterSpacing:"0.5px", fontWeight:600 }}>Project</div>
                  <div style={{ fontSize:13, fontWeight:700, color:"#0B1F3A" }}>{selP.project_name}</div>
                </div>
              </div>
            )}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, background:"#FAFBFC", borderRadius:10, padding:"12px", marginBottom:12 }}>
              <FR label="Price"          value={fmtFull(selP.price)}/>
              <FR label="ROI"            value={`${selP.roi}%`}/>
              <FR label="Size"           value={`${(selP.size||0).toLocaleString()} sq ft`}/>
              <FR label="Bedrooms"       value={selP.bedrooms||"N/A"}/>
              <FR label="Classification" value={selP.classification||"—"}/>
              <FR label="Developer"      value={selP.developer}/>
              <FR label="Completion"     value={selP.completion}/>
              <FR label="Type"           value={selP.type}/>
            </div>
            {selP.description && <div style={{ fontSize:13, color:"#4A5568", lineHeight:1.65, marginBottom:14, padding:"10px", background:"#FAFBFC", borderRadius:8, border:"1px solid #E2E8F0" }}>{selP.description}</div>}
            {canEdit && (
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:10, color:"#A0AEC0", textTransform:"uppercase", letterSpacing:"0.6px", marginBottom:8, fontWeight:600 }}>Update Status</div>
                <div style={{ display:"flex", gap:6 }}>
                  {["Available","Under Offer","Sold"].map(s=>(
                    <button key={s} onClick={()=>setStatus(s)} style={{ flex:1, fontSize:11, padding:"6px 0", borderRadius:20, border:`1.5px solid ${selP.status===s?"#0B1F3A":"#E2E8F0"}`, background:selP.status===s?"#0B1F3A":"#fff", color:selP.status===s?"#fff":"#4A5568", cursor:"pointer", fontWeight:selP.status===s?700:400 }}>{s}</button>
                  ))}
                </div>
              </div>
            )}
            {canDel && <Btn variant="danger" small full onClick={delProp}>Delete Property</Btn>}
          </div>
        </div>
      )}

      {showAdd && (
        <Modal title="Add New Property" onClose={()=>setShowAdd(false)}>
          <FF label="Property Name" required><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Palm Jumeirah Villa"/></FF>
          <FF label="Project Name"><input value={form.project_name} onChange={e=>setForm(f=>({...f,project_name:e.target.value}))} placeholder="e.g. Emaar Beachfront, Creek Harbour…"/></FF>
          <G2>
            <FF label="Property Type"><select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>{PROP_TYPES.map(t=><option key={t}>{t}</option>)}</select></FF>
            <FF label="Classification">
              <select value={form.classification} onChange={e=>setForm(f=>({...f,classification:e.target.value}))}>
                <option value="">Select…</option>
                {["Villa","Flat","Building","Penthouse","Townhouse","Duplex","Studio","Office","Warehouse","Plot"].map(c=><option key={c}>{c}</option>)}
              </select>
            </FF>
          </G2>
          <G2>
            <FF label="Status"><select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>{["Available","Under Offer","Sold"].map(s=><option key={s}>{s}</option>)}</select></FF>
            <FF label="Location"><input value={form.location} onChange={e=>setForm(f=>({...f,location:e.target.value}))} placeholder="Palm Jumeirah, Dubai"/></FF>
          </G2>
          <G2>
            <FF label="Price (AED)"><input type="number" value={form.price} onChange={e=>setForm(f=>({...f,price:e.target.value}))} placeholder="5000000"/></FF>
            <FF label="Size (sq ft)"><input type="number" value={form.size} onChange={e=>setForm(f=>({...f,size:e.target.value}))} placeholder="2500"/></FF>
          </G2>
          <G2>
            <FF label="Bedrooms"><input type="number" value={form.bedrooms} onChange={e=>setForm(f=>({...f,bedrooms:e.target.value}))} placeholder="3 (blank for commercial)"/></FF>
            <FF label="ROI (%)"><input type="number" value={form.roi} onChange={e=>setForm(f=>({...f,roi:e.target.value}))} placeholder="7.5"/></FF>
          </G2>
          <G2>
            <FF label="Developer"><input value={form.developer} onChange={e=>setForm(f=>({...f,developer:e.target.value}))} placeholder="Emaar"/></FF>
            <FF label="Completion"><input value={form.completion} onChange={e=>setForm(f=>({...f,completion:e.target.value}))} placeholder="Ready or Q4 2027"/></FF>
          </G2>
          <FF label="Description"><textarea value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} rows={3} placeholder="Key selling points…"/></FF>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:6 }}>
            <Btn variant="outline" onClick={()=>setShowAdd(false)}>Cancel</Btn>
            <Btn onClick={save} disabled={saving}>{saving?"Saving…":"Save Property"}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// PIPELINE
// ═══════════════════════════════════════════════════════
function Pipeline({ leads, setLeads, currentUser, showToast }) {
  const [dragging,   setDragging]   = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const canEdit = can(currentUser.role,"write");

  const visible  = can(currentUser.role,"see_all") ? leads : leads.filter(l=>l.assigned_to===currentUser.id);
  const byStage  = STAGES.reduce((a,s)=>({...a,[s]:visible.filter(l=>l.stage===s)}),{});

  const onDrop = async (stage) => {
    if (!dragging||!canEdit) return;
    const { error } = await supabase.from("leads").update({ stage }).eq("id",dragging.id);
    if (!error) { setLeads(p=>p.map(l=>l.id===dragging.id?{...l,stage}:l)); }
    else showToast(error.message,"error");
    setDragging(null); setDropTarget(null);
  };

  return (
    <div className="fade-in" style={{ height:"100%", overflowX:"auto" }}>
      <div style={{ display:"flex", gap:10, height:"100%", minWidth:STAGES.length*188 }}>
        {STAGES.map(stage=>{
          const m=STAGE_META[stage]; const items=byStage[stage]||[];
          const total=items.reduce((s,l)=>s+(l.budget||0),0); const isDrop=dropTarget===stage;
          return (
            <div key={stage} onDragOver={e=>{ e.preventDefault(); setDropTarget(stage); }} onDragLeave={()=>setDropTarget(null)} onDrop={()=>onDrop(stage)}
              style={{ flex:1, minWidth:182, display:"flex", flexDirection:"column", background:isDrop?"#FDF8EE":"#F7F9FC", border:`1.5px ${isDrop?"dashed":"solid"} ${isDrop?"#C9A84C":"#E2E8F0"}`, borderRadius:12, overflow:"hidden", transition:"all 0.15s" }}>
              <div style={{ padding:"10px 12px", background:"#fff", borderBottom:"1px solid #F0F2F5" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:2 }}>
                  <span style={{ fontSize:10, fontWeight:700, color:m.c, textTransform:"uppercase", letterSpacing:"0.7px" }}>{stage}</span>
                  <span style={{ fontSize:12, fontWeight:700, background:m.bg, color:m.c, width:22, height:22, borderRadius:"50%", display:"inline-flex", alignItems:"center", justifyContent:"center" }}>{items.length}</span>
                </div>
                <div style={{ fontSize:11, color:"#A0AEC0" }}>{total>0?fmtM(total):"No value"}</div>
              </div>
              <div style={{ flex:1, overflowY:"auto", padding:"8px" }}>
                {items.length===0&&<div style={{ textAlign:"center", padding:"1.5rem 0.5rem", color:"#D1D9E6", fontSize:12 }}>Drop here</div>}
                {items.map(lead=>(
                  <div key={lead.id} draggable={canEdit} className="dcard"
                    onDragStart={()=>setDragging(lead)} onDragEnd={()=>{ setDragging(null); setDropTarget(null); }}
                    style={{ background:"#fff", border:"1px solid #E2E8F0", borderRadius:10, padding:"10px 11px", marginBottom:8, userSelect:"none", opacity:dragging?.id===lead.id?0.45:1, borderLeft:`3px solid ${m.c}` }}>
                    <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:6 }}>
                      <Av name={lead.name} size={26}/>
                      <div style={{ fontWeight:600, fontSize:12, color:"#0B1F3A", flex:1, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{lead.name}</div>
                    </div>
                    <TypeBadge type={lead.property_type}/>
                    <div style={{ fontFamily:"'Playfair Display',serif", fontSize:13, fontWeight:700, color:"#0B1F3A", marginTop:7 }}>{fmtM(lead.budget)}</div>
                    <div style={{ fontSize:10, color:"#A0AEC0", marginTop:3 }}>{fmtDate(lead.updated_at||lead.created_at)}</div>
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

// ═══════════════════════════════════════════════════════
// ACTIVITY LOG
// ═══════════════════════════════════════════════════════
function ActivityLog({ leads, activities, setActivities, currentUser, showToast }) {
  const [fType,   setFType]   = useState("All");
  const [fLead,   setFLead]   = useState("All");
  const [showAdd, setShowAdd] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [form, setForm]       = useState({ lead_id:"", type:"Call", note:"" });
  const canEdit = can(currentUser.role,"write");

  const filtered = useMemo(()=>[...activities]
    .sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))
    .filter(a=>(fType==="All"||a.type===fType)&&(fLead==="All"||a.lead_id===fLead))
  ,[activities,fType,fLead]);

  const save = async () => {
    if (!form.note.trim()||!form.lead_id) { showToast("Select a lead and enter a note.","error"); return; }
    setSaving(true);
    try {
      const lead = leads.find(l=>l.id===form.lead_id);
      const { data, error } = await supabase.from("activities").insert({ lead_id:form.lead_id, type:form.type, note:form.note, user_id:currentUser.id, user_name:currentUser.full_name, lead_name:lead?.name||"" }).select().single();
      if (error) throw error;
      setActivities(p=>[data,...p]);
      showToast("Activity logged.","success"); setShowAdd(false); setForm({ lead_id:"", type:"Call", note:"" });
    } catch(e) { showToast(e.message,"error"); }
    finally { setSaving(false); }
  };

  const del = async (id) => {
    if (!can(currentUser.role,"delete")) return;
    const { error } = await supabase.from("activities").delete().eq("id",id);
    if (!error) setActivities(p=>p.filter(a=>a.id!==id));
  };

  return (
    <div className="fade-in" style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      <div style={{ display:"flex", gap:8, marginBottom:10, flexWrap:"wrap" }}>
        <select value={fType} onChange={e=>setFType(e.target.value)} style={{ width:"auto" }}>
          <option value="All">All types</option>{ACT_TYPES.map(t=><option key={t}>{t}</option>)}
        </select>
        <select value={fLead} onChange={e=>setFLead(e.target.value)} style={{ width:"auto" }}>
          <option value="All">All leads</option>{leads.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        {canEdit && <div style={{ marginLeft:"auto" }}><Btn variant="gold" onClick={()=>setShowAdd(true)}>+ Log Activity</Btn></div>}
      </div>
      <div style={{ fontSize:12, color:"#A0AEC0", marginBottom:10 }}>{filtered.length} activit{filtered.length!==1?"ies":"y"}</div>
      <div style={{ flex:1, overflowY:"auto" }}>
        {filtered.length===0 && <Empty icon="📋" msg="No activities yet"/>}
        {filtered.map((act,idx)=>{
          const m=ACT_META[act.type]; const prev=filtered[idx-1];
          const showDate=!prev||new Date(prev.created_at).toDateString()!==new Date(act.created_at).toDateString();
          return (
            <div key={act.id}>
              {showDate && (
                <div style={{ display:"flex", alignItems:"center", gap:10, margin:"14px 0 8px" }}>
                  <div style={{ height:1, flex:1, background:"#E2E8F0" }}/>
                  <span style={{ fontSize:11, fontWeight:600, color:"#A0AEC0" }}>{fmtDate(act.created_at)}</span>
                  <div style={{ height:1, flex:1, background:"#E2E8F0" }}/>
                </div>
              )}
              <div style={{ display:"flex", gap:12, marginBottom:8, padding:"12px 14px", background:"#fff", border:"1px solid #E2E8F0", borderRadius:10 }}>
                <div style={{ width:38, height:38, borderRadius:10, background:m.bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>{m.icon}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4, flexWrap:"wrap" }}>
                    <span style={{ fontSize:13, fontWeight:700, color:m.c }}>{act.type}</span>
                    <span style={{ fontSize:12, color:"#718096" }}>with</span>
                    <span style={{ fontSize:13, fontWeight:600, color:"#0B1F3A" }}>{act.lead_name||"Unknown"}</span>
                  </div>
                  <div style={{ fontSize:13, color:"#4A5568", lineHeight:1.6, marginBottom:4 }}>{act.note}</div>
                  <div style={{ fontSize:11, color:"#A0AEC0" }}>Logged by {act.user_name} · {fmtDate(act.created_at)}</div>
                </div>
                {can(currentUser.role,"delete") && (
                  <button onClick={()=>del(act.id)} style={{ background:"none", border:"none", color:"#E2E8F0", fontSize:16, alignSelf:"flex-start", padding:0, transition:"color 0.15s" }} onMouseOver={e=>e.currentTarget.style.color="#B83232"} onMouseOut={e=>e.currentTarget.style.color="#E2E8F0"}>×</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showAdd && (
        <Modal title="Log New Activity" onClose={()=>setShowAdd(false)} width={460}>
          <FF label="Lead" required>
            <select value={form.lead_id} onChange={e=>setForm(f=>({...f,lead_id:e.target.value}))}>
              <option value="">Select a lead…</option>{leads.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </FF>
          <FF label="Activity Type">
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {ACT_TYPES.map(t=>(
                <button key={t} onClick={()=>setForm(f=>({...f,type:t}))} style={{ padding:"6px 14px", borderRadius:20, border:`1.5px solid ${form.type===t?"#0B1F3A":"#E2E8F0"}`, background:form.type===t?"#0B1F3A":"#fff", color:form.type===t?"#fff":"#4A5568", fontSize:13, cursor:"pointer", fontWeight:form.type===t?600:400 }}>
                  {ACT_META[t].icon} {t}
                </button>
              ))}
            </div>
          </FF>
          <FF label="Note / Summary" required><textarea value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))} rows={4} placeholder="What happened?"/></FF>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
            <Btn variant="outline" onClick={()=>setShowAdd(false)}>Cancel</Btn>
            <Btn variant="gold" onClick={save} disabled={saving}>{saving?"Saving…":"Save Activity"}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// ROOT APP
// ═══════════════════════════════════════════════════════
const TABS = [
  { id:"dashboard",  label:"Dashboard",      icon:"⊞", roles:["admin","manager","agent","viewer"] },
  { id:"leads",      label:"Leads",          icon:"👤", roles:["admin","manager","agent","viewer"] },
  { id:"master",     label:"Property DB",    icon:"🏗", roles:["admin","manager","agent","viewer"] },
  { id:"properties", label:"Listings",       icon:"🏢", roles:["admin","manager","agent","viewer"] },
  { id:"pipeline",   label:"Pipeline",       icon:"⬡", roles:["admin","manager","agent","viewer"] },
  { id:"activity",   label:"Activity Log",   icon:"📋", roles:["admin","manager","agent","viewer"] },
  { id:"users",      label:"Users",          icon:"👥", roles:["admin"] },
];
const SUBTITLES = {
  dashboard:  "Your sales overview at a glance",
  leads:      "Manage clients and track their journey",
  master:     "Projects → Categories → Buildings → Units — master property database",
  properties: "Quick property listings",
  pipeline:   "Drag deals across stages to update them",
  activity:   "Every call, email, visit and meeting — logged",
  users:      "Add, edit and manage team access",
};

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [checking,    setChecking]    = useState(true);
  const [leads,       setLeads]       = useState([]);
  const [properties,  setProperties]  = useState([]);
  const [activities,  setActivities]  = useState([]);
  const [users,       setUsers]       = useState([]);
  const [tab,         setTab]         = useState("dashboard");
  const [dataLoading, setDataLoading] = useState(false);
  const [toast,       setToast]       = useState(null);

  const showToast = (msg, type="success") => setToast({ msg, type });

  // Check existing session on load
  useEffect(() => {
    const restoreSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile } = await supabase
          .from("profiles").select("*").eq("id", session.user.id).single();
        if (profile && profile.is_active) {
          setCurrentUser({ ...session.user, ...profile });
        } else {
          await supabase.auth.signOut();
        }
      }
      setChecking(false);
    };
    restoreSession();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT") {
        setCurrentUser(null); setLeads([]); setProperties([]); setActivities([]);
      }
      if (event === "TOKEN_REFRESHED" && session?.user) {
        const { data: profile } = await supabase
          .from("profiles").select("*").eq("id", session.user.id).single();
        if (profile) setCurrentUser(u => ({ ...u, ...profile }));
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Load all data once logged in
  useEffect(() => {
    if (!currentUser) return;
    const loadData = async () => {
      setDataLoading(true);
      const [l, p, a, u] = await Promise.all([
        supabase.from("leads").select("*").order("created_at",{ascending:false}),
        supabase.from("properties").select("*").order("created_at",{ascending:false}),
        supabase.from("activities").select("*").order("created_at",{ascending:false}),
        supabase.from("profiles").select("*").order("created_at",{ascending:false}),
      ]);
      setLeads(l.data||[]);
      setProperties(p.data||[]);
      setActivities(a.data||[]);
      setUsers(u.data||[]);
      setDataLoading(false);
    };
    loadData();

    // Real-time subscriptions
    const leadsChannel = supabase.channel("leads-changes")
      .on("postgres_changes",{ event:"*", schema:"public", table:"leads" }, payload => {
        if (payload.eventType==="INSERT") setLeads(p=>[payload.new,...p]);
        if (payload.eventType==="UPDATE") setLeads(p=>p.map(l=>l.id===payload.new.id?payload.new:l));
        if (payload.eventType==="DELETE") setLeads(p=>p.filter(l=>l.id!==payload.old.id));
      }).subscribe();
    const actChannel = supabase.channel("act-changes")
      .on("postgres_changes",{ event:"INSERT", schema:"public", table:"activities" }, payload => {
        setActivities(p=>[payload.new,...p]);
      }).subscribe();

    return () => { supabase.removeChannel(leadsChannel); supabase.removeChannel(actChannel); };
  }, [currentUser]);

  const handleLogin  = (user) => { setCurrentUser(user); setTab("dashboard"); };
  const handleLogout = async () => { await supabase.auth.signOut(); setCurrentUser(null); };

  const userRole = currentUser?.role || "viewer";
  const visibleTabs = TABS.filter(t => t.roles.includes(userRole));

  if (checking) return (
    <>
      <GlobalStyle/>
      <div style={{ minHeight:"100vh", background:"#0B1F3A", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:32, color:"#fff", marginBottom:20 }}><span style={{ color:"#C9A84C" }}>◆</span> PropCRM</div>
          <Spinner msg=""/>
        </div>
      </div>
    </>
  );

  if (!currentUser) return <><GlobalStyle/><LoginScreen onLogin={handleLogin}/></>;

  return (
    <>
      <GlobalStyle/>
      <div style={{ display:"flex", flexDirection:"column", height:"100vh", background:"#F0F2F5", overflow:"hidden" }}>

        {/* Nav */}
        <div style={{ background:"#0B1F3A", display:"flex", alignItems:"center", padding:"0 1.5rem", height:54, flexShrink:0, gap:2, boxShadow:"0 2px 16px rgba(11,31,58,0.5)" }}>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:18, color:"#fff", fontWeight:700, marginRight:24, whiteSpace:"nowrap" }}>
            <span style={{ color:"#C9A84C" }}>◆</span> PropCRM
          </div>
          {visibleTabs.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)}
              style={{ padding:"6px 13px", borderRadius:8, border:"none", background:tab===t.id?"rgba(201,168,76,0.12)":"transparent", color:tab===t.id?"#C9A84C":"rgba(255,255,255,0.55)", fontSize:13, fontWeight:tab===t.id?600:400, cursor:"pointer", display:"flex", alignItems:"center", gap:6, transition:"all 0.15s", borderBottom:tab===t.id?"2px solid #C9A84C":"2px solid transparent" }}>
              <span style={{ fontSize:14 }}>{t.icon}</span>{t.label}
            </button>
          ))}
          <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ textAlign:"right", display:"flex", flexDirection:"column", gap:1 }}>
              <span style={{ fontSize:12, color:"#fff", fontWeight:500 }}>{currentUser.full_name}</span>
              <RoleBadge role={currentUser.role}/>
            </div>
            <Av name={currentUser.full_name||currentUser.email} size={32} bg="#C9A84C" tc="#0B1F3A"/>
            <button onClick={handleLogout} style={{ fontSize:11, color:"rgba(255,255,255,0.4)", background:"none", border:"1px solid rgba(255,255,255,0.1)", borderRadius:6, padding:"4px 10px", cursor:"pointer" }}>Sign Out</button>
          </div>
        </div>

        {/* Page title */}
        <div style={{ padding:"16px 1.5rem 10px", flexShrink:0 }}>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:21, fontWeight:700, color:"#0B1F3A" }}>{TABS.find(t=>t.id===tab)?.label}</div>
          <div style={{ fontSize:12, color:"#A0AEC0", marginTop:2 }}>{SUBTITLES[tab]}</div>
        </div>

        {/* Content */}
        <div style={{ flex:1, overflow:"hidden", padding:"0 1.5rem 1.5rem" }}>
          {dataLoading ? <Spinner msg="Loading your data…"/> : (<>
            {tab==="dashboard"  && <div style={{ height:"100%", overflowY:"auto", paddingRight:4 }}><Dashboard leads={leads} properties={properties} activities={activities} currentUser={currentUser}/></div>}
            {tab==="leads"      && <Leads      leads={leads} setLeads={setLeads} properties={properties} activities={activities} setActivities={setActivities} currentUser={currentUser} users={users} showToast={showToast}/>}
            {tab==="master"     && <PropertyMaster currentUser={currentUser} showToast={showToast}/>}
            {tab==="properties" && <Properties properties={properties} setProperties={setProperties} currentUser={currentUser} showToast={showToast}/>}
            {tab==="pipeline"   && <Pipeline   leads={leads} setLeads={setLeads} currentUser={currentUser} showToast={showToast}/>}
            {tab==="activity"   && <ActivityLog leads={leads} activities={activities} setActivities={setActivities} currentUser={currentUser} showToast={showToast}/>}
            {tab==="users"      && can(userRole,"manage_users") && <UserManagement currentUser={currentUser} leads={leads} activities={activities} showToast={showToast}/>}
          </>)}
        </div>
      </div>

      {toast && <Toast msg={toast.msg} type={toast.type} onDone={()=>setToast(null)}/>}
    </>
  );
}
