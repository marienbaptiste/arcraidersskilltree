#!/usr/bin/env python3
"""
Remove the old/duplicate point numbers layer (the first one)
"""

from pathlib import Path

tsx_path = Path(__file__).parent.parent / 'components' / 'SkillTree.tsx'
lines = tsx_path.read_text(encoding='utf-8').split('\n')

# Find the FIRST occurrence of "Top Layer: Point Numbers" (line 1665)
# and remove from there until its closing </svg> tag

first_start = None
first_end = None

for i, line in enumerate(lines):
    if 'Top Layer: Point Numbers' in line and first_start is None:
        first_start = i
        print(f"Found first Point Numbers layer at line {i+1}")

        # Find its closing </svg> tag
        svg_depth = 0
        for j in range(i, len(lines)):
            if '<svg' in lines[j]:
                svg_depth += 1
            if '</svg>' in lines[j]:
                svg_depth -= 1
                if svg_depth == 0:
                    first_end = j
                    print(f"Found closing </svg> at line {j+1}")
                    break
        break

if first_start is not None and first_end is not None:
    # Remove lines from first_start to first_end (inclusive)
    # But keep any blank lines before to maintain structure

    # Check if there's a blank line before
    if first_start > 0 and lines[first_start - 1].strip() == '':
        start_delete = first_start - 1
    else:
        start_delete = first_start

    print(f"Removing lines {start_delete+1} to {first_end+1}")

    # Remove the lines
    del lines[start_delete:first_end+1]

    # Write back
    tsx_path.write_text('\n'.join(lines), encoding='utf-8')
    print(f"[OK] Removed old point numbers layer ({first_end - start_delete + 1} lines)")
else:
    print("ERROR: Could not find first Point Numbers layer")
