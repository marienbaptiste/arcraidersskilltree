#!/usr/bin/env python3
"""
Update skillData.ts with transformed coordinates
"""

import json
import re

# Load transformed coordinates
with open('skill-tree-planner/scripts/transformed_coordinates.json', 'r') as f:
    transformed = json.load(f)

# Read skillData.ts
with open('skill-tree-planner/data/skillData.ts', 'r') as f:
    content = f.read()

# Update each node's coordinates
for node_id, coords in transformed.items():
    # Find the node block and update x, y coordinates
    # Pattern to match: x: <number>, and y: <number>,

    # First, find the node block
    pattern = rf"(id:\s*'{re.escape(node_id)}'.*?)(x:\s*)([\d.]+)(,\s*y:\s*)([\d.]+)(,\s*radius:\s*)([\d.]+)"

    def replace_coords(match):
        return (match.group(1) +
                match.group(2) + f"{coords['x']:.6f}" +
                match.group(4) + f"{coords['y']:.6f}" +
                match.group(6) + f"{coords['radius']:.6f}")

    content = re.sub(pattern, replace_coords, content, flags=re.DOTALL)

# Write back
with open('skill-tree-planner/data/skillData.ts', 'w') as f:
    f.write(content)

print("✓ Updated skillData.ts with transformed coordinates")
print(f"  Updated {len(transformed)} nodes")
