#!/usr/bin/env python3
import xml.etree.ElementTree as ET

# Parse SVG
tree = ET.parse('../assets/ArcRaidersTree.svg')
root = tree.getroot()

# Find circle86
for elem in root.iter():
    if elem.get('id') == 'circle86':
        cx = float(elem.get('cx'))
        cy = float(elem.get('cy'))
        print(f"Found circle86 at ({cx}, {cy})")
        break

# Find all paths
all_paths = []
for path_elem in root.iter():
    if path_elem.tag.endswith('path') and path_elem.get('id'):
        all_paths.append(path_elem)

print(f"\nTotal paths with IDs: {len(all_paths)}")

# Look for paths with IDs that might indicate they're bottom connectors
# User said it's "named" and "easy to find"
print("\nSearching for paths with suggestive IDs...")
print("\nPaths with 'c' or 'C' in ID:")
for path in all_paths:
    path_id = path.get('id')
    if 'c' in path_id.lower() or 'C' in path_id:
        d_attr = path.get('d')
        print(f"  {path_id}: {len(d_attr) if d_attr else 0} chars")

# Also list short paths (likely simple connectors)
print("\nShort paths (< 100 chars, likely simple connectors):")
for path in all_paths:
    path_id = path.get('id')
    d_attr = path.get('d')
    if d_attr and len(d_attr) < 100:
        print(f"  {path_id}: {len(d_attr)} chars - {d_attr}")
