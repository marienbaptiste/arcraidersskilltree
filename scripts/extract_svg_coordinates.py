#!/usr/bin/env python3
import xml.etree.ElementTree as ET
import json

# Parse the SVG
tree = ET.parse('skill-tree-planner/assets/ArcRaidersTree.svg')
root = tree.getroot()

# Define SVG namespace
ns = {'svg': 'http://www.w3.org/2000/svg', 'inkscape': 'http://www.inkscape.org/namespaces/inkscape'}

# Find all circle elements
circles = {}
for circle in root.findall('.//svg:circle', ns):
    circle_id = circle.get('id')
    if circle_id:
        cx = float(circle.get('cx', 0))
        cy = float(circle.get('cy', 0))
        r = float(circle.get('r', 0))
        circles[circle_id] = {'cx': cx, 'cy': cy, 'r': r}

# Print the circles in a readable format
print("Found", len(circles), "circles")
print("\nCircle coordinates:")
for cid, coords in sorted(circles.items()):
    print(f"{cid}: x={coords['cx']:.6f}, y={coords['cy']:.6f}, r={coords['r']:.6f}")
