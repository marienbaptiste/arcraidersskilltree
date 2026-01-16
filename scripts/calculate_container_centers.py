#!/usr/bin/env python3
"""
Calculate the center position of each container path to properly align the text
"""

import re
import json

# Read the SkillTree.tsx file
with open('skill-tree-planner/components/SkillTree.tsx', 'r') as f:
    content = f.read()

# Extract all container paths with their IDs and d attributes
pattern = r'id="(container-[a-z]-[^"]+)"\s+d="([^"]+)"'
containers = re.findall(pattern, content)

print(f"Found {len(containers)} containers\n")

# Function to calculate approximate center from path
def get_path_center(path_string):
    """
    Parse SVG path and calculate its approximate center.
    Containers are simple rounded rectangles, so we can extract key coordinates.
    """
    # Extract all coordinates from the path
    # Pattern: numbers (including negative and decimals)
    coords = re.findall(r'[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?', path_string)
    coords = [float(c) for c in coords]

    if len(coords) < 4:
        return None, None

    # Get x and y coordinates separately
    # First coordinate is the starting point from 'm'
    x_coords = [coords[i] for i in range(0, len(coords), 2)]
    y_coords = [coords[i] for i in range(1, len(coords), 2)]

    # Calculate bounding box
    min_x = min(x_coords)
    max_x = max(x_coords)
    min_y = min(y_coords)
    max_y = max(y_coords)

    # Calculate center
    center_x = (min_x + max_x) / 2
    center_y = (min_y + max_y) / 2

    return center_x, center_y

# Calculate centers for each container
results = {}
for container_id, path_d in containers:
    center_x, center_y = get_path_center(path_d)
    if center_x is not None:
        results[container_id] = {'x': center_x, 'y': center_y}

# Group by tree
tree_results = {'A': {}, 'B': {}, 'C': {}, 'D': {}}
for container_id, coords in results.items():
    match = re.match(r'container-([a-z])-(.+)', container_id)
    if match:
        tree = match.group(1).upper()
        node_suffix = match.group(2)
        node_id = f'tree-{tree.lower()}-node-{node_suffix}'
        tree_results[tree][node_id] = coords

# Print results by tree
for tree in ['A', 'B', 'C', 'D']:
    print(f"\nTree {tree} ({len(tree_results[tree])} containers):")
    for node_id, coords in sorted(list(tree_results[tree].items())[:3]):
        print(f"  {node_id}: x={coords['x']:.2f}, y={coords['y']:.2f}")

# Save to JSON for easy use
with open('skill-tree-planner/scripts/container_centers.json', 'w') as f:
    json.dump(results, f, indent=2)

print(f"\n✓ Calculated centers for {len(results)} containers")
print(f"✓ Saved to container_centers.json")
