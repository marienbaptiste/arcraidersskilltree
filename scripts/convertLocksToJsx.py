#!/usr/bin/env python3
"""
Convert lock icons from SVG format to React JSX format
"""

import re
from pathlib import Path

locks_path = Path(__file__).parent / 'locks_output.txt'

with open(locks_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Convert svg: namespace to regular elements
content = re.sub(r'<svg:(\w+)', r'<\1', content)
content = re.sub(r'</svg:(\w+)>', r'</\1>', content)

# Remove xmlns declarations
content = re.sub(r'\s+xmlns:\w+="[^"]*"', '', content)

# Convert style attributes to React format (camelCase)
def convert_style_to_react(match):
    style_content = match.group(1)
    # Convert kebab-case to camelCase
    style_content = re.sub(r'mix-blend-mode', 'mixBlendMode', style_content)
    style_content = re.sub(r'fill-opacity', 'fillOpacity', style_content)
    style_content = re.sub(r'fill-rule', 'fillRule', style_content)
    style_content = re.sub(r'stroke-width', 'strokeWidth', style_content)
    style_content = re.sub(r'stroke-dasharray', 'strokeDasharray', style_content)
    style_content = re.sub(r'stroke-opacity', 'strokeOpacity', style_content)
    style_content = re.sub(r'stroke-linecap', 'strokeLinecap', style_content)
    style_content = re.sub(r'stroke-miterlimit', 'strokeMiterlimit', style_content)

    return f'style={{{{{style_content}}}}}'

content = re.sub(r'style="([^"]*)"', convert_style_to_react, content)

# Convert filter references
content = re.sub(r'filter:url\(#([^)]+)\)', r'filter: "url(#\1)"', content)

# Write back
with open(locks_path, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Converted lock icons to React JSX format")
