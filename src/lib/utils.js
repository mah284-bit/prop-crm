// Utility functions

// Utility functions extracted from App.jsx
export function buildIcsEvent(act) {
  if (!act.scheduled_at) return null;
  const dt = new Date(act.scheduled_at);
  const dtStr = dt.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//PropCRM//Activity//EN
BEGIN:VEVENT
UID:${act.id}@propcrm
DTSTAMP:${dtStr}
DTSTART:${dtStr}
SUMMARY:${(act.activity_type || '').replace(/"/g, '\\"')}
DESCRIPTION:${(act.description || '').replace(/"/g, '\\"')}
END:VEVENT
END:VCALENDAR`;
}

export function hoursLeft(scheduledAt) {
  if (!scheduledAt) return null;
  const now = new Date();
  const then = new Date(scheduledAt);
  const diffMs = then - now;
  if (diffMs < 0) return null;
  return Math.floor(diffMs / (1000 * 60 * 60));
}

export function reservationUrgency(hours) {
  if (!hours) return "neutral";
  if (hours < 24) return "critical";
  if (hours < 72) return "high";
  return "low";
}
