import { useState, useEffect, useRef, useCallback } from "react";

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

function getLiveData() {
  try {
    // Trigger App to refresh window globals
    window.dispatchEvent(new CustomEvent("propcrm_ai_data_request"));
    return {
      leads: window.__propcrm_leads || [],
      units: window.__propcrm_units || [],
      projects: window.__propcrm_projects || [],
      user: window.__propcrm_user || {},
    };
  } catch(e) { return { leads:[], units:[], projects:[], user:{} }; }
}

function MsgContent({ content, role }) {
  if (role === "user") return <span>{content}</span>;
  return (
    <div>
      {content.split("\n").map((line, i) => {
        const t = line.trim();
        if (!t) return <div key={i} style={{height:5}}/>;
        if (t.match(/^[•\-\*]\s/)) return (
          <div key={i} style={{display:"flex",gap:8,marginBottom:5,alignItems:"flex-start"}}>
            <span style={{color:"#8A6200",fontWeight:700,flexShrink:0}}>◆</span>
            <span style={{color:"#2C1810"}}>{t.replace(/^[•\-\*]\s/,"")}</span>
          </div>
        );
        if (t.endsWith(":") && t.length < 50) return (
          <div key={i} style={{fontWeight:700,color:"#5C3A00",marginTop:10,marginBottom:5,fontSize:11,textTransform:"uppercase",letterSpacing:"1px",borderBottom:"1px solid rgba(139,96,0,.2)",paddingBottom:3}}>{t}</div>
        );
        // Handle **bold** markdown
        if (t.includes("**")) {
          const parts = t.split(/\*\*(.*?)\*\*/g);
          return (
            <div key={i} style={{marginBottom:3,color:"#2C1810"}}>
              {parts.map((p,j) => j%2===1
                ? <strong key={j} style={{color:"#5C3A00"}}>{p}</strong>
                : <span key={j}>{p}</span>
              )}
            </div>
          );
        }
        return <div key={i} style={{marginBottom:3,color:"#2C1810"}}>{t}</div>;
      })}
    </div>
  );
}

const CSS = `
  @keyframes ai-bounce { from{transform:translateY(0)} to{transform:translateY(-4px)} }
  @keyframes ai-shimmer { 0%,100%{opacity:.6} 50%{opacity:1} }
  .ai-quick:hover { background:rgba(139,96,0,.12) !important; border-color:rgba(139,96,0,.5) !important; transform:translateY(-1px); box-shadow:0 4px 12px rgba(139,96,0,.15); }
  .ai-input:focus { border-color:rgba(139,96,0,.5) !important; box-shadow:0 0 0 3px rgba(201,168,76,.12); }
`;

export default function AIBubble() {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [msgs, setMsgs] = useState([]);
  const [inp, setInp] = useState("");
  const [busy, setBusy] = useState(false);
  const [provId, setProvId] = useState(() => localStorage.getItem("propccrm_ai_provider") || "groq");
  const [key, setKey] = useState(() => localStorage.getItem("propccrm_ai_key_"+(localStorage.getItem("propccrm_ai_provider")||"groq"))||"");
  const [cfg, setCfg] = useState(false);
  const [nm, setNm] = useState("Al AI");
  const [stats, setStats] = useState({ leads:0, avail:0 });
  const [dataReady, setDataReady] = useState(false);
  const [pos, setPos] = useState({ x:null, y:null });
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef({x:0,y:0});
  const panelRef = useRef(null);
  const endRef = useRef(null);
  const inputRef = useRef(null);

  const prov = AI_PROVIDERS.find(p=>p.id===provId)||AI_PROVIDERS[0];
  const hasKey = !!key.trim();

  useEffect(() => {
    const refresh = () => {
      try {
        const co = JSON.parse(localStorage.getItem("propccrm_company_cache")||"null");
        if (co?.name) setNm(co.ai_assistant_name || (co.name.split(" ")[0]+" AI"));
      } catch(e) {}
      const d = getLiveData();
      setStats({ leads:d.leads.length, avail:d.units.filter(u=>u.status==="Available").length });
    };
    refresh();
    const t = setInterval(refresh, 1500);
    // Check data readiness every second
    const check = setInterval(()=>{
      const d = getLiveData();
      if(d.leads.length>0 || d.units.length>0){ setDataReady(true); clearInterval(check); }
    }, 500);
    return () => { clearInterval(t); };
  }, []);

  useEffect(() => {
    if (open&&!minimized&&endRef.current) endRef.current.scrollIntoView({behavior:"smooth"});
  }, [msgs,open,minimized]);

  useEffect(() => {
    if (open&&!minimized&&inputRef.current) setTimeout(()=>inputRef.current?.focus(),120);
  }, [open,minimized]);

  useEffect(() => {
    const h = e => {
      if ((e.ctrlKey||e.metaKey)&&e.key==="k") { e.preventDefault(); open&&minimized?setMinimized(false):setOpen(o=>!o); }
    };
    window.addEventListener("keydown",h);
    return ()=>window.removeEventListener("keydown",h);
  }, [open,minimized]);

  const onMouseDown = useCallback(e => {
    if (e.target.closest("button")||e.target.closest("input")) return;
    setDragging(true);
    const r = panelRef.current.getBoundingClientRect();
    dragOffset.current = {x:e.clientX-r.left, y:e.clientY-r.top};
    e.preventDefault();
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const mv = e => {
      const w = panelRef.current?.offsetWidth||440;
      const h = panelRef.current?.offsetHeight||60;
      setPos({
        x:Math.max(0,Math.min(e.clientX-dragOffset.current.x, window.innerWidth-w)),
        y:Math.max(0,Math.min(e.clientY-dragOffset.current.y, window.innerHeight-h))
      });
    };
    const up = ()=>setDragging(false);
    window.addEventListener("mousemove",mv);
    window.addEventListener("mouseup",up);
    return ()=>{window.removeEventListener("mousemove",mv);window.removeEventListener("mouseup",up);};
  }, [dragging]);

  const saveKey = k => { setKey(k); localStorage.setItem("propccrm_ai_key_"+provId,k); };
  const changeProv = id => { setProvId(id); localStorage.setItem("propccrm_ai_provider",id); setKey(localStorage.getItem("propccrm_ai_key_"+id)||""); };

  const buildCtx = () => {
    const {leads,units,projects,user} = getLiveData();
    const avail = units.filter(u=>u.status==="Available");
    const active = leads.filter(l=>!["Closed Won","Closed Lost"].includes(l.stage));
    const pipeline = {};
    active.forEach(l=>{pipeline[l.stage]=(pipeline[l.stage]||0)+1;});
    return (
      "You are "+nm+", a premium AI real estate concierge for PropCRM — Dubai's luxury CRM.\n"+
      "User: "+(user.full_name||"Agent")+" ("+(user.role||"agent")+")\n"+
      "Date: "+new Date().toLocaleDateString("en-AE",{weekday:"long",day:"numeric",month:"long",year:"numeric"})+"\n\n"+
      "LIVE DATA:\n"+
      "Leads: "+leads.length+" total, "+active.length+" active\n"+
      "Pipeline: "+Object.entries(pipeline).map(([s,c])=>"  • "+s+": "+c).join("\n")+"\n"+
      "Won: "+leads.filter(l=>l.stage==="Closed Won").length+" · Lost: "+leads.filter(l=>l.stage==="Closed Lost").length+"\n\n"+
      "Recent leads:\n"+leads.slice(0,6).map(l=>"  • "+l.name+" | "+l.stage+" | AED "+(l.budget?Number(l.budget).toLocaleString():"TBD")).join("\n")+"\n\n"+
      "Inventory: "+units.length+" total, "+avail.length+" available\n"+
      "Projects: "+projects.map(p=>p.name).join(", ")+"\n\n"+
      "Available units (first 12):\n"+avail.slice(0,12).map(u=>"  • "+u.unit_ref+" | "+(u.sub_type||u.unit_type||"")+" | "+(u.bedrooms===0?"Studio":u.bedrooms+"BR")+" | "+(u.view||"")).join("\n")+"\n\n"+
      "STYLE: You are a luxury Dubai real estate concierge — warm, confident, precise. Use bullet points with •. Section headers in CAPS with colon. Under 180 words. End with one action tip. Match user's language."
    );
  };

  const send = async t => {
    const q = (t||inp).trim();
    if (!q||busy) return;
    if (!hasKey) { setCfg(true); return; }
    setInp(""); setMinimized(false);
    const next = [...msgs,{role:"user",content:q}];
    setMsgs(next); setBusy(true);
    try {
      const reply = await prov.call(key,buildCtx(),next);
      setMsgs(m=>[...m,{role:"assistant",content:reply}]);
    } catch(e) {
      setMsgs(m=>[...m,{role:"assistant",content:"⚠️ "+e.message}]);
    } finally { setBusy(false); }
  };

  const QUICK = [
    {icon:"📊",label:"Pipeline summary"},
    {icon:"🏠",label:"Available units"},
    {icon:"🔥",label:"Hot leads"},
    {icon:"💬",label:"Draft WhatsApp"},
    {icon:"⏰",label:"Stale deals"},
    {icon:"📈",label:"Revenue forecast"},
  ];

  const posStyle = pos.x!==null ? {left:pos.x,top:pos.y,bottom:"auto",right:"auto"} : {bottom:20,right:20};

  const initial = nm.charAt(0).toUpperCase();
  if (!open) return (
    <div style={{position:"fixed",bottom:20,right:20,zIndex:99999}}>
      <style>{`
        @keyframes ai-ring{0%{transform:scale(1);opacity:.6}70%{transform:scale(1.6);opacity:0}100%{transform:scale(1.6);opacity:0}}
        .ai-bubble-btn:hover{transform:scale(1.08)!important;box-shadow:0 12px 36px rgba(201,168,76,.7),0 2px 8px rgba(0,0,0,.3)!important}
        .ai-bubble-btn:hover .ai-ring{animation-play-state:running}
      `}</style>
      <div className="ai-ring" style={{
        position:"absolute",inset:-6,borderRadius:"50%",
        border:"2px solid rgba(201,168,76,.5)",
        animation:"ai-ring 2s ease-out infinite"
      }}/>
      <button className="ai-bubble-btn" onClick={()=>setOpen(true)} title={"Open "+nm+" · Ctrl+K"}
        style={{position:"relative",width:64,height:64,borderRadius:"50%",border:"none",cursor:"pointer",
          background:"linear-gradient(135deg,#0B1F3A 0%,#1A3558 100%)",
          boxShadow:"0 8px 28px rgba(11,31,58,.6),0 0 0 2px #C9A84C,0 0 0 4px rgba(201,168,76,.2)",
          display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:1,
          transition:"all .25s"}}>
        <span style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:700,color:"#C9A84C",lineHeight:1}}>{initial}</span>
        <span style={{fontSize:8,color:"rgba(201,168,76,.6)",letterSpacing:"1.5px",textTransform:"uppercase",lineHeight:1}}>AI</span>
      </button>
    </div>
  );

  if (minimized) return (
    <div ref={panelRef} onMouseDown={onMouseDown}
      style={{position:"fixed",...posStyle,zIndex:99999,
        width:240,height:48,
        background:"linear-gradient(135deg,#0B1F3A,#1A3558)",
        border:"1px solid rgba(201,168,76,.4)",
        borderRadius:24,boxShadow:"0 8px 28px rgba(0,0,0,.35),0 0 0 1px rgba(201,168,76,.1)",
        display:"flex",alignItems:"center",gap:10,padding:"0 14px",
        cursor:"grab",userSelect:"none"}}>
      <div style={{width:28,height:28,borderRadius:"50%",flexShrink:0,
        background:"linear-gradient(135deg,#C9A84C,#8A6200)",
        display:"flex",alignItems:"center",justifyContent:"center",
        fontFamily:"'Playfair Display',serif",fontSize:14,fontWeight:700,color:"#0B1F3A"}}>
        {initial}
      </div>
      <div style={{flex:1,fontFamily:"'Playfair Display',serif",fontSize:13,fontWeight:600,color:"#E8C97A",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{nm}</div>
      <button onClick={()=>setMinimized(false)} style={{background:"none",border:"none",color:"rgba(201,168,76,.7)",cursor:"pointer",fontSize:14}}>▲</button>
      <button onClick={()=>setOpen(false)} style={{background:"none",border:"none",color:"rgba(255,255,255,.4)",cursor:"pointer",fontSize:18}}>×</button>
    </div>
  );

  return (
    <div ref={panelRef} style={{
      position:"fixed",...posStyle,zIndex:99999,
      width:440,height:680,maxHeight:"92vh",
      background:"linear-gradient(165deg,#FEFCF8 0%,#FBF7EE 50%,#F7F0E0 100%)",
      border:"1px solid rgba(201,168,76,.4)",
      borderRadius:20,
      boxShadow:"0 24px 64px rgba(0,0,0,.25),0 4px 16px rgba(201,168,76,.2),inset 0 1px 0 rgba(255,255,255,.9)",
      display:"flex",flexDirection:"column",overflow:"hidden",
      fontFamily:"'DM Sans',system-ui,sans-serif",
      cursor:dragging?"grabbing":"default"
    }}>
      <style>{CSS}</style>

      {/* Header */}
      <div onMouseDown={onMouseDown} style={{
        padding:"14px 16px",cursor:"grab",flexShrink:0,
        background:"linear-gradient(135deg,#0B1F3A 0%,#162d4a 100%)",backgroundSize:"200% 200%",
        borderBottom:"3px solid #C9A84C",
        display:"flex",alignItems:"center",gap:10
      }}>
        <div style={{
          width:38,height:38,borderRadius:"50%",flexShrink:0,
          background:"linear-gradient(135deg,#C9A84C,#E8C97A)",
          boxShadow:"0 3px 10px rgba(201,168,76,.5),0 0 0 2px rgba(255,255,255,.2)",
          display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:0,color:"#0B1F3A"
        }}>
          <span style={{fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:700,lineHeight:1}}>{initial}</span>
          <span style={{fontSize:7,letterSpacing:"1px",fontWeight:600,lineHeight:1}}>AI</span>
        </div>
        <div style={{flex:1}}>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:16,fontWeight:700,color:"#F0D98A",letterSpacing:".3px"}}>{nm}</div>
          <div style={{fontSize:9,color:"rgba(201,168,76,.65)",textTransform:"uppercase",letterSpacing:"2px",marginTop:1}}>Real Estate Intelligence</div>
        </div>
        <button onClick={e=>{e.stopPropagation();setCfg(v=>!v);}}
          style={{background:cfg?"rgba(201,168,76,.25)":"rgba(255,255,255,.1)",border:"1px solid rgba(201,168,76,.4)",color:"#E8C97A",borderRadius:7,padding:"4px 10px",fontSize:11,fontWeight:600,cursor:"pointer"}}>
          {prov.name}
        </button>
        {msgs.length>0&&<button onClick={e=>{e.stopPropagation();setMsgs([]);}}
          style={{background:"none",border:"none",color:"rgba(255,255,255,.5)",cursor:"pointer",fontSize:15,padding:"4px"}}>↺</button>}
        <button onClick={e=>{e.stopPropagation();setMinimized(true);}}
          style={{background:"none",border:"none",color:"rgba(255,255,255,.5)",cursor:"pointer",fontSize:13,padding:"4px"}}>▼</button>
        <button onClick={e=>{e.stopPropagation();setOpen(false);}}
          style={{background:"none",border:"none",color:"rgba(255,255,255,.4)",cursor:"pointer",fontSize:19,padding:"4px",lineHeight:1}}>×</button>
      </div>

      {/* Config */}
      {cfg&&(
        <div style={{padding:"12px 16px",borderBottom:"1px solid rgba(201,168,76,.25)",background:"#F5EDD8",flexShrink:0}}>
          <div style={{display:"flex",gap:6,marginBottom:10}}>
            {AI_PROVIDERS.map(p=>(
              <button key={p.id} onClick={()=>changeProv(p.id)} style={{
                flex:1,padding:"7px 4px",borderRadius:8,cursor:"pointer",fontWeight:600,fontSize:11,
                border:"1.5px solid",borderColor:provId===p.id?"#8A6200":"rgba(139,96,0,.25)",
                background:provId===p.id?"rgba(139,96,0,.12)":"rgba(255,255,255,.6)",
                color:provId===p.id?"#5C3A00":"#8A7A6A"
              }}>
                {p.name}<span style={{display:"block",fontSize:9,marginTop:1,color:provId===p.id?"#8A6200":"#A09080"}}>{p.badge}</span>
              </button>
            ))}
          </div>
          <input value={key} onChange={e=>saveKey(e.target.value)} placeholder={prov.placeholder} type="password"
            style={{width:"100%",background:"#fff",border:"1px solid rgba(139,96,0,.3)",borderRadius:8,padding:"8px 12px",color:"#2C1810",fontSize:12,boxSizing:"border-box",outline:"none"}}/>
          {hasKey
            ?<div style={{marginTop:6,fontSize:11,color:"#1A7F5A",fontWeight:600}}>✓ API key saved</div>
            :<a href={prov.link} target="_blank" rel="noreferrer" style={{display:"block",marginTop:6,fontSize:11,color:"#8A6200",textDecoration:"none",fontWeight:500}}>→ Get your free API key</a>
          }
        </div>
      )}

      {/* Messages */}
      <div style={{flex:1,overflowY:"auto",padding:"16px",display:"flex",flexDirection:"column",gap:12}}>
        {msgs.length===0&&(
          <div>
            {/* Hero area */}
            <div style={{textAlign:"center",padding:"16px 0 20px",
              borderBottom:"1px solid rgba(201,168,76,.2)",marginBottom:18}}>
              <div style={{
                width:64,height:64,borderRadius:"50%",margin:"0 auto 14px",
                background:"linear-gradient(135deg,#0B1F3A,#162d4a)",
                boxShadow:"0 6px 20px rgba(11,31,58,.3),0 0 0 3px rgba(201,168,76,.3),0 0 0 6px rgba(201,168,76,.1)",
                display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:1
              }}>
                <span style={{fontFamily:"'Playfair Display',serif",fontSize:26,fontWeight:700,color:"#C9A84C",lineHeight:1}}>{initial}</span>
                <span style={{fontSize:9,color:"rgba(201,168,76,.6)",letterSpacing:"2px",fontWeight:600}}>AI</span>
              </div>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,color:"#0B1F3A",marginBottom:4}}>{nm}</div>
              <div style={{fontSize:11,color:"#8A7A6A",letterSpacing:".5px",marginBottom:10}}>YOUR REAL ESTATE CONCIERGE</div>
              {hasKey
                ?<div style={{fontSize:12,color:"#5C4A2A",background:"rgba(201,168,76,.12)",borderRadius:20,padding:"5px 14px",display:"inline-block",border:"1px solid rgba(201,168,76,.3)"}}>
                  {dataReady
                    ? <span>📊 {stats.leads} leads &nbsp;·&nbsp; 🏠 {stats.avail} units available</span>
                    : <span style={{animation:"ai-shimmer 1s ease-in-out infinite"}}>⏳ Loading your data…</span>
                  }
                </div>
                :<div style={{fontSize:12,color:"#8A6200",fontWeight:500}}>Click {prov.name} above to configure</div>
              }
            </div>

            {hasKey&&(
              <div style={{display:"flex",flexWrap:"wrap",gap:8,justifyContent:"center"}}>
                {QUICK.map(q=>(
                  <button key={q.label} className={dataReady?"ai-quick":""} onClick={()=>dataReady&&send(q.label)}
                    style={{
                      padding:"8px 14px",borderRadius:22,cursor:dataReady?"pointer":"not-allowed",fontSize:12,fontWeight:500,
                      border:"1px solid rgba(139,96,0,.25)",
                      background:dataReady?"rgba(201,168,76,.08)":"rgba(139,96,0,.04)",
                      color:dataReady?"#3D2800":"#B0A090",
                      display:"flex",alignItems:"center",gap:6,
                      transition:"all .2s",opacity:dataReady?1:.6
                    }}>
                    <span style={{fontSize:14}}>{q.icon}</span>{q.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {msgs.map((m,i)=>(
          <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start",gap:8,alignItems:"flex-start"}}>
            {m.role==="assistant"&&(
              <div style={{width:28,height:28,borderRadius:"50%",flexShrink:0,marginTop:2,
                background:"linear-gradient(135deg,#0B1F3A,#162d4a)",
                boxShadow:"0 2px 8px rgba(11,31,58,.3)",
                display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:0}}>
                <span style={{fontFamily:"'Playfair Display',serif",fontSize:12,fontWeight:700,color:"#C9A84C",lineHeight:1}}>{initial}</span>
                <span style={{fontSize:6,color:"rgba(201,168,76,.5)",letterSpacing:".5px"}}>AI</span>
              </div>
            )}
            <div style={{
              maxWidth:"84%",padding:"10px 14px",
              borderRadius:m.role==="user"?"16px 16px 4px 16px":"16px 16px 16px 4px",
              background:m.role==="user"
                ?"linear-gradient(135deg,#0B1F3A,#1A3558)"
                :"#fff",
              border:m.role==="assistant"?"1px solid rgba(201,168,76,.25)":"none",
              boxShadow:m.role==="assistant"?"0 2px 8px rgba(0,0,0,.08)":"none",
              color:m.role==="user"?"#F0D98A":"#2C1810",
              fontSize:13,lineHeight:1.65,wordBreak:"break-word"
            }}>
              <MsgContent content={m.content} role={m.role}/>
            </div>
          </div>
        ))}

        {busy&&(
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:28,height:28,borderRadius:8,background:"linear-gradient(135deg,#0B1F3A,#162d4a)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"#C9A84C"}}>✦</div>
            <div style={{background:"#fff",border:"1px solid rgba(201,168,76,.25)",borderRadius:12,padding:"10px 14px",display:"flex",gap:5}}>
              {[0,1,2].map(i=>(
                <div key={i} style={{width:7,height:7,borderRadius:"50%",background:"#C9A84C",
                  animation:"ai-bounce .7s "+(i*.15)+"s ease-in-out infinite alternate"}}/>
              ))}
            </div>
          </div>
        )}
        <div ref={endRef}/>
      </div>

      {/* Input */}
      <div style={{padding:"12px 14px",borderTop:"2px solid rgba(201,168,76,.25)",background:"rgba(251,247,240,.95)",flexShrink:0}}>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <input ref={inputRef} value={inp} className="ai-input"
            onChange={e=>setInp(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}
            placeholder={hasKey?"Ask your concierge…":"Configure API key to start"}
            disabled={!hasKey||busy}
            style={{
              flex:1,background:"#fff",
              border:"1px solid rgba(139,96,0,.25)",
              borderRadius:12,padding:"10px 14px",color:"#2C1810",fontSize:13,
              outline:"none",opacity:hasKey?1:.6,transition:"all .2s"
            }}/>
          <button onClick={()=>send()} disabled={!hasKey||busy||!inp.trim()}
            style={{
              width:44,height:44,borderRadius:12,border:"none",
              background:hasKey&&inp.trim()?"linear-gradient(135deg,#0B1F3A,#1A3558)":"rgba(139,96,0,.12)",
              color:hasKey&&inp.trim()?"#C9A84C":"#A09080",
              cursor:hasKey&&inp.trim()?"pointer":"not-allowed",
              fontSize:18,flexShrink:0,
              boxShadow:hasKey&&inp.trim()?"0 4px 12px rgba(11,31,58,.3)":"none",
              transition:"all .2s"
            }}>↑</button>
        </div>
        <div style={{marginTop:5,fontSize:10,color:"#A09080",textAlign:"center",letterSpacing:".3px"}}>
          Drag to move · ▼ minimise · Ctrl+K
        </div>
      </div>
    </div>
  );
}
