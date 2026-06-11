export function Btn({children,onClick,variant="primary",small=false,full=false,disabled=false,style:st={}}) {
  const s={
    primary:{background:"#0F2540",color:"#fff",border:"none"},
    gold:{background:"#C9A84C",color:"#0F2540",border:"none"},
    outline:{background:"#fff",color:"#0F2540",border:"1.5px solid #D1D9E6"},
    danger:{background:"#FAEAEA",color:"#B83232",border:"1.5px solid #F0BCBC"},
    green:{background:"#E6F4EE",color:"#1A7F5A",border:"1.5px solid #A8D5BE"},
    wa:{background:"#25D366",color:"#fff",border:"none"}
  };
  return (
    <button 
      onClick={onClick} 
      disabled={disabled} 
      style={{
        ...s[variant],
        padding:small?"6px 14px":"9px 18px",
        borderRadius:8,
        fontSize:small?12:13,
        fontWeight:600,
        display:"inline-flex",
        alignItems:"center",
        gap:6,
        transition:"opacity 0.15s",
        width:full?"100%":"auto",
        justifyContent:"center",
        opacity:disabled?0.45:1,
        ...st
      }} 
      onMouseOver={e=>{if(!disabled)e.currentTarget.style.opacity="0.82"}} 
      onMouseOut={e=>e.currentTarget.style.opacity=disabled?"0.45":"1"}
    >
      {children}
    </button>
  );
}
