// normalisePhone - UAE phone normalization
function normalisePhone(p) {
  if (!p) return "";
  let s = String(p).replace(/\D/g, "");
  if (s.startsWith("971")) s = s.slice(3);
  if (s.startsWith("0")) s = s.slice(1);
  return s;
}

// addWorkingDays - Add business days to date
function addWorkingDays(startDate, days) {
  const d = new Date(startDate);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay(); // 0=Sun, 6=Sat — weekend
    if (day !== 0 && day !== 6) added++;
  }
  return d;
}

// downloadIcsAndOpenMail - Download .ics + open mailto
function downloadIcsAndOpenMail({to, subject, body, ics, filename}) {
  // 1. Trigger .ics download
  const blob = new Blob([ics], {type:"text/calendar;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "site-visit.ics";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
  // 2. Open mailto: with subject + body — user attaches the just-downloaded file
  const mailto = `mailto:${encodeURIComponent(to||"")}?subject=${encodeURIComponent(subject||"")}&body=${encodeURIComponent(body||"")}`;
  // Slight delay so the download dialog appears before the mailto handler
  setTimeout(()=>{ window.location.href = mailto; }, 300);
}

export { normalisePhone, addWorkingDays, downloadIcsAndOpenMail };
