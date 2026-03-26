import { useState, useMemo, useEffect } from "react";

/* ═══════════════════════════════════════════════════════════════
   PROPERTY SALES CRM  —  v1.0
   Modules: Dashboard · Leads · Properties · Pipeline · Activity
   All data persisted in localStorage
═══════════════════════════════════════════════════════════════ */

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
      font-size: 13px; color: #1a2535; background: #fff; width: 100%; transition: border-color 0.2s;
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

// ─── SEED DATA ────────────────────────────────────────────────────
const SEED_LEADS = [
  { id:1, name:"Ahmed Al Mansoori", email:"ahmed.m@gmail.com", phone:"+971 50 123 4567", source:"Referral", stage:"Negotiation", propertyType:"Luxury", budget:12000000, notes:"Interested in Palm Jumeirah villas — sea view, private pool mandatory. Very serious buyer.", lastContact:"2026-03-20", assignedTo:"Sara K.", propertyId:3, createdAt:"2026-02-10" },
  { id:2, name:"Priya Sharma", email:"priya.sharma@corp.ae", phone:"+971 55 987 6543", source:"Website", stage:"Site Visit", propertyType:"Commercial", budget:5500000, notes:"Looking for fitted office in DIFC. Min 3,500 sq ft. Needs parking for 10 cars.", lastContact:"2026-03-22", assignedTo:"James M.", propertyId:2, createdAt:"2026-02-18" },
  { id:3, name:"James Whitfield", email:"j.whitfield@email.com", phone:"+971 52 456 7890", source:"Portal", stage:"Proposal Sent", propertyType:"Residential", budget:2200000, notes:"First-time buyer, needs mortgage pre-approval advice. Prefers JVC or JVT.", lastContact:"2026-03-18", assignedTo:"Sara K.", propertyId:1, createdAt:"2026-03-01" },
  { id:4, name:"Fatima Al Zaabi", email:"fatima.z@hotmail.com", phone:"+971 56 321 0987", source:"Event", stage:"Contacted", propertyType:"Off-plan", budget:1800000, notes:"Interested in Creek Harbour launches. Asking about 10/90 payment plans.", lastContact:"2026-03-23", assignedTo:"Omar R.", propertyId:4, createdAt:"2026-03-05" },
  { id:5, name:"David Chen", email:"dchen@venture.com", phone:"+971 50 654 3210", source:"Referral", stage:"New Lead", propertyType:"Commercial", budget:9000000, notes:"Seeking warehouse space in DIP or JAFZA. Min 15,000 sq ft.", lastContact:"2026-03-24", assignedTo:"James M.", propertyId:null, createdAt:"2026-03-24" },
  { id:6, name:"Maria Santos", email:"msantos@email.ae", phone:"+971 55 111 2233", source:"Social Media", stage:"Closed Won", propertyType:"Residential", budget:1500000, notes:"Purchased 2BR in JVC. Handover Q3 2026. Happy client — potential referrals.", lastContact:"2026-03-15", assignedTo:"Omar R.", propertyId:1, createdAt:"2026-01-20" },
  { id:7, name:"Khalid Al Rashid", email:"k.rashid@luxury.ae", phone:"+971 50 777 8899", source:"Referral", stage:"Closed Lost", propertyType:"Luxury", budget:20000000, notes:"Went with competitor on Emirates Hills. Lost on pricing. Keep for future.", lastContact:"2026-03-10", assignedTo:"Sara K.", propertyId:null, createdAt:"2026-01-05" },
  { id:8, name:"Rania Hassan", email:"rania.h@dubai.ae", phone:"+971 54 222 3344", source:"Cold Call", stage:"Contacted", propertyType:"Residential", budget:3200000, notes:"Upgrading from apartment to villa. Arabian Ranches or Damac Hills preferred.", lastContact:"2026-03-21", assignedTo:"Sara K.", propertyId:null, createdAt:"2026-03-08" },
  { id:9, name:"Tom Erikson", email:"tom.e@nordic.com", phone:"+971 52 888 9900", source:"Website", stage:"New Lead", propertyType:"Off-plan", budget:2800000, notes:"Expat investor looking for off-plan with strong ROI. Flexible on location.", lastContact:"2026-03-24", assignedTo:"James M.", propertyId:null, createdAt:"2026-03-24" },
];
const SEED_PROPERTIES = [
  { id:1, name:"Jumeirah Village Circle Residences", type:"Residential", location:"JVC, Dubai", price:1450000, size:1250, bedrooms:2, status:"Available", developer:"Emaar", completion:"Ready", roi:7.2, description:"Modern 2BR apartment with community pool view. Tenanted — 7.2% net yield." },
  { id:2, name:"DIFC Office Tower Suite", type:"Commercial", location:"DIFC, Dubai", price:5200000, size:3800, bedrooms:null, status:"Available", developer:"ICD Brookfield", completion:"Ready", roi:8.1, description:"Grade A fully fitted offices in the heart of Dubai's financial district. DEWA included." },
  { id:3, name:"Palm Jumeirah Signature Villa", type:"Luxury", location:"Palm Jumeirah, Dubai", price:11800000, size:7200, bedrooms:6, status:"Under Offer", developer:"Nakheel", completion:"Ready", roi:5.9, description:"Beachfront 6BR villa with private pool, direct beach access and skyline views." },
  { id:4, name:"Creek Harbour Sky Residences", type:"Off-plan", location:"Dubai Creek Harbour", price:1750000, size:1100, bedrooms:2, status:"Available", developer:"Emaar", completion:"Q4 2027", roi:9.4, description:"Off-plan 2BR with Creek and Burj Khalifa views. 10/90 post-handover payment plan." },
  { id:5, name:"Business Bay Penthouse", type:"Luxury", location:"Business Bay, Dubai", price:8900000, size:4500, bedrooms:4, status:"Available", developer:"Damac", completion:"Ready", roi:6.7, description:"Sky-high 4BR penthouse with 270° Burj Khalifa views. Fully furnished." },
  { id:6, name:"DIP Logistics Warehouse", type:"Commercial", location:"Dubai Investment Park", price:7800000, size:18000, bedrooms:null, status:"Available", developer:"Master Developer", completion:"Ready", roi:8.8, description:"Grade A warehouse with 12m clear height, 4 loading docks, temperature control option." },
  { id:7, name:"Damac Hills Maple Villa", type:"Residential", location:"Damac Hills, Dubai", price:3100000, size:2900, bedrooms:4, status:"Available", developer:"Damac", completion:"Ready", roi:6.2, description:"4BR townhouse facing the Trump International Golf Course. Corner unit, large garden." },
];
const SEED_ACTIVITIES = [
  { id:1, leadId:1, type:"Meeting", note:"In-person at our office. Discussed villa shortlist — 3 options presented. He wants to revisit Palm villa this weekend.", date:"2026-03-20", user:"Sara K." },
  { id:2, leadId:2, type:"Visit", note:"Site visit at DIFC Tower completed. Very impressed with fitout quality. Requesting formal proposal.", date:"2026-03-22", user:"James M." },
  { id:3, leadId:3, type:"Email", note:"Sent proposal with JVC 2BR unit. Included DLD fee breakdown and mortgage simulation.", date:"2026-03-18", user:"Sara K." },
  { id:4, leadId:1, type:"Call", note:"Counter-offer discussion — client at AED 11.5M. Negotiating with seller for 300k reduction.", date:"2026-03-17", user:"Sara K." },
  { id:5, leadId:4, type:"Call", note:"Intro call. Very interested in Creek Harbour. Wants flexible payment plan.", date:"2026-03-23", user:"Omar R." },
  { id:6, leadId:5, type:"Email", note:"Initial outreach. Sent DIP warehouse brochure and 3-year ROI projection.", date:"2026-03-24", user:"James M." },
  { id:7, leadId:6, type:"Note", note:"Deal closed! Signed SPA for JVC unit. 7.1% ROI locked in. Client extremely happy.", date:"2026-03-15", user:"Omar R." },
  { id:8, leadId:8, type:"Call", note:"Discovery call — budget confirmed at AED 3.2M. Looking to move by end of year.", date:"2026-03-21", user:"Sara K." },
];

// ─── CONSTANTS ────────────────────────────────────────────────────
const STAGES     = ["New Lead","Contacted","Site Visit","Proposal Sent","Negotiation","Closed Won","Closed Lost"];
const PROP_TYPES = ["Residential","Commercial","Luxury","Off-plan"];
const SOURCES    = ["Referral","Website","Portal","Cold Call","Event","Social Media"];
const AGENTS     = ["Sara K.","James M.","Omar R.","Nadia T."];
const ACT_TYPES  = ["Call","Email","Meeting","Visit","Note"];

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

// ─── UTILS ────────────────────────────────────────────────────────
const fmtM    = n => `AED ${(n/1e6).toFixed(1)}M`;
const fmtFull = n => `AED ${Number(n).toLocaleString("en-AE")}`;
const fmtDate = d => new Date(d).toLocaleDateString("en-AE",{day:"numeric",month:"short",year:"numeric"});
const ini     = n => n.split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase();
const uid     = () => Date.now() + Math.floor(Math.random()*9999);

function useLS(key, seed) {
  const [v, setV] = useState(() => {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : seed; } catch { return seed; }
  });
  const set = x => { setV(x); try { localStorage.setItem(key, JSON.stringify(x)); } catch {} };
  return [v, set];
}

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

const Btn = ({ children, onClick, variant="primary", small=false, full=false, style:st={} }) => {
  const s = { primary:{background:"#0B1F3A",color:"#fff",border:"none"}, gold:{background:"#C9A84C",color:"#0B1F3A",border:"none"}, outline:{background:"#fff",color:"#0B1F3A",border:"1.5px solid #D1D9E6"}, danger:{background:"#FAEAEA",color:"#B83232",border:"1.5px solid #F0BCBC"} };
  return <button onClick={onClick} style={{ ...s[variant], padding:small?"6px 14px":"9px 18px", borderRadius:8, fontSize:small?12:13, fontWeight:600, display:"inline-flex", alignItems:"center", gap:6, transition:"opacity 0.15s", width:full?"100%":"auto", justifyContent:"center", ...st }} onMouseOver={e=>e.currentTarget.style.opacity="0.82"} onMouseOut={e=>e.currentTarget.style.opacity="1"}>{children}</button>;
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

const FF = ({ label, children }) => (
  <div style={{ marginBottom:14 }}>
    <label style={{ display:"block", fontSize:11, fontWeight:600, color:"#4A5568", marginBottom:5, textTransform:"uppercase", letterSpacing:"0.5px" }}>{label}</label>
    {children}
  </div>
);
const G2 = ({ children }) => <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>{children}</div>;

// ═══════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════
function Dashboard({ leads, properties, activities }) {
  const active  = leads.filter(l => !["Closed Won","Closed Lost"].includes(l.stage));
  const won     = leads.filter(l => l.stage === "Closed Won");
  const lost    = leads.filter(l => l.stage === "Closed Lost");
  const pipeVal = active.reduce((s,l)=>s+l.budget,0);
  const wonVal  = won.reduce((s,l)=>s+l.budget,0);
  const avail   = properties.filter(p=>p.status==="Available").length;
  const maxCount= Math.max(...STAGES.map(s=>leads.filter(l=>l.stage===s).length),1);
  const recent  = [...activities].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,6);
  const topAgents = AGENTS.map(a=>({ name:a, won:leads.filter(l=>l.assignedTo===a&&l.stage==="Closed Won").length, active:leads.filter(l=>l.assignedTo===a&&!["Closed Won","Closed Lost"].includes(l.stage)).length })).sort((a,b)=>b.won-a.won);

  const SC = ({ label, value, sub, accent }) => (
    <div style={{ background:"#fff", border:"1px solid #E2E8F0", borderRadius:12, padding:"1.125rem 1.25rem", borderTop:`3px solid ${accent}` }}>
      <div style={{ fontSize:10, color:"#A0AEC0", textTransform:"uppercase", letterSpacing:"0.7px", fontWeight:600, marginBottom:6 }}>{label}</div>
      <div style={{ fontFamily:"'Playfair Display',serif", fontSize:26, fontWeight:700, color:"#0B1F3A", lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:12, color:"#718096", marginTop:5 }}>{sub}</div>}
    </div>
  );

  return (
    <div className="fade-in" style={{ display:"flex", flexDirection:"column", gap:18 }}>
      {/* Hero banner */}
      <div style={{ background:"linear-gradient(135deg,#0B1F3A 0%,#1A3558 100%)", borderRadius:14, padding:"1.5rem 2rem", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:22, color:"#fff", fontWeight:700 }}>Good morning ☀️</div>
          <div style={{ color:"#C9A84C", fontSize:13, marginTop:4 }}>{new Date().toLocaleDateString("en-AE",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</div>
        </div>
        <div style={{ textAlign:"right" }}>
          <div style={{ color:"rgba(255,255,255,0.5)", fontSize:11, textTransform:"uppercase", letterSpacing:"0.6px" }}>Total Pipeline Value</div>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:30, color:"#C9A84C", fontWeight:700, marginTop:2 }}>{fmtM(pipeVal)}</div>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
        <SC label="Active Leads"     value={active.length}  sub={`of ${leads.length} total`} accent="#0B1F3A"/>
        <SC label="Deals Won"        value={won.length}     sub={fmtM(wonVal)+" closed"}      accent="#1A7F5A"/>
        <SC label="Deals Lost"       value={lost.length}    sub="Review & re-engage"          accent="#B83232"/>
        <SC label="Properties Avail" value={avail}          sub={`of ${properties.length} listed`} accent="#C9A84C"/>
      </div>

      {/* Pipeline chart + leaderboard */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 310px", gap:14 }}>
        <Card>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:15, fontWeight:700, color:"#0B1F3A", marginBottom:16 }}>Pipeline by Stage</div>
          {STAGES.map(s => {
            const cnt = leads.filter(l=>l.stage===s).length;
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
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:15, fontWeight:700, color:"#0B1F3A", marginBottom:14 }}>Agent Leaderboard</div>
          {topAgents.map((a,i) => (
            <div key={a.name} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 0", borderBottom:i<topAgents.length-1?"1px solid #F0F2F5":"none" }}>
              <div style={{ width:22, height:22, borderRadius:"50%", background:i===0?"#C9A84C":i===1?"#A0AEC0":"#CD7F32", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:"#fff", flexShrink:0 }}>{i+1}</div>
              <Av name={a.name} size={30}/>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600, color:"#0B1F3A" }}>{a.name}</div>
                <div style={{ fontSize:11, color:"#A0AEC0" }}>{a.active} active · {a.won} won</div>
              </div>
              <div style={{ fontSize:14, fontWeight:700, color:"#1A7F5A" }}>{a.won}✓</div>
            </div>
          ))}
        </Card>
      </div>

      {/* Recent activity */}
      <Card>
        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:15, fontWeight:700, color:"#0B1F3A", marginBottom:14 }}>Recent Activity</div>
        {recent.length===0 && <Empty icon="📋" msg="No activities logged yet"/>}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          {recent.map(act => {
            const m = ACT_META[act.type];
            const lead = leads.find(l=>l.id===act.leadId);
            return (
              <div key={act.id} style={{ display:"flex", gap:10, padding:"10px", background:"#FAFBFC", borderRadius:10, border:"1px solid #F0F2F5" }}>
                <div style={{ width:32, height:32, borderRadius:8, background:m.bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, flexShrink:0 }}>{m.icon}</div>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:"#0B1F3A" }}>{act.type} — {lead?.name||"Unknown"}</div>
                  <div style={{ fontSize:11, color:"#718096", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{act.note}</div>
                  <div style={{ fontSize:10, color:"#A0AEC0", marginTop:2 }}>{act.user} · {fmtDate(act.date)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// LEADS
// ═══════════════════════════════════════════════════════
function Leads({ leads, setLeads, properties, setActivities }) {
  const [search, setSearch]   = useState("");
  const [fStage, setFStage]   = useState("All");
  const [fType,  setFType]    = useState("All");
  const [sel,    setSel]      = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const blank = { name:"",email:"",phone:"",source:"Referral",stage:"New Lead",propertyType:"Residential",budget:"",notes:"",assignedTo:"Sara K.",propertyId:"" };
  const [form, setForm]       = useState(blank);
  const [logForm, setLogForm] = useState({ type:"Call", note:"" });

  const filtered = useMemo(()=>leads.filter(l=>{
    const q = search.toLowerCase();
    return (l.name.toLowerCase().includes(q)||l.email.toLowerCase().includes(q))
      &&(fStage==="All"||l.stage===fStage)
      &&(fType==="All"||l.propertyType===fType);
  }),[leads,search,fStage,fType]);

  const selLead = sel ? leads.find(l=>l.id===sel) : null;
  const selProp = selLead?.propertyId ? properties.find(p=>p.id===Number(selLead.propertyId)) : null;

  const saveLead = () => {
    if (!form.name.trim()) return;
    setLeads(p=>[{ ...form, id:uid(), budget:Number(form.budget)||0, lastContact:new Date().toISOString().slice(0,10), createdAt:new Date().toISOString().slice(0,10), propertyId:form.propertyId?Number(form.propertyId):null },...p]);
    setShowAdd(false); setForm(blank);
  };
  const saveLog = () => {
    if (!logForm.note.trim()||!selLead) return;
    setActivities(p=>[{ id:uid(), leadId:selLead.id, type:logForm.type, note:logForm.note, date:new Date().toISOString().slice(0,10), user:"Sara K." },...p]);
    setLeads(p=>p.map(l=>l.id===selLead.id?{...l,lastContact:new Date().toISOString().slice(0,10)}:l));
    setShowLog(false); setLogForm({ type:"Call", note:"" });
  };
  const setStage = s => setLeads(p=>p.map(l=>l.id===sel?{...l,stage:s}:l));
  const delLead  = () => { setLeads(p=>p.filter(l=>l.id!==sel)); setSel(null); };

  return (
    <div className="fade-in" style={{ display:"flex", gap:14, height:"100%" }}>
      {/* List */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0 }}>
        <div style={{ display:"flex", gap:8, marginBottom:10, flexWrap:"wrap" }}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍  Search name or email…" style={{ flex:1, minWidth:160 }}/>
          <select value={fStage} onChange={e=>setFStage(e.target.value)} style={{ width:"auto" }}>
            <option value="All">All stages</option>
            {STAGES.map(s=><option key={s}>{s}</option>)}
          </select>
          <select value={fType} onChange={e=>setFType(e.target.value)} style={{ width:"auto" }}>
            <option value="All">All types</option>
            {PROP_TYPES.map(t=><option key={t}>{t}</option>)}
          </select>
          <Btn onClick={()=>setShowAdd(true)}>+ Add Lead</Btn>
        </div>
        <div style={{ fontSize:12, color:"#A0AEC0", marginBottom:8 }}>{filtered.length} lead{filtered.length!==1?"s":""}</div>
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
                  <StageBadge stage={l.stage}/>
                  <div style={{ fontSize:11, color:sel===l.id?"#C9A84C":"#1A7F5A", fontWeight:600, marginTop:4 }}>{fmtM(l.budget)}</div>
                </div>
              </div>
              <div style={{ display:"flex", gap:6, marginTop:7, alignItems:"center" }}>
                <TypeBadge type={l.propertyType}/>
                <span style={{ fontSize:11, color:sel===l.id?"#C9A84C55":"#A0AEC0" }}>👤 {l.assignedTo} · {fmtDate(l.lastContact)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detail panel */}
      {selLead && (
        <div className="slide-in" style={{ width:330, background:"#fff", border:"1px solid #E2E8F0", borderRadius:12, display:"flex", flexDirection:"column", flexShrink:0, overflow:"hidden" }}>
          <div style={{ background:"#0B1F3A", padding:"1.25rem", position:"relative" }}>
            <button onClick={()=>setSel(null)} style={{ position:"absolute", top:10, right:12, background:"none", border:"none", color:"#C9A84C", fontSize:20, cursor:"pointer" }}>×</button>
            <Av name={selLead.name} size={48} bg="#C9A84C" tc="#0B1F3A"/>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:17, color:"#fff", fontWeight:700, marginTop:10 }}>{selLead.name}</div>
            <div style={{ fontSize:12, color:"#C9A84C", marginTop:2 }}>{selLead.email}</div>
            <div style={{ fontSize:12, color:"#C9A84C88", marginTop:1 }}>{selLead.phone}</div>
          </div>
          <div style={{ flex:1, overflowY:"auto", padding:"1rem" }}>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:14 }}>
              <StageBadge stage={selLead.stage}/><TypeBadge type={selLead.propertyType}/>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, background:"#FAFBFC", borderRadius:10, padding:"12px", marginBottom:12 }}>
              <FR label="Budget"       value={fmtM(selLead.budget)}/>
              <FR label="Source"       value={selLead.source}/>
              <FR label="Assigned To"  value={selLead.assignedTo}/>
              <FR label="Last Contact" value={fmtDate(selLead.lastContact)}/>
            </div>
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
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:10, color:"#A0AEC0", textTransform:"uppercase", letterSpacing:"0.6px", marginBottom:8, fontWeight:600 }}>Move to Stage</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                {STAGES.map(s=>(
                  <button key={s} onClick={()=>setStage(s)} style={{ fontSize:10, padding:"4px 9px", borderRadius:20, border:`1.5px solid ${selLead.stage===s?"#0B1F3A":"#E2E8F0"}`, background:selLead.stage===s?"#0B1F3A":"#fff", color:selLead.stage===s?"#fff":"#4A5568", cursor:"pointer", fontWeight:selLead.stage===s?700:400 }}>{s}</button>
                ))}
              </div>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <Btn variant="gold" small onClick={()=>setShowLog(true)} style={{ flex:1 }}>+ Log Activity</Btn>
              <Btn variant="danger" small onClick={delLead}>Delete</Btn>
            </div>
          </div>
        </div>
      )}

      {showAdd && (
        <Modal title="Add New Lead" onClose={()=>setShowAdd(false)}>
          <G2><FF label="Full Name *"><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Ahmed Al Mansoori"/></FF>
          <FF label="Phone"><input value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} placeholder="+971 50 000 0000"/></FF></G2>
          <FF label="Email"><input value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="email@example.com"/></FF>
          <G2><FF label="Budget (AED)"><input type="number" value={form.budget} onChange={e=>setForm(f=>({...f,budget:e.target.value}))} placeholder="2000000"/></FF>
          <FF label="Assigned To"><select value={form.assignedTo} onChange={e=>setForm(f=>({...f,assignedTo:e.target.value}))}>{AGENTS.map(a=><option key={a}>{a}</option>)}</select></FF></G2>
          <G2><FF label="Lead Source"><select value={form.source} onChange={e=>setForm(f=>({...f,source:e.target.value}))}>{SOURCES.map(s=><option key={s}>{s}</option>)}</select></FF>
          <FF label="Property Type"><select value={form.propertyType} onChange={e=>setForm(f=>({...f,propertyType:e.target.value}))}>{PROP_TYPES.map(t=><option key={t}>{t}</option>)}</select></FF></G2>
          <G2><FF label="Pipeline Stage"><select value={form.stage} onChange={e=>setForm(f=>({...f,stage:e.target.value}))}>{STAGES.map(s=><option key={s}>{s}</option>)}</select></FF>
          <FF label="Link Property"><select value={form.propertyId} onChange={e=>setForm(f=>({...f,propertyId:e.target.value}))}><option value="">None</option>{properties.map(p=><option key={p.id} value={p.id}>{p.name.slice(0,28)}</option>)}</select></FF></G2>
          <FF label="Notes"><textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} rows={3} placeholder="Interest details, requirements…"/></FF>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:6 }}>
            <Btn variant="outline" onClick={()=>setShowAdd(false)}>Cancel</Btn>
            <Btn onClick={saveLead}>Save Lead</Btn>
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
          <FF label="Summary / Note *"><textarea value={logForm.note} onChange={e=>setLogForm(f=>({...f,note:e.target.value}))} rows={4} placeholder="What was discussed or agreed?"/></FF>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
            <Btn variant="outline" onClick={()=>setShowLog(false)}>Cancel</Btn>
            <Btn variant="gold" onClick={saveLog}>Save Activity</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// PROPERTIES
// ═══════════════════════════════════════════════════════
function Properties({ properties, setProperties }) {
  const [fType,   setFType]   = useState("All");
  const [fStatus, setFStatus] = useState("All");
  const [sel,     setSel]     = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const blank = { name:"",type:"Residential",location:"",price:"",size:"",bedrooms:"",status:"Available",developer:"",completion:"Ready",roi:"",description:"" };
  const [form, setForm] = useState(blank);

  const filtered = properties.filter(p=>(fType==="All"||p.type===fType)&&(fStatus==="All"||p.status===fStatus));
  const selP = sel ? properties.find(p=>p.id===sel) : null;
  const SM = { Available:{c:"#1A7F5A",bg:"#E6F4EE"}, "Under Offer":{c:"#A06810",bg:"#FDF3DC"}, Sold:{c:"#B83232",bg:"#FAEAEA"} };

  const save = () => {
    if (!form.name.trim()) return;
    setProperties(p=>[{ ...form, id:uid(), price:Number(form.price)||0, size:Number(form.size)||0, bedrooms:form.bedrooms?Number(form.bedrooms):null, roi:Number(form.roi)||0 },...p]);
    setShowAdd(false); setForm(blank);
  };
  const setStatus = s => setProperties(p=>p.map(x=>x.id===sel?{...x,status:s}:x));
  const delProp   = () => { setProperties(p=>p.filter(x=>x.id!==sel)); setSel(null); };

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
          <div style={{ marginLeft:"auto" }}><Btn onClick={()=>setShowAdd(true)}>+ Add Property</Btn></div>
        </div>
        <div style={{ fontSize:12, color:"#A0AEC0", marginBottom:8 }}>{filtered.length} propert{filtered.length!==1?"ies":"y"}</div>
        <div style={{ flex:1, overflowY:"auto", display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(255px,1fr))", gap:12, alignContent:"start" }}>
          {filtered.length===0 && <Empty icon="🏢" msg="No properties match filters"/>}
          {filtered.map(p=>{
            const sm = SM[p.status]||{}; const isSel = sel===p.id;
            return (
              <div key={p.id} onClick={()=>setSel(isSel?null:p.id)} className="ch"
                style={{ background:isSel?"#0B1F3A":"#fff", border:`1.5px solid ${isSel?"#C9A84C":"#E2E8F0"}`, borderRadius:12, padding:"14px 16px", cursor:"pointer" }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                  <TypeBadge type={p.type}/>
                  <span style={{ fontSize:11, fontWeight:600, padding:"3px 9px", borderRadius:20, background:isSel?"rgba(255,255,255,0.1)":sm.bg, color:isSel?"#C9A84C":sm.c }}>{p.status}</span>
                </div>
                <div style={{ fontWeight:700, fontSize:14, color:isSel?"#fff":"#0B1F3A", lineHeight:1.4, marginBottom:4 }}>{p.name}</div>
                <div style={{ fontSize:12, color:isSel?"#C9A84C88":"#A0AEC0", marginBottom:10 }}>📍 {p.location}</div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div style={{ fontFamily:"'Playfair Display',serif", fontWeight:700, fontSize:15, color:isSel?"#C9A84C":"#0B1F3A" }}>{fmtM(p.price)}</div>
                  <div style={{ fontSize:12, fontWeight:600, color:isSel?"#C9A84C":"#1A7F5A" }}>{p.roi}% ROI</div>
                </div>
                <div style={{ fontSize:11, color:isSel?"#C9A84C44":"#A0AEC0", marginTop:5 }}>
                  {p.size.toLocaleString()} sq ft{p.bedrooms?` · ${p.bedrooms} BR`:""} · {p.completion}
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
            <div style={{ fontSize:36 }}>{selP.type==="Luxury"?"🏰":selP.type==="Commercial"?"🏢":selP.type==="Off-plan"?"🏗":"🏠"}</div>
            <div style={{ marginTop:6 }}><TypeBadge type={selP.type}/></div>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:16, color:"#fff", fontWeight:700, marginTop:8, lineHeight:1.3 }}>{selP.name}</div>
            <div style={{ fontSize:12, color:"#C9A84C", marginTop:3 }}>📍 {selP.location}</div>
          </div>
          <div style={{ flex:1, overflowY:"auto", padding:"1rem" }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, background:"#FAFBFC", borderRadius:10, padding:"12px", marginBottom:12 }}>
              <FR label="Price"      value={fmtFull(selP.price)}/>
              <FR label="ROI"        value={`${selP.roi}%`}/>
              <FR label="Size"       value={`${selP.size.toLocaleString()} sq ft`}/>
              <FR label="Bedrooms"   value={selP.bedrooms||"N/A"}/>
              <FR label="Developer"  value={selP.developer}/>
              <FR label="Completion" value={selP.completion}/>
            </div>
            {selP.description && <div style={{ fontSize:13, color:"#4A5568", lineHeight:1.65, marginBottom:14, padding:"10px", background:"#FAFBFC", borderRadius:8, border:"1px solid #E2E8F0" }}>{selP.description}</div>}
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:10, color:"#A0AEC0", textTransform:"uppercase", letterSpacing:"0.6px", marginBottom:8, fontWeight:600 }}>Update Status</div>
              <div style={{ display:"flex", gap:6 }}>
                {["Available","Under Offer","Sold"].map(s=>(
                  <button key={s} onClick={()=>setStatus(s)} style={{ flex:1, fontSize:11, padding:"6px 0", borderRadius:20, border:`1.5px solid ${selP.status===s?"#0B1F3A":"#E2E8F0"}`, background:selP.status===s?"#0B1F3A":"#fff", color:selP.status===s?"#fff":"#4A5568", cursor:"pointer", fontWeight:selP.status===s?700:400 }}>{s}</button>
                ))}
              </div>
            </div>
            <Btn variant="danger" small full onClick={delProp}>Delete Property</Btn>
          </div>
        </div>
      )}

      {showAdd && (
        <Modal title="Add New Property" onClose={()=>setShowAdd(false)}>
          <FF label="Property Name *"><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Palm Jumeirah Villa"/></FF>
          <G2><FF label="Type"><select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>{PROP_TYPES.map(t=><option key={t}>{t}</option>)}</select></FF>
          <FF label="Status"><select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>{["Available","Under Offer","Sold"].map(s=><option key={s}>{s}</option>)}</select></FF></G2>
          <FF label="Location"><input value={form.location} onChange={e=>setForm(f=>({...f,location:e.target.value}))} placeholder="Palm Jumeirah, Dubai"/></FF>
          <G2><FF label="Price (AED)"><input type="number" value={form.price} onChange={e=>setForm(f=>({...f,price:e.target.value}))} placeholder="5000000"/></FF>
          <FF label="Size (sq ft)"><input type="number" value={form.size} onChange={e=>setForm(f=>({...f,size:e.target.value}))} placeholder="2500"/></FF></G2>
          <G2><FF label="Bedrooms"><input type="number" value={form.bedrooms} onChange={e=>setForm(f=>({...f,bedrooms:e.target.value}))} placeholder="3 (blank for commercial)"/></FF>
          <FF label="ROI (%)"><input type="number" value={form.roi} onChange={e=>setForm(f=>({...f,roi:e.target.value}))} placeholder="7.5"/></FF></G2>
          <G2><FF label="Developer"><input value={form.developer} onChange={e=>setForm(f=>({...f,developer:e.target.value}))} placeholder="Emaar"/></FF>
          <FF label="Completion"><input value={form.completion} onChange={e=>setForm(f=>({...f,completion:e.target.value}))} placeholder="Ready or Q4 2027"/></FF></G2>
          <FF label="Description"><textarea value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} rows={3} placeholder="Key selling points…"/></FF>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:6 }}>
            <Btn variant="outline" onClick={()=>setShowAdd(false)}>Cancel</Btn>
            <Btn onClick={save}>Save Property</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// PIPELINE
// ═══════════════════════════════════════════════════════
function Pipeline({ leads, setLeads }) {
  const [dragging,   setDragging]   = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const byStage = STAGES.reduce((a,s)=>({...a,[s]:leads.filter(l=>l.stage===s)}),{});

  return (
    <div className="fade-in" style={{ height:"100%", overflowX:"auto" }}>
      <div style={{ display:"flex", gap:10, height:"100%", minWidth:STAGES.length*190 }}>
        {STAGES.map(stage=>{
          const m = STAGE_META[stage];
          const items = byStage[stage]||[];
          const total = items.reduce((s,l)=>s+l.budget,0);
          const isDrop = dropTarget===stage;
          return (
            <div key={stage}
              onDragOver={e=>{ e.preventDefault(); setDropTarget(stage); }}
              onDragLeave={()=>setDropTarget(null)}
              onDrop={()=>{ if(dragging){ setLeads(p=>p.map(l=>l.id===dragging.id?{...l,stage}:l)); } setDragging(null); setDropTarget(null); }}
              style={{ flex:1, minWidth:180, display:"flex", flexDirection:"column", background:isDrop?"#FDF8EE":"#F7F9FC", border:`1.5px ${isDrop?"dashed":"solid"} ${isDrop?"#C9A84C":"#E2E8F0"}`, borderRadius:12, overflow:"hidden", transition:"all 0.15s" }}>
              {/* Header */}
              <div style={{ padding:"10px 12px", background:"#fff", borderBottom:"1px solid #F0F2F5" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:2 }}>
                  <span style={{ fontSize:10, fontWeight:700, color:m.c, textTransform:"uppercase", letterSpacing:"0.7px" }}>{stage}</span>
                  <span style={{ fontSize:12, fontWeight:700, background:m.bg, color:m.c, width:22, height:22, borderRadius:"50%", display:"inline-flex", alignItems:"center", justifyContent:"center" }}>{items.length}</span>
                </div>
                <div style={{ fontSize:11, color:"#A0AEC0" }}>{total>0?fmtM(total):"No value"}</div>
              </div>
              {/* Cards */}
              <div style={{ flex:1, overflowY:"auto", padding:"8px" }}>
                {items.length===0 && <div style={{ textAlign:"center", padding:"1.5rem 0.5rem", color:"#D1D9E6", fontSize:12 }}>Drop here</div>}
                {items.map(lead=>(
                  <div key={lead.id} draggable className="dcard"
                    onDragStart={()=>setDragging(lead)}
                    onDragEnd={()=>{ setDragging(null); setDropTarget(null); }}
                    style={{ background:"#fff", border:"1px solid #E2E8F0", borderRadius:10, padding:"10px 11px", marginBottom:8, userSelect:"none", opacity:dragging?.id===lead.id?0.45:1, borderLeft:`3px solid ${m.c}` }}>
                    <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:6 }}>
                      <Av name={lead.name} size={26}/>
                      <div style={{ fontWeight:600, fontSize:12, color:"#0B1F3A", flex:1, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{lead.name}</div>
                    </div>
                    <TypeBadge type={lead.propertyType}/>
                    <div style={{ fontFamily:"'Playfair Display',serif", fontSize:13, fontWeight:700, color:"#0B1F3A", marginTop:7 }}>{fmtM(lead.budget)}</div>
                    <div style={{ fontSize:10, color:"#A0AEC0", marginTop:3, display:"flex", justifyContent:"space-between" }}>
                      <span>👤 {lead.assignedTo}</span><span>{fmtDate(lead.lastContact)}</span>
                    </div>
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
function ActivityLog({ leads, activities, setActivities }) {
  const [fType,   setFType]   = useState("All");
  const [fLead,   setFLead]   = useState("All");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm]       = useState({ leadId:"", type:"Call", note:"", user:"Sara K." });

  const filtered = useMemo(()=>[...activities]
    .sort((a,b)=>new Date(b.date)-new Date(a.date))
    .filter(a=>(fType==="All"||a.type===fType)&&(fLead==="All"||a.leadId===Number(fLead)))
  ,[activities,fType,fLead]);

  const save = () => {
    if (!form.note.trim()||!form.leadId) return;
    setActivities(p=>[{ ...form, id:uid(), leadId:Number(form.leadId), date:new Date().toISOString().slice(0,10) },...p]);
    setShowAdd(false); setForm({ leadId:"", type:"Call", note:"", user:"Sara K." });
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
        <div style={{ marginLeft:"auto" }}><Btn variant="gold" onClick={()=>setShowAdd(true)}>+ Log Activity</Btn></div>
      </div>
      <div style={{ fontSize:12, color:"#A0AEC0", marginBottom:10 }}>{filtered.length} activit{filtered.length!==1?"ies":"y"}</div>
      <div style={{ flex:1, overflowY:"auto" }}>
        {filtered.length===0 && <Empty icon="📋" msg="No activities yet — log your first one!"/>}
        {filtered.map((act,idx)=>{
          const m = ACT_META[act.type];
          const lead = leads.find(l=>l.id===act.leadId);
          const prev = filtered[idx-1];
          const showDate = !prev||prev.date!==act.date;
          return (
            <div key={act.id}>
              {showDate && (
                <div style={{ display:"flex", alignItems:"center", gap:10, margin:"14px 0 8px" }}>
                  <div style={{ height:1, flex:1, background:"#E2E8F0" }}/>
                  <span style={{ fontSize:11, fontWeight:600, color:"#A0AEC0", whiteSpace:"nowrap" }}>{fmtDate(act.date)}</span>
                  <div style={{ height:1, flex:1, background:"#E2E8F0" }}/>
                </div>
              )}
              <div style={{ display:"flex", gap:12, marginBottom:8, padding:"12px 14px", background:"#fff", border:"1px solid #E2E8F0", borderRadius:10 }}>
                <div style={{ width:38, height:38, borderRadius:10, background:m.bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>{m.icon}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4, flexWrap:"wrap" }}>
                    <span style={{ fontSize:13, fontWeight:700, color:m.c }}>{act.type}</span>
                    <span style={{ fontSize:12, color:"#718096" }}>with</span>
                    <span style={{ fontSize:13, fontWeight:600, color:"#0B1F3A" }}>{lead?.name||"Unknown Lead"}</span>
                    {lead && <StageBadge stage={lead.stage}/>}
                  </div>
                  <div style={{ fontSize:13, color:"#4A5568", lineHeight:1.6, marginBottom:4 }}>{act.note}</div>
                  <div style={{ fontSize:11, color:"#A0AEC0" }}>Logged by {act.user}</div>
                </div>
                <button onClick={()=>setActivities(p=>p.filter(a=>a.id!==act.id))} style={{ background:"none", border:"none", color:"#E2E8F0", fontSize:16, alignSelf:"flex-start", padding:0, transition:"color 0.15s" }} onMouseOver={e=>e.currentTarget.style.color="#B83232"} onMouseOut={e=>e.currentTarget.style.color="#E2E8F0"}>×</button>
              </div>
            </div>
          );
        })}
      </div>

      {showAdd && (
        <Modal title="Log New Activity" onClose={()=>setShowAdd(false)} width={460}>
          <FF label="Lead *"><select value={form.leadId} onChange={e=>setForm(f=>({...f,leadId:e.target.value}))}><option value="">Select a lead…</option>{leads.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></FF>
          <FF label="Activity Type">
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {ACT_TYPES.map(t=>(
                <button key={t} onClick={()=>setForm(f=>({...f,type:t}))} style={{ padding:"6px 14px", borderRadius:20, border:`1.5px solid ${form.type===t?"#0B1F3A":"#E2E8F0"}`, background:form.type===t?"#0B1F3A":"#fff", color:form.type===t?"#fff":"#4A5568", fontSize:13, cursor:"pointer", fontWeight:form.type===t?600:400 }}>
                  {ACT_META[t].icon} {t}
                </button>
              ))}
            </div>
          </FF>
          <FF label="Logged By"><select value={form.user} onChange={e=>setForm(f=>({...f,user:e.target.value}))}>{AGENTS.map(a=><option key={a}>{a}</option>)}</select></FF>
          <FF label="Note / Summary *"><textarea value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))} rows={4} placeholder="What happened? What was discussed or agreed?"/></FF>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
            <Btn variant="outline" onClick={()=>setShowAdd(false)}>Cancel</Btn>
            <Btn variant="gold" onClick={save}>Save Activity</Btn>
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
  { id:"dashboard",  label:"Dashboard",    icon:"⊞" },
  { id:"leads",      label:"Leads",        icon:"👤" },
  { id:"properties", label:"Properties",   icon:"🏢" },
  { id:"pipeline",   label:"Pipeline",     icon:"⬡" },
  { id:"activity",   label:"Activity Log", icon:"📋" },
];
const SUBTITLES = {
  dashboard:  "Your sales overview at a glance",
  leads:      "Manage clients and track their journey",
  properties: "Your full property inventory",
  pipeline:   "Drag deals across stages to update them",
  activity:   "Every call, email, visit and meeting — logged",
};

export default function App() {
  const [leads,      setLeads]      = useLS("crm_leads_v2",      SEED_LEADS);
  const [properties, setProperties] = useLS("crm_properties_v2", SEED_PROPERTIES);
  const [activities, setActivities] = useLS("crm_activities_v2", SEED_ACTIVITIES);
  const [tab, setTab] = useState("dashboard");

  const resetAll = () => {
    if (!window.confirm("Reset all data back to sample data? This cannot be undone.")) return;
    setLeads(SEED_LEADS); setProperties(SEED_PROPERTIES); setActivities(SEED_ACTIVITIES);
  };

  return (
    <>
      <GlobalStyle/>
      <div style={{ display:"flex", flexDirection:"column", height:"100vh", background:"#F0F2F5", overflow:"hidden" }}>

        {/* ── Top Nav ── */}
        <div style={{ background:"#0B1F3A", display:"flex", alignItems:"center", padding:"0 1.5rem", height:54, flexShrink:0, gap:2, boxShadow:"0 2px 16px rgba(11,31,58,0.5)" }}>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:18, color:"#fff", fontWeight:700, marginRight:28, whiteSpace:"nowrap", letterSpacing:"0.3px" }}>
            <span style={{ color:"#C9A84C" }}>◆</span> PropCRM
          </div>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)}
              style={{ padding:"6px 13px", borderRadius:8, border:"none", background:tab===t.id?"rgba(201,168,76,0.12)":"transparent", color:tab===t.id?"#C9A84C":"rgba(255,255,255,0.55)", fontSize:13, fontWeight:tab===t.id?600:400, cursor:"pointer", display:"flex", alignItems:"center", gap:6, transition:"all 0.15s", borderBottom:tab===t.id?"2px solid #C9A84C":"2px solid transparent" }}>
              <span style={{ fontSize:14 }}>{t.icon}</span>{t.label}
            </button>
          ))}
          <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:14 }}>
            <span style={{ fontSize:11, color:"rgba(255,255,255,0.35)", display:"flex", gap:10 }}>
              <span>{leads.length} leads</span>
              <span>·</span>
              <span>{properties.length} props</span>
              <span>·</span>
              <span>{activities.length} activities</span>
            </span>
            <button onClick={resetAll} style={{ fontSize:11, color:"rgba(255,255,255,0.35)", background:"none", border:"1px solid rgba(255,255,255,0.1)", borderRadius:6, padding:"4px 10px", cursor:"pointer" }}>Reset Demo</button>
            <Av name="Admin User" size={32} bg="#C9A84C" tc="#0B1F3A"/>
          </div>
        </div>

        {/* ── Page title ── */}
        <div style={{ padding:"16px 1.5rem 10px", flexShrink:0 }}>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:21, fontWeight:700, color:"#0B1F3A" }}>{TABS.find(t=>t.id===tab)?.label}</div>
          <div style={{ fontSize:12, color:"#A0AEC0", marginTop:2 }}>{SUBTITLES[tab]}</div>
        </div>

        {/* ── Content ── */}
        <div style={{ flex:1, overflow:"hidden", padding:"0 1.5rem 1.5rem" }}>
          {tab==="dashboard"  && <div style={{ height:"100%", overflowY:"auto", paddingRight:4 }}><Dashboard leads={leads} properties={properties} activities={activities}/></div>}
          {tab==="leads"      && <Leads      leads={leads} setLeads={setLeads} properties={properties} setActivities={setActivities}/>}
          {tab==="properties" && <Properties properties={properties} setProperties={setProperties}/>}
          {tab==="pipeline"   && <Pipeline   leads={leads} setLeads={setLeads}/>}
          {tab==="activity"   && <ActivityLog leads={leads} activities={activities} setActivities={setActivities}/>}
        </div>
      </div>
    </>
  );
}
