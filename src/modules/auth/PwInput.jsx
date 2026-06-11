import { useState } from 'react';
import { EyeIcon } from './EyeIcon.jsx';

export function PwInput({value,onChange,placeholder="••••••••",onKeyDown}) {
  const [show,setShow]=useState(false);
  return (
    <div style={{position:"relative"}}>
      <input 
        type={show?"text":"password"} 
        value={value} 
        onChange={onChange} 
        placeholder={placeholder} 
        onKeyDown={onKeyDown} 
        style={{paddingRight:42}}
      />
      <button 
        type="button" 
        onClick={()=>setShow(s=>!s)} 
        style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"#A0AEC0",padding:0,display:"flex",alignItems:"center",cursor:"pointer"}}
      >
        <EyeIcon open={show}/>
      </button>
    </div>
  );
}
