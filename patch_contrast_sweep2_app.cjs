/* =====================================================================
 * Contrast sweep #2 (App.jsx) — 5 more white-on-white modal headers.
 * All have background:#fff header + color:#fff title => invisible.
 * Flip each title #fff -> navy #0F2540. Anchored on unique title spans.
 *   9491  💰 Add/Edit Payment
 *   11955 🎯 New Opportunity
 *   13572 📤 Upload Projects from Excel
 *   13624 Edit Project / New Project
 *   15866 Edit User / Add New User
 * Safe: .bak, idempotent, each anchor must match exactly once.
 * Run from repo root:  node patch_contrast_sweep2_app.cjs
 * ===================================================================== */
const fs = require("fs");
const path = "src/App.jsx";
if (!fs.existsSync(path)) { console.error("ERROR: run from repo root."); process.exit(1); }
let src = fs.readFileSync(path, "utf8");

const edits = [
  ['<span style={{fontFamily:"\'Playfair Display\',serif",fontSize:16,fontWeight:700,color:"#fff"}}>💰 {editPayment?"Edit":"Add"} Payment</span>',
   '<span style={{fontFamily:"\'Playfair Display\',serif",fontSize:16,fontWeight:700,color:"#0F2540"}}>💰 {editPayment?"Edit":"Add"} Payment</span>',
   "Add/Edit Payment"],
  ['<div style={{fontFamily:"\'Playfair Display\',serif",fontSize:16,fontWeight:700,color:"#fff"}}>🎯 New Opportunity</div>',
   '<div style={{fontFamily:"\'Playfair Display\',serif",fontSize:16,fontWeight:700,color:"#0F2540"}}>🎯 New Opportunity</div>',
   "New Opportunity"],
  ['<span style={{fontFamily:"\'Playfair Display\',serif",fontSize:17,fontWeight:700,color:"#fff"}}>📤 Upload Projects from Excel</span>',
   '<span style={{fontFamily:"\'Playfair Display\',serif",fontSize:17,fontWeight:700,color:"#0F2540"}}>📤 Upload Projects from Excel</span>',
   "Upload Projects Excel"],
  ['<span style={{fontFamily:"\'Playfair Display\',serif",fontSize:17,fontWeight:700,color:"#fff"}}>{editProj?"Edit Project":"New Project"}</span>',
   '<span style={{fontFamily:"\'Playfair Display\',serif",fontSize:17,fontWeight:700,color:"#0F2540"}}>{editProj?"Edit Project":"New Project"}</span>',
   "Edit/New Project"],
  ['<span style={{fontFamily:"\'Playfair Display\',serif",fontSize:16,fontWeight:700,color:"#fff"}}>{editUser?"Edit User":"Add New User"}</span>',
   '<span style={{fontFamily:"\'Playfair Display\',serif",fontSize:16,fontWeight:700,color:"#0F2540"}}>{editUser?"Edit User":"Add New User"}</span>',
   "Edit/Add User"],
];

let changed = 0;
for (const [oldS, newS, name] of edits) {
  const c = src.split(oldS).length - 1;
  if (c === 0) { console.error("  SKIP (" + name + "): not found (already fixed?)"); continue; }
  if (c > 1)  { console.error("  ABORT (" + name + "): matched " + c + " (expected 1)"); process.exit(1); }
  src = src.replace(oldS, newS); changed++;
  console.log("  OK (" + name + ")");
}

if (changed > 0) {
  fs.writeFileSync(path + ".bak", fs.readFileSync(path, "utf8"));
  fs.writeFileSync(path, src);
  console.log("App.jsx: " + changed + " header title(s) fixed -> navy. Backup: src/App.jsx.bak");
} else {
  console.log("No changes.");
}
console.log("Next: npm run build");
