#!/usr/bin/env python3
"""
Match container paths to nodes by applying tree transforms
"""

import json
import re
from pathlib import Path

# Load config
config_path = Path(__file__).parent.parent / 'data' / 'config' / 'skillTreeConfig.json'
with open(config_path) as f:
    config = json.load(f)

# Read SVG
svg_path = Path(__file__).parent.parent / 'assets' / 'ARtreeforweb.svg'
svg_content = svg_path.read_text(encoding='utf-8')

# Extract tree transforms from SVG
tree_transforms = {}
for tree_letter in ['A', 'B', 'C', 'D']:
    # Try matrix first
    pattern = f'inkscape:label="Tree {tree_letter}"[^>]*transform="matrix\\(([^)]+)\\)"'
    match = re.search(pattern, svg_content)
    if match:
        values = [float(x) for x in match.group(1).split(',')]
        # Matrix format: a, b, c, d, e, f
        # where x' = a*x + c*y + e, y' = b*x + d*y + f
        tree_transforms[tree_letter] = values
        print(f"Tree {tree_letter} transform (matrix): {values}")
    else:
        # Try translate
        pattern = f'inkscape:label="Tree {tree_letter}"[^>]*transform="translate\\(([^)]+)\\)"'
        match = re.search(pattern, svg_content)
        if match:
            tx, ty = [float(x) for x in match.group(1).split(',')]
            # Translate is equivalent to matrix(1, 0, 0, 1, tx, ty)
            tree_transforms[tree_letter] = [1, 0, 0, 1, tx, ty]
            print(f"Tree {tree_letter} transform (translate): {tx}, {ty}")

# Find all containers in SVG with their positions
pattern = r'inkscape:label="Tree ([A-D]) container node ([^"]+)"[^>]*?/><path[^>]*?d="m\s+([0-9.-]+)[,\s]+([0-9.-]+)[^"]*?"'
container_matches = re.findall(pattern, svg_content, re.DOTALL)

print(f"\nFound {len(container_matches)} containers in SVG")

# Build mapping from container label to position
containers = {}
for tree, node_id, x, y in container_matches:
    containers[f"{tree}-{node_id}"] = (float(x), float(y))

# Transform node positions and match to containers
mapping = {}
mismatches = []

for tree_key, tree_data in config['trees'].items():
    tree_letter = tree_key
    transform = tree_transforms.get(tree_letter)

    if not transform:
        print(f"WARNING: No transform for tree {tree_letter}")
        continue

    a, b, c, d, e, f = transform

    for node in tree_data['nodes']:
        if node['maxPoints'] <= 1:
            continue

        # Apply transform to node position
        x, y = node['x'], node['y']
        x_transformed = a * x + c * y + e
        y_transformed = b * x + d * y + f

        # Try to find matching container
        best_match = None
        best_distance = float('inf')

        for container_label, (cx, cy) in containers.items():
            if not container_label.startswith(f"{tree_letter}-"):
                continue

            distance = ((x_transformed - cx)**2 + (y_transformed - cy)**2)**0.5
            if distance < best_distance:
                best_distance = distance
                best_match = container_label

        if best_match and best_distance < 15:  # 15 pixel tolerance
            # Extract the node ID from the label
            expected_label = f"{tree_letter}-{node['id'].split('node-')[1]}"
            mapping[best_match] = node['id']

            if best_match != expected_label:
                mismatches.append({
                    'container_label': best_match,
                    'should_be': node['id'],
                    'distance': round(best_distance, 1)
                })
        else:
            print(f"WARNING: No match for node {node['id']} (transformed pos: {x_transformed:.1f}, {y_transformed:.1f}, best distance: {best_distance:.1f})")

print(f"\nMatched {len(mapping)} containers to nodes")
print(f"Found {len(mismatches)} label mismatches:")

for mismatch in sorted(mismatches, key=lambda x: x['container_label'])[:30]:
    print(f"  Container '{mismatch['container_label']}' -> should be '{mismatch['should_be']}' (dist: {mismatch['distance']})")

# Save mapping
output_path = Path(__file__).parent / 'container_mapping.json'
with open(output_path, 'w') as f:
    json.dump(mapping, f, indent=2, sort_keys=True)

print(f"\nSaved mapping to {output_path}")
