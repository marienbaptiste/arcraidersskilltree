#!/usr/bin/env python3
import xml.etree.ElementTree as ET
import re

tree = ET.parse('../assets/ArcRaidersTree.svg')
root = tree.getroot()

print("Looking for groups labeled with Tree A, B, C, D:\n")

# Find all groups
for g_elem in root.iter():
    if g_elem.tag.endswith('g'):
        label = g_elem.get('{http://www.inkscape.org/namespaces/inkscape}label', '')
        g_id = g_elem.get('id')
        transform = g_elem.get('transform', '')
        
        if label and 'Tree' in label:
            print(f"Found: {label}")
            print(f"  ID: {g_id}")
            print(f"  Transform: {transform}")
            
            # Check if this group contains path69 or circle86
            for elem in g_elem.iter():
                elem_id = elem.get('id')
                if elem_id in ['path69', 'circle86', 'path2', 'path1', 'path21']:
                    elem_label = elem.get('{http://www.inkscape.org/namespaces/inkscape}label', '')
                    print(f"  Contains: {elem_id} ({elem_label if elem_label else 'no label'})")
            print()
