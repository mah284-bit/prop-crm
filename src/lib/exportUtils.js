// Export utilities for Excel/PDF downloads
function exportToExcel(rows, headers, filename) {
  const escape = v => {
    if(v === null || v === undefined) return "";
    const s = String(v);
    return s.includes(",") || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g,'""')}"` : s;
  };
  const csv = [headers.map(escape).join(","), ...rows.map(r=>r.map(escape).join(","))].join("\n");
  const blob = new Blob(["\uFEFF"+csv], {type:"text/csv;charset=utf-8"});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href=url; a.download=filename+".csv"; a.click();
  URL.revokeObjectURL(url);
}

// ── PDF export helper ─────────────────────────────────────────────
if (typeof window !== "undefined") {
  window.exportToExcel = exportToExcel;
  globalThis.exportToExcel = exportToExcel;
}
function exportToPDF(title, subtitle, headers, rows, filename) {
  const colW = Math.floor(90/headers.length);
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;color:#1a2535;font-size:11px}
    .header{background:#1E3A5F;color:#fff;padding:20px 24px;margin-bottom:0}
    .title{font-size:20px;font-weight:700;color:#C9A84C;margin-bottom:4px}
    .subtitle{font-size:12px;color:rgba(255,255,255,.6)}
    .meta{font-size:11px;color:rgba(255,255,255,.4);margin-top:4px}
    table{width:100%;border-collapse:collapse;margin:0}
    th{background:#1E3A5F;color:#C9A84C;padding:7px 8px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:.4px}
    td{padding:6px 8px;border-bottom:1px solid #F0F2F5;font-size:10px;vertical-align:top}
    tr:nth-child(even) td{background:#FAFBFC}
    .footer{margin-top:16px;text-align:center;font-size:9px;color:#A0AEC0}
    @media print{@page{margin:12mm}}
  </style></head><body>
  <div class="header">
    <div class="title">◆ PropCRM — ${title}</div>
    <div class="subtitle">${subtitle}</div>
    <div class="meta">Generated: ${new Date().toLocaleString("en-AE",{day:"numeric",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"})}</div>
  </div>
  <table>
    <thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead>
    <tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c===null||c===undefined?"—":c}</td>`).join("")}</tr>`).join("")}</tbody>
  </table>
  <div class="footer">PropCRM · Confidential · ${rows.length} records</div>
  </body></html>`;
  const blob = new Blob([html], {type:"text/html"});
  const url  = URL.createObjectURL(blob);
  const w    = window.open(url,"_blank");
  if(w) { w.onload = () => { w.print(); URL.revokeObjectURL(url); }; }
  else { const a=document.createElement("a"); a.href=url; a.download=filename+".html"; a.click(); URL.revokeObjectURL(url); }
}

if (typeof window !== "undefined") {
  window.exportToPDF = exportToPDF;
  globalThis.exportToPDF = exportToPDF;
}
// ── Main Reports Module ───────────────────────────────────────────


export { exportToExcel, exportToPDF };
