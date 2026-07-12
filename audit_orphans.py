import os, re
allsrc = {}
for root, dirs, files in os.walk("src"):
    for f in files:
        if f.endswith((".jsx", ".js")):
            p = os.path.join(root, f).replace("\\", "/")
            allsrc[p] = open(p, encoding="utf-8", errors="ignore").read()
imported = set()
pat = re.compile(r'from\s+["\']([^"\']+)["\']|import\s*\(\s*["\']([^"\']+)["\']')
for p, txt in allsrc.items():
    for m in pat.finditer(txt):
        spec = m.group(1) or m.group(2)
        if not spec.startswith("."): continue
        base = os.path.normpath(os.path.join(os.path.dirname(p), spec)).replace("\\", "/")
        for cand in (base, base + ".jsx", base + ".js", base + "/index.jsx", base + "/index.js"):
            if cand in allsrc: imported.add(cand)
roots = ("src/main.jsx", "src/App.jsx")
orphans = [p for p in sorted(allsrc) if p not in imported and p not in roots]
print("Files never imported by any other file:")
for p in orphans: print("  ", p)
print("Total:", len(orphans))
