// GroupConsolidatedView — placeholder, extracted from App.jsx (MAP A5)
export default function GroupConsolidatedView() {
  return (
    <div className="fade-in" style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",gap:16,padding:"2rem",textAlign:"center"}}>
      <div style={{fontSize:56}}>🏛</div>
      <div style={{fontFamily:"'Playfair Display',serif",fontSize:24,fontWeight:700,color:"#0F2540"}}>Group Consolidated View</div>
      <div style={{fontSize:14,color:"#718096",maxWidth:500,lineHeight:1.8}}>
        This will provide consolidated reporting across all your legal entities — combined pipeline, rent roll, inventory and agent performance in one board-level view.
      </div>
      <div style={{background:"#FFF9EC",border:"1.5px solid #E8C97A",borderRadius:12,padding:"16px 24px",maxWidth:480,width:"100%",textAlign:"left"}}>
        <div style={{fontSize:12,fontWeight:700,color:"#8A6200",marginBottom:10,textTransform:"uppercase",letterSpacing:".5px"}}>📋 Planned for MVP Phase</div>
        {["Consolidated KPIs across all companies","Cross-entity pipeline & rent roll totals","Per-entity breakdown with drill-down","Group-level agent performance ranking","Consolidated PDF/Excel report export","Parent company / subsidiary structure"].map((f,i)=>(
          <div key={i} style={{display:"flex",gap:8,marginBottom:6,fontSize:13,color:"#4A5568"}}>
            <span style={{color:"#C9A84C",fontWeight:700}}>○</span>{f}
          </div>
        ))}
      </div>
      <div style={{fontSize:11,color:"#A0AEC0"}}>Requires <code style={{background:"#F7F9FC",padding:"1px 5px",borderRadius:4}}>group_id</code> column on companies table · Scheduled for MVP</div>
    </div>
  );
}
