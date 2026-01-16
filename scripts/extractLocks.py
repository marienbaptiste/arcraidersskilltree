#!/usr/bin/env python3
"""
Extract all lock icon groups from the SVG file
"""

import re
from pathlib import Path
import xml.etree.ElementTree as ET

svg_path = Path(__file__).parent.parent / 'assets' / 'ARtreeforweb.svg'
output_path = Path(__file__).parent / 'locks_output.txt'

# Read SVG
with open(svg_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Register namespaces
namespaces = {
    'svg': 'http://www.w3.org/2000/svg',
    'inkscape': 'http://www.inkscape.org/namespaces/inkscape'
}

for prefix, uri in namespaces.items():
    ET.register_namespace(prefix, uri)

# Parse SVG
tree = ET.parse(svg_path)
root = tree.getroot()

locks = []

# Find all groups with lock labels (but not the parent "Lock" group)
for g in root.iter('{http://www.w3.org/2000/svg}g'):
    label = g.get('{http://www.inkscape.org/namespaces/inkscape}label', '')

    # Match "Tree X lock Y" pattern
    match = re.match(r'Tree ([A-D]) lock (.+)', label)
    if match:
        tree_id = match.group(1)
        node_id = match.group(2)

        # Convert group to string
        g_str = ET.tostring(g, encoding='unicode')

        locks.append({
            'tree': tree_id,
            'node': node_id,
            'label': label,
            'content': g_str
        })

print(f"Found {len(locks)} lock icons")

# Write to output file
with open(output_path, 'w', encoding='utf-8') as f:
    f.write('<g id="all-lock-icons">\n')

    for lock in locks:
        tree = lock['tree']
        node = lock['node']
        skill_id = f"{tree}-{node}"

        f.write(f"  {{/* Tree {tree} lock {node} */}}\n")

        # Clean up the group content - remove inkscape-specific attributes and add our ID
        content = lock['content']

        # Remove inkscape attributes
        content = re.sub(r'\s+inkscape:[^=]+="[^"]*"', '', content)
        content = re.sub(r'\s+sodipodi:[^=]+="[^"]*"', '', content)

        # Add our custom ID and conditional rendering
        content = re.sub(r'<g\s+', f'<g id="lock-{skill_id.lower()}" ', content, count=1)

        # Add visibility hidden
        content = re.sub(r'(<g[^>]*)', r'\1 visibility="hidden"', content, count=1)

        # Indent the content
        lines = content.split('\n')
        indented = '\n'.join('  ' + line if line.strip() else line for line in lines)

        f.write(indented)
        f.write('\n')

    f.write('</g>\n')

print(f"Wrote {len(locks)} lock icons to {output_path}")
