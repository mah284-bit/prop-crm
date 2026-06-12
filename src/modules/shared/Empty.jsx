export function Empty({icon,msg}) {
  return (
    <div style={{textAlign:"center",padding:"3rem 1rem",color:"#A0AEC0"}}>
      <div style={{fontSize:36,marginBottom:10}}>{icon}</div>
      <div style={{fontSize:13}}>{msg}</div>
    </div>
  );
}
