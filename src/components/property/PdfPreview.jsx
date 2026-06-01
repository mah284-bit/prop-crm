// =====================================================================
// Phase 2.2 — Property Detail Pack  (inline-style, matches PropPulse)
// PdfPreview — inline brochure preview via native iframe (Decision 4)
// =====================================================================
// Native <iframe> renders PDFs in all modern browsers (0 KB vs ~200KB
// for react-pdf).
//
// Props:
//   fileUrl     : string  — Supabase Storage public URL (brochure_file_url)
//   externalUrl : string  — developer-hosted link (brochure_url)  [optional]
//   title       : string  — heading (default "Brochure")
//
// Behavior:
//   - fileUrl present  -> inline iframe preview + "Open in new tab"
//   - else             -> renders nothing (the panel's existing
//                         "Download Brochure" link already covers external URLs,
//                          so we avoid a duplicate button)
// =====================================================================

const LABEL = {
  fontSize: 11, fontWeight: 700, color: "#94A3B8",
  textTransform: "uppercase", letterSpacing: ".5px",
};

export default function PdfPreview({ fileUrl, externalUrl, title = "Brochure" }) {
  if (!fileUrl) return null;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={LABEL}>{title}</div>
        <a href={fileUrl} target="_blank" rel="noreferrer"
          style={{ fontSize: 11, fontWeight: 600, color: "#1A5FA8", textDecoration: "none" }}>
          Open in new tab ↗
        </a>
      </div>
      <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid #E8EDF4" }}>
        <iframe
          src={fileUrl}
          title={title}
          style={{ width: "100%", height: 460, border: "none", background: "#F7F9FC" }}
        />
      </div>
    </div>
  );
}
