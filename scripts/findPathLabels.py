#!/usr/bin/env python3
import xml.etree.ElementTree as ET
import json

tree = ET.parse('../assets/ArcRaidersTree.svg')
root = tree.getroot()

print("Bottom connector paths (path 0):\n")

for path_elem in root.iter():
    if path_elem.tag.endswith('path'):
        path_id = path_elem.get('id')
        if path_id:
            label = path_elem.get('{http://www.inkscape.org/namespaces/inkscape}label', '')
            d_attr = path_elem.get('d')
            
            if label and 'path 0' in label.lower():
                print(f"Path ID: {path_id}")
                print(f"Label: {label}")
                print(f"Length: {len(d_attr)} chars")
                print()
