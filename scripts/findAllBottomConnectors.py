#!/usr/bin/env python3
import xml.etree.ElementTree as ET

tree = ET.parse('../assets/ArcRaidersTree.svg')
root = tree.getroot()

# Find all tier 0 nodes (circles)
print("Finding all tier 0 node positions:\n")
tier_0_nodes = {}
for elem in root.iter():
    elem_id = elem.get('id')
    if elem_id and elem_id.startswith('circle') and elem.tag.endswith('circle'):
        # Check if it's a key node (larger radius)
        r = float(elem.get('r', 0))
        if r > 10:  # Key nodes have r=13.517313
            cx = float(elem.get('cx'))
            cy = float(elem.get('cy'))
            tier_0_nodes[elem_id] = (cx, cy)
            print(f"{elem_id}: ({cx:.2f}, {cy:.2f})")

print(f"\n\nNow finding bottom connector paths (long paths, >150 chars, starting high y >200):\n")
for path_elem in root.iter():
    if path_elem.tag.endswith('path'):
        path_id = path_elem.get('id')
        if path_id and 'path102' not in path_id and 'path104' not in path_id:
            d_attr = path_elem.get('d')
            label = path_elem.get('{http://www.inkscape.org/namespaces/inkscape}label', '')
            
            if d_attr and (len(d_attr) > 70 and len(d_attr) < 180):
                # Check if it starts with high y coordinate
                import re
                m_match = re.search(r'[Mm]\s*([\d.-]+)\s*,\s*([\d.-]+)', d_attr)
                if m_match:
                    x = float(m_match.group(1))
                    y = float(m_match.group(2))
                    
                    if y > 200 or (len(d_attr) < 100 and 'c' in d_attr and y > 50):
                        print(f"{path_id}: starts at ({x:.2f}, {y:.2f}) - {len(d_attr)} chars")
                        if label:
                            print(f"  Label: {label}")
                        print()
