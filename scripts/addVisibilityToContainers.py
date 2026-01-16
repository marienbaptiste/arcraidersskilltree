#!/usr/bin/env python3
"""
Add visibility="hidden" to all containers in containers_output.txt
"""

from pathlib import Path

containers_path = Path(__file__).parent / 'containers_output.txt'

with open(containers_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace opacity="1" with opacity="0" and add visibility="hidden"
content = content.replace('opacity="1"\n  />', 'opacity="0"\n    visibility="hidden"\n  />')

with open(containers_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Added visibility='hidden' and set opacity='0' to all containers")
