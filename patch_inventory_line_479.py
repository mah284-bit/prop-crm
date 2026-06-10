#!/usr/bin/env python3
import re

file_path = "src/components/InventoryModule.jsx"

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

old = 'onClick={()=>openUnit(u)}'
new = 'onClick={()=>{openUnit(u); openPropertyPack(u.id);}}'

if old in content:
    content = content.replace(old, new, 1)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("✅ Line 479 patched successfully")
else:
    print("⚠️ Pattern not found")
