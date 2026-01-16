#!/usr/bin/env python3
"""
Add conditional rendering for all point containers
"""

import re
from pathlib import Path

# Read the SkillTree.tsx file
tsx_path = Path(__file__).parent.parent / 'components' / 'SkillTree.tsx'
with open(tsx_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Step 1: Add the helper function before the return statement
helper_function = """  // Helper to check if a container should be shown
  const shouldShowContainer = (nodeId: string) => {
    const node = skillNodes.find((n) => n.id === nodeId);
    if (!node || node.maxPoints <= 1) return false;

    const currentPoints = getSkillPoints(nodeId);
    const totalTreePoints = getTotalTreePoints(node.tree);
    const nodeState = getSkillState(node, state.skillPoints, totalTreePoints, skillNodes);

    // Show container if node has points or is unlocked
    return currentPoints > 0 || nodeState === 'unlocked';
  };

"""

# Find where to insert the helper (before the return statement)
for i, line in enumerate(lines):
    if line.strip() == 'return (':
        lines.insert(i, helper_function)
        print(f"Added helper function before line {i+1}")
        break

# Step 2: Wrap each container with conditional rendering
# We'll do this by finding container patterns and wrapping them
output_lines = []
i = 0
wrapped_count = 0

while i < len(lines):
    line = lines[i]

    # Check if this is a container comment
    container_match = re.match(r'(\s+){/\* Tree ([A-D]) container node ([^\*]+) \*/}', line)

    if container_match and i + 1 < len(lines):
        indent = container_match.group(1)
        tree = container_match.group(2)
        node_id = container_match.group(3).strip()
        skill_id = f"{tree}-{node_id}"

        # Check if next line is a path element (not already wrapped)
        next_line = lines[i + 1]
        if '<path' in next_line and 'shouldShowContainer' not in next_line:
            # Found unwrapped container, wrap it
            output_lines.append(line)  # Keep the comment
            output_lines.append(f"{indent}{{shouldShowContainer('{skill_id}') && (\n")

            # Add the path element with adjusted indentation
            path_lines = []
            j = i + 1
            while j < len(lines):
                path_line = lines[j]
                path_lines.append('  ' + path_line)  # Add 2 spaces
                if '/>' in path_line:
                    break
                j += 1

            output_lines.extend(path_lines)
            output_lines.append(f"{indent})}}\n")

            wrapped_count += 1
            i = j + 1
            continue

    output_lines.append(line)
    i += 1

# Write the result
with open(tsx_path, 'w', encoding='utf-8') as f:
    f.writelines(output_lines)

print(f"Wrapped {wrapped_count} containers successfully!")
