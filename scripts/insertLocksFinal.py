#!/usr/bin/env python3
"""
Insert all 16 lock icons into SkillTree.tsx at the correct location
"""

import re
from pathlib import Path

# Read files
tsx_path = Path(__file__).parent.parent / 'components' / 'SkillTree.tsx'
locks_path = Path(__file__).parent / 'locks_output.txt'

with open(tsx_path, 'r', encoding='utf-8') as f:
    tsx_content = f.read()

with open(locks_path, 'r', encoding='utf-8') as f:
    locks_content = f.read()

# Parse locks and wrap them with conditional rendering
# Extract each lock group WITHOUT the comment (we'll add our own)
lock_pattern = r'{/\* Tree ([A-D]) lock ([^\*]+) \*/}\s+(<g id="lock-[^>]*>.*?</g>)'

locks_matches = list(re.finditer(lock_pattern, locks_content, re.DOTALL))
print(f"Found {len(locks_matches)} lock icons")

# Build wrapped locks with conditional rendering
wrapped_locks = []
for match in locks_matches:
    tree = match.group(1)
    node_id = match.group(2).strip()
    lock_group = match.group(3)  # Just the <g>...</g> without comment

    # Convert to proper node ID format: A-2-3 → tree-a-node-2-3
    skill_id = f"tree-{tree.lower()}-node-{node_id}"

    # Remove visibility="hidden" from the group since we'll control visibility with React
    lock_group = re.sub(r'\s+visibility="hidden"', '', lock_group)

    # Properly indent the lock group
    lock_lines = lock_group.split('\n')
    indented_lock = []
    for line in lock_lines:
        if line.strip():
            indented_lock.append('                ' + line)
        else:
            indented_lock.append(line)

    lock_group_indented = '\n'.join(indented_lock)

    # Wrap with conditional rendering - locks show when node is locked
    wrapped = f"""              {{/* Tree {tree} lock {node_id} */}}
              {{shouldShowLock('{skill_id}') && (
{lock_group_indented}
              )}}"""

    wrapped_locks.append(wrapped)

all_locks = '\n'.join(wrapped_locks)

# Find where to insert - after the containers layer
# Look for the closing </svg> tag of the containers layer
pattern = r'(</svg>\s*{/\* Top Layer: Point Containers.*?\*/})'
match = re.search(pattern, tsx_content, re.DOTALL)

if match:
    insertion_point = match.end()

    # Create the locks layer
    locks_layer = f"""

          {{/* Top Layer: Lock Icons (renders above containers) */}}
          <svg
            viewBox="0 0 717.06897 424.73498"
            className="absolute inset-0 w-full h-full"
            style={{{{ pointerEvents: 'none', zIndex: 1001 }}}}
          >
            {{/* All Lock icons - 16 total across all trees */}}
            {{/* Only show locks for gated/locked nodes */}}
            <g id="all-lock-icons">
{all_locks}
            </g>
          </svg>
"""

    # Insert the locks layer
    new_content = tsx_content[:insertion_point] + locks_layer + tsx_content[insertion_point:]

    # Write result
    with open(tsx_path, 'w', encoding='utf-8') as f:
        f.write(new_content)

    print(f"Done! Added {len(locks_matches)} lock icons to SkillTree.tsx")
else:
    print("ERROR: Could not find insertion point")
