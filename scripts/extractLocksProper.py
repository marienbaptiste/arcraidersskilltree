#!/usr/bin/env python3
"""
Extract all lock icon groups from SVG and convert to React JSX
"""

import re
from pathlib import Path

svg_path = Path(__file__).parent.parent / 'assets' / 'ARtreeforweb.svg'
output_path = Path(__file__).parent / 'locks_output.txt'

with open(svg_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Find all lock groups - they're simple groups with ellipse, rect, and path children
pattern = r'<g[^>]*inkscape:label="Tree ([A-D]) lock ([^"]+)"[^>]*>.*?</g>'
matches = re.finditer(pattern, content, re.DOTALL)

locks = []
for match in matches:
    tree_id = match.group(1)
    node_id = match.group(2)
    group_content = match.group(0)

    locks.append({
        'tree': tree_id,
        'node': node_id,
        'content': group_content
    })

print(f"Found {len(locks)} lock groups")

# Write to output file
with open(output_path, 'w', encoding='utf-8') as f:
    f.write('{/* All Lock Icons - 16 total across all trees */}\n')
    f.write('<g id="all-lock-icons">\n')

    for lock in locks:
        tree = lock['tree']
        node = lock['node']
        content = lock['content']

        f.write(f'  {{/* Tree {tree} lock {node} */}}\n')

        # Clean up the content
        # Remove inkscape-specific attributes
        content = re.sub(r'\s+inkscape:label="[^"]*"', '', content)
        content = re.sub(r'\s+sodipodi:[^=]+="[^"]*"', '', content)

        # Update the main group ID and add visibility
        content = re.sub(
            r'<g\s+id="[^"]*"',
            f'<g id="lock-{tree.lower()}-{node}" visibility="hidden"',
            content,
            count=1
        )

        # Convert kebab-case attributes to camelCase for React
        content = re.sub(r'stroke-width', 'strokeWidth', content)
        content = re.sub(r'stroke-dasharray', 'strokeDasharray', content)
        content = re.sub(r'stroke-opacity', 'strokeOpacity', content)
        content = re.sub(r'stroke-linecap', 'strokeLinecap', content)
        content = re.sub(r'stroke-miterlimit', 'strokeMiterlimit', content)
        content = re.sub(r'fill-opacity', 'fillOpacity', content)
        content = re.sub(r'fill-rule', 'fillRule', content)
        content = re.sub(r'mix-blend-mode', 'mixBlendMode', content)

        # Indent the content
        lines = content.split('\n')
        indented = []
        for line in lines:
            if line.strip():
                indented.append('  ' + line)
            else:
                indented.append(line)

        f.write('\n'.join(indented))
        f.write('\n\n')

    f.write('</g>\n')

print(f"Wrote {len(locks)} lock groups to {output_path}")
