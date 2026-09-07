// Day 102: extracted from App.jsx. The App.jsx split five months ago (2131570) moved LeasingLeads
// and LeasingModule into their own files and left the shared helpers behind - so those screens threw
// "Spinner is not defined" the moment anyone opened them. Nobody did, for five months.
export default function Spinner({ msg = "Loading\u2026" }) {
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",gap:16,color:"#A0AEC0"}}>
      <div style={{width:36,height:36,border:"3px solid #E2E8F0",borderTop:"3px solid #C9A84C",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
      {msg && <div style={{fontSize:14}}>{msg}</div>}
    </div>
  );
}
