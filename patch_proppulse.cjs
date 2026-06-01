/* =====================================================================
 * Phase 2.2 — PropPulse.jsx patcher
 * Adds: 5 property-pack component imports + the media block inside the
 *       existing project detail panel.
 * Safe: makes a .bak backup, refuses to run twice, aborts if anchors
 *       are not found (no partial edits).
 * Run from repo root:  node patch_proppulse.cjs
 * ===================================================================== */
const fs = require("fs");
const path = "src/components/PropPulse.jsx";

if (!fs.existsSync(path)) {
  console.error("ERROR: " + path + " not found. Run this from the repo root (/d/prop-crm).");
  process.exit(1);
}

let src = fs.readFileSync(path, "utf8");
const nl = src.includes("\r\n") ? "\r\n" : "\n";

// Idempotency guard
if (src.includes("property/MediaGallery")) {
  console.log("Already patched (property components found) — no changes made.");
  process.exit(0);
}

// ---- Anchor 1: imports ----
const importAnchor = 'import { supabase } from "../lib/supabase";';
if (!src.includes(importAnchor)) {
  console.error("ERROR: import anchor not found. Aborting, file unchanged.");
  process.exit(1);
}
const imports = [
  'import MediaGallery from "./property/MediaGallery";',
  'import AmenityGrid from "./property/AmenityGrid";',
  'import PdfPreview from "./property/PdfPreview";',
  'import VideoEmbed from "./property/VideoEmbed";',
  'import FullImage from "./property/FullImage";',
].join(nl);

// ---- Anchor 2: media block (after the description line) ----
const descAnchor = '{selProject.description&&<p style={{fontSize:13,color:"#4A5568",lineHeight:1.6,margin:0}}>{selProject.description}</p>}';
if (!src.includes(descAnchor)) {
  console.error("ERROR: description anchor not found. Aborting, file unchanged.");
  process.exit(1);
}
const mediaBlock = [
  '{/* -- Property Pack media (Phase 2.2) - each section self-hides if no data -- */}',
  '<FullImage src={selProject.hero_image_url} maxHeight={240} objectFit="cover" />',
  '<PdfPreview fileUrl={selProject.brochure_file_url} externalUrl={selProject.brochure_url} />',
  '<FullImage src={selProject.master_plan_url} title="Master Plan" objectFit="contain" />',
  '<MediaGallery photos={selProject.photo_gallery_urls} title="Community Photos" />',
  '<VideoEmbed url={selProject.video_url} />',
  '<AmenityGrid amenities={selProject.amenities} />',
  '<button disabled title="Phase 2 - Communications Overhaul, Q3 2026"',
  '  style={{alignSelf:"flex-start",padding:"8px 16px",borderRadius:8,border:"1px dashed #CBD5E1",background:"#F8FAFC",color:"#94A3B8",fontSize:12,fontWeight:600,cursor:"not-allowed"}}>',
  '  \uD83D\uDCE4 Share Pack - coming Q3 2026',
  '</button>',
].join(nl);

// ---- Backup, then apply both edits ----
fs.writeFileSync(path + ".bak", src);
src = src.replace(importAnchor, importAnchor + nl + imports);
src = src.replace(descAnchor, descAnchor + nl + mediaBlock);
fs.writeFileSync(path, src);

console.log("OK: PropPulse.jsx patched.");
console.log("    Backup saved at src/components/PropPulse.jsx.bak");
console.log("    Next: npm run build");
