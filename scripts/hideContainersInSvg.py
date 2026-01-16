#!/usr/bin/env python3
"""
Add visibility="hidden" to all container paths in the SVG file
"""

import re
from pathlib import Path

svg_path = Path(__file__).parent.parent / 'assets' / 'ARtreeforweb.svg'

with open(svg_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Find all container paths with inkscape:label="Tree X container node Y"
# and add visibility="hidden" to them
def add_visibility(match):
    path_element = match.group(0)
    # Check if visibility is already set
    if 'visibility=' in path_element:
        # Replace existing visibility
        path_element = re.sub(r'visibility="[^"]*"', 'visibility="hidden"', path_element)
    else:
        # Add visibility before the closing />
        path_element = path_element.replace(' />', ' visibility="hidden" />')
    return path_element

# Pattern to match path elements with container labels
pattern = r'<path[^>]*inkscape:label="Tree [A-D] container node [^"]*"[^>]*/?>'

content = re.sub(pattern, add_visibility, content)

# Write back
with open(svg_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Added visibility='hidden' to all container paths in SVG")
