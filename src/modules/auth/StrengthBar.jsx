import { getStrength } from '../utils.js';

export function StrengthBar({password}) {
  const s=getStrength(password);
  if(!password)return null;
  return (
    <div style={{marginTop:6}}>
      <div style={{height:4,background:"#F7F9FC",borderRadius:4,overflow:"hidden"}}>
        <div style={{width:`${s.pct}%`,height:"100%",background:s.color,borderRadius:4,transition:"width 0.3s"}}/>
      </div>
      <div style={{fontSize:11,color:s.color,fontWeight:600,marginTop:4}}>
        {s.label} password
      </div>
    </div>
  );
}
