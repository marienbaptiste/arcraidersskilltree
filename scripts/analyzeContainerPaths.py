#!/usr/bin/env python3
"""
Properly parse SVG container paths to get actual bounding boxes
"""

import re
from pathlib import Path
from svg.path import parse_path

svg_path = Path(__file__).parent.parent / 'assets' / 'ARtreeforweb.svg'
svg_content = svg_path.read_text(encoding='utf-8')

# Get first container as example
pattern = r'<path[^>]*\s+d="([^"]+)"[^>]*inkscape:label="Tree A container node 0"'
match = re.search(pattern, svg_content)

if match:
    d_attr = match.group(1)
    print("Tree A container node 0 path:")
    print(d_attr[:150])
    print()

    # Parse using svg.path library
    try:
        path = parse_path(d_attr)
        bbox = path.bbox()
        print(f"Bounding box from svg.path library:")
        print(f"  xmin={bbox[0]:.2f}, xmax={bbox[1]:.2f}")
        print(f"  ymin={bbox[2]:.2f}, ymax={bbox[3]:.2f}")
        print(f"  width={bbox[1]-bbox[0]:.2f}, height={bbox[3]-bbox[2]:.2f}")
        print(f"  center=({(bbox[0]+bbox[1])/2:.2f}, {(bbox[2]+bbox[3])/2:.2f})")
    except Exception as e:
        print(f"svg.path failed: {e}")
        print("Will need to use manual parsing")
