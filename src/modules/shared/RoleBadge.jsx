import { ROLE_META } from '../constants.js';

export function RoleBadge({role}) {
  const m=ROLE_META[role]||{label:role,color:"#718096",bg:"#F7F9FC"};
  return <span style={{fontSize:11,fontWeight:600,padding:"3px 9px",borderRadius:20,background:m.bg,color:m.color,textTransform:"capitalize"}}>{m.label}</span>;
}
