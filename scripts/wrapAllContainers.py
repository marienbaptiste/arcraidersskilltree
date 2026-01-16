#!/usr/bin/env python3
"""
Script to wrap all container paths with conditional rendering
"""

import re
from pathlib import Path

# Read the SkillTree.tsx file
tsx_path = Path(__file__).parent.parent / 'components' / 'SkillTree.tsx'
with open(tsx_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Pattern to match unwrapped containers (those not already wrapped with shouldShowContainer)
# Matches: {/* Tree X container node Y */} followed by <path ... />
unwrapped_pattern = r'(\s+){/\* Tree ([A-D]) container node ([^*]+) \*/}\s+<path\s+id="container-[a-d]-[^"]+"\s+d="([^"]+)"\s+fill="#090c19"\s+stroke="#6c7074"\s+strokeWidth="0\.7"\s+opacity="1"\s+/>'

def replace_container(match):
    indent = match.group(1)
    tree = match.group(2)
    node_id = match.group(3).strip()
    path_d = match.group(4)

    # Convert to proper node ID format: A-0 → tree-a-node-0
    skill_id = f"tree-{tree.lower()}-node-{node_id}"
    container_id = f"container-{tree.lower()}-{node_id.lower()}"

    # Create the wrapped version
    wrapped = f'''{indent}{{/* Tree {tree} container node {node_id} */}}
{indent}{{shouldShowContainer('{skill_id}') && (
{indent}  <path
{indent}    id="{container_id}"
{indent}    d="{path_d}"
{indent}    fill="#090c19"
{indent}    stroke="#6c7074"
{indent}    strokeWidth="0.7"
{indent}    opacity="1"
{indent}  />
{indent})}}'''

    return wrapped

# Replace all unwrapped containers
new_content = re.sub(unwrapped_pattern, replace_container, content)

# Count how many replacements were made
matches = list(re.finditer(unwrapped_pattern, content))
print(f"Found {len(matches)} unwrapped containers")

if matches:
    print("\nFirst match example:")
    print("Node:", matches[0].group(2) + "-" + matches[0].group(3).strip())

    # Write the updated content
    with open(tsx_path, 'w', encoding='utf-8') as f:
        f.write(new_content)

    print(f"\n✓ Wrapped {len(matches)} containers successfully!")
else:
    print("\n✓ All containers are already wrapped!")
