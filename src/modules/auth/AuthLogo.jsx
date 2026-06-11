export function AuthLogo({sub}) {
  return (
    <div style={{textAlign:"center",marginBottom:28}}>
      <div style={{fontFamily:"'Playfair Display',serif",fontSize:32,fontWeight:700,color:"#0F2540"}}><span style={{color:"#C9A84C"}}>◆</span> PropCRM</div>
      <div style={{fontSize:13,color:"#A0AEC0",marginTop:6}}>{sub}</div>
    </div>
  );
}
