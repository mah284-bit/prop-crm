/* =====================================================================
 * Hotfix — remove the literal "/* unit-header-contrast-fixed *​/" text that
 * is rendering visibly in the unit panel header (marker was placed outside
 * the JSX expression). Keep the navy color fix; just delete the stray text.
 * Run from repo root:  node patch_fix_visible_marker.cjs
 * ===================================================================== */
const fs = require("fs");
const path = "src/components/InventoryModule.jsx";
if (!fs.existsSync(path)) { console.error("ERROR: run from repo root."); process.exit(1); }
let src = fs.readFileSync(path, "utf8");

const bad = '</div>/* unit-header-contrast-fixed */';
if (!src.includes(bad)) {
  console.log("Marker not found in that form — checking generic.");
  // fallback: remove any standalone occurrence right after the ref div
}
const count = src.split(bad).length - 1;
if (count >= 1) {
  src = src.split(bad).join('</div>');
  fs.writeFileSync(path, src);
  console.log("OK: removed visible marker (" + count + " occurrence). Navy color fix retained.");
  console.log("    Next: npm run build");
} else {
  console.error("Could not find the exact marker string. Paste line ~521 so I can target it.");
  process.exit(1);
}
