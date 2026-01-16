#!/usr/bin/env python3
"""
Add visibility="hidden" to all lock groups in the SVG file
"""

import re
from pathlib import Path

svg_path = Path(__file__).parent.parent / 'assets' / 'ARtreeforweb.svg'

with open(svg_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Find all lock groups with inkscape:label="Tree X lock Y"
# and add visibility="hidden" to them
def add_visibility(match):
    group_element = match.group(0)
    # Check if visibility is already set
    if 'visibility=' in group_element:
        # Replace existing visibility
        group_element = re.sub(r'visibility="[^"]*"', 'visibility="hidden"', group_element)
    else:
        # Add visibility after the opening <g tag
        group_element = re.sub(r'(<g[^>]*)(>)', r'\1 visibility="hidden"\2', group_element, count=1)
    return group_element

# Pattern to match group elements with lock labels
# Match the entire group from <g to its closing </g>
pattern = r'<g[^>]*inkscape:label="Tree [A-D] lock [^"]*"[^>]*>.*?</g>'

content = re.sub(pattern, add_visibility, content, flags=re.DOTALL)

# Write back
with open(svg_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Added visibility='hidden' to all lock groups in SVG")
