export function AuthLogo({sub}) {
  return (
    <div style={{textAlign:"center",marginBottom:28}}>
      <div style={{fontFamily:"'Playfair Display',serif",fontSize:32,fontWeight:700,color:"#0F2540"}}><span style={{color:"#C9A84C"}}>◆</span> PropCRM</div>
      <div style={{fontSize:13,color:"#A0AEC0",marginTop:6}}>{sub}</div>
    </div>
  );
}

export function ErrBox({msg}) {
  return msg?<div style={{background:"#FAEAEA",color:"#B83232",border:"1.5px solid #F0BCBC",borderRadius:8,padding:"10px 14px",fontSize:13,marginBottom:16,lineHeight:1.5}}>{msg}</div>:null;
}
