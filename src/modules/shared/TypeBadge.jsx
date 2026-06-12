import { TYPE_META } from '../constants.js';

export function TypeBadge({type}) {
  const m=TYPE_META[type]||{c:"#718096",bg:"#F7F9FC"};
  return <span style={{fontSize:11,fontWeight:600,padding:"3px 9px",borderRadius:20,background:m.bg,color:m.c}}>{type}</span>;
}
