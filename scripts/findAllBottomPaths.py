#!/usr/bin/env python3
import xml.etree.ElementTree as ET

tree = ET.parse('../assets/ArcRaidersTree.svg')
root = tree.getroot()

print("Searching for all Tree paths labeled 'path 0':\n")

for tree_name in ['Tree A', 'Tree B', 'Tree C', 'Tree D']:
    print(f"\n{tree_name}:")
    found = False
    for path_elem in root.iter():
        if path_elem.tag.endswith('path'):
            path_id = path_elem.get('id')
            if path_id:
                label = path_elem.get('{http://www.inkscape.org/namespaces/inkscape}label', '')
                d_attr = path_elem.get('d')
                
                if label and label.startswith(tree_name) and 'path 0' in label:
                    import re
                    m = re.search(r'[Mm]\s*([\d.-]+)\s*,\s*([\d.-]+)', d_attr)
                    start = f"({m.group(1)}, {m.group(2)})" if m else "N/A"
                    print(f"  Path ID: {path_id}")
                    print(f"  Label: {label}")
                    print(f"  Starts at: {start}")
                    print(f"  Length: {len(d_attr)} chars")
                    found = True
    
    if not found:
        print(f"  NO PATH FOUND!")
