#!/usr/bin/env python3
import xml.etree.ElementTree as ET

tree = ET.parse('../assets/ArcRaidersTree.svg')
root = tree.getroot()

print("Looking for paths in Tree C group (g100) that connect to node 0:\n")

# Find Tree C group
for g_elem in root.iter():
    if g_elem.tag.endswith('g') and g_elem.get('id') == 'g100':
        print(f"Found Tree C group: {g_elem.get('id')}")
        print(f"Label: {g_elem.get('{http://www.inkscape.org/namespaces/inkscape}label', '')}")
        print(f"Transform: {g_elem.get('transform', '')}\n")
        
        print("Paths in this group:\n")
        for elem in g_elem.iter():
            if elem.tag.endswith('path'):
                elem_id = elem.get('id')
                label = elem.get('{http://www.inkscape.org/namespaces/inkscape}label', '')
                d_attr = elem.get('d', '')
                
                # Look for paths related to node 0
                if label and ('node 0' in label.lower() or 'path 0' in label.lower()):
                    print(f"Path ID: {elem_id}")
                    print(f"Label: {label}")
                    print(f"Length: {len(d_attr)} chars")
                    print(f"d: {d_attr[:100]}...")
                    print()
        
        break
