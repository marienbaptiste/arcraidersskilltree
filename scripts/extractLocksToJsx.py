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

# Find lock groups with their content
# Pattern to match entire group from opening to closing tag
lock_groups = []

lines = content.split('\n')
i = 0
while i < len(lines):
    line = lines[i]

    # Look for group with "Tree X lock Y" label
    match = re.search(r'inkscape:label="Tree ([A-D]) lock ([^"]+)"', line)
    if match:
        tree_id = match.group(1)
        node_id = match.group(2)

        # Extract the entire group
        group_lines = [line]
        depth = line.count('<g') - line.count('</g>')

        j = i + 1
        while depth > 0 and j < len(lines):
            group_lines.append(lines[j])
            depth += lines[j].count('<g') - lines[j].count('</g>')
            j += 1

        group_content = '\n'.join(group_lines)

        lock_groups.append({
            'tree': tree_id,
            'node': node_id,
            'content': group_content
        })

    i += 1

print(f"Found {len(lock_groups)} lock groups")

# Convert to JSX
output_lines = []
output_lines.append('{/* All Lock Icons - 16 total across all trees */}')
output_lines.append('<g id="all-lock-icons">')

for lock in lock_groups:
    tree = lock['tree']
    node = lock['node']
    content = lock['content']

    output_lines.append(f"  {{/* Tree {tree} lock {node} */}}")

    # Clean up SVG to JSX conversion
    # Remove inkscape and sodipodi attributes
    content = re.sub(r'\s+inkscape:[^=]+="[^"]*"', '', content)
    content = re.sub(r'\s+sodipodi:[^=]+="[^"]*"', '', content)

    # Add custom ID to the main group
    content = re.sub(r'(<g\s+)', f'<g id="lock-{tree.lower()}-{node}" ', content, count=1)

    # Add visibility="hidden" to the main group
    content = re.sub(r'(<g[^>]*)(>)', r'\1 visibility="hidden"\2', content, count=1)

    # Convert style attribute values to JSX format
    def style_to_jsx(match):
        style_str = match.group(1)
        # Convert CSS properties to camelCase and wrap in object notation
        style_str = re.sub(r'mix-blend-mode', 'mixBlendMode', style_str)
        style_str = re.sub(r'fill-opacity', 'fillOpacity', style_str)
        style_str = re.sub(r'fill-rule', 'fillRule', style_str)
        style_str = re.sub(r'stroke-width', 'strokeWidth', style_str)
        style_str = re.sub(r'stroke-dasharray', 'strokeDasharray', style_str)
        style_str = re.sub(r'stroke-opacity', 'strokeOpacity', style_str)
        style_str = re.sub(r'stroke-linecap', 'strokeLinecap', style_str)
        style_str = re.sub(r'stroke-miterlimit', 'strokeMiterlimit', style_str)

        # Convert semicolon-separated CSS to comma-separated JS object
        props = []
        for prop in style_str.split(';'):
            prop = prop.strip()
            if ':' in prop:
                key, value = prop.split(':', 1)
                key = key.strip()
                value = value.strip()

                # Handle url() values
                if 'url(' in value:
                    value = f'"{value}"'
                else:
                    value = f'"{value}"'

                props.append(f'{key}: {value}')

        return f'style={{{{{", ".join(props)}}}}}'

    content = re.sub(r'style="([^"]*)"', style_to_jsx, content)

    # Indent properly
    lines = content.split('\n')
    indented_lines = []
    for line in lines:
        if line.strip():
            indented_lines.append('  ' + line)

    output_lines.append('\n'.join(indented_lines))

output_lines.append('</g>')

# Write output
with open(output_path, 'w', encoding='utf-8') as f:
    f.write('\n'.join(output_lines))

print(f"Wrote {len(lock_groups)} lock groups to {output_path}")
