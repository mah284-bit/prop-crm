import { ini } from '../utils.js';

export function Av({name,size=36,bg="#0F2540",tc="#C9A84C"}) {
  return (
    <div style={{width:size,height:size,borderRadius:"50%",background:bg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:size*0.32,fontWeight:600,color:tc,letterSpacing:"0.5px"}}>{ini(name)}</div>
  );
}
