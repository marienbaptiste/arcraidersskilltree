#!/usr/bin/env python3
"""
Complete script to add helper function and all wrapped containers
"""

import re
from pathlib import Path

# Read files
tsx_path = Path(__file__).parent.parent / 'components' / 'SkillTree.tsx'
containers_path = Path(__file__).parent / 'containers_output.txt'

with open(tsx_path, 'r', encoding='utf-8') as f:
    tsx_content = f.read()

with open(containers_path, 'r', encoding='utf-8') as f:
    containers_content = f.read()

# Step 1: Add helper function before return statement if not already present
if 'shouldShowContainer' not in tsx_content:
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
    tsx_content = tsx_content.replace('  return (', helper_function + '  return (')
    print("Added helper function")

# Step 2: Parse containers and wrap them
# Extract path elements from containers_output.txt
container_pattern = r'{/\* Tree ([A-D]) container node ([^\*]+) \*/}\s+<path\s+id="container-([a-d]-[^"]+)"\s+d="([^"]+)"\s+fill="([^"]+)"\s+stroke="([^"]+)"\s+strokeWidth="([^"]+)"\s+opacity="([^"]+)"\s+/>'

containers_matches = list(re.finditer(container_pattern, containers_content))
print(f"Found {len(containers_matches)} containers in output file")

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

# Step 3: Insert containers into the file
# Find the lock overlay closing tag and insert containers after it
lock_closing = '</g>\n\n            {/* Points container'
if lock_closing in tsx_content:
    # Replace with lock + all containers
    replacement = f"""</g>

            {{/* All Points containers - 59 total across all trees */}}
            {{/* Only show containers for nodes with maxPoints > 1 that are unlocked or have points */}}
            <g id="all-point-containers">
{all_containers}
            </g>"""

    tsx_content = tsx_content.replace('</g>\n\n            {/* Points container', replacement + '\n            {/* Old Points container')
    print("Added all wrapped containers")

# Step 4: Remove old single container if it exists
old_container_pattern = r'            {/\* Old Points container.*?</g>'
tsx_content = re.sub(old_container_pattern, '', tsx_content, flags=re.DOTALL)

# Write result
with open(tsx_path, 'w', encoding='utf-8') as f:
    f.write(tsx_content)

print("Done! Added helper function and all 59 wrapped containers")
