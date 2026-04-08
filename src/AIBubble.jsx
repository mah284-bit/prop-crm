import { useState, useEffect, useRef } from "react";

const AI_PROVIDERS = [
  {
    id:"groq", name:"Groq", badge:"FREE",
    placeholder:"Get free key at console.groq.com",
    link:"https://console.groq.com",
    call: async (key, sys, msgs) => {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":"Bearer "+key},
        body:JSON.stringify({model:"llama-3.3-70b-versatile",messages:[{role:"system",content:sys},...msgs],max_tokens:1024,temperature:0.7})
      });
      if(!res.ok){const e=await res.json();throw new Error(e.error?.message||"Groq error");}
      return (await res.json()).choices[0]?.message?.content||"";
    }
  },
  {
    id:"gemini", name:"Gemini", badge:"FREE",
    placeholder:"Get free key at aistudio.google.com",
    link:"https://aistudio.google.com",
    call: async (key, sys, msgs) => {
      const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key="+key, {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({system_instruction:{parts:[{text:sys}]},contents:msgs.map(m=>({role:m.role==="assistant"?"model":"user",parts:[{text:m.content}]})),generationConfig:{maxOutputTokens:1024}})
      });
      if(!res.ok){const e=await res.json();throw new Error(e.error?.message||"Gemini error");}
      return (await res.json()).candidates[0]?.content?.parts[0]?.text||"";
    }
  },
  {
    id:"claude", name:"Claude", badge:"PAID",
    placeholder:"Get key at console.anthropic.com",
    link:"https://console.anthropic.com",
    call: async (key, sys, msgs) => {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{"Content-Type":"application/json","x-api-key":key,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
        body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1024,system:sys,messages:msgs})
      });
      if(!res.ok){const e=await res.json();throw new Error(e.error?.message||"Claude error");}
      return (await res.json()).content[0]?.text||"";
    }
  }
];

export default function AIBubble() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([]);
  const [inp, setInp] = useState("");
  const [busy, setBusy] = useState(false);
  const [provId, setProvId] = useState(() => localStorage.getItem("propccrm_ai_provider") || "groq");
  const [key, setKey] = useState(() => localStorage.getItem("propccrm_ai_key_" + (localStorage.getItem("propccrm_ai_provider") || "groq")) || "");
  const [cfg, setCfg] = useState(false);
  const [nm, setNm] = useState("Prop AI");
  const endRef = useRef(null);

  const prov = AI_PROVIDERS.find(p => p.id === provId) || AI_PROVIDERS[0];
  const hasKey = !!key.trim();

  useEffect(() => {
    if (open && endRef.current) endRef.current.scrollIntoView({ behavior: "smooth" });
  }, [msgs, open]);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("propccrm_user") || "null");
    if (user) {
      const name = user.ai_assistant_name || (user.full_name?.split(" ")[0] || "Prop") + " AI";
      setNm(name);
    }
  }, [open]);

  useEffect(() => {
    const handler = e => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") { e.preventDefault(); setOpen(o => !o); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const saveKey = k => { setKey(k); localStorage.setItem("propccrm_ai_key_" + provId, k); };
  const changeProv = id => {
    setProvId(id);
    localStorage.setItem("propccrm_ai_provider", id);
    setKey(localStorage.getItem("propccrm_ai_key_" + id) || "");
  };

  const buildCtx = () => {
    try {
      const leads = JSON.parse(localStorage.getItem("propccrm_leads_cache") || "[]");
      const units = JSON.parse(localStorage.getItem("propccrm_units_cache") || "[]");
      const user = JSON.parse(localStorage.getItem("propccrm_user") || "{}");
      const avail = units.filter(u => u.status === "Available").length;
      return "You are " + nm + ", an AI assistant for a Dubai real estate CRM called PropCRM.\n" +
        "User: " + (user.full_name || "Agent") + " (" + (user.role || "agent") + ")\n" +
        "Live data: " + leads.length + " leads, " + units.length + " units (" + avail + " available)\n" +
        "Be concise, professional, and use bullet points. Match the user's language.";
    } catch(e) {
      return "You are an AI assistant for PropCRM, a Dubai real estate CRM. Be helpful and concise.";
    }
  };

  const send = async t => {
    const q = (t || inp).trim();
    if (!q || busy) return;
    if (!hasKey) { setCfg(true); return; }
    setInp("");
    const next = [...msgs, { role: "user", content: q }];
    setMsgs(next);
    setBusy(true);
    try {
      const reply = await prov.call(key, buildCtx(), next);
      setMsgs(m => [...m, { role: "assistant", content: reply }]);
    } catch(e) {
      setMsgs(m => [...m, { role: "assistant", content: "Error: " + e.message }]);
    } finally {
      setBusy(false);
    }
  };

  const QUICK = ["Pipeline summary", "Available units", "Hot leads", "Draft WhatsApp", "Stale deals"];

  const bubbleStyle = {
    position:"fixed", bottom:28, right:28, zIndex:99999,
    width:60, height:60, borderRadius:"50%", border:"none", cursor:"pointer",
    background:"linear-gradient(135deg,#C9A84C,#E8C97A)",
    boxShadow:"0 4px 20px rgba(201,168,76,.6), 0 0 0 4px rgba(201,168,76,.15)",
    display:"flex", alignItems:"center", justifyContent:"center",
    fontSize:26, color:"#0B1F3A", transition:"transform .2s"
  };

  const panelStyle = {
    position:"fixed", bottom:20, right:20, zIndex:99999,
    width:420, height:660, maxHeight:"90vh",
    background:"linear-gradient(160deg,#0B1F3A 0%,#0f2847 100%)",
    borderRadius:20, boxShadow:"0 24px 80px rgba(0,0,0,.7), 0 0 0 1px rgba(201,168,76,.3)",
    display:"flex", flexDirection:"column", overflow:"hidden",
    fontFamily:"'DM Sans',system-ui,sans-serif"
  };

  if (!open) {
    return (
      <button style={bubbleStyle} onClick={() => setOpen(true)} title={"Open " + nm + " (Ctrl+K)"}>
        ✦
      </button>
    );
  }

  return (
    <div style={panelStyle}>
      <div style={{padding:"14px 16px", borderBottom:"1px solid rgba(201,168,76,.25)", display:"flex", alignItems:"center", gap:8, background:"rgba(201,168,76,.06)"}}>
        <div style={{width:32, height:32, borderRadius:8, background:"linear-gradient(135deg,#C9A84C,#8A6200)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, flexShrink:0}}>✦</div>
        <div style={{flex:1}}>
          <div style={{fontFamily:"'Playfair Display',serif", fontSize:14, fontWeight:700, color:"#E8C97A"}}>{nm}</div>
          <div style={{fontSize:10, color:"rgba(201,168,76,.5)", textTransform:"uppercase", letterSpacing:"1px"}}>Real Estate Intelligence</div>
        </div>
        <button onClick={() => setCfg(v => !v)} style={{background:"none", border:"1px solid rgba(201,168,76,.3)", color:"#C9A84C", borderRadius:6, padding:"3px 8px", fontSize:11, cursor:"pointer"}}>{prov.name}</button>
        {msgs.length > 0 && <button onClick={() => setMsgs([])} style={{background:"none", border:"none", color:"rgba(255,255,255,.4)", cursor:"pointer", fontSize:16}}>↺</button>}
        <button onClick={() => setOpen(false)} style={{background:"none", border:"none", color:"rgba(255,255,255,.5)", cursor:"pointer", fontSize:20, lineHeight:1}}>×</button>
      </div>

      {cfg && (
        <div style={{padding:"12px 16px", borderBottom:"1px solid rgba(255,255,255,.08)", background:"rgba(0,0,0,.2)"}}>
          <div style={{display:"flex", gap:6, marginBottom:8}}>
            {AI_PROVIDERS.map(p => (
              <button key={p.id} onClick={() => changeProv(p.id)} style={{flex:1, padding:"5px 4px", borderRadius:7, border:"1.5px solid", borderColor:provId===p.id?"#C9A84C":"rgba(255,255,255,.15)", background:provId===p.id?"rgba(201,168,76,.15)":"transparent", color:provId===p.id?"#C9A84C":"rgba(255,255,255,.4)", fontSize:11, fontWeight:600, cursor:"pointer"}}>
                {p.name}
                <span style={{display:"block", fontSize:9, color:provId===p.id?"#C9A84C":"rgba(255,255,255,.3)"}}>{p.badge}</span>
              </button>
            ))}
          </div>
          <input value={key} onChange={e => saveKey(e.target.value)} placeholder={prov.placeholder} type="password" style={{width:"100%", background:"rgba(255,255,255,.07)", border:"1px solid rgba(255,255,255,.15)", borderRadius:7, padding:"7px 10px", color:"#fff", fontSize:12, boxSizing:"border-box", outline:"none"}} />
          {hasKey
            ? <div style={{marginTop:5, fontSize:11, color:"#1A7F5A"}}>✓ Key saved</div>
            : <a href={prov.link} target="_blank" rel="noreferrer" style={{display:"block", marginTop:5, fontSize:11, color:"#C9A84C", textDecoration:"none"}}>Get free API key →</a>
          }
        </div>
      )}

      <div style={{flex:1, overflowY:"auto", padding:"12px 14px", display:"flex", flexDirection:"column", gap:10}}>
        {msgs.length === 0 && (
          <div style={{textAlign:"center", padding:"24px 0 16px"}}>
            <div style={{fontSize:32, marginBottom:8}}>✦</div>
            <div style={{color:"#E8C97A", fontSize:15, fontWeight:600, marginBottom:4, fontFamily:"'Playfair Display',serif"}}>{hasKey ? "How can I help?" : "Configure to start"}</div>
            <div style={{fontSize:12, color:"rgba(255,255,255,.4)", marginBottom:16}}>{hasKey ? "Ask anything about your pipeline, leads or units" : "Click " + prov.name + " above and add your API key"}</div>
            {hasKey && (
              <div style={{display:"flex", flexWrap:"wrap", gap:7, justifyContent:"center"}}>
                {QUICK.map(q => (
                  <button key={q} onClick={() => send(q)} style={{padding:"7px 12px", borderRadius:20, border:"1px solid rgba(201,168,76,.25)", background:"rgba(201,168,76,.08)", color:"rgba(255,255,255,.75)", fontSize:12, cursor:"pointer"}}>
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} style={{display:"flex", justifyContent:m.role==="user"?"flex-end":"flex-start", gap:8}}>
            {m.role === "assistant" && <div style={{width:24, height:24, borderRadius:6, flexShrink:0, marginTop:2, background:"linear-gradient(135deg,#C9A84C,#8A6200)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11}}>✦</div>}
            <div style={{maxWidth:"82%", padding:"9px 13px", borderRadius:m.role==="user"?"14px 14px 4px 14px":"14px 14px 14px 4px", background:m.role==="user"?"linear-gradient(135deg,#C9A84C,#a87e30)":"rgba(255,255,255,.08)", color:m.role==="user"?"#0B1F3A":"rgba(255,255,255,.88)", fontSize:13, lineHeight:1.6, whiteSpace:"pre-wrap", wordBreak:"break-word"}}>
              {m.content}
            </div>
          </div>
        ))}
        {busy && (
          <div style={{display:"flex", alignItems:"center", gap:8}}>
            <div style={{width:24, height:24, borderRadius:6, background:"linear-gradient(135deg,#C9A84C,#8A6200)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11}}>✦</div>
            <div style={{color:"rgba(255,255,255,.4)", fontSize:13}}>Thinking...</div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div style={{padding:"10px 12px", borderTop:"1px solid rgba(255,255,255,.08)", background:"rgba(0,0,0,.15)"}}>
        <div style={{display:"flex", gap:7, alignItems:"center"}}>
          <input
            value={inp}
            onChange={e => setInp(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={hasKey ? "Ask anything... (Enter to send)" : "Add API key above to start"}
            disabled={!hasKey || busy}
            style={{flex:1, background:"rgba(255,255,255,.08)", border:"1px solid rgba(255,255,255,.12)", borderRadius:10, padding:"9px 12px", color:"#fff", fontSize:13, outline:"none", opacity:hasKey?1:.5}}
          />
          <button onClick={() => send()} disabled={!hasKey || busy || !inp.trim()} style={{width:42, height:42, borderRadius:10, border:"none", background:hasKey&&inp.trim()?"linear-gradient(135deg,#C9A84C,#8A6200)":"rgba(255,255,255,.1)", color:hasKey&&inp.trim()?"#0B1F3A":"rgba(255,255,255,.3)", cursor:hasKey&&inp.trim()?"pointer":"not-allowed", fontSize:18, flexShrink:0}}>
            ↑
          </button>
        </div>
        <div style={{marginTop:5, fontSize:10, color:"rgba(255,255,255,.2)", textAlign:"center"}}>Ctrl+K to toggle · {prov.name} powered</div>
      </div>
    </div>
  );
}
