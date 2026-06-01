/* =====================================================================
 * Phase 2.2b — App.jsx patcher: mount PropertyPackModal once (global)
 * Adds: import + <PropertyPackModal/> next to the global <Toast/>.
 * Safe: .bak backup, refuses to run twice, aborts if anchors missing.
 * Run from repo root:  node patch_app_property_pack.cjs
 * ===================================================================== */
const fs = require("fs");
const path = "src/App.jsx";

if (!fs.existsSync(path)) {
  console.error("ERROR: " + path + " not found. Run from repo root (/d/prop-crm).");
  process.exit(1);
}
let src = fs.readFileSync(path, "utf8");
const nl = src.includes("\r\n") ? "\r\n" : "\n";

if (src.includes("PropertyPackModal")) {
  console.log("Already patched (PropertyPackModal present) — no changes made.");
  process.exit(0);
}

// ---- Anchor 1: import (after the PropPulse import) ----
const importAnchor = 'import PropPulse from "./components/PropPulse.jsx";';
if (!src.includes(importAnchor)) {
  console.error("ERROR: PropPulse import anchor not found. Aborting, file unchanged.");
  process.exit(1);
}
const importLine = 'import PropertyPackModal from "./components/property/PropertyPackModal.jsx";';
src = src.replace(importAnchor, importAnchor + nl + importLine);

// ---- Anchor 2: mount (next to the global Toast) ----
const toastAnchor = '    {toast&&<Toast msg={toast.msg} type={toast.type} onDone={()=>setToast(null)}/>}';
if (!src.includes(toastAnchor)) {
  console.error("ERROR: Toast mount anchor not found. Aborting, file unchanged.");
  process.exit(1);
}
const mountLine = '    {/* Phase 2.2b — global Property Pack viewer (opens from anywhere via openPropertyPack) */}' + nl +
                  '    <PropertyPackModal />';
src = src.replace(toastAnchor, toastAnchor + nl + mountLine);

fs.writeFileSync(path + ".bak", fs.readFileSync(path, "utf8"));
fs.writeFileSync(path, src);
console.log("OK: App.jsx patched (import + global mount).");
console.log("    Backup: src/App.jsx.bak");
console.log("    Next: node patch_inventory_property_pack.cjs");
