#!/usr/bin/env python3
"""
Group containers by tree for proper positioning
"""

import re
from pathlib import Path

# Read current SkillTree.tsx
tsx_path = Path(__file__).parent.parent / 'components' / 'SkillTree.tsx'
with open(tsx_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Extract all containers
container_pattern = r'{/\* Tree ([A-D]) container node ([^*]+) \*/}\s+{shouldShowContainer\(\'([^\']+)\'\) && \(\s+<path[^>]+/>\s+\)}'
containers = re.findall(container_pattern, content, re.DOTALL)

print(f"Found {len(containers)} containers")

# Group by tree
trees = {'A': [], 'B': [], 'C': [], 'D': []}
for match in re.finditer(container_pattern, content, re.DOTALL):
    tree = match.group(1)
    full_container = match.group(0)
    trees[tree].append(full_container)

print(f"Tree A: {len(trees['A'])} containers")
print(f"Tree B: {len(trees['B'])} containers")
print(f"Tree C: {len(trees['C'])} containers")
print(f"Tree D: {len(trees['D'])} containers")

# Build grouped containers for each tree
for tree_letter in ['A', 'B', 'C', 'D']:
    tree_containers = '\n'.join([f"              {c}" for c in trees[tree_letter]])
    print(f"\n--- Tree {tree_letter} containers ---")
    print(tree_containers[:200] + "...")
