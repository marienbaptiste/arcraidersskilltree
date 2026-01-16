#!/usr/bin/env python3
"""
Fix container mapping by matching container positions to closest nodes
"""

import re
import json
import math
from pathlib import Path

# Load SVG
svg_path = Path(__file__).parent.parent / 'assets' / 'ARtreeforweb.svg'
svg_content = svg_path.read_text(encoding='utf-8')

# Load config
config_path = Path(__file__).parent.parent / 'data' / 'config' / 'skillTreeConfig.json'
config = json.loads(config_path.read_text())

# Tree transforms
transforms = {
    'A': (0.82544171, 0.56448736, 0.56221371, -0.82211698, 81.266847, 463.85256),
    'B': (0.89936804, -0.43717992, -0.43524462, -0.89585089, 610.80536, 537.82782),
    'C': (-0.52573371, -0.85068281, -0.84681827, 0.52357993, 572.66577, 88.767464),
    'D': (-0.43320549, 0.90128931, 0.89741215, 0.43171024, 39.071412, -145.14677)
}

# Extract all containers by tree
pattern = r'inkscape:label="Tree ([A-D]) container node ([^"]+)"[^>]*\/><path[^>]*\s+d="([^"]+)"'
all_containers = re.findall(pattern, svg_content)

print(f"Found {len(all_containers)} containers total")
print()

# For each tree, find correct mapping
for tree_letter in ['A', 'B', 'C', 'D']:
    print(f"=== Tree {tree_letter} ===")

    # Get nodes for this tree
    tree_nodes = {node['id']: (node['x'], node['y'])
                  for node in config['trees'][tree_letter]['nodes']}

    # Get transform
    a, b, c, d, e, f = transforms[tree_letter]

    # Get containers for this tree
    tree_containers = [(label, path_d) for tree, label, path_d in all_containers
                       if tree == tree_letter]

    print(f"Nodes: {len(tree_nodes)}, Containers: {len(tree_containers)}")

    # For each container, find closest node
    mappings = []
    for label, path_d in tree_containers:
        # Extract starting position from path
        coord_match = re.search(r'm\s+([\d.]+),([\d.]+)', path_d)
        if not coord_match:
            continue
        cx, cy = float(coord_match.group(1)), float(coord_match.group(2))

        # Find closest node
        min_dist = float('inf')
        closest_node_id = None
        for node_id, (nx, ny) in tree_nodes.items():
            # Transform node position
            tx = a * nx + c * ny + e
            ty = b * nx + d * ny + f
            dist = math.sqrt((tx - cx)**2 + (ty - cy)**2)
            if dist < min_dist:
                min_dist = dist
                closest_node_id = node_id

        mappings.append((closest_node_id, path_d, label, cx, cy, min_dist))

    # Sort by node_id to get correct order
    mappings.sort(key=lambda x: x[0])

    # Generate TSX
    print(f"\n  {/* Tree {tree_letter} Containers */}")
    for node_id, path_d, orig_label, cx, cy, dist in mappings:
        container_id = node_id.replace('tree-', 'container-').replace('-node-', '-')
        print(f"  {{/* {node_id} (was labeled '{orig_label}', dist={dist:.1f}) */}}")
        print(f"  {{shouldShowContainer('{node_id}') && (")
        print(f"    <path")
        print(f"      id=\"{container_id}\"")
        print(f"      d=\"{path_d}\"")
        print(f"      fill=\"#090c19\"")
        print(f"      stroke=\"#6c7074\"")
        print(f"      strokeWidth=\"0.7\"")
        print(f"      opacity=\"1\"")
        print(f"    />")
        print(f"  )}}")
    print()
