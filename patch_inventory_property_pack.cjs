/* =====================================================================
 * Phase 2.2b — InventoryModule.jsx patcher: add "Property Pack" button
 * Adds: import openPropertyPack + a button in the unit detail panel that
 *       opens the global Property Pack viewer for the selected unit.
 * Safe: .bak backup, refuses to run twice, aborts if anchors missing.
 * Run from repo root:  node patch_inventory_property_pack.cjs
 * ===================================================================== */
const fs = require("fs");
const path = "src/components/InventoryModule.jsx";

if (!fs.existsSync(path)) {
  console.error("ERROR: " + path + " not found. Run from repo root.");
  process.exit(1);
}
let src = fs.readFileSync(path, "utf8");
const nl = src.includes("\r\n") ? "\r\n" : "\n";

if (src.includes("openPropertyPack")) {
  console.log("Already patched (openPropertyPack present) — no changes made.");
  process.exit(0);
}

// ---- Anchor 1: import (after the supabase import on line 2) ----
const importAnchor = 'import { supabase } from "../lib/supabase";';
if (!src.includes(importAnchor)) {
  console.error("ERROR: supabase import anchor not found. Aborting.");
  process.exit(1);
}
const importLine = 'import { openPropertyPack } from "./property/propertyPackBus";';
src = src.replace(importAnchor, importAnchor + nl + importLine);

// ---- Anchor 2: the "Edit Unit" button in the unit detail panel ----
// We insert a Property Pack button immediately BEFORE it. Match the stable
// part of the line (the visible label) to avoid brittle full-line matching.
const editAnchor = '{canEdit&&<button onClick={()=>openEdit(selUnit)} style={{padding:"8px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>✏ Edit Unit</button>}';
if (!src.includes(editAnchor)) {
  console.error("ERROR: 'Edit Unit' button anchor not found (panel layout may have changed). Aborting.");
  process.exit(1);
}
const packButton =
  '{/* Phase 2.2b — open global Property Pack viewer for this unit */}' + nl +
  '                    <button onClick={()=>openPropertyPack(selUnit.id)} style={{padding:"8px",borderRadius:8,border:"none",background:"#0F2540",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"}}>📸 Property Pack</button>';
src = src.replace(editAnchor, packButton + nl + '                    ' + editAnchor);

fs.writeFileSync(path + ".bak", fs.readFileSync(path, "utf8"));
fs.writeFileSync(path, src);
console.log("OK: InventoryModule.jsx patched (import + Property Pack button).");
console.log("    Backup: src/components/InventoryModule.jsx.bak");
console.log("    Next: npm run build");
