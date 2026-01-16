#!/usr/bin/env python3
"""
Script to wrap all container paths with conditional rendering - FIXED VERSION
"""

import re
from pathlib import Path

# Read the SkillTree.tsx file
tsx_path = Path(__file__).parent.parent / 'components' / 'SkillTree.tsx'
with open(tsx_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Pattern to match unwrapped containers - matches across multiple lines
# Looking for: comment + path element (not already wrapped)
pattern = r'(              ){/\* Tree ([A-D]) container node ([^*]+) \*/}\s+<path\s+(id="container-[a-d][^"]*"\s+d="[^"]+"\s+fill="[^"]+"\s+stroke="[^"]+"\s+strokeWidth="[^"]+"\s+opacity="[^"]+"\s+/>)'

def replace_container(match):
    indent = match.group(1)
    tree = match.group(2)
    node_id = match.group(3).strip()
    path_element = match.group(4)

    # Create the skill ID
    skill_id = f"{tree}-{node_id}"

    # Create wrapped version preserving exact path element
    wrapped = f'''{indent}{{/* Tree {tree} container node {node_id} */}}
{indent}{{shouldShowContainer('{skill_id}') && (
{indent}  <{path_element.replace('/>', '')}
{indent}  />
{indent})}}'''

    return wrapped

# Find all matches
matches = list(re.finditer(pattern, content, re.MULTILINE))
print(f"Found {len(matches)} unwrapped containers")

# Replace
new_content = re.sub(pattern, replace_container, content, flags=re.MULTILINE)

# Write
if matches:
    with open(tsx_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print(f"Wrapped {len(matches)} containers!")
else:
    print("No unwrapped containers found")
