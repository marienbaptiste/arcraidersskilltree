#!/usr/bin/env python3
"""
Analyze container positions relative to nodes to find the correct offset
"""

import re
import json

# Read the SkillTree.tsx file
with open('skill-tree-planner/components/SkillTree.tsx', 'r') as f:
    tsx_content = f.read()

# Load node data
with open('skill-tree-planner/data/config/skillTreeConfig.json', 'r') as f:
    config = json.load(f)

# Load calculated container centers
with open('skill-tree-planner/scripts/container_centers.json', 'r') as f:
    container_centers = json.load(f)

# Transformations for each tree
transformations = {
    'A': {'type': 'matrix', 'a': 0.82544171, 'b': 0.56448736, 'c': 0.56221371, 'd': -0.82211698, 'e': 81.266847, 'f': 463.85256},
    'B': {'type': 'translate', 'tx': 221.93716, 'ty': 39.335736},
    'C': {'type': 'translate', 'tx': 221.93716, 'ty': 39.335736},
    'D': {'type': 'matrix', 'a': -1, 'b': 0, 'c': 0, 'd': 1, 'e': 552.10903, 'f': 48.512262},
}

def apply_transform(x, y, tree):
    """Apply the appropriate transformation to node coordinates"""
    t = transformations[tree]
    if t['type'] == 'translate':
        return x + t['tx'], y + t['ty']
    else:  # matrix
        new_x = t['a'] * x + t['c'] * y + t['e']
        new_y = t['b'] * x + t['d'] * y + t['f']
        return new_x, new_y

# Analyze offsets for each tree
print("Container position analysis:\n")

for tree_letter in ['A', 'B', 'C', 'D']:
    tree_nodes = config['trees'][tree_letter]['nodes']

    # Filter nodes with maxPoints > 1
    multi_point_nodes = [n for n in tree_nodes if n.get('maxPoints', 1) > 1]

    if not multi_point_nodes:
        continue

    print(f"\n{'='*60}")
    print(f"Tree {tree_letter} ({len(multi_point_nodes)} multi-point nodes)")
    print(f"{'='*60}")

    offsets_y = []

    for node in multi_point_nodes[:5]:  # Show first 5
        node_id = node['id']
        container_id = f"container-{tree_letter.lower()}-{node_id.split('node-')[1]}"

        if container_id not in container_centers:
            continue

        # Get node position
        node_x, node_y = node['x'], node['y']
        radius = node['radius']

        # Apply transformation
        trans_x, trans_y = apply_transform(node_x, node_y, tree_letter)

        # Get container center
        container = container_centers[container_id]
        cont_x, cont_y = container['x'], container['y']

        # Calculate offset from node center + radius
        expected_y = trans_y + radius
        offset_y = cont_y - expected_y

        offsets_y.append(offset_y)

        print(f"\n{node_id}:")
        print(f"  Node: x={node_x:.2f}, y={node_y:.2f}, r={radius:.2f}")
        print(f"  Transformed: x={trans_x:.2f}, y={trans_y:.2f}")
        print(f"  Container center: x={cont_x:.2f}, y={cont_y:.2f}")
        print(f"  Expected y (node.y + radius): {expected_y:.2f}")
        print(f"  Offset: {offset_y:.2f}")

    if offsets_y:
        avg_offset = sum(offsets_y) / len(offsets_y)
        print(f"\n  Average Y offset: {avg_offset:.2f}")
        print(f"  → Use: y = node.y + radius + {avg_offset:.2f}")

print("\n" + "="*60)
print("\nRECOMMENDATION:")
print("Update text positioning to use container centers directly")
print("or use the calculated average offsets above.")
print("="*60)
