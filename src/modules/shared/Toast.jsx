import { useEffect } from 'react';

export function Toast({msg,type="success",onDone}) {
  useEffect(()=>{
    const t=setTimeout(onDone,3500);
    return()=>clearTimeout(t);
  },[]);
  const colors={
    success:["#E6F4EE","#1A7F5A"],
    error:["#FAEAEA","#B83232"],
    info:["#E6EFF9","#1A5FA8"],
    warning:["#FDF3DC","#A06810"]
  };
  const[bg,c]=colors[type]||colors.info;
  return (
    <div style={{position:"fixed",bottom:90,right:24,zIndex:99999,background:bg,color:c,border:`1.5px solid ${c}33`,borderRadius:10,padding:"12px 18px",fontSize:13,fontWeight:600,boxShadow:"0 4px 20px rgba(0,0,0,0.15)",maxWidth:420,wordBreak:"break-word"}}>
      {type==="success"?"✓ ":type==="error"?"✕ ":type==="warning"?"⚠ ":"ℹ "}{msg}
    </div>
  );
}
