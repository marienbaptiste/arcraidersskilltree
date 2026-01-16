#!/usr/bin/env python3
"""
Convert lock icons style attributes from strings to JSX objects
"""

import re
from pathlib import Path

locks_path = Path(__file__).parent / 'locks_output.txt'

with open(locks_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Function to convert CSS string to JSX object
def css_to_jsx_object(css_string):
    # Split by semicolon and process each property
    properties = []
    for prop in css_string.split(';'):
        prop = prop.strip()
        if ':' in prop:
            key, value = prop.split(':', 1)
            key = key.strip()
            value = value.strip()

            # Convert kebab-case to camelCase
            key = re.sub(r'-([a-z])', lambda m: m.group(1).upper(), key)

            # Handle special cases
            if key == 'filter' and 'url(' in value:
                # Keep filter values as strings
                properties.append(f'{key}: "{value}"')
            elif value in ['none', 'inline', 'normal', 'round', 'nonzero']:
                # Keep certain values as strings
                properties.append(f'{key}: "{value}"')
            elif value.replace('.', '').replace('-', '').isdigit():
                # Numeric values
                properties.append(f'{key}: {value}')
            else:
                # String values
                properties.append(f'{key}: "{value}"')

    return '{{ ' + ', '.join(properties) + ' }}'

# Convert style="..." to style={{...}}
def convert_style(match):
    css_string = match.group(1)
    jsx_object = css_to_jsx_object(css_string)
    return f'style={jsx_object}'

# Replace all style attributes
content = re.sub(r'style="([^"]*)"', convert_style, content)

# Write back
with open(locks_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Converted all style attributes to JSX format")
