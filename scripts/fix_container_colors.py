#!/usr/bin/env python3
import re

# Read the file
with open('skill-tree-planner/components/SkillTree.tsx', 'r') as f:
    content = f.read()

# Pattern to match container paths with their IDs
pattern = r'(<path\s+id="container-[a-z]-[^"]+"\s+d="[^"]+"\s+fill="[^"]+"\s+)stroke="#6c7074"'

# Function to replace stroke with dynamic color
def replace_stroke(match):
    # Extract the container ID to get the node ID
    id_match = re.search(r'id="container-([a-z])-([^"]+)"', match.group(0))
    if id_match:
        tree = id_match.group(1)
        node_suffix = id_match.group(2)
        node_id = f'tree-{tree}-node-{node_suffix}'
        return match.group(1) + f"stroke={{getNodeColor('{node_id}')}}"
    return match.group(0)

# Replace all occurrences
new_content = re.sub(pattern, replace_stroke, content)

# Write back
with open('skill-tree-planner/components/SkillTree.tsx', 'w') as f:
    f.write(new_content)

print("✓ Updated all container stroke colors to use getNodeColor()")
