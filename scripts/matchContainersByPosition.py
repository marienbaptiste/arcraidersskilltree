#!/usr/bin/env python3
"""
Match container paths to nodes by position instead of by label
"""

import json
import re
from pathlib import Path

# Load config
config_path = Path(__file__).parent.parent / 'data' / 'config' / 'skillTreeConfig.json'
with open(config_path) as f:
    config = json.load(f)

# Get all nodes with maxPoints > 1
nodes_by_position = {}
for tree_key, tree_data in config['trees'].items():
    for node in tree_data['nodes']:
        if node['maxPoints'] > 1:
            pos_key = (round(node['x'], 0), round(node['y'], 0))
            nodes_by_position[pos_key] = node['id']

# Read SVG
svg_path = Path(__file__).parent.parent / 'assets' / 'ARtreeforweb.svg'
svg_content = svg_path.read_text(encoding='utf-8')

# Find all containers in SVG with their positions
# Pattern to match: label on one line, then path on next line
pattern = r'inkscape:label="Tree ([A-D]) container node ([^"]+)"[^>]*?/><path[^>]*?d="m\s+([0-9.-]+)[,\s]+([0-9.-]+)[^"]*?"'
container_matches = re.findall(pattern, svg_content, re.DOTALL)

print(f"Found {len(container_matches)} containers in SVG")
print(f"Have {len(nodes_by_position)} nodes with maxPoints > 1")

# Match containers to nodes by position
container_to_node = {}
mismatches = []

for tree_label, node_label, x_str, y_str in container_matches:
    x = round(float(x_str), 0)
    y = round(float(y_str), 0)

    old_id = f"{tree_label}-{node_label}"

    # Try to find matching node position (with some tolerance)
    matched = False
    for (node_x, node_y), node_id in nodes_by_position.items():
        # Check if tree matches and position is close
        if node_id.startswith(f"tree-{tree_label.lower()}-"):
            dx = abs(x - node_x)
            dy = abs(y - node_y)
            if dx < 10 and dy < 10:  # 10 pixel tolerance
                container_to_node[old_id] = node_id
                matched = True
                if old_id != f"{tree_label}-{node_id.split('-')[-1]}":
                    mismatches.append(f"{old_id} (pos: {x},{y}) -> {node_id} (pos: {node_x},{node_y})")
                break

    if not matched:
        print(f"WARNING: No match for container {old_id} at position ({x}, {y})")

print(f"\nFound {len(mismatches)} label mismatches:")
for mismatch in mismatches[:20]:
    print(f"  {mismatch}")

# Save mapping
output_path = Path(__file__).parent / 'container_mapping.json'
with open(output_path, 'w') as f:
    json.dump(container_to_node, f, indent=2)

print(f"\nSaved mapping to {output_path}")
