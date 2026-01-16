#!/usr/bin/env python3
import xml.etree.ElementTree as ET

tree = ET.parse('../assets/ArcRaidersTree.svg')
root = tree.getroot()

paths_to_check = {
    'path1': 'Tree D',
    'path2': 'Tree B', 
    'path21': 'Tree A',
    'path69': 'Tree C'
}

print("Comparing bottom connector path data:\n")

for path_id, tree_name in paths_to_check.items():
    for path_elem in root.iter():
        if path_elem.tag.endswith('path') and path_elem.get('id') == path_id:
            d_attr = path_elem.get('d', '')
            style = path_elem.get('style', '')
            stroke_width = path_elem.get('stroke-width', 'not set')
            
            print(f"{tree_name} ({path_id}):")
            print(f"  Length: {len(d_attr)} chars")
            print(f"  Style: {style if style else 'not set'}")
            print(f"  stroke-width attr: {stroke_width}")
            print(f"  Path: {d_attr}")
            print()
            break
