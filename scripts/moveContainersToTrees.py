#!/usr/bin/env python3
"""
Move containers from flat group into their respective tree transform groups
"""

import re
from pathlib import Path

tsx_path = Path(__file__).parent.parent / 'components' / 'SkillTree.tsx'
content = tsx_path.read_text(encoding='utf-8')

# Extract all containers and group by tree
containers_by_tree = {'A': [], 'B': [], 'C': [], 'D': []}

pattern = r'{/\* Tree ([A-D]) container node ([^*]+) \*/}\s+{shouldShowContainer\([^)]+\) && \(\s+<path[^/]+/>\s+\)}'
for match in re.finditer(pattern, content, re.DOTALL):
    tree = match.group(1)
    full_text = match.group(0)
    containers_by_tree[tree].append(full_text)

print(f"Found containers:")
for tree in ['A', 'B', 'C', 'D']:
    print(f"  Tree {tree}: {len(containers_by_tree[tree])} containers")

# Now we need to insert each tree's containers into that tree's transformed group
# Find where each tree's paths group ends and insert containers there

for tree_letter in ['A', 'B', 'C', 'D']:
    pattern_tree_paths = f'{{/\\* Tree {tree_letter} Paths \\(rendered with transformation\\) \\*/}}'
    match = re.search(pattern_tree_paths, content)
    if match:
        print(f"\nFound Tree {tree_letter} Paths group at position {match.start()}")

print("\n✓ Analysis complete. Containers need to be moved into tree transform groups.")
print("This will require manual restructuring of the TSX file.")
