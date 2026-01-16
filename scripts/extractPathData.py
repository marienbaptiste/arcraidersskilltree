#!/usr/bin/env python3
import xml.etree.ElementTree as ET
import json

# Parse SVG
tree = ET.parse('../assets/ArcRaidersTree.svg')
root = tree.getroot()

# Define namespace
ns = {'svg': 'http://www.w3.org/2000/svg', 'inkscape': 'http://www.inkscape.org/namespaces/inkscape'}

# Extract path data
path_data = {}

# Find all path elements
for path in root.findall('.//svg:path', ns):
    path_id = path.get('id')
    if path_id and path_id.startswith('path'):
        d_attr = path.get('d')
        if d_attr:
            path_data[path_id] = d_attr
            print(f"Found: {path_id}")

# Output as JSON
print(f"\nTotal paths found: {len(path_data)}")
print("\nJSON output:")
print(json.dumps(path_data, indent=2))
