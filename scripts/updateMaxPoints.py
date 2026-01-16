#!/usr/bin/env python3
"""
Update maxPoints for all nodes that have containers
"""

import json
from pathlib import Path

config_path = Path(__file__).parent.parent / 'data' / 'config' / 'skillTreeConfig.json'

with open(config_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

# Node IDs that have containers (from containers_output.txt)
# These are the simplified IDs without "tree-" prefix
container_nodes = [
    # Tree A
    '0', '2-1', '2-2', '2-3', '2-4', '2-5', '1-3', '3-1', '1-4', '1-1', '1-5', '3-2', '1-6-3-3', '1-2', '2-6-3-3',
    # Tree B
    '0', '1-1', '1-2', '2-1', '2-2', '2-3', '1-3', '3-1', '2-4', '2-5', '3-2', '1-5', '1-6-3-3', '2-6-3-3', '1-4',
    # Tree C
    '0', '2-1', '2-2', '1-1', '1-3', '2-3', '2-6-3-3', '1-6-3-3', '1-5', '1-4', '3-2', '3-1', '2-4', '2-5', '1-2',
    # Tree D
    '0', '1-1', '1-2', '1-3', '2-1', '2-2', '2-4', '2-3', '1-4', '3-1', '2-5', '3-2', '1-6-3-3', '2-6-3-3', '1-5'
]

# Update maxPoints for each tree
for tree_id in ['A', 'B', 'C', 'D']:
    for node in data['trees'][tree_id]['nodes']:
        # Extract the simplified ID from the full node ID (e.g., "tree-a-node-0" -> "0")
        node_suffix = node['id'].replace(f'tree-{tree_id.lower()}-node-', '')

        # Set maxPoints to 5 for nodes with containers (to make them visible)
        if node_suffix in container_nodes:
            node['maxPoints'] = 5
            print(f"Updated {tree_id}-{node_suffix} to maxPoints: 5")

# Write updated config
with open(config_path, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2)

print(f"\nDone! Updated configuration with maxPoints for all container nodes")
