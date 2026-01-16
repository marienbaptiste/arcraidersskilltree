#!/usr/bin/env python3
"""
Extract tree bounding boxes from the SVG and calculate optimal viewport settings
"""

import re
import json
import math
from pathlib import Path

# Read the SVG file
svg_path = Path(__file__).parent.parent / 'assets' / 'ArcRaidersTree.svg'
with open(svg_path, 'r', encoding='utf-8') as f:
    content = f.read()

# First, find the Tree BoundingBoxes layer
bbox_layer_match = re.search(r'inkscape:label="Tree BoundingBoxes"[^>]*>(.*?)</g>', content, re.DOTALL)

if not bbox_layer_match:
    print('{"error": "Tree BoundingBoxes layer not found"}')
    exit(1)

bbox_layer_content = bbox_layer_match.group(1)

# Pattern to match rect elements with tree labels in the BoundingBoxes layer
pattern = r'<rect[^>]*inkscape:label="Tree ([A-D])"[^>]*>'

trees = {}

for match in re.finditer(pattern, bbox_layer_content):
    rect_element = match.group(0)
    tree_name = match.group(1)

    # Extract attributes from the rect element
    width_match = re.search(r'width="([^"]+)"', rect_element)
    height_match = re.search(r'height="([^"]+)"', rect_element)
    x_match = re.search(r'x="([^"]+)"', rect_element)
    y_match = re.search(r'y="([^"]+)"', rect_element)
    transform_match = re.search(r'transform="rotate\(([^)]+)\)"', rect_element)

    if width_match and height_match and x_match and y_match:
        tree_data = {
            'name': f'Tree {tree_name}',
            'width': float(width_match.group(1)),
            'height': float(height_match.group(1)),
            'x': float(x_match.group(1)),
            'y': float(y_match.group(1)),
        }

        if transform_match:
            tree_data['rotation'] = float(transform_match.group(1))

        trees[tree_name] = tree_data

# Calculate the overall bounding box that encompasses all trees
if trees:
    # For rotated rectangles, we need to calculate the actual bounding box
    all_x_coords = []
    all_y_coords = []

    for tree_id, tree in trees.items():
        x, y, w, h = tree['x'], tree['y'], tree['width'], tree['height']

        if 'rotation' in tree:
            # Convert rotation to radians
            angle = math.radians(tree['rotation'])
            cos_a = math.cos(angle)
            sin_a = math.sin(angle)

            # Four corners of the rectangle before rotation (relative to top-left)
            corners = [
                (0, 0),
                (w, 0),
                (w, h),
                (0, h)
            ]

            # Rotate each corner around origin, then translate to position
            rotated_corners = []
            for cx, cy in corners:
                # Rotate
                rx = cx * cos_a - cy * sin_a
                ry = cx * sin_a + cy * cos_a
                # Translate to actual position
                rotated_corners.append((rx + x, ry + y))

            all_x_coords.extend([c[0] for c in rotated_corners])
            all_y_coords.extend([c[1] for c in rotated_corners])

            # Store rotated corners for later use
            tree['corners'] = rotated_corners
        else:
            # No rotation - simple bounding box
            all_x_coords.extend([x, x + w])
            all_y_coords.extend([y, y + h])

            # Store corners for consistency
            tree['corners'] = [
                (x, y),
                (x + w, y),
                (x + w, y + h),
                (x, y + h)
            ]

    min_x = min(all_x_coords)
    max_x = max(all_x_coords)
    min_y = min(all_y_coords)
    max_y = max(all_y_coords)

    overall_bbox = {
        'x': min_x,
        'y': min_y,
        'width': max_x - min_x,
        'height': max_y - min_y,
        'centerX': (min_x + max_x) / 2,
        'centerY': (min_y + max_y) / 2
    }

    output = {
        'trees': trees,
        'overallBoundingBox': overall_bbox
    }

    print(json.dumps(output, indent=2))
else:
    print('{"error": "No bounding boxes found"}')
