#!/usr/bin/env python3
import xml.etree.ElementTree as ET

# Parse SVG
tree = ET.parse('../assets/ArcRaidersTree.svg')
root = tree.getroot()

# Known bottom paths that work:
# Tree B: path2
# Tree A: path21
# Tree D: path1

working_paths = ['path1', 'path2', 'path21']
test_path = 'path69'

print("Working bottom connector paths:\n")
for path_elem in root.iter():
    if path_elem.tag.endswith('path'):
        path_id = path_elem.get('id')
        if path_id in working_paths + [test_path]:
            d_attr = path_elem.get('d')
            print(f"{path_id}:")
            print(f"  d: {d_attr}")
            print(f"  length: {len(d_attr)} chars\n")
