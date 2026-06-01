/* =====================================================================
 * Movable Modals (Phase 2) — make the SHARED <Modal> component draggable
 * Uses the reusable useDraggable hook (src/lib/useDraggable.js).
 * Covers the 4 Inventory form-modals that render via <Modal>.
 * Keeps a light backdrop (form modals, not work-beside panels).
 * Safe: writes the hook file, .bak backup, idempotent, aborts if anchors miss.
 * Run from repo root (place useDraggable.js in repo root first):
 *   node patch_shared_modal_draggable.cjs
 * ===================================================================== */
const fs = require("fs");
const path = "src/App.jsx";
if (!fs.existsSync(path)) { console.error("ERROR: run from repo root."); process.exit(1); }

// --- 0) ensure the hook file exists at src/lib/useDraggable.js ---
const libDir = "src/lib";
const hookPath = libDir + "/useDraggable.js";
if (!fs.existsSync(hookPath)) {
  if (!fs.existsSync("useDraggable.js")) {
    console.error("ERROR: useDraggable.js not found in repo root. Download it there first.");
    process.exit(1);
  }
  if (!fs.existsSync(libDir)) fs.mkdirSync(libDir, { recursive: true });
  fs.copyFileSync("useDraggable.js", hookPath);
  console.log("OK: created " + hookPath);
} else {
  console.log("Hook already present at " + hookPath);
}

let src = fs.readFileSync(path, "utf8");
const nl = src.includes("\r\n") ? "\r\n" : "\n";

if (src.includes("/* draggable-shared-modal */")) {
  console.log("App.jsx already patched (shared Modal draggable) — no changes made.");
  process.exit(0);
}

// --- 1) add hook import after the first react import ---
const importHook = 'import { useDraggable } from "./lib/useDraggable";';
if (!src.includes(importHook)) {
  const m = src.match(/import[^\n]*from\s*["']react["'];/);
  if (!m) { console.error("ERROR: no react import to anchor. Aborting."); process.exit(1); }
  src = src.replace(m[0], m[0] + nl + importHook);
}

// --- 2) open: arrow-fn -> function body with hook + return; light backdrop; ref + handle ---
const openOld =
'const Modal=({title,onClose,children,width=520})=>(' + nl +
'  <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:"1rem"}}>' + nl +
'    <div className="fade-in" style={{background:"#fff",borderRadius:16,width,maxWidth:"100%",maxHeight:"90vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(11,31,58,0.3)"}}>' + nl +
'      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"1.25rem 1.5rem",borderBottom:"1px solid #E2E8F0",position:"sticky",top:0,background:"#fff",zIndex:1}}>';
const openNew =
'const Modal=({title,onClose,children,width=520})=>{' + nl +
'  /* draggable-shared-modal */' + nl +
'  const { ref, posStyle, handleProps } = useDraggable({ open: true });' + nl +
'  return (' + nl +
'  <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,0.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:"1rem"}}>' + nl +
'    <div ref={ref} className="fade-in" style={{background:"#fff",borderRadius:16,width,maxWidth:"100%",maxHeight:"90vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(11,31,58,0.3)",...posStyle}}>' + nl +
'      <div {...handleProps} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"1.25rem 1.5rem",borderBottom:"1px solid #E2E8F0",position:"sticky",top:0,background:"#fff",zIndex:1,cursor:"move",userSelect:"none"}}>';
if (!src.includes(openOld)) { console.error("ERROR: Modal open anchor not found. Aborting, App.jsx unchanged."); process.exit(1); }
src = src.replace(openOld, openNew);

// --- 3) close: turn the arrow-fn ");" into the function "  );};" (exact real structure) ---
const closeOld =
'      <div style={{padding:"1.25rem 1.5rem"}}>{children}</div>' + nl +
'    </div>' + nl +
'  </div>' + nl +
');';
const closeNew =
'      <div style={{padding:"1.25rem 1.5rem"}}>{children}</div>' + nl +
'    </div>' + nl +
'  </div>' + nl +
'  );' + nl +
'};';
if (!src.includes(closeOld)) { console.error("ERROR: Modal close anchor not found. Aborting, App.jsx unchanged (no .bak written)."); process.exit(1); }
src = src.replace(closeOld, closeNew);

fs.writeFileSync(path + ".bak", fs.readFileSync(path, "utf8"));
fs.writeFileSync(path, src);
console.log("OK: shared <Modal> is now draggable (covers the 4 Inventory form modals).");
console.log("    Backup: src/App.jsx.bak");
console.log("    Next: npm run build");
