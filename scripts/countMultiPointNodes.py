#!/usr/bin/env python3
import json
from pathlib import Path

config_path = Path(__file__).parent.parent / 'data' / 'config' / 'skillTreeConfig.json'
with open(config_path) as f:
    data = json.load(f)

nodes = [n for tree in data['trees'].values() for n in tree['nodes']]
multi_point = [n for n in nodes if n['maxPoints'] > 1]

print(f'Total nodes with maxPoints > 1: {len(multi_point)}')
print('\nTree breakdown:')
for tree_id in ['A','B','C','D']:
    count = sum(1 for n in data['trees'][tree_id]['nodes'] if n['maxPoints'] > 1)
    print(f'  Tree {tree_id}: {count} nodes')

print(f'\nList of multi-point nodes:')
for tree_id in ['A','B','C','D']:
    tree_nodes = [n for n in data['trees'][tree_id]['nodes'] if n['maxPoints'] > 1]
    if tree_nodes:
        print(f'\n  Tree {tree_id}:')
        for n in tree_nodes:
            print(f'    {n["id"]} (maxPoints: {n["maxPoints"]})')
