#!/usr/bin/env python3
"""
Find the container path that doesn't have a proper label
"""

import re
from pathlib import Path

svg_path = Path(__file__).parent.parent / 'assets' / 'ARtreeforweb.svg'
with open(svg_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Find all path elements with id="path102*"
path_pattern = r'<path[^>]*?id="(path102[^"]*)"[^>]*?d="([^"]+)"[^>]*?inkscape:label="([^"]*)"'
paths = re.findall(path_pattern, content, re.DOTALL)

print(f"Found {len(paths)} container paths with labels\n")

# Group by Tree D
tree_d_paths = [(pid, d, label) for pid, d, label in paths if 'Tree D container' in label]
print(f"Tree D containers: {len(tree_d_paths)}")

for pid, d, label in tree_d_paths:
    # Extract node ID from label
    match = re.search(r'Tree D container node ([^\s"]+)', label)
    if match:
        node_id = match.group(1)
        # Show first 50 chars of path data
        print(f"  D-{node_id}: {d[:60]}...")

# Also check for paths without the inkscape:label pattern
all_path102_pattern = r'id="(path102[^"]*)"[^>]*?d="([^"]+)"'
all_paths = re.findall(all_path102_pattern, content)
print(f"\nTotal path102 elements: {len(all_paths)}")

# Find paths that don't have inkscape:label
labeled_ids = set(p[0] for p in paths)
unlabeled = [(pid, d) for pid, d in all_paths if pid not in labeled_ids]
print(f"Unlabeled paths: {len(unlabeled)}")
for pid, d in unlabeled[:5]:  # Show first 5
    print(f"  {pid}: {d[:60]}...")
