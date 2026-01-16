#!/usr/bin/env python3
"""
Remove all embedded images from the SVG file to reduce file size
"""

import xml.etree.ElementTree as ET

# Parse the SVG
ET.register_namespace('', 'http://www.w3.org/2000/svg')
ET.register_namespace('sodipodi', 'http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd')
ET.register_namespace('inkscape', 'http://www.inkscape.org/namespaces/inkscape')
ET.register_namespace('xlink', 'http://www.w3.org/1999/xlink')

tree = ET.parse('skill-tree-planner/assets/ArcRaidersTree.svg')
root = tree.getroot()

# Define namespaces
ns = {
    'svg': 'http://www.w3.org/2000/svg',
    'xlink': 'http://www.w3.org/1999/xlink'
}

# Find all image elements
images = root.findall('.//svg:image', ns)

print(f"Found {len(images)} image elements")

# Remove all images by iterating through all elements and removing image children
count = 0
for parent in root.iter():
    images_to_remove = [child for child in parent if child.tag.endswith('image')]
    for image in images_to_remove:
        parent.remove(image)
        count += 1
        print(f"  Removed image: {image.get('id')}")

# Write back
tree.write('skill-tree-planner/assets/ArcRaidersTree.svg', encoding='utf-8', xml_declaration=True)

print(f"\n✓ Removed {count} images from SVG file")
