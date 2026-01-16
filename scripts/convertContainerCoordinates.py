#!/usr/bin/env python3
"""
The containers currently have local coordinates (relative to tree transforms).
Since locks work in the overlay, containers must use ABSOLUTE coordinates.
This script extracts containers with their tree transforms already applied to get absolute coords.
"""

import re
import svg.path
from pathlib import Path

# Read SVG
svg_path = Path(__file__).parent.parent / 'assets' / 'ARtreeforweb.svg'
content = svg_path.read_text(encoding='utf-8')

# Extract tree transforms - looking at where containers actually are in the SVG
tree_data = {}
for tree_letter in ['A', 'B', 'C', 'D']:
    # Find the group that contains this tree's containers
    # Pattern: find a <g> tag that has containers for this tree as children
    pattern = f'<g[^>]*>.*?Tree {tree_letter} container node'
    match = re.search(pattern, content, re.DOTALL)
    if match:
        # Now find the transform on this group
        group_start = content.rfind('<g', 0, match.start())
        group_tag = content[group_start:content.find('>', group_start)+1]

        transform_match = re.search(r'transform="([^"]+)"', group_tag)
        if transform_match:
            transform = transform_match.group(1)
            print(f"Tree {tree_letter}: {transform}")
            tree_data[tree_letter] = transform

print("\nThis shows what transforms need to be applied to container coordinates")
print("Containers are INSIDE transformed groups, so their coordinates are relative")
print("For overlay rendering, we need ABSOLUTE coordinates (like the locks have)")
