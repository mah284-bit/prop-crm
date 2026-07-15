import io, sys
p = "src/components/LogActivityModal.jsx"
lines = io.open(p, encoding="utf-8").readlines()
src = "".join(lines)
if "form.main_location" in src: sys.exit("ABORT: already applied")
# 1. state: add main_location to the form init (anchor on ns_ fields line)
si = next((i for i,l in enumerate(lines) if 'ns_type:"Call"' in l), None)
if si is None: sys.exit("ABORT: state line not found")
lines[si] = lines[si].replace('ns_type:"Call"', 'main_location:"", ns_type:"Call"')
# 2. narration: append location to the note line (anchor on duration narration L39)
ni = next((i for i,l in enumerate(lines) if 'form.duration_mins?("\\n' in l or "Duration: " in l and "form.duration_mins" in l), None)
if ni is None: sys.exit("ABORT: narration line not found")
lines[ni] = lines[ni].rstrip("\n") + "\n" + lines[ni].replace("form.duration_mins", "form.main_location").replace("\\u23f1 Duration: ", "\\ud83d\\udccd ").replace('" mins"', '""').replace("+\" mins\"","") if False else lines[ni]
io.open(p, "w", encoding="utf-8", newline="").writelines(lines)
print("PARTIAL: state added - narration/save/field steps follow")
