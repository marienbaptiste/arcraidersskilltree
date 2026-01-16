import fs from 'fs';
import path from 'path';
import { skillNodes, skillPaths } from '../data/skillData';

// Tree metadata configuration
const treeMetadata = {
  A: {
    id: 'A',
    name: 'Survival Tree',
    color: '#3b82f6',
    visible: true,
    transform: 'matrix(0.82544171,0.56448736,0.56221371,-0.82211698,81.266847,463.85256)',
  },
  B: {
    id: 'B',
    name: 'Combat Tree',
    color: '#a855f7',
    visible: true,
    transform: 'translate(221.93716, 39.335736)',
  },
  C: {
    id: 'C',
    name: 'Crafting Tree',
    color: '#06b6d4',
    visible: true,
    transform: 'translate(221.93716, 39.335736)',
  },
  D: {
    id: 'D',
    name: 'Exploration Tree',
    color: '#ec4899',
    visible: true,
    transform: 'matrix(-1,0,0,1,552.10903,48.512262)',
  },
};

// Convert nodes to JSON format with new fields
const convertedNodes = skillNodes.map((node) => ({
  ...node,
  maxPoints: 1, // Default: binary unlock (can be changed in admin)
  pointsRequiredInTree: 0, // Default: no tree point requirement
}));

// Group nodes and paths by tree
const groupByTree = () => {
  const trees: Record<string, any> = {};

  ['A', 'B', 'C', 'D'].forEach((treeId) => {
    const treeNodes = convertedNodes.filter((n) => n.tree === treeId);
    const treePaths = skillPaths.filter((p) => p.tree === treeId);

    trees[treeId] = {
      ...treeMetadata[treeId as keyof typeof treeMetadata],
      nodes: treeNodes,
      paths: treePaths,
    };
  });

  return trees;
};

// Generate final JSON structure
const config = {
  version: '1.0',
  trees: groupByTree(),
};

// Write to JSON file
const outputPath = path.join(__dirname, '..', 'data', 'config', 'skillTreeConfig.json');
const outputDir = path.dirname(outputPath);

// Create config directory if it doesn't exist
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

fs.writeFileSync(outputPath, JSON.stringify(config, null, 2), 'utf-8');

console.log(`✅ Migration complete! JSON written to: ${outputPath}`);
console.log(`📊 Stats:`);
console.log(`  - Total nodes: ${convertedNodes.length}`);
console.log(`  - Total paths: ${skillPaths.length}`);
console.log(`  - Trees: ${Object.keys(config.trees).length}`);
console.log(`  - Tree A nodes: ${config.trees.A.nodes.length}`);
console.log(`  - Tree B nodes: ${config.trees.B.nodes.length}`);
console.log(`  - Tree C nodes: ${config.trees.C.nodes.length}`);
console.log(`  - Tree D nodes: ${config.trees.D.nodes.length}`);
