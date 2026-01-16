#!/usr/bin/env python3
"""
Fix container IDs from short format (A-0) to full format (tree-a-node-0)
"""

import re
from pathlib import Path

tsx_path = Path(__file__).parent.parent / 'components' / 'SkillTree.tsx'
content = tsx_path.read_text(encoding='utf-8')

# Pattern to match shouldShowContainer('X-Y')
def replace_container_id(match):
    full_call = match.group(0)
    old_id = match.group(1)

    # Parse the old ID (e.g., "A-0", "B-2-3")
    parts = old_id.split('-')
    tree = parts[0]  # e.g., "A"
    node_id = '-'.join(parts[1:])  # e.g., "0" or "2-3"

    # Convert to new format
    new_id = f"tree-{tree.lower()}-node-{node_id}"

    return f"shouldShowContainer('{new_id}')"

# Replace all container IDs
pattern = r"shouldShowContainer\('([A-D]-[^']+)'\)"
new_content = re.sub(pattern, replace_container_id, content)

# Count replacements
matches = re.findall(pattern, content)
print(f"Fixed {len(matches)} container IDs")

# Write back
tsx_path.write_text(new_content, encoding='utf-8')
print("Done!")
