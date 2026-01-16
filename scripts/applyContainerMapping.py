#!/usr/bin/env python3
"""
Apply the container mapping to fix container IDs in SkillTree.tsx
"""

import json
import re
from pathlib import Path

# Load the mapping
mapping_path = Path(__file__).parent / 'container_mapping.json'
with open(mapping_path) as f:
    mapping = json.load(f)

print(f"Loaded {len(mapping)} container mappings")

# Read SkillTree.tsx
tsx_path = Path(__file__).parent.parent / 'components' / 'SkillTree.tsx'
content = tsx_path.read_text(encoding='utf-8')

# Apply each mapping
replacements = 0
for old_label, correct_node_id in mapping.items():
    # Convert old label to the format currently in TSX
    # e.g., "A-0" -> "tree-a-node-0"
    parts = old_label.split('-')
    tree = parts[0]
    node_part = '-'.join(parts[1:])
    current_wrong_id = f"tree-{tree.lower()}-node-{node_part}"

    # Replace in shouldShowContainer calls
    old_pattern = f"shouldShowContainer('{current_wrong_id}')"
    new_pattern = f"shouldShowContainer('{correct_node_id}')"

    if old_pattern in content:
        content = content.replace(old_pattern, new_pattern)
        replacements += 1
        print(f"  Fixed: {current_wrong_id} -> {correct_node_id}")

# Write back
tsx_path.write_text(content, encoding='utf-8')

print(f"\nApplied {replacements} container ID corrections")
