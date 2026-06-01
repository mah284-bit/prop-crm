/* =====================================================================
 * Phase 2.2b Phase 2 — Opp detail: add Property Pack trigger
 * Adds a small "📸 Pack" button next to the linked-unit ref on the
 * opportunity detail unit header. Uses openPropertyPack(selectedUnit.id).
 * Safe: .bak backup, idempotent, aborts if anchor not unique/missing.
 * Run from repo root:  node patch_oppdetail_property_pack.cjs
 * ===================================================================== */
const fs = require("fs");
const path = "src/App.jsx";
if (!fs.existsSync(path)) { console.error("ERROR: run from repo root."); process.exit(1); }
let src = fs.readFileSync(path, "utf8");
const nl = src.includes("\r\n") ? "\r\n" : "\n";

if (src.includes("openPropertyPack(selectedUnit.id)")) {
  console.log("Already patched (opp-detail trigger present) — no changes made.");
  process.exit(0);
}

// Ensure the bus is imported in App.jsx (PropertyPackModal import exists; add named import too)
const busImportMarker = 'import { openPropertyPack } from "./components/property/propertyPackBus";';
if (!src.includes(busImportMarker)) {
  const afterModal = 'import PropertyPackModal from "./components/property/PropertyPackModal.jsx";';
  if (!src.includes(afterModal)) { console.error("ERROR: PropertyPackModal import not found — run patch_app_property_pack.cjs first."); process.exit(1); }
  src = src.replace(afterModal, afterModal + nl + busImportMarker);
}

// Unique anchor: the linked-unit ref span on opp detail (verified count = 1)
const anchor = '<span style={{fontWeight:700,color:"#0F2540"}}>{selectedUnit.unit_ref}</span>';
const matches = src.split(anchor).length - 1;
if (matches !== 1) { console.error("ERROR: opp-detail anchor matched " + matches + " times (expected 1). Aborting."); process.exit(1); }

const button = anchor + nl +
  '                            {/* Phase 2.2b — open Property Pack for this unit */}' + nl +
  '                            <button onClick={e=>{e.stopPropagation();openPropertyPack(selectedUnit.id);}} title="View Property Pack" style={{padding:"2px 8px",borderRadius:5,border:"none",background:"#0F2540",color:"#fff",fontSize:10,fontWeight:700,cursor:"pointer"}}>📸 Pack</button>';
src = src.replace(anchor, button);

fs.writeFileSync(path + ".bak", fs.readFileSync(path, "utf8"));
fs.writeFileSync(path, src);
console.log("OK: App.jsx opp-detail Property Pack trigger added.");
console.log("    Backup: src/App.jsx.bak");
console.log("    Next: npm run build");
