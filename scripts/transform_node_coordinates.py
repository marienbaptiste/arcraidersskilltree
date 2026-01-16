#!/usr/bin/env python3
"""
Transform node coordinates to match the new ArcRaidersTree.svg file.
The new SVG has transformations baked in, so we need to apply those same
transformations to the node coordinates.

Original transformations from old SVG:
- Tree A: matrix(0.82544171,0.56448736,0.56221371,-0.82211698,81.266847,463.85256)
- Tree D: matrix(-1,0,0,1,552.10903,48.512262)
- Tree B/C: translate(221.93716, 39.335736)
"""

import json
import math

def apply_matrix_transform(x, y, a, b, c, d, e, f):
    """Apply SVG matrix transformation: matrix(a,b,c,d,e,f)"""
    new_x = a * x + c * y + e
    new_y = b * x + d * y + f
    return new_x, new_y

def apply_translate(x, y, tx, ty):
    """Apply SVG translate transformation"""
    return x + tx, y + ty

# Read skillData.ts to extract current coordinates
import re

with open('skill-tree-planner/data/skillData.ts', 'r') as f:
    content = f.read()

# Find all node definitions
node_pattern = r"{\s*id:\s*'([^']+)',.*?tree:\s*'([A-D])',.*?x:\s*([\d.]+),\s*y:\s*([\d.]+),\s*radius:\s*([\d.]+)"
nodes = re.findall(node_pattern, content, re.DOTALL)

print("Found", len(nodes), "nodes")
print("\nTransformed coordinates:\n")

# Apply transformations
transformed = {}
for node_id, tree, x, y, r in nodes:
    x, y, r = float(x), float(y), float(r)

    if tree == 'A':
        # Apply Tree A transformation
        new_x, new_y = apply_matrix_transform(
            x, y,
            0.82544171, 0.56448736, 0.56221371, -0.82211698, 81.266847, 463.85256
        )
    elif tree == 'D':
        # Apply Tree D transformation (horizontal flip + translate)
        new_x, new_y = apply_matrix_transform(
            x, y,
            -1, 0, 0, 1, 552.10903, 48.512262
        )
    elif tree in ['B', 'C']:
        # Apply Tree B/C transformation
        new_x, new_y = apply_translate(x, y, 221.93716, 39.335736)
    else:
        new_x, new_y = x, y

    transformed[node_id] = (new_x, new_y, r)
    print(f"{node_id} (Tree {tree}): x={x:.6f}, y={y:.6f} -> x={new_x:.6f}, y={new_y:.6f}, r={r:.6f}")

# Save to JSON for easy use
with open('skill-tree-planner/scripts/transformed_coordinates.json', 'w') as f:
    json.dump({k: {'x': v[0], 'y': v[1], 'radius': v[2]} for k, v in transformed.items()}, f, indent=2)

print("\n✓ Saved transformed coordinates to transformed_coordinates.json")
