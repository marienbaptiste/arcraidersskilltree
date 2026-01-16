#!/usr/bin/env python3
"""
Match containers by geometric distance and update positions in SkillTree.tsx
"""

import re
from pathlib import Path
import math

def extract_centroid(path_d):
    """Extract approximate centroid from SVG path d attribute"""
    # Extract all coordinate pairs from the path
    coords = re.findall(r'(-?\d+\.?\d*),(-?\d+\.?\d*)', path_d)
    if not coords:
        return None

    # Calculate centroid
    x_coords = [float(x) for x, y in coords]
    y_coords = [float(y) for x, y in coords]

    return (sum(x_coords) / len(x_coords), sum(y_coords) / len(y_coords))

def distance(p1, p2):
    """Calculate Euclidean distance between two points"""
    return math.sqrt((p1[0] - p2[0])**2 + (p1[1] - p2[1])**2)

# Read the extracted containers from SVG
containers_file = Path(__file__).parent / 'containers_output.txt'
with open(containers_file, 'r', encoding='utf-8') as f:
    svg_containers_content = f.read()

# Extract SVG container data with labels
svg_pattern = r'{/\* (Tree [A-D] container node[^*]*) \*/}\s*<path\s+id="(container-[^"]+)"\s+d="([^"]*)"'
svg_matches = re.findall(svg_pattern, svg_containers_content)

# Build SVG containers dict with centroids
svg_containers = {}
for label, container_id, path_d in svg_matches:
    centroid = extract_centroid(path_d)
    if centroid:
        svg_containers[container_id] = {
            'label': label,
            'path_d': path_d,
            'centroid': centroid
        }

print(f"Found {len(svg_containers)} containers in SVG")

# Read SkillTree.tsx
tsx_file = Path(__file__).parent.parent / 'components' / 'SkillTree.tsx'
with open(tsx_file, 'r', encoding='utf-8') as f:
    tsx_content = f.read()

# Extract current TSX container data
tsx_pattern = r'id="(container-[^"]+)"\s+d="([^"]*)"'
tsx_matches = re.findall(tsx_pattern, tsx_content)

# Build TSX containers dict with centroids
tsx_containers = {}
for container_id, path_d in tsx_matches:
    centroid = extract_centroid(path_d)
    if centroid:
        tsx_containers[container_id] = {
            'path_d': path_d,
            'centroid': centroid
        }

print(f"Found {len(tsx_containers)} containers in TSX")

# For each TSX container, find the closest SVG container
matches = {}
used_svg_containers = set()

for tsx_id, tsx_data in tsx_containers.items():
    tsx_centroid = tsx_data['centroid']

    # Find closest SVG container
    min_distance = float('inf')
    closest_svg_id = None

    for svg_id, svg_data in svg_containers.items():
        if svg_id in used_svg_containers:
            continue

        svg_centroid = svg_data['centroid']
        dist = distance(tsx_centroid, svg_centroid)

        if dist < min_distance:
            min_distance = dist
            closest_svg_id = svg_id

    if closest_svg_id:
        matches[tsx_id] = {
            'svg_id': closest_svg_id,
            'new_path_d': svg_containers[closest_svg_id]['path_d'],
            'distance': min_distance,
            'label': svg_containers[closest_svg_id]['label']
        }
        used_svg_containers.add(closest_svg_id)
        print(f"{tsx_id} -> {closest_svg_id} (distance: {min_distance:.2f})")

# Update TSX file with new positions
updated_count = 0
new_tsx_content = tsx_content

for tsx_id, match_data in matches.items():
    new_path_d = match_data['new_path_d']

    # Find and replace the d attribute for this container
    pattern = rf'(id="{tsx_id}"\s+)d="[^"]*"'
    replacement = rf'\1d="{new_path_d}"'

    new_tsx_content = re.sub(pattern, replacement, new_tsx_content)
    updated_count += 1

# Write back to file
with open(tsx_file, 'w', encoding='utf-8') as f:
    f.write(new_tsx_content)

print(f"\nUpdated {updated_count} container positions in SkillTree.tsx")
