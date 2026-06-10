#!/usr/bin/env python3

file_path = "src/components/PropPulse.jsx"

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add import if not present
if 'openPropertyPack' not in content:
    old_import = 'import { supabase } from "../lib/supabase";'
    new_import = 'import { supabase } from "../lib/supabase";\nimport { openPropertyPack } from "./property/propertyPackBus";'
    content = content.replace(old_import, new_import, 1)
    print("✅ Added openPropertyPack import")

# 2. Add helper function (after imports, before component)
if 'const openProjectPack' not in content:
    helper = '''
// Helper: open property pack for first unit of a project
const openProjectPack = async (projectId) => {
  try {
    const { data: firstUnit } = await supabase
      .from('project_units')
      .select('id')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true })
      .limit(1)
      .single();
    if (firstUnit?.id) {
      openPropertyPack(firstUnit.id);
    }
  } catch (err) {
    console.error('Failed to fetch first unit:', err);
  }
};
'''
    insert_pos = content.find('export default function PropPulse')
    if insert_pos > 0:
        content = content[:insert_pos] + helper + '\n' + content[insert_pos:]
        print("✅ Added openProjectPack helper function")

# 3. Patch line 475 onClick
old = 'onClick={()=>setSelProject(proj)}'
new = 'onClick={()=>{setSelProject(proj); openProjectPack(proj.id);}}'
if old in content:
    content = content.replace(old, new, 1)
    print("✅ Patched line 475 onClick")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ PropPulse patching complete")
