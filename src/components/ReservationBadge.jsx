import React from "react";
import { reservationUrgency, hoursLeft } from "../lib/utils.js";

const RES_COLORS = {
  ok: { bg: "#E6F4EE", c: "#1A7F5A", border: "#A8D5BE" },
  warning: { bg: "#FFF3CD", c: "#856404", border: "#FFEEBA" },
  critical: { bg: "#F8D7DA", c: "#721C24", border: "#F5C6CB" },
  expired: { bg: "#E2E3E5", c: "#383D41", border: "#D6D8DB" },
  inactive: { bg: "#D1ECF1", c: "#0C5460", border: "#BEE5EB" },
};

export default function ReservationBadge({ reservation }) {
  function ReservationBadge({ reservation }) {
  if (!reservation) return null;
  const urg = reservationUrgency(reservation);
  const col = RES_COLORS[urg];
  const hrs = hoursLeft(reservation.expires_at, reservation.extended_until);
  if (reservation.status === "Confirmed") return (
    <span style={{fontSize:9,fontWeight:700,padding:"2px 6px",borderRadius:20,background:"#E6F4EE",color:"#1A7F5A",border:"1px solid #A8D5BE"}}>✓ Confirmed</span>
  );
  if (reservation.status !== "Active" && reservation.status !== "Extended") return null;
  return (
    <span style={{fontSize:9,fontWeight:700,padding:"2px 6px",borderRadius:20,background:col.bg,color:col.c,border:`1px solid ${col.border}`}}>
      {urg === "expired" ? "⚠ Expired" : `🔒 ${hrs}h left`}
    </span>
  );
}

}
