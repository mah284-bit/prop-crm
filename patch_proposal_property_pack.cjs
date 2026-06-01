/* =====================================================================
 * Phase 2.2b Phase 2 — Proposal builder + review: Property Pack trigger
 * Adds a "📸 Pack" button after the OPTION label in BOTH the proposal
 * builder (fontSize:9 anchor) and the proposal review view (fontSize:11),
 * each calling openPropertyPack(pu.unit_id).
 * Safe: .bak backup, idempotent, each anchor verified unique before edit.
 * Run from repo root:  node patch_proposal_property_pack.cjs
 * ===================================================================== */
const fs = require("fs");
const path = "src/App.jsx";
if (!fs.existsSync(path)) { console.error("ERROR: run from repo root."); process.exit(1); }
let src = fs.readFileSync(path, "utf8");
const nl = src.includes("\r\n") ? "\r\n" : "\n";

if (src.includes("openPropertyPack(pu.unit_id)")) {
  console.log("Already patched (proposal triggers present) — no changes made.");
  process.exit(0);
}

// Bus import should already exist (added by opp-detail patch). Add if missing.
const busImport = 'import { openPropertyPack } from "./components/property/propertyPackBus";';
if (!src.includes(busImport)) {
  const anchorImp = 'import PropertyPackModal from "./components/property/PropertyPackModal.jsx";';
  if (!src.includes(anchorImp)) { console.error("ERROR: run patch_app_property_pack.cjs first."); process.exit(1); }
  src = src.replace(anchorImp, anchorImp + nl + busImport);
}

const btn = (indent) =>
  nl + indent + '{/* Phase 2.2b — Property Pack trigger */}' +
  nl + indent + '<button onClick={e=>{e.stopPropagation();openPropertyPack(pu.unit_id);}} title="View Property Pack" style={{padding:"2px 8px",borderRadius:5,border:"none",background:"#0F2540",color:"#fff",fontSize:9,fontWeight:700,cursor:"pointer"}}>📸 Pack</button>';

// --- Anchor A: proposal BUILDER (fontSize:9) ---
const anchorA = '<span style={{fontSize:9,fontWeight:700,color:"#94A3B8"}}>OPTION {idx+1}</span>';
const aCount = src.split(anchorA).length - 1;
if (aCount !== 1) { console.error("ERROR: builder anchor matched " + aCount + " (expected 1). Aborting."); process.exit(1); }
src = src.replace(anchorA, anchorA + btn('                      '));

// --- Anchor B: proposal REVIEW view (fontSize:11) ---
const anchorB = '<span style={{fontSize:11,fontWeight:700,color:"#94A3B8"}}>OPTION {idx+1}</span>';
const bCount = src.split(anchorB).length - 1;
if (bCount !== 1) { console.error("ERROR: review anchor matched " + bCount + " (expected 1). Aborting."); process.exit(1); }
src = src.replace(anchorB, anchorB + btn('                            '));

fs.writeFileSync(path + ".bak", fs.readFileSync(path, "utf8"));
fs.writeFileSync(path, src);
console.log("OK: App.jsx proposal Property Pack triggers added (builder + review).");
console.log("    Backup: src/App.jsx.bak");
console.log("    Next: npm run build");
