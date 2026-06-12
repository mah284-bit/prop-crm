export function FR({label,value}) {
  return (
    <div style={{display:"flex",flexDirection:"column",gap:2}}>
      <span style={{fontSize:10,color:"#A0AEC0",textTransform:"uppercase",letterSpacing:"0.6px",fontWeight:600}}>{label}</span>
      <span style={{fontSize:13,color:"#0F2540",fontWeight:500}}>{value||"—"}</span>
    </div>
  );
}
