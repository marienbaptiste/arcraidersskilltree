#!/usr/bin/env python3
import xml.etree.ElementTree as ET
import json

# Parse SVG
tree = ET.parse('../assets/ArcRaidersTree.svg')
root = tree.getroot()

# Find circle86 (Tree C node 0)
print("Looking for Tree C tier 0 node (circle86)...")
for elem in root.iter():
    if elem.get('id') == 'circle86':
        cx = float(elem.get('cx'))
        cy = float(elem.get('cy'))
        print(f"Found circle86 at ({cx}, {cy})")

        # List all path IDs that might be related
        print("\nAll paths in SVG:")
        all_paths = {}
        for path_elem in root.iter():
            if path_elem.tag.endswith('path'):
                path_id = path_elem.get('id')
                if path_id:
                    d_attr = path_elem.get('d')
                    all_paths[path_id] = {
                        'd': d_attr,
                        'length': len(d_attr) if d_attr else 0,
                        'inkscape_label': path_elem.get('{http://www.inkscape.org/namespaces/inkscape}label', '')
                    }

        # Print all paths sorted by ID
        for path_id in sorted(all_paths.keys(), key=lambda x: int(x.replace('path', '')) if x.replace('path', '').isdigit() else 999999):
            path_info = all_paths[path_id]
            label = f" (label: {path_info['inkscape_label']})" if path_info['inkscape_label'] else ""
            print(f"  {path_id}: {path_info['length']} chars{label}")

        print(f"\nTotal paths: {len(all_paths)}")
        break
