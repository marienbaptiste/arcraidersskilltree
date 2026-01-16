#!/usr/bin/env python3
"""
Generate point number displays for multi-point containers.
Numbers should be displayed left-to-right inside the container.
"""

import re
from pathlib import Path

svg_path = Path(__file__).parent.parent / 'assets' / 'ARtreeforweb.svg'
config_path = Path(__file__).parent.parent / 'data' / 'config' / 'skillTreeConfig.json'

# Read config to get maxPoints for each node
import json
config_content = config_path.read_text(encoding='utf-8')
config = json.loads(config_content)

# Build a map of node ID to maxPoints
node_max_points = {}
for tree_id in ['A', 'B', 'C', 'D']:
    for node in config['trees'][tree_id]['nodes']:
        node_max_points[node['id']] = node['maxPoints']

# Read SVG
svg_content = svg_path.read_text(encoding='utf-8')

# Pattern to match containers
pattern = r'<path[^>]*\s+d="([^"]+)"[^>]*inkscape:label="Tree ([A-D]) container node ([^"]+)"'
matches = re.findall(pattern, svg_content)

print(f"Found {len(matches)} containers\n")

# Parse SVG path to get bounding box
def get_path_bounds(d_attr):
    """Extract bounding box from SVG path d attribute

    These paths start with 'm x,y' which gives us the starting position.
    The containers are horizontally oriented rounded rectangles, roughly 300x8 units.
    We'll use the starting position and add approximate dimensions.
    """
    # Get the starting position from the 'm' command
    m_match = re.match(r'm\s+([-\d.]+)[,\s]+([-\d.]+)', d_attr)
    if not m_match:
        return None

    start_x = float(m_match.group(1))
    start_y = float(m_match.group(2))

    # Containers are approximately 300 units wide and 8 units tall (horizontal orientation)
    # Based on examining the SVG, they extend to the left from the starting point
    width = 300
    height = 8

    return {
        'min_x': start_x - width,  # Container extends left
        'max_x': start_x,
        'min_y': start_y - height,  # Container extends up
        'max_y': start_y,
        'center_x': start_x - (width / 2),
        'center_y': start_y - (height / 2),
        'width': width,
        'height': height
    }

# Generate TSX code for point numbers
print("// Point numbers inside containers:")
print("// Add this as a new SVG layer after locks")
print()
print("{/* Top Layer: Point Numbers (renders above containers and locks) */}")
print("<svg")
print("  viewBox=\"0 0 717.06897 424.73498\"")
print("  className=\"absolute inset-0 w-full h-full\"")
print("  style={{ pointerEvents: 'none', zIndex: 1002 }}")
print(">")
print("  <g id=\"all-point-numbers\">")

for path_d, tree, node_id in matches:
    # Normalize node ID
    node_id_normalized = node_id.replace(' ', '-')
    skill_id = f"tree-{tree.lower()}-node-{node_id_normalized}"

    # Get maxPoints for this node
    max_points = node_max_points.get(skill_id, 1)

    # Only generate for multi-point nodes
    if max_points <= 1:
        continue

    # Get container bounds
    bounds = get_path_bounds(path_d)

    # Calculate positions for point numbers (evenly spaced, left to right)
    # Leave some padding from edges
    padding = bounds['width'] * 0.1
    usable_width = bounds['width'] - (2 * padding)
    spacing = usable_width / (max_points - 1) if max_points > 1 else 0

    # Position text at top center of container, inside the top edge
    text_x = bounds['center_x']
    text_y = bounds['min_y'] + 5  # 5 units below top edge to ensure it's inside

    print(f"    {{/* Tree {tree} node {node_id} - {max_points} points */}}")
    print(f"    {{shouldShowContainer('{skill_id}') && (")
    print(f"      <text")
    print(f"        x=\"{text_x:.2f}\"")
    print(f"        y=\"{text_y:.2f}\"")
    print(f"        textAnchor=\"middle\"")
    print(f"        dominantBaseline=\"hanging\"")
    print(f"        style={{{{")
    print(f"          fontSize: '9px',")
    print(f"          fill: '#6c7074',")
    print(f"          fontWeight: 'bold',")
    print(f"          userSelect: 'none'")
    print(f"        }}}}")
    print(f"      >")
    print(f"        {{state.skillPoints['{skill_id}'] || 0}}/{max_points}")
    print(f"      </text>")
    print(f"    )}}")

print("  </g>")
print("</svg>")
