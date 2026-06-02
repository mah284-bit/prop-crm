/* =====================================================================
 * Movable Modals — make ProposalBuilderDialog (the "Send Proposal" EDITOR)
 * draggable. This is the modal brokers ACTUALLY open (Edit / Send Revised /
 * Build proposal). Component opens at App.jsx ~line 3284.
 * Uses the existing useDraggable hook (imported, count=1).
 * Light backdrop kept (active form; you move it, not work behind it).
 * Anchored on a block UNIQUE to this component (panel+header+title fontSize:18)
 * so it can't hit the structurally-identical View modal or the 9459 email modal.
 * Safe: .bak backup, idempotent, aborts if block !=1.
 * Run from repo root:  node patch_sendproposal_draggable.cjs
 * ===================================================================== */
const fs = require("fs");
const path = "src/App.jsx";
if (!fs.existsSync(path)) { console.error("ERROR: run from repo root."); process.exit(1); }
let src = fs.readFileSync(path, "utf8");
const nl = src.includes("\r\n") ? "\r\n" : "\n";

if (src.includes("/* draggable-sendproposal */")) {
  console.log("Already patched (Send Proposal editor draggable) — no changes made.");
  process.exit(0);
}
if (!src.includes('import { useDraggable }')) {
  console.error("ERROR: useDraggable import missing. Aborting."); process.exit(1);
}

// --- Edit 1: hook call right after the component opens (unique signature) ---
const compOpen = 'function ProposalBuilderDialog({ opp, lead, units, projects, salePricing, currentUser, lastProposal, onClose, onSaved, showToast }) {';
const compCount = src.split(compOpen).length - 1;
if (compCount !== 1) { console.error("ERROR: ProposalBuilderDialog signature matched " + compCount + " (expected 1). Aborting."); process.exit(1); }
src = src.replace(compOpen, compOpen + nl +
  '  /* draggable-sendproposal */ const { ref: dragRef, posStyle, handleProps } = useDraggable({ open: true });');

// --- Edit 2: panel + header + unique title block ---
const block =
'      <div style={{background:"#fff",borderRadius:16,width:680,maxWidth:"100%",maxHeight:"92vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 24px 64px rgba(11,31,58,.4)"}}>' + nl +
'        <div style={{padding:"1.1rem 1.4rem",borderBottom:"1px solid #E8EDF4",background:"#0F2540"}}>' + nl +
'          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>' + nl +
'            <div>' + nl +
'              <div style={{fontFamily:"\'Playfair Display\',serif",fontSize:18,fontWeight:700,color:"#fff"}}>\uD83D\uDCE4 Send Proposal</div>';
const blockNew =
'      <div ref={dragRef} style={{background:"#fff",borderRadius:16,width:680,maxWidth:"100%",maxHeight:"92vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 24px 64px rgba(11,31,58,.4)",...posStyle}}>' + nl +
'        <div {...handleProps} style={{padding:"1.1rem 1.4rem",borderBottom:"1px solid #E8EDF4",background:"#0F2540",cursor:"move",userSelect:"none"}}>' + nl +
'          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>' + nl +
'            <div>' + nl +
'              <div style={{fontFamily:"\'Playfair Display\',serif",fontSize:18,fontWeight:700,color:"#fff"}}>\uD83D\uDCE4 Send Proposal</div>';
const blockCount = src.split(block).length - 1;
if (blockCount !== 1) { console.error("ERROR: Send Proposal panel/header/title block matched " + blockCount + " (expected 1). Aborting, file unchanged."); process.exit(1); }
src = src.replace(block, blockNew);

fs.writeFileSync(path + ".bak", fs.readFileSync(path, "utf8"));
fs.writeFileSync(path, src);
console.log("OK: ProposalBuilderDialog (Send Proposal editor) is now draggable (2 edits).");
console.log("    Backup: src/App.jsx.bak");
console.log("    Next: npm run build");
