export type SkillState = 'locked' | 'available' | 'unlocked';

export type TreeType = 'A' | 'B' | 'C' | 'D';

export interface SkillNode {
  id: string; // e.g., "tree-a-node-0", "tree-b-node-1-1"
  svgId: string; // Original SVG element ID e.g., "path3-4"
  name: string;
  description: string;
  tree: TreeType;
  branch: number; // 0, 1, 2, 3 (main branches)
  position: number; // Position in branch (0, 1-1, 1-2, etc.)
  tier: number; // Depth level in tree
  prerequisites: string[] | string[][]; // Array of skill IDs (AND) or array of arrays (OR groups)
  iconPath?: string; // Path to PNG icon
  x: number; // SVG coordinate
  y: number; // SVG coordinate
  radius: number; // Node circle radius
  isKeyNode: boolean; // Larger nodes (r=13.517313) are key nodes
  maxPoints?: number; // Maximum points that can be allocated to this skill
  pointsRequiredInTree?: number; // Total points required in tree before this skill can be unlocked
  comment?: string; // Optional comment shown in tooltip
}

export interface SkillPath {
  id: string;
  svgId: string;
  from: string; // Skill node ID
  to: string; // Skill node ID
  tree: TreeType;
}

export interface TreeConfig {
  id: TreeType;
  name: string;
  color: string;
  visible: boolean;
  transform: string;
  nodes: SkillNode[];
  paths: SkillPath[];
}

export interface SkillTreeConfig {
  version: string;
  maxSkillPoints: number;
  trees: Record<TreeType, TreeConfig>;
}

export interface SkillTreeState {
  skillPoints: Map<string, number>; // Maps skill ID to point count
  hoveredSkill: string | null;
}

export interface SkillData {
  nodes: SkillNode[];
  paths: SkillPath[];
}

// Helper type for skill actions
export type SkillAction =
  | { type: 'ADD_POINT'; skillId: string }
  | { type: 'REMOVE_POINT'; skillId: string }
  | { type: 'SET_POINTS'; skillId: string; points: number }
  | { type: 'RESET_ALL' }
  | { type: 'HOVER_SKILL'; skillId: string | null }
  | { type: 'LOAD_STATE'; skillPoints: Record<string, number> };
