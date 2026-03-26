import { useState, useEffect } from "react";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL  = "https://ysceukgpimzfqixtnbnp.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzY2V1a2dwaW16ZnFpeHRuYm5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNDI5OTQsImV4cCI6MjA4OTkxODk5NH0.WZSyGeOEbiRo1wt13syheTOyiAToMWXInxIaBgaqq8k";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

export default function App() {
  const [status, setStatus] = useState("Connecting to Supabase...");
  const [session, setSession] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        setStatus("Supabase error: " + error.message);
      } else if (data.session) {
        setSession(data.session);
        setStatus("Connected! You are logged in.");
      } else {
        setStatus("Connected to Supabase! No active session — please log in.");
      }
    });
  }, []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  const login = async () => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMsg("Error: " + error.message);
    else { setMsg("Login success! User: " + data.user.email); setSession(data.session); }
  };

  return (
    <div style={{ fontFamily:"sans-serif", padding:"2rem", maxWidth:480, margin:"2rem auto" }}>
      <h1 style={{ fontSize:24, marginBottom:8 }}>PropCRM Connection Test</h1>
      <div style={{ padding:"12px 16px", background: status.includes("error") || status.includes("Error") ? "#FAEAEA" : "#E6F4EE", borderRadius:8, marginBottom:24, fontSize:14, color: status.includes("error") || status.includes("Error") ? "#B83232" : "#1A7F5A", fontWeight:600 }}>
        {status}
      </div>
      {!session && (
        <div>
          <p style={{ fontSize:14, marginBottom:16, color:"#4A5568" }}>Enter your credentials to test login:</p>
          <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" style={{ display:"block", width:"100%", padding:"10px", marginBottom:10, border:"1px solid #D1D9E6", borderRadius:8, fontSize:14, boxSizing:"border-box" }}/>
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" style={{ display:"block", width:"100%", padding:"10px", marginBottom:10, border:"1px solid #D1D9E6", borderRadius:8, fontSize:14, boxSizing:"border-box" }}/>
          <button onClick={login} style={{ width:"100%", padding:"10px", background:"#0B1F3A", color:"#fff", border:"none", borderRadius:8, fontSize:14, fontWeight:600, cursor:"pointer" }}>Test Login</button>
          {msg && <div style={{ marginTop:12, padding:"10px", background: msg.includes("Error") ? "#FAEAEA" : "#E6F4EE", borderRadius:8, fontSize:13, color: msg.includes("Error") ? "#B83232" : "#1A7F5A" }}>{msg}</div>}
        </div>
      )}
      {session && (
        <div style={{ background:"#E6F4EE", borderRadius:8, padding:"16px" }}>
          <p style={{ fontSize:14, color:"#1A7F5A", fontWeight:600 }}>✓ Logged in as: {session.user.email}</p>
          <p style={{ fontSize:13, color:"#4A5568", marginTop:8 }}>Supabase connection is working. The full CRM can now be loaded.</p>
        </div>
      )}
    </div>
  );
}
