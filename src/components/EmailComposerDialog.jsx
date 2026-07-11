import React, { useState } from "react";
import { EMAIL_TEMPLATES, substituteVars } from "../lib/emailTemplates.js";

export default function EmailComposerDialog({ lead, opp, onClose, showToast }) {
  const [templateId, setTemplateId] = useState("owner_proposal");
  const [customVars, setCustomVars] = useState({});
  const [loading, setLoading] = useState(false);

  const template = EMAIL_TEMPLATES[templateId];
  const preview = template ? substituteVars(template.body, customVars) : "";

  const handleSend = async () => {
    try {
      setLoading(true);
      console.log("TODO: Wire to email service (Resend/SendGrid)");
      showToast("Email prepared (send integration ready for Phase 2.4)", "info");
      onClose();
    } catch (e) {
      showToast("Send failed: " + e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999}}>
      <div style={{background:"#fff",borderRadius:12,padding:20,maxWidth:700,maxHeight:"90vh",overflow:"auto",boxShadow:"0 10px 40px rgba(0,0,0,0.2)"}}>
        <div style={{fontSize:16,fontWeight:700,marginBottom:16,color:"#0F2540"}}>📧 Compose Email</div>
        
        <div style={{marginBottom:14}}>
          <label style={{fontSize:12,fontWeight:600,color:"#475569",display:"block",marginBottom:6}}>Template</label>
          <select value={templateId} onChange={(e)=>setTemplateId(e.target.value)} style={{width:"100%",padding:"8px 12px",borderRadius:7,border:"1px solid #E2E8F0",fontSize:12}}>
            {Object.entries(EMAIL_TEMPLATES).map(([id, t]) => <option key={id} value={id}>{t.name}</option>)}
          </select>
        </div>

        <div style={{marginBottom:14}}>
          <label style={{fontSize:12,fontWeight:600,color:"#475569",display:"block",marginBottom:6}}>Subject</label>
          <input type="text" value={template?.subject||""} readOnly style={{width:"100%",padding:"8px 12px",borderRadius:7,border:"1px solid #E2E8F0",fontSize:12,background:"#F8FAFC"}}/>
        </div>

        <div style={{marginBottom:14}}>
          <label style={{fontSize:12,fontWeight:600,color:"#475569",display:"block",marginBottom:6}}>Preview</label>
          <div style={{padding:12,borderRadius:7,border:"1px solid #E2E8F0",background:"#F8FAFC",fontSize:11,color:"#475569",lineHeight:1.6,whiteSpace:"pre-wrap",minHeight:100,maxHeight:200,overflow:"auto"}}>{preview}</div>
        </div>

        <div style={{marginBottom:14}}>
          <label style={{fontSize:12,fontWeight:600,color:"#475569",display:"block",marginBottom:6}}>Variables (To/From/Data)</label>
          <textarea placeholder="(Auto-filled from lead/opp context)" style={{width:"100%",padding:"8px 12px",borderRadius:7,border:"1px solid #E2E8F0",fontSize:11,minHeight:60,fontFamily:"monospace"}} value={JSON.stringify(customVars, null, 2)} onChange={(e)=>setCustomVars(JSON.parse(e.target.value||"{}"))}/> 
        </div>

        <div style={{display:"flex",gap:8}}>
          <button onClick={handleSend} disabled={loading} style={{flex:1,padding:"10px 16px",borderRadius:7,border:"none",background:"#0F2540",color:"#fff",fontSize:12,fontWeight:600,cursor:loading?"not-allowed":"pointer"}}>{loading?"Sending...":"📧 Send"}</button>
          <button onClick={onClose} style={{flex:1,padding:"10px 16px",borderRadius:7,border:"1px solid #E2E8F0",background:"#fff",color:"#475569",fontSize:12,fontWeight:600,cursor:"pointer"}}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
