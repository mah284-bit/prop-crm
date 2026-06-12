import os

with open('src/App.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

start_idx = 3450
next_func_idx = None
for i in range(start_idx + 1, len(lines)):
    if lines[i].strip().startswith('function '):
        next_func_idx = i
        break

if next_func_idx:
    comp = ''.join(lines[start_idx:next_func_idx])
    imports = "import React, { useState, useEffect } from 'react';\nimport { supabase } from \"../../lib/supabase.js\";\nimport { Btn } from \"../../modules/shared/Btn.jsx\";\nimport { Badge } from \"../../modules/shared/Badge.jsx\";\nimport { COLORS, OPP_STAGES } from \"../../modules/constants.js\";\n\n"
    
    os.makedirs('src/components/sales', exist_ok=True)
    with open('src/components/sales/Dashboard.jsx', 'w', encoding='utf-8') as f:
        f.write(imports + comp + "\nexport default Dashboard;\n")
    
    with open('src/App.jsx', 'w', encoding='utf-8') as f:
        f.write(''.join(lines[:start_idx] + lines[next_func_idx:]))
    
    print(f"✅ Dashboard extracted ({next_func_idx - start_idx} lines)")
    
    with open('src/App.jsx', 'r', encoding='utf-8') as f:
        new_lines = f.readlines()
        print(f"App.jsx now {len(new_lines)} lines")
else:
    print("❌ Failed")
