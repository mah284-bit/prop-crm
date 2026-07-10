import React from "react";

export default function AuthWrap({ children }) {
  return (
    <div style={{background:"linear-gradient(135deg,#0B1F3A 0%,#1A3558 100%)",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem"}}>
      {children}
    </div>
  );
}
