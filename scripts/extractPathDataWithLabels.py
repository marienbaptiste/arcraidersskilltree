#!/usr/bin/env python3
import xml.etree.ElementTree as ET
import json

tree = ET.parse('../assets/ArcRaidersTree.svg')
root = tree.getroot()

path_data = {}

for path_elem in root.iter():
    if path_elem.tag.endswith('path'):
        path_id = path_elem.get('id')
        if path_id:
            d_attr = path_elem.get('d')
            label = path_elem.get('{http://www.inkscape.org/namespaces/inkscape}label', '')
            
            if d_attr:
                path_data[path_id] = {
                    'd': d_attr,
                    'label': label if label else None
                }

# Save to JSON
with open('pathDataWithLabels.json', 'w') as f:
    json.dump(path_data, f, indent=2)

print(f"Extracted {len(path_data)} paths with labels")
print("\nBottom connector paths:")
for pid in ['path1', 'path2', 'path21', 'path69']:
    if pid in path_data:
        label = path_data[pid]['label'] or 'NO LABEL'
        print(f"  {pid}: {label}")
