import React from "react";

export default function CompanyPicker({ isSA, companies, storedId, switchCompany }) {
  if (!isSA || companies.length <= 1) return null;
  return (
    <>
                      {/* Super admin company switcher */}
                {isSA&&companies.length>1&&(
                  <select value={storedId||""} onChange={e=>{ if(e.target.value && e.target.value!==storedId) switchCompany(e.target.value); }} style={{
                    background:"rgba(255,255,255,.1)",border:"1px solid rgba(201,168,76,.35)",
                    borderRadius:6,padding:"3px 6px",color:"#C9A84C",fontSize:11,fontWeight:600,
                    cursor:"pointer",maxWidth:130
                  }}>
                    {companies.map(c=><option key={c.id} value={c.id} style={{background:"#0F2540",color:"#fff"}}>{c.name}</option>)}
                  </select>
                )}

    </>
  );
}
