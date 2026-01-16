#!/usr/bin/env python3
"""
Extract containers EXACTLY as they appear in the SVG, preserving order and labels
"""

import re
from pathlib import Path

svg_path = Path(__file__).parent.parent / 'assets' / 'ARtreeforweb.svg'
svg_content = svg_path.read_text(encoding='utf-8')

# Pattern to match: path element with BOTH d attribute and inkscape:label on it
# The label is an attribute on the path element itself, after the d attribute
# Match: <path ... d="..." ... inkscape:label="Tree X container node Y"
pattern = r'<path[^>]*\s+d="([^"]+)"[^>]*inkscape:label="Tree ([A-D]) container node ([^"]+)"'

matches = re.findall(pattern, svg_content)

print(f"Found {len(matches)} containers in SVG\n")

# Generate TSX with EXACT labels from SVG
print("// Containers in exact SVG order:")
print("<g id=\"all-point-containers\">")

for path_d, tree, node_id in matches:
    # Convert label to node ID: "A" + "0" -> "tree-a-node-0"
    # Replace spaces with dashes for capstone nodes (e.g., "2-6 3-3" -> "2-6-3-3")
    node_id_normalized = node_id.replace(' ', '-')
    skill_id = f"tree-{tree.lower()}-node-{node_id_normalized}"
    container_id = f"container-{tree.lower()}-{node_id_normalized.lower()}"

    print(f"  {{/* Tree {tree} container node {node_id} */}}")
    print(f"  {{shouldShowContainer('{skill_id}') && (")
    print(f"    <path")
    print(f"      id=\"{container_id}\"")
    print(f"      d=\"{path_d}\"")
    print(f"      fill=\"#090c19\"")
    print(f"      stroke=\"#6c7074\"")
    print(f"      strokeWidth=\"0.7\"")
    print(f"      opacity=\"1\"")
    print(f"    />")
    print(f"  )}}")

print("</g>")
