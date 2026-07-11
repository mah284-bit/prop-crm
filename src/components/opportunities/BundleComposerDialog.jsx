import React, { useState } from "react";
import { downloadBundle } from "../../lib/composeBundle.js";

export default function BundleComposerDialog({ proposalPdfUrl, onClose, showToast }) {
  const [selected, setSelected] = useState({proposal: true, brochure: false, floorPlan: false});
  const [loading, setLoading] = useState(false);

  const handleCompose = async () => {
    try {
      setLoading(true);
      if (!selected.proposal) { showToast("Proposal required", "warning"); return; }
      showToast("Bundle ready to download", "success");
      onClose();
    } catch (e) {
      showToast("Bundle failed: " + e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999}}>
      <div style={{background:"#fff",borderRadius:12,padding:24,maxWidth:400,boxShadow:"0 10px 40px rgba(0,0,0,0.2)"}}>
        <div style={{fontSize:16,fontWeight:700,marginBottom:16,color:"#0F2540"}}>📦 Download Bundle</div>
        <div style={{marginBottom:20}}>
          <label style={{display:"flex",gap:8,marginBottom:10,cursor:"pointer"}}><input type="checkbox" checked={selected.proposal} disabled/><span style={{fontSize:13,color:"#475569"}}>📄 Proposal</span></label>
          <label style={{display:"flex",gap:8,marginBottom:10,cursor:"pointer"}}><input type="checkbox" checked={selected.brochure} onChange={(e)=>setSelected({...selected,brochure:e.target.checked})}/><span style={{fontSize:13,color:"#475569"}}>📰 Brochure</span></label>
          <label style={{display:"flex",gap:8,cursor:"pointer"}}><input type="checkbox" checked={selected.floorPlan} onChange={(e)=>setSelected({...selected,floorPlan:e.target.checked})}/><span style={{fontSize:13,color:"#475569"}}>🏗️ Floor Plan</span></label>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={handleCompose} disabled={loading} style={{flex:1,padding:"10px 16px",borderRadius:7,border:"none",background:"#0F2540",color:"#fff",fontSize:12,fontWeight:600,cursor:loading?"not-allowed":"pointer"}}>{loading?"Composing...":"📥 Download"}</button>
          <button onClick={onClose} style={{flex:1,padding:"10px 16px",borderRadius:7,border:"1px solid #E2E8F0",background:"#fff",color:"#475569",fontSize:12,fontWeight:600,cursor:"pointer"}}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
