#!/usr/bin/env python3
import xml.etree.ElementTree as ET
import re

tree = ET.parse('../assets/ArcRaidersTree.svg')
root = tree.getroot()

# Circle86 is at (157.36, 215.88)
target_x = 157.36

print("Looking for paths with starting coordinates near x=157 (Tree C):\n")
for path_elem in root.iter():
    if path_elem.tag.endswith('path'):
        path_id = path_elem.get('id')
        if path_id and 'path102' not in path_id and 'path104' not in path_id:
            d_attr = path_elem.get('d')
            label = path_elem.get('{http://www.inkscape.org/namespaces/inkscape}label', '')
            
            if d_attr:
                # Extract first coordinate pair (after M or m command)
                m_match = re.search(r'[Mm]\s*([\d.-]+)\s*,\s*([\d.-]+)', d_attr)
                if m_match:
                    x = float(m_match.group(1))
                    y = float(m_match.group(2))
                    
                    # Check if x is close to 157
                    if abs(x - target_x) < 10 or (d_attr.startswith('m') and abs(x) < 10):  # relative or absolute
                        print(f"{path_id}: starts at ({x}, {y})")
                        if label:
                            print(f"  Label: {label}")
                        print(f"  Length: {len(d_attr)} chars")
                        print(f"  d: {d_attr}\n")
