import skillTreeConfigData from './config/skillTreeConfig.json';
import { SkillTreeConfig, SkillNode, SkillPath, TreeType, TreeConfig, SkillData } from '@/types/skills';

// Type assertion for the imported JSON
const skillTreeConfig = skillTreeConfigData as SkillTreeConfig;

// Validate configuration
function validateConfig(config: SkillTreeConfig): void {
  if (!config.version) {
    throw new Error('Config must have a version');
  }

  if (!config.maxSkillPoints || config.maxSkillPoints < 1) {
    throw new Error('Config must have a valid maxSkillPoints value');
  }

  const treeIds: TreeType[] = ['A', 'B', 'C', 'D'];

  for (const treeId of treeIds) {
    if (!config.trees[treeId]) {
      throw new Error(`Missing tree configuration for tree ${treeId}`);
    }

    const tree = config.trees[treeId];

    if (!tree.id || !tree.name || !tree.color || !tree.nodes || !tree.paths) {
      throw new Error(`Incomplete configuration for tree ${treeId}`);
    }

    // Validate each node has required fields
    for (const node of tree.nodes) {
      if (!node.id || node.maxPoints === undefined || node.pointsRequiredInTree === undefined) {
        throw new Error(`Invalid node configuration in tree ${treeId}: ${node.id}`);
      }
    }
  }
}

// Validate on module load
validateConfig(skillTreeConfig);

// Export tree configs
export const treeConfigs: Record<TreeType, TreeConfig> = skillTreeConfig.trees;

// Export flattened nodes and paths for backward compatibility
export const skillNodes: SkillNode[] = Object.values(skillTreeConfig.trees).flatMap(
  (tree) => tree.nodes
);

export const skillPaths: SkillPath[] = Object.values(skillTreeConfig.trees).flatMap(
  (tree) => tree.paths
);

// Export combined data
export const skillData: SkillData = {
  nodes: skillNodes,
  paths: skillPaths,
};

// Export full config
export { skillTreeConfig };

// Helper functions
export function getTreeConfig(treeId: TreeType): TreeConfig {
  return treeConfigs[treeId];
}

export function getVisibleTrees(): TreeType[] {
  return Object.values(treeConfigs)
    .filter((tree) => tree.visible)
    .map((tree) => tree.id);
}

export function getTreeNodes(treeId: TreeType): SkillNode[] {
  return treeConfigs[treeId].nodes;
}

export function getTreePaths(treeId: TreeType): SkillPath[] {
  return treeConfigs[treeId].paths;
}

export function getMaxSkillPoints(): number {
  return skillTreeConfig.maxSkillPoints;
}
