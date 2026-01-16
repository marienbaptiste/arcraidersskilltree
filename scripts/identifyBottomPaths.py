#!/usr/bin/env python3
import xml.etree.ElementTree as ET
import re

tree = ET.parse('../assets/ArcRaidersTree.svg')
root = tree.getroot()

# We know:
# - circle86 is Tree C tier 0 at (157.36, 215.89)
# - path69 starts at (157.32, 229.50) - matches Tree C!
# - path2 starts at (128.99, 246.78) - labeled Tree B
# - path1 starts at (131.66, 242.47) - unlabeled, likely Tree D or A
# - path21 starts at (131.93, 241.18) - unlabeled, likely Tree D or A

# Let's find all tier 0 circles and their positions
print("Tier 0 nodes (large circles, r > 10):\n")
tier0_circles = []
for elem in root.iter():
    if elem.tag.endswith('circle'):
        r = float(elem.get('r', 0))
        if r > 10:
            cx = float(elem.get('cx'))
            cy = float(elem.get('cy'))
            elem_id = elem.get('id')
            tier0_circles.append((elem_id, cx, cy))
            print(f"{elem_id}: ({cx:.2f}, {cy:.2f})")

# Find all long paths (potential bottom connectors)
print("\n\nLong paths (>70 chars, <180 chars, high y > 200):\n")
bottom_paths = []
for path_elem in root.iter():
    if path_elem.tag.endswith('path'):
        path_id = path_elem.get('id')
        if path_id and 'path102' not in path_id and 'path104' not in path_id:
            d_attr = path_elem.get('d')
            label = path_elem.get('{http://www.inkscape.org/namespaces/inkscape}label', '')
            
            if d_attr and 70 < len(d_attr) < 180:
                m = re.search(r'[Mm]\s*([\d.-]+)\s*,\s*([\d.-]+)', d_attr)
                if m:
                    x = float(m.group(1))
                    y = float(m.group(2))
                    if y > 200:
                        bottom_paths.append((path_id, x, y, len(d_attr), label))
                        label_str = f" [{label}]" if label else ""
                        print(f"{path_id}: ({x:.2f}, {y:.2f}) - {len(d_attr)} chars{label_str}")

# Match paths to circles
print("\n\nMatching bottom paths to tier 0 circles:")
print("\nTree C (circle86 at 157.36, 215.89):")
for path_id, x, y, length, label in bottom_paths:
    if abs(x - 157.36) < 30:
        print(f"  → {path_id} at ({x:.2f}, {y:.2f}) - {label if label else 'UNLABELED'}")
