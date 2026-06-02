/* =====================================================================
 * Contrast fix — Inventory unit detail panel header (InventoryModule.jsx)
 * Header background is #fff but the unit ref + project-name text are #fff /
 * rgba(255,255,255,.6) => invisible (white on white). Flip text to navy/slate.
 * Surgical: only the two text colors in the panel header change.
 * Safe: .bak backup, idempotent, aborts if anchors not unique.
 * Run from repo root:  node patch_unit_panel_header_contrast.cjs
 * ===================================================================== */
const fs = require("fs");
const path = "src/components/InventoryModule.jsx";
if (!fs.existsSync(path)) { console.error("ERROR: run from repo root."); process.exit(1); }
let src = fs.readFileSync(path, "utf8");

if (src.includes("/* unit-header-contrast-fixed */")) {
  console.log("Already patched (contrast fixed) — no changes made.");
  process.exit(0);
}

// 1) unit_ref title: white -> navy
const refOld = '<div style={{fontFamily:"\'Playfair Display\',serif",fontSize:18,color:"#fff",fontWeight:700}}>{selUnit.unit_ref}</div>';
const refNew = '<div style={{fontFamily:"\'Playfair Display\',serif",fontSize:18,color:"#0F2540",fontWeight:700}}>{selUnit.unit_ref}</div>/* unit-header-contrast-fixed */';
const refCount = src.split(refOld).length - 1;
if (refCount !== 1) { console.error("ERROR: unit_ref title anchor matched " + refCount + " (expected 1). Aborting."); process.exit(1); }
src = src.replace(refOld, refNew);

// 2) project name + sub_type: translucent white -> slate
const subOld = '<div style={{fontSize:12,color:"rgba(255,255,255,.6)",marginTop:2}}>{proj?.name} · {selUnit.sub_type}</div>';
const subNew = '<div style={{fontSize:12,color:"#64748B",marginTop:2}}>{proj?.name} · {selUnit.sub_type}</div>';
const subCount = src.split(subOld).length - 1;
if (subCount !== 1) { console.error("ERROR: project-name anchor matched " + subCount + " (expected 1). Aborting."); process.exit(1); }
src = src.replace(subOld, subNew);

fs.writeFileSync(path + ".bak", fs.readFileSync(path, "utf8"));
fs.writeFileSync(path, src);
console.log("OK: unit panel header text now navy/slate on white (readable). 2 edits.");
console.log("    Backup: " + path + ".bak");
console.log("    Next: npm run build");
