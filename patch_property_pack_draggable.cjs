/* =====================================================================
 * Movable Modals (Phase 1) — make PropertyPackModal draggable
 * - drag by the header (grab the title row)
 * - no dark backdrop -> the form behind stays visible & usable
 * - viewport-clamped so it can't be lost off-screen
 * - x + ESC still close; click-outside removed (no backdrop to click)
 * Proven here first; logic will be extracted into a reusable
 * <DraggableModal> wrapper for app-wide rollout once validated.
 * Safe: .bak backup, idempotent, aborts if an anchor is missing.
 * Run from repo root:  node patch_property_pack_draggable.cjs
 * ===================================================================== */
const fs = require("fs");
const path = "src/components/property/PropertyPackModal.jsx";
if (!fs.existsSync(path)) { console.error("ERROR: run from repo root."); process.exit(1); }
let src = fs.readFileSync(path, "utf8");
const nl = src.includes("\r\n") ? "\r\n" : "\n";

if (src.includes("/* draggable-pack */")) {
  console.log("Already patched (draggable) — no changes made.");
  process.exit(0);
}

// --- 1) add useRef to the React import ---
const impOld = 'import { useState, useEffect, useCallback } from "react";';
const impNew = 'import { useState, useEffect, useCallback, useRef } from "react";';
if (!src.includes(impOld)) { console.error("ERROR: react import anchor not found. Aborting."); process.exit(1); }
src = src.replace(impOld, impNew);

// --- 2) add drag state + handlers right after `const [pack, setPack] = useState(null);` ---
const stateAnchor = '  const [pack, setPack] = useState(null);';
if (!src.includes(stateAnchor)) { console.error("ERROR: state anchor not found. Aborting."); process.exit(1); }
const dragBlock = stateAnchor + nl +
'  /* draggable-pack — position + drag handlers */' + nl +
'  const [pos, setPos] = useState(null); // {x,y} top-left; null = default (top-right)' + nl +
'  const dragRef = useRef(null);' + nl +
'  const PANEL_W = 680;' + nl +
'  const onDragStart = useCallback((clientX, clientY) => {' + nl +
'    const node = dragRef.current;' + nl +
'    const rect = node ? node.getBoundingClientRect() : { left: clientX, top: clientY };' + nl +
'    const offX = clientX - rect.left;' + nl +
'    const offY = clientY - rect.top;' + nl +
'    const move = (cx, cy) => {' + nl +
'      const w = node ? node.offsetWidth : PANEL_W;' + nl +
'      const h = node ? node.offsetHeight : 400;' + nl +
'      let nx = cx - offX, ny = cy - offY;' + nl +
'      nx = Math.max(8, Math.min(nx, window.innerWidth - w - 8));' + nl +
'      ny = Math.max(8, Math.min(ny, window.innerHeight - 48));' + nl +
'      setPos({ x: nx, y: ny });' + nl +
'    };' + nl +
'    const mm = (e) => move(e.clientX, e.clientY);' + nl +
'    const tm = (e) => { const t = e.touches[0]; if (t) move(t.clientX, t.clientY); };' + nl +
'    const up = () => {' + nl +
'      window.removeEventListener("mousemove", mm);' + nl +
'      window.removeEventListener("mouseup", up);' + nl +
'      window.removeEventListener("touchmove", tm);' + nl +
'      window.removeEventListener("touchend", up);' + nl +
'    };' + nl +
'    window.addEventListener("mousemove", mm);' + nl +
'    window.addEventListener("mouseup", up);' + nl +
'    window.addEventListener("touchmove", tm, { passive: false });' + nl +
'    window.addEventListener("touchend", up);' + nl +
'  }, []);' + nl +
'  // reset to default position each time the modal opens' + nl +
'  useEffect(() => { if (open) setPos(null); }, [open]);';
src = src.replace(stateAnchor, dragBlock);

// --- 3) replace the backdrop wrapper: drop dark bg, remove click-close, allow pointer-through ---
const wrapOld =
'    <div' + nl +
'      onClick={close}' + nl +
'      style={{' + nl +
'        position: "fixed", inset: 0, background: "rgba(15,37,64,.55)",' + nl +
'        display: "flex", alignItems: "center", justifyContent: "center",' + nl +
'        zIndex: 1400, padding: "1rem",' + nl +
'      }}' + nl +
'      role="dialog" aria-modal="true"' + nl +
'    >';
const wrapNew =
'    <div' + nl +
'      style={{' + nl +
'        position: "fixed", inset: 0, background: "transparent",' + nl +
'        zIndex: 1400, pointerEvents: "none",' + nl +
'      }}' + nl +
'      role="dialog" aria-modal="false"' + nl +
'    >';
if (!src.includes(wrapOld)) { console.error("ERROR: backdrop wrapper anchor not found. Aborting."); process.exit(1); }
src = src.replace(wrapOld, wrapNew);

// --- 4) replace the panel div: absolute position (draggable), ref, pointer-events on, shadow ---
const panelOld =
'      <div' + nl +
'        onClick={(e) => e.stopPropagation()}' + nl +
'        style={{' + nl +
'          background: "#fff", borderRadius: 16, width: 680, maxWidth: "100%",' + nl +
'          maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(11,31,58,.25)",' + nl +
'        }}' + nl +
'      >';
const panelNew =
'      <div' + nl +
'        ref={dragRef}' + nl +
'        style={{' + nl +
'          position: "absolute",' + nl +
'          top: pos ? pos.y : 24,' + nl +
'          left: pos ? pos.x : (typeof window !== "undefined" ? Math.max(8, window.innerWidth - 680 - 32) : 40),' + nl +
'          background: "#fff", borderRadius: 16, width: 680, maxWidth: "calc(100vw - 16px)",' + nl +
'          maxHeight: "88vh", overflow: "auto", boxShadow: "0 24px 70px rgba(11,31,58,.35)",' + nl +
'          border: "1px solid #E2E8F0", pointerEvents: "auto",' + nl +
'        }}' + nl +
'      >';
if (!src.includes(panelOld)) { console.error("ERROR: panel anchor not found. Aborting."); process.exit(1); }
src = src.replace(panelOld, panelNew);

// --- 5) make the header a drag handle (cursor + onMouseDown/onTouchStart + hint) ---
const headOld = '        <div style={{ padding: "1.1rem 1.4rem", borderBottom: "1px solid #E8EDF4", display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "sticky", top: 0, background: "#fff", zIndex: 2 }}>';
const headNew = '        <div' + nl +
'          onMouseDown={(e) => { if (e.target.closest("button")) return; e.preventDefault(); onDragStart(e.clientX, e.clientY); }}' + nl +
'          onTouchStart={(e) => { if (e.target.closest("button")) return; const t = e.touches[0]; if (t) onDragStart(t.clientX, t.clientY); }}' + nl +
'          title="Drag to move"' + nl +
'          style={{ padding: "1.1rem 1.4rem", borderBottom: "1px solid #E8EDF4", display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "sticky", top: 0, background: "#fff", zIndex: 2, cursor: "move", userSelect: "none" }}>';
if (!src.includes(headOld)) { console.error("ERROR: header anchor not found. Aborting."); process.exit(1); }
src = src.replace(headOld, headNew);

fs.writeFileSync(path + ".bak", fs.readFileSync(path, "utf8"));
fs.writeFileSync(path, src);
console.log("OK: PropertyPackModal is now draggable (5 edits).");
console.log("    - grab the header to move; x/ESC close; no dark backdrop (form stays usable).");
console.log("    Backup: " + path + ".bak");
console.log("    Next: npm run build");
