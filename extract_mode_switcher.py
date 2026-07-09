#!/usr/bin/env python3
import os

with open('src/App.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

extracted_lines = lines[2690:2718]

mode_switcher = 'import React from "react";\n\nexport default function ModeSwitcher({ currentApp, canSwitch, setActiveApp, navigateToTab }) {\n  return (\n    <>\n      ' + ''.join(extracted_lines) + '\n    </>\n  );\n}\n'

os.makedirs('src/components', exist_ok=True)
with open('src/components/ModeSwitcher.jsx', 'w', encoding='utf-8') as f:
    f.write(mode_switcher)

new_lines = lines[:2690] + ['        <ModeSwitcher currentApp={currentApp} canSwitch={canSwitch} setActiveApp={setActiveApp} navigateToTab={navigateToTab} />\n'] + lines[2718:]

with open('src/App.jsx', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("OK")
