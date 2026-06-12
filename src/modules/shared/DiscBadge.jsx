import { Badge } from './Badge.jsx';

export function DiscBadge({status}) {
  const C={
    Pending:{c:"#A06810",bg:"#FDF3DC"},
    Approved:{c:"#1A7F5A",bg:"#E6F4EE"},
    Rejected:{c:"#B83232",bg:"#FAEAEA"},
    Escalated:{c:"#5B3FAA",bg:"#EEE8F9"}
  };
  const m=C[status]||{c:"#718096",bg:"#F7F9FC"};
  return <Badge label={status} c={m.c} bg={m.bg}/>;
}
