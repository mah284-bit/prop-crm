import RemindersBell from "./RemindersBell.jsx";

export default function AppHeader({
  currentUser,
  currentApp,
  showToast,
  showPwModal,
  setShowPwModal,
  navigateToTab,
  handleLogout,
  RemindersBell: RemindersBellComp,
  RoleBadge,
  Av,
  PwRecoveryForm,
}) {
  return (
    <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
      <RemindersBellComp
        currentUser={currentUser}
        showToast={showToast}
        onNavigateToOpp={(oppId)=>{
          const targetTab = currentApp === "leasing" ? "l_leads" : "opportunities";
          navigateToTab(targetTab, {type:"opp", oppId});
        }}
        onNavigateToLead={(leadId)=>{
          const targetTab = currentApp === "leasing" ? "l_leads" : "leads";
          navigateToTab(targetTab, {type:"lead", leadId});
        }}
      />

      <div style={{textAlign:"right"}}>
        <div style={{fontSize:12,color:"#0F2540",fontWeight:600,lineHeight:1.2,letterSpacing:"-.2px"}}>{currentUser.full_name}</div>
        <RoleBadge role={currentUser.role}/>
      </div>
      <Av name={currentUser.full_name||currentUser.email} size={32} bg="#C9A84C" tc="#0F2540"/>

      {showPwModal&&(<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:99998,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setShowPwModal(false)}><div style={{background:"#fff",borderRadius:16,padding:"2rem",width:400,maxWidth:"90vw",boxShadow:"0 20px 60px rgba(0,0,0,.3)"}} onClick={e=>e.stopPropagation()}><div style={{textAlign:"center",marginBottom:20}}><div style={{fontSize:36,marginBottom:6}}>🔑</div><div style={{fontFamily:"'Inter',sans-serif",fontSize:16,fontWeight:700,color:"#0F2540",letterSpacing:"-.4px",marginBottom:4}}>Change Password</div></div><PwRecoveryForm onDone={()=>{setShowPwModal(false);showToast("Password changed","success");}}/></div></div>)}

      <button onClick={()=>window.dispatchEvent(new CustomEvent("propcrm_ai_open"))} title="Open AI Concierge · Ctrl+K"
        style={{width:34,height:34,borderRadius:"50%",border:"none",cursor:"pointer",
          background:"linear-gradient(135deg,#0B1F3A 0%,#1A3558 100%)",boxShadow:"0 0 0 1.5px #C9A84C",
          display:"inline-flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:0,flexShrink:0}}
        onMouseOver={e=>{e.currentTarget.style.transform="scale(1.08)";}}
        onMouseOut={e=>{e.currentTarget.style.transform="scale(1)";}}>
        <span style={{fontFamily:"'Playfair Display',serif",fontSize:13,fontWeight:700,color:"#C9A84C",lineHeight:1}}>✦</span>
      </button>

      <button onClick={()=>setShowPwModal(true)} title="Change my password" style={{fontSize:16,color:"#C9A84C",background:"none",border:"none",cursor:"pointer",padding:"0 4px"}}>🔑</button>

      <button onClick={handleLogout} title="Sign out"
        style={{fontSize:11,color:"#64748B",background:"#fff",border:"1px solid #E2E8F0",borderRadius:6,padding:"5px 10px",cursor:"pointer",whiteSpace:"nowrap",transition:"all .15s",fontWeight:600,display:"inline-flex",alignItems:"center",gap:5}}
        onMouseOver={e=>{e.currentTarget.style.background="#FEE2E2"; e.currentTarget.style.borderColor="#FCA5A5"; e.currentTarget.style.color="#C53030";}}
        onMouseOut={e=>{e.currentTarget.style.background="#fff"; e.currentTarget.style.borderColor="#E2E8F0"; e.currentTarget.style.color="#64748B";}}>
        ⏏ Sign out
      </button>
      <div style={{borderLeft:"1px solid #E8EDF4",paddingLeft:10,display:"flex",alignItems:"center",gap:3}}>
        <span style={{color:"#C9A84C",fontSize:10}}>◆</span>
        <span style={{fontFamily:"'Inter',sans-serif",fontSize:10,color:"#94A3B8",fontWeight:600,letterSpacing:".5px"}}>PropCRM</span>
      </div>
    </div>
  );
}
