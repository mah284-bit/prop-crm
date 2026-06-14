// Reservation utility functions
function hoursLeft(expiresAt, extendedUntil) {
  const exp = extendedUntil ? new Date(extendedUntil) : new Date(expiresAt);
  return Math.max(0, Math.round((exp - new Date()) / 36e5));
}

function reservationUrgency(res) {
  const hrs = hoursLeft(res.expires_at, res.extended_until);
  if (res.status !== "Active") return "inactive";
  if (hrs <= 0)   return "expired";
  if (hrs <= 12)  return "critical";
  if (hrs <= 24)  return "warning";
  return "ok";
}

export { hoursLeft, reservationUrgency };
