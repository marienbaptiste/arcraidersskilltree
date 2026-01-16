#!/usr/bin/env python3
"""
Update container paths in SkillTree.tsx with new positions from SVG
"""

import re
from pathlib import Path

# Read the extracted containers
containers_file = Path(__file__).parent / 'containers_output.txt'
with open(containers_file, 'r', encoding='utf-8') as f:
    containers_content = f.read()

# Extract container data
container_pattern = r'id="(container-[a-d]-[^"]+)"[^d]*d="([^"]*)"'
new_containers = dict(re.findall(container_pattern, containers_content))

print(f"Found {len(new_containers)} containers to update")

# Read SkillTree.tsx
tsx_file = Path(__file__).parent.parent / 'components' / 'SkillTree.tsx'
with open(tsx_file, 'r', encoding='utf-8') as f:
    tsx_content = f.read()

# Update each container's d attribute
updated_count = 0
for container_id, new_d in new_containers.items():
    # Find and replace the d attribute for this container
    pattern = rf'(id="{container_id}"[^d]*)d="[^"]*"'
    replacement = rf'\1d="{new_d}"'

    new_tsx_content = re.sub(pattern, replacement, tsx_content)

    if new_tsx_content != tsx_content:
        tsx_content = new_tsx_content
        updated_count += 1
        print(f"Updated {container_id}")

# Write back to file
with open(tsx_file, 'w', encoding='utf-8') as f:
    f.write(tsx_content)

print(f"\nUpdated {updated_count} containers in SkillTree.tsx")
