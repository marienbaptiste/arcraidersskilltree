#!/usr/bin/env python3
import xml.etree.ElementTree as ET

tree = ET.parse('../assets/ArcRaidersTree.svg')
root = tree.getroot()

print("Paths WITHOUT labels (potential bottom connectors for Trees A, C, D):\n")
for path_elem in root.iter():
    if path_elem.tag.endswith('path'):
        path_id = path_elem.get('id')
        if path_id:
            label = path_elem.get('{http://www.inkscape.org/namespaces/inkscape}label', '')
            d_attr = path_elem.get('d')
            if not label and d_attr and len(d_attr) < 200 and 'path102' not in path_id and 'path104' not in path_id:
                print(f"{path_id}: {len(d_attr)} chars")
                print(f"  d: {d_attr}\n")
