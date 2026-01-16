#!/usr/bin/env python3
"""
Insert point numbers layer into SkillTree.tsx after the locks layer
"""

from pathlib import Path

# Read the TSX file
tsx_path = Path(__file__).parent.parent / 'components' / 'SkillTree.tsx'
tsx_content = tsx_path.read_text(encoding='utf-8')

# Read the point numbers TSX
point_numbers_path = Path(__file__).parent / 'point_numbers_tsx.txt'
point_numbers_content = point_numbers_path.read_text(encoding='utf-8')

# Find the insertion point (after the locks </svg> tag, before </div>)
# Looking for the line "          </svg>" that closes the locks layer
# followed by blank lines and then "        </div>"

# Split into lines
lines = tsx_content.split('\n')

# Find the closing </svg> tag for locks layer (should be around line 1662)
# Look for a line that is "          </svg>" followed by one or more blank lines and "</div>"
insert_index = None
for i in range(len(lines) - 2):
    if lines[i].strip() == '</svg>':
        # Check if followed by blanks and then </div>
        j = i + 1
        while j < len(lines) and lines[j].strip() == '':
            j += 1
        if j < len(lines) and lines[j].strip() == '</div>':
            insert_index = i + 1  # Insert after the </svg> line
            print(f"Found closing locks </svg> at line {i+1}")
            break

if insert_index is None:
    print("ERROR: Could not find insertion point (looking for </svg> followed by blank(s) and </div>)")
    exit(1)

print(f"Found insertion point at line {insert_index}")

# Insert the point numbers content
# Add a blank line, then the content
lines.insert(insert_index, '')
lines.insert(insert_index + 1, '          ' + point_numbers_content.replace('\n', '\n          ').rstrip())

# Join back and write
new_content = '\n'.join(lines)
tsx_path.write_text(new_content, encoding='utf-8')

print(f"[OK] Inserted point numbers layer into SkillTree.tsx")
print(f"  Added {len(point_numbers_content.split(chr(10)))} lines after line 1662")
