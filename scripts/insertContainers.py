#!/usr/bin/env python3
"""
Insert all 60 containers into SkillTree.tsx at the correct location
"""

import re
from pathlib import Path

# Read files
tsx_path = Path(__file__).parent.parent / 'components' / 'SkillTree.tsx'
containers_path = Path(__file__).parent / 'containers_output.txt'

with open(tsx_path, 'r', encoding='utf-8') as f:
    tsx_lines = f.readlines()

with open(containers_path, 'r', encoding='utf-8') as f:
    containers_content = f.read()

# Parse containers and wrap them
container_pattern = r'{/\* Tree ([A-D]) container node ([^\*]+) \*/}\s+<path\s+id="container-([a-d]-[^"]+)"\s+d="([^"]+)"\s+fill="([^"]+)"\s+stroke="([^"]+)"\s+strokeWidth="([^"]+)"\s+opacity="([^"]+)"\s+/>'

containers_matches = list(re.finditer(container_pattern, containers_content))
print(f"Found {len(containers_matches)} containers")

# Build wrapped containers
wrapped_containers = []
for match in containers_matches:
    tree = match.group(1)
    node_id = match.group(2).strip()
    container_id = match.group(3)
    path_d = match.group(4)
    fill = match.group(5)
    stroke = match.group(6)
    stroke_width = match.group(7)
    opacity = match.group(8)

    skill_id = f"{tree}-{node_id}"

    wrapped = f"""              {{/* Tree {tree} container node {node_id} */}}
              {{shouldShowContainer('{skill_id}') && (
                <path
                  id="container-{container_id}"
                  d="{path_d}"
                  fill="{fill}"
                  stroke="{stroke}"
                  strokeWidth="{stroke_width}"
                  opacity="{opacity}"
                />
              )}}"""
    wrapped_containers.append(wrapped)

all_containers = '\n'.join(wrapped_containers)

# Find the line with "</svg>" and insert containers after it
new_lines = []
inserted = False
for i, line in enumerate(tsx_lines):
    new_lines.append(line)
    # Check if this is the interactive overlay closing tag (line 530 or 543)
    if not inserted and line.strip() == '</svg>' and i >= 525:  # Around line 530
        # Insert the new SVG layer with containers
        container_layer = f"""
          {{/* Top Layer: Point Containers (renders above everything) */}}
          <svg
            viewBox="0 0 717.06897 424.73498"
            className="absolute inset-0 w-full h-full"
            style={{{{ pointerEvents: 'none', zIndex: 1000 }}}}
          >
            {{/* All Points containers - 60 total across all trees */}}
            {{/* Only show containers for nodes with maxPoints > 1 that are unlocked or have points */}}
            <g id="all-point-containers">
{all_containers}
            </g>
          </svg>
"""
        new_lines.append(container_layer)
        inserted = True
        print(f"Inserted containers after line {i+1}")

# Write result
with open(tsx_path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print(f"Done! Added {len(containers_matches)} containers to SkillTree.tsx")
