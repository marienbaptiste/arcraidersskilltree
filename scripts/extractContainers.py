#!/usr/bin/env python3
"""
Extract all point container paths from the SVG and generate React JSX code
"""

import re
from pathlib import Path

# Read the SVG file
svg_path = Path(__file__).parent.parent / 'assets' / 'ArcRaidersTree.svg'
with open(svg_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Find all path elements with container labels
# Pattern matches: d="..." (path data) ... inkscape:label="Tree X container node Y"
pattern = r'd="([^"]+)"[^>]*inkscape:label="(Tree [A-D] container node[^"]*)"'
matches = re.findall(pattern, content)

print(f"Found {len(matches)} container paths\n")
print("// Point containers overlay JSX:")
print("<g id=\"all-point-containers\">")

for path_data, label in matches:
    # Extract tree and node info from label
    tree_match = re.search(r'Tree ([A-D])', label)
    node_match = re.search(r'node (.+)$', label)

    if tree_match and node_match:
        tree = tree_match.group(1)
        node_id = node_match.group(1).replace(' ', '-')

        print(f"  {{/* {label} */}}")
        print(f"  <path")
        print(f"    id=\"container-{tree.lower()}-{node_id}\"")
        print(f"    d=\"{path_data}\"")
        print(f"    fill=\"#090c19\"")
        print(f"    stroke=\"#6c7074\"")
        print(f"    strokeWidth=\"0.7\"")
        print(f"    opacity=\"1\"")
        print(f"  />")

print("</g>")
