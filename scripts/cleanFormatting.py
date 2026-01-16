#!/usr/bin/env python3
"""
Clean up extra blank lines in container formatting
"""

import re
from pathlib import Path

# Read the SkillTree.tsx file
tsx_path = Path(__file__).parent.parent / 'components' / 'SkillTree.tsx'
with open(tsx_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix pattern: remove extra blank lines within shouldShowContainer blocks
# Pattern: blank lines between attributes in path elements
content = re.sub(r'(\s+id="[^"]+")(\n\s*\n\s+)(d=")', r'\1\n\2', content)
content = re.sub(r'(d="[^"]+")(\n\s*\n\s+)(fill=)', r'\1\n\2', content)
content = re.sub(r'(fill="[^"]+")(\n\s*\n\s+)(stroke=)', r'\1\n\2', content)
content = re.sub(r'(stroke="[^"]+")(\n\s*\n\s+)(strokeWidth=)', r'\1\n\2', content)
content = re.sub(r'(strokeWidth="[^"]+")(\n\s*\n\s+)(opacity=)', r'\1\n\2', content)
content = re.sub(r'(opacity="[^"]+")(\n\s*\n\s+)(/>)', r'\1\n\2', content)

# Remove double blank lines
while '\n\n\n' in content:
    content = content.replace('\n\n\n', '\n\n')

# Write back
with open(tsx_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Formatting cleaned!")
