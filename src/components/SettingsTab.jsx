// SettingsTab — legacy app-config form (Mode/Company/Currency/Country), extracted from App.jsx (MAP A9). FUTURE: fold into new settings/SettingsPage customization surface pre-go-live.
import { useState } from "react";

export default function SettingsTab({appConfig, onConfigChange, currentUser, showToast}) {
  // 21 May 2026: Handle null appConfig (destructure default {} only applies when undefined, not null)
  const cfg = appConfig || {};
  const [form, setForm] = useState({
    mode:     cfg.mode||"both",
    company:  cfg.company||"PropCRM",
    currency: cfg.currency||"AED",
    country:  cfg.country||"UAE",
  });
  const save=()=>{
    const cfg={...appConfig,...form,updatedAt:new Date().toISOString()};
    onConfigChange(cfg);
    showToast("Settings saved","success");
  };
  return(
    <div style={{maxWidth:480}}>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:".5px"}}>CRM Mode</label>
          <select value={form.mode} onChange={e=>setForm(f=>({...f,mode:e.target.value}))}>
            <option value="sales">Sales Only</option>
            <option value="leasing">Leasing Only</option>
            <option value="both">Sales & Leasing</option>
          </select>
        </div>
        <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:".5px"}}>Company Name</label><input value={form.company} onChange={e=>setForm(f=>({...f,company:e.target.value}))}/></div>
        <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:".5px"}}>Currency</label>
          <select value={form.currency} onChange={e=>setForm(f=>({...f,currency:e.target.value}))}>
            {["AED","USD","GBP","EUR","SAR","QAR","KWD"].map(c=><option key={c}>{c}</option>)}
          </select>
        </div>
        <button onClick={save} style={{padding:"10px 24px",borderRadius:8,border:"none",background:"#0F2540",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",alignSelf:"flex-start"}}>Save Settings</button>
      </div>
    </div>
  );
}
