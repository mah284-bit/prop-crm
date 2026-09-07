import { useDraggable } from "../../lib/useDraggable.js";

// Day 102: extracted from App.jsx. LeasingModule uses it for Add Tenant and New Lease Contract and
// threw "Modal is not defined" - the last of the refactor casualties.
export const Modal=({title,onClose,children,width=520})=>{
  /* draggable-shared-modal */
  const { ref, posStyle, handleProps } = useDraggable({ open: true });
  return (
  <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,0.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:"1rem"}}>
    <div ref={ref} className="fade-in" style={{background:"#fff",borderRadius:16,width,maxWidth:"100%",maxHeight:"90vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(11,31,58,0.3)",...posStyle}}>
      <div {...handleProps} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"1.25rem 1.5rem",borderBottom:"1px solid #E2E8F0",position:"sticky",top:0,background:"#fff",zIndex:1,cursor:"move",userSelect:"none"}}>
        <span style={{fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:700,color:"#0F2540"}}>{title}</span>
        <button onClick={onClose} style={{background:"none",border:"none",fontSize:22,color:"#A0AEC0",cursor:"pointer"}}>×</button>
      </div>
      <div style={{padding:"1.25rem 1.5rem"}}>{children}</div>
    </div>
  </div>
  );
};
