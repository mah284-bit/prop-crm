/* =====================================================================
 * Contrast sweep — fix white-on-white headers from the dark->light change.
 *  1. InventoryModule: "Upload Inventory from Excel" title  #fff -> navy
 *  2. InventoryModule: "Add New Unit / Edit Unit" title     #fff -> navy
 *  3. PropPulse: banner stat labels  rgba(255,255,255,.5) -> slate
 * Each anchor verified unique before edit. Safe: .bak, idempotent, abort-if-miss.
 * Run from repo root:  node patch_contrast_sweep.cjs
 * ===================================================================== */
const fs = require("fs");

function fixOne(path, label, edits) {
  if (!fs.existsSync(path)) { console.error("ERROR: missing " + path); process.exit(1); }
  let src = fs.readFileSync(path, "utf8");
  let changed = 0;
  for (const [oldS, newS, name] of edits) {
    const c = src.split(oldS).length - 1;
    if (c === 0) { console.error("  SKIP (" + name + "): anchor not found (maybe already fixed)"); continue; }
    if (c > 1)  { console.error("  ABORT (" + name + "): anchor matched " + c + " (expected 1)"); process.exit(1); }
    src = src.replace(oldS, newS); changed++;
    console.log("  OK (" + name + ")");
  }
  if (changed > 0) {
    fs.writeFileSync(path + ".bak", fs.readFileSync(path, "utf8"));
    fs.writeFileSync(path, src);
    console.log(label + ": " + changed + " edit(s). Backup: " + path + ".bak");
  } else {
    console.log(label + ": no changes.");
  }
}

// --- InventoryModule.jsx ---
fixOne("src/components/InventoryModule.jsx", "InventoryModule", [
  [
    '<span style={{fontFamily:"\'Playfair Display\',serif",fontSize:17,fontWeight:700,color:"#fff"}}>📤 Upload Inventory from Excel</span>',
    '<span style={{fontFamily:"\'Playfair Display\',serif",fontSize:17,fontWeight:700,color:"#0F2540"}}>📤 Upload Inventory from Excel</span>',
    "Upload Excel title"
  ],
  [
    '<span style={{fontFamily:"\'Playfair Display\',serif",fontSize:17,fontWeight:700,color:"#fff"}}>{editUnit?"Edit Unit":"Add New Unit"}</span>',
    '<span style={{fontFamily:"\'Playfair Display\',serif",fontSize:17,fontWeight:700,color:"#0F2540"}}>{editUnit?"Edit Unit":"Add New Unit"}</span>',
    "Add/Edit Unit title"
  ],
]);

// --- PropPulse.jsx banner stat labels ---
fixOne("src/components/PropPulse.jsx", "PropPulse", [
  [
    '<div style={{fontSize:10,color:"rgba(255,255,255,.5)",textTransform:"uppercase",letterSpacing:".5px"}}>{l}</div>',
    '<div style={{fontSize:10,color:"#64748B",textTransform:"uppercase",letterSpacing:".5px"}}>{l}</div>',
    "Banner stat labels"
  ],
]);

console.log("DONE. Next: npm run build");
