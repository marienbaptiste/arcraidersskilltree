#!/usr/bin/env python3
"""
Replace the point numbers layer in SkillTree.tsx
"""

from pathlib import Path

# Read the TSX file
tsx_path = Path(__file__).parent.parent / 'components' / 'SkillTree.tsx'
tsx_content = tsx_path.read_text(encoding='utf-8')

# Find and remove the old point numbers layer
# Look for the comment "Top Layer: Point Numbers" up to the closing </svg>
import re

# Pattern to match the entire point numbers SVG layer
pattern = r'\s*\{/\* Top Layer: Point Numbers.*?\n\s*</svg>'
match = re.search(pattern, tsx_content, re.DOTALL)

if match:
    print(f"Found old point numbers layer at position {match.start()}-{match.end()}")
    # Remove the old layer
    tsx_content = tsx_content[:match.start()] + tsx_content[match.end():]
    print("Removed old point numbers layer")
else:
    print("No existing point numbers layer found")

# Now find where to insert the new layer (after locks </svg>, before </div>)
lines = tsx_content.split('\n')

# Find the closing </svg> tag for locks layer
insert_index = None
for i in range(len(lines) - 2):
    if (lines[i].strip() == '</svg>' and
        lines[i+1].strip() == '' and
        lines[i+2].strip() == '</div>'):
        insert_index = i + 1  # Insert after the </svg> line
        print(f"Found insertion point at line {i+1}")
        break

if insert_index is None:
    print("ERROR: Could not find insertion point")
    exit(1)

# Read the new point numbers TSX
point_numbers_path = Path(__file__).parent / 'point_numbers_tsx.txt'
point_numbers_content = point_numbers_path.read_text(encoding='utf-8')

# Insert the new content
lines.insert(insert_index, '')
lines.insert(insert_index + 1, '          ' + point_numbers_content.replace('\n', '\n          ').rstrip())

# Join and write
new_content = '\n'.join(lines)
tsx_path.write_text(new_content, encoding='utf-8')

print(f"[OK] Replaced point numbers layer in SkillTree.tsx")
